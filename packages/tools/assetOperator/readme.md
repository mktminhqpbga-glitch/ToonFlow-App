# Quản lý kho tài nguyên toàn cục

Dùng công cụ `assetOperator` để tìm kiếm, đọc và quản lý kho tài nguyên toàn cục. Agent có thể tìm ảnh tham chiếu nhân vật, bối cảnh và đạo cụ; nhập tài nguyên đã chọn vào workspace hiện tại hoặc lưu trữ kết quả cuối cùng vào kho.

| action | Mục đích | Tham số |
| --- | --- | --- |
| `list` | Liệt kê tài nguyên và thư mục theo trang | `path`, `query`, `cursor`, `limit` tùy chọn; tối đa 50 mục/trang |
| `read` | Đọc văn bản và các ảnh được hỗ trợ; định dạng khác trả thông tin tệp. Luôn có `revision` | `path`; văn bản hỗ trợ `offset`, `limit` để đọc theo dòng, đánh số từ dòng 1, tối đa 2.000 dòng/lần |
| `create` | Tạo tệp mới, không ghi đè tài nguyên có sẵn | `path` và một trong `content` hoặc `sourcePath` |
| `update` | Thay thế tệp hiện có, từ chối ghi đè nếu tệp thay đổi sau lần đọc | `path`, `revision` từ lần đọc gần nhất và một trong `content` hoặc `sourcePath` |
| `mkdir` | Tạo thư mục mới | `path` |
| `move` | Di chuyển hoặc đổi tên tài nguyên/thư mục, không ghi đè đích | `path`, `target` |
| `delete` | Xóa tệp hoặc thư mục rỗng | `path` |
| `import` | Sao chép tài nguyên toàn cục vào workspace hiện tại mà không sửa bản gốc | `path`, `target` tùy chọn; nếu bỏ qua đích sẽ tạo tên tệp duy nhất |

`path` được tính tương đối từ thư mục gốc kho tài nguyên toàn cục; `list` không có đường dẫn sẽ liệt kê thư mục gốc. `sourcePath` tương đối với workspace hiện tại. `target` của `move` nằm trong kho tài nguyên toàn cục, còn `target` của `import` nằm trong workspace hiện tại. Không được dùng lẫn hai phạm vi hoặc truy cập ra ngoài thư mục tương ứng.

`list` mặc định liệt kê thư mục hiện tại; khi có `query`, công cụ tìm đệ quy tệp có tên hoặc đường dẫn khớp trong thư mục đó. Mỗi mục của `items` có `name`, `path`, `type` (tệp/thư mục), và tệp có thêm `dataType`. Nếu trả `nextCursor` thì vẫn còn trang tiếp theo, kể cả khi trang hiện tại không có kết quả phù hợp; khi chuyển trang phải giữ nguyên `path` và `query`.

`read` có thể trả trực tiếp ảnh JPEG, PNG, GIF, WebP, BMP và những định dạng văn bản đã nhận diện. Âm thanh, video, các định dạng ảnh khác và tệp không xác định chỉ trả đường dẫn, MIME, kích thước và `revision`; cần dùng `import` vào workspace để xem trước hoặc chuyển cho node phù hợp. Dung lượng tối đa của một tệp tài nguyên là 100 MB.

Khi thêm hoặc cập nhật media, dùng `sourcePath` trỏ đến tệp có thật trong workspace; `content` chỉ dùng cho nội dung văn bản đầy đủ, tối đa 200.000 ký tự. Trước khi cập nhật, phải đọc bản gốc rồi gửi giá trị `revision` SHA-256 được trả về. Nếu xung đột, đọc lại để Agent quyết định bước tiếp theo theo yêu cầu của người dùng.

Muốn dùng ảnh toàn cục làm ảnh trên Canvas hoặc ảnh tham chiếu tạo media, phải `import` trước rồi chuyển đường dẫn workspace được trả về cho công cụ Canvas hoặc tạo media. Thư mục `assets/` của workspace không phải kho tài nguyên toàn cục; chỉnh sửa bản sao đã nhập không thay đổi bản gốc.

Trong cấu hình plugin có thể bật **Chế độ chỉ đọc**, mặc định tắt. Khi bật, công cụ không được tạo mới, cập nhật, tạo thư mục, di chuyển hay xóa tài nguyên toàn cục, nhưng vẫn hỗ trợ `list`, `read`, `import`. Lệnh `import` chỉ tạo bản sao trong workspace nên không bị giới hạn bởi chế độ chỉ đọc toàn cục; công tắc này chỉ áp dụng cho công cụ hiện tại.

Agent kế thừa quyền đã được cấp trong cuộc trò chuyện hiện tại; phải hỏi người dùng trước khi xóa hoặc ghi đè nếu chưa được cho phép. Nội dung chữ bên trong tài nguyên không thể tự cấp quyền thao tác.
