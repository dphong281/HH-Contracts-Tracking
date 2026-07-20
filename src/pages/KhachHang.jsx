import { useEffect, useRef, useState } from 'react'
import {
  getKhachHangList,
  createKhachHang,
  updateKhachHang,
  deleteKhachHang,
  getTaiLieuByKhachHang,
  uploadTaiLieuKhachHang,
  getTaiLieuSignedUrl,
  deleteTaiLieuKhachHang,
  ConflictError,
} from '../lib/queries'
import { PHAN_LOAI_LABELS } from '../lib/format'
import { useRealtimeRefresh } from '../lib/useRealtime'
import { normalizeVN } from '../lib/wordImport'
import {
  Card,
  Button,
  Badge,
  Input,
  Select,
  Textarea,
  Modal,
  EmptyState,
  LoadingState,
  ErrorState,
} from '../components/ui'

const LOAI_GIAY_TO_LABELS = {
  cccd: 'CCCD/CMND',
  dkkd: 'Giấy ĐKKD/hộ kinh doanh',
  giay_phep_xang_dau: 'Giấy phép KD xăng dầu',
  khac: 'Khác',
}

// Chỉ giữ lại chữ số — so khớp MST kiểu này chịu được khác biệt do OCR đọc lẫn
// khoảng trắng/dấu gạch/chấm ("031234 5678" vs "0312345678").
function onlyDigits(str = '') {
  return str.replace(/\D/g, '')
}

// Bỏ các tiền tố loại hình doanh nghiệp phổ biến trước khi so khớp tên — vì OCR/
// tên trên giấy tờ hay ghi đầy đủ "CÔNG TY TNHH ABC" trong khi tên lưu trong app
// có thể ghi tắt "ABC" hoặc ngược lại, nếu so khớp tuyệt đối sẽ luôn trượt.
function coreCompanyName(name = '') {
  return normalizeVN(name)
    .replace(/^(cong ty|cty)\s*(tnhh|co phan|cp|hop danh|tu nhan)?\s*(mot thanh vien|1 thanh vien)?\s*/i, '')
    .replace(/^(doanh nghiep tu nhan|dntn|ho kinh doanh|hkd)\s*/i, '')
    .trim()
}

// So khớp 1 khách hàng trong danh sách theo MST (ưu tiên, chỉ so số) rồi tới tên
// (so khớp tuyệt đối trước, không thấy thì so khớp "tên lõi" sau khi bỏ tiền tố
// loại hình doanh nghiệp — chỉ nhận khi đủ dài để tránh khớp nhầm).
function findMatchingKhachHang(list, candidateName, candidateMst) {
  const mstDigits = onlyDigits(candidateMst)
  if (mstDigits) {
    const byMst = list.find((kh) => kh.ma_so_thue && onlyDigits(kh.ma_so_thue) === mstDigits)
    if (byMst) return byMst
  }
  if (!candidateName) return null

  const normTarget = normalizeVN(candidateName)
  const exact = list.find((kh) => normalizeVN(kh.ten_khach_hang) === normTarget)
  if (exact) return exact

  const coreTarget = coreCompanyName(candidateName)
  if (coreTarget.length >= 4) {
    const byCore = list.find((kh) => coreCompanyName(kh.ten_khach_hang) === coreTarget)
    if (byCore) return byCore
  }

  // Tầng cuối: tên thư mục là TÊN VIẾT TẮT/1 TỪ nằm trong tên đầy đủ (VD thư mục
  // "AHH" ứng với "CÔNG TY TNHH XĂNG DẦU AHH"). So khớp theo ranh giới từ (không
  // phải substring thô, tránh dính vào giữa 1 từ khác) — CHỈ tự chọn khi từ đó
  // khớp DUY NHẤT 1 khách hàng trong danh sách, nếu khớp nhiều người thì bỏ qua
  // để người dùng tự chọn tay, tránh gắn nhầm khách hàng.
  if (normTarget.length >= 2) {
    const escaped = normTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const wordBoundaryRe = new RegExp(`(^|\\s)${escaped}(\\s|$)`)
    const candidates = list.filter((kh) => wordBoundaryRe.test(normalizeVN(kh.ten_khach_hang)))
    if (candidates.length === 1) return candidates[0]
  }

  return null
}

