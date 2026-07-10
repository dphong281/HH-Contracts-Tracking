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
