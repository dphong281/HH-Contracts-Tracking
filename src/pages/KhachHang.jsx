import { useEffect, useState } from 'react'
import {
  getKhachHangList,
  createKhachHang,
  updateKhachHang,
  deleteKhachHang,
} from '../lib/queries'
import { PHAN_LOAI_LABELS } from '../lib/format'
import { useRealtimeRefresh } from '../lib/useRealtime'
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
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterLoai, setFilterLoai] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

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
    setModalOpen(true)
  }

  function openEdit(kh) {
    setEditing(kh)
    setForm({ ...EMPTY_FORM, ...kh })
    setModalOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form }
    delete payload.id
    delete payload.created_at
    delete payload.updated_at

    const { error } = editing
      ? await updateKhachHang(editing.id, payload)
      : await createKhachHang(payload)

    setSaving(false)
    if (error) {
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
        <Button variant="amber" onClick={openAdd}>+ Thêm khách hàng</Button>
      </div>

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
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Huỷ</Button>
            <Button type="submit" variant="amber" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
