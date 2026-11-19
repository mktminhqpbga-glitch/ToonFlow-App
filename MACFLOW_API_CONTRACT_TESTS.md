# Kiểm chứng hợp đồng MacFlow ↔ mac2API

MacFlow đóng vai trò client. Các phép thử chạy trên dữ liệu tạm và dịch vụ HTTP loopback giả lập. Cấu hình, tác vụ, tài khoản và trình duyệt của mac2API thật ở ngoài môi trường kiểm thử.

## Đã xong

| Yêu cầu | Yêu cầu và phản hồi đã kiểm chứng |
| --- | --- |
| Đăng ký provider | Registry cài `mac2ApiMuse`, `mac2ApiChatGpt`, `mac2ApiGemini` và giữ `muse2Api`. Catalog chỉ đưa `muse/video` vào xưởng video. Muse văn bản chỉ nhận các ID văn bản cho phép, gồm `muse-spark` và `muse/text`. |
| Cấu hình và catalog | `PUT /api/mac2Api/save` lưu URL chuẩn hóa và khóa client ở cấu hình backend. `GET /api/mac2Api/status` trả trạng thái và thông tin khả năng cho màn hình cài đặt. API chỉ báo có khóa đã lưu. Chế độ đa thuê bao tiếp tục dùng cổng mô hình do quản trị viên công bố. |
| Khả năng | `GET /v1/capabilities` đọc schema v1, trạng thái từng nguồn, mô hình, giới hạn và cờ tính năng. Khi máy chủ trả 404, 405 hoặc 501, client đọc `/v1/models`, `/healthz`, `/readyz` và giữ trạng thái khả năng chưa xác minh. |
| Gửi ảnh và video | `POST /v1/images/tasks` và `POST /v1/videos` gửi header `Idempotency-Key` bằng UUID tác vụ. MacFlow lưu URL, loại tác vụ, SHA-256 của payload và UUID trước khi gửi. Biên nhận phải có ID hợp lệ và hai trường ID phải khớp nếu cùng xuất hiện. Phép thử kiểm tra POST đồng thời cùng UUID bị chặn. |
| Theo dõi và khôi phục | `GET /v1/images/tasks/{id}` và `GET /v1/videos/{id}` theo dõi biên nhận cũ. Khi biên nhận bị mất hoặc không đọc được, `GET /v1/tasks/by-request` thử tìm đúng UUID nếu tính năng được công bố. Phép thử mô phỏng phản hồi lỗi, thời hạn client, GET 404 và khởi động lại tiến trình. Các trường hợp này chỉ dùng GET để tìm hoặc tiếp tục tác vụ đã gửi. Các tác vụ còn chờ xuất hiện lại khi mở workspace được phép. |
| Lỗi gửi | HTTP 404, 409 và 429 từ POST được kiểm tra là từ chối dứt khoát. HTTP 401 từ catalog ngăn gửi. 429 dùng `Retry-After` để trì hoãn các yêu cầu mới trong hàng. Timeout, biên nhận hỏng và 5xx giữ trạng thái chưa rõ. |
| Hủy | Hủy tác vụ đang chờ ngăn POST. Khi có biên nhận và khả năng hủy, MacFlow gọi `POST /v1/images/tasks/{id}/cancel` hoặc `POST /v1/videos/{id}/cancel`. Đã mô phỏng xác nhận 200, yêu cầu hủy 202, 409 đang chạy, 409 đã kết thúc và fallback dừng cục bộ. Cả trạng thái và giải thích được lưu cùng lịch sử. |
| Hàng chờ và phạm vi | Ba tác vụ trên hai workspace cùng chia sẻ giới hạn hai tác vụ đang theo dõi ở một client. Kiểm tra một workspace khác nhận 404 khi dùng ID của dự án đầu, và một tài khoản khác bị từ chối truy cập bản ghi cục bộ. |
| Ảnh tham chiếu | Xưởng kiểm tra số lượng, MIME và kích thước theo khả năng đã đọc. Ảnh đã chọn nằm trong bộ nhớ cho đến khi bấm tạo và ghi xong vào workspace. Ảnh kết quả chỉ được thêm qua nút “Dùng ảnh hiện tại làm tham chiếu”. Bộ gửi kiểm tra chữ ký tệp, chống trùng nội dung và ánh xạ `{{ref N}}` theo thứ tự thực tế. |
| Tỉ lệ video | Fixture xác nhận payload giữ `aspect_ratio: "9:16"` cùng `resolution: "1080p"`. Xưởng giải thích khi catalog chưa công bố tỉ lệ cho người dùng chọn. |
| Đầu ra và Canvas | `GET /v1/media/{name}` chỉ đến cùng nguồn và đường dẫn kho media cấu hình, không theo chuyển hướng. Nội dung bị giới hạn dung lượng và kiểm tra chữ ký theo MIME. MacFlow ghi thành công vào workspace trước khi báo hoàn tất. Chromium đã tạo ảnh trong Xưởng, tải lại sau khi URL upstream đã được dùng hết lượt tải duy nhất, chọn ảnh kết quả làm tham chiếu và đưa ảnh vào Canvas. |
| Chrome | Tích hợp mới chỉ gửi API mac2API. Luồng AI Chrome trực tiếp có kiểm thử hồi quy riêng. |

