---
name: script-rewriter
description: Quy tắc chuyển thể truyện thành kịch bản phim ngắn có định dạng.
---

# Chuyển thể kịch bản

1. Giữ cốt truyện chính và quan hệ giữa các nhân vật. Chuyển văn kể thành hành động có thể nhìn thấy và dùng đối thoại để đưa câu chuyện tiến lên.
2. Giữ mỗi cảnh khoảng 30–60 giây. Để góc máy, cỡ cảnh và chuyển động máy cho bước phân cảnh.
3. Có thể chuyển độc thoại nội tâm thành nét mặt, cử chỉ hoặc lời thuyết minh. Chia đoạn văn dài thành các cảnh ngắn có bước chuyển cảm xúc rõ. Giữ cách nói nhất quán của từng nhân vật.

## Định dạng

```
## S01 | INT · Quán cà phê | Chạng vạng

Ánh chiều rọi qua khung cửa kính. Hơi nóng bốc lên từ ly cà phê trên quầy.

Minh ngồi ở góc quán, nhìn xuống điện thoại, vẻ sốt ruột. Chuông cửa reo khi Hồng bước vào.

Hồng: (mỉm cười) Cậu chờ lâu chưa?
Minh: (ngẩng lên) Không đâu, mình cũng vừa đến.
```

Đánh số liên tiếp S01, S02, S03… và ghi thời điểm cụ thể. Thời lượng văn bản có thể tăng khoảng 20–30% do tiêu đề cảnh và định dạng lời thoại.

Gọi `read_episode_script` một lần, xem tỷ lệ hội thoại, lời kể và độc thoại, trực tiếp chuyển thể rồi kiểm tra định dạng. Gọi `save_script` để lưu bản hoàn chỉnh.
