# Kết quả kiểm thử theo lệnh HD-01 đến HD-05

**Ngày ghi:** 2026-11-09 (UTC+7) · **Người thực hiện:** ChatGPT (GPT-6)
**Nhánh:** `feat/independentToonFlowFullIntegration` · **PR #4:** Draft.
**Quy tắc thực hiện:** chỉ hoàn tất và kiểm thử một HD trước khi bắt đầu sửa code HD kế tiếp. Phân biệt kiểm tra source, CI, UI chạy thật và AI/provider thật.

| Hạng mục | Code/source | Typecheck/build | Giao diện chạy thật | Provider thực | Kết luận |
| --- | --- | --- | --- | --- | --- |
| HD-01 Model thiếu cấu hình bị khóa | Đã thêm metadata `availability` cho media model cài đặt và model Chrome sẵn sàng; Image/Video selector khóa `needsConfiguration`, guard ở submit. Không tự suy đoán provider có API key là đã kết nối mạng | Chờ CI commit mới | NOT TESTED | NOT TESTED | PARTIAL |
| HD-02 Thumbnail + tên và kéo thả đúng caret | Chưa sửa trong giai đoạn HD-01. Component có chip và avatar, kéo thả caret chưa được nghiệm thu | NOT TESTED | NOT TESTED | NOT TESTED | PENDING |
| HD-03 Tạo node bằng preset prompt | Chưa sửa trong giai đoạn HD-01 | NOT TESTED | NOT TESTED | NOT TESTED | PENDING |
| HD-04 Studio nhân vật chỉ một bộ ảnh cố định | Chưa sửa trong giai đoạn HD-01 | NOT TESTED | NOT TESTED | NOT TESTED | PENDING |
| HD-05 Batch tiếp tục cảnh độc lập, đánh dấu cảnh lỗi | Chưa sửa trong giai đoạn HD-01; UNKNOWN không tự retry | NOT TESTED | NOT TESTED | NOT TESTED | PENDING |

## HD-01 — Kiểm tra chính xác

1. Backend `apps/server/src/utils/media/generation.ts`: model có API key bắt buộc nhưng không được cấu hình → `needsConfiguration`. Có cấu hình → `configured` (không phải `ready`); Chrome Bridge chỉ trả model `ready` khi capability của tab được xác nhận.
2. `packages/nodeScaffold/src/nodeAi.ts`: khai báo metadata, không thêm bí mật vào response.
3. `packages/nodes/imageGenerationNode/src/index.vue` và `videoGenerationNode/src/index.vue`: model thiếu cấu hình được hiển thị nhưng khóa không chọn, mặc định chọn model có cấu hình, chặn submit thiếu cấu hình; lựa chọn cũ vẫn giữ trong dự án.
4. **Giới hạn:** API hiện mới liệt kê provider đã cài và Chrome Bridge khi khả dụng, không phải catalog đầy đủ của provider chưa cài; không được tuyên bố HD-01 hoàn thành 100%. Xác thực tài khoản, quota và mạng của model `configured` không được suy ra từ API key.
5. **Kiểm thử UI cần thực hiện:** A thiếu key → disabled và nút tạo không gửi; B key có nhưng mạng lỗi → báo lỗi, không tạo output giả; C Chrome mất tab → không gửi; D đổi model/locale, save/reload không mất selection; E provider cũ vẫn tạo được khi cấu hình hợp lệ.

## Cập nhật nghiệm thu HD-02 → HD-05 (2026-11-09, GPT-6)

| HD | Code thay đổi | Static/typecheck/build | Unit/integration thực thi độc lập | UI runtime | AI/Chrome/FFmpeg E2E | Kết luận |
| --- | --- | --- | --- | --- | --- | --- |
| HD-02 | Kéo ảnh/video từ output Canvas hoặc Asset Library vào prompt; tên nguồn, liên kết node/handle, caret-drop | **PASS** run 42549399300 | Chưa có test drag/undo/persistence tự động riêng | NOT TESTED | BLOCKED | PARTIAL |
| HD-03 | Bảng preset hai cột; sửa prompt trước khi tạo node image/video thực | **PASS** run 42549924812 | Chưa có test tạo node/lưu và reload riêng | NOT TESTED | BLOCKED | PARTIAL |
| HD-04 | Studio nhân vật workspace, UUID, một bộ ảnh, upload/edit/search/import Canvas | **PASS** run 42550662370; run 42551746997 cũng PASS sau code HD-05 | Chưa có test filesystem/concurrent edit riêng | NOT TESTED | BLOCKED | PARTIAL |
| HD-05 | Durable batch Task ID, 5 routes, 2 trang batch, fail riêng theo cảnh, UNKNOWN không auto-retry; FFprobe + FFmpeg concat có guard | **PASS** run 42551746997 trước chức năng ghép; run 42552231169 PASS sau ghép | Chưa có bài test giả lập crash/reload hay scene state transitions | NOT TESTED | BLOCKED | PARTIAL |

