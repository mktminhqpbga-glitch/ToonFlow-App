# Tiến độ tiếp quản ToonFlow độc lập

Ngày 2026-11-08 (UTC+7). Người thực hiện: Codex (GPT-6). Đây là checkpoint triển khai, **không phải nghiệm thu toàn bộ yêu cầu**.

## Trạng thái ban đầu đã đối chiếu

- Checkout ban đầu `work`, HEAD `ddd0667c933f7ebb2c0c6a74cd8956e584c169b2`, sạch, không có stash.
- Remote fetch mặc định chỉ lấy main; kiểm tra `git ls-remote --heads origin` tìm thấy nhánh tích hợp. Đã lấy đúng nhánh và chuyển sang `feat/independentToonFlowFullIntegration`, HEAD nền `f566193c1e7409c5125d6b47559c0e58b787a644`.
- `refs/pull/4/head` trùng SHA nền trên. API GitHub/Actions bị proxy chặn CONNECT 403; **chưa xác minh lại trạng thái Draft/CI hiện tại qua API**. Không merge hoặc đổi trạng thái PR.
- Đã đọc AGENTS, bốn sổ ghi chú, cameraStudioAcceptance, translationApprovalQueue, các commit Camera Studio và Chrome Bridge mới. Không có ảnh tham khảo của người dùng trong phiên này; chỉ kiểm tra ảnh chụp mới từ Chromium.
- Trước phiên đã có Camera Studio, snapshot theo asset, 3D focal length, ratio prompt-only, khóa URL cuộc trò chuyện, Companion và Relay. Bằng chứng CI cũ trong tài liệu không thay thế kiểm thử hiện tại.

## Bảng triển khai

| Hạng mục | Code hiện tại | UI | Backend | Build | Unit/Integration Test | Runtime/E2E | Lỗi | Việc còn lại | Commit/bằng chứng |
|---|---|---|---|---|---|---|---|---|---|
| Frozen install | DONE | — | — | DONE | Kiểm tra chỉ đổi 1084 URL, giữ checksum/version | DONE trên Linux | Mirror bị 403 đã khắc phục bằng npm HTTPS | Thử Mac | bun.lock; ISSUE-0022 |
| Runner typecheck toàn repo | DONE | — | DONE | — | Chạy đủ 50 workspace | 48 PASS, 2 FAILED | desktop/mobile thiếu SDK Hutch | Hoàn tất Hutch rồi chạy lại | scripts/typecheckWorkspaces.ts |
| Build Tools/Ext/Nodes/MCP/Web/Server | DONE | — | — | DONE | Mỗi nhóm exit 0 | Không suy ra AI hoạt động | Cảnh báo bundle Web lớn | Regression các chức năng | Log kiểm tra trong e2eAcceptance |
| Font Be Vietnam Pro | DONE phần nền | DONE trên Chromium | — | DONE | WOFF2 local + SIL OFL | DONE font thực tải, chữ Việt | Chưa rà mọi style plugin | Mac, Canvas/chat/popup toàn diện | assets/typography.scss |
| Mặc định vi | DONE | DONE | PARTIAL | DONE | Giữ lựa chọn system/locale đã lưu | DONE trang chủ/cài đặt | Không phải 100% chuỗi | Audit dynamic/backend/plugin | lib/defaultLanguage.ts |
| Tên chín node mặc định | PARTIAL | DONE trong menu cài đặt | Không đổi ID | DONE | Có kiểm tra chuỗi Trung trong menu runtime | DONE menu; canvas cũ NOT TESTED | Header dự án cũ còn cần audit | Kiểm tra mọi label cũ | lib/nodeDisplayLabel.ts |
| Việt hóa UI toàn app | PARTIAL | PARTIAL | PARTIAL | DONE phạm vi sửa | Chưa có gate toàn app | PARTIAL Chromium | Còn chuỗi ngoài phạm vi sửa | vietnameseFullAudit | vi.json |
| Prompt ẩn | PARTIAL | — | PARTIAL | DONE phạm vi sửa | Camera vi/en/disabled/preserve prompt PASS | AI NOT TESTED | Nhiều Tools/Skills/Teams chưa Việt hóa | Dịch bảo toàn schema và kiểm prompt cuối | vietnameseFullAudit |
| Cài đặt tinh gọn | PARTIAL | DONE thu gọn nâng cao | Không xóa upstream | DONE | PublicWeb giữ logic tài khoản | DONE local Chromium | Chưa gom model/mục dự án-lưu trữ riêng | Kiểm tra publicWeb/upstream thực | settings/index.vue |
| Extension ZIP thật | DONE | Nút tải + hướng dẫn | Tệp static Web | DONE | 7 tệp, CRC, manifest, hash lặp lại PASS | DONE HTTP download; Chrome cài thực NOT TESTED | Chưa nghiệm thu Mac | Cài Load unpacked | scripts/packChromeCompanion.ts |
| Bridge UI/Local capability | PARTIAL | Dịch chính, Local disable khi không hỗ trợ | localAvailable | DONE | Server/Web typecheck PASS | Mac/Render BLOCKED | Chưa kiểm tra panel trực tiếp trên Mac | Ghép nối thiết bị thật | chromeBridge/manager.ts |
| Diagnostics Bridge | PARTIAL | Provider/tab/capability có sẵn | Có sẵn | DONE | JS syntax PASS | BLOCKED AI/Render | Chưa đủ bảng diagnostics tổng hợp | Tác vụ, session, reconnect | Code có trước phiên |
| Camera Studio | PARTIAL | Có trước phiên | Snapshot có trước phiên | DONE | Prompt locale PASS | Mac/AI BLOCKED | Preset chung chỉ localStorage | GUI/persist scene/result | cameraStudioAcceptance |
| Tỷ lệ ảnh | PARTIAL | Năm tỷ lệ mong muốn | Kiểm output dimensions có trước phiên | DONE | CI cũ không thay runtime | BLOCKED AI | Chưa điều khiển tỷ lệ native website | So file output thật | ISSUE-0020 |
| Tạo ảnh/video thật | PARTIAL | Có node | Có Bridge/asset pipeline | DONE | Chưa nghiệm thu AI | BLOCKED | Không có Chrome đăng nhập/Render thực | Một ảnh + video tới workspace/reopen | e2eAcceptance |
| Canvas/9 node/Agent/Asset/MCP | Có code gốc | PARTIAL | Có code gốc | DONE | Typecheck workspace liên quan PASS | NOT TESTED regression | Chưa chứng minh mọi thao tác | Save/load, upload, connect node | Không đánh dấu DONE |
| Hai nút toolbar mới | NOT STARTED | NOT STARTED | — | — | NOT TESTED | NOT TESTED | Chưa có | Thư viện vật liệu + Studio nhân vật | Yêu cầu giai đoạn 5 |
| Thư viện vật liệu sáng tạo | PARTIAL thành phần tái sử dụng | Chưa có bảng mới | Lighting/multi-angle/storyboard có sẵn | DONE code cũ | NOT TESTED | NOT TESTED | Chưa có workflow công cụ tổng hợp | Tái sử dụng đúng node/tool | Không thêm nút giả |
| Studio nhân vật | NOT STARTED | NOT STARTED | NOT STARTED | — | NOT TESTED | NOT TESTED | Chưa có Character ID/store/gallery | Backend workspace bền vững rồi UI | Yêu cầu giai đoạn 5 |
| Batch Image | NOT STARTED | NOT STARTED | NOT STARTED | — | NOT TESTED | NOT TESTED | Chưa có engine/checkpoint | Đọc repo tham khảo + giấy phép | ISSUE-0021 |
| Batch Video/FFmpeg workflow | NOT STARTED | NOT STARTED | NOT STARTED | — | NOT TESTED | NOT TESTED | FFmpeg có sẵn không đồng nghĩa workflow | Queue/scene/checkpoint/output MP4 | ISSUE-0021 |
| CI mới/PR #4 | BLOCKED API | — | — | Local evidence ở trên | CI mới NOT TESTED | BLOCKED API | api.github.com bị 403 | Cho phép domain rồi đọc CI | Không merge main |
| Web Mac Ventura | Có scripts local trước phiên | NOT TESTED | NOT TESTED | Linux không thay Mac | NOT TESTED | BLOCKED máy Mac | Không có Mac thật | Checklist e2eAcceptance | Không sửa metadata native |

