# 📝 KHU VỰC 3 — LƯU Ý QUAN TRỌNG

**Tác dụng với người dùng:** xem các điều cần nhớ trước khi sửa, build hoặc phát hành ứng dụng.

**Tác dụng với AI tiếp nhận:** lưu quyết định, hạn chế và các ràng buộc không được bỏ qua. Mỗi lưu ý phải ghi nguồn, người ghi và phạm vi; lưu ý không phải là danh sách việc đã làm hoặc danh sách bug.

[← Về bảng điều hướng](./overview.md) · [Việc đã làm](./completedWork.md) · [Vấn đề tồn tại](./openIssues.md)

### NOTE-0001 — Mỗi AI phải lưu bằng chứng và tự ký tên

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Quy tắc:** Mỗi thay đổi mã phải được ghi vào `completedWork.md`, kể cả sửa lỗi nhỏ; cập nhật vấn đề còn mở ở `openIssues.md` sau sửa; ghi phát hiện mới tại đây.
- **Lý do:** AI tiếp theo biết ai đã thay đổi, không nhầm người yêu cầu với người viết code và không suy đoán mức độ hoàn tất.
- **Phạm vi:** toàn repository.
- **Nguồn:** yêu cầu của chủ dự án trong cuộc trò chuyện hiện tại.

### NOTE-0002 — Giữ nguyên hướng dẫn kỹ thuật và giới hạn an toàn của repo

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Quy tắc:** trước khi phát triển đọc `AGENTS.md` và các chỉ dẫn liên quan; file/thư mục mới dùng kiểu `lowerCamelCase`; không tự thêm test module trái quy định; không xóa dữ liệu OSS/database trực tuyến khi chưa được người dùng xác nhận từng thao tác.
- **Phạm vi:** phát triển.
- **Nguồn:** [AGENTS.md](../../AGENTS.md).

### NOTE-0003 — Phân biệt source code, build và tính năng đã chạy thật

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Quy tắc:** tìm thấy component / event handler / API không đủ để kết luận đã chạy thành công. Ghi riêng: có trong mã, đã build, đã chạy chức năng UI, đã test yêu cầu AI.
- **Phạm vi:** kiểm thử và bàn giao.
- **Nguồn:** phân tích source trong repository.

### NOTE-0004 — macOS Intel cần chú ý phiên bản hệ điều hành

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Thông tin:** README/development guide của phiên bản hiện tại ghi desktop macOS yêu cầu **macOS 14 trở lên**, cả Intel và Apple Silicon.
- **Phạm vi:** build và tương thích.
- **Nguồn:** [README.md](../../README.md), [docs/development.md](../development.md).
- **Cần làm:** muốn hỗ trợ macOS cũ hơn cần kiểm tra lại SDK, runtime và thử trên máy thật; không khẳng định có thể chạy chỉ vì tạo được DMG.

### NOTE-0005 — Không coi công cụ browser là Chrome Extension / remote relay

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Thông tin:** `packages/tools/browser/` có công cụ thao tác Chrome/Edge bằng Agent trên máy. Chưa tìm thấy Chrome Extension chuyên dùng chuyển tác vụ tạo ảnh qua relay giữa máy trong lần kiểm tra.
- **Phạm vi:** thiết kế tích hợp AI.
- **Nguồn:** [browser tool](../../packages/tools/browser/readme.md).
- **Cần làm:** nếu cần extension/relay, phải thiết kế và xác minh riêng; không gắn nhãn “đã có” khi mới có browser automation.

### NOTE-0006 — Quyền truy cập server và API Key

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Thông tin:** README nêu cổng 3000 của bản server độc lập không có lớp đăng nhập nghiệp vụ riêng; phải có tường lửa/proxy xác thực nếu công khai. Dịch vụ tạo ảnh/video/audio cần mô hình/nhà cung cấp khả dụng và có thể phát sinh phí.
- **Phạm vi:** bảo mật, vận hành và kết nối AI.
- **Nguồn:** [README.md](../../README.md).
- **Quy tắc:** không bao giờ commit khóa hoặc token vào tài liệu công khai.

### NOTE-0007 — Thông tin tác giả gốc và giấy phép

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Thông tin:** source của repo hiện nhận diện upstream `HBAI-Ltd/Toonflow-app`, giấy phép MIT; khi sửa nhận diện hoặc phân phối lại vẫn phải giữ các thông báo giấy phép/bản quyền áp dụng.
- **Phạm vi:** phân phối / phát hành.
- **Nguồn:** [LICENSE](../../LICENSE), [package.json](../../package.json).

