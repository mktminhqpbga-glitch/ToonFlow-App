# ToonFlow-App độc lập — Web trên macOS Ventura 13 Intel

**Trạng thái (2026-11-08):** đã có mã tích hợp, nhưng chưa build/test runtime hoặc chạy Render thật. Đây là hướng dẫn cho nhánh `feat/independentToonFlowFullIntegration`, **không phải xác nhận đã nghiệm thu**.

## Nguyên tắc hệ thống

- Source chính: https://github.com/mktminhqpbga-glitch/ToonFlow-App
- Hệ thống gốc vẫn dùng Vue Flow/Canvas/Node, Bun Express server, workspace/media history, model providers, Electrobun desktop cho macOS hỗ trợ runtime.
- **Ventura 13 Intel:** sử dụng **Web và backend chạy cục bộ**, không hạ yêu cầu runtime Electrobun macOS 14+ chỉ bằng cách sửa cấu hình.
- Khi dùng Web Ventura, Chrome Bridge **chỉ hỗ trợ Remote qua Render**. Local Chrome WebSocket riêng `127.0.0.1` vẫn dành cho Desktop hỗ trợ.
- Tự đăng nhập Muse, Gemini, ChatGPT trong tab Chrome, không cần API key cho chế độ Companion. Không vượt giới hạn tài khoản/ToS, không truy xuất cookie.

## Cài đặt và chạy Web Ventura (chưa kiểm thử ở môi trường Mac thực)

Yêu cầu Git, Bun 1.4.3, phiên bản Node/dependency theo repository và Chrome được cài đặt thủ công trên máy cần sử dụng.

```bash
git clone https://github.com/mktminhqpbga-glitch/ToonFlow-App.git
cd ToonFlow-App
git switch feat/independentToonFlowFullIntegration
bun install --frozen-lockfile
bun run build:tools
bun run build:ext
bun run build:nodes
bun run build:mcp
```

Mở **Terminal 1** tại thư mục repo:

```bash
bun run dev:server:local
```

Mở **Terminal 2** tại thư mục repo:

```bash
bun run dev:web:local
```

Truy cập địa chỉ Vite in ở Terminal 2 (thường là `http://127.0.0.1:5173`). Frontend/Backend đều bind loopback trong hai script này. Backend chỉ kích hoạt Chrome Bridge nếu chạy macOS và `TOONFLOW_LOCAL_WEB_BRIDGE=1` cùng `TOONFLOW_SERVER_HOST=127.0.0.1`. Reverse proxy hoặc server công khai không được cấp quyền Chrome. Vite proxy phải xác nhận nguồn client ở loopback.

Trang chủ đi thẳng vào Home, cho phép chọn thư mục làm việc, tạo project, mở Canvas, sử dụng node/AI provider được cấu hình. Hệ thống tài khoản thương mại ToonFlow gốc không bắt buộc để mở Home.

## Render Relay và Chrome Companion

1. Chọn nhánh tích hợp trong Render, tạo Docker Web Service từ `render.yaml`. Đặt `RELAY_OWNER_KEY` là chuỗi ngẫu nhiên ít nhất 32 ký tự trong Render Environment Variables (không lưu Git).
2. Ghi lại HTTPS URL **thực tế** của Render; kiểm tra `GET /healthz`. Chưa có service URL từ phiên làm việc này.
3. Trong Web Ventura vào **Settings → AI Bridge · Chrome**, chọn **Chrome through Render**, nhập URL HTTPS và owner key.
4. Tạo mã pairing một lần, mở Chrome máy khác hoặc VM → `chrome://extensions` → Developer mode → Load unpacked → chọn thư mục `packages/chromeCompanion`. Dán mã qua popup Remote và đặt tên thiết bị.
5. Quay về ToonFlow, duyệt yêu cầu ghép nối, chọn thiết bị và tab Muse/Gemini/ChatGPT đã đăng nhập.
6. Text Node hỗ trợ Gemini/ChatGPT; Image Generation hỗ trợ nguồn đã xác nhận khả năng ảnh; Video Generation chỉ Muse nếu có capability video.
7. Kết quả dự kiến đi qua backend media/workspace gốc. **Chưa có bằng chứng end-to-end**, không gửi lại prompt nếu trạng thái chưa xác nhận.

Relay dùng WSS hai kết nối đi ra, HTTPS long-polling dự phòng. Render không vận hành Chrome. Bí mật E2E nằm ở Mac/Chrome; Render chỉ thấy ciphertext và metadata. Render Free có SQLite tạm thời, cần ghép lại sau restart/deploy; lưu dài hạn cần persistent storage được người dùng chấp thuận.

Đọc thêm: [Hướng dẫn Render](../apps/chromeRelay/readme.md), [Các vấn đề còn tồn tại](./aiNotes/openIssues.md).

## Tài khoản upstream, quảng cáo và model

- Home không mount banner thương mại hoặc trang Explore mặc định; backend route quảng cáo trả kết quả rỗng, không gọi upstream.
- Mọi API thông qua `channelRequest` truy cập dịch vụ thương mại ToonFlow gốc mặc định chặn và trả 503. **Chỉ** khi chủ ứng dụng tự đặt `TOONFLOW_LEGACY_CHANNEL=1` thì mới cho phép dùng tài khoản upstream theo điều khoản và quyền thực tế; không bỏ qua xác thực/trả phí.
- Các model/provider API khác do người dùng tự thiết lập vẫn sử dụng logic gốc; chưa có bài test hồi quy.
- Marketplace upstream không mount từ Settings Web cục bộ, nhưng mã provider/plugin cục bộ vẫn được giữ. Chức năng phải audit trước khi quyết định thay thế hoàn toàn.

## Build Desktop/Release

- Mã Desktop vẫn giữ Electrobun; macOS 14+ theo runtime hiện tại, **không tuyên bố Ventura Desktop hỗ trợ**.
- `.github/workflows/integrationCheck.yml` chạy typecheck/build trên Linux khi PR được mở, không chạy installer macOS.
- GitHub fork là nguồn `homepage`, `repository`, issues, release mặc định; không có DMG mới đã xác minh. Không tự chạy cập nhật production.
- MIT/NOTICE tác giả gốc được giữ; xem [kiểm kê](./integrationAudit.md) trước khi dùng lại thương hiệu hay tài sản.

## Nếu gặp lỗi

Sao chép log Terminal *đã che key* và tạo issue trên https://github.com/mktminhqpbga-glitch/ToonFlow-App/issues. Báo rõ: Mac Ventura 13 Intel, Bun version, lệnh typecheck/build, trạng thái Render/Chrome và bước nào chưa qua. Không gửi token pairing, `RELAY_OWNER_KEY`, cookie hay prompt riêng tư vào issue công khai.
