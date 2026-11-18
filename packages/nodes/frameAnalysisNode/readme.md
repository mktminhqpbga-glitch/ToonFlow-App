# Phân tích video theo khung hình

Bấm **Phân tích khung hình** trên thanh công cụ node Video hoặc Tạo video để tạo node phân tích và tự nối video hiện tại; cũng có thể thêm node phân tích riêng rồi chọn video. Khi bắt đầu, công cụ trích keyframe, clip từng cảnh và âm thanh gốc thành các node tài nguyên độc lập. Có thể bật AI để mô tả mỗi cảnh và tổng kết phim theo trọng tâm phân tích đã nhập.

- **Phân cảnh:** mỗi cảnh có một ảnh JPG giữ độ phân giải gốc, ở gần thời điểm giữa cảnh.
- **Chuyển động:** xuất clip MP4 H.264/AAC theo các điểm cắt được phát hiện, giữ âm thanh của clip.
- **Âm thanh gốc:** trích track âm thanh đầu tiên thành M4A, bao gồm lời thoại, nhạc và âm thanh môi trường; không tách nhạc nền.
- **Danh sách phân tích:** tải JSON trong báo cáo mở bằng **Xem kết quả** ở thanh công cụ trên. Chứa điểm cắt, tham số, đường dẫn và mô tả AI đã hoàn tất.

Node phân tích chỉ có cổng video đầu vào, không có đầu ra bên phải. Các node ảnh/video/âm thanh được tạo độc lập có thể nối vào luồng tiếp theo và được nhóm theo loại tư liệu, thứ tự cảnh.

Giao diện tái sử dụng khung node, trình phát video, ô prompt và bộ chọn mô hình văn bản theo nhà cung cấp của Toonflow, sử dụng theme và thẻ hành động phía dưới khi chọn node. **Xem kết quả** chỉ xuất hiện trên thanh công cụ phía trên. Báo cáo có mục lục cảnh bên trái, hình/mô tả bên phải; chuyển giữa keyframe và video, chỉ nạp mục đang chọn, dừng phát và giải phóng tệp khi đóng hoặc đổi mục. Phần tổng hợp toàn phim chỉ hiện khi có kết quả, theo tiêu đề và đoạn văn. Bấm nút phân tích ở node video chỉ tạo và nối node, không tự chạy xử lý hoặc gọi AI.

## Phát hiện cắt cảnh cục bộ

Không cần Python, mô hình thị giác hoặc API mô hình. Mỗi frame được giải mã theo timestamp thật, cạnh dài nhất thu còn 256 pixel nhưng không giảm tốc độ khung hình. **Theo từng frame** nghĩa là kiểm tra tất cả frame đã giải mã; đầu ra vẫn chỉ một keyframe mỗi cảnh.

Điểm phát hiện được tính từ **75% chênh lệch không gian RGB và 25% chênh lệch biểu đồ màu đã làm mượt**, trên thang 0–100 riêng của bộ phát hiện.

- **Adaptive:** lấy trung vị điểm thay đổi trong khoảng gần 1,2 giây để ước tính chuyển động nền, giữ tối đa 180 frame; ngưỡng là `max(4, trung vị) × ngưỡng cắt cảnh`, mặc định ngưỡng cắt là 3.
- **Content:** dùng điểm thay đổi tuyệt đối, ngưỡng mặc định 27.
- **Cảnh ngắn nhất:** mặc định 0,6 giây. Điểm cắt phải là đỉnh cục bộ; khi các điểm quá gần nhau giữ điểm mạnh hơn. Frame chớp tạm rồi quay về hình cũ bị hạn chế, đoạn đuôi ngắn hơn mức tối thiểu được nhập vào cảnh trước.

Giảm ngưỡng có thể tăng số điểm cắt, tăng ngưỡng có thể giảm. Nếu không có điểm cắt, cả video là một cảnh. Bộ phát hiện dựa trên biến đổi hình ảnh, không bảo đảm bắt hết chuyển cảnh mờ dần hoặc biến đổi ngữ nghĩa và không nhất thiết giống bộ phát hiện khác.

Giải mã dùng các khối RGB tạm thời rồi xóa sau khi xử lý; RAM giữ frame/khối/timestamp đang cần. Khi giải mã nhanh hơn phân tích, dung lượng đĩa tạm có thể tăng. Các clip bị cắt được mã hóa lại, thời gian phụ thuộc độ phân giải, thời lượng và số cảnh.

