import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCongNoList } from '../lib/queries'
import { PHAN_LOAI_LABELS, formatCurrency, formatDate } from '../lib/format'
import { Card, Badge, StatCard, EmptyState, LoadingState, ErrorState } from '../components/ui'
import { useRealtimeRefresh } from '../lib/useRealtime'

export default function CongNo() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [onlyDebt, setOnlyDebt] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await getCongNoList()
    if (error) setError(error.message)
    else setList(data || [])
    setLoading(false)
  }

  useRealtimeRefresh(['hop_dong_dau_ra', 'thanh_toan'], load)

  const filtered = onlyDebt ? list.filter((r) => Number(r.cong_no_con_lai) > 0) : list
  const tongCongNo = list.reduce((sum, r) => sum + Math.max(Number(r.cong_no_con_lai), 0), 0)
  const soHdConNo = list.filter((r) => Number(r.cong_no_con_lai) > 0).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Công nợ</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Theo dõi tiến độ thanh toán theo từng hợp đồng</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Tổng công nợ còn lại" value={formatCurrency(tongCongNo)} accent />
        <StatCard label="Số hợp đồng còn nợ" value={soHdConNo} />
        <StatCard label="Tổng số hợp đồng" value={list.length} />
      </div>

      <label className="flex items-center gap-2 text-sm mb-3">
        <input type="checkbox" checked={onlyDebt} onChange={(e) => setOnlyDebt(e.target.checked)} />
        Chỉ hiển thị hợp đồng còn công nợ
      </label>

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="p-4"><ErrorState message={error} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Không có công nợ" sub="Tất cả hợp đồng đã được thanh toán đầy đủ." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wide border-b border-[var(--color-line)]">
                <th className="px-5 py-3 font-medium">Số HĐ</th>
                <th className="px-5 py-3 font-medium">Khách hàng</th>
                <th className="px-5 py-3 font-medium">Nhân viên PT</th>
                <th className="px-5 py-3 font-medium text-right">Giá trị HĐ</th>
                <th className="px-5 py-3 font-medium text-right">Đã thanh toán</th>
                <th className="px-5 py-3 font-medium text-right">Còn nợ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-[var(--color-line)] last:border-0 hover:bg-black/[0.015]">
                  <td className="px-5 py-3 font-medium text-[var(--color-ink)]">
                    <Link to={`/hop-dong/${r.id}`} className="hover:underline">{r.so_hop_dong}</Link>
                  </td>
                  <td className="px-5 py-3">
                    {r.ten_khach_hang || '—'}
                    {r.phan_loai && <span className="text-xs text-[var(--color-text-muted)] ml-1">({PHAN_LOAI_LABELS[r.phan_loai]})</span>}
                  </td>
                  <td className="px-5 py-3 text-[var(--color-text-muted)]">{r.nhan_vien_phu_trach || '—'}</td>
                  <td className="px-5 py-3 text-right">{formatCurrency(r.gia_tri_hop_dong)}</td>
                  <td className="px-5 py-3 text-right text-[var(--color-good)]">{formatCurrency(r.tien_da_thanh_toan)}</td>
                  <td className="px-5 py-3 text-right font-medium">
                    <Badge className={Number(r.cong_no_con_lai) > 0 ? 'bg-[#C0432E]/10 text-[#C0432E]' : 'bg-[#2F7A5E]/10 text-[#2F7A5E]'}>
                      {formatCurrency(r.cong_no_con_lai)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
