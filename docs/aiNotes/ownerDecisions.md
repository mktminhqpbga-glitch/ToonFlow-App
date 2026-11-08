# Những quyết định cần chủ dự án hướng dẫn — ToonFlow-App

**Cập nhật:** 2026-11-09 (UTC+7) · **Người lập:** ChatGPT (GPT-6)
**Phạm vi:** Chỉ các quyết định sản phẩm chưa thể suy ra chắc chắn từ mã hiện tại; đây không phải danh sách tính năng DONE. Không merge PR #4.

Phần có thể sửa không cần hỏi: khắc phục lỗi có thể tái hiện, dịch UI/prompt hệ thống có kiểm soát, kiểm tra build/typecheck, tránh gửi model chưa sẵn sàng, bảo vệ dữ liệu, giữ Canvas và định dạng lưu có sẵn.

## Quyết định đã được chủ dự án chốt — 2026-11-09

- **HD-01:** Hiện tất cả model; model chưa kết nối/chưa cấu hình phải bị khóa. Không coi "có API key" là bằng chứng mạng/tài khoản/model thật sẵn sàng.
- **HD-02:** Chip reference có **thumbnail nhỏ + tên tài nguyên**, không lấy media giả; vị trí chèn khớp caret/drop, Undo/Redo và lưu mở lại giữ được.
- **HD-03:** Nhấn mục Thư viện vật liệu phải **tạo node có prompt preset**, dùng hệ thống node gốc và prompt ẩn nếu tác vụ AI yêu cầu.
- **HD-04:** **Một nhân vật chỉ có một bộ ảnh cố định**; không tạo phiên bản trang phục/diện mạo phụ tự động. Có thể dùng bộ ba góc máy trong bộ ảnh gốc.
- **HD-05:** Batch tiếp tục xử lý **những cảnh độc lập** nếu một cảnh thất bại; cảnh lỗi được đánh dấu. Cảnh phụ thuộc / UNKNOWN không tự retry và không chạy tiếp sai thứ tự.
- **Quy tắc kiểm thử:** Mỗi mục phải có kết quả riêng, phân biệt source inspection, typecheck/build, UI và E2E AI thật; mục BLOCKED không được coi PASS.

Các quyết định này thay thế những đề xuất A/B/C cũ bên dưới; không hỏi lại cùng nội dung.

## HD-01 — Model chưa khả dụng sẽ hiện thế nào?

- **Đã chốt:** ưu tiên model thực sự sẵn sàng, tùy chọn "Hiện tất cả model"; model không sẵn sàng không được phép gửi tác vụ.
- **Cần chủ dự án chọn cách trình bày:** A. Chỉ hiện model sẵn sàng, có nút "Hiện tất cả" trong danh sách; B. Hiện tất cả, model chưa kết nối nằm dưới và bị khóa.
- **Đề xuất:** A; khi model đang dùng mất kết nối, giữ cấu hình nhưng nút tạo bị khóa với nguyên nhân và liên kết Settings.
- **Cần kiểm chứng kỹ thuật:** API catalog hiện trả danh sách model; không suy diễn trạng thái chỉ từ sự có mặt của model. Chrome Bridge phải xét relay, extension, tab, capability và trạng thái phiên.

## HD-02 — Kéo ảnh/video từ Canvas vào prompt

- **Đã chốt:** chèn vào đúng caret/drop position; chip tham chiếu thật có asset ID/path; nhiều reference; Undo/Redo; lưu khôi phục; không gửi reference không được hỗ trợ.
- **Cần chủ dự án cho ví dụ nếu có:** mong muốn media thả vào prompt biểu thị bằng thumbnail thu nhỏ hay chip có tên? Có muốn cho phép kéo node chưa có kết quả không?
- **Đề xuất:** thumbnail nhỏ + tên; từ chối node chưa có file; kéo trỏ vào chip mở xem lớn. Ưu tiên giữ định dạng prompt hiện có.
- **Kỹ thuật:** cần xác định payload drag thực tế Canvas/Asset Library, không tự tạo reference giả; đổi payload/model phải tương thích dữ liệu cũ.

