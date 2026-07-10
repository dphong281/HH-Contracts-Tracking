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

// Trích xuất thông tin Bên B (khách hàng) + thông tin hợp đồng từ nội dung hợp đồng.
// Cố tình bỏ qua toàn bộ khối "BÊN A" theo yêu cầu.
export function parseContractText(text) {
  const clean = text.replace(/\r/g, '')

  // Cô lập khối "BÊN B" — từ nhãn Bên B đến khi gặp mốc "Điều 1" hoặc câu mở đầu điều khoản
  const benBStart = clean.search(/B[ÊE]N\s*B\s*\(?\s*B[ÊE]N\s*MUA\)?/i)
  let benBBlock = ''
  if (benBStart !== -1) {
    const after = clean.slice(benBStart)
    const endIdx = after.search(/(Sau khi bàn bạc|ĐI[ỀE]U\s*1\b|Điều\s*1\b)/i)
    benBBlock = endIdx !== -1 ? after.slice(0, endIdx) : after.slice(0, 600)
  }

  const ten_khach_hang = grabLine(/B[ÊE]N\s*B\s*\(?\s*B[ÊE]N\s*MUA\)?\s*:?\s*(.*)/i, benBBlock)
  const dia_chi = grabLine(/^\s*Đ[ịi]a\s*ch[ỉi]\s*:?\s*(.*)/i, benBBlock)
  const so_dien_thoai = grabLine(/^\s*Đi[ệe]n\s*tho[ạa]i\s*:?\s*(.*)/i, benBBlock, /Fax/i)
  const ma_so_thue = grabLine(/^\s*M[ãa]\s*s[ốo]\s*thu[ếe]\s*:?\s*(.*)/i, benBBlock)

  // Số hợp đồng — thường ghi dạng "Số ... HĐ:" ngay đầu văn bản
  const so_hop_dong = grabLine(/^\s*S[ốo]\s*:?\s*H[ĐD]\s*:?\s*(.*)/i, clean.slice(0, 500))

  // Ngày ký / ngày bắt đầu hiệu lực — "ngày 01 tháng 01 năm 2026"
  let ngay_bat_dau = ''
  const startMatch = clean.match(/ng[àa]y\s+(\d{1,2})\s+th[áa]ng\s+(\d{1,2})\s+n[ăa]m\s+(\d{4})/i)
  if (startMatch) ngay_bat_dau = toIsoDate(startMatch[1], startMatch[2], startMatch[3])

  // Ngày hết hiệu lực — "đến hết ngày 31/12/2030"
  let ngay_ket_thuc = ''
  const endMatch =
    clean.match(/h[ếe]t\s+ng[àa]y\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i) ||
    clean.match(/đ[ếe]n\s+ng[àa]y\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i)
  if (endMatch) ngay_ket_thuc = toIsoDate(endMatch[1], endMatch[2], endMatch[3])

  // Đoán phân loại khách hàng dựa trên loại hợp đồng
  let phan_loai_goi_y = ''
  if (/T\s*N\s*P\s*P|t[ổo]ng\s*(nh[àa]\s*)?ph[âa]n\s*ph[ốo]i/i.test(clean)) phan_loai_goi_y = 'TNPP'
  else if (/t[ổo]ng\s*đ[ạa]i\s*l[ýy]|đ[ạa]i\s*l[ýy]/i.test(clean)) phan_loai_goi_y = 'DL'
  else if (/ti[êe]u\s*th[ụu]\s*tr[ựu]c\s*ti[ếe]p/i.test(clean)) phan_loai_goi_y = 'TTTT'

  return {
    ten_khach_hang,
    dia_chi,
    so_dien_thoai,
    ma_so_thue,
    so_hop_dong,
    ngay_bat_dau,
    ngay_ket_thuc,
    phan_loai_goi_y,
  }
}
