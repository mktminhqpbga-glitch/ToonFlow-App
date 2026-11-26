<template>
  <nodeSkeleton v-bind="nodeProps" :topVisible="node.selected" :downloadUrl="previewUrl" downloadName="videoDaGhep.mp4" @fullscreen="player?.enterFullscreen()">
    <section class="mergePanel nodrag nopan nowheel" aria-label="Ghép video" :aria-busy="busy" @keydown.stop @pointerdown.stop @dblclick.stop>
      <el-tabs v-model="activeTab" class="mergeTabs">
        <el-tab-pane label="Clip" name="clips">
          <div class="clipPanel">
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
                <div v-if="clip.file" class="trimFields">
                  <label>Từ giây
                    <input type="number" min="0" step="0.01" placeholder="Đầu clip" :value="data.mergeTrims[clip.key]?.start ?? ''" :disabled="busy" :aria-label="'Bắt đầu clip ' + (index + 1)" @change="setTrim(clip.key, 'start', $event)" />
                  </label>
                  <label>Đến giây
                    <input type="number" min="0" step="0.01" placeholder="Hết clip" :value="data.mergeTrims[clip.key]?.end ?? ''" :disabled="busy" :aria-label="'Kết thúc clip ' + (index + 1)" @change="setTrim(clip.key, 'end', $event)" />
                  </label>
                </div>
              </li>
            </ol>
            <div class="trimFields" v-if="clips.length >= 2">
              <label>Chuyển cảnh
                <select v-model="data.mergeTransition.type" :disabled="busy">
                  <option value="cut">Cắt thẳng</option>
                  <option value="fade">Hòa tan</option>
                </select>
              </label>
              <label v-if="data.mergeTransition.type === 'fade'">Thời lượng (giây)
                <input v-model.number="data.mergeTransition.duration" type="number" min="0.1" max="5" step="0.1" :disabled="busy" />
              </label>
            </div>
            <input ref="filePicker" hidden type="file" accept="video/*,.mp4,.mov,.webm,.mkv,.m4v,.avi" multiple @change="addFiles" />
            <el-button :icon="IconUpload" :loading="uploading" :disabled="busy" @click="filePicker?.click()">Thêm video</el-button>
          </div>
        </el-tab-pane>
        <el-tab-pane label="Âm thanh" name="audio" lazy>
          <audioSettings v-model="data.mergeAudio" :disabled="busy" :connections="connections" @upload="addAudio" @remove="removeAudio" />
        </el-tab-pane>
        <el-tab-pane label="Phụ đề" name="subtitles" lazy>
          <subtitleSettings v-model="data.mergeSubtitles" :disabled="busy" />
        </el-tab-pane>
      </el-tabs>
      <div class="panelActions">
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
import { ElButton, ElProgress, ElTabPane, ElTabs } from "element-plus";
import { IconArrowDown, IconArrowUp, IconMovie, IconUpload, IconX } from "@tabler/icons-vue";
import { nodeSkeleton, useNode, useNodeInputs, uploadNodeFile, type NodeHandle, type NodeMediaValue, type WorkspaceFiles } from "@toonflow/nodes-scaffold/runtime";
import { getMediaMimeType } from "@toonflow/node-shared/mediaTypes";
import videoPlayer from "@toonflow/node-video/videoPlayer";
import { mergeVideo, type ClipRange, type Transition } from "./mergeVideo";
import audioSettings from "./audioSettings.vue";
import subtitleSettings from "./subtitleSettings.vue";
import type { AudioSettings, AudioTracks } from "./audioMix";
import type { SubtitleSettings } from "./subtitles";

defineOptions({
  inheritAttrs: false,
  icon: IconMovie,
  handles: [
    { id: "in", type: "target", dataType: "VIDEO", label: "Các clip đầu vào" },
    { id: "music", type: "target", dataType: "AUDIO", label: "Nhạc nền" },
    { id: "voice", type: "target", dataType: "AUDIO", label: "Lời đọc" },
    { id: "video", type: "source", dataType: "VIDEO", label: "Video đã ghép" },
  ] satisfies NodeHandle[],
});

