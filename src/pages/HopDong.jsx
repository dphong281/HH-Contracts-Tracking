import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHopDongList, createHopDong, getKhachHangList, getNhanVienList, createKhachHang } from '../lib/queries'
import { PHAN_LOAI_LABELS, TRANG_THAI_LABELS, TRANG_THAI_COLORS, formatCurrency, formatDate, daysUntil } from '../lib/format'
import { extractTextFromDocx, parseContractText, normalizeVN } from '../lib/wordImport'
import { useRealtimeRefresh } from '../lib/useRealtime'
import {
  Card, Button, Badge, Input, Select, Textarea, Modal, EmptyState, LoadingState, ErrorState,
} from '../components/ui'

const EMPTY_FORM = {
  khach_hang_id: '', nhan_vien_id: '', so_hop_dong: '', ngay_bat_dau: '', ngay_ket_thuc: '',
  gia_tri_hop_dong: '', trang_thai: 'dang_hieu_luc', ghi_chu: '', ghi_chu_hop_dong: '',
}

export default function HopDong() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [list, setList] = useState([])
  const [khachHangs, setKhachHangs] = useState([])
  const [nhanViens, setNhanViens] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterTrangThai, setFilterTrangThai] = useState('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importQueue, setImportQueue] = useState([]) // [{ key, file, parsed, reason, khach_hang_id, khachHangMode, newForm, so_hop_dong, ngay_bat_dau, ngay_ket_thuc, gia_tri_hop_dong, nhan_vien_id, ghi_chu, ghi_chu_hop_dong }]

  useEffect(() => { load() }, [])

  useRealtimeRefresh(['hop_dong_dau_ra', 'khach_hang', 'nhan_vien'], load)

  async function load() {
    setLoading(true)
    const [hd, kh, nv] = await Promise.all([getHopDongList(), getKhachHangList(), getNhanVienList()])
    if (hd.error) setError(hd.error.message)
    else setList(hd.data || [])
    setKhachHangs(kh.data || [])
    setNhanViens(nv.data || [])
    setLoading(false)
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      khach_hang_id: form.khach_hang_id || null,
      nhan_vien_id: form.nhan_vien_id || null,
      gia_tri_hop_dong: Number(form.gia_tri_hop_dong) || 0,
      ngay_bat_dau: form.ngay_bat_dau || null,
      ngay_ket_thuc: form.ngay_ket_thuc || null,
    }
    const { data, error } = await createHopDong(payload)
    setSaving(false)
    if (error) {
      alert('Lỗi lưu dữ liệu: ' + error.message)
      return
    }
    setModalOpen(false)
    navigate(`/hop-dong/${data.id}`)
  }

  // ---------- NHẬP TỪ FILE WORD (tự động 100%, hỗ trợ nhiều file) ----------
  function openFilePicker() {
    setImportError(null)
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) return

    const nonDocx = files.filter((f) => !f.name.toLowerCase().endsWith('.docx')).map((f) => f.name)
    const docxFiles = files.filter((f) => f.name.toLowerCase().endsWith('.docx'))

    setImporting(true)
    setImportError(null)

    const autoSaved = []
    const failed = []
    const needsReview = [] // thiếu số HĐ hoặc thiếu tên khách hàng — không đủ dữ liệu để tự lưu

    // Danh sách khách hàng tạm dùng trong vòng lặp — cập nhật ngay khi tự tạo mới,
    // để 2 file cùng một khách hàng trong 1 lần chọn không bị tạo trùng.
    let workingKhachHangs = [...khachHangs]

    for (const file of docxFiles) {
      try {
        const text = await extractTextFromDocx(file)
        const parsed = parseContractText(text)

        if (!parsed.so_hop_dong) {
          const normTarget = normalizeVN(parsed.ten_khach_hang || '')
          const match = workingKhachHangs.find((kh) => normalizeVN(kh.ten_khach_hang) === normTarget)
          needsReview.push({
            key: `${file.name}-${Date.now()}`,
            file,
            parsed,
            reason: 'Không đọc được số hợp đồng',
            khach_hang_id: match ? match.id : '',
            khachHangMode: match ? 'existing' : 'new',
            newForm: { ten_khach_hang: parsed.ten_khach_hang || '', phan_loai: parsed.phan_loai_goi_y || 'DL', dia_chi: parsed.dia_chi || '', so_dien_thoai: parsed.so_dien_thoai || '', ma_so_thue: parsed.ma_so_thue || '' },
            so_hop_dong: parsed.so_hop_dong || '',
            ngay_bat_dau: parsed.ngay_bat_dau || '',
            ngay_ket_thuc: parsed.ngay_ket_thuc || '',
            gia_tri_hop_dong: '',
            nhan_vien_id: '',
            ghi_chu_hop_dong: `Nhập tự động từ file Word: ${file.name}`,
          })
          continue
        }
        if (list.some((hd) => hd.so_hop_dong === parsed.so_hop_dong)) {
          failed.push(`${file.name}: số HĐ "${parsed.so_hop_dong}" đã tồn tại — bỏ qua để tránh trùng`)
          continue
        }

        let khachHangId = null
        if (parsed.ten_khach_hang) {
          const normTarget = normalizeVN(parsed.ten_khach_hang)
          const match = workingKhachHangs.find((kh) => normalizeVN(kh.ten_khach_hang) === normTarget)
          if (match) {
            khachHangId = match.id
          } else {
            const { data: khData, error: khError } = await createKhachHang({
              ten_khach_hang: parsed.ten_khach_hang,
              phan_loai: parsed.phan_loai_goi_y || 'DL',
              dia_chi: parsed.dia_chi || null,
              so_dien_thoai: parsed.so_dien_thoai || null,
              ma_so_thue: parsed.ma_so_thue || null,
            })
            if (khError) { failed.push(`${file.name}: lỗi tạo khách hàng — ${khError.message}`); continue }
            khachHangId = khData.id
            workingKhachHangs = [...workingKhachHangs, khData]
          }
        } else {
          needsReview.push({ key: `${file.name}-${Date.now()}`, file, parsed, reason: 'Không đọc được tên khách hàng (Bên B)' })
          continue
        }

        const { error } = await createHopDong({
          khach_hang_id: khachHangId,
          nhan_vien_id: null,
          so_hop_dong: parsed.so_hop_dong,
          ngay_bat_dau: parsed.ngay_bat_dau || null,
          ngay_ket_thuc: parsed.ngay_ket_thuc || null,
          gia_tri_hop_dong: 0,
          trang_thai: 'dang_hieu_luc',
          ghi_chu: null,
          ghi_chu_hop_dong: `Nhập tự động từ file Word: ${file.name}`,
          chi_tiet_import: buildChiTietImport(parsed),
        })
        if (error) { failed.push(`${file.name}: lỗi lưu hợp đồng — ${error.message}`); continue }
        autoSaved.push(`${file.name} (${parsed.so_hop_dong})`)
      } catch (err) {
        failed.push(`${file.name}: ${err.message}`)
      }
    }

    setImporting(false)
    setKhachHangs(workingKhachHangs)
    load()

    let msg = ''
    if (autoSaved.length) msg += `✅ Đã tự động nhập ${autoSaved.length} hợp đồng:\n${autoSaved.join('\n')}\n`
    if (failed.length) msg += `\n⚠️ ${failed.length} file lỗi/bỏ qua:\n${failed.join('\n')}\n`
    if (nonDocx.length) msg += `\n⚠️ Bỏ qua ${nonDocx.length} file không phải .docx: ${nonDocx.join(', ')}\n`
    if (msg) alert(msg.trim())

    if (needsReview.length > 0) {
      setImportQueue(needsReview)
      setImportOpen(true)
    }
  }

  // Gói lại dữ liệu phụ trích xuất từ file — dùng chung cho cả nhập tự động và nhập thủ công qua modal.
  function buildChiTietImport(parsed) {
    return {
      loai_hop_dong: parsed.loai_hop_dong,
      ngay_ky: parsed.ngay_ky,
      dia_diem_ky: parsed.dia_diem_ky,
      so_trang: parsed.so_trang,
      so_ban: parsed.so_ban,
      ben_b: {
        fax: parsed.fax,
        tai_khoan: parsed.tai_khoan,
        dai_dien: parsed.dai_dien,
        chuc_vu: parsed.chuc_vu,
      },
      san_luong_cam_ket: parsed.san_luong_cam_ket,
      cong_thuc_gia: parsed.cong_thuc_gia,
      chiet_khau: parsed.chiet_khau,
      hinh_thuc_mua_ban: parsed.hinh_thuc_mua_ban,
      hinh_thuc_thanh_toan: parsed.hinh_thuc_thanh_toan,
      dat_coc_ky_quy: parsed.dat_coc_ky_quy,
      thoi_han_doi_chieu_cong_no: parsed.thoi_han_doi_chieu_cong_no,
      dieu_kien_don_phuong_cham_dut: parsed.dieu_kien_don_phuong_cham_dut,
      nghia_vu_treo_logo: parsed.nghia_vu_treo_logo,
      gia_han_tu_dong: parsed.gia_han_tu_dong,
    }
  }

  async function handleConfirmImport(e) {
    e.preventDefault()
    setSaving(true)

    const errors = []
    let lastSavedId = null

    for (const item of importQueue) {
      let khachHangId = item.khach_hang_id

      if (item.khachHangMode === 'new') {
        if (!item.newForm.ten_khach_hang) {
          errors.push(`${item.file.name}: cần tên khách hàng để tạo mới`)
          continue
        }
        const { data: khData, error: khError } = await createKhachHang({
          ten_khach_hang: item.newForm.ten_khach_hang,
          phan_loai: item.newForm.phan_loai,
          dia_chi: item.newForm.dia_chi || null,
          so_dien_thoai: item.newForm.so_dien_thoai || null,
          ma_so_thue: item.newForm.ma_so_thue || null,
        })
        if (khError) { errors.push(`${item.file.name}: lỗi tạo khách hàng — ${khError.message}`); continue }
        khachHangId = khData.id
      }

      if (!khachHangId) {
        errors.push(`${item.file.name}: chưa chọn khách hàng`)
        continue
      }
      if (!item.so_hop_dong) {
        errors.push(`${item.file.name}: chưa nhập số hợp đồng`)
        continue
      }

      const { data, error } = await createHopDong({
        khach_hang_id: khachHangId,
        nhan_vien_id: item.nhan_vien_id || null,
        so_hop_dong: item.so_hop_dong,
        ngay_bat_dau: item.ngay_bat_dau || null,
        ngay_ket_thuc: item.ngay_ket_thuc || null,
        gia_tri_hop_dong: Number(item.gia_tri_hop_dong) || 0,
        trang_thai: 'dang_hieu_luc',
        ghi_chu: null,
        ghi_chu_hop_dong: item.ghi_chu_hop_dong || null,
        chi_tiet_import: buildChiTietImport(item.parsed),
      })
      if (error) { errors.push(`${item.file.name}: lỗi lưu hợp đồng — ${error.message}`); continue }
      lastSavedId = data.id
    }

    setSaving(false)
    setImportOpen(false)
    setImportQueue([])
    load()

    if (errors.length > 0) {
      alert(`Có lỗi khi lưu:\n` + errors.join('\n'))
    }
    // Nếu chỉ có đúng 1 hợp đồng vừa lưu thành công, mở luôn trang chi tiết — tiện cho trường hợp phổ biến nhất (xem lại 1 file thiếu số HĐ).
    if (lastSavedId && errors.length === 0 && importQueue.length === 1) {
      navigate(`/hop-dong/${lastSavedId}`)
    }
  }

  function updateImportQueueItem(key, patch) {
    setImportQueue((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)))
  }

  function updateImportQueueItemNewForm(key, patch) {
    setImportQueue((prev) => prev.map((it) => (it.key === key ? { ...it, newForm: { ...it.newForm, ...patch } } : it)))
  }

  function removeImportQueueItem(key) {
    setImportQueue((prev) => prev.filter((it) => it.key !== key))
  }

  const filtered = list.filter((hd) => {
    const matchSearch =
      hd.so_hop_dong?.toLowerCase().includes(search.toLowerCase()) ||
      hd.khach_hang?.ten_khach_hang?.toLowerCase().includes(search.toLowerCase())
    const matchTrangThai = filterTrangThai === 'all' || hd.trang_thai === filterTrangThai
    return matchSearch && matchTrangThai
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Hợp đồng đầu ra</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Toàn bộ hợp đồng bán hàng đang theo dõi</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            multiple
            className="hidden"
            onChange={handleFileSelected}
          />
          <Button variant="ghost" onClick={openFilePicker} disabled={importing}>
            {importing ? 'Đang đọc file...' : '📄 Nhập từ file Word'}
          </Button>
          <Button variant="amber" onClick={openAdd}>+ Thêm hợp đồng</Button>
        </div>
      </div>

      {importError && (
        <div className="mb-4"><ErrorState message={importError} /></div>
      )}

      <div className="flex gap-3 mb-4">
        <input
          placeholder="Tìm theo số HĐ hoặc tên khách hàng..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-xs px-3 py-2 rounded-lg border border-[var(--color-line)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-amber)]/50"
        />
        <select
          value={filterTrangThai}
          onChange={(e) => setFilterTrangThai(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[var(--color-line)] bg-white text-sm"
        >
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(TRANG_THAI_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="p-4"><ErrorState message={error} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Chưa có hợp đồng nào"
            sub="Thêm hợp đồng thủ công hoặc nhập từ file Word."
            action={<Button variant="amber" onClick={openAdd}>+ Thêm hợp đồng</Button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wide border-b border-[var(--color-line)]">
                <th className="px-5 py-3 font-medium">Số HĐ</th>
                <th className="px-5 py-3 font-medium">Khách hàng</th>
                <th className="px-5 py-3 font-medium">Nhân viên PT</th>
                <th className="px-5 py-3 font-medium">Thời hạn</th>
                <th className="px-5 py-3 font-medium text-right">Giá trị</th>
                <th className="px-5 py-3 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((hd) => {
                const dLeft = daysUntil(hd.ngay_ket_thuc)
                return (
                  <tr
                    key={hd.id}
                    onClick={() => navigate(`/hop-dong/${hd.id}`)}
                    className="border-b border-[var(--color-line)] last:border-0 hover:bg-black/[0.02] cursor-pointer"
                  >
                    <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{hd.so_hop_dong}</td>
                    <td className="px-5 py-3">
                      {hd.khach_hang?.ten_khach_hang || '—'}
                      {hd.khach_hang?.phan_loai && (
                        <span className="text-xs text-[var(--color-text-muted)] ml-1">
                          ({PHAN_LOAI_LABELS[hd.khach_hang.phan_loai]})
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[var(--color-text-muted)]">{hd.nhan_vien?.ho_ten || '—'}</td>
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

      {/* Modal thêm hợp đồng thủ công */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Thêm hợp đồng" wide>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Số hợp đồng *"
              required
              value={form.so_hop_dong}
              onChange={(e) => setForm({ ...form, so_hop_dong: e.target.value })}
            />
            <Select
              label="Trạng thái"
              value={form.trang_thai}
              onChange={(e) => setForm({ ...form, trang_thai: e.target.value })}
            >
              {Object.entries(TRANG_THAI_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Khách hàng *"
              required
              value={form.khach_hang_id}
              onChange={(e) => setForm({ ...form, khach_hang_id: e.target.value })}
            >
              <option value="">— Chọn khách hàng —</option>
              {khachHangs.map((kh) => (
                <option key={kh.id} value={kh.id}>{kh.ten_khach_hang}</option>
              ))}
            </Select>
            <Select
              label="Nhân viên phụ trách"
              value={form.nhan_vien_id}
              onChange={(e) => setForm({ ...form, nhan_vien_id: e.target.value })}
            >
              <option value="">— Chọn nhân viên —</option>
              {nhanViens.map((nv) => (
                <option key={nv.id} value={nv.id}>{nv.ho_ten}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Ngày bắt đầu"
              type="date"
              value={form.ngay_bat_dau}
              onChange={(e) => setForm({ ...form, ngay_bat_dau: e.target.value })}
            />
            <Input
              label="Ngày kết thúc"
              type="date"
              value={form.ngay_ket_thuc}
              onChange={(e) => setForm({ ...form, ngay_ket_thuc: e.target.value })}
            />
            <Input
              label="Giá trị hợp đồng (đ)"
              type="number"
              min="0"
              value={form.gia_tri_hop_dong}
              onChange={(e) => setForm({ ...form, gia_tri_hop_dong: e.target.value })}
            />
          </div>
          <Textarea
            label="Ghi chú"
            rows={2}
            value={form.ghi_chu}
            onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })}
          />
          <Textarea
            label="Ghi chú hợp đồng"
            rows={2}
            value={form.ghi_chu_hop_dong}
            onChange={(e) => setForm({ ...form, ghi_chu_hop_dong: e.target.value })}
          />
          {khachHangs.length === 0 && (
            <p className="text-xs text-[var(--color-amber-dark)]">
              Bạn chưa có khách hàng nào. Hãy thêm khách hàng trước ở mục "Khách hàng".
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Huỷ</Button>
            <Button type="submit" variant="amber" disabled={saving || khachHangs.length === 0}>
              {saving ? 'Đang lưu...' : 'Lưu & mở chi tiết'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal xác nhận — chỉ cho các file KHÔNG đủ dữ liệu để tự lưu (thiếu số HĐ / thiếu tên khách hàng).
          Các file đọc đủ dữ liệu đã được lưu thẳng, không cần xác nhận. */}
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title={`Cần xem lại (${importQueue.length} file)`} wide>
        {importQueue.length > 0 && (
          <form onSubmit={handleConfirmImport} className="space-y-4">
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              {importQueue.map((item) => (
                <div key={item.key} className="border border-[var(--color-line)] rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-[var(--color-ink)] truncate">{item.file.name}</div>
                      <div className="text-xs text-[var(--color-amber-dark)] mt-0.5">{item.reason}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImportQueueItem(item.key)}
                      className="text-xs text-[var(--color-danger)] hover:underline shrink-0 ml-3 cursor-pointer"
                    >
                      Bỏ qua file này
                    </button>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                      Khách hàng (Bên B)
                    </p>
                    <div className="flex gap-4 mb-3 text-sm">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          checked={item.khachHangMode === 'existing'}
                          onChange={() => updateImportQueueItem(item.key, { khachHangMode: 'existing' })}
                        />
                        Dùng khách hàng có sẵn
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          checked={item.khachHangMode === 'new'}
                          onChange={() => updateImportQueueItem(item.key, { khachHangMode: 'new' })}
                        />
                        Tạo khách hàng mới
                      </label>
                    </div>

                    {item.khachHangMode === 'existing' ? (
                      <Select
                        label="Khách hàng"
                        value={item.khach_hang_id}
                        onChange={(e) => updateImportQueueItem(item.key, { khach_hang_id: e.target.value })}
                      >
                        <option value="">— Chọn khách hàng —</option>
                        {khachHangs.map((kh) => (
                          <option key={kh.id} value={kh.id}>{kh.ten_khach_hang}</option>
                        ))}
                      </Select>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Tên khách hàng *"
                          required
                          className="col-span-2"
                          value={item.newForm.ten_khach_hang}
                          onChange={(e) => updateImportQueueItemNewForm(item.key, { ten_khach_hang: e.target.value })}
                        />
                        <Select
                          label="Phân loại"
                          value={item.newForm.phan_loai}
                          onChange={(e) => updateImportQueueItemNewForm(item.key, { phan_loai: e.target.value })}
                        >
                          {Object.entries(PHAN_LOAI_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v} ({k})</option>
                          ))}
                        </Select>
                        <Input
                          label="Địa chỉ"
                          className="col-span-2"
                          value={item.newForm.dia_chi}
                          onChange={(e) => updateImportQueueItemNewForm(item.key, { dia_chi: e.target.value })}
                        />
                        <Input
                          label="Điện thoại"
                          value={item.newForm.so_dien_thoai}
                          onChange={(e) => updateImportQueueItemNewForm(item.key, { so_dien_thoai: e.target.value })}
                        />
                        <Input
                          label="Mã số thuế"
                          value={item.newForm.ma_so_thue}
                          onChange={(e) => updateImportQueueItemNewForm(item.key, { ma_so_thue: e.target.value })}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                      Thông tin hợp đồng
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Số hợp đồng *"
                        required
                        placeholder="File không có sẵn — nhập tay"
                        value={item.so_hop_dong}
                        onChange={(e) => updateImportQueueItem(item.key, { so_hop_dong: e.target.value })}
                      />
                      <Select
                        label="Nhân viên phụ trách"
                        value={item.nhan_vien_id}
                        onChange={(e) => updateImportQueueItem(item.key, { nhan_vien_id: e.target.value })}
                      >
                        <option value="">— Chọn nhân viên —</option>
                        {nhanViens.map((nv) => (
                          <option key={nv.id} value={nv.id}>{nv.ho_ten}</option>
                        ))}
                      </Select>
                      <Input
                        label="Ngày bắt đầu"
                        type="date"
                        value={item.ngay_bat_dau}
                        onChange={(e) => updateImportQueueItem(item.key, { ngay_bat_dau: e.target.value })}
                      />
                      <Input
                        label="Ngày kết thúc"
                        type="date"
                        value={item.ngay_ket_thuc}
                        onChange={(e) => updateImportQueueItem(item.key, { ngay_ket_thuc: e.target.value })}
                      />
                      <Input
                        label="Giá trị hợp đồng (đ)"
                        type="number"
                        min="0"
                        value={item.gia_tri_hop_dong}
                        onChange={(e) => updateImportQueueItem(item.key, { gia_tri_hop_dong: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-[var(--color-text-muted)]">
              Các file này thiếu dữ liệu bắt buộc nên không tự lưu được — kiểm tra/điền thêm rồi bấm Lưu.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setImportOpen(false)}>Huỷ tất cả</Button>
              <Button type="submit" variant="amber" disabled={saving}>
                {saving ? 'Đang lưu...' : `Lưu ${importQueue.length} file`}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}