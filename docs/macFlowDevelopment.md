# Phát triển MacFlow với Codex

Tài liệu này áp dụng cho nhánh `feat/macflow-media-studios` của `mktminhqpbga-glitch/ToonFlow-App`. Đọc [`AGENTS.md`](../AGENTS.md) trước khi sửa. Dùng hợp đồng SDK và mã nguồn trên chính nhánh đang chạy để quyết định tên trường, khả năng mô hình, đường dẫn và lệnh build.

## 1. Chọn đúng chỗ để sửa

| Nhu cầu | Điểm vào | Mẫu để đọc |
| --- | --- | --- |
| Thêm màn hình, nút, hộp thoại hoặc mục cài đặt | `apps/web/src/pages`, `apps/web/src/components/settings`, `apps/web/src/router/index.ts` | Hai xưởng dùng chung [`mediaStudio/index.vue`](../apps/web/src/pages/mediaStudio/index.vue) với `kind` từ router. |
| Chạy Huobao Drama tách biệt, nối mô hình và Kho MacFlow | `services/huobaoDrama`, `apps/server/src/utils/huobao` | [Chạy Huobao Drama với MacFlow](huobaoDrama.md). |
| Phân cảnh phim ngắn và chuyển prompt sang xưởng | `apps/web/src/pages/shortDrama` và `apps/web/src/lib/studioPromptTransfer.ts` | [Phim ngắn và nhập dữ liệu Huobao](shortDrama.md). |
| Dựng video sản phẩm từ ảnh và lời thoại | `apps/web/src/pages/mediaStudio/clipForgeStudio.vue` và `clipForgeApi.ts` | [Xưởng video sản phẩm với ClipForge](clipForge.md). |
| Ghép ảnh, clip, lời đọc và phụ đề từ tư liệu trong dự án | `apps/web/src/pages/mediaStudio/moneyPrinterStudio.vue`, `apps/server/src/utils/mediaStudio/moneyPrinterTurbo.ts` | [Dựng video từ tư liệu với MoneyPrinterTurbo](moneyPrinterTurbo.md). |
| Mở xưởng video bán hàng VideoAFF và kết nối mô hình, tư liệu | `services/videoAff`, `apps/server/src/utils/videoAff` và `apps/web/src/pages/videoAff` | [Chạy VideoAFF với MacFlow](videoAff.md). |
| Chạy nhiều cảnh, giữ phiên bản và chọn clip ghép | `apps/web/src/pages/mediaStudio/videoFlowRun.vue` và `useVideoFlowRun.ts` | Thao tác theo từng cảnh. Dùng cùng ảnh và kịch bản, chọn rõ bản video sẽ đưa sang node Ghép video. |
| Thêm node có giao diện trên Canvas | `packages/nodes/<tênNode>` cho node tích hợp, hoặc dự án plugin trong workspace cho tệp cài riêng | [`textNode`](../packages/nodes/textNode), [`videoScriptNote`](../plugins/videoScriptNote), [`nodeScaffold`](../packages/nodeScaffold/readme.md). |
| Thêm thao tác Agent có thể gọi | `packages/tools/<tênCôngCụ>` hoặc plugin công cụ trong workspace | [`askUser`](../packages/tools/askUser/src/index.ts), [`toolScaffold`](../packages/toolScaffold/readme.md). |
| Dạy Agent một quy trình hoặc mẫu đầu ra | Một kỹ năng có `SKILL.md` | [`workflow`](../packages/skills/workflow/SKILL.md). |
| Thêm trình mở, xem hoặc sửa tài liệu | `packages/ext/<tênTiệnÍch>` | [`extScaffold`](../packages/extScaffold/readme.md). |
| Thêm mô hình hoặc tích hợp nhà cung cấp | Cài đặt mô hình, catalog, `packages/providers` và adapter tương ứng | [`muse2Api.md`](muse2Api.md), [`hợp đồng mac2API`](../MACFLOW_API_CONTRACT_TESTS.md). |
| Sửa luồng tác vụ phía máy chủ | `apps/server/src/routes`, `apps/server/src/utils`, `apps/server/src/lib` | [`mediaStudio/list.ts`](../apps/server/src/routes/mediaStudio/list.ts), [`ai/media/generate.ts`](../apps/server/src/routes/ai/media/generate.ts). |

