# HD-08 — Nghiệm thu tiếng Việt và prompt ẩn trên Mac Intel Ventura

**Ngày lập:** 2026-11-09 · **Trạng thái:** mã nguồn và kiểm thử tĩnh đang triển khai; **chưa có nghiệm thu giao diện Web/Chrome thật trên Mac của chủ dự án**.

## 1. Cập nhật nhánh tích hợp

Trong Terminal, tại thư mục repository:

```bash
git fetch origin
git switch feat/independentToonFlowFullIntegration
git pull --ff-only origin feat/independentToonFlowFullIntegration
bun install --frozen-lockfile
bun packages/i18n/src/auditVietnamese.ts --strict
bun packages/i18n/src/auditVietnameseResidual.ts
bun test packages/i18n/src/vietnameseCoverage.test.ts packages/i18n/src/hiddenPromptCoverage.test.ts packages/nodes/audioGenerationNode/tests/vietnameseUi.test.ts packages/nodes/frameAnalysisNode/tests/aiPromptVi.test.ts packages/nodes/frameAnalysisNode/tests/vietnameseRuntime.test.ts packages/nodes/imageNode/tests/hiddenPromptsVi.test.ts apps/server/src/utils/media/mediaErrorVi.test.ts apps/web/tests/languageDefaults.test.ts apps/web/tests/providerTestPanelVi.test.ts
bun run --cwd apps/web typecheck
bun run --cwd apps/server typecheck
bun run build:nodes
bun run --cwd apps/web build
```

Không xóa dữ liệu workspace, không xóa cài đặt trình duyệt; sao lưu workspace trước khi kiểm lưu/mở lại.

## 2. Mở Web + Server, chuyển locale

Mở Terminal A: `bun run dev:server:local`; Terminal B: `bun run dev:web:local`. Dùng URL mà Vite thực sự thông báo.

1. Vào Cài đặt → Ngôn ngữ, chọn **Tiếng Việt**. Kiểm tra `document.documentElement.lang` là `vi` trong DevTools.
2. Kiểm tra ngôn ngữ các node Text, Image, Video, Audio, Frame Analysis; các popup **Lịch sử media**, **Chi phí**, **Chi tiết lỗi**, hộp chọn model; tooltip, placeholder, nút và menu Canvas.
3. Mở **Panorama Preview**: kiểm tra nhãn góc nhìn, so sánh ảnh gốc, hướng dẫn bàn phím, lỗi tải ảnh, các lựa chọn chụp 1/4/12 ảnh và câu mô tả ảnh chụp.
4. Mở **Thử model media**: thử lỗi thiếu prompt, sai tham số JSON và tham chiếu ảnh/video; kiểm tra lỗi và nhật ký đã che thông tin nhạy cảm hiển thị tiếng Việt. Khi yêu cầu AI sửa provider, phần *hướng dẫn hệ thống* phải là tiếng Việt, nhật ký người dùng giữ nguyên.
5. Chọn **English**, kiểm tra UI không còn ép tiếng Việt ở các chỗ có hỗ trợ locale. Chọn lại Tiếng Việt; lưu cài đặt và reload. Nếu user trước đây chọn en/zh một cách chủ động, không được tự ghi đè quyền lựa chọn.
6. Thử lưu project, reload, đổi lại node; xác nhận `modelId`, `providerId`, `dataType`, `characterId`, đường dẫn ảnh, nội dung prompt **không đổi**.

## 3. Kiểm thử prompt ẩn thực tế

- Với locale vi, kiểm tra payload AI Agent/Director 3D, frame-analysis, panorama, inpaint, lighting và provider repair prompt. Chỉ dịch các chỉ dẫn điều khiển AI; giữ nguyên `{{ref 1}}`, tên tool, JSON key/schema, tọa độ, enum, giá trị cấu hình và **nội dung người dùng**.
- Chỉ kiểm tra payload trên workspace thử nghiệm/tài khoản bạn kiểm soát; **không gửi token, owner key, cookie, request body nhạy cảm hoặc prompt cá nhân** lên PR công khai.
- Không thay đổi ngôn ngữ đầu ra do người dùng yêu cầu trong prompt của họ. Chỉ mặc định chỉ dẫn hệ thống bằng tiếng Việt khi UI đang ở `vi`.
- Nếu thiếu Chrome/Render đăng nhập, đánh dấu AI E2E **BLOCKED**, tiếp tục kiểm thử locale/unit/UI trên máy.

## 4. Hiểu đúng số liệu kiểm toán

- `auditVietnamese.ts --strict` đếm **chuỗi UI được bộ phân tích AST nhận diện** và số khóa thiếu trong `vi.json`. Bằng 0 không có nghĩa mọi prompt ẩn, dữ liệu runtime hoặc nội dung plugin đều đã dịch.
- `auditVietnameseResidual.ts` đếm **ứng viên literal tiếng Trung** còn trong mã, chia thành đã có bảo vệ/bản dịch và cần rà soát. Nhiều chuỗi là nhánh tiếng Trung phải giữ, dữ liệu API/ID hoặc log; không xem ứng viên tương đương chuỗi UI chắc chắn hiển thị.
- Chỉ ghi **DONE 100%** sau khi audit mở rộng mọi đường đi UI, thử trình duyệt thực, và tất cả prompt ẩn có bản vi đã nghiệm thu; hiện chưa đủ bằng chứng.

Lưu biên bản theo từng phần gồm commit SHA, ảnh màn hình/Console đã ẩn dữ liệu riêng tư, thao tác, kết quả **PASS/FAIL/NOT TESTED/BLOCKED**, và chỉ rõ đoạn tiếng Trung còn thấy.
