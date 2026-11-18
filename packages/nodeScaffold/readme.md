# Bộ khung node

`@toonflow/nodes-scaffold` cung cấp cấu hình Vite dùng chung, bộ khung node và giao diện với ứng dụng chủ. Mỗi plugin node trong `packages/nodes/*` tự quản lý dependency, thành phần Vue con và điểm vào build. Mã dùng chung giữa các plugin nằm tại `packages/nodeShared` dưới dạng gói độc lập `@toonflow/node-shared`, không được build như một node riêng.

```text
packages/nodeScaffold/
  index.ts                 共享构建配置
  src/runtime.ts           浏览器组件、组合式函数、类型和工具的统一入口
  src/useNode.ts           当前节点状态、端口、输出、事件和文件能力
  src/nodeSkeleton.vue     共用标题栏、内容 Card 和左右连接点
  src/values.ts            固定输出结构与类型校验
  src/nodeInputs.ts        按目标节点、输入端口读取上游值
  src/nodeEvent.ts         统一注册节点输入、输出、删除和连接校验事件
  src/workspaceFiles.ts    使用宿主文件能力、上传节点文件
packages/nodeShared/       跨插件共享组件与业务逻辑，独立包 @toonflow/node-shared
packages/nodes/imageNode/
  package.json             当前节点自己的依赖
  vite.config.ts           引用共享配置
  tsconfig.json
  src/index.vue            当前节点唯一入口
build/nodes/
  imageNode.umd.js          单个节点的元数据、组件、子组件、依赖和样式
data/nodes/
  imageNode.umd.js          开发时同步，供 server 加载
```

Đóng gói thành phần con trong `src/components/` của chính node, đặt các hàm tiện ích ở thư mục khác và import bình thường; chúng không tạo điểm vào node riêng.

`packages/nodeScaffold` chỉ cung cấp nền tảng node chung, cấu hình build và giao diện với ứng dụng chủ. Các năng lực runtime được import từ `@toonflow/nodes-scaffold/runtime`. Thành phần, tương tác, prompt, preset và logic nghiệp vụ riêng của plugin phải nằm trong chính plugin đó và được tái sử dụng qua các export công khai. Thành phần và logic dùng chung giữa các plugin phải đặt thống nhất tại `packages/nodeShared` và import qua subpath công khai của gói độc lập `@toonflow/node-shared`, không trộn vào bộ khung. Điểm vào gốc `@toonflow/nodes-scaffold` chỉ dành cho cấu hình Vite import `createNodeConfig`; không tham chiếu nó trong thành phần trình duyệt.

## Dependency chỉnh sửa Markdown dùng chung

Tiptap, marked và DOMPurify dùng lại dependency của ứng dụng chủ qua cấu hình external khi build. Trình sửa, thành phần xem trước, thanh công cụ và vòng đời do từng extension hoặc node triển khai trong gói riêng, không import thành phần của ứng dụng chủ và không có lớp chuyển tiếp thành phần. Gói con khi dùng những dependency này phải khai báo peerDependencies tương thích với ứng dụng chủ: các gói Tiptap hiện ở phiên bản `3.31.3`, `marked` ở `18.0.13` và `dompurify` ở `3.4.16`.

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

Các module dùng chung gồm `@tiptap/core`, `@tiptap/vue-3`, `@tiptap/starter-kit`, `@tiptap/markdown`, cùng `extension-find-and-replace`, `extension-highlight`, `extension-image`, `extension-list`, `extension-subscript`, `extension-superscript`, `extension-table`, `extension-text-align` (đều có tiền tố `@tiptap/`); còn có `@tiptap/pm/model`, `@tiptap/pm/state`, `@tiptap/pm/view`, `marked` và `dompurify`. Sản phẩm build tham chiếu dependency tương ứng từ `window.toonflowTiptapHost`, không đóng gói trùng các phần triển khai này.

Tiptap thống nhất dùng named import như `{ StarterKit }`, `{ Image }`, `{ Highlight }`, `{ Superscript }`, `{ Subscript }`, `{ TextAlign }`, `{ FindAndReplace }`. Với Vite 8 UMD hiện tại, default import sẽ lấy toàn bộ đối tượng module bên ngoài nên không phù hợp với các module chia sẻ này. DOMPurify riêng biệt chia sẻ hàm mặc định, tiếp tục dùng `import DOMPurify from "dompurify"`. Không cần bật cờ tương thích CJS cũ làm ảnh hưởng mọi dependency.

Ứng dụng chủ trước tiên kiểm tra UMD có tham chiếu `toonflowTiptapHost` không, chỉ tải động dependency dùng chung khi cần, rồi tiếp tục dùng lại cùng module ES. Plugin ảnh, video hoặc văn bản thuần thông thường không vì thế mà tải trước Tiptap. Việc mount, hủy, ẩn thành phần, cập nhật nội dung và lưu tệp vẫn do từng gói quản lý. Sản phẩm dùng dependency dùng chung cần phiên bản ứng dụng chủ tương ứng.

## Tái sử dụng nghiệp vụ phía plugin

Phần nhập prompt, danh sách tham chiếu, lịch sử tạo, trạng thái tạo và giải thích lỗi nằm ở `packages/nodeShared`. Node sử dụng cần khai báo `@toonflow/node-shared` là dependency workspace rồi import qua subpath:

```ts
import promptInput from "@toonflow/node-shared/promptInput";
import referenceItem from "@toonflow/node-shared/referenceItem";
import { useNodeReferences } from "@toonflow/node-shared/useNodeReferences";

const { refList, referenceMentions, setReferencePreview, removeReference } = useNodeReferences("in");
```

Chỉnh sửa ảnh, cắt ảnh thành ô lưới, vẽ lại một vùng và chiếu sáng được import từ các subpath tương ứng của `@toonflow/node-image`; trình phát video được import từ `@toonflow/node-video/videoPlayer`. Mã chia sẻ được đóng gói cùng node sử dụng; Vue, VueFlow và Element Plus tiếp tục dùng lại instance của ứng dụng chủ.

## Khung node

Import `nodeSkeleton` và `useNode` từ `@toonflow/nodes-scaffold/runtime`; tại điểm vào node, dùng `<nodeSkeleton v-bind="nodeProps">` bọc nội dung. `label` mặc định là “Node chưa đặt tên”; thanh tiêu đề phía trên không viền, phần nội dung phía dưới dùng Element Plus Card, slot mặc định chứa nội dung node. Giữ `defineOptions({ inheritAttrs: false })` tại điểm vào node để tránh thuộc tính cấp cao nhất do VueFlow truyền ghi đè `label` và các tham số khác của khung.

Phía trái tiêu đề hiển thị biểu tượng 16px, mặc định `IconBox`. Điểm vào node khai báo biểu tượng qua `defineOptions({ icon: IconPhoto })`; `useNode()` và danh sách node Canvas dùng chung thành phần đó. Từng instance có thể ghi đè qua `useNode({ icon })` hoặc `:icon` của khung; không cần ghi biểu tượng vào `data` của node.

Định nghĩa các cổng nối qua mảng `handles`; mặc định không có cổng. Mỗi mục chứa `id` duy nhất và ổn định trong node, `type` (`target` là đầu vào bên trái, `source` là đầu ra bên phải), loại dữ liệu `dataType` và `label` gợi ý tùy chọn. Cùng một phía hỗ trợ nhiều cổng, phân bố đều theo thứ tự mảng; cổng đơn được căn giữa. Card sẽ tăng chiều cao theo số cổng.

