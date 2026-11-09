# Remote Chrome Bridge via Render

**Trạng thái mã:** đã viết adapter; chưa deploy Render, chưa xác minh macOS hoặc Chrome VM. Bản này dùng nhánh `feat/remoteChromeBridgeRender` kế thừa PR #1. Local Mode vẫn dùng `127.0.0.1` độc lập Internet.

## Kiến trúc

- ToonFlow Desktop macOS → RemoteTransport (WSS, HTTPS long-poll fallback) → Render Web Service → Chrome Companion (MV3 trên Windows/macOS/Linux) → tab Muse/Gemini/ChatGPT.
- Mac và Chrome **đều chủ động kết nối đi ra** Render qua TLS. Không cần public IP, NAT/port forwarding, không mở cổng vào Chrome máy ảo.
- Kết quả trao đổi qua các frame AES-256-GCM ứng dụng mã hóa đầu cuối bằng bí mật ngẫu nhiên 256-bit chỉ trong mã ghép nối Mac→Chrome. Relay chỉ thấy metadata kích thước, ID frame/device và ciphertext. **TLS/WSS** bảo vệ đường mạng; **AES-GCM** mới bảo vệ prompt/media trước chính Relay.
- File được chia frame 12KiB, SHA-256 toàn ciphertext, giới hạn 48MiB mỗi logical message và 12 frame đang chờ mỗi channel tại Relay. Relay không ghi prompt/media vào SQLite. Bộ nhận chỉ hoàn tất khi checksum/giải mã hợp lệ.
- Client giữ ID job/node/tab/provider, không tự gửi lại AI prompt khi mất xác nhận. Retry chỉ dành cho frame transport bị từ chối do hàng đợi đầy.
- Local Mode không đổi; các provider gốc tiếp tục qua pipeline ToonFlow.

## Tạo dịch vụ Render Web Service (chưa được thực hiện)

1. Kết nối repository GitHub với Render, chọn **New → Blueprint** dùng `render.yaml`, hoặc tạo Web Service từ Docker path `apps/chromeRelay/dockerfile`. Không chọn Static Site.
2. Đặt `RELAY_OWNER_KEY` trong **Render → Environment** bằng bí mật ngẫu nhiên tối thiểu 32 ký tự; KHÔNG commit GitHub. Ghi `RELAY_DB_PATH` tới SQLite path phù hợp.
3. Render sẽ gắn TLS công khai; sao chép URL thực tế dạng `https://<dịch-vụ-của-bạn>` ở Dashboard. URL là ví dụ cấu trúc, **không có URL Render thật nào được triển khai trong phiên này**.
4. Chỉ sử dụng 1 instance Relay; HTTP `GET /healthz` trả `{"status":"ok"}` nếu server chạy. WSS endpoint `/v1/ws`, fallback HTTPS `/v1/channel/poll`, `/v1/channel/send`, `/v1/channel/ack`.
5. **Render Free:** file system tạm, SQLite mất sau sleep/restart/deploy; mỗi thiết bị phải ghép lại. Free dịch vụ ngừng sau 15 phút không có inbound traffic và cold start có thể dài. Để **ghép nối bền vững**, dùng Render Web Service có persistent disk (gắn `RELAY_DB_PATH` vào disk) hoặc thiết kế DB managed khác được kiểm chứng; không nâng gói trong nhiệm vụ này.

## Kết nối Chrome từ máy khác/VM

1. Mở ToonFlow Desktop **Settings → AI Bridge · Chrome** → chọn **Chrome through Render**.
2. Nhập URL HTTPS của Render và giá trị `RELAY_OWNER_KEY` do bạn vừa tạo; bấm **Connect Render** (secret lưu chỉ trong settings.json mode 0600 trên Mac, không trả qua API status).
3. Bấm **New one-time pairing code**, sao chép toàn bộ mã (gồm phần `#secret`) vào máy Chrome.
4. Trên Chrome máy khác bật `chrome://extensions` → Developer mode → Load unpacked → chọn `packages/chromeCompanion`. Chrome 116+; extension yêu cầu cấp quyền kết nối đúng origin HTTPS Render người dùng vừa nhập.
5. Trong popup của extension, dán mã vào mục **Remote via Render**, nhập tên thiết bị, bấm **Pair via Render**. Về Mac, chờ xuất hiện yêu cầu và bấm **Approve device**.
6. Sau khi được duyệt, chọn thiết bị trong Settings. Mở tab Muse/Gemini/ChatGPT, đăng nhập tự nguyện, chọn tab và bấm **Connect**. Dùng Text/Image/Video Node gốc theo capability tab được phát hiện.
7. Khi Render/WSS ngắt, hệ thống thử HTTPS long-poll tự động; nếu HTTPS cũng lỗi, công việc bị ngắt ở trạng thái chưa xác nhận. **Hãy kiểm tra tab cũ trước khi gửi mới**.

## Bảo mật, dữ liệu và các giới hạn

- Mỗi máy Chrome dùng device token riêng và ID riêng. Relay cấp token sau yêu cầu ghép nối có thời hạn và được người dùng Mac duyệt. Có rename/revoke từ Settings; revoke vô hiệu hóa token trên Relay.
- Device token hash được lưu SQLite; dữ liệu nhạy cảm (secret AES, token Chrome) nằm trong settings cục bộ Mac/chrome.storage.local phía Chrome. Không thu thập password/cookie/session của các website AI. Cài extension không tự đăng nhập.
- Mã pairing dùng một lần, giới hạn 5 phút, có xác nhận thủ công; không chia sẻ mã pairing công khai. Render không thể đọc ciphertext AI khi secret không rò rỉ.
- MV3 service worker có thể bị tạm dừng; dùng WSS ping ~22s và chrome.alarms theo khả năng Chrome 116+; không vượt chính sách máy ảo.
- Thu hồi pair trước đây sau khi Render Free xóa SQLite không thể thao tác: thiết bị cũ đã mất quyền truy cập theo DB mới, cần ghép lại.
- Relay có timeout/backpressure/rate limits trong bộ nhớ; **không lưu hàng đợi qua restart**. Không bảo đảm hoàn tất đang dở hoặc tự khôi phục job.
- Hạn chế DOM AI của PR #1 vẫn tồn tại. Chưa xác minh video/ảnh thật trên Chrome VM hay cập nhật Canvas sau restart. Các chuỗi UI mới chưa có bản Việt duyệt: `docs/aiNotes/remoteUiStringsPending.md`.

## Kiểm tra còn phải thực hiện

- Test thực tế `GET /healthz` trên Render đã deploy; WSS hai thiết bị, HTTPS fallback với WSS bị chặn (không bypass); 2 thiết bị đồng thời và routing.
- Test revoke/rename, pair 1 lần/TTL/restart với persistent storage; encrypt/decrypt/hash nhiều frame, media lớn, cancel, limit.
- Run `bun install --frozen-lockfile` và typecheck/build workspaces liên quan, đóng gói macOS và cài extension Chrome Windows/macOS/Linux.
- Kết nối tài khoản Muse/Gemini/ChatGPT thật, giữ đúng text/ảnh/video theo node, lưu/đóng/mở lại Canvas, test provider gốc, light/dark.
- Không gọi chức năng này 'đã hoạt động thực tế' khi chưa có log/screenshot chạy thật.
