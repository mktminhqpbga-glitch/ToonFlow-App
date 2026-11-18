# Thao tác Canvas

Cho phép Agent thao tác trực tiếp Canvas đang mở trong dự án để xây dựng và sắp xếp luồng node.

## Cách sử dụng

Mở Canvas của dự án cần thao tác, rồi mô tả công việc, ví dụ: “Sắp xếp Canvas hiện tại”, “Thêm node văn bản để viết phân cảnh” hoặc “Nối ảnh tham chiếu này với node tạo video”.
Agent sẽ tra cứu node và khả năng thực tế trước khi thực hiện, ưu tiên dùng lại node hiện có.

## Tính năng

- Tạo, chuyển và đổi tên Canvas.
- Thêm node; di chuyển, đổi tên, chọn và xóa nhiều node cùng lúc.
- Nối nhiều cặp cổng tương thích hoặc xóa nhiều dây nối cùng lượt.
- Tự sắp xếp Canvas dựa vào kích thước node và dây nối, hoặc chỉnh khung nhìn tới node cần xem.
- Gọi chức năng node có hỗ trợ như sửa chữ, đặt prompt hoặc tạo media theo schema thực tế của node.

Canvas mục tiêu phải đang khả dụng. Loại node có thể thêm phụ thuộc plugin đã cài; dây nối phải thỏa điều kiện đầu vào.
Tác vụ tạo media cần chờ kết quả thực tế sau khi bắt đầu; tự sắp xếp Canvas không chạy tạo media.
Không cần API Key riêng cho công cụ này; cấu hình tạo media thuộc nhà cung cấp tương ứng.
