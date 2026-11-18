# Trình duyệt web

Cho phép Toonflow Agent điều khiển Chrome hoặc Edge trên máy và xem trực tiếp trang đang thao tác ngay trong workspace.

## Cách sử dụng

1. Bật **Trình duyệt web** trong cài đặt công cụ. Công cụ sẽ tìm trình duyệt trên máy; cũng có thể chỉ định đường dẫn tuyệt đối tới tệp thực thi.
2. Yêu cầu Agent mở trang, tìm kiếm hoặc đọc thông tin trong cuộc trò chuyện.
3. Khi Agent sử dụng trình duyệt lần đầu, một thẻ xem trước nhỏ xuất hiện bên dưới thanh công cụ của tin nhắn tương ứng. Hình ảnh được cập nhật theo từng bước, không tạo thẻ mới cho mỗi lần gọi công cụ hay chuyển thẻ xuống cuối danh sách tin nhắn. Có thể di chuột, nhấp, nhấp đúp, nhấp chuột phải, kéo thả, nhập văn bản, dùng phím bổ trợ và cuộn trang; nhấp **Phóng to** để xem chi tiết. Khi khung xem mất tiêu điểm, đổi trang hoặc ngừng theo dõi, các phím và nút chuột đang được giữ thủ công sẽ được nhả.

Thanh trên của cửa sổ phóng to có ô địa chỉ và các nút Quay lại, Tiếp, Tải lại. Nhập địa chỉ HTTP/HTTPS đầy đủ rồi nhấn Enter để truy cập. Quay lại và Tiếp dùng lịch sử thật của tab hiện tại; nút bị vô hiệu nếu không có lịch sử tương ứng. Lỗi điều hướng hiển thị ngay trong cửa sổ phóng to.

Mỗi cuộc trò chuyện với Agent dùng một phiên trình duyệt riêng và chỉ hiện một khung xem. Phiên có thể tiếp tục qua nhiều lượt hội thoại; các thao tác nhiều bước và việc phóng to/thu nhỏ cùng dùng lại một kết nối khung xem. Khi chuyển sang cuộc trò chuyện khác, việc xem tạm dừng và được tiếp tục khi quay lại; Agent vẫn có thể thao tác. Nhấn Dừng trong khi công cụ đang thao tác sẽ đóng phiên trình duyệt hiện tại để tránh tiếp tục chạy sau khi hủy; có thể mở lại. Khi thoát ứng dụng, phiên trình duyệt do lần khởi chạy hiện tại tạo sẽ được dọn.

Công cụ hỗ trợ mở trang, điều hướng, chụp trạng thái trang, đọc nội dung theo trang, nhấp, di chuột, điền văn bản, nhấn phím, cuộn, chụp ảnh màn hình và quản lý tab. Thao tác theo tham chiếu phần tử do bản chụp trạng thái trả về; nếu trang thay đổi hoặc tham chiếu không còn hợp lệ thì phải chụp trạng thái mới. Sau `hover` để mở menu, cũng cần lấy lại trạng thái. Khung xem được truyền qua giao diện riêng, không ghi vào lịch sử trò chuyện.

Yêu cầu Chrome hoặc Edge trên máy. Phiên bản đầu dùng hồ sơ trình duyệt tạm riêng, không đọc dữ liệu đăng nhập trong hồ sơ trình duyệt cá nhân. Trạng thái đăng nhập tồn tại đến khi đóng phiên trình duyệt hiện tại. Cách ly phiên trình duyệt trên máy không tương đương sandbox của hệ điều hành.

Theo mặc định, công cụ giảm một số dấu hiệu tự động hóa phổ biến: loại bỏ cờ tự động hóa khi khởi động, tắt dấu `AutomationControlled`, đặt kích thước cửa sổ và màn hình ảo khớp khung xem; trước khi điều hướng, xóa `HeadlessChrome` khỏi User-Agent nhưng vẫn giữ phiên bản, thương hiệu, nền tảng thật và Client Hints của trình duyệt. Không cần cài plugin stealth riêng và không sửa ngôn ngữ trang, GPU hay đối tượng plugin. Các thiết lập này có hiệu lực khi khởi chạy tiến trình trình duyệt mới.

Đây **không phải chế độ ẩn hoàn toàn**. Đã kiểm chứng trên Edge 153 và Chrome 154 tại máy: môi trường script của SharedWorker, ServiceWorker và những yêu cầu do chúng gửi vẫn có thể lộ `HeadlessChrome`; cửa sổ bật lên do trang tạo có thể lộ trong yêu cầu đầu và phần script đầu tiên trước khi khởi tạo. Điều chỉnh cho trang chính, iframe và DedicatedWorker không chứng minh các ngữ cảnh trên cũng đã được che. Website vẫn có thể phát hiện tự động hóa bằng hành vi, mạng và các dấu hiệu trình duyệt khác. Khi cần đăng nhập hoặc xác minh thủ công, có thể tiếp quản qua khung xem trực tiếp.

Script chạy sớm nhất của trang cũng có thể đọc được kích thước ngoài cửa sổ tạm thời là `0×0`, rồi kích thước trở lại bình thường. Chờ kích thước trang trống ổn định không loại bỏ trạng thái thoáng qua của tài liệu mới khi điều hướng, vì thế công cụ không thêm bước chờ vô hiệu hoặc tự sửa thuộc tính kích thước.

Ngày 07/10/2026, với hai trình duyệt trên, cả 20 bài kiểm tra Fingerprint Scanner của [Sannysoft](https://bot.sannysoft.com/) đều trả `ok`, hai phép thử WebDriver đạt, [BotD v2](https://github.com/fingerprintjs/BotD) trả `bot: false`. Nhóm đối chứng Edge khởi động bằng Puppeteer mặc định bị BotD nhận diện `headless_chrome`. Các kết quả công khai này chỉ chứng minh những bài kiểm tra cụ thể, không đảm bảo hệ thống chống bot của website sẽ không phát hiện tự động hóa.

## Phát triển

`bun run --filter @toonflow/tool-browser typecheck`

`NODE_ENV=dev bun run --filter @toonflow/tool-browser build`

Runtime trình duyệt và giao thức đầu vào lần lượt được xuất qua `./host` và `./protocol`. Host giữ runtime và chèn điểm gọi vào ngữ cảnh công cụ để công cụ và giao diện xem cùng dùng một phiên.

Frontend dùng `isBrowserTool` từ `./client` để lọc công cụ trình duyệt, giữ đầy đủ dữ liệu lịch sử công cụ, sau đó truyền kết quả tới `browserPanel` từ `./panel` với `tools: ToolCall[]`, `directory?: string`, `active: boolean`. Panel nằm dưới thanh công cụ của tin nhắn tương ứng. Danh sách ảo giữ lại tin nhắn trình duyệt hiện tại để cuộn hoặc thêm tin nhắn không làm hủy khung xem hay tạo lại kết nối. Nếu phiên lịch sử hết hiệu lực, panel hiển thị đã kết thúc; lỗi và gián đoạn công cụ vẫn được hiển thị trong thẻ.