## AI hỗ trợ phân tích

Node mới mặc định tắt AI và chỉ tách cảnh cục bộ; node cũ giữ trạng thái công tắc trước đó. Khi bật thủ công, chọn mô hình văn bản đã được cài trong ứng dụng và bật **Phân cảnh** hoặc **Chuyển động**. Mô hình phải hiểu ảnh; có tên trong danh sách không chứng minh đã kiểm thử khả năng thị giác. Có thể nhập trọng tâm phân tích tối đa 2.000 ký tự (bố cục, di chuyển diễn viên, chuyển động camera, nhịp dựng...). Yêu cầu này dùng cho cả phân tích từng cảnh và tổng kết. Chỉ gửi AI khi người dùng bấm bắt đầu phân tích hoặc nút phân tích AI; phí tính theo nhà cung cấp.

Kết quả cục bộ được lưu trước, sau đó lần lượt phân tích từng cảnh. Thường lấy ba frame đầu, giữa và cuối; cảnh ngắn loại các frame trùng. Ảnh cho AI thu trong phạm vi 640 × 640. Danh sách cũ không lưu thời điểm lấy mẫu có thể dùng keyframe duy nhất và đánh dấu chuyển động máy quay là **Không thể xác nhận**.

Mỗi cảnh gửi một yêu cầu để xác định cỡ cảnh, góc quay, chuyển động và mô tả hình. Sau đó dùng mô hình văn bản tổng hợp toàn phim dựa trên các ghi chép đó. Một lượt AI tối đa 200 cảnh; tách cảnh và tư liệu cục bộ không bị giới hạn này. Không tự gửi lại request.

Khi kết quả qua kiểm tra, lưu danh sách AI mới, cập nhật tên tư liệu và hiển thị trong báo cáo: mô tả từng cảnh, tổng quan, cấu trúc tự sự, nhịp dựng, cách cắt và phản hồi trọng tâm người dùng. Nếu AI lỗi hoặc bị hủy, các kết quả cục bộ vẫn được giữ; có thể bổ sung hoặc chạy lại AI mà không cắt video lại. Nếu tất cả cảnh đã phân tích nhưng phần tổng hợp thất bại, lưu phần từng cảnh cùng lỗi; nếu giữ nguyên mô hình/trọng tâm, có thể chỉ chạy lại tổng hợp.

Frame được lấy mẫu chỉ cho phép suy luận chuyển động có giới hạn; thiếu chứng cứ phải ghi **Không thể xác nhận** hoặc **Có thể**. AI không nhận track âm thanh, không phân tích tiếng, nhạc hoặc lời thoại.

## Cài đặt và build

Node thuộc `packages/nodes/frameAnalysisNode` và được build bằng luồng node hiện có. Dùng lại FFmpeg, mô hình, tệp workspace và API Canvas, không cần Python hoặc dịch vụ riêng. Muốn tạo node tư liệu độc lập, cần bật plugin node ảnh/video/âm thanh tương ứng. FFmpeg cần hỗ trợ rawvideo, segment, libx264 và AAC.

Tại thư mục gốc repository:

~~~powershell
bun install
bun run --filter '@toonflow/node-frame-analysis' typecheck
bun run --filter '@toonflow/node-frame-analysis' build
~~~

Kết quả nằm tại `build/nodes/frameAnalysisNode.umd.js`; lệnh gốc `build:nodes` cũng gồm node này. Khi phát triển, dùng `bun run --filter '@toonflow/node-frame-analysis' build --mode development` để đồng bộ vào `data/nodes`. Các nút truy cập phân tích từ Video/Tạo video thuộc gói node tương ứng.

Tư liệu tạo ra lưu trong workspace theo `assets/ID-node/analysis…`. Nếu tác vụ cục bộ hủy hoặc thất bại, các tệp chưa được ghi nhận của lượt đó được dọn; kết quả thành công được giữ để Undo hoặc sử dụng trong các node tư liệu. Phân tích lại tạo nhóm mới. Ảnh tham chiếu AI tạm sẽ được xóa khi xử lý xong, hủy hoặc lỗi.

Việc kiểm chứng phát triển dùng typecheck, build và thao tác cục bộ thích hợp. Trong lượt dịch giao diện này không gửi yêu cầu AI thực; chất lượng phản hồi của mô hình và tính tương thích của nhà cung cấp chưa được kiểm chứng.
