export function Card({ children, className = '' }) {
  return (
    <div className={`bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl transition-shadow duration-200 ${className}`}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, accent = false }) {
  return (
    <Card className="p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
        {label}
      </div>
      <div
        className={`font-display text-2xl font-semibold mt-2 ${
          accent ? 'text-[var(--color-amber-dark)]' : 'text-[var(--color-ink)]'
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-[var(--color-text-muted)] mt-1">{sub}</div>}
    </Card>
  )
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const base =
    'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ' +
    'transition-all duration-150 ease-out ' +
    'active:scale-[0.97] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-amber)]/50 focus-visible:ring-offset-2 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer'
  const variants = {
    primary:
      'bg-[var(--color-ink)] text-white shadow-sm ' +
      'hover:bg-[var(--color-ink-2)] hover:shadow-md hover:-translate-y-0.5',
    amber:
      'bg-[var(--color-amber)] text-[var(--color-ink)] shadow-sm ' +
      'hover:bg-[var(--color-amber-dark)] hover:text-white hover:-translate-y-0.5 ' +
      'hover:shadow-[0_8px_20px_-6px_rgba(232,151,58,0.55)]',
    ghost:
      'bg-transparent text-[var(--color-text)] border border-[var(--color-line)] ' +
      'hover:bg-black/[0.03] hover:border-[var(--color-amber)]/40',
    danger:
      'bg-transparent text-[var(--color-danger)] border border-[var(--color-danger)]/30 ' +
      'hover:bg-[var(--color-danger)]/10 hover:border-[var(--color-danger)]/50',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Badge({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-150 ${className}`}>
      {children}
    </span>
  )
}

export function Input({ label, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{label}</span>}
      <input
        className={`w-full px-3 py-2 rounded-lg border border-[var(--color-line)] bg-white text-sm transition-all duration-150 hover:border-[var(--color-amber)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-amber)]/50 focus:border-[var(--color-amber)] ${className}`}
        {...props}
      />
    </label>
  )
}

export function Select({ label, children, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{label}</span>}
      <select
        className={`w-full px-3 py-2 rounded-lg border border-[var(--color-line)] bg-white text-sm transition-all duration-150 hover:border-[var(--color-amber)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-amber)]/50 focus:border-[var(--color-amber)] cursor-pointer ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  )
}

export function Textarea({ label, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{label}</span>}
      <textarea
        className={`w-full px-3 py-2 rounded-lg border border-[var(--color-line)] bg-white text-sm transition-all duration-150 hover:border-[var(--color-amber)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-amber)]/50 focus:border-[var(--color-amber)] ${className}`}
        {...props}
      />
    </label>
  )
}

export function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        style={{ animation: 'qlhd-fade-in 0.15s ease-out' }}
        onClick={onClose}
      />
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}
        style={{ animation: 'qlhd-scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-line)] sticky top-0 bg-white rounded-t-2xl">
          <h3 className="font-display text-lg font-semibold text-[var(--color-ink)]">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 active:scale-90 transition-all duration-150 text-[var(--color-text-muted)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-amber)]/50"
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export function EmptyState({ title, sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6" style={{ animation: 'qlhd-fade-in 0.2s ease-out' }}>
      <div className="w-12 h-12 rounded-full bg-[var(--color-amber)]/15 flex items-center justify-center text-[var(--color-amber-dark)] font-display text-xl mb-3">
        —
      </div>
      <div className="font-medium text-[var(--color-ink)]">{title}</div>
      {sub && <div className="text-sm text-[var(--color-text-muted)] mt-1 max-w-sm">{sub}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingState({ label = 'Đang tải...' }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-[var(--color-text-muted)]">
      <span className="qlhd-spinner text-[var(--color-amber)]" />
      {label}
    </div>
  )
}

export function ErrorState({ message }) {
  return (
    <div
      className="rounded-lg bg-[var(--color-danger)]/8 border border-[var(--color-danger)]/20 text-[var(--color-danger)] text-sm px-4 py-3"
      style={{ animation: 'qlhd-fade-in 0.2s ease-out' }}
    >
      Lỗi: {message}
    </div>
  )
}
