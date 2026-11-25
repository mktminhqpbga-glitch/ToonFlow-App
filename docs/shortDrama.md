# Phim ngắn trong MacFlow

Mở **Tổng quan → Phim ngắn** trong một dự án MacFlow. Mỗi dự án giữ một bảng phân cảnh, gồm kịch bản, danh sách cảnh và các prompt cho ảnh/video. Bảng dùng chung với cửa sổ MacFlow mở đúng dự án và kiểm tra phiên bản khi lưu để bảo vệ bản chỉnh ở cửa sổ khác.

## Từ kịch bản đến phân cảnh

1. Nhập tên tập và dán kịch bản. Thêm từng cảnh hoặc chọn mô hình văn bản trong MacFlow rồi bấm **AI chia phân cảnh**. Mô hình được yêu cầu viết mô tả và prompt bằng tiếng Việt, giữ diễn biến và lời thoại gốc.
2. Chỉnh thứ tự, tên, thời lượng, mô tả và lời thoại. Thời lượng `0` thể hiện chưa chốt. Mỗi cảnh có prompt ảnh và prompt video riêng.
3. Bấm **Đưa sang Xưởng ảnh** hoặc **Đưa sang Xưởng video**. MacFlow lưu bảng và điền prompt của cảnh đang chọn vào đúng xưởng. Ở xưởng, chọn mô hình, thêm tư liệu tham chiếu nếu cần rồi dùng nút **Thêm vào hàng chờ**. Khi xong, kết quả xuất hiện trong lịch sử xưởng.
4. Bấm **Tải Markdown** để giữ kịch bản và các cảnh trong một tệp. **Đưa vào Canvas** tạo một node **Văn bản** với nội dung này khi Canvas đã mở và node Văn bản đang bật. Mọi chỉnh sửa trong Canvas tiếp tục dùng trình sửa Văn bản có sẵn.

## Nhập một tập từ Huobao Drama

1. Chạy Huobao Drama trong môi trường được phép sử dụng của bạn và mở tập cần chuyển. Dùng ID của tập trong dữ liệu dự án Huobao. Số thứ tự hiển thị của tập và ID có thể khác nhau.
2. Trong **Phim ngắn → Nhập từ Huobao**, nhập địa chỉ máy đang chạy Huobao và ID tập, rồi bấm **Mở JSON của tập**. Nút mở endpoint `GET /api/v1/episodes/{episode_id}/storyboards` ở một tab riêng. Bạn cũng có thể mở endpoint trực tiếp, ví dụ `http://localhost:5679/api/v1/episodes/3/storyboards`.
3. Lưu phản hồi dưới dạng `.json` rồi bấm **Chọn tệp JSON**, hoặc sao chép phản hồi vào mục **Dán JSON** trong MacFlow. Hộp thoại nhận tối đa 300 cảnh và 4 MiB. MacFlow giữ thứ tự cảnh, tên, mô tả, thông tin góc máy, thời lượng và hai prompt. Kiểm tra các cảnh sau khi nhập rồi bấm **Lưu dự án**.
4. Để dịch dữ liệu nhập, chọn mô hình văn bản và bấm **Việt hóa cảnh** ở cảnh cần dịch. Kiểm tra lời thoại, tên riêng và mô tả trước khi gửi tác vụ. Khả năng xử lý và mức sử dụng phụ thuộc mô hình đã chọn.

Tra cứu hợp đồng nhập tại repo Huobao Drama, nhánh `master`, mã nguồn đối chiếu `24d4c17612e71cf10c8eeb1a8b6439afa73e2c07`. Huobao phân phối theo CC BY-NC-SA 4.0. Trang **Phim ngắn** dùng mã và giao diện MacFlow cùng bộ nhập dữ liệu tương thích với endpoint công khai. Tệp ảnh, clip và bản ghép của Huobao tiếp tục được quản lý ở Huobao. [Mã route phân cảnh](https://github.com/chatfire-AI/huobao-drama/blob/24d4c17612e71cf10c8eeb1a8b6439afa73e2c07/backend/src/routes/episodes.ts) · [Giấy phép Huobao](https://github.com/chatfire-AI/huobao-drama/blob/24d4c17612e71cf10c8eeb1a8b6439afa73e2c07/LICENSE)
