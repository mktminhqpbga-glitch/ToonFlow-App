# AI chrome — luồng yêu cầu chung 0.6.0

> **Tài liệu lịch sử cho v0.6.0.** Bản AI Chrome mới triển khai giao thức v7/extension 0.8.0 với nhiều dịch vụ, nhiều tab và bộ chọn hai tầng. Xem [AI Chrome đa dịch vụ và nhiều tab](aiChromeMultiTab.md) để biết cách dùng hiện tại và những giới hạn chưa kiểm chứng trên website thực.

Trạng thái: đã sửa mã nguồn, **CHƯA CHẠY build, typecheck, kiểm tra cú pháp hoặc kiểm thử bản 0.6.0**, theo yêu cầu chủ dự án. Những kết quả kiểm tra các bản trước không xác nhận bản này hoạt động. Hướng dẫn để người dùng kiểm thử: [aiChromeManualTest.md](aiChromeManualTest.md).

Phạm vi lượt sửa ngày 16/11/2026: kết nối VM qua relay có mã hóa hai đầu, ghép nối chỉ nhập mã, xác nhận gói, upload/gửi/nhận kết quả và lỗi Muse. Chỉ nối chức năng vào các mục kết nối đã có, không thiết kế lại giao diện. Mã tham khảo 26Flow được đọc để hiểu cơ chế, không sửa References hoặc sao chép mã nguồn vào MacFlow.

Chạy relay và ghép nối trong máy ảo Muse AI: [aiChromeVm.md](aiChromeVm.md). Chưa có relay công khai được triển khai; cần cấu hình URL/khóa vận hành trước khi dùng VM.

## Nguyên tắc

Khi node chọn provider `aiChrome`, yêu cầu đi qua một luồng chung:

```text
Node: prompt + lệnh/cấu hình + tham chiếu
    → nhánh aiChrome ở backend
    → buildChromeRequest() → { payload, files }
    → runTask() dùng gói đã tổng hợp
    → hàng đợi dùng chung → WebSocket → extension
    → đính kèm File + nhập prompt + bấm gửi trên Muse
    → quét phản hồi 5 giây/lần → chuyển kết quả về
    → kiểm tra dữ liệu → lưu kết quả → xác nhận saved
    → chờ thêm 5 giây → yêu cầu tiếp theo
```

Text Node, tạo ảnh, video và âm thanh dùng cùng bộ tổng hợp prompt, hàng đợi, cơ chế ID và truyền tệp. `kind` chỉ mô tả đầu ra cần thu về: văn bản, ảnh, video hoặc âm thanh. Nó không chọn một giao thức gửi khác hoặc một endpoint AI riêng trên Muse.

Các endpoint và cách lưu hiện có của ToonFlow vẫn được tận dụng: văn bản trả về qua SSE; media lưu vào workspace và gắn với media task. Cả hai đều gọi `runTask()` để chuyển sang Chrome. Provider API tiếp tục đi qua adapter API hiện có; nhánh này không thêm dấu REQUEST/RESPONSE hoặc chuyển đặc tả của API thành chữ.

## Đóng gói yêu cầu

