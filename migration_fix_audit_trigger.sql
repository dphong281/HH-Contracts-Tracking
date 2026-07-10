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
