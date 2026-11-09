# HD-06 — Nghiệm thu thực tế trên Mac Intel / macOS 13 Ventura

**Trạng thái:** CHECKLIST — **NOT TESTED trên máy Mac của chủ dự án**. Việc CI/Bun test PASS không thay cho E2E Web/Chrome/AI. Không nhập khóa bí mật, nội dung riêng tư hoặc cookie vào log công khai.

## A. Lấy đúng nhánh và chạy Web/Server

```bash
git fetch origin
git switch feat/independentToonFlowFullIntegration
git pull --ff-only origin feat/independentToonFlowFullIntegration
bun install --frozen-lockfile
bun run build:tools
bun run build:ext
bun run build:nodes
bun run build:mcp
bun run --cwd apps/server typecheck
bun run --cwd apps/web typecheck
bun test apps/server/src/utils/media/batchTransitions.test.ts apps/server/src/utils/media/batchFfmpeg.test.ts apps/web/tests/materialPresetCatalog.test.ts packages/nodeShared/tests/promptDrop.test.ts apps/web/tests/characterRecords.test.ts
```

Bắt đầu bằng **hai Terminal riêng biệt**, từ thư mục repo (không bỏ kiểm tra bảo mật bridge):

Terminal 1:
```bash
bun run dev:server:local
```

Terminal 2:
```bash
bun run dev:web:local
```

Chỉ sử dụng địa chỉ mà Vite/Server thực tế in ra. Kiểm tra Developer Tools → Console, Network; nếu có lỗi hãy lưu HTTP status, tên route, ảnh hoặc log đã xóa thông tin bí mật.

## B. Nghiệm thu theo chức năng

- **HD-02 Prompt:** Tạo hai node có ảnh/video đầu ra thật. Kéo vào vị trí giữa chữ trong prompt; kéo từ Asset Library; chèn nhiều tham chiếu; xem trước; xóa 1 tham chiếu; Undo/Redo; lưu canvas, tải lại trang, xác nhận nội dung gốc và ID nguồn/handle còn nguyên. Thực thi tạo media **chỉ khi có provider thực đang đăng nhập** và kiểm tra file request đã chứa tài nguyên nguồn thực, không chỉ URL thumbnail.
- **HD-03 Thư viện vật liệu:** Hai nút toolbar mở được; popup hai cột; chọn Storyboard, Chín góc máy, Ba góc nhìn nhân vật; chỉnh prompt; tạo node có `type=remote-imageGenerationNode` hoặc `remote-videoGenerationNode`; lưu/reload. Preset chỉ điền prompt hướng dẫn; chất lượng kết quả phụ thuộc model đang kết nối.
- **HD-04 Studio nhân vật:** Tạo hồ sơ có ảnh PNG/JPEG/WebP; ghi nhận Character ID; thử tìm/sửa, đổi bộ ảnh, reload; đưa ảnh vào Canvas, xác nhận node giữ `characterId`; xóa hồ sơ và xác nhận ảnh trên workspace/Canvas vẫn còn; thử chuyển workspace trong lúc upload để xác nhận không ghi nhầm dự án. Sao lưu workspace trước khi thử tình huống lỗi.
- **HD-05 Batch Image:** Tạo ≥3 prompt; ghi lại mỗi Task ID, từng trạng thái và số việc chờ; thử tạm dừng/tiếp tục, cảnh FAILED độc lập, hủy các cảnh chờ; reload trang và restart server, kiểm tra Task ID không đổi; cảnh UNKNOWN không được tự gửi lại; đưa ảnh thành node Canvas rồi lưu/reload.
- **HD-05 Batch Video:** Tạo ít nhất hai cảnh video thực; kiểm tra file đầu vào bằng FFprobe (codec, duration dương, MIME); thử ghép FFmpeg và probe MP4 đầu ra; thử một clip sai codec hoặc thumbnail bị từ chối; tải MP4 và đưa vào Canvas. Nếu FFmpeg chưa cài hoặc nguồn video không tương thích, lỗi phải rõ ràng và không có file `merged` giả.
- **Video Node:** Khi không có model, vẫn mở tỷ lệ 16:9/9:16, nhưng không gửi AI; khi model có cấu hình, chỉ mở tính năng model hỗ trợ. Đổi model, save/reload không mất prompt và tỉ lệ.

## C. Chrome Companion, Render và provider thật

- Xây extension bằng `bun run build:ext`. Trong Chrome mở `chrome://extensions` → bật Developer mode → Load unpacked từ **thư mục extension được build ra và được xác minh trên máy**; đối chiếu bản extension với phiên server, không tự giả định đường dẫn.
- Mở Cài đặt → Chrome Bridge; ghép nối bằng mã hiển thị trên server thật. Kiểm tra trạng thái pairing, thiết bị và đúng tab Muse/Gemini/ChatGPT đã được chọn; thử tab mất kết nối, trang đăng xuất, chuyển URL, lỗi quota. Không bỏ allowlist hoặc Origin/token validation để thử nhanh.
- Với Render Relay, kiểm tra Device ID, Tab ID, document token trước và sau khi gửi; tạo tác vụ đơn rồi theo dõi chính tab; không gửi lại UNKNOWN để “thử lần nữa”. Chỉ ghi SUCCESS khi có response/file mới đúng request và đúng tab.
- Nếu chưa có tài khoản Chrome hợp lệ, thông tin Render hoặc quyền cài FFmpeg, ghi **BLOCKED** cho riêng E2E đó và tiếp tục kiểm tra local/unit.

## D. Ghi bằng chứng

Mỗi ca: ngày giờ + commit SHA + môi trường Mac (Intel, Ventura 13.x), thao tác, expected/actual, trạng thái **PASS / FAIL / NOT TESTED / BLOCKED**, ảnh/console log **đã che dữ liệu nhạy cảm**. Đính vào `docs/aiNotes/hdAcceptance.md`, giữ nguyên issue nếu chưa có bằng chứng.

**Giới hạn hiện tại:** Chưa có bằng chứng Web thao tác thật trên macOS 13, provider đăng nhập, Render credentials hay FFmpeg chạy bên trong app phát hành. CI chỉ chạy unit/fixture/typecheck/build trên Linux.
