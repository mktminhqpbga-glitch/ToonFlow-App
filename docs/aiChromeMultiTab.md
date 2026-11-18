# AI Chrome đa dịch vụ và nhiều tab — giao thức v7

## Mục tiêu và phạm vi

AI Chrome đưa yêu cầu của node qua extension trong Chrome, **không** sử dụng API key của website. Một tác vụ chỉ hướng tới **một tab được chỉ định** bằng dịch vụ, tab ID, document token và URL. Nếu chuyển trang, không còn đăng nhập, tab mất kết nối, tải ảnh chưa xác nhận hoặc không nhận được kết quả đúng tác vụ, hệ thống dừng và báo lỗi, **không âm thầm chuyển sang tab khác hay tự gửi lại**.

Muse2API là cơ chế API khác, vẫn giữ URL/API và định danh provider riêng.
Khi bật driver Python `chrome_extension` tùy chọn, **chỉ lớp điều khiển
trình duyệt** của Muse2API đi qua extension; backend giao tiếp trực tiếp
với hàng đợi AI Chrome, không gọi ngược lại HTTP Muse2API nên không có
vòng lặp. Chế độ này còn ở staging và chưa thay dịch vụ live.

### Chọn tại node

1. Mở Chrome đã cài và ghép nối extension với MacFlow trong **Cài đặt → AI chrome**. Có thể mở nhiều tab của cùng hoặc khác dịch vụ.
2. Trong node văn bản, hình ảnh, video hoặc âm thanh, dùng **AI Chrome → Dịch vụ → Tab #N** để chọn tab. Các node khác có tích hợp bộ chọn mô hình cũng chỉ hiển thị tab tương thích với loại đầu ra của chúng.
3. Kiểm tra trạng thái tab: **sẵn sàng**, **đang chạy**, **chưa sẵn sàng** hoặc **bị chặn**. Một tab đang chạy chỉ có thể nhận yêu cầu tiếp theo qua hàng đợi, không gửi hai prompt cùng lúc.
4. Nhập prompt và kết nối tư liệu tham chiếu vào node theo thứ tự mong muốn. Khi gửi, backend chụp snapshot từng tệp, kiểm tra MIME/chữ ký/dung lượng và đưa vào manifest số thứ tự 1, 2, 3… cùng SHA-256.
5. Extension chỉ được nhấn Send sau khi đã xác nhận nhận đủ dữ liệu tham chiếu, tệp được đính kèm theo đúng thứ tự và tab không có tác vụ ngoài ý muốn. Sau khi nhận kết quả, backend kiểm tra checksum và kiểu media, lưu vào workspace rồi mới báo hoàn thành.

### Kết nối một lần bằng mã — tự nhận diện đầu ra

