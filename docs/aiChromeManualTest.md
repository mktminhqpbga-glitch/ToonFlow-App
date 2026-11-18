# Tự kiểm thử AI chrome 0.6.0

> **Lưu ý (17-11-2026):** Tài liệu này mô tả quy trình của bản 0.6.0,
> hiện đã cũ. MacFlow trong `/macflow-2` dùng extension **0.8.0**
> và giao thức WebSocket **v7**, có menu **Dịch vụ → Tab #N** ở node;
> không dùng lại các bước chọn model/tab của bản 0.6.0 một cách máy móc.
> Xem [tài liệu AI Chrome v7](aiChromeMultiTab.md) và báo cáo kiểm toán
> mới nhất trước khi nghiệm thu. Chỉ thử nghiệm AI thực sau khi xác nhận
> việc phát sinh hạn mức/chi phí là chấp nhận được.

**Chưa kiểm thử.** Codex chỉ sửa mã nguồn trong lần này, không chạy build, typecheck, kiểm tra cú pháp, trình duyệt hoặc gọi AI. Các bước dưới đây để bạn thực hiện trên máy chạy MacFlow và Chrome. Bản 0.6.0 bổ sung VM relay, upload, xác nhận gửi, đọc/tải kết quả và lỗi Muse; tất cả cần bạn nghiệm thu trên môi trường thật. Hướng dẫn relay: [aiChromeVm.md](aiChromeVm.md).

## 1. Khởi động đúng bản mới

Dùng Bun theo `package.json` của dự án (hiện là 1.4.3). Trong terminal, vào thư mục `MacFlow` của bản mã nguồn vừa sửa:

```bash
bun install --frozen-lockfile
bun run build:server
bun run start:server
```

Nếu lệnh nào báo lỗi, dừng tại đó và gửi lại nội dung lỗi. Chưa chuyển sang các bước sau. Không cần xóa dữ liệu hoặc sửa hai thư mục `References`.

Mở `http://127.0.0.1:3000/#/home` trên Chrome. Nếu backend in ra cổng khác, dùng cổng được in. Muốn chạy chế độ phát triển sau khi đã build các plugin, dừng server vừa chạy rồi dùng `bun run dev`, mở địa chỉ Vite được in ra (thường là `http://127.0.0.1:5173/#/home`). Không chạy hai backend cùng cổng.

Tạo một project và canvas riêng để thử. Trong bản server/Linux, chọn project ở bên trong thư mục `MacFlow/data/workspaces/`. Dùng thư mục mới, ví dụ `chromeManual`, để dễ tìm các kết quả. Nếu đã cấu hình `TOONFLOW_DATA_DIR`, thư mục `data` nằm ở đường dẫn đó.

## 2. Cài extension và ghép nối

1. Vào Settings → **AI chrome** → **Tải extension**. Lưu ZIP rồi giải nén vào một thư mục cố định.
2. Mở `chrome://extensions`, bật Developer mode, chọn **Load unpacked**, trỏ tới thư mục chứa `manifest.json`. Phiên bản phải là **0.6.0** và thư mục phải có `requestReceiver.js`, `pairing.js`, `relayConnection.js`, `mediaDownload.js`. Nếu đã cài bản cũ, thay các tệp bằng bản mới rồi bấm Reload extension. Cũng tải lại tab Muse.
3. Trong Settings → AI chrome → Kết nối thông thường, bấm **Tạo mã ghép nối**. Mã mới bắt đầu bằng `MC1.`; sao chép toàn bộ mã.
4. Trong popup extension chỉ có một ô ghép nối: dán mã rồi bấm **Ghép nối**. Không nhập WebSocket, URL trang hoặc tên Chrome. Quay về MacFlow bấm **Xác nhận thiết bị**, đối chiếu Extension ID với `chrome://extensions`.
5. Nếu đang có ghép nối từ bản cũ mà bị từ chối, hủy ghép nối trong MacFlow rồi làm lại. Nếu báo khác phiên bản, cập nhật cả backend và extension.
6. Đăng nhập Muse và mở cuộc hội thoại định dùng. Trước tiên nên tự gửi một câu ngắn để xác nhận AI trả được văn bản. Chờ xong, để ô nhập trống.
7. Trong popup: **Đọc danh sách tab** → chọn đúng tab → tick **Văn bản** → **Chọn tab Muse**. Chỉ tick ảnh/video/âm thanh khi đã tự xác nhận tab đó tạo được loại đầu ra này. Đây không phải chức năng tự phát hiện khả năng của AI.
8. Quay lại Settings, bấm **Làm mới trạng thái**. Phải thấy đã kết nối, đúng đầu ra đã chọn. Trong node mở lại danh sách model và chọn **AI chrome → Muse • Chrome**. Nếu danh sách chưa đổi, chờ khoảng 30 giây rồi mở lại.