- `buildChromeRequest()` ở `apps/server/src/utils/aiChrome/request.ts` là điểm đóng gói chung. Gọi hàm không cần có tab hoặc kết nối Chrome; hàm không gửi yêu cầu và không ghi đĩa. Chỉ `runTask()` mới sử dụng cơ chế vận chuyển đã có.
- Giữ dữ liệu yêu cầu gốc; tạo một prompt gửi riêng cho Chrome.
- Prompt gửi có `[REQUEST_BEGIN:UUID]`, yêu cầu gốc, loại đầu ra, cấu hình đã chọn dưới dạng JSON văn bản, danh sách tệp theo thứ tự và `[REQUEST_END:UUID]`.
- Tỷ lệ, kích thước, thời lượng, độ phân giải, âm thanh, giọng đọc, tốc độ và `other` được giữ thành đặc tả văn bản nếu chúng có trong yêu cầu node. Không tự bấm đổi các thiết lập này trên website.
- `referenceOrder` của node video được bổ sung thành `referenceBindings`: `{{ref N}}` trỏ rõ tới số tệp đính kèm, vai trò ảnh/khung đầu/khung cuối/video/audio hoặc đoạn văn bản tương ứng. Thiếu tệp phải báo lỗi trước khi gửi.
- Với Text Node: đưa system prompt, lịch sử hội thoại, thông số công cụ và tham chiếu văn bản vào prompt. Ảnh inline trong ngữ cảnh được tách ra thành tệp; tài liệu được đọc thành văn bản bằng bộ đọc hiện có. Nội dung base64 của ảnh không bị nhét vào prompt.
- Chỉ tách ảnh từ các phần nội dung ảnh thật của message; không duyệt và thay thế tùy ý đối tượng trong tham số, kết quả JSON hoặc schema công cụ. Không thay đổi ngữ cảnh gốc.
- Văn bản phải nằm giữa `[RESPONSE_BEGIN:UUID]` và `[RESPONSE_END:UUID]`. Bỏ hai dấu trước khi trả cho node. Với JSON/code, dấu nằm ngoài nội dung JSON/code.
- Media được lấy từ vùng phản hồi sau đúng tin nhắn chứa REQUEST ID, đúng tab, URL và document. Không yêu cầu vẽ ID lên ảnh hoặc đọc ID trong video/audio. Không lấy ảnh poster làm video.
- Khi node cung cấp công cụ, yêu cầu AI trả JSON `{text, toolCalls}`; tên công cụ được kiểm tra ở backend, tham số và việc thực thi đi qua vòng công cụ sẵn có của node. Đây chưa phải tích hợp Agent SDK riêng.

Mỗi lần gọi có một UUID; một node có thể có nhiều lần gọi. Media task hiện có giữ ánh xạ taskId → workspace/canvas/node. Backend lưu thêm metadata theo UUID trong `data/aiChromeTasks/` để chặn gửi lại cùng ID sau khi khởi động lại. Khi hàng đợi tiếp nhận, bản ghi `UUID.json` lưu thêm trường `request` chứa payload đã đóng gói, với quyền tệp `0600`; không chứa byte media. Phản hồi văn bản hoàn chỉnh được lưu riêng ở `UUID.response.json` trước khi xác nhận saved. Đây là bản ghi transport; node vẫn chịu trách nhiệm cập nhật nội dung trên canvas.

### Đầu ra tại ranh giới đóng gói

Hàm trả về `{ payload, files }`. `payload` là đối tượng JSON; `files` giữ dữ liệu nhị phân theo cùng thứ tự với `payload.attachments`. Không serialize cả `{ payload, files }` để vận chuyển media bằng JSON.

| Trường trong payload | Nội dung |
| --- | --- |
| `version`, `type` | Phiên bản gói `1`, loại `chromeRequest`; phân biệt với giao thức WebSocket phiên bản `6` |
| `providerId`, `modelId` | `aiChrome`, `museChrome` |
| `requestId`, `kind` | UUID viết thường của lần gọi và loại đầu ra cần nhận |
| `originalPrompt` | Chuỗi đầu vào bộ đóng gói, giữ nguyên; với node văn bản đây là context và tham chiếu văn bản đã tổng hợp |
| `specification` | Bản sao JSON độc lập của các đặc tả/lệnh đã chọn; giữ `false`, `0`, chuỗi và mảng, bỏ trường tùy chọn `undefined` ở cấp ngoài |
| `prompt` | Văn bản đầy đủ có chỉ dẫn, đặc tả, tham chiếu và dấu ID, sẵn sàng bàn giao |
| `markers` | Bốn dấu REQUEST_BEGIN/END và RESPONSE_BEGIN/END của cùng requestId |
| `attachments` | Mỗi tệp có `index` từ 0, ID ổn định `requestId:N` với N từ 1, nhãn, tên tệp, MIME, số byte và SHA-256 |
| `totalReferenceBytes` | Tổng dung lượng tệp nhị phân |
| `response` | Loại đầu ra mong đợi, có bắt buộc dấu RESPONSE hay không, MIME được nhận và giới hạn dung lượng; chỉ mô tả hợp đồng, không tự thực hiện lấy kết quả |

