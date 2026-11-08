# Nghiệm thu — kết quả thật và việc chưa kiểm thử

2026-11-08 (UTC+7), Codex (GPT-6). Máy thử: Linux x64, Bun 1.4.3, Node 24.22.1, Chromium headless, FFmpeg 7.1.5. Backend chỉ bind 127.0.0.1, dữ liệu mới ở `/workspace/cloudSetup/runtimeData`, không dùng dữ liệu người dùng.

| Kiểm tra | Kết quả | Bằng chứng/giới hạn |
|---|---|---|
| bun install --frozen-lockfile | PASS | Sau chuyển 1084 URL mirror/Taobao sang npm HTTPS; phiên bản/checksum giữ nguyên |
| bun run typecheck | FAILED | Runner cũ FileNotFound; runner mới thực thi 50 workspace, 48 PASS, desktop/mobile thiếu SDK .hutch |
| SDK Hutch | BLOCKED | Launcher 0.28.2 tải được với NODE_USE_ENV_PROXY=1; Cottontail ReleaseDownloadFailed, không vô hiệu TLS/checksum |
| build:tools | PASS | Exit 0 |
| build:ext | PASS | Exit 0 |
| build:nodes | PASS | Exit 0 |
| build:mcp | PASS | Exit 0 |
| Web build | PASS | Exit 0, cảnh báo chunk lớn; có ZIP và font local |
| Server build | PASS | Exit 0 |
| build:server / build root | Không chạy nguyên lệnh trong checkpoint | Đã chạy từng nhóm tương đương, không chạy lại các nhóm giống nhau chỉ để lặp bằng chứng. build:server gồm Nodes/Tools/Ext/Web/Server; build root gồm Tools/Ext/Web/Server |
| Typecheck Web/Server/nodeShared/ImageGeneration/VideoGeneration sau sửa | PASS | Chạy riêng từng workspace; không thay thế lỗi desktop/mobile |
| Companion + Relay JS syntax | PASS | node --check background/content/remoteTransport/popup/server.js |
| Extension ZIP | PASS | Đúng 7 tệp whitelist; CRC/manifest references; hai lần pack cùng SHA256 |
| ZIP static HTTP | PASS | GET /chromeCompanion.zip trả 200 và bytes ZIP thật |
| Server startup/GET / | PASS | start:server, HTTP 200, khởi động ~478ms ở lần chạy |
| Lựa chọn ngôn ngữ lưu qua reload | PASS | Chọn English, reload vẫn en, Advanced settings bằng English, chọn lại vi |
| Trang chủ/Cài đặt vi | PASS phạm vi thử | Chromium không pageerror, html.lang=vi, node menu không còn 9 nhãn Trung mặc định |
| Font | PASS phạm vi thử | document.fonts.ready/check với chữ Việt có dấu, computedStyle Be Vietnam Pro; ảnh chụp đã xem |
| Cài đặt nâng cao/tài khoản | PASS local | Thu gọn mặc định, mở thấy MCP, không hiện tài khoản upstream |
| Light/Dark/Escape/responsive | PASS phạm vi thử | Click label radio thật, đổi class dark; Escape đóng dialog; 390px không tràn chiều ngang dialog |
| Camera prompt vi/en | PASS | Bun/assert: tắt giữ nguyên, bật đúng locale và optics, prompt người dùng/template giữ nguyên; node label vi/en giữ alias/tên riêng/type ngoài builtin |
| Tạo/mở/lưu/reopen Canvas, upload media | NOT TESTED | Build không thay regression dữ liệu |
| Bridge panel trên Mac/Local disabled | NOT TESTED UI Mac | Có metadata localAvailable và disabled binding; Linux không bật panel macOS |
| Render, ghép nối, chấp thuận, tab AI | BLOCKED | Không có URL/thiết bị/Chrome đăng nhập thật được cung cấp |
| Prompt text Muse/Gemini/ChatGPT | BLOCKED | Chưa gọi tài khoản thật |
| Một ảnh/video thật → tải → workspace → Canvas → reopen | BLOCKED | Không tạo output giả, không dùng thumbnail làm video |
| 5 ảnh, 3 video, nhiều Chrome, mất kết nối/reload/không gửi trùng | BLOCKED | Cần thiết bị AI và engine thật |
| Studio nhân vật/Thư viện vật liệu mới/Batch | NOT TESTED / NOT STARTED | Chưa triển khai hoàn chỉnh; xem implementationStatus |
| Mac Intel Ventura 13 | BLOCKED | Không có máy Mac trong môi trường thử |
| CI hiện tại/PR Draft | BLOCKED API | api.github.com CONNECT 403. Không đổi Draft hoặc merge |

ZIP SHA256 sau pack cố định mtime: `2ce4e7c81a7444613acbff0819be872fece850f8c014b8a44583c7cd4d49fff9` (cập nhật nếu nguồn Extension đổi).

## Checklist trên Mac/Chrome/Render thật

- Ghi SHA checkout, macOS/Bun/Chrome versions; chạy hai script local theo implementationStatus.
- Tải ZIP từ Bridge, giải nén, Load unpacked ở chrome://extensions; ghép bằng mã dùng một lần và chấp thuận đúng thiết bị.
- Kiểm tab đăng nhập và đúng conversation/mode; tab đổi URL/reload/mất phiên phải kiểm lại, không gửi khi không có tab.
- Tạo một ảnh và một video thật; lưu SHA256/MIME/kích thước/codec/duration của file, xác nhận không phải poster.
- Mở lại workspace/Canvas và đối chiếu Node/Asset/Camera snapshot. Sau đó mới chạy 5 ảnh/3 video liên tiếp.
- Kiểm mất kết nối khi SUBMITTING/RUNNING; UNKNOWN không tự retry. Không vượt CAPTCHA/hạn mức.
- Đối chiếu CAM-01..12 trong cameraStudioAcceptance và giữ PR #4 Draft đến khi build/regression/AI thật đạt.

Không gửi cookie, pairing code, owner key, API key hoặc prompt riêng tư vào báo cáo công khai.

Bằng chứng triển khai checkpoint: [commit 412912a](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/412912a62888209a040128c522ef085f6a7953dc).
