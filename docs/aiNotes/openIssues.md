# ⚠️ KHU VỰC 2 — VẤN ĐỀ CÒN TỒN TẠI

**Tác dụng với người dùng:** biết lỗi hoặc điểm chưa hoàn chỉnh, ai phát hiện, ai đã thử sửa và còn vướng gì.

**Tác dụng với AI tiếp nhận:** trước và sau **mỗi lần sửa** phải kiểm tra khu vực này, không tự xóa vấn đề khi chưa có bằng chứng xác minh. Nếu một vấn đề đã qua nhiều người sửa, giữ lại lịch sử thử sửa.

[← Về bảng điều hướng](./overview.md) · [Việc đã làm](./completedWork.md) · [Lưu ý quan trọng](./importantNotes.md)

> **Lưu ý:** Các mục khởi tạo dưới đây do ChatGPT (GPT-6) **phát hiện qua đọc repository ngày 2026-11-08**, không phải do ChatGPT sửa gây ra. Chưa chạy app để tái hiện lỗi chức năng.

### ISSUE-0001 — GitHub Actions đang ở thư mục không được GitHub nhận làm workflow

- **Mức độ:** Cao (đóng gói/phát hành).
- **Trạng thái:** Mở — chưa sửa.
- **Phát hiện:** 2026-11-08 · **Người ghi nhận:** ChatGPT (GPT-6).
- **Người chịu trách nhiệm sửa:** Chưa chỉ định.
- **Người sửa lần cuối:** Chưa có; chưa thực hiện sửa.
- **Bằng chứng:** có `.github_temp/workflows/debug.yml`, `release.yml`, `signPath.yml`; không thấy `.github/workflows/` trong cây nguồn tại thời điểm kiểm tra.
- **Tác động:** các file ở `.github_temp/workflows/` không tự được GitHub Actions đăng ký.
- **Đã thử sửa:** Chưa.
- **Bước tiếp theo:** đối chiếu nội dung workflow, đường dẫn, quyền Actions, secrets và các nhánh phát hành; chỉ chuyển sang `.github/workflows/` khi đã kiểm tra tác động; chạy thử một workflow, gắn link run.
- **Điều kiện đóng:** workflow xuất hiện và chạy thành công trên repo này với bằng chứng run/artefact.
- **Lịch sử sửa:** Chưa có.

### ISSUE-0002 — Chưa xác nhận có bản phát hành tải được từ chính fork

- **Mức độ:** Trung bình (phát hành).
- **Trạng thái:** Mở — chờ kiểm tra/triển khai.
- **Phát hiện:** 2026-11-08 · **Người ghi nhận:** ChatGPT (GPT-6).
- **Người chịu trách nhiệm sửa:** Chưa chỉ định.
- **Người sửa lần cuối:** Chưa có.
- **Bằng chứng:** danh sách releases của fork trả về rỗng khi kiểm tra; mã có script desktop packaging nhưng **script không đồng nghĩa đã có tệp DMG/EXE/APK tải được**.
- **Tác động:** không có đường dẫn đã xác minh cho bản cài đặt fork.
- **Đã thử sửa:** Chưa.
- **Bước tiếp theo:** kiểm tra Actions, xây dựng đúng hệ điều hành/kiến trúc; kiểm thử tải và cài đặt; thêm URL bản phát hành thực tế.
- **Điều kiện đóng:** có Release/artefact truy cập được, kèm thông tin kiến trúc và kiểm thử.
- **Lịch sử sửa:** Chưa có.

### ISSUE-0003 — Liên kết phát hành và tài liệu còn dẫn tới upstream HBAI-Ltd

- **Mức độ:** Trung bình (nhận diện và cập nhật sản phẩm).
- **Trạng thái:** Mở — cần quyết định có cá nhân hóa bản fork hay không.
- **Phát hiện:** 2026-11-08 · **Người ghi nhận:** ChatGPT (GPT-6).
- **Người chịu trách nhiệm sửa:** Chưa chỉ định.
- **Người sửa lần cuối:** Chưa có.
- **Bằng chứng:** `README.md`, `package.json`, `electrobun.config.ts` vẫn chứa liên kết / mặc định tham chiếu `HBAI-Ltd/Toonflow-app`.
- **Tác động:** nếu phát hành như app riêng, người sử dụng có thể được dẫn tới upstream cho download/update/support.
- **Đã thử sửa:** Chưa.
- **Bước tiếp theo:** thống nhất tên sản phẩm, URL release và cơ chế update; không sửa hoặc xóa thông tin giấy phép/bản quyền upstream trái quy định.
- **Điều kiện đóng:** đường dẫn và nguồn cập nhật đúng ý định, được xác minh.
- **Lịch sử sửa:** Chưa có.

