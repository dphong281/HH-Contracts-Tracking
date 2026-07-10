// Mã hoá trường dữ liệu nhạy cảm ngay trên trình duyệt trước khi gửi lên Supabase.
// Dùng AES-GCM (chuẩn công nghiệp) qua Web Crypto API — có sẵn trong mọi trình duyệt hiện đại.
//
// GIỚI HẠN CẦN BIẾT: key nằm trong code app (biến môi trường VITE_ENCRYPTION_KEY),
// nên bảo vệ được dữ liệu khi ở trạng thái tĩnh (rò rỉ database, backup thất lạc,
// ai đó xem trộm Supabase Table Editor) — nhưng KHÔNG bảo vệ được nếu người có sẵn
// quyền vào chính app này cố tình mở DevTools để lấy key.

const RAW_KEY = import.meta.env.VITE_ENCRYPTION_KEY

let cachedKey = null

async function getKey() {
  if (cachedKey) return cachedKey
  if (!RAW_KEY) {
    throw new Error('Thiếu VITE_ENCRYPTION_KEY trong .env — không thể mã hoá/giải mã dữ liệu.')
  }
  const rawBytes = base64ToBytes(RAW_KEY)
  cachedKey = await crypto.subtle.importKey('raw', rawBytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
  return cachedKey
}

function bytesToBase64(bytes) {
  let binary = ''
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary)
}

function base64ToBytes(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// Mã hoá 1 chuỗi text -> chuỗi base64 (an toàn để lưu vào cột text trên Supabase)
// Trả về null nếu input rỗng/null (để không mã hoá giá trị trống một cách vô nghĩa)
export async function encryptField(plainText) {
  if (plainText === null || plainText === undefined || plainText === '') return null
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(String(plainText))
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const combined = new Uint8Array(iv.length + cipherBuf.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(cipherBuf), iv.length)
  // Tiền tố "enc:" để phân biệt dữ liệu đã mã hoá với dữ liệu cũ chưa mã hoá (nếu có)
  return 'enc:' + bytesToBase64(combined)
}

// Giải mã ngược lại. Nếu gặp dữ liệu cũ chưa có tiền tố "enc:" (từ trước khi bật mã hoá),
// trả nguyên văn — để không vỡ dữ liệu cũ, tự nhiên "di cư" dần khi được sửa lại.
export async function decryptField(storedValue) {
  if (storedValue === null || storedValue === undefined || storedValue === '') return storedValue
  if (typeof storedValue !== 'string' || !storedValue.startsWith('enc:')) return storedValue
  try {
    const key = await getKey()
    const combined = base64ToBytes(storedValue.slice(4))
    const iv = combined.slice(0, 12)
    const cipherBytes = combined.slice(12)
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes)
    return new TextDecoder().decode(plainBuf)
  } catch (_e) {
    return '⚠️ Không giải mã được (sai key?)'
  }
}

// Helper mã hoá nhiều field cùng lúc trong 1 object, trả về object mới
export async function encryptFields(obj, fieldNames) {
  const result = { ...obj }
  for (const field of fieldNames) {
    if (field in result) {
      result[field] = await encryptField(result[field])
    }
  }
  return result
}

// Helper giải mã nhiều field cùng lúc trong 1 object, trả về object mới
export async function decryptFields(obj, fieldNames) {
  const result = { ...obj }
  for (const field of fieldNames) {
    if (field in result && result[field] !== null && result[field] !== undefined) {
      result[field] = await decryptField(result[field])
    }
  }
  return result
}

// Giải mã 1 mảng object cùng lúc (dùng cho danh sách)
export async function decryptList(list, fieldNames) {
  return Promise.all(list.map((item) => decryptFields(item, fieldNames)))
}

// Tạo 1 key ngẫu nhiên mạnh (dùng 1 lần khi setup ban đầu, in ra để lưu vào .env)
export async function generateNewKey() {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
  const raw = await crypto.subtle.exportKey('raw', key)
  return bytesToBase64(new Uint8Array(raw))
}
