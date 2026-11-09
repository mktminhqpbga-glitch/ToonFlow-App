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
- **Cập nhật kiểm thử 2026-11-08 — ChatGPT (GPT-6):** [commit e02e4833](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/e02e4833a190626ecb649123a5b2cfa5db50b86d) dùng build từng thư mục để tránh Bun `--filter`; [CI run #42481958013](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42481958013) PASS toàn bộ nhóm Tools, Ext, Nodes, MCP, Web và Server cùng typecheck đã chọn. Đây là **xác minh build trên Linux**, không phải test runtime Ventura/Desktop. Vẫn **MỞ** cho đến khi nghiệm thu Mac Ventura và bản Desktop hợp lệ, không có DMG mới được xác nhận.

### ISSUE-0018 — GitHub Actions cài Bun và frozen lockfile (CI Linux đã xác minh)

- **Ngày:** 2026-11-08 · **Người phát hiện/sửa lockfile gần nhất:** ChatGPT (GPT-6).
- **Trạng thái:** Đã xác minh và đóng phạm vi CI Linux ngày 2026-11-08 · **Mức độ trước sửa:** Cao, chặn typecheck và build.
- **Bằng chứng:** [run #1](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42467297410): Bun đã cài, `bun install --frozen-lockfile` trả `lockfile had changes, but lockfile is frozen`; [run #2](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42467506307): GitHub HTTP 504 tải Bun từ release, các bước sau bị skip.
- **Đã thử:** đồng bộ `bun.lock` với `apps/chromeRelay/package.json` trong [commit 63e003c8](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/63e003c88089fc4ba1e541844d11b15b7a710619); rerun failed workflow #2, không nới `--frozen-lockfile`.
- **Còn tồn tại:** chưa có CI PASS sau thay đổi, chưa biết có lỗi compiler/typecheck nào phía sau. Không gộp lỗi 504 external với lỗi source code.
- **Điều kiện đóng:** install frozen PASS, typecheck và build liên quan PASS trên workflow mới; kiểm chứng macOS là việc độc lập còn mở trong ISSUE-0017.
- **Cập nhật 2026-11-08 — ChatGPT (GPT-6):** nhờ [commit e02e4833](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/e02e4833a190626ecb649123a5b2cfa5db50b86d) và [GitHub Actions run #42481958013](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42481958013), Bun/frozen lockfile/typecheck 7 workspace/build Tools-Ext-Nodes-MCP-Web-Server đều **PASS** (Linux CI); lỗi `FileNotFound` đã hết trong quy trình này. Các lỗi tải Bun 504 trước đây là lỗi hạ tầng. **Phần CI đã xác minh/đóng; thử nghiệm trên macOS không thuộc kết quả này và tiếp tục được theo dõi ở ISSUE-0017.**


### ISSUE-0019 — Camera Studio cần nghiệm thu GUI và độ bền dữ liệu trên Mac Ventura

- **Ngày:** 2026-11-08 · **Người phát hiện/sửa gần nhất:** ChatGPT (GPT-6). **Trạng thái:** MỞ, runtime chưa kiểm chứng. **Ưu tiên:** Cao.
- **Đã làm:** shared Camera Studio, presets lưu browser localStorage, node.data.camera, node.data.cameraHistory theo path asset; Director3D sceneConfig.cameraStudio + PerspectiveCamera focal length; giữ prompt nguyên và chỉ thêm chỉ dẫn khi enabled.
- **Chưa kiểm chứng:** bật/tắt nhanh, save/reopen Canvas, đổi nhiều preset liên tiếp, Scene 3D camera position/FOV/aspect/animation, mất quyền localStorage/ghi model.json, export lại asset. Đổi trường `sceneConfig.cameraStudio` phải không ảnh hưởng agent 3D cũ.
- **Điều kiện đóng:** log GUI trên Mac Intel Ventura và scene 3D, ảnh/video thực; preset được đọc sau reload và ảnh kết quả hiển thị snapshot đúng.

### ISSUE-0020 — Chrome aspect ratio chỉ là prompt intention; chưa có adapter chọn tỷ lệ native

- **Ngày:** 2026-11-08 · **Người phát hiện/sửa gần nhất:** ChatGPT (GPT-6). **Trạng thái:** MỞ, chưa thể gọi tỷ lệ thật được xác minh. **Ưu tiên:** Cao.
- **Đã làm:** tách `ratio.ts` với tập tỷ lệ prompt-only; gửi chỉ dẫn tỷ lệ và size vào AI request, UI thông báo không bảo đảm; extension từ chối tab/mode không sẵn sàng, URL cuộc trò chuyện đổi; readMedia trả kích thước thật và thời lượng từ phần tử media. Node ảnh ghi nhận ratioMatched khi tải ảnh đã lưu.
- **Chưa kiểm chứng:** DOM của Muse/Gemini/ChatGPT đã đăng nhập thật, khả năng chọn tỷ lệ trực tiếp từng provider, ảnh JPEG/PNG/WebP thực với mọi tỷ lệ, tải WebM/MP4 và ffprobe, các trường hợp blob lỗi, ảnh thumbnail và 2 Chrome.
- **Điều kiện đóng:** có nguồn capability đáng tin từ provider/tab, chạy thật và so tỷ lệ output bằng file đã tải. **Không tuyên bố chọn tỷ lệ native đã hoạt động.**

### ISSUE-0021 — Batch camera snapshots chưa có Batch Engine được kiểm thử

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6). **Trạng thái:** MỞ, chưa triển khai Batch Camera UI/Engine. **Ưu tiên:** Sau Bridge real.
- **Đã làm:** `CameraSettings`, `normalizeCameraSettings`, `appendCameraInstructions` và lưu snapshot per output trong hai node để tái sử dụng ở engine hiện hữu.
- **Còn tồn tại:** chưa chứng minh engine Batch Image/Video chạy được trong ToonFlow; không tạo UI giả hoặc copy MooZ Relay; cần hợp đồng Job/Scene/Task/Node/Asset và checkpoint đúng provider trước khi thêm Batch.
- **Điều kiện đóng:** Batch Engine thật, queue/chrome idempotency và sản phẩm ảnh/video nhiều lượt được kiểm thử trên Chrome thật.

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

### ISSUE-0022 — Cloud không tải được tarball từ npm mirror

- **Ngày:** 2026-11-08 (UTC+7). **Người phụ trách/sửa gần nhất:** Codex (GPT-6).
- **Trạng thái:** Đang sửa.
- **Bằng chứng:** `bun install --frozen-lockfile` lỗi ProxyConnectFailed; curl tới registry.npmmirror.com trả CONNECT 403, npm chính thức trả 200.
- **Hướng sửa:** đổi duy nhất host URL tarball trong bun.lock sang registry.npmjs.org; giữ nguyên phiên bản, schema và checksum. Cài frozen và kiểm tra compiler/build sau đó.
- **Điều kiện đóng:** cài frozen thành công và ghi rõ các kiểm tra thực sự đã chạy.

- **Cập nhật ISSUE-0022 — Codex (GPT-6), 2026-11-08:** đã thay 1084 URL tarball mirror/Taobao bằng npm HTTPS; so sánh toàn bộ lockfile với HEAD xác nhận không đổi version/checksum. Frozen install PASS. Đã khắc phục đường cài Linux, không thay network allowlist.

### ISSUE-0023 — Typecheck desktop/mobile thiếu SDK Hutch

- **Ngày/người sửa gần nhất:** 2026-11-08 (UTC+7), Codex (GPT-6).
- **Trạng thái:** Mở / BLOCKED prerequisite.
- **Đã làm:** runner tuần tự tránh Bun --filter FileNotFound và chạy đủ 50 workspace. 48 PASS, desktop/mobile lỗi import .hutch/devkit và electrobun/main, kèm lỗi type suy ra từ SDK thiếu.
- **Đã thử:** Electrobun 2.0.5 bootstrap mặc định lỗi DNS; NODE_USE_ENV_PROXY=1 tải launcher Hutch 0.28.2 thành công rồi Cottontail ReleaseDownloadFailed. Không sửa expected checksum/TLS hoặc thêm declaration stub.
- **Còn lại:** chuẩn bị SDK bằng đường tải chính thức được hỗ trợ, chạy lại toàn bộ typecheck. Không coi CI chọn một số workspace là toàn repo xanh.

### ISSUE-0024 — Yêu cầu tổng thể còn các hạng mục chưa triển khai/nghiệm thu

- **Ngày/người cập nhật:** 2026-11-08 (UTC+7), Codex (GPT-6).
- **Trạng thái:** Mở / PARTIAL.
- **Đã thay đổi:** font local, locale mặc định vi, hiển thị nhãn node, cài đặt nâng cao, ZIP Extension, Bridge copy/capability, prompt Camera vi.
- **Đã xác minh:** typecheck phạm vi sửa, build các nhóm, HTTP, Chromium UI, ZIP integrity và prompt Camera. Xem e2eAcceptance.
- **Còn lại:** Việt hóa prompt/UI toàn app; Bridge diagnostics đầy đủ; AI/Render/Mac thật; toolbar, Thư viện vật liệu, Studio nhân vật và Batch bền vững. Chưa đọc bốn repo tham khảo. Không đánh dấu toàn bộ DONE.

### ISSUE-0025 — Chrome task có thể nhận lượt trả lời khác hoặc gửi sau khi đổi chat

- **Ngày/người phụ trách:** 2026-11-08 (UTC+7), Codex (GPT-6).
- **Trạng thái:** Đang sửa.
- **Tái hiện:** Chromium chạy content.js thật trên DOM mô phỏng: FAIL khi có user message mới sau receipt, đổi URL trong khi upload tham chiếu, trang đang busy, hoặc ảnh cũ được render thành element mới. Trường hợp text thông thường PASS. Không coi mô phỏng là nghiệm thu provider thật.
- **Hướng sửa:** khóa tab + documentToken + exact URL; probe lại và kiểm ngay trước submit; gắn output với receipt của chính prompt, chặn lượt user khác/URL media cũ; kiểm lại sau download; giữ UNKNOWN nếu đã submit mà mất bằng chứng.
- **Điều kiện đóng phần code:** ca tái hiện từ đỏ sang xanh, kiểm transport Local/Remote và build/typecheck liên quan. E2E Chrome/Render/account thật vẫn phải nghiệm thu riêng.

- **Cập nhật ISSUE-0025 — Codex (GPT-6), 2026-11-08:** 8 ca không an toàn đã đối chiếu FAIL ở bản nền và PASS sau sửa; 2 ca kết quả đúng tiếp tục PASS. Đã xác minh thêm reload cùng URL, khóa tab đồng thời, frame/document, ledger/restart, backend và Local WS. Server/Web typecheck/build và ZIP 0.2.0 PASS. **Phần lỗi tái hiện có kiểm soát đã sửa; ISSUE vẫn Mở/chờ nghiệm thu website AI, Render và Mac thật.** Không khẳng định adapter production đã hoạt động đầy đủ.


### ISSUE-0026 — Prompt editor/reference picker chưa nghiệm thu locale và kéo thả caret

- **Ngày/người cập nhật:** 2026-11-09 (UTC+7), ChatGPT (GPT-6).
- **Trạng thái:** Mở / PARTIAL; **NOT TESTED** runtime.
- **Đã thử sửa:** bổ sung nhãn tiếng Việt vào `promptInput.vue` và `promptReferenceMenu.vue`, bảo toàn nhãn gốc cùng cơ chế reference, không thay đổi model, schema hoặc thao tác x-sender; các commit 6d02a4e, d3f94a8, 3f1cc0a.
- **Vẫn chưa xác minh:** thay đổi locale trên UI, build/typecheck, drag media đúng tọa độ caret, lưu/khôi phục reference, Undo/Redo trong Chrome/Mac. Không đánh dấu phần drag-and-drop DONE.
- **Bước tiếp theo:** chạy typecheck nodeShared; test chuyển locale; xác định định dạng drag hiện có ở Canvas/Asset Library trước khi chạm luồng insertion; test persistence và payload AI.


### ISSUE-0027 — Hai bảng tạo ảnh/video chưa nghiệm thu sau Việt hóa

- **Ngày/người sửa lần cuối:** 2026-11-09 (UTC+7), ChatGPT (GPT-6).
- **Trạng thái:** Mở / PARTIAL, runtime NOT TESTED.
- **Đã thử:** Việt hóa nhãn và aria-label hai bảng cài đặt (commit 2302f60 và bccd1bd). Bảo toàn giá trị mode/duration/ratio/size và model.
- **Còn lại:** typecheck/build ở commit mới, test chuyển locale vi/en lúc popover mở, thử chọn ratio và mode ảnh/video với model thật, xác nhận cảnh báo Chrome.
- **Điều kiện đóng:** CI pass trên commit mới và kiểm tra UI liên quan; E2E với provider chỉ đóng khi có kết quả thực.


### ISSUE-0028 — HD-01 model disabled chưa có catalog và readiness đầy đủ

- **Ngày/người sửa cuối:** 2026-11-09 (UTC+7), ChatGPT (GPT-6). **Trạng thái:** Mở / PARTIAL.
- **Đã sửa code:** backend phân biệt `needsConfiguration` và `configured` cho media provider đang cài; model Chrome đang probe có `ready`; image/video không cho chọn/gửi model thiếu cấu hình. Commit c051788, fec3e8e, 4253903, 5fab792, 6f174cc, 333261f.
- **Chưa đạt:** các provider chưa cài chưa được liệt kê; config có API key chưa chứng minh kết nối hoặc quota; cần test mode multiTenant; cần test Mac/Chrome/Render thực. Đừng hiểu nhãn `configured` là `connected`.
- **Kiểm tra:** CI integrationCheck run 42511358311 đã thành công; source review và E2E khác nhau. Tham khảo [bảng kiểm riêng](./hdAcceptance.md).


### ISSUE-0029 — HD-02 drag/drop runtime và tính đúng của prompt reference

- **Ngày/người trực tiếp sửa:** 2026-11-09, ChatGPT (GPT-6). **Trạng thái:** PARTIAL, mở.
- **Đã làm:** code drag/drop từ Canvas và Asset Library, ID nguồn thật, chèn theo caret, sửa lỗi TypeScript; CI 42549399300 PASS.
- **Cần kiểm chứng:** click-select/caret DOM, Undo/Redo, thumbnail, video preview, copy/paste, lưu/reload, gửi reference qua provider. Không công nhận E2E.

### ISSUE-0030 — HD-03 UI preset cần thử tạo node trong ứng dụng thật

- **Ngày/người trực tiếp sửa:** 2026-11-09, ChatGPT (GPT-6). **Trạng thái:** PARTIAL, mở.
- **Đã làm:** hai cột preset, prompt chỉnh trước, tạo node thực, tự khóa khi thiếu node. CI 42549924812 PASS.
- **Chưa làm:** thử click từng preset, xác minh node type/SDK từ catalog tải động, lưu mở lại node, chụp UI.

### ISSUE-0031 — HD-04 cần nghiệm thu lưu, nhập media và Studio AI

- **Ngày/người trực tiếp sửa:** 2026-11-09, ChatGPT (GPT-6). **Trạng thái:** PARTIAL, mở.
- **Đã làm:** workspace character index, Character ID, bộ ảnh gốc tối đa 9 ảnh, upload, sửa, xóa hồ sơ không xóa media, import Canvas, bảo vệ switch workspace; CI 42550662370 PASS.
- **Chưa làm:** thử ghi file thực, concurrent edit, cleanup lỗi upload, khôi phục trên Mac, sinh nhân vật thật bằng AI/model.

### ISSUE-0032 — HD-05 Batch Engine vẫn thiếu nghiệm thu runtime, FFmpeg và điều phối đa thiết bị

- **Ngày/người trực tiếp sửa:** 2026-11-09, ChatGPT (GPT-6). **Trạng thái:** PARTIAL, mở.
- **Đã làm:** lưu batch state và Task ID bền vững; chỉ một batch job đang chạy toàn server, trang batch ảnh/video, tiếp tục cảnh độc lập sau FAILED, UNKNOWN không tự retry. Initial CI run 42551209546 FAIL TS, sửa ở f3a9e7a; CI 42551746997 PASS.
- **Chưa làm:** FFmpeg MP4 nối cảnh, test actual provider E2E, map thiết bị/tab thật, resume sau restart/timeout, nhập batch output vào Canvas, bộ test queue/negative. `interrupted` cần xử lý thận trọng, không tự submit job mới cho UNKNOWN.


### ISSUE-0033 — HD-05 FFmpeg nối MP4 và ánh xạ Device/Tab cần nghiệm thu thật

- **Ngày/người sửa:** 2026-11-09, ChatGPT (GPT-6). **Trạng thái:** PARTIAL.
- **Đã sửa mã:** `apps/server/src/utils/media/batches.ts`, `apps/server/src/routes/ai/media/batches/merge.ts`, `apps/web/src/pages/workspace/components/batchPage.vue`.
- **Đã làm:** FFprobe xác minh nguồn rồi chỉ concat các cảnh MP4/MOV có codec/kích thước/kiểu audio tương thích; không ghi đè file; FFprobe lại file mới; lưu kết quả MP4 của batch. Ghi Device ID và Tab ID thực khi dispatch cho Chrome Bridge theo selection; serial global nên không chồng batch vào một tab.
- **Commit:** 2189906, 42adb19, 879c83a, 724aade, 4619c55.
- **Chưa nghiệm thu:** đoạn clip thực, codec/frame rate audio, hoạt động FFmpeg trên Mac Ventura, nhiều Chrome song song, xử lý hai người dùng/tiến trình, queue trạng thái task hiện tại cho Dashboard. E2E **BLOCKED** do chưa có môi trường Chrome/Render/FFmpeg thực.


### ISSUE-0034 — HD-06 runtime E2E, hệ thống queue, media import và Mac Ventura chưa nghiệm thu

- **Ngày/người sửa gần nhất:** 2026-11-09, ChatGPT (GPT-6). **Trạng thái: MỞ — PARTIAL.**
- **Code:** các phần `promptDrop.ts`, `promptInput.vue`, `materialPresetCatalog.ts`, `characterRecords.ts`, `media/tasks.ts` (read-only `inspect`), `media/batches.ts`, `batchTransitions.ts`, Canvas index/host, BatchPage/Workspace, workflow CI.
- **Đã kiểm thử:** regression Bun cho pure state, prompt drop ID/caret, catalog preset, ghi/đọc tệp Character JSON thật, MP4 fixture FFmpeg thật; [run 42556447168](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42556447168) PASS cho code ở thời điểm run. Các guard Chrome offline thêm sau đó cần CI riêng.
- **Đã sửa:** Asset Library và existing reference không bị `!material` chặn; batch restart không tự resume UNKNOWN; mọi cảnh SUCCESS mới đặt `completed`, lỗi khác thành `partial`; Chrome rớt trước submit sẽ bảo toàn queued Task ID và đưa batch sang `paused` kèm lý do. Kết quả batch đã có đường đi nhập node Canvas và ghi save.
- **Chưa hoàn tất:** Browser thao tác thực Undo/Redo/caret/payload ảnh-video, HTTP server và dự án reload, task backend restart có provider thật, concurrency đa thiết bị/tab/đa tiến trình, thử FFmpeg xuất MP4 bằng app, Chrome Muse/Gemini/ChatGPT đã đăng nhập, Render Relay, Mac Intel macOS 13; AI Center HD-07, Việt hóa 100% HD-08, desktop packaging HD-09.
- **Bảo vệ dữ liệu:** không xóa hồ sơ/canvas/cấu hình của người dùng; tất cả fixture/test ghi thư mục tạm. Kết quả E2E **NOT TESTED** khi chưa có log Mac/Chrome xác thực.
- **Bước kế tiếp:** theo [checklist Mac](./hd06MacAcceptance.md); chạy Web/Server local, test giao diện thật, tạo video provider thật, load/reload, kiểm hàng đợi thực và bổ sung unit/integration HTTP routes trên workspace thử nghiệm độc lập. Không tự retry UNKNOWN.


### ISSUE-0035 — HD-07 Chrome Bridge và một ảnh/video thật vẫn chưa được nghiệm thu

- **Ngày/người sửa mới nhất:** 2026-11-09, ChatGPT (GPT-6). **Trạng thái: PARTIAL / E2E BLOCKED**.
- **Đã sửa thực tế:** `chromeBridge/dispatchGuard.ts` + local/remote run chống cùng tab; quarantine UNKNOWN và cancelled chưa xác nhận; reset selections khi mất relay; rollback sai owner key; `chromeBridge/mediaSignature.ts` kiểm bytes trước ghi workspace; `chromeBridge/access.ts` test lại an toàn loopback/Origin; `/diagnostics` kết hợp trạng thái thực (Relay/Device/Extension/Tab/Model/task); UI trong AI Bridge.
- **Tests mới:** `dispatchGuard.test.ts`, `bridgeValidation.test.ts`, `mediaSignature.test.ts`, `access.test.ts` chạy trong GitHub Actions; phân biệt unit/security logic với E2E.
- **E2E chưa làm được:** Chrome Companion đã đăng nhập Muse/Gemini/ChatGPT thật; Render WSS/HTTPS owner pairing thật; 1 ảnh + 1 video file thật và checksum; Batch 5 ảnh 3 video và FFmpeg với clip AI; tab reload/Chrome mất mạng, snapshot dự án sau Mac restart. Cần dùng [quy trình Mac](./hd07MacAcceptance.md) và lưu log đã che token.
- **Cần tiếp tục:** integration HTTP/WS qua Relay thực, kiểm sống từng selector của website, xác nhận người dùng chọn model/chip và trạng thái online/bận/offline, test crash recovery, xác minh FFprobe codec/duration trên file tạo từ provider. Không đánh dấu DONE trước bằng chứng.


**ISSUE-0035 cập nhật 09/11/2026:** Đã code tái xác minh readiness khi trạng thái Bridge được refresh, ngăn tab UNKNOWN trở lại danh sách model sẵn sàng; test pure probe cho logout, sai documentToken/URL/capability. **Chưa nghiệm thu:** tab Muse/Gemini/ChatGPT thật và thời gian probe qua Render trên Mac, hồi quy đồng thời nhiều thiết bị/Chrome. Không đóng issue.


### ISSUE-0036 — HD-08: còn chuỗi tiếng Trung trong giao diện, prompt và dữ liệu dịch chưa đầy đủ

- **Ngày, AI sửa:** 2026-11-09, ChatGPT (GPT-6). **Trạng thái:** MỞ — PARTIAL, chưa E2E.
- **Đã sửa:** bật dịch ở nodeShared + toàn bộ 9 node UMD có sẵn; sửa alias build Vite, đồng bộ locale trên host, dịch Media Price/History/Node Error/Audio Settings; thêm prompt tiếng Việt riêng cho trợ lý giải thích lỗi và trợ lý tích hợp provider; thêm 254 khóa dịch trong các nhóm Image/Video/Audio/Director 3D; mở rộng `auditVietnamese.ts`, `vietnameseCoverage.test.ts`, CI audit.
- **Bằng chứng:** run 42563406550 PASS (43 test), audit tại commit 9cca37ca: 656 candidate còn thiếu trên phạm vi Web/nodeShared/nodeScaffold/nodes, 0 vi values chứa Hán tự, 0 parse error. Sau đó thêm 60 khóa nên đếm lại bằng CI mới.
- **Chưa thể đánh dấu DONE:** audit --strict còn fail; bản dịch thủ công còn thiếu ở nhiều phần Director/Video/Image/Camera Studio, hệ thống prompt khác, giao diện tùy biến/third-party plugin. `providerPromptVi` cần nghiệm thu hành vi thật bằng provider-agent UI; run trước có lỗi cú pháp, đã sửa ở b788552, cần chứng minh CI mới.
- **Ngôn ngữ lưu cũ:** cấu hình có thể lưu `ui.language = zh-CN` do người dùng từng chọn hoặc bản cũ; KHÔNG tự ghi đè lựa chọn lưu này khi chưa phân biệt được ý muốn, vì yêu cầu không thay dữ liệu người dùng. Trên Mac cần chủ động chọn Tiếng Việt tại Cài đặt một lần; lần sau giữ tùy chọn.
- **Việc tiếp theo:** tiếp tục xử lý danh sách `bun packages/i18n/src/auditVietnamese.ts`, bổ sung dịch còn thiếu và UI E2E, audit prompt ẩn riêng, đưa strict audit về 0 khi thực sự đủ. Không nhận 100% trước bằng chứng.


### ISSUE-0036 — HD-08 cần nghiệm thu UI runtime và khảo sát toàn bộ prompt ngoài phạm vi audit

- **Ngày/người sửa gần nhất:** 2026-11-09, ChatGPT (GPT-6). **Trạng thái: MỞ / PARTIAL.**
- **Đã kiểm tra và sửa:** 536 khóa UI thiếu tiếng Việt tại mốc audit ban đầu; cập nhật từ điển lên 4.884 mục, audit `--strict` toàn bộ `apps/web/src`, `packages/nodeShared/src`, `packages/nodeScaffold/src`, `packages/nodes`. CI #42567345816 PASS với 0 ứng viên UI thiếu, 0 giá trị dịch chứa chữ Hán, 0 lỗi parse. Việt hóa các prompt tạo media, phân tích video, vẽ lại, panorama, góc máy, ánh sáng và sub-agent; thêm regression tests.
- **Giới hạn cần nói rõ:** 0 **khóa còn thiếu trong tập ứng viên UI do máy phân tích nhận biết**, không phải 0 ký tự tiếng Trung trong repository. Nhánh ngôn ngữ Trung Quốc vẫn phải giữ để hỗ trợ người dùng chọn zh-CN. Không có cách đáng tin để kết luận mọi chuỗi UI/prompt ẩn tùy biến đều đã được phát hiện và dịch chỉ dựa trên kiểm thử tĩnh.
- **Cần nghiệm thu tiếp:** trên Mac Intel Ventura mở Web/Server; chuyển giữa `vi` → `en` → `vi`, kiểm tra giao diện từng node, thông báo lỗi, tooltip, lịch sử, Audio Generation, camera, thư viện vật liệu, Studio, lưu/mở lại; kiểm tra request gửi tới model thật với locale vi và payload user prompt không bị thay đổi. Phần browser và provider thật **NOT TESTED/BLOCKED**.


### ISSUE-0036 — HD-08 Việt hóa chưa đủ 100% nguồn giao diện và prompt ẩn

- **Ngày/người trực tiếp rà soát và sửa:** 2026-11-09, ChatGPT (GPT-6). **Trạng thái: MỞ — PARTIAL.**
- **Đã sửa code và kiểm thử CI:** dynamic Panorama Preview, Frame Analysis runtime messages, Video Player preview, provider tester errors/log placeholders/system repair prompt, 22 lỗi backend media, 10 khóa `vi.json`, test 9 node UMD sử dụng `localizeBuiltIn`. Đã bổ sung kiểm toán thành `dictionaryCoveredUnverified` và `noVietnameseDictionaryKey`.
- **Bằng chứng test:** [run #42587671929](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42587671929): 72 PASS, 0 FAIL, UI AST thiếu 0 key trong các phạm vi công bố. Bản cập nhật mới hơn tiếp tục đòi CI.
- **Vẫn thiếu:** xem xét 1.538 ứng viên literal tiếng Trung tại run nêu trên (836 có dictionary chưa rõ thực thi, 702 thiếu dictionary, gồm 61 dòng ứng viên liên quan prompt); xem thêm các gói plugin/skill, thông báo runtime không đi qua bộ i18n, xác thực mọi prompt ẩn và UI trình duyệt thật. Không tự dịch các identifier/schema/enum/API hoặc văn bản người dùng.
- **Kiểm thử trên Mac:** chưa mở ứng dụng trên Mac Ventura từ phiên hiện tại. Dùng [checklist](./hd08VietnameseAcceptance.md); kiểm tra vi→en→vi, reload, Panorama, Audio, Frame Analysis, model tester, Agent và hidden prompts thật.
- **Không đánh dấu DONE:** CI/AST PASS chỉ xác nhận phạm vi test, không chứng minh mọi màn hình và prompt đã Việt hóa.


### ISSUE-0037 — Nghiệm thu hai nút trên thanh công cụ chính của Canvas

- **Ngày/người sửa gần nhất:** 2026-11-09, ChatGPT (GPT-6). **Trạng thái:** CODED / chờ nghiệm thu trình duyệt.
- **Thay đổi:** [17262ce](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/17262ce1b474b4ad65ecfdd9dab58567d6e377e7) chuyển nút Thư viện vật liệu và Studio nhân vật đúng vị trí và nối callback xuyên qua Canvas Host; dialog cũ được giữ lại.
- **Cần xác minh:** mở từng cửa sổ từ thanh chính, không nút trùng, tạo preset node, thêm ảnh nhân vật, đổi Canvas/workspace và lưu/reload; [CI](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42591076127) phải PASS trước khi tính typecheck/build. Trình duyệt Mac chưa được thử trực tiếp.


- **Cập nhật ISSUE-0037, 2026-11-09, ChatGPT (GPT-6):** `IconShapes` gây CI TS2724 đã sửa bằng `IconShape` tại [4aa196f](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/4aa196f661a0df1559b229a34ede4242a8631982), CI [42591313409](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42591313409) SUCCESS. Bổ sung test hợp đồng đường nối Canvas + Home Batch tại [8293dc3](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/8293dc3cbe3843b23a44048df01de434a0c46c3f), CI [42591976160](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42591976160) SUCCESS. **Vẫn MỞ**: UI Mac click, dialog, chọn dự án, lưu/reload và media thật chưa được chạy; không coi source-contract PASS là E2E.


### ISSUE-0038 — Nghiệm thu release riêng và Batch lifecycle trên Mac
- **Người sửa gần nhất:** ChatGPT (GPT-6), 2026-11-09. **Trạng thái: PARTIAL / UI NOT TESTED**.
- Đã xác nhận `release/toonflow-two-commits` trỏ `c73a5e40`, parent duy nhất là commit nguyên gốc `b325d961`, snapshot giống integration `661cdb0`. GitHub Actions không có run riêng trên release tại thời điểm kiểm tra. Không được lấy CI của nhánh khác làm chứng cứ nghiệm thu độc lập release.
- Tạo nhánh `feat/toonflow-functional-completion` từ release; bổ sung trigger push CI riêng trên nhánh phát triển (không sửa workflow release), sửa race model fetch trong Batch `73e1731`, thêm kiểm tra regression `f866d62`. Run mới: https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42599007281 (chưa xác nhận kết luận ở lúc ghi).
- **Còn thiếu:** chạy ứng dụng Mac thật, đổi workspace trong lúc model HTTP pending; xác minh model/queue không giao nhau, save/reload, UI click; nghiệm thu Chrome Companion VM, video/FFprobe thực, và 206-item audit file (không thấy trong Git tree `c73a5e40`).
- **An toàn:** không gửi AI prompt có phí, không thay đổi Render, không xóa workspace, không merge PR #4.


### ISSUE-0039 — Chrome Bridge diagnostic state sau rớt kết nối: chờ nghiệm thu UI/VM
- **Ngày/người sửa gần nhất:** ChatGPT (GPT-6), 2026-11-09. **CODED + CI TESTED, UI NOT TESTED**.
- `dispatchGuard.ts` đã sửa để offline ưu tiên stale task, và tab không có capability sẽ không được báo ready; regression mới trong `dispatchGuard.test.ts`. CI từng commit mã: [42607487305](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42607487305) và [42607808516](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42607808516) SUCCESS.
- Smoke GET read-only cho Web, Workspace, Bridge ở `bun scripts/smokeLocal.ts` (chỉ chạy sau khi mở server/web trên Mac). Không phải Playwright và không chứng minh tương tác thật.
- **Cần tái hiện/kiểm chứng trên máy chủ sở hữu:** Ngắt rồi nối lại Extension/VM, xác nhận offline/ready, tab/capability và task UNKNOWN, tạo thử media chỉ với đồng ý riêng của chủ tài khoản. Mac browser, Media node reload và queue restart vẫn NOT TESTED.
