// Mô hình tính "điểm rủi ro công nợ" cho từng hợp đồng — HOÀN TOÀN dựa trên
// thống kê/quy tắc từ dữ liệu thực tế (công nợ, hạn mức, thời hạn, lịch sử khách
// hàng), KHÔNG gọi AI/LLM. Đây không phải mô hình ML được huấn luyện — là công
// thức tính điểm có trọng số, minh bạch, dễ giải thích và dễ chỉnh sửa trọng số
// khi thấy dự đoán chưa sát thực tế.
//
// 4 yếu tố đầu vào (mỗi yếu tố chuẩn hoá về khoảng 0–1 trước khi nhân trọng số):
//
// 1. Áp lực công nợ hiện tại (40%) — công nợ còn lại so với hạn mức (hoặc so với
//    giá trị hợp đồng nếu chưa đặt hạn mức). Nợ càng gần/vượt hạn mức thì điểm
//    càng cao.
// 2. Đã vượt hạn mức công nợ (15%) — cộng thêm nếu công nợ hiện tại > hạn mức.
// 3. Áp lực thời hạn (25%) — hợp đồng càng gần ngày hết hạn mà vẫn còn nợ thì
//    điểm càng cao; đã quá hạn mà còn nợ thì tối đa.
// 4. Lịch sử khách hàng (20%) — trong số các hợp đồng ĐÃ HẾT HẠN trước đây của
//    cùng khách hàng này, bao nhiêu % vẫn còn nợ tồn đọng (chưa trả hết dù đã
//    hết hạn) — khách hàng có tiền sử hay để nợ tồn thì rủi ro cao hơn.

const TRONG_SO = {
  ap_luc_cong_no: 0.4,
  vuot_han_muc: 0.15,
  ap_luc_thoi_han: 0.25,
  lich_su_khach_hang: 0.2,
}

function clamp01(x) {
  if (Number.isNaN(x) || x === null || x === undefined) return 0
  return Math.max(0, Math.min(1, x))
}

function daysBetween(a, b) {
  return Math.round((new Date(a) - new Date(b)) / (1000 * 60 * 60 * 24))
}

// Tính tổng đã thanh toán của 1 hợp đồng từ danh sách thanh_toan đầy đủ.
function tongDaThanhToan(hopDongId, thanhToans) {
  return thanhToans
    .filter((tt) => tt.hop_dong_id === hopDongId)
    .reduce((sum, tt) => sum + tt.so_tien, 0)
}

// Tỷ lệ % hợp đồng đã hết hạn của 1 khách hàng mà vẫn còn nợ tồn đọng tại thời
// điểm hiện tại — dùng làm "điểm lịch sử" cho khách hàng đó.
function tinhLichSuKhachHang(khachHangId, tatCaHopDong, thanhToans, homNay) {
  const hopDongDaHetHan = tatCaHopDong.filter(
    (hd) => hd.khach_hang_id === khachHangId && hd.ngay_ket_thuc && new Date(hd.ngay_ket_thuc) < homNay
  )
  if (hopDongDaHetHan.length === 0) return null // chưa có lịch sử — không đủ dữ liệu để đánh giá

  const soHopDongConNo = hopDongDaHetHan.filter((hd) => {
    const daTra = tongDaThanhToan(hd.id, thanhToans)
    return Number(hd.gia_tri_hop_dong) - daTra > 0
  }).length

  return soHopDongConNo / hopDongDaHetHan.length
}

