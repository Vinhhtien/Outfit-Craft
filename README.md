# OutfitCraft

Nền tảng web giúp số hóa tủ quần áo: upload ảnh → tách nền tự động → kéo-thả phối đồ trên canvas → gợi ý trang phục theo thời tiết.

> Đồ án môn WDP — FPT University

---

## Tech stack

| Tầng | Công nghệ |
|------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Canvas | Fabric.js v6 |
| Tách nền | `@imgly/background-removal` (chạy client-side bằng WASM) |
| Backend | Node.js, Express 4, TypeScript |
| Database | MongoDB + Mongoose 8 |
| Lưu ảnh | Cloudinary |
| Thời tiết | OpenWeatherMap API |
| Stylist ảo | Google Gemini API (có fallback rule-based) |

---

## Cấu trúc thư mục

```
Project/
├── client/                  # Next.js frontend
│   └── src/
│       ├── app/             # Các trang (App Router)
│       │   ├── login/  register/
│       │   ├── wardrobe/    # Quản lý tủ đồ
│       │   ├── studio/      # Canvas phối đồ
│       │   ├── suggest/     # Gợi ý theo thời tiết
│       │   └── schedule/    # Lịch trang phục
│       ├── components/
│       │   ├── ui/          # Button, Input, Modal... (dùng chung)
│       │   ├── layout/      # Navbar, ProtectedLayout
│       │   ├── wardrobe/    # AddItemModal, ItemCard
│       │   └── canvas/      # OutfitCanvas (bọc Fabric.js)
│       ├── lib/
│       │   ├── api.ts               # Axios instance + interceptor
│       │   ├── services.ts          # Hàm gọi từng endpoint
│       │   ├── fabricCanvas.ts      # Tiện ích Fabric.js
│       │   ├── backgroundRemoval.ts # Tách nền client-side
│       │   └── colorExtract.ts      # Lấy màu chủ đạo từ ảnh
│       ├── store/           # Zustand (authStore, canvasStore)
│       └── types/           # Type dùng chung toàn client
│
└── server/                  # Express API
    └── src/
        ├── config/          # env, db, cloudinary
        ├── models/          # Mongoose schema
        ├── controllers/     # Xử lý request
        ├── routes/          # Định nghĩa endpoint
        ├── services/        # Logic nghiệp vụ (weather, suggestion, stylist, upload)
        ├── middlewares/     # auth, validate, upload, errorHandler
        ├── utils/           # ApiError, asyncHandler
        └── types/           # Enum & type domain
```

---

## Cài đặt

### Yêu cầu
- Node.js 18 trở lên
- MongoDB (cài local hoặc dùng MongoDB Atlas miễn phí)

### 1. Clone và cài dependencies

```bash
git clone <URL-repo-cua-nhom>
cd Project

cd server && npm install
cd ../client && npm install
```

### 2. Cấu hình biến môi trường

**`server/.env`** — copy từ `.env.example` rồi điền:

```bash
cd server
cp .env.example .env
```

