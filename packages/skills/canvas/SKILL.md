---
name: canvas
description: Hướng dẫn thao tác Canvas Toonflow bằng công cụ chính thức; tạo, chuyển, đổi tên Canvas; thêm, di chuyển, đổi tên, nối và xóa node; tự sắp xếp Canvas, chỉnh khung nhìn và gọi chức năng node. Dùng khi người dùng muốn thao tác Canvas hiện tại hoặc xây dựng luồng node.
metadata:
  version: "2.1.0"
  displayName: Hướng dẫn thao tác Canvas
  author: Toonflow
  github: https://github.com/HBAI-Ltd/Toonflow-app
---

# Hướng dẫn thao tác Canvas

**Ngôn ngữ sử dụng:** Mặc định trình bày kết quả, giải thích thao tác, thông báo và mô tả node bằng tiếng Việt, trừ khi người dùng yêu cầu khác. Giữ nguyên ID, tên hàm, schema, JSON và tên riêng gốc. Nội dung tiếng Trung trong phần phương pháp cũ không phải yêu cầu trả lời người dùng bằng tiếng Trung.

Điều khiển Canvas đang chạy bằng các công cụ “Thao tác Canvas” đã được bật. Các công cụ chỉ khả dụng khi có ngữ cảnh Canvas. Nếu thiếu công cụ, hãy đề nghị người dùng mở Canvas của dự án đích và xác nhận công cụ đã bật; không lách qua công cụ bằng cách chỉnh sửa trực tiếp JSON của Canvas.

## Quy trình thao tác

1. Khi đã biết ID của node, hãy đọc trực tiếp node đích; nếu chưa biết, dùng `getCanvas({})` để xem tổng quan Canvas đang hoạt động, rồi dùng `findCanvasNodes` tìm theo tên, loại hoặc trạng thái được chọn. Chỉ truy vấn các loại node bằng `getCanvas({ include: ["nodeTypes"] })` khi cần thêm node.
2. Chọn thao tác bên dưới theo yêu cầu của người dùng và chờ kết quả trả về sau mỗi lần gọi. Các lần gọi tiếp theo dùng ID được trả về ở bước trước; không đoán ID, loại node, cổng hoặc hàm của node.
3. Dùng `getCanvasNodes` để đọc đúng các trường cần thiết, `getCanvasEdges` để kiểm tra các kết nối liên quan. Khi cần chỉnh sửa nội dung node, dùng `getNodeTools` đọc mô tả và `parameters` đầy đủ của hàm node, rồi gọi qua `nodeTools`.
4. Sau khi điều chỉnh cấu trúc, gọi `fitCanvas` nếu cần để hiển thị kết quả; sau đó dùng `getCanvasNodes` / `getCanvasEdges` chỉ kiểm tra các node, tên và kết nối chịu ảnh hưởng. `arrangeCanvas` đã tự điều chỉnh khung nhìn nên không cần gọi lại `fitCanvas`. Chỉ báo cáo những thao tác mà công cụ thực sự hoàn tất.