Tệp được sao chép thành snapshot riêng khi đóng gói để thay đổi dữ liệu đầu vào sau đó không làm lệch checksum hoặc nội dung đang chờ. Tên tệp trong prompt khớp quy tắc tên của adapter hiện có. Yêu cầu thiếu ID hợp lệ, prompt rỗng/quá dài, cấu hình không phải JSON, tệp rỗng, sai MIME/chữ ký hoặc vượt giới hạn bị từ chối trước khi vào hàng đợi.

Không thêm API xem trước, endpoint mới hay logic thao tác website. Nhánh provider API không gọi bộ đóng gói Chrome. Bộ nhận mới dùng giao thức WebSocket phiên bản `6`; phiên bản payload vẫn là `1`.

## Xác nhận nhận gói — bổ sung từ 0.4.0

```text
Backend                                 Extension
prepare(payload, requestHash)        →  kiểm tra cấu trúc, ID, dấu prompt,
                                       manifest, đầu ra và SHA-256 payload
                                    ←  packageAck(accepted, requestHash)
fileStart + khối nhị phân + fileEnd  →  đối chiếu từng tệp với manifest,
                                       kiểm tra thứ tự, byte và SHA-256
                                    ←  fileAck sau mỗi bước/khối
packageEnd(requestHash)              →  kiểm tra đủ số tệp và tổng byte,
                                       lưu chặng packageReady
                                    ←  packageAck(ready, requestHash)
run(requestHash)                     →  mới bàn giao cho adapter tab đã chọn
```

- `accepted` chỉ xác nhận metadata đã hợp lệ và đã ghi nhận ID; chưa có nghĩa nhận đủ tệp. Backend ghi chặng `receivingPackage`.
- `ready` chỉ phát sau khi đủ mọi tệp trong manifest, không còn tệp đang nhận, tổng byte khớp và metadata trạng thái đã lưu. Backend lúc này mới ghi `received` và phát `run`. Yêu cầu không có tệp vẫn phải qua `packageEnd` và ACK ready.
- `requestHash` là SHA-256 của UTF-8 `JSON.stringify(payload)`, bao gồm prompt, đặc tả, markers, manifest và hợp đồng đầu ra. Đây là checksum để đối chiếu dữ liệu; xác thực kết nối vẫn dùng ghép nối/token.
- `fileStart` phải khớp `attachmentId`, index, tên tệp, nhãn, MIME, dung lượng và SHA-256 trong manifest. Không tự đặt lại tên tệp trong extension. Mã truyền tệp không được dùng lại trong cùng tác vụ.
- Giới hạn metadata 2 MiB; tối đa 8 tệp với tổng 64 MiB; ACK metadata/nhận đủ và ACK tệp đều có thời hạn 15 giây. Không nhận được ACK đúng phase, ID và checksum thì dừng, không tự gửi lại.
- `chromeTask` chỉ lưu ID, requestHash, tab/document/URL, chặng, số tệp đã xác minh, tổng byte đã xác minh và lỗi nếu có. Không lưu prompt hay byte media trong Chrome storage.
- `chromeReceipts` giữ 100 ID đã nhận gần nhất, kể cả sau saved hoặc reset thủ công, để từ chối ID lặp. Backend tiếp tục chặn ID đã sử dụng bằng bản ghi trên đĩa; giới hạn 100 chỉ áp dụng bộ nhớ lịch sử ở extension.
- Sau khi service worker khởi động lại, metadata `packageReady` không cho phép chạy tiếp vì byte tệp trong RAM đã mất. Chặn hàng đợi để người dùng kiểm tra; không phục hồi bằng cách tự gửi lại prompt.
- Thông điệp đang xử lý của WebSocket cũ không được tiếp tục trên kết nối mới. Mất kết nối, sai dữ liệu hoặc lỗi lưu trạng thái trước ACK đều không được giao tác vụ cho tab.
- Backend và extension phải cập nhật cùng giao thức `6`; extension manifest là `0.6.0`. Bản cũ bị từ chối khi kiểm tra phiên bản. Đối chiếu phiên bản thực trong `chrome://extensions`.

