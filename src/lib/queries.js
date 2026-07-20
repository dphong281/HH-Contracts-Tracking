import { supabase } from './supabase'
import { encryptField, encryptFields, decryptField, decryptFields, decryptList } from './encryption'

// Danh sách field bị mã hoá theo từng bảng — dùng để mã hoá lúc ghi, giải mã lúc đọc.
const KHACH_HANG_ENCRYPTED = ['dia_chi', 'so_dien_thoai', 'ma_so_thue']
const NHAN_VIEN_ENCRYPTED = ['so_dien_thoai', 'email']

// ---------- KHOÁ ĐỒNG THỜI (optimistic lock) ----------
// Ném ra khi phát hiện có người khác đã sửa bản ghi này trước bạn (dựa theo
// cột updated_at — tự động cập nhật qua trigger DB mỗi lần UPDATE thành công).
export class ConflictError extends Error {
  constructor() {
    super('Dữ liệu này đã bị người khác thay đổi kể từ khi bạn mở form. Vui lòng tải lại trang rồi thử lại.')
    this.name = 'ConflictError'
  }
}

// updateWithLock: nếu truyền expectedUpdatedAt, chỉ update thành công khi
// updated_at hiện tại trên DB VẪN khớp giá trị lúc bạn tải form lên — nếu
// khác (ai đó đã sửa trước), trả về ConflictError thay vì ghi đè âm thầm.
async function updateWithLock(table, id, expectedUpdatedAt, payload) {
  let query = supabase.from(table).update(payload).eq('id', id)
  if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt)
  const res = await query.select().maybeSingle()
  if (res.error) return res
  if (!res.data && expectedUpdatedAt) return { data: null, error: new ConflictError() }
  return res
}

// ---------- KHÁCH HÀNG ----------
export async function getKhachHangList() {
  const res = await supabase.from('khach_hang').select('*').order('created_at', { ascending: false })
  if (res.error) return res
  return { ...res, data: await decryptList(res.data, KHACH_HANG_ENCRYPTED) }
}
export async function getKhachHangById(id) {
  const res = await supabase.from('khach_hang').select('*').eq('id', id).single()
  if (res.error) return res
  return { ...res, data: await decryptFields(res.data, KHACH_HANG_ENCRYPTED) }
}
export async function createKhachHang(payload) {
  const encrypted = await encryptFields(payload, KHACH_HANG_ENCRYPTED)
  return supabase.from('khach_hang').insert(encrypted).select().single()
}
export async function updateKhachHang(id, payload, expectedUpdatedAt) {
  const encrypted = await encryptFields(payload, KHACH_HANG_ENCRYPTED)
  return updateWithLock('khach_hang', id, expectedUpdatedAt, encrypted)
}
export async function deleteKhachHang(id) {
  return supabase.from('khach_hang').delete().eq('id', id)
}

// ---------- TÀI LIỆU KHÁCH HÀNG (giấy tờ đính kèm: CCCD, ĐKKD, giấy phép KD xăng dầu...) ----------
// File thật lưu trong Storage bucket 'tai-lieu-kh' (private), bảng này chỉ lưu đường dẫn.
const TAI_LIEU_KH_BUCKET = 'tai-lieu-kh'

export async function getTaiLieuByKhachHang(khachHangId) {
  return supabase
    .from('tai_lieu_khach_hang')
    .select('*')
    .eq('khach_hang_id', khachHangId)
    .order('created_at', { ascending: false })
}

// Upload file lên Storage rồi ghi 1 dòng vào bảng tai_lieu_khach_hang.
// loaiGiayTo: 'cccd' | 'dkkd' | 'giay_phep_xang_dau' | 'khac' | null (nhập tay không rõ loại)
export async function uploadTaiLieuKhachHang(khachHangId, file, loaiGiayTo) {
  const ext = file.name.split('.').pop()
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  const path = `${khachHangId}/${Date.now()}-${rand}.${ext}`

  const { error: upErr } = await supabase.storage.from(TAI_LIEU_KH_BUCKET).upload(path, file)
  if (upErr) return { data: null, error: upErr }

  const res = await supabase
    .from('tai_lieu_khach_hang')
    .insert({ khach_hang_id: khachHangId, ten_file: file.name, loai_giay_to: loaiGiayTo || null, storage_path: path })
    .select()
    .single()

  if (res.error) {
    // Rollback file đã upload nếu ghi DB thất bại, tránh rác trong bucket.
    await supabase.storage.from(TAI_LIEU_KH_BUCKET).remove([path])
  }
  return res
}