type UploadedClip = NodeMediaValue & { name: string };
type Clip = { key: string; name: string; file?: NodeMediaValue; local?: boolean };
type TrackKind = keyof AudioTracks;

const { id, node, nodeProps, outputs, files, ffmpeg, nodeEvent } = useNode({ label: "Ghép video" });
const { getTargetSources, getTargetValues } = useNodeInputs();
const data = node.data as typeof node.data & {
  mergeUploads: UploadedClip[];
  mergeOrder: string[];
  mergeTrims: Record<string, ClipRange>;
  mergeAudio: AudioSettings;
  mergeTransition: Transition;
  mergeSubtitles: SubtitleSettings;
};
if (!Array.isArray(data.mergeUploads)) data.mergeUploads = [];
if (!Array.isArray(data.mergeOrder)) data.mergeOrder = [];
data.mergeTrims ??= {};
data.mergeAudio ??= { originalVolume: 100, musicVolume: 15, voiceVolume: 100, voiceOffset: 0, loop: true, fade: false, duck: false };
data.mergeTransition ??= { type: "cut", duration: 0.5 };
data.mergeSubtitles ??= { cues: [], burn: true, size: 4.5, position: "bottom" };
const activeTab = ref("clips");
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
  const positions = new Map(data.mergeOrder.map((key, index) => [key, index]));
  const occurrences = new Map<string, number>();
  const labels = new Map(getTargetSources(id, "in").map(({ node, handle }) => [JSON.stringify([node.id, handle.id]), node.data?.label]));
  const inputs = getTargetValues(id, "in").map((item): Clip => {
    const source = JSON.stringify([item.source, item.sourceHandle]);
    const index = occurrences.get(source) ?? 0;
    occurrences.set(source, index + 1);
    const file = item.dataType === "VIDEO" ? item.value : undefined;
    return { key: `source:${source}:${index}`, name: labels.get(source) || file?.url.split("/").at(-1) || "Video từ Canvas", file };
  });
  const uploads: Clip[] = data.mergeUploads.map(file => ({ key: `file:${file.url}`, name: file.name, file, local: true }));
  return [...inputs, ...uploads].sort((left, right) => (positions.get(left.key) ?? positions.size) - (positions.get(right.key) ?? positions.size));
});

function connection(kind: TrackKind) {
  const values = getTargetValues(id, kind);
  if (!values.length) return;
  const trackName = kind === "music" ? "nhạc nền" : "lời đọc";
  if (values.length > 1) return { label: `Chỉ nối một nguồn ${trackName}.`, error: true };
  const value = values[0];
  if (value?.dataType !== "AUDIO" || !value.value) return { label: `Đang chờ ${trackName} từ node nguồn.`, error: true };
  const label = getTargetSources(id, kind)[0]?.node.data?.label;
  return { label: label || "Âm thanh từ Canvas", file: value.value };
}

const connections = computed(() => ({ music: connection("music"), voice: connection("voice") }));
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
  if (busy.value) return;
  const key = `file:${path}`;
  data.mergeUploads = data.mergeUploads.filter(file => file.url !== path);
  data.mergeOrder = data.mergeOrder.filter(item => item !== key);
  delete data.mergeTrims[key];
}

function setTrim(key: string, field: keyof ClipRange, event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const range = data.mergeTrims[key] ?? { start: null, end: null };
  data.mergeTrims[key] = { ...range, [field]: input.value === "" ? null : input.valueAsNumber };
}

function removeAudio(kind: TrackKind) {
  if (busy.value) return;
  delete data.mergeAudio[kind === "music" ? "musicFile" : "voiceFile"];
}

