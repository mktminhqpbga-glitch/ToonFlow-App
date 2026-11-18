# Kiểm toán gửi/nhận AI trong MacFlow — 17/11/2026

**Phạm vi:** mã nguồn tại `/macflow-2`, node văn bản/ảnh/video/âm thanh, director3d/frameAnalysis, backend AI Chrome protocol v7, extension 0.8.2, media provider Muse2API Python 0.4.0/Go. Đánh giá source và kiểm thử mock; **KHÔNG phải xác nhận end-to-end trên tài khoản Muse/ChatGPT/Gemini thật**.

**Nguyên tắc:** không tự gửi prompt hoặc AI trả phí; không mở/đóng Chrome, không thay Profile 22, cookie/proxy/API key hoặc dừng tiến trình Muse2API đang chạy; không thay đổi ID node/provider/receipt; không tự retry tác vụ có trạng thái không rõ.

## 1. Luồng dữ liệu đã đối chiếu

| Tuyến | Gửi | Nhận | Kết quả kiểm toán |
| --- | --- | --- | --- |
| Node media → Muse2API | Node tạo snapshot prompt/tham chiếu → media backend → provider `muse2Api` → HTTP `127.0.0.1:18610/v1` | Task ID → polling 5 giây → media bytes → kiểm tra MIME → lưu workspace → output node | Đã kiểm tra adapter bằng mock Python v0.4.0 (chuẩn và alias tùy biến) / Go; live Muse2API chưa sẵn sàng |
| Node AI Chrome → backend | Node ghi model + `chromeTabId` → `chromeRequest` và tệp theo thứ tự → websocket v7 | `packageAck`, `stage`, `resultStart`, chunk/checksum, lưu kết quả → node | Bắt buộc tab ID, document token và URL phải khớp; không tự chọn tab |
| Backend → extension → tab Muse | `prepare → fileStart/chunk/fileEnd → packageEnd → run` trên đúng tab | Muse DOM bridge chờ receipt, nhận text hoặc tệp media, chuyển chunk kết quả ngược về backend | Có xác nhận file và chống gửi lặp; chưa thử trên tab Muse thật |
| Backend → tab ChatGPT/Gemini | Cùng pinned tab; upload tệp theo thứ tự, kiểm tra tên preview, sau đó mới nhấn Send | **Chỉ có adapter nhận văn bản**; chưa xác thực nhận media nhị phân | Không quảng cáo tạo ảnh/video/audio qua ChatGPT/Gemini khi chưa có adapter |
| Claude/Grok/Perplexity | Có ID dự phòng trong protocol/node | **Chưa có adapter thật/host permissions** | Không hiện kết quả giả, chưa công bố khả năng |

Trong hệ thống hiện tại, hàng đợi Chrome **tuần tự toàn cục** (không xử lý nhiều tab đồng thời), tối đa 20 việc và 128 MiB tệp đang chờ; backend có khoảng nghỉ 5 giây sau khi lưu. Điều này giữ an toàn gửi/nhận, nhưng chưa đáp ứng mong muốn xử lý nhiều tab đồng thời nếu người dùng cần tính năng đó trong tương lai.

## 2. Lỗi hoặc rủi ro đã sửa trong mã nguồn

