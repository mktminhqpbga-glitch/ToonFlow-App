# Muse2API cho MacFlow

> **Lưu ý từ phiên làm việc trên Mac ngày 2026-11-17:** Dịch vụ Muse2API
> người dùng hiện đang chạy là **Python v0.4.0**, không phải Go vip0014.
> Nội dung phía dưới là tài liệu **lịch sử của adapter Go**; không dùng
> lệnh Docker/Go ở đây để thay dịch vụ Python hoặc xóa dữ liệu cũ.
> Xem [kế hoạch Python và Chrome Profile 22](muse2ApiPythonProfile22.md)
> để biết trạng thái tích hợp thực tế và những điều kiện an toàn còn thiếu.

## Bản được tích hợp

Nguồn: https://github.com/vip0014/muse2api

Commit: `0a2cfffb1fa6dc706398781fb3a75621f8494750` (nhánh `master`, phiên bản upstream 2.1.0).

Đây là bản Go dùng Noise WebSocket/protobuf trực tiếp đến Muse. Không cần chạy Chrome hay extension AI chrome của MacFlow. Extension upstream chỉ giúp xuất cookie để nhập tài khoản vào muse2API. MacFlow chỉ giữ Base URL và API key; cookie, mật khẩu quản trị và khóa mã hóa nằm ở dịch vụ muse2API.

Không dùng hướng dẫn Python/Chromium của các repo muse2api khác cho bản này.

## Chạy dịch vụ

Yêu cầu Docker Engine/Docker Desktop và Docker Compose **2.17 trở lên** (hỗ trợ `dockerfile_inline`), có mạng khi build lần đầu.

Từ thư mục `MacFlow/`, tạo `.env` từ `.env.example`, điền:

- `MUSE2API_KEY`: khóa API dài, ngẫu nhiên.
- `MUSE2API_ADMIN_USERNAME`: mặc định `admin`.
- `MUSE2API_ADMIN_PASSWORD`: mật khẩu quản trị riêng, ít nhất 8 ký tự.
- `MUSE2API_CREDENTIAL_KEY`: base64 của đúng 32 byte ngẫu nhiên. Phải sao lưu cùng dữ liệu; mất khóa sẽ không giải mã được cookie cũ.

Có thể tạo API key bằng `openssl rand -hex 32` và khóa mã hóa bằng `openssl rand -base64 32`. Ghi kết quả vào `.env` trên máy của bạn; không gửi cookie hoặc khóa lên chat. `.env` được Git bỏ qua.

```sh
docker compose -f composeMuse.yaml up -d --build
```

Compose tải đúng commit đã ghim để build; không sao chép mã upstream vào `References/`, không chạy bộ test upstream. Chỉ mở cổng loopback `18610`; dữ liệu nằm trong volume riêng `muse2ApiData`. Không dùng `down -v` nếu cần giữ tài khoản, tác vụ và media.

Mở trên **máy chạy Docker**: `http://127.0.0.1:18610/admin`. Đăng nhập bằng tài khoản/mật khẩu quản trị, không dùng API key để đăng nhập. Nhập tài khoản Muse của bạn; upstream yêu cầu cookie `hatch_sess` và `hatch_vml`. Dùng phần phát hiện/kiểm tra tài khoản trong trang quản trị để xem trạng thái phiên.

Nếu đã có muse2API vip0014 đang chạy, bỏ qua bước Docker và dùng địa chỉ/API key hiện có. Không ghi đè dữ liệu hoặc đổi khóa mã hóa của dịch vụ cũ.

### Chạy trực tiếp khi không dùng Docker

Cần Go 1.24+ và Node 24+. Từ `MacFlow/`, sau khi đã tạo `.env`:

```sh
git clone https://github.com/vip0014/muse2api.git work/muse2Api
cd work/muse2Api
git checkout --detach 0a2cfffb1fa6dc706398781fb3a75621f8494750
cd web
npm ci --no-audit --no-fund
npm run build
cd ..
CGO_ENABLED=0 go build -trimpath -o bin/muse2api ./cmd/muse2api
set -a
. ../../.env
set +a
MUSE2API_HOME="$PWD" MUSE2API_HOST=127.0.0.1 ./bin/muse2api
```

