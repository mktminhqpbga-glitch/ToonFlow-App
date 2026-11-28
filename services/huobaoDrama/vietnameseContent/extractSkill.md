---
name: extractor
description: Quy tắc tách nhân vật, bối cảnh và đạo cụ từ kịch bản.
---

# Tách tư liệu trong tập

Đọc kịch bản bằng `read_script_for_extraction`, sau đó đối chiếu các danh sách `read_existing_characters`, `read_existing_scenes` và `read_existing_props`. Chỉ xử lý tư liệu cần cho tập hiện tại. Dùng lại tư liệu đã có và gắn vào tập khi cần.

## Nhân vật

- `name` ghi đầy đủ. `role` cho biết vai chính, vai phụ hoặc vai quần chúng.
- `appearance` dài khoảng 300–500 ký tự, ghi tuổi ước chừng, giới tính thể hiện, vóc dáng, nét mặt và phong thái. Đổi đặc điểm tính cách thành biểu cảm hoặc cử chỉ nhìn thấy được.
- `styling` ghi tóc, trang phục, trang điểm và phụ kiện. `description` có thể bổ sung quá khứ và quan hệ.
- Dùng `save_dedup_characters` để lưu và gắn vào tập.

## Bối cảnh

- `location` ghi địa điểm cụ thể. `time` ghi thời điểm. Cùng địa điểm vào thời điểm khác là mục riêng.
- `prompt` tả bố trí, dấu ấn thời đại, chi tiết chính và không gian trống. `lighting` ghi nguồn sáng, tông màu, độ tương phản và không khí.
- Dùng `save_dedup_scenes` để lưu và gắn vào tập.

## Đạo cụ

Ưu tiên tối đa ba đạo cụ có vai trò trực tiếp với cốt truyện và cần tạo ảnh riêng vì có cảnh cận hoặc xuất hiện nhiều lần. Nếu bỏ vật đó mà câu chuyện vẫn tiến triển, hoặc vật chỉ là đồ dùng thoáng qua, phục trang thường ngày hay đồ trang trí bối cảnh, hãy bỏ qua. Dùng `save_dedup_props` để lưu `name`, `type` và `description` chỉ tả các đặc điểm vật lý. Truyền danh sách rỗng khi không có đạo cụ phù hợp. Mô tả tạo ảnh sẽ được soạn ở bước sau.

Đối chiếu nhân vật và đạo cụ theo tên chính trước phần trong ngoặc, có thể dùng `normalized_name`. Đối chiếu bối cảnh theo địa điểm và thời điểm, có thể dùng `normalized_location`. Khi tìm thấy mục trùng, gắn mục có sẵn thay vì tạo bản sao.