`research/` chứa mã tham khảo. `services/` chứa dịch vụ tích hợp riêng. Khi lỗi xuất hiện ở MacFlow, bắt đầu bằng luồng từ thao tác người dùng đến backend MacFlow rồi đối chiếu phản hồi upstream. Xác nhận chính xác ranh giới xảy ra lỗi trước khi thay đổi một dịch vụ tích hợp.

Trong **Xưởng tạo video → Tự động theo luồng**, mở **Hồ sơ sản phẩm** để lưu hoặc lấy lại ảnh và mô tả cho dự án. Có thể mở cùng hồ sơ trong **Kho tài nguyên**. Khi một cảnh đã có video, mở **Làm lại cảnh**, nhập điều chỉnh, rồi tạo lại khung hình hoặc video. Chọn phiên bản muốn dùng ngay ở bước Khung hình hoặc Video. Tích ít nhất hai cảnh rồi bấm **Đưa clip vào Ghép video** để chỉnh thứ tự, âm thanh và phụ đề trên Canvas. **Tổng quan** hiển thị đợt gần nhất của dự án đang mở.

## 2. Tạo node cài riêng ngay trong MacFlow

1. **Chọn hợp đồng đầu vào và đầu ra.** Ví dụ node “Ghi chú kịch bản” nhận `STRING`, cho sửa văn bản, rồi xuất `STRING`. Nếu mục tiêu là nhận video và trả kịch bản, xem [`Video → Kịch bản`](../plugins/videoScriptNote/src/index.vue) để dùng `VIDEO`, workspace và `ai.generate` đúng cách.
2. **Mở Canvas trong một workspace thử.** Bật công cụ **Phát triển plugin** khi có sẵn. Trong cuộc trò chuyện, yêu cầu Agent gọi `developPlugin` với `{"action":"guide","type":"node"}` để đọc SDK của bản đang chạy. Công cụ này cần khả năng phát triển plugin của ứng dụng cục bộ. Khi dùng repo, có thể build bằng quy trình ở mục 3.
3. **Viết mã nguồn trong một thư mục riêng.** Ví dụ `plugins/scriptMemoNode` tương đối với workspace. Dự án tối thiểu dùng `plugin.json`, `package.json`, `src/index.vue` và có thể kèm `readme.md`.
4. **Build rồi cài.** Gọi `developPlugin` với `{"action":"build","path":"plugins/scriptMemoNode"}`. Đọc phản hồi build và đường dẫn sản phẩm. Gọi tiếp `{"action":"install","path":"plugins/scriptMemoNode"}` và xác nhận trong hộp thoại MacFlow. Khi công cụ báo `refreshed: true`, mở menu thêm node trong Canvas. Hoặc cài tệp `scriptMemoNode.umd.js` qua **Chợ plugin → Đã cài → Cài plugin từ máy**.
5. **Thử thêm và nối node.** Kiểm tra đầu vào rỗng, nối đúng loại, sửa nội dung, nối sang node khác, lưu, tải lại Canvas và mở node đã tạo từ bản trước. Mỗi lần phát hành cập nhật, tăng `package.json.version`, giữ `name` và ID các cổng đang dùng.

### Mẫu dự án node

`plugin.json`

```json
{
  "type": "node",
  "name": "scriptMemoNode",
  "displayName": "Ghi chú kịch bản",
  "description": "Chỉnh và chuyển tiếp văn bản trên Canvas"
}
```

`package.json`