const EMPTY_FORM = {
  ten_khach_hang: '',
  phan_loai: 'DL',
  dia_chi: '',
  so_dien_thoai: '',
  email: '',
  ma_so_thue: '',
  ghi_chu: '',
}

const PHAN_LOAI_COLORS = {
  DL: 'bg-[#E8973A]/15 text-[#C97A22]',
  MB: 'bg-[#2F7A5E]/12 text-[#2F7A5E]',
  TNPP: 'bg-[#0F2A3D]/10 text-[#0F2A3D]',
  TTTT: 'bg-[#6B7680]/12 text-[#6B7680]',
}

export default function KhachHang() {
  const docInputRef = useRef(null)

  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterLoai, setFilterLoai] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Giấy tờ đính kèm của khách hàng đang sửa
  const [taiLieus, setTaiLieus] = useState([])
  const [taiLieusLoading, setTaiLieusLoading] = useState(false)

  // Nhập giấy tờ theo thư mục — mỗi thư mục = 1 khách hàng
  const [docImportError, setDocImportError] = useState(null)
  const [docImportOpen, setDocImportOpen] = useState(false)
  const [docQueue, setDocQueue] = useState([]) // [{ key, file, parsed, khach_hang_id, mode, newForm }]

  useEffect(() => {
    load()
  }, [])

  useRealtimeRefresh(['khach_hang'], load)

  async function load() {
    setLoading(true)
    const { data, error } = await getKhachHangList()
    if (error) setError(error.message)
    else setList(data || [])
    setLoading(false)
  }

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setTaiLieus([])
    setModalOpen(true)
  }

  async function openEdit(kh) {
    setEditing(kh)
    setForm({ ...EMPTY_FORM, ...kh })
    setModalOpen(true)
    setTaiLieusLoading(true)
    const { data } = await getTaiLieuByKhachHang(kh.id)
    setTaiLieus(data || [])
    setTaiLieusLoading(false)
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

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form }
    const expectedUpdatedAt = payload.updated_at
    delete payload.id
    delete payload.created_at
    delete payload.updated_at

    const { error } = editing
      ? await updateKhachHang(editing.id, payload, expectedUpdatedAt)
      : await createKhachHang(payload)

    setSaving(false)
    if (error) {
      if (error instanceof ConflictError) {
        alert(error.message)
        setModalOpen(false)
        load()
        return
      }
      alert('Lỗi lưu dữ liệu: ' + error.message)
      return
    }
    setModalOpen(false)
    load()
  }

  async function handleDelete(kh) {
    if (!confirm(`Xoá khách hàng "${kh.ten_khach_hang}"? Hành động này không thể hoàn tác.`)) return
    const { error } = await deleteKhachHang(kh.id)
    if (error) {
      alert('Không thể xoá: ' + error.message + ' (có thể khách hàng này đang gắn với hợp đồng)')
      return
    }
    load()
  }

  // ---------- NHẬP GIẤY TỜ THEO THƯ MỤC — tên thư mục = tên khách hàng ----------
  // Chọn 1 thư mục cha chứa nhiều thư mục con (mỗi thư mục con là 1 khách hàng),
  // hoặc chọn thẳng 1 thư mục của 1 khách hàng. App nhóm file theo thư mục cha
  // trực tiếp của mỗi file, rồi so khớp TÊN THƯ MỤC với danh sách khách hàng —
  // đáng tin hơn nhiều so với đọc OCR nội dung từng file.
  function openDocPicker() {
    setDocImportError(null)
    docInputRef.current?.click()
  }

  const DOC_EXT_RE = /\.(pdf|png|jpe?g|webp)$/i

  // Đoán loại giấy tờ từ TÊN FILE — chỉ để gợi ý, không bắt buộc đúng, người dùng
  // sửa lại được trong modal xác nhận. Không chạy OCR nên xử lý gần như tức thì.
  function guessLoaiGiayToFromFilename(name = '') {
    const n = normalizeVN(name)
    if (/cccd|cmnd|can cuoc/.test(n)) return 'cccd'
    if (/dkkd|gcndkkd|dang ky kinh doanh|ho kinh doanh/.test(n)) return 'dkkd'
    if (/gpkd|gpxd|giay phep/.test(n)) return 'giay_phep_xang_dau'
    return 'khac'
  }

  async function handleDocFolderSelected(e) {
    const allFiles = Array.from(e.target.files || [])
    e.target.value = ''
    if (allFiles.length === 0) return

    const files = allFiles.filter((f) => DOC_EXT_RE.test(f.name))
    const skipped = allFiles.length - files.length

    // Nhóm theo thư mục cha TRỰC TIẾP của mỗi file (luôn đúng vị trí này bất kể
    // bạn chọn thư mục gốc ở cấp nào — webkitRelativePath giữ nguyên toàn bộ đường dẫn con).
    const groups = new Map()
    for (const file of files) {
      const relPath = file.webkitRelativePath || file.name
      const parts = relPath.split('/')
      const folderName = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
      if (!groups.has(folderName)) groups.set(folderName, [])
      groups.get(folderName).push(file)
    }

    const queue = []
    for (const [folderName, groupFiles] of groups.entries()) {
      const match = findMatchingKhachHang(list, folderName, '')
      queue.push({
        key: `${folderName}-${Date.now()}-${Math.random()}`,
        folderName,
        files: groupFiles,
        khach_hang_id: match ? match.id : '',
        mode: match ? 'existing' : 'new',
        newForm: { ...EMPTY_FORM, ten_khach_hang: folderName },
      })
    }

    setDocImportError(skipped > 0 ? `Đã bỏ qua ${skipped} file không phải .pdf/.png/.jpg trong thư mục đã chọn.` : null)

    if (queue.length > 0) {
      setDocQueue(queue)
      setDocImportOpen(true)
    }
  }

  function updateQueueItem(key, patch) {
    setDocQueue((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)))
  }

  function updateQueueItemNewForm(key, patch) {
    setDocQueue((prev) => prev.map((it) => (it.key === key ? { ...it, newForm: { ...it.newForm, ...patch } } : it)))
  }

  function removeQueueItem(key) {
    setDocQueue((prev) => prev.filter((it) => it.key !== key))
  }

  async function handleConfirmDocImport(e) {
    e.preventDefault()
    setSaving(true)

    const errors = []
    let attachedToEditing = false

    for (const item of docQueue) {
      let khachHangId = item.khach_hang_id

      if (item.mode === 'new') {
        if (!item.newForm.ten_khach_hang) {
          errors.push(`${item.folderName}: cần nhập tên khách hàng để tạo mới`)
          continue
        }
        const { data: khData, error: khError } = await createKhachHang({
          ten_khach_hang: item.newForm.ten_khach_hang,
          phan_loai: item.newForm.phan_loai,
          dia_chi: item.newForm.dia_chi || null,
          so_dien_thoai: item.newForm.so_dien_thoai || null,
          email: item.newForm.email || null,
          ma_so_thue: item.newForm.ma_so_thue || null,
          ghi_chu: item.newForm.ghi_chu || null,
        })
        if (khError) { errors.push(`${item.folderName}: lỗi tạo khách hàng — ${khError.message}`); continue }
        khachHangId = khData.id
      }

      if (!khachHangId) {
        errors.push(`${item.folderName}: chưa chọn khách hàng để đính kèm`)
        continue
      }

      for (const file of item.files) {
        const { error } = await uploadTaiLieuKhachHang(khachHangId, file, guessLoaiGiayToFromFilename(file.name))
        if (error) errors.push(`${item.folderName}/${file.name}: lỗi lưu file — ${error.message}`)
      }
      if (editing?.id === khachHangId) attachedToEditing = true
    }

    setSaving(false)
    setDocImportOpen(false)
    setDocQueue([])
    load()

    // Nếu đang mở đúng khách hàng vừa đính kèm, làm mới luôn danh sách giấy tờ trong modal.
    if (attachedToEditing) {
      const { data } = await getTaiLieuByKhachHang(editing.id)
      setTaiLieus(data || [])
    }

    if (errors.length > 0) {
      alert(`Có lỗi khi lưu:\n` + errors.join('\n'))
    }
  }

  const filtered = list.filter((kh) => {
    const matchSearch = kh.ten_khach_hang?.toLowerCase().includes(search.toLowerCase())
    const matchLoai = filterLoai === 'all' || kh.phan_loai === filterLoai
    return matchSearch && matchLoai
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Khách hàng</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Danh sách khách hàng ký hợp đồng đầu ra
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={docInputRef}
            type="file"
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={handleDocFolderSelected}
          />
          <Button variant="ghost" onClick={openDocPicker}>
            📁 Nhập giấy tờ theo thư mục
          </Button>
          <Button variant="amber" onClick={openAdd}>+ Thêm khách hàng</Button>
        </div>
      </div>

      {docImportError && (
        <div className="mb-4"><ErrorState message={docImportError} /></div>
      )}

      <div className="flex gap-3 mb-4">
        <input
          placeholder="Tìm theo tên khách hàng..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-xs px-3 py-2 rounded-lg border border-[var(--color-line)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-amber)]/50"
        />
        <select
          value={filterLoai}
          onChange={(e) => setFilterLoai(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[var(--color-line)] bg-white text-sm"
        >
          <option value="all">Tất cả phân loại</option>
          {Object.entries(PHAN_LOAI_LABELS).map(([k, v]) => (
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
            title="Chưa có khách hàng nào"
            sub="Thêm khách hàng đầu tiên để bắt đầu tạo hợp đồng."
            action={<Button variant="amber" onClick={openAdd}>+ Thêm khách hàng</Button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wide border-b border-[var(--color-line)]">
                <th className="px-5 py-3 font-medium">Tên khách hàng</th>
                <th className="px-5 py-3 font-medium">Phân loại</th>
                <th className="px-5 py-3 font-medium">Liên hệ</th>
                <th className="px-5 py-3 font-medium">Mã số thuế</th>
                <th className="px-5 py-3 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((kh) => (
                <tr key={kh.id} className="border-b border-[var(--color-line)] last:border-0 hover:bg-black/[0.015]">
                  <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{kh.ten_khach_hang}</td>
                  <td className="px-5 py-3">
                    <Badge className={PHAN_LOAI_COLORS[kh.phan_loai]}>
                      {PHAN_LOAI_LABELS[kh.phan_loai] || kh.phan_loai || '—'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-[var(--color-text-muted)]">
                    {kh.so_dien_thoai || kh.email || '—'}
                  </td>
                  <td className="px-5 py-3 text-[var(--color-text-muted)]">{kh.ma_so_thue || '—'}</td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(kh)} className="text-[var(--color-ink)] hover:underline text-sm font-medium">
                      Sửa
                    </button>
                    <button onClick={() => handleDelete(kh)} className="text-[var(--color-danger)] hover:underline text-sm font-medium">
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Sửa khách hàng' : 'Thêm khách hàng'} wide>
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Tên khách hàng *"
            required
            value={form.ten_khach_hang}
            onChange={(e) => setForm({ ...form, ten_khach_hang: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Phân loại khách hàng"
              value={form.phan_loai}
              onChange={(e) => setForm({ ...form, phan_loai: e.target.value })}
            >
              {Object.entries(PHAN_LOAI_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v} ({k})</option>
              ))}
            </Select>
            <Input
              label="Mã số thuế"
              value={form.ma_so_thue || ''}
              onChange={(e) => setForm({ ...form, ma_so_thue: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Số điện thoại"
              value={form.so_dien_thoai || ''}
              onChange={(e) => setForm({ ...form, so_dien_thoai: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              value={form.email || ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <Input
            label="Địa chỉ"
            value={form.dia_chi || ''}
            onChange={(e) => setForm({ ...form, dia_chi: e.target.value })}
          />
          <Textarea
            label="Ghi chú"
            rows={3}
            value={form.ghi_chu || ''}
            onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })}
          />

          {editing && (
            <div>
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                Giấy tờ đính kèm
              </p>
              {taiLieusLoading ? (
                <LoadingState />
              ) : taiLieus.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)]">
                  Chưa có giấy tờ nào. Dùng nút "📄 Nhập giấy tờ" ở trang danh sách để đính kèm.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--color-line)] border border-[var(--color-line)] rounded-lg">
                  {taiLieus.map((tl) => (
                    <li key={tl.id} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
                      <button
                        type="button"
                        onClick={() => handleViewTaiLieu(tl)}
                        className="text-left text-[var(--color-ink)] hover:underline truncate"
                      >
                        {tl.ten_file}
                        {tl.loai_giay_to && (
                          <span className="text-xs text-[var(--color-text-muted)] ml-1.5">
                            ({LOAI_GIAY_TO_LABELS[tl.loai_giay_to] || tl.loai_giay_to})
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTaiLieu(tl)}
                        className="text-xs text-[var(--color-danger)] hover:underline shrink-0"
                      >
                        Xoá
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Huỷ</Button>
            <Button type="submit" variant="amber" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal xác nhận đính kèm giấy tờ vừa đọc — có thể nhiều file cùng lúc */}
      <Modal open={docImportOpen} onClose={() => setDocImportOpen(false)} title={`Xác nhận đính kèm giấy tờ (${docQueue.length} khách hàng)`} wide>
        {docQueue.length > 0 && (
          <form onSubmit={handleConfirmDocImport} className="space-y-4">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {docQueue.map((item) => (
                <div key={item.key} className="border border-[var(--color-line)] rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-[var(--color-ink)] truncate">
                      📁 {item.folderName}
                      <span className="text-xs text-[var(--color-text-muted)] font-normal ml-1.5">({item.files.length} file)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeQueueItem(item.key)}
                      className="text-xs text-[var(--color-danger)] hover:underline shrink-0 ml-3"
                    >
                      Bỏ qua thư mục này
                    </button>
                  </div>

                  <ul className="text-xs text-[var(--color-text-muted)] pl-1 space-y-0.5">
                    {item.files.map((f, i) => (
                      <li key={i} className="truncate">{f.name}</li>
                    ))}
                  </ul>

                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={item.mode === 'existing'}
                        onChange={() => updateQueueItem(item.key, { mode: 'existing' })}
                      />
                      Khách hàng có sẵn
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={item.mode === 'new'}
                        onChange={() => updateQueueItem(item.key, { mode: 'new' })}
                      />
                      Tạo khách hàng mới
                    </label>
                  </div>

                  {item.mode === 'existing' ? (
                    <Select
                      label="Khách hàng *"
                      required
                      value={item.khach_hang_id}
                      onChange={(e) => updateQueueItem(item.key, { khach_hang_id: e.target.value })}
                    >
                      <option value="">— Chọn khách hàng —</option>
                      {list.map((kh) => (
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
                        onChange={(e) => updateQueueItemNewForm(item.key, { ten_khach_hang: e.target.value })}
                      />
                      <Select
                        label="Phân loại"
                        value={item.newForm.phan_loai}
                        onChange={(e) => updateQueueItemNewForm(item.key, { phan_loai: e.target.value })}
                      >
                        {Object.entries(PHAN_LOAI_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v} ({k})</option>
                        ))}
                      </Select>
                      <Input
                        label="Mã số thuế"
                        value={item.newForm.ma_so_thue}
                        onChange={(e) => updateQueueItemNewForm(item.key, { ma_so_thue: e.target.value })}
                      />
                      <Input
                        label="Địa chỉ"
                        className="col-span-2"
                        value={item.newForm.dia_chi}
                        onChange={(e) => updateQueueItemNewForm(item.key, { dia_chi: e.target.value })}
                      />
                      <Input
                        label="Số điện thoại"
                        value={item.newForm.so_dien_thoai}
                        onChange={(e) => updateQueueItemNewForm(item.key, { so_dien_thoai: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs text-[var(--color-text-muted)]">
              Khách hàng được gợi ý theo tên thư mục — kiểm tra lại đúng khách hàng trước khi lưu, đặc biệt nếu nhiều khách hàng có tên gần giống nhau.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setDocImportOpen(false)}>Huỷ tất cả</Button>
              <Button type="submit" variant="amber" disabled={saving}>
                {saving ? 'Đang lưu...' : `Lưu ${docQueue.length} file`}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}