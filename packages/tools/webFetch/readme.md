# Đọc trang web

Cho Agent đọc nội dung từ URL công khai cụ thể, phù hợp tóm tắt bài viết, xác minh thông tin hoặc phân tích văn bản/JSON.

## Cách sử dụng

Gửi URL và yêu cầu trong cuộc trò chuyện, ví dụ: “Đọc trang này, rút ra các điểm liên quan đến sản xuất video và ghi nguồn”.
Công cụ đọc URL đã biết. Khi cần tìm trang trước, có thể phối hợp với công cụ **Tìm kiếm web**.

## Tính năng

- Trích chữ từ HTML tĩnh, đọc văn bản và JSON.
- Trả URL thực, trạng thái HTTP, nội dung và đánh dấu khi đã cắt bớt.
- Dùng fetch tích hợp của Bun để đọc HTTP(S), không chạy script của trang, không nhận URL chứa tên đăng nhập hoặc mật khẩu.
- Theo tối đa 5 lần chuyển hướng, kiểm tra giao thức mỗi lần; đọc tối đa 2 MiB nội dung đã giải nén.
- Dùng DNS và cấu hình mạng của môi trường chạy, không tự đoán địa chỉ IP sau DNS; hỗ trợ môi trường proxy Fake-IP. Công cụ không tự cô lập mạng nội bộ; nếu cần, môi trường triển khai phải chặn ở tầng mạng.

## Cấu hình

Trong **Cài đặt → Chợ tiện ích → Đã cài**, tìm **Đọc trang web** rồi bấm **Cấu hình**.

- **Thời gian chờ (ms):** mặc định 20.000; có thể đặt 1.000–60.000.
- **Số ký tự nội dung tối đa:** mặc định 40.000; cho phép 1.000–100.000, nội dung vượt sẽ bị cắt.

Không yêu cầu API Key. Trang cần JavaScript để render có thể không lấy được nội dung hoàn chỉnh.
