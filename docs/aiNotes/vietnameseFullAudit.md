# Kiểm kê Việt hóa toàn bộ — checkpoint chưa đạt 100%

2026-11-08 (UTC+7), Codex (GPT-6). Trạng thái tổng: **PARTIAL**.

## Đã thay đổi và xác minh

- Bản Web độc lập mặc định `vi`; `VITE_TOONFLOW_DEFAULT_LOCALE` cho phép locale khác hoặc `system`. Lựa chọn người dùng đã lưu vẫn có ưu tiên.
- Font Be Vietnam Pro local, trọng lượng 400/500/600/700, subset Latin/Latin Extended/Vietnamese, giấy phép SIL OFL. Chromium xác nhận font tải được và `html.lang=vi`.
- Nhiều nhãn/error/help chính trên trang Chrome Bridge dùng từ điển vi; trạng thái trình bày được ánh xạ, không đổi protocol state/Provider ID. Popup Extension đã dịch phần Remote.
- Nhãn mặc định chín node ở menu được dịch tại render. Không ghi bản dịch vào dữ liệu dự án, không dịch alias. Chromium kiểm menu Cài đặt không còn chín nhãn mặc định tiếng Trung.
- Camera Studio nhận locale từ hai node tạo ảnh/video, thêm chỉ dẫn tiếng Việt khi vi. Giữ nguyên prompt người dùng, tên Sony/Cooke, đơn vị mm, f/2.8. Tắt Camera không thêm chuỗi nào. Bản en giữ nguyên.
- Bài kiểm tra prompt trực tiếp bằng Bun/assert đã qua cho vi, en, disabled, prompt gốc có tiếng Nhật và `{{characterId}}`.

## Quét phạm vi bắt buộc

Đếm tệp .ts/.vue/.md/.json và tệp có ký tự CJK ngày kiểm tra; gồm cả comment và bản locale gốc. **Không dùng số này như số lỗi hay phần trăm bản dịch.**

| Phạm vi | Tệp quét | Tệp có CJK |
|---|---:|---:|
| apps/server/src/agent | 30 | 28 |
| apps/server/src/utils | 71 | 56 |
| apps/web/src | 178 | 163 |
| packages/nodes | 93 | 74 |
| packages/nodeShared | 26 | 16 |
| packages/tools | 77 | 53 |
| packages/skills | 34 | 34 |
| packages/teams | 10 | 7 |
| packages/providers | 8 | 5 |

## Chưa hoàn thành

- System prompt vi đã có trước phiên, nhưng summary/guidelines của Tools được ghép động từ plugin. Chưa kiểm toàn bộ prompt cuối tại điểm gọi AI.
- `.describe(...)`, promptSnippet, promptGuidelines trong Tools; Markdown Skills/references; nội dung Agent Teams; prompt Director3D và mọi đường phân tích ảnh/video cần rà theo ngữ cảnh, bảo toàn ý nghĩa.
- Nhiều chuỗi backend/runtime/plugin và header node cũ chưa được kiểm chứng ở vi. Không thay ID, JSON keys, model/provider/tool names, placeholder hoặc template syntax để dịch.
- Nhãn ngôn ngữ như 日本語/简体中文 trong bộ chọn ngôn ngữ là tên tự gọi có chủ đích; không coi là lỗi Việt hóa.
- Lỗi từ website/provider có thể là nội dung bên ngoài; không tự dịch nội dung người dùng hoặc ngôn ngữ đầu ra đã chỉ định.
- Màn hình Bridge thực trên Mac, Canvas/Asset/Agent toàn diện chưa được kiểm tra. Không tuyên bố 100%.

## Kiểm tra cần bổ sung

1. Chặn/capture payload ở biên model transport trong môi trường thử; liệt kê mọi chỉ dẫn tự sinh và nguồn, không ghi prompt riêng tư/token vào báo cáo công khai.
2. So sánh cấu trúc JSON/schema/tool name/placeholder trước-sau theo từng template; chạy định dạng phản hồi và tool calling thực tế.
3. Gate chỉ kiểm chuỗi tự sinh thuộc luồng vi, có allowlist rõ ràng cho tên model/giao thức/nhãn ngôn ngữ; không quét mù rồi sửa nội dung người dùng.
4. Đã chạy kiểm tra regression cụ thể ở menu và Camera; **chưa có gate tự động toàn ứng dụng**.
