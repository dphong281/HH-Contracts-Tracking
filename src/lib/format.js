export function formatCurrency(value) {
  const n = Number(value) || 0
  return n.toLocaleString('vi-VN') + ' đ'
}

export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN')
}

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

export const PHAN_LOAI_LABELS = {
  DL: 'Đại lý',
  MB: 'Mua bán',
  TNPP: 'Thương nhân phân phối',
  TTTT: 'Tiêu thụ trực tiếp',
}

export const TRANG_THAI_LABELS = {
  dang_hieu_luc: 'Đang hiệu lực',
  het_han: 'Hết hạn',
  da_thanh_ly: 'Đã thanh lý',
}

export const TRANG_THAI_COLORS = {
  dang_hieu_luc: 'bg-[#2F7A5E]/10 text-[#2F7A5E]',
  het_han: 'bg-[#C0432E]/10 text-[#C0432E]',
  da_thanh_ly: 'bg-[#6B7680]/10 text-[#6B7680]',
}
