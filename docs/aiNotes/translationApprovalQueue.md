# Danh sách tổng hợp chờ duyệt Việt hóa — đợt 1

**Ngày:** 2026-11-08. **Người ghi:** ChatGPT (GPT-6).
**KHÔNG phải bản dịch đã phê duyệt; tuyệt đối không tự áp dụng đề xuất vào UI hoặc prompt.**
Tập hợp các mục mới đã xác định. Đây **chưa phải danh sách đầy đủ** mọi chuỗi Trung/Anh trong 1.454 mục của monorepo. Mọi AI phải tiếp tục bổ sung ID/ngữ cảnh khi phát hiện và không rút gọn hay tự dịch prompt điều khiển.

Các câu trong 127 mục V1 và 10 tên menu đã được duyệt **không có trong hàng chờ**: xem [bảng đã duyệt](./vietnameseAuditV1.md). Mục [RemoteUI gốc](./remoteUiStringsPending.md) được đối chiếu lại ở bảng dưới đây.

| ID | File | Chuỗi gốc | Ngữ cảnh | Bản dịch đề xuất (CHƯA DUYỆT) |
|---|---|---|---|---|
| REMOTE-UI-001 | apps/web/src/components/settings/panels/chromeBridge/index.vue | Chrome Bridge mode | Tiêu đề lựa chọn chế độ kết nối | Chế độ Chrome Bridge |
| REMOTE-UI-002 | apps/web/src/components/settings/panels/chromeBridge/index.vue | Chrome on this Mac | Nhãn chế độ Local | Chrome trên máy Mac này |
| REMOTE-UI-003 | apps/web/src/components/settings/panels/chromeBridge/index.vue | Chrome through Render | Nhãn Remote Mode | Chrome qua Render |
| REMOTE-UI-004 | apps/web/src/components/settings/panels/chromeBridge/index.vue | Remote Relay · Render | Tiêu đề card relay | Relay từ xa · Render |
| REMOTE-UI-005 | apps/web/src/components/settings/panels/chromeBridge/index.vue | Both devices connect out over WSS or HTTPS. The Relay URL must point to your Render Web Service. | Giải thích đường truyền | Cả hai thiết bị chủ động kết nối qua WSS hoặc HTTPS. URL Relay phải là dịch vụ Render của bạn. |
| REMOTE-UI-006 | apps/web/src/components/settings/panels/chromeBridge/index.vue | Connect Render | Hành động cấu hình | Kết nối Render |
| REMOTE-UI-007 | apps/web/src/components/settings/panels/chromeBridge/index.vue | Refresh devices | Tải lại danh sách | Làm mới thiết bị |
| REMOTE-UI-008 | apps/web/src/components/settings/panels/chromeBridge/index.vue | New one-time pairing code | Tạo mã một lần | Tạo mã ghép nối dùng một lần |
| REMOTE-UI-009 | apps/web/src/components/settings/panels/chromeBridge/index.vue | Copy | Sao chép mã | Sao chép |
| REMOTE-UI-010 | apps/web/src/components/settings/panels/chromeBridge/index.vue | Approve device | Duyệt yêu cầu ghép nối | Duyệt thiết bị |
| REMOTE-UI-011 | apps/web/src/components/settings/panels/chromeBridge/index.vue | Select paired Chrome device | Chọn máy | Chọn thiết bị Chrome đã ghép nối |
| REMOTE-UI-012 | apps/web/src/components/settings/panels/chromeBridge/index.vue | New device name | Đổi tên thiết bị | Tên thiết bị mới |
| REMOTE-UI-013 | apps/web/src/components/settings/panels/chromeBridge/index.vue | Rename | Đổi tên | Đổi tên |
| REMOTE-UI-014 | apps/web/src/components/settings/panels/chromeBridge/index.vue | Revoke | Thu hồi quyền kết nối | Thu hồi |
| REMOTE-UI-015 | apps/web/src/components/settings/panels/chromeBridge/index.vue | Chrome offline or Relay not reachable. Check HTTPS access and pairing on the remote machine. | Lỗi kết nối | Chrome ngoại tuyến hoặc Relay không thể truy cập. Kiểm tra HTTPS và ghép nối trên máy từ xa. |
| REMOTE-UI-016 | packages/chromeCompanion/popup.html | Remote via Render | Tiêu đề popup extension | Kết nối từ xa qua Render |
| REMOTE-UI-017 | packages/chromeCompanion/popup.html | Pair via Render | Nút ghép nối extension | Ghép nối qua Render |
| REMOTE-UI-018 | packages/chromeCompanion/popup.html | Disconnect Remote | Nút ngắt kết nối | Ngắt kết nối từ xa |
| REMOTE-UI-019 | packages/chromeCompanion/popup.html | Device name | Ô tên thiết bị | Tên thiết bị |
| REMOTE-UI-020 | packages/chromeCompanion/popup.js | Pairing pending approval in ToonFlow. | Trạng thái chờ phê duyệt | Đang chờ phê duyệt ghép nối trong ToonFlow. |

**Khối prompt chưa duyệt, không tự diễn đạt:** `apps/web/src/components/settings/panels/mediaModel/providerPrompt.ts`, `packages/skills/v118workflow/SKILL.md` và `references/*`, `packages/skills/canvas/SKILL.md`, các `packages/tools/*` ngoài 127 ID. Cần nguồn dịch và ID do chủ dự án duyệt.

**Tiếp tục rà soát:** các chuỗi thông báo lỗi, Settings account, menu chuột phải, toolbar Canvas, thư viện tài nguyên và popup Companion cũ nếu không dùng `@toonflow/i18n`. Đề xuất ở bảng chỉ là thông tin để duyệt một lần, không có thay đổi runtime.
