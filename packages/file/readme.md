# Năng lực thao tác tệp cơ bản

`@toonflow/file` là điểm vào thao tác tệp dùng chung cho Node/Bun, chỉ quản lý ghi nguyên tử và hàng đợi tệp trong tiến trình. Đường dẫn tệp toàn cục do module sở hữu quyết định; tệp workspace vẫn phải qua `resolveWorkspacePath` của server, khóa nghiệp vụ và kiểm tra quyền API trước. Module sử dụng vẫn chịu trách nhiệm giao dịch cài đặt, rollback, định dạng dữ liệu và thông báo lỗi.

```ts
import { readFile, writeAtomic } from "@toonflow/file";

await writeAtomic(absolutePath, JSON.stringify(snapshot));
const content = await readFile(absolutePath, "utf8");
```

- `writeAtomic` / `writeAtomicSync`: tạo tệp tạm tên ngẫu nhiên ngắn trong cùng thư mục với cờ `wx`, ghi đầy đủ rồi đổi tên. Với `exclusive: true`, Bun trên Windows và mobile dùng đổi tên độc quyền của hệ thống; môi trường khác dùng hard link để commit. Nếu đích đã tồn tại, trả `EEXIST`, không ghi đè tệp, thư mục hoặc symbolic link. Quyền mặc định `0o600`; không tự tạo thư mục cha, không gộp các snapshot, không bảo đảm bền vững dữ liệu khi mất điện.
- Các thao tác `writeFile`, `appendFile`, `copyFile` thông thường vẫn theo ngữ nghĩa thư viện chuẩn và tham gia hàng đợi. Snapshot nghiệp vụ cần thay thế toàn bộ phải chọn rõ API nguyên tử. Không âm thầm chuyển thao tác append, sao chép khi hot reload hoặc staging lúc cài đặt thành loại thao tác khác.
- `async-mutex` quản lý hàng đợi FIFO: tối đa 64 lượt đọc đồng thời trên cùng tệp, ghi độc quyền; tệp khác nhau có thể xử lý song song. Đường dẫn trên Windows không phân biệt chữ hoa/thường; với nhiều đường dẫn, lấy khóa theo thứ tự cố định để tránh deadlock. Module gọi chịu trách nhiệm `realpath`, liên kết và giới hạn giao dịch ở cấp thư mục.
- Luồng đọc/ghi, handle do `open` trả về và thư mục do `opendir` trả về đều giữ quyền truy cập cho đến khi đóng; bên gọi phải hoàn tất, hủy hoặc đóng chúng. Thời gian chờ hàng đợi tối đa 30 giây, hỗ trợ `AbortSignal` qua `withFileAccess`. Lời gọi đồng bộ gặp thao tác xung đột chưa xong trong cùng tiến trình sẽ báo `EBUSY` ngay.
- Luồng đọc/ghi theo đường dẫn hỗ trợ `AbortSignal` và `destroy()`; hủy trong lúc chờ quyền truy cập sẽ không mở hoặc cắt ngắn tệp về sau. Nếu việc đóng cấp thấp thất bại và handle có thể vẫn còn hiệu lực, tiếp tục giữ quyền truy cập. Không nhận `fd` hoặc `fs` tùy biến từ ngoài để vượt hàng đợi; handle đã mở dùng phương thức stream của đối tượng trả về từ `open`. Phần tử đang chờ đã hủy trong semaphore bên thứ ba vẫn chờ tới vị trí cũ rồi trả quyền, không thực thi nghiệp vụ và không phá thứ tự ban đầu.
- `rename` và commit nguyên tử dùng số lần thử lại hữu hạn của `stubborn-fs`, tối đa khoảng 5 giây; nếu tệp vẫn bị giữ, ném lỗi gốc. Không thử lại toàn bộ giao dịch cài đặt nhiều bước hoặc input stream đã bị tiêu thụ. Ghi nguyên tử chỉ dọn tệp tạm do chính lượt này tạo, lỗi đóng/dọn không được che lỗi ghi ban đầu. Nếu commit đã thành công mà dọn tệp tạm thất bại, chỉ ghi cảnh báo, không báo nội dung đã lưu là thất bại.
- `withFileAccess(paths, kind, action, signal?)` cho phép HTTP/SDK và module khác thích nghi với I/O gốc; callback phải chờ thao tác thực sự kết thúc. Đây không phải khóa tái nhập: không gọi lại các thao tác I/O được quản lý bởi gói từ callback trên cùng đường dẫn. Nếu cần tổ hợp thao tác, module nghiệp vụ quyết định phạm vi giao dịch.

Các phương thức Bun về tệp được import qua `@toonflow/file/bun`: `file`, `write`. Giá trị trả về giữ đúng danh tính Blob; `text/json/arrayBuffer/bytes/formData/stream/write/delete/unlink` tham gia hàng đợi. Đường dẫn dạng chuỗi, URL và byte dùng chung hàng đợi tệp. `file` không nhận fd từ ngoài; `FileSink.writer` đồng bộ không được cung cấp, ghi luồng dùng `createWriteStream`. Khi Blob được giao cho đối tượng tiêu thụ gốc như `Response`, module gọi quản lý vòng đời tiêu thụ; cần phối hợp với sửa đổi thì dùng `withFileAccess` trong module.

`write` và `file(...).write` chỉ nhận dữ liệu không phải stream. `Response`, `Request`, `ReadableStream` dùng `pipeline` chuẩn cùng `createWriteStream`, truyền tín hiệu hủy cho cả stream và `pipeline`. Một số đầu vào stream bất thường ở Bun 1.3.14 khiến `Bun.write` không bao giờ hoàn tất; gói từ chối trực tiếp những đầu vào đó để tránh giữ hàng đợi tệp.

Gói không chiếm quyền quản lý hệ thống tệp bên trong thư viện bên thứ ba, tiến trình ngoài, C#/NSIS hoặc khóa tệp của hệ điều hành. Lưu trữ bền vững của SDK, cấu hình, HTTP, FFmpeg và bộ cài vẫn giữ ranh giới module riêng. Không đưa SDK nghiệp vụ vào đây hoặc sửa `node:fs` trên toàn ứng dụng.
