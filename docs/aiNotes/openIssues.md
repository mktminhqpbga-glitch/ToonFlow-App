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

### ISSUE-0005 — Deploy Render crash vì server không đọc được file tool trong `build/tools` (EACCES)

- **Mức độ:** Cao (triển khai).
- **Trạng thái:** Đang sửa — đã sửa `Dockerfile`, chờ xác minh bằng deploy lại trên Render.
- **Phát hiện:** 2026-11-09 16:13 (UTC+7) · **Người ghi nhận:** Muse (Muse Spark).
- **Người chịu trách nhiệm sửa:** Muse (Muse Spark).
- **Người sửa lần cuối:** Muse (Muse Spark), 2026-11-09 16:16 (UTC+7).
- **Cách tái hiện hoặc bằng chứng:** deploy Web Service `toonflow-app` trên Render (Docker, Free, Singapore, commit `ddd0667`): build Docker thành công, server crash khi khởi động với lỗi `EACCES: permission denied, copyfile '/app/build/tools/pluginDeveloper.tool.js' -> '/app/data/tools/pluginDeveloper.tool.js'`, `Exited with status 1`, `No open ports detected`; thử lại sau khi đặt `TOONFLOW_DATA_DIR=/tmp/toonflow-data` vẫn crash đúng lỗi đó. URL https://toonflow-app-hy9r.onrender.com chỉ hiện màn hình "APPLICATION LOADING" của Render.
- **Nguyên nhân đã xác nhận:** file `build/tools/pluginDeveloper.tool.js` trong bản build có quyền `600` thuộc root, các file tool khác là `640` thuộc root; `Dockerfile` chỉ `chown -R bun:bun data` rồi chạy server bằng user `bun`, nên user `bun` không đọc được file nguồn để copy — lỗi ở file nguồn, không phải thư mục đích. Đã kiểm chứng cơ chế trên máy ảo: user thường copy file `600` thuộc root thì bị `Permission denied`, sau `chown` cho user đó thì copy thành công.
- **Ảnh hưởng:** server không khởi động được trên Render, chưa có link public nào hoạt động.
- **Đã thử sửa:** 2026-11-09 — đổi `TOONFLOW_DATA_DIR` sang `/tmp/toonflow-data` trên Render (không hiệu quả, vì lỗi ở file nguồn). 2026-11-09 — sửa `Dockerfile`: `chown -R bun:bun data` thành `chown -R bun:bun data build` (commit chờ push, xem `DONE-0003`).
- **Còn tồn tại sau lần sửa cuối:** chờ deploy lại trên Render để xác minh server khởi động và URL mở được trang Toonflow.
- **Bước tiếp theo:** push commit lên nhánh `main`, Render tự build lại; kiểm tra log deploy và URL https://toonflow-app-hy9r.onrender.com; gỡ biến môi trường tạm `TOONFLOW_DATA_DIR=/tmp/toonflow-data` trên service Render để dùng lại `/app/data` mặc định.
- **Điều kiện đóng:** service Render ở trạng thái Live và URL mở được trang Toonflow.
- **Lịch sử sửa:** 2026-11-09 — Muse (Muse Spark) sửa `Dockerfile` (chown thêm thư mục `build`), chưa xác minh bằng deploy.

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
