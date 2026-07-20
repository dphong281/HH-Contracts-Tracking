// Đọc & trích thông tin từ giấy tờ khách hàng (PDF hoặc ảnh PNG/JPG):
// CCCD/CMND, Giấy chứng nhận đăng ký doanh nghiệp/hộ kinh doanh, Giấy phép kinh doanh xăng dầu.
//
// Phụ thuộc (cài thêm nếu chưa có):
//   npm install pdfjs-dist tesseract.js

import * as pdfjsLib from 'pdfjs-dist'
// Import worker theo kiểu asset-URL của Vite — nếu bản pdfjs-dist khác không có
// file .mjs này, đổi path cho khớp (kiểm tra node_modules/pdfjs-dist/build/).
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createWorker } from 'tesseract.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// Nếu lớp text có sẵn của PDF ít hơn ngưỡng này → coi là PDF scan (ảnh chụp/quét),
// cần OCR thay vì đọc text trực tiếp.
const MIN_TEXT_LAYER_CHARS = 40

let ocrWorkerPromise = null
function getOcrWorker() {
  // Dùng chung 1 worker OCR cho cả phiên làm việc — khởi tạo (tải model tiếng Việt) khá tốn thời gian.
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker('vie')
  }
  return ocrWorkerPromise
}

// OCR một ảnh (File hoặc canvas) — trả về text nhận diện được.
async function ocrImage(imageSource, onProgress) {
  const worker = await getOcrWorker()
  if (onProgress) {
    worker.setProgressHandler?.((p) => {
      if (p.status === 'recognizing text') onProgress(p.progress)
    })
  }
  const { data } = await worker.recognize(imageSource)
  return data.text
}

// Trích text từ PDF: thử đọc lớp text có sẵn trước; nếu quá ít (PDF scan) thì
// render từng trang ra canvas rồi OCR.
export async function extractTextFromPdf(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  let textLayer = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    textLayer += content.items.map((it) => it.str).join(' ') + '\n'
  }

  if (textLayer.trim().length >= MIN_TEXT_LAYER_CHARS) {
    return { text: textLayer, source: 'pdf-text-layer' }
  }

  // PDF scan — không có lớp text hữu ích, OCR từng trang.
  let ocrText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise
    ocrText += (await ocrImage(canvas, onProgress)) + '\n'
  }
  return { text: ocrText, source: 'pdf-ocr' }
}

// Trích text từ ảnh PNG/JPG bằng OCR.
export async function extractTextFromImage(file, onProgress) {
  const text = await ocrImage(file, onProgress)
  return { text, source: 'image-ocr' }
}

// Dispatch theo phần mở rộng file — dùng hàm này ở UI thay vì gọi riêng từng loại.
export async function extractTextFromFile(file, onProgress) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return extractTextFromPdf(file, onProgress)
  if (/\.(png|jpe?g|webp)$/.test(name)) return extractTextFromImage(file, onProgress)
  throw new Error('Chỉ hỗ trợ file .pdf, .png, .jpg, .jpeg, .webp')
}

// ---------------------------------------------------------------------------
// Trích trường theo nhãn — chấp nhận nhãn và giá trị cách nhau bởi ':' hoặc '/'
// (OCR hay đọc CCCD dạng "Họ và tên / Full name: NGUYỄN VĂN A").
function grabLine(labelRegex, text, stopWord) {
  const lines = text.split('\n')
  for (const line of lines) {
    const m = line.match(labelRegex)
    if (m) {
      let val = (m[1] || '').trim()
      if (stopWord) {
        const idx = val.search(stopWord)
        if (idx !== -1) val = val.slice(0, idx).trim()
      }
      val = val.replace(/^[:\/]+\s*/, '').trim()
      if (val) return val.replace(/[ \t]+/g, ' ')
    }
  }
  return ''
}

function detectDocType(text) {
  if (/c[ăa]n\s*c[ưu][ớo]c\s*c[ôo]ng\s*d[âa]n|CCCD|CMND|ch[ứu]ng\s*minh\s*nh[âa]n\s*d[âa]n/i.test(text)) return 'cccd'
  if (/gi[ấa]y\s*ph[ée]p\s*kinh\s*doanh\s*x[ăa]ng\s*d[ầa]u/i.test(text)) return 'giay_phep_xang_dau'
  if (/gi[ấa]y\s*ch[ứu]ng\s*nh[ậa]n\s*đ[ăa]ng\s*k[ýy]\s*(doanh\s*nghi[ệe]p|h[ộo]\s*kinh\s*doanh)/i.test(text)) return 'dkkd'
  return 'khac'
}

