# ToonFlow Chrome Companion (macOS Desktop)

Đây là extension **viết riêng** cho ToonFlow theo giao thức ghép nối nội bộ; không sao chép thư viện GPL trong repository workflow.

1. Chạy ToonFlow Desktop trên macOS được hỗ trợ, mở **Settings → AI Bridge · Chrome**.
2. Mở Chrome → chrome://extensions → bật **Developer mode** → **Load unpacked** → chọn thư mục \`packages/chromeCompanion\` (trên bản tải từ repository hoặc thư mục \`chromeCompanion\` đã đóng gói cùng ứng dụng).
3. Mở tab Muse (\`https://muse.ai/\`), Gemini (\`https://gemini.google.com/\`) và/hoặc ChatGPT (\`https://chatgpt.com/\`); tự đăng nhập và mở cuộc trò chuyện hiện có trước khi gửi.
4. Trong ToonFlow, sao chép mã ghép nối. Nhấp biểu tượng extension và dán mã vào ô ghép nối. Không gửi mã cho người khác.
5. Quay về ToonFlow → tìm tab → chọn chính xác tab của từng AI → **Kết nối**. Chỉ khi tab có ô nhập và khả năng AI được phát hiện mới xuất hiện model tương ứng trong node.
6. Trong **Text Node** dùng Gemini hoặc ChatGPT; trong **Image Generation Node** dùng Muse/Gemini/ChatGPT nếu website hiện chức năng ảnh; trong **Video Generation Node** dùng Muse nếu website hiện chức năng video.
7. Mất kết nối, reload hoặc timeout: kiểm tra kết quả trên website. **Không có gửi lại tự động**. Chọn ngắt/tab mới nếu cần.

Chỉ hỗ trợ tab đã chọn trên Chrome cục bộ. Không truy cập mật khẩu, cookie hoặc token; không yêu cầu API key. Các nguồn website có thể thay đổi DOM hoặc hạn chế tự động hóa theo điều khoản. Những chức năng chưa xác minh bị vô hiệu, không bảo đảm chất lượng/tỷ lệ/độ phân giải nếu website không cung cấp điều khiển. Tiện ích này không thể vượt qua CAPTCHA hoặc giới hạn của nhà cung cấp.

Extension thực hiện DOM automation, không phải API chính thức. Chưa được kiểm thử với các tài khoản đã đăng nhập thực tế; xem sổ \`docs/aiNotes/openIssues.md\` trước khi sử dụng production.
