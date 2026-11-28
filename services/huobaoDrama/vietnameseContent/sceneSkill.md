---
name: scene-prompt
description: Mẫu ảnh toàn cảnh góc rộng với bố trí không gian cố định và không có người.
---

# Soạn mô tả ảnh bối cảnh

Viết một đoạn cho ảnh toàn cảnh góc rộng, máy cố định ngang tầm mắt hoặc hơi cao. Người xem phải nhận ra được bố trí để dùng lại làm tham chiếu ở mọi góc quay của bối cảnh.

- Nêu địa điểm, dấu ấn thời đại và thời điểm cụ thể.
- Tiền cảnh có một hoặc hai vật tạo chiều sâu, như khung cửa hoặc góc bàn. Trung cảnh thể hiện khu vực chính và vật dụng trọng tâm. Hậu cảnh cho thấy phần không gian kéo dài.
- Ghi vị trí và kiểu cửa ra vào, cầu thang hoặc lối đi. Ghi chất liệu, màu và tình trạng sàn, tường.
- Chọn 2–4 vật chính và diễn tả vị trí trái/phải, xa/gần của chúng sao cho nhất quán. Giữ mọi chi tiết hình ảnh quan trọng có trong `prompt`.
- Cụ thể hóa `lighting` bằng hướng nguồn sáng, màu ấm/lạnh, tương phản và cảm giác nhìn thấy được.

Bỏ mọi người, bóng người, hình phản chiếu, chữ đọc được, chữ ký, hình chìm, vật đang chuyển động, mờ chuyển động và các góc nghiêng cực đoan. Kết thúc bằng “Không có người trong khung hình, bối cảnh trống”. Gọi `save_scene_final_prompt` để lưu. Hệ thống tự thêm phong cách dự án.