// Tính điểm rủi ro (0–100) + phân loại mức độ + chi tiết từng yếu tố cho 1 hợp đồng.
// Trả về null nếu hợp đồng không cần đánh giá (đã hết hiệu lực, hoặc đã hết nợ).
export function tinhDiemRuiRo(hopDong, tatCaHopDong, thanhToans, homNay = new Date()) {
  if (hopDong.trang_thai !== 'dang_hieu_luc') return null

  const daThanhToan = tongDaThanhToan(hopDong.id, thanhToans)
  const congNoConLai = Number(hopDong.gia_tri_hop_dong) - daThanhToan
  if (congNoConLai <= 0) return null // đã trả hết — không có rủi ro để dự đoán

  const hanMuc = hopDong.han_muc_cong_no || hopDong.gia_tri_hop_dong || 1

  // 1. Áp lực công nợ hiện tại
  const apLucCongNo = clamp01(congNoConLai / hanMuc)

  // 2. Đã vượt hạn mức
  const vuotHanMuc = hopDong.han_muc_cong_no && congNoConLai > hopDong.han_muc_cong_no ? 1 : 0

  // 3. Áp lực thời hạn — còn <= 30 ngày thì bắt đầu tính điểm, quá hạn thì tối đa
  let apLucThoiHan = 0
  if (hopDong.ngay_ket_thuc) {
    const soNgayConLai = daysBetween(hopDong.ngay_ket_thuc, homNay)
    if (soNgayConLai < 0) apLucThoiHan = 1
    else apLucThoiHan = clamp01(1 - soNgayConLai / 30)
  }

  // 4. Lịch sử khách hàng — null nếu chưa có hợp đồng nào hết hạn trước đó (không đủ dữ liệu)
  const lichSu = hopDong.khach_hang_id
    ? tinhLichSuKhachHang(hopDong.khach_hang_id, tatCaHopDong, thanhToans, homNay)
    : null

  // Nếu chưa có lịch sử, phân bổ lại trọng số của yếu tố này cho 3 yếu tố còn lại
  // theo tỷ lệ tương ứng, thay vì tính là 0 (tránh đánh giá thấp sai lệch khách mới).
  let diem
  if (lichSu === null) {
    const tongTrongSoConLai = TRONG_SO.ap_luc_cong_no + TRONG_SO.vuot_han_muc + TRONG_SO.ap_luc_thoi_han
    diem =
      (apLucCongNo * TRONG_SO.ap_luc_cong_no +
        vuotHanMuc * TRONG_SO.vuot_han_muc +
        apLucThoiHan * TRONG_SO.ap_luc_thoi_han) /
      tongTrongSoConLai
  } else {
    diem =
      apLucCongNo * TRONG_SO.ap_luc_cong_no +
      vuotHanMuc * TRONG_SO.vuot_han_muc +
      apLucThoiHan * TRONG_SO.ap_luc_thoi_han +
      lichSu * TRONG_SO.lich_su_khach_hang
  }

  const score = Math.round(diem * 100)
  const level = score >= 70 ? 'cao' : score >= 40 ? 'trung_binh' : 'thap'

  return {
    hop_dong_id: hopDong.id,
    score,
    level,
    cong_no_con_lai: congNoConLai,
    yeu_to: {
      ap_luc_cong_no: Math.round(apLucCongNo * 100),
      vuot_han_muc: vuotHanMuc === 1,
      ap_luc_thoi_han: Math.round(apLucThoiHan * 100),
      lich_su_khach_hang: lichSu === null ? null : Math.round(lichSu * 100),
    },
  }
}

// Tính điểm rủi ro cho toàn bộ danh sách hợp đồng, trả về mảng đã sắp xếp theo
// điểm giảm dần (rủi ro cao nhất lên đầu), bỏ qua hợp đồng không cần đánh giá.
export function tinhDiemRuiRoTatCa(tatCaHopDong, thanhToans, homNay = new Date()) {
  return tatCaHopDong
    .map((hd) => {
      const ketQua = tinhDiemRuiRo(hd, tatCaHopDong, thanhToans, homNay)
      return ketQua ? { ...ketQua, hop_dong: hd } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
}

export const LEVEL_LABELS = {
  cao: 'Rủi ro cao',
  trung_binh: 'Rủi ro trung bình',
  thap: 'Rủi ro thấp',
}

export const LEVEL_COLORS = {
  cao: 'bg-[#C0432E]/12 text-[#C0432E]',
  trung_binh: 'bg-[#E8973A]/15 text-[#C97A22]',
  thap: 'bg-[#2F7A5E]/12 text-[#2F7A5E]',
}