# ✅ KHU VỰC 1 — NHỮNG VIỆC ĐÃ LÀM

**Tác dụng với người dùng:** biết chính xác ai đã sửa gì, khi nào, ở đâu và đã kiểm tra đến mức nào.

**Tác dụng với AI tiếp nhận:** đọc lịch sử trước khi sửa để tránh làm trùng, xóa nhầm chức năng, hoặc tuyên bố hoàn thành sai. Chỉ ghi thay đổi thực sự đã được lưu; việc dự định làm không được coi là đã làm.

[← Về bảng điều hướng](./overview.md) · [Vấn đề tồn tại](./openIssues.md) · [Lưu ý quan trọng](./importantNotes.md)

## Các việc đã ghi nhận

### DONE-0001 — Thiết lập ba khu vực ghi chú và hướng dẫn cho AI

- **Ngày:** 2026-11-08 (UTC+7)
- **Người thực hiện nội dung:** ChatGPT (GPT-6)
- **Phạm vi:** tài liệu trong repository; **không thay đổi logic ứng dụng**.
- **Các tệp:** `docs/aiNotes/overview.md`, `docs/aiNotes/completedWork.md`, `docs/aiNotes/openIssues.md`, `docs/aiNotes/importantNotes.md`, `README.md` và `AGENTS.md`.
- **Đã làm:** chia ba khu vực riêng; thêm trường tác giả, người sửa cuối, trạng thái, bằng chứng; hướng dẫn ghi log sau mỗi lần thay đổi; liên kết ở trang chính repo cho AI/người dùng xem.
- **Bằng chứng:** [commit khởi tạo sổ ghi chú](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/cd6ee3f6c9e8a15ce8c3cf2bd9443e3f443f3e13), [README.md](../../README.md), [AGENTS.md](../../AGENTS.md).
- **Kiểm tra:** xác minh việc lưu và đường dẫn file trên GitHub sau khi commit; không chạy kiểm thử giao diện/AI vì thay đổi chỉ là tài liệu.
- **Trạng thái:** Đã ghi vào repo; chưa kiểm thử ứng dụng.
- **Vấn đề liên quan:** `ISSUE-0001` đến `ISSUE-0004` được ghi để theo dõi, không được coi là đã khắc phục.

### DONE-0002 — Kiểm tra việc lưu tài liệu và sửa liên kết bằng chứng

- **Ngày:** 2026-11-08 (UTC+7)
- **Người trực tiếp sửa:** ChatGPT (GPT-6)
- **Phạm vi:** chỉ tài liệu nhật ký, không sửa ứng dụng.
- **Các tệp thực sự sửa:** `docs/aiNotes/completedWork.md`.
- **Đã làm:** xác nhận cả 6 tệp trong lần khởi tạo tồn tại trên nhánh `main`; đổi liên kết commit đầu tiên từ đường dẫn tương đối sang URL commit đầy đủ.
- **Bằng chứng:** [Lịch sử cập nhật tệp này](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commits/main/docs/aiNotes/completedWork.md).
- **Đã kiểm tra:** đọc lại 4 tệp ghi chú, `README.md` và `AGENTS.md` từ GitHub sau lần commit trước.
- **Chưa kiểm tra:** giao diện và mô hình AI của ứng dụng.
- **Vấn đề sau khi sửa:** `ISSUE-0001` đến `ISSUE-0004` vẫn chưa xử lý.
- **Trạng thái:** Đã ghi vào repo; chưa kiểm thử ứng dụng.

### DONE-0003 — Mã AI Bridge và Chrome Companion cho macOS

- **Ngày:** 2026-11-08 (UTC+7)
- **Người trực tiếp thực hiện:** ChatGPT (GPT-6), không mặc định chủ repository là tác giả logic.
- **Trạng thái:** Đã viết code và lưu trên nhánh `feat/chromeBridgeMuseGeminiChatgpt`; **chưa nghiệm thu hoạt động thực tế**.
- **Thay đổi:** Local Bridge Bun WebSocket loopback/pairing; Chrome Companion MV3 tự viết; phân biệt tab và capability của Muse/Gemini/ChatGPT; Settings dùng component Element Plus và biến màu ToonFlow; Text Node Gemini/ChatGPT; Image Generation Node Muse/Gemini/ChatGPT; Video Generation Node Muse; media đi qua framework lưu file/output/history gốc.
- **Các file thêm:** `apps/server/src/utils/chromeBridge/runtime.ts`, `apps/server/src/utils/chromeBridge/router.ts`, `apps/web/src/components/settings/panels/chromeBridge/index.vue`, `packages/chromeCompanion/manifest.json`, `background.js`, `content.js`, `popup.html`, `popup.js`, `readme.md`.
- **Các file sửa:** `apps/server/src/app.ts`, `apps/server/package.json`, `apps/server/src/utils/media/generation.ts`, `apps/desktop/src/index.ts`, `apps/web/src/components/settings/index.vue`, `packages/nodes/textNode/src/index.vue`, `electrobun.config.ts`, `README.md`; ngoài ra cập nhật ba sổ `docs/aiNotes`.
- **Mã tham khảo:** `mktminhqpbga-glitch/workflow` chỉ được nghiên cứu về hành vi/giao thức (GPL-2.0-or-later), không chép mã GPL vào dự án MIT.
- **Bằng chứng:** [commit mã nguồn đầu tiên](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/df9ab12fc93c385660a2f850507566f3a4e63a8d), [toàn bộ lịch sử nhánh](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commits/feat/chromeBridgeMuseGeminiChatgpt).
- **Kiểm tra đã thực hiện:** so sánh mã nguồn với pipeline gốc; xác minh 4 sổ/file ghi chú cũ không mất; kiểm tra parser JavaScript cho `background.js`, `content.js`, `popup.js` và JSON manifest (đều parse được); đọc lại các file GitHub sau commit.
- **Chưa thực hiện:** Bun typecheck, Vue/Vite build, Electrobun macOS build/DMG, mở GUI, đăng nhập Chrome, gọi AI thật, lưu/mở lại project, kiểm thử chính xác media và provider cũ. Không có Bun/macOS hay phiên đăng nhập để xác minh tại môi trường hiện tại.
- **Lỗi hoặc rủi ro chưa đóng:** `ISSUE-0005`–`ISSUE-0008`; các ISSUE cũ vẫn giữ nguyên.
- **Mục đích bàn giao:** AI sau phải kiểm tra thật trước khi đánh dấu hoàn thành tính năng, ghi mọi sửa đổi kế tiếp vào đây.

