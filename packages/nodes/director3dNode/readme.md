# Đạo diễn 3D

Dùng văn bản để tạo bối cảnh, hoạt ảnh mô hình và chuyển động camera; sau đó điều chỉnh góc nhìn trong không gian 3D. Thích hợp dựng thử hành động và góc máy. Nhân vật hình người sử dụng mẫu khớp nối low-poly tích hợp; bối cảnh/đạo cụ có thể dùng hình học cơ bản.

## Đầu vào và đầu ra

- Hỗ trợ văn bản, ảnh và video tham chiếu để mô tả bối cảnh, hành động và camera.
- Có thể xuất keyframe thành node ảnh PNG và hoạt ảnh được chọn thành node video MP4.
- Cần bật plugin node ảnh hoặc video tương ứng trước khi xuất.

## Cách sử dụng

Lần đầu mở bảng Đạo diễn 3D sẽ xuất hiện hướng dẫn, sau khi hoàn thành hoặc đóng sẽ không tự hiện lại.

1. Bấm bản xem trước của node để mở bảng, chọn mô hình AI, mô tả cảnh/hành động/góc máy rồi bấm **Tạo hoạt ảnh**.
2. Chọn phương án trong danh sách hoạt ảnh để xem hành động và chuyển động camera từ đầu, cùng prompt đầu vào. Dùng nút Phát và thanh tiến độ để tạm dừng/tua; có thể nhập thêm yêu cầu để tạo phương án mới. Nếu phương án cũ không lưu prompt, giao diện báo rõ là thiếu.
3. Bấm vào khung 3D để điều khiển camera. Dùng chuột đổi hướng; WASD di chuyển, Space đi lên, Shift hạ xuống, con lăn đổi tiêu cự.
4. Nhấp chuột phải hoặc bấm **Thêm keyframe** để lưu góc nhìn. Có thể kéo đổi thứ tự, bấm xem lại hoặc xóa; nhấp trái hoặc Esc để thoát điều khiển.
5. Sau khi lưu keyframe, tạo hoạt ảnh mới để AI tham khảo góc nhìn và thứ tự đó.
6. Chỉnh tỉ lệ, lưới, bầu trời và ánh sáng rồi xuất ảnh keyframe hoặc bấm **Xuất node video**.

Khi xuất video cần để cửa sổ hiện tại hiển thị; sau khi hoàn tất, xem kết quả ở node video mới trên Canvas.

## AI chỉnh sửa từng phần

Việc tạo phương án dùng `ai.generate()` giống node Văn bản và cấp riêng các công cụ `readDocument`, `editDocument` qua `tools`. Mô hình văn bản được chọn phải hỗ trợ gọi công cụ. Mỗi lượt sao chép phương án đang chọn làm bản nháp; AI đọc và chỉnh cục bộ cảnh, track và camera, giữ nội dung không sửa. Lần tạo đầu cũng dùng công cụ để hoàn thiện bản nháp. Vòng lặp công cụ và bản nháp ở phía node; server chỉ chuyển tiếp từng yêu cầu mô hình, không lưu phiên Đạo diễn 3D.

Hai công cụ trên không được đăng ký vào `nodeTools`, không đưa cho Agent tổng và không trực tiếp sửa tệp. Chỉ thêm phương án khi đã kiểm tra toàn bộ, render xem trước và lưu thành công; mọi phương án dùng chung cảnh. Khi lỗi, hủy hoặc có xung đột chỉnh sửa đồng thời thì không ghi bản nháp. Mỗi lượt tạo cho phép tối đa 40 lần gọi mô hình; quá 10 phút sẽ hủy.

## Nhân vật khớp nối low-poly

Trong Cài đặt của Đạo diễn 3D, bấm **Thêm nhân vật** để thêm và lưu hình người low-poly. Mô hình ít phân đoạn lưới, không vẽ các quả cầu khớp, nhưng bên trong vẫn có 16 khớp. Có thể trực tiếp yêu cầu AI dùng mẫu nhân vật tích hợp, không cần tự ghép cơ thể.

Nhân vật cao khoảng 1,8 đơn vị, gốc tọa độ dưới bàn chân, +Y lên, +Z ra trước, +X là bên trái theo chính nhân vật. Các thuộc tính `position`, `rotation`, `scale` của object gốc điều khiển vị trí/hướng/kích thước tổng thể. `material.color` điều khiển màu thống nhất toàn nhân vật; mỗi nhân vật có thể dùng màu riêng.

Một nhân vật chiếm một phần tử trong `objectList`:

~~~json
{
  "threeJsonId": "person1",
  "name": "Nhân vật",
  "objType": "mannequin",
  "geometry": {},
  "position": { "x": 0, "y": 0, "z": 0 },
  "material": { "type": "standard", "color": "#c8a878", "roughness": 0.7 },
  "pose": { "rightElbow": { "x": -1.2, "y": 0, "z": 0 } }
}
~~~

`pose` có thể bỏ qua; mặc định mọi góc xoay bằng 0 là đứng, hai tay thả tự nhiên. Tư thế khớp dùng góc Euler XYZ tính bằng radian tương đối với khớp cha. Thứ bậc: hips → spine → neck → head; từ spine nối vai trái/phải → khuỷu → cổ tay; từ hips nối hông trái/phải → đầu gối → mắt cá. Xoay vai kéo cả cánh tay, xoay hông kéo cả chân.

Tên khớp khả dụng: hips, spine, neck, head, leftShoulder, leftElbow, leftWrist, rightShoulder, rightElbow, rightWrist, leftHip, leftKnee, leftAnkle, rightHip, rightKnee, rightAnkle.

Mặc định nhân vật có đủ các phần. Có thể thêm mảng `hiddenParts` để ẩn khớp được chọn và các phần con. Ví dụ `"hiddenParts": ["leftShoulder", "rightKnee"]` ẩn cả tay trái và cẳng chân phải (kể cả bàn chân). Shoulder là cả tay; Elbow là cẳng tay cùng bàn tay; Wrist chỉ bàn tay. Hip là cả chân; Knee là cẳng chân cùng bàn chân; Ankle chỉ bàn chân. Phân biệt left/right theo chính nhân vật. Khớp ẩn vẫn giữ tên trong bộ xương và hoạt ảnh cũ vẫn dùng được.

Trong track hoạt ảnh, `objectId` luôn là ID object gốc; `joint` chọn khớp. Các frame chỉ cần `rotation`, giữ chiều dài xương cố định. Ví dụ gập khuỷu tay phải:

~~~json
{
  "objectId": "person1",
  "joint": "rightElbow",
  "frames": [
    { "time": 0, "rotation": { "x": 0, "y": 0, "z": 0 } },
    { "time": 1, "rotation": { "x": -1.2, "y": 0, "z": 0 } }
  ]
}
~~~

Track không có `joint` điều khiển chuyển động, xoay hoặc đổi tỉ lệ của object gốc và có thể dùng cùng track khớp. `position` và `scale` trong track gốc có thể bỏ qua để giữ mặc định. Mọi track vẫn phải đúng thời lượng phương án và định dạng keyframe.