## Ghép nối thông thường: chỉ nhập mã

1. Trong MacFlow → Settings → AI chrome → Kết nối thông thường, bấm Tạo mã ghép nối.
2. Dán toàn bộ mã vào ô duy nhất trong popup extension, bấm Ghép nối. Không nhập địa chỉ WebSocket, địa chỉ trang hoặc tên Chrome.
3. Quay về MacFlow, đối chiếu Extension ID và xác nhận thiết bị. Nút Mở MacFlow trong extension dùng đích đang ghép nối hoặc cấu hình đã lưu.

Mã có định dạng `MC1.<cổng backend>.<ký hiệu host trang>.<cổng trang>.<hạn dùng>.<bí mật>`. Chỉ cần sao chép/dán; các trường định tuyến bên trong do ứng dụng xử lý. Đây là mã chứa thông tin định tuyến, không phải mã số ngắn 6 chữ số.

- Cổng backend lấy từ socket HTTP thực tế; host/cổng trang lấy từ nguồn trang đã được xác thực. Tự hỗ trợ trường hợp frontend dev và backend khác cổng, không dò cổng hoặc mặc định luôn 3000.
- Extension tạo WebSocket tới `127.0.0.1` của cùng máy, chỉ đường dẫn `/api/aiChrome/socket`. Trang dùng `localhost` hoặc `127.0.0.1` theo mã. Mã không cho trỏ tới tên miền từ xa.
- Mã có bí mật ngẫu nhiên 96 bit và hạn tối đa 5 phút. Backend giữ hash của toàn bộ mã, nên đổi thông tin cổng/host/hạn trong mã sẽ không còn khớp. Tạo mã mới thay thế mã cũ; chấp thuận thiết bị tiêu thụ phiên ghép nối.
- Extension từ chối mã sai định dạng, cổng ngoài phạm vi hoặc mã hết hạn trước khi kết nối. Mã được kiểm tra lại tại backend. Không lưu mã ghép nối trong Chrome storage; sau khi ghép nối chỉ lưu đích kết nối và token thiết bị như trước.
- Tên thiết bị được đặt tự động là Chrome của tôi. Token ghép nối đã lưu có thể tiếp tục dùng sau khi cả hai phía cập nhật; nếu muốn thử luồng mới, hủy ghép nối rồi tạo mã MC1 mới.
- Bản này hỗ trợ trang HTTP local. HTTPS local, IPv6 và kết nối từ máy khác chưa nằm trong luồng mã MC1.

## Chrome trên máy khác/VM

Đã có relay độc lập, client host và extension client. MacFlow/extension kết nối ra relay qua WSS, dùng kênh AES-256-GCM được xác thực hai đầu; relay không đọc prompt/tệp/token thiết bị. Mã `MV1.` dùng room/ticket/khóa kênh; người dùng chỉ dán mã vào extension trên VM rồi xác nhận thiết bị ở máy MacFlow. Không dùng mã local `MC1.` cho máy khác.

Cấu hình `MACFLOW_CHROME_RELAY_URL` và `MACFLOW_CHROME_RELAY_KEY` trên máy MacFlow, cùng khóa vận hành ở relay; tải ZIP từ Settings sau khi cấu hình để ZIP tự thêm quyền đúng domain relay. Không có giá trị mặc định trỏ tới một relay công cộng. Thiếu cấu hình/kết nối thì không tạo mã VM.

