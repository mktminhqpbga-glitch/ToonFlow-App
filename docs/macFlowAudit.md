# Rà soát MacFlow ngày 23/11/2026

Nhánh `feat/macflow-media-studios`, mốc trước khi sửa `1b3bf58f93446ec2c2ba3ea24cadab79cf7e07b7`.

## 1. Phạm vi đã xem

| Khu vực | Cách rà soát |
| --- | --- |
| Web và ứng dụng chủ | Kiểm tra kiểu toàn workspace Web, build, mở Tổng quan, Xưởng ảnh, Xưởng video và Canvas trên bản standalone. Đọc luồng từ tác vụ được chọn tới tệp kết quả và từ trạng thái hàng chờ tới thông báo trên màn hình. |
| Server và workspace | Kiểm tra kiểu, build standalone và chạy các ca kiểm thử hợp đồng hiện có. Rà soát ghi tệp, lịch sử và trạng thái tác vụ ở ranh giới API của hai xưởng. |
| Node, tool, extension, MCP và thư viện dùng chung | Kiểm tra kiểu theo từng workspace, build sản phẩm tích hợp, build và cài node trong hướng dẫn bằng SDK trên máy chủ cục bộ. Kiểm tra lại plugin Video → Kịch bản và tệp ZIP phân phối. |
| Chrome và dịch vụ tích hợp | Kiểm tra cú pháp tệp JavaScript của extension, chạy các kiểm thử AI Chrome và adapter MacFlow hiện có, chạy bộ kiểm thử Muse2API Python. Chế độ sử dụng tab và tài khoản thật cần nghiệm thu riêng. |
| Mã tham khảo | Lập danh mục `research/` và đối chiếu điểm vào ứng dụng. Các bản tham khảo trong đó có vòng đời và bộ kiểm tra riêng. |

Các phép thử hành vi dùng workspace tạm và dữ liệu giả lập. Kiểm tra kiểu toàn workspace bao phủ hợp đồng TypeScript. Kiểm tra tính năng dựa trên các luồng được liệt kê bên dưới.

## 2. Lỗi đã tái hiện và sửa

| Lỗi | Tái hiện trước khi sửa | Kết quả sau khi sửa |
| --- | --- | --- |
| Lệnh gốc dừng với `FileNotFound` | `bun run typecheck` và `bun run --filter @toonflow/web typecheck` dừng trước khi chạy trình biên dịch trên Linux. Trace cho thấy Bun 1.4.3 tìm `packages/teamscaffold`, trong khi thư mục là `teamScaffold`. | Các lệnh gốc duyệt đúng tên thư mục trên đĩa. `bun run typecheck` chạy 47/47 workspace. `bun run dev` mở được cả Web và Server. [Mã chọn workspace](../scripts/runWorkspaces.ts) |
| Xem một kết quả nhưng tải toàn bộ media lịch sử | Với lịch sử 5 ảnh, bản cũ yêu cầu cả 5 tệp khi chỉ mở ảnh đầu. URL xem trước còn được giữ cho tới khi đổi dự án hoặc đóng xưởng. | Lần đầu chỉ đọc ảnh đang được xem. Đổi tác vụ đọc đúng ảnh mới và giải phóng phần xem trước cũ. Giảm từ 5 xuống 1 lần đọc tệp ở lần mở trong tình huống đã kiểm tra. [Trang xưởng](../apps/web/src/pages/mediaStudio/index.vue) |
| Tệp kết quả thiếu khiến màn hình báo đang tải mãi | Trả 404 cho tệp đã lưu. Bản cũ giữ trạng thái “Đang tải file từ workspace…” và giữ mục cache lỗi. | Hiển thị lý do ngay tại ô xem trước và có nút **Tải lại bản xem trước**. Kiểm chứng lần tải lại hiển thị ảnh khi tệp trở lại. Trình duyệt báo lỗi giải mã riêng cho tệp không mở được. [Trang xưởng](../apps/web/src/pages/mediaStudio/index.vue) |
| Thông báo hàng chờ và lỗi gửi có thể gây hiểu nhầm | Một lần gọi hàng chờ thất bại ghi lỗi vào lịch sử. Phản hồi HTTP 502 dạng chữ không đọc được bằng `response.json()`. Với lỗi HTTP chưa biết kết quả, thông báo có thể nói tác vụ bị từ chối trong khi bản ghi đã đánh dấu gián đoạn. | Lỗi hàng chờ có vị trí riêng và tự hết khi kết nối hồi phục. Phản hồi không đọc được hiện mã HTTP. Trạng thái chưa xác nhận hiện đúng ID để kiểm tra. Ca 502 gửi đúng một yêu cầu tạo. [Trang xưởng](../apps/web/src/pages/mediaStudio/index.vue) |

