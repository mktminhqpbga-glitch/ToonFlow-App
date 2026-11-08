# ToonFlow Chrome Companion 0.2.0

Extension viết riêng cho ToonFlow, không sao chép mã GPL. Hỗ trợ transport Local của Desktop macOS và Remote qua Render cho bản Web Ventura đã bật Bridge.

## Cài hoặc cập nhật

1. Cập nhật backend và Web cùng phiên bản nhánh tích hợp. Chạy Web dev/build để tạo ZIP.
2. Trong **Cài đặt → AI Bridge · Chrome**, chọn **Tải Extension cho Chrome** rồi giải nén. ZIP chỉ chứa manifest, background, content, popup, remote transport và tài liệu; không chứa cấu hình ghép nối hoặc bí mật.
3. Mở `chrome://extensions`, bật **Developer mode**, chọn **Load unpacked** và chọn thư mục đã giải nén. Nếu đã cài, thay bộ tệp rồi nhấn **Reload** của Extension.
4. Tải lại các tab Muse/Gemini/ChatGPT để nạp content script mới. Phiên bản 0.2.0 yêu cầu cả backend và Extension mới; phiên bản cũ sẽ bị từ chối an toàn thay vì gửi thiếu khóa phiên.
5. Tự đăng nhập trang AI, mở cuộc trò chuyện muốn dùng và để ô prompt trống. Trong ToonFlow, ghép nối thiết bị, chọn đúng tab và kiểm tra kết nối. Với Web trên Mac Ventura dùng **Chrome qua Render**; không coi Local của Desktop là khả năng sẵn có của Web.
6. Không chia sẻ owner key, mã ghép nối, cookie hoặc token đăng nhập. Extension không đọc mật khẩu/cookie.

## Giữ đúng tab và nhận đúng lượt trả lời

- Không tự kích hoạt tab, đổi URL, mở chat mới hoặc chuyển sang tab khác khi không tìm thấy kết quả.
- Mỗi lần chọn tab lưu URL chính xác và mã phiên tài liệu. Reload cùng URL vẫn là phiên mới, cần chọn/kiểm tra lại tab. Dùng cuộc trò chuyện đã mở; không dựa vào việc website tự chuyển URL từ trang chủ sau prompt đầu tiên.
- Kiểm tra lại trước submit, sau upload và sau download. Không gửi nếu tab đang tải/bận, composer có bản nháp hoặc cuộc trò chuyện bị thay thế.
- Mỗi tab chỉ nhận một tác vụ. Receipt phải khớp prompt của tác vụ; có lượt user khác xen vào hoặc mất dấu receipt thì không nhận câu trả lời cuối trang làm kết quả.
- Loại element và URL media đã có trước submit, kể cả DOM render lại. Ảnh phải giải mã được, MIME khớp bytes, kích thước lấy từ file. Video phải có header định dạng, kích thước và thời lượng thật; không dùng poster.
- Event kết quả phải đúng Task ID, Provider, Tab ID, documentToken và top frame. Backend cũng kiểm loại output, MIME, base64, kích thước và thời lượng.
- Lịch sử chống gửi trùng dùng chung Local/Remote, chỉ lưu Task ID và thời điểm, không lưu prompt/media. Không tự hết hạn ID đã ghi. Đạt giới hạn 20.000 bản ghi thì ngừng gửi an toàn thay vì xóa lịch sử rồi có thể gửi lại.

## Khi trạng thái UNKNOWN

`UNKNOWN` nghĩa là đã thử gửi nhưng không đủ bằng chứng xác định kết quả: đổi chat, reload, mất kết nối, timeout hoặc thiếu receipt chắc chắn. Không tự gửi lại Task ID cũ; không bấm tạo lại chỉ vì ToonFlow chưa nhận file.

Kiểm tra và lưu kết quả thực trên website trước. Khi đã xử lý tác vụ cũ, có thể tải lại **chính tab đó**, rồi chọn/kiểm tra lại trong ToonFlow để tạo tác vụ mới được chủ động yêu cầu. Reload không hủy chắc chắn tác vụ đang chạy trên máy chủ AI. Nút hủy chỉ bấm Stop khi còn chứng minh được đây là lượt gửi của chính tác vụ, không điều khiển lượt gửi thủ công khác.

## Giới hạn kiểm chứng

Đã có kiểm tra Chromium trên DOM có kiểm soát, worker/API mô phỏng và giao thức WebSocket Local thật trên Linux. Đây không phải bằng chứng DOM hiện tại của Muse/Gemini/ChatGPT hay Render thật đã nghiệm thu. Cần kiểm thử từng website/tài khoản, nhất là history virtualization, upload, mode tạo media và cuộc trò chuyện không có ID ổn định. Khi không xác minh được, có thể từ chối hoặc UNKNOWN để tránh nhận sai. Không vượt CAPTCHA, hạn mức hoặc điều khoản nhà cung cấp.