Từ extension **0.8.2**, popup không còn menu chọn tab, nút ghim tab, ô tích
đầu ra hay thao tác lưu loại media. Người dùng chỉ cần **dán mã ghép nối**
(tự bắt đầu kết nối khi dán trọn mã, hoặc bấm Kết nối) và xác nhận
thiết bị tại MacFlow khi ghép nối lần đầu. Extension tự dò những tab
Muse / ChatGPT / Gemini đã mở. **Chọn tab chỉ tại node** (Dịch vụ → Tab #N).

Bridge Muse hiện triển khai đầy đủ bốn luồng nhận kết quả theo loại tác
vụ `text/image/video/audio`, nên tự báo `outputKinds` qua phép kiểm tra
live của chính content script; không dựa vào lựa chọn thủ công hay dữ
liệu lưu từ phiên trước. ChatGPT và Gemini vẫn chỉ công bố `text` vì
chưa có adapter nhận file media tương ứng. Nếu bridge cũ không công bố
khả năng media, hệ thống chỉ coi nó là `text` thay vì đoán.

### Đối chiếu cách điều khiển Muse2API và extension

Đã đọc **bản clone staging Python v0.4.0** tại
`services/muse2api-v040/src/muse2api/drivers/browser/driver.py` và
`dom.py`. Chưa có bản sao source tùy biến chính xác của PID Muse2API
đang chạy trong `services/muse2api`, vì vậy đối chiếu này **không phải
xác minh mã của tiến trình live**.

Muse2API browser driver dùng CDP: `_new_thread` chuẩn bị cuộc hội thoại,
`_attach` đưa **từng ảnh theo thứ tự** bằng `input[type=file]`, sau
đó `_send` điền prompt vào textarea bằng native setter và click Send.
`_wait_media` theo dõi file đính kèm từ phản hồi mới, rồi
`_download` đọc byte tệp trong page context. Nó có nhánh tự gửi **một
prompt tiếp theo** hỏi Muse đính kèm file khi phản hồi chỉ có chữ; luồng
extension **không** tự gửi thêm prompt đó để tránh phát sinh tác vụ không
được mong đợi.

Extension hiện dùng `museBridge.js` (content script, không cần CDP):
backend pin `tabId + URL + documentToken`, kiểm tra tab không có draft,
nhận gói prompt và các ảnh theo manifest/checksum, rồi **điền prompt
trước, tải lần lượt ảnh 1→2→…** vào cùng composer. Sau mỗi ảnh, chờ
đúng số preview và upload ổn định, đồng thời kiểm tra prompt không đổi.
**Chỉ nhấn Send đúng một lần sau khi đã đủ tất cả ảnh**; chờ receipt có
`REQUEST_BEGIN/END`, kiểm tra media có đúng loại và chuyển bytes ngược
về backend. Nếu không xác nhận được receipt thì giữ trạng thái không rõ,
**không tự gửi lại**. “Gửi prompt” trong trình tự này là **điền vào ô
nhập**, không phải nhấn Enter gửi thành một message riêng rồi mới upload.

Đã thêm `apps/server/tests/museBridgeSequence.test.ts` chạy chính
content script trên fake DOM: thử hai ảnh theo thứ tự và click một lần,
thiếu preview ảnh thứ hai thì không click, prompt bị thay đổi sau ảnh
thứ nhất thì không click. Test này không gửi AI và **không chứng minh
Muse UI thật vẫn có cùng cấu trúc DOM**.

Nếu màn hình Cài đặt vẫn hiện `Đầu ra: text` ở Muse, hãy cập nhật file
extension từ **Cài đặt → AI chrome → Tải extension**, giải nén đè thư mục
extension hiện có, **Reload** tại `chrome://extensions`, rồi tải lại
trang Muse và bấm **Làm mới trạng thái** ở MacFlow. Không cần chọn hay
tích thêm gì trong popup. Danh sách model sẽ tự có AI Chrome cho node
tạo ảnh khi backend nhận được tab Muse có `outputKinds: image`.

**Lưu ý:** adapter có thể *vận chuyển và kiểm tra* ảnh/video/audio, nhưng
điều đó không chứng minh quyền tài khoản, quota, hay website sẽ tạo media
thành công. Muse phải thực sự trả tệp đúng loại, đúng tác vụ, giải mã
được và qua kiểm tra checksum thì node mới nhận thành công. Khi không
thể xác nhận, báo lỗi/giữ trạng thái chưa rõ; không tự gửi lại.

### Giao thức và giới hạn

| Thành phần | Quy tắc |
| --- | --- |
| Giao thức WebSocket | v7 ở backend và extension; bản cũ không tương thích |
| Thông điệp tab | `tabStatus.targets[]` (tối đa 25), mỗi tab có `provider`, `tabId`, `url`, `documentToken`, `outputKinds`, `ready`, `blocked`, `busy` và có thể có `taskId` |
| Dịch vụ / model ID | `museChrome`, `chatgptChrome`, `geminiChrome`; cấu trúc còn chuẩn bị sẵn ID cho Claude/Grok/Perplexity, nhưng chỉ dịch vụ mà extension **thật sự báo có thể dùng** mới xuất hiện trong catalog |
| Chọn tab | `other.chromeTabId` cho media, `chromeTabId` cấp yêu cầu cho văn bản; từ chối khi tab không thuộc đúng dịch vụ/model hoặc token/URL đã đổi |
| Gói yêu cầu | `chromeRequest` v1; `prepare → packageAck(accepted) → fileStart/chunks/fileEnd → packageEnd → packageAck(ready) → run` |
| Tham chiếu | Tối đa 8 tệp, tổng 64 MiB; thứ tự và checksum phải khớp manifest |
| Kết quả | Văn bản tối đa 1 MiB; media tối đa 64 MiB; chỉ lưu file hợp lệ đúng loại mà node yêu cầu |
| Hàng đợi | Tối đa 20 tác vụ, 128 MiB tệp đang chờ; vận chuyển hiện tuần tự toàn cục, mỗi tác vụ cố định một tab, chờ ít nhất 5 giây sau kết quả đã lưu |
| Trạng thái không rõ | Không tự gửi lại; lưu ID và trạng thái, yêu cầu kiểm tra thủ công trước khi tiếp tục |

**Lưu ý quan trọng:** Nhà cung cấp website có thể thay đổi HTML, quyền tài khoản, hạn mức, luồng tải file và cấu trúc câu trả lời bất cứ lúc nào. Không suy ra khả năng tạo ảnh/video/audio chỉ từ việc trang có ô nhập văn bản. Chỉ cho chọn loại đầu ra mà adapter thực tế hỗ trợ và có thể nhận diện kết quả an toàn; nếu không xác nhận được ảnh đã đính kèm hoặc đầu ra có đúng tác vụ hay không, dừng trước khi gửi hoặc báo trạng thái chưa rõ.

## Kiểm tra kỹ thuật và kiểm thử thủ công

Chạy từ gốc repository (không tự động gọi AI):

```sh
export PATH="$HOME/.bun/bin:$PATH"
bun run --cwd apps/server typecheck
bun test apps/server/tests/aiChromeMultiTab.test.ts
node --check packages/chromeExtension/background.js
node --check packages/chromeExtension/requestReceiver.js
node --check packages/chromeExtension/museTransport.js
```

Để kiểm thử thật, người dùng cần đăng nhập website trong chính Chrome đã ghép nối, tải lại extension v0.8.2 qua `chrome://extensions`, mở tab mẫu và thử một yêu cầu chỉ khi chấp nhận sử dụng hạn mức AI. Cần xác minh riêng: nhận diện từng tab và số thứ tự; tab sẵn sàng/bận; ghim chính xác tab được node chọn khi gửi; thứ tự file; phản hồi văn bản/ảnh thật; thay tab giữa chừng; mất kết nối; timeout và trạng thái không rõ. Không coi typecheck hoặc test DOM giả lập là bằng chứng đã gửi/nhận thành công trên mọi website.

Tài liệu giao thức Muse phiên bản trước: [aiChrome.md](aiChrome.md).
