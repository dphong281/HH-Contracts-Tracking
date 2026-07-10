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