Một MacFlow ghép một extension tại một thời điểm. Token/khóa kênh lưu riêng ở hai đầu; restart relay chỉ phục hồi đường truyền, không phát lại tác vụ. Hướng dẫn triển khai, mô tả kênh và giới hạn: [aiChromeVm.md](aiChromeVm.md).

## Truyền dữ liệu và hàng đợi

- Backend ↔ extension: WebSocket cùng cổng HTTP backend, truyền nhị phân theo khối 64 KiB; kiểm tra thứ tự, dung lượng, SHA-256 và ACK từng khối. Không công khai URL ảnh hoặc yêu cầu extension tự đọc đường dẫn local.
- Background ↔ content script: do Chrome messaging dùng JSON, mỗi khối 64 KiB được mã hóa base64 và xác nhận riêng. Không gói cả video vào một thông điệp JSON lớn. Content script tạo `File` và đưa vào ô tải tệp bằng `DataTransfer`.
- Tối đa 8 tệp tham chiếu, tổng 64 MiB/yêu cầu. Kết quả văn bản tối đa 1 MiB; kết quả media tối đa 64 MiB. Hàng đợi tối đa 20 yêu cầu, dữ liệu tham chiếu đang chờ ở backend tối đa 128 MiB.
- Định dạng media hiện nhận: PNG/JPEG/WebP; MP4/WebM; MP3/WAV/OGG/FLAC/M4A/audio WebM. Backend kiểm tra MIME và chữ ký tệp; chưa đo đầy đủ độ phân giải/thời lượng đầu ra hoặc xác minh mọi codec.
- Một tab Muse được chọn, một tác vụ tại một thời điểm. Sau khi backend lưu kết quả và trạng thái hoàn tất, gửi `saved`, chờ ít nhất 5 giây mới phát yêu cầu kế tiếp.
- Quét DOM và báo trạng thái tab 5 giây/lần. Phản hồi phải ổn định qua hai lần quét và website không còn báo đang sinh. Thời gian chờ phản hồi tối đa 15 phút; toàn bộ vòng đời mỗi tác vụ trong hàng đợi tối đa 20 phút; ACK khối tối đa 15 giây.
- Giới hạn 20 phút tính từ khi vào hàng đợi, nên tác vụ chờ quá lâu có thể hết hạn trước khi được gửi.
- Khi mất kết nối, timeout, hủy hoặc không chắc đã gửi hay đã lưu: dừng hàng đợi, giữ ID và trạng thái chưa xác định, không tự gửi lại. Kiểm tra tab trước khi chủ động tiếp tục. Tiếp tục chỉ mở hàng đợi cho yêu cầu mới.
- Settings hiển thị tối đa 20 tác vụ gần nhất trong phiên backend hiện tại: ID, loại đầu ra, chặng gần nhất, chặng bị dừng và lỗi nếu có, số đã gửi/đã nhận/đã lưu/đã gửi chưa nhận. File metadata bền vững phục vụ đối chiếu sau khi restart; UI chưa tải lịch sử từ đĩa.

## Kết nối và phạm vi

- Extension Manifest V3, ghép nối cùng máy; mã 5 phút và bước xác nhận extension ID ở MacFlow. Token chỉ lưu ở trusted extension storage, backend giữ hash.
- Chỉ chế độ độc lập; các API điều khiển MacFlow vẫn giới hạn loopback localhost/127.0.0.1. VM dùng kênh relay riêng, không mở endpoint local cho Internet.
- Popup chọn thủ công các đầu ra đã kiểm tra trên tab Muse. Đây là xác nhận của người dùng, không phải backend tự chứng minh website có quota hoặc tạo được tất cả các loại nội dung.
- Model chung: `aiChrome / museChrome`, tên “Muse • Chrome”. Các loại đầu ra được công bố theo lựa chọn trong popup. ID cũ `museImage` vẫn được nhận cho tác vụ ảnh đã lưu cấu hình; nên chọn lại model mới.
- Preset kích thước, tỷ lệ, thời lượng, độ phân giải trong catalog chỉ để mô tả yêu cầu bằng chữ, không phải giới hạn hoặc cam kết khả năng của Muse.
- Adapter giao diện hiện chỉ có Muse; không tự hỗ trợ mọi website AI. Mục báo cáo các AI đã hiển thị và Agent SDK riêng vẫn chưa phát triển. Model Chrome không hiện trong bộ chọn model của Agent riêng.

