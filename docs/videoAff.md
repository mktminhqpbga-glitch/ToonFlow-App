# VideoAFF trong MacFlow

**Tổng quan → VideoAFF** mở xưởng bán hàng ngay trong cửa sổ MacFlow. Khi dùng cục bộ, MacFlow tự khởi động VideoAFF lần đầu bạn mở mục này. Bấm **Mô hình và Kho** trên thanh trên cùng để chọn mô hình và chuyển tư liệu. Giao diện, thao tác tải tệp và tiện ích Chrome dùng địa chỉ và cổng của MacFlow. Màu chủ đạo, sáng/tối và cỡ chữ theo cài đặt MacFlow. Dữ liệu làm việc của VideoAFF nằm trong thư mục dữ liệu của ứng dụng.

MacFlow chứa mã nguồn đầy đủ của [AI Content Automation tại commit `5d92bc0d93fb0e1eb3ae77aaf7e6954e749e459a`](https://github.com/vdat-18/ai-content-automation/tree/5d92bc0d93fb0e1eb3ae77aaf7e6954e749e459a) trong `services/videoAff/upstream`, gồm cả extension, mã máy chủ, dashboard và kiểm thử. Tên dashboard đã đổi thành VideoAFF. Phần tạo ảnh bìa bỏ qua các mốc sau khi video kết thúc để hỗ trợ video rất ngắn. Giao diện VideoAFF và tiện ích Chrome dùng tiếng Việt. [Giấy phép MIT và ghi công](../services/videoAff/upstream/LICENSE)

## Chạy trực tiếp trên máy

1. Với macOS dùng Homebrew, cài công cụ một lần. MacFlow tự khởi động PostgreSQL riêng cho VideoAFF. Trên Linux, cài các công cụ tương ứng và dùng PostgreSQL 17.

   ```sh
   brew install uv node pnpm postgresql@17 ffmpeg
   ```

2. Chạy MacFlow từ thư mục có mã nguồn như thường lệ. Mở MacFlow bằng `127.0.0.1` hoặc `localhost`, rồi chọn **VideoAFF** trong **Tổng quan**. Lần đầu MacFlow tải thư viện Python và chuẩn bị giao diện. Sau đó xưởng hiện ngay bên dưới thanh VideoAFF, cùng cửa sổ. Mã kết nối để dùng mô hình MacFlow được tạo tự động.
3. Khi MacFlow tắt, VideoAFF và cơ sở dữ liệu của nó cũng tắt. Vào lại **Tổng quan → VideoAFF** để mở dữ liệu đã lưu. VideoAFF chạy nội bộ qua Unix socket. Trên máy khác trong mạng, mở địa chỉ MacFlow của máy chủ (ví dụ `http://192.168.1.20:3000`) rồi chọn **VideoAFF**.

Dữ liệu chạy trực tiếp nằm ở `data/videoAff/` bên cạnh dữ liệu MacFlow, hoặc trong thư mục dữ liệu bạn đã đặt qua `TOONFLOW_DATA_DIR`. Bản native tạo kho PostgreSQL riêng. Các bộ dữ liệu từ Docker hoặc VideoAFF đã triển khai ở nơi khác cần nhập riêng nếu muốn chuyển sang chạy trực tiếp. Nếu chưa mở được, xem thông báo ngay trong MacFlow và nhật ký `videoAff/start.log` trong thư mục dữ liệu. Nếu đã đặt `TOONFLOW_VIDEO_AFF_ORIGIN` cho bản cũ, gỡ biến đó khi muốn MacFlow tự khởi động VideoAFF cục bộ.

Trong **VideoAFF → Sản phẩm**, bấm **Tải tiện ích Chrome** rồi giải nén `VideoAFF-Collector.zip`. Mở `chrome://extensions`, bật **Chế độ dành cho nhà phát triển**, chọn **Tải tiện ích đã giải nén** và mở thư mục `VideoAFF-Collector`. Mở trang sản phẩm TikTok Shop rồi bấm **Gửi sản phẩm này** trong tiện ích. Bấm **Tạo video từ sản phẩm** để mở sản phẩm đó trong VideoAFF của MacFlow. Tiện ích được đóng gói theo địa chỉ MacFlow đang mở. Nếu chuyển sang địa chỉ máy chủ hoặc cổng khác, hãy tải lại ZIP từ địa chỉ mới và nạp thư mục mới trong Chrome. [Hướng dẫn tiện ích](../services/videoAff/upstream/extension/README.md)

## Chạy bằng Docker

1. Từ thư mục MacFlow, tạo hai mã riêng bằng lệnh dưới đây. Nếu đã có `.env.videoAff`, dùng lại tệp đó. Mật khẩu phải giữ nguyên khi khởi động lại dữ liệu PostgreSQL đã có.

   ```sh
   if [ ! -e .env.videoAff ]; then
     (umask 077
      printf 'VIDEO_AFF_DB_PASSWORD=%s\nMACFLOW_VIDEO_AFF_TOKEN=%s\n' \
        "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env.videoAff)
   fi
   ```

2. Khởi động MacFlow và VideoAFF.

   ```sh
   docker compose --env-file .env.videoAff -f compose.yaml -f composeVideoAff.yaml up -d --build
   ```

3. Mở MacFlow ở `http://localhost:3000`, rồi chọn **Tổng quan → VideoAFF**. MacFlow phục vụ cả xưởng và tiện ích trên cùng cổng. Muốn dùng từ máy khác trong mạng, đặt `MACFLOW_HTTP_BIND_ADDRESS=0.0.0.0` trong `.env.videoAff` rồi chạy lại lệnh Compose. Có thể đặt `MACFLOW_HTTP_PORT` nếu MacFlow dùng cổng khác. Các vùng dữ liệu Docker giữ PostgreSQL và tệp qua các lần khởi động.
4. Cài tiện ích từ nút **Tải tiện ích Chrome** trên trang **Sản phẩm** theo các bước ở trên. [Hướng dẫn tiện ích](../services/videoAff/upstream/extension/README.md)

Bộ Docker dùng lưu trữ tệp VideoAFF trên volume cục bộ. Repo gốc vẫn bao gồm cấu hình SeaweedFS, sao lưu và giám sát dành cho các cách triển khai khác.

## Chọn mô hình

Trong **MacFlow → VideoAFF → Mô hình và Kho**, chọn mô hình đã cài cho năm mục rồi bấm **Lưu mô hình**. Mô hình **Viết kịch bản** và **Kiểm tra ảnh và video** cần đọc được ảnh. Mô hình **Tạo ảnh cảnh** cần nhận nhiều ảnh tham chiếu. Mô hình **Tạo clip** cần hỗ trợ khung hình đầu, video dọc 9:16 và 15 giây. Mô hình **Tạo giọng đọc** phải trả tệp MP3. Có thể chọn cùng một mô hình cho hai mục văn bản.

MacFlow giữ khóa nhà cung cấp ở máy chủ. VideoAFF dùng mã kết nối riêng để gọi mô hình và sử dụng các tác vụ MacFlow trong thư mục `workspaces/videoAff`. Khi cần nối dịch vụ trực tiếp, đặt các nhóm `AIC_SCREENING_*`, `AIC_IMAGE_*`, `AIC_VIDEO_*` hoặc `AIC_TTS_*` trong `.env.videoAff`. Mỗi nhóm có thể dùng mô hình riêng. Đặt `AIC_TTS_VOICE` theo giọng nhà cung cấp hỗ trợ nếu giọng tự động không phù hợp.

Luồng gốc cần ít nhất một ảnh bối cảnh Pinterest đã qua kiểm tra trước khi tạo ảnh cảnh. Đặt `AIC_EMBEDDING_MODEL=dinov2-small` để VideoAFF nhận và loại ảnh trùng, rồi điền `AIC_TEXT_EMBEDDING_BASE_URL`, `AIC_TEXT_EMBEDDING_API_KEY` và `AIC_TEXT_EMBEDDING_MODEL` của dịch vụ OpenAI-compatible có chức năng tìm ảnh theo mô tả. Khởi động lại VideoAFF sau khi bổ sung những mục này. [Cấu hình đầy đủ của repo gốc](../services/videoAff/upstream/README.vi.md#c%E1%BA%A5u-h%C3%ACnh-ch%C3%ADnh-deployenvexample)

Khi dùng bản chạy trực tiếp, đặt các biến trên trong `.env.videoAff` ở thư mục mã nguồn MacFlow. Sau khi sửa tệp này, mở lại MacFlow rồi chọn **Tổng quan → VideoAFF**. Ở lần xuất video đầu tiên, máy chạy VideoAFF cần tải mô hình Whisper để căn thời điểm phụ đề theo lời đọc. Tệp tải được giữ trong vùng dữ liệu VideoAFF.

## Dùng Kho và làm video

1. Chọn sản phẩm đã thu thập trong VideoAFF. Trong **Bộ nhớ AI → Ảnh bối cảnh**, kiểm tra ảnh bối cảnh lấy bằng tiện ích Chrome. Tạo hoặc chọn một người mẫu. Để dùng ảnh đã có trong MacFlow, mở **Mô hình và Kho**, chọn người mẫu và ảnh, xác nhận quyền sử dụng rồi bấm **Thêm ảnh vào VideoAFF**.
2. Viết ý tưởng và xem kịch bản. Duyệt ảnh cảnh đầu, sau đó duyệt ảnh từng cảnh. VideoAFF tạo clip và giọng đọc, ghép video dọc rồi soạn phần mô tả đăng bài.
3. Khi hoàn thành, mở **Mô hình và Kho**. Chọn video và bấm **Lưu video** hoặc **Lưu ảnh bìa**. Bản sao nằm trong thư mục **VideoAFF** ở Kho MacFlow.

## Kết nối VideoAFF đã chạy sẵn

Đặt các biến ở máy chủ MacFlow rồi khởi động lại MacFlow.

- `TOONFLOW_VIDEO_AFF_ORIGIN` là địa chỉ nội bộ để máy chủ MacFlow gọi VideoAFF. Build giao diện với `VITE_VIDEO_AFF_BASE=/api/videoAff/studio/dashboard/` và phục vụ các tệp giao diện tại `/dashboard/` phía VideoAFF. Lưu lượng từ trình duyệt đi qua MacFlow.
- `TOONFLOW_VIDEO_AFF_CALLBACK` là địa chỉ cầu nối mà máy chủ VideoAFF truy cập được. Mặc định `http://127.0.0.1:3000/api/videoAff/bridge/v1`.
- `TOONFLOW_VIDEO_AFF_TOKEN` là cùng mã được khai báo trong các mục khóa API trỏ về cầu nối của VideoAFF. Các tên cho cầu nối là `macflow-writer`, `macflow-review`, `macflow-image`, `macflow-video` và `macflow-audio`. Dùng `AIC_IMAGE_API=edits` và `AIC_VIDEO_FRAME_FIELDS=image` khi trỏ các dịch vụ đó về MacFlow.

Tích hợp này dùng trong bản MacFlow tự vận hành. Khi truy cập từ ngoài máy chủ, dùng mạng tin cậy hoặc VPN và áp dụng kiểm soát truy cập của MacFlow. ZIP tiện ích chứa thông tin kết nối của địa chỉ đã tải xuống.
