---
name: v118workflow
description: Quy trình sản xuất Toonflow v1.1.8 kết hợp phương pháp biên kịch, 12 kỹ thuật kể chuyện, 11 phong cách mỹ thuật và cách làm tài nguyên, phân cảnh, prompt ảnh/video. Làm theo giai đoạn có xác nhận, duy trì Canvas kịch bản, tài nguyên và từng tập; dùng cho dự án kiểu cũ, sản xuất nhiều tập hoặc tiếp tục dự án.
metadata:
  version: "1.1.0"
  displayName: Quy trình sản xuất theo tập v1.1.8
  author: Toonflow
  github: https://github.com/HBAI-Ltd/Toonflow-app
---

# Quy trình sản xuất theo tập v1.1.8

**Ngôn ngữ sử dụng:** Mặc định giao tiếp, mô tả phân cảnh, danh sách tài nguyên và prompt bằng tiếng Việt, trừ khi người dùng yêu cầu khác. Không dịch định danh, trường JSON, lời thoại gốc hoặc nhãn tham chiếu có sẵn. Các đoạn tiếng Trung cũ là tài liệu phương pháp, không phải yêu cầu xuất kết quả tiếng Trung.

Chuyển quy trình cũ “Dây chuyền viết kịch bản + Dây chuyền sản xuất + Bàn làm việc video” thành các thao tác Canvas hiện tại của Toonflow. Thứ tự thực hiện mỗi bước là: **Đọc dữ liệu đầu vào đã xác nhận → Hoàn thành giai đoạn hiện tại → Lưu vào Canvas được chỉ định → Đọc lại và kiểm tra → Trình bày kết quả → Chờ người dùng xác nhận**. Bản tóm tắt trò chuyện không thay thế sản phẩm đã lưu trên Canvas, và việc bắt đầu tác vụ không đồng nghĩa phương tiện đã được tạo thành công.

Kỹ năng này chứa cả các quy trình con và kiến thức chuyên môn cần thiết để hoàn thành chúng. Đọc tài liệu tham chiếu (reference) của giai đoạn hiện tại trước, rồi làm theo chỉ dẫn trong đó để đọc phương pháp chung và thể loại/phong cách đã chọn từ `references/knowledge/`. Không được chỉ điền vài dòng tóm tắt theo bảng quy trình rồi tuyên bố hoàn thành, cũng không áp dụng đồng thời mọi thể loại và phong cách. Xem [Ánh xạ nguồn](references/sourceMap.md) để biết cơ sở của phiên bản cũ và các lựa chọn khi chuyển đổi. Không gọi cơ sở dữ liệu cũ, thao tác ghi XML hoặc giao diện riêng cho Agent con; không tự động áp dụng cơ chế chọn mô hình của workflow khác.

