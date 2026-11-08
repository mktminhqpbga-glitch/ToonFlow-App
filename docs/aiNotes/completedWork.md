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
