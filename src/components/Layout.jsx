import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Tổng quan', icon: IconGrid, end: true },
  { to: '/hop-dong', label: 'Hợp đồng', icon: IconDoc },
  { to: '/du-doan', label: 'Dự đoán', icon: IconTrendingUp },
  { to: '/khach-hang', label: 'Khách hàng', icon: IconUsers },
  { to: '/cong-no', label: 'Công nợ', icon: IconWallet },
  { to: '/nhan-vien', label: 'Nhân viên', icon: IconBadge },
  { to: '/nhat-ky', label: 'Nhật ký hoạt động', icon: IconClock },
  { to: '/cai-dat', label: 'Cài đặt', icon: IconSettings },
]

export default function Layout({ children }) {
  const { hoTen, signOut } = useAuth()

  return (
    <div className="h-screen flex overflow-hidden">
      <aside className="w-64 shrink-0 h-full overflow-y-auto bg-[var(--color-ink)] text-white flex flex-col">
        <div className="px-6 py-6 border-b border-white/10">
          <div className="text-[11px] tracking-[0.2em] text-[var(--color-amber)] font-semibold uppercase">
            Hoang Ha
          </div>
          <div className="font-display text-xl font-semibold leading-tight mt-1">
            Contract Manager
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
                  isActive
                    ? 'bg-[var(--color-amber)] text-[var(--color-ink)] shadow-sm'
                    : 'text-white/75 hover:bg-white/10 hover:text-white hover:translate-x-0.5'
                }`
              }
            >
              <span className="transition-transform duration-200 group-hover:scale-110">
                <Icon />
              </span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="min-w-0">
              <div className="text-xs text-white/40">Đang đăng nhập</div>
              <div className="text-sm font-medium truncate">{hoTen || '—'}</div>
            </div>
            <button
              onClick={signOut}
              className="shrink-0 text-xs text-white/60 hover:text-white px-2 py-1.5 rounded-md hover:bg-white/10 transition-all duration-150 active:scale-95 cursor-pointer"
              title="Đăng xuất"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 h-full overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  )
}

function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  )
}
function IconDoc() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  )
}
function IconTrendingUp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  )
}
function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17.5" cy="9" r="2.4" /><path d="M15.8 14a5.2 5.2 0 0 1 5.2 5.2" />
    </svg>
  )
}
function IconWallet() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" />
      <path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2z" />
      <circle cx="17" cy="14" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}
function IconBadge() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="12" cy="10" r="2.5" />
      <path d="M7.5 17c1-2.2 2.7-3.2 4.5-3.2s3.5 1 4.5 3.2" />
    </svg>
  )
}
function IconClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />
    </svg>
  )
}
function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
  
}
