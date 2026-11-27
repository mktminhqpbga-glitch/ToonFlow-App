# Phim ngắn trong MacFlow

Mở **Phim ngắn → Mở bảng phân cảnh MacFlow đã lưu** trong một dự án MacFlow. Dùng **Tạo storyboard mới** để tạo một bảng riêng cho tập khác và dùng danh sách cạnh nút để mở lại các bảng. Mỗi bảng giữ kịch bản, nhân vật, ảnh xem trước và phân cảnh riêng. MacFlow lưu nháp trên trình duyệt và kiểm tra phiên bản khi bấm **Lưu dự án** để bảo vệ bản đã sửa ở cửa sổ khác. [Chạy Huobao Drama với MacFlow](huobaoDrama.md)

## Từ kịch bản đến phân cảnh

1. Nhập tên tập và dán kịch bản. Mở ví dụ bên dưới ô kịch bản nếu cần. Thêm cảnh thủ công hoặc chọn mô hình văn bản rồi bấm **AI chia phân cảnh**. Khi AI chạy, bạn sẽ thấy thời gian chờ và nút dừng. Mức sử dụng và chi phí phụ thuộc nhà cung cấp mô hình.
2. Thêm danh sách nhân vật, chỉnh tên, thời lượng, mô tả, lời thoại và ghi chú sản xuất. Kéo tay nắm của cảnh hoặc bấm **Lên trước** và **Xuống sau** để đổi thứ tự. Cảnh do AI chia có thời lượng ước tính. Với cảnh cũ còn 0 giây, bấm **Ước tính thời lượng còn thiếu**, rồi chỉnh số giây theo nhịp dựng. Bấm **Tải ảnh cảnh** để thêm ảnh PNG, JPG hoặc WebP tối đa 6 MiB. Nếu vừa bỏ nhầm cảnh, bấm **Hoàn tác** ngay trên bảng.
3. Bấm **Đưa sang Xưởng ảnh** hoặc **Đưa sang Xưởng video**. MacFlow lưu bảng và điền prompt của cảnh đang chọn vào đúng xưởng. Ở xưởng, chọn mô hình, thêm tư liệu tham chiếu nếu cần rồi dùng nút **Thêm vào hàng chờ**. Khi xong, kết quả xuất hiện trong lịch sử xưởng.
4. Bấm **Tải Markdown** để giữ kịch bản và các cảnh trong một tệp, hoặc bấm **In hoặc lưu PDF** và chọn **Lưu dưới dạng PDF** trong hộp thoại in. **Đưa vào Canvas** tạo một node **Văn bản** ở chỗ trống, với tên bảng và thời điểm xuất. Bấm **Đọc toàn bộ** để đọc nội dung. Để dùng nội dung này cho **Tạo ảnh**, bấm cổng đầu ra của **Văn bản**, rồi bấm cổng đầu vào của **Tạo ảnh**. Phần văn bản đã nối hiện trong node nhận.

## Nhập một tập từ Huobao Drama

1. Chạy Huobao Drama trong môi trường được phép sử dụng của bạn và mở tập cần chuyển. Dùng ID của tập trong dữ liệu dự án Huobao. Số thứ tự hiển thị của tập và ID có thể khác nhau.
2. Trong bảng phân cảnh đã lưu, chọn **Nhập từ Huobao**, nhập địa chỉ máy đang chạy Huobao và ID tập, rồi bấm **Mở JSON của tập**. Nút mở endpoint `GET /api/v1/episodes/{episode_id}/storyboards` ở một tab riêng. Bạn cũng có thể mở endpoint trực tiếp, ví dụ `http://localhost:5679/api/v1/episodes/3/storyboards`.
3. Lưu phản hồi dưới dạng `.json` rồi bấm **Chọn tệp JSON**, hoặc sao chép phản hồi vào mục **Dán JSON** trong MacFlow. Hộp thoại nhận tối đa 300 cảnh và 4 MiB. MacFlow giữ thứ tự cảnh, tên, mô tả, thông tin góc máy, thời lượng và hai prompt. Kiểm tra các cảnh sau khi nhập rồi bấm **Lưu dự án**.
4. Để dịch dữ liệu nhập, chọn mô hình văn bản và bấm **Việt hóa cảnh** ở cảnh cần dịch. Kiểm tra lời thoại, tên riêng và mô tả trước khi gửi tác vụ. Khả năng xử lý và mức sử dụng phụ thuộc mô hình đã chọn.

Điền **Ghi chú nhập** nếu bạn muốn lưu nguồn hoặc phiên bản của tập. Với máy chủ Huobao riêng có bảo vệ, mở **Kết nối Huobao có khóa truy cập** và dùng khóa do người quản trị cấp nếu máy chủ chấp nhận `X-API-Key` từ MacFlow. MacFlow che khóa trong ô nhập và xóa khỏi biểu mẫu sau khi nhập. Bạn có thể dùng tệp JSON nếu máy chủ giới hạn kết nối giữa hai trang.

Tra cứu hợp đồng nhập tại repo Huobao Drama, nhánh `master`, mã nguồn đối chiếu `24d4c17612e71cf10c8eeb1a8b6439afa73e2c07`. Huobao phân phối theo CC BY-NC-SA 4.0. Bảng phân cảnh đã lưu dùng giao diện MacFlow và bộ nhập dữ liệu từ endpoint Huobao. [Mã route phân cảnh](https://github.com/chatfire-AI/huobao-drama/blob/24d4c17612e71cf10c8eeb1a8b6439afa73e2c07/backend/src/routes/episodes.ts) · [Giấy phép Huobao](https://github.com/chatfire-AI/huobao-drama/blob/24d4c17612e71cf10c8eeb1a8b6439afa73e2c07/LICENSE)
