<template>
  <nodeSkeleton v-bind="nodeProps" :topVisible="node.selected" :downloadUrl="previewUrl" downloadName="videoDaGhep.mp4" @fullscreen="player?.enterFullscreen()">
    <section class="mergePanel nodrag nopan nowheel" aria-label="Ghép video" :aria-busy="busy" @keydown.stop @pointerdown.stop @dblclick.stop>
      <p v-if="!clips.length" class="hint">Nối các node video vào cổng bên trái hoặc tải clip từ máy.</p>
      <ol v-else class="clipList" aria-label="Thứ tự ghép video">
        <li v-for="(clip, index) in clips" :key="clip.key" class="clipRow">
          <span class="clipOrder" aria-hidden="true">{{ index + 1 }}</span>
          <div class="clipName" :title="clip.name">
            <strong>{{ clip.name }}</strong>
            <small v-if="!clip.file">Đang chờ video từ node nguồn</small>
          </div>
          <div class="clipActions">
            <el-button text :icon="IconArrowUp" :disabled="busy || index === 0" :aria-label="`Đưa clip ${index + 1} lên`" @click="move(index, -1)" />
            <el-button text :icon="IconArrowDown" :disabled="busy || index === clips.length - 1" :aria-label="`Đưa clip ${index + 1} xuống`" @click="move(index, 1)" />
            <el-button v-if="clip.local" text :icon="IconX" :disabled="busy" :aria-label="`Bỏ clip ${index + 1}`" @click="removeClip(clip.file!.url)" />
          </div>
        </li>
      </ol>
      <input ref="filePicker" hidden type="file" accept="video/*,.mp4,.mov,.webm,.mkv,.m4v,.avi" multiple @change="addFiles" />
      <div class="panelActions">
        <el-button :icon="IconUpload" :loading="uploading" :disabled="busy" @click="filePicker?.click()">Thêm video</el-button>
        <el-button v-if="merging" :disabled="cancelling" @click="cancel">{{ cancelling ? "Đang dừng…" : "Dừng ghép" }}</el-button>
        <el-button v-else type="primary" :icon="IconMovie" :disabled="busy || clips.length < 2 || clips.some(clip => !clip.file)" @click="start">Ghép video</el-button>
      </div>
      <el-progress v-if="merging" :percentage="100" :indeterminate="true" :showText="false" aria-label="Đang ghép video" />
      <p v-if="errorMessage" class="errorText" role="alert">{{ errorMessage }}</p>
      <div v-if="previewUrl" class="result">
        <span>Kết quả đã ghép</span>
        <videoPlayer :key="previewUrl" ref="player" :src="previewUrl" label="Video đã ghép" readOnly />
      </div>
    </section>
  </nodeSkeleton>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref } from "vue";
import { ElButton, ElProgress } from "element-plus";
import { IconArrowDown, IconArrowUp, IconMovie, IconUpload, IconX } from "@tabler/icons-vue";
import { nodeSkeleton, useNode, useNodeInputs, uploadNodeFile, type NodeHandle, type NodeMediaValue, type WorkspaceFiles } from "@toonflow/nodes-scaffold/runtime";
import { getMediaMimeType } from "@toonflow/node-shared/mediaTypes";
import videoPlayer from "@toonflow/node-video/videoPlayer";
import { mergeVideo } from "./mergeVideo";

defineOptions({
  inheritAttrs: false,
  icon: IconMovie,
  handles: [
    { id: "in", type: "target", dataType: "VIDEO", label: "Các clip đầu vào" },
    { id: "video", type: "source", dataType: "VIDEO", label: "Video đã ghép" },
  ] satisfies NodeHandle[],
});

type UploadedClip = NodeMediaValue & { name: string };
type Clip = { key: string; name: string; file?: NodeMediaValue; local?: boolean };

const { id, node, nodeProps, outputs, files, ffmpeg, nodeEvent } = useNode({ label: "Ghép video" });
const { getTargetSources, getTargetValues } = useNodeInputs();
const data = node.data as typeof node.data & { mergeUploads?: UploadedClip[]; mergeOrder?: string[] };
if (!Array.isArray(data.mergeUploads)) data.mergeUploads = [];
if (!Array.isArray(data.mergeOrder)) data.mergeOrder = [];
const filePicker = ref<HTMLInputElement>();
const player = ref<InstanceType<typeof videoPlayer>>();
const uploading = ref(false);
const merging = ref(false);
const cancelling = ref(false);
const busy = computed(() => uploading.value || merging.value);
const errorMessage = ref("");
const lifetime = new AbortController();
let controller: AbortController | undefined;
let job: Promise<void> | undefined;

const clips = computed(() => {
  const positions = new Map(data.mergeOrder!.map((key, index) => [key, index]));
  const occurrences = new Map<string, number>();
  const labels = new Map(getTargetSources(id, "in").map(({ node, handle }) => [JSON.stringify([node.id, handle.id]), node.data?.label]));
  const inputs = getTargetValues(id, "in").map((item): Clip => {
    const source = JSON.stringify([item.source, item.sourceHandle]);
    const index = occurrences.get(source) ?? 0;
    occurrences.set(source, index + 1);
    const file = item.dataType === "VIDEO" ? item.value : undefined;
    return { key: `source:${source}:${index}`, name: labels.get(source) || file?.url.split("/").at(-1) || "Video từ Canvas", file };
  });
  const uploads: Clip[] = data.mergeUploads!.map(file => ({ key: `file:${file.url}`, name: file.name, file, local: true }));
  return [...inputs, ...uploads].sort((left, right) => (positions.get(left.key) ?? positions.size) - (positions.get(right.key) ?? positions.size));
});

