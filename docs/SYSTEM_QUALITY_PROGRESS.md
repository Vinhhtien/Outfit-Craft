# Nghiệm thu task 54, 55 và 57

Cập nhật: 15/10/2026. Phạm vi đã thống nhất: desktop, xử lý lỗi/thông báo, trạng thái tải và lưu ảnh Cloudinary. Không bao gồm tối ưu mobile hay hoàn thiện task 58 (kiểm thử toàn hệ thống).

## Kết luận theo task

| Task | Kết luận | Bằng chứng |
| --- | --- | --- |
| 54 — Xử lý lỗi & thông báo | Hoàn thành trong phạm vi yêu cầu | Thông báo tiếng Việt; lỗi API có trạng thái phù hợp; không lộ chi tiết nội bộ; lỗi biểu mẫu hiện ngay tại nơi thao tác; hết phiên có thể đăng nhập lại và giữ biểu mẫu; tự lưu vị trí món đồ có bản nháp và thử lại. |
| 55 — Màn hình chờ khi tải dữ liệu | Hoàn thành trên desktop | Có loading/skeleton/progress; phân biệt tải lỗi với danh sách rỗng; thử lại được; giữ dữ liệu của lần tải thành công; hủy yêu cầu cũ; không hiển thị dữ liệu của tài khoản trước khi đổi tài khoản. |
| 57 — Lưu trữ ảnh Cloudinary | Hoàn thành | Đã kiểm tra bằng Cloudinary thật qua API ứng dụng: ảnh gốc/ảnh món đồ, thumbnail, avatar, thay ảnh và xóa ảnh; có kiểm thử tự động các lỗi upload, lưu DB và dọn ảnh. |

## Những phần hoàn thiện trong lượt này

### Task 54

- Thay việc bỏ qua lỗi tự lưu khi rời Studio bằng hàng đợi lưu vị trí/kích thước món đồ.
- Ghi bản nháp vào sessionStorage trước thời gian chờ tự lưu; bản nháp khôi phục được khi tải lại cùng tab. Khi bộ nhớ trình duyệt không dùng được, hiển thị cảnh báo giữ trang mở.
- Gửi lần lượt theo từng món đồ, giữ bản chỉnh mới nhất khi yêu cầu trước đang chạy; chỉ xóa bản nháp sau khi lưu thành công.
- Lỗi tự lưu vẫn hiển thị sau khi chuyển trang, có nút “Thử lưu lại”; thử lại khi có mạng hoặc đăng nhập lại. Bản nháp được tách theo tài khoản, không gửi dưới phiên của người khác.
- Cảnh báo trước khi đóng/tải lại trang nếu còn thay đổi chưa lưu. Đóng hẳn tab có thể làm mất sessionStorage; không cam kết khôi phục sau khi người dùng bỏ qua cảnh báo và đóng tab.
- Hiển thị lỗi lưu/xóa số đo ngay trong hộp thoại. Chặn gửi trùng và đóng bằng nút Hủy khi đang lưu số đo.

### Task 55

- Giữ các trạng thái tải, khung chờ danh sách, tiến độ upload và thao tác thử lại.
- Bổ sung tách dữ liệu đang hiển thị theo tài khoản để dữ liệu cũ không lóe lên trong lúc tài khoản mới đang tải.
- Xác nhận bằng trình duyệt rằng tải chậm có skeleton, tải lỗi có thử lại và không bị hiểu nhầm là tủ đồ rỗng; kết quả tìm kiếm cũ không ghi đè kết quả mới.
- Tách bài kiểm tra mobile thành bài riêng có nhãn `@mobile`; không xóa hoặc nới lỏng điều kiện kiểm tra mobile. `test:desktop` chỉ chạy phạm vi desktop đã yêu cầu.

### Task 57

- Ghi công việc dọn ảnh cũ vào MongoDB trước khi thay/xóa tham chiếu trong dữ liệu. Nếu tiến trình dừng giữa hai bước, công việc còn lại để xử lý sau.
- Nếu không ghi được công việc dọn ảnh, dừng thao tác trước khi xóa dữ liệu; giữ nguyên bản ghi và ảnh.
- Chỉ xóa ảnh không còn được món đồ, outfit hoặc avatar tham chiếu; giữ ảnh cũ nếu lưu dữ liệu mới thất bại.
- Khởi động backend chờ tạo chỉ mục hàng đợi dọn ảnh. Công việc dự phòng chờ 24 giờ; dọn ngay sau thao tác thành công, lỗi nhà cung cấp được thử lại với thời gian chờ tăng dần.
- Bổ sung kiểm thử avatar: upload thất bại, DB thất bại, thay ảnh thành công và dọn ảnh cũ.
- Có lệnh xác minh Cloudinary thật dùng ảnh tự tạo và MongoDB tạm; không kết nối DB dự án, không sử dụng hoặc sửa ảnh người dùng có sẵn.

## Kết quả kiểm tra ngày 15/10/2026

- Backend: **21/21 đạt**; TypeScript build đạt.
- Frontend: **13/13 đạt**; ESLint, kiểm tra kiểu và build production đạt.
- Edge desktop: **7/7 đạt**, tiến trình kiểm thử trả mã thành công; mobile không nằm trong lần chạy này.
- Cloudinary thật: **đạt** cả 5 nhóm kiểm tra: tải/đọc hai ảnh món đồ; gửi lại không tạo trùng; thay thumbnail; thay avatar; xóa ảnh món đồ và thumbnail.
- Các ảnh kiểm thử Cloudinary đã được dọn sạch sau khi chạy.

## Chạy lại kiểm tra

Trong `server`:

```text
npm test
npm run build
npm run test:cloudinary
```

`test:cloudinary` cần cấu hình Cloudinary hợp lệ trong `.env` và kết nối Internet. Lệnh tạo ảnh nhỏ riêng để kiểm tra rồi xóa chúng. MongoDB dùng riêng bản tạm của bộ kiểm thử.

Trong `client`:

```text
npm test
npm run lint
npm run typecheck
npm run build
npm run test:desktop
```

Kiểm thử trình duyệt dùng Edge, cổng 3100 và API giả lập. Nếu môi trường cần tự quản lý máy chủ kiểm thử: chạy Next với `NEXT_PUBLIC_API_URL=http://127.0.0.1:5100/api` ở cổng 3100, rồi đặt `PLAYWRIGHT_EXTERNAL_SERVER=1` khi chạy Playwright. Không dùng cờ này với một máy chủ không rõ cấu hình.

## Ghi chú tích hợp

- Luồng thêm món đồ dùng `POST /items/with-images` với metadata, hai ảnh và `creationKey` giữ nguyên khi thử lại.
- Luồng hai bước cũ `POST /items/upload` → `POST /items` yêu cầu biên nhận ký số khớp ảnh và chủ sở hữu.
- Bảng Google Sheets chưa được sửa; trạng thái trên bảng cần được đối chiếu với kết quả nghiệm thu trong tài liệu này.

## Ngoài phạm vi lần này

- Lỗi bố cục mobile và kiểm thử đầy đủ mọi kích thước màn hình.
- Task 58: kiểm thử toàn hệ thống, email/OTP thật, thời tiết thật, tách nền thật và các luồng nghiệp vụ khác.
- Vấn đề ghi nhận mặc đồng thời của lịch vẫn thuộc danh sách cần xử lý riêng; không dùng kết quả task 54/55/57 để kết luận toàn dự án đã hết lỗi.