Mỗi node khai báo các cổng mặc định bằng `defineOptions({ handles })`; thành phần UMD công khai trực tiếp mảng này để Canvas lọc danh sách node có thể nối trước khi tạo node. `useNode()` tự sao chép khai báo vào ref `handles` độc lập; nếu cần khởi tạo động, vẫn có thể ghi đè bằng `useNode({ handles })`, không đọc khai báo hoặc giá trị mặc định từ `data.handles`. Node sửa `handles.value` để điều khiển số lượng, loại, nhãn gợi ý và thứ tự cổng; quy tắc nhận kết nối đăng ký qua `nodeEvent.on("canConnect", callback)`. `nodeProps` tự theo dõi thay đổi tiêu đề trên Canvas. Sau khi tiêu đề xuống dòng hoặc vị trí cổng thay đổi, neo kết nối sẽ được đo lại; khi xóa cổng, đổi ID cổng hoặc hướng vào/ra, các kết nối không còn hợp lệ của cổng cũ sẽ được dọn.

```vue
<template>
  <nodeSkeleton v-bind="nodeProps">
    <el-input v-model="outputs.text.value" type="textarea" class="nodrag nopan nowheel" @pointerdown.stop @mousedown.stop @dblclick.stop @keydown.stop />
  </nodeSkeleton>
</template>

<script setup lang="ts">
import { ElInput } from "element-plus";
import { nodeSkeleton, useNode, type NodeHandle } from "@toonflow/nodes-scaffold/runtime";

defineOptions({
  inheritAttrs: false,
  handles: [{ id: "text", type: "source", dataType: "STRING", label: "文本输出" }] satisfies NodeHandle[],
});
const { nodeProps, outputs } = useNode({
  label: "文本",
  outputs: { text: { dataType: "STRING", value: "" } },
});
</script>
```

`useNode(options?)` nhận `label`, `icon`, `handles`, `outputs` và trả về `id`, `node`, `config`, `nodeProps`, `handles`, `outputs`, `nodeEvent`, `nodeTools`, `files`, `ai`, `ffmpeg`, `asr`, `updateNodeInternals`. `nodeProps` là computed để bind vào khung, gồm tiêu đề, biểu tượng, cổng và đầu ra. `outputs` suy ra kiểu từ giá trị mặc định và phục hồi đầu ra hợp lệ đã lưu của node hiện tại; chỉ chấp nhận cổng source vẫn tồn tại và kiểu khớp. Giá trị văn bản mặc định giữ `STRING`; node ảnh không có đầu ra đã lưu thì giữ rỗng.

`files.uploadFile(file)`, `files.removeNodeFiles()` và `updateNodeInternals()` đã được gắn với node hiện tại, không phải truyền ID lần nữa; `files` cũng cung cấp `getWorkspaceFiles()`, `useFileUrl()`. Khai báo cổng, UI cụ thể, kiểm tra tải lên và cơ chế loại trừ đồng thời giữa tải/xóa vẫn do node nghiệp vụ quản lý. Có thể đọc trực tiếp trạng thái chọn qua `node.selected`, ví dụ bind `v-model:bottomVisible="node.selected"`.

`useNode()` còn trả về `previewReady` và truyền qua `nodeProps` đến khung: slot mặc định chỉ được mount khi node lần đầu tiến gần vùng nhìn, sau đó giữ trạng thái xem trước và UI. Việc đăng ký công cụ, đầu ra và tác vụ tạo phải nằm trong `setup` của chính node, không phụ thuộc thành phần xem trước được mount. Nếu cần mount nội dung ngay, đặt rõ `:previewReady="true"` trên khung. Khi chọn vùng hoặc kéo, slot trên/dưới không được mount, sẽ phục hồi khi nhấp chọn một node.

Cổng chưa nối dùng `IconCircleDashed`, sau khi nối dùng `IconCircleDot`; khi kết nối cuối cùng bị gỡ, trở về vòng tròn nét đứt. Biểu tượng 18px, vùng tương tác chuột trong suốt mở rộng ra ngoài 8px (tổng 34px), không còn hiển thị nền hình tròn đặc cũ.



### Xử lý phương tiện bằng FFmpeg

`await useNode().ffmpeg(signal?)` lấy factory được gắn với workspace hiện tại; lấy `ffmpeg` trong setup của thành phần rồi gọi trong hàm xử lý sự kiện. Cũng có thể dùng riêng `useNodeFfmpeg()` (import từ runtime hoặc `@toonflow/nodes-scaffold/nodeFfmpeg`). Cách gọi giống chuỗi fluent ở tools, hỗ trợ nhiều đầu vào/đầu ra, bộ lọc phức tạp, chụp khung hình, ghép, `clone()`, `ffprobe` và truy vấn khả năng như encoder.

```ts
const { ffmpeg: loadFfmpeg, id } = useNode();

async function compose(signal?: AbortSignal) {
  const ffmpeg = await loadFfmpeg(signal);
  // 输出目录应事先通过 files 创建；新文件名避免覆盖原素材。
  const output = `assets/${id}/combined.mp4`;
  await new Promise<void>((resolve, reject) => {
    ffmpeg("assets/first.mp4")
      .input("assets/second.mp4")
      .complexFilter("[0:v][1:v]hstack=inputs=2[video]")
      .outputOptions("-map [video]")
      .videoCodec("libx264")
      .on("progress", progress => console.log(progress.timemark))
      .on("error", reject)
      .on("end", () => resolve())
      .save(output);
  });
  return output;
}
```

Chuỗi lời gọi được chuyển qua `/api/ffmpeg/execute` cho `@toonflow/ffmpeg` của ứng dụng chủ thực thi; UMD của node không chứa thư viện thực thi Node.js. Hỗ trợ các sự kiện `start`, `progress`, `stderr`, `codecData`, `filenames`, `end`, `error` và `on/once/off`; cấu hình phải hoàn tất trước khi chạy, muốn song song dùng lệnh độc lập hoặc `clone()`. Thư mục được cố định lúc lấy factory nên sau khi đổi workspace, thao tác sẽ không ghi vào dự án mới.

Đầu vào/đầu ra dùng đường dẫn tệp workspace; tải lên và đọc nhị phân dùng lại `files`. Trình duyệt không thể truyền Node.js Stream, logger hoặc tiến trình con; không cung cấp `.pipe()`, setter đường dẫn chương trình thực thi hoặc tải tệp preset trên server. Có thể dùng `preset(command => ...)` để tái sử dụng cấu hình trong node. Dùng các kiểu `BrowserFfmpegFactory` / `BrowserFfmpegCommand`, không giả làm đối tượng Node.js nguyên sinh.

Unmount node, hủy signal được truyền vào hoặc `command.kill()` sẽ hủy yêu cầu và dừng chuyển đổi; nếu hủy trước lúc bắt đầu thì FFmpeg chạy sau cũng bị ngăn tiếp tục. Thư viện nguyên sinh phục vụ FFprobe/truy vấn năng lực không cung cấp tiến trình con; việc hủy chỉ ngừng chờ kết quả truy vấn. Nếu thiếu FFmpeg, tái sử dụng thông báo tải xuống trong cài đặt, không tự cài hoặc thử lại.

Đường dẫn đầu vào, đầu ra và ảnh chụp được truyền rõ phải tuân thủ kiểm tra workspace và symlink của ứng dụng chủ. I/O gián tiếp trong tham số gốc, bộ lọc và danh sách phương tiện vẫn chỉ dành cho node đáng tin, **không phải sandbox hệ thống tệp**. Xem API nguyên sinh phía server tại `packages/toolScaffold/readme.md`.

### Chuyển âm thanh thành văn bản

Trong setup của thành phần, lấy `const { asr } = useNode()` rồi gọi `await asr.transcribe("assets/audio.wav", { lang: "zh-CN", signal })` để trả về toàn văn nhận dạng. Cũng có thể import riêng `useNodeAsr()` từ runtime hoặc `@toonflow/nodes-scaffold/nodeAsr`; API micro `createBrowserAsr` và các hàm kiểm tra hỗ trợ cũng được export công khai.

