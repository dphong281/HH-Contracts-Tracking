import { supabase } from './supabase'

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`

async function callAdminFunction(payload) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Chưa đăng nhập')

  const res = await fetch(FUNCTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.ok) throw new Error(json.error || 'Có lỗi xảy ra, thử lại sau.')
  return json
}

export function adminCreateUser({ email, password, ho_ten, so_dien_thoai, vai_tro }) {
  return callAdminFunction({ type: 'create_user', email, password, ho_ten, so_dien_thoai, vai_tro })
}

export function adminResetPassword({ user_id, new_password, yeu_cau_id }) {
  return callAdminFunction({ type: 'reset_password', user_id, new_password, yeu_cau_id })
}