## Thứ tự tiếp tục

1. Cài SDK Hutch qua đường tải chính thức được hỗ trợ; chạy lại desktop/mobile và toàn bộ typecheck, không thêm stub hoặc bỏ kiểm tra.
2. Tiếp tục Việt hóa tự nhiên trong UI/backend/Tools/Skills/Teams; kiểm từng prompt cuối và schema. Không tự dịch nội dung người dùng.
3. Hoàn tất Bridge diagnostics và nghiệm thu thiết bị Chrome/Render thật. Không retry tác vụ UNKNOWN.
4. Sau đó triển khai Thư viện vật liệu và Studio nhân vật với store workspace; Batch dùng Task/Scene/Node/Asset ID và checkpoint bền vững.
5. Đọc bốn repo tham khảo, xác minh giấy phép trước khi chọn thiết kế Batch; chưa đọc/clone các repo này trong checkpoint hiện tại.

## Chạy bản Web Ventura

```sh
git fetch origin
git switch feat/independentToonFlowFullIntegration
git pull --ff-only origin feat/independentToonFlowFullIntegration
bun install --frozen-lockfile
bun run build:tools
bun run build:ext
bun run build:nodes
bun run build:mcp
bun run dev:server:local
```

Terminal thứ hai: `bun run dev:web:local`. Mở địa chỉ Vite trên loopback, thường cổng 5173. Extension ZIP được tạo khi dev/build Web; tải trong Cài đặt → AI Bridge · Chrome. Không thay Electrobun hay hạ metadata yêu cầu macOS.

Bằng chứng triển khai checkpoint: [commit 412912a](https://github.com/mktminhqpbga-glitch/ToonFlow-App/commit/412912a62888209a040128c522ef085f6a7953dc).

## Cập nhật Bridge 0.2.0 — giữ tab và đúng kết quả

Codex (GPT-6), 2026-11-08 (UTC+7): đã thêm khóa documentToken/URL/Task/Provider/Tab/frame, giữ một tác vụ trên tab, receipt/anchor riêng, loại URL ảnh cũ và kiểm lại sau download. Chống gửi trùng bền vững áp dụng cả Local/Remote; UNKNOWN không tự retry. Không tự đổi hoặc kích hoạt tab Chrome.

Phần code đã kiểm tra bằng Chromium có DOM kiểm soát, worker/API giả lập và Local WebSocket thật trên Linux; **chưa** có nghiệm thu website AI/Render/Mac thật. Các hạng mục toàn dự án khác giữ trạng thái PARTIAL như trên. Xem phần cập nhật trong e2eAcceptance và readme Extension 0.2.0 để cập nhật đồng bộ backend/Extension và tải lại tab AI.
