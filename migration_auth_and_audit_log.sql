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