### ISSUE-0004 — Chưa xác minh chức năng qua chạy thử trên ứng dụng

- **Loại:** Việc kiểm chứng còn thiếu, **không phải bằng chứng rằng mọi nút bị lỗi**.
- **Mức độ:** Trung bình.
- **Trạng thái:** Mở — chờ kiểm thử.
- **Phát hiện:** 2026-11-08 · **Người ghi nhận:** ChatGPT (GPT-6).
- **Người kiểm thử phụ trách:** Chưa chỉ định.
- **Người sửa lần cuối:** Chưa có.
- **Bằng chứng:** lần phân tích chỉ đọc nguồn, cấu hình và tài liệu; chưa chạy ứng dụng thật, chưa gọi mô hình AI.
- **Bước tiếp theo:** có bộ cài/chạy thử rồi kiểm tra mở project, tạo node, kết nối, AI generate, save/load, download và toàn bộ nút chức năng; tạo issue riêng cho từng lỗi tái hiện.
- **Điều kiện đóng:** báo cáo kiểm thử với phiên bản, môi trường và kết quả xác minh có thể đối chiếu.
- **Lịch sử sửa:** Chưa có.

### ISSUE-0005 — Muse/Gemini/ChatGPT chưa kiểm thử DOM và tài khoản thật

- **Phát hiện:** 2026-11-08 · **Người phát hiện / viết code lần cuối:** ChatGPT (GPT-6).
- **Mức độ:** Cao · **Trạng thái:** Mở · **Người nghiệm thu:** Chưa chỉ định.
- **Đã thử sửa:** viết extension chỉ nhận tab đã chọn, kiểm composer/mode, đối chiếu câu hỏi mới và kết quả phía sau, không dùng ảnh lịch sử. [Commit mã](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/df9ab12fc93c385660a2f850507566f3a4e63a8d).
- **Còn tồn tại:** giao diện web có thể đổi DOM; Muse có thể không lộ nút ảnh/video; Gemini/ChatGPT image chưa chứng minh; CORS/download media chưa kiểm chứng; chưa có lần tạo văn bản/ảnh/video thành công thật.
- **Lịch sử sửa:** 2026-11-08 — ChatGPT (GPT-6) — thêm stop-button best effort và phát hiện thông báo usage/rate limit bằng DOM; **chưa kiểm thử thật**.
- **Lịch sử sửa:** 2026-11-08 — ChatGPT (GPT-6) — bổ sung allowlist `*.muse.ai` và nút gửi/dừng Muse dựa trên manifest tham khảo; **chưa được thực nghiệm**, không đóng issue.
- **Cần làm / điều kiện đóng:** chạy extension trên Chrome có đăng nhập hợp lệ; thử lần lượt từng loại chức năng; chứng minh kết quả mới đúng node và đúng tệp; ghi màn hình/log không chứa thông tin nhạy cảm.

### ISSUE-0006 — Chưa typecheck/build và kiểm thử ToonFlow Desktop macOS

- **Phát hiện:** 2026-11-08 · **Người thực hiện code / ghi nhận:** ChatGPT (GPT-6).
- **Mức độ:** Cao · **Trạng thái:** Mở · **Người kiểm thử:** Chưa chỉ định.
- **Đã kiểm tra:** cú pháp JS riêng của extension và JSON manifest bằng parser; cấu trúc tệp, import, node pipeline bằng đọc mã.
- **Còn tồn tại:** không có Bun, dependency của repo hoặc macOS trong môi trường chạy hiện tại; chưa typecheck/build thật; chưa kiểm giao diện sáng/tối, timeout, hủy, reload, Chrome disconnect, lưu/mở lại, model/provider cũ.
- **Cần làm / điều kiện đóng:** `bun install --frozen-lockfile`, `bun run typecheck`, các lệnh build liên quan và chạy trên macOS; ghi log/hình bằng chứng trước khi công nhận.

### ISSUE-0007 — Chưa xác minh đường dẫn và cách cài extension từ bản .app/DMG

