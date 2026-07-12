-- ============================================
-- MIGRATION: Tự động cập nhật updated_at mỗi khi sửa bản ghi
-- Dùng cho tính năng "khoá đồng thời" — phát hiện khi 2 người cùng sửa
-- 1 bản ghi cùng lúc, tránh ghi đè âm thầm.
-- ============================================

create or replace function fn_bump_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bump_updated_at on hop_dong_dau_ra;
create trigger trg_bump_updated_at before update on hop_dong_dau_ra
  for each row execute function fn_bump_updated_at();

drop trigger if exists trg_bump_updated_at on khach_hang;
create trigger trg_bump_updated_at before update on khach_hang
  for each row execute function fn_bump_updated_at();
