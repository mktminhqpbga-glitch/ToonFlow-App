# AI-Bridge là dịch vụ độc lập — MacFlow chỉ dùng API

## Phân chia trách nhiệm

**AI-Bridge** chạy như một dịch vụ riêng ở `http://127.0.0.1:4319` (bản tùy chỉnh). Nó tự quản lý Chrome extension, các Chrome Profile, tab AI, phiên trang, hàng đợi và việc tạo/thu nhận media. MacFlow không cài đặt, không đóng gói, không cập nhật hay điều khiển extension của AI-Bridge.

**MacFlow** là API client: người dùng chỉ nhập API Key tại **Cài đặt → Kết nối AI-Bridge (API)**, sau đó chọn AI và tab trong từng node. MacFlow gửi yêu cầu thông qua API có xác thực, nhận ảnh/video đã xác minh và gắn kết quả về đúng node. API Key được lưu ở `data/settings.json` (quyền `0600`), không gửi về frontend, không lưu tại browser storage và không in vào log.

## Hợp đồng API cần từ dịch vụ AI-Bridge

| Phương thức | Endpoint | Mục đích |
| --- | --- | --- |
| `GET` | `/health` | Xác nhận máy chủ đang chạy, không cần API Key |
| `GET` | `/v1/models` | Xác thực API Key, đọc danh sách model |
| `GET` | `/api/bridge/status` | Đọc extension, Profile, tab, phiên và khả năng output; cần bearer key |
| `POST` | `/v1/chat/completions` | Tạo trên tab đã ghim rõ ràng; không tự chọn tab khác |
| `POST` | `/v1/input-images` | Tải ảnh đầu vào bằng raw bytes, trả ID và SHA-256 |
| `GET` | `/v1/media/:id` | Tải media đã tạo để MacFlow xác minh mime, độ dài và SHA-256 |

`/api/bridge/status` cần cung cấp `connected_extensions`, `extension_versions`, `tabs` với `profileInstanceId`, `tabId`, `documentToken`, `provider`, `url`, `ready`, `busy`, `outputKinds`. Thiếu hoặc sai trường → MacFlow không phát yêu cầu tạo ảnh/video. Tab hoặc phiên đã đổi → báo lỗi, tuyệt đối không gửi lại/đổi tab ngầm. Khả năng tải ảnh tham chiếu phải được API và tab xác nhận rõ.

## Tình trạng triển khai

- MacFlow frontend chỉ hiển thị kết nối, kiểm tra API và danh sách AI/tab; tạo ảnh/video thực hiện trong node.
- MacFlow backend chỉ kiểm tra/cấp quyền sử dụng API. Không đọc tệp khóa hoặc token trong thư mục nguồn AI-Bridge tùy chỉnh, không trả khóa cho trình duyệt, không đóng gói extension.
- Nguồn Original `4320` vẫn được giữ tạm thời cho workflow cũ; không tự chuyển khi Custom chưa xác minh an toàn.
- Hiện AI-Bridge Custom có thể trả `/v1/models` nhưng nếu `/api/bridge/status` trả `404`, chỉ coi API Key hợp lệ, **không** coi tính năng media đã sẵn sàng.

Không cần và không được gửi prompt tạo ảnh/video để kiểm thử kết nối API Key. Các endpoint kiểm tra chỉ đọc metadata.
