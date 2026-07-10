-- ============================================
-- MIGRATION: Vai trò admin + Yêu cầu quên mật khẩu
-- Chạy sau migration_auth_and_audit_log.sql
-- ============================================

-- 1. Thêm số điện thoại + vai trò vào tai_khoan
alter table tai_khoan add column if not exists so_dien_thoai text;
alter table tai_khoan add column if not exists vai_tro text default 'nhan_vien'
  check (vai_tro in ('admin', 'nhan_vien'));

-- 2. Cho phép admin sửa tai_khoan của người khác (không chỉ của chính mình)
drop policy if exists "tu sua tai khoan cua minh" on tai_khoan;
drop policy if exists "sua tai khoan" on tai_khoan;
create policy "sua tai khoan" on tai_khoan for update
  using (
    auth.uid() = id
    or exists (select 1 from tai_khoan tk2 where tk2.id = auth.uid() and tk2.vai_tro = 'admin')
  );

-- 3. Bảng yêu cầu hỗ trợ (hiện chỉ dùng cho "quên mật khẩu")
create table if not exists yeu_cau_ho_tro (
  id uuid primary key default gen_random_uuid(),
  loai text default 'quen_mat_khau' check (loai in ('quen_mat_khau')),
  email text not null,
  so_dien_thoai text not null,
  ghi_chu text,
  trang_thai text default 'cho_xu_ly' check (trang_thai in ('cho_xu_ly', 'da_xu_ly')),
  created_at timestamptz default now(),
  xu_ly_boi uuid references auth.users(id),
  xu_ly_luc timestamptz
);

alter table yeu_cau_ho_tro enable row level security;

-- Ai cũng gửi được yêu cầu (kể cả chưa đăng nhập — vì quên mật khẩu thì đâu đăng nhập được)
drop policy if exists "ai cung gui duoc yeu cau" on yeu_cau_ho_tro;
create policy "ai cung gui duoc yeu cau" on yeu_cau_ho_tro for insert
  with check (true);

-- Chỉ admin xem/xử lý được danh sách yêu cầu
drop policy if exists "chi admin xem yeu cau" on yeu_cau_ho_tro;
create policy "chi admin xem yeu cau" on yeu_cau_ho_tro for select
  using (exists (select 1 from tai_khoan where id = auth.uid() and vai_tro = 'admin'));

drop policy if exists "chi admin cap nhat yeu cau" on yeu_cau_ho_tro;
create policy "chi admin cap nhat yeu cau" on yeu_cau_ho_tro for update
  using (exists (select 1 from tai_khoan where id = auth.uid() and vai_tro = 'admin'));

-- 4. QUAN TRỌNG: chỉ định tài khoản admin đầu tiên (đổi email cho đúng tài khoản của bạn)
-- update tai_khoan set vai_tro = 'admin' where email = 'email-cua-ban@vidu.com';
