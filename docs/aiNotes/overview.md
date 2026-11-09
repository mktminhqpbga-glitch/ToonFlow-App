# SỔ GHI CHÚ DỰ ÁN — TOONFLOW-APP

> **Mục đích:** đây là bảng điều hướng chính thức dành cho chủ dự án và các AI/người phát triển tiếp theo. Các mục ở đây phản ánh **duy nhất repository ToonFlow-App**. Không lấy nội dung từ cuộc trò chuyện khác để tự điền thành sự thật dự án.

**Cập nhật lần đầu:** 2026-11-08 (Asia/Bangkok) · **Người tạo:** ChatGPT (GPT-6) · **Phạm vi:** sổ ghi chú, không sửa chức năng ứng dụng.

## Checkpoint tiếp quản bản độc lập

- [Tiến độ triển khai và phần còn thiếu](./implementationStatus.md)
- [Kiểm kê Việt hóa UI/prompt — chưa đạt 100%](./vietnameseFullAudit.md)
- [Kết quả kiểm thử và checklist nghiệm thu thật](./e2eAcceptance.md)

## Ba khu vực bắt buộc

| Khu vực | Để làm gì? | Liên kết |
| --- | --- | --- |
| ✅ 1. Việc đã làm | Ghi lại mọi thay đổi thực sự được lưu vào repository; ai làm, ngày nào, sửa tệp nào, có kiểm thử chưa. | [Xem việc đã làm](./completedWork.md) |
| ⚠️ 2. Vấn đề còn tồn tại | Ghi lỗi, vấn đề hoặc việc cần xác minh chưa kết thúc; ai phát hiện, ai sửa gần nhất, đã thử gì và bước tiếp theo. | [Xem vấn đề còn tồn tại](./openIssues.md) |
| 📝 3. Lưu ý quan trọng | Ghi nguyên tắc, ràng buộc, kiến trúc, cảnh báo và quyết định cần giữ nguyên để AI khác không làm sai. | [Xem lưu ý quan trọng](./importantNotes.md) |

## Hướng dẫn AI khác: quy trình bắt buộc

1. **Trước khi sửa:** đọc tài liệu này, [việc đã làm](./completedWork.md), [vấn đề còn tồn tại](./openIssues.md), [lưu ý quan trọng](./importantNotes.md) và [AGENTS.md](../../AGENTS.md). Chỉ tin vào dữ liệu được đối chiếu với code/commit hiện tại.
2. **Trước mỗi thay đổi:** ghi hoặc cập nhật mã `ISSUE-xxxx` (nếu khắc phục vấn đề) với người phụ trách và cách kiểm tra. Nếu là tính năng mới, tạo mã `DONE-xxxx` sau khi đã thực sự áp dụng, không ghi trước.
3. **Sau mỗi lần thay đổi có commit:** bắt buộc thêm dòng vào `completedWork.md`, ghi **người trực tiếp thực hiện** (tên người hoặc AI và model), commit, danh sách file, kết quả kiểm tra, tồn đọng. Không dùng tên chủ repository để thay cho người thực hiện.
4. **Sau mỗi lần sửa:** rà soát `openIssues.md`. Vấn đề chưa hết phải giữ trạng thái mở, bổ sung ngày, **người sửa lần cuối**, cách sửa đã thử và lỗi còn gặp; vấn đề đã hết chỉ đánh dấu **đã xác minh** khi có bằng chứng.
5. **Nếu phát hiện ràng buộc/quyết định mới:** thêm `NOTE-xxxx` vào `importantNotes.md` kèm người ghi, ngày và phạm vi.
6. **Báo cáo lại cho chủ dự án**: thay đổi nào đã làm, ai làm, đã kiểm tra gì, có lỗi nào còn tồn tại, link commit và các file ghi chú.
7. **Không tự ghi “đã hoàn thành”** cho việc mới chỉ phân tích, đưa ra ý tưởng, đọc file, có nút giao diện, build thành công nhưng chưa chạy thử chức năng, hoặc chưa có kết quả phản hồi. Phân biệt `Xác nhận bằng code`, `Đã chạy thử`, `Cần kiểm chứng`.
8. Nếu nhiều AI cùng làm, **không ghi đè lịch sử ghi chú** của người khác. Kéo bản mới nhất, dùng ID riêng, chỉnh sửa có căn cứ. Mỗi AI phải ký tên riêng và dẫn chứng commit của mình.
9. Không lưu API key, token, mật khẩu, dữ liệu riêng tư hoặc bí mật vào ba khu vực (đây là repository công khai).
10. Các file này là **tài liệu trên GitHub, không phải chức năng ghi chú hiển thị trực tiếp trong giao diện app**.

## Chuẩn thông tin cho từng mục

- **ID:** `DONE-0001`, `ISSUE-0001`, `NOTE-0001` (tăng dần, không dùng lại).
- **Ngày:** `YYYY-MM-DD HH:mm (UTC+7)`; nếu không biết giờ ghi ngày, không bịa thời gian.
- **Người thực hiện / người ghi nhận:** tên thật nếu được xác nhận; AI ghi `ChatGPT (GPT-6)` hoặc tên AI/model thực tế.
- **Trạng thái:** `Đã ghi vào repo` / `Đã kiểm thử` / `Chưa kiểm thử`; vấn đề dùng `Mở` / `Đang sửa` / `Chờ xác minh` / `Đã xác minh và đóng`.
- **Bằng chứng:** đường dẫn tệp, commit/PR, log kiểm thử hoặc bước tái hiện. Không có bằng chứng thì ghi `Chưa xác minh`.
- **Không suy đoán người sửa trước đó:** tên tài khoản commit chỉ là tài khoản ghi commit, không đồng nghĩa với tác giả làm code.

## Tình trạng ghi nhận khi khởi tạo (08/11/2026)

- Đã tạo bộ ghi chú và quy tắc bàn giao bằng tài liệu.
- Chưa thay đổi mã chạy frontend, backend, AI, Node hoặc quy trình build trong công việc khởi tạo này.
- Các vấn đề được ghi ban đầu là **quan sát từ nguồn** chứ không phải các lỗi đã tái hiện trên ứng dụng đang chạy.
