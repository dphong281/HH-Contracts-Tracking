import mammoth from 'mammoth'

// Đọc file .docx và trả về text thô
export async function extractTextFromDocx(file) {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

function grab(regex, text) {
  const m = text.match(regex)
  return m ? m[1].trim().replace(/[ \t]+/g, ' ') : ''
}

// Trích theo từng dòng — tránh lỗi \s* "nhảy" qua dấu xuống dòng và
// nhặt nhầm nội dung của nhãn kế tiếp khi trường hiện tại để trống.
function grabLine(labelRegex, block, stopWord) {
  const lines = block.split('\n')
  for (const line of lines) {
    const m = line.match(labelRegex)
    if (m) {
      let val = (m[1] || '').trim()
      if (stopWord) {
        const idx = val.search(stopWord)
        if (idx !== -1) val = val.slice(0, idx).trim()
      }
      val = val.replace(/^:+\s*/, '').trim()
      if (val) return val.replace(/[ \t]+/g, ' ')
    }
  }
  return ''
}

// Lấy TẤT CẢ các dòng khớp nhãn — dùng cho trường có thể lặp lại (VD nhiều số TK).
function grabAllLines(labelRegex, block) {
  const lines = block.split('\n')
  const out = []
  for (const line of lines) {
    const m = line.match(labelRegex)
    if (m) {
      const val = (m[1] || '').trim().replace(/^:+\s*/, '').trim()
      if (val) out.push(val.replace(/[ \t]+/g, ' '))
    }
  }
  return out
}

// Tách riêng logic lấy Số hợp đồng — không dùng grabLine() thông thường vì cần
// BỎ QUA các dòng "Số điện thoại"/"Số CCCD"/"Số tài khoản" cũng bắt đầu bằng
// "Số" nhưng không phải số hợp đồng, và giữ nguyên mã dạng "15.2026/HĐMBXD/HH – TL"
// (không cần chữ "HĐ" tách riêng thành nhãn như giả định trước đây).
function extractSoHopDong(text) {
  const lines = text.split('\n')
  const excludePrefixes = /^(đi[ệe]n\s*tho[ạa]i|t[àa]i\s*kho[ảa]n|CCCD|CMND|nh[àa]|fax|email)/i
  for (const line of lines) {
    const m = line.match(/^\s*S[ốo]\s+(.+)/i) || line.match(/^\s*S[ốo]:(.+)/i)
    if (m) {
      const val = m[1].trim().replace(/^:+\s*/, '').trim()
      if (val && !excludePrefixes.test(val)) return val.replace(/[ \t]+/g, ' ')
    }
  }
  return ''
}

function toIsoDate(day, month, year) {
  if (!day || !month || !year) return ''
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Bỏ dấu tiếng Việt để so khớp tên khách hàng không phân biệt dấu
export function normalizeVN(str = '') {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

// Tách văn bản hợp đồng thành từng "ĐIỀU n: ..." để khoanh vùng trích xuất theo điều khoản.
// Trả về mảng { so, tieu_de, noi_dung } — noi_dung chạy tới đầu điều tiếp theo.
function splitByArticles(text) {
  // Bắt buộc: đầu dòng + "ĐIỀU" viết hoa nguyên vẹn + dấu ':' hoặc '.' ngay sau số.
  // Tránh khớp nhầm các câu tham chiếu chéo kiểu "...tại Điều 7 (bảy) của hợp đồng"
  // hay "...khoản 7 Điều 1 Nghị định số 80/2023/NĐ-CP" (không viết hoa, không có dấu ngay sau số).
  const re = /^[ \t]*ĐI[ỀE]U\s+(\d{1,2})\s*[:.]\s*([^\n]*)/gm
  const matches = [...text.matchAll(re)]
  const articles = []
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const start = m.index
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length
    articles.push({
      so: parseInt(m[1], 10),
      tieu_de: (m[2] || '').trim(),
      noi_dung: text.slice(start, end),
    })
  }
  return articles
}

function findArticle(articles, so) {
  return articles.find((a) => a.so === so)
}

// ---- Sản lượng cam kết: dòng dạng "<tên hàng>: <số lượng> <đơn vị>/tháng" ----
function extractSanLuong(block) {
  if (!block) return []
  const lines = block.split('\n')
  const re = /^[\s\-•*]*([^:：]+?)\s*[:：]\s*([\d.,]+)\s*(l[íi]t|kg|t[ấa]n)\s*\/\s*th[áa]ng/i
  const out = []
  for (const line of lines) {
    const m = line.match(re)
    if (m) {
      const donViRaw = m[3].toLowerCase()
      out.push({
        ten_hang: m[1].trim(),
        so_luong: m[2].trim(),
        don_vi: donViRaw.startsWith('l') ? 'lít' : donViRaw.startsWith('k') ? 'kg' : 'tấn',
      })
    }
  }
  return out
}

// ---- Hình thức mua bán (thường ở Điều 3) ----
function extractHinhThucMuaBan(block) {
  if (!block) return []
  const out = []
  if (/mua\s*h[àa]ng\s*theo\s*ti[ếe]n\s*đ[ộo]/i.test(block)) out.push('Theo tiến độ hàng ngày')
  if (/mua\s*h[àa]ng\s*theo\s*l[ôo]/i.test(block)) out.push('Theo lô')
  return out
}

// ---- Hình thức thanh toán (thường ở Điều 6) ----
function extractHinhThucThanhToan(block) {
  if (!block) return []
  const out = []
  if (/thanh\s*to[áa]n\s*b[ằa]ng\s*chuy[ểe]n\s*kho[ảa]n/i.test(block)) out.push('Chuyển khoản')
  if (/thanh\s*to[áa]n\s*b[ằa]ng\s*ti[ềe]n\s*m[ặa]t/i.test(block)) out.push('Tiền mặt')
  if (/tr[ảa]\s*tr[ướu][ớo]c|tr[ảa]\s*ngay/i.test(block)) out.push('Trả trước')
  if (/tr[ảa]\s*ch[ậa]m/i.test(block)) out.push('Trả chậm (công nợ)')
  return out
}

function extractDatCocKyQuy(block) {
  if (!block) return false
  return /đ[ặa]t\s*c[ọo]c|k[ýy]\s*qu[ỹy]/i.test(block)
}

// "trong thời hạn 05 (năm) ngày làm việc" → "5 ngày làm việc"
function extractThoiHanDoiChieu(block) {
  if (!block) return ''
  const m = block.match(/(\d{1,2})\s*\([^\d)]*\)?\s*ng[àa]y\s*l[àa]m\s*vi[ệe]c/i)
  return m ? `${m[1]} ngày làm việc` : ''
}

// ---- Giá & chiết khấu (thường ở Điều 2) ----
function extractCongThucGia(block) {
  if (!block) return ''
  const m = block.match(/Gi[áa]\s*b[áa]n\s*=\s*[^\n]+/i)
  return m ? m[0].trim() : ''
}

// Chỉ khớp khi hợp đồng đã điền số cụ thể, VD "500 đồng/lít" hoặc "2%"
function extractChietKhau(block) {
  if (!block) return ''
  const m = block.match(/chi[ếe]t\s*kh[ấa]u[^\n%.]{0,40}?([\d.,]+\s*(?:đ[ồo]ng\s*\/\s*l[íi]t|%|đ\s*\/\s*l[íi]t))/i)
  return m ? m[1].trim() : ''
}

// ---- Điều kiện đơn phương chấm dứt hợp đồng ----
function extractDieuKienChamDut(block) {
  if (!block) return []
  const lines = block.split('\n')
  const out = []
  for (const line of lines) {
    if (
      /đ[ơo]n\s*ph[ươu][ơo]ng\s*ch[ấa]m\s*d[ứu]t/i.test(line) ||
      /kh[ôo]ng\s*th[ựu]c\s*hi[ệe]n\s*đ[úu]ng/i.test(line)
    ) {
      out.push(line.trim())
    }
  }
  return out
}

function extractTreoLogo(block) {
  if (!block) return false
  return /treo\s*logo|bi[ểe]n\s*hi[ệe]u/i.test(block)
}

// "trong vòng 30 ngày ... sẽ tự động thanh lý"
function extractGiaHanTuDong(block) {
  if (!block) return ''
  const m = block.match(/trong\s*v[òo]ng\s*(\d{1,3})\s*n[gh]?[àa]y[^\n.]*t[ựu]\s*đ[ộo]ng\s*thanh\s*l[ýy]/i)
  return m ? `Tự động thanh lý sau ${m[1]} ngày nếu không có ý kiến` : ''
}

// "Hợp đồng này gồm 10 trang và được lập thành 04 bản..."
function extractSoTrangSoBan(text) {
  const m = text.match(/g[ồo]m\s*(\d{1,3})\s*trang[^\n]*l[ậa]p\s*th[àa]nh\s*(\d{1,2})\s*b[ảa]n/i)
  if (!m) return { so_trang: '', so_ban: '' }
  return { so_trang: m[1], so_ban: m[2] }
}

// Trích thông tin một "Bên" (địa chỉ, điện thoại, fax, TK, MST, đại diện, chức vụ) từ 1 khối text
function extractPartyInfo(block) {
  const dia_chi = grabLine(/^\s*Đ[ịi]a\s*ch[ỉi]\s*:?\s*(.*)/i, block)
  const dien_thoai = grabLine(/^\s*Đi[ệe]n\s*tho[ạa]i\s*:?\s*(.*)/i, block, /Fax/i)
  const fax = grabLine(/Fax\s*:?\s*(.*)/i, block)
  const tai_khoan = grabAllLines(/^\s*(?:Ho[ặa]c\s*)?T[àa]i\s*kho[ảa]n\s*s[ốo]\s*:?\s*(.*)/i, block)
  const ma_so_thue = grabLine(/^\s*M[ãa]\s*s[ốo]\s*thu[ếe]\s*:?\s*(.*)/i, block)
  const dai_dien = grabLine(/Đ[ạa]i\s*di[ệe]n\s*[ÔôƠơ]ng\/B[àa]\s*:?\s*(.*)/i, block, /Ch[ứu]c\s*v[ụu]/i)
  const chuc_vu = grabLine(/Ch[ứu]c\s*v[ụu]\s*:?\s*(.*)/i, block)
  return { dia_chi, dien_thoai, fax, tai_khoan, ma_so_thue, dai_dien, chuc_vu }
}

// Trích xuất toàn bộ thông tin hợp đồng: định danh, Bên A, Bên B, sản lượng,
// giá/chiết khấu, hình thức mua bán & thanh toán, và các điều khoản cần theo dõi.
export function parseContractText(text) {
  // Loại bỏ \r, soft hyphen (U+00AD) và zero-width chars — Word hay chèn các ký tự
  // ẩn này vào giữa từ (VD "n­gày") khiến regex theo từ khóa bị trượt.
  const clean = text
    .replace(/\r/g, '')
    .replace(/[\u00AD\u200B\u200C\u200D\uFEFF]/g, '')
  const articles = splitByArticles(clean)

  // ===== 1. Thông tin định danh hợp đồng =====
  const so_hop_dong = extractSoHopDong(clean.slice(0, 800))

  let loai_hop_dong = ''
  if (/ĐẠI\s*L[ÝY]\s*B[ÁA]N\s*L[ẺE]/i.test(clean.slice(0, 500))) loai_hop_dong = 'Đại lý bán lẻ xăng dầu'
  else if (/MUA\s*B[ÁA]N\s*X[ĂA]NG\s*D[ẦA]U/i.test(clean.slice(0, 500))) loai_hop_dong = 'Mua bán xăng dầu'

  let ngay_ky = ''
  let dia_diem_ky = ''
  const kyMatch = clean.match(
    /H[ôo]m\s*nay,?\s*ng[àa]y\s+(\d{1,2})\s+th[áa]ng\s+(\d{1,2})\s+n[ăa]m\s+(\d{4})\s*t[ạa]i\s+([^\n,;]+)/i
  )
  if (kyMatch) {
    ngay_ky = toIsoDate(kyMatch[1], kyMatch[2], kyMatch[3])
    dia_diem_ky = kyMatch[4].trim()
  }

  let ngay_bat_dau = ngay_ky
  if (!ngay_bat_dau) {
    const startMatch = clean.match(/ng[àa]y\s+(\d{1,2})\s+th[áa]ng\s+(\d{1,2})\s+n[ăa]m\s+(\d{4})/i)
    if (startMatch) ngay_bat_dau = toIsoDate(startMatch[1], startMatch[2], startMatch[3])
  }

  let ngay_ket_thuc = ''
  const endMatch =
    clean.match(/h[ếe]t\s+ng[àa]y\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i) ||
    clean.match(/đ[ếe]n\s+ng[àa]y\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i)
  if (endMatch) ngay_ket_thuc = toIsoDate(endMatch[1], endMatch[2], endMatch[3])

  const { so_trang, so_ban } = extractSoTrangSoBan(clean)

  // ===== 2 & 3. Khối Bên A / Bên B =====
  // Bên B: nhận nhiều nhãn — BÊN MUA (hợp đồng mua bán) hoặc BÊN ĐẠI LÝ / NHẬN ĐẠI LÝ (hợp đồng đại lý)
  const benAStart = clean.search(/B[ÊE]N\s*A\s*\(?[^)]*\)?/i)
  const benBStart = clean.search(
    /B[ÊE]N\s*B\s*\(?\s*B[ÊE]N\s*(MUA|Đ[ẠA]I\s*L[ÝY]|NH[ẬA]N\s*Đ[ẠA]I\s*L[ÝY])\)?/i
  )

  let benABlock = ''
  if (benAStart !== -1) {
    const after = clean.slice(benAStart)
    const endIdx = after.search(/B[ÊE]N\s*B\s*\(/i)
    benABlock = endIdx !== -1 ? after.slice(0, endIdx) : after.slice(0, 600)
  }

  let benBBlock = ''
  if (benBStart !== -1) {
    const after = clean.slice(benBStart)
    const endIdx = after.search(/(Sau khi bàn bạc|ĐI[ỀE]U\s*1\b|Điều\s*1\b)/i)
    benBBlock = endIdx !== -1 ? after.slice(0, endIdx) : after.slice(0, 600)
  }

  const ten_ben_a = grabLine(/B[ÊE]N\s*A\s*\([^)]*\)\s*:?\s*(.*)/i, benABlock) || 'CÔNG TY TNHH HOÀNG HÀ'
  const benA = extractPartyInfo(benABlock)

  const ten_khach_hang = grabLine(/B[ÊE]N\s*B\s*\([^)]*\)\s*:?\s*(.*)/i, benBBlock)
  const benB = extractPartyInfo(benBBlock)

  // ===== 4. Sản lượng cam kết (thường nằm trong Điều 1) =====
  const dieu1 = findArticle(articles, 1)
  const san_luong_cam_ket = extractSanLuong(dieu1 ? dieu1.noi_dung : clean)

  // ===== 5. Giá & chiết khấu (Điều 2) =====
  const dieu2 = findArticle(articles, 2)
  const cong_thuc_gia = extractCongThucGia(dieu2 ? dieu2.noi_dung : '')
  const chiet_khau = extractChietKhau(dieu2 ? dieu2.noi_dung : '')

  // ===== 6. Hình thức mua bán (Điều 3) & thanh toán (Điều 6/7) =====
  const dieu3 = findArticle(articles, 3)
  const dieu6 = findArticle(articles, 6)
  const dieu7 = findArticle(articles, 7)
  const hinh_thuc_mua_ban = extractHinhThucMuaBan(dieu3 ? dieu3.noi_dung : '')
  const hinh_thuc_thanh_toan = extractHinhThucThanhToan(dieu6 ? dieu6.noi_dung : '')
  const dat_coc_ky_quy = extractDatCocKyQuy(dieu6 ? dieu6.noi_dung : '')
  const thoi_han_doi_chieu_cong_no = extractThoiHanDoiChieu(dieu7 ? dieu7.noi_dung : '')

  // ===== 7. Điều khoản khác cần theo dõi =====
  const dieu10 = findArticle(articles, 10)
  const dieu12 = findArticle(articles, 12)
  const dieu_kien_don_phuong_cham_dut = extractDieuKienChamDut(dieu10 ? dieu10.noi_dung : '')
  const nghia_vu_treo_logo = extractTreoLogo(dieu10 ? dieu10.noi_dung : '')
  const gia_han_tu_dong = extractGiaHanTuDong(dieu12 ? dieu12.noi_dung : clean)

  // ===== Gợi ý phân loại khách hàng (giữ nguyên logic cũ) =====
  const hasWord = (re) => re.test(clean)
  const hasAbbrev = (code) => new RegExp(`(^|[\\s:.,(])${code}([\\s:.,)]|$)`, 'i').test(clean)
  let phan_loai_goi_y = ''
  if (hasWord(/T\s*N\s*P\s*P/i) || hasWord(/th[ưu][ơo]ng\s*nh[âa]n\s*ph[âa]n\s*ph[ốo]i/i) || hasAbbrev('TNPP')) {
    phan_loai_goi_y = 'TNPP'
  } else if (hasWord(/t[ổo]ng\s*đ[ạa]i\s*l[ýy]|đ[ạa]i\s*l[ýy]/i) || hasAbbrev('ĐL') || hasAbbrev('DL')) {
    phan_loai_goi_y = 'DL'
  } else if (hasWord(/ti[êe]u\s*th[ụu]\s*tr[ựu]c\s*ti[ếe]p/i) || hasAbbrev('TTTT')) {
    phan_loai_goi_y = 'TTTT'
  } else if (hasAbbrev('MB')) {
    phan_loai_goi_y = 'MB'
  }

  return {
    // 1. Định danh hợp đồng
    so_hop_dong,
    loai_hop_dong,
    ngay_ky,
    dia_diem_ky,
    ngay_bat_dau,
    ngay_ket_thuc,
    so_trang,
    so_ban,

    // 2. Bên A (Hoàng Hà)
    ten_ben_a,
    dia_chi_a: benA.dia_chi,
    dien_thoai_a: benA.dien_thoai,
    fax_a: benA.fax,
    tai_khoan_a: benA.tai_khoan,
    ma_so_thue_a: benA.ma_so_thue,
    dai_dien_a: benA.dai_dien,
    chuc_vu_a: benA.chuc_vu,

    // 3. Bên B (khách hàng)
    ten_khach_hang,
    dia_chi: benB.dia_chi,
    so_dien_thoai: benB.dien_thoai,
    fax: benB.fax,
    tai_khoan: benB.tai_khoan,
    ma_so_thue: benB.ma_so_thue,
    dai_dien: benB.dai_dien,
    chuc_vu: benB.chuc_vu,

    // 4. Sản lượng cam kết theo mặt hàng
    san_luong_cam_ket,

    // 5. Giá & chiết khấu
    cong_thuc_gia,
    chiet_khau,

    // 6. Hình thức mua bán & thanh toán
    hinh_thuc_mua_ban,
    hinh_thuc_thanh_toan,
    dat_coc_ky_quy,
    thoi_han_doi_chieu_cong_no,

    // 7. Điều khoản khác cần theo dõi
    dieu_kien_don_phuong_cham_dut,
    nghia_vu_treo_logo,
    gia_han_tu_dong,

    // Gợi ý phân loại khách hàng
    phan_loai_goi_y,
  }
}