# Remote Chrome Bridge — chuỗi giao diện chưa có bản dịch được duyệt

- **Ngày:** 2026-11-08 · **Người ghi:** ChatGPT (GPT-6).
- **Trạng thái:** chờ người điều phối cung cấp bản dịch theo ID/đường dẫn; **không tự tạo câu Việt cho UI mới**.
- **Nguồn:** các nhãn mới trong `apps/web/src/components/settings/panels/chromeBridge/index.vue` và `packages/chromeCompanion/{popup.html,popup.js}`.
- **Chính sách:** giữ nguyên text kỹ thuật/English tạm thời cho tới khi có bản dịch `vi` được duyệt. Không áp dụng sang nhánh Việt hóa PR #2 trong công việc này.

| ID chờ duyệt | Chuỗi giao diện gốc |
|---|---|
| `REMOTE-UI-001` | Chrome Bridge mode |
| `REMOTE-UI-002` | Chrome on this Mac |
| `REMOTE-UI-003` | Chrome through Render |
| `REMOTE-UI-004` | Remote Relay · Render |
| `REMOTE-UI-005` | Both devices connect out over WSS or HTTPS. The Relay URL must point to your Render Web Service. |
| `REMOTE-UI-006` | Connect Render |
| `REMOTE-UI-007` | Refresh devices |
| `REMOTE-UI-008` | New one-time pairing code |
| `REMOTE-UI-009` | Copy |
| `REMOTE-UI-010` | Approve device |
| `REMOTE-UI-011` | Select paired Chrome device |
| `REMOTE-UI-012` | New device name |
| `REMOTE-UI-013` | Rename |
| `REMOTE-UI-014` | Revoke |
| `REMOTE-UI-015` | Chrome offline or Relay not reachable. Check HTTPS access and pairing on the remote machine. |
| `REMOTE-UI-016` | Remote via Render |
| `REMOTE-UI-017` | Pair via Render |
| `REMOTE-UI-018` | Disconnect Remote |
| `REMOTE-UI-019` | Device name |
| `REMOTE-UI-020` | Pairing pending approval in ToonFlow. |

Các lỗi kết nối và thông báo an toàn còn nhiều câu tiếng Anh khác trong mã remote; chưa có ID/bản dịch Việt, **không được tự dịch**. Cần kiểm kê bổ sung sau khi có bản chạy thật.
