# HD-07 — Nghiệm thu Chrome Companion, Muse và video thật trên Mac Intel Ventura

**Ngày lập:** 2026-11-09 — **trạng thái thực tế:** BLOCKED (chưa có Chrome đăng nhập và Render của chủ dự án trong môi trường GitHub). Bằng chứng CI chỉ xác nhận typecheck, test regression giả lập trạng thái/tab và build; không chứng minh AI E2E.

## 1. Khởi chạy đúng nhánh; không tắt bảo mật

Tại thư mục ToonFlow-App trên máy Mac Intel 13 Ventura:

```bash
git fetch origin
git switch feat/independentToonFlowFullIntegration
git pull --ff-only origin feat/independentToonFlowFullIntegration
bun install --frozen-lockfile
bun run build:tools
bun run build:ext
bun run build:nodes
bun run build:mcp
bun run dev:server:local
```

Mở Terminal thứ hai cùng repo:

```bash
bun run dev:web:local
```

Vào URL **đúng như Vite thông báo**, không mặc định cổng. Không đặt `TOONFLOW_LOCAL_WEB_BRIDGE` để bỏ kiểm tra loopback; Web Ventura dùng Chrome qua Remote/Render. Không đăng khóa/chứng thực vào issue công khai.

## 2. Kết nối và chẩn đoán từng tầng

1. Trong ToonFlow: **Cài đặt → AI Bridge · Chrome**. Tải `chromeCompanion.zip`; giải nén vào một thư mục riêng.
2. Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → chọn thư mục chứa `manifest.json` của extension vừa giải nén. Reload extension nếu đã dùng bản cũ.
3. AI Bridge → Remote → nhập **HTTPS origin** của Render Relay và owner key **chỉ vào UI trên máy bạn**. Không gửi cho ChatGPT. Bấm kết nối.
4. Ở mục **Chẩn đoán kết nối AI**, kiểm tra Relay, thiết bị và Extension lần lượt báo OK. Nếu không, sửa đúng tầng được báo lỗi.
5. Tạo mã ghép nối một lần, nhập mã vào Companion trên Chrome của máy đã đăng nhập; phê duyệt device trong ToonFlow. Mã này nhạy cảm, không chụp công khai.
6. Mở và đăng nhập `muse.ai`; bấm đọc danh sách tab; chọn **đúng tab Muse**, xác minh tab/probe/capability **image** và **video**. Với Gemini và ChatGPT, chỉ bật loại tác vụ mà trang đăng nhập xác nhận có sẵn.
7. Trong API devtools/network có thể xem `GET /api/desktop/chromeBridge/diagnostics`; yêu cầu trả kết quả không chứa owner key hoặc secret. API vẫn đòi request loopback/Origin hợp lệ; không gọi từ web công cộng.
8. Thử ngắt Render hoặc tắt tab; phải thấy trạng thái offline hoặc UNKNOWN, không tự gửi prompt khác. Sau khi kiểm tra thủ công kết quả cũ, **chọn lại tab** để xác minh phiên mới.

## 3. Tạo một ảnh AI thật (ưu tiên P0)

1. Tạo workspace thử nghiệm, mở **Image Generation Node**.
2. Chọn model **Muse · Chrome** với capability image thật đã xác nhận, prompt mới độc nhất chứa ký hiệu dễ nhận biết nhưng không phải bí mật (ví dụ: `HD07-IMAGE-SAMPLE-01: a red ceramic mug on a wooden table`). Chọn tỷ lệ 1:1 nếu website hỗ trợ; nếu chỉ gửi tỷ lệ bằng prompt thì ghi rõ.
3. Bấm gửi **đúng một lần**. Ghi Task ID (không ghi token/cookie). Quan sát đúng tab Chrome: prompt mới, kết quả mới sau khi submit, không nhầm ảnh lịch sử.
4. Chỉ đánh dấu PASS khi UI node trỏ đến **tệp ảnh mới được lưu trong workspace**; thử tải và dùng Finder/Terminal kiểm tra `file <đường-dẫn-ảnh>`, `sips -g pixelWidth -g pixelHeight <đường-dẫn-ảnh>`.
5. Lưu dự án, đóng tab Web, mở lại. Ảnh và node phải còn đúng đường dẫn và hiển thị. Nếu có lỗi 403/401/timeout hoặc UNKNOWN, giữ nguyên Task ID, không thử tự động gửi lại.

## 4. Tạo một video AI thật

1. Mở **Video Generation Node**, chọn đúng Muse tab với capability video đang bật và model video có thể sử dụng.
2. Prompt test mới khác trước: `HD07-VIDEO-SAMPLE-01: locked camera, a red ceramic mug gently rotates, 5 seconds`. Không dùng poster hay hình xem trước thay video.
3. Gửi một lần, chờ kết quả và tải video **từ node/workspace**.
4. Trên **tệp video gốc thật**, chạy:

```bash
file "<đường-dẫn-video>"
ffprobe -v error -show_entries format=duration,format_name -show_entries stream=codec_type,codec_name,width,height -of json "<đường-dẫn-video>"
```

Phải thấy stream video + codec hợp lệ và duration > 0; kiểm tra playback thực. Lưu/reload workspace. Nếu Mac chưa cài ffprobe, cài FFmpeg bằng bộ cài được bạn tin cậy; không suy ra file hợp lệ từ MIME/thumbnail.

## 5. Batch 5 ảnh, 3 video và MP4

- Batch Image: nhập **5 prompt khác nhau**, chọn model thật, lưu lại 5 Task ID, kiểm tra file/tên/mime từng kết quả. Tạm dừng sau một cảnh, tiếp tục; không gửi chồng cùng tab.
- Batch Video: nhập **3 prompt**, kiểm tra Task ID và scene ID, kết quả MP4/WebM thật; thử đưa từng kết quả vào Canvas.
- Khi cả ba cảnh video hợp lệ và codec/kích thước/FPS/audio tương thích, bấm **Ghép MP4 (FFmpeg)**. Kiểm tra MP4 đã ghép bằng `ffprobe` và phát video; sau đó tải và đưa MP4 vào Canvas.
- Tạo riêng một case FAILED bằng tác vụ độc lập trên workspace thử, xác nhận các cảnh khác tiếp tục; case UNKNOWN **không tự retry**, không ghi `completed` nếu thiếu file.
- Restart Server và reload Web; xác nhận các Scene ID/Task ID cũ không bị đổi hay gửi lại.

## 6. Biên bản và an toàn

Ghi theo từng ca **PASS/FAIL/BLOCKED/NOT TESTED**, commit SHA, ngày giờ, macOS 13.x + Chrome + Bun version, thao tác, đường dẫn file **đã ẩn thông tin cá nhân**, MIME, bytes, sha256, FFprobe duration, mô tả kết quả Console/Network **đã xóa token và cookie**. Không đăng Relay owner key, pairing URL, auth header, nội dung riêng tư hoặc đường dẫn người dùng chứa thông tin cá nhân.

Đến khi có bằng chứng nghiệm thu ngoài GitHub Actions, **không đánh dấu AI E2E PASS hoặc HD-07 DONE**. PR #4 tiếp tục Draft.
