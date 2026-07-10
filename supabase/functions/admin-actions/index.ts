// Edge Function: admin-actions
// Chạy phía server Supabase — giữ service role key an toàn, KHÔNG BAO GIỜ lộ ra frontend.
// Xử lý 2 thao tác chỉ admin mới được làm: tạo tài khoản mới, đặt lại mật khẩu cho người khác.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Supabase gần đây đổi từ biến SUPABASE_SERVICE_ROLE_KEY sang SUPABASE_SECRET_KEYS (dạng JSON)
// cho các project mới — hàm này tự nhận diện, dùng được cả 2 kiểu.
function getServiceRoleKey() {
  const direct = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (direct) return direct
  const secretsRaw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (secretsRaw) {
    try {
      const parsed = JSON.parse(secretsRaw)
      return parsed.default || Object.values(parsed)[0]
    } catch (_e) {
      return null
    }
  }
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Thiếu Authorization header')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = getServiceRoleKey()
    if (!serviceKey) throw new Error('Không tìm thấy service role key trên server')

    // Client theo quyền của người gọi — dùng để xác thực và kiểm tra vai trò admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await callerClient.auth.getUser()
    if (userErr || !userData?.user) throw new Error('Không xác thực được người gọi')

    const { data: profile, error: profileErr } = await callerClient
      .from('tai_khoan')
      .select('vai_tro')
      .eq('id', userData.user.id)
      .single()
    if (profileErr || profile?.vai_tro !== 'admin') {
      throw new Error('Chỉ admin mới được thực hiện thao tác này')
    }

    // Client quyền admin (service role) — chỉ dùng SAU khi đã xác nhận người gọi là admin ở trên
    const adminClient = createClient(supabaseUrl, serviceKey)

    const body = await req.json()

    // ---------- TẠO TÀI KHOẢN MỚI ----------
    if (body.type === 'create_user') {
      const { email, password, ho_ten, so_dien_thoai, vai_tro } = body
      if (!email || !password || !ho_ten) throw new Error('Thiếu thông tin bắt buộc')
      if (password.length < 6) throw new Error('Mật khẩu cần tối thiểu 6 ký tự')

      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { ho_ten },
      })
      if (createErr) throw createErr

      // Trigger DB đã tự tạo hàng trong tai_khoan — cập nhật thêm SĐT + vai trò
      const { error: updateErr } = await adminClient
        .from('tai_khoan')
        .update({ so_dien_thoai: so_dien_thoai || null, vai_tro: vai_tro || 'nhan_vien', ho_ten })
        .eq('id', created.user.id)
      if (updateErr) throw updateErr

      return new Response(JSON.stringify({ ok: true, user_id: created.user.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ---------- ĐẶT LẠI MẬT KHẨU CHO NGƯỜI KHÁC ----------
    if (body.type === 'reset_password') {
      const { user_id, new_password, yeu_cau_id } = body
      if (!user_id || !new_password) throw new Error('Thiếu thông tin bắt buộc')
      if (new_password.length < 6) throw new Error('Mật khẩu cần tối thiểu 6 ký tự')

      const { error: resetErr } = await adminClient.auth.admin.updateUserById(user_id, {
        password: new_password,
      })
      if (resetErr) throw resetErr

      if (yeu_cau_id) {
        await adminClient
          .from('yeu_cau_ho_tro')
          .update({
            trang_thai: 'da_xu_ly',
            xu_ly_boi: userData.user.id,
            xu_ly_luc: new Date().toISOString(),
          })
          .eq('id', yeu_cau_id)
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    throw new Error('Loại thao tác không hợp lệ')
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