```json
{
  "name": "scriptMemoNode",
  "version": "1.0.0",
  "type": "module"
}
```

`src/index.vue`

```vue
<template>
  <nodeSkeleton v-bind="nodeProps">
    <div class="memoBody nodrag nopan">
      <label>
        Kịch bản
        <textarea v-model="outputs.text.value" rows="5" />
      </label>
      <button type="button" :disabled="!incoming?.trim()" @click="takeInput">Lấy văn bản đầu vào</button>
    </div>
  </nodeSkeleton>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { nodeSkeleton, useNode, useNodeInputs, type NodeHandle } from "@toonflow/nodes-scaffold/runtime";

defineOptions({
  inheritAttrs: false,
  handles: [
    { id: "in", type: "target", dataType: "STRING", label: "Văn bản đầu vào" },
    { id: "text", type: "source", dataType: "STRING", label: "Kịch bản" },
  ] satisfies NodeHandle[],
});

const { id, nodeProps, outputs } = useNode({
  label: "Ghi chú kịch bản",
  outputs: { text: { dataType: "STRING" as const, value: "" } },
});
const { getTargetValues } = useNodeInputs();
const incoming = computed(() => {
  const value = getTargetValues(id, "in").find(item => item.dataType === "STRING")?.value;
  return typeof value === "string" ? value : "";
});

function takeInput() {
  if (typeof incoming.value === "string" && incoming.value.trim()) outputs.value.text.value = incoming.value;
}
</script>

<style scoped>
.memoBody { display: grid; gap: 8px; color: var(--el-text-color-primary); }
.memoBody label { display: grid; gap: 5px; }
.memoBody textarea { font: inherit; color: inherit; background: var(--el-bg-color); resize: vertical; }
.memoBody :is(textarea, button):focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 2px; }
</style>
```

Nút lấy đầu vào là một thao tác rõ ràng để người dùng chủ động thay văn bản. Với node chuyên dùng để **hiển thị và chỉnh kịch bản dài**, hãy cân nhắc dùng lại node **Văn bản** và lệnh `node:setText` để lưu Markdown đúng cơ chế của Canvas. [`scriptTextNote.ts`](../plugins/videoScriptNote/src/scriptTextNote.ts) có ví dụ tạo node mặc định khi thiếu và bảo toàn nội dung đang sửa.

## 3. Build node tích hợp, công cụ và tiện ích

### Chạy MacFlow từ repo

Git, Bun theo `packageManager` và các dependency trong lockfile là nền tảng. Chạy từ gốc `ToonFlow-App` bằng shell trên macOS/Linux.

```sh
bun install --frozen-lockfile
bun run build:server
bun run start:server
```

Khi cập nhật bản web đã cài từ repo, mở thư mục MacFlow trên máy đang chạy ứng dụng và lấy mã mới bằng `git pull --ff-only origin feat/macflow-media-studios`. Chạy lại các lệnh trên để dựng và khởi động bản mới. Trong **Cài đặt → Giới thiệu**, đối chiếu **Mã bản dựng** với commit GitHub để biết trình duyệt đang mở bản nào.

Bản standalone phục vụ Web và API tại `http://127.0.0.1:3000` theo cấu hình mặc định. Khi phát triển giao diện, dùng `bun run dev:plugins` để đồng bộ plugin phát triển, rồi `bun run dev`. Vite mặc định mở tại `http://localhost:5173` và proxy API tới Server. `TOONFLOW_SERVER_PORT` đổi cổng Server và đích proxy. Khi cần thử bằng dữ liệu riêng, dùng `TOONFLOW_DATA_DIR` trỏ tới thư mục tạm. Lệnh `dev:plugins` đồng bộ plugin vào thư mục `data/` của repo, vì vậy với Server thử trỏ dữ liệu tạm, hãy cài plugin thử bằng tệp build trong chính instance đó. Khi chỉ chạy một gói, dùng `bun run --cwd <đường-dẫn> <lệnh>` để dùng đúng tên thư mục trên Linux.

