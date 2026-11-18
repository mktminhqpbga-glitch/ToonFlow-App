# Muse2API Python 0.4.0 trong MacFlow — Chrome Profile 22

**Trạng thái 2026-11-17: đang chuẩn bị tích hợp, CHƯA chuyển dịch vụ.** Đây là luồng Python
`www222fff/muse2api` v0.4.0, **không** phải dịch vụ Go `vip0014/muse2api`
trong tài liệu lịch sử `docs/muse2Api.md`.

## Cập nhật — khắc phục Profile 22 bằng Chrome extension (hướng ưu tiên)

**Chỉ sửa staging, CHƯA áp dụng vào tiến trình live.** Google Chrome 136 trở
lên không còn tôn trọng `--remote-debugging-port` với **thư mục dữ liệu Chrome
mặc định**; do đó phương án CDP attach với `--user-data-dir=~/Library/Application
Support/Google/Chrome --profile-directory=Profile 22` bên dưới không khả thi
cho Chrome thông thường hiện đang chạy. Xem thông báo bảo mật chính thức
<https://developer.chrome.com/blog/remote-debugging-port/> (17/03/2025).
Không được "sửa" bằng cách trỏ `--user-data-dir` vào thư mục con
`Profile 22` hoặc tạo bản Chrome độc lập.

Mã staging mới có đường truyền:

```text
Muse2API Python 0.4.0 (API /v1 vẫn giữ nguyên)
  └─ drivers/chrome_extension.py (không mở Chrome / CDP)
      └─ HTTP localhost, shared secret riêng, UUID duy nhất
          └─ MacFlow /api/aiChrome/muse2api/bridge
              └─ runTask trực tiếp (KHÔNG gọi lại provider Muse2API)
                  └─ WS v7 → extension đang ở Chrome Profile 22
                      └─ 5 tab Muse do extension tạo và quản lý
```

- Chỉ sau **xác minh trực tiếp extension nằm trong Chrome Profile 22**, yêu
  cầu `/ensure` mới được gửi để extension mở **5 tab Muse mới** dưới dạng
  tab nền trong **cùng profile của extension**, rồi lưu ID và tái sử dụng.
  Mất tab có thể bổ sung slot khi có lệnh quản lý rõ ràng; không mở tab mỗi
  tác vụ, không dùng `chrome.windows.create`, không warm prompt. Extension
  **không có API xác minh tên Chrome profile**, vì vậy bước xác nhận bên
  ngoài không thể thay thế bằng phỏng đoán.
- **Bước bắt buộc mới trước Muse2API:** trong **Cài đặt → AI Chrome**, chọn
  `Profile 22`, xác nhận extension thực sự đang cài và kết nối trong profile
  đó, rồi chọn **Chọn & kiểm tra IP Mỹ**. Backend không tự gán Profile 22
  theo tên thư mục, không tự chọn profile khác, xóa lựa chọn khi extension
  ngắt/thay thiết bị hoặc server khởi động lại. Nếu chưa chọn, mọi yêu cầu
  Muse2API qua bridge bị từ chối **trước khi mở tab hay gửi prompt**.
- Extension chỉ **đọc** cấu hình proxy hiệu lực qua
  `chrome.proxy.settings.get({incognito:false})`. Không đọc password,
  không đổi proxy. Chỉ trạng thái proxy xác thực được mới đủ điều kiện;
  `direct`, `system` chưa chứng minh có proxy, tự phát hiện/không hỗ trợ
  hoặc lỗi đọc đều **chặn**. Chế độ PAC/rule phức tạp có thể không chứng
  minh được Muse thật sẽ dùng proxy và phải từ chối an toàn. Quyền
  `proxy` mới trong manifest có thể yêu cầu người dùng **Reload/cấp
  quyền lại** sau khi cập nhật extension.