async function addAudio(kind: TrackKind, event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || busy.value) return;
  const mimeType = getMediaMimeType(file);
  if (!mimeType.startsWith("audio/") || !file.size || file.size > 100 * 1024 * 1024) {
    errorMessage.value = "Hãy chọn tệp âm thanh có dung lượng tối đa 100 MiB.";
    return;
  }
  uploading.value = true;
  errorMessage.value = "";
  try {
    const url = await uploadNodeFile(files.getWorkspaceFiles(), id, file);
    if (!lifetime.signal.aborted) data.mergeAudio[kind === "music" ? "musicFile" : "voiceFile"] = { url, mimeType, name: file.name };
  } catch (error) {
    if (!lifetime.signal.aborted) errorMessage.value = readError(error, "Không tải được tệp âm thanh.");
  } finally { uploading.value = false; }
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
      data.mergeUploads.push({ url, mimeType, name: file.name });
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
  const { music, voice } = connections.value;
  const trackError = [music, voice].find(track => track?.error);
  if (trackError) {
    activeTab.value = "audio";
    errorMessage.value = trackError.label;
    return;
  }
  const sources = clips.value.map(clip => ({
    path: clip.file!.url, start: data.mergeTrims[clip.key]?.start ?? null, end: data.mergeTrims[clip.key]?.end ?? null,
  }));
  const audio = { ...data.mergeAudio, voiceOffset: data.mergeAudio.voiceOffset || 0 };
  const tracks = { music: music?.file ?? audio.musicFile, voice: voice?.file ?? audio.voiceFile };
  const transition = { ...data.mergeTransition };
  const subtitles = { ...data.mergeSubtitles, cues: data.mergeSubtitles.cues.map(cue => ({ ...cue })) };
  const current = controller = new AbortController();
  merging.value = true;
  errorMessage.value = "";
  job = (async () => {
    let workspace: WorkspaceFiles | undefined;
    let outputPath: string | undefined;
    let captionPath: string | undefined;
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
      await mergeVideo(processor, sources, outputPath, {
        audio, tracks, transition, subtitles, signal: current.signal,
        async writeCaptions(content) {
          const path = `assets/mergeCaptions${crypto.randomUUID()}.ass`;
          await workspace!.write(path, content, true);
          captionPath = path;
          return path;
        },
      });
      current.signal.throwIfAborted();
      outputs.value.video = { dataType: "VIDEO", value: { url: outputPath, mimeType: "video/mp4" } };
      outputPath = undefined;
    } catch (error) {
      if (!current.signal.aborted) errorMessage.value = readError(error, "Không ghép được video.");
    } finally {
      for (const path of [outputPath, captionPath]) {
        if (path && workspace) await workspace.remove(path).catch(error => {
          if (!lifetime.signal.aborted && error?.response?.data?.data?.code !== "ENOENT") {
            errorMessage.value = [errorMessage.value, "Không dọn được tệp tạm trong dự án."].filter(Boolean).join(" ");
          }
        });
      }
      controller = undefined;
      merging.value = cancelling.value = false;
    }
  })();
}

nodeEvent.on("save", reason => {
  if (reason === "reload" && busy.value) throw new Error("Hãy chờ thao tác ghép hoặc tải tệp hoàn tất trước khi tải lại node.");
});
nodeEvent.on("delete", async () => {
  if (uploading.value) throw new Error("Đang tải tệp lên dự án.");
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
.mergeTabs { min-width: 0; }
.mergeTabs :deep(.el-tabs__header) { margin: 0 0 9px; }
.mergeTabs :deep(.el-tabs__item) { height: 32px; padding: 0 12px; }
.clipPanel { display: grid; justify-items: start; gap: 8px; }
.clipList { padding: 0; margin: 0; list-style: none; display: grid; gap: 5px; max-height: 250px; overflow: auto; }
.clipRow {
  display: flex;
  flex-wrap: wrap;
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
.clipList, .trimFields { width: 100%; }
.trimFields { display: flex; align-items: center; gap: 6px; }
.trimFields label { flex: 1; min-width: 0; display: grid; gap: 3px; font-size: 12px; }
.trimFields input, .trimFields select { width: 100%; box-sizing: border-box; padding: 4px 6px; border-radius: 4px; border: 1px solid var(--el-border-color); color: var(--el-text-color-primary); background: var(--el-bg-color); font: inherit; }
.clipActions :deep(.el-button) { margin: 0; padding: 5px; min-height: 27px; height: auto; }
.panelActions { justify-content: flex-end; flex-wrap: wrap; }
.panelActions :deep(.el-button) { margin: 0; }
.result { min-width: 0; display: grid; gap: 7px; font-size: 12px; }
</style>
