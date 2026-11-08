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

ZIP SHA256 lịch sử tại checkpoint 412912a (không phải bản 0.2.0): `2ce4e7c81a7444613acbff0819be872fece850f8c014b8a44583c7cd4d49fff9` (cập nhật nếu nguồn Extension đổi).

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


## Bridge 0.2.0 — kiểm tra giữ đúng tab và đúng kết quả

Codex (GPT-6), 2026-11-08 (UTC+7). Bản nền a3b72a3. Các fixture không có tài khoản AI và không gửi prompt ra website thật; Chromium chặn mạng và phục vụ DOM có kiểm soát. Không coi đây là nghiệm thu Muse/Gemini/ChatGPT/Render/Mac.

| Tình huống content script thật trên Chromium | Bản nền | Sau sửa |
|---|---|---|
| User gửi lượt khác sau receipt; không được lấy câu trả lời lượt đó | FAIL | PASS |
| Đổi URL trong khi upload; không submit vào chat mới | FAIL | PASS |
| Tab đã có tác vụ đang tạo; không gửi chồng | FAIL | PASS |
| Media cũ được render thành element mới; không fetch/nhận URL cũ | FAIL | PASS |
| Receipt chỉ chứa prompt như một phần chuỗi khác | FAIL | PASS |
| Đổi trang trong khi fetch kết quả; không trả completed | FAIL | PASS, UNKNOWN |
| Composer có bản nháp chưa gửi; giữ nguyên bản nháp | FAIL | PASS |
| Thay toàn bộ lịch sử chat cùng URL khi upload | FAIL (chạy riêng đối chiếu bản nền) | PASS |
| Văn bản đúng receipt | PASS | PASS |
| Ảnh PNG tự tạo 512×512, đọc đúng kích thước từ bytes | PASS | PASS |

Các kiểm tra bổ sung đã chạy:

- Chromium reload thực tại URL không đổi: documentToken thay đổi và request từ phiên đã chọn cũ bị từ chối trước submit.
- Worker code với Chrome API giả lập: đổi document/URL trước run bị chặn; chỉ dispatch một tác vụ khi hai request đồng thời; iframe/sai document không được trả output; đúng context nhận được.
- Task ID đã hoàn tất hoặc worker restart vẫn không dispatch lại; ledger ghi đồng thời trên hai tab không mất ID; UNKNOWN tiếp tục giữ khóa tab.
- Backend Local/Remote: bắt buộc document handshake; gửi đúng token đã chọn; không nhận loại output/MIME/base64/kích thước/thời lượng sai; event document khác bị bỏ qua; uncertain/UNKNOWN được giữ đúng trạng thái.
- Giao thức WebSocket Local thực trên loopback Linux (chỉ bật seam enabled cho kiểm tra giao thức, không giả mạo bằng chứng macOS): auth/pin payload/event đúng nhận được, sai document bị bỏ qua, sai kind bị từ chối.
- Server/Web typecheck PASS; Server/Web build PASS; Companion JS syntax PASS. Không chạy lại toàn repo 50 workspace: lỗi SDK Hutch trước đó vẫn là blocker riêng.
- ZIP 0.2.0: HTTP 200, CRC PASS, whitelist đúng 7 tệp, bytes của mỗi tệp khớp nguồn hiện tại, pack lặp lại cùng hash.

ZIP 0.2.0 SHA256: `3515eb393a62b3bfc48cef54747c22de690ef394cba3d30f431a67dce371f2e1`.

Harness/log cục bộ tại `/workspace/cloudSetup/bridgeValidation/v020/`, không thêm framework hoặc test module vào mã ứng dụng. Đây là artifact của môi trường kiểm tra, không phải tệp được publish cùng repo. Ví dụ chạy lại: `node /workspace/cloudSetup/bridgeValidation/v020/bridgeGuardChecks.cjs`; bản nền dùng biến BRIDGE_SOURCE trỏ tới bridgeContentBaseline.js. Backend harness dùng Bun `--tsconfig-override apps/server/tsconfig.json` và TOONFLOW_DATA_DIR riêng.

**Còn BLOCKED/NOT TESTED:** DOM/selector hiện tại của tài khoản AI thật, nhận video thực hoàn chỉnh và codec/duration của file tải, Render WSS/HTTPS thật, Mac Ventura thật. Sau cập nhật phải Reload Extension và tab AI, chọn lại tab; xem packages/chromeCompanion/readme.md. Không tự retry UNKNOWN.
