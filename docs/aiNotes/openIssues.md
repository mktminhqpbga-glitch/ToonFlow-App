# ⚠️ KHU VỰC 2 — VẤN ĐỀ CÒN TỒN TẠI

**Tác dụng với người dùng:** biết lỗi hoặc điểm chưa hoàn chỉnh, ai phát hiện, ai đã thử sửa và còn vướng gì.

**Tác dụng với AI tiếp nhận:** trước và sau **mỗi lần sửa** phải kiểm tra khu vực này, không tự xóa vấn đề khi chưa có bằng chứng xác minh. Nếu một vấn đề đã qua nhiều người sửa, giữ lại lịch sử thử sửa.

[← Về bảng điều hướng](./overview.md) · [Việc đã làm](./completedWork.md) · [Lưu ý quan trọng](./importantNotes.md)

> **Lưu ý:** Các mục khởi tạo dưới đây do ChatGPT (GPT-6) **phát hiện qua đọc repository ngày 2026-11-08**, không phải do ChatGPT sửa gây ra. Chưa chạy app để tái hiện lỗi chức năng.

### ISSUE-0001 — GitHub Actions đang ở thư mục không được GitHub nhận làm workflow

- **Mức độ:** Cao (đóng gói/phát hành).
- **Trạng thái:** Mở — chưa sửa.
- **Phát hiện:** 2026-11-08 · **Người ghi nhận:** ChatGPT (GPT-6).
- **Người chịu trách nhiệm sửa:** Chưa chỉ định.
- **Người sửa lần cuối:** Chưa có; chưa thực hiện sửa.
- **Bằng chứng:** có `.github_temp/workflows/debug.yml`, `release.yml`, `signPath.yml`; không thấy `.github/workflows/` trong cây nguồn tại thời điểm kiểm tra.
- **Tác động:** các file ở `.github_temp/workflows/` không tự được GitHub Actions đăng ký.
- **Đã thử sửa:** Chưa.
- **Bước tiếp theo:** đối chiếu nội dung workflow, đường dẫn, quyền Actions, secrets và các nhánh phát hành; chỉ chuyển sang `.github/workflows/` khi đã kiểm tra tác động; chạy thử một workflow, gắn link run.
- **Điều kiện đóng:** workflow xuất hiện và chạy thành công trên repo này với bằng chứng run/artefact.
- **Lịch sử sửa:** Chưa có.

### ISSUE-0002 — Chưa xác nhận có bản phát hành tải được từ chính fork

- **Mức độ:** Trung bình (phát hành).
- **Trạng thái:** Mở — chờ kiểm tra/triển khai.
- **Phát hiện:** 2026-11-08 · **Người ghi nhận:** ChatGPT (GPT-6).
- **Người chịu trách nhiệm sửa:** Chưa chỉ định.
- **Người sửa lần cuối:** Chưa có.
- **Bằng chứng:** danh sách releases của fork trả về rỗng khi kiểm tra; mã có script desktop packaging nhưng **script không đồng nghĩa đã có tệp DMG/EXE/APK tải được**.
- **Tác động:** không có đường dẫn đã xác minh cho bản cài đặt fork.
- **Đã thử sửa:** Chưa.
- **Bước tiếp theo:** kiểm tra Actions, xây dựng đúng hệ điều hành/kiến trúc; kiểm thử tải và cài đặt; thêm URL bản phát hành thực tế.
- **Điều kiện đóng:** có Release/artefact truy cập được, kèm thông tin kiến trúc và kiểm thử.
- **Lịch sử sửa:** Chưa có.

### ISSUE-0003 — Liên kết phát hành và tài liệu còn dẫn tới upstream HBAI-Ltd

- **Mức độ:** Trung bình (nhận diện và cập nhật sản phẩm).
- **Trạng thái:** Mở — cần quyết định có cá nhân hóa bản fork hay không.
- **Phát hiện:** 2026-11-08 · **Người ghi nhận:** ChatGPT (GPT-6).
- **Người chịu trách nhiệm sửa:** Chưa chỉ định.
- **Người sửa lần cuối:** Chưa có.
- **Bằng chứng:** `README.md`, `package.json`, `electrobun.config.ts` vẫn chứa liên kết / mặc định tham chiếu `HBAI-Ltd/Toonflow-app`.
- **Tác động:** nếu phát hành như app riêng, người sử dụng có thể được dẫn tới upstream cho download/update/support.
- **Đã thử sửa:** Chưa.
- **Bước tiếp theo:** thống nhất tên sản phẩm, URL release và cơ chế update; không sửa hoặc xóa thông tin giấy phép/bản quyền upstream trái quy định.
- **Điều kiện đóng:** đường dẫn và nguồn cập nhật đúng ý định, được xác minh.
- **Lịch sử sửa:** Chưa có.

### ISSUE-0004 — Chưa xác minh chức năng qua chạy thử trên ứng dụng

- **Loại:** Việc kiểm chứng còn thiếu, **không phải bằng chứng rằng mọi nút bị lỗi**.
- **Mức độ:** Trung bình.
- **Trạng thái:** Mở — chờ kiểm thử.
- **Phát hiện:** 2026-11-08 · **Người ghi nhận:** ChatGPT (GPT-6).
- **Người kiểm thử phụ trách:** Chưa chỉ định.
- **Người sửa lần cuối:** Chưa có.
- **Bằng chứng:** lần phân tích chỉ đọc nguồn, cấu hình và tài liệu; chưa chạy ứng dụng thật, chưa gọi mô hình AI.
- **Bước tiếp theo:** có bộ cài/chạy thử rồi kiểm tra mở project, tạo node, kết nối, AI generate, save/load, download và toàn bộ nút chức năng; tạo issue riêng cho từng lỗi tái hiện.
- **Điều kiện đóng:** báo cáo kiểm thử với phiên bản, môi trường và kết quả xác minh có thể đối chiếu.
- **Lịch sử sửa:** Chưa có.