## Phụ thuộc máy chủ mac2API

- `/v1/capabilities`, tra cứu theo khóa và hủy từ xa cần triển khai tương ứng ở mac2API. MacFlow đã kiểm chứng cả phản hồi v1 và phương án xử lý máy chủ cũ.
- Hợp đồng đã gửi mô tả endpoint nhưng không liệt kê toàn bộ trường payload tạo ảnh/video. Fixture dùng `images` dạng data URI, `aspect_ratio`, và `resolution` cho video. Cần đối chiếu các trường này, giới hạn độ phân giải và cấu trúc kết quả với bản máy chủ thực tế.
- Khả năng kết nối Chrome, trạng thái tab, hỗ trợ tham chiếu của từng website và tài nguyên đầu ra thật do mac2API xác nhận. Hai tài liệu Desktop và snapshot adapter 2.0.7 được nhắc trong yêu cầu chưa có trong checkout đám mây để đối chiếu.
- Giới hạn cục bộ áp dụng trong một tiến trình MacFlow. Với tác vụ chưa rõ trạng thái hoặc nhiều client chạy riêng, giới hạn cuối cùng do mac2API quyết định.

## Chưa kiểm chứng

- Chưa dùng khóa thật, chưa gửi prompt thật và chưa xác nhận các endpoint v1 trên máy chủ riêng của người dùng.
- Chromium xác nhận luồng ảnh từ Xưởng sang Canvas. Video 9:16 và thứ tự tham chiếu được kiểm tra ở lớp API giả lập. Chưa mở thử một video thật tạo từ mac2API trong Canvas.
- Cài đặt chia sẻ của ba provider thuộc MacFlow độc lập. Mô hình media được kiểm tra khả năng kết nối ở mục “Kết nối mac2API”. Việc tạo thử lưu tiến độ thực hiện trong Xưởng hoặc Canvas của dự án.
- Tệp tham chiếu được giữ khi đã ghi để tác vụ cũ còn dùng được. Việc thu hồi bộ nhớ và URL xem trước áp dụng khi bỏ ảnh nháp. Chưa có chức năng tự xóa các tệp đã ghi.

## Kết quả chạy

- `bun test apps/server/tests/mac2ApiContract.test.ts` — 12 đạt, 0 lỗi.
- Hồi quy lịch sử Xưởng, đưa media vào Canvas, Muse2API Python và AI Chrome — 36 đạt, 0 lỗi.
- Typecheck Web và Server thành công. Build standalone và build lại Web/Server sau các thay đổi cuối thành công.
- Kiểm chứng Chromium với máy chủ fixture loopback thành công.