Đầu vào là đường dẫn âm thanh trong workspace hiện tại, không rỗng và tối đa 100 MB. Workspace của lượt đọc được cố định; unmount node hoặc hủy signal đầu vào sẽ dừng nhận dạng và giải phóng tài nguyên âm thanh. Phần dưới dùng lại nhận dạng âm thanh của trình duyệt từ `@toonflow/asr` theo tốc độ phát gốc; nếu ứng dụng chủ không hỗ trợ hoặc dịch vụ nhận dạng báo lỗi thì ném lỗi trực tiếp, không chuyển sang micro. API tồn tại không đồng nghĩa dịch vụ nhận dạng trong WebView thực tế hoạt động; phải kiểm chứng trên gói cài đặt đích.

### Gọi mô hình AI

`ai` do `useNode()` trả về cung cấp danh sách mô hình văn bản và phương tiện, tạo văn bản và tạo phương tiện. Cũng có thể gọi riêng `useNodeAi()` trong setup thành phần. Tạo văn bản thống nhất dùng `ai.generate()`; thông báo dạng luồng và công cụ riêng là tham số tùy chọn, không cần đổi phương thức gọi.

```ts
const { ai } = useNode();
const models = await ai.getModels();
const model = models[0];
if (!model) throw new Error("请先在设置中添加模型");
const input = { providerId: model.providerId, modelId: model.modelId, prompt: "写一段简短介绍" };

// 一次返回完整文本，也可传入 systemPrompt。
const result = await ai.generate(input);
console.log(result.text);

// 按增量更新；Promise 最终返回完整结果。
let text = "";
await ai.generate({
  ...input,
  onEvent(event) {
    if (event.type === "text") text += event.delta;
  },
});
```

- `ai.getModels(signal?)`: đọc mô hình đã cấu hình trong cài đặt, trả `providerId`, `providerLabel`, `modelId`, `label`, `protocol` và ngữ cảnh/độ dài đầu ra tùy chọn; `protocol` là `openai-completions`, `openai-responses` hoặc `anthropic-messages`, không trả khóa hay địa chỉ API.
- `ai.generate(input)`: luôn trả `{ text, reasoning? }`. `input` gồm `providerId`, `modelId`, `prompt`; tùy chọn `systemPrompt`, `references`, `directory`, `tools`, `onEvent` và `signal`.
- `onEvent` nhận phần tăng thêm của văn bản hoặc suy nghĩ `{ type: "text" | "reasoning", delta }`, cùng sự kiện bắt đầu công cụ `{ type: "toolStart", id, name, args }` và hoàn tất công cụ `{ type: "toolEnd", id, name, result, isError }`. Không truyền callback vẫn dùng cùng quy trình thực thi và chỉ cần chờ kết quả cuối.
- `references` truyền các `{ dataType, value }` loại `STRING`, `IMAGE`, `VIDEO` theo thứ tự danh sách, ứng với số `{{ref 1}}`, v.v. Văn bản giữ nội dung gốc, phương tiện mang đường dẫn tương đối trong workspace và kiểu MIME; backend kiểm tra thư mục và đọc thành tệp đính kèm. Tham chiếu phương tiện phải truyền `directory` là đường dẫn tuyệt đối của workspace. Node không tự phán đoán khả năng nhận tệp đính kèm của mô hình; lỗi API được trả nguyên dạng. Video dùng `video_url` của Chat Completions, Responses/Anthropic gửi dưới dạng tệp; nhà cung cấp quyết định có chấp nhận không.
- Unmount thành phần sẽ dừng yêu cầu trình duyệt. Trong một số trường hợp SSE im lặng, Bun 1.3.14 không phát hiện ngắt kết nối kịp, quá trình tạo phía thượng nguồn có thể tiếp tục đến hết. Khi cần dừng sớm, truyền `signal: controller.signal`. Lỗi HTTP, lỗi trong stream và ngắt luồng không có sự kiện hoàn tất đều ném ngoại lệ; bên gọi chịu trách nhiệm hiển thị lỗi, client không tự thử lại.
- Node văn bản giữ đầu ra lần trước cho đến khi nhận văn bản mới; nếu stream bị ngắt, phần đã tạo được giữ lại.

Khi cần gọi công cụ, truyền `tools: localTools` có kiểu `NodeAiTool[]` vào cùng điểm vào; kiểu được export từ runtime. Mỗi công cụ có `{ name, description, parameters, execute }`; `parameters` là JSON Schema, `execute(args, signal)` thực thi phía node và kiểm tra tham số. Vòng lặp công cụ tái sử dụng SDK; ngữ cảnh lượt hiện tại do trình duyệt duy trì, mỗi yêu cầu mang ngữ cảnh mô hình cần. Server chỉ proxy một lần yêu cầu mô hình, đọc khóa và xử lý tệp đính kèm; không tạo phiên và không thực thi công cụ. Công cụ riêng không đăng ký vào `nodeTools` vì điểm này chỉ dành cho Agent tổng từ bên ngoài thao tác node.

Một lượt có công cụ được yêu cầu mô hình tối đa 40 lần, quá 10 phút sẽ phát tín hiệu hủy. Công cụ bất đồng bộ phải phản hồi `signal` được truyền; bộ khung không thể ép dừng mã tự ý bỏ qua tín hiệu. Công cụ cần commit nguyên tử chỉ nên sửa bản nháp riêng; khi gọi thành công, node kiểm tra và lưu, còn nếu lỗi/hủy thì bỏ bản nháp. Bộ khung không thể tự hoàn tác tác động bên ngoài mà công cụ đã tạo.

AI văn bản chỉ cung cấp `generate({ ...input, onEvent, signal })`; server chỉ nhận yêu cầu `Context` và trả SSE, không giữ định dạng gọi cũ.


- `ai.getMediaModels(signal?)`: đọc các mô hình ảnh/video do nhà cung cấp đã cài khai báo, trả ID và tên nhà cung cấp/mô hình, loại và tham số chế độ. Mô hình ảnh có thể khai báo các tùy chọn độ phân giải và tỷ lệ hỗ trợ qua `imageSizes`, `imageRatios`; khi tạo, node truyền lựa chọn bằng `size`, `ratio`.
- `ai.generateImage(input, signal?)`: tạo không streaming và ghi tệp, trả `{ path, mimeType, mediaType: "image" }[]`. `input` gồm `directory` là đường dẫn tuyệt đối của workspace, `providerId`, `modelId`, `prompt`, `outputDirectory` là thư mục tương đối trong workspace; có thể truyền `images: { path, mimeType }[]`, `ratio`, `size`. Tham chiếu ảnh chỉ truyền đường dẫn tương đối trong workspace để backend đọc.
- `ai.generateVideo(input, signal?)`: tạo video và ghi tệp, trả `{ path, mimeType, mediaType: "video" }[]`. Các trường cơ bản giống tạo ảnh; cấu hình video qua `duration`, `resolution`, `ratio`, `generateAudio`, `mode`, có thể truyền `images`, `videos`, `audios`, `firstFrame`, `lastFrame`. Mọi tư liệu đều là tham chiếu `{ path, mimeType }` trong workspace.

Ba phương thức `generate*` cho phương tiện giữ nguyên kiểu trả về và chấp nhận tham số thứ ba tùy chọn `{ taskId, nodeId, canvasPath, onStatus }`. `ai.resumeMedia(directory, taskId, signal?, options?)` chỉ kiểm tra lại tác vụ đã có; `ai.cancelMedia(directory, taskId)` hủy tường minh tác vụ phía server. Khi truyền `taskId` đã lưu bền vững, unmount node hoặc mất kết nối lúc truy vấn chỉ dừng chờ cục bộ; cách gọi cũ hai tham số vẫn hủy tác vụ khi unmount hoặc abort tường minh.

