# Tìm kiếm web

Tìm trang công khai và cung cấp cho Agent tiêu đề, liên kết nguồn và tóm tắt. Mặc định dùng `duck-duck-scrape` để tìm DuckDuckGo không cần tài khoản/API Key; có thể chọn DeepSeek hoặc Tavily.

## Cách sử dụng

Nói yêu cầu tìm trong cuộc trò chuyện, ví dụ: “Tìm tài liệu gần đây về tạo video bằng AI, liệt kê nguồn và các ý chính”.
Kết quả tìm kiếm chỉ giúp tìm nguồn; để xác minh đầy đủ nội dung nên dùng thêm công cụ **Đọc trang web**.

## Cấu hình

Vào **Cài đặt → Chợ tiện ích → Đã cài → Tìm kiếm web → Cấu hình**.

- **Dịch vụ tìm kiếm:** mặc định DuckDuckGo (không cần khóa), có thể chọn DeepSeek hoặc Tavily.
- **DeepSeek API Key:** bắt buộc khi chọn DeepSeek, phải là khóa DeepSeek chính thức; tương thích khóa đã lưu trước đây.
- **Tavily API Key:** bắt buộc khi chọn Tavily; hai loại khóa được lưu riêng.
- **Số kết quả tối đa:** mặc định 8, tùy chọn 1–20.
- **Thời gian chờ (ms):** mặc định 30.000, tùy chọn 1.000–60.000.

DuckDuckGo cần truy cập mạng và có thể bị giới hạn lượt hoặc CAPTCHA. Khi thất bại, công cụ hiển thị nguyên nhân và gợi ý chuyển dịch vụ thủ công trong Cài đặt; không tự chuyển sang dịch vụ trả phí.
DeepSeek dùng API tìm kiếm chính thức, khóa của proxy/nhà cung cấp khác không thay được; Tavily dùng tìm kiếm cơ bản.
Trong chế độ nhiều người thuê, yêu cầu mô hình phải đi qua cổng nền tảng, nên tìm kiếm DeepSeek bằng khóa riêng chưa mở; có thể chọn DuckDuckGo hoặc Tavily. Công cụ không tự đổi dịch vụ.
Kết quả có URL nguồn để Agent trích dẫn, nhưng phần tóm tắt không có nghĩa đã đọc toàn bài.