### NOTE-0008 — Kiến trúc AI Bridge tự viết, không sao chép GPL

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Quyết định:** giữ Bun/Electrobun, không Electron, không Canvas khác; adapter `apps/server/src/utils/chromeBridge` + MV3 Chrome `packages/chromeCompanion`, chỉ ba AI. Nguồn `workflow` GPL-2.0-or-later dùng tham khảo hành vi/giao thức, không sao chép.
- **Luồng:** Node gốc → API desktop hoặc mediaTasks gốc → loopback websocket ghép nối → extension → tab người dùng chọn → kết quả → workspace/output gốc. Text Node: Gemini/ChatGPT; Image: Muse/Gemini/ChatGPT nếu giao diện có; Video: Muse nếu có.
- **Bằng chứng:** [nhánh code](https://github.com/mktminhqpbga-glitch/ToonFlow-App/tree/feat/chromeBridgeMuseGeminiChatgpt).

### NOTE-0009 — Bảo toàn dữ liệu, trạng thái không chắc chắn

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Quy tắc:** mỗi request có UUID, provider/tab, nodeId; media còn có canvas/workspace gốc do `useNodeGeneration` quản lý. File media lưu bằng `writeWorkspaceFile` pipeline hiện có, không đưa base64 vào JSON Canvas; output cũ không mất khi tải file lỗi. Sau khi đã gửi mà mất kết nối/timeout: **không tự gửi lại**. Reopen media job bị gián đoạn phải yêu cầu người dùng xác minh tab.
- **Giới hạn:** MV3 worker/job in-memory chưa chứng minh khả năng khôi phục sau restart; cần test thật. Bộ trạng thái gần nhất trong memory chỉ lưu ID, provider, tab, node ID và trạng thái, tối đa 20 mục; đóng app sẽ xóa. Lệnh cancel thử bấm nút Stop của website nhưng không thể bảo đảm AI đã hủy ở máy chủ. Thông báo hết lượt được nhận diện bằng DOM và cũng cần kiểm chứng.

### NOTE-0010 — Giữ giao diện, chủ đề và tài khoản

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Quy tắc:** dùng Settings gốc Element Plus + màu `--el-*`; model selector và output/history/preview node gốc; không nhúng website AI; không đổi bố cục, ngôn ngữ hoặc kích thước Canvas. Light/dark cần kiểm thử.
- **Quy tắc dịch vụ:** không khai báo video cho Gemini/ChatGPT. Chức năng hình ảnh chỉ hiển thị khi probe tab phát hiện nút có khả năng. Đăng nhập Chrome không đồng nghĩa quyền API. Không vượt CAPTCHA/giới hạn tài khoản.

### NOTE-0011 — Bảo mật và phạm vi macOS

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Quy tắc:** chỉ bật Bridge khi host desktop macOS, không mở listener ở server/Web/Android/Windows/Linux. WebSocket chỉ `127.0.0.1`; Origin extension + mã ghép nối ngẫu nhiên; chỉ domain Muse (gồm `*.muse.ai`), Gemini và ChatGPT; không thu cookie, token, mật khẩu hoặc dữ liệu đăng nhập; không ghi token pairing vào log/repo.
- **Giới hạn:** mã ghép nối được đổi ngay khi phiên Chrome được chấp nhận; người dùng phải sao chép mã mới sau khi ngắt. Cần kiểm toán bảo mật và điều khoản sử dụng khi phát hành.

### NOTE-0012 — Chưa có nghiệm thu thực tế

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Xác minh:** files trên GitHub và cú pháp JavaScript/JSON extension bằng parser.
- **Chưa xác minh:** TypeScript/Vue typecheck, desktop build, 3 tab AI thật, bất kỳ media được tạo, lưu/mở project, toàn bộ UI light/dark và provider API cũ. Không được đánh dấu tính năng là hoàn thành khi chỉ mới được commit. Tiếp tục ở `ISSUE-0005`–`ISSUE-0008`.

### NOTE-0013 — Phân tách Local/Remote đúng nguồn và giữ nguyên ba AI

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Kiến trúc:** `manager.ts` chuyển giữa Local Bridge `runtime.ts` trên `127.0.0.1` và Remote Bridge `remote.ts` qua Render; không thay node model/provider và output hiện có. Render chỉ làm Web Service, không chạy Chrome, không tạo ảnh/video. Chrome có thể ở Windows/macOS/Linux; Mac vẫn dùng Electrobun.
- **Phạm vi:** Muse, Gemini, ChatGPT đã có trong PR #1; không dùng Electron, không có Canvas thứ hai, không sao chép GPL. PR #2 Việt hóa không bị merge/chỉnh sửa.
- **Nguồn:** [commit Remote](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/0db8ec285034cd8b7779e3e029f1409c31c314d3).

### NOTE-0014 — TLS khác mã hóa E2E, bí mật ghép nối và khóa lâu dài

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Thiết kế:** TLS/WSS dùng kênh mạng ra Render; AES-256-GCM được thực hiện giữa Mac và Chrome trước khi chuyển cipher frame qua Relay. Mã 32 byte ngẫu nhiên nằm trong fragment `#...` của pairing code, **không gửi Relay qua API**; Render chỉ biết pair ID, chủ sở hữu, token hash, tên và metadata. Mac lưu relay owner key/secret trong `settings.json` 0600, Chrome lưu device token+secret trong `chrome.storage.local` chỉ tin cậy của extension.
- **Quy tắc:** không log prompt/media/password/cookie, không gửi key AES cho Render; phải review an toàn với phiên chạy thật và giới hạn lưu trữ.

### NOTE-0015 — Durability và chính sách không tự gửi prompt lặp

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Thiết kế:** bảng token hash/thiết bị lưu SQLite. Khi `RELAY_DB_PATH` nằm trên đĩa persistent của Render sẽ lưu qua restart; Free ephemeral mất DB, cần ghép lại. Queue frame ở RAM có giới hạn và **không khôi phục sau restart**. `run` có request ID, Chrome lưu ledger trước khi gửi tab, transport chỉ retry khối bị từ chối do backpressure; trạng thái không chắc chắn sau ngắt phải tra tab chứ không tự gửi lại.
- **Giới hạn:** bảo đảm hoạt động phải kiểm thử WSS/HTTPS thực tế, không gọi đây là đã chạy chỉ do parser/code qua kiểm tra.

### NOTE-0016 — UI bản Remote chờ duyệt Việt hóa và không ảnh hưởng Local

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Quy tắc:** thêm panel Render trong Settings Chrome Bridge đang có, dùng Element Plus + token/theme cũ. Không sửa bố cục Canvas, nhãn node, ngôn ngữ gốc. Chuỗi Remote UI chưa có bản dịch `vi` duyệt được ghi thành từng ID ở `remoteUiStringsPending.md`; không tự dịch. Khi nhánh Việt hóa PR #2 cần kết hợp, phải review/resolve riêng, không tự merge.
- **Nguồn:** [bảng UI chờ duyệt](./remoteUiStringsPending.md), [PR #1](https://github.com/mktminhqpbga-glitch/ToonFlow-App/pull/1), [PR #2](https://github.com/mktminhqpbga-glitch/ToonFlow-App/pull/2).

### NOTE-0017 — Nguồn và giới hạn hợp nhất Việt hóa vào nhánh độc lập

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Quy tắc:** không ghi đè bản Việt đã duyệt từ `feat/vietnameseApprovedPromptsV1`, không đổi prompt nguồn ngoài 127 ID. 10 cặp tên node/menu thêm trong chỉ thị tích hợp là các bản dịch đã duyệt. Hai chuỗi `3D导演台`, `逐帧拉片` mới có khóa `vi.json`, không sửa locale khác.
- **Conflict:** `Text Node` đồng thời chỉnh chức năng Chrome ở PR #1 và ngôn ngữ ở PR #2; đã kết hợp nội dung thay vì chọn một file nguyên vẹn.
- **Lưu trữ nguồn:** sổ `docs/aiNotes/historyVietnameseV1/` giữ bản gốc từ nhánh PR #2; không đổi số thứ tự ID cũ trên PR đó.
- **Chưa kiểm tra runtime:** không đóng ISSUE cho đến khi có log compile và chạy macOS/Web Ventura.

### NOTE-0018 — Web Ventura chỉ mở Remote Bridge khi backend an toàn

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Quyết định:** chạy `bun run dev:server:local` và `bun run dev:web:local` trên Mac Intel Ventura. Vite/Express bind loopback; server host Mac và env opt-in. Web được dùng Render Remote Mode; local WebSocket Chrome vẫn riêng cho Desktop. Frontend Settings không tự bật tính năng nếu không đọc được endpoint backend.
- **Lưu ý bảo mật:** proxy Vite gắn `x-toonflow-local-client` cho request loopback; kiểm cả Origin/Referer và source socket. Cần test cross-origin, không tin rằng `127.0.0.1` riêng đủ nếu có reverse proxy.
- **Nguồn:** [commit](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/d1f4598993e7785a2ecfe348977fb94e0e0a9403), [hướng dẫn Ventura](../../docs/independentDistribution.md).

### NOTE-0019 — Mọi kênh thương mại upstream phải là opt-in

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Quyết định:** `channelRequest` trả 503 mặc định, bật `TOONFLOW_LEGACY_CHANNEL=1` mới cho phép gọi dịch vụ ToonFlow gốc. Home không mount quảng cáo/Explore, route quảng cáo trả rỗng; không xóa hệ thống provider/Canvas hoặc sửa phương thức thanh toán bên thứ ba.
- **Chưa đủ:** các module mạng khác chưa quét hết, có thể còn truy vấn upstream; cần audit network capture thực tế. Tên/identifier thương hiệu, updater native và bản phát hành phải kiểm tra tiếp.

### NOTE-0020 — Kiểm soát bản dịch, giấy phép và mức xác nhận

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Dịch:** chỉ áp dụng 127 ID V1 và 10 tên menu đã duyệt; 20 chuỗi Remote là **đề xuất chờ duyệt**, không tự áp dụng; không đổi prompt/token AI, không mất các locale khác. Giao diện Home/Settings dùng từ điển `vi.json` hiện có.
- **Phát hành:** dùng GitHub fork cho mã/issues/update fallback, giữ MIT và tác giả HBAI-Ltd, không gắn nhãn sở hữu độc quyền. `@toonflow/*` là namespace nội bộ hợp lệ, không cần đổi toàn bộ. Không merge PR Draft khi chưa test.
- **Nguồn:** [báo cáo kiểm kê](../../docs/integrationAudit.md), [hàng chờ dịch](./translationApprovalQueue.md), [commit](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/d1f4598993e7785a2ecfe348977fb94e0e0a9403).

### NOTE-0021 — Kết quả kiểm thử GitHub Actions phải phân loại theo giai đoạn

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Phân biệt:** GitHub `setup-bun` tải thất bại do HTTP 504 **không** tương đương code không compile. Lỗi `bun install --frozen-lockfile` do thêm workspace `chromeRelay` mà chưa cập nhật lockfile đã được xử lý trong commit `63e003c8`, nhưng chỉ gọi là khắc phục khi run mới PASS.
- **Kiểm thử:** GitHub Actions Linux không thay thế kiểm thử Web macOS Ventura Intel, Electrobun macOS14+ hay Chrome/Render/account AI thật.
- **Nguồn:** [CI run #1](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42467297410), [CI run #2](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42467506307).

### NOTE-0022 — CI Linux đã đạt, không đồng nghĩa kết nối AI hoặc macOS đã nghiệm thu

- **Ngày:** 2026-11-08 (UTC+7) · **Người ghi:** ChatGPT (GPT-6).
- **Thực tế xác minh:** PR #4 có [CI PASS run #42481958013](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42481958013) tại [commit e02e4833](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/e02e4833a190626ecb649123a5b2cfa5db50b86d), với Bun frozen install, cú pháp Companion/Relay, typecheck 7 workspace và build từng nhóm Tools/Ext/Nodes/MCP/Web/Server.
- **Ranh giới:** build Linux và typecheck không kiểm chứng ứng dụng Web thực chạy trên macOS 13 Intel, lưu Canvas/Nodes/media, Render Relay WSS/HTTPS, Muse/ChatGPT/Gemini login/account/adapter, hay DMG. **Không chuyển PR #4 khỏi Draft và không merge main** trước khi các bài thử end-to-end đạt.
- **Quyết định kỹ thuật:** lỗi `FileNotFound` khi Bun `--filter` workspace camelCase được tránh bằng build từng thư mục, tương tự script `apps/server/scripts/buildStandalone.ts`. Script mới chỉ sửa generated build outputs, không thay đổi tool logic.
- **Cần xác minh lại:** mọi lần thay script/build dependency, và khi kiểm thử Mac/Render thật.

### NOTE-0023 — Camera Studio mặc định là chỉ dẫn AI; DOF 3D chưa hỗ trợ

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Quy tắc:** `buildCameraInstructions` trả chuỗi trống khi disabled; không sửa `node.data.prompt`. Phong cách Sony/ARRI/RED/Blackmagic, lens, aperture là hướng dẫn visual, không mô phỏng máy vật lý. Preset dùng chung lưu trên localStorage của **chính browser**, không tự đồng bộ cloud hoặc các thiết bị. Snapshot sau khi asset lưu nằm trong `node.data.cameraHistory` theo đường dẫn file.
- **Director 3D:** chỉ focalLength gọi `PerspectiveCamera.setFocalLength` và ghi FOV theo camera gốc; aperture không bật hiệu ứng chiều sâu renderer. Scene document thêm metadata tùy chọn và không gửi vào `threejson`. Runtime 3D và lưu scene chưa được nghiệm thu.
- **Nguồn:** [Camera Studio source](../../packages/nodeShared/src/cameraStudio.ts), [3D editor](../../packages/nodes/director3dNode/src/sceneEditor.vue), [run CI](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42493990963).

### NOTE-0024 — Tỷ lệ Chrome phải phân biệt ý định prompt với điều khiển native

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Quyết định:** Chrome imageRatios gồm năm tỷ lệ **mong muốn** sau kiểm tra type adapter, được gửi trong prompt, không điều khiển trực tiếp tỉ lệ nếu UI website không chứng minh được. Ảnh trả về phải kiểm kích thước sau khi tải thành file và mở preview; ratioMatched có dung sai 2.5%, không bảo đảm tuyệt đối. Video cần source `<video>`, MIME media hợp lệ, kích thước/positive duration, không nhận poster đơn thuần.
- **An toàn:** Extension probe lại mode/tab và khóa `expectedUrl` bằng exact URL trước khi submit, không tự retry job không xác nhận. Kiểm chứng này là **code + CI**, chưa phải bằng chứng Chrome account thật.
- **Nguồn:** `apps/server/src/utils/chromeBridge/ratio.ts`, `packages/chromeCompanion/{background.js,content.js}`; [bảng nghiệm thu](./cameraStudioAcceptance.md).

## Mẫu lưu ý mới

### NOTE-xxxx — Tên lưu ý

- **Ngày:** YYYY-MM-DD HH:mm (UTC+7)
- **Người ghi / AI:** [tên và model]
- **Thông tin hoặc quyết định:** [mô tả chính xác]
- **Lý do / ảnh hưởng:** [vì sao AI khác cần biết]
- **Phạm vi:** [đường dẫn, module hoặc toàn dự án]
- **Nguồn / bằng chứng:** [file/commit/yêu cầu trực tiếp]
- **Có cần xác minh lại không?:** Có/Không; [khi nào]

### NOTE-0025 — Phạm vi Việt hóa mới và cấu hình bản độc lập

- **Ngày:** 2026-11-08 (UTC+7). **Người ghi:** Codex (GPT-6).
- **Nguồn:** yêu cầu tổng tiếp quản hiện tại cho phép dịch UI và prompt tích hợp bằng tiếng Việt, thay cho giới hạn hàng chờ dịch trước đây. Không dịch nội dung người dùng, ID, schema hoặc giao thức.
- **Cấu hình:** Web mặc định locale vi; VITE_TOONFLOW_DEFAULT_LOCALE cho phép locale khác hoặc system. Giá trị ngôn ngữ người dùng đã lưu được giữ. VITE_TOONFLOW_LEGACY_UI=1 cho phép hiển thị tài khoản upstream; publicWeb giữ luồng tài khoản nhiều người thuê.
- **Font:** Be Vietnam Pro 5.3.0 từ @fontsource/be-vietnam-pro, SIL OFL kèm nguồn; các subset latin/latin-ext/vietnamese và trọng lượng 400/500/600/700 được phục vụ nội bộ, không cần Google Fonts.

### NOTE-0026 — Khóa phiên tab và đối chiếu kết quả Bridge 0.2.0

- **Ngày/người ghi:** 2026-11-08 (UTC+7), Codex (GPT-6).
- **Quyết định:** selection/run/result đối chiếu documentToken theo mỗi content document, URL chính xác, Task/Provider/Tab và frame 0. Không gọi API đổi URL/active tab. Reload dù cùng URL cần chọn/kiểm tra lại tab.
- **Nhận kết quả:** receipt prompt phải khớp, không chấp nhận user turn khác; giữ anchor hội thoại, chặn URL media lịch sử, kiểm lại sau download. Khi site không cho đủ bằng chứng (DOM ảo hóa, prompt trùng không có ID ổn định), từ chối/UNKNOWN thay vì đoán.
- **Chống lặp:** lịch sử Task ID của Extension dùng chung Local/Remote, ghi tuần tự trước dispatch, không tự hết hạn. Giới hạn 20.000 bản ghi thì chặn gửi; không tự xóa lịch sử để tiếp tục. Chỉ lưu ID/thời điểm, không lưu nội dung hay credential.
- **Tương thích:** backend và Extension 0.2.0 phải cập nhật cùng nhau; tải lại tab AI sau Reload Extension. Extension cũ không có documentToken bị từ chối an toàn.
- **Giới hạn:** các kiểm tra DOM kiểm soát, worker giả lập và Local WS không thay thế AI/Render/Mac E2E. Không cam kết ngăn người dùng tự đổi tab; cam kết phần mềm không tự đổi và không tiếp tục nhận kết quả khi mất dấu phiên.
