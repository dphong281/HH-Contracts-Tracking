import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = đang kiểm tra, null = chưa đăng nhập
  const [hoTen, setHoTen] = useState('')
  const [vaiTro, setVaiTro] = useState('nhan_vien')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setHoTen('')
      setVaiTro('nhan_vien')
      return
    }
    supabase
      .from('tai_khoan')
      .select('ho_ten, vai_tro')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setHoTen(data?.ho_ten || session.user.email)
        setVaiTro(data?.vai_tro || 'nhan_vien')
      })
  }, [session])

  async function signIn(email, password) {
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (!result.error) {
      try {
        localStorage.setItem('qlhd_last_email', email)
      } catch (_e) {
        // localStorage có thể bị chặn (chế độ ẩn danh) — bỏ qua, không quan trọng
      }
    }
    return result
  }

  async function signOut() {
    return supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user || null,
        hoTen,
        vaiTro,
        isAdmin: vaiTro === 'admin',
        loading: session === undefined,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
