import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getTaiKhoanList, updateTaiKhoan, getYeuCauHoTroList, markYeuCauDaXuLy, exportAllDataForBackup, encryptExistingData, getCaiDatHeThong, updateCaiDatHeThong, restoreFromBackupJson } from '../lib/queries'
import { adminCreateUser, adminResetPassword } from '../lib/adminApi'
import { Card, Button, Badge, Input, Select, Modal, LoadingState, ErrorState, EmptyState } from '../components/ui'

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('vi-VN')
}

export default function CaiDat() {
  const { user, hoTen, isAdmin } = useAuth()

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Cài đặt</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Hồ sơ cá nhân và quản trị hệ thống</p>
      </div>

      <div className="space-y-6">
        <HoSoCaNhan userId={user.id} initialHoTen={hoTen} />
        {isAdmin && <QuanLyTaiKhoan currentUserId={user.id} />}
        {isAdmin && <YeuCauQuenMatKhau />}
        {isAdmin && <MaHoaDuLieuCu />}
        {isAdmin && <LichBackup />}
        {isAdmin && <SaoLuuDuLieu />}
        {isAdmin && <KhoiPhucBackup />}
      </div>
    </div>
  )
}

// ============================================================
// HỒ SƠ CÁ NHÂN — ai cũng có
// ============================================================
function HoSoCaNhan({ userId, initialHoTen }) {
  const [hoTen, setHoTen] = useState(initialHoTen || '')
  const [soDienThoai, setSoDienThoai] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const [newPassword, setNewPassword] = useState('')
  const [changingPw, setChangingPw] = useState(false)
  const [pwMessage, setPwMessage] = useState(null)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('tai_khoan').select('*').eq('id', userId).single()
      if (data) {
        setHoTen(data.ho_ten || '')
        setSoDienThoai(data.so_dien_thoai || '')
      }
      setLoading(false)
    })()
  }, [userId])

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    const { error } = await updateTaiKhoan(userId, { ho_ten: hoTen, so_dien_thoai: soDienThoai || null })
    setSaving(false)
    setMessage(error ? { type: 'error', text: error.message } : { type: 'success', text: 'Đã lưu.' })
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (newPassword.length < 6) {
      setPwMessage({ type: 'error', text: 'Mật khẩu cần tối thiểu 6 ký tự.' })
      return
    }
    setChangingPw(true)
    setPwMessage(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setChangingPw(false)
    if (error) setPwMessage({ type: 'error', text: error.message })
    else {
      setPwMessage({ type: 'success', text: 'Đã đổi mật khẩu.' })
      setNewPassword('')
    }
  }

  if (loading) return <Card className="p-5"><LoadingState /></Card>

  return (
    <Card className="p-5">
      <h3 className="font-display font-semibold text-[var(--color-ink)] mb-4">Hồ sơ của tôi</h3>
      <form onSubmit={handleSaveProfile} className="grid grid-cols-2 gap-4 mb-4">
        <Input label="Họ tên" value={hoTen} onChange={(e) => setHoTen(e.target.value)} />
        <Input label="Số điện thoại" value={soDienThoai} onChange={(e) => setSoDienThoai(e.target.value)} placeholder="Dùng để xác minh khi quên mật khẩu" />
        <div className="col-span-2 flex items-center gap-3">
          <Button type="submit" variant="amber" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu hồ sơ'}</Button>
          {message && (
            <span className={`text-sm ${message.type === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-good)]'}`}>
              {message.text}
            </span>
          )}
        </div>
      </form>

      <div className="border-t border-[var(--color-line)] pt-4">
        <form onSubmit={handleChangePassword} className="flex items-end gap-3">
          <Input
            label="Đổi mật khẩu"
            type="password"
            placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" variant="ghost" disabled={changingPw || !newPassword}>
            {changingPw ? 'Đang đổi...' : 'Đổi mật khẩu'}
          </Button>
          {pwMessage && (
            <span className={`text-sm ${pwMessage.type === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-good)]'}`}>
              {pwMessage.text}
            </span>
          )}
        </form>
      </div>
    </Card>
  )
}

