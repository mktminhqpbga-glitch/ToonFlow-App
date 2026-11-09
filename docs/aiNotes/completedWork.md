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

### DONE-0003 — Sửa quyền đọc thư mục `build/` trong Dockerfile để server chạy được trên Render

- **Ngày:** 2026-11-09 16:16 (UTC+7)
- **Người trực tiếp sửa:** Muse (Muse Spark)
- **Người yêu cầu:** chủ repository (yêu cầu đưa ToonFlow-App lên Render để có link cố định, rồi đồng ý sửa Dockerfile và deploy lại)
- **Phạm vi:** sửa lỗi deploy Render (ISSUE-0005); không thay đổi logic ứng dụng.
- **Các tệp thực sự sửa:** `Dockerfile`, `docs/aiNotes/openIssues.md`, `docs/aiNotes/completedWork.md`, `docs/aiNotes/importantNotes.md`.
- **Đã làm:** đổi dòng `chown -R bun:bun data` trong `Dockerfile` thành `chown -R bun:bun data build`, vì file `build/tools/pluginDeveloper.tool.js` có quyền `600` thuộc root (các file tool khác `640` thuộc root) mà server chạy bằng user `bun` nên không đọc được để copy sang thư mục dữ liệu; thêm `ISSUE-0005` vào `openIssues.md` và ghi chú `NOTE-0008` vào `importantNotes.md`.
- **Bằng chứng:** [commit sửa Dockerfile](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/d6f57bc1c817f10a10a23f86b04dcf2b42e1f009); log lỗi Render `EACCES: permission denied, copyfile '/app/build/tools/pluginDeveloper.tool.js' -> '/app/data/tools/pluginDeveloper.tool.js'`.
- **Đã kiểm tra:** kiểm chứng cơ chế lỗi trên máy ảo: user thường copy file `600` thuộc root thì bị `Permission denied`, sau `chown` cho user đó thì copy thành công; chưa có Docker trên máy ảo nên chưa build thử image.
- **Chưa kiểm tra:** deploy lại trên Render và mở URL https://toonflow-app-hy9r.onrender.com.
- **Vấn đề sau khi sửa:** `ISSUE-0005` vẫn mở, chờ xác minh bằng deploy lại.
- **Trạng thái:** Đã ghi vào repo (chờ push); chưa kiểm thử bằng deploy.

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
