# Dựng video từ tư liệu trong MacFlow

Mở dự án rồi vào **Xưởng tạo video → Dựng video từ tư liệu**. MacFlow chạy bộ dựng cục bộ của MoneyPrinterTurbo bằng Python và FFmpeg trên máy đang chạy ứng dụng. Trình duyệt sử dụng địa chỉ và cổng MacFlow hiện có.

## Dựng video

1. Tải ảnh và clip lên hoặc chọn từ thư viện MacFlow. Sắp xếp cảnh và chỉnh số giây của từng cảnh. Danh sách này và nhạc nền được dùng chung cho cả đợt.
2. Nhập một kịch bản, hoặc nhập nhiều mục như `[Giới thiệu sản phẩm] [Ba cách sử dụng]`. Bấm **Thêm vào danh sách**. Có thể dùng mô hình văn bản đã cài để viết kịch bản và chỉnh lại trước khi duyệt.
3. Tải bản thu lời đọc cho từng video nếu cần. Với **Chèn phụ đề**, nhập một dòng kịch bản cho mỗi cảnh và theo cùng thứ tự. Phụ đề hiển thị trong thời gian của cảnh. Đặt tổng thời lượng đủ cho bản thu. Tiếng gốc của clip được thay bằng nhạc nền và lời đọc đã chọn.
4. Đánh dấu **Đã duyệt kịch bản** rồi bấm **Thêm vào hàng chờ**. Mỗi cặp ngoặc vuông có tác vụ và MP4 riêng. Hạn mức chạy song song 1–10 dùng chung với Xưởng video.
5. Khi hoàn thành, bấm **Xem video**, **Tải MP4** hoặc **Lưu vào thư viện**. MP4 cũng được lưu trong `assets/generated` của dự án và xuất hiện trong lịch sử Xưởng video.

Bản nháp và các mã theo dõi được lưu theo trình duyệt và dự án. Hàng chờ và MP4 nằm trên máy MacFlow. Tải lại trang sẽ kiểm tra tiếp mã đã lưu. **Dựng lại** tạo lượt mới cho mục lỗi hoặc bị hủy. **Tiếp tục dựng** dùng lại lượt đã gián đoạn. **Gửi lại yêu cầu đã lưu** dùng cùng mã nếu máy chủ chưa nhận yêu cầu.

## Phụ thuộc và mã nguồn

- Cần Python 3.11 trở lên và FFmpeg/FFprobe có bộ mã hóa `libx264`. Chèn phụ đề cần bộ lọc `subtitles` của FFmpeg và phông chữ có dấu tiếng Việt. MacFlow dùng bộ FFmpeg đã cấu hình trong **Chợ plugin → FFmpeg**.
- Tích hợp chạy từ tư liệu cục bộ gồm PNG, JPG, WebP, MP4, MOV và WebM. Lời đọc và nhạc nền dùng MP3, WAV, M4A, FLAC, AAC hoặc Ogg. Giới hạn mỗi video là 20 cảnh, 5 phút và 300 MiB tư liệu. Mỗi tệp tối đa 100 MiB.
- Bộ dựng dùng mô-đun [video_project.py của MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo/blob/71dced7aea880440916a8b1920d3db1ee7cd2866/app/services/video_project.py) theo [giấy phép MIT](../services/moneyPrinterTurbo/upstream/LICENSE). MacFlow bổ sung tham số đường dẫn FFmpeg khi tạo bản dựng và xử lý ảnh tĩnh, bản thu và phụ đề ở lớp kết nối.
