# Quản trị OutfitCraft

Trang `/admin` dùng chung đăng nhập và phong cách với trang chủ: xanh rêu, nền kem, xanh lá nhạt, kiểu chữ và nút bo tròn.

## Tài khoản mẫu tự động (development)

Khi chạy backend ở `NODE_ENV=development`, ứng dụng tự tạo tài khoản:

- Email: `admin@outfitcraft.local`
- Mật khẩu: `OutfitCraft@123`
- Đã xác thực email và có quyền admin, dùng chung trang `/login`, sau đó vào `/admin`.

Chỉ tạo khi email chưa tồn tại; các lần khởi động sau không đặt lại mật khẩu, quyền hoặc trạng thái khóa. Không tự nâng quyền tài khoản đã tồn tại trùng email. Đặt `SEED_DEMO_ADMIN=false` để tắt tạo tự động. `NODE_ENV=production` luôn tắt cơ chế này. Việc tắt không xóa tài khoản đã tạo; trước khi triển khai công khai cần đổi mật khẩu hoặc xóa tài khoản demo. Có thể chạy `npm run admin:demo` để tạo ngay mà không khởi động server.

## Cấp quyền cho tài khoản riêng

1. Chạy backend và frontend như README.
2. Đăng ký một tài khoản, xác thực email.
3. Trong thư mục `server`, chạy `npm run admin:grant -- email-cua-ban@example.com` với email thật của tài khoản vừa tạo. Lệnh sử dụng database được cấu hình trong `.env`; chỉ người vận hành dự án chạy lệnh này.
4. Đăng nhập lại, bấm biểu tượng khiên trên thanh điều hướng hoặc vào `/admin`.

Không có API tự cấp quyền admin.

## Phạm vi

1. Bảo vệ giao diện và API theo quyền admin.
2. Tổng số người dùng, món đồ, outfit, tài khoản bị khóa.
3. Danh sách người dùng có phân trang.
4. Tìm theo tên/email, lọc trạng thái.
5. Xem hồ sơ cơ bản và số lượng món đồ/outfit; không đọc hồ sơ cơ thể.
6. Khóa/mở khóa kèm lý do. Chặn cả đăng nhập mới và các API dùng token cũ. Tài khoản admin không bị khóa qua giao diện này.
7. Xem bảy danh mục và số món đồ thuộc từng danh mục (gồm cả món lưu trữ).
8. Sửa tên, thứ tự lớp, nhiệt độ mặc định. Không thêm/xóa danh mục. Tên hiển thị được tải khi mở ứng dụng; tải lại trang để nhận chỉnh sửa từ admin khác. Lớp áp dụng khi thêm đồ vào Studio, không xếp lại outfit đã lưu. Nhiệt độ áp dụng cho món mới khi không gửi khoảng nhiệt độ riêng.
9. Tìm, lọc, xem thumbnail và ẩn/hiện outfit công khai. Trạng thái kiểm duyệt độc lập với `isPublic`; chủ sở hữu không thể tự xóa cờ kiểm duyệt qua API sửa outfit. Outfit bị ẩn bị loại khỏi feed và chặn người khác đọc trực tiếp. Chủ vẫn xem/sửa được outfit của mình.
10. Nhật ký admin kèm thời điểm, lý do, thay đổi trước/sau và trạng thái. Ghi ý định trước khi cập nhật; nếu tiến trình dừng giữa chừng, bản ghi có thể còn ở trạng thái chưa xác nhận. Chưa có cơ chế giao dịch nguyên tử giữa bản ghi nghiệp vụ và nhật ký.

## Kiểm thử

- Backend: `npm run lint`, `npm test` (dùng MongoDB tạm, không dùng dữ liệu thật).
- Frontend: `npm run typecheck`, `npm run lint`, `npm test`.
- Giao diện admin: `npm run test:e2e -- e2e/admin.spec.mjs` (API mô phỏng; kiểm thử backend riêng xác minh phân quyền và dữ liệu).

Không bao gồm phân tích nâng cao, quản lý dịch vụ, ticket hỗ trợ, thanh toán hay cấu hình AI.
