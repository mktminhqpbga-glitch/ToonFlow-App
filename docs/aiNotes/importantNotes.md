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

### NOTE-0008 — Quy tắc Việt hóa prompt theo đúng ID được duyệt

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Nguồn:** `ToonFlow_Bang_Viet_Hoa_Prompt_v1.xlsx` và `ToonFlow_Prompt_Viet_Hoa_Cho_AI_Lap_Trinh_v1.md`; [commit code](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/cbeb30013f5a07da42c64b74eebd3d748e6d4538).
- **Quyết định:** chỉ dùng câu Việt được cung cấp cho `VI-0001`–`VI-0127` nếu chuỗi gốc khớp nguyên văn và đúng file; không tự dịch, diễn đạt lại, rút gọn hay thêm prompt. Giữ token, các tên hàm/công cụ, JSON key, schema và logic. Các chuỗi không có ID phải ghi thành issue và để nguyên.
- **Phạm vi:** System Prompt Agent, Đạo diễn 3D, một số mô tả công cụ/nút hình-video-text, Settings. **Không phải toàn bộ ToonFlow**.

### NOTE-0009 — Đường chọn ngôn ngữ không phá i18n hiện có

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Quyết định:** host Settings vẫn để chuỗi Trung làm khóa của từ điển `packages/i18n/src/locales/vi.json`; chỉ cập nhật giá trị `vi`, các locale khác giữ nguyên. System Prompt server dựa vào `apps/server/src/lib/i18n.ts` xử lý `Accept-Language` theo yêu cầu; Node plugin chỉ nhận tín hiệu `document.documentElement.lang` của host và không có riêng kho ngôn ngữ toàn cục. Prompt do người dùng tự cấu hình hoặc nhãn người dùng lưu riêng không bị tự động sửa.
- **Lưu ý:** đúng logic theo code không đồng nghĩa đã kiểm thử runtime; phải chạy GUI/chức năng AI trước khi merge.

### NOTE-0010 — Các phạm vi khóa không được đưa vào kế hoạch Việt hóa V1

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Quy tắc:** chưa dịch `providerPrompt.ts`, `v118workflow/SKILL.md`, các tài liệu `references/*`, `canvas/SKILL.md`, các prompt tool/plugin khác ngoài danh sách ID. Không thay các đoạn ghép tiếng Trung còn thiếu trong Node vì chưa có câu Việt được duyệt.
- **Nguồn:** mục `06 - CHƯA DUYỆT` của tệp Markdown được đính kèm. Mọi AI tiếp theo phải đọc bảng và `docs/aiNotes/vietnameseAuditV1.md` trước khi mở rộng.
## Mẫu lưu ý mới

### NOTE-xxxx — Tên lưu ý

- **Ngày:** YYYY-MM-DD HH:mm (UTC+7)
- **Người ghi / AI:** [tên và model]
- **Thông tin hoặc quyết định:** [mô tả chính xác]
- **Lý do / ảnh hưởng:** [vì sao AI khác cần biết]
- **Phạm vi:** [đường dẫn, module hoặc toàn dự án]
- **Nguồn / bằng chứng:** [file/commit/yêu cầu trực tiếp]
- **Có cần xác minh lại không?:** Có/Không; [khi nào]
