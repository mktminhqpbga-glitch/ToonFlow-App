# AI chrome 0.6.0 — Chrome trong máy ảo Muse AI

Đã bổ sung mã relay, kết nối hai đầu và adapter Muse. **Chưa chạy install/build/typecheck/kiểm tra cú pháp, dịch vụ, trình duyệt hoặc kiểm thử bản này. Chưa triển khai một relay công khai.** Hướng dẫn bên dưới dành cho bạn hoặc người vận hành thực hiện.

Điều kiện: bạn có thể mở Chrome và cài extension bên trong máy ảo Muse AI. VM cần truy cập được Muse và địa chỉ relay qua WSS. Một MacFlow hiện ghép với một extension, chọn kết nối thông thường hoặc VM; hai chế độ dùng chung hàng đợi tác vụ.

## Các thành phần đã có

```text
MacFlow trên máy chủ ── WSS ── relay ── WSS ── extension trong VM
          ╰──────────── kênh mã hóa hai đầu ────────────╯
                                               ↓
                                      tab Muse đã đăng nhập
```

- Relay độc lập: `apps/server/src/chromeRelay/index.ts`. Không import cấu hình/workspace MacFlow, không ghi prompt, media hoặc token ra đĩa.
- Client relay phía MacFlow: `apps/server/src/utils/aiChrome/relay.ts`.
- Client relay phía extension: `packages/chromeExtension/relayConnection.js`.
- Mã local `MC1.` vẫn dùng cổng loopback. Mã VM `MV1.` mang URL relay, room, ticket, khóa kênh và hạn ghép nối. Chỉ cần sao chép/dán toàn bộ mã; đây không phải mã số ngắn 6 chữ số.
- Kênh VM dùng HMAC-SHA256 xác nhận khóa, nonce mới từ cả hai đầu, HKDF-SHA256 tạo khóa riêng mỗi chiều, AES-256-GCM và bộ đếm chống phát lại frame. Relay chỉ chuyển tiếp ciphertext của giao thức tác vụ. Bằng chứng ghép nối `MVH.` được gửi bên trong kênh, không gửi lại toàn bộ mã chứa khóa.
- Mã ghép nối hết hạn sau tối đa 5 phút, backend kiểm tra hạn. Relay dùng TTL tương đối để tránh phụ thuộc việc hai máy chủ có cùng đồng hồ tuyệt đối. Sau xác nhận thiết bị, phiên giữ lại cho kết nối lại bằng token.
- Khi xác nhận thiết bị, MacFlow đổi sang ticket và khóa kênh mới, chuyển cho extension bên trong kênh mã hóa rồi lưu riêng hai đầu. Ticket trong mã MV1 ban đầu không còn dùng để nối lại room đã ghép.
- Đăng ký room từ MacFlow yêu cầu khóa vận hành relay. Khóa này không đưa vào ZIP extension hoặc mã VM. Ticket và khóa kênh khác nhau; relay chỉ giữ hash ticket trong RAM.
- Kết nối lại chỉ phục hồi đường truyền, không phát lại tác vụ đã gửi. Hàng đợi dừng nếu tác vụ gián đoạn; người dùng kiểm tra rồi chủ động tiếp tục như luồng local.

## 1. Chuẩn bị relay trên máy có tên miền HTTPS

Cần một máy có Bun và địa chỉ mà VM truy cập được. Nếu chưa có máy/tên miền này thì mã VM chưa thể kết nối thật; source hiện không có relay công cộng được cài sẵn.

Tạo khóa ngẫu nhiên cho vận hành relay (giữ riêng, dùng cùng giá trị ở relay và máy MacFlow):

```bash
bun -e 'import { randomBytes } from "node:crypto"; console.log(randomBytes(32).toString("hex"));'
```

Trong thư mục `MacFlow` trên máy relay, với dependencies đã cài:

```bash
export MACFLOW_CHROME_RELAY_KEY='THAY_BANG_KHOA_NGAU_NHIEN_VUA_TAO'
export MACFLOW_CHROME_RELAY_PORT=8788
export MACFLOW_CHROME_RELAY_BIND=127.0.0.1
bun run dev:chromeRelay
```

Lệnh này chạy relay riêng, không chạy backend/các tác vụ dữ liệu MacFlow. Relay mặc định chỉ nghe loopback. Phục vụ nó qua TLS reverse proxy, ví dụ Caddy với tên miền của bạn:

