import { useEffect, useState } from 'react'
import { getNhatKyList, getTaiKhoanList } from '../lib/queries'
import { Card, Badge, Select, LoadingState, ErrorState, EmptyState } from '../components/ui'
import { useRealtimeRefresh } from '../lib/useRealtime'

const HANH_DONG_LABELS = { INSERT: 'Thêm mới', UPDATE: 'Cập nhật', DELETE: 'Xoá' }
const HANH_DONG_COLORS = {
  INSERT: 'bg-[#2F7A5E]/10 text-[#2F7A5E]',
  UPDATE: 'bg-[#E8973A]/15 text-[#C97A22]',
  DELETE: 'bg-[#C0432E]/10 text-[#C0432E]',
}
const BANG_LABELS = {
  hop_dong_dau_ra: 'Hợp đồng',
  khach_hang: 'Khách hàng',
  nhan_vien: 'Nhân viên',
  thanh_toan: 'Thanh toán',
  phu_luc_hop_dong: 'Phụ lục',
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return d.toLocaleString('vi-VN')
}

export default function NhatKy() {
  const [list, setList] = useState([])
  const [taiKhoans, setTaiKhoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterBang, setFilterBang] = useState('all')
  const [filterHanhDong, setFilterHanhDong] = useState('all')
  const [filterNguoi, setFilterNguoi] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [nk, tk] = await Promise.all([getNhatKyList(), getTaiKhoanList()])
    if (nk.error) setError(nk.error.message)
    else setList(nk.data || [])
    setTaiKhoans(tk.data || [])
    setLoading(false)
  }

  useRealtimeRefresh(['nhat_ky_hoat_dong'], load)

  const filtered = list.filter((item) => {
    if (filterBang !== 'all' && item.bang !== filterBang) return false
    if (filterHanhDong !== 'all' && item.hanh_dong !== filterHanhDong) return false
    if (filterNguoi !== 'all' && item.nguoi_thuc_hien !== filterNguoi) return false
    return true
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Nhật ký hoạt động</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Lịch sử ai đã thêm / sửa / xoá dữ liệu trong hệ thống
        </p>
      </div>

      <div className="flex gap-3 mb-4">
        <Select value={filterBang} onChange={(e) => setFilterBang(e.target.value)} className="w-48">
          <option value="all">Tất cả module</option>
          {Object.entries(BANG_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
        <Select value={filterHanhDong} onChange={(e) => setFilterHanhDong(e.target.value)} className="w-44">
          <option value="all">Tất cả hành động</option>
          {Object.entries(HANH_DONG_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
        <Select value={filterNguoi} onChange={(e) => setFilterNguoi(e.target.value)} className="w-52">
          <option value="all">Tất cả người dùng</option>
          {taiKhoans.map((tk) => (
            <option key={tk.id} value={tk.id}>{tk.ho_ten}</option>
          ))}
        </Select>
      </div>

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="p-4"><ErrorState message={error} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Chưa có hoạt động nào" sub="Nhật ký sẽ ghi lại mọi thao tác thêm/sửa/xoá trong hệ thống." />
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {filtered.map((item) => (
              <li key={item.id} className="px-5 py-3">
                <div
                  className="flex items-start justify-between gap-3 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={HANH_DONG_COLORS[item.hanh_dong]}>{HANH_DONG_LABELS[item.hanh_dong] || item.hanh_dong}</Badge>
                      <Badge className="bg-black/5 text-[var(--color-text-muted)]">{BANG_LABELS[item.bang] || item.bang}</Badge>
                    </div>
                    <div className="text-sm text-[var(--color-ink)] mt-1.5">{item.mo_ta}</div>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] shrink-0 text-right">
                    {formatDateTime(item.created_at)}
                  </div>
                </div>

                {expandedId === item.id && (item.du_lieu_truoc || item.du_lieu_sau) && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {item.du_lieu_truoc && (
                      <div className="bg-black/[0.02] rounded-lg p-3 overflow-x-auto">
                        <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase mb-1.5">Trước khi thay đổi</div>
                        <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(item.du_lieu_truoc, null, 2)}</pre>
                      </div>
                    )}
                    {item.du_lieu_sau && (
                      <div className="bg-black/[0.02] rounded-lg p-3 overflow-x-auto">
                        <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase mb-1.5">Sau khi thay đổi</div>
                        <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(item.du_lieu_sau, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
