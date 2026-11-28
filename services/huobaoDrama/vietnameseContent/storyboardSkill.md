---
name: storyboard-breaker
description: Cách chia kịch bản thành phân cảnh gồm nhiều cảnh quay nhỏ.
---

# Chia phân cảnh

Mỗi phân cảnh là một tác vụ tạo video dài 8–15 giây, có 2–4 cảnh quay nhỏ, mỗi cảnh quay khoảng 2–6 giây và tập trung vào một hành động, phản ứng hoặc chi tiết. Có thể cắt để đổi góc, đối tượng hoặc cỡ cảnh trong cùng một bối cảnh.

1. Dùng `read_storyboard_context` để đọc kịch bản, tư liệu và tóm tắt phân cảnh có sẵn.
2. Xác định nhịp truyện và đặt ranh giới ở điểm chuyển địa điểm, phát hiện, bước ngoặt hoặc cao trào. Giữ chuỗi nguyên nhân, sự kiện và phản ứng liền nhau.
3. Ước lượng tổng theo 500 ký tự mỗi phút và trung bình 12 giây mỗi phân cảnh, sai số khoảng 20%.
4. Chia cảnh quay nhỏ ở điểm đổi hành động, chủ thể hoặc góc nhìn. Gọi `save_storyboards` theo lô đã quy định. Dùng `update_storyboard` khi chỉ sửa một phân cảnh.

| Loại phân cảnh | Thời lượng | Công dụng |
|---|---|---|
| Chuyển tiếp | 8–10 giây | Di chuyển, cảnh trống hoặc giới thiệu không gian |
| Kể chuyện | 10–15 giây | Sự kiện và đối thoại |
| Điểm nhấn | 12–15 giây | Cao trào, bước ngoặt hoặc cận cảnh kéo dài |

Thời lượng phải đủ ít nhất số ký tự lời thoại và thuyết minh chia cho 4,5 rồi cộng hai giây. Chuyển lời thoại thừa sang đoạn tiếp theo.

## Thành phần

- Tiêu đề ngắn, địa điểm và bố trí, thời điểm và ánh sáng.
- Cỡ cảnh, góc ngang/cao/thấp/nghiêng/từ sau và chuyển động máy. Mỗi cảnh quay có thể dùng cách khác nhau.
- `description` chia theo **【Cảnh quay 1】**, **【Cảnh quay 2】**… Viết người xem thấy ai làm gì, với cử chỉ và nét mặt ra sao. Ghi `Tên nói: “Lời thoại”` hoặc `Thuyết minh: Nội dung` ở đúng mục.
- `result` là kết quả ngay sau cảnh. `atmosphere` gồm ánh sáng, màu, âm thanh và cảm giác không gian.
- `image_prompt` bám khung đầu. `bgm_prompt` và `sound_effect` dùng chi tiết đủ rõ để tạo âm thanh.

## Gắn tư liệu

Tìm `scene_id` theo địa điểm và thời điểm đã có. Gắn `character_ids` khi nhân vật nhìn thấy được, hành động hoặc nói. Gắn `prop_ids` khi đạo cụ được dùng, trao tay, quay cận hoặc hiện rõ và có ý nghĩa. Dùng đúng mã trong danh sách và truyền danh sách rỗng khi không có mục phù hợp. Các đạo cụ đã gắn sẽ cung cấp ảnh tham chiếu cho bước tạo video.