Mã tự mang cổng backend và cổng trang, kể cả khi dùng Vite 5173. Có thể thử lại luồng ghép nối với cổng backend khác để xác nhận không phụ thuộc 3000. Thử mã hết hạn hoặc sửa một ký tự: không được ghép nối; tạo mã mới thì mã trước không còn dùng được. Các trường hợp này chưa được Codex chạy.

Luồng hiện tại chỉ dành cho cùng máy, chế độ độc lập và trang HTTP localhost/127.0.0.1. Mã local MC1 vẫn chỉ dùng cùng máy. Để thử VM, cấu hình relay và ghép bằng mã MV1 theo aiChromeVm.md. Nếu Chrome bị quản trị và không cho Load unpacked, cần dùng môi trường cho phép cài extension; chưa thể thử luồng này trong trình duyệt đang bị chặn.

## 2b. Ghép nối VM Muse AI

Làm theo `aiChromeVm.md`: chạy relay, cấu hình URL/khóa trên MacFlow, tải ZIP mới, cài trong VM, chọn Kết nối VM và dán mã MV1. Xác nhận đúng Extension ID. Thử mất relay rồi kết nối lại: không tự nhập lại prompt đang dở. Khởi động lại backend/extension chỉ khôi phục kênh; nếu còn tác vụ chưa rõ kết quả phải kiểm tra trước khi mở lại hàng đợi. Các bước này chưa được Codex chạy.

## 3. Thử Text Node trước

Khi đối chiếu gói, backend lưu `request` và `requestHash` trong `data/aiChromeTasks/<UUID>.json`. Extension lưu chặng trong `chromeTask` của trusted storage: `metadataReceived` → `receivingReferences` (nếu có tệp) → `packageReady` → `dispatchingToPage`. Những chặng có thể đi qua nhanh nên popup 5 giây/lần không nhất thiết hiển thị hết. Không có tệp cũng phải được ACK ready trước lệnh run. Không gửi toàn bộ storage vì có token kết nối.

1. Thêm node văn bản, chọn node để hiện ô prompt và bộ chọn model ở phía dưới.
2. Chọn **Muse • Chrome**, nhập:

   ```text
   Chỉ trả lời đúng nội dung KIEM_TRA_CHROME_01, không thêm giải thích.
   ```

3. Bấm nút gửi của node, theo dõi tab Muse. Mong đợi extension tự nhập **một** prompt, có REQUEST_BEGIN/END cùng UUID và lệnh yêu cầu RESPONSE_BEGIN/END cùng UUID, rồi bấm gửi.
4. Mong đợi phản hồi Muse nằm giữa hai dấu RESPONSE, sau đó nội dung về node và không còn các dấu bọc. Không sửa prompt hoặc tự bấm Send trong Muse khi đang chạy.
5. Trong Settings, ID chuyển qua các chặng nhận yêu cầu → tham chiếu sẵn sàng → gửi → chờ → nhận → lưu. Bộ đếm đã gửi, nhận về và đã lưu tăng tương ứng.
6. Lưu canvas, mở lại project để đối chiếu nội dung node. Văn bản của node nằm tại `assets/<nodeId>/content.md`; bản nhận của transport nằm tại `MacFlow/data/aiChromeTasks/<UUID>.response.json`.

AI có thể không tuân theo dấu RESPONSE; khi đó tác vụ chưa được coi là đã nhận thành công. Chụp lại phản hồi thực tế để chỉnh bộ nhận, không bấm gửi lặp lại trong lúc chưa biết trạng thái.

## 4. Thử tham chiếu và đặc tả bằng chữ

**Văn bản có ảnh:** thêm ảnh vào project, nối/chọn làm tham chiếu cho Text Node. Yêu cầu mô tả màu hoặc nội dung dễ đối chiếu. Mong đợi ảnh xuất hiện ở vùng đính kèm của Muse, prompt chỉ có nhãn tham chiếu, không có chuỗi `data:image/...;base64,...` dài. Đối chiếu nội dung câu trả lời với ảnh thật.

**Tạo ảnh:** trong popup bổ sung đầu ra Ảnh rồi chọn lại tab. Ở node tạo ảnh chọn Muse • Chrome, chọn tỷ lệ và kích thước, nhập prompt dễ nhận biết. Trên Muse phải thấy các đặc tả này trong prompt văn bản. Kết quả phải là tệp ảnh mới về đúng node, lưu trong `assets/generated/` của project. Nếu có nhiều ảnh, bản hiện tại chỉ lấy một đầu ra phù hợp.

**Tạo video:** chỉ thử nếu Muse thực sự hỗ trợ. Bổ sung đầu ra Video; trong node chọn thời lượng, tỷ lệ, độ phân giải và tùy chọn âm thanh. Các giá trị đã chọn phải xuất hiện trong prompt gửi, ví dụ `duration`, `ratio`, `resolution`, `generateAudio`. Kết quả về phải là tệp MP4/WebM phát được, không phải ảnh poster. Những lựa chọn này là yêu cầu bằng chữ; hãy tự đối chiếu với video thực tế.

