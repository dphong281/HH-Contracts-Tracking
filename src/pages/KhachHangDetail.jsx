import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getKhachHangById, updateKhachHang, deleteKhachHang,
  getHopDongByKhachHang,
  getTaiLieuByKhachHang, getTaiLieuSignedUrl, deleteTaiLieuKhachHang,
  getPhuLucByKhachHang, createPhuLuc, deletePhuLuc,
  ConflictError,
} from '../lib/queries'
import { PHAN_LOAI_LABELS, TRANG_THAI_LABELS, TRANG_THAI_COLORS, formatCurrency, formatDate, daysUntil } from '../lib/format'
import {
  Card, Button, Badge, Input, Select, Textarea, Modal, LoadingState, ErrorState, EmptyState,
} from '../components/ui'
import { useRealtimeRefresh } from '../lib/useRealtime'

const LOAI_GIAY_TO_LABELS = {
  cccd: 'CCCD/CMND',
  dkkd: 'Giấy ĐKKD/hộ kinh doanh',
  giay_phep_xang_dau: 'Giấy phép KD xăng dầu',
  khac: 'Khác',
}

const PHAN_LOAI_COLORS = {
  DL: 'bg-[#E8973A]/15 text-[#C97A22]',
  MB: 'bg-[#2F7A5E]/12 text-[#2F7A5E]',
  TNPP: 'bg-[#0F2A3D]/10 text-[#0F2A3D]',
  TTTT: 'bg-[#6B7680]/12 text-[#6B7680]',
}