// ---- CCCD / CMND ----
function parseCCCD(text) {
  const clean = text.replace(/\r/g, '')
  return {
    loai_giay_to: 'cccd',
    so_cccd: grabLine(/(?:S[ốo]|No\.?)\s*[:\/]?\s*(\d{9,12})/i, clean),
    ho_ten: grabLine(/H[ọo]\s*(?:v[àa]\s*)?t[êe]n[^\n]*?[:\/]\s*([A-ZÀ-Ỹ\s]{5,})/i, clean),
    ngay_sinh: grabLine(/Ng[àa]y\s*sinh[^\n]*?[:\/]\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, clean),
    gioi_tinh: grabLine(/Gi[ớo]i\s*t[íi]nh[^\n]*?[:\/]\s*(Nam|N[ữu])/i, clean),
    quoc_tich: grabLine(/Qu[ốo]c\s*t[ịi]ch[^\n]*?[:\/]\s*([^\n]+)/i, clean),
    que_quan: grabLine(/Qu[êe]\s*qu[áa]n[^\n]*?[:\/]\s*([^\n]+)/i, clean),
    noi_thuong_tru: grabLine(/N[ơo]i\s*th[ưu][ờo]ng\s*tr[úu][^\n]*?[:\/]\s*([^\n]+)/i, clean),
    co_gia_tri_den: grabLine(/(?:C[óo]\s*gi[áa]\s*tr[ịi]\s*đ[ếe]n|Date\s*of\s*expiry)[^\n]*?[:\/]\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, clean),
  }
}

// ---- Giấy chứng nhận đăng ký doanh nghiệp / hộ kinh doanh ----
function parseDKKD(text) {
  const clean = text.replace(/\r/g, '')
  return {
    loai_giay_to: 'dkkd',
    ten_doanh_nghiep: grabLine(/T[êe]n\s*(?:doanh\s*nghi[ệe]p|h[ộo]\s*kinh\s*doanh)[^\n]*?[:\/]\s*([^\n]+)/i, clean),
    ma_so_thue: grabLine(/M[ãa]\s*s[ốo]\s*(?:doanh\s*nghi[ệe]p|thu[ếe])[^\n]*?[:\/]\s*(\d{10,13})/i, clean),
    dia_chi_tru_so: grabLine(/Đ[ịi]a\s*ch[ỉi]\s*(?:tr[ụu]\s*s[ởo]|kinh\s*doanh)[^\n]*?[:\/]\s*([^\n]+)/i, clean),
    nguoi_dai_dien: grabLine(/(?:Ng[ưu][ờo]i\s*đ[ạa]i\s*di[ệe]n(?:\s*theo\s*ph[áa]p\s*lu[ậa]t)?|Ch[ủu]\s*h[ộo])[^\n]*?[:\/]\s*([^\n]+)/i, clean),
    ngay_cap: grabLine(/(?:C[ấa]p\s*(?:l[ầa]n\s*đ[ầa]u|ng[àa]y)|Đ[ăa]ng\s*k[ýy]\s*l[ầa]n\s*đ[ầa]u)[^\n]*?[:\/]\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, clean),
    nganh_nghe_kd: grabLine(/Ng[àa]nh\s*ngh[ềe]\s*kinh\s*doanh[^\n]*?[:\/]\s*([^\n]+)/i, clean),
  }
}

// ---- Giấy phép kinh doanh xăng dầu ----
function parseGiayPhepXangDau(text) {
  const clean = text.replace(/\r/g, '')
  return {
    loai_giay_to: 'giay_phep_xang_dau',
    ten_thuong_nhan: grabLine(/(?:Th[ưu][ơo]ng\s*nh[âa]n|T[êe]n\s*doanh\s*nghi[ệe]p)[^\n]*?[:\/]\s*([^\n]+)/i, clean),
    so_giay_phep: grabLine(/S[ốo]\s*(?:gi[ấa]y\s*ph[ée]p|GPKD)[^\n]*?[:\/]\s*([^\n]+)/i, clean),
    co_quan_cap: grabLine(/(?:C[ơo]\s*quan\s*c[ấa]p|N[ơo]i\s*c[ấa]p)[^\n]*?[:\/]\s*([^\n]+)/i, clean),
    ngay_cap: grabLine(/Ng[àa]y\s*c[ấa]p[^\n]*?[:\/]\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, clean),
    hieu_luc_den: grabLine(/(?:Hi[ệe]u\s*l[ựu]c\s*đ[ếe]n|H[ếe]t\s*h[ạa]n)[^\n]*?[:\/]\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, clean),
    dia_diem_kd: grabLine(/Đ[ịi]a\s*đi[ểe]m\s*kinh\s*doanh[^\n]*?[:\/]\s*([^\n]+)/i, clean),
  }
}

// Tự nhận diện loại giấy tờ rồi trích các trường tương ứng.
// Luôn kèm raw_text để người dùng đối chiếu/sửa tay khi OCR đọc sai.
export function parseDocumentText(text) {
  const type = detectDocType(text)
  let parsed
  if (type === 'cccd') parsed = parseCCCD(text)
  else if (type === 'dkkd') parsed = parseDKKD(text)
  else if (type === 'giay_phep_xang_dau') parsed = parseGiayPhepXangDau(text)
  else parsed = { loai_giay_to: 'khac' }
  parsed.raw_text = text
  return parsed
}

// Hàm tiện dùng ở UI: đưa file vào, nhận về dữ liệu đã trích + text gốc.
export async function extractAndParseDocument(file, onProgress) {
  const { text, source } = await extractTextFromFile(file, onProgress)
  const parsed = parseDocumentText(text)
  parsed.nguon_doc = source // 'pdf-text-layer' | 'pdf-ocr' | 'image-ocr' — báo cho người dùng biết độ tin cậy
  return parsed
}

// Giải phóng worker OCR khi rời trang (gọi trong useEffect cleanup nếu cần).
export async function terminateOcrWorker() {
  if (ocrWorkerPromise) {
    const worker = await ocrWorkerPromise
    await worker.terminate()
    ocrWorkerPromise = null
  }
}