# Deploy OutfitCraft lên Vercel + MongoDB Atlas

Cả client và server đều chạy trên Vercel (gói Hobby miễn phí), database dùng MongoDB Atlas (gói M0 miễn phí).

```
Trình duyệt ──► Vercel project "outfitcraft-client"  (thư mục client/, Next.js)
                     │  NEXT_PUBLIC_API_URL
                     ▼
               Vercel project "outfitcraft-server"  (thư mục server/, Express chạy serverless)
                     │  MONGO_URI
                     ▼
               MongoDB Atlas (Singapore)      + Cloudinary, Gemini, OpenWeather, Gmail, Decart (giữ nguyên key)
```

Chạy trên máy (`npm run dev`) không thay đổi gì: vẫn dùng `server/.env`, MongoDB local và cứ 60 giây dọn ảnh lỗi như cũ.

---

## Bước 1. Tạo database trên MongoDB Atlas

1. Đăng ký hoặc đăng nhập tại https://cloud.mongodb.com.
2. **Create cluster** → chọn **M0 (Free)**, nhà cung cấp **AWS**, khu vực **Singapore (ap-southeast-1)**.
   Server trên Vercel cũng chạy ở Singapore (`sin1`), nên hai bên ở gần nhau thì app nhanh hơn.
3. **Database Access** → **Add New Database User**: đặt tên và mật khẩu (chỉ dùng chữ và số để khỏi phải mã hoá ký tự đặc biệt trong chuỗi kết nối). Quyền: *Read and write to any database*.
4. **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`).
   Vercel không có IP cố định nên bắt buộc phải mở như vậy; database vẫn được bảo vệ bằng user và mật khẩu ở bước 3.
5. **Connect** → **Drivers** → copy chuỗi kết nối, rồi **thêm tên database `outfitcraft`** ngay trước dấu `?`:
   ```
   mongodb+srv://<user>:<mật khẩu>@<cluster>.mongodb.net/outfitcraft?retryWrites=true&w=majority
   ```
   Chuỗi này là `MONGO_URI` dùng ở các bước sau. Không commit chuỗi này lên git.

## Bước 2. Chuyển dữ liệu từ máy lên Atlas

Ảnh nằm trên Cloudinary, database chỉ lưu đường link, nên chuyển database xong là ảnh vẫn hiện bình thường. Mật khẩu người dùng đã được mã hoá nên giữ nguyên, mọi người đăng nhập như cũ.

**Cách A: MongoDB Compass** (giao diện, dễ nhất)
1. Mở Compass, kết nối `mongodb://127.0.0.1:27017`, vào database `outfitcraft`.
2. Với từng collection: **Export Data** → **Export the full collection** → định dạng **JSON**.
3. Mở kết nối mới tới Atlas (dán `MONGO_URI` ở bước 1), tạo database `outfitcraft`.
4. Tạo từng collection cùng tên, rồi **Add Data** → **Import JSON or CSV file** → chọn file vừa export.

**Cách B: MongoDB Database Tools** (dòng lệnh, chuyển một lần cả database)
Cài [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools), rồi chạy:
```
mongodump --uri "mongodb://127.0.0.1:27017/outfitcraft" --out dump
mongorestore --uri "<MONGO_URI ở bước 1>" dump
```

Index (ví dụ index tìm kiếm theo tên món đồ) sẽ được server tự tạo lại trong lần chạy đầu tiên.

## Bước 3. Deploy server

1. Đăng nhập https://vercel.com bằng tài khoản GitHub có quyền với repo `Vinhhtien/Outfit-Craft`.
2. **Add New → Project** → chọn repo **Outfit-Craft** → **Import**.
3. Cấu hình:
   - **Project Name**: `outfitcraft-server`
   - **Root Directory**: `server`
   - **Framework Preset**: `Other`. Lệnh build đã khai báo sẵn trong `server/vercel.json`, không cần điền.
4. Mở **Environment Variables** và thêm các biến dưới đây. Giá trị lấy từ `server/.env` trên máy, trừ những dòng ghi khác:

   | Biến | Giá trị |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGO_URI` | Chuỗi Atlas ở bước 1 |
   | `JWT_SECRET` | Chuỗi ngẫu nhiên **mới**, dài từ 32 ký tự trở lên (đừng dùng lại chuỗi trên máy) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `CLIENT_ORIGIN` | Tạm điền `http://localhost:3000`, sửa lại ở bước 5 |
   | `FRONTEND_URL` | Tạm điền `http://localhost:3000`, sửa lại ở bước 5 |
   | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Như trên máy |
   | `OPENWEATHER_API_KEY` | Như trên máy |
   | `GEMINI_API_KEY` (và `GEMINI_MODEL` nếu có dùng) | Như trên máy |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Như trên máy |
   | `DECART_API_KEY`, `TRYON_MAX_SESSION_SECONDS`, `TRYON_DAILY_SECONDS` | Như trên máy |
   | `CRON_SECRET` | Chuỗi ngẫu nhiên mới. Vercel Cron dùng nó để gọi việc dọn ảnh mỗi ngày |
   | `SEED_DEMO_ADMIN` | `false` |

