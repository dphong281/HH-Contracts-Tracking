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
