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