export default function KhachHangDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [kh, setKh] = useState(null)
  const [hopDongs, setHopDongs] = useState([])
  const [taiLieus, setTaiLieus] = useState([])
  const [phuLucs, setPhuLucs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const [plOpen, setPlOpen] = useState(false)
  const [plForm, setPlForm] = useState({ hop_dong_id: '', so_phu_luc: '', ten_phu_luc: '', ngay_bat_dau: '', ngay_ket_thuc: '', noi_dung: '' })

  useEffect(() => { load() }, [id])

  useRealtimeRefresh(['khach_hang', 'hop_dong_dau_ra', 'tai_lieu_khach_hang', 'phu_luc_hop_dong'], load)

  async function load() {
    setLoading(true)
    const [khRes, hdRes, tlRes, plRes] = await Promise.all([
      getKhachHangById(id),
      getHopDongByKhachHang(id),
      getTaiLieuByKhachHang(id),
      getPhuLucByKhachHang(id),
    ])
    if (khRes.error) setError(khRes.error.message)
    else setKh(khRes.data)
    setHopDongs(hdRes.data || [])
    setTaiLieus(tlRes.data || [])
    setPhuLucs(plRes.data || [])
    setLoading(false)
  }

  function openEdit() {
    setEditForm({
      ten_khach_hang: kh.ten_khach_hang || '',
      phan_loai: kh.phan_loai || 'DL',
      dia_chi: kh.dia_chi || '',
      so_dien_thoai: kh.so_dien_thoai || '',
      email: kh.email || '',
      ma_so_thue: kh.ma_so_thue || '',
      ghi_chu: kh.ghi_chu || '',
      _expectedUpdatedAt: kh.updated_at,
    })
    setEditOpen(true)
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    setSaving(true)
    const { _expectedUpdatedAt, ...payload } = editForm
    const { error } = await updateKhachHang(id, payload, _expectedUpdatedAt)
    setSaving(false)
    if (error) {
      if (error instanceof ConflictError) {
        alert(error.message)
        setEditOpen(false)
        load()
        return
      }
      alert('Lỗi: ' + error.message)
      return
    }
    setEditOpen(false)
    load()
  }

  async function handleDeleteKhachHang() {
    if (!confirm(`Xoá khách hàng "${kh.ten_khach_hang}"? Hành động này không thể hoàn tác.`)) return
    const { error } = await deleteKhachHang(id)
    if (error) {
      alert('Không thể xoá: ' + error.message + ' (có thể khách hàng này đang gắn với hợp đồng)')
      return
    }
    navigate('/khach-hang')
  }

  async function handleViewTaiLieu(tl) {
    const { data, error } = await getTaiLieuSignedUrl(tl.storage_path)
    if (error || !data?.signedUrl) {
      alert('Không mở được file: ' + (error?.message || 'lỗi không xác định'))
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  async function handleDeleteTaiLieu(tl) {
    if (!confirm(`Xoá file "${tl.ten_file}"?`)) return
    const { error } = await deleteTaiLieuKhachHang(tl.id, tl.storage_path)
    if (error) { alert('Lỗi xoá file: ' + error.message); return }
    setTaiLieus((prev) => prev.filter((t) => t.id !== tl.id))
  }

  function openAddPhuLuc() {
    setPlForm({
      hop_dong_id: hopDongs.length === 1 ? hopDongs[0].id : '',
      so_phu_luc: '',
      ten_phu_luc: '',
      ngay_bat_dau: '',
      ngay_ket_thuc: '',
      noi_dung: '',
    })
    setPlOpen(true)
  }

  async function handleAddPhuLuc(e) {
    e.preventDefault()
    if (!plForm.hop_dong_id) { alert('Cần chọn hợp đồng áp dụng cho phụ lục này.'); return }
    const { error } = await createPhuLuc(plForm)
    if (error) { alert('Lỗi: ' + error.message); return }
    setPlOpen(false)
    load()
  }

  async function handleDeletePhuLuc(plId) {
    if (!confirm('Xoá phụ lục này?')) return
    await deletePhuLuc(plId)
    load()
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />
  if (!kh) return <EmptyState title="Không tìm thấy khách hàng" />

  return (
    <div>
      <Link to="/khach-hang" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-ink)] inline-flex items-center gap-1 mb-4">
        ← Danh sách khách hàng
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">{kh.ten_khach_hang}</h1>
            <Badge className={PHAN_LOAI_COLORS[kh.phan_loai]}>{PHAN_LOAI_LABELS[kh.phan_loai] || kh.phan_loai || '—'}</Badge>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {kh.ma_so_thue && `MST: ${kh.ma_so_thue}`}
            {kh.so_dien_thoai && ` · ĐT: ${kh.so_dien_thoai}`}
            {kh.email && ` · ${kh.email}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={openEdit}>Sửa</Button>
          <Button variant="ghost" onClick={handleDeleteKhachHang} className="!text-[var(--color-danger)]">Xoá</Button>
        </div>
      </div>

      {kh.dia_chi && (
        <Card className="p-5 mb-6">
          <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Địa chỉ</div>
          <div className="text-sm">{kh.dia_chi}</div>
        </Card>
      )}

      {kh.ghi_chu && (
        <Card className="p-5 mb-6">
          <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Ghi chú</div>
          <div className="text-sm">{kh.ghi_chu}</div>
        </Card>
      )}

      {/* Hợp đồng liên quan */}
      <Card className="mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-line)]">
          <h3 className="font-display font-semibold text-[var(--color-ink)]">Hợp đồng liên quan</h3>
        </div>
        {hopDongs.length === 0 ? (
          <EmptyState title="Chưa có hợp đồng nào" sub="Khách hàng này chưa gắn với hợp đồng nào." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wide border-b border-[var(--color-line)]">
                <th className="px-5 py-3 font-medium">Số HĐ</th>
                <th className="px-5 py-3 font-medium">Thời hạn</th>
                <th className="px-5 py-3 font-medium text-right">Giá trị</th>
                <th className="px-5 py-3 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {hopDongs.map((hd) => {
                const dLeft = daysUntil(hd.ngay_ket_thuc)
                return (
                  <tr
                    key={hd.id}
                    onClick={() => navigate(`/hop-dong/${hd.id}`)}
                    className="border-b border-[var(--color-line)] last:border-0 hover:bg-black/[0.02] cursor-pointer"
                  >
                    <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{hd.so_hop_dong}</td>
                    <td className="px-5 py-3 text-[var(--color-text-muted)]">
                      {formatDate(hd.ngay_bat_dau)} → {formatDate(hd.ngay_ket_thuc)}
                      {hd.trang_thai === 'dang_hieu_luc' && dLeft !== null && dLeft <= 30 && (
                        <div className={`text-xs mt-0.5 ${dLeft < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-amber-dark)]'}`}>
                          {dLeft < 0 ? `Quá hạn ${Math.abs(dLeft)} ngày` : `Còn ${dLeft} ngày`}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-medium">{formatCurrency(hd.gia_tri_hop_dong)}</td>
                    <td className="px-5 py-3">
                      <Badge className={TRANG_THAI_COLORS[hd.trang_thai]}>{TRANG_THAI_LABELS[hd.trang_thai]}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* Giấy tờ đính kèm */}
        <Card>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-line)]">
            <h3 className="font-display font-semibold text-[var(--color-ink)]">Giấy tờ đính kèm</h3>
          </div>
          {taiLieus.length === 0 ? (
            <EmptyState title="Chưa có giấy tờ" sub='Dùng nút "Nhập giấy tờ theo thư mục" ở trang danh sách khách hàng.' />
          ) : (
            <ul className="divide-y divide-[var(--color-line)]">
              {taiLieus.map((tl) => (
                <li key={tl.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => handleViewTaiLieu(tl)}
                    className="text-left text-sm text-[var(--color-ink)] hover:underline truncate cursor-pointer"
                  >
                    {tl.ten_file}
                    {tl.loai_giay_to && (
                      <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{LOAI_GIAY_TO_LABELS[tl.loai_giay_to] || tl.loai_giay_to}</div>
                    )}
                  </button>
                  <button onClick={() => handleDeleteTaiLieu(tl)} className="text-xs text-[var(--color-danger)] hover:underline shrink-0 cursor-pointer">Xoá</button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Phụ lục — gom từ tất cả hợp đồng của khách hàng này */}
        <Card>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-line)]">
            <h3 className="font-display font-semibold text-[var(--color-ink)]">Phụ lục</h3>
            <Button
              variant="ghost"
              onClick={openAddPhuLuc}
              disabled={hopDongs.length === 0}
              className="!py-1.5 !px-3 text-xs"
              title={hopDongs.length === 0 ? 'Khách hàng cần có ít nhất 1 hợp đồng trước' : ''}
            >
              + Thêm
            </Button>
          </div>
          {phuLucs.length === 0 ? (
            <EmptyState
              title="Chưa có phụ lục"
              sub={hopDongs.length === 0 ? 'Cần có hợp đồng trước khi thêm phụ lục.' : 'Thêm phụ lục cho 1 trong các hợp đồng của khách hàng này.'}
            />
          ) : (
            <ul className="divide-y divide-[var(--color-line)]">
              {phuLucs.map((pl) => (
                <li key={pl.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div>
                    {pl.so_phu_luc && (
                      <div className="text-xs text-[var(--color-text-muted)]">Số {pl.so_phu_luc} — HĐ {pl.so_hop_dong}</div>
                    )}
                    <div className="font-medium text-sm text-[var(--color-ink)]">{pl.ten_phu_luc}</div>
                    {pl.noi_dung && <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{pl.noi_dung}</div>}
                    {(pl.ngay_bat_dau || pl.ngay_ket_thuc) && (
                      <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        Thời hạn: {formatDate(pl.ngay_bat_dau)} → {formatDate(pl.ngay_ket_thuc)}
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleDeletePhuLuc(pl.id)} className="text-xs text-[var(--color-danger)] hover:underline shrink-0 cursor-pointer">Xoá</button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Modal sửa khách hàng */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Sửa khách hàng" wide>
        {editForm && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <Input label="Tên khách hàng *" required value={editForm.ten_khach_hang} onChange={(e) => setEditForm({ ...editForm, ten_khach_hang: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Phân loại khách hàng" value={editForm.phan_loai} onChange={(e) => setEditForm({ ...editForm, phan_loai: e.target.value })}>
                {Object.entries(PHAN_LOAI_LABELS).map(([k, v]) => <option key={k} value={k}>{v} ({k})</option>)}
              </Select>
              <Input label="Mã số thuế" value={editForm.ma_so_thue} onChange={(e) => setEditForm({ ...editForm, ma_so_thue: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Số điện thoại" value={editForm.so_dien_thoai} onChange={(e) => setEditForm({ ...editForm, so_dien_thoai: e.target.value })} />
              <Input label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <Input label="Địa chỉ" value={editForm.dia_chi} onChange={(e) => setEditForm({ ...editForm, dia_chi: e.target.value })} />
            <Textarea label="Ghi chú" rows={3} value={editForm.ghi_chu} onChange={(e) => setEditForm({ ...editForm, ghi_chu: e.target.value })} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>Huỷ</Button>
              <Button type="submit" variant="amber" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal thêm phụ lục */}
      <Modal open={plOpen} onClose={() => setPlOpen(false)} title="Thêm phụ lục">
        <form onSubmit={handleAddPhuLuc} className="space-y-4">
          <Select
            label="Hợp đồng áp dụng *"
            required
            value={plForm.hop_dong_id}
            onChange={(e) => setPlForm({ ...plForm, hop_dong_id: e.target.value })}
          >
            <option value="">— Chọn hợp đồng —</option>
            {hopDongs.map((hd) => (
              <option key={hd.id} value={hd.id}>{hd.so_hop_dong}</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Số phụ lục" value={plForm.so_phu_luc} onChange={(e) => setPlForm({ ...plForm, so_phu_luc: e.target.value })} />
          </div>
          <Input
            label="Tên phụ lục *"
            required
            placeholder="Về việc ..."
            value={plForm.ten_phu_luc}
            onChange={(e) => setPlForm({ ...plForm, ten_phu_luc: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Thời hạn từ ngày" type="date" value={plForm.ngay_bat_dau} onChange={(e) => setPlForm({ ...plForm, ngay_bat_dau: e.target.value })} />
            <Input label="Đến ngày" type="date" value={plForm.ngay_ket_thuc} onChange={(e) => setPlForm({ ...plForm, ngay_ket_thuc: e.target.value })} />
          </div>
          <Textarea label="Nội dung" rows={3} value={plForm.noi_dung} onChange={(e) => setPlForm({ ...plForm, noi_dung: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setPlOpen(false)}>Huỷ</Button>
            <Button type="submit" variant="amber">Lưu</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}