| Vấn đề | Sửa tại | Trạng thái |
| --- | --- | --- |
| Request không chọn tab có thể đi vào một tab AI duy nhất đang online | `apps/server/src/utils/aiChrome/jobs.ts` | Bắt buộc `chromeTabId`; từ chối thay vì auto-route |
| Status backend có thể báo connected khi WebSocket thực tế không còn OPEN | `apps/server/src/utils/aiChrome/index.ts` | Dùng `online()` tính cả socket/heartbeat |
| Nhiều ô upload Muse phù hợp có thể chọn nhầm ô | `packages/chromeExtension/museBridge.js` | Từ chối khi không duy nhất, xác thực FileList của tệp trước sự kiện DOM |
| Ô upload ChatGPT/Gemini có thể không nhận đúng FileList | `packages/chromeExtension/siteBridge.js` | Xác nhận name/size/type/count trước sự kiện DOM, vẫn chờ thumbnail hiện filename |
| Mọi tab Muse chưa chọn từng được quảng cáo mặc định hỗ trợ cả ảnh/video/âm thanh | `packages/chromeExtension/museTransport.js` | Muse tab thông thường chỉ công bố text; chỉ dùng loại đầu ra media đã chọn thủ công cho đúng document token/URL/tab, không tái sử dụng quyền chọn sau reload |
| Tab AI chọn trong node có thể đổi giữa chừng do UI thay đổi khi tác vụ bất đồng bộ chạy nhiều bước | `textNode`, `frameAnalysisNode`, `director3dNode` | Snapshot tab ID tại đầu tác vụ và giữ cố định |
| Chuyển model bằng setConfig có thể giữ tab ID cũ không đúng service | `imageGenerationNode`, `videoGenerationNode`, `audioGenerationNode` | Xóa tab ID cũ khi đổi model |
| Canvas cũ lưu định danh `museImage` | `nodeScaffold/nodeAi.ts`, `nodeShared/chromeTabs.ts` | Chuẩn hóa về `museChrome`, không đổi cấu trúc dữ liệu node |
| Menu tab thiếu trạng thái/task rõ ràng | `nodeShared/components/chromeModelSelect.vue` và Settings AI Chrome | Chấm trạng thái + task ID, refresh khi mở |
| Muse2API tạo target nhưng mở kết nối CDP tới target thất bại | `services/muse2api-v040/.../driver.py` | Đóng chỉ target vừa tạo, không chạm Muse anchor của người dùng |
| Pool Muse2API có thể mắc ở 4/5 phiên khi startup mở một tab thất bại | Cùng driver | Retry có giới hạn để khôi phục pool, không warm-up prompt |
| Request Muse2API có thể tự mở tab mới khi pool còn dưới 5 | Cùng driver | Từ chối request, dành việc bổ sung pool cho prewarm riêng |
| Tài liệu/nhãn cũ chỉ nói tới Go vip0014/extension 0.6.0 | Tài liệu Muse2API, AI Chrome và nhãn provider | Phân biệt đúng Python/Go, protocol v7 |

**Thay đổi sau kiểm toán, 17/11/2026 — extension 0.8.2:** theo yêu cầu
đơn giản hóa của người dùng, đã **bỏ hẳn** checkbox chọn loại đầu ra
và nút chọn/ghim tab Muse trong popup. Thay cho cơ chế thủ công ghi ở
hàng trên (lịch sử 0.8.1), Muse bridge tự báo các *luồng media mà adapter
thực sự triển khai* khi phát hiện ô soạn thảo. MacFlow chọn đúng tab tại
node, không chọn trong popup. Adapter vận chuyển media không bảo đảm
tài khoản/website thực tế tạo được file; lỗi, checksum, MIME và receipt
vẫn được kiểm tra trước khi ghi node.

## 3. Lỗi vận hành **chưa thể xử lý** trong phiên này

1. **Muse2API Python v0.4.0 chưa sẵn sàng:** `GET /readyz` đang `ready=false`, `driver.ok=false`, `tabs=0`, dù có một account hợp lệ. Không chạy thử tạo ảnh/video để tránh gửi prompt khi driver hỏng.
2. **Không chứng thực được Chrome Profile 22 có proxy qua CDP 19210:** tiến trình Chrome cũ khởi động `--user-data-dir=.../Chrome/Profile 22` mà thiếu `--profile-directory=Profile 22`; CDP không có Muse anchor. Không dùng/kill/restart profile này.
3. **Chưa có chính source Muse2API gốc:** bản đang chạy khác upstream Python 0.4.0 vì có endpoint `/v1/images/tasks`. Yêu cầu sao chép source gốc `ur_bwjya4qffz2n` vẫn `OPEN`; thư mục `services/muse2api` không tồn tại. Không thay dịch vụ bằng clone upstream.
4. **Extension đã ghép nối nhưng đang offline:** API trạng thái MacFlow qua Vite `127.0.0.1:5182` trả `connected=false`, `targets=[]`, đã có thiết bị ghép nối, `jobs.waiting=0`. Không thể xác thực tab thật, upload và nhận kết quả live khi chưa kết nối lại extension. Không tự mở Chrome.
5. **Mã provider live chưa nhận sửa đổi mới:** `data/providers/muse2Api.ts` (bản đã cài, kích thước 15.970 byte) khác `packages/providers/src/media/muse2Api.ts` (source đã sửa). Backend đang chạy từ 06:30; khi **restart backend MacFlow an toàn** sẽ đồng bộ provider built-in theo hash sửa đổi. Không tự thay file provider đang cài hoặc làm gián đoạn trạng thái người dùng trong phiên audit.
6. **Chưa có thử nghiệm E2E:** không xác minh trực tiếp Muse tạo ảnh/video thật, ChatGPT/Gemini upload ảnh trên giao diện mới, hành vi chi tiết Chrome proxy, hoặc kết quả được vẽ vào node sau reload.