// ============================================================
// QUẢN LÝ TÀI KHOẢN — chỉ admin
// ============================================================
function QuanLyTaiKhoan({ currentUserId }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ email: '', password: '', ho_ten: '', so_dien_thoai: '', vai_tro: 'nhan_vien' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await getTaiKhoanList()
    if (error) setError(error.message)
    else setList(data || [])
    setLoading(false)
  }

  async function toggleRole(tk) {
    if (tk.id === currentUserId) {
      alert('Bạn không thể tự đổi vai trò của chính mình.')
      return
    }
    const newRole = tk.vai_tro === 'admin' ? 'nhan_vien' : 'admin'
    if (!confirm(`Đổi vai trò của "${tk.ho_ten}" thành ${newRole === 'admin' ? 'Admin' : 'Nhân viên'}?`)) return
    const { error } = await updateTaiKhoan(tk.id, { vai_tro: newRole })
    if (error) { alert('Lỗi: ' + error.message); return }
    load()
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      await adminCreateUser(createForm)
      setCreateOpen(false)
      setCreateForm({ email: '', password: '', ho_ten: '', so_dien_thoai: '', vai_tro: 'nhan_vien' })
      load()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-line)]">
        <h3 className="font-display font-semibold text-[var(--color-ink)]">Quản lý tài khoản</h3>
        <Button variant="amber" onClick={() => setCreateOpen(true)} className="!py-1.5 !px-3 text-xs">+ Tạo tài khoản</Button>
      </div>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <div className="p-4"><ErrorState message={error} /></div>
      ) : list.length === 0 ? (
        <EmptyState title="Chưa có tài khoản nào" />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wide border-b border-[var(--color-line)]">
              <th className="px-5 py-3 font-medium">Họ tên</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Số điện thoại</th>
              <th className="px-5 py-3 font-medium">Vai trò</th>
              <th className="px-5 py-3 font-medium text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {list.map((tk) => (
              <tr key={tk.id} className="border-b border-[var(--color-line)] last:border-0">
                <td className="px-5 py-3 font-medium text-[var(--color-ink)]">
                  {tk.ho_ten} {tk.id === currentUserId && <span className="text-xs text-[var(--color-text-muted)]">(bạn)</span>}
                </td>
                <td className="px-5 py-3 text-[var(--color-text-muted)]">{tk.email}</td>
                <td className="px-5 py-3 text-[var(--color-text-muted)]">{tk.so_dien_thoai || '—'}</td>
                <td className="px-5 py-3">
                  <Badge className={tk.vai_tro === 'admin' ? 'bg-[#E8973A]/15 text-[#C97A22]' : 'bg-black/5 text-[var(--color-text-muted)]'}>
                    {tk.vai_tro === 'admin' ? 'Admin' : 'Nhân viên'}
                  </Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => toggleRole(tk)}
                    disabled={tk.id === currentUserId}
                    className="text-xs text-[var(--color-ink)] hover:underline font-medium disabled:opacity-30 disabled:no-underline"
                  >
                    {tk.vai_tro === 'admin' ? 'Hạ xuống Nhân viên' : 'Nâng lên Admin'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo tài khoản mới">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Họ tên *" required value={createForm.ho_ten} onChange={(e) => setCreateForm({ ...createForm, ho_ten: e.target.value })} />
          <Input label="Email *" type="email" required value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
          <Input label="Mật khẩu tạm *" type="text" required minLength={6} placeholder="Tối thiểu 6 ký tự" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
          <Input label="Số điện thoại" value={createForm.so_dien_thoai} onChange={(e) => setCreateForm({ ...createForm, so_dien_thoai: e.target.value })} />
          <Select label="Vai trò" value={createForm.vai_tro} onChange={(e) => setCreateForm({ ...createForm, vai_tro: e.target.value })}>
            <option value="nhan_vien">Nhân viên</option>
            <option value="admin">Admin</option>
          </Select>
          {createError && <ErrorState message={createError} />}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Huỷ</Button>
            <Button type="submit" variant="amber" disabled={creating}>{creating ? 'Đang tạo...' : 'Tạo tài khoản'}</Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}

