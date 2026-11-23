Thả video hoặc nối cổng Video đầu vào, chỉnh **Prompt phân tích** và chọn mô hình. Bấm **Phân tích kịch bản** để gửi tư liệu và prompt trong cùng một yêu cầu. Nhập thông tin sản phẩm mới nếu muốn áp dụng cấu trúc video mẫu cho sản phẩm khác.

Chế độ Video cần mô hình nhận tệp video. Với tệp lớn, node dùng FFmpeg để tạo bản MP4 nhỏ hơn, giữ thời lượng và âm thanh nguồn. Bạn có thể cài FFmpeg trong Chợ plugin.

Chế độ Khung hình gửi ảnh mẫu kèm prompt tới mô hình đọc ảnh. Kịch bản từ API được lưu vào node **Text** (Văn bản) của Canvas. Nếu đã nối cổng kịch bản vào Text, node dùng lại kết nối đó và giữ nội dung bạn đã viết. Nếu chưa nối, một node Text mới được tạo ở bên phải.

Dùng **Xem node Text** để tìm kết quả. Với kịch bản đã có từ bản cũ, bấm **Đưa kết quả vào node Text** để chuyển sang node Văn bản.