- Extension kiểm tra IP thoát ra Internet của **chính Chrome đang ghép
  nối** bằng truy vấn HTTPS tới `ipapi.co/json/` và `ipwho.is/`,
  không kiểm tra IP của Python/Bun. Cả hai nguồn phải xác nhận quốc gia
  `US` và cùng IP; khác quốc gia, lỗi/timeout, IP không khớp, không có
  proxy hoặc dữ liệu không rõ đều chặn. Các dịch vụ kiểm tra nhìn thấy
  IP công khai của browser; không gửi cookie Muse. Đây là kiểm tra
  egress có giới hạn, không phải chứng minh tuyệt đối đường mạng của
  **mọi yêu cầu** tới `muse.ai` nếu proxy có luật riêng theo domain.
- `/api/aiChrome/profile` (được xác thực như Cài đặt MacFlow) chỉ lưu
  lựa chọn profile trong **bộ nhớ backend** cho phiên kết nối hiện tại;
  không tự thay Chrome profile. Bridge có `POST /verify` riêng để
  kiểm tra mà **không** mở Muse/tab; `/ensure` kiểm tra trước khi tạo
  tab; `/run` kiểm tra lại cho **mỗi tác vụ**, trong hàng đợi trước
  `prepare` và ngay trước `run/Send`, để proxy/IP thay đổi giữa chừng
  không được dùng kết quả kiểm tra cũ. Nếu lỗi ở ngưỡng đã nhận gói thì
  giữ trạng thái không rõ và **không tự gửi lại**.
- Backend chỉ gửi vào **5 tab có ID do extension quản lý và có probe Muse
  thật**, pin `tabId + documentToken + URL`. Từ chối nếu chưa đủ 5, nếu
  thiếu adapter media hoặc có kết nối không rõ. Hàng đợi Chrome hiện **tuần
  tự toàn cục**; 5 tab chưa có nghĩa 5 tác vụ chạy song song.
- Python gửi **cùng một gói** prompt và tối đa 8 tham chiếu theo thứ tự.
  Video chỉ nhận một ảnh đầu, image `n=1`; không âm thầm bỏ ảnh hoặc tự
  tạo nhiều lần. Đầu ra được kiểm tra loại, SHA-256, byte-length, lưu
  `*.muse2api-result.{bin,json}` theo task UUID trước khi extension nhận
  ACK `saved`. Khi HTTP thất lạc, chỉ truy hồi kết quả theo UUID tại
  `GET .../result/:id`, **không tự POST lại**.
- Bridge yêu cầu **hai biến secret cùng giá trị**:
  `MACFLOW_MUSE2API_BRIDGE_TOKEN` cho backend Bun và
  `MUSE2API_CHROME_BRIDGE_TOKEN` cho Python, tối thiểu 32 ký tự, chỉ giữ
  trong môi trường chạy riêng của người dùng. Không dùng Muse API key,
  không ghi secret vào repo/chat; chặn request không đến từ localhost
  hoặc có Origin trình duyệt. Nếu chưa cấu hình, đường truyền **tắt**.
- Python cần `MUSE2API_DRIVER=chrome_extension`,
  `MUSE2API_CHROME_PROFILE22_CONFIRMED=true` sau khi người dùng đã xác
  nhận đúng profile; script dùng `MUSE2API_TRANSPORT=extension` mặc định.
  Dùng `bash scripts/muse2api-profile22.sh diagnose-extension` để xem
  read-only proxy, quốc gia IP, số tab do extension quản lý sau bước
  chọn profile (có phát sinh truy vấn tới dịch vụ IP qua Chrome nhưng
  **không gửi AI**). `check`
  đòi **source tùy biến đang chạy** có class driver mới và dùng data cũ;
  `start` còn từ chối khi cổng 18610 bận và cần xác nhận proxy.
- Driver extension `requires_account=false`: xác thực Muse theo **cookie
  đăng nhập của tab Chrome**, không dùng cookie/tài khoản trong Python để
  thao tác trang web. Không xóa/ghi đè bản ghi account Python hiện có;
  `/readyz` có thể hoạt động với `accounts.total=0` **nếu và chỉ nếu**
  extension và đủ năm tab Muse thực sự sẵn sàng. Giữ nguyên data cũ khi
  chuyển đổi; kiểm tra nguyên nhân biến động số account riêng.
- Trước khi live: sao chép và đối chiếu nguồn tùy biến (bước
  `ur_bwjya4qffz2n` còn OPEN), merge từng patch thay vì thay cả source
  bằng clone; nạp backend/extension mới có kiểm soát. Không kill/restart
  Chrome hiện có, đặc biệt tiến trình con cũ do Python sở hữu.
