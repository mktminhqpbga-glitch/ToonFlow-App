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


### DONE-0020 — HD-01: khóa model media thiếu cấu hình (triển khai từng phần)

- **Ngày:** 2026-11-09 (UTC+7) · **Người trực tiếp thực hiện:** ChatGPT (GPT-6).
- **Nguồn yêu cầu:** quyết định HD-01 của chủ dự án: hiện tất cả model, model chưa kết nối bị khóa. Không làm chéo HD-02 đến HD-05.
- **Tệp mã sửa:** `apps/server/src/utils/media/generation.ts`, `packages/nodeScaffold/src/nodeAi.ts`, `packages/nodes/imageGenerationNode/src/index.vue`, `packages/nodes/videoGenerationNode/src/index.vue`.
- **Đã làm:** thêm trạng thái cấu hình không chứa secret, giữ model có cấu hình là `configured` (không tự ghi `ready`), hiển thị model thiếu API key ở dropdown nhưng disabled, bảo vệ submit và chọn mặc định hợp lệ.
- **Commit:** [backend](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/c051788523eb2e5973676bc798870b5e2061b2d3), [type](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/fec3e8e95b785cdeb47cacd36e3e84c9298ba682), [image](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/4253903b1ca60710bae2d4edbb3fa6284e791b76), [video](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/5fab792b84458e82a8c90cd2a657ac6407349bd7), [default image](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/6f174cc7ce38df74043b3f2a96de15685d097f74), [default video](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/333261f324ad0dc7a32217155f147b73548efd0f).
- **Đã kiểm tra:** đối chiếu source, xác minh CI run 42511358311 hoàn tất success trên commit `333261f`. Chưa xác minh CI cho tất cả commit tài liệu sau đó.
- **Chưa kiểm tra:** UI trực tiếp và AI/provider thật. Model chưa cài không có trong catalog, provider chỉ có key chưa xác minh mạng/quota. Ghi rõ trong [bảng nghiệm thu](./hdAcceptance.md).
- **Trạng thái:** Đã commit code, PARTIAL, chưa nghiệm thu end-to-end; issue vẫn mở.


### DONE-0021 — HD-02: kéo tham chiếu media Canvas/Asset Library vào prompt (code, chưa E2E)

- **Ngày:** 2026-11-09 · **Người thực hiện:** ChatGPT (GPT-6).
- **Mã nguồn:** `packages/nodeShared/src/useNodeReferences.ts`, `packages/nodeShared/src/components/promptInput.vue`, `packages/nodeShared/src/components/promptReferenceMenu.vue`, `packages/nodes/imageGenerationNode/src/index.vue`, `packages/nodes/videoGenerationNode/src/index.vue`, `apps/web/src/pages/workspace/panels/canvas/index.vue`.
- **Thực hiện:** drag/dropped material bằng định danh node+handle thực; hỗ trợ asset library path qua import & connect node; nhúng tên nguồn/thumbnail nếu có ảnh xem trước; chèn ở caret khi xác định được, tránh tạo edge trùng; dùng mô hình prompt lưu hiện tại. Commit mã từ `be6ac4d` đến `086f34c` (xem log GitHub).
- **Kiểm tra:** GitHub Actions `integrationCheck` run [42549399300](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42549399300) **PASS** (typecheck/build).
- **Chưa nghiệm thu:** vị trí drop qua nhiều trường hợp DOM, Undo/Redo bằng chuột, khôi phục project, gửi media thực tới provider: **NOT TESTED**. **Trạng thái: PARTIAL.**

### DONE-0022 — HD-03: Canvas Thư viện vật liệu tạo node thật có preset (code, chưa UI E2E)

- **Ngày:** 2026-11-09 · **Người thực hiện:** ChatGPT (GPT-6).
- **Mã nguồn:** `apps/web/src/pages/workspace/panels/canvas/components/materialPresets.vue`, `canvasControls.vue`, `apps/web/src/pages/workspace/panels/canvas/index.vue`.
- **Thực hiện:** hai cột preset, sửa prompt trước khi tạo, tự ẩn preset nếu node loại tương ứng chưa cài, tạo node image/video qua VueFlow và lưu dữ liệu promptModel; không gửi AI trước khi người dùng yêu cầu.
- **Commits:** [207bf0d](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/207bf0dac877030bad241d4a4278c7df2a78ce88), [5474ecd](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/5474ecd25955cce28e94ec0faa2b3b209f5dabef), [f9f464a](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/f9f464a1b2916f3236f23b3f4c0993b6792c75a9).
- **Kiểm tra:** GitHub Actions `integrationCheck` run [42549924812](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42549924812) **PASS**. UI/actual save reopen: **NOT TESTED**. **Trạng thái PARTIAL.**

### DONE-0023 — HD-04: Studio nhân vật, Character ID và bộ ảnh cố định trong workspace (code)

