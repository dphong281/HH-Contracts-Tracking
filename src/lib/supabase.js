import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY. Kiểm tra file .env ở thư mục gốc project.'
  )
}

// persistSession: false — CỐ Ý không lưu phiên đăng nhập qua localStorage.
// Mỗi lần mở lại app (đóng tab, F5, mở trình duyệt mới...) sẽ luôn phải đăng nhập lại,
// chỉ email được nhớ sẵn (xem src/pages/Login.jsx) — theo đúng yêu cầu bảo mật.
// Trong lúc đang dùng app (không đóng/mở lại tab), phiên vẫn hoạt động bình thường,
// không bị tự đăng xuất giữa chừng.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
})
