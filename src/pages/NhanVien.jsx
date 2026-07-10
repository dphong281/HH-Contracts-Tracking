import { useEffect, useState } from 'react'
import { getNhanVienList, createNhanVien, updateNhanVien, deleteNhanVien } from '../lib/queries'
import { useRealtimeRefresh } from '../lib/useRealtime'
import {
  Card, Button, Badge, Input, Modal, EmptyState, LoadingState, ErrorState,
} from '../components/ui'

const EMPTY_FORM = { ho_ten: '', chuc_vu: '', so_dien_thoai: '', email: '', dang_hoat_dong: true }

export default function NhanVien() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  useRealtimeRefresh(['nhan_vien'], load)

  async function load() {
    setLoading(true)
    const { data, error } = await getNhanVienList()
    if (error) setError(error.message)
    else setList(data || [])
    setLoading(false)
  }

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(nv) {
    setEditing(nv)
    setForm({ ...EMPTY_FORM, ...nv })
    setModalOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form }
    delete payload.id
    delete payload.created_at

    const { error } = editing
      ? await updateNhanVien(editing.id, payload)
      : await createNhanVien(payload)

    setSaving(false)
    if (error) {
      alert('Lỗi lưu dữ liệu: ' + error.message)
      return
    }
    setModalOpen(false)
    load()
  }

  async function handleDelete(nv) {
    if (!confirm(`Xoá nhân viên "${nv.ho_ten}"?`)) return
    const { error } = await deleteNhanVien(nv.id)
    if (error) {
      alert('Không thể xoá: ' + error.message)
      return
    }
    load()
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Nhân viên phụ trách</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Danh sách nhân viên gán vào hợp đồng</p>
        </div>
        <Button variant="amber" onClick={openAdd}>+ Thêm nhân viên</Button>
      </div>

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="p-4"><ErrorState message={error} /></div>
        ) : list.length === 0 ? (
          <EmptyState
            title="Chưa có nhân viên nào"
            sub="Thêm nhân viên để gán phụ trách hợp đồng."
            action={<Button variant="amber" onClick={openAdd}>+ Thêm nhân viên</Button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wide border-b border-[var(--color-line)]">
                <th className="px-5 py-3 font-medium">Họ tên</th>
                <th className="px-5 py-3 font-medium">Chức vụ</th>
                <th className="px-5 py-3 font-medium">Liên hệ</th>
                <th className="px-5 py-3 font-medium">Trạng thái</th>
                <th className="px-5 py-3 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {list.map((nv) => (
                <tr key={nv.id} className="border-b border-[var(--color-line)] last:border-0 hover:bg-black/[0.015]">
                  <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{nv.ho_ten}</td>
                  <td className="px-5 py-3 text-[var(--color-text-muted)]">{nv.chuc_vu || '—'}</td>
                  <td className="px-5 py-3 text-[var(--color-text-muted)]">{nv.so_dien_thoai || nv.email || '—'}</td>
                  <td className="px-5 py-3">
                    <Badge className={nv.dang_hoat_dong ? 'bg-[#2F7A5E]/12 text-[#2F7A5E]' : 'bg-[#6B7680]/12 text-[#6B7680]'}>
                      {nv.dang_hoat_dong ? 'Đang làm việc' : 'Ngừng làm việc'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(nv)} className="text-[var(--color-ink)] hover:underline text-sm font-medium">Sửa</button>
                    <button onClick={() => handleDelete(nv)} className="text-[var(--color-danger)] hover:underline text-sm font-medium">Xoá</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Sửa nhân viên' : 'Thêm nhân viên'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Họ tên *" required value={form.ho_ten} onChange={(e) => setForm({ ...form, ho_ten: e.target.value })} />
          <Input label="Chức vụ" value={form.chuc_vu || ''} onChange={(e) => setForm({ ...form, chuc_vu: e.target.value })} />
          <Input label="Số điện thoại" value={form.so_dien_thoai || ''} onChange={(e) => setForm({ ...form, so_dien_thoai: e.target.value })} />
          <Input label="Email" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.dang_hoat_dong}
              onChange={(e) => setForm({ ...form, dang_hoat_dong: e.target.checked })}
            />
            Đang làm việc
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Huỷ</Button>
            <Button type="submit" variant="amber" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