### DONE-0004 — Bổ sung subdomain Muse vào allowlist

- **Ngày:** 2026-11-08 (UTC+7) · **Người sửa:** ChatGPT (GPT-6).
- **Thay đổi:** xác nhận manifest của nguồn tham khảo dùng cả `muse.ai` và `*.muse.ai`; bổ sung giới hạn đúng subdomain Muse vào `runtime.ts`, `background.js`, `content.js`, `manifest.json`; bổ sung selector nút gửi/dừng của composer Muse. Không thêm provider mới.
- **Kiểm tra:** so sánh manifest tham khảo; phân tích cú pháp JavaScript và manifest sau sửa bằng parser. **Chưa chạy Muse thật / macOS build**.
- **Bằng chứng:** [lịch sử nhánh](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commits/feat/chromeBridgeMuseGeminiChatgpt).
- **Vấn đề tiếp tục mở:** `ISSUE-0005`, `ISSUE-0006`.
- **Trạng thái:** Đã viết mã, chưa nghiệm thu.

### DONE-0005 — Thu hồi mã ghép nối sau khi Chrome kết nối

- **Ngày:** 2026-11-08 (UTC+7) · **Người sửa:** ChatGPT (GPT-6).
- **Đã sửa:** `apps/server/src/utils/chromeBridge/runtime.ts`, tạo lại mã ghép nối ngay sau xác thực WebSocket thành công. Mã cũ không còn dùng để ghép nối sau khi ngắt.
- **Đã kiểm tra:** đối chiếu luồng auth/close trong mã. **Chưa test thực tế với Chrome/macOS**.
- **Bằng chứng:** [lịch sử nhánh](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commits/feat/chromeBridgeMuseGeminiChatgpt).
- **Trạng thái:** Đã viết mã, chưa nghiệm thu; `ISSUE-0008` vẫn mở.

### DONE-0006 — Hiển thị trạng thái hoàn thành và lỗi của tác vụ gần nhất

- **Ngày:** 2026-11-08 (UTC+7) · **Người sửa:** ChatGPT (GPT-6).
- **Các file sửa:** `apps/server/src/utils/chromeBridge/runtime.ts`, `apps/web/src/components/settings/panels/chromeBridge/index.vue`, hai sổ ghi chú.
- **Đã làm:** lưu tối đa 20 trạng thái kết thúc **chỉ chứa metadata** (không prompt/media), Settings hiển thị `connecting`, `ready`, `submitting`, `running`, `completed`, `failed`, `cancelled`, `disconnected`, `idle`; xóa lịch sử trạng thái khi chọn/ngắt provider.
- **Bằng chứng:** [lịch sử nhánh](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commits/feat/chromeBridgeMuseGeminiChatgpt).
- **Kiểm tra:** đọc logic trạng thái từ mã, chưa kiểm tra GUI/macOS thực.
- **Trạng thái:** Đã viết, chưa nghiệm thu; `ISSUE-0006` vẫn mở.

### DONE-0007 — Hủy tốt nhất trên website và nhận diện giới hạn

- **Ngày:** 2026-11-08 (UTC+7) · **Người sửa:** ChatGPT (GPT-6).
- **File sửa:** `packages/chromeCompanion/content.js`, các sổ ghi chú.
- **Đã sửa:** khi người dùng hủy, hủy watcher local và thử bấm nút Stop hiện có trên tab; phát hiện cảnh báo rate limit/usage limit mới sau yêu cầu; không gửi lại tự động.
- **Đã kiểm tra:** parse cú pháp JS thành công. **Chưa chứng minh nút Stop hoạt động hoặc nhận diện lỗi thật trên ba website**.
- **Bằng chứng:** [lịch sử nhánh](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commits/feat/chromeBridgeMuseGeminiChatgpt).
- **Trạng thái:** Đã viết mã, chưa nghiệm thu; ISSUE-0005/0008 vẫn mở.