**Chú ý:** mỗi CI run chỉ chứng minh các bước thực sự có trong workflow (typecheck và build). Không có hành vi giao diện click/drag/drop hoặc tác vụ AI thật được thử bằng Chrome đã đăng nhập. Bản build mới hơn có thêm lưu thiết bị/tab lúc dispatch; cần đối chiếu run CI tương ứng trước khi công nhận PASS cho commit cuối.

**Các checkpoint còn lại:** chạy runtime UI và phục hồi dữ liệu trên Mac Intel macOS 13; thêm unit test độc lập cho queue; đóng gói/khởi chạy FFmpeg đúng phiên bản; xác thực video thực và kết quả ghép; tối ưu nhiều thiết bị/tab thay vì serial toàn server; thiết kế chuyển kết quả batch lên Canvas; hoàn thiện Studio AI và Việt hóa.

## Log bằng chứng

- Mã backend: [c051788](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/c051788523eb2e5973676bc798870b5e2061b2d3).
- Kiểu model: [fec3e8e](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/fec3e8e95b785cdeb47cacd36e3e84c9298ba682).
- Image: [4253903](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/4253903b1ca60710bae2d4edbb3fa6284e791b76), [6f174cc](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/6f174cc7ce38df74043b3f2a96de15685d097f74).
- Video: [5fab792](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/5fab792b84458e82a8c90cd2a657ac6407349bd7), [333261f](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/333261f324ad0dc7a32217155f147b73548efd0f).

Không đánh dấu PASS E2E khi chỉ typecheck/build. Không sửa hay xóa dữ liệu người dùng.


## HD-06 — Bằng chứng hồi quy tự động (2026-11-09, ChatGPT GPT-6)

**Nhánh:** `feat/independentToonFlowFullIntegration` · **PR #4:** Draft, không merge.

| Phạm vi | Kiểm thử đã thực thi (Bun/FFmpeg trên GitHub Actions) | Runtime UI / AI thật |
| --- | --- | --- |
| HD-02 | Kiểm tra Node ID+handle tham chiếu ảnh/video đã kết nối, nguồn Canvas mới, asset path, nhiều tham chiếu và caret offset giữa câu | **NOT TESTED**: thả chuột, Undo/Redo, Preview, payload provider, save/reload |
| HD-03 | Catalog preset storyboard, 9 góc máy, 3 góc nhìn; khóa khi thiếu node ảnh/video thật, prompt sửa không làm thay đổi bản mẫu | **NOT TESTED**: mở popup, tạo node, lưu/reload, provider |
| HD-04 | Đọc/ghi JSON nhân vật qua `@toonflow/file` trên thư mục temp thật; giữ ID; xóa hồ sơ không xóa file; từ chối JSON/đường dẫn sai | **NOT TESTED**: upload/trình duyệt/concurrent edit/Character AI |
| HD-05 | Trạng thái FAILED tiếp tục độc lập, orphan running→UNKNOWN, pause/cancel/restart, không dispatch trùng, COMPLETED chỉ khi tất cả cảnh thành công, Chrome offline không tiêu thụ queued; FFmpeg tạo và ghép clip MP4 thật, FFprobe kiểm tra duration, codec/ratio và từ chối PNG poster | **NOT TESTED/BLOCKED**: chạy HTTP queue + Chrome/Render thật, FFmpeg trong app Mac |
| Batch → Canvas | Code import `batchResults` qua workspace, tạo node media thật và flush save; có nút nhập từng cảnh hoặc MP4 ghép | **NOT TESTED**: click, lưu/mở lại Canvas bằng UI |

- **CI xác thực:** [run #42556447168](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42556447168) và [run #42556832767](https://github.com/mktminhqpbga-glitch/ToonFlow-App/actions/runs/42556832767): **PASS** typecheck, regression Bun, FFmpeg fixture, build Web/Server/Nodes/Tools/MCP. Run #42556832767 đã gồm test Chrome offline guard; đây không phải provider E2E.
- **Hướng dẫn Mac và cách tái chạy:** [hd06MacAcceptance.md](./hd06MacAcceptance.md). Lệnh test đã được tích hợp trong `.github/workflows/integrationCheck.yml`.
- **Còn mở:** browser/Web runtime, Chrome đăng nhập thực, Render, multi-device concurrency, FFmpeg ghép video provider trong app và Mac Intel Ventura; không tự tuyên bố E2E PASS.