## 4. Kiểm thử không sử dụng hạn mức AI

- **Python:** `services/muse2api-v040/.venv/bin/python -m pytest -q --maxfail=1` → **186 PASS**; Ruff trên source/test sửa → PASS.
- **AI Chrome backend + Muse2API provider:** `bun test apps/server/tests/aiChromeMultiTab.test.ts apps/server/tests/muse2ApiPythonCompatibility.test.ts` → **14 PASS**. Chỉ dùng mock, không gửi prompt.
- **TypeScript:** Bun server/web typecheck và provider tsc → PASS.
- **Node Vue:** vue-tsc các package `nodeShared`, `nodeScaffold`, `textNode`, `frameAnalysisNode`, `director3dNode`, `imageGenerationNode`, `videoGenerationNode`, `audioGenerationNode` → PASS theo lần kiểm thử cuối của từng package.
- **Extension / launcher:** `node --check packages/chromeExtension/*.js` và `bash -n scripts/muse2api-profile22.sh` → PASS.
- Không có git ở thư mục gốc `/macflow-2`; không cam kết đã commit/push các sửa đổi.

## 5. Điều kiện nghiệm thu còn lại

Hoàn thành sao chép **source-only** Muse2API gốc trong Chat On Steroids (không sao chép database/cookie/keys); đối chiếu API tùy biến rồi chuyển patch có kiểm thử. Xác minh **bằng mắt** Chrome thật Profile 22 đang đăng nhập Muse qua proxy, cổng CDP, `--profile-directory`, và `targetId` tab Muse anchor, không mở Chrome khác. Lập phương án handoff an toàn riêng cho PID Muse2API vì shutdown cũ có thể tắt Chrome con; bảo toàn accounts/keys/tasks/requests database/media. Sau khi app backend và extension được cập nhật có kiểm soát, chạy test read-only /healthz, /readyz, danh sách năm tab và một vòng chạy thật **chỉ khi người dùng cho phép dùng hạn mức AI**.

**Kết luận:** source code đã có thêm các chốt gửi/nhận quan trọng và bộ kiểm thử mock qua; hệ thống **chưa thể kết luận đang hoạt động end-to-end** vì cả Muse2API lẫn AI Chrome extension đều chưa sẵn sàng tại thời điểm kiểm tra.

## 6. Bổ sung cùng ngày — nguyên nhân Profile 22 và cầu nối extension

Trong lần kiểm tra tiếp theo, Muse2API Python PID 87721 (cổng 18610)
còn tạo Chrome con PID 87722 (CDP 19210) với `--user-data-dir` **sai**
trỏ thẳng vào `.../Google/Chrome/Profile 22`, không có flag
`--profile-directory=Profile 22`. CDP chỉ có trang MacFlow/omnibox,
không có tab Muse; `/readyz` lúc đó là `ready=false, tabs=0`.
Đây là chứng cứ từ chẩn đoán **read-only**; PID có thể thay đổi về sau.

Theo <https://developer.chrome.com/blog/remote-debugging-port/>, Chrome
136+ không cho remote debugging bằng root dữ liệu Chrome chuẩn. Vì vậy,
cài CDP trên đúng profile không phải hướng sửa an toàn; tránh mọi cách
vòng qua bằng Chrome khác hoặc profile riêng.

