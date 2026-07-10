-- ============================================
-- SCHEMA: Theo dõi Hợp đồng Đầu ra (QLHD)
-- Chạy toàn bộ file này trong Supabase SQL Editor
-- ============================================

-- 1. KHÁCH HÀNG
create table if not exists khach_hang (
  id uuid primary key default gen_random_uuid(),
  ten_khach_hang text not null,
  phan_loai text check (phan_loai in ('DL', 'MB', 'TNPP', 'TTTT')),
  dia_chi text,
  so_dien_thoai text,
  email text,
  ma_so_thue text,
  ghi_chu text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. NHÂN VIÊN PHỤ TRÁCH
create table if not exists nhan_vien (
  id uuid primary key default gen_random_uuid(),
  ho_ten text not null,
  chuc_vu text,
  so_dien_thoai text,
  email text,
  dang_hoat_dong boolean default true,
  created_at timestamptz default now()
);

-- 3. HỢP ĐỒNG
create table if not exists hop_dong_dau_ra (
  id uuid primary key default gen_random_uuid(),
  khach_hang_id uuid references khach_hang(id) on delete restrict,
  nhan_vien_id uuid references nhan_vien(id) on delete set null,
  so_hop_dong text unique not null,
  ngay_bat_dau date,
  ngay_ket_thuc date,
  gia_tri_hop_dong text,
  trang_thai text default 'dang_hieu_luc' check (trang_thai in ('dang_hieu_luc', 'het_han', 'da_thanh_ly')),
  ghi_chu text,
  ghi_chu_hop_dong text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. PHỤ LỤC HỢP ĐỒNG
create table if not exists phu_luc_hop_dong (
  id uuid primary key default gen_random_uuid(),
  hop_dong_id uuid references hop_dong_dau_ra(id) on delete cascade,
  ten_phu_luc text not null,
  noi_dung text,
  ngay_hieu_luc date,
  file_dinh_kem text,
  created_at timestamptz default now()
);

-- 5. THANH TOÁN / CÔNG NỢ
create table if not exists thanh_toan (
  id uuid primary key default gen_random_uuid(),
  hop_dong_id uuid references hop_dong_dau_ra(id) on delete cascade,
  ngay_thanh_toan date not null default current_date,
  so_tien text not null,
  hinh_thuc text,
  ghi_chu text,
  created_at timestamptz default now()
);

-- 6. INDEX
create index if not exists idx_kh_ten on khach_hang(ten_khach_hang);
create index if not exists idx_kh_phan_loai on khach_hang(phan_loai);
create index if not exists idx_hd_khach_hang on hop_dong_dau_ra(khach_hang_id);
create index if not exists idx_hd_nhan_vien on hop_dong_dau_ra(nhan_vien_id);
create index if not exists idx_hd_ngay_ket_thuc on hop_dong_dau_ra(ngay_ket_thuc);
create index if not exists idx_pl_hop_dong on phu_luc_hop_dong(hop_dong_id);
create index if not exists idx_tt_hop_dong on thanh_toan(hop_dong_id);

-- 7. (Không còn view v_hop_dong_cong_no ở đây — gia_tri_hop_dong/so_tien được mã hoá
--    ở phía app nên SQL không SUM() trực tiếp được nữa. Công nợ được tính trong
--    JavaScript sau khi giải mã, xem hàm getCongNoList() trong src/lib/queries.js)

-- 8. RLS - mở tạm cho MVP (chưa có auth). Siết lại sau khi thêm đăng nhập.
alter table khach_hang enable row level security;
alter table nhan_vien enable row level security;
alter table hop_dong_dau_ra enable row level security;
alter table phu_luc_hop_dong enable row level security;
alter table thanh_toan enable row level security;

drop policy if exists "allow all for now" on khach_hang;
drop policy if exists "allow all for now" on nhan_vien;
drop policy if exists "allow all for now" on hop_dong_dau_ra;
drop policy if exists "allow all for now" on phu_luc_hop_dong;
drop policy if exists "allow all for now" on thanh_toan;

create policy "allow all for now" on khach_hang for all using (true) with check (true);
create policy "allow all for now" on nhan_vien for all using (true) with check (true);
create policy "allow all for now" on hop_dong_dau_ra for all using (true) with check (true);
create policy "allow all for now" on phu_luc_hop_dong for all using (true) with check (true);
create policy "allow all for now" on thanh_toan for all using (true) with check (true);
-- ============================================
-- MIGRATION: Đăng nhập (Auth) + Nhật ký hoạt động (Audit log)
-- Chạy sau khi đã có schema chính (supabase_schema.sql)
-- ============================================

-- 1. BẢNG TÀI KHOẢN — liên kết 1-1 với auth.users của Supabase
create table if not exists tai_khoan (
  id uuid primary key references auth.users(id) on delete cascade,
  ho_ten text not null,
  email text,
  created_at timestamptz default now()
);

alter table tai_khoan enable row level security;

drop policy if exists "xem tat ca tai khoan" on tai_khoan;
create policy "xem tat ca tai khoan" on tai_khoan for select using (auth.role() = 'authenticated');

drop policy if exists "tu sua tai khoan cua minh" on tai_khoan;
create policy "tu sua tai khoan cua minh" on tai_khoan for update using (auth.uid() = id);

-- 2. TRIGGER: tự động tạo hồ sơ tai_khoan khi có user đăng ký/được tạo mới
-- (Bạn tạo user ở Supabase Dashboard → Authentication → Add user,
--  hồ sơ tai_khoan sẽ tự sinh ra, lấy tên từ phần trước @ của email)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tai_khoan (id, ho_ten, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'ho_ten', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. BẢNG NHẬT KÝ HOẠT ĐỘNG
create table if not exists nhat_ky_hoat_dong (
  id bigint generated always as identity primary key,
  bang text not null,
  hanh_dong text not null,
  ban_ghi_id uuid,
  nguoi_thuc_hien uuid references auth.users(id),
  ten_nguoi_thuc_hien text,
  du_lieu_truoc jsonb,
  du_lieu_sau jsonb,
  mo_ta text,
  created_at timestamptz default now()
);

create index if not exists idx_nkhd_created on nhat_ky_hoat_dong(created_at desc);
create index if not exists idx_nkhd_bang on nhat_ky_hoat_dong(bang);
create index if not exists idx_nkhd_nguoi on nhat_ky_hoat_dong(nguoi_thuc_hien);

alter table nhat_ky_hoat_dong enable row level security;

drop policy if exists "xem nhat ky" on nhat_ky_hoat_dong;
create policy "xem nhat ky" on nhat_ky_hoat_dong for select using (auth.role() = 'authenticated');
-- Cố tình KHÔNG cho insert/update/delete trực tiếp từ client —
-- chỉ trigger (chạy quyền definer) mới được ghi vào bảng này.

-- 4. TRIGGER FUNCTION dùng chung để ghi nhật ký cho các bảng nghiệp vụ
-- ============================================
-- FIX: hàm fn_ghi_nhat_ky() bị lỗi khi xoá/sửa vì CASE kiểm tra chéo field
-- trên kiểu RECORD (old/new). Đổi sang IF/ELSIF để mỗi nhánh chạy độc lập.
-- An toàn để chạy nhiều lần (CREATE OR REPLACE).
-- ============================================

create or replace function fn_ghi_nhat_ky()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ten text;
  v_mo_ta text;
  v_ban_ghi_id uuid;
  v_nhan_dang text := '';
  v_ten_bang text;
begin
  select ho_ten into v_ten from tai_khoan where id = auth.uid();

  if tg_op = 'DELETE' then
    v_ban_ghi_id := old.id;
  else
    v_ban_ghi_id := new.id;
  end if;

  if tg_table_name = 'hop_dong_dau_ra' then
    v_ten_bang := 'hợp đồng';
    if tg_op = 'DELETE' then
      v_nhan_dang := coalesce(old.so_hop_dong, '');
    else
      v_nhan_dang := coalesce(new.so_hop_dong, '');
    end if;
  elsif tg_table_name = 'khach_hang' then
    v_ten_bang := 'khách hàng';
    if tg_op = 'DELETE' then
      v_nhan_dang := coalesce(old.ten_khach_hang, '');
    else
      v_nhan_dang := coalesce(new.ten_khach_hang, '');
    end if;
  elsif tg_table_name = 'nhan_vien' then
    v_ten_bang := 'nhân viên';
    if tg_op = 'DELETE' then
      v_nhan_dang := coalesce(old.ho_ten, '');
    else
      v_nhan_dang := coalesce(new.ho_ten, '');
    end if;
  elsif tg_table_name = 'thanh_toan' then
    v_ten_bang := 'thanh toán';
    v_nhan_dang := 'khoản thanh toán';
  elsif tg_table_name = 'phu_luc_hop_dong' then
    v_ten_bang := 'phụ lục';
    if tg_op = 'DELETE' then
      v_nhan_dang := coalesce(old.ten_phu_luc, '');
    else
      v_nhan_dang := coalesce(new.ten_phu_luc, '');
    end if;
  else
    v_ten_bang := tg_table_name;
  end if;

  v_mo_ta := coalesce(v_ten, 'Người dùng đã xoá') || ' ' ||
    (case tg_op
      when 'INSERT' then 'đã thêm'
      when 'UPDATE' then 'đã cập nhật'
      when 'DELETE' then 'đã xoá'
    end) || ' ' || v_ten_bang ||
    (case when v_nhan_dang <> '' then ' "' || v_nhan_dang || '"' else '' end);

  insert into nhat_ky_hoat_dong
    (bang, hanh_dong, ban_ghi_id, nguoi_thuc_hien, ten_nguoi_thuc_hien, du_lieu_truoc, du_lieu_sau, mo_ta)
  values (
    tg_table_name,
    tg_op,
    v_ban_ghi_id,
    auth.uid(),
    v_ten,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    v_mo_ta
  );

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

drop trigger if exists trg_log_khach_hang on khach_hang;
create trigger trg_log_khach_hang after insert or update or delete on khach_hang
  for each row execute function fn_ghi_nhat_ky();

drop trigger if exists trg_log_nhan_vien on nhan_vien;
create trigger trg_log_nhan_vien after insert or update or delete on nhan_vien
  for each row execute function fn_ghi_nhat_ky();

drop trigger if exists trg_log_hop_dong on hop_dong_dau_ra;
create trigger trg_log_hop_dong after insert or update or delete on hop_dong_dau_ra
  for each row execute function fn_ghi_nhat_ky();

drop trigger if exists trg_log_phu_luc on phu_luc_hop_dong;
create trigger trg_log_phu_luc after insert or update or delete on phu_luc_hop_dong
  for each row execute function fn_ghi_nhat_ky();

drop trigger if exists trg_log_thanh_toan on thanh_toan;
create trigger trg_log_thanh_toan after insert or update or delete on thanh_toan
  for each row execute function fn_ghi_nhat_ky();

-- 5. SIẾT LẠI RLS — chỉ người đã đăng nhập mới đọc/ghi được dữ liệu nghiệp vụ
-- (Trước đây đang mở "allow all" cho MVP chưa có đăng nhập)

drop policy if exists "allow all for now" on khach_hang;
drop policy if exists "allow all for now" on nhan_vien;
drop policy if exists "allow all for now" on hop_dong_dau_ra;
drop policy if exists "allow all for now" on phu_luc_hop_dong;
drop policy if exists "allow all for now" on thanh_toan;

drop policy if exists "chi nguoi da dang nhap" on khach_hang;
create policy "chi nguoi da dang nhap" on khach_hang for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "chi nguoi da dang nhap" on nhan_vien;
create policy "chi nguoi da dang nhap" on nhan_vien for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "chi nguoi da dang nhap" on hop_dong_dau_ra;
create policy "chi nguoi da dang nhap" on hop_dong_dau_ra for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "chi nguoi da dang nhap" on phu_luc_hop_dong;
create policy "chi nguoi da dang nhap" on phu_luc_hop_dong for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "chi nguoi da dang nhap" on thanh_toan;
create policy "chi nguoi da dang nhap" on thanh_toan for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
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
-- ============================================
-- MIGRATION: Bật Realtime cho các bảng nghiệp vụ
-- Giúp app tự cập nhật khi có người khác thêm/sửa/xoá dữ liệu,
-- không cần F5 lại trang.
-- ============================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'khach_hang', 'nhan_vien', 'hop_dong_dau_ra',
    'phu_luc_hop_dong', 'thanh_toan', 'nhat_ky_hoat_dong'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
-- ============================================
-- MIGRATION: Chuẩn bị cột cho dữ liệu mã hoá
-- Các trường text (dia_chi, so_dien_thoai, ma_so_thue, email) không cần đổi gì —
-- chỉ 2 trường dạng số (gia_tri_hop_dong, so_tien) cần đổi sang text để chứa
-- được chuỗi đã mã hoá (dạng base64).
-- ============================================

-- View cũ tính công nợ trực tiếp bằng SQL SUM() trên cột số — không còn dùng được
-- vì cột đã đổi sang text (chứa dữ liệu mã hoá). Việc tính công nợ giờ chuyển sang
-- phía app (giải mã xong mới cộng trong JavaScript) — xem hàm getCongNoList().
drop view if exists v_hop_dong_cong_no;

alter table hop_dong_dau_ra alter column gia_tri_hop_dong type text using gia_tri_hop_dong::text;
alter table hop_dong_dau_ra alter column gia_tri_hop_dong drop default;

alter table thanh_toan alter column so_tien type text using so_tien::text;

-- Sau khi chạy xong migration này, đăng nhập vào app bằng tài khoản ADMIN,
-- vào Cài đặt → mục "Mã hoá dữ liệu cũ" → bấm chạy 1 lần để mã hoá toàn bộ
-- dữ liệu hiện có (dữ liệu tạo mới sau migration này đã tự động mã hoá rồi,
-- bước này chỉ cần cho dữ liệu tạo TRƯỚC khi bật tính năng mã hoá).
-- ============================================
-- MIGRATION: Cấu hình lịch sao lưu (số ngày admin tự đặt trong Cài đặt)
-- ============================================

-- Bảng chỉ có đúng 1 dòng (dùng mẹo id boolean, chỉ chấp nhận giá trị true)
create table if not exists cai_dat_he_thong (
  id boolean primary key default true,
  backup_interval_days int not null default 7 check (backup_interval_days > 0),
  backup_last_run_at timestamptz,
  updated_at timestamptz default now(),
  constraint chi_1_dong check (id)
);

insert into cai_dat_he_thong (id) values (true) on conflict (id) do nothing;

alter table cai_dat_he_thong enable row level security;

drop policy if exists "xem cai dat" on cai_dat_he_thong;
create policy "xem cai dat" on cai_dat_he_thong for select
  using (auth.role() = 'authenticated');

drop policy if exists "admin sua cai dat" on cai_dat_he_thong;
create policy "admin sua cai dat" on cai_dat_he_thong for update
  using (exists (select 1 from tai_khoan where id = auth.uid() and vai_tro = 'admin'));

-- Lưu ý: GitHub Actions cập nhật backup_last_run_at bằng service role key
-- (bỏ qua RLS), nên không cần thêm policy riêng cho việc đó.