- Giới hạn staging: stream text hiện nhận một kết quả đầy đủ rồi yield,
  không phải streaming token trực tiếp; việc renew cookie và quota Muse
  không được extension giả lập. Các route tùy biến gốc chưa thể khẳng
  định tương thích trước khi nhận đúng source đang chạy.

Phần **CDP attach-only** bên dưới được giữ để ghi lại nghiên cứu và
kiểm thử bảo vệ profile, **không phải phương án triển khai ưu tiên**.

## Dịch vụ đang chạy, phải giữ nguyên cho tới khi xác minh xong

- Python `-m muse2api`, cổng `127.0.0.1:18610`, phiên bản `0.4.0`.
- `/healthz` HTTP 200, nhưng `/readyz` báo `ready=false`, `driver.ok=false`, `tabs=0`.
- Chrome CDP `127.0.0.1:19210` hiện thuộc tiến trình có
  `--user-data-dir=.../Google/Chrome/Profile 22` **nhưng không có**
  `--profile-directory=Profile 22`. Điều này không chứng minh đang dùng
  Chrome Profile 22 đúng như yêu cầu. CDP hiện chưa nhìn thấy tab `muse.ai`.
- Mã đang chạy có `POST /v1/images/tasks`; upstream tag 0.4.0 nguyên bản
  không có endpoint đó. **Không được xem clone là mã gốc giống hệt**.
- Không dừng PID Python hoặc Chrome khi chưa có phương án chuyển an toàn:
  shutdown bình thường của service cũ có thể terminate tiến trình Chrome con.

## Cấu trúc trong dự án

- `services/muse2api-v040/`: clone upstream tag 0.4.0, đã chỉnh cơ chế
  attach-only và pool 5 tab cho **staging + kiểm thử**. Có `.venv` riêng.
  Upstream mặc định `browser_attach_only=false` để không phá bộ kiểm thử
  truyền thống; **chỉ** chạy bản tích hợp thông qua launcher của MacFlow,
  bắt buộc export `MUSE2API_BROWSER_ATTACH_ONLY=true` và xác minh đúng
  Chrome/Profile 22 trước startup.
- `services/muse2api/`: **đích dành cho bản nguồn THỰC TẾ đang chạy**.
  Chưa có vì thư mục ngoài dự án chưa được cấp quyền; yêu cầu copy source đã
  ghi nhận trong Chat On Steroids, **không chứa khóa/cookie/database**.
- `scripts/muse2api-profile22.sh`: launcher fail-closed. Nó **chỉ dùng**
  `services/muse2api/` (bản nguồn thật); không tự dùng clone thay thế.
  Chế độ `check` chỉ kiểm tra, chế độ `start` chỉ chạy khi cổng 18610 trống,
  Chrome đúng profile, dữ liệu cũ đã được chỉ định, và người dùng đã xác thực
  proxy. Không tạo tiến trình Chrome.
- `packages/providers/src/media/muse2Api.ts`: giữ định danh provider
  `muse2Api` và Base URL/API Key, phân biệt giao thức Python/Go qua
  `/healthz` và `/openapi.json`. Với Python 0.4.0 upstream, image task dùng
  `POST /v1/images/generations` + `async:true` và `image: [...]`,
  polling `/v1/images/generations/{id}`. Với Python 0.4.0 **tùy biến** có
  `POST /v1/images/tasks`, giữ nguyên alias và polling `/v1/images/tasks/{id}`,
  thêm `image` vào payload để không làm rơi ảnh tham chiếu và vẫn giữ `images`
  cho tương thích ngược. Chặn tự gửi lại khi thiếu task ID.

## Các điều kiện trước khi chạy dịch vụ từ MacFlow

1. Người dùng hoàn tất bước sao chép **chỉ source** từ Muse2API đang chạy
   vào `services/muse2api/`. So sánh khác biệt với upstream trước khi áp dụng
   các sửa đổi staging, đặc biệt các thay đổi không có trong upstream như
   `/v1/images/tasks`. Không ghi đè toàn bộ source gốc bằng clone.
