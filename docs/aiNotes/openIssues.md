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

### ISSUE-0014 — Chưa kiểm tra Web Ventura thật và quyền truy cập Bridge qua Vite proxy

- **Ngày:** 2026-11-08 · **Người phát hiện/sửa gần nhất:** ChatGPT (GPT-6). **Mức độ:** Cao. **Trạng thái:** Mở.
- **Đã làm:** mode Web chỉ bật trên macOS với `TOONFLOW_LOCAL_WEB_BRIDGE=1` và `TOONFLOW_SERVER_HOST=127.0.0.1`; Vite script bind loopback; kiểm Origin, Referer, socket loopback, `x-toonflow-local-client` từ proxy Vite. [Commit](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/d1f4598993e7785a2ecfe348977fb94e0e0a9403).
- **Chưa xác minh:** truy cập từ browser Mac Ventura, chống LAN/public qua proxy, extension cả WSS/HTTPS, từng endpoint, TypeScript and Vue build; không coi kiểm mã là security proof.
- **Điều kiện đóng:** test Mac Ventura 13 Intel, curl/browser same-origin và cross-site, request từ LAN bị từ chối, Render handshake, output đúng node.

### ISSUE-0015 — Quảng cáo/upstream chưa được kiểm toán triệt để toàn monorepo

- **Ngày:** 2026-11-08 · **Người ghi/sửa gần nhất:** ChatGPT (GPT-6). **Mức độ:** Cao. **Trạng thái:** Mở.
- **Đã làm:** xóa mount/tải quảng cáo, bỏ Explore khỏi trang Home, sửa grid, route ad trả rỗng; `channelRequest` chặn mặc định để không gọi `api.toonflow.net`; marketplace local không được mount, metadata/release chính hướng về fork. [Commit](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/d1f4598993e7785a2ecfe348977fb94e0e0a9403).
- **Còn tồn tại:** các component banner không còn mount ở Home nhưng file nguồn vẫn nằm trong repo; các thư viện/route upstream khác, addon, updateServer, SDK và network có thể có lời gọi khác chưa được chứng minh đã chặn; chưa có network capture lúc mở app.
- **Điều kiện đóng:** audit mọi caller theo mã + log network thực tế, chứng minh không gửi upstream không chủ động, rà soát component chết trước khi xóa và xác nhận giữ nguyên Canvas/workspace.

### ISSUE-0016 — Chưa hoàn tất Việt hóa tất cả UI, kỹ năng workflow và chuỗi Remote mới

- **Ngày:** 2026-11-08 · **Người ghi/sửa gần nhất:** ChatGPT (GPT-6). **Mức độ:** Trung bình. **Trạng thái:** Mở.
- **Đã làm:** tích hợp 127 ID và 10 nhãn node được duyệt, áp dụng các câu đã có trong `vi.json` lên 24 vị trí Home, 2 vị trí Settings; tạo hàng chờ 20 chuỗi Remote UI ở `translationApprovalQueue.md`.
- **Còn tồn tại:** chưa duyệt và chưa áp dụng bản dịch Remote mới; plugin/tools/prompts dài, 185 file .vue và 625 file .ts chưa được kiểm kê văn bản từng chuỗi; chưa test chuyển vi/zh/en.
- **Điều kiện đóng:** có bản dịch phê duyệt đầy đủ, diff từng ID đúng ngữ cảnh, và chạy GUI/AI prompt kiểm chứng không làm đổi token/schema.

### ISSUE-0017 — Build, phát hành và crash Desktop Ventura chưa được chứng minh đã sửa

- **Ngày:** 2026-11-08 · **Người ghi/sửa gần nhất:** ChatGPT (GPT-6). **Mức độ:** Cao. **Trạng thái:** Mở.
- **Đã làm:** thêm `.github/workflows/integrationCheck.yml` trên nhánh tích hợp, lệnh `bun install --frozen-lockfile`, TypeScript typecheck, build tools/ext/nodes/Web/server/MCP; scripts `dev:server:local`, `dev:web:local`; định tuyến release sang fork.
- **Chưa thực hiện:** không có Bun/dependencies/macOS trong môi trường trực tiếp nên không chạy lệnh; chưa đọc log CI thực tế; chưa có DMG, chưa chạy Desktop macOS14+ hoặc Ventura.
- **Thông tin máy người dùng cung cấp:** macOS Ventura 13 Intel, Bun 1.4.3/1.4.4, Web/Server mở được, Desktop crash C++/Bun. Đây là nguồn do người dùng báo, **chưa tái hiện ở môi trường này**.
- **Điều kiện đóng:** CI PASS, Web Ventura runtime PASS và Desktop được chứng minh trên OS hỗ trợ; không hạ minimum macOS bằng sửa metadata giả.

### ISSUE-0018 — GitHub Actions cài Bun và frozen lockfile chưa qua kiểm tra

- **Ngày:** 2026-11-08 · **Người phát hiện/sửa lockfile gần nhất:** ChatGPT (GPT-6).
- **Trạng thái:** Mở · **Mức độ:** Cao, chặn typecheck và build.
- **Bằng chứng:** [run #1](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42467297410): Bun đã cài, `bun install --frozen-lockfile` trả `lockfile had changes, but lockfile is frozen`; [run #2](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42467506307): GitHub HTTP 504 tải Bun từ release, các bước sau bị skip.
- **Đã thử:** đồng bộ `bun.lock` với `apps/chromeRelay/package.json` trong [commit 63e003c8](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/63e003c88089fc4ba1e541844d11b15b7a710619); rerun failed workflow #2, không nới `--frozen-lockfile`.
- **Còn tồn tại:** chưa có CI PASS sau thay đổi, chưa biết có lỗi compiler/typecheck nào phía sau. Không gộp lỗi 504 external với lỗi source code.
- **Điều kiện đóng:** install frozen PASS, typecheck và build liên quan PASS trên workflow mới và kiểm chứng macOS riêng.

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