// ============================================================
// YÊU CẦU QUÊN MẬT KHẨU — chỉ admin
// ============================================================
function YeuCauQuenMatKhau() {
  const [list, setList] = useState([])
  const [taiKhoans, setTaiKhoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showResolved, setShowResolved] = useState(false)

  const [resetTarget, setResetTarget] = useState(null) // { yeuCau, taiKhoanId, newPassword }
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [ycRes, tkRes] = await Promise.all([getYeuCauHoTroList(), getTaiKhoanList()])
    if (ycRes.error) setError(ycRes.error.message)
    else setList(ycRes.data || [])
    setTaiKhoans(tkRes.data || [])
    setLoading(false)
  }

  function findMatchingTaiKhoan(yc) {
    return taiKhoans.find((tk) => tk.email?.toLowerCase() === yc.email?.toLowerCase())
  }

  function openReset(yc) {
    const matched = findMatchingTaiKhoan(yc)
    setResetError(null)
    setResetTarget({ yeuCau: yc, taiKhoanId: matched?.id || '', newPassword: '' })
  }

  async function handleReset(e) {
    e.preventDefault()
    if (!resetTarget.taiKhoanId) {
      setResetError('Chọn tài khoản cần đặt lại mật khẩu.')
      return
    }
    if (resetTarget.newPassword.length < 6) {
      setResetError('Mật khẩu cần tối thiểu 6 ký tự.')
      return
    }
    setResetting(true)
    setResetError(null)
    try {
      await adminResetPassword({
        user_id: resetTarget.taiKhoanId,
        new_password: resetTarget.newPassword,
        yeu_cau_id: resetTarget.yeuCau.id,
      })
      setResetTarget(null)
      load()
    } catch (err) {
      setResetError(err.message)
    } finally {
      setResetting(false)
    }
  }

  async function handleSkip(yc) {
    if (!confirm('Đánh dấu yêu cầu này là đã xử lý mà không đặt lại mật khẩu?')) return
    await markYeuCauDaXuLy(yc.id)
    load()
  }

  const filtered = list.filter((yc) => showResolved || yc.trang_thai === 'cho_xu_ly')
  const soChoXuLy = list.filter((yc) => yc.trang_thai === 'cho_xu_ly').length

  return (
    <Card>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-line)]">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-semibold text-[var(--color-ink)]">Yêu cầu quên mật khẩu</h3>
          {soChoXuLy > 0 && <Badge className="bg-[#C0432E]/10 text-[#C0432E]">{soChoXuLy} chờ xử lý</Badge>}
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          Hiện cả yêu cầu đã xử lý
        </label>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <div className="p-4"><ErrorState message={error} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Không có yêu cầu nào" sub="Yêu cầu quên mật khẩu từ trang đăng nhập sẽ hiện ở đây." />
      ) : (
        <ul className="divide-y divide-[var(--color-line)]">
          {filtered.map((yc) => {
            const matched = findMatchingTaiKhoan(yc)
            const phoneMatches = matched && matched.so_dien_thoai && matched.so_dien_thoai === yc.so_dien_thoai
            return (
              <li key={yc.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm text-[var(--color-ink)]">{yc.email}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      SĐT người gửi: <strong>{yc.so_dien_thoai}</strong>
                      {matched && (
                        matched.so_dien_thoai ? (
                          <span className={`ml-2 ${phoneMatches ? 'text-[var(--color-good)]' : 'text-[var(--color-danger)]'}`}>
                            {phoneMatches ? '✓ Khớp với SĐT lưu trong hệ thống' : `✕ Không khớp (hệ thống lưu: ${matched.so_dien_thoai})`}
                          </span>
                        ) : (
                          <span className="ml-2 text-[var(--color-amber-dark)]">— Tài khoản chưa có SĐT lưu để đối chiếu</span>
                        )
                      )}
                      {!matched && <span className="ml-2 text-[var(--color-danger)]">— Không tìm thấy tài khoản với email này</span>}
                    </div>
                    {yc.ghi_chu && <div className="text-xs text-[var(--color-text-muted)] mt-1">Ghi chú: {yc.ghi_chu}</div>}
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">{formatDateTime(yc.created_at)}</div>
                  </div>
                  <div className="text-right shrink-0 space-y-1.5">
                    <Badge className={yc.trang_thai === 'cho_xu_ly' ? 'bg-[#C0432E]/10 text-[#C0432E]' : 'bg-[#2F7A5E]/10 text-[#2F7A5E]'}>
                      {yc.trang_thai === 'cho_xu_ly' ? 'Chờ xử lý' : 'Đã xử lý'}
                    </Badge>
                    {yc.trang_thai === 'cho_xu_ly' && (
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleSkip(yc)} className="text-xs text-[var(--color-text-muted)] hover:underline">
                          Bỏ qua
                        </button>
                        <button onClick={() => openReset(yc)} className="text-xs text-[var(--color-ink)] hover:underline font-medium">
                          Đặt lại mật khẩu
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title="Đặt lại mật khẩu">
        {resetTarget && (
          <form onSubmit={handleReset} className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)]">
              Yêu cầu từ <strong>{resetTarget.yeuCau.email}</strong> — SĐT: <strong>{resetTarget.yeuCau.so_dien_thoai}</strong>.
              Hãy gọi điện xác nhận đúng người trước khi đặt mật khẩu mới.
            </p>
            <Select
              label="Tài khoản cần đặt lại"
              value={resetTarget.taiKhoanId}
              onChange={(e) => setResetTarget({ ...resetTarget, taiKhoanId: e.target.value })}
            >
              <option value="">— Chọn tài khoản —</option>
              {taiKhoans.map((tk) => (
                <option key={tk.id} value={tk.id}>{tk.ho_ten} ({tk.email})</option>
              ))}
            </Select>
            <Input
              label="Mật khẩu mới *"
              required
              minLength={6}
              placeholder="Tối thiểu 6 ký tự"
              value={resetTarget.newPassword}
              onChange={(e) => setResetTarget({ ...resetTarget, newPassword: e.target.value })}
            />
            {resetError && <ErrorState message={resetError} />}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setResetTarget(null)}>Huỷ</Button>
              <Button type="submit" variant="amber" disabled={resetting}>
                {resetting ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  )
}

// ============================================================
// MÃ HOÁ DỮ LIỆU CŨ — chỉ admin, chạy 1 lần
// ============================================================
function MaHoaDuLieuCu() {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(null)
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)

  async function handleRun() {
    if (!confirm('Quét và mã hoá toàn bộ dữ liệu chưa mã hoá (SĐT/địa chỉ/MST khách hàng, SĐT/email nhân viên, giá trị hợp đồng, số tiền thanh toán)? Có thể chạy lại nhiều lần an toàn.')) return
    setRunning(true)
    setError(null)
    setReport(null)
    try {
      const result = await encryptExistingData((done, total) => setProgress({ done, total }))
      setReport(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  return (
    <Card className="p-5">
      <h3 className="font-display font-semibold text-[var(--color-ink)] mb-1">Mã hoá dữ liệu cũ</h3>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        Từ nay dữ liệu mới (SĐT/địa chỉ/MST khách hàng, SĐT/email nhân viên, giá trị hợp đồng,
        số tiền thanh toán) tự động được mã hoá khi lưu. Nếu bạn có dữ liệu tạo ra trước khi
        bật tính năng này, bấm nút dưới để quét và mã hoá nốt — chỉ cần chạy 1 lần,
        chạy lại nhiều lần cũng an toàn (dữ liệu đã mã hoá sẽ tự bỏ qua).
      </p>
      <div className="flex items-center gap-3">
        <Button variant="amber" onClick={handleRun} disabled={running}>
          {running ? `Đang xử lý... ${progress ? `${progress.done}/${progress.total}` : ''}` : '🔒 Quét & mã hoá dữ liệu cũ'}
        </Button>
        {error && <ErrorState message={error} />}
      </div>
      {report && (
        <div className="mt-3 text-sm text-[var(--color-good)]">
          Xong: đã mã hoá {report.khach_hang} khách hàng, {report.nhan_vien} nhân viên,{' '}
          {report.hop_dong_dau_ra} hợp đồng, {report.thanh_toan} khoản thanh toán.
        </div>
      )}
    </Card>
  )
}

// ============================================================
// LỊCH SAO LƯU LÊN GOOGLE DRIVE — chỉ admin
// ============================================================
function LichBackup() {
  const [days, setDays] = useState(7)
  const [lastRun, setLastRun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    (async () => {
      const { data } = await getCaiDatHeThong()
      if (data) {
        setDays(data.backup_interval_days)
        setLastRun(data.backup_last_run_at)
      }
      setLoading(false)
    })()
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    const { error } = await updateCaiDatHeThong({ backup_interval_days: Number(days) })
    setSaving(false)
    setMessage(error ? { type: 'error', text: error.message } : { type: 'success', text: 'Đã lưu.' })
  }

  if (loading) return <Card className="p-5"><LoadingState /></Card>

  return (
    <Card className="p-5">
      <h3 className="font-display font-semibold text-[var(--color-ink)] mb-1">Lịch sao lưu lên Google Drive</h3>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        Hệ thống tự động sao lưu toàn bộ database và tải lên Google Drive theo chu kỳ dưới đây
        (chạy nền qua GitHub Actions, kiểm tra mỗi ngày, chỉ thực sự backup khi đã đủ số ngày).
        Cần thiết lập Google Drive 1 lần trước — xem README mục "Backup lên Google Drive".
      </p>
      <form onSubmit={handleSave} className="flex items-end gap-3 mb-3">
        <Input
          label="Số ngày giữa các lần backup"
          type="number"
          min={1}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="max-w-[160px]"
        />
        <Button type="submit" variant="amber" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</Button>
        {message && (
          <span className={`text-sm ${message.type === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-good)]'}`}>
            {message.text}
          </span>
        )}
      </form>
      <p className="text-xs text-[var(--color-text-muted)]">
        Lần backup gần nhất: {lastRun ? formatDateTime(lastRun) : 'Chưa có lần nào'}
      </p>
    </Card>
  )
}

// ============================================================
// SAO LƯU DỮ LIỆU THỦ CÔNG — chỉ admin
// ============================================================
function SaoLuuDuLieu() {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  async function handleExport() {
    setExporting(true)
    setError(null)
    try {
      const data = await exportAllDataForBackup()
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ngay = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `qlhd-backup-${ngay}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card className="p-5">
      <h3 className="font-display font-semibold text-[var(--color-ink)] mb-1">Sao lưu dữ liệu</h3>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        Tải toàn bộ dữ liệu hiện tại (khách hàng, hợp đồng, phụ lục, thanh toán, nhân viên, tài khoản)
        về máy dưới dạng file JSON. Dùng khi cần sao lưu nhanh trước một thao tác rủi ro
        (ví dụ trước khi xoá hàng loạt). Đây là bản chụp thủ công tại thời điểm bấm nút —
        không thay thế cho sao lưu tự động hàng tuần (xem README).
      </p>
      <div className="flex items-center gap-3">
        <Button variant="amber" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Đang xuất...' : '⬇ Tải file backup (.json)'}
        </Button>
        {error && <ErrorState message={error} />}
      </div>
    </Card>
  )
}

// ============================================================
// KHÔI PHỤC TỪ FILE BACKUP — chỉ admin
// ============================================================
function KhoiPhucBackup() {
  const fileInputRef = useRef(null)
  const [pendingData, setPendingData] = useState(null)
  const [pendingFileName, setPendingFileName] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)

  function openFilePicker() {
    setError(null)
    setReport(null)
    fileInputRef.current?.click()
  }

  function handleFileSelected(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (!data.khach_hang && !data.hop_dong_dau_ra) {
          throw new Error('File này không đúng định dạng backup của QLHD.')
        }
        setPendingData(data)
        setPendingFileName(file.name)
        setConfirmOpen(true)
      } catch (err) {
        setError('Không đọc được file: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  async function handleConfirmRestore() {
    setRestoring(true)
    setError(null)
    try {
      const result = await restoreFromBackupJson(pendingData)
      setReport(result)
      setConfirmOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setRestoring(false)
    }
  }

  const counts = pendingData && {
    khach_hang: pendingData.khach_hang?.length || 0,
    nhan_vien: pendingData.nhan_vien?.length || 0,
    hop_dong_dau_ra: pendingData.hop_dong_dau_ra?.length || 0,
    phu_luc_hop_dong: pendingData.phu_luc_hop_dong?.length || 0,
    thanh_toan: pendingData.thanh_toan?.length || 0,
  }

  return (
    <Card className="p-5">
      <h3 className="font-display font-semibold text-[var(--color-ink)] mb-1">Khôi phục từ file backup</h3>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        Tải lên file <code>.json</code> đã xuất từ mục "Sao lưu dữ liệu" ở trên để khôi phục.
        Đây là <strong>gộp/ghi đè theo ID</strong> (upsert) — dữ liệu trùng ID trong file sẽ ghi đè
        dữ liệu hiện tại; dữ liệu được tạo sau thời điểm backup mà không có trong file sẽ{' '}
        <strong>không</strong> bị xoá. Không khôi phục tài khoản đăng nhập — tạo lại qua mục
        "Quản lý tài khoản" nếu cần.
      </p>
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelected} />
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={openFilePicker}>📤 Chọn file backup (.json)</Button>
        {error && <ErrorState message={error} />}
      </div>

      {report && (
        <div className="mt-3 text-sm">
          <div className="text-[var(--color-good)]">
            Đã khôi phục: {report.khach_hang} khách hàng, {report.nhan_vien} nhân viên,{' '}
            {report.hop_dong_dau_ra} hợp đồng, {report.phu_luc_hop_dong} phụ lục,{' '}
            {report.thanh_toan} khoản thanh toán.
          </div>
          {report.loi.length > 0 && (
            <div className="text-[var(--color-danger)] mt-1">
              Có lỗi: {report.loi.join(' · ')}
            </div>
          )}
        </div>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Xác nhận khôi phục dữ liệu">
        {counts && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text)]">
              File: <strong>{pendingFileName}</strong>
              {pendingData.xuat_luc && (
                <> — xuất lúc {new Date(pendingData.xuat_luc).toLocaleString('vi-VN')}</>
              )}
            </p>
            <ul className="text-sm text-[var(--color-text-muted)] space-y-1">
              <li>{counts.khach_hang} khách hàng</li>
              <li>{counts.nhan_vien} nhân viên</li>
              <li>{counts.hop_dong_dau_ra} hợp đồng</li>
              <li>{counts.phu_luc_hop_dong} phụ lục</li>
              <li>{counts.thanh_toan} khoản thanh toán</li>
            </ul>
            <div className="rounded-lg bg-[var(--color-amber)]/10 border border-[var(--color-amber)]/30 text-sm px-3 py-2">
              Dữ liệu trùng ID sẽ bị <strong>ghi đè</strong> bằng nội dung trong file này. Hành động
              không thể hoàn tác trực tiếp — nên tải 1 bản backup dữ liệu hiện tại trước nếu chưa chắc chắn.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Huỷ</Button>
              <Button variant="danger" onClick={handleConfirmRestore} disabled={restoring}>
                {restoring ? 'Đang khôi phục...' : 'Xác nhận khôi phục'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}