## 3. Kết quả kiểm tra

- `bun run typecheck` đạt 47/47 workspace. Plugin phân phối riêng `videoScriptNote` qua `vue-tsc`, build Vite và kiểm tra ZIP riêng.
- `bun run build` và `bun run build:server` cùng đạt. Gói standalone bao gồm Web, Server, node, tool, extension và MCP. `bun run dev` được mở với thư mục dữ liệu tạm và đã thấy hai tiến trình sẵn sàng.
- Bộ kiểm thử Server hiện có chạy riêng theo từng tệp, tổng cộng **60 đạt, 0 lỗi**. Phạm vi gồm lịch sử xưởng, hợp đồng mac2API, AI Chrome và thư viện prompt.
- Bộ kiểm thử Muse2API Python có **196 đạt**. Có một cảnh báo phụ thuộc AnyIO về bí danh sẽ bị gỡ trong Pytest 10.
- `go test` của Gemini Web To API đạt ở chế độ kiểm thử cục bộ với Go 1.25.12. CDN của Go proxy trả 403 cho `klauspost/compress`, nên lệnh dùng một modfile tạm trỏ tới mã nguồn chính thức cùng tag `v1.18.7`. Ca E2E cần dịch vụ thật được tắt trong lượt này.
- Chromium xác nhận tải đúng tệp đang chọn, thử tải lại sau 404, xóa thông báo hàng chờ sau khi API hồi phục và giữ ID sau HTTP 502. Đã mở Tổng quan, Canvas và cả hai xưởng, thử lưu mẫu luồng trong Xưởng video.
- SDK đã build được ví dụ `scriptMemoNode` từ hướng dẫn. Máy chủ thử cài được tệp ví dụ và nhận đúng phiên bản `1.2.0` của plugin Video → Kịch bản.

## 4. Việc cần hoàn thiện theo thứ tự

| Ưu tiên | Việc cần làm | Điều kiện để coi là xong |
| --- | --- | --- |
| 1 | Nối **Thiết lập luồng** với bộ thực thi và hàng chờ. Bản hiện tại lưu và kiểm tra cấu hình mẫu. | Một mẫu A → các bước → Z chạy theo đúng thứ tự. Mỗi bước đọc đúng nguồn đã chọn và có kết quả riêng. Lưu tiến độ để tải lại và chạy lại từ bước lỗi. Giới hạn ảnh/video tiếp tục độc lập. |
| 2 | Nghiệm thu với phiên bản mac2API, mô hình và trình duyệt đang dùng thực tế. | Tạo được ảnh và video có tư liệu tham chiếu bằng tài khoản thử. Kiểm tra API nhận tham chiếu, trạng thái mất kết nối, khôi phục theo ID, hủy, tải kết quả và đưa vào Canvas. Ghi phiên bản, mô hình và ID tác vụ để tái hiện. |
| 3 | Đo và giảm chi phí mở app, mở Canvas và mở lịch sử dài. | Build hiện báo gói vào Web khoảng 9,29 MB sau minify và gói Workspace khoảng 5,31 MB. Đo tải lần đầu trên máy mục tiêu, sau đó tách phần chỉ dùng khi mở tính năng. So sánh dung lượng truyền và thời gian tương tác trước/sau cùng một tình huống. |
| 4 | Rà soát nhất quán giao diện, trạng thái và khả năng truy cập. | Mỗi màn chính có trạng thái trống, đang tải, lỗi và khôi phục. Thử giao diện sáng/tối, khung hẹp, bàn phím và ba ngôn ngữ hỗ trợ. Dùng cùng mẫu báo lỗi khi người dùng cần ID để tra cứu. |
| 5 | Nghiệm thu các chế độ triển khai và tích hợp riêng. | Chạy lại các luồng cần macOS hoặc Chrome Profile thật, cổng mac2API và cấu hình nhiều người dùng nếu có sử dụng. Kiểm tra với dữ liệu thử và báo rõ môi trường cho từng kết quả. |

## 5. Cách gửi lỗi để lần sửa sau dễ tái hiện

```text
Màn hình và thao tác: Xưởng video → Thêm vào hàng chờ
Bản đang dùng: commit hoặc phiên bản MacFlow
Các bước: 1. ... 2. ... 3. ...
Mong đợi: ...
Thực tế: ...
Mô hình, trạng thái, mã HTTP, ID tác vụ: ...
Sau tải lại trang: ...
```

Ảnh chụp kèm thông báo đầy đủ giúp đối chiếu nhanh hơn. Chia sẻ ID tác vụ, mã HTTP và nội dung đã lọc thông tin riêng tư. Hướng dẫn dành cho lần sửa tiếp theo nằm ở [Phát triển MacFlow với Codex](macFlowDevelopment.md).