5. **Deploy**. Xong thì mở `https://<tên-server>.vercel.app/api/health`, phải thấy `"OutfitCraft API dang chay"`.

> **Nhánh nào được deploy?** Vercel mặc định deploy nhánh `main`. Nếu code deploy chưa được merge vào `main`, vào **Settings → Git → Production Branch** đổi thành `deploy-vercel`; merge xong thì đổi lại `main`.

## Bước 4. Deploy client

1. **Add New → Project** → chọn lại repo **Outfit-Craft**.
2. Cấu hình:
   - **Project Name**: `outfitcraft-client`
   - **Root Directory**: `client`
   - **Framework Preset**: `Next.js` (Vercel tự nhận)
3. **Environment Variables**:

   | Biến | Giá trị |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://<tên-server>.vercel.app/api` (có `/api` ở cuối) |

4. **Deploy**. Ghi lại link client, ví dụ `https://outfitcraft-client.vercel.app`.

## Bước 5. Nối server với client

1. Vào project **outfitcraft-server** → **Settings → Environment Variables**, sửa:
   - `CLIENT_ORIGIN` = link client, **không có dấu `/` ở cuối**, ví dụ `https://outfitcraft-client.vercel.app`
   - `FRONTEND_URL` = cùng link đó (dùng cho link đặt lại mật khẩu trong email)
2. **Deployments** → bản mới nhất → **⋯ → Redeploy** để server nhận giá trị mới.

`CLIENT_ORIGIN` quyết định trình duyệt nào được gọi API (CORS) và cũng là origin được phép mở phiên thử đồ trực tiếp với Decart. Điền sai thì client sẽ báo lỗi mạng.

## Bước 6. Kiểm tra sau khi deploy

- [ ] Đăng nhập bằng một tài khoản đã có (dữ liệu chuyển từ máy lên)
- [ ] Tủ đồ: thêm món mới, ảnh được tách nền, AI gợi ý thông tin
- [ ] Phối đồ: thêm món, đổi món trong ô, lưu outfit
- [ ] Gợi ý: hiện thời tiết và trang phục; AI Stylist trả lời
- [ ] Hồ sơ: đổi ảnh đại diện
- [ ] Quên mật khẩu: nhận được email, bấm link mở đúng trang trên Vercel
- [ ] Thử đồ trực tiếp (cần tài khoản Decart còn credit)
- [ ] Trang quản trị với tài khoản admin

## Giới hạn khi chạy trên Vercel

- **Mỗi ảnh upload tối đa 4MB** (Vercel giới hạn mỗi request 4,5MB). Client đã tự thu nhỏ ảnh món đồ, wishlist và ảnh đại diện trước khi gửi nên thường chỉ vài trăm KB.
- **Dọn ảnh Cloudinary bị lỗi chạy 1 lần mỗi ngày** lúc 3h sáng UTC (Vercel Cron), thay vì mỗi 60 giây như khi chạy trên máy.
- Request đầu tiên sau một lúc không ai dùng có thể chậm khoảng 1 giây vì server phải khởi động và kết nối database.
- Chống spam (rate limit) đếm riêng trên từng instance của Vercel, nên lỏng hơn khi chạy trên máy.

## Khi deploy bị lỗi

- **Bản mới chạy lỗi:** trên Vercel → **Deployments** → chọn bản chạy tốt trước đó → **⋯ → Promote to Production** (hoặc **Instant Rollback**).
- **Xem lỗi:** Vercel → project server → **Logs**. Lỗi `503 Máy chủ đang khởi động hoặc mất kết nối cơ sở dữ liệu` thường do `MONGO_URI` sai hoặc chưa mở Network Access ở Atlas.
- **Quay lại code trước khi sửa để deploy:** tag git `before-deploy` trỏ về bản trước khi thêm cấu hình Vercel.

## Các file liên quan

| File | Vai trò |
|---|---|
| `server/vercel.json` | Lệnh build, khu vực Singapore, chuyển mọi request vào hàm serverless, lịch Cron |
| `server/api/index.js` | Cửa vào của Vercel, dùng bản đã build trong `dist/` |
| `server/src/vercel.ts` | Hàm serverless: chuẩn bị server (một lần) rồi giao request cho Express |
| `server/src/bootstrap.ts` | Các bước khởi động dùng chung cho local và Vercel |
| `server/src/routes/cron.routes.ts` | Đường dẫn Cron dọn ảnh, có kiểm tra `CRON_SECRET` |