| Biến | Bắt buộc | Lấy ở đâu |
|------|:--------:|-----------|
| `MONGO_URI` | ✅ | Local: `mongodb://127.0.0.1:27017/outfitcraft`<br>Atlas: [mongodb.com/atlas](https://www.mongodb.com/atlas) (free tier) |
| `JWT_SECRET` | ✅ | Tự đặt một chuỗi ngẫu nhiên dài |
| `CLOUDINARY_*` | ✅ | [cloudinary.com](https://cloudinary.com) → Dashboard (free 25GB) |
| `OPENWEATHER_API_KEY` | ⬜ | [openweathermap.org/api](https://openweathermap.org/api) (free 1000 req/ngày)<br>*Không có → tính năng Gợi ý báo lỗi* |
| `GEMINI_API_KEY` | ⬜ | [aistudio.google.com](https://aistudio.google.com/apikey) (free tier)<br>*Không có → tự động dùng gợi ý rule-based* |

**`client/.env.local`**:

```bash
cd client
cp .env.example .env.local
```

```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### 3. Chạy

Mở **2 terminal**:

```bash
# Terminal 1 — Backend (cổng 5000)
cd server && npm run dev

# Terminal 2 — Frontend (cổng 3000)
cd client && npm run dev
```

Mở http://localhost:3000

---

## API endpoints

Mọi route (trừ `/auth/register`, `/auth/login`, `/health`) đều cần header:
`Authorization: Bearer <token>`

### Auth
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/register` | Đăng ký |
| POST | `/api/auth/login` | Đăng nhập, trả JWT |
| GET | `/api/auth/me` | Thông tin user hiện tại |

### Tủ đồ
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/items/upload` | Upload ảnh (multipart, field `image`) → trả URL |
| GET | `/api/items` | Danh sách, lọc `?category=&style=&season=&q=&page=` |
| GET | `/api/items/stats` | Thống kê cho dashboard |
| POST | `/api/items` | Tạo món đồ (metadata) |
| GET/PATCH/DELETE | `/api/items/:id` | Xem / sửa / xóa |

### Outfit
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/outfits` | Danh sách outfit của mình |
| GET | `/api/outfits/feed` | Feed OOTD công khai |
| POST | `/api/outfits` | Lưu outfit (items + canvasJSON + thumbnail) |
| GET/PATCH/DELETE | `/api/outfits/:id` | Xem / sửa / xóa |
| POST | `/api/outfits/:id/wear` | Đánh dấu đã mặc (tăng `wearCount`) |

### Gợi ý
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/suggestions/weather?city=` | Thời tiết hiện tại |
| GET | `/api/suggestions?city=&occasion=` | Bộ đồ gợi ý + lời tư vấn stylist |
| GET | `/api/suggestions/ranked?category=` | Danh sách item đã chấm điểm |

### Lịch
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/schedule?from=&to=` | Lịch trong khoảng ngày |
| POST | `/api/schedule` | Gán outfit cho một ngày (upsert) |
| PATCH | `/api/schedule/:id/worn` | Xác nhận đã mặc |
| DELETE | `/api/schedule/:id` | Bỏ khỏi lịch |

---

## Ghi chú kỹ thuật

**Tách nền chạy ở client.** Dùng `@imgly/background-removal` (WASM) nên không tốn quota API và ảnh không rời máy người dùng cho đến khi bấm Lưu. Lần đầu chạy cần tải model AI (~vài chục MB) nên có thanh tiến trình. Server vẫn hỗ trợ tách nền qua Cloudinary nếu cần (truyền `removeBackground=true` khi upload), nhưng cần add-on trả phí.

**Outfit lưu 2 dạng song song.** `canvasJSON` là snapshot đầy đủ của Fabric để mở lại chỉnh sửa; mảng `items` lưu riêng từng item kèm transform để có thể truy vấn "outfit nào đang dùng món đồ X" mà không phải parse JSON.

**Xóa món đồ có kiểm tra ràng buộc.** Nếu món đồ đang nằm trong outfit nào đó, hệ thống chuyển sang trạng thái lưu trữ (`isArchived`) thay vì xóa hẳn, tránh làm vỡ layout outfit đã lưu.

**Gợi ý không phụ thuộc AI.** Thuật toán rule-based chấm điểm theo nhiệt độ, mùa, dịp, trời mưa và tần suất đã mặc — luôn chạy được. Gemini chỉ dùng để viết lời tư vấn bên trên kết quả đó; thiếu API key hoặc gọi lỗi thì tự động fallback sang text sinh từ rule.

---

## Lệnh thường dùng

```bash
# Server
npm run dev      # chạy dev (tsx watch, tự reload)
npm run build    # biên dịch TypeScript sang dist/
npm start        # chạy bản build
npm run lint     # kiểm tra type, không xuất file

# Client
npm run dev      # chạy dev
npm run build    # build production
npm run lint     # ESLint
```