## Những tệp chính

| Vị trí | Vai trò |
| --- | --- |
| `apps/server/src/utils/aiChrome/prompt.ts` | Tổng hợp prompt duy nhất cho Chrome |
| `apps/server/src/utils/aiChrome/request.ts` | Gói JSON và snapshot tệp chung; kiểm tra ID, cấu hình, MIME, dung lượng và checksum |
| `packages/chromeExtension/requestReceiver.js` | Kiểm tra payload/manifest, requestHash và đối chiếu metadata từng tệp |
| `packages/chromeExtension/pairing.js` | Đọc mã MC1/MV1 và kiểm tra định tuyến |
| `apps/server/src/chromeRelay/index.ts`, `utils/aiChrome/relay.ts` | Relay độc lập và client host mã hóa VM |
| `packages/chromeExtension/relayConnection.js`, `mediaDownload.js` | Client VM mã hóa và tải tệp HTTPS qua background |
| `apps/server/src/utils/aiChrome/jobs.ts` | Hàng đợi chung, ID, checkpoint, ACK, khoảng nghỉ 5 giây |
| `apps/server/src/utils/aiChrome/protocol.ts`, `files.ts` | Loại đầu ra, giao thức và kiểm tra/truyền tệp |
| `apps/server/src/utils/aiChrome/text.ts` | Đưa context/tham chiếu của node văn bản vào luồng chung, đọc phản hồi |
| `apps/server/src/utils/aiChrome/index.ts` | Ghép nối, WebSocket, catalog model Chrome |
| `apps/server/src/routes/ai/generate.ts` | Rẽ nhánh văn bản khi provider là aiChrome |
| `apps/server/src/utils/media/generation.ts`, `tasks.ts` | Rẽ nhánh media, gắn tác vụ và xác nhận sau khi lưu |
| `packages/nodeScaffold/src/nodeAi.ts` | Cho phép protocol Chrome trong model của node; giữ API gọi hiện có |
| `packages/chromeExtension/museTransport.js` | Nhận yêu cầu và truyền các khối tham chiếu/kết quả |
| `packages/chromeExtension/museBridge.js` | Tạo File, thao tác ô nhập/upload, bấm gửi, theo dõi và lấy kết quả |
| `packages/chromeExtension/background.js`, `popup.*`, `manifest.json`, `mediaTransfer.js` | Kết nối, chọn tab/đầu ra và tiện ích truyền dữ liệu |
| `apps/web/src/components/settings/panels/aiChrome/index.vue`, `lib/aiChrome.ts` | Cài đặt, ghép nối, chặng tác vụ và thống kê |

## Giới hạn cần kiểm tra trên máy thật

Selector Muse, cách xác nhận upload đã hoàn tất, dấu RESPONSE do AI trả và URL tải media cần kiểm tra với tab đăng nhập thật. Chuyển cuộc hội thoại thủ công hoặc tải lại tab phải chọn và xác nhận lại; việc Muse tự tạo URL hội thoại chỉ được nhận khi có bubble chứa đủ ID trong cùng document. Không thao tác tay vào cùng cuộc hội thoại khi đang có tác vụ.

Nếu website không thực hiện đặc tả bằng chữ, không trả đúng loại tệp, chỉ cung cấp luồng video không có tệp tải được, hoặc chặn đọc URL bằng phiên/CORS, tác vụ có thể dừng. Chưa có chuyển đổi định dạng, đổi codec, chuyển poster thành video hoặc tự gửi lại để che lỗi.

Bản này chưa được kiểm thử thực tế. Không dùng các mô tả trong tài liệu này làm bằng chứng PASS.