- **Ngày:** 2026-11-09 · **Người thực hiện:** ChatGPT (GPT-6).
- **Mã nguồn:** `apps/web/src/pages/workspace/panels/canvas/components/characterStudio.vue`, `canvasControls.vue`, `apps/web/src/pages/workspace/panels/canvas/index.vue`.
- **Thực hiện:** tạo/sửa/xóa hồ sơ (ảnh gốc không bị xóa), tìm kiếm, lưu JSON workspace + optimistic revision; upload ảnh thật, import các ảnh vào Canvas với Character ID; phòng chống ghi sang workspace khác khi chuyển project.
- **Commits:** [c52a7da](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/c52a7dae7263dbe776046edaef39a6bccf87a8ec), [78eabe0](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/78eabe0b722f4b00db004e843cf1aba57a409ac2), [0d081ab](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/0d081ab3b2475396954811ed20871ab29c4aaa85), [0089264](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/008926452fb4e07ccd8590a68019113b045a0219).
- **Kiểm tra:** GitHub Actions `integrationCheck` run [42550662370](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42550662370) **PASS**. Khôi phục dữ liệu trên Mac, upload vật lý, Character AI: **NOT TESTED**. **Trạng thái PARTIAL.**

### DONE-0024 — HD-05: hàng đợi batch lưu trạng thái và trang image/video (code nền)

- **Ngày:** 2026-11-09 · **Người thực hiện:** ChatGPT (GPT-6).
- **Mã nguồn:** `apps/server/src/utils/media/batches.ts`, bốn route `apps/server/src/routes/ai/media/batches/{create,list,status,control}.ts`, `apps/web/src/pages/workspace/components/batchPage.vue`, `apps/web/src/pages/workspace/index.vue`.
- **Thực hiện:** batch scene có UUID + taskId bền vững, lưu workspace, điều phối tuần tự để không chồng job Chrome, tái sử dụng media task thật, tiếp tục cảnh độc lập sau FAILED, UNKNOWN dừng/không tự gửi lại, API tạo/đọc/list/điều khiển, UI chọn model/prompt/media thật, trạng thái từng cảnh, tải kết quả; mở 2 trang từ Workspace.
- **Kiểm tra:** CI trước đó run 42551209546 FAIL do mismatch type kết quả audio, đã sửa commit [f3a9e7a](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/f3a9e7ae5c5c2e3ad32082911e642fd6d8a91c58). Run [42551746997](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42551746997) **PASS** (typecheck/build) sau wiring UI commit [585e9bb](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/585e9bbac8afd5fc77b8c99fbb1740171b0641a5).
- **Chưa làm/xác nhận:** FFmpeg ghép MP4, map Device/Tab và queue đa thiết bị chính xác, đưa kết quả Batch lên Canvas, phục hồi/restart thật, E2E Muse/Gemini/video thật. Không coi CI là E2E. **Trạng thái PARTIAL**.


### DONE-0025 — HD-05: ghép MP4 bằng FFmpeg trên file video đã xác minh (code, chưa E2E)

- **Ngày/người sửa:** 2026-11-09, ChatGPT (GPT-6).
- **Mã nguồn:** `apps/server/src/utils/media/batches.ts`, `apps/server/src/routes/ai/media/batches/merge.ts`, `apps/web/src/pages/workspace/components/batchPage.vue`.
- **Hành vi đã code:** chỉ cho ghép batch video hoàn tất với >=2 cảnh thành công; xác minh tệp nguồn trong workspace và FFprobe các luồng video/codec/kích thước/thời lượng; chỉ copy concat với các nguồn tương thích; FFprobe lại đầu ra MP4 trước khi lưu metadata `merged`. Xuất file tên ngẫu nhiên, không ghi đè video cũ; không chấp nhận poster/thumbnail. Dùng `createWorkspaceFfmpeg` hiện có, không cài FFmpeg giả.
- **Commits:** [2189906](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/21899068ee4405338fe6b5db65943f1c20f708c9), [42adb19](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/42adb19ce11ed7d40d7064db2e2499e28acbfaa5), [879c83a](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/879c83a0ff40fd05869d17bb66e2bd81d892bb32), [724aade](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/724aade329c3b417e51b494727fe8853018c1afb).
- **Kiểm thử:** đang kiểm tra CI run 42552231169; FFmpeg chạy với video thật, hợp codec và nhập lại Canvas **NOT TESTED**. Không đánh dấu E2E PASS.


### DONE-0026 — Video Node: mở được cài đặt tỷ lệ dù chưa có model