```caddyfile
relay.example.com {
  reverse_proxy 127.0.0.1:8788
}
```

`relay.example.com` là tên miền ví dụ, phải thay bằng tên miền thực đã trỏ tới máy relay. URL để cấu hình là `wss://relay.example.com/relay`. HTTP `/health` chỉ báo relay đang phục vụ; không chứng minh ghép nối hoặc AI chạy được.

Nếu dùng bản build: `bun run build:server` tạo thêm `build/chromeRelay/index.js`. Có thể sao chép tệp relay đã bundle tới máy relay có Bun, đặt các biến môi trường như trên rồi chạy `bun /đường/dẫn/index.js`; hoặc chạy `bun run start:chromeRelay` trong repo đã build. Không cần sao chép dữ liệu workspace/`settings.json` của MacFlow sang relay.

## 2. Cấu hình máy chạy MacFlow

Trên máy MacFlow, đặt cùng khóa vận hành và URL WSS của relay trước khi khởi động backend:

```bash
export MACFLOW_CHROME_RELAY_URL='wss://relay.example.com/relay'
export MACFLOW_CHROME_RELAY_KEY='THAY_BANG_CUNG_KHOA_NGAU_NHIEN_TREN_RELAY'
bun run start:server
```

Với PowerShell trên Windows:

```powershell
$env:MACFLOW_CHROME_RELAY_URL = 'wss://relay.example.com/relay'
$env:MACFLOW_CHROME_RELAY_KEY = 'THAY_BANG_CUNG_KHOA_NGAU_NHIEN_TREN_RELAY'
bun run start:server
```

Chạy bản mã mới thì cần tự cài dependencies/build trước theo README. Các lệnh hướng dẫn này chưa được Codex chạy trong lượt sửa.

Trong Settings → AI chrome → Kết nối VM, trạng thái phải cho biết đã cấu hình relay. Bấm Tạo mã: backend chỉ trả mã khi đăng ký room với relay thành công. Nếu thiếu cấu hình, khóa không đúng, URL sai hoặc relay không tới được, hiển thị lỗi; không tạo mã giả hoặc tự chuyển sang local.

## 3. Cài extension và ghép nối VM

1. Sau khi cấu hình relay ở backend, tải ZIP extension từ Settings của chính MacFlow đó. ZIP tự thêm quyền cho tên miền relay được cấu hình. ZIP không chứa khóa vận hành, token hoặc khóa kênh.
2. Chuyển ZIP vào VM Muse AI, giải nén, cài bằng Load unpacked. Kiểm tra phiên bản **0.6.0**, có `relayConnection.js`, `mediaDownload.js` và `pairing.js`.
3. Tại MacFlow chọn Kết nối VM, tạo mã `MV1.`. Nếu đang ghép local/thiết bị cũ, hủy ghép nối trước.
4. Trong popup extension trên VM chỉ dán mã rồi bấm Ghép nối. Không nhập URL hay cổng.
5. Quay về MacFlow trên máy chủ, đối chiếu Extension ID rồi xác nhận thiết bị. Popup trong VM phải báo Đã kết nối VM. Nút Mở MacFlow không mở localhost của VM thay cho máy chủ.
6. Đăng nhập Muse bên trong VM, mở tab chat, để trống prompt và bỏ các tham chiếu cũ. Chọn tab và loại đầu ra đã kiểm tra trong popup.
7. Chọn Muse • Chrome trong node của MacFlow để tạo yêu cầu. Gói, ID, truyền khối, checksum, ACK ready/saved và khoảng nghỉ 5 giây giữ nguyên.

Nếu đổi tên miền relay: cập nhật biến môi trường, tạo mã/ghép nối mới và tải lại ZIP để cấp đúng quyền domain. Không thêm quyền mọi website cho extension. Không gửi mã MV1 hoặc toàn bộ storage vào log/báo lỗi vì chứa bí mật ghép nối.

## 4. Muse: upload, gửi và nhận kết quả

