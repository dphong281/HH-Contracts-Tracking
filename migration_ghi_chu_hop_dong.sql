-- Chạy đoạn này trong Supabase SQL Editor nếu bạn ĐÃ tạo database từ trước
-- (không ảnh hưởng dữ liệu hiện có)
--
-- Tự nhận diện 2 trường hợp:
-- 1. Nếu bạn đã chạy migration cũ (cột tên "ghi_chu_noi_bo") -> đổi tên cột
-- 2. Nếu chưa có cột nào -> thêm mới cột "ghi_chu_hop_dong"

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'hop_dong_dau_ra' and column_name = 'ghi_chu_noi_bo'
  ) then
    alter table hop_dong_dau_ra rename column ghi_chu_noi_bo to ghi_chu_hop_dong;
  elsif not exists (
    select 1 from information_schema.columns
    where table_name = 'hop_dong_dau_ra' and column_name = 'ghi_chu_hop_dong'
  ) then
    alter table hop_dong_dau_ra add column ghi_chu_hop_dong text;
  end if;
end $$;