- **Ngày/người trực tiếp sửa:** 2026-11-09, ChatGPT (GPT-6).
- **Tệp:** `packages/nodes/videoGenerationNode/src/index.vue`.
- **Code:** bỏ khóa popover thiết lập chỉ vì thiếu `selectedModel`, giữ khóa nút gửi AI bằng `modelCanGenerate`; hiển thị cảnh báo rằng tỷ lệ mới chỉ là cấu hình dự kiến, hướng dẫn nối model trong AI Bridge/Model AI.
- **Commit:** [7586654](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/75866544de1cbf4bc03900f86f6a1176069d699b).
- **Kiểm chứng:** Typecheck/build theo CI run 42552641306 đang chạy lúc ghi; chưa kiểm trực tiếp click 9:16 trên Mac. **Trạng thái PARTIAL**.


### DONE-0027 — HD-06: sửa lỗi kéo thả, bảo vệ Batch khi restart, test thật và nhập media vào Canvas (PARTIAL)

- **Thực hiện:** 2026-11-09, ChatGPT (GPT-6); tất cả mã sau nằm trên `feat/independentToonFlowFullIntegration`, PR #4 vẫn Draft.
- **HD-02:** sửa `packages/nodeShared/src/components/promptInput.vue` vì điều kiện `!material` chặn Asset Library/drop reference cũ. Trích `promptDrop.ts` để chọn đúng existing Node ID+handle, material, asset path và clamp caret offset. Test: `packages/nodeShared/tests/promptDrop.test.ts`. Commit ví dụ [ed0f813](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/ed0f813e1de0a0a0c9756f69cd4f557d22809b19), [71fcfd9](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/71fcfd9a8433d0275067af026e825af4730dd87d).
- **HD-03:** `materialPresetCatalog.ts` và `materialPresets.vue` chỉ tìm node Image/Video thực, thêm preset đúng **3 góc nhìn nhân vật** và ghi rõ giới hạn prompt preset; test `apps/web/tests/materialPresetCatalog.test.ts`. Commit [bfa226a](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/bfa226a1b7a8211741be87eeb2d1b3f4eff60f5a).
- **HD-04:** `characterRecords.ts` kiểm tra Character ID, đường dẫn và MIME ảnh, chống ghi đè dữ liệu JSON hỏng; `characterStudio.vue` dùng parser/upsert. Test `apps/web/tests/characterRecords.test.ts` ghi/đọc **tệp temp thật** bằng `@toonflow/file` và xác nhận xóa hồ sơ không xóa ảnh gốc. Commit [b529a8a](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/b529a8a12673d4f7db986ced2852d0c59b81770d).
- **HD-05:** `apps/server/src/utils/media/tasks.ts` thêm `inspect` chỉ đọc (không tự tiếp tục provider task); `batches.ts` phục hồi queued khi mở workspace, cách ly orphan running → UNKNOWN, lưu Task ID, bỏ qua scene FAILED độc lập; batch thành công toàn bộ mới `completed`, có lỗi là `partial`; kiểm tra Chrome device/tab/capability trước khi gửi, offline giữ queued và hiển thị `pauseReason`. Kiểm thử state bằng `batchTransitions.test.ts`. Commit ví dụ [1b834a5](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/1b834a5cdaae663dd9d619fe3943909edb6629b8), [d2a9c1a](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/d2a9c1ad5421ec1f0058e0928d6b93bb751ed944), [45df553](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/45df5534857fac6400dc64eb3cef502e23053766).
- **Canvas media:** `canvas/index.vue`, `canvasHost.vue`, `apps/web/src/pages/workspace/index.vue`, `batchPage.vue` tạo node media thật từ file trong `batchResults`, lưu canvas, có nút cho từng ảnh/video và MP4 ghép. Commit ví dụ [7854c11](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/7854c1130bdea97812394d8612f99051cec7d2b2), [9e720f1](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/9e720f1c9c8d3fb8e9e763e3bee69fd016f672b9).
- **FFmpeg:** `batchTransitions.ts` + `batches.ts` so khớp codec/resolution/fps/pixel/audio, tránh nối stream-copy thiếu tương thích; `apps/server/src/utils/media/batchFfmpeg.test.ts` gọi FFmpeg/FFprobe thật, tự tạo clip MP4 và thử concat/thumbnail/sai thông số. [CI workflow](../../.github/workflows/integrationCheck.yml) tự cài FFmpeg nếu runner chưa có. Đã chạy thủ công kiểm tra clip bằng FFmpeg trên Linux container (không phải macOS/app).
- **Bằng chứng test đã hoàn tất:** GitHub Actions [run #42556447168](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42556447168) **PASS**: typecheck, Bun unit/fixture regression, Build Web/Server/Nodes/Tools/MCP. Các commit Chrome offline guard mới hơn cần CI riêng, không gộp kết quả cũ.
- **Chưa kiểm chứng:** Web click/drag thật, save/reload Canvas bằng UI, HTTP gọi provider, Chrome và Render đăng nhập thật, crash/restart E2E, FFmpeg trong desktop Mac, Mac Intel Ventura. **NOT TESTED/BLOCKED; không phải DONE E2E.**
- **Hướng dẫn chạy:** [hd06MacAcceptance.md](./hd06MacAcceptance.md).


### DONE-0028 — HD-07 P0 Chrome Bridge: bảo vệ tab, kết quả media và chẩn đoán (CODED/PARTIAL, chưa E2E)

- **Ngày/người thực hiện:** 2026-11-09, ChatGPT (GPT-6).
- **Mã nguồn trực tiếp:** `apps/server/src/utils/chromeBridge/{dispatchGuard.ts,dispatchGuard.test.ts,mediaSignature.ts,mediaSignature.test.ts,bridgeValidation.test.ts,access.ts,access.test.ts,manager.ts,router.ts,remote.ts,runtime.ts}`, `apps/server/src/utils/media/generation.ts`, `apps/web/src/components/settings/panels/chromeBridge/index.vue`, `.github/workflows/integrationCheck.yml`.
- **Thay đổi:** kiểm tra cùng-tab và Task ID trước submit; cách ly UNKNOWN và hủy chưa xác nhận; refresh thụ động không mở khóa UNKNOWN; mất Relay buộc probe tab lại; rollback cấu hình Render sai key; endpoint `/api/desktop/chromeBridge/diagnostics` và bảng chẩn đoán không lộ owner secret; đối chiếu chữ ký bytes PNG/JPEG/WebP/MP4/MOV/WebM trước khi lưu file Chrome; thêm test quyền loopback/Origin/proxy, document ID, provider allowlist và chống media giả.
- **Commit code tiêu biểu:** [856a287](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/856a287c537a178ee0655deb358227b3cfb45225), [d470c97](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/d470c97d1ae1462303c5acb4ed41c2881d9c523e), [1865181](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/1865181210f200de751f456ba271ddfabffcef51), [1c2adb2](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/1c2adb208c4e1b0e36bdd06fbf41847ec6e6bcf4), [3db9bd5](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/3db9bd5764ef4c4a4dae015b76ccd4b382cbbdd2), [135821e](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/135821ef0305447ad782e191fe44059a8b498db9).
- **Kiểm thử:** CI có thành công ở commit nền trước HD-07; các run HD-07 riêng cho từng commit cần đối chiếu; **không công nhận provider E2E** dù unit/build PASS. Quy trình nghiệm thu thật: [hd07MacAcceptance.md](./hd07MacAcceptance.md).
- **Phân loại:** **CODED / PARTIAL**, không phải DONE E2E. Chưa có Chrome/Render đăng nhập của chủ dự án trong môi trường lập trình; 1 ảnh/video thật, Batch 5+3, ghép video thật, save/reopen trên Mac **BLOCKED**.


**HD-07 bổ sung sau checkpoint DONE-0028 (09/11/2026):** `runtime.ts`, `remote.ts`, `manager.ts`, `dispatchGuard.ts` xác minh lại tab đã đăng nhập, documentToken và capability trên status refresh; không mở khóa UNKNOWN bằng refresh thụ động; loại model UNKNOWN khỏi catalog sẵn sàng. Test `dispatchGuard.test.ts` thêm case logout, session changed, URL mismatch, Gemini không video. Các commit: `5d3f1ce`, `efdfc2ca`, `3d2b8b5e`, `5fc63452`, `ecd72bef`, `c9c57361`, `e8293780`, `d7e2eaf9`, `296880b2`. Trạng thái CODED; E2E Chrome thật BLOCKED.


### DONE-0029 — HD-08: Việt hóa bộ biên dịch node tích hợp, prompt nội bộ và kiểm toán (CODED/PARTIAL, chưa E2E)

- **Ngày, tác giả:** 2026-11-09, ChatGPT (GPT-6). **Nhánh:** `feat/independentToonFlowFullIntegration`. PR #4 vẫn Draft, không merge.
- **Sửa mã nguồn:** `packages/i18n/src/{vite.ts,extract.ts,vue.ts,auditVietnamese.ts,vietnameseCoverage.test.ts,locales/vi.json}`; `packages/nodeScaffold/index.ts`; 9 `packages/nodes/*/vite.config.ts`; `apps/web/vite.config.ts`; `packages/nodeShared/src/components/{mediaPrice.vue,mediaHistory.vue,nodeError.vue}`; `packages/nodes/audioGenerationNode/src/components/generationSettings.vue`; `apps/web/src/components/settings/panels/mediaModel/{providerPromptVi.ts,providerAgentDialog.vue,addCustomProviderDialog.vue}`; `.github/workflows/integrationCheck.yml`.
- **Đã code:** plugin Vite bao phủ `packages/nodeShared` và các node dựng sẵn khi build UMD; đồng bộ locale trong bundle node theo ngôn ngữ host; tự động trích xuất chuỗi nhãn/tooltips/placeholders/errors và cảnh báo số bản dịch còn thiếu, không biến đổi ID/schema/JSON/user data; bổ sung bản Việt của prompt giải thích lỗi và trợ lý tích hợp provider; các system prompt mặc định và prompt đạo diễn đã có bản Việt trước đó, giữ nguyên. Dịch thủ công nhãn/lỗi node Media Price, History, Audio Settings. Bổ sung các nhóm từ điển Image/Video/Audio, PCM và Director 3D.
- **Commit tiêu biểu:** [d000708](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/d0007085dcafd38106d54707c8a4491469a39a9f), [e8d8a7e](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/e8d8a7ed08beb887c4fe3ad70aa14e2f371ae38c), [cc5d7a5](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/cc5d7a53181dbea08ef36f233e3109dcaf5759e0), [930211e](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/930211e02a772684c34eb284e4bf73b09bd2a1e4), [7fe238d](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/7fe238dc1ac1e93c3ef4a8cdb6fb503f43d355ca), [b788552](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/b78855261341098bf4f8de9e954bd3818bae732a), [6ba34a1](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/6ba34a104b59d1045a953f04c2d27a2e3fd093f6).
- **Kiểm thử chắc chắn đã hoàn tất:** [CI #42563406550](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42563406550) **SUCCESS** với 43 Bun tests PASS, typecheck + build. Lúc đó audit: 3.248 candidate UI strings, 4.228 bản dịch, **656 candidate còn thiếu**, 0 giá trị dịch còn chữ Hán, 0 lỗi parse. Sau đó đã thêm 60 khóa và sửa prompt provider; **cần dùng audit/CI mới** để cập nhật số còn thiếu, không suy diễn. Cấu hình build thay đổi từng bước có các run FAIL trước khi fix import module và dấu backtick trong prompt; không dùng run cũ để chứng minh HEAD mới.
- **Chưa đạt:** 100% các chuỗi UI còn thiếu; mọi prompt riêng của plugin có thể còn tiếng Trung; bộ đếm audit không bao phủ mọi chuỗi text trong runtime và ảnh; Mac Ventura click và screenshot chưa kiểm thử. **Trạng thái PARTIAL; không đánh dấu Việt hóa 100%**.


### DONE-0029 — HD-08: Việt hóa giao diện và prompt ẩn (mã nguồn + CI, E2E CHƯA NGHIỆM THU)

- **Ngày thực hiện:** 2026-11-09; **người thực hiện:** ChatGPT (GPT-6).
- **Các tệp đã sửa:** `packages/i18n/src/locales/vi.json` (+536 bản dịch tiếng Việt); `.github/workflows/integrationCheck.yml` (audit `--strict` + các bài test mới); `apps/web/src/lib/defaultLanguage.ts`, `apps/web/src/stores/settings.ts` (bảo toàn lựa chọn locale rõ ràng, không để `system` kế thừa ngầm ghi đè mặc định); `packages/nodes/{imageGenerationNode,videoGenerationNode,audioGenerationNode}/src/index.vue`; `packages/nodes/audioGenerationNode/src/components/generationSettings.vue`; `packages/nodes/frameAnalysisNode/src/{aiAnalysis.ts,aiPromptVi.ts}`; `packages/nodes/imageNode/src/{imageInpaint.ts,imagePanorama.ts,imageMultiAngle.ts,imageLighting.ts}`; `apps/server/src/agent/runtime/subAgent.ts`.
- **Kết quả kiểm toán xác minh:** CI [run #42567345816](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42567345816) **PASS** 43/43 bài test, build/typecheck và audit với `candidateUiStrings=3248`, `dictionaryEntries=4884`, `missingVietnameseEntries=0`, `untranslatedVietnameseValues=0`, `parseFailures=0`. Đây chỉ là các chuỗi mà bộ phân tích UI nhận biết được; các nhánh tiếng Trung dùng cho locale khác vẫn được giữ nguyên.
- **Prompt ẩn:** chọn bản Việt khi locale vi cho frame analysis theo cảnh và toàn bộ đoạn, chú thích tham chiếu trong image/video/audio, vẽ lại một phần ảnh, ảnh panorama 360/720, camera nhiều góc nhìn, chỉnh ánh sáng và sub-agent. Giữ nguyên JSON schema, model ID, tham số camera, tệp người dùng, dấu `{{ref 1}}` và nội dung prompt do người dùng gõ. Các prompt Việt của agent mặc định, Director3D và provider assistant đã có từ trước, không ghi đè.
- **Bộ test mới:** `apps/web/tests/languageDefaults.test.ts`, `packages/i18n/src/hiddenPromptCoverage.test.ts`, `packages/nodes/frameAnalysisNode/tests/aiPromptVi.test.ts`, `packages/nodes/imageNode/tests/hiddenPromptsVi.test.ts`; được đưa vào GitHub Actions. Kiểm tra thêm các run mới trước khi xác nhận toàn bộ.
- **Commits code tiêu biểu:** `7d44b7a`, `1162304`, `d899645`, `ab7cc08`, `e8858c5`, `325d263`, `4fef38c`, `0936862`, `2339b2b`, `f2d2ef8`, `fd4105d`, `f05cbf8`, `a16c221`, `6ed1d1e`, `21d52c4`, `8aca655`, `f35f4a5`.
- **Trạng thái:** **CODED/PARTIAL**, chưa thể ghi **100% UI E2E** vì chưa kiểm click/đổi locale/reload tất cả node thật trên Mac Ventura; audit chỉ kiểm những chuỗi nó nhận diện, không loại trừ các prompt tùy biến và các gói ngoài phạm vi. Không dịch văn bản/tệp/dữ liệu mà người dùng cung cấp.


### DONE-0029 — HD-08: mở rộng Việt hóa giao diện, prompt ẩn và mặc định backend (CODED/PARTIAL, 09/11/2026)

- **Người trực tiếp thực hiện:** ChatGPT (GPT-6), ngày 2026-11-09.
- **Mã nguồn đã sửa thật:** `packages/nodes/audioGenerationNode/src/index.vue`, `packages/nodes/imageGenerationNode/src/index.vue`, `packages/nodes/videoGenerationNode/src/index.vue`, `packages/nodes/frameAnalysisNode/src/aiAnalysis.ts`; `apps/web/src/lib/defaultLanguage.ts`, `apps/web/tests/languageDefaults.test.ts`; `apps/server/src/lib/i18n.ts`, `apps/server/src/app.ts`, `apps/server/src/lib/i18n.test.ts`; `apps/server/src/agent/teams/{index.ts,remote.ts}`; `packages/nodeShared/src/nodeLanguage.ts`; `packages/i18n/src/{locales/vi.json,hiddenPromptCoverage.test.ts,auditVietnameseResidual.ts}`; `.github/workflows/integrationCheck.yml`.
- **Phạm vi:** dịch placeholder/tooltip/accessibility/error runtime trong ba node tạo media; tiến độ & lỗi của phân tích từng cảnh; prompt ẩn và hướng dẫn tool `teamResources`, `delegate`, `requestInput` trong Team AI, giữ nguyên tên công cụ và payload JSON; bảo vệ lựa chọn ngôn ngữ rõ ràng, vô hiệu hóa ưu tiên tiếng Trung ngầm từ cấu hình cũ cho UI và backend; dùng tiếng Việt khi request không có header rõ ràng; giữ lựa chọn ngôn ngữ chủ động khác tiếng Việt; bổ sung hai khóa còn thiếu trong `vi.json` và giữ lời dịch có dấu.
- **Bằng chứng CI đã hoàn tất trên commit trung gian:** [42580934945](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42580934945) **PASS 65/65 Bun tests**, strict audit: **3172** UI keys nhận diện, **0** keys thiếu, **0** giá trị tiếng Việt còn Hán tự; kiểm tra phần còn lại còn **1592** lexical candidates (không phải số lỗi UI được xác nhận). Có CI lần đầu cho test mở rộng bị FAIL vì assertion quá chặt bắt Audio Node chứa chữ `muse`; đã sửa đúng assertion trong commit `1bd7358e`, cần xem run sau commit.
- **Commit tiêu biểu:** [d972c82](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/d972c82ffcf854fa92f801043a47713ad1f13e22), [2606d6d](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/2606d6dc2362dc91cd8a874b6b2075efbdb98e32), [906469d](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/906469d866a6bcf5bd3c574485c45277b06bc4ce), [5a36c5d](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/5a36c5d52e67bf98b7b17c8c9fd451508afa8083), [bfab3fb](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/bfab3fb24cf5dc2377948aba9d5bc6bdd47a053d), [93334e3](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/93334e3cc5dfc306d93fa99660aeef8a0177917a), [d0d279f](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/d0d279faf76ed6755bca05b1063cc0249edbfa89), [ea67319](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/ea67319d8e0d3dc4291369c3bb11b6f9141a96af), [1bd7358](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/1bd7358e3e45cbd5dc34ea611e9c110059c60943).
- **Chưa nghiệm thu:** thay đổi ngôn ngữ trong Web đang chạy, popup/video/audio từng thao tác trên Mac Intel macOS 13, mọi prompt nội bộ/protocol chưa được audit thủ công, sản phẩm AI thật. **PARTIAL, chưa DONE 100%.**


### DONE-0030 — HD-08: sửa Việt hóa runtime ở Panorama, phân tích video, model tester và backend media (PARTIAL, KHÔNG nghiệm thu 100%)

- **Ngày/người trực tiếp sửa:** 2026-11-09, ChatGPT (GPT-6); nhánh `feat/independentToonFlowFullIntegration`, PR #4 Draft.
- **Code:** `packages/nodes/imageNode/src/components/imagePanoramaPreview.vue` (nhãn so sánh, capture, lỗi ảnh, hướng dẫn thao tác và accessibility động); `packages/nodes/frameAnalysisNode/src/index.vue` (23 loại nhãn runtime/lỗi/thông báo); `apps/web/src/components/videoPlayer.vue` (progress preview); `apps/web/src/components/settings/panels/mediaModel/providerTestPanel.vue` (kiểm thử model, che log và prompt ẩn yêu cầu AI sửa provider); `apps/server/src/utils/media/generation.ts`, `mediaErrorVi.ts` (22 lỗi media theo request locale); `packages/i18n/src/locales/vi.json` (10 khóa còn thiếu); `packages/i18n/src/auditVietnameseResidual.ts` (phân loại lại ứng viên dictionary/guarded); test/bước CI tương ứng.
- **Một số commit có mã nguồn thực:** [bfb6d98](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/bfb6d987502d4f28601a592844411a9a961fa200), [1e94a68](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/1e94a680a8f26454b385ec60a12a5806bf2803a6), [3a7cccb](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/3a7cccb84dc8aafca4efe39c7e23a25b1c6f9a19), [6b83d6a](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/6b83d6a299c23872a176bcf12fda26b613d943b1), [2f0e8eb](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/2f0e8ebca8188ffa4daddcfe77c99c1eb4872025), [511262d](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/511262dc7dc2216c147c447e6c72d5afb8af465d).
- **Kiểm thử có bằng chứng:** [run #42587671929](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42587671929) **PASS** 72/72 test, 0 lỗi; audit UI nhận diện 3.129 chuỗi, dictionary 4.896 khóa, `missingVietnameseEntries=0`, `untranslatedVietnameseValues=0`, `parseFailures=0` **trong phạm vi AST đã quét**. Các commit UI/provider/9-node build guard thêm sau cần CI tương ứng; không lấy PASS cũ suy ra HEAD mới.
- **Kiểm kê còn mở tại #42587671929:** 1.538 **ứng viên literal** cần xét thủ công: 836 có từ điển vi nhưng chưa xác nhận được đường thực thi, 702 chưa có khóa dictionary; 61 ứng viên ở dòng liên quan prompt. Đây không phải số chuỗi chắc chắn hiển thị, cũng không phải chứng minh prompt ẩn đã dịch hết.
- **Mac/Web, AI E2E:** **NOT TESTED**; xem [hd08VietnameseAcceptance.md](./hd08VietnameseAcceptance.md).
- **Trạng thái:** **PARTIAL**, không tuyên bố 100%.


### DONE-0031 — Chuyển nút Thư viện vật liệu và Studio nhân vật lên thanh công cụ Canvas (CODED, chờ E2E)

- **Ngày/người sửa:** 2026-11-09, ChatGPT (GPT-6); đúng branch tích hợp, PR #4 Draft.
- **Mã:** `apps/web/src/pages/workspace/index.vue`, `panels/canvas/canvasHost.vue`, `panels/canvas/index.vue`, `panels/canvas/components/canvasControls.vue` (đều trong `apps/web/src/pages/workspace/`).
- **Thay đổi:** chuyển hai nút từ panel dưới-trái vào `toolMenuContent`, thứ tự [+] [hand] [search] [Shapes: vật liệu] [smile: nhân vật] [help]. Giữ nguyên 2 dialog và callback thêm node/ảnh qua instance Canvas hiện tại, không tạo nút thứ hai.
- **Commit mã:** [17262ce](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/17262ce1b474b4ad65ecfdd9dab58567d6e377e7).
- **Kiểm thử:** source/static replacement PASS; [CI cho commit](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42591076127) đã khởi chạy (xem GitHub để xác minh kết luận cuối). UI click, tạo node thật, lưu/reload và Mac Ventura **NOT TESTED**; không đánh dấu DONE nghiệm thu.


### DONE-0032 — Regression đường nối toolbar Canvas và Home Batch (kiểm thử tĩnh + CI, chưa nghiệm thu UI)
- **Ngày/người thực hiện:** 2026-11-09, ChatGPT (GPT-6). Nhánh tích hợp PR #4 Draft.
- **Lỗi CI trước đó:** run [42591076127](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42591076127) FAILED do TS2724: Tabler không export `IconShapes`. Đã sửa bằng `IconShape` trong [4aa196f](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/4aa196f661a0df1559b229a34ede4242a8631982); run [42591313409](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42591313409) SUCCESS.
- **Regression mới:** `apps/web/tests/workspaceNavigation.test.ts` kiểm tra hợp đồng nguồn thứ tự các nút, một cặp dialog, phương thức qua Canvas Host, chọn dự án và route Batch, các payload có directory; bổ sung chạy trong `.github/workflows/integrationCheck.yml`. [Commit 8293dc3](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/8293dc3cbe3843b23a44048df01de434a0c46c3f), [CI #42591976160](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42591976160) **SUCCESS** (typecheck, regression suite, build).
- **Giới hạn:** test nguồn không thay thế click thật; click mở dialog, tạo preset node, upload ảnh nhân vật, lưu/reload và Mac Ventura **UI NOT TESTED**. Batch/Muse AI E2E **BLOCKED** do không có trình duyệt/VM và tài khoản kết nối trong môi trường kiểm thử.


### DONE-0033 — Chặn phản hồi model AI cũ ghi đè workspace Batch mới (CODED; CI chưa xác nhận)
- **Người thực hiện:** ChatGPT (GPT-6), 2026-11-09. Branch `feat/toonflow-functional-completion` tạo từ release `c73a5e40`; **không sửa release 2 commit**.
- **Lỗi tiềm tàng có chứng cứ code:** `batchPage.vue` gọi bất đồng bộ `/api/ai/media/models` khi kích hoạt Batch / đổi workspace; hàm cũ không kiểm tra liệu component đã rời workspace hay chưa trước khi cập nhật `models` và `modelKey`.
- **Thay đổi thật:** `apps/web/src/pages/workspace/components/batchPage.vue` thêm request generation token; chỉ phản hồi model thuộc phiên kích hoạt hiện tại mới được cập nhật; hủy hiệu lực kết quả cũ khi đổi workspace/kind, inactive hoặc unmount. Không đổi API/schema/provider.
- **Commit:** [73e1731](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/73e173104f3e70c2a947ffdf5a1a7628e3f7c013) (mã); [f866d62](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/f866d6221214fd2eab711ca2cd9c7a997b458f48) (regression guard); [45797ae](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/45797ae8e543eca468a73dd2f43fb4412f9bc38a) (CI push cho nhánh thử nghiệm).
- **Kiểm tra đang chờ:** [GitHub Actions run 42599007281](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42599007281); kiểm thử hợp đồng nguồn không bằng browser E2E. Không tự gọi Muse, Render hoặc file người dùng.
- **Nghiệm thu:** **CODED / E2E NOT TESTED** cho tới khi có thao tác chuyển dự án nhanh và xác minh model tương ứng trong UI.


### DONE-0034 — Chrome Bridge diagnostic readiness guard và kịch bản smoke HTTP chỉ đọc (CODED, CI riêng; Mac E2E chưa test)
- **Ngày/người thực hiện:** 2026-11-09, ChatGPT (GPT-6); nhánh `feat/toonflow-functional-completion`.
- **Lỗi từ logic đang có:** `bridgeDiagnosis` ưu tiên các trạng thái task cũ `running/unknown` hơn việc mất kết nối Extension/thiết bị; một tab đã chọn nhưng `capabilities=[]` vẫn hiển thị `ready`. Đây là lỗi xác nhận bằng điều kiện nguồn và regression fixture, **không phải log tái hiện trên Mac**.
- **Sửa runtime:** `apps/server/src/utils/chromeBridge/dispatchGuard.ts`, commit [71360cf](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/71360cf20c694aa5c1b2abc15b08150107c86c52) và [0bbc54c](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/0bbc54c10b8bdac1475d9e758aa53b8a49b8b4cb): khi mất kết nối báo offline; chỉ báo ready khi tab có capability được xác nhận. Không sửa điều kiện cấm retry Task ID UNKNOWN hoặc giao thức provider.
- **Regression thực thi trên CI:** `apps/server/src/utils/chromeBridge/dispatchGuard.test.ts`; [CI 42607487305](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42607487305) và [CI 42607808516](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42607808516) **SUCCESS** (typecheck, regression, Vietnamese audit, FFmpeg fixture, build).
- **Smoke Mac:** thêm `scripts/smokeLocal.ts` tại [f59ee74](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/f59ee74a49172f101b75309dff12044afb56e41e), kiểm GET Web HTML, GET `/api/workspaces/list` và GET `/api/desktop/chromeBridge/diagnostics` qua origin loopback; syntax CI trong [b162b3c](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/b162b3cccb9ea246625101fbafc624fb959ff8d9). Đây là công cụ chạy trên Mac, **chưa được chạy bằng Web/Server thật trong môi trường hiện tại**.
- **Giới hạn:** environment không có Bun/Chrome, DNS `github.com` của Terminal không truy cập được. **Browser E2E NOT TESTED, Mac Ventura/Muse VM/Render E2E BLOCKED**. Không gọi AI trả phí, không đụng workspace thật.

- **Bổ sung smoke parser:** [409f5a6](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/409f5a6440af0526e4626d7dd1131f07020b10bf), [3544133](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/35441338e880161c4076af531342c56b14b46cac): regex `<html>` chấp nhận thuộc tính lang/whitespace đúng. **Chưa khẳng định smoke Mac PASS**. CI liên quan: [42608340985](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42608340985) (xem kết luận GitHub).
