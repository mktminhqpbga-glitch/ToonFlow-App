# Những yêu cầu cốt lõi bắt buộc phải đọc để làm việc

1. **Mục tiêu:** Xây dựng AI Canvas Studio tương tự ToonFlow, có Canvas vô hạn, node tạo ảnh/video, quản lý dự án và kết nối AI bên ngoài.
2. **Công nghệ:** Vue 3, TypeScript, Vue Flow, Element Plus, Bun/Node.js, SQLite, Chrome Extension Manifest V3 và WebSocket.
3. **Quản lý ID:** Mọi thành phần giao diện, chức năng và API phải có ID rõ ràng theo quy tắc `AC.NHÓM.CHỨC_NĂNG.THÀNH_PHẦN`.
4. **Giao diện:** Tối giản, chuyên nghiệp, hỗ trợ kéo thả node, nối dây, thu phóng và tự động lưu dữ liệu.
5. **Kết nối AI:** Ưu tiên kết nối một nhà cung cấp trước, hoàn thiện quy trình rồi mới mở rộng.
6. **Chrome Extension:** Ghép nối bằng mã đơn giản, nhận diện tab AI, gửi tác vụ và nhận kết quả đúng.
7. **Task ID:** Mỗi lần gửi phải có ID riêng. Không tự gửi lại tác vụ khi mất kết nối, không lấy nhầm kết quả cũ.
8. **MapID:** Có hệ thống xác định từng nút trên giao diện, cho phép sao chép ID, chức năng, file mã nguồn và selector.
9. **Triển khai theo 3 giai đoạn:** Ứng dụng cơ bản → kết nối AI thật → hoàn thiện và đóng gói Desktop.
10. **Kiểm thử:** Không được tuyên bố hoàn thành khi chức năng chưa chạy và chưa được kiểm chứng.

## Quy tắc cứng bổ sung

- **Giao diện và chức năng phải đi cùng nhau:** Nút được tạo phải có hành vi được xác định, không chỉ để trang trí.
- **ID phải ổn định:** Để sau này có thể yêu cầu AI sửa chính xác một thành phần mà không ảnh hưởng những phần khác.
- **Không làm mất dữ liệu:** Giữ nguyên dự án, node, kết nối và kết quả đã lưu.
- **Xây dựng tuần tự:** Hoàn thiện và kiểm thử từng giai đoạn trước khi mở rộng.
