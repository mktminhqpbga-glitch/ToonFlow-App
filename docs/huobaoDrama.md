# Chạy Huobao Drama với MacFlow

**Tổng quan → Phim ngắn** mở Huobao Drama ngay trong tab hiện tại. Chọn **← MacFlow** ở đầu trang Huobao để quay lại. Khi Huobao chưa chạy, MacFlow hiện nút **Thử lại** và đường dẫn đến bảng phân cảnh đã lưu. Các bảng cũ cũng mở trực tiếp ở `/#/shortDrama/storyboard`. [Hướng dẫn bảng phân cảnh MacFlow](shortDrama.md)

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

Chạy lại lệnh trên sau khi cập nhật Git để cả MacFlow và Huobao có phần chọn mô hình và kho ảnh mới. MacFlow mở tại `http://127.0.0.1:3000`, Huobao mở tại `http://127.0.0.1:5679`. Docker dùng hai volume riêng cho dữ liệu của Huobao và MacFlow. Nếu mở bằng địa chỉ khác, đặt `MACFLOW_HUOBAO_PUBLIC_URL` cho Huobao và `MACFLOW_PUBLIC_URL` cho MacFlow. Dùng Huobao trong mạng riêng dành cho người được phép dùng các dự án, mô hình và kho ảnh MacFlow.

## Dùng lại mô hình MacFlow

1. Cài và kiểm tra mô hình ở phần Cài đặt của MacFlow. Mô hình văn bản dùng với Agent Huobao cần hỗ trợ gọi công cụ. Chọn mô hình ảnh/video có khả năng nhận đúng tư liệu tham chiếu và thông số bạn sẽ dùng.
2. Trong Huobao, mở **Cài đặt → Dịch vụ AI → Mô hình từ MacFlow**, chọn các mô hình cho **Viết kịch bản**, **Tạo ảnh** và **Tạo video**, rồi bấm **Lưu mô hình**. Các tập mới ưu tiên cấu hình MacFlow. Trong tập đã tạo trước đó, có thể chọn **MacFlow** ở bộ chọn mô hình trên đầu màn hình của tập.
3. Khóa nhà cung cấp được lưu trong MacFlow. Huobao dùng kết nối giữa hai dịch vụ để gửi ảnh/video vào hàng chờ MacFlow. Kết quả được lưu trong dự án đã cấu hình và Huobao tải bản sao vào kho của phim.

Cầu nối dùng một cấu hình chung cho MacFlow tự vận hành. Chỉ lưu `MACFLOW_HUOBAO_TOKEN` trong cấu hình của hai dịch vụ. Khi thay mã, khởi động lại hai dịch vụ và bấm **Lưu mô hình** trong Huobao để cập nhật kết nối.

## Thêm ảnh trong Huobao

Mở một tập, chọn **Tư liệu** rồi bấm **Tải lên** ở nhân vật, bối cảnh hoặc đạo cụ. Chọn **Tải ảnh từ máy** hoặc **Chọn từ Kho MacFlow**. Khi lấy từ Kho, chọn ảnh để xem trước rồi bấm **Dùng ảnh này**. Huobao lưu một bản sao trong dự án phim. Ảnh đó có thể được chọn trong danh sách tư liệu tham chiếu khi tạo clip của cảnh. Kho MacFlow hỗ trợ PNG, JPEG và WebP tối đa 50 MiB cho thao tác này.

## Kết nối với một Huobao đã chạy sẵn

Đặt `TOONFLOW_HUOBAO_ORIGIN` ở máy chủ MacFlow thành URL gốc của Huobao, ví dụ `http://127.0.0.1:5679`. Đặt `TOONFLOW_HUOBAO_PUBLIC_URL` thành địa chỉ Huobao mà trình duyệt mở được và `TOONFLOW_HUOBAO_PROJECT` thành tên dự án MacFlow nhận tác vụ. Dùng cùng giá trị `TOONFLOW_HUOBAO_MACFLOW_ORIGIN` (địa chỉ MacFlow mà Huobao truy cập được) và `TOONFLOW_HUOBAO_TOKEN` ở cả hai dịch vụ. Huobao cũng dùng `HUOBAO_PUBLIC_ORIGIN` cho địa chỉ trình duyệt mở và `TOONFLOW_PUBLIC_URL` cho nút quay lại MacFlow. Để tham chiếu video hoặc âm thanh cục bộ, đặt `PUBLIC_BASE_URL` của Huobao thành URL gốc mà MacFlow truy cập được. Bộ Docker tự đặt các địa chỉ nội bộ này.

Nếu tự dựng từ mã nguồn Huobao, áp dụng cả `prepareLocale.cjs` và `prepareMacFlow.cjs` lên bản sao của mã nguồn đã ghim trước khi dựng giao diện và chạy máy chủ Huobao.