- Chờ shell/ô nhập tải xong, kiểm tra không còn draft/tệp cũ.
- Upload theo lô nếu input hỗ trợ nhiều tệp, hoặc từng tệp nếu chỉ hỗ trợ một tệp. Không sửa thuộc tính `multiple` để ép website nhận nhiều tệp.
- Xác nhận đủ từng tệp bằng tên hoặc card preview tương ứng, không còn trạng thái upload/busy và ổn định ít nhất 1,5 giây. `input.files` chứa tệp chưa được coi là bằng chứng upload thành công. Trước Send kiểm tra lại đúng số card.
- Nhập nguyên prompt đã đóng gói, bấm Send một lần, xác nhận bubble người dùng mới có đủ REQUEST_BEGIN/END cùng ID. Không tự dùng Enter, đổi prompt hoặc gửi lại khi không chắc đã gửi.
- Cho phép Muse đổi URL do tạo hội thoại mới chỉ sau khi tìm được tin nhắn có đầy đủ ID, cùng document/origin và không có tin nhắn khác chen vào. Cập nhật URL cho tác vụ và các tác vụ đang xếp hàng cùng tab/document. Chuyển tab/document/cuộc hội thoại thủ công khi đang chạy vẫn dừng.
- Quét kết quả 5 giây/lần; văn bản phải đủ hai dấu RESPONSE, media phải là ứng viên mới trong vùng phản hồi của yêu cầu. Cần ổn định hai lần quét và không còn nút Stop.
- Đọc ảnh/video/audio thực, kiểm tra MIME/chữ ký ở backend, giải mã ảnh hoặc metadata media tại Chrome. Poster không thay thế video. Nếu có nhiều URL của cùng phản hồi, có thể thử URL khác khi tải tệp thất bại; không gửi lại yêu cầu AI.
- Tệp phải thực sự tải được. Blob MSE/DRM không xuất tệp hoặc codec Chrome không giải mã được có thể dừng; không giả thành công bằng cách chỉ trả URL.
- Phát hiện các cảnh báo Muse về quota, phiên đăng nhập, upload, tạo nội dung thất bại và câu trả lời từ chối tạo media. Lỗi có mã và chặng; không tự tạo phiên bản prompt khác.

## 5. URL kết quả và CDN

Ưu tiên tải bằng phiên tab Muse. Nếu không đọc được URL HTTPS do CORS/quyền phiên trang, content script yêu cầu background tải. Background chỉ tải hostname đã có quyền trong manifest, chia khối 64 KiB và giới hạn 64 MiB/120 giây. Không follow redirect trong đường tải background.

Nếu kết quả nằm ở CDN khác Muse, thêm chính xác hostname CDN vào biến môi trường của backend, ví dụ:

```bash
export MACFLOW_CHROME_MEDIA_HOSTS='assets.examplecdn.com,video.examplecdn.com'
```

Đây là tên miền ví dụ. Dùng hostname CDN thực tế từ URL kết quả, không nhập URL đầy đủ, wildcard hoặc địa chỉ máy nội bộ. Khởi động lại backend, tải lại ZIP và cập nhật extension. ZIP bổ sung quyền HTTPS cho những hostname đó; không tự cấp quyền cho tên miền do AI tùy ý trả về. URL redirect cần lấy URL tệp trực tiếp; nếu quyền/phiên/codec không cho đọc, tác vụ báo lỗi thay vì báo đã lưu.

## Giới hạn và cách báo lỗi

Giữ giới hạn 8 tham chiếu/tổng 64 MiB, text đầu ra 1 MiB, media đầu ra 64 MiB, hàng đợi 20 tác vụ. Relay giới hạn room/kết nối, frame 2 MiB cộng overhead mã hóa, có hạn đăng ký, heartbeat và ngắt khi peer quá tải. Relay restart làm mất room RAM; host đăng ký lại room đã ghép, extension kết nối lại bằng cấu hình riêng đã lưu.

Backend lưu token hash và cấu hình kênh trong `data/settings.json` quyền 0600; extension lưu cấu hình/token trong trusted storage. Relay không có bản sao workspace. Hủy ghép nối thu hồi token và đóng room/kênh.

Gửi mã lỗi, task ID, chặng, loại node, phiên bản extension và ảnh vùng giao diện Muse liên quan. Không gửi mã ghép nối, khóa relay, khóa kênh hoặc cookie.

Các selector/card upload và trạng thái giao diện được viết dựa trên cấu trúc đã phân tích; chưa kiểm chứng trên tài khoản/VM thật của bạn. Vì vậy chưa thể xác nhận độ tương thích của phiên bản giao diện Muse cụ thể. Không coi tài liệu hoặc build thành bằng chứng PASS.
