# Xử lý media bằng FFmpeg

Cung cấp `ffmpeg` và `ffprobe` cho Agent, kết nối trực tiếp qua `context.ffmpeg()`, dùng lại chương trình thực thi cấu hình trong chợ plugin và cầu nối gọi lệnh sẵn có của node.

## Cách gọi

`ffprobe` nhận đường dẫn tệp và các tham số gốc tùy chọn:

```json
{ "path": "assets/input.mp4", "options": ["-count_frames"] }
```

`steps` của `ffmpeg` gọi các phương thức fluent theo thứ tự; `operation` chỉ định phương thức thực thi cuối cùng, mặc định `run()` nếu bỏ qua. Ví dụ xuất chuỗi ảnh:

```json
{
  "steps": [
    { "method": "input", "args": ["assets/input.mp4"] },
    { "method": "fps", "args": [1] },
    { "method": "output", "args": ["assets/frame%03d.png"] }
  ]
}
```

Cũng có thể dùng `operation: { "method": "save", "args": ["assets/output.mp4"] }` hoặc thao tác gốc như `screenshots`, `concat`. Để truy vấn encoder, codec, định dạng hoặc bộ lọc được hỗ trợ, bỏ `steps` và đặt `operation.method` thành `availableEncoders`, `availableCodecs`, `availableFormats` hoặc `availableFilters`.

`options` tương ứng với tham số khởi tạo fluent mà host hỗ trợ: `source`, `cwd`, `niceness`, `priority`, `stdoutLines`, `timeout`. `steps` hỗ trợ toàn bộ phương thức cấu hình và tên thay thế có sẵn của host; các giá trị JSON trong `args` được giữ nguyên, còn `undefinedArgs` có thể chỉ định vị trí cần truyền `undefined`.

## Năng lực gốc và thực thi

- Không đặt thêm danh sách cho phép các tham số FFmpeg; không tách hoặc viết lại `inputOptions`, `outputOptions` hay tham số bộ lọc.
- Không giới hạn đầu ra ở một tệp: chuỗi ảnh, phân đoạn HLS/DASH, nhiều đầu vào/đầu ra đều được xử lý theo khả năng gốc.
- Không chuyển hướng sang tệp tạm hay ép giới hạn thời gian chạy. Thư mục đầu ra phải được chuẩn bị theo yêu cầu gốc; ghi đè tệp có sẵn tuân theo quy tắc FFmpeg. Nếu không yêu cầu ghi đè, nên chọn tên tệp mới.
- Giữ nguyên kiểm tra đường dẫn workspace tường minh của host, thông báo cài đặt khi thiếu FFmpeg, cơ chế truyền lỗi và hủy chuyển đổi. Khi hủy hoặc lỗi, có thể còn tệp dở do quá trình xử lý gốc tạo ra; công cụ không tự xóa tài nguyên.

Công cụ truyền dữ liệu gọi lệnh ở dạng JSON, không nhận JavaScript, callback hay luồng Node; chương trình thực thi được cấu hình qua chợ plugin. Host chỉ kiểm tra các đường dẫn tệp được khai báo trực tiếp: truy cập gián tiếp qua tham số gốc, bộ lọc hoặc danh sách media không phải sandbox hệ thống tệp. Giao diện gốc của FFprobe và truy vấn khả năng không cung cấp tiến trình con; hủy chỉ dừng chờ, còn truy vấn bên dưới tự thoát.