Các lệnh trên dùng shell Bash/Zsh trên Linux/macOS, build mã nguồn và không gọi bộ test. Dữ liệu dịch vụ ở `work/muse2Api/data/`, tách khỏi dữ liệu MacFlow; phải sao lưu cùng khóa mã hóa. Giữ tiến trình chạy khi dùng MacFlow. Nếu thư mục clone đã tồn tại và có dữ liệu, dùng lại nó; không xóa để cài lại.

## Kết nối MacFlow

Khởi động lại MacFlow sau khi build bản mới. Backend tự cài adapter media `muse2Api.ts` vào dữ liệu ứng dụng; không tự thêm API key của bạn.

### Văn bản/note

Trong **Cài đặt → mô hình ngôn ngữ → thêm provider**, chọn **Muse2API (vip0014)**:

- Base URL: `http://127.0.0.1:18610/v1` nếu hai dịch vụ cùng chạy trên một máy.
- API key: `MUSE2API_KEY` của dịch vụ.
- Model: `muse-spark`.

Chọn Muse Spark ở node văn bản. Endpoint: `POST /v1/chat/completions`, hỗ trợ SSE và lịch sử hội thoại qua giao thức hiện có. Danh sách model trong preset là cấu hình, không phải bằng chứng tài khoản đã đăng nhập thành công.

Chat của bản vip0014 hiện chuyển ảnh thành nhãn `[图片]`, không gửi ảnh thật lên Muse, và không triển khai function calling. MacFlow từ chối file/công cụ ở luồng chat này để tránh mất dữ liệu âm thầm; preset không xuất hiện trong danh sách Agent SDK. Dùng model media để tạo ảnh/video có tham chiếu.

### Ảnh/video

Trong **Cài đặt → mô hình media**, chọn **Muse2API (vip0014)** và lưu Base URL/API key. Adapter được cài sẵn khi server khởi động; nếu đã có trong danh sách, cấu hình trực tiếp thay vì thêm trùng.