Node tạo dùng lại `@toonflow/node-shared/useNodeGeneration`, lưu định danh tác vụ và dữ liệu khôi phục không nhạy cảm tại `node.data.mediaTask`, lưu Canvas qua ứng dụng chủ trước khi gửi. Khi mở lại Canvas chỉ truy vấn ID đã có và lưu đầu ra sau khi hoàn tất. `useNodePersistence()` của ứng dụng chủ nằm ở `@toonflow/nodes-scaffold/nodeDocument`, trả ngữ cảnh gắn với thư mục và Canvas hiện tại; `save()` có thể chờ lưu xong. Nếu nhà cung cấp không cung cấp thông tin tác vụ có thể khôi phục, quá trình tạo đồng bộ sau khi tiến trình dịch vụ bị gián đoạn không được tự thực hiện lại; khôi phục thất bại vẫn giữ đầu ra cũ.

Trước khi tạo, lấy bản chụp `directory` qua `files.getWorkspaceFiles().list()`, dùng `assets/${id}` cho `outputDirectory`. Có thể gán trực tiếp kết quả vào `outputs.value.image = { dataType: "IMAGE", value: { url: result.path, mimeType: result.mimeType } }` và xem trước bằng `files.useFileUrl`. Node tạo ảnh ghép tham chiếu văn bản và truyền tham chiếu ảnh; thành công thì thay đầu ra, thất bại hoặc dừng thì giữ ảnh trước. Hủy yêu cầu trước khi xóa node. Canvas hiện tại giữ tư liệu node để hỗ trợ hoàn tác, không xóa tệp vật lý theo việc xóa node.

### Hàm node dành cho Agent

Gọi `nodeTools.register` trong `setup` đồng bộ của node. Có thể import `nodeTools` trực tiếp từ runtime hoặc lấy từ `useNode()` trả về. Phương thức tự gắn ID node hiện tại, trả hàm hủy đăng ký và tự hủy khi thành phần unmount.

```ts
import { useNode, z } from "@toonflow/nodes-scaffold/runtime";

const { outputs, nodeTools } = useNode({
  handles: [{ id: "text", type: "source", dataType: "STRING" }],
  outputs: { text: { dataType: "STRING", value: "" } },
});

nodeTools.register({
  name: "setText",
  description: "修改此节点的文本输出",
  parameters: z.strictObject({ text: z.string().min(1) }),
  execute({ text }) {
    outputs.value.text.value = text;
    return { text };
  },
});
```

Tên hàm dùng camelCase; ví dụ trên được hiển thị thành `node:setText`. Các hàm trùng tên được phân biệt bằng `nodeId`. Sau khi bật plugin “Thao tác Canvas” tại `packages/tools/canvas`, Agent dùng `findCanvasNodes` để tìm node, `getCanvasNodes` để truy vấn trường và cổng khi cần, `getNodeTools({ nodeIds: [...] })` để xem schema đầy đủ của hàm đích và gọi thông qua `nodeTools` thống nhất:

```json
{ "nodeId": "具体节点 ID", "name": "node:setText", "args": { "text": "新内容" } }
```

`parameters` sử dụng Zod object schema, còn `z` được bộ khung export chung, node không cần cài Zod riêng. Kiểu tham số của `execute` được suy ra tự động và chuyển thành Draft 7 JSON Schema của đầu vào lúc đăng ký để Agent và server sử dụng. Trước khi thực thi, frontend gọi `safeParseAsync` từ schema gốc để giữ giá trị mặc định, chuyển đổi và `refine` bất đồng bộ. Nếu tham số không hợp lệ, callback không chạy; lỗi kèm mô tả hàm hiện tại, schema tham số và hướng dẫn sửa. Kiểu đầu vào không chuyển được thành JSON Schema sẽ báo lỗi ngay khi đăng ký.

Callback hỗ trợ đồng bộ hoặc bất đồng bộ, giá trị trả về phải tuần tự hóa được thành JSON. Nếu không có giá trị thì trả `null`; ngoại lệ được gửi về Agent dưới dạng lỗi thực thi công cụ.

Registry dùng chung instance Vue Flow của ứng dụng chủ, không ghi vào JSON Canvas. Mỗi truy vấn hàm đọc registry hiện tại; `addNode` trả thông tin node vừa thêm nên có thể dùng `getNodeTools` tra và gọi ngay trong cùng lượt Agent. Hàm của node đã unmount không thể gọi. Chuyển Canvas thủ công sẽ chấm dứt thao tác của cuộc trò chuyện hiện tại đang gắn với Canvas cũ. Khi Agent tạo bằng `addCanvas` hoặc chuyển bằng `switchCanvas`, chỉ cuộc trò chuyện phát động thao tác được gắn lại Canvas mới và có thể tiếp tục gọi trong cùng lượt. Chỉnh sửa thực hiện qua instance Vue Flow; frontend chờ quy trình lưu Canvas sẵn có hoàn tất rồi mới trả kết quả. Đọc không kích hoạt lưu.

`getCanvas` mặc định chỉ trả tổng quan Canvas. Chỉ `include: ["canvases"]` mới trả danh sách Canvas trong workspace theo trang (`id`, `name`); `include: ["nodeTypes"]` trả loại node khả dụng theo trang. `addCanvas({ name? })` tạo Canvas trống và chọn nó; nếu không truyền tên thì dùng `画布N` chưa bị chiếm. `switchCanvas({ canvasId })` chuyển Canvas sau khi lưu. `renameCanvas({ canvasId?, name })` đổi tên tệp JSON tương ứng; nếu bỏ `canvasId` thì đổi Canvas đang hoạt động, `name` không chứa đuôi `.json`. Cả ba trả tổng quan Canvas đang hoạt động đã cập nhật; tạo và đổi tên không ghi đè tệp đã tồn tại.

Các công cụ đọc Canvas gồm `getCanvas`, `findCanvasNodes`, `getCanvasNodes`, `getCanvasEdges` và `getNodeTools`, đều có phân trang và giới hạn phản hồi 64 KiB. Kiểm tra `hasMore/nextCursor` và giữ tham số gốc để đọc tiếp; trang kết quả rỗng cũng có thể chưa quét hết. `getCanvasNodes` hỗ trợ tối đa 20 ID mỗi lô, chiếu các trường và `dataKeys`. Dữ liệu lớn được đọc theo `path`, chuỗi chia đoạn bằng `textOffset/textLimit` và mảng/đối tượng phân trang bằng `valueOffset/valueLimit`; `truncated` trả đường dẫn và offset để đọc tiếp. Tác vụ toàn Canvas xử lý theo lô và giữ tóm tắt, không tích lũy mọi chi tiết; schema hàm luôn đầy đủ.

Mỗi trang node hoặc kết nối quét tối đa 2.000 mục; `totalNodes/totalEdges` là tổng trên Canvas, không phải số khớp bộ lọc; `selectedOnly` đọc trạng thái chọn hiện tại. Tên được so khớp toàn văn nhưng phần xem trước tên trong danh sách dài tối đa 512 ký tự. `nodeIds` trong truy vấn chi tiết hoặc hàm phải loại trùng, `textOffset/valueOffset` dương bắt buộc đi với `path`. Đường dẫn tối đa 64 cấp, JSON UTF-8 tối đa 2048 byte; `pathDepthLimit` cho biết chạm giới hạn độ sâu. Biên nhận ID cho thao tác cấu trúc tối đa 100 mục; sắp xếp, chỉnh khung nhìn và xóa lần lượt có `arrangedCount`, `nodeCount`, `removedEdgeCount`. `truncated` chỉ có nghĩa biên nhận rút gọn, không nên chạy thao tác lại. Kết quả nghiệp vụ của `nodeTools` theo định nghĩa node và không chịu giới hạn 64 KiB của năm công cụ đọc.

