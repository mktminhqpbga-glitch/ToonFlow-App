# Chạy Huobao Drama với MacFlow

**Tổng quan → Phim ngắn → Mở Huobao Drama** mở ứng dụng Huobao ở tab riêng. Huobao giữ nguyên màn hình quản lý phim, tập, kịch bản, kho tư liệu theo dự án, phân cảnh và ghép phim. MacFlow cung cấp các thao tác nối mô hình và chuyển tư liệu trong màn hình Phim ngắn. Bảng phân cảnh từng lưu trong MacFlow mở qua **Mở bảng phân cảnh MacFlow đã lưu**. [Hướng dẫn bảng phân cảnh MacFlow](shortDrama.md)

Repo gốc được ghim dưới dạng Git submodule tại `services/huobaoDrama/upstream` tới commit `24d4c17612e71cf10c8eeb1a8b6439afa73e2c07`. Lớp ngôn ngữ thêm tiếng Việt cho các màn hình chính và ngôn ngữ nội dung AI. Các nhãn chưa dịch dùng tiếng Anh. Huobao Drama theo giấy phép CC BY-NC-SA 4.0. Tuân thủ điều kiện phi thương mại, ghi công và chia sẻ tương tự khi phân phối phần Huobao đã chỉnh. [Repo Huobao Drama](https://github.com/chatfire-AI/huobao-drama/tree/24d4c17612e71cf10c8eeb1a8b6439afa73e2c07) · [Giấy phép](https://github.com/chatfire-AI/huobao-drama/blob/24d4c17612e71cf10c8eeb1a8b6439afa73e2c07/LICENSE)

## Chạy hai dịch vụ bằng Docker

Từ repo MacFlow, lấy mã của Huobao ở đúng commit.

```sh
git submodule update --init --recursive services/huobaoDrama/upstream
```

Để mở cầu nối AI, thêm các biến sau vào tệp `.env` cục bộ của MacFlow. Dùng một chuỗi riêng tạo bằng `openssl rand -hex 32` cho `MACFLOW_HUOBAO_TOKEN`. Giữ nguyên các dòng cấu hình đã có khi cập nhật tệp.

```dotenv
MACFLOW_HUOBAO_TOKEN=
MACFLOW_HUOBAO_PROJECT=myProject
```

`myProject` là thư mục trong vùng `workspaces` của MacFlow dùng cho hàng chờ và kết quả từ API Huobao. Với bộ Docker đi kèm, thư mục này được tạo sẵn. Có thể đặt tên một thư mục dự án khác đã tồn tại.

```sh
docker compose -f compose.yaml -f composeHuobao.yaml up -d --build
```

MacFlow mở tại `http://127.0.0.1:3000`, Huobao mở tại `http://127.0.0.1:5679`. Docker dùng hai volume riêng cho SQLite và tư liệu của Huobao và dữ liệu MacFlow. Đặt `MACFLOW_HUOBAO_PUBLIC_URL` nếu trình duyệt mở Huobao bằng địa chỉ khác. Dùng Huobao trong mạng riêng vì dịch vụ gốc dành cho môi trường tin cậy và người truy cập có quyền làm việc với dự án Huobao.

## Dùng lại mô hình MacFlow

1. Cài và kiểm tra mô hình ở phần Cài đặt của MacFlow. Mô hình văn bản dùng với Agent Huobao cần hỗ trợ gọi công cụ. Chọn mô hình ảnh/video có khả năng nhận đúng tư liệu tham chiếu và thông số bạn sẽ dùng.
2. Mở **Phim ngắn**, chọn các mô hình văn bản, ảnh và video cần dùng, rồi bấm **Kết nối mô hình MacFlow**. Huobao sẽ hiển thị các mục **MacFlow · Văn bản**, **MacFlow · Ảnh** và **MacFlow · Video** trong **Cài đặt → Dịch vụ AI**. Chọn và kết nối trước khi tạo tập vì Huobao lưu cấu hình ảnh/video theo từng tập.
3. Khóa nhà cung cấp vẫn nằm trong MacFlow. Huobao nhận mã riêng của cầu nối và gửi ảnh/video vào hàng chờ MacFlow. Kết quả tạo ảnh/video tồn tại trong workspace được chọn và Huobao tải bản sao vào kho dự án của mình.

Cầu nối hiện dùng cho MacFlow tự vận hành, một cấu hình dùng chung của người vận hành. `MACFLOW_HUOBAO_TOKEN` cấp quyền gọi các mô hình đã chọn. Chỉ lưu token trong cấu hình dịch vụ riêng. Khi thay token, khởi động lại MacFlow rồi bấm **Kết nối mô hình MacFlow** để cập nhật các mục Huobao. Những dự án Huobao cũ vẫn có thể mở và chọn dịch vụ trực tiếp trong Huobao.

## Chuyển tệp qua lại

- **Kho tư liệu → MacFlow → Huobao** gửi bản sao tệp đã chọn từ Kho MacFlow vào vùng tải lên của Huobao. Mở hoặc sao chép liên kết được trả về để dùng làm tư liệu trong Huobao.
- **Kho tư liệu → Huobao → MacFlow** nhận liên kết tệp từ chính Huobao đang chạy hoặc đường dẫn dạng `/static/…`. Kết quả được lưu trong thư mục **Huobao** ở Kho MacFlow.
- Hai hướng hỗ trợ PNG, JPEG, WebP, MP4, MOV, WebM và các định dạng âm thanh tương thích của Huobao. Cầu nối giới hạn 50 MiB mỗi tệp và Huobao có giới hạn riêng cho tệp âm thanh. Kho lưu bản sao theo yêu cầu của bạn.

## Kết nối với một Huobao đã chạy sẵn

Đặt `TOONFLOW_HUOBAO_ORIGIN` ở máy chủ MacFlow thành URL gốc của Huobao, ví dụ `http://127.0.0.1:5679`. Đặt `TOONFLOW_HUOBAO_PUBLIC_URL` thành địa chỉ trình duyệt mở được, `TOONFLOW_HUOBAO_MACFLOW_ORIGIN` thành URL gốc mà máy chủ Huobao truy cập được, cùng `TOONFLOW_HUOBAO_TOKEN` và `TOONFLOW_HUOBAO_PROJECT`. Nếu dùng video hoặc âm thanh cục bộ làm tham chiếu, đặt `PUBLIC_BASE_URL` của Huobao bằng origin Huobao mà MacFlow truy cập được. Mặc định của bộ Docker đã dùng địa chỉ nội bộ này.
