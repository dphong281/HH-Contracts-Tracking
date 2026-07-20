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
  const [importData, setImportData] = useState(null)
  const [matchedKhachHang, setMatchedKhachHang] = useState(null)
  const [khachHangMode, setKhachHangMode] = useState('existing') // 'existing' | 'new'

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

  // ---------- NHẬP TỪ FILE WORD ----------
  function openFilePicker() {
    setImportError(null)
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.docx')) {
      setImportError(
        'Chỉ đọc được file .docx. Nếu file của bạn là .doc (Word cũ), mở file đó trong Word → File → Save As → chọn định dạng .docx rồi tải lên lại.'
      )
      return
    }

    setImporting(true)
    setImportError(null)
    try {
      const text = await extractTextFromDocx(file)
      const parsed = parseContractText(text)

      if (!parsed.ten_khach_hang) {
        setImportError('Không tìm thấy thông tin "Bên B" trong file. Bạn có thể nhập thủ công bên dưới hoặc kiểm tra lại file.')
      }

      const normTarget = normalizeVN(parsed.ten_khach_hang)
      const match = khachHangs.find((kh) => normalizeVN(kh.ten_khach_hang) === normTarget)
      setMatchedKhachHang(match || null)
      setKhachHangMode(match ? 'existing' : 'new')

      setImportData({
        ten_khach_hang: parsed.ten_khach_hang,
        dia_chi: parsed.dia_chi,
        so_dien_thoai: parsed.so_dien_thoai,
        ma_so_thue: parsed.ma_so_thue,
        phan_loai: parsed.phan_loai_goi_y || 'DL',
        so_hop_dong: parsed.so_hop_dong,
        ngay_bat_dau: parsed.ngay_bat_dau,
        ngay_ket_thuc: parsed.ngay_ket_thuc,
        gia_tri_hop_dong: '',
        nhan_vien_id: '',
        khach_hang_id_existing: match ? match.id : '',
        ghi_chu: '',
        ghi_chu_hop_dong: `Nhập tự động từ file Word: ${file.name}`,
        // Thông tin phụ trích xuất từ file — chỉ để xem/lưu kèm, không có ô nhập riêng.
        // Được lưu nguyên vào cột jsonb `chi_tiet_import` của hop_dong_dau_ra.
        chi_tiet_import: {
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
        },
      })
      setImportOpen(true)
    } catch (err) {
      setImportError('Không đọc được nội dung file: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  async function handleConfirmImport(e) {
    e.preventDefault()
    setSaving(true)
    try {
      let khachHangId = importData.khach_hang_id_existing

      if (khachHangMode === 'new') {
        if (!importData.ten_khach_hang) {
          alert('Cần có tên khách hàng để tạo mới.')
          setSaving(false)
          return
        }
        const { data: khData, error: khError } = await createKhachHang({
          ten_khach_hang: importData.ten_khach_hang,
          phan_loai: importData.phan_loai,
          dia_chi: importData.dia_chi || null,
          so_dien_thoai: importData.so_dien_thoai || null,
          ma_so_thue: importData.ma_so_thue || null,
        })
        if (khError) { alert('Lỗi tạo khách hàng: ' + khError.message); setSaving(false); return }
        khachHangId = khData.id
      }

      if (!khachHangId) {
        alert('Bạn cần chọn khách hàng có sẵn hoặc tạo khách hàng mới.')
        setSaving(false)
        return
      }
      if (!importData.so_hop_dong) {
        alert('Cần nhập Số hợp đồng (file không có sẵn số HĐ).')
        setSaving(false)
        return
      }

      const { data, error } = await createHopDong({
        khach_hang_id: khachHangId,
        nhan_vien_id: importData.nhan_vien_id || null,
        so_hop_dong: importData.so_hop_dong,
        ngay_bat_dau: importData.ngay_bat_dau || null,
        ngay_ket_thuc: importData.ngay_ket_thuc || null,
        gia_tri_hop_dong: Number(importData.gia_tri_hop_dong) || 0,
        trang_thai: 'dang_hieu_luc',
        ghi_chu: importData.ghi_chu || null,
        ghi_chu_hop_dong: importData.ghi_chu_hop_dong || null,
        chi_tiet_import: importData.chi_tiet_import || null,
      })
      setSaving(false)
      if (error) { alert('Lỗi lưu hợp đồng: ' + error.message); return }
      setImportOpen(false)
      navigate(`/hop-dong/${data.id}`)
    } catch (err) {
      setSaving(false)
      alert('Lỗi: ' + err.message)
    }
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

      {/* Modal xác nhận dữ liệu nhập từ Word */}
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Xác nhận thông tin nhập từ file Word" wide>
        {importData && (
          <form onSubmit={handleConfirmImport} className="space-y-5">
            <div>
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                Thông tin khách hàng (Bên B)
              </p>
              {matchedKhachHang && (
                <div className="mb-3 p-3 rounded-lg bg-[#2F7A5E]/8 text-sm text-[var(--color-good)]">
                  Đã tìm thấy khách hàng có sẵn trùng tên: <strong>{matchedKhachHang.ten_khach_hang}</strong>
                </div>
              )}
              <div className="flex gap-4 mb-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={khachHangMode === 'existing'}
                    onChange={() => setKhachHangMode('existing')}
                    disabled={!matchedKhachHang}
                  />
                  Dùng khách hàng có sẵn
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={khachHangMode === 'new'}
                    onChange={() => setKhachHangMode('new')}
                  />
                  Tạo khách hàng mới từ dữ liệu trích xuất
                </label>
              </div>

              {khachHangMode === 'existing' ? (
                <Select
                  label="Khách hàng"
                  value={importData.khach_hang_id_existing}
                  onChange={(e) => setImportData({ ...importData, khach_hang_id_existing: e.target.value })}
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
                    value={importData.ten_khach_hang}
                    onChange={(e) => setImportData({ ...importData, ten_khach_hang: e.target.value })}
                  />
                  <Select
                    label="Phân loại"
                    value={importData.phan_loai}
                    onChange={(e) => setImportData({ ...importData, phan_loai: e.target.value })}
                  >
                    {Object.entries(PHAN_LOAI_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v} ({k})</option>
                    ))}
                  </Select>
                  <Input
                    label="Địa chỉ"
                    className="col-span-2"
                    value={importData.dia_chi}
                    onChange={(e) => setImportData({ ...importData, dia_chi: e.target.value })}
                  />
                  <Input
                    label="Điện thoại"
                    value={importData.so_dien_thoai}
                    onChange={(e) => setImportData({ ...importData, so_dien_thoai: e.target.value })}
                  />
                  <Input
                    label="Mã số thuế"
                    value={importData.ma_so_thue}
                    onChange={(e) => setImportData({ ...importData, ma_so_thue: e.target.value })}
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
                  value={importData.so_hop_dong}
                  onChange={(e) => setImportData({ ...importData, so_hop_dong: e.target.value })}
                />
                <Select
                  label="Nhân viên phụ trách"
                  value={importData.nhan_vien_id}
                  onChange={(e) => setImportData({ ...importData, nhan_vien_id: e.target.value })}
                >
                  <option value="">— Chọn nhân viên —</option>
                  {nhanViens.map((nv) => (
                    <option key={nv.id} value={nv.id}>{nv.ho_ten}</option>
                  ))}
                </Select>
                <Input
                  label="Ngày bắt đầu"
                  type="date"
                  value={importData.ngay_bat_dau}
                  onChange={(e) => setImportData({ ...importData, ngay_bat_dau: e.target.value })}
                />
                <Input
                  label="Ngày kết thúc"
                  type="date"
                  value={importData.ngay_ket_thuc}
                  onChange={(e) => setImportData({ ...importData, ngay_ket_thuc: e.target.value })}
                />
                <Input
                  label="Giá trị hợp đồng (đ)"
                  type="number"
                  min="0"
                  value={importData.gia_tri_hop_dong}
                  onChange={(e) => setImportData({ ...importData, gia_tri_hop_dong: e.target.value })}
                />
              </div>
              <Textarea
                label="Ghi chú"
                rows={2}
                className="mt-4"
                value={importData.ghi_chu}
                onChange={(e) => setImportData({ ...importData, ghi_chu: e.target.value })}
              />
              <Textarea
                label="Ghi chú hợp đồng"
                rows={2}
                className="mt-4"
                value={importData.ghi_chu_hop_dong}
                onChange={(e) => setImportData({ ...importData, ghi_chu_hop_dong: e.target.value })}
              />
            </div>

            {importData.chi_tiet_import && (
              <div>
                <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                  Thông tin khác trích xuất từ file (sẽ lưu kèm hợp đồng)
                </p>
                <div className="rounded-lg border border-[var(--color-line)] p-4 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {importData.chi_tiet_import.loai_hop_dong && (
                      <div><span className="text-[var(--color-text-muted)]">Loại HĐ:</span> {importData.chi_tiet_import.loai_hop_dong}</div>
                    )}
                    {importData.chi_tiet_import.ngay_ky && (
                      <div><span className="text-[var(--color-text-muted)]">Ngày ký:</span> {formatDate(importData.chi_tiet_import.ngay_ky)}</div>
                    )}
                    {importData.chi_tiet_import.dia_diem_ky && (
                      <div><span className="text-[var(--color-text-muted)]">Nơi ký:</span> {importData.chi_tiet_import.dia_diem_ky}</div>
                    )}
                    {(importData.chi_tiet_import.so_trang || importData.chi_tiet_import.so_ban) && (
                      <div><span className="text-[var(--color-text-muted)]">Số trang / số bản:</span> {importData.chi_tiet_import.so_trang || '—'} / {importData.chi_tiet_import.so_ban || '—'}</div>
                    )}
                    {importData.chi_tiet_import.ben_b?.dai_dien && (
                      <div><span className="text-[var(--color-text-muted)]">Đại diện Bên B:</span> {importData.chi_tiet_import.ben_b.dai_dien}{importData.chi_tiet_import.ben_b.chuc_vu ? ` (${importData.chi_tiet_import.ben_b.chuc_vu})` : ''}</div>
                    )}
                    {importData.chi_tiet_import.ben_b?.fax && (
                      <div><span className="text-[var(--color-text-muted)]">Fax:</span> {importData.chi_tiet_import.ben_b.fax}</div>
                    )}
                    {importData.chi_tiet_import.ben_b?.tai_khoan?.length > 0 && (
                      <div className="col-span-2"><span className="text-[var(--color-text-muted)]">Số TK:</span> {importData.chi_tiet_import.ben_b.tai_khoan.join(' · ')}</div>
                    )}
                  </div>

                  {importData.chi_tiet_import.san_luong_cam_ket?.length > 0 && (
                    <div>
                      <div className="text-xs text-[var(--color-text-muted)] mb-1">Sản lượng cam kết</div>
                      <table className="w-full text-xs">
                        <tbody>
                          {importData.chi_tiet_import.san_luong_cam_ket.map((sl, i) => (
                            <tr key={i} className="border-t border-[var(--color-line)] first:border-0">
                              <td className="py-1 pr-2">{sl.ten_hang}</td>
                              <td className="py-1 text-right font-medium">{sl.so_luong} {sl.don_vi}/tháng</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {(importData.chi_tiet_import.cong_thuc_gia || importData.chi_tiet_import.chiet_khau) && (
                    <div className="text-xs">
                      <span className="text-[var(--color-text-muted)]">Giá & chiết khấu:</span>{' '}
                      {importData.chi_tiet_import.cong_thuc_gia}
                      {importData.chi_tiet_import.chiet_khau && ` — Chiết khấu: ${importData.chi_tiet_import.chiet_khau}`}
                    </div>
                  )}

                  {(importData.chi_tiet_import.hinh_thuc_mua_ban?.length > 0 || importData.chi_tiet_import.hinh_thuc_thanh_toan?.length > 0) && (
                    <div className="text-xs">
                      {importData.chi_tiet_import.hinh_thuc_mua_ban?.length > 0 && (
                        <div><span className="text-[var(--color-text-muted)]">Hình thức mua bán:</span> {importData.chi_tiet_import.hinh_thuc_mua_ban.join(', ')}</div>
                      )}
                      {importData.chi_tiet_import.hinh_thuc_thanh_toan?.length > 0 && (
                        <div><span className="text-[var(--color-text-muted)]">Hình thức thanh toán:</span> {importData.chi_tiet_import.hinh_thuc_thanh_toan.join(', ')}</div>
                      )}
                      {importData.chi_tiet_import.dat_coc_ky_quy && (
                        <div className="text-[var(--color-amber-dark)]">Có yêu cầu đặt cọc / ký quỹ</div>
                      )}
                      {importData.chi_tiet_import.thoi_han_doi_chieu_cong_no && (
                        <div><span className="text-[var(--color-text-muted)]">Thời hạn đối chiếu công nợ:</span> {importData.chi_tiet_import.thoi_han_doi_chieu_cong_no}</div>
                      )}
                    </div>
                  )}

                  {(importData.chi_tiet_import.dieu_kien_don_phuong_cham_dut?.length > 0 || importData.chi_tiet_import.nghia_vu_treo_logo || importData.chi_tiet_import.gia_han_tu_dong) && (
                    <div className="text-xs space-y-1">
                      {importData.chi_tiet_import.gia_han_tu_dong && (
                        <div><span className="text-[var(--color-text-muted)]">Gia hạn/thanh lý:</span> {importData.chi_tiet_import.gia_han_tu_dong}</div>
                      )}
                      {importData.chi_tiet_import.nghia_vu_treo_logo && (
                        <div>Có nghĩa vụ treo logo / biển hiệu</div>
                      )}
                      {importData.chi_tiet_import.dieu_kien_don_phuong_cham_dut?.length > 0 && (
                        <div>
                          <span className="text-[var(--color-text-muted)]">Điều kiện đơn phương chấm dứt:</span>
                          <ul className="list-disc list-inside mt-0.5">
                            {importData.chi_tiet_import.dieu_kien_don_phuong_cham_dut.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-[var(--color-text-muted)]">
              Dữ liệu được trích xuất tự động từ file Word, kiểm tra lại trước khi lưu — đặc biệt các trường có thể để trống nếu file không ghi rõ.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setImportOpen(false)}>Huỷ</Button>
              <Button type="submit" variant="amber" disabled={saving}>
                {saving ? 'Đang lưu...' : 'Lưu & mở chi tiết'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}