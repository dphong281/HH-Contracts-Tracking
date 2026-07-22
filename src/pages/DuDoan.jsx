import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDuDoanData } from '../lib/queries'
import { tinhDiemRuiRoTatCa, LEVEL_LABELS, LEVEL_COLORS } from '../lib/duDoan'
import { PHAN_LOAI_LABELS, formatCurrency, formatDate } from '../lib/format'
import { Card, Badge, StatCard, EmptyState, LoadingState, ErrorState } from '../components/ui'
import { useRealtimeRefresh } from '../lib/useRealtime'

const PHAN_LOAI_COLORS = {
  DL: 'bg-[#E8973A]/15 text-[#C97A22]',
  MB: 'bg-[#2F7A5E]/12 text-[#2F7A5E]',
  TNPP: 'bg-[#0F2A3D]/10 text-[#0F2A3D]',
  TTTT: 'bg-[#6B7680]/12 text-[#6B7680]',
}

export default function DuDoan() {
  const [ketQua, setKetQua] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterLevel, setFilterLevel] = useState('all')

  useEffect(() => { load() }, [])

  useRealtimeRefresh(['hop_dong_dau_ra', 'thanh_toan'], load)

  async function load() {
    setLoading(true)
    const { data, error } = await getDuDoanData()
    if (error) { setError(error.message); setLoading(false); return }
    setKetQua(tinhDiemRuiRoTatCa(data.hopDongs, data.thanhToans))
    setLoading(false)
  }

  const filtered = filterLevel === 'all' ? ketQua : ketQua.filter((r) => r.level === filterLevel)
  const soRuiRoCao = ketQua.filter((r) => r.level === 'cao').length
  const tongNoRuiRoCao = ketQua.filter((r) => r.level === 'cao').reduce((sum, r) => sum + r.cong_no_con_lai, 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Dự đoán rủi ro công nợ</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Xếp hạng hợp đồng theo khả năng chậm thanh toán / vượt hạn mức — tính bằng thống kê từ dữ liệu thực tế, không dùng AI.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Hợp đồng rủi ro cao" value={soRuiRoCao} accent />
        <StatCard label="Công nợ thuộc nhóm rủi ro cao" value={formatCurrency(tongNoRuiRoCao)} />
        <StatCard label="Tổng hợp đồng đang đánh giá" value={ketQua.length} />
      </div>

      <div className="flex gap-2 mb-4">
        {['all', 'cao', 'trung_binh', 'thap'].map((lv) => (
          <button
            key={lv}
            onClick={() => setFilterLevel(lv)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer ${
              filterLevel === lv
                ? 'bg-[var(--color-ink)] text-white'
                : 'bg-white border border-[var(--color-line)] text-[var(--color-text-muted)] hover:bg-black/[0.02]'
            }`}
          >
            {lv === 'all' ? 'Tất cả' : LEVEL_LABELS[lv]}
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="p-4"><ErrorState message={error} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Không có hợp đồng nào ở mức này" sub="Không phát hiện hợp đồng nào đang chịu rủi ro chậm thanh toán." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wide border-b border-[var(--color-line)]">
                <th className="px-5 py-3 font-medium">Khách hàng</th>
                <th className="px-5 py-3 font-medium">Phân loại</th>
                <th className="px-5 py-3 font-medium">Thời hạn</th>
                <th className="px-5 py-3 font-medium text-right">Còn nợ</th>
                <th className="px-5 py-3 font-medium">Mức rủi ro</th>
                <th className="px-5 py-3 font-medium">Điểm</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.hop_dong_id} className="border-b border-[var(--color-line)] last:border-0 hover:bg-black/[0.015]">
                  <td className="px-5 py-3 font-medium text-[var(--color-ink)]">
                    <Link to={`/hop-dong/${r.hop_dong_id}`} className="hover:underline">
                      {r.hop_dong.khach_hang?.ten_khach_hang || '—'}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    {r.hop_dong.khach_hang?.phan_loai ? (
                      <Badge className={PHAN_LOAI_COLORS[r.hop_dong.khach_hang.phan_loai]}>
                        {PHAN_LOAI_LABELS[r.hop_dong.khach_hang.phan_loai] || r.hop_dong.khach_hang.phan_loai}
                      </Badge>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3 text-[var(--color-text-muted)]">
                    {formatDate(r.hop_dong.ngay_bat_dau)} → {formatDate(r.hop_dong.ngay_ket_thuc)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium">{formatCurrency(r.cong_no_con_lai)}</td>
                  <td className="px-5 py-3">
                    <Badge className={LEVEL_COLORS[r.level]}>{LEVEL_LABELS[r.level]}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                        <div
                          className={`h-full ${r.level === 'cao' ? 'bg-[#C0432E]' : r.level === 'trung_binh' ? 'bg-[#E8973A]' : 'bg-[#2F7A5E]'}`}
                          style={{ width: `${r.score}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--color-text-muted)]">{r.score}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <p className="text-xs text-[var(--color-text-muted)] mt-4">
        Điểm rủi ro tính từ 4 yếu tố: áp lực công nợ hiện tại so với hạn mức, đã vượt hạn mức hay chưa,
        áp lực thời hạn hợp đồng (càng gần/quá hạn mà còn nợ điểm càng cao), và lịch sử của khách hàng
        (tỷ lệ hợp đồng cũ còn nợ tồn đọng). Đây là công thức thống kê minh bạch dựa trên dữ liệu có sẵn,
        không phải dự đoán bằng AI — chỉ mang tính tham khảo, không thay thế đánh giá thực tế.
      </p>
    </div>
  )
}
