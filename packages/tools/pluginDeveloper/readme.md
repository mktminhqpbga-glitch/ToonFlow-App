# Công cụ phát triển plugin

Đây là công cụ tích hợp của Toonflow, mã nguồn tại `packages/tools/pluginDeveloper`, được build và đóng gói cùng các công cụ mặc định. Việc biên dịch node và công cụ tái sử dụng framework cùng phụ thuộc workspace, không cần tự tạo symlink cục bộ.

Build trong thư mục này tạo `build/tools/pluginDeveloper.tool.js` ở gốc repository. Các phụ thuộc phổ biến được biên dịch trước, nén ZIP và nhúng vào gói; giới hạn kích thước JS cuối cùng dưới 10 MB:

~~~sh
bun run build
~~~

Từ gốc repository, `bun run build:tools` cũng build công cụ này. Chạy `bun run dev:plugins` hoặc build với `NODE_ENV=dev` để đồng bộ vào `data/tools/`.

Typecheck:

~~~sh
bun run typecheck
~~~

Khi cần bảo trì SDK đầy đủ, có thể build riêng kho lưu trữ và danh sách kiểm tra cho hệ điều hành/kiến trúc hiện tại, kết quả trong thư mục `build/` của công cụ:

~~~sh
bun run build:sdk
~~~

Công cụ được phân phối thành một tệp .tool.js. Lần build đầu kiểm tra và giải nén ZIP tích hợp, các lần sau dùng cache. Plugin dùng công cụ Zod của host, UI Vue với CSS thường hoặc node dùng framework và component dùng chung có thể build offline. Cache nằm cạnh tệp tool trong `pluginResources/pluginDeveloper/` và được dọn khi gỡ cài đặt. Thao tác `guide` đọc tài liệu tích hợp.

Khi dự án phụ thuộc vào phần chỉ có trong SDK đầy đủ, build mới cố gắng dùng lại hoặc tải bản SDK 1.2.0 tương thích. Lỗi cú pháp và kiểm tra đường dẫn được trả trực tiếp cho bên gọi.