// Link tạm (1 giờ) để xem/tải file — bucket private nên không có URL public trực tiếp.
export async function getTaiLieuSignedUrl(storagePath) {
  return supabase.storage.from(TAI_LIEU_KH_BUCKET).createSignedUrl(storagePath, 3600)
}

export async function deleteTaiLieuKhachHang(id, storagePath) {
  await supabase.storage.from(TAI_LIEU_KH_BUCKET).remove([storagePath])
  return supabase.from('tai_lieu_khach_hang').delete().eq('id', id)
}

// ---------- NHÂN VIÊN ----------
export async function getNhanVienList() {
  const res = await supabase.from('nhan_vien').select('*').order('created_at', { ascending: false })
  if (res.error) return res
  return { ...res, data: await decryptList(res.data, NHAN_VIEN_ENCRYPTED) }
}
export async function createNhanVien(payload) {
  const encrypted = await encryptFields(payload, NHAN_VIEN_ENCRYPTED)
  return supabase.from('nhan_vien').insert(encrypted).select().single()
}
export async function updateNhanVien(id, payload) {
  const encrypted = await encryptFields(payload, NHAN_VIEN_ENCRYPTED)
  return supabase.from('nhan_vien').update(encrypted).eq('id', id).select().single()
}
export async function deleteNhanVien(id) {
  return supabase.from('nhan_vien').delete().eq('id', id)
}

// ---------- HỢP ĐỒNG ----------
// gia_tri_hop_dong được mã hoá -> cột lưu dạng text, đọc ra phải ép lại về Number
async function decryptHopDong(row) {
  if (!row) return row
  const decrypted = await decryptField(row.gia_tri_hop_dong)
  return { ...row, gia_tri_hop_dong: Number(decrypted) || 0 }
}

export async function getHopDongList() {
  const res = await supabase
    .from('hop_dong_dau_ra')
    .select('*, khach_hang(id, ten_khach_hang, phan_loai), nhan_vien(id, ho_ten)')
    .order('created_at', { ascending: false })
  if (res.error) return res
  return { ...res, data: await Promise.all(res.data.map(decryptHopDong)) }
}
export async function getHopDongById(id) {
  const res = await supabase
    .from('hop_dong_dau_ra')
    .select('*, khach_hang(id, ten_khach_hang, phan_loai), nhan_vien(id, ho_ten)')
    .eq('id', id)
    .single()
  if (res.error) return res
  return { ...res, data: await decryptHopDong(res.data) }
}
export async function createHopDong(payload) {
  const encrypted = { ...payload, gia_tri_hop_dong: await encryptField(payload.gia_tri_hop_dong) }
  const res = await supabase.from('hop_dong_dau_ra').insert(encrypted).select().single()
  if (res.error) return res
  return { ...res, data: await decryptHopDong(res.data) }
}
export async function updateHopDong(id, payload, expectedUpdatedAt) {
  const encrypted = { ...payload }
  if ('gia_tri_hop_dong' in encrypted) {
    encrypted.gia_tri_hop_dong = await encryptField(encrypted.gia_tri_hop_dong)
  }
  const res = await updateWithLock('hop_dong_dau_ra', id, expectedUpdatedAt, encrypted)
  if (res.error) return res
  return { ...res, data: await decryptHopDong(res.data) }
}
export async function getHopDongByKhachHang(khachHangId) {
  const res = await supabase
    .from('hop_dong_dau_ra')
    .select('*, nhan_vien(id, ho_ten)')
    .eq('khach_hang_id', khachHangId)
    .order('created_at', { ascending: false })
  if (res.error) return res
  return { ...res, data: await Promise.all(res.data.map(decryptHopDong)) }
}
export async function deleteHopDong(id) {
  return supabase.from('hop_dong_dau_ra').delete().eq('id', id)
}

