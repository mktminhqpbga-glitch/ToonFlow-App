# Đa ngôn ngữ Toonflow

[Về trang chủ dự án](../../README.md) · [Mục lục tài liệu](../../docs/readme.md) · [Hướng dẫn phát triển và mở rộng](../../docs/development.md)

Từ điển ngôn ngữ tập trung tại `src/locales/`, gồm 21 ngôn ngữ: tiếng Trung giản thể, tiếng Trung phồn thể, tiếng Anh, tiếng Nhật, tiếng Nga, tiếng Việt, tiếng Thái, tiếng Hàn, tiếng Hindi, tiếng Indonesia (`id`), tiếng Mã Lai (`ms`), tiếng Philippines (`fil`), tiếng Bengal (`bn`), tiếng Urdu (`ur`), tiếng Tamil (`ta`), tiếng Telugu (`te`), tiếng Marathi (`mr`), tiếng Punjab (`pa`, chữ Gurmukhi), tiếng Ả Rập (`ar`), tiếng Ba Tư (`fa`) và tiếng Thổ Nhĩ Kỳ (`tr`). `zhCn.json` là văn bản nguồn tiếng Trung được trích xuất; các ngôn ngữ khác dùng cùng khóa thông điệp.

## Cách sử dụng

Phần cài đặt Web và hướng dẫn lần đầu tái sử dụng `languageSelect.vue`: trang cài đặt hiển thị trực tiếp các thẻ ngôn ngữ; hướng dẫn lần đầu mở cùng bộ thẻ qua một nút bấm. Các thẻ dùng cờ SVG cục bộ và tên ngôn ngữ bản địa, hỗ trợ chọn bằng phím mũi tên và Home/End. Giá trị khởi tạo mặc định hiện là tiếng Việt (`vi`); lựa chọn thủ công được lưu vào `settings.ui.language` hiện có, không ghi đè chủ đề, mô hình hay cài đặt khác. Khi chọn “Theo hệ thống”, ứng dụng xác định ngôn ngữ từ `navigator.languages` và tiếp tục theo dõi thay đổi ngôn ngữ hệ thống. Với tiếng Trung, ưu tiên phân biệt Hans/Hant rồi xét vùng; ngôn ngữ hệ thống không được hỗ trợ sẽ chuyển về tiếng Anh.