Kiểm tra nghiệm thu từng giai đoạn theo [Đối chiếu hợp đồng đầu ra](references/sourceMap.md#阶段产出契约对照), bao gồm nội dung, số lượng, ánh xạ nguồn và trạng thái. Kỹ năng này giữ nguyên các sản phẩm cốt lõi cùng hai lộ trình sản xuất của phiên bản cũ; lưu trữ trên Canvas, xác nhận từng bước và nghiệm thu kết quả tạo là những yêu cầu mới khi chuyển đổi. Không coi hai giai đoạn trùng tên hoặc tệp đã được tạo là bằng chứng đầu ra tương đương, và không hứa hai lần tạo bằng AI sẽ giống nhau từng chữ hoặc từng khung hình.

## Xác định tiến độ và Canvas trước

1. Xác nhận dự án hiện tại, mục tiêu của người dùng trong lượt này, dữ liệu đầu vào sẵn có và kết quả đã xác nhận. Nếu đã có kịch bản hoàn chỉnh, được chốt, trước tiên lưu nguyên văn kịch bản vào các node chính thức trên Canvas tổng kịch bản theo bước khởi tạo; sau đó mới làm tài nguyên cơ sở hoặc tập cần sản xuất. Không tự suy ngược để bịa tiểu thuyết, bảng sự kiện hoặc khung cốt truyện. Khi tiếp tục dự án cũ, bắt đầu từ giai đoạn chưa được xác nhận đầu tiên.
2. Trước tiên đọc [Khởi tạo và lưu trữ dự án](references/projectSetup.md) cùng [Thực thi trên Canvas](references/canvasOperations.md) để kiểm tra công cụ, vị trí tệp và các node hiện tại. Kế thừa cấu hình đã xác nhận, chỉ bổ sung những mục còn thiếu có ảnh hưởng đến bước hiện tại.
3. Mọi Canvas đều nằm trong **không gian làm việc của dự án do người dùng chọn**, không phải thư mục cài kỹ năng. Cấu trúc mặc định như bên dưới. Dự án hiện có có thể dùng thư mục và tên mà người dùng đã xác nhận, nhưng vẫn phải có một Canvas tổng kịch bản, một Canvas tổng tài nguyên và một Canvas sản xuất riêng cho mỗi tập.

```text
项目工作区/
└─ 画布/
   ├─ 剧本.json
   ├─ 资产.json
   └─ 分集/
      ├─ 第001集.json
      ├─ 第002集.json
      └─ …
```

| Canvas | Nội dung chính thức duy nhất |
| --- | --- |
| Kịch bản | Cấu hình dự án, chỉ mục nguồn, sự kiện theo chương, khung cốt truyện và đề cương các tập, chiến lược chuyển thể, kịch bản chính thức từng tập, chỉ mục đường dẫn Canvas |
| Tài nguyên | Tài nguyên cơ sở và tài nguyên phát sinh của toàn bộ tác phẩm, quan hệ cha-con, thiết kế hình ảnh, prompt, ảnh đã chọn, danh sách tập sử dụng |
| Tập N | Nguồn kịch bản/bản chụp làm việc của tập, kế hoạch đạo diễn, bảng storyboard, node tư liệu tham chiếu, ảnh storyboard, video, bản ghi lựa chọn và bàn giao |

Ảnh trên Canvas của từng tập là tham chiếu cục bộ đến cùng tệp tài nguyên, không tạo thành một thư viện tài nguyên chính thức thứ hai. Không thể nối trực tiếp giữa hai Canvas; trước tiên chuyển Canvas để đọc đầu ra tài nguyên thực tế, rồi tạo node tham chiếu trong tập hiện tại. Giữ nguyên vị trí tệp tư liệu mà ứng dụng trả về; không di chuyển kết quả đã tạo trong `assets/` chỉ để sắp xếp thư mục Canvas.

`addCanvas` hiện không có tham số thư mục. Bắt buộc làm theo [Cách lưu trữ Canvas](references/canvasOperations.md#画布创建与归档) để đặt các tệp đúng vị trí trong cây thư mục, tìm lại đường dẫn/ID thực tế rồi mới điền sản phẩm vào Canvas. Không được để toàn bộ Canvas ở thư mục gốc mà vẫn tuyên bố đã hoàn tất lưu trữ.

## Quy trình chính và các điểm xác nhận

Mỗi hàng là một giai đoạn riêng biệt. Trước khi thực hiện, đọc tài liệu tham chiếu của hàng đó và những kiến thức được chỉ định. Có thể tái sử dụng đầu ra đã được xác nhận rõ ràng, đồng thời ghi lại nguồn. Việc “bỏ qua” phải có lý do phù hợp và lựa chọn rõ ràng của người dùng. Nếu dự án không chuyển thể từ tác phẩm gốc, có thể rút ngắn hoặc bỏ qua phần sự kiện theo chương, khung cốt truyện hoặc chiến lược dựa trên đầu vào sẵn có; không được bịa thêm sự kiện hoặc trải nghiệm.

| Bước | Quy trình con | Vị trí lưu sản phẩm và kết quả cần xác nhận trong lượt này |
| --- | --- | --- |
| 0 | [Khởi tạo dự án](references/projectSetup.md) | Canvas kịch bản: cấu hình dự án, phạm vi, thư mục và chỉ mục Canvas |
| 1 | [Nguồn và sự kiện theo chương](references/sourceEvents.md) | Canvas kịch bản: các chương thực tế và bảng sự kiện; xác nhận tính bao phủ của nguồn và tính xác thực |
| 2 | [Khung cốt truyện](references/storySkeleton.md) | Canvas kịch bản: hạt nhân câu chuyện, hành trình phát triển nhân vật, đề cương từng tập, nhật ký lược bỏ; xác nhận phương án chia tập |
| 3 | [Chiến lược chuyển thể](references/adaptationStrategy.md) | Canvas kịch bản: nguyên tắc và ranh giới chuyển thể; xác nhận các lựa chọn giữ/bỏ |
| 4 | [Kịch bản từng tập](references/episodeScript.md) | Canvas kịch bản: kịch bản hoàn chỉnh của tập hiện tại; mặc định xác nhận từng tập, rồi mới quyết định viết tiếp tập nào |
| 5 | [Trích xuất tài nguyên cơ sở](references/baseAssets.md) | Canvas tài nguyên: nhân vật/bối cảnh/đạo cụ và các tập xuất hiện; xác nhận tái sử dụng, tạo mới và thiết kế hình ảnh |
| 6 | [Tạo ảnh tài nguyên](references/generateAssets.md) | Canvas tài nguyên: prompt và ảnh tài nguyên cơ sở; xác nhận phương án tạo trước, rồi xác nhận ảnh được chọn |
| 7 | [Kế hoạch đạo diễn](references/directorPlan.md) | Canvas của tập hiện tại: chia cảnh, thống kê thoại, cảm xúc, chuyển tiếp và lưu ý |
| 8 | [Phân tích tài nguyên phát sinh](references/deriveAssets.md) | Canvas tài nguyên: danh sách tài nguyên phát sinh của tập và tài nguyên cha; xác nhận tất cả, một phần, điều chỉnh hoặc bỏ qua |
| 9 | [Tạo ảnh tài nguyên](references/generateAssets.md) | Canvas tài nguyên: ảnh phát sinh đã được chọn; nếu không cần tài nguyên phát sinh, phải ghi rõ lý do bỏ qua |
| 10 | [Bảng storyboard](references/storyboardTable.md) | Canvas của tập hiện tại: cảnh → đoạn phim → góc máy, ánh xạ tài nguyên thực tế và kết quả kiểm tra |
| 11 | [Dựng bảng node storyboard](references/storyboardPanel.md) | Canvas của tập hiện tại: tạo node văn bản, tham chiếu, ảnh/video theo chế độ thực tế; xác nhận số lượng, thời lượng và kết nối |
| 12 | [Ảnh storyboard](references/storyboardImages.md) | Canvas của tập hiện tại: ảnh storyboard cho chế độ khung hình đầu; chế độ văn bản với nhiều tham chiếu có thể bỏ qua nếu ghi rõ lý do |
| 13 | [Video và bàn giao](references/videoProduction.md) | Canvas của tập hiện tại: prompt/cấu hình video → kết quả tạo → lựa chọn và bàn giao, với ba điểm xác nhận độc lập |

Lặp lại bước 7–13 cho mỗi tập. Sau khi hoàn thành tập hiện tại, cho người dùng chọn tập tiếp theo; không coi “đã xong một tập” là “đã xong toàn bộ phim”. Có thể bổ sung tài nguyên cơ sở theo từng lô dựa trên kịch bản đã xác nhận, nhưng tài nguyên dùng xuyên tập vẫn được duy trì trên cùng một Canvas tài nguyên.

## Cách dùng kiến thức trong từng giai đoạn

| Nội dung công việc | Kiến thức bắt buộc đọc | Sản phẩm bắt buộc thực hiện |
| --- | --- | --- |
| Khung cốt truyện, chuyển thể, kịch bản từng tập | [Phương pháp viết kịch bản](references/knowledge/scriptCraft.md) + thể loại của dự án trong [Các thể loại tự sự](references/knowledge/narrativeGenres.md) | Canvas kịch bản: mong muốn và trở ngại của nhân vật, hành trình phát triển nhân vật, tiến triển cảm xúc, cách tiết lộ thông tin, cú ngoặt/gợi mở và các lựa chọn chuyển thể cụ thể |
| Thiết kế và prompt cho tài nguyên cơ sở/phát sinh | [Thiết kế tài nguyên](references/knowledge/assetDesign.md) + phong cách đã chọn trong [Phong cách mỹ thuật](references/knowledge/visualStyles.md) | Canvas tài nguyên: đặc điểm nhận diện nhân vật, không gian và ánh sáng/màu bối cảnh, cấu trúc đạo cụ, điểm khác biệt của các biến thể, prompt có thể thực thi và phiên bản được chọn |
| Kế hoạch đạo diễn và storyboard | [Thiết kế góc máy](references/knowledge/shotCraft.md) + thể loại tự sự của dự án; đọc thêm phong cách mỹ thuật đã chọn nếu có biểu đạt hình ảnh | Canvas của tập hiện tại: ý đồ góc máy, phạm vi thông tin có thể nhìn thấy, vị trí và trục nhìn, nhịp độ và tính liên tục, được ghi thành kế hoạch đạo diễn và góc máy cụ thể |
| Prompt ảnh storyboard và nghiệm thu | [Kỹ thuật prompt ảnh](references/knowledge/imagePromptCraft.md) + phong cách mỹ thuật đã chọn | Canvas của tập hiện tại: trạng thái khung hình đầu, cỡ cảnh/hướng nhìn, ánh xạ tham chiếu thực tế, prompt phù hợp mô hình và kết quả kiểm tra |
| Prompt video và nghiệm thu | [Kỹ thuật prompt video](references/knowledge/videoPromptCraft.md) + phương pháp thể hiện video của phong cách mỹ thuật đã chọn | Canvas của tập hiện tại: trình tự thời gian/hành động/âm thanh theo chế độ chọn, liên kết tham chiếu thực, tính liên tục chuyển động và nghiệm thu từng đoạn |

Thể loại tự sự quyết định cách tổ chức thông tin, cảm xúc và góc máy; phong cách mỹ thuật quyết định hình dáng, chất liệu, ánh sáng/màu sắc và cách thể hiện. Hai yếu tố phải được chọn độc lập: không coi “bí ẩn/giật gân” là một phong cách hình ảnh, cũng không coi “đất nặn” là thể loại cốt truyện. Nếu người dùng đã chọn rõ ràng thì giữ nguyên; nếu chưa, hãy đề xuất phương án có lý do dựa trên nội dung và chỉ ghi vào cấu hình dự án sau khi được xác nhận.

Kiến thức chuyên môn không phải giấy phép để tự thêm tình tiết. Ở giai đoạn viết kịch bản, có thể dùng các phương pháp tổ chức cấu trúc và tạo cú ngoặt trong phạm vi chuyển thể người dùng cho phép. Sau khi kịch bản đã chốt, thủ pháp thể loại chỉ hướng dẫn cách thể hiện các sự kiện đã xác nhận; không được tự thêm tình tiết đánh lạc hướng, thay kết thúc, đảo thứ tự sự kiện hoặc thêm cảnh. Ví dụ về phong cách cũng không được ghi đè danh tính nhân vật, thế giới quan và ảnh tham chiếu đã xác nhận.

Khi có mâu thuẫn giữa phương pháp chung, ngoại lệ của thể loại và mẫu mô hình cũ, trước tiên phải đáp ứng nội dung đã được người dùng xác nhận cùng khả năng thực tế của công cụ hiện tại, sau đó mới áp dụng phương pháp phù hợp dự án. Không ép mọi dự án theo khuôn phiên bản cũ như một tuyến truyện nhịp nhanh, thời lượng góc máy cố định hoặc mẫu màu da/chiều cao. Điều kiện áp dụng cho phim ngắn thương mại, dàn nhân vật đông, khoảng lặng và biến thể đặc biệt được giải thích trong các tài liệu kiến thức tương ứng.

Mỗi lần chỉ ghi **phương pháp và kết quả thực sự được dự án này áp dụng** lên Canvas tương ứng. Ví dụ: manh mối nào được giấu trong cảnh này, vì sao nhân vật đứng nghiêng người, nguồn sáng chính đến từ đâu và những đặc điểm nào của ảnh gốc phải giữ nguyên. Không sao chép cả tài liệu kiến thức thành node; cũng không chỉ ghi “đã tham khảo kỹ năng X” mà thiếu quyết định sản xuất cụ thể để người dùng xem xét.

## Cách xác nhận từng bước

- Trước tiên ghi toàn bộ kết quả có thể xem xét của giai đoạn hiện tại vào Canvas, dùng công cụ đọc lại để xác nhận đã lưu. Nếu văn bản dài, có thể chia node theo chương, tập hoặc cảnh, nhưng không cắt ngắn nội dung chính thức. Dùng `fitCanvas` để hiển thị kết quả của lượt này.
- Trong node văn bản “Nhật ký giai đoạn” trên Canvas hiện tại, ghi rõ giai đoạn/số tập, phiên bản đầu vào, ID node đầu ra, kết quả kiểm tra, trạng thái và các mục đang chờ quyết định. Phân biệt các trạng thái `草稿` (bản nháp), `待确认` (chờ xác nhận), `已确认` (đã xác nhận), `生成中` (đang tạo), `失败` (thất bại), `待复核` (chờ rà soát lại), `已跳过` (đã bỏ qua).
- Trình bày tên Canvas và đường dẫn tương đối, bản tóm tắt sản phẩm, các vấn đề cụ thể và nội dung bước tiếp theo. Dùng `askUser` nếu khả dụng để người dùng chọn “Xác nhận chuyển bước tiếp / Sửa mục được chỉ định / Làm lại bước hiện tại”. Nếu không có công cụ hỏi, hãy hỏi trong cuộc trò chuyện và chờ phản hồi. Kết thúc giai đoạn tại đây trong lúc chờ người dùng; không tạo sẵn node sản xuất cho giai đoạn sau hoặc kích hoạt tạo phương tiện.
- Khi người dùng phản hồi, ghi lại quyết định. Chỉ sửa những mục họ chỉ định, đọc lại kết quả sửa rồi mới xác nhận. Không coi kiểm tra đạt, hủy câu hỏi, bỏ qua trao đổi, quá thời gian hoặc im lặng là phê duyệt. Lệnh “tiếp tục” chỉ chuyển đến giai đoạn kế tiếp đang chờ xác nhận.
- Cấu hình, tài nguyên hoặc lô tạo cụ thể đã được người dùng xác nhận vẫn có hiệu lực; không yêu cầu cấp lại cùng một quyền. Nếu người dùng đã cho phép rõ một lô cùng giai đoạn trên nhiều tập, có thể thực hiện đúng phạm vi đó và trình bày kết quả chung. Nếu chưa được phép, vẫn phải xác nhận từng tập, không coi mục tiêu toàn dự án là cho phép chạy toàn bộ quy trình.
- Phương án tạo nội dung phải gồm mô hình/chế độ thực tế, đối tượng và số lượng, prompt, tham chiếu, thời lượng/tỷ lệ khung hình/độ phân giải và các chi phí đã biết; chi phí chưa rõ phải ghi là chưa rõ. Chỉ gọi tạo nội dung sau khi đã được xác nhận cho đúng lô hiện tại. Nếu thất bại, trước tiên kiểm tra trạng thái thực tế; không thêm phương án ứng viên, đổi mô hình hoặc thử lại có phí vượt phạm vi đã xác nhận.

## Tiếp tục dự án, chỉnh sửa và xử lý thất bại

Mỗi lần tiếp tục dự án phải lấy nội dung Canvas và bản ghi xác nhận của người dùng làm căn cứ, không chỉ dựa vào trí nhớ cuộc trò chuyện. Nếu kết quả đã có nhưng chưa được xác nhận, hãy trình bày kết quả đó để xin xác nhận bổ sung, không tạo lại.

Sau khi thay đổi nội dung ở bước trước, đánh dấu những bước sau thực sự bị ảnh hưởng: nếu kịch bản đổi, kiểm tra kế hoạch đạo diễn/storyboard/video của tập đó; nếu phiên bản tài nguyên đổi, kiểm tra storyboard/video đang tham chiếu tài nguyên đó. Đánh dấu chúng là chờ rà soát lại, giữ nguyên sản phẩm cũ và lịch sử lựa chọn, không tự làm lại toàn bộ phim. Các xác nhận không bị ảnh hưởng vẫn có hiệu lực.

Nếu thiếu nguồn, thư mục chưa được sắp đúng vị trí, thiếu công cụ hoặc ghi tệp thất bại, hãy nêu cụ thể các mục chưa hoàn tất và các bước khôi phục. Không được trình bày văn bản trò chuyện, node rỗng, đường dẫn giả, đầu ra cũ hoặc tác vụ vừa khởi chạy như thể giai đoạn đã hoàn thành. Chỉ xử lý phạm vi người dùng yêu cầu trong lượt này; khi chỉ tư vấn hoặc chỉnh sửa kỹ năng, không tạo dự án sản xuất.