// ---------- CÔNG NỢ ----------
// Trước đây đọc từ view SQL v_hop_dong_cong_no (tính SUM trực tiếp trong Postgres).
// Giờ gia_tri_hop_dong/so_tien đã mã hoá nên SQL không cộng trực tiếp được nữa —
// tính công nợ ở đây, trên dữ liệu đã giải mã.
export async function getCongNoList() {
  const [hdRes, ttRes] = await Promise.all([
    supabase.from('hop_dong_dau_ra').select('*, khach_hang(ten_khach_hang, phan_loai), nhan_vien(ho_ten)'),
    supabase.from('thanh_toan').select('hop_dong_id, so_tien'),
  ])
  if (hdRes.error) return { data: null, error: hdRes.error }
  if (ttRes.error) return { data: null, error: ttRes.error }

  const hopDongs = await Promise.all(hdRes.data.map(decryptHopDong))
  const thanhToans = await Promise.all(
    ttRes.data.map(async (tt) => ({ ...tt, so_tien: Number(await decryptField(tt.so_tien)) || 0 }))
  )

  const data = hopDongs.map((hd) => {
    const tienDaThanhToan = thanhToans
      .filter((tt) => tt.hop_dong_id === hd.id)
      .reduce((sum, tt) => sum + tt.so_tien, 0)
    return {
      id: hd.id,
      so_hop_dong: hd.so_hop_dong,
      ten_khach_hang: hd.khach_hang?.ten_khach_hang,
      phan_loai: hd.khach_hang?.phan_loai,
      nhan_vien_phu_trach: hd.nhan_vien?.ho_ten,
      ngay_bat_dau: hd.ngay_bat_dau,
      ngay_ket_thuc: hd.ngay_ket_thuc,
      gia_tri_hop_dong: hd.gia_tri_hop_dong,
      trang_thai: hd.trang_thai,
      tien_da_thanh_toan: tienDaThanhToan,
      cong_no_con_lai: hd.gia_tri_hop_dong - tienDaThanhToan,
    }
  })

  data.sort((a, b) => b.cong_no_con_lai - a.cong_no_con_lai)
  return { data, error: null }
}

// ---------- CÀI ĐẶT HỆ THỐNG (lịch backup) ----------
export async function getCaiDatHeThong() {
  return supabase.from('cai_dat_he_thong').select('*').eq('id', true).single()
}
export async function updateCaiDatHeThong(payload) {
  return supabase.from('cai_dat_he_thong').update(payload).eq('id', true).select().single()
}

// ---------- SAO LƯU THỦ CÔNG ----------
// Xuất toàn bộ dữ liệu ra file JSON để tải về máy. Giữ nguyên dạng đã mã hoá
// (không giải mã) — nhất quán với backup pg_dump tự động, an toàn hơn nếu file bị lộ.
export async function exportAllDataForBackup() {
  const [khachHang, nhanVien, hopDong, phuLuc, thanhToan, taiKhoan] = await Promise.all([
    supabase.from('khach_hang').select('*'),
    supabase.from('nhan_vien').select('*'),
    supabase.from('hop_dong_dau_ra').select('*'),
    supabase.from('phu_luc_hop_dong').select('*'),
    supabase.from('thanh_toan').select('*'),
    supabase.from('tai_khoan').select('id, ho_ten, email, vai_tro, so_dien_thoai, created_at'),
  ])

  const firstError = [khachHang, nhanVien, hopDong, phuLuc, thanhToan, taiKhoan].find((r) => r.error)
  if (firstError) throw new Error(firstError.error.message)

  return {
    xuat_luc: new Date().toISOString(),
    ghi_chu: 'Các trường nhạy cảm (SĐT, địa chỉ, MST, giá trị HĐ, số tiền) đang ở dạng đã mã hoá.',
    khach_hang: khachHang.data,
    nhan_vien: nhanVien.data,
    hop_dong_dau_ra: hopDong.data,
    phu_luc_hop_dong: phuLuc.data,
    thanh_toan: thanhToan.data,
    tai_khoan: taiKhoan.data,
  }
}

// ---------- KHÔI PHỤC TỪ FILE BACKUP (.json) ----------
// Ghi đè/gộp theo id (upsert) — dữ liệu trùng id sẽ bị thay bằng nội dung trong file backup.
// Dữ liệu được tạo SAU thời điểm backup mà không có trong file sẽ KHÔNG bị xoá.
// Thứ tự khôi phục quan trọng (khách hàng/nhân viên trước, rồi mới tới hợp đồng,
// rồi mới tới phụ lục/thanh toán) vì có ràng buộc khoá ngoại giữa các bảng.
// Không khôi phục tai_khoan — tài khoản đăng nhập phải tạo lại qua Cài đặt → Quản lý tài khoản.
export async function restoreFromBackupJson(data) {
  const report = { khach_hang: 0, nhan_vien: 0, hop_dong_dau_ra: 0, phu_luc_hop_dong: 0, thanh_toan: 0, loi: [] }

  async function upsertTable(table, rows) {
    if (!rows || rows.length === 0) return 0
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' })
    if (error) {
      report.loi.push(`${table}: ${error.message}`)
      return 0
    }
    return rows.length
  }

  report.khach_hang = await upsertTable('khach_hang', data.khach_hang)
  report.nhan_vien = await upsertTable('nhan_vien', data.nhan_vien)
  report.hop_dong_dau_ra = await upsertTable('hop_dong_dau_ra', data.hop_dong_dau_ra)
  report.phu_luc_hop_dong = await upsertTable('phu_luc_hop_dong', data.phu_luc_hop_dong)
  report.thanh_toan = await upsertTable('thanh_toan', data.thanh_toan)

  return report
}

