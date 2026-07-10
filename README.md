# QLHD — Theo dõi Hợp đồng Đầu ra

Webapp quản lý hợp đồng đầu ra cho Hoàng Hà: khách hàng, hợp đồng, phụ lục, công nợ/thanh toán, dashboard tổng quan, đăng nhập, nhật ký hoạt động, mã hoá dữ liệu nhạy cảm, realtime, backup 3 lớp.

Stack: React + Vite + Tailwind CSS v4 + Supabase (free tier) + Recharts + Supabase Auth + Supabase Realtime + GitHub Actions.

---

## 1. Cài đặt cơ bản

```bash
npm install
```

### Tạo Supabase project (nếu chưa có)
1. [supabase.com](https://supabase.com) → New Project (free tier), region Singapore
2. **SQL Editor** → chạy toàn bộ `supabase_schema.sql` → Run
3. **Settings → API Keys** → copy **Project URL** và **Publishable key**

### Kết nối
Đổi tên `.env.example` → `.env`, điền:
```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx
VITE_ENCRYPTION_KEY=xem_muc_5_ben_duoi
```

```bash
npm run dev
```

### Deploy free lên Vercel
1. Push code lên GitHub repo (**Private** — vì chứa dữ liệu kinh doanh)
2. [vercel.com](https://vercel.com) → New Project → chọn repo
3. **Environment Variables**: thêm cả 3 biến trong `.env`
4. Deploy — domain dạng `xxx.vercel.app`, hoàn toàn free

---

## 2. Cấu trúc module

| Module | Ghi chú |
|---|---|
| Đăng nhập | Bắt buộc mới vào được app. Nhớ email cho lần sau. Có "Quên mật khẩu?" |
| Tổng quan (Dashboard) | Chỉ số tổng, biểu đồ, cảnh báo HĐ sắp hết hạn, top công nợ/KH — realtime |
| Hợp đồng | CRUD, tìm kiếm, lọc, nhập từ file Word (.docx) — realtime |
| Chi tiết hợp đồng | Sửa HĐ, phụ lục, thanh toán, công nợ tự tính — realtime |
| Khách hàng | CRUD, phân loại ĐL/MB/TNPP/TTTT — realtime |
| Công nợ | Tổng hợp công nợ toàn bộ HĐ — realtime |
| Nhân viên | CRUD nhân viên phụ trách — realtime |
| Nhật ký hoạt động | Ai thêm/sửa/xoá gì, lúc nào — ghi ở tầng database, không lách được — realtime |
| Cài đặt | Hồ sơ cá nhân (mọi người); Quản lý tài khoản, Yêu cầu quên mật khẩu, Mã hoá dữ liệu cũ, Lịch backup Google Drive, Sao lưu thủ công (chỉ admin) |

---

## 3. Vai trò Admin / Nhân viên

2 vai trò, quyền thao tác dữ liệu nghiệp vụ như nhau — chỉ khác: **admin** mới thấy "Quản lý tài khoản" + "Yêu cầu quên mật khẩu" trong Cài đặt.

### Tạo tài khoản đăng nhập
**Cách 1 (cần đã deploy Edge Function, xem mục 6):** Admin → Cài đặt → Quản lý tài khoản → "+ Tạo tài khoản"

**Cách 2 (dùng ngay, không cần Edge Function):** Supabase Dashboard → Authentication → Users → Add user → hồ sơ `tai_khoan` tự sinh, sửa lại tên/SĐT/vai trò trong Table Editor nếu cần

### Chỉ định admin đầu tiên
```sql
update tai_khoan set vai_tro = 'admin' where email = 'email-cua-ban@vidu.com';
```

### Luồng "Quên mật khẩu"
1. Trang đăng nhập → "Quên mật khẩu?" → nhập email + SĐT → gửi
2. Admin thấy yêu cầu trong Cài đặt, hệ thống tự so khớp SĐT với hồ sơ tài khoản (✓/✕)
3. Admin gọi điện xác minh thật, nhập mật khẩu mới, bấm "Đặt lại mật khẩu"

Không có gửi email/SMS tự động cho admin (cần dịch vụ trả phí) — admin cần chủ động kiểm tra Cài đặt định kỳ.

---

## 4. Realtime

Khi ai đó thêm/sửa/xoá dữ liệu, người khác đang mở app tự thấy cập nhật, không cần F5 (Supabase Realtime, miễn phí, bật qua `migration_realtime.sql`).

Giới hạn: 2 người sửa cùng 1 hợp đồng cùng lúc → ai lưu sau đè người lưu trước, không cảnh báo xung đột. Hiếm xảy ra với quy mô nội bộ nhỏ.

---

## 5. Mã hoá dữ liệu nhạy cảm

Mã hoá ngay trên trình duyệt (AES-256-GCM, Web Crypto API — chuẩn có sẵn, không cần thư viện ngoài) trước khi gửi lên Supabase:

- Khách hàng: địa chỉ, số điện thoại, mã số thuế
- Nhân viên: số điện thoại, email
- Hợp đồng: giá trị hợp đồng
- Thanh toán: số tiền

Không mã hoá: SĐT tài khoản đăng nhập (cần đối chiếu bằng mắt khi xử lý quên mật khẩu), tên KH/NV/số HĐ (cần tìm nhanh).

### Giới hạn cần hiểu rõ trước khi dùng
Key mã hoá nằm trong code app (`VITE_ENCRYPTION_KEY`). Bảo vệ được: database bị rò rỉ, backup thất lạc, ai đó xem trộm Supabase Table Editor. Không bảo vệ được: người có sẵn quyền vào app mở DevTools lấy key. Phù hợp nhóm nội bộ tin cậy nhau. Cần bảo mật cao hơn (chống cả người dùng nội bộ ác ý) thì báo lại để nâng cấp sang mã hoá qua Edge Function.

Tìm kiếm/lọc vẫn hoạt động bình thường trên trường đã mã hoá (app tải hết dữ liệu, giải mã, lọc trên trình duyệt — không lọc bằng SQL). Vài nghìn hợp đồng trở xuống, tốc độ không khác biệt đáng kể.

### Thiết lập (làm 1 lần)
1. Tạo khoá ngẫu nhiên mạnh:
   ```powershell
   node -e "console.log(Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'))"
   ```
2. Thêm vào `.env`: `VITE_ENCRYPTION_KEY=chuoi_vua_copy`
3. Lưu khoá này ở nơi an toàn riêng (trình quản lý mật khẩu) — mất khoá = mất vĩnh viễn toàn bộ dữ liệu đã mã hoá, không có cách khôi phục, kể cả chính bạn.
4. Chạy `migration_encryption.sql` trong SQL Editor
5. Admin → Cài đặt → Mã hoá dữ liệu cũ → chạy 1 lần (mã hoá nốt dữ liệu tạo trước khi bật tính năng này)
6. Deploy Vercel: thêm `VITE_ENCRYPTION_KEY` vào Environment Variables

---

## 6. BẮT BUỘC: Deploy Edge Function (để Quản lý tài khoản hoạt động)

Tạo tài khoản mới / đặt lại mật khẩu người khác cần "chìa khoá vạn năng" (service role key) — không được lộ ra frontend, nên chạy qua Edge Function (server của Supabase, miễn phí).

```powershell
npm install -g supabase
supabase login
supabase link --project-ref <PROJECT_REF_CUA_BAN>
supabase functions deploy admin-actions
```

`PROJECT_REF` lấy từ URL project, vd `https://ttmtmcoexzaiwqpnphx.supabase.co` → ref là `ttmtmcoexzaiwqpnphx`. Deploy xong dùng ngay, không cần cấu hình thêm.

---

## 7. Backup 3 lớp

**Lớp 1 — Xuất nhanh thủ công:** Cài đặt → Sao lưu dữ liệu → tải `.json`. Dùng trước thao tác rủi ro. Có nút **Khôi phục từ file backup** ngay bên dưới để nhập ngược file `.json` này lại vào database khi cần — xem chi tiết ở mục "Khôi phục từ file JSON" bên dưới.

**Lớp 2 — Tự động vào GitHub repo:** GitHub Actions chạy `pg_dump` theo lịch, commit vào `backups/` (giữ 12 bản), lưu artifact 90 ngày. Đồng thời giữ project Supabase không bị tạm dừng do 7 ngày không hoạt động.

**Lớp 3 — Tự động lên Google Drive theo lịch tự đặt:** Admin đặt "số ngày giữa các lần backup" trong Cài đặt; GitHub Actions kiểm tra mỗi ngày, đến hạn thì backup + tải lên Drive.

### Thiết lập Lớp 2 (bắt buộc để Lớp 3 hoạt động)
1. Supabase Dashboard → nút Connect → chọn Session pooler (không chọn Transaction pooler / Direct connection — không ổn định từ GitHub Actions)
2. Copy connection string dạng `postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-xxx.pooler.supabase.com:5432/postgres`
3. Thay `[YOUR-PASSWORD]` bằng mật khẩu database thật (Project Settings → Database → Database Password — khác với mật khẩu đăng nhập app)
4. GitHub repo → Settings → Secrets and variables → Actions → thêm secret `SUPABASE_DB_URL` = connection string đã điền mật khẩu
5. Đảm bảo repo Private
6. Push code lên GitHub (đã có sẵn `.github/workflows/backup.yml`)

### Thiết lập Lớp 3 — Google Drive (cần tài khoản Google, làm 1 lần)

**Bước 1 — Service Account trên Google Cloud (miễn phí)**
1. [console.cloud.google.com](https://console.cloud.google.com) → tạo project mới (hoặc dùng có sẵn)
2. APIs & Services → Library → tìm "Google Drive API" → Enable
3. APIs & Services → Credentials → Create Credentials → Service Account → đặt tên (vd `qlhd-backup`) → Create and Continue → Done
4. Bấm vào Service Account → tab Keys → Add Key → Create new key → JSON → tải về, giữ kỹ
5. Mở file JSON, copy giá trị `"client_email"` (dạng `xxx@xxx.iam.gserviceaccount.com`)

**Bước 2 — Share thư mục Drive cho Service Account**
1. Google Drive cá nhân → tạo thư mục mới (vd "QLHD Backups")
2. Chuột phải → Share → dán email Service Account → quyền Editor → Send (bắt buộc — Service Account không có kho lưu trữ riêng)
3. Mở thư mục, lấy Folder ID từ URL: `drive.google.com/drive/folders/<FOLDER_ID>`

**Bước 3 — Thêm secrets vào GitHub**

| Secret | Giá trị |
|---|---|
| `SUPABASE_URL` | `https://ttmtmcoexzaiwqpnphx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API Keys → tab "Legacy anon, service_role API keys" → copy `service_role` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Toàn bộ nội dung file JSON ở Bước 1.4 |
| `GOOGLE_DRIVE_FOLDER_ID` | Folder ID ở Bước 2.3 |

`SUPABASE_SERVICE_ROLE_KEY` bỏ qua mọi RLS — chỉ để trong GitHub Secrets, tuyệt đối không dán vào code hay `.env` frontend.

**Bước 4 — Chạy migration + cấu hình**
1. Chạy `migration_backup_settings.sql` trong SQL Editor
2. Admin → Cài đặt → Lịch sao lưu → đặt số ngày → Lưu
3. GitHub repo → tab Actions → workflow "Sao lưu Supabase (theo lịch cấu hình trong app)" → Run workflow để test ngay
4. Kiểm tra thư mục Drive đã share — thấy file `.sql.gz` mới là thành công

### Khôi phục từ file JSON (nút trong Cài đặt)

Cài đặt → **Khôi phục từ file backup** → chọn file `.json` đã tải ở Lớp 1 → xem lại số lượng bản ghi trong màn hình xác nhận → bấm khôi phục.

Cách hoạt động: **gộp/ghi đè theo ID** (upsert), không phải xoá sạch rồi nạp lại — dữ liệu trùng ID trong file sẽ bị ghi đè bằng nội dung trong file, dữ liệu tạo **sau** thời điểm backup mà không có trong file **không** bị xoá. Không khôi phục tài khoản đăng nhập (tạo lại qua Quản lý tài khoản nếu cần). Dữ liệu mã hoá trong file được giữ nguyên dạng mã hoá khi ghi lại — không cần quan tâm tới khoá mã hoá ở bước này, app tự giải mã lại lúc hiển thị như bình thường.

### Khôi phục từ file `.sql.gz` (backup tự động) khi cần
Tải file `.sql.gz` mới nhất (từ `backups/`, tab Actions, hoặc Google Drive) → giải nén → chạy:
```powershell
psql "postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-xxx.pooler.supabase.com:5432/postgres" -f backup-2026-xx-xx.sql
```

---

## 8. Nhập hợp đồng từ file Word

Trang Hợp đồng → "📄 Nhập từ file Word" → tải `.docx` → tự trích: tên/địa chỉ/điện thoại/MST khách hàng (chỉ Bên B, bỏ qua Bên A), số HĐ, ngày bắt đầu/kết thúc → màn hình xác nhận cho sửa lại trước khi lưu.

Chỉ đọc được `.docx`. File `.doc` (Word cũ) cần Save As → .docx trước khi tải lên.

---

## 9. Migration cho database đã tạo từ trước

Chạy theo đúng thứ tự trong SQL Editor (không mất dữ liệu hiện có):

1. `migration_ghi_chu_hop_dong.sql` — ô ghi chú thứ 2 cho hợp đồng
2. `migration_auth_and_audit_log.sql` — đăng nhập + nhật ký hoạt động, siết quyền truy cập
3. `migration_admin_settings.sql` — vai trò admin, SĐT, bảng yêu cầu quên mật khẩu
4. `migration_realtime.sql` — bật realtime
5. `migration_encryption.sql` — chuẩn bị cột cho dữ liệu mã hoá
6. `migration_backup_settings.sql` — cấu hình lịch backup

Tạo database hoàn toàn mới → chỉ cần chạy `supabase_schema.sql` (đã gộp sẵn tất cả).

Sau migration 2: phải tạo ít nhất 1 tài khoản đăng nhập ngay (mục 3) — nếu không sẽ không vào được app vì RLS chặn truy cập ẩn danh.

Sau migration 3: chỉ định admin đầu tiên ngay (mục 3).

Sau migration 5: thiết lập mã hoá ngay (mục 5) — nếu không, app sẽ báo lỗi thiếu `VITE_ENCRYPTION_KEY` khi đọc/ghi hợp đồng và thanh toán.

---

## 10. Lưu ý bảo mật tổng quan

- RLS yêu cầu đăng nhập mới đọc/ghi được dữ liệu nghiệp vụ
- 2 vai trò (admin/nhân viên) chỉ khác nhau ở quyền quản lý tài khoản
- Service role key (quyền cao nhất) chỉ tồn tại trong Edge Function (server Supabase) và GitHub Secrets — không bao giờ trong code frontend
- Dữ liệu nhạy cảm mã hoá client-side — xem giới hạn ở mục 5
- Nhật ký hoạt động ghi ở tầng database (trigger), không lách được từ code frontend