2. Chứng thực bằng mắt đúng **Chrome Profile 22 đang dùng proxy**, trang Muse
   đang đăng nhập trong profile đó; xác minh cổng CDP thuộc đúng Chrome,
   `--profile-directory=Profile 22`, và có tab `https://muse.ai/` tại
   chính browser context đó. Chọn một `targetId` cụ thể của tab Muse đã
   xác nhận trong `http://127.0.0.1:<CDP_PORT>/json/list` (không tự chọn
   tab Muse ở profile khác). Nếu không chứng thực được, hệ thống phải dừng.
   Không bật cổng debug mới, không mở Chrome khác, không đổi profile.
3. Chỉ định đúng **thư mục data cũ** (accounts, API keys, database, media,
   tasks/receipt); cấu hình `.env` gốc qua biến `MUSE2API_CONFIG_FILE`
   nếu có; tuyệt đối không sao chép bí mật vào tài liệu/chat.
4. Kiểm tra các tác vụ đang chạy đã kết thúc rồi mới lập phương án handoff
   tiến trình. Không dùng `kill`/restart tự động vì tiến trình Python
   cũ sở hữu Chrome con. Không khởi động trùng trên cổng 18610.
5. Chạy kiểm thử mock, xác minh read-only `/readyz` và danh sách 5 tab.
   Không phát prompt AI trả phí để thử.

## Biến môi trường cho launcher (chỉ đặt ở terminal của người dùng)

```bash
export MUSE2API_DATA_DIR="/duong-dan-tuyet-doi/den/data-cu"
export MUSE2API_CONFIG_FILE="/duong-dan-den/.env-goc"
export MUSE2API_CDP_PORT="19210" # CHỈ khi đúng cổng của Profile 22 đã xác minh
export MUSE2API_BROWSER_EXPECTED_USER_DATA_DIR="/duong-dan/root-cua-Chrome"
export MUSE2API_BROWSER_EXPECTED_PROFILE_DIRECTORY="Profile 22"
export MUSE2API_BROWSER_EXPECTED_MUSE_TARGET_ID="ID-cua-tab-Muse-da-xac-minh"
bash scripts/muse2api-profile22.sh check
```

Launcher không nhận giả định `.../Google/Chrome/Profile 22` làm
`user-data-dir` chuẩn nếu không có flag profile-directory tương ứng.
Nếu không rõ profile/proxy, hãy dừng tại `check`. Sau khi kiểm chứng **mọi**
điều kiện, chủ sở hữu có thể đặt `MACFLOW_PROFILE22_PROXY_CONFIRMED=1`
và gọi `start`; riêng việc giải phóng cổng 18610 cần handoff an toàn,
không tự thực hiện trong script.

## Giới hạn / kết quả chưa chứng thực

- 5 slot mở `/thread/new` (không warm-up và không gửi prompt), sử dụng lại
  tối đa 5 tab cho mỗi request. Không bật/incognito context riêng,
  không ghi đè cookie trong Chrome gắn vào.
- Chưa xác minh live 5 slot vì Chrome CDP hiện không đúng ràng buộc profile
  và không có Muse anchor. Proxy có thể do extension quản lý nên **không thể
  xác minh chỉ bằng command-line flags**.
- Python 0.4.0 upstream chấp nhận tối đa 4 ảnh cho image, nhưng video chỉ có
  trường first frame `image`; adapter từ chối các ảnh video còn lại thay vì
  âm thầm bỏ qua. Nếu source gốc có hỗ trợ riêng, cần kiểm tra lại trước
  khi đổi hành vi.
- `Idempotency-Key` của Python 0.4.0 upstream chưa được chứng minh; không
  tự POST lại khi client không nhận task ID. Tác vụ Go cũ vẫn giữ receipt và
  đường đi endpoint cũ. Alias Python tùy biến có thể có idempotency riêng
  nhưng chưa được chứng minh khi chưa đối chiếu mã nguồn thực tế; vẫn từ chối
  gửi lại nếu mất ID.
- Chưa thay đổi `/macflow-2` thành macOS `.app`, chưa restart Muse2API gốc,
  chưa kiểm thử sinh ảnh/video thật.