### Node tích hợp

Tạo `packages/nodes/<tênNode>` theo cấu trúc của [`imageNode`](../packages/nodes/imageNode/package.json). `package.json` khai báo dependency ngay trong gói con. `vite.config.ts` gọi `createNodeConfig` từ `@toonflow/nodes-scaffold`, giữ `name` camelCase duy nhất. `src/index.vue` là điểm vào. Thêm workspace mới thì chạy `bun install` để cập nhật lockfile tương ứng.

```sh
bun run --cwd packages/nodes/textNode typecheck
bun run --cwd packages/nodes/textNode build
```

Đổi `textNode` thành thư mục node cần build. Build mặc định ghi một tệp `.umd.js` trong `build/nodes`. Tệp cài có metadata `toonflowNode` chứa phiên bản do scaffold nhúng. `NODE_ENV=dev` khi build sẽ đồng bộ node đã chỉ định vào `data/nodes`. Node phân phối riêng có thể dùng `createNodeConfig(..., { outDir, syncToData: false })` và cài từ tệp tạo ra. Dùng **tệp JS** trong bộ chọn cài cục bộ. Nếu phân phối ZIP cho dễ tải, đặt JS ở gốc ZIP và hướng dẫn giải nén trước.

### Tool plugin

Đọc [`toolScaffold`](../packages/toolScaffold/readme.md) và một tool đang chạy. Trong repo dùng `packages/tools/<tênTool>/src/index.ts` với `ToolPlugin`, `validateConfig`, `createTools(context)` và `build.ts` dùng `createToolConfig`. Dự án cài qua Agent dùng `plugin.json` với `type: "tool"`, `package.json.version`, `src/index.ts`, luồng `guide` → `build` → `install` và tệp `.tool.js`. Sau khi bật tool, mở lượt trò chuyện mới để kiểm tra danh sách công cụ. Cho Agent tham số Zod rõ nghĩa, kiểm tra dữ liệu khi thực thi, hỗ trợ hủy qua `signal` và trả kết quả có cấu trúc để bước sau sử dụng. Khi cần đọc hoặc ghi dự án, ưu tiên `context.files`; khi thao tác Canvas, dùng `context.canvas`. Tool chạy với quyền của tiến trình server, nên nguồn tệp cài phải đáng tin cậy.

### Tiện ích tài liệu và kỹ năng

```sh
bun run create:ext myEditor
bun install
bun run --cwd packages/ext/myEditor typecheck
bun run --cwd packages/ext/myEditor build
```

Sửa `src/metadata.ts` cho loại tệp và cấu hình, `src/index.vue` cho giao diện. Thao tác tài liệu đi qua `context.updateText`, `context.flushSave` và `context.files`. Với kỹ năng, giữ mô tả, phạm vi, đầu vào, các bước, đầu ra và tiêu chí dừng ngay trong `SKILL.md`. Ví dụ và quy tắc phải bám tính năng thực sự có trên bản chạy.

## 4. Giao diện và dữ liệu khi thêm tính năng