Các thao tác thay đổi Canvas cơ bản gồm `addCanvas`, `switchCanvas`, `renameCanvas`, `addNode`, `deleteNodes`, `moveNodes`, `renameNodes`, `connectNodes`, `deleteEdges`, `selectNodes` và `fitCanvas`. Nội dung node vẫn sửa bằng hàm đã đăng ký, không cho Agent tùy ý ghi `data` của node. Xóa kích hoạt callback `delete` của node trước rồi dọn kết nối; nối dùng lại kiểm tra hướng cổng, loại dữ liệu và `canConnect` của node.

Callback bất đồng bộ lấy `{ signal }` từ tham số thứ hai, truyền cho `fetch` và các thao tác tương tự, đồng thời kiểm tra `signal.throwIfAborted()` trước khi đổi trạng thái. Một lần gọi chờ tối đa 120 giây; hủy hoặc chuyển Canvas sẽ ngừng chờ, nhưng công việc bất đồng bộ trong callback phải phối hợp với signal mới dừng được. Nếu trình duyệt ngắt đột ngột và runtime không phát sự kiện đóng, server dùng timeout để dọn lượt chờ.

### Slot nổi phía trên và dưới

Khung cung cấp hai named slot `top` và `bottom`, lần lượt điều khiển ẩn/hiện qua `v-model:topVisible` và `v-model:bottomVisible`, mặc định ẩn. Nếu không cung cấp slot `top` thì phía trên mặc định hiển thị thanh “Thêm vào thư viện tư liệu, Tải xuống, Toàn màn hình”. Nếu không cung cấp slot `bottom` thì không render lớp nổi dưới. Lớp nổi căn giữa theo chiều ngang, cách node 12px; lớp trên nằm phía trên thanh tiêu đề để không che chữ. Cả hai không chiếm không gian bố cục node, không ảnh hưởng vị trí Card hoặc cổng nối.

`topWidth` và `bottomWidth` mặc định đều là `"20vw"`. Giá trị số được hiểu là px, chuỗi hỗ trợ phần trăm và các đơn vị chiều rộng CSS khác. Với thanh công cụ mặc định, nên đặt `topWidth="max-content"`. Truyền `downloadUrl`, `downloadName` để điều khiển tải xuống; dùng `@fullscreen` mở chế độ toàn màn hình của node. Nút thư viện tư liệu dùng lại đầu ra node và hộp thoại lưu của ứng dụng chủ, bị vô hiệu hóa nếu không có đầu ra. Nút bổ sung đặt trong slot `topActions`, trước nút tải xuống; node ảnh/video/âm thanh cung cấp nút thay thế ở đây. Tùy biến `top` sẽ thay toàn bộ thanh công cụ. Chỉnh nội dung lớp nổi không kéo Canvas hoặc bật menu chuột phải của node.

```vue
<template>
  <nodeSkeleton v-model:topVisible="topVisible" v-model:bottomVisible="bottomVisible" :bottomWidth="480">
    <template #top>上方内容</template>
    <template #bottom>下方内容</template>
  </nodeSkeleton>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { nodeSkeleton } from "@toonflow/nodes-scaffold/runtime";

defineOptions({ inheritAttrs: false });
const topVisible = ref(true);
const bottomVisible = ref(false);
</script>
```

### Loại dữ liệu và kiểm tra kết nối