**Khung đầu/cuối và tham chiếu hỗn hợp:** thêm các tệp dễ phân biệt. Nếu prompt có `{{ref 1}}`, `{{ref 2}}`, kiểm tra `referenceBindings` trong prompt gửi ánh xạ đúng tệp theo số và vai trò; không gán nhầm ảnh thành video hoặc nhầm khung đầu với khung cuối. Tối đa 8 tệp, tổng 64 MiB/yêu cầu.

**Âm thanh:** chỉ bật khi tab thực sự hỗ trợ; dùng node âm thanh, chọn các tùy chọn có sẵn. Mong đợi đặc tả xuất hiện bằng chữ và nhận tệp âm thanh phát được. Bản hiện tại nhận các định dạng nêu trong `aiChrome.md`; chưa tự chuyển đổi codec/định dạng khi website trả khác.

## 5. Thử hàng đợi và mất kết nối

**Thứ tự và khoảng nghỉ:** gửi lần lượt từ hai node khác nhau, ví dụ Text Node A rồi Text Node B. Chỉ A được nhập trước; B chờ. Sau khi A có trạng thái đã lưu, chờ thêm ít nhất 5 giây mới nhập prompt B. Kết quả phải về đúng node theo ID. Có thể thử tiếp một cặp khác loại đầu ra để xác nhận cùng hàng đợi, nếu Muse hỗ trợ cả hai.

**Mất kết nối có chủ đích:** trong project thử, khi một yêu cầu đã gửi và đang chờ, bấm **Tạm ngắt** ở popup. Mong đợi MacFlow dừng hàng đợi, giữ ID/chặng và trạng thái chưa xác định, không tự nhập lại prompt. Kiểm tra tab Muse và kết quả thật. Kết nối lại, rồi trong MacFlow bấm **Tôi đã kiểm tra tab — tiếp tục hàng đợi**. Thao tác này không gửi lại tác vụ cũ; muốn thử lại phải chủ động tạo yêu cầu mới.

**Đổi tab/cuộc hội thoại:** sau khi xong một lượt, tải lại Muse hoặc chuyển cuộc hội thoại. Mong đợi phải chọn và xác nhận lại tab trong popup trước lần chạy tiếp. Extension không được tự gán phản hồi của cuộc hội thoại khác cho node cũ.

Các thao tác thử có thể tiêu hao quota Muse. Chỉ tạo số yêu cầu cần thiết để kiểm tra.

## 6. Đối chiếu provider API

Nếu có provider API đã cấu hình, chọn lại provider đó trong cùng loại node và gửi một yêu cầu ngắn. Mong đợi đi bằng adapter API cũ, không nhập vào tab Muse, không có REQUEST_BEGIN/RESPONSE_BEGIN do nhánh Chrome thêm và không chuyển các tham số API thành prompt mới. Bộ đếm Chrome không tăng do yêu cầu API.

Agent SDK riêng và mục báo cáo AI chưa phát triển. Kết nối VM đã có mã nhưng cần relay WSS thực tế trước khi thử. Vòng công cụ do một node cung cấp có thể thử riêng sau khi các bước văn bản cơ bản đã đạt; AI phải trả đúng JSON và chỉ yêu cầu công cụ được cấp.

## Khi gặp lỗi, gửi lại thông tin gì

- Loại node, model đã chọn, phiên bản extension, bước đang thử.
- Task ID trong Settings hoặc popup và chặng cuối cùng trước lỗi.
- Nội dung lỗi ở node/Settings. Nếu lỗi build, gửi phần đầu lỗi và tên tệp/dòng.
- Prompt thực tế và vùng trả lời trên Muse để đối chiếu REQUEST/RESPONSE và tham chiếu. Che nội dung riêng tư.
- Nếu extension lỗi: vào `chrome://extensions` → MacFlow AI chrome → **Errors** hoặc mở console **service worker** và lấy thông báo lỗi liên quan. Không gửi token, mã ghép nối hay toàn bộ Chrome storage.
- Media đã về node chưa, phát/mở được chưa, có tệp thật trong workspace chưa.

Trạng thái trước khi bạn thử:

| Mục | Kết quả |
| --- | --- |
| Cài dependency và build | CHƯA CHẠY |
| Cài extension/ghép nối | CHƯA THỬ |
| VM relay/ghép nối và kết nối lại | CHƯA THỬ |
| Text Node và dấu ID | CHƯA THỬ |
| Tham chiếu và đặc tả | CHƯA THỬ |
| Ảnh/video/audio | CHƯA THỬ |
| Hàng đợi 5 giây | CHƯA THỬ |
| Mất kết nối, không gửi lại | CHƯA THỬ |
| Provider API | CHƯA THỬ |
