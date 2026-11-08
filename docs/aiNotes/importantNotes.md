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
- **Giới hạn:** MV3 worker/job in-memory chưa chứng minh khả năng khôi phục sau restart; cần test thật.

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

## Mẫu lưu ý mới

### NOTE-xxxx — Tên lưu ý

- **Ngày:** YYYY-MM-DD HH:mm (UTC+7)
- **Người ghi / AI:** [tên và model]
- **Thông tin hoặc quyết định:** [mô tả chính xác]
- **Lý do / ảnh hưởng:** [vì sao AI khác cần biết]
- **Phạm vi:** [đường dẫn, module hoặc toàn dự án]
- **Nguồn / bằng chứng:** [file/commit/yêu cầu trực tiếp]
- **Có cần xác minh lại không?:** Có/Không; [khi nào]