Khi làm phim, video hoặc kể chuyện, trước hết đọc [Các giai đoạn sản xuất và xác nhận](references/videoProduction.md#0-逐阶段协作). Theo mặc định, chỉ triển khai giai đoạn hiện tại đã được xác nhận. Thu thập thông tin theo từng bước, trình bày kết quả của giai đoạn, hỏi người dùng muốn điều chỉnh gì và chờ họ xác nhận tiếp tục. Không tạo toàn bộ storyboard và node tạo nội dung cùng lúc chỉ vì người dùng nói “làm một phim ngắn”; cũng không xem việc đặt câu hỏi thất bại, bỏ qua câu hỏi hoặc im lặng là sự xác nhận.

Theo mặc định, dựa vào kịch bản hoàn chỉnh của lượt này để tạo tài nguyên nhân vật, bối cảnh và đạo cụ, rồi chia thành các đoạn có nhiều góc máy. Mỗi đoạn có một prompt video và một node video, các tài nguyên được dùng trực tiếp cho chế độ tạo từ nhiều tham chiếu. Trước khi viết prompt tài nguyên, đọc [Quy chuẩn ảnh tài nguyên](../script/references/assetGuide.md); trước khi viết prompt video, đọc [Hướng dẫn sản xuất đoạn phim](../script/references/productionGuide.md). Không được rút gọn ảnh cận mặt nhân vật và bộ ba góc nhìn đầy đủ chính diện, bên hông, phía sau thành một ảnh tình tiết chung.

Các liên kết trong tài liệu được tính tương đối từ thư mục chứa tệp hiện tại. Để tìm quy chuẩn của kỹ năng `script` ở kỹ năng khác, dùng `location` thực tế trong `available_skills`. Nếu thiếu kỹ năng phụ thuộc, hãy nêu rõ phần còn thiếu, chỉ tiếp tục các thao tác cấu trúc không phụ thuộc vào phần đó; không tự dựng quy chuẩn dựa vào mô tả sơ lược.

Các cách viết bên dưới có nghĩa là “tên công cụ (đối tượng tham số)”. Gọi trực tiếp công cụ tương ứng, không bọc thêm một lớp `{ name, args }`; chỉ riêng công cụ `nodeTools` vốn có tham số `name` và `args`.

## Đọc dữ liệu Canvas

Năm công cụ đọc dữ liệu đều hỗ trợ tham số `canvasId` tùy chọn để xác nhận Canvas đang hoạt động; không thể dùng tham số này để đọc Canvas chưa được kích hoạt. Mỗi phản hồi tối đa 64 KiB và không cung cấp bản chụp toàn bộ sơ đồ:

| Công cụ | Tham số và kết quả trả về |
| --- | --- |
| `getCanvas` | Mặc định trả về `id`, số node, số kết nối, số node được chọn và `viewport`. Dùng `include: ["canvases"]` để lấy danh sách Canvas `{ id, name }`, hoặc `include: ["nodeTypes"]` để lấy `{ type, label }` trong `availableNodeTypes`. Hai loại danh sách dùng chung cơ chế phân trang; `limit` mặc định 30, tối đa 100. |
| `findCanvasNodes` | Lọc bằng `query` (ID hoặc tên đầy đủ), `types` (tối đa 20 loại), `selectedOnly`; nếu không truyền bộ lọc thì liệt kê theo trang. Trả về bản tóm tắt `nodes`, phần xem trước tên dài tối đa 512 ký tự; `limit` mặc định 30, tối đa 100. |
| `getCanvasNodes` | `nodeIds` nhận từ 1–20 ID mỗi lần, không trùng lặp. `fields` mặc định gồm `label/type/position`, có thể chọn thêm `ports/data/outputs`. `dataKeys` giới hạn các thuộc tính riêng trong `data` cần đọc, tối đa 20; trả về dữ liệu chiếu của `nodes`. |
| `getCanvasEdges` | `nodeIds` là tùy chọn, tối đa 20; `direction` là `incoming/outgoing/both`, mặc định `both`. Chỉ khi bỏ qua các ID mới phân trang toàn bộ kết nối. Trả về `edges`; `limit` mặc định 100, tối đa 200. |
| `getNodeTools` | `nodeIds` nhận từ 1–20 ID mỗi lần, không trùng lặp; `names` có thể lọc tối đa 20 tên hàm đầy đủ. Trả về `nodeTools` (gồm `nodeId/name/description/parameters`); `limit` mặc định 20, tối đa 50. Schema không bị cắt ngắn; nếu một mục quá lớn, công cụ sẽ báo lỗi rõ ràng. |

Khi phân trang, kiểm tra `hasMore` / `nextCursor`, giữ nguyên mọi tham số truy vấn ban đầu và chỉ thay `cursor`. Mỗi lượt lọc node hoặc truy vấn kết nối quét tối đa 2.000 mục; ngay cả khi `nodes` / `edges` của trang hiện tại rỗng, `hasMore: true` vẫn có nghĩa là chưa quét hết. `totalNodes` / `totalEdges` là tổng số mục trên toàn Canvas, không phải số mục khớp bộ lọc. Không tự phân tích hay tạo cursor; nếu cursor mất hiệu lực, hãy truy vấn lại. `selectedOnly` lọc theo trạng thái được chọn tại thời điểm đọc từng trang. Người dùng có thể chỉnh sửa làm thay đổi kết quả; không xem các trang như một bản chụp cố định.

Bên trong một node cũng có thể chứa dữ liệu rất lớn. `getCanvasNodes` dùng `path` để chọn đường dẫn con trong dữ liệu chiếu, chẳng hạn `path: ["data", "promptModel"]` hoặc `["outputs", "text", "value"]`, rồi trả về `value` tại đường dẫn đó. Thành phần đầu tiên của đường dẫn chỉ được là một trong sáu trường dữ liệu chiếu; `ports` tương ứng `data.handles` của node. Mảng và đối tượng được phân trang qua `valueOffset` / `valueLimit`, mặc định 0 / 30 và tối đa 100 mục; chuỗi được chia đoạn qua `textOffset` / `textLimit`, mặc định 0 / 1.000 và tối đa 4.000 ký tự. Khi `valueOffset` hoặc `textOffset` lớn hơn 0, bắt buộc cung cấp `path` để tránh làm sai vị trí của tất cả trường được chiếu. Đường dẫn chỉ truy cập thuộc tính riêng, không được đọc thuộc tính kế thừa.

`path` tối đa 64 cấp; mỗi phần tối đa 256 ký tự (cho phép khóa rỗng của đối tượng JSON). Toàn bộ đường dẫn dưới dạng JSON UTF-8 tối đa 2.048 byte. Khi chạm giới hạn số cấp hoặc số byte, kết quả trả về `pathDepthLimit` / `pathBytesLimit`; không được hiểu nhầm dấu hiệu này là đã đọc hết nội dung. Khóa quá dài được đánh dấu `keyTooLong` và có `nextOffset` để tiếp tục đọc các trường kế tiếp.

`hasMore/nextCursor` ở cấp cao nhất cho biết còn node chưa trả về; hãy giữ nguyên các tham số khác và tiếp tục phân trang node. `truncated` của mỗi node cho biết chưa đọc hết giá trị của node đó. Khi xử lý một mục bị cắt ngắn, chỉ truy vấn node chứa mục đó bằng đường dẫn và offset tương ứng, không kèm `cursor` cũ. Quy tắc cụ thể:

- `text`: tiếp tục đọc bằng `path` của mục đó và `nextOffset` làm `textOffset`. `entries`: dùng `path` và `nextOffset` làm `valueOffset`. Không có `nextOffset` nghĩa là đã đến cuối đường dẫn, nhưng dấu hiệu bị cắt ngắn vẫn có thể tồn tại vì lượt hiện tại chỉ trả về đoạn cuối.
- `depth/budget`: mở truy vấn chi tiết mới theo `path` của mục đó để thu hẹp phạm vi đọc; không mang theo `cursor` của truy vấn cũ khi đọc lại đường dẫn.
- `pathDepthLimit/pathBytesLimit/keyTooLong/circular` cho biết không thể mở rộng đầy đủ. Với `keyTooLong`, có thể dùng `nextOffset` trả về để bỏ qua khóa đó và đọc các trường tiếp theo, nhưng giá trị bị bỏ qua vẫn chưa được lấy. Không lặp lại truy vấn ở giới hạn cứng hoặc coi đó là nội dung đã đầy đủ.

Hãy đọc các trường cần thiết của node trước, chỉ khi phát hiện bị cắt ngắn mới đọc bổ sung theo đường dẫn; không mở rộng thành truy vấn toàn bộ Canvas. Nếu đã có đường dẫn tệp văn bản, hãy giao cho công cụ đọc tệp; khi kiểm tra toàn văn phải ghép đủ các đoạn đã đọc và các đoạn tiếp theo.

Với tác vụ trên toàn Canvas, xử lý theo từng trang và ghi lại tiến độ; chỉ giữ trong ngữ cảnh lô hiện tại, bản tóm tắt tích lũy và cursor, không tích trữ toàn bộ chi tiết. Việc thêm hoặc xóa trên toàn Canvas có thể khiến cursor duyệt mất hiệu lực; hãy truy vấn lại và đối chiếu với các ID đã xử lý hoặc kết quả đã có để tránh thực hiện trùng. Sau khi thêm/xóa node hoặc chuyển Canvas, dùng `getNodeTools` để khám phá lại các hàm liên quan.

## Quản lý Canvas

| Công cụ | Tham số | Thao tác và kết quả trả về |
| --- | --- | --- |
| `addCanvas` | `{ name? }` | Tạo Canvas trống và chuyển sang Canvas mới; nếu bỏ qua tên thì tự dùng một tên “画布N” chưa được sử dụng. Trả về tổng quan Canvas mới được kích hoạt. |
| `switchCanvas` | `{ canvasId }` | Chờ lưu xong những chỉnh sửa hiện tại rồi chuyển sang Canvas được chỉ định; trả về tổng quan Canvas mới được kích hoạt. |
| `renameCanvas` | `{ canvasId?, name }` | Nếu không truyền ID, đổi tên Canvas đang hoạt động và đổi cả tên tệp JSON. Trả về tổng quan Canvas đang hoạt động sau thao tác. |

Sau khi loại bỏ khoảng trắng đầu/cuối, tên dài từ 1 đến 120 ký tự, không kèm phần mở rộng `.json` và phải là tên tệp hợp lệ. Tên không được chứa dấu phân cách đường dẫn, ký tự không hợp lệ cho tên tệp, ký tự điều khiển, không kết thúc bằng dấu chấm và không trùng tên dành riêng của hệ thống. Tệp cùng tên sẽ không bị ghi đè.

ID Canvas liên quan đến tên tệp, vì vậy sau khi đổi tên phải đọc lại ID được trả về. Đổi tên một Canvas không hoạt động sẽ không tự chuyển đến Canvas đó. Sau khi tạo hoặc chuyển Canvas thành công bằng các công cụ trên, những lần gọi tiếp theo trong lượt này sẽ tác động đến Canvas mới đang hoạt động.

## Node và kết nối

| Công cụ | Tham số | Thao tác và kết quả trả về |
| --- | --- | --- |
| `addNode` | `{ type, position: { x, y }, label? }` | Thêm node mới và trả về thông tin node; truy vấn các hàm bằng `getNodeTools`. Nếu không chỉ định tên, dùng `label` của loại node. |
| `moveNodes` | `{ moves: [{ nodeId, position: { x, y } }] }` | Di chuyển nhiều node theo lô, trả về thông tin `nodes`. Node không cho phép kéo sẽ từ chối thao tác. |
| `renameNodes` | `{ renames: [{ nodeId, label }] }` | Cập nhật hàng loạt tên hiển thị, trả về thông tin `nodes`; không thay đổi ID node. |
| `deleteNodes` | `{ nodeIds: [...] }` | Xóa các node và kết nối của chúng; trả về `nodeIds`, `removedEdgeCount`, tối đa 100 `removedEdgeIds` và `truncated`. Việc cắt ngắn chỉ ảnh hưởng đến biên nhận. |
| `connectNodes` | `{ connections: [{ source, sourceHandle, target, targetHandle }] }` | Kết nối hàng loạt cổng đầu ra với cổng đầu vào, trả về `{ edges }`. Nếu kết nối giống hệt đã tồn tại, trả về kết nối hiện có. |
| `deleteEdges` | `{ edgeIds: [...] }` | Xóa các kết nối được chỉ định, trả về `edgeIds` và thông tin `nodes` liên quan. |
| `selectNodes` | `{ nodeIds: [...] }` | Thay thế danh sách node đang được chọn, trả về `selectedCount`, tối đa 100 `selectedNodeIds` và `truncated`. Truyền mảng rỗng để bỏ chọn tất cả node. |
| `arrangeCanvas` | `{}` | Sắp xếp toàn bộ Canvas đang hoạt động: dựa vào kích thước thực và các kết nối để sắp các node cấp cao từ trái sang phải; node con di chuyển theo node cha và khung nhìn tự động thích ứng. Trả về `arrangedCount`, tối đa 100 `arrangedNodeIds`, `truncated` và `viewport`. Không chỉnh nội dung, kết nối hoặc lựa chọn và không kích hoạt tạo nội dung. |
| `fitCanvas` | `{ nodeIds?: [...] }` | Điều chỉnh khung nhìn, trả về `fitted`, `viewport`, `nodeCount` và `truncated`. Nếu truyền `nodeIds` thì trả thêm tối đa 100 `nodeIds`; nếu bỏ qua sẽ hiển thị tất cả node. |

`truncated` trong biên nhận thao tác ở trên chỉ có nghĩa là danh sách ID được rút ngắn, không có nghĩa thao tác chỉ thực hiện trên phần xem trước. Không thực hiện lại thao tác chỉ để lấy biên nhận đầy đủ; hãy dùng công cụ đọc để đối chiếu phạm vi bị ảnh hưởng khi cần.

### Giới hạn tham số

- `position` dùng tọa độ Canvas, không phải tọa độ pixel màn hình; `x` và `y` phải là các số hữu hạn. Khi bật hút vào lưới, vị trí thêm hoặc di chuyển sẽ được làm tròn theo lưới; lấy `node.position` trả về làm chuẩn.
- Sau khi bỏ khoảng trắng đầu/cuối, `label` của node dài 1–200 ký tự.
- `addNode` chỉ chấp nhận loại node có trong `availableNodeTypes` hiện tại, không chấp nhận `data` tùy ý hoặc ID node tự đặt. Dùng các hàm node đã đăng ký để điền nội dung hoặc cài đặt thông số.
- Các thao tác di chuyển, đổi tên, xóa và nối trên nhận 1–64 mục mỗi lô; ngay cả một mục cũng phải truyền dưới dạng mảng. Nếu một mục không hợp lệ, toàn bộ lô không được thực hiện. Ngoại lệ xảy ra trong khi chạy không có nghĩa các tác động đã phát sinh tự động được hoàn tác; trước khi khôi phục vẫn phải đọc lại trạng thái.
- Tham số cấp cao nhất của công cụ được kiểm tra nghiêm ngặt theo đối tượng; không truyền trường chưa khai báo. `nodeTools.args` còn phải đáp ứng khai báo tham số riêng của hàm node.
- ID node, ID Canvas và ID kết nối là các định danh khác nhau; không dùng tên hiển thị để thay thế.

### Quy tắc kết nối

Trước hết, dùng `getCanvasNodes({ nodeIds: [...], fields: ["ports"] })` để đọc các cổng ở hai đầu. Mỗi cổng gồm `id`, `type`, `dataType`, có thể có thêm `label`. `source` và `target` là ID node; `sourceHandle` và `targetHandle` là ID cổng trong node tương ứng.

- Chỉ nối từ cổng đầu ra có `type: "source"` sang cổng đầu vào có `type: "target"`.
- Sử dụng ID cổng thực tế, không đoán từ nhãn mô tả như “đầu vào ảnh”. Các node khác nhau có thể có cổng trùng tên, vì vậy phải xác nhận cả node sở hữu cổng.
- Công cụ áp dụng quy tắc kiểm tra kết nối của Canvas và node đích. Loại dữ liệu khớp nhau không bảo đảm sẽ kết nối được, vì node đích có thể có quy tắc bổ sung. Nếu bị từ chối, kiểm tra lại các cổng mới nhất và mô tả hàm; không chỉnh sửa JSON để ép nối.
- Văn bản kịch bản và storyboard dùng để lên kế hoạch, không đưa trực tiếp làm đầu vào của node tạo ảnh/video. Trước tiên xác nhận các tài nguyên nhân vật, bối cảnh, v.v., rồi chuyển toàn bộ góc máy của đoạn hiện tại thành một prompt video chuyên dụng; chỉ kết nối những tài nguyên thực sự được dùng trong lượt này.
- Sau khi nối tư liệu, kiểm tra thứ tự tham chiếu thực tế của node đích, rồi dùng `node:setPrompt` để ghi `{{ref N}}` cùng tên và mục đích của tư liệu. Kết nối thành công không có nghĩa prompt đã liên kết đúng tư liệu. Xem [Mục 3–4 về chuyển đổi quy trình sản xuất](references/videoProduction.md) để kiểm tra thứ tự và cấu hình chi tiết.
- Khi node hoặc kết nối từ chối thao tác nối, chọn, di chuyển hoặc xóa, phải tuân theo lỗi trả về. Trước khi xóa node có node con, phải xóa các node con hoặc đưa chúng vào cùng lô xóa. Nếu thao tác liên quan đến nội dung người dùng chưa yêu cầu xóa, phải làm rõ phạm vi trước và không tự mở rộng việc xóa.

## Gọi hàm của node

Dùng `nodeTools({ nodeId, name, args })`:

- `nodeId` và `name` phải lấy từ cùng một mục trong danh sách hàm; `name` phải giữ nguyên tiền tố đầy đủ `node:`.
- Tạo `args` theo JSON Schema trong `parameters` của hàm, tuân thủ trường bắt buộc, enum và cấu trúc dữ liệu. Ngay cả hàm không có tham số cũng phải truyền `{}`.
- Không giả định mọi node đều có các hàm giống nhau. Những khả năng như đặt prompt, nhập tư liệu và tạo phương tiện phải dựa vào các hàm thực sự đã đăng ký trên node đó.
- Khi cần kiểm tra hoặc thay đổi cấu hình tạo nội dung, nếu danh sách có `node:getConfig` thì dùng hàm này đọc cấu hình hiện tại và khả năng mô hình. Dùng `node:setConfig` với các tham số đã được mô tả để thay đổi tùy chọn, rồi đối chiếu kết quả trả về. Sửa cấu hình không kích hoạt tạo nội dung. Giữ nguyên các cài đặt hợp lệ đã được người dùng xác nhận, không tự chọn lại mô hình chỉ vì tác vụ chỉnh sửa thông thường.
- Trước khi tạo ảnh hoặc video, trình bày mô hình thực tế, đối tượng và số lượng, thông số, prompt, tham chiếu và chi phí, rồi chờ người dùng phê duyệt rõ phương án tiêu tốn tài nguyên tính toán. Nếu chưa biết giá thì nói rõ chưa biết. Ảnh đơn, bản thử, tạo bổ sung, tạo lại và những lần thử lại có thể tốn phí đều phải nằm trong phạm vi ủy quyền; có thể xin xác nhận một lần cho cả lô cụ thể. Dùng `askUser` nếu khả dụng; nếu không có, hỏi bằng văn bản và chờ phản hồi. Chưa có câu trả lời thì không được kích hoạt tạo nội dung. Khi chưa chỉ định nhà cung cấp, mặc định chọn theo thứ tự công cụ trả về một mô hình Toonflow thực sự khả dụng và đáp ứng yêu cầu. Lựa chọn đã được người dùng chỉ định hoặc xác nhận có ưu tiên; không coi giá trị mặc định tự động trên node là lựa chọn của người dùng. Nếu không có mô hình Toonflow phù hợp, phải giải thích và xác nhận nhà cung cấp hoặc mô hình thay thế.
- Giá trị trả về tùy hàm node quyết định; nếu không có giá trị thì là `null`. Giới hạn 64 KiB của năm công cụ đọc Canvas không áp dụng cho kết quả thực thi hàm nghiệp vụ `nodeTools`. Thực thi thành công không tự động đồng nghĩa tạo phương tiện thành công; phải kiểm tra kết quả và trạng thái mới nhất của node.
- Sau khi thêm node mới, có thể dùng ngay ID được trả về để truy vấn `getNodeTools` và gọi các hàm, không cần kết thúc lượt trò chuyện hiện tại.

## Tác vụ thường gặp

### Chuyển phương án sáng tạo thành Canvas có thể thực thi

Khi cần đưa storyboard, tư liệu và prompt của kịch bản, tiểu thuyết hoặc ý tưởng sáng tạo thành các node, hãy đọc [Chuyển quy trình sản xuất video sang Canvas](references/videoProduction.md). Tài liệu này nêu rõ nội dung nào thuộc node văn bản, cách tái sử dụng phương tiện, nối các phụ thuộc thực tế và kiểm tra kết quả tạo nền đã hoàn thành. Các tham số chung vẫn phải theo hướng dẫn này và mô tả mới nhất do công cụ trả về.

### Tạo Canvas mới và thêm node

Gọi `addCanvas({ "name": "分镜草稿" })`, sau đó dùng `getCanvas({ "include": ["nodeTypes"] })` truy vấn `availableNodeTypes` rồi chọn loại đáp ứng yêu cầu của người dùng để truyền vào `type` của `addNode`. Ví dụ tọa độ `{ "x": 120, "y": 160 }`; tên tùy theo ý định của người dùng. Ghi lại `node.id` được trả về, dùng `getNodeTools` để truy vấn và gọi hàm điền nội dung node, cuối cùng gọi `fitCanvas({})`.

### Kết nối hai node đã có

Gọi `findCanvasNodes` để tìm hai node theo tên hoặc trạng thái chọn mà người dùng chỉ định. Nếu đã biết ID thì bỏ qua bước tìm kiếm; nếu các node trùng tên không thể phân biệt thì phải làm rõ đối tượng đích. Dùng `getCanvasNodes` đọc các cổng đầu ra/đầu vào, rồi điền ID thực tế vào mảng `connections` của `connectNodes`. Kiểm tra hai đầu trong `edges` được trả về, sau đó đưa hai node vào tầm nhìn nếu cần.

### Tìm và đọc đoạn được chỉ định

Ví dụ người dùng chỉ định G51, trước tiên gọi `findCanvasNodes({ "query": "G51", "limit": 20 })` và xác nhận đối tượng từ kết quả phân trang. Trong các ví dụ sau, phải thay `目标ID` bằng ID thực tế được trả về:

- Kiểm tra prompt và đầu ra: `getCanvasNodes({ "nodeIds": ["目标ID"], "fields": ["label", "data", "outputs"], "dataKeys": ["prompt", "referenceOrder"] })`. Các trường mặc định không có `ports/data/outputs`, không được coi trường chưa yêu cầu là giá trị rỗng.
- Đọc prompt dài: `getCanvasNodes({ "nodeIds": ["目标ID"], "path": ["data", "prompt"], "textLimit": 4000 })`. Các lần đọc tiếp theo phải dùng `nextOffset` được trả về, không tự suy ra offset theo độ dài đã yêu cầu.
- Truy vấn các kết nối đi vào node đích: `getCanvasEdges({ "nodeIds": ["目标ID"], "direction": "incoming", "limit": 100 })`. Truy vấn các hàm có thể gọi: `getNodeTools({ "nodeIds": ["目标ID"], "limit": 20 })`.

### Sắp xếp nhiều node

Chỉ khi người dùng yêu cầu rõ ràng việc sắp xếp toàn bộ Canvas hiện tại, sau khi xác nhận đúng đối tượng mới gọi `arrangeCanvas({})` một lần. Không tự tính tọa độ từng node rồi lần lượt di chuyển. Công cụ dùng lại tính năng sắp xếp hiện có của Canvas, không chấp nhận `nodeIds` hoặc tham số phạm vi cục bộ khác.

Nếu các node cần sắp chưa đo được kích thước hoặc không thể di chuyển, công cụ sẽ báo lỗi rõ ràng; không đoán kích thước hay lách giới hạn di chuyển. Canvas trống trả về `arrangedNodeIds` rỗng như bình thường, không thực hiện sắp xếp hoặc điều chỉnh khung nhìn.

Nếu chỉ sắp xếp các góc máy hoặc node cụ thể, đọc vị trí thực tế và phạm vi đích, sau đó chỉnh những node đó bằng mảng `moves` của `moveNodes`; dùng `fitCanvas({ "nodeIds": [...] })` để hiển thị khi cần. Nếu chỉ muốn xem nội dung cho rõ, dùng trực tiếp `fitCanvas` mà không sắp xếp lại node. Không gọi `arrangeCanvas` để di chuyển các node khác của người dùng khi chỉ sắp xếp một vùng; không xóa hoặc dựng lại node để thay thế thao tác di chuyển.

## Xử lý sau khi thất bại

- Nếu loại node chưa bật, cổng không tồn tại hoặc hàm chưa đăng ký: lần lượt dùng `getCanvas({ include: ["nodeTypes"] })`, `getCanvasNodes`, `getNodeTools` để truy vấn trạng thái mới nhất và điều chỉnh thao tác; không đoán hàm thay thế.
- Nếu Canvas đã đóng, người dùng tự chuyển dự án/Canvas hoặc ngữ cảnh của lượt hiện tại mất hiệu lực: ngừng dùng ID cũ và đề nghị người dùng gửi lại yêu cầu trong Canvas đích.
- Quá thời gian, hủy hoặc lưu thất bại không đồng nghĩa thao tác đã được hoàn tác. Khi ngữ cảnh vẫn hợp lệ, trước tiên đọc trạng thái Canvas mới nhất để xác nhận node, kết nối hoặc Canvas đã được tạo hay chưa, rồi mới quyết định thử lại; tránh tạo trùng hoặc kích hoạt tạo nội dung nhiều lần.
- Công cụ sẽ chờ lưu hoàn tất đối với thao tác cần lưu; không ghi trực tiếp JSON Canvas bằng cách khác. Công cụ hiện tại không có giao diện chung để xóa Canvas, tùy ý ghi dữ liệu node hoặc tùy ý đặt thông số khung nhìn.