### DONE-0008 — Thêm mã Render Relay và Remote Chrome Bridge trên nhánh PR riêng

- **Ngày:** 2026-11-08 (UTC+7) · **Người trực tiếp thực hiện:** ChatGPT (GPT-6). Tài khoản dùng để commit không tự động được coi là người viết logic.
- **Phạm vi:** Chỉ `Muse`, `Gemini`, `ChatGPT` qua Chrome cục bộ hoặc Chrome máy khác/VM. Kế thừa `feat/chromeBridgeMuseGeminiChatgpt`/PR #1; không đụng `main`, không merge PR #1 hay PR #2.
- **Thêm:** `apps/chromeRelay/server.js`, `package.json`, `dockerfile`, `readme.md`, `render.yaml`, `apps/server/src/utils/chromeBridge/manager.ts`, `remote.ts`, `remoteTransport.ts`, `packages/chromeCompanion/remoteTransport.js`, `docs/aiNotes/remoteUiStringsPending.md`.
- **Sửa:** `apps/server/src/utils/chromeBridge/router.ts`, `apps/server/src/app.ts`, `apps/server/src/utils/media/generation.ts`, `apps/server/src/utils/conf/index.ts`, `apps/server/package.json`, `apps/web/src/components/settings/panels/chromeBridge/index.vue`, `packages/chromeCompanion/background.js`, `manifest.json`, `popup.html`, `popup.js`.
- **Đã viết trong mã:** WSS + HTTPS long-poll fallback hai kết nối ra Render; pairing 5 phút, owner phê duyệt, device token riêng và hash SQLite, chọn/đổi tên/thu hồi máy; AES-256-GCM khóa E2E chỉ Mac/Chrome biết; dữ liệu chia khối 12KiB, checksum SHA-256, hàng đợi bounded, backpressure và chống lặp ID; Chrome MV3 reconnect/keepalive; chọn Local/Remote bằng Settings gốc; node và media history dùng chung bridge manager/output gốc.
- **Giữ nguyên:** Local bridge `apps/server/src/utils/chromeBridge/runtime.ts` sử dụng `127.0.0.1`, Local Mode không phụ thuộc Internet; không thay Canvas, không thêm model/provider hoặc AI mới, không sửa prompt hoặc repository Việt hóa.
- **Bằng chứng:** [commit mã](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/0db8ec285034cd8b7779e3e029f1409c31c314d3), [nhánh Remote](https://github.com/mktminhqpbga-glitch/ToonFlow-App/tree/feat/remoteChromeBridgeRender), [hướng dẫn Render](../../apps/chromeRelay/readme.md).
- **Kiểm tra thực hiện:** đọc AGENTS.md và 3 sổ; đối chiếu runtime/extension/nodes trước sửa; kiểm tra cây mã và diff GitHub 20 file thêm/sửa, 0 file cũ xóa; parse cú pháp `server.js`, `background.js`, `remoteTransport.js`, `popup.js` bằng JS parser; parse `manifest.json`; rà soát cấu trúc Vue, cấu hình Render, chữ ký mã hóa/khối, không hardcode Render URL.
- **Chưa chạy hoặc chưa chứng minh:** Bun typecheck/Vite/Electrobun build; service Render thực; WSS/HTTPS đi giữa hai máy/VM; kết nối account AI thật; dữ liệu media; restart/cancel; UI sáng/tối, lưu/mở project, provider gốc. **Chỉ mã đã commit và kiểm tra tĩnh, chưa đủ nghiệm thu.**
- **Vấn đề còn mở:** `ISSUE-0005`–`ISSUE-0008` từ PR #1, `ISSUE-0009`–`ISSUE-0012` của Remote.
- **Trạng thái:** Đã ghi mã vào GitHub trên nhánh riêng; **chưa kiểm thử thực tế**.

### DONE-0009 — Hợp nhất nhánh Việt hóa V1 vào nền Remote Bridge, giải quyết xung đột Text Node

- **Ngày:** 2026-11-08 (UTC+7). **Người trực tiếp sửa:** ChatGPT (GPT-6).
- **Nền:** `feat/remoteChromeBridgeRender` tại `a08cff1a0be2c89e443e782851f49faa25811fbb`; nguồn Việt hóa `feat/vietnameseApprovedPromptsV1` tại `8f6395ee1271f0bc36c104cadcda05b3a6db8703`. Cả hai nhánh gốc và các PR Draft vẫn giữ nguyên.
- **Thực hiện:** tích hợp 127 mục Việt hóa được duyệt, hợp nhất thủ công `packages/nodes/textNode/src/index.vue` để giữ nút hủy/submit của Chrome Bridge và bản Việt theo locale; thêm 10 bản dịch tên node/menu được duyệt, chỉ bổ sung bản Việt của hai khóa chưa có `3D导演台`, `逐帧拉片`, áp dụng nhãn phản ứng theo ngôn ngữ trên sáu node hiện hữu.
- **Các file chính:** `apps/server/src/agent/runtime/prompt.ts`, `packages/i18n/src/locales/vi.json`, `packages/nodeScaffold/src/{useNode,nodeTools}.ts`, `packages/nodeShared/src/nodeLanguage.ts`, `packages/nodes/{textNode,director3dNode,frameAnalysisNode,audioGenerationNode,imageNode,videoNode,audioNode,imageGenerationNode,videoGenerationNode}/src/index.vue` và các mô tả tool/prompt Đạo diễn.
- **Nhật ký nguồn Việt hóa bảo toàn tại:** `docs/aiNotes/historyVietnameseV1/`; bảng kiểm 127 ID tại `docs/aiNotes/vietnameseAuditV1.md`.
- **Kiểm chứng:** so sánh tệp theo SHA, kiểm tra mâu thuẫn nội dung và giữ luồng Chrome Bridge trong Text Node. **Chưa typecheck, build hoặc kiểm tra runtime ứng dụng.**
- **Bằng chứng:** [lịch sử nhánh tích hợp](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commits/feat/independentToonFlowFullIntegration).
- **Trạng thái:** Đã đưa vào cây mã tích hợp; chưa nghiệm thu.

### DONE-0010 — Web Ventura cục bộ, trang chủ độc lập và kênh upstream opt-in

- **Ngày:** 2026-11-08 (UTC+7). **Người trực tiếp làm:** ChatGPT (GPT-6).
- **Bằng chứng mã:** [commit tích hợp Web và độc lập hóa](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/d1f4598993e7785a2ecfe348977fb94e0e0a9403).
- **File runtime:** `apps/server/src/{app,index}.ts`, `apps/server/src/utils/chromeBridge/{access,router,manager}.ts`, `apps/server/src/lib/channelRequest.ts`, `apps/server/src/routes/channel/community/getAdvertisements.ts`, `apps/web/src/pages/home/index.vue`, `apps/web/src/components/settings/index.vue`, `apps/web/src/router/index.ts`.
- **Hành vi mã:** thêm tùy chọn `TOONFLOW_LOCAL_WEB_BRIDGE=1` dành cho Mac Web và bind `127.0.0.1`; chỉ cho Remote Render trên Web, Local Desktop `127.0.0.1` giữ nguyên; ràng buộc Origin/Referer/loopback và kiểm proxy Vite; Settings kiểm backend trước khi hiện Bridge; Home không mount banner quảng cáo và Explore upstream, bỏ fetch quảng cáo, sửa grid và đi thẳng vào Home; route quảng cáo trả trống; API thương mại upstream mặc định bị chặn, `TOONFLOW_LEGACY_CHANNEL=1` mới opt-in.
- **File nhận diện/build:** `package.json`, `apps/web/package.json`, `electrobun.config.ts`, `README.md`, `.github/workflows/integrationCheck.yml`. Đổi URL repo, issues, release fallback sang fork, giữ `author` MIT gốc; bổ sung script Web loopback và workflow kiểm tra build.
- **Tài liệu:** `docs/independentDistribution.md`, `docs/integrationAudit.md`, `docs/aiNotes/translationApprovalQueue.md`. Ghi 20 câu Remote UI với đề xuất **chưa duyệt/chưa áp dụng**.
- **Đã kiểm tra:** đối chiếu file thực tế; kiểm tra tĩnh các import và chuỗi gọi Home, Vite proxy, HTTP gate, logic manager; nhận diện một thiếu sót Settings và sửa trước khi commit; chưa có log typecheck/build/runtime.
- **Chưa kiểm tra:** Web Ventura thật, tất cả upstream callers, Canvas lưu/mở, Extension trên máy ảo, Render WSS/HTTPS, phiên AI thật, CI status, macOS Desktop/installer. Không tuyên bố production-ready.
- **Trạng thái:** Đã commit mã, kiểm chứng tĩnh một số luồng; **chưa nghiệm thu vận hành**.

### DONE-0011 — Đồng bộ Bun lockfile và kiểm tra CI thật

- **Ngày:** 2026-11-08 (UTC+7) · **Người sửa:** ChatGPT (GPT-6).
- **File:** `bun.lock` — bổ sung workspace `apps/chromeRelay` và bản ghi `@toonflow/chromeRelay` đúng package manifest hiện có, không sửa phiên bản của dependency khác.
- **Bằng chứng mã:** [commit lockfile](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/63e003c88089fc4ba1e541844d11b15b7a710619).
- **CI đã chạy:** [lần 1](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42467297410) **FAIL** `bun install --frozen-lockfile` (lockfile sai workspace); [lần 2](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42467506307) **FAIL trước cài đặt** vì GitHub download Bun 1.4.3 trả 504; đã yêu cầu chạy lại các job fail. **Chưa có bằng chứng install/typecheck/build PASS sau khi sửa.**
- **Trạng thái:** Đã ghi mã; lỗi CI đang chờ kết quả run tiếp theo; `ISSUE-0017` chưa đóng.

### DONE-0012 — Sửa FileNotFound trong build:tools và xác minh toàn bộ CI tích hợp

- **Ngày:** 2026-11-08 (UTC+7). **Người trực tiếp sửa và kiểm tra:** ChatGPT (GPT-6).
- **Nguồn yêu cầu:** tiếp tục nhánh `feat/independentToonFlowFullIntegration` từ SHA `894efc53`, không đụng các tính năng đã commit, giữ PR #4 Draft.
- **Nguyên nhân xác nhận qua mã và CI:** root `build:tools` gọi `bun run --filter './packages/tools/*' build` và lỗi `FileNotFound` khi chạy Bun 1.4.3 trên GitHub Actions Linux. Cách tránh `--filter` đã được ghi trong `apps/server/scripts/buildStandalone.ts`; không liên quan đến code logic riêng của 11 tool.
- **Các tệp đã thay đổi:** `package.json`, `apps/server/scripts/buildPackageGroup.ts` (script build group mới), `.github/workflows/integrationCheck.yml`. Script build theo thư mục từng workspace, giống phương pháp có sẵn, giữ `NODE_ENV=production`; chỉ dọn thư mục đầu ra build được sinh ra, **không xóa mã nguồn**. CI chia các nhóm Tools/Extensions/Nodes/MCP/Web/Server thành từng bước.
- **Bằng chứng mã:** [commit e02e4833](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/e02e4833a190626ecb649123a5b2cfa5db50b86d); **bằng chứng chạy CI thật:** [GitHub Actions run #42481958013](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42481958013), `head_sha=e02e4833a190626ecb649123a5b2cfa5db50b86d`, **conclusion=success**.
- **PASS:** Bun 1.4.3 từ npm; `bun install --frozen-lockfile`; syntax Chrome Companion/Relay; typecheck 7 workspace (Server, Web, nodeShared, nodeScaffold, textNode, imageGenerationNode, videoGenerationNode); Build Tools (11 gói), Extensions (5), Nodes (9), MCP, Web, Server.
- **Chưa kiểm thử:** chạy GUI/Web/macOS Ventura 13 Intel thực tế, runtime server + proxy, lưu/mở Canvas và lịch sử media, Muse/ChatGPT/Gemini đăng nhập thật qua Render WSS/HTTPS fallback, thiết bị thứ hai, bảo mật mạng, macOS DMG/installer. CI Linux không đại diện cho các thử nghiệm này.
- **Vấn đề còn tồn tại:** `ISSUE-0014`, `ISSUE-0015`, `ISSUE-0016`, `ISSUE-0017`; PR #4 vẫn Draft, không merge `main`.
- **Trạng thái:** Đã commit, **đã xác minh CI Linux PASS**; **chưa nghiệm thu toàn ứng dụng**.

### DONE-0013 — Camera Studio dùng chung và Chrome Bridge tỷ lệ prompt-only

- **Ngày:** 2026-11-08 (UTC+7). **Người trực tiếp sửa:** ChatGPT (GPT-6). **Người yêu cầu:** chủ dự án.
- **Bắt đầu từ:** nhánh `feat/independentToonFlowFullIntegration` HEAD `7d825fc8`, PR #4 Draft; không merge vào `main`.
- **Mã:** `packages/nodeShared/src/{cameraStudio.ts,components/cameraStudio.vue,components/imageGenerationSettings.vue}`, `packages/nodeShared/package.json`, `packages/nodes/{imageGenerationNode,videoGenerationNode,director3dNode}/src`, `apps/server/src/utils/chromeBridge/{ratio.ts,runtime.ts,remote.ts}`, `packages/chromeCompanion/{background.js,content.js}`, `.github/workflows/integrationCheck.yml`.
- **Đã commit:** thêm Camera Studio opt-in với thân máy/ống kính, tiêu cự 12–200mm, khẩu độ; preset dùng chung lưu cục bộ theo trình duyệt; chỉ thêm chỉ dẫn vào bản prompt **được gửi** khi bật, không ghi đè prompt người dùng; snapshot preset và prompt gửi được gắn đường dẫn asset đã lưu trong node, hiển thị lại theo output. Giữ inpaint riêng, ánh sáng, nhiều góc và các cài đặt video khác.
- **Director 3D:** mở rộng schema scene cho metadata preset tùy chọn; tái dùng `PerspectiveCamera.setFocalLength` để cập nhật FOV khi thay tiêu cự; không giả DOF cho khẩu độ, không đổi camera position, controls target và keyframes theo chủ đích; lưu qua luồng `model.json` hiện hữu.
- **Chrome:** thay hạn chế ảnh 16:9 bằng `1:1,16:9,9:16,4:3,3:4` **chỉ dưới dạng tỷ lệ mong muốn qua prompt**, vì chưa có bộ chọn tỷ lệ native được xác minh. Chặn tỷ lệ khác trong adapter, kiểm khả năng tab ngay trước submit, khóa URL cuộc trò chuyện, ghi nhận kích thước/tg thực của media khi extension tải, so sánh tỷ lệ ảnh khi xem asset đã lưu.
- **Các commit mã:** [a866c090](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/a866c090896ecfd4d39c3230a9693621d2a68bb2), [f6d2dadb](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/f6d2dadb4a0ed10fb2cf0caa7f4d0b2be4636894), [cced9a37](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/cced9a371a45cfb198eaba19e70a7a2b1b6c3274), [ed9173cc](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/ed9173cc529d86cb84c861e1005ecb0a103730a1), [40120e45](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/40120e45959f6b8416c181237bd76b1380fa3f3a), [46806933](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/46806933ac0ac33d99af71e6e3b1f750adc41332), [ef198519](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/ef198519934c797820fdc2f0e6fdf887cec60f36), [0e5aec34](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/0e5aec3437ac9e33bdf1f390a2c8a8eb14cb150d), [91ea9c04](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/91ea9c040e4af5352c57d6162f5dc1be3954ddf8), [1a455410](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/1a455410fc4259996a0265e3e5b223918c380d7d), [c38db20a](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/c38db20a04b1079b2b980f39af17b6afc23390fd), [62c32c57](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/62c32c57e25a0817b981cd3ceae97bd139258158).
- **Kiểm chứng:** [CI Linux run #42493990963](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42493990963) **PASS** sau khi thêm Director typecheck và preflight URL; [CI run #42494199700](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42494199700) tại commit giao diện cuối: **PASS (CI Linux) theo lần đọc log 2026-11-08**. Không có bài test tự động mới (tuân thủ AGENTS).
- **Chưa kiểm chứng:** camera UI và lưu/mở node trên Mac thật, hình chiếu FOV qua renderer và animation, 1:1/9:16 output thật, Render, Chrome có tài khoản, mẫu ảnh/video sinh AI, FFmpeg duration, Batch; các mục này là **BLOCKED/NOT TESTED**, không ghi PASS.
- **Tài liệu nghiệm thu:** [cameraStudioAcceptance.md](./cameraStudioAcceptance.md). **PR #4 vẫn Draft; không merge `main`.**


### DONE-0014 — Checkpoint bản độc lập: cài đặt, typography, locale và Extension ZIP

- **Ngày:** 2026-11-08 (UTC+7). **Người trực tiếp thực hiện:** Codex (GPT-6).
- **Bằng chứng:** [commit 412912a](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/412912a62888209a040128c522ef085f6a7953dc).
- **Đã thay đổi:** 1084 URL tarball sang npm HTTPS với version/checksum nguyên; runner typecheck tuần tự; font Be Vietnam Pro/SIL OFL local; mặc định vi nhưng giữ lựa chọn người dùng; nhãn builtin node tại render; cài đặt nâng cao và ẩn tài khoản upstream local; Bridge UI/popup vi, Local capability; ZIP Extension whitelist có checksum lặp lại; Camera prompt vi ở hai node; ba báo cáo checkpoint.
- **Đã kiểm tra:** frozen install PASS; typecheck đủ 50 workspace với 48 PASS và 2 lỗi SDK desktop/mobile; các typecheck sau sửa ở Web/Server/nodeShared/ImageGeneration/VideoGeneration PASS; build Tools/Ext/Nodes/MCP/Web/Server PASS; Companion/Relay JS syntax PASS; ZIP/HTTP/integrity PASS; Chromium default vi/font/menu/advanced/light-dark/390px/Escape/no-pageerror/language persist PASS; Bun/assert Camera prompt và node label/alias PASS.
- **Review:** rà input/capability, whitelist ZIP, bảo toàn lockfile, không có credential trong thay đổi, không đổi Node/Provider/Tool ID hoặc prompt người dùng. Lỗi desktop/mobile là prerequisite chưa giải quyết; không báo toàn repo typecheck xanh.
- **Chưa hoàn tất:** Việt hóa toàn app/prompt; diagnostics Bridge đầy đủ; AI thật/Render/Mac; toolbar/Thư viện vật liệu/Studio nhân vật/Batch. Không merge main, không chuyển PR khỏi Draft.
- **Vấn đề:** ISSUE-0022 đã khắc phục cài Linux; ISSUE-0023 và ISSUE-0024 mở; các ISSUE-0019..0021 tiếp tục mở.
- **Trạng thái:** phần thay đổi có kiểm tra như trên; yêu cầu tổng thể PARTIAL.

<details><summary>Danh sách chính xác 50 tệp trong commit</summary>

- `.gitignore`
- `apps/server/src/utils/chromeBridge/manager.ts`
- `apps/web/package.json`
- `apps/web/scripts/packChromeCompanion.ts`
- `apps/web/src/assets/fonts/beVietnamProLatin400.woff2`
- `apps/web/src/assets/fonts/beVietnamProLatin500.woff2`
- `apps/web/src/assets/fonts/beVietnamProLatin600.woff2`
- `apps/web/src/assets/fonts/beVietnamProLatin700.woff2`
- `apps/web/src/assets/fonts/beVietnamProLatinExt400.woff2`
- `apps/web/src/assets/fonts/beVietnamProLatinExt500.woff2`
- `apps/web/src/assets/fonts/beVietnamProLatinExt600.woff2`
- `apps/web/src/assets/fonts/beVietnamProLatinExt700.woff2`
- `apps/web/src/assets/fonts/beVietnamProVietnamese400.woff2`
- `apps/web/src/assets/fonts/beVietnamProVietnamese500.woff2`
- `apps/web/src/assets/fonts/beVietnamProVietnamese600.woff2`
- `apps/web/src/assets/fonts/beVietnamProVietnamese700.woff2`
- `apps/web/src/assets/fonts/fontLicense.txt`
- `apps/web/src/assets/fonts/fontSource.md`
- `apps/web/src/assets/main.scss`
- `apps/web/src/assets/typography.scss`
- `apps/web/src/components/agent/index.vue`
- `apps/web/src/components/settings/index.vue`
- `apps/web/src/components/settings/panels/chromeBridge/index.vue`
- `apps/web/src/components/settings/panels/general/nodeMenuSettings.vue`
- `apps/web/src/components/settings/panels/general/ui.vue`
- `apps/web/src/lib/defaultLanguage.ts`
- `apps/web/src/lib/nodeDisplayLabel.ts`
- `apps/web/src/main.ts`
- `apps/web/src/pages/hello/index.vue`
- `apps/web/src/pages/home/index.vue`
- `apps/web/src/pages/workspace/panels/canvas/components/nodeMenuItems.vue`
- `apps/web/src/stores/settings.ts`
- `bun.lock`
- `docs/aiNotes/e2eAcceptance.md`
- `docs/aiNotes/implementationStatus.md`
- `docs/aiNotes/importantNotes.md`
- `docs/aiNotes/openIssues.md`
- `docs/aiNotes/overview.md`
- `docs/aiNotes/remoteUiStringsPending.md`
- `docs/aiNotes/translationApprovalQueue.md`
- `docs/aiNotes/vietnameseFullAudit.md`
- `package.json`
- `packages/chromeCompanion/popup.html`
- `packages/chromeCompanion/popup.js`
- `packages/i18n/src/locales/en.json`
- `packages/i18n/src/locales/vi.json`
- `packages/nodeShared/src/cameraStudio.ts`
- `packages/nodes/imageGenerationNode/src/index.vue`
- `packages/nodes/videoGenerationNode/src/index.vue`
- `scripts/typecheckWorkspaces.ts`

</details>

### DONE-0015 — Ghi nhật ký và liên kết bằng chứng checkpoint

- **Ngày/người thực hiện:** 2026-11-08 (UTC+7), Codex (GPT-6).
- **Phạm vi:** tài liệu `docs/aiNotes/completedWork.md`, `implementationStatus.md`, `vietnameseFullAudit.md`, `e2eAcceptance.md`.
- **Đã làm:** ghi commit triển khai, tệp thực thay đổi, kết quả thực chạy và phần chưa hoàn tất; giữ lịch sử cũ.
- **Bằng chứng commit tài liệu:** [lịch sử nhật ký trên nhánh tích hợp](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commits/feat/independentToonFlowFullIntegration/docs/aiNotes/completedWork.md).
- **Kiểm tra:** đối chiếu SHA, danh sách tệp từ git show, kết quả lệnh và git diff --check. Không ghi thêm kết quả AI chưa thực hiện.
- **Trạng thái:** đã ghi tài liệu; các blocker ứng dụng không thay đổi.


### DONE-0016 — Chrome Companion 0.2.0 giữ phiên tab và ràng buộc kết quả tác vụ

- **Ngày/người trực tiếp thực hiện:** 2026-11-08 (UTC+7), Codex (GPT-6).
- **Bằng chứng:** [commit aed9389](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/aed93891bc2f60aaa7fc95c2b18f72f472652a92).
- **Đã sửa:** pin documentToken/URL/Task/Provider/Tab/frame 0 ở Local và Remote; không tự đổi/active tab; kiểm lại trước gửi và sau upload/download; giữ anchor/receipt đúng prompt; chặn lượt user khác, bản nháp, trang busy và media URL cũ; decode ảnh thật để lấy kích thước; validate output kind/MIME/base64/metadata ở backend. Ledger chung Local/Remote tuần tự và bền qua restart, UNKNOWN không tự retry.
- **Tái hiện trước/sau:** 8 trường hợp không an toàn FAIL ở a3b72a3, PASS sau sửa; 2 trường hợp văn bản/ảnh đúng tiếp tục PASS. Có thêm kiểm tra reload cùng URL, race worker, iframe/docToken, ledger/restart, backend và WebSocket Local thật qua loopback Linux.
- **Kiểm tra:** Companion JS syntax, Server/Web typecheck, Server/Web build, ZIP HTTP/CRC/whitelist/source/hash đều PASS. ZIP phiên bản 0.2.0; cập nhật backend/Extension cùng nhau và tải lại tab AI.
- **Chưa nghiệm thu:** site AI đăng nhập thực, Render thật, video/codecs đầu ra thực và Mac Ventura. Không gộp kiểm tra DOM/worker giả lập với E2E provider. Không sửa hoặc đóng các hạng mục toàn dự án chưa làm.
- **Vấn đề:** ISSUE-0025 sửa phần có thể tái hiện; vẫn mở phần nghiệm thu thực. NOTE-0026 ghi protocol/cutover và giới hạn.
- **Tệp thực sửa:**
  - `apps/server/src/utils/chromeBridge/remote.ts`
  - `apps/server/src/utils/chromeBridge/runtime.ts`
  - `docs/aiNotes/e2eAcceptance.md`
  - `docs/aiNotes/implementationStatus.md`
  - `docs/aiNotes/importantNotes.md`
  - `docs/aiNotes/openIssues.md`
  - `packages/chromeCompanion/background.js`
  - `packages/chromeCompanion/content.js`
  - `packages/chromeCompanion/manifest.json`
  - `packages/chromeCompanion/readme.md`

- **Trạng thái:** code đã kiểm tra trong phạm vi ghi trên; E2E provider BLOCKED/NOT TESTED.

### DONE-0017 — Lưu bằng chứng tối ưu Bridge

- **Ngày/người:** 2026-11-08 (UTC+7), Codex (GPT-6).
- **Tệp:** `docs/aiNotes/completedWork.md`, `docs/aiNotes/e2eAcceptance.md`.
- **Đã làm/kiểm tra:** ghi SHA triển khai, tệp sửa, kết quả đỏ/xanh thực chạy, giới hạn và hướng dẫn cập nhật; đối chiếu git show và git diff --check.
- **Bằng chứng tài liệu:** [lịch sử nhật ký nhánh tích hợp](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commits/feat/independentToonFlowFullIntegration/docs/aiNotes/completedWork.md).
- **Trạng thái:** tài liệu đã ghi; không thêm kết quả AI hoặc Mac chưa chạy.

## Mẫu thêm mục mới — AI/người sửa phải điền đủ

### DONE-xxxx — Tên thay đổi ngắn gọn

- **Ngày:** YYYY-MM-DD HH:mm (UTC+7)
- **Người trực tiếp sửa:** [người hoặc AI/model]
- **Người yêu cầu:** [nếu có; không được đồng nhất với người sửa]
- **Phạm vi:** [mục tiêu thay đổi]
- **Các tệp thực sự sửa:** [đường dẫn]
- **Đã làm:** [chức năng hoặc lỗi đã thay đổi cụ thể]
- **Bằng chứng:** [URL commit/PR, diff]
- **Đã kiểm tra:** [lệnh và kết quả; thao tác UI nếu đã thử]
- **Chưa kiểm tra:** [nếu có]
- **Vấn đề sau khi sửa:** [ISSUE-xxxx hoặc “chưa phát hiện qua kiểm tra đã nêu”; không khẳng định toàn bộ không lỗi]
- **Trạng thái:** Đã ghi vào repo / Đã kiểm thử / Chưa kiểm thử


### DONE-0018 — Bổ sung nhãn Việt hóa cho trình soạn prompt và menu tham chiếu (code only)

- **Ngày:** 2026-11-09 (UTC+7).
- **Người thực hiện:** ChatGPT (GPT-6).
- **Phạm vi:** chỉ hai Vue component của nodeShared; không sửa backend, schema hay nội dung prompt người dùng.
- **Tệp:** `packages/nodeShared/src/components/promptInput.vue`, `packages/nodeShared/src/components/promptReferenceMenu.vue` và ghi chú bàn giao.
- **Đã làm:** thêm nhãn tiếng Việt cho mở rộng prompt, placeholder, lỗi chọn tài nguyên và menu tham chiếu; giữ nhãn Trung cho ngôn ngữ khác; nhóm category cập nhật theo locale.
- **Bằng chứng:** [6d02a4e](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/6d02a4e3c82100f8ec407b5256b5bd70047628f2), [d3f94a8](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/d3f94a817f7054be62069e8954e77d236cedcf3f), [3f1cc0a](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/3f1cc0a4661a1282228a9ebed766b0ee0b0ee529).
- **Kiểm tra:** đọc lại code/nhánh qua GitHub; chưa chạy Bun, browser hoặc Mac thật.
- **Chưa kiểm tra:** Vue typecheck, build, tương tác UI, drag/drop, persistence và payload AI.
- **Vấn đề:** ISSUE-0026 vẫn mở.
- **Trạng thái:** Đã ghi code lên nhánh, NOT TESTED runtime; chưa nghiệm thu chức năng.


### DONE-0019 — Code nhãn locale của bảng tạo ảnh và video

- **Ngày:** 2026-11-09 (UTC+7). **Người trực tiếp sửa:** ChatGPT (GPT-6).
- **Phạm vi:** labels/aria-label và chế độ hiển thị trong `packages/nodeShared/src/components/imageGenerationSettings.vue` và `packages/nodes/videoGenerationNode/src/components/generationSettings.vue`.
- **Đã làm:** thêm nhãn vi khi locale vi, giữ nhãn zh gốc ngoài chế độ vi. Không sửa giá trị mode và payload model.
- **Bằng chứng:** [commit ảnh](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/2302f600c7ab30f2afbfb814a119725f8c6eb706), [commit video](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/bccd1bd10af5955160300adb5ab9ec332ce1bbd1).
- **Kiểm tra:** kiểm tra lại nội dung source qua GitHub, không chạy runtime, typecheck hoặc Mac trong phiên này; CI commit mới đang cần kiểm tra.
- **Vấn đề:** ISSUE-0027 mở; tính năng tạo ảnh/video thật không được tuyên bố DONE.
- **Trạng thái:** Đã ghi vào repo / NOT TESTED runtime.