## HD-03 — Thư viện vật liệu trên toolbar

- **Đã chốt:** nút Thư viện vật liệu mở bảng hai cột với các nhóm Storyboard, Phân cảnh liên tục, Diễn tiến hình ảnh, Chín góc máy, Nhiều góc nhìn, Ảnh thiết lập nhân vật/bối cảnh/sản phẩm, chất liệu chân dung, ánh sáng điện ảnh.
- **Cần chủ dự án chỉ rõ với nhóm chưa có công cụ tương ứng:** chọn một mục sẽ (A) tạo node có preset prompt, (B) mở modal chỉnh sửa hiện có, hay (C) mở workflow mẫu?
- **Đề xuất:** tái sử dụng chức năng hiện có; các mục chưa có backend bị vô hiệu hóa và nêu nguyên nhân, không dựng nút giả.

## HD-04 — Studio nhân vật

- **Đã chốt:** Nhân vật của tôi / Kho nhân vật mẫu; tạo, tải, chỉnh, tạo AI, ba góc nhìn, đưa vào Canvas, tái sử dụng qua cảnh, lưu theo workspace.
- **Cần chủ dự án hướng dẫn:** ảnh mẫu là ảnh do bạn cung cấp hay bộ mẫu tự tạo? Một nhân vật có thể có nhiều phiên bản trang phục/tạo hình không?
- **Đề xuất:** không chép thư viện có bản quyền; preset chỉ chứa đường dẫn asset thật; hỗ trợ phiên bản nhân vật với ảnh tham chiếu gốc giữ nguyên.

## HD-05 — Hàng loạt ảnh/video, nhiều cảnh

- **Đã chốt:** tạo ảnh và video hàng loạt, tác vụ có trạng thái/pause/resume/cancel, lưu checkpoint, ghép bằng FFmpeg, không chạy song song cùng tab Chrome, trạng thái UNKNOWN không tự retry.
- **Cần chủ dự án chọn:** tác vụ video thất bại ở một cảnh: A. Dừng toàn bộ workflow; B. Tiếp tục các cảnh khác và đánh dấu cảnh lỗi; C. Chờ xử lý thủ công.
- **Đề xuất:** B cho tác vụ độc lập; C khi trạng thái UNKNOWN hoặc phụ thuộc cảnh trước. FFmpeg chỉ ghép các cảnh đã xác minh có file thật, không lấy video giả.
- **Cần chỉ rõ thêm nếu quan trọng:** quy tắc đặt tên và sắp thứ tự scene; mặc định giữ thứ tự danh sách.

## HD-06 — Giao diện và kiểm thử trên Mac Intel Ventura

- **Đã chốt:** chạy Web + backend loopback, Chrome Companion qua Render Relay; không tự dùng desktop runtime yêu cầu macOS 14.
- **Cần chủ dự án giúp thử ngoài môi trường hiện tại:** chụp màn hình thao tác lỗi; thử tài khoản Chrome Muse/Gemini/ChatGPT đã đăng nhập; kiểm tra Render và file đầu ra thật. Không gửi API key, token hoặc mật khẩu.
- **Đề xuất:** đầu tiên kiểm thử tạo 1 ảnh thật và 1 video thật; sau đó thử reload workspace, mất kết nối, timeout và batch. Ghi BLOCKED nếu chưa có phiên thật.

## Cách trả lời

Chỉ cần trả lời theo dạng **HD-01 A, HD-02 thumbnail, HD-03 ...** hoặc gửi ảnh/phác thảo giao diện. Không cần cung cấp lại thông tin repo, nhánh hay những yêu cầu đã chốt.

Các mục không có quyết định sản phẩm bổ sung vẫn tiếp tục được sửa độc lập. Tài liệu này **không xác nhận bất kỳ tính năng Batch/Studio/Drag-and-drop nào đã chạy**.