- **Phát hiện:** 2026-11-08 · **Người đã sửa/ghi nhận:** ChatGPT (GPT-6).
- **Mức độ:** Trung bình · **Trạng thái:** Mở.
- **Đã làm:** copy `packages/chromeCompanion` qua cấu hình Electrobun, README hướng dẫn `chrome://extensions` → Load unpacked.
- **Còn tồn tại:** chưa có build .app thực để xác minh thư mục resource hoặc cài thật trên Chrome; chưa có cơ chế cài một chạm.
- **Cần làm / điều kiện đóng:** đóng gói DMG macOS và cài extension từ tài nguyên được đóng gói, kiểm tra ghép nối.

### ISSUE-0008 — Đánh giá bảo mật và TOS chưa nghiệm thu

- **Phát hiện:** 2026-11-08 · **Người đã sửa/ghi nhận:** ChatGPT (GPT-6).
- **Mức độ:** Cao trước khi phát hành · **Trạng thái:** Mở.
- **Đã làm:** chỉ cổng loopback, pairing token ngẫu nhiên, kiểm Origin, tab và hostname trong allowlist, giới hạn lệnh, không đọc cookie/password, không tự retry request đã gửi.
- **Còn tồn tại:** chưa kiểm thử tấn công local, Chrome MV3, quyền website, lỗi bị đăng xuất, ứng xử giới hạn/CAPTCHA, điều kiện sử dụng dịch vụ; có ô soạn thảo không phải bằng chứng quyền sử dụng API hoặc chức năng tài khoản.
- **Lịch sử sửa tiếp theo:** 2026-11-08 — ChatGPT (GPT-6) — thêm Render Relay Remote với E2E AES-GCM, thiết bị có token riêng; chưa penetration-test hoặc kiểm thử Chrome thật. [Commit](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/0db8ec285034cd8b7779e3e029f1409c31c314d3). Không đóng issue gốc.
- **Cần làm / điều kiện đóng:** security review và chạy thử trường hợp ngắt, đổi tab, reload, tài khoản hết phiên và các giới hạn dịch vụ.

### ISSUE-0009 — Chưa có Render Service thật và chưa thử WSS/HTTPS giữa hai máy

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6) · **Người viết Relay/Client lần cuối:** ChatGPT (GPT-6).
- **Mức độ:** Cao · **Trạng thái:** Mở — chờ kết nối Render người dùng và môi trường Mac/Chrome VM.
- **Đã làm:** Render Docker Web Service, `render.yaml`, HTTPS/WSS API, các transport đi ra từ hai phía; [commit mã](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/0db8ec285034cd8b7779e3e029f1409c31c314d3).
- **Chưa thực hiện:** không có tài khoản/dịch vụ Render được kết nối vào phiên triển khai; không tạo/dùng service hoặc phí từ hệ thống bên ngoài, không có URL thật; không chạy GET `/healthz` hay chứng minh handshake WSS.
- **Điều kiện đóng:** tạo đúng Render Web Service được người dùng cho phép, xác minh `/healthz`, 2 kết nối WSS, HTTPS fallback với WSS chủ động chặn và log an toàn, không mở cổng nội bộ.

### ISSUE-0010 — Render Free không lưu được SQLite bền vững sau ngủ/redeploy

- **Ngày:** 2026-11-08 · **Người ghi và người sửa thiết kế lần cuối:** ChatGPT (GPT-6).
- **Mức độ:** Cao nếu muốn thiết bị giữ ghép nối qua restart · **Trạng thái:** Mở — phụ thuộc hạ tầng.
- **Đã làm:** xác thực thiết bị bằng token hash trong SQLite `RELAY_DB_PATH`, không chỉ lưu danh tính thiết bị trong RAM; tài liệu cảnh báo Render Free.
- **Còn tồn tại:** Render Free dùng filesystem tạm nên mất SQLite khi ngủ/redeploy, không đáp ứng bền vững. Render có persistent disk cho paid Web Service hoặc cơ sở dữ liệu ngoài, nhưng **chưa được cấp phép tạo dịch vụ trả phí**.
- **Nguồn kiểm tra:** https://render.com/docs/free .
- **Điều kiện đóng:** xác nhận phương án lưu bền vững được người dùng chấp thuận, mô phỏng restart/redeploy và kiểm chứng ghép nối giữ nguyên; nếu dùng Free, phải chấp nhận ghép lại.

### ISSUE-0011 — Chưa test chunk media, idempotency, MV3 và độ bền kết nối