`dataType` mô phỏng [các loại dữ liệu ComfyUI](https://docs.comfy.org/custom-nodes/backend/datatypes), dùng chuỗi chữ hoa phân biệt hoa/thường: `STRING`, `INT`, `FLOAT`, `BOOLEAN`, `IMAGE`, `MASK`, `LATENT`, `AUDIO`, `VIDEO`, `MODEL`, `CLIP`, `VAE`, `CONDITIONING`; cũng hỗ trợ loại tùy biến. `*` là loại đại diện mọi giá trị; `["INT", "FLOAT"]` nghĩa là chấp nhận nhiều loại, loại đơn vẫn ghi được `"IMAGE"`. Tương thích cú pháp chuỗi phân cách bằng dấu phẩy cũ. Mặc định có thể nối khi tập loại ở hai đầu giao nhau. Đầu ra ảnh dùng `IMAGE`, node tổng quát dùng `*`. Đây chỉ là khai báo tương thích cổng, không tạo hay chuyển đổi dữ liệu.

Chỉ cho `source` nối với `target`; cổng cùng loại hoặc thiếu cổng/loại luôn bị từ chối. Node đăng ký callback kiểm tra qua `nodeEvent.on("canConnect", callback)` theo chữ ký `ValidConnectionFunc` của VueFlow: `(connection, context) => boolean`. `connection` gồm `source`, `target`, `sourceHandle`, `targetHandle`; `context` chứa hai node đầu cuối cùng node và kết nối của Canvas hiện tại. Dù bắt đầu kéo từ đầu nào, các trường luôn theo đúng hướng đầu vào/đầu ra thực tế và **chỉ gọi callback của node target, source không tham gia kiểm tra**.

Quy tắc nhận bổ sung được đăng ký trong `setup` của thành phần node cụ thể. Ví dụ dưới giới hạn mỗi cổng đầu vào nhận tối đa hai kết nối; trong callback cũng có thể đọc `sourceNode.id`, `sourceNode.type`, `sourceNode.data` và cổng nguồn để hạn chế nguồn vào. Node ảnh chỉ có đầu ra nên không cần callback nhận.

```vue
<template>
  <nodeSkeleton v-bind="nodeProps" />
</template>

<script setup lang="ts">
import { nodeSkeleton, useNode } from "@toonflow/nodes-scaffold/runtime";

defineOptions({ inheritAttrs: false });
const { nodeProps, nodeEvent } = useNode({
  handles: [
    { id: "in", type: "target", dataType: "*" },
    { id: "out", type: "source", dataType: "*" },
  ],
});

nodeEvent.on("canConnect", (connection, { edges }) => {
  // 类型兼容由骨架统一检查，本节点只限制每个输入端口的连接数量。
  return edges.filter(edge => edge.target === connection.target && edge.targetHandle === connection.targetHandle).length < 2;
});
</script>
```

Kiểm tra chung trước tiên xác nhận hướng cổng, sự tồn tại và tương thích loại, sau đó mới gọi callback bổ sung của target. Nếu không đăng ký callback thì cho nối; callback đã đăng ký phải chạy đồng bộ và trả đúng `true`, trả giá trị khác hoặc ném lỗi sẽ từ chối kết nối. Không hỗ trợ kiểm tra bất đồng bộ. Node không cần gọi lại `isTypeCompatible` và không thể vượt giới hạn loại bằng cách trả `true`. Callback được gọi lặp trong lúc kéo, nên không được tạo tác dụng phụ.

Bộ khung đặt khai báo cổng trong `node.data.handles`. Sự kiện được dùng chung theo instance VueFlow hiện tại và ID node, hỗ trợ kết nối giữa các node UMD độc lập. Tất cả cổng dùng cùng điểm vào kiểm tra để bảo đảm kéo từ source vẫn gọi callback target. Các kiểu `NodeData`, `NodeHandle`, `NodeDataType` và hàm `isTypeCompatible`, `validateConnection` được export từ `@toonflow/nodes-scaffold/runtime`. Khi gọi `addEdges` thủ công, phải tự gọi hàm kiểm tra; không được bỏ qua quy trình kéo dây mà vẫn cho là đã kiểm tra.

## Xóa node

Node đăng ký xử lý xóa qua `nodeEvent.on("delete", callback)`, có thể dùng callback bất đồng bộ. Bộ khung chờ lần lượt theo thứ tự đăng ký, chỉ xóa node và các kết nối khi mọi xử lý đều thành công; nếu không có hàm xử lý thì xóa trực tiếp, nếu bất kỳ xử lý nào ném lỗi thì dừng, thông báo và giữ node. Nút xóa và menu chuột phải dùng chung điểm vào này. Không dọn tệp khi unmount thành phần vì chuyển Canvas hoặc tải lại node cũng có thể xóa nhầm tài nguyên.

```ts
import { useNode } from "@toonflow/nodes-scaffold/runtime";

const { nodeEvent, files } = useNode();
nodeEvent.on("delete", async () => {
  await files.removeNodeFiles();
});
```

Node ảnh gọi `files.removeNodeFiles()` trong callback xóa. Canvas hiện tại dùng `retainNodeFiles` giữ tư liệu để hỗ trợ hoàn tác, nên phương thức này không xóa tệp vật lý. Ứng dụng chủ không bật chính sách giữ tệp sẽ dọn `assets/<nodeId>/` trong workspace; nếu thư mục không tồn tại thì coi như đã dọn. Từ chối xóa khi đang tải lên và khóa tải lên khi đang dọn. Chỉ dọn thư mục riêng của node đó, không dựa vào URL đầu ra để xóa tệp node khác. Node được sao chép vẫn có thể chia sẻ đường dẫn ảnh gốc; ứng dụng chủ phải tính đến những tham chiếu này trước khi cho phép dọn vật lý.

## Giá trị đầu ra và công cụ đọc

Đầu ra do ref `outputs` của `useNode` quản lý và được truyền cho khung qua `nodeProps`. Khóa của đối tượng là ID cổng source, mỗi giá trị cố định theo dạng `{ dataType, value }`. Ví dụ sau khi node ảnh đã chuẩn bị xong tài nguyên:

```ts
import { useNode } from "@toonflow/nodes-scaffold/runtime";

const { outputs } = useNode({
  handles: [{ id: "image", type: "source", dataType: "IMAGE" }],
});
// 在节点的实际加载或生成逻辑完成后赋值。
outputs.value.image = { dataType: "IMAGE", value: { url: "assets/example.png", mimeType: "image/png" } };
```

Giao thức đầu ra ban đầu như bên dưới. Phương tiện được biểu diễn bằng tham chiếu tệp, không phải tensor Python của backend ComfyUI; không thực hiện chuyển đổi dữ liệu.

| dataType | value |
| --- | --- |
| STRING | string |
| INT | number nguyên an toàn |
| FLOAT | number hữu hạn |
| BOOLEAN | boolean |
| IMAGE / MASK | `{ url: string, mimeType: "image/…" }` |
| VIDEO | `{ url: string, mimeType: "video/…" }` |
| AUDIO | `{ url: string, mimeType: "audio/…" }` |

Giá trị đầu ra phải dùng loại cụ thể, không dùng `*` hoặc mảng loại vì chúng chỉ dành cho khai báo tương thích cổng. Các loại cổng khác như `LATENT`, `MODEL` chưa có giao thức truyền giá trị; khi thêm giao thức phải mở rộng đồng thời `NodeValueMap` và `isNodeOutput`. Node ảnh chưa tải tệp lên có đầu ra rỗng; khi làm mới, phục hồi từ `data.outputs` đã lưu trên Canvas.

### Tải ảnh lên và tệp workspace

Node ảnh chọn tệp bằng nút tải lên, lưu vào `assets/<nodeId>/<随机文件名>.<扩展名>` trong workspace hiện tại (thư mục tên `assets`). Khi thay ảnh, dùng tên tệp mới và giữ tệp cũ để không ảnh hưởng các tham chiếu của node đã sao chép. Đầu ra ảnh là `{ dataType: "IMAGE", value: { url: "assets/...", mimeType: "image/..." } }`; `url` là đường dẫn tương đối trong workspace, không phải URL có thể trực tiếp đưa vào `<img src>`.

Trong `setup` của node, lấy `files` do `useNode()` trả về, không phải tự chèn dependency hoặc gọi API:

```ts
import { useNode } from "@toonflow/nodes-scaffold/runtime";

const { files } = useNode();
const path = await files.uploadFile(file); // 创建当前节点目录，使用唯一文件名写入
const workspaceFiles = files.getWorkspaceFiles();
const bytes = await workspaceFiles.read(path);
```

`getWorkspaceFiles()` trả về bộ phương thức tệp đầy đủ của ứng dụng chủ: `list`, `read`, `readText`, `readJson`, `write`, `writeJson`, `rename`, `remove`, `mkdir`. Mỗi lần gọi gắn với thư mục làm việc ở thời điểm đó; thao tác nhiều bước nên dùng lại một giá trị trả về. Bên trong `uploadFile` cũng chỉ lấy một lần để tránh ghi nhầm sang thư mục dự án khác khi đổi dự án giữa lúc tải lên. Node cụ thể chịu trách nhiệm kiểm tra loại và kích thước tệp.

Canvas cung cấp năng lực tệp ứng dụng chủ qua Vue `provide("workspaceFiles", factory)`; bộ khung phụ trách inject, không đóng gói Axios hay Pinia. Ứng dụng chủ chia sẻ việc đọc tệp cùng workspace và Blob URL qua `acquireUrl(path, mimeType)` tùy chọn, trả `{ url: Promise<string>, release() }`. URL được thu hồi khi người dùng cuối cùng giải phóng, cache mất hiệu lực sau khi tệp được ghi, đổi tên hoặc xóa. JSON Canvas chỉ lưu bền vững đường dẫn tương đối và kiểu MIME.

`files.useFileUrl(media, onError)` trong `setup` nhận ref, computed hoặc getter của `{ url, mimeType }`, trả URL ref có thể bind vào `src` của ảnh, âm thanh hoặc video. Nó đọc tệp khi node lần đầu tiến gần vùng nhìn, bỏ qua yêu cầu đã lỗi thời và giải phóng tham chiếu tài nguyên khi thay thế hoặc unmount; nếu ứng dụng chủ cũ chưa cung cấp `acquireUrl` thì dùng cách đọc thông thường. Lỗi giao cho `onError` xử lý. Node ảnh chỉ cần `const previewUrl = files.useFileUrl(image, error => showError(error, "图片读取失败"))`.

Trong `setup` của node, dùng bộ công cụ đọc target được chỉ định:

```ts
import { computed } from "vue";
import { useNode, useNodeInputs } from "@toonflow/nodes-scaffold/runtime";

const { id } = useNode();
const { getTargetSources, getTargetValues } = useNodeInputs();
const sources = computed(() => getTargetSources(id, "in"));
// 每项为 { node, handle }：上游节点对象、与该输入连接的 source 端口。
const inputValues = computed(() => getTargetValues(id, "in"));
// 也可传其它目标节点 ID：getTargetValues("otherNodeId", "imageInput")。
// 每项为 { source, sourceHandle, dataType, value }。
```

Một đầu vào có thể nối nhiều source nên kết quả là mảng theo thứ tự kết nối trên Canvas. Kết nối bị ngắt, thiếu cổng hoặc không tương thích loại sẽ không trả kết quả; kết nối chưa có đầu ra vẫn giữ nguồn và `dataType` khai báo tại cổng, với `value` là `undefined` và danh sách tham chiếu hiển thị biểu tượng loại. Các giá trị hợp lệ `0`, `false`, chuỗi rỗng được giữ. Trước khi đọc nội dung hoặc tạo phải kiểm tra `value`, không gửi tham chiếu rỗng làm tệp đính kèm. Nếu cấu trúc hoặc loại đầu ra không khớp khai báo source thì ném lỗi. Khi đặt trong `computed`, thay đổi kết nối, cổng hoặc giá trị đầu ra tự cập nhật kết quả đọc. Công cụ chỉ đọc giá trị hiện tại, không chạy node thượng nguồn hoặc yêu cầu tệp phương tiện.

`getTargetSources` trả các nguồn của cổng target theo thứ tự kết nối, không yêu cầu thượng nguồn đã có đầu ra. Kết nối thiếu node/cổng, sai hướng hoặc không tương thích loại cổng không được trả; các cổng khác nhau của cùng node thượng nguồn vẫn được giữ riêng. Dùng nó khi chỉ cần xem kết nối; khi cần giá trị đầu ra thực hãy dùng `getTargetValues`.

Các hàm thuần `getTargetSources(targetId, targetHandleId, nodes, edges)` và `getTargetValues(targetId, targetHandleId, nodes, edges)` cũng được export từ `@toonflow/nodes-scaffold/runtime` và có thể dùng trực tiếp trong logic đã có dữ liệu Canvas.

### Sự kiện node

Trong `setup` của thành phần node, lấy `nodeEvent` từ `useNode()`; cũng có thể gọi riêng `useNodeEvent()`. Không truyền tham số thì mặc định dùng node hiện tại, còn `useNodeEvent(nodeId)` dùng node được chỉ định. Đăng ký thống nhất bằng `nodeEvent.on(name, callback)` với đúng hai tham số: tên sự kiện và callback. `input:<handleId>` theo dõi đầu vào thượng nguồn của target handle; `output:<handleId>` theo dõi đầu ra source handle; cổng đầu vào và đầu ra cùng tên được theo dõi riêng. Xử lý xóa và kiểm tra kết nối dùng các sự kiện `delete` và `canConnect` đã mô tả. `useNodeInputs()` vẫn là công cụ đọc tức thời, không phụ trách đăng ký sự kiện.

Callback `save` phải chờ ghi tệp node hoàn tất; nếu ném lỗi sẽ ngăn việc chuyển hoặc làm mới hiện tại. Lưu thông thường không truyền tham số; khi buộc làm mới thì truyền `"reload"`, để node đang tạo hoặc xuất chưa xong có thể từ chối unmount, tránh instance mới đọc nội dung chưa hoàn tất.

```ts
import { useNode, useNodeEvent } from "@toonflow/nodes-scaffold/runtime";

const { nodeEvent } = useNode();
const stopInput = nodeEvent.on("input:in", values => {
  // values: NodeInputValue[]，每项包含 source、sourceHandle、dataType、value。
});
const stopOutput = nodeEvent.on("output:text", output => {
  // output: NodeOutput | undefined，包含 dataType、value。
});

useNodeEvent("otherNodeId").on("output:text", output => {
  // 监听其它节点的指定输出端口。
});
// 需要提前停止时调用 stopInput() / stopOutput()。
```

Sau khi đăng ký listener đầu vào/đầu ra, callback nhận ngay giá trị hiện tại. Sau đó, đầu vào phát thông báo khi kết nối, cổng hoặc đầu ra thượng nguồn thay đổi; đầu ra phát thông báo khi cổng hoặc giá trị đầu ra thay đổi, kể cả trường lồng nhau như URL trong đối tượng phương tiện. Đầu vào không có giá trị hợp lệ là `[]`, đầu ra không tồn tại là `undefined`. Việc xóa node, gỡ cổng hoặc xóa đầu ra cũng phát thông báo; các giá trị hợp lệ `0`, `false` và chuỗi rỗng được giữ. Kiểm tra loại giống công cụ đọc; đầu ra không hợp lệ sẽ ném lỗi.

Listener đầu vào/đầu ra dùng `watch` sâu của Vue được chia sẻ, các thay đổi đồng bộ trong cùng lượt được gộp theo lịch Vue, không chạy node thượng nguồn. Không sửa vô điều kiện đầu ra đang theo dõi ngay trong callback để tránh vòng kích hoạt. Mọi lệnh đăng ký `on` đều trả hàm hủy; nếu đăng ký đồng bộ trong `setup` thì tự dọn khi phạm vi thành phần bị hủy, hoặc có thể gọi hàm trả về để hủy sớm.

## Build và tải node

Chạy tại thư mục gốc repository:

```powershell
bun install
bun run dev:plugins
bun run dev
```

Chỉ build hoặc theo dõi một node:

```powershell
bun run --filter '@toonflow/node-image' build
bun run --filter '@toonflow/node-image' dev
```

Chạy lệnh theo dõi node và `bun run dev` ở thư mục gốc trong hai terminal riêng; sau khi sửa mã nguồn, làm mới trang ứng dụng chủ. Build mặc định chỉ xuất ra `build/nodes` tại thư mục gốc. `dev:plugins` đặt `NODE_ENV=dev`; lệnh theo dõi node hoặc Vite `--mode development` cũng đồng bộ node hiện tại vào `data/nodes`. Khi đồng bộ, ghi tệp tạm trước rồi thay tệp chính để tránh dịch vụ đọc script chưa ghi xong; nếu đồng bộ thất bại sẽ báo lỗi build.

Build một gói không dọn hai thư mục trên để tránh xóa sản phẩm node khác. `bun run build:nodes` ở thư mục gốc trước tiên xóa sạch `build/nodes` rồi build tất cả node, không sửa `data/nodes`. Node đã cài mà không còn cần thì gỡ qua trang cài đặt.

Server cung cấp danh sách node `/api/nodes/get` từ `data/nodes` và script qua `/api/nodes/files?name=<节点名>`. Trang chủ tự đọc danh sách, tải `window.toonflowNodes[节点名]` tương ứng và đăng ký vào VueFlow; menu chuột phải cho phép thêm node đã tải. Không cần cấu hình `VITE_NODES_URL` hoặc khởi động dịch vụ riêng phục vụ sản phẩm build.

Danh sách đã cài hỗ trợ bật, tắt và gỡ. Trạng thái tắt được lưu thành dấu `data/nodes/<节点名>.disabled`, đồng bộ phát triển không đặt lại; gói bị tắt vẫn hiển thị trong danh sách đã cài nhưng backend ngừng cung cấp script của nó. Gỡ cài đặt chỉ xóa UMD và dấu trạng thái tương ứng trong `data/nodes`, giữ mã nguồn và sản phẩm tại `build/nodes`. Cài lại hoặc đồng bộ phát triển sẽ thêm lại node. Sau thao tác, menu thêm node trên Canvas đồng bộ ngay; các instance và kết nối hiện có của Canvas vẫn giữ, nhưng sau khi làm mới trang chỉ tải các gói đang bật.

## Thêm node mới

1. Tham khảo `packages/nodes/imageNode`, tạo mã nguồn và cấu hình trong thư mục chưa tồn tại (ví dụ `packages/nodes/exampleNode`). Viết nội dung theo nhu cầu node mới, đổi tên gói trong `package.json`, chẳng hạn `@toonflow/node-example`, và đổi tên node trong `vite.config.ts` thành `exampleNode`.
2. Sửa `src/index.vue`, khai báo framework UI và thư viện bên thứ ba sử dụng trong `dependencies` của gói con. Nếu cần Sass hoặc plugin build khác, thêm vào `devDependencies` của gói đó.
3. Tại thư mục gốc chạy `bun install` và `bun run dev:plugins` để tạo `build/nodes/exampleNode.umd.js` và đồng bộ vào `data/nodes/exampleNode.umd.js`. Chạy `bun run dev` hoặc làm mới trang chủ đang mở để tải node; trong trình duyệt, export là `window.toonflowNodes.exampleNode`. Chỉ dùng `bun run build:nodes` khi cần tạo sản phẩm phát hành.

Tên node phải duy nhất và theo camelCase; chỉ định tên tường minh giúp tránh khác biệt chữ hoa/thường trong đường dẫn của công cụ Windows làm sai tên export. Cấu hình Vite của từng gói chỉ cần:

```ts
import { createNodeConfig } from "@toonflow/nodes-scaffold";

export default createNodeConfig({
  name: "exampleNode",
  displayName: "示例节点",
  author: "", // 填写作者名称
  github: "", // 填写作者或项目的 https://github.com/... 地址
}, import.meta.url);
```

`name` là định danh duy nhất của node, quyết định tên tệp và tên đăng ký VueFlow; `displayName` là tên hiển thị trên chợ plugin. `author` và `github` có thể để trống, chợ chỉ hiển thị thông tin đã điền.

Phiên bản được quản lý trong `package.json.version` của từng gói con node, ví dụ `"version": "2.0.0"`. Khi phát hành bản mới, sửa trường này, không phải điền lại trong cấu hình Vite. Build yêu cầu phiên bản là chuỗi không rỗng và theo dõi thay đổi của `package.json`.

Quá trình build ghi ba trường hiển thị, `version`, `readme` và `configRules` vào chú thích `/*! toonflowNode:{JSON} */` ở dòng đầu UMD, không cần manifest riêng. Server chỉ phân tích JSON đó, không thực thi mã node, và trả metadata qua `/api/nodes/get`. Danh sách đã cài trong cài đặt hiển thị tên, phiên bản và tác giả plugin; biểu tượng nhỏ cuối tên mở GitHub. UMD cũ không có metadata vẫn hiện định danh node; nếu thiếu phiên bản, API trả chuỗi rỗng. Sau khi sửa cấu hình hoặc phiên bản và đồng bộ phát triển, mở lại chợ để làm mới.

Khi cần alias, plugin hoặc cấu hình bổ sung, dùng `mergeConfig` của Vite trong `vite.config.ts` của node để ghép. Giữ định dạng UMD, thư mục đầu ra và cấu hình external/globals của mọi dependency chia sẻ trong cấu hình chung.

Ứng dụng chủ cũng có thể gọi `createNodeConfig(metadata, configUrl, { outDir, syncToData: false })`, ghi sản phẩm vào thư mục chỉ định rồi chuyển cho quy trình cài đặt hiện có. `outDir` là đường dẫn tuyệt đối hoặc tương đối so với dự án node; nếu không truyền tùy chọn thì giữ thư mục build và hành vi đồng bộ phát triển gốc. Nếu tắt đồng bộ tường minh, sẽ không ghi vào `data/nodes` ngay cả khi build ở chế độ phát triển hoặc theo dõi liên tục. Build chỉ cho phép một script UMD, tài nguyên phải nhúng bên trong, không phụ thuộc tệp cài đặt bổ sung.

### Cấu hình plugin node

Node có thể khai báo `configRules` trong `createNodeConfig`, dùng trực tiếp `Rule[]` từ `@form-create/element-ui`, chung định dạng với công cụ và cùng cách render frontend `<form-create>`. Các trường `type`, `field`, `title`, `value`, `props`, `options`, `validate`, v.v. tuân theo quy tắc nguyên sinh của thư viện, không tạo định dạng form riêng. Quy tắc được truyền cùng metadata plugin ở dạng JSON, tối đa 100 mục, không chứa hàm hoặc giá trị ngoài JSON. Nếu không khai báo hoặc mảng rỗng, nút cấu hình bị ẩn; trường bắt buộc được khai báo bằng `validate`:

```ts
export default createNodeConfig({
  name: "exampleNode",
  displayName: "示例节点",
  author: "",
  github: "",
  configRules: [{
    type: "input",
    field: "apiKey",
    title: "API Key",
    props: { type: "password", showPassword: true },
    validate: [{ required: true, whitespace: true, message: "请填写 API Key" }],
  }],
}, import.meta.url);
```

Người dùng mở biểu mẫu “Cấu hình” của node trong chợ plugin ở phần cài đặt rồi lưu. Khi thiếu cài đặt bắt buộc, nút cấu hình hiển thị chấm đỏ nhỏ. Cấu hình được lưu theo loại node và dùng chung cho mọi instance cùng loại, không ghi vào `node.data` hoặc JSON Canvas.

```ts
const { config } = useNode();
// 在实际执行时读取，保留配置保存后的响应式更新。
const apiKey = computed(() => String(config.value.apiKey ?? ""));
```

`config` là computed chỉ đọc, chỉ chứa cấu hình riêng của loại node hiện tại, không cung cấp settings toàn cục. Ứng dụng chủ cấp quyền đọc phản ứng qua Vue `provide("nodeConfig", (nodeType: string) => config)`; bộ khung truyền loại đầy đủ của node hiện tại (ví dụ `remote-exampleNode`). Sau khi người dùng lưu, node đã tồn tại nhận cấu hình mới; trường chưa lưu dùng `value` mặc định trong `configRules`; nếu ứng dụng chủ không cung cấp năng lực này thì trả `{}`.

## Ranh giới dependency và style

- `vue` và `@vue-flow/core` là peer dependency của node. UMD dùng trực tiếp `window.toonflowNodeHost.vue`, `.vueFlow` do ứng dụng chủ cung cấp; không tạo Vue app trong node, `useVueFlow()` kế thừa Canvas hiện tại.
- `element-plus` cũng là peer dependency, dùng lại `window.toonflowNodeHost.elementPlus`. Import thành phần từ điểm vào gốc khi cần, ví dụ `import { ElButton } from "element-plus"` và dùng `<el-button>` trong template. Không import `element-plus/es/...` hoặc CSS của nó. Ứng dụng chủ tải thống nhất thành phần và style Element Plus; sản phẩm node không đóng gói trùng.
- Phần lõi `three` dùng lại `window.toonflowNodeHost.three` qua external, ứng dụng chủ cung cấp đầy đủ API. Node tiếp tục khai báo cùng phiên bản `three` với ứng dụng chủ (hiện `0.184.0`), dùng `import { WebGLRenderer, Vector3 } from "three"` bình thường, không cần truy cập biến toàn cục trực tiếp. Phần mở rộng `three/addons/*` và `three/examples/jsm/*` vẫn được đóng gói vào node khi cần; các tham chiếu `three` bên trong phần mở rộng cũng dùng lõi chủ. Không import sâu lõi từ `three/src/*`. UMD node và ứng dụng chủ phải dùng các phiên bản tương thích.
- Pi SDK dùng cho AI văn bản cũng được chia sẻ qua cơ chế external hiện có từ `window.toonflowNodeHost.ai`, gồm `runAgentLoop` và `createAssistantMessageEventStream`. Không đóng gói lại trong từng UMD node, không thêm runtime hoặc dịch vụ. UMD node, ứng dụng chủ và backend phải dùng các phiên bản tương thích.
- Khi thư viện bên thứ ba tham chiếu trực tiếp `@vue/runtime-core` hoặc `@vue/runtime-dom`, vẫn dùng export Vue của ứng dụng chủ. Phiên bản Vue/VueFlow của các node phải tương thích với chủ; không dùng thư viện tự nhúng Vue hoặc import trực tiếp bản build `dist` của Vue.
- Dependency khác được đóng gói riêng theo từng node; các node khác nhau có thể dùng framework UI và phiên bản thư viện bên thứ ba khác nhau, thậm chí cùng thư viện có thể lặp lại trong nhiều UMD.
- Với thư viện UI khác, ưu tiên import thành phần cục bộ và import CSS cần thiết trong mã nguồn node. Chế độ UMD của Vite kết hợp `cssCodeSplit: true` để nhúng CSS vào cùng JS. Thư viện thành phần cần provider phải được bọc trong provider của chính nó ở thành phần gốc node.
- Gói con độc lập tạo ranh giới quản lý dependency, không cung cấp cách ly style trang. CSS toàn cục, reset hoặc thư viện cần cài toàn cục qua `app.use()` phải có cách thích nghi riêng. Style của node ưu tiên dùng `<style scoped>`.