- **Chọn màn tham chiếu cụ thể.** Dùng [`Xưởng media`](../apps/web/src/pages/mediaStudio/index.vue) cho trang tạo nội dung, [`Thiết lập luồng`](../apps/web/src/pages/mediaStudio/studioFlowSetup.vue) cho biểu mẫu nhiều bước, `nodeSkeleton` cho node Canvas và màn Cài đặt hiện có cho cấu hình. Giữ nhãn điều hướng, font, khoảng cách, hệ biểu tượng Tabler và các thành phần Element Plus đã dùng trong màn đó.
- **Thừa hưởng giao diện đang chọn.** Ưu tiên `--el-bg-color`, `--el-bg-color-page`, `--el-text-color-primary`, `--el-text-color-secondary`, `--el-border-color-light`, `--el-color-primary` và token trạng thái. Xem [`appearance.ts`](../apps/web/src/lib/appearance.ts) và [`settings.ts`](../apps/web/src/stores/settings.ts) để theo đúng màu chủ đạo và ngôn ngữ hỗ trợ. UI ứng dụng chủ theo luồng dịch hiện có. Plugin giữ nội dung riêng theo quy tắc trong `AGENTS.md`.
- **Mô tả đủ trạng thái.** Vẽ rõ màn trống, đang nạp, đang chạy, thành công, lỗi, hủy và kết quả cũ. Tắt nút khi thiếu dữ liệu bắt buộc hoặc đang gửi. Khi tải tệp lỗi, cho người dùng xem lý do và làm lại đúng thao tác. Nút biểu tượng có tên truy cập. Trường nhập có nhãn. Kéo thả cần thao tác thay thế qua nút hoặc bàn phím.
- **Giữ tính tương thích.** Tên plugin, ID cổng, kiểu đầu ra, định danh mô hình và định dạng JSON là hợp đồng. Thêm trường mới với mặc định phù hợp cho dữ liệu cũ. Với Node, giữ dữ liệu Canvas tuần tự hóa được và dùng tương thích cổng của SDK. Với Web, chốt workspace trước thao tác nhiều bước, dùng `useWorkspaceFiles` và kiểm tra phiên bản khi ghi đè.
- **Gọi AI qua điểm vào có sẵn.** Với node dùng `ai.getModels`, `getNodeModelIdentity` và `ai.generate` hoặc API media theo SDK. Tôn trọng catalog về loại đầu ra, tỷ lệ, thời lượng, độ phân giải, ảnh tham chiếu. Cấu hình khóa ở backend; Canvas, mẫu luồng, nhật ký và metadata chỉ lưu định danh cần dùng. Kết quả kiểu media giữ `url` tương đối trong workspace cùng `mimeType` theo hợp đồng SDK.
- **Tác vụ dài cần danh tính.** Giữ ID để kiểm tra tải lại hoặc mất mạng. Phân biệt lỗi bị từ chối với trạng thái máy chủ chưa rõ. Khi cần theo dõi lại, kiểm tra theo ID cũ trước khi tạo yêu cầu mới. Chỉ tải preview người dùng đang xem, giải phóng blob URL và tài nguyên khi đổi mục hoặc rời trang.
- **Luồng xưởng có thứ tự và tham chiếu riêng.** Giữ A và Z cố định, ID bước ổn định khi kéo, và kiểm tra một bước chỉ đọc đầu vào hoặc kết quả từ bước trước. [Thiết lập luồng](../apps/web/src/pages/mediaStudio/studioFlows.ts) lưu mẫu theo dự án. Xưởng tạo video có chế độ **Tự động theo luồng**. Chế độ này dùng mẫu mặc định hoặc mẫu đã lưu gồm Văn bản → Ảnh → Video. Sau khi tách các cặp ngoặc vuông, mỗi mục chạy theo thứ tự ba bước trong mẫu. Trạng thái và đầu ra lưu trong dự án. Khi tiếp tục, luồng dùng mã tác vụ cũ để kiểm tra ảnh/video và vẫn tuân theo hàng chờ riêng của hai xưởng.

Ví dụ khi thêm **Dùng làm ảnh tham chiếu** ở Xưởng ảnh, đặt nút cạnh các thao tác kết quả đang có. Dùng lại hàm kiểm tra MIME, dung lượng và số ảnh của xưởng. Giữ đường dẫn workspace của kết quả đang chọn. Kiểm tra lần đầu dùng ảnh, dùng lại cùng ảnh, mô hình đã đầy giới hạn và đổi dự án trong lúc đọc tệp. Khi bàn giao, mô tả chính xác thao tác bấm nút và ảnh xuất hiện ở đâu.

## 5. Checklist bàn giao và mẫu nhắn cho Codex