- **Ngày:** 2026-11-08 · **Người ghi/viết lần cuối:** ChatGPT (GPT-6).
- **Mức độ:** Cao · **Trạng thái:** Mở.
- **Đã viết:** encrypted frame 12KiB + SHA-256, giới hạn RAM Relay, ack per frame, WSS/HTTPS retry khung khi backpressure, không tự phát lại logical `run`, ledger ID của Chrome, Chrome 116+ keepalive 22s và alarm 1 phút.
- **Chưa chứng minh:** Bun Relay thực tế, nhiều frame hàng chục MB, WSS→HTTPS giữa job, 2 Chrome đồng thời, owner restart, mất frame/ack, VM giới hạn dịch vụ worker, cancel, timeout, gửi nhầm node, ảnh/video cũ.
- **Ảnh hưởng:** sự cố mạng có thể làm trạng thái yêu cầu không chắc chắn, không có phục hồi file hay tác vụ sau Render restart.
- **Điều kiện đóng:** test đầy đủ LAN/Internet/VM + video/image/text đúng node, chứng minh checksum và không gửi trùng, kiểm tra media history/lưu mở lại.

### ISSUE-0012 — Chưa typecheck/build, duyệt UI tiếng Việt mới và security review

- **Ngày:** 2026-11-08 · **Người ghi/viết code lần cuối:** ChatGPT (GPT-6).
- **Mức độ:** Cao trước merge · **Trạng thái:** Mở.
- **Kiểm tra:** parse JS relay/extension/manifest, rà soát Vue sơ bộ; chưa chạy `bun run typecheck`, build hoặc mở app thật do không có Bun/macOS và môi trường Chrome ảo.
- **Cần làm:** TypeScript/Vue typecheck, build server/nodes/Desktop, kiểm thử UI light/dark và chi tiết nút; review origin/token/cancel, HTTPS/WSS/CORS/capability; xác minh Render chỉ chuyển ciphertext.
- **Việt hóa:** chuỗi UI mới bằng tiếng Anh/thuật ngữ kỹ thuật chưa có bản dịch `vi` duyệt; danh sách `docs/aiNotes/remoteUiStringsPending.md`. **Không tự dịch và không thay PR #2**.
- **Điều kiện đóng:** có log typecheck/build+test, chuỗi Việt được duyệt, kiểm thử bảo mật và runtime thành công.

### ISSUE-0013 — Việt hóa ghép với Chrome Bridge chưa qua build và kiểm thử

- **Ngày:** 2026-11-08 · **Người ghi/sửa gần nhất:** ChatGPT (GPT-6). **Trạng thái:** Mở.
- **Đã làm:** ba-way source review, giữ logic Chrome Bridge khi hợp nhất `Text Node`, đưa 127 ID và 10 nhãn menu đúng bản duyệt vào cây mã. Hai bản ghi chú nguồn Việt hóa được giữ riêng, không ghi đè lịch sử Remote.
- **Chưa chứng minh:** Vue/TS compile, reactive label, Text Node gửi/hủy thực tế, 3D prompt, các ngôn ngữ cũ, các chuỗi mới chờ dịch. **Không tự dịch những câu chưa duyệt**.
- **Điều kiện đóng:** log build/typecheck và chạy thử locale vi/zh/en với Text/Media/3D Node, giữ nguyên prompt user và kết quả đúng node.

## Mẫu thêm vấn đề mới hoặc ghi lại lần sửa

### ISSUE-xxxx — Tên vấn đề

- **Mức độ:** Thấp / Trung bình / Cao / Nghiêm trọng
- **Loại:** Lỗi xác minh / Vấn đề cấu hình / Cần kiểm chứng / Quyết định đang chờ
- **Trạng thái:** Mở / Đang sửa / Chờ xác minh / Đã xác minh và đóng
- **Phát hiện:** [ngày] · **Người ghi nhận:** [tên/người AI]
- **Người chịu trách nhiệm sửa:** [tên hoặc chưa chỉ định]
- **Người sửa lần cuối:** [tên người/AI/model; “Chưa có” nếu chưa ai sửa]
- **Cách tái hiện hoặc bằng chứng:** [bước + expected/actual, file, log]
- **Nguyên nhân đã xác nhận / giả thuyết:** [phân biệt rõ]
- **Ảnh hưởng:** [điều gì bị hỏng / giới hạn]
- **Lịch sử sửa:** [ngày — ai sửa — commit — đã thay đổi gì — kết quả kiểm tra; thêm dòng, không xóa dòng cũ]
- **Còn tồn tại sau lần sửa cuối:** [mô tả hoặc “chờ kiểm thử”]
- **Bước tiếp theo:** [việc cụ thể và người chịu trách nhiệm]
- **Điều kiện đóng:** [bài kiểm chứng chứng minh đã hết]
