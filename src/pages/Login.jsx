import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { createYeuCauQuenMatKhau } from '../lib/queries'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const [forgotOpen, setForgotOpen] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('qlhd_last_email')
      if (saved) setEmail(saved)
    } catch (_e) {
      // bỏ qua nếu trình duyệt chặn localStorage
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Email hoặc mật khẩu không đúng.'
          : error.message
      )
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-[11px] tracking-[0.2em] text-[var(--color-amber-dark)] font-semibold uppercase">
            Hoàng Hà
          </div>
          <div className="font-display text-2xl font-semibold text-[var(--color-ink)] mt-1">
            Theo dõi Hợp đồng Đầu ra
          </div>
        </div>

        {!forgotOpen ? (
          <>
            <form
              onSubmit={handleSubmit}
              className="bg-white border border-[var(--color-line)] rounded-2xl p-6 space-y-4"
            >
              <h1 className="font-display text-lg font-semibold text-[var(--color-ink)]">Đăng nhập</h1>

              <label className="block">
                <span className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Email</span>
                <input
                  type="email"
                  required
                  autoFocus={!email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-line)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-amber)]/50 focus:border-[var(--color-amber)]"
                />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Mật khẩu</span>
                <input
                  type="password"
                  required
                  autoFocus={!!email}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-line)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-amber)]/50 focus:border-[var(--color-amber)]"
                />
              </label>

              {error && (
                <div className="rounded-lg bg-[var(--color-danger)]/8 border border-[var(--color-danger)]/20 text-[var(--color-danger)] text-sm px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-[var(--color-ink)] text-white hover:bg-[var(--color-ink-2)] disabled:opacity-50"
              >
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>

              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="w-full text-center text-sm text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:underline"
              >
                Quên mật khẩu?
              </button>
            </form>

            <p className="text-xs text-center text-[var(--color-text-muted)] mt-4">
              Chưa có tài khoản? Liên hệ quản trị viên để được tạo tài khoản.
            </p>
          </>
        ) : (
          <ForgotPasswordForm defaultEmail={email} onBack={() => setForgotOpen(false)} />
        )}
      </div>
    </div>
  )
}

function ForgotPasswordForm({ defaultEmail, onBack }) {
  const [email, setEmail] = useState(defaultEmail || '')
  const [soDienThoai, setSoDienThoai] = useState('')
  const [ghiChu, setGhiChu] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await createYeuCauQuenMatKhau({ email, so_dien_thoai: soDienThoai, ghi_chu: ghiChu })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="bg-white border border-[var(--color-line)] rounded-2xl p-6 text-center space-y-3">
        <div className="text-2xl">✓</div>
        <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">Đã gửi yêu cầu</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Admin sẽ liên hệ qua số điện thoại bạn cung cấp để xác nhận và đặt lại mật khẩu.
        </p>
        <button
          onClick={onBack}
          className="text-sm text-[var(--color-ink)] hover:underline font-medium"
        >
          ← Quay lại đăng nhập
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-[var(--color-line)] rounded-2xl p-6 space-y-4"
    >
      <div>
        <h1 className="font-display text-lg font-semibold text-[var(--color-ink)]">Quên mật khẩu</h1>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Gửi yêu cầu tới admin — admin sẽ gọi điện xác nhận qua số điện thoại rồi đặt lại mật khẩu cho bạn.
        </p>
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Email tài khoản *</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--color-line)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-amber)]/50 focus:border-[var(--color-amber)]"
        />
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Số điện thoại *</span>
        <input
          type="tel"
          required
          placeholder="Để admin gọi xác nhận danh tính"
          value={soDienThoai}
          onChange={(e) => setSoDienThoai(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--color-line)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-amber)]/50 focus:border-[var(--color-amber)]"
        />
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Ghi chú (không bắt buộc)</span>
        <textarea
          rows={2}
          value={ghiChu}
          onChange={(e) => setGhiChu(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--color-line)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-amber)]/50 focus:border-[var(--color-amber)]"
        />
      </label>

      {error && (
        <div className="rounded-lg bg-[var(--color-danger)]/8 border border-[var(--color-danger)]/20 text-[var(--color-danger)] text-sm px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-[var(--color-line)] hover:bg-black/5"
        >
          Quay lại
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-[var(--color-amber)] text-[var(--color-ink)] hover:bg-[var(--color-amber-dark)] hover:text-white disabled:opacity-50"
        >
          {loading ? 'Đang gửi...' : 'Gửi yêu cầu'}
        </button>
      </div>
    </form>
  )
}