// ---------- NHẬT KÝ HOẠT ĐỘNG ----------
export async function getNhatKyList(limit = 200) {
  return supabase
    .from('nhat_ky_hoat_dong')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
}

// ---------- TÀI KHOẢN ----------
// Lưu ý: so_dien_thoai của tài khoản KHÔNG mã hoá (theo yêu cầu) — vì cần dùng
// để admin đối chiếu bằng mắt khi xử lý yêu cầu quên mật khẩu.
export async function getTaiKhoanList() {
  return supabase.from('tai_khoan').select('*').order('ho_ten', { ascending: true })
}
export async function updateTaiKhoan(id, payload) {
  return supabase.from('tai_khoan').update(payload).eq('id', id).select().single()
}

// ---------- YÊU CẦU HỖ TRỢ (quên mật khẩu) ----------
export async function createYeuCauQuenMatKhau({ email, so_dien_thoai, ghi_chu }) {
  // Cố tình KHÔNG .select() sau insert — người gửi yêu cầu (chưa đăng nhập)
  // không có quyền đọc lại bảng này (chỉ Admin đọc được), nên nếu cố đọc lại
  // Postgres sẽ báo gộp thành lỗi RLS dù bản ghi đã ghi thành công.
  return supabase
    .from('yeu_cau_ho_tro')
    .insert({ loai: 'quen_mat_khau', email, so_dien_thoai, ghi_chu: ghi_chu || null })
}
export async function getYeuCauHoTroList() {
  return supabase.from('yeu_cau_ho_tro').select('*').order('created_at', { ascending: false })
}
export async function markYeuCauDaXuLy(id) {
  return supabase
    .from('yeu_cau_ho_tro')
    .update({ trang_thai: 'da_xu_ly', xu_ly_luc: new Date().toISOString() })
    .eq('id', id)
}

// ---------- PHỤ LỤC ----------
export async function getPhuLucByHopDong(hopDongId) {
  return supabase
    .from('phu_luc_hop_dong')
    .select('*')
    .eq('hop_dong_id', hopDongId)
    .order('created_at', { ascending: false })
}
export async function createPhuLuc(payload) {
  return supabase.from('phu_luc_hop_dong').insert(payload).select().single()
}
export async function deletePhuLuc(id) {
  return supabase.from('phu_luc_hop_dong').delete().eq('id', id)
}

// ---------- PHỤ LỤC — GOM THEO KHÁCH HÀNG (dùng ở trang chi tiết khách hàng) ----------
// Phụ lục vẫn gắn với 1 hợp đồng cụ thể (bảng phu_luc_hop_dong không đổi cấu trúc) —
// hàm này chỉ gom tất cả phụ lục của TẤT CẢ hợp đồng thuộc 1 khách hàng, kèm theo
// số hợp đồng để hiển thị cho biết phụ lục đó thuộc hợp đồng nào.
export async function getPhuLucByKhachHang(khachHangId) {
  const { data: hopDongs, error: hdErr } = await supabase
    .from('hop_dong_dau_ra')
    .select('id, so_hop_dong')
    .eq('khach_hang_id', khachHangId)
  if (hdErr) return { data: null, error: hdErr }
  if (!hopDongs || hopDongs.length === 0) return { data: [], error: null }

  const ids = hopDongs.map((h) => h.id)
  const { data: phuLucs, error: plErr } = await supabase
    .from('phu_luc_hop_dong')
    .select('*')
    .in('hop_dong_id', ids)
    .order('ngay_bat_dau', { ascending: false })
  if (plErr) return { data: null, error: plErr }

  const hopDongMap = new Map(hopDongs.map((h) => [h.id, h.so_hop_dong]))
  const data = phuLucs.map((pl) => ({ ...pl, so_hop_dong: hopDongMap.get(pl.hop_dong_id) }))
  return { data, error: null }
}

