---
name: video-prompt
description: Mẫu chuyển phân cảnh thành hướng dẫn tạo video chia theo thời gian.
---

# Soạn mô tả video

Một phân cảnh tạo một video 8–15 giây. Bám `description` cho hành động và lời nói, dùng `atmosphere` bổ sung ánh sáng, màu sắc và không khí. Có thể cắt để đổi góc máy, cỡ cảnh hoặc chủ thể trong cùng bối cảnh. Giữ đúng trình tự, không chuyển bối cảnh hay hồi tưởng.

## Định dạng

Dòng đầu giới thiệu nhân vật xuất hiện và bối cảnh được gắn, có thể ghi đạo cụ nổi bật. Gọi các tư liệu bằng `@Tên` đúng nguyên văn trong danh sách. Kết thúc dòng đầu bằng dấu chấm.

```
Nhân vật: @Minh, @Hồng. Bối cảnh: @Quán cà phê.
0–3 giây: @Quán cà phê, máy đứng yên, cận @Minh đang nhìn điện thoại và gõ ngón tay lên bàn.
3–6 giây: Cắt sang toàn cảnh cửa. Chuông cửa reo khi @Hồng đẩy cửa đi vào.
6–9 giây: Cắt về trung cảnh. @Hồng ngồi xuống đối diện @Minh. Minh nói: “Cậu tới rồi.”
```

Mỗi dòng tiếp theo là một khoảng ba giây liền nhau. Số khoảng bằng tổng thời lượng chia ba và làm tròn lên. Rút ngắn khoảng cuối khi cần để đúng tổng thời lượng.

## Nội dung

- Mỗi **【Cảnh quay N】** hoặc mục tương ứng trong mô tả cũ đi với một hoặc hai khoảng liền nhau. Giữ thứ tự, không gộp, bỏ hoặc thêm cảnh quay.
- Dòng đầu tiên của hành động cho thấy không gian, vị trí máy và vị trí nhân vật. Sau điểm cắt, nêu rõ cỡ cảnh và chủ thể mới.
- Mỗi khoảng gồm mốc thời gian, bối cảnh, máy quay, chủ thể, hành động, biểu cảm, ánh sáng và lời thoại hoặc thuyết minh nếu có. Giữ một trạng thái máy và một hành động chính trong mỗi khoảng.
- Dùng hành động cụ thể để diễn tả cảm xúc. Trích lời thoại và thuyết minh tại đúng mục, không tự viết thêm. Nếu một câu dài, trải sang nhiều khoảng. Có thể ghi âm thanh môi trường khi không có thoại.
- Mỗi khoảng ít nhất một tham chiếu `@Tên` thuộc phân cảnh. Nhắc đúng nhân vật, bối cảnh, đạo cụ xuất hiện rõ, được dùng hoặc quay cận. Giữ tên đầy đủ để hệ thống nối ảnh chính xác.

Gọi `update_storyboard` với `storyboard_id` và `video_prompt`. Chỉ cập nhật mô tả video của cảnh được yêu cầu.