- `muse-image`: văn bản → ảnh hoặc chỉnh ảnh, một kết quả mỗi tác vụ. Kết nối bản [mac2API](https://github.com/mktminhqpbga-glitch/mac2API/tree/feat/mac2api-client-contract) đã cập nhật bằng Base URL của dịch vụ và khóa `m2c_…` để dùng tối đa 20 ảnh. Adapter đọc giới hạn máy chủ tại `/capabilities`. Các bản Python 0.4.0 và Go vip0014 hiện có hỗ trợ tối đa 4 ảnh.
- `muse-video`: văn bản → video hoặc 1–4 ảnh tham chiếu; ảnh đầu là tham chiếu bắt đầu. Chưa hỗ trợ khung cuối, video/audio tham chiếu.
- Ảnh tham chiếu: PNG/JPEG/GIF/WebP, tối đa 10 MiB mỗi ảnh. Tổng dung lượng tối đa 100 MiB khi dùng luồng nhiều ảnh của mac2API, 24 MiB cho luồng cũ. MacFlow chuyển byte thành data URL theo thứ tự đã chọn.
- Ảnh: kích thước `auto`; tỷ lệ được chuyển thành `aspect_ratio`. Upstream diễn đạt yêu cầu bằng prompt, không bảo đảm chính xác số pixel.
- Video: nhập số giây ở **Thời lượng mong muốn (giây)** trong cài đặt node. Adapter chuyển thời lượng vào mô tả khi API của dịch vụ giới hạn tham số `duration`. Mỗi tác vụ trả một clip với thời lượng Muse hỗ trợ. Mặc định yêu cầu 720p và dùng âm thanh của Muse.
- Tệp trả về được backend MacFlow tải bằng Bearer key rồi lưu vào workspace. Không cần bật `MUSE2API_PUBLIC_MEDIA` và không đưa API key vào URL media.

### Khi dùng Docker hoặc máy khác

| Nơi chạy MacFlow backend | Base URL cần cấu hình |
| --- | --- |
| Cùng máy với cổng muse2API đã publish | `http://127.0.0.1:18610/v1` |
| Hai service trong cùng Compose | `http://muse2api:18610/v1` |
| MacFlow ở Cloud, muse2API ở máy Mac/VPS | Địa chỉ HTTPS mà backend Cloud thực sự truy cập được |

Để chạy cả hai trong cùng mạng Compose:

```sh
docker compose -f compose.yaml -f composeMuse.yaml up -d --build
```

Không dùng `127.0.0.1` của máy bạn để trỏ từ một backend nằm trên Cloud/container khác. UI gọi backend MacFlow; backend mới là bên gọi muse2API, nên không cần mở CORS cho trình duyệt.

## Theo dõi và khôi phục tác vụ

Ảnh đi qua `POST /v1/images/tasks`, video qua `POST /v1/videos`; sau đó GET trạng thái mỗi **5 giây**, tối đa 65 phút mỗi lần chờ. Adapter lưu snapshot và `Idempotency-Key` trước POST, lưu mã tác vụ ngay khi được nhận.

- Đã có task ID: thao tác Tiếp tục chỉ đọc lại đúng tác vụ và tải kết quả.
- Mất phản hồi trước khi có ID: thao tác Tiếp tục dùng đúng snapshot/key cũ để tận dụng cơ chế chống trùng của vip0014, không tạo một key mới.
- Không tự lặp lại POST khi lỗi mạng. Trạng thái upstream `unknown` dừng chờ để kiểm tra thủ công; không tự retry sinh nội dung.
- Đổi Base URL thì không tiếp tục tác vụ của dịch vụ cũ. Xóa cơ sở dữ liệu muse2API sẽ làm mất lịch sử chống trùng; phải kiểm tra thủ công trước khi dùng lại snapshot.
- Hủy ở MacFlow dừng đợi/tải; không bảo đảm hủy tác vụ đã chạy trên Muse. Kiểm tra ID ở trang quản trị trước khi tạo yêu cầu mới.

## Proxy và vị trí IP

Bản vip0014 dùng `MUSE2API_PROXY` chung cho tiến trình gọi HTTP/WS đến Muse; không dùng cấu hình proxy từng tài khoản của bản Python. IP Muse nhìn thấy phụ thuộc máy/proxy chạy **muse2API**, không phụ thuộc Chrome mở MacFlow hay relay AI chrome.

Nếu proxy ở ứng dụng trên macOS, container Docker Desktop thường dùng `http://host.docker.internal:<cổng>`; `127.0.0.1:<cổng>` trong container trỏ về chính container. Điền proxy thực tế vào `.env` rồi cập nhật service. Chưa có proxy được cấu hình sẵn và không bảo đảm chỉ đổi IP sẽ mở được tính năng bị giới hạn theo tài khoản.

## Tình trạng xác minh

Ngày 2026-11-16 trên workspace Cloud:

- MacFlow: typecheck server/web và build server/web thành công; đã khởi động lại ở cổng 3000.
- Backend đã cài adapter media, lưu cấu hình kết nối cục bộ và công bố ba model Muse2API trong danh sách tương ứng.
- Muse2API: build trực tiếp mã nguồn Go và web quản trị thành công; chạy phiên bản 2.1.0 ở cổng 18610. `GET /healthz` và `GET /v1/models` có Bearer trả HTTP 200, đúng ba model.
- Docker: chưa chạy thành công trong Cloud này do storage driver VFS làm hết dung lượng khi build. Đã dọn cache của lần build này và dùng cách chạy trực tiếp ở trên; không coi file Compose là đã được xác minh end-to-end.
- Chưa nhập tài khoản Muse, chưa gọi API tạo chat/ảnh/video. Chưa xác minh truyền ảnh, polling, idempotency hoặc tải kết quả bằng một tác vụ thật. Không chạy bộ test.

Khóa/mật khẩu cục bộ được tạo riêng trong `.env` (quyền 0600); không ghi giá trị bí mật vào tài liệu. Ở workspace này, có thể chạy lại dịch vụ trực tiếp bằng toolchain đã cài trong `/workspace/work/tooling/go/bin`; khi triển khai nơi khác, dùng Go cài trên máy đó.

Các địa chỉ loopback ở trên thuộc **Cloud**, không trỏ vào máy Mac của bạn. Muốn xác minh end-to-end cần mở được trang quản trị trong môi trường chạy dịch vụ và nhập tài khoản Muse hợp lệ. Không chạy tác vụ sinh nội dung để kiểm tra khi chưa có tài khoản của bạn.
