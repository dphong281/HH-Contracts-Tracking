import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getHopDongById, updateHopDong, deleteHopDong,
  getKhachHangList, getNhanVienList,
  getPhuLucByHopDong, createPhuLuc, deletePhuLuc,
  getThanhToanByHopDong, createThanhToan, deleteThanhToan,
} from '../lib/queries'
import { PHAN_LOAI_LABELS, TRANG_THAI_LABELS, TRANG_THAI_COLORS, formatCurrency, formatDate, daysUntil } from '../lib/format'
import {
  Card, Button, Badge, Input, Select, Textarea, Modal, LoadingState, ErrorState, EmptyState,
} from '../components/ui'
import { useRealtimeRefresh } from '../lib/useRealtime'

export default function HopDongDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [hd, setHd] = useState(null)
  const [khachHangs, setKhachHangs] = useState([])
  const [nhanViens, setNhanViens] = useState([])
  const [phuLucs, setPhuLucs] = useState([])
  const [thanhToans, setThanhToans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const [plOpen, setPlOpen] = useState(false)
  const [plForm, setPlForm] = useState({ ten_phu_luc: '', noi_dung: '', ngay_hieu_luc: '' })

  const [ttOpen, setTtOpen] = useState(false)
  const [ttForm, setTtForm] = useState({ ngay_thanh_toan: '', so_tien: '', hinh_thuc: 'Chuyển khoản', ghi_chu: '' })

  useEffect(() => { load() }, [id])

  useRealtimeRefresh(['hop_dong_dau_ra', 'phu_luc_hop_dong', 'thanh_toan'], load)

  async function load() {
    setLoading(true)
    const [hdRes, khRes, nvRes, plRes, ttRes] = await Promise.all([
      getHopDongById(id), getKhachHangList(), getNhanVienList(),
      getPhuLucByHopDong(id), getThanhToanByHopDong(id),
    ])
    if (hdRes.error) setError(hdRes.error.message)
    else setHd(hdRes.data)
    setKhachHangs(khRes.data || [])
    setNhanViens(nvRes.data || [])
    setPhuLucs(plRes.data || [])
    setThanhToans(ttRes.data || [])
    setLoading(false)
  }

  function openEdit() {
    setEditForm({
      khach_hang_id: hd.khach_hang_id || '',
      nhan_vien_id: hd.nhan_vien_id || '',
      so_hop_dong: hd.so_hop_dong || '',
      ngay_bat_dau: hd.ngay_bat_dau || '',
      ngay_ket_thuc: hd.ngay_ket_thuc || '',
      gia_tri_hop_dong: hd.gia_tri_hop_dong || 0,
      trang_thai: hd.trang_thai,
      ghi_chu: hd.ghi_chu || '',
      ghi_chu_hop_dong: hd.ghi_chu_hop_dong || '',
    })
    setEditOpen(true)
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...editForm,
      khach_hang_id: editForm.khach_hang_id || null,
      nhan_vien_id: editForm.nhan_vien_id || null,
      gia_tri_hop_dong: Number(editForm.gia_tri_hop_dong) || 0,
      ngay_bat_dau: editForm.ngay_bat_dau || null,
      ngay_ket_thuc: editForm.ngay_ket_thuc || null,
    }
    const { error } = await updateHopDong(id, payload)
    setSaving(false)
    if (error) { alert('Lỗi: ' + error.message); return }
    setEditOpen(false)
    load()
  }

  async function handleDeleteHopDong() {
    if (!confirm(`Xoá hợp đồng "${hd.so_hop_dong}"? Toàn bộ phụ lục và lịch sử thanh toán liên quan cũng sẽ bị xoá.`)) return
    const { error } = await deleteHopDong(id)
    if (error) { alert('Lỗi: ' + error.message); return }
    navigate('/hop-dong')
  }

  async function handleAddPhuLuc(e) {
    e.preventDefault()
    const { error } = await createPhuLuc({ ...plForm, hop_dong_id: id })
    if (error) { alert('Lỗi: ' + error.message); return }
    setPlOpen(false)
    setPlForm({ ten_phu_luc: '', noi_dung: '', ngay_hieu_luc: '' })
    load()
  }

  async function handleDeletePhuLuc(plId) {
    if (!confirm('Xoá phụ lục này?')) return
    await deletePhuLuc(plId)
    load()
  }

  async function handleAddThanhToan(e) {
    e.preventDefault()
    const payload = { ...ttForm, hop_dong_id: id, so_tien: Number(ttForm.so_tien) || 0 }
    const { error } = await createThanhToan(payload)
    if (error) { alert('Lỗi: ' + error.message); return }
    setTtOpen(false)
    setTtForm({ ngay_thanh_toan: '', so_tien: '', hinh_thuc: 'Chuyển khoản', ghi_chu: '' })
    load()
  }

  async function handleDeleteThanhToan(ttId) {
    if (!confirm('Xoá khoản thanh toán này?')) return
    await deleteThanhToan(ttId)
    load()
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />
  if (!hd) return <EmptyState title="Không tìm thấy hợp đồng" />

  const tongDaThanhToan = thanhToans.reduce((sum, tt) => sum + Number(tt.so_tien), 0)
  const congNoConLai = Number(hd.gia_tri_hop_dong) - tongDaThanhToan
  const dLeft = daysUntil(hd.ngay_ket_thuc)

  return (
    <div>
      <Link to="/hop-dong" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-ink)] inline-flex items-center gap-1 mb-4">
        ← Danh sách hợp đồng
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">{hd.so_hop_dong}</h1>
            <Badge className={TRANG_THAI_COLORS[hd.trang_thai]}>{TRANG_THAI_LABELS[hd.trang_thai]}</Badge>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {hd.khach_hang?.ten_khach_hang || 'Chưa gán khách hàng'}
            {hd.khach_hang?.phan_loai && ` · ${PHAN_LOAI_LABELS[hd.khach_hang.phan_loai]}`}
            {hd.nhan_vien?.ho_ten && ` · Phụ trách: ${hd.nhan_vien.ho_ten}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={openEdit}>Sửa</Button>
          <Button variant="danger" onClick={handleDeleteHopDong}>Xoá</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="p-5">
          <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Giá trị hợp đồng</div>
          <div className="font-display text-xl font-semibold mt-2 text-[var(--color-ink)]">{formatCurrency(hd.gia_tri_hop_dong)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Đã thanh toán</div>
          <div className="font-display text-xl font-semibold mt-2 text-[var(--color-good)]">{formatCurrency(tongDaThanhToan)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Công nợ còn lại</div>
          <div className={`font-display text-xl font-semibold mt-2 ${congNoConLai > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-good)]'}`}>
            {formatCurrency(congNoConLai)}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Thời hạn</div>
          <div className="text-sm font-medium mt-2 text-[var(--color-ink)]">
            {formatDate(hd.ngay_bat_dau)} → {formatDate(hd.ngay_ket_thuc)}
          </div>
          {hd.trang_thai === 'dang_hieu_luc' && dLeft !== null && (
            <div className={`text-xs mt-1 ${dLeft < 0 ? 'text-[var(--color-danger)]' : dLeft <= 30 ? 'text-[var(--color-amber-dark)]' : 'text-[var(--color-text-muted)]'}`}>
              {dLeft < 0 ? `Quá hạn ${Math.abs(dLeft)} ngày` : `Còn ${dLeft} ngày`}
            </div>
          )}
        </Card>
      </div>

      {hd.ghi_chu && (
        <Card className="p-5 mb-6">
          <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Ghi chú</div>
          <div className="text-sm">{hd.ghi_chu}</div>
        </Card>
      )}

      {hd.ghi_chu_hop_dong && (
        <Card className="p-5 mb-6 bg-[var(--color-amber)]/[0.04] border-[var(--color-amber)]/25">
          <div className="text-xs font-medium text-[var(--color-amber-dark)] uppercase tracking-wide mb-1">Ghi chú hợp đồng</div>
          <div className="text-sm">{hd.ghi_chu_hop_dong}</div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Phụ lục */}
        <Card>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-line)]">
            <h3 className="font-display font-semibold text-[var(--color-ink)]">Phụ lục kèm theo</h3>
            <Button variant="ghost" onClick={() => setPlOpen(true)} className="!py-1.5 !px-3 text-xs">+ Thêm</Button>
          </div>
          {phuLucs.length === 0 ? (
            <EmptyState title="Chưa có phụ lục" sub="Thêm phụ lục đính kèm hợp đồng này." />
          ) : (
            <ul className="divide-y divide-[var(--color-line)]">
              {phuLucs.map((pl) => (
                <li key={pl.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm text-[var(--color-ink)]">{pl.ten_phu_luc}</div>
                    {pl.noi_dung && <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{pl.noi_dung}</div>}
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">Hiệu lực: {formatDate(pl.ngay_hieu_luc)}</div>
                  </div>
                  <button onClick={() => handleDeletePhuLuc(pl.id)} className="text-xs text-[var(--color-danger)] hover:underline shrink-0">Xoá</button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Thanh toán */}
        <Card>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-line)]">
            <h3 className="font-display font-semibold text-[var(--color-ink)]">Lịch sử thanh toán</h3>
            <Button variant="ghost" onClick={() => setTtOpen(true)} className="!py-1.5 !px-3 text-xs">+ Ghi nhận</Button>
          </div>
          {thanhToans.length === 0 ? (
            <EmptyState title="Chưa có thanh toán" sub="Ghi nhận lần thanh toán đầu tiên." />
          ) : (
            <ul className="divide-y divide-[var(--color-line)]">
              {thanhToans.map((tt) => (
                <li key={tt.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm text-[var(--color-ink)]">{formatCurrency(tt.so_tien)}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {formatDate(tt.ngay_thanh_toan)} · {tt.hinh_thuc || '—'}
                    </div>
                    {tt.ghi_chu && <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{tt.ghi_chu}</div>}
                  </div>
                  <button onClick={() => handleDeleteThanhToan(tt.id)} className="text-xs text-[var(--color-danger)] hover:underline shrink-0">Xoá</button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Modal sửa HĐ */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Sửa hợp đồng" wide>
        {editForm && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Số hợp đồng *" required value={editForm.so_hop_dong} onChange={(e) => setEditForm({ ...editForm, so_hop_dong: e.target.value })} />
              <Select label="Trạng thái" value={editForm.trang_thai} onChange={(e) => setEditForm({ ...editForm, trang_thai: e.target.value })}>
                {Object.entries(TRANG_THAI_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Khách hàng" value={editForm.khach_hang_id} onChange={(e) => setEditForm({ ...editForm, khach_hang_id: e.target.value })}>
                <option value="">— Chọn khách hàng —</option>
                {khachHangs.map((kh) => <option key={kh.id} value={kh.id}>{kh.ten_khach_hang}</option>)}
              </Select>
              <Select label="Nhân viên phụ trách" value={editForm.nhan_vien_id} onChange={(e) => setEditForm({ ...editForm, nhan_vien_id: e.target.value })}>
                <option value="">— Chọn nhân viên —</option>
                {nhanViens.map((nv) => <option key={nv.id} value={nv.id}>{nv.ho_ten}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Ngày bắt đầu" type="date" value={editForm.ngay_bat_dau || ''} onChange={(e) => setEditForm({ ...editForm, ngay_bat_dau: e.target.value })} />
              <Input label="Ngày kết thúc" type="date" value={editForm.ngay_ket_thuc || ''} onChange={(e) => setEditForm({ ...editForm, ngay_ket_thuc: e.target.value })} />
              <Input label="Giá trị hợp đồng (đ)" type="number" min="0" value={editForm.gia_tri_hop_dong} onChange={(e) => setEditForm({ ...editForm, gia_tri_hop_dong: e.target.value })} />
            </div>
            <Textarea label="Ghi chú" rows={3} value={editForm.ghi_chu || ''} onChange={(e) => setEditForm({ ...editForm, ghi_chu: e.target.value })} />
            <Textarea label="Ghi chú hợp đồng" rows={3} value={editForm.ghi_chu_hop_dong || ''} onChange={(e) => setEditForm({ ...editForm, ghi_chu_hop_dong: e.target.value })} />
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
          <Input label="Tên phụ lục *" required value={plForm.ten_phu_luc} onChange={(e) => setPlForm({ ...plForm, ten_phu_luc: e.target.value })} />
          <Input label="Ngày hiệu lực" type="date" value={plForm.ngay_hieu_luc} onChange={(e) => setPlForm({ ...plForm, ngay_hieu_luc: e.target.value })} />
          <Textarea label="Nội dung" rows={3} value={plForm.noi_dung} onChange={(e) => setPlForm({ ...plForm, noi_dung: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setPlOpen(false)}>Huỷ</Button>
            <Button type="submit" variant="amber">Lưu</Button>
          </div>
        </form>
      </Modal>

      {/* Modal ghi nhận thanh toán */}
      <Modal open={ttOpen} onClose={() => setTtOpen(false)} title="Ghi nhận thanh toán">
        <form onSubmit={handleAddThanhToan} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Ngày thanh toán *" type="date" required value={ttForm.ngay_thanh_toan} onChange={(e) => setTtForm({ ...ttForm, ngay_thanh_toan: e.target.value })} />
            <Input label="Số tiền (đ) *" type="number" min="0" required value={ttForm.so_tien} onChange={(e) => setTtForm({ ...ttForm, so_tien: e.target.value })} />
          </div>
          <Select label="Hình thức" value={ttForm.hinh_thuc} onChange={(e) => setTtForm({ ...ttForm, hinh_thuc: e.target.value })}>
            <option>Chuyển khoản</option>
            <option>Tiền mặt</option>
            <option>Khác</option>
          </Select>
          <Textarea label="Ghi chú" rows={2} value={ttForm.ghi_chu} onChange={(e) => setTtForm({ ...ttForm, ghi_chu: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setTtOpen(false)}>Huỷ</Button>
            <Button type="submit" variant="amber">Lưu</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