// ---------- THANH TOÁN ----------
// so_tien được mã hoá -> cột lưu dạng text, đọc ra phải ép lại về Number
export async function getThanhToanByHopDong(hopDongId) {
  const res = await supabase
    .from('thanh_toan')
    .select('*')
    .eq('hop_dong_id', hopDongId)
    .order('ngay_thanh_toan', { ascending: false })
  if (res.error) return res
  const data = await Promise.all(
    res.data.map(async (tt) => ({ ...tt, so_tien: Number(await decryptField(tt.so_tien)) || 0 }))
  )
  return { ...res, data }
}
export async function createThanhToan(payload) {
  const encrypted = { ...payload, so_tien: await encryptField(payload.so_tien) }
  const res = await supabase.from('thanh_toan').insert(encrypted).select().single()
  if (res.error) return res
  return { ...res, data: { ...res.data, so_tien: Number(await decryptField(res.data.so_tien)) || 0 } }
}
export async function deleteThanhToan(id) {
  return supabase.from('thanh_toan').delete().eq('id', id)
}

// ---------- MÃ HOÁ DỮ LIỆU CŨ (chạy 1 lần) ----------
// Quét toàn bộ dữ liệu hiện có, mã hoá những giá trị chưa được mã hoá
// (dữ liệu tạo ra trước khi bật tính năng mã hoá). An toàn để chạy nhiều lần —
// giá trị đã mã hoá rồi sẽ được encryptField bỏ qua không mã hoá lại (nhờ decryptField
// nhận diện qua tiền tố "enc:", nhưng ở đây ta mã hoá lại toàn bộ nên cần check thủ công).
export async function encryptExistingData(onProgress) {
  let done = 0
  let total = 0
  const report = { khach_hang: 0, nhan_vien: 0, hop_dong_dau_ra: 0, thanh_toan: 0 }

  const isEncrypted = (v) => typeof v === 'string' && v.startsWith('enc:')

  const [khRes, nvRes, hdRes, ttRes] = await Promise.all([
    supabase.from('khach_hang').select('*'),
    supabase.from('nhan_vien').select('*'),
    supabase.from('hop_dong_dau_ra').select('*'),
    supabase.from('thanh_toan').select('*'),
  ])
  const firstError = [khRes, nvRes, hdRes, ttRes].find((r) => r.error)
  if (firstError) throw new Error(firstError.error.message)

  total =
    khRes.data.length * KHACH_HANG_ENCRYPTED.length / 3 +
    nvRes.data.length +
    hdRes.data.length +
    ttRes.data.length
  const tick = () => { done += 1; onProgress?.(done, total) }

  for (const kh of khRes.data) {
    const needsEncrypt = KHACH_HANG_ENCRYPTED.some((f) => kh[f] && !isEncrypted(kh[f]))
    if (!needsEncrypt) { tick(); continue }
    const payload = {}
    for (const f of KHACH_HANG_ENCRYPTED) {
      payload[f] = isEncrypted(kh[f]) ? kh[f] : await encryptField(kh[f])
    }
    await supabase.from('khach_hang').update(payload).eq('id', kh.id)
    report.khach_hang += 1
    tick()
  }

  for (const nv of nvRes.data) {
    const needsEncrypt = NHAN_VIEN_ENCRYPTED.some((f) => nv[f] && !isEncrypted(nv[f]))
    if (!needsEncrypt) { tick(); continue }
    const payload = {}
    for (const f of NHAN_VIEN_ENCRYPTED) {
      payload[f] = isEncrypted(nv[f]) ? nv[f] : await encryptField(nv[f])
    }
    await supabase.from('nhan_vien').update(payload).eq('id', nv.id)
    report.nhan_vien += 1
    tick()
  }

  for (const hd of hdRes.data) {
    if (isEncrypted(hd.gia_tri_hop_dong)) { tick(); continue }
    const payload = { gia_tri_hop_dong: await encryptField(hd.gia_tri_hop_dong) }
    await supabase.from('hop_dong_dau_ra').update(payload).eq('id', hd.id)
    report.hop_dong_dau_ra += 1
    tick()
  }

  for (const tt of ttRes.data) {
    if (isEncrypted(tt.so_tien)) { tick(); continue }
    const payload = { so_tien: await encryptField(tt.so_tien) }
    await supabase.from('thanh_toan').update(payload).eq('id', tt.id)
    report.thanh_toan += 1
    tick()
  }

  return report
}