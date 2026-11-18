# Bộ khung mở rộng tài liệu

Trang tài liệu dùng Dockview để quản lý tab, chia màn hình và quy trình đóng. Mỗi gói con workspace trong `packages/ext/*` cung cấp một trình sửa tệp, trình xem trước hoặc trình hiển thị node Canvas. Extension chỉ nhận `context` do ứng dụng chủ cung cấp, không import `apps/web/src`.

## Tạo extension

Chạy tại thư mục gốc repository:

```sh
bun packages/extScaffold/create.ts myEditor
bun install
bun run --cwd packages/ext/myEditor typecheck
bun run --cwd packages/ext/myEditor build
```

Tham số phải là tên camelCase, không kèm `ext-`. Ví dụ `myEditor` tạo ID `ext-myEditor` và tên gói `@toonflow/ext-myeditor`. Nếu thư mục cùng tên đã tồn tại, lệnh sẽ từ chối tạo. Lệnh chỉ tạo thư mục và tệp, không ngầm cài dependency, build hoặc sửa cấu hình ứng dụng chủ.

Nếu thao tác ghi thất bại giữa chừng, những tệp đã tạo được giữ lại. Sau khi sửa nguyên nhân, có thể tạo bù hoặc dọn thủ công; bộ khung không tự xóa đệ quy thư mục để hoàn tác.

```text
packages/ext/myEditor/
  package.json
  tsconfig.json
  viteConfig.ts
  readme.md
  src/
    metadata.ts
    index.ts
    index.vue
```

Thành phần được tạo có thể chỉnh văn bản trực tiếp và minh họa cài đặt biểu tượng, cỡ chữ do extension tự khai báo. Hãy sửa tên hiển thị, biểu tượng, phần mở rộng tệp và quy tắc cấu hình trong `src/metadata.ts`, sau đó triển khai nội dung `src/index.vue`.

## Khai báo extension

```ts
// src/metadata.ts
import type { ExtDefinition } from "@toonflow/ext-scaffold/runtime";

export default {
  id: "ext-myEditor",
  displayName: "我的编辑器",
  extensions: ["txt"],
  resourceKind: "file",
  text: true,
  configRules: [{ type: "inputNumber", field: "fontSize", title: "字号", value: 14, props: { min: 10, max: 32 } }],
} satisfies Omit<ExtDefinition, "load">;
```

Điểm vào `src/index.ts` kết hợp khai báo với hàm tải thành phần:

```ts
import { defineExt } from "@toonflow/ext-scaffold/runtime";
import metadata from "./metadata";

export default defineExt({ ...metadata, load: () => import("./index.vue") });
```

`id` phải duy nhất trên tất cả extension, theo dạng `ext-` cộng tên camelCase, ví dụ `ext-image`, `ext-canvasNode`; tên thư mục và biến vẫn dùng camelCase. Phần mở rộng tệp không có dấu chấm, chỉ dùng chữ thường hoặc số. `resourceKind` là `file` hoặc `canvasNode`; extension node Canvas được phép dùng mảng phần mở rộng rỗng. Trình sửa văn bản phải đặt `text: true` để ứng dụng chủ nạp trước văn bản và cấp quyền đọc/ghi tài liệu; trình xem trước tệp nhị phân như ảnh không đặt cờ này.

`icon` tùy chọn là URL ảnh, cho phép `http:`, `https:` hoặc URL `data:image` của SVG, PNG, JPEG, WebP, GIF, AVIF. Biểu tượng được khai báo cùng sản phẩm extension, ứng dụng chủ chỉ hiển thị như ảnh; nếu không khai báo sẽ dùng biểu tượng tệp chung. Extension tích hợp sẵn và mẫu tạo dùng SVG nhúng, không cần yêu cầu tải ảnh thêm.

`configRules` tùy chọn tái sử dụng `Rule[]` form-create hiện có của chợ plugin; mỗi `rule.value` cung cấp giá trị mặc định, không lập schema cài đặt riêng. Quy tắc phải tuần tự hóa được thành JSON, tối đa 100 mục, không chứa hàm. Nếu không khai báo hoặc dùng mảng rỗng, ứng dụng không hiển thị mục cài đặt của extension.

Các trường trong bố cục `children` và điều kiện `control[].rule` cũng được lưu. Trường điều kiện đang ẩn và chưa gửi sẽ không kích hoạt kiểm tra bắt buộc phía server.

Ứng dụng chủ liệt kê các extension đã cài và đang bật từ `data/ext/`, tải sản phẩm UMD và thành phần do `load()` trả về khi cần; không phải sửa dependency của workspace web hoặc bảng đăng ký tĩnh. Khi một phần mở rộng tệp có nhiều extension khả dụng, ứng dụng chủ hiển thị hộp chọn “Mở bằng” và có thể đặt liên kết mặc định; menu chuột phải “Mở bằng” ở cây tệp cho phép chọn lại. Bộ khung không tự ghi đè liên kết tệp hiện có.

## Ngữ cảnh thành phần

```ts
import type { ExtContext } from "@toonflow/ext-scaffold/runtime";

const props = defineProps<{ context: ExtContext }>();
```

| Trường | Mục đích |
| --- | --- |
| `resource` | Danh tính tài nguyên, gồm thư mục workspace, đường dẫn tương đối, tên tab; với node Canvas còn có `nodeId`. |
| `files` | Các thao tác tệp được giới hạn vào workspace chứa tài nguyên, gồm `read`, `readText`, `readJson`, `write`, `writeJson`, `list`, `rename`, `copy`, `reveal`, `remove`, `mkdir`, `acquireUrl`. |
| `text`, `loading`, `error`, `dirty` | Văn bản và trạng thái tải/lưu do ứng dụng chủ quản lý. Gửi chỉnh sửa bằng `updateText()`; không sửa trực tiếp trạng thái chủ. `loading` cũng cho biết tạm dừng chỉnh sửa trong lúc thao tác tệp. |
| `active` | Trang tài liệu có đang hoạt động không; node Canvas dựa vào đó để gắn hoặc giải phóng phần hiển thị, thành phần phương tiện có thể tạm dừng tương ứng. |
| `config` | Cấu hình extension hiện tại, gồm giá trị mặc định của quy tắc và giá trị đã lưu; ứng dụng chủ đồng bộ sau khi cài đặt trên chợ plugin thay đổi. Không sửa trực tiếp để thay cho lưu. |
| `saveConfig(config)` | Lưu cấu hình mà extension hiện tại khai báo và cập nhật trạng thái chủ; ném ngoại lệ nếu thất bại. Cài đặt chợ plugin dùng cùng điểm lưu bền vững. |
| `updateText(text)` | Cập nhật văn bản của tab hiện tại; hàng đợi lưu do ứng dụng chủ quản lý, không tạo cơ chế tự lưu riêng. |
| `flushSave()` | Chờ các chỉnh sửa của tab hiện tại lưu xong; ném ngoại lệ khi thất bại. |
| `writeClipboardText(text)` | Sao chép văn bản qua tính năng clipboard của ứng dụng chủ trên desktop hoặc trình duyệt. |
| `openFile(path)` | Mở đường dẫn tương đối trong cùng workspace; liên kết tệp, ánh xạ node và loại tab trùng do ứng dụng chủ quản lý. |
| `location` | Yêu cầu định vị trong chế độ xem hiện tại (tùy chọn), gồm `line`, `column` bắt đầu từ 1, `query` cần chọn và dấu thay đổi `revision`. Extension lắng nghe rồi định vị trình sửa của mình; không tham gia lưu nội dung. |
| `mountNode(element)` | Chỉ cung cấp cho node Canvas. Hiển thị giao diện node gốc trong phần tử, trả về phương thức giải phóng hiển thị; phải gọi khi unmount. |

Lưu văn bản hỗ trợ UTF-8 (có hoặc không có BOM) và UTF-16 LE/BE có BOM, đồng thời giữ nguyên mã hóa ban đầu. Nếu mã hóa không được hỗ trợ, ứng dụng từ chối mở và không sửa tệp gốc. Trước khi lưu, ứng dụng chủ đối chiếu phiên bản tệp lúc đọc; nếu phát hiện chỉnh sửa từ bên ngoài, ngừng ghi đè và giữ nội dung đang sửa để người dùng chọn tải phiên bản trên đĩa hoặc lưu bản sao. Extension phải chỉnh tài liệu hiện tại qua `context.updateText(text)`; không gọi `context.files.write()` để vượt qua cơ chế mã hóa, hàng đợi lưu và bảo vệ xung đột của ứng dụng chủ.

Một tệp có thể xuất hiện trong nhiều ô chia màn hình; nội dung và trạng thái lưu dùng chung một phiên. Thành phần phải theo dõi `context.text` để nhận sửa đổi từ ô khác, trong khi con trỏ, tìm kiếm và chế độ sửa giữ riêng trong từng thành phần. Đóng một ô không hủy việc lưu của ô khác; node Canvas giữ một instance chạy duy nhất, chia màn hình chỉ di chuyển phần hiển thị của nó.

Xem trước tệp nhị phân dùng `context.files.acquireUrl(path)` để nhận `{ url: Promise<string>, release() }`. Dù đã tải xong hay chưa, khi chuyển tài nguyên hoặc unmount thành phần đều phải gọi `release()`. Không tự thu hồi URL chia sẻ. Giao diện phải hiển thị lỗi thao tác tệp; đường dẫn bắt buộc là đường dẫn tương đối trong workspace hiện tại.

`files.copy(path, target)` chỉ sao chép trong workspace này, từ chối ghi đè nếu đích đã tồn tại. Khi sao chép thư mục, symlink bị cấm; thất bại có thể để lại một phần nội dung đích, được mô tả qua `partial` và `target` trong dữ liệu lỗi. `files.reveal(path)` chỉ hỗ trợ ứng dụng desktop hoặc trang phát triển chạy cục bộ trên Windows/macOS; truy cập từ xa sẽ bị từ chối.

## Dependency chỉnh sửa Markdown dùng chung

Tiptap, marked và DOMPurify dùng lại dependency của ứng dụng chủ qua thiết lập external khi build. Trình sửa, thành phần xem trước, thanh công cụ và vòng đời được mỗi extension hoặc node triển khai trong gói riêng, không import thành phần chủ và không có lớp chuyển tiếp thành phần. Khi dùng những dependency này, gói con phải khai báo peerDependencies tương thích với ứng dụng chủ: hiện các gói Tiptap là `3.31.3`, `marked` là `18.0.13` và `dompurify` là `3.4.16`.

Dùng trực tiếp API gốc của dependency:

```ts
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";

const editor = new Editor({
  extensions: [StarterKit, Markdown],
  content: "# 标题",
  contentType: "markdown",
});
```

Các module dùng chung gồm `@tiptap/core`, `@tiptap/vue-3`, `@tiptap/starter-kit`, `@tiptap/markdown` và `extension-find-and-replace`, `extension-highlight`, `extension-image`, `extension-list`, `extension-subscript`, `extension-superscript`, `extension-table`, `extension-text-align` (tất cả có tiền tố `@tiptap/`); ngoài ra có `@tiptap/pm/model`, `@tiptap/pm/state`, `@tiptap/pm/view`, `marked` và `dompurify`. Sản phẩm build tham chiếu các dependency tương ứng trong `window.toonflowTiptapHost`, không đóng gói trùng các phần triển khai này.

Tiptap thống nhất dùng named import, ví dụ `{ StarterKit }`, `{ Image }`, `{ Highlight }`, `{ Superscript }`, `{ Subscript }`, `{ TextAlign }`, `{ FindAndReplace }`. Với Vite 8 UMD hiện tại, default import lấy toàn bộ đối tượng module bên ngoài nên không thể dùng cho các module chia sẻ này. DOMPurify riêng biệt chia sẻ hàm mặc định, tiếp tục dùng `import DOMPurify from "dompurify"`. Không cần bật cờ tương thích CJS cũ ảnh hưởng tất cả dependency.

Ứng dụng chủ trước tiên kiểm tra UMD có tham chiếu `toonflowTiptapHost` không, chỉ tải dependency chia sẻ động khi cần, sau đó dùng lại cùng module ES. Plugin ảnh, video hoặc văn bản thuần thông thường sẽ không vì thế mà tải Tiptap trước. Việc mount, hủy, ẩn thành phần, cập nhật nội dung và lưu tệp vẫn do từng gói quản lý. Sản phẩm dùng dependency chia sẻ phải đi kèm phiên bản ứng dụng chủ tương thích.

## Build và phát triển độc lập

`viteConfig.ts` sử dụng cấu hình chia sẻ:

```ts
import { createExtConfig } from "@toonflow/ext-scaffold";
import metadata from "./src/metadata.ts";

export default createExtConfig(metadata, import.meta.url);
```

Tệp khai báo không import thành phần để tránh bộ đóng gói cấu hình phân tích tệp Vue quá sớm. Mỗi lần build lại sẽ đọc lại khai báo và các dependency; thay đổi phần mở rộng, biểu tượng và cài đặt được đồng bộ vào metadata UMD. Sau khi đổi ID extension phải khởi động lại tiến trình build.

Sản phẩm là `build/ext/<id>.umd.js`, ví dụ `build/ext/ext-image.umd.js`; gồm chú thích metadata JSON `toonflowExt`, phiên bản, tài liệu hướng dẫn và style thành phần được tự chèn. Sản phẩm export `window.toonflowExts[id]` theo cấu trúc `ExtDefinition`. Vue, Element Plus và trạng thái ngôn ngữ Toonflow được chia sẻ từ ứng dụng chủ:

```ts
import * as vue from "vue";
import * as elementPlus from "element-plus";
import * as i18n from "@toonflow/i18n/vue";

Object.assign(window, { toonflowExtHost: { vue, elementPlus, i18n } });
```

Runtime dùng `@toonflow/ext-scaffold/runtime`, cấu hình build dùng `@toonflow/ext-scaffold` để tránh đóng gói Vite và mã hệ thống tệp vào trình duyệt. Style cơ bản của Element Plus do ứng dụng chủ tải, style thành phần của extension được đóng vào sản phẩm.

`bun run --cwd packages/ext/myEditor dev` build liên tục và thay thế sản phẩm trong `data/ext/` theo cách nguyên tử để chợ plugin và ứng dụng chủ tài liệu cục bộ đọc. Build một lần với `NODE_ENV=dev` hoặc `--mode development` cũng đồng bộ tương tự; build production chỉ ghi vào `build/ext/`.

Metadata của chợ plugin gồm `id`, `displayName`, `icon` tùy chọn, `configRules`, `extensions`, `resourceKind`, `text` tùy chọn, `version` và `readme`. `load` vẫn là export runtime, không ghi vào metadata JSON. Chợ plugin phụ trách cài, cập nhật, bật/tắt; bộ khung phụ trách khai báo, tạo và build độc lập.