const output = computed(() => outputs.value.video?.dataType === "VIDEO" ? outputs.value.video.value : undefined);
const previewUrl = files.useFileUrl(output, error => { errorMessage.value = readError(error, "Không mở được video đã ghép."); });

function readError(error: unknown, fallback: string) {
  const response = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return response || (error instanceof Error ? error.message : fallback);
}

function move(index: number, offset: number) {
  if (busy.value) return;
  const order = clips.value.map(clip => clip.key);
  const next = index + offset;
  if (next < 0 || next >= order.length) return;
  [order[index], order[next]] = [order[next]!, order[index]!];
  data.mergeOrder = order;
}

function removeClip(path: string) {
  if (!busy.value) data.mergeUploads = data.mergeUploads!.filter(file => file.url !== path);
}

async function addFiles(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const selected = [...(input.files ?? [])];
  input.value = "";
  if (busy.value || !selected.length) return;
  uploading.value = true;
  errorMessage.value = "";
  const rejected: string[] = [];
  try {
    const workspace = files.getWorkspaceFiles();
    for (const file of selected) {
      if (lifetime.signal.aborted) return;
      const mimeType = getMediaMimeType(file);
      if (!mimeType.startsWith("video/") || !file.size || file.size > 100 * 1024 * 1024) {
        rejected.push(file.name);
        continue;
      }
      const url = await uploadNodeFile(workspace, id, file);
      if (lifetime.signal.aborted) return;
      data.mergeUploads!.push({ url, mimeType, name: file.name });
    }
    if (rejected.length) errorMessage.value = `Hãy chọn tệp video có dung lượng từ 1 byte đến 100 MiB. Tệp bị bỏ qua: ${rejected.join(", ")}.`;
  } catch (error) {
    if (!lifetime.signal.aborted) errorMessage.value = readError(error, "Không tải được clip lên dự án.");
  } finally { uploading.value = false; }
}

function cancel() {
  if (!controller) return;
  cancelling.value = true;
  controller.abort();
}

function start() {
  if (busy.value || clips.value.length < 2 || clips.value.some(clip => !clip.file)) return;
  const paths = clips.value.map(clip => clip.file!.url);
  const current = controller = new AbortController();
  merging.value = true;
  errorMessage.value = "";
  job = (async () => {
    let workspace: WorkspaceFiles | undefined;
    let outputPath: string | undefined;
    try {
      workspace = files.getWorkspaceFiles();
      const processor = await ffmpeg(current.signal);
      const directory = `assets/${id}`;
      for (const path of ["assets", directory]) {
        current.signal.throwIfAborted();
        await workspace.mkdir(path).catch(error => {
          if (error?.response?.data?.data?.code !== "EEXIST") throw error;
        });
      }
      outputPath = `${directory}/videoGhep${crypto.randomUUID()}.mp4`;
      await mergeVideo(processor, paths, outputPath, current.signal);
      current.signal.throwIfAborted();
      outputs.value.video = { dataType: "VIDEO", value: { url: outputPath, mimeType: "video/mp4" } };
      outputPath = undefined;
    } catch (error) {
      if (!current.signal.aborted) errorMessage.value = readError(error, "Không ghép được video.");
    } finally {
      if (outputPath && workspace) await workspace.remove(outputPath).catch(error => {
        if (!lifetime.signal.aborted && error?.response?.data?.data?.code !== "ENOENT") {
          errorMessage.value = [errorMessage.value, "Không dọn được tệp ghép dở trong dự án."].filter(Boolean).join(" ");
        }
      });
      controller = undefined;
      merging.value = cancelling.value = false;
    }
  })();
}

nodeEvent.on("save", reason => {
  if (reason === "reload" && busy.value) throw new Error("Hãy chờ thao tác ghép hoặc tải clip hoàn tất trước khi tải lại node.");
});
nodeEvent.on("delete", async () => {
  if (uploading.value) throw new Error("Đang tải clip lên dự án.");
  cancel();
  await job;
  await files.removeNodeFiles();
});
onScopeDispose(() => { lifetime.abort(); controller?.abort(); });
</script>

<style scoped>
.mergePanel {
  width: 340px;
  max-width: 100%;
  display: grid;
  gap: 12px;
  padding: 12px;
  box-sizing: border-box;
}
.hint, .errorText { margin: 0; font-size: 13px; line-height: 1.45; overflow-wrap: anywhere; }
.hint { color: var(--el-text-color-secondary); }
.errorText { color: var(--el-color-danger); }
.clipList { padding: 0; margin: 0; list-style: none; display: grid; gap: 5px; max-height: 250px; overflow: auto; }
.clipRow {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 6px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color-lighter);
}
.clipOrder { color: var(--el-text-color-secondary); font-size: 12px; min-width: 12px; text-align: center; }
.clipName { flex: 1; min-width: 0; display: grid; gap: 2px; font-size: 12px; }
.clipName strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.clipName small { color: var(--el-text-color-secondary); }
.clipActions, .panelActions { display: flex; align-items: center; gap: 4px; }
.clipActions :deep(.el-button) { margin: 0; padding: 5px; min-height: 27px; height: auto; }
.panelActions { justify-content: space-between; flex-wrap: wrap; }
.panelActions :deep(.el-button) { margin: 0; }
.result { min-width: 0; display: grid; gap: 7px; font-size: 12px; }
</style>