Toàn bộ 16 hình cờ lấy thống nhất từ SVG tỷ lệ 4:3 có sẵn của [flag-icons 7.3.2](https://github.com/lipis/flag-icons/tree/7.3.2/flags/4x3); chỉ bọc phần tử gốc thành symbol trong `languageFlags.svg` cục bộ, giữ nguyên đường vẽ, định nghĩa, tỷ lệ và thông báo giấy phép MIT. Chỉ đưa vào các quốc gia thực sự được thành phần sử dụng, không cài toàn bộ thư viện hình và không gọi CDN khi chạy. Khi đổi hình, phải cập nhật tài nguyên thượng nguồn tương ứng, không tự vẽ lại.

Các ngôn ngữ châu Á bổ sung hỗ trợ mã theo vùng (ví dụ `id-ID`, `bn-BD`, `ar-SA`) và bí danh `tl-PH` → `fil`, `in-ID` → `id`. Hiện mỗi ngôn ngữ chỉ có một hệ chữ viết; `pa-PK` / `pa-Arab` sẽ không bị nhận sai thành tiếng Punjab chữ Gurmukhi. Nếu hệ chữ viết chưa được hỗ trợ, ứng dụng tiếp tục thử mục tiếp theo trong danh sách ngôn ngữ hệ thống. Tiếng Ả Rập, tiếng Ba Tư và tiếng Urdu dùng RTL; nội dung kỹ thuật như tọa độ Canvas, mã, địa chỉ, khóa bí mật và JSON vẫn giữ LTR. Thẻ tiếng Ả Rập và tiếng Ba Tư lần lượt dùng cờ Ả Rập Xê Út và Iran. Cờ chỉ hỗ trợ nhận diện bằng hình ảnh; các ngôn ngữ khác nhau của cùng một quốc gia sẽ dùng lại biểu tượng.

Element Plus dùng 21 tệp JSON ngôn ngữ đầy đủ trong `src/elementPlus/` và kết nối với ConfigProvider toàn cục qua `@toonflow/i18n/elementPlus`. Phân trang, ngày tháng, tải lên, lọc và thông báo trợ năng cập nhật ngay khi đổi ngôn ngữ, không còn phải quay về tiếng Anh chỉ vì thiếu gói ngôn ngữ chính thức. Định dạng ngày và tên thứ dùng các gói ngôn ngữ Day.js đã đăng ký ở Web; tiếng Philippines ánh xạ sang `tl-ph`, tiếng Punjab chữ Gurmukhi sang `pa-in`. TDesign vẫn dùng nền tiếng Anh với ngôn ngữ chưa có; phần điều khiển chat được bổ sung từ từ điển ứng dụng. Thông báo kiểm tra hợp lệ chung của Zod cho `fil/te/mr/pa` vẫn dùng tiếng Anh.

Văn bản tĩnh trên Web và các thuộc tính hiển thị được chỉ định rõ được `@toonflow/i18n/vite` chuyển đổi trước khi biên dịch Vue; mã nguồn nghiệp vụ tiếp tục được viết bằng tiếng Trung. Việc chuyển đổi chỉ áp dụng cho `apps/web/src`; trình biên dịch chỉ xử lý các vị trí hiển thị đã biết, không duyệt DOM, không gọi dịch trực tuyến, không tắt tối ưu hóa tĩnh của Vue và không đổi ngôn ngữ bằng cách gắn lại trang.

Văn bản động có thể dùng template tag nguyên sinh của JavaScript, không cần macro Babel:

```ts
import { t, msg, translate } from "@toonflow/i18n/vue";

// 操作发生时显示当前语言。
ElMessage.success(t`文件 ${fileName} 已保存`);

// 配置保存消息描述，显示时翻译；参数会在创建描述时取值。
const saveLabel = msg`保存`;
const label = computed(() => translate(saveLabel));

// 动态参数在响应式作用域内求值。
const countLabel = computed(() => t`已选择 ${selectedCount.value} 个节点`);
```

`msg` giữ nguyên mẫu và tham số, còn `t` dịch ngay. Hàm dịch ở điểm vào Vue đọc trạng thái ngôn ngữ có tính phản ứng; chuỗi thông thường được tạo một lần khi khởi tạo module hoặc trong setup sẽ không tự cập nhật. Tham số được chèn nguyên dạng, không phân tích lại thành mẫu mới; dấu ngoặc nhọn và dấu nháy được template tag thoát ký tự. Khi cần số nhiều, bản dịch có thể dùng `plural` của ICU MessageFormat; không tách câu để ghép chuỗi.

Backend sử dụng ngữ cảnh yêu cầu trong `apps/server/src/lib/i18n.ts`. `success/error` tương thích cả chuỗi tiếng Trung cũ lẫn mô tả thông điệp; lỗi động dùng `t` của module này. Với lỗi FFmpeg phía server, có thể dùng `messageError` từ `@toonflow/i18n/errors`, truyền mô tả được tạo bằng template tag `msg` để lưu nội dung nguồn và tham số, chỉ dịch tại đầu ra lỗi hệ thống. Backend không được gọi `setLocale` của core để đổi ngôn ngữ toàn cục.

Nguồn ngôn ngữ được tách theo `Accept-Language` của từng yêu cầu (bao gồm trọng số q). Nếu ngôn ngữ trong yêu cầu không được hỗ trợ, dùng ngôn ngữ ứng dụng đã lưu hoặc ngôn ngữ hệ thống. Zod dùng bộ phân phối ngôn ngữ đăng ký một lần và đọc theo từng yêu cầu. SSE, MCP và FFmpeg chỉ xử lý lỗi hệ thống đã nhận diện; nội dung mô hình, kết quả công cụ thành công, lỗi nhà cung cấp chưa biết, nội dung người dùng và chi tiết nhật ký giữ nguyên.

Các gói con nhà cung cấp, tools, nodes và bộ khung node hiện **không tích hợp cơ chế đa ngôn ngữ**, cũng không tham gia trích xuất văn bản. Tên plugin và văn bản bên trong plugin giữ nguyên giá trị gốc; menu quản lý plugin, thao tác cài đặt và thông báo kiểm tra cấu hình trên Web vẫn thuộc giao diện ứng dụng. Giữa quy trình build node và ứng dụng chủ không có giao diện ngôn ngữ lúc chạy.

## Cập nhật văn bản giao diện

Chạy tại thư mục gốc repository:

```sh
bun run --cwd packages/i18n extract
```

Lệnh này chỉ cập nhật từ điển nguồn tiếng Trung và `src/messageSources.json` (chỉ mục nguồn thông điệp), không ghi đè bản dịch thủ công của ngôn ngữ khác. Bổ sung các khóa mới vào 20 tệp ngôn ngữ còn lại, giữ các tham số như `{0}`; sau khi thay văn bản tiếng Trung gốc phải chỉnh bản dịch tương ứng. Nếu cùng câu tiếng Trung có ý nghĩa khác nhau trong các ngữ cảnh, phải tách thông điệp rõ ràng; không suy ra trạng thái nghiệp vụ từ chữ đã dịch.

JSON của Element Plus được quản lý độc lập với quá trình trích xuất văn bản ứng dụng, dựa trên đầy đủ 142 thông điệp thành phần của phiên bản 2.14.5; giấy phép MIT thượng nguồn được lưu tại `src/elementPlus/license.txt`. Khi nâng cấp Element Plus, đối chiếu toàn bộ khóa và cấu trúc mảng với gói tiếng Anh của phiên bản mới, rồi cập nhật đủ 21 JSON. Mẫu thành phần giữ các tham số đặt tên gốc như `{total}`, `{pager}`, `{column}`, không dùng cú pháp ICU của từ điển ứng dụng; `name` phải khớp tên ngôn ngữ Day.js đã đăng ký. Kiểm tra kiểu dữ liệu có thể kiểm tra độ bao phủ ngôn ngữ và cấu trúc so với gói tiếng Anh cục bộ, nhưng không thay thế đối chiếu với bản thượng nguồn sau nâng cấp hoặc rà soát chất lượng bản dịch.

Khi rà soát, lần theo chỉ mục nguồn đến sự kiện nút, nhánh trạng thái và hành vi API thực tế để xác nhận đối tượng thao tác, phạm vi ảnh hưởng và điều kiện hoàn tất. Ví dụ, phân loại mục yêu thích khác nghĩa với “Thêm vào yêu thích”; đóng hộp thoại cũng khác “Không dùng màu tô sáng”. Khoảng cắt âm thanh, dòng bảng, thông tin phiên bản và số tiền tiêu dùng đều phải được hiểu theo chức năng tương ứng.

Mã hiển thị chưa được hỗ trợ phải gọi tường minh `translate/t` tại ranh giới hiển thị; không mở rộng quy tắc sang mọi `message`, `label` hoặc tất cả chuỗi tiếng Trung. Dữ liệu người dùng như `data`, `inputs`, `outputs` không thuộc phạm vi tự động dịch. Bộ chọn logic hiện dùng `[aria-label="中文"]` cần được thay bằng dấu hiệu `data-*` ổn định.

Từ điển được đóng gói cùng ứng dụng, không cần dịch vụ dịch thuật khi chạy. Hiện 20 từ điển bản dịch đã được AI hỗ trợ rà soát ngữ nghĩa từng mục trên toàn bộ nội dung, đồng thời kiểm tra lại thuật ngữ, điều kiện phủ định, đối tượng thao tác, số liệu và tham số mẫu; việc này không tương đương biên tập chất lượng xuất bản bởi người bản ngữ của từng ngôn ngữ. Các gói con nhà cung cấp, tools, nodes, website bên thứ ba và trình cài đặt nằm ngoài phạm vi dịch thuật đã mô tả ở đây.

Xem quá trình xác minh tại [Nhật ký kiểm thử hồi quy](./regression.md).
