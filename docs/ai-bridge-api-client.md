# AI-Bridge là dịch vụ độc lập — MacFlow chỉ dùng API

## Phân chia trách nhiệm

**AI-Br / AI-Bridge** là dịch vụ độc lập. MacFlow có nhà cung cấp **AI-Br tích hợp sẵn** (`providerId: aiBr`), kết nối mặc định với `http://127.0.0.1:4319/v1` hoặc một tên miền HTTPS trên Render do người dùng nhập. Chrome và extension chỉ chạy trên máy người dùng; nếu có Dashboard Cloud thì backend/API nằm trên Render. MacFlow không cài đặt, không đóng gói, không cập nhật hoặc quản lý extension AI-Br.

**MacFlow** là API client: cấu hình **Base URL + API Key một lần** tại **Cài đặt → Kết nối AI-Bridge (API)**, sau đó model văn bản đã công bố từ `/v1/models` tự xuất hiện dưới nhà cung cấp AI-Br. Khi dịch vụ xác minh khả năng ảnh/video và trạng thái tab, các model media tương ứng sẽ xuất hiện trên Canvas — **không cần nhập tệp nhà cung cấp `.ts`**. Khóa được lưu ở `data/settings.json` (quyền `0600`), không gửi về frontend, không lưu tại browser storage hoặc in vào log. Đổi sang máy chủ/tên miền mới phải nhập lại API Key.

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

## Nhà cung cấp AI-Br tích hợp trong MacFlow

- `providerId: aiBr` được MacFlow cung cấp sẵn; model văn bản được đọc trực tiếp từ API `GET /v1/models` và dùng giao thức OpenAI chat completions (không tự retry sau khi prompt có thể đã đến website). Không nhập thêm `.ts` thủ công.
- Kết nối trong Cài đặt → Kết nối AI-Bridge (API): Base URL `http://127.0.0.1:4319/v1` hoặc `https://<domain>/v1`, cộng API Key. Không được tự gửi khóa cũ sang domain mới.
- Model media chỉ xuất hiện khi API thực sự công bố `outputKinds` chứa `image`/`video` và `/api/bridge/status` xác nhận sẵn sàng. Model được ghim trên Dashboard có thể không cần `target`; nếu không ghim, node phải chọn chính xác Profile/tab/document/URL. Không gửi sang tab bất kỳ.
- Đầu vào tham chiếu sử dụng `POST /v1/input-images` dạng bytes thật, yêu cầu ID và SHA-256 trước khi gửi prompt. Luồng async dùng `POST /v1/media/tasks` + `GET /v1/media/tasks/{task_id}` với `client_request_id` và `Idempotency-Key`; mất kết nối hoặc resume chỉ GET, tuyệt đối không POST lại. Chỉ fallback chat đồng bộ khi task API xác nhận rõ endpoint không tồn tại.
- Đầu ra tải qua `GET /v1/media/{id}` có xác thực, xác minh MIME, kích thước và SHA-256. Tối đa 4 ảnh đầu vào, 5 MiB/ảnh và 16 MiB tổng; đầu ra tối đa 4 tệp, mỗi tệp 16 MiB.
- Các bản nghiên cứu AI-Br 0.4.0 và AI-Bridge 0.6.0 lưu trong workspace **không chứng minh** dịch vụ 4319/Render hiện đáp ứng toàn bộ hợp đồng: hiện có bản thiếu API raw upload, `outputKinds` hoặc async task. Chỉ chạy thử bằng fixture cho tới khi server và Extension thật đã được nghiệm thu riêng.