**Đã thêm source staging (chưa deploy):** guard trong
`services/muse2api-v040/.../chromium.py` chặn khởi chạy Chrome khi
user-data-dir nằm trong cây profile thật, launcher `diagnose` từ chối
owner sai. Driver mới `chrome_extension.py` nói chuyện với
`apps/server/src/routes/aiChrome/muse2apiBridge.ts` bằng một token
localhost riêng, đẩy trực tiếp sang `runTask` và nhận kết quả byte/
checksum theo task UUID, không auto-resend. Extension điều khiển **năm
tab Muse do chính nó tạo trong profile đang cài**, lưu ID và reuse.
Đây là phần source/kiểm thử, **chưa được chạy trên Chrome thật**.

Các chốt nghiệm thu chưa đóng: bản Python **tùy biến gốc** chưa ở
`services/muse2api` (step `ur_bwjya4qffz2n` OPEN); không xác minh
được extension thật nằm trong Profile 22; backend live có thể chưa nạp
route mới; chưa reload extension mới; chưa xác nhận proxy/cookie;
không được dừng PID cũ khi nó sở hữu Chrome con. Yêu cầu bảo toàn API
tùy biến `/v1/images/tasks` trước khi đổi driver.

**Kiểm thử mới không tiêu hạn mức AI:** Python driver mock 6/6 PASS;
toàn bộ Python 195/195 PASS, Ruff PASS; Bun backend/protocol/adapter/
quản lý năm tab gồm 24/24 PASS, typecheck server PASS, JavaScript
extension và launcher shell syntax PASS.
Tất cả kết quả này chỉ chứng minh định dạng, nguyên tắc fail-closed
và giả lập offline; không chứng minh 5 tab/cookie/proxy/AI media live.

**Đối chiếu live sau kiểm thử:** `GET /healthz` vẫn báo Python v0.4.0;
`/readyz` báo `ready=false`, `driver.tabs=0`; thống kê tài khoản
tại thời điểm lần đọc mới nhất là `total=0, available=0` (lần trước
từng trả 1/1). Chưa xác minh nguyên nhân khác biệt, không thay đổi hoặc
khôi phục account data theo suy đoán. Tiến trình 87721/87722 vẫn chạy,
không bị dừng hoặc thay.

## 7. Kiểm tra proxy/IP Mỹ trước mọi tác vụ Muse2API

**Yêu cầu bổ sung:** phải chọn Chrome Profile 22 trong Settings và
xác nhận extension thật đang nằm trong profile đó, sau đó kiểm tra
proxy đã cấu hình **và** IP công khai thuộc Hoa Kỳ. Nếu thiếu proxy,
quốc gia không phải US, hoặc bất cứ kết quả kiểm tra nào không chắc chắn,
Muse2API **không được mở tab hoặc gửi tác vụ**.

Mã source staging bổ sung route `/api/aiChrome/profile` (lựa chọn do
người dùng xác nhận), thông điệp WS `verifyMuseNetwork` /
`museNetworkVerified`, bridge `/verify` và preflight trước `/ensure`,
`/run`, `prepare` và `run` (gửi thật). Chốt Python kiểm tra
`profile.selectedProfile='Profile 22'`, `proxyMode`, `countryCode='US'`
và `verified` trước khi báo ready. Lựa chọn bị reset khi Chrome
disconnect/thay extension; không mặc định tin nhãn profile.

Extension dùng quyền Chrome `proxy` **để đọc cấu hình**, không ghi;
chấp nhận cấu hình HTTPS proxy cố định `http` (CONNECT), `https`,
`socks5` hoặc PAC tĩnh bắt buộc không có DIRECT/fallback;
chế độ `system`/auto_detect/PAC động không đủ chứng cứ và sẽ bị chặn.
truy vấn HTTPS `ipapi.co` và `ipwho.is` lấy IP và định vị egress.
Hai nhà cung cấp có thể sai lệch/quá hạn mức và proxy có PAC/route
riêng theo hostname; lúc đó **fail closed**, không tự bypass.
Đây là source và kiểm thử offline; **chưa xác minh proxy/IP thật của
Profile 22**, cũng chưa áp dụng vào Muse2API PID hiện tại.