1. Ghi rõ đường dẫn màn hình, phiên bản/commit, cách tái hiện, kết quả thực tế và kết quả mong đợi. Khi cần, thêm trình duyệt, mô hình, `taskId` và mã HTTP đã lọc thông tin riêng tư.
2. Xác định file nào sở hữu UI, logic và lưu dữ liệu. Chọn thay đổi nhỏ nhất xử lý nguyên nhân. Giữ phạm vi cùng nhánh. Đối chiếu hành vi đang dùng với dữ liệu cũ và lỗi gián đoạn.
3. Chạy `bun run typecheck` hoặc `bun run --cwd <workspace> typecheck`. Nếu đổi file route Server, chạy `bun run --cwd apps/server routes` trước khi build. Chạy `bun run build:server` khi cần kiểm bản standalone. Thử đường sử dụng chính trên dữ liệu cô lập, thêm kiểm tra màn nhỏ, sáng/tối, bàn phím và tải lại theo phạm vi thay đổi. Tuân thủ giới hạn kiểm thử trong `AGENTS.md`.
4. Báo phần đã xác minh, phần cần máy hoặc provider thật, phiên bản artefact nếu có và mã commit đầy đủ. Với file cài, thử tải đúng bản và đối chiếu version trong metadata. Chỉ đẩy nhánh đã được người dùng chọn bằng cập nhật fast-forward.

> Làm trong `mktminhqpbga-glitch/ToonFlow-App`, nhánh `feat/macflow-media-studios`. Đọc `AGENTS.md` và `docs/macFlowDevelopment.md`. Mục tiêu của tôi là **[viết điều tôi muốn làm và nơi bấm]**. Dùng **[màn hoặc node hiện có]** làm chuẩn giao diện. Dữ liệu đầu vào gồm **[liệt kê]**; kết quả cần ở **[màn, node, file hoặc cổng]**. Nếu sửa lỗi, tái hiện bằng **[các bước]** và giữ hành vi cũ cho **[trường hợp liên quan]**. Ưu tiên SDK và component sẵn có. Kiểm tra bằng **[luồng nghiệm thu]** trên workspace thử, báo kiểm tra đã chạy, các lỗi xác minh được, mã commit và cách cập nhật. Nếu là plugin cài riêng, giao tệp JS cùng tên và phiên bản để tôi chọn trong Chợ plugin.

## Kho video và nhân vật dùng chung

Trong **Xưởng tạo video**, mở **Viết prompt** ngay cạnh **Mô tả ý tưởng**. Chọn mô hình văn bản đã cài, mở **Mẫu yêu cầu** để chỉnh mẫu mặc định, rồi bấm **Viết bằng AI**. Bạn có thể sửa bản nháp và bấm **Dùng prompt này** để đưa nội dung vào ô tạo video. Mẫu và mô hình được lưu theo trình duyệt.

Thanh bên của **Xưởng tạo video** và **VideoAFF** có **Kho tài nguyên** và **Kho nhân vật**. Kho video có thư mục `XuongVideo` và `VideoAFF`. Kết quả Xưởng video đi qua hàng chờ được lưu khi hoàn thành. VideoAFF đồng bộ video đã ghép khi xưởng đang chạy. ClipForge chuyển video khi Xưởng đọc được kết quả từ dịch vụ ClipForge.

Trong **Kho nhân vật**, thêm tên nhân vật rồi tải các ảnh PNG, JPG hoặc WebP có dung lượng tối đa 20 MiB mỗi ảnh. Ảnh được lưu trong `NhanVatThamChieu` ở Kho MacFlow. Khi mô hình tạo video nhận ảnh đầu vào, **Dùng ảnh này** thêm ảnh vào ô tham chiếu. Trong VideoAFF, nút đó mở bảng chọn người mẫu với ảnh đã chọn sẵn để bạn xác nhận quyền sử dụng trước khi thêm.