### ISSUE-0005 — Các chuỗi tiếng Trung chưa có ID hoặc chưa duyệt, nghiêm cấm tự dịch

- **Ngày phát hiện:** 2026-11-08 · **Người phát hiện:** ChatGPT (GPT-6).
- **Mức độ:** Cao với phạm vi Việt hóa toàn bộ · **Trạng thái:** Mở; chờ bảng bổ sung của người điều phối.
- **Bằng chứng:** mục `06 - CHƯA DUYỆT` của tài liệu V1 khóa `apps/web/src/components/settings/panels/mediaModel/providerPrompt.ts`, `packages/skills/v118workflow/SKILL.md` và `references/*`, `packages/skills/canvas/SKILL.md`, `packages/tools/*`, các node/plugin chưa có ID.
- **Ví dụ ghi nhận ngoài bảng, giữ nguyên câu gốc:** `apps/web/src/components/settings/panels/general/ui.vue` còn `Toonflow 每一个灵感，都值得被看见` và `这是当前颜色、字体与圆角的实际效果。`; `packages/nodes/imageGenerationNode/src/index.vue` còn các đoạn ghép `参考 ` / ` 张图` và dấu phân cách tiếng Trung chưa có ID riêng. Đây chỉ là ví dụ có thể xác minh, **không phải danh sách tất cả chuỗi còn lại**.
- **Đã thử sửa:** chỉ triển khai 127 dòng được duyệt theo mã `VI-xxxx`, tuyệt đối không tự cấp bản dịch cho những câu khác. [Commit mã](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/cbeb30013f5a07da42c64b74eebd3d748e6d4538).
- **Người sửa lần cuối:** ChatGPT (GPT-6), riêng mục chưa duyệt **không sửa**.
- **Điều kiện đóng:** nhận bản dịch được duyệt nguyên văn cho các chuỗi còn thiếu, đối chiếu với code mới rồi triển khai có kiểm tra; không tự sửa prompt dài.

### ISSUE-0006 — Chưa typecheck/build hoặc nghiệm thu runtime/AI của bản Việt hóa

- **Ngày phát hiện:** 2026-11-08 · **Người ghi nhận và sửa mã lần cuối:** ChatGPT (GPT-6).
- **Mức độ:** Cao trước khi merge · **Trạng thái:** Mở.
- **Đã kiểm tra:** Excel↔Markdown 127 ID/hash; đối chiếu GitHub từng chuỗi; tách bản VI/ZH, kiểm tra nội dung và token template, không có file locale khác thay đổi; nhãn Node và description có đường theo dõi locale trong mã.
- **Chưa kiểm tra:** dependencies Bun, TypeScript/Vue typecheck, build; chuyển locale `vi` ↔ `zh-CN` ↔ `en` trong GUI; hành vi gửi system prompt thực, Agent tools, Đạo diễn 3D, text/image/video; dark mode, đầu ra và tải lại project. Chưa có môi trường Bun/macOS/AI để chạy.
- **Nguy cơ cần kiểm chứng:** mô tả công cụ thay theo locale tại runtime, nhãn/handle Node theo dõi host DOM `lang`; nhãn do người dùng đặt lưu trong `node.data.label` cần được bảo toàn, không tự dịch dữ liệu người dùng.
- **Bằng chứng:** [commit mã](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/cbeb30013f5a07da42c64b74eebd3d748e6d4538), [bảng kiểm](./vietnameseAuditV1.md).
- **Điều kiện đóng:** ghi log typecheck/build thành công và test hồi quy thực tế các chức năng AI với chuyển ngôn ngữ; không đóng bằng kiểm tra tĩnh.

## Mẫu thêm vấn đề mới hoặc ghi lại lần sửa

### ISSUE-xxxx — Tên vấn đề

- **Mức độ:** Thấp / Trung bình / Cao / Nghiêm trọng
- **Loại:** Lỗi xác minh / Vấn đề cấu hình / Cần kiểm chứng / Quyết định đang chờ
- **Trạng thái:** Mở / Đang sửa / Chờ xác minh / Đã xác minh và đóng
- **Phát hiện:** [ngày] · **Người ghi nhận:** [tên/người AI]
- **Người chịu trách nhiệm sửa:** [tên hoặc chưa chỉ định]
- **Người sửa lần cuối:** [tên người/AI/model; “Chưa có” nếu chưa ai sửa]
- **Cách tái hiện hoặc bằng chứng:** [bước + expected/actual, file, log]
- **Nguyên nhân đã xác nhận / giả thuyết:** [phân biệt rõ]
- **Ảnh hưởng:** [điều gì bị hỏng / giới hạn]
- **Lịch sử sửa:** [ngày — ai sửa — commit — đã thay đổi gì — kết quả kiểm tra; thêm dòng, không xóa dòng cũ]
- **Còn tồn tại sau lần sửa cuối:** [mô tả hoặc “chờ kiểm thử”]
- **Bước tiếp theo:** [việc cụ thể và người chịu trách nhiệm]
- **Điều kiện đóng:** [bài kiểm chứng chứng minh đã hết]
