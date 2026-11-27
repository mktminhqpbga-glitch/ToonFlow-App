<template>
  <div class="renderStudio">
    <section class="setup" aria-label="Chuẩn bị video">
      <el-card shadow="never">
        <template #header><h2>1. Chuẩn bị tư liệu chung</h2></template>
        <div class="actions">
          <el-button :loading="importing" @click="chooseDevice('footage')">Tải ảnh / clip lên</el-button>
          <el-button :disabled="importing" @click="chooseLibrary('footage')">Chọn từ thư viện</el-button>
        </div>
        <ol v-if="draft.scenes.length" class="scenes">
          <li v-for="(scene, index) in draft.scenes" :key="scene.id">
            <div class="sceneName"><strong>{{ scene.name }}</strong><small>Cảnh {{ index + 1 }}</small></div>
            <label class="duration"><span>Giây</span>
              <el-input-number :modelValue="scene.duration" :min="1" :max="60" :precision="0" size="small" controlsPosition="right"
                :aria-label="'Số giây cảnh ' + (index + 1)" @change="value => { if (value != null) scene.duration = value; }" />
            </label>
            <div class="actions">
              <el-button size="small" :disabled="index === 0" :aria-label="'Đưa cảnh ' + (index + 1) + ' lên'" @click="move(index, -1)">↑</el-button>
              <el-button size="small" :disabled="index === draft.scenes.length - 1" :aria-label="'Đưa cảnh ' + (index + 1) + ' xuống'" @click="move(index, 1)">↓</el-button>
              <el-button size="small" text :aria-label="'Bỏ cảnh ' + (index + 1)" @click="draft.scenes.splice(index, 1)">Bỏ</el-button>
            </div>
          </li>
        </ol>
        <p v-else class="hint">Thêm ảnh hoặc clip theo thứ tự muốn xuất hiện. Toàn bộ video trong đợt dùng chung danh sách này.</p>
        <p v-if="draft.scenes.length" class="hint">{{ totalSeconds }} giây · Clip được cắt hoặc lặp cho đủ cảnh. Tiếng gốc của clip được tắt để phối nhạc và lời đọc.</p>
        <div class="options">
          <label>Tỷ lệ khung hình
            <el-select v-model="draft.ratio">
              <el-option value="9:16" label="9:16 · Dọc" />
              <el-option value="16:9" label="16:9 · Ngang" />
              <el-option value="1:1" label="1:1 · Vuông" />
            </el-select>
          </label>
          <label>Độ phân giải
            <el-select v-model="draft.resolution"><el-option value="720p" label="720p" /><el-option value="1080p" label="1080p" /></el-select>
          </label>
          <label>Số video chạy cùng lúc
            <el-select :modelValue="queue.limit" :disabled="loadingQueue || savingQueue" @change="changeLimit">
              <el-option v-for="limit in 10" :key="limit" :value="limit" :label="String(limit)" />
            </el-select>
          </label>
        </div>
        <div class="audio">
          <div><strong>Nhạc nền chung</strong><small>{{ draft.music?.name || "Chưa chọn nhạc" }}</small></div>
          <div class="actions">
            <el-button size="small" :disabled="importing" @click="chooseDevice('music')">Tải lên</el-button>
            <el-button size="small" :disabled="importing" @click="chooseLibrary('music')">Từ thư viện</el-button>
            <el-button v-if="draft.music" size="small" text @click="draft.music = undefined">Bỏ nhạc</el-button>
          </div>
          <label v-if="draft.music" class="volume">Âm lượng nhạc <el-slider v-model="draft.musicVolume" :max="50" :showTooltip="false" />{{ draft.musicVolume }}%</label>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header><h2>2. Tạo danh sách video</h2></template>
        <label for="renderPrompts">Chủ đề hoặc kịch bản</label>
        <el-input id="renderPrompts" v-model="draft.prompts" type="textarea" :rows="4" :maxlength="100000"
          placeholder="Một video thì nhập trực tiếp. Nhiều video thì nhập [Video 1] [Video 2]." />
        <div class="actions promptActions">
          <el-button :disabled="!draft.prompts.trim() || draft.items.length >= 30" @click="addItems">Thêm vào danh sách</el-button>
        </div>
        <details>
          <summary>Thiết lập viết kịch bản bằng AI</summary>
          <label for="renderModel">Mô hình văn bản</label>
          <el-select id="renderModel" v-model="draft.model" :loading="loadingModels" placeholder="Chọn mô hình đã cài" filterable clearable>
            <el-option v-for="model in models" :key="getNodeModelKey(model)" :value="getNodeModelKey(model)" :label="model.label + ' · ' + model.providerLabel" />
          </el-select>
          <p v-if="modelError" class="hint">{{ modelError }}</p>
          <label for="renderContext" class="contextLabel">Kịch bản hoặc lưu ý chung</label>
          <el-input id="renderContext" v-model="draft.context" type="textarea" :rows="2" :maxlength="6000" />
        </details>
        <el-alert v-if="issue" type="error" :title="issue" :closable="false" showIcon />
        <p v-if="storageIssue" class="issue" role="alert">{{ storageIssue }}</p>
      </el-card>
    </section>

    <section class="jobs" aria-label="Duyệt và dựng video">
      <el-card shadow="never">
        <template #header>
          <div class="heading"><h2>3. Duyệt và dựng video</h2>
            <el-button text :loading="checking" @click="refresh">Làm mới trạng thái</el-button>
          </div>
        </template>
        <div class="heading">
          <p class="hint" role="status">{{ queue.running }} đang chạy · {{ queue.queued }} đang chờ trong Xưởng video</p>
          <el-button v-if="draft.items.length > 1" type="primary" plain :disabled="!readyItems.length || batchBusy || !!storageIssue"
            :loading="batchBusy" @click="enqueueBatch">Xếp hàng {{ readyItems.length }} video đã duyệt</el-button>
        </div>
        <p v-if="statusError" role="status" class="issue">{{ statusError }}</p>
        <p v-if="libraryNotice" role="status" class="hint">{{ libraryNotice }}</p>
        <el-empty v-if="!draft.items.length" :imageSize="75" description="Thêm chủ đề hoặc kịch bản để bắt đầu." />
        <div v-for="(item, index) in draft.items" :key="item.id" class="item">
          <div class="heading">
            <h3>Video {{ index + 1 }} · {{ item.topic.slice(0, 85) }}</h3>
            <div class="actions">
              <el-tag :type="tagType(item)" effect="light">{{ statusLabel(item) }}</el-tag>
              <el-button v-if="!item.attempt" text size="small" :disabled="busyItems.has(item.id)" @click="draft.items.splice(index, 1)">Bỏ mục</el-button>
            </div>
          </div>
          <template v-if="editable(item)">
            <label :for="'renderScript' + item.id">Kịch bản đã duyệt</label>
            <el-input :id="'renderScript' + item.id" v-model="item.script" type="textarea" :rows="3" :maxlength="12000" @input="item.approved = false" />
            <div class="actions">
              <el-button size="small" :loading="writingItems.has(item.id)" :disabled="!draft.model || busyItems.has(item.id)" @click="writeScript(item)">Viết kịch bản bằng AI</el-button>
              <el-checkbox v-model="item.captions" @change="item.approved = false">Chèn phụ đề</el-checkbox>
              <el-checkbox v-model="item.approved" :disabled="!item.script.trim()">Đã duyệt kịch bản</el-checkbox>
            </div>
            <p v-if="item.captions" class="hint">Mỗi dòng kịch bản là một dòng phụ đề cho đúng một cảnh, theo thứ tự bên trái.</p>
            <div class="audio">
              <div><strong>Lời đọc</strong><small>{{ item.narration?.name || "Chưa chọn bản thu" }}</small></div>
              <div class="actions">
                <el-button size="small" :disabled="importing" @click="chooseDevice(item.id)">Tải lên</el-button>
                <el-button size="small" :disabled="importing" @click="chooseLibrary(item.id)">Từ thư viện</el-button>
                <el-button v-if="item.narration" size="small" text @click="item.narration = undefined">Bỏ lời đọc</el-button>
              </div>
            </div>
            <el-button type="primary" :loading="busyItems.has(item.id)" :disabled="!canQueue(item) || !!storageIssue" @click="enqueue(item)">
              {{ stateOf(item)?.state === "failed" || stateOf(item)?.state === "cancelled" ? "Dựng lại" : "Thêm vào hàng chờ" }}
            </el-button>
          </template>
          <div v-else-if="item.attempt" class="actions">
            <el-button v-if="stateOf(item)?.state === 'interrupted' && stateOf(item)?.result?.code === 404" size="small"
              :loading="busyItems.has(item.id)" @click="submit(item)">Gửi lại yêu cầu đã lưu</el-button>
            <el-button v-else-if="stateOf(item)?.state === 'interrupted' && stateOf(item)?.resumable" size="small"
              :loading="busyItems.has(item.id)" @click="resume(item)">Tiếp tục dựng</el-button>
            <el-button v-if="['queued', 'running'].includes(stateOf(item)?.state || '')" size="small" text
              :loading="busyItems.has(item.id)" @click="cancel(item)">Hủy tác vụ</el-button>
            <template v-if="output(item)">
              <el-button size="small" @click="previewResult(item)">Xem video</el-button>
              <el-button size="small" @click="saveResult(item, false)">Tải MP4</el-button>
              <el-button size="small" @click="saveResult(item, true)">Lưu vào thư viện</el-button>
            </template>
            <el-button v-if="stateOf(item)?.state === 'succeeded'" size="small" text @click="newVersion(item)">Chỉnh và tạo bản mới</el-button>
          </div>
          <p v-if="itemErrors[item.id] || stateOf(item)?.state === 'failed'" class="issue" role="status">{{ itemErrors[item.id] || describeStudioError(stateOf(item)?.result?.message, stateOf(item)?.result?.code) }}</p>
        </div>
      </el-card>
    </section>
    <input ref="input" type="file" hidden :accept="target === 'footage' ? footageAccept : audioAccept"
      :multiple="target === 'footage'" @change="importDevice" />
    <el-dialog v-model="libraryOpen" title="Chọn tư liệu từ thư viện MacFlow" width="min(980px, 95vw)" appendToBody destroyOnClose>
      <assetLibrary v-model="libraryOpen" expanded :canSelect="canSelect" :selecting="importing" @select="importLibrary" />
    </el-dialog>
    <el-dialog v-model="previewOpen" title="Xem kết quả" width="min(760px, 95vw)" appendToBody @closed="closePreview">
      <video v-if="previewUrl" class="preview" :src="previewUrl" controls playsinline />
      <p v-else role="status">{{ previewError || "Đang mở video…" }}</p>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import axios from "axios";
import { computed, nextTick, onMounted, onScopeDispose, reactive, ref, shallowRef, watch } from "vue";
import { z } from "@toonflow/nodes-scaffold/nodeTools";
import { findNodeModel, getNodeModelIdentity, getNodeModelKey, readNodeModels, useNodeAi, type NodeAiModel } from "@toonflow/nodes-scaffold/nodeAi";
import assetLibrary from "@/pages/workspace/panels/canvas/components/assetLibrary.vue";
import useWorkspaceFiles from "@/lib/workspaceFiles";
import saveFile from "@/lib/saveFile";
import { splitFlowPrompts } from "./videoFlow";
import { describeStudioError, requestStudio, StudioRequestError } from "./studioRequests";
import { fileErrorCode, videoFlowError } from "./useVideoFlowRun";

const props = defineProps<{ directory: string; ownerId: string; active: boolean }>();
const files = useWorkspaceFiles(props.directory);
const ai = useNodeAi();
const lifetime = new AbortController();
const relativePath = z.string().min(1).max(2048);
const mediaSchema = z.object({ name: z.string().max(260), path: relativePath });
const sceneSchema = mediaSchema.extend({ id: z.uuid(), duration: z.number().int().min(1).max(60) });
const ratio = z.enum(["9:16", "16:9", "1:1"]);
const resolution = z.enum(["720p", "1080p"]);
const renderSchema = z.object({ ratio, resolution, scenes: z.array(z.object({ path: relativePath, duration: z.number(), caption: z.string().optional() })).min(1).max(20),
  music: relativePath.optional(), narration: relativePath.optional(), musicVolume: z.number().min(0).max(0.5) });
const attemptSchema = z.object({ taskId: z.uuid(), script: z.string().max(12000), video: renderSchema });
const itemSchema = z.object({ id: z.uuid(), topic: z.string().max(12000), script: z.string().max(12000), approved: z.boolean(),
  captions: z.boolean(), narration: mediaSchema.optional(), attempt: attemptSchema.optional() });
const draftSchema = z.object({ prompts: z.string().max(100000), context: z.string().max(6000), ratio, resolution, model: z.string().max(2048),
  music: mediaSchema.optional(), musicVolume: z.number().int().min(0).max(50), scenes: z.array(sceneSchema).max(20), items: z.array(itemSchema).max(30) });
type Item = z.infer<typeof itemSchema>;
type RenderAttempt = z.infer<typeof attemptSchema>;
type Queue = { limit: number; running: number; queued: number };
type Media = { path: string; mimeType: string; mediaType: string };
type Status = { taskId: string; state: "queued" | "running" | "interrupted" | "succeeded" | "failed" | "cancelled"; resumable?: boolean;
  statusUnavailable?: boolean; result?: { message: string; code: number; data: Media[] | null } };
type AssetEntry = { name: string; path: string; type: "file" | "directory" };

const key = "macflow.moneyPrinterTurbo.v1:" + JSON.stringify([props.ownerId, props.directory]);
const storageIssue = ref("");
const draft = ref<z.infer<typeof draftSchema>>({ prompts: "", context: "", ratio: "9:16", resolution: "720p",
  model: "", musicVolume: 15, scenes: [], items: [] });
try {
  const saved = localStorage.getItem(key);
  if (saved) draft.value = draftSchema.parse(JSON.parse(saved));
} catch { storageIssue.value = "Chưa đọc được bản nháp. Kiểm tra quyền lưu của trình duyệt trước khi gửi video."; }
watch(draft, () => { persist(); }, { deep: true, flush: "sync" });
function persist() {
  try { localStorage.setItem(key, JSON.stringify(draft.value)); storageIssue.value = ""; return true; }
  catch { storageIssue.value = "Trình duyệt chưa lưu được bản nháp. Chừa chỗ lưu hoặc cho phép lưu dữ liệu rồi thử lại."; return false; }
}

const issue = ref("");
const modelError = ref("");
const models = shallowRef<NodeAiModel[]>([]);
const loadingModels = ref(false);
const importing = ref(false);
const libraryOpen = ref(false);
const input = ref<HTMLInputElement>();
const target = ref("footage");
const inputDirectory = "assets/videoTuLieu";
const footageAccept = ".mp4,.mov,.webm,.png,.jpg,.jpeg,.webp";
const audioAccept = ".mp3,.wav,.m4a,.flac,.aac,.ogg";
const statusError = ref("");
const queue = ref<Queue>({ limit: 1, running: 0, queued: 0 });
const states = reactive<Record<string, Status>>({});
const itemErrors = reactive<Record<string, string>>({});
const busyItems = reactive(new Set<string>());
const writingItems = reactive(new Set<string>());
const checking = ref(false);
const loadingQueue = ref(true);
const savingQueue = ref(false);
const batchBusy = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
const totalSeconds = computed(() => draft.value.scenes.reduce((sum, scene) => sum + (scene.duration ?? 0), 0));
const readyItems = computed(() => draft.value.items.filter(item => !item.attempt && canQueue(item)));

function makeId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 15) | 64;
  bytes[8] = (bytes[8]! & 63) | 128;
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")
    .replace(/^(........)(....)(....)(....)(............)$/, "$1-$2-$3-$4-$5");
}

function addItems() {
  issue.value = "";
  try {
    const text = draft.value.prompts.trim();
    const entries = text.startsWith("[") ? splitFlowPrompts(text) : [text];
    if (entries.some(item => !item || item.length > 12000)) throw new Error("Mỗi mục cần có nội dung và tối đa 12.000 ký tự.");
    if (draft.value.items.length + entries.length > 30) throw new Error("Danh sách chứa tối đa 30 video.");
    draft.value.items.push(...entries.map(topic => ({ id: makeId(), topic, script: topic, approved: false, captions: false })));
    draft.value.prompts = "";
  } catch (error) { issue.value = videoFlowError(error); }
}

function move(index: number, delta: number) {
  const scenes = draft.value.scenes;
  const next = index + delta;
  if (!scenes[index] || !scenes[next]) return;
  [scenes[index], scenes[next]] = [scenes[next], scenes[index]];
}

async function loadModels() {
  loadingModels.value = true;
  try { models.value = await readNodeModels<NodeAiModel>("language", lifetime.signal, true); }
  catch { if (!lifetime.signal.aborted) modelError.value = "Chưa tải được mô hình văn bản. Bạn vẫn có thể nhập kịch bản."; }
  finally { loadingModels.value = false; }
}
async function writeScript(item: Item) {
  const model = findNodeModel(models.value, draft.value.model);
  if (!model || writingItems.has(item.id)) return;
  itemErrors[item.id] = "";
  writingItems.add(item.id);
  try {
    const scenes = draft.value.scenes.map(scene => `${scene.name} · ${scene.duration} giây`).join("\n");
    const answer = await ai.generate({
      ...getNodeModelIdentity(model), directory: props.directory,
      systemPrompt: "Viết kịch bản video ngắn bằng tiếng Việt tự nhiên. Với danh sách cảnh, trả đúng một câu lời đọc trên mỗi dòng tương ứng, không đánh số và không chèn định dạng Markdown. Bám sát nội dung người dùng.",
      prompt: `Chủ đề hoặc nội dung cần chỉnh:\n${item.topic}\n\nLưu ý chung:\n${draft.value.context}\n\nTư liệu theo thứ tự:\n${scenes}`,
      signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(120000)]),
    });
    if (!answer.text.trim() || answer.text.trim().length > 12000) throw new Error("Mô hình trả kịch bản rỗng hoặc quá dài. Hãy thử lại.");
    item.script = answer.text.trim();
    item.approved = false;
  } catch (error) { if (!lifetime.signal.aborted) itemErrors[item.id] = videoFlowError(error); }
  finally { writingItems.delete(item.id); }
}

function accepted(name: string, destination: string) {
  const suffix = "." + name.split(".").at(-1)?.toLowerCase();
  return (destination === "footage" ? footageAccept : audioAccept).split(",").includes(suffix);
}
function canSelect(entry: AssetEntry) { return entry.type === "file" && accepted(entry.name, target.value); }
function chooseLibrary(destination: string) { target.value = destination; libraryOpen.value = true; }
async function chooseDevice(destination: string) { target.value = destination; await nextTick(); input.value?.click(); }

async function importMedia(source: { name: string; file: Blob }[], destination: string) {
  if (destination === "footage" && draft.value.scenes.length + source.length > 20) throw new Error("Mỗi danh sách tư liệu tối đa 20 cảnh.");
  for (const folder of ["assets", inputDirectory]) {
    await files.mkdir(folder, lifetime.signal).catch(async error => {
      if (fileErrorCode(error) !== "EEXIST") throw error;
      await files.list(folder, lifetime.signal);
    });
  }
  for (const { file, name } of source) {
    if (!accepted(name, destination) || !file.size || file.size > 100 * 1024 * 1024) throw new Error("Tệp không đúng định dạng hoặc vượt 100 MiB.");
    const id = makeId();
    const path = `${inputDirectory}/source${id.replaceAll("-", "")}.${name.split(".").at(-1)?.toLowerCase()}`;
    await files.write(path, file, true, AbortSignal.any([lifetime.signal, AbortSignal.timeout(120000)]));
    const media = { name: name.slice(0, 260), path };
    if (destination === "footage") draft.value.scenes.push({ ...media, id, duration: 5 });
    else if (destination === "music") draft.value.music = media;
    else {
      const item = draft.value.items.find(row => row.id === destination);
      if (item && editable(item)) item.narration = media;
    }
  }
}
async function importDevice(event: Event) {
  const field = event.target as HTMLInputElement;
  const source = Array.from(field.files ?? []).map(file => ({ file, name: file.name }));
  field.value = "";
  if (!source.length || importing.value) return;
  issue.value = "";
  importing.value = true;
  try { await importMedia(source, target.value); }
  catch (error) { if (!lifetime.signal.aborted) issue.value = videoFlowError(error); }
  finally { importing.value = false; }
}
async function importLibrary(entry: AssetEntry) {
  if (!canSelect(entry) || importing.value) return;
  const destination = target.value;
  importing.value = true;
  issue.value = "";
  try {
    const { data } = await axios.get<Blob>("/api/assets/read", { params: { path: entry.path }, responseType: "blob", signal: lifetime.signal, timeout: 120000 });
    await importMedia([{ file: data, name: entry.name }], destination);
    libraryOpen.value = false;
  } catch (error) { if (!lifetime.signal.aborted) issue.value = videoFlowError(error); }
  finally { importing.value = false; }
}

function stateOf(item: Item) { return item.attempt ? states[item.attempt.taskId] : undefined; }
function editable(item: Item) { return !item.attempt || ["failed", "cancelled"].includes(stateOf(item)?.state ?? ""); }
function canQueue(item: Item) {
  return !importing.value && editable(item) && item.approved && !!item.script.trim() && draft.value.scenes.length > 0 &&
    totalSeconds.value <= 300 && !writingItems.has(item.id) && draft.value.scenes.every(scene => Number.isInteger(scene.duration) && scene.duration >= 1 && scene.duration <= 60);
}

function output(item: Item) {
  const state = stateOf(item);
  return state?.state === "succeeded" ? state.result?.data?.find(media => media.mediaType === "video") : undefined;
}
function statusLabel(item: Item) {
  if (writingItems.has(item.id)) return "Đang viết kịch bản";
  if (!item.attempt) return item.approved ? "Đã duyệt" : "Chờ duyệt";
  const status = stateOf(item);
  if (status?.statusUnavailable) return "Chưa đọc được tiến độ";
  const labels = { queued: "Đang chờ", running: "Đang dựng", interrupted: "Đã gián đoạn",
    succeeded: "Đã hoàn thành", failed: "Lỗi", cancelled: "Đã hủy" };
  return status ? labels[status.state] : "Đang kiểm tra";
}
function tagType(item: Item) {
  return ({ failed: "danger", succeeded: "success", running: "primary", interrupted: "warning" } as const)
    [stateOf(item)?.state as "failed" | "succeeded" | "running" | "interrupted"] ?? "info";
}
function newVersion(item: Item) {
  item.attempt = undefined;
  item.approved = false;
  itemErrors[item.id] = "";
}
async function submit(item: Item) {
  if (!item.attempt || busyItems.has(item.id)) return;
  const { taskId, script, video } = item.attempt;
  busyItems.add(item.id);
  itemErrors[item.id] = "";
  try {
    const result = await requestStudio<{ taskId: string }>("/api/mediaStudio/render", {
      method: "POST", body: JSON.stringify({ directory: props.directory, taskId, script, video }),
      signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(20000)]),
    });
    if (result.taskId !== taskId) throw new Error("Máy chủ trả sai mã tác vụ. Hãy kiểm tra lại.");
    states[taskId] = { taskId, state: "queued" };
  } catch (error) {
    if (!lifetime.signal.aborted) {
      itemErrors[item.id] = videoFlowError(error);
      if (error instanceof StudioRequestError && [400, 401, 403, 413, 415, 422].includes(error.status)) item.attempt = undefined;
    }
  }
  finally { busyItems.delete(item.id); if (!batchBusy.value) void refresh(); }
}

async function enqueue(item: Item) {
  if (!canQueue(item) || busyItems.has(item.id)) return;
  itemErrors[item.id] = "";
  const subtitles = item.captions ? item.script.split(/\r?\n/).map(line => line.trim()).filter(Boolean) : [];
  if (item.captions && (subtitles.length !== draft.value.scenes.length || subtitles.some(line => line.length > 280))) {
    itemErrors[item.id] = "Số dòng phụ đề phải bằng số cảnh và mỗi dòng tối đa 280 ký tự.";
    return;
  }
  const attempt: RenderAttempt = { taskId: makeId(), script: item.script.trim(), video: {
    ratio: draft.value.ratio, resolution: draft.value.resolution, scenes: draft.value.scenes.map(({ path, duration }, index) => ({
      path, duration, caption: subtitles[index],
    })),
    music: draft.value.music?.path, narration: item.narration?.path, musicVolume: draft.value.musicVolume / 100,
  } };
  const previous = item.attempt;
  item.attempt = attempt;
  if (!persist()) { item.attempt = previous; return; }
  await submit(item);
}
async function enqueueBatch() {
  if (batchBusy.value) return;
  batchBusy.value = true;
  try { for (const item of [...readyItems.value]) { if (lifetime.signal.aborted) break; await enqueue(item); } }
  finally { batchBusy.value = false; void refresh(); }
}

const statusRequest = (ids: string[], resume = false) => requestStudio<Status[]>("/api/ai/media/tasks/status", {
  method: "POST", body: JSON.stringify({ directory: props.directory, taskIds: ids, resume }),
  signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(15000)]),
});
async function refresh() {
  if (checking.value || lifetime.signal.aborted) return;
  clearTimeout(timer);
  checking.value = true;
  try {
    const ids = draft.value.items.flatMap(item => item.attempt ? [item.attempt.taskId] : []);
    const params = new URLSearchParams({ directory: props.directory, mediaType: "video", queueOnly: "1" });
    const [status, summary] = await Promise.allSettled([
      ids.length ? statusRequest(ids) : Promise.resolve([]),
      requestStudio<{ queue: Queue }>("/api/mediaStudio/list?" + params, { signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(15000)]) }),
    ]);
    if (status.status === "fulfilled") for (const row of status.value) states[row.taskId] = row;
    if (summary.status === "fulfilled" && !savingQueue.value) queue.value = summary.value.queue;
    statusError.value = status.status === "rejected" || summary.status === "rejected" ? "Chưa cập nhật được tiến độ. MacFlow sẽ thử lại." : "";
  } finally {
    loadingQueue.value = false;
    checking.value = false;
    if (!lifetime.signal.aborted && props.active) timer = setTimeout(() => void refresh(), 2500);
  }
}
async function changeLimit(limit: number) {
  savingQueue.value = true;
  issue.value = "";
  try {
    const result = await requestStudio<{ limit: number }>("/api/mediaStudio/queueLimit", {
      method: "PUT", body: JSON.stringify({ mediaType: "video", limit }), signal: lifetime.signal,
    });
    queue.value.limit = result.limit;
  } catch (error) { if (!lifetime.signal.aborted) issue.value = videoFlowError(error); }
  finally { savingQueue.value = false; }
}
async function resume(item: Item) {
  if (!item.attempt || busyItems.has(item.id)) return;
  busyItems.add(item.id);
  try { for (const row of await statusRequest([item.attempt.taskId], true)) states[row.taskId] = row; }
  catch (error) { if (!lifetime.signal.aborted) itemErrors[item.id] = videoFlowError(error); }
  finally { busyItems.delete(item.id); void refresh(); }
}
async function cancel(item: Item) {
  if (!item.attempt || busyItems.has(item.id)) return;
  busyItems.add(item.id);
  try { await requestStudio("/api/ai/media/tasks/cancel", {
    method: "POST", body: JSON.stringify({ directory: props.directory, taskIds: [item.attempt.taskId] }), signal: lifetime.signal,
  }); }
  catch (error) { if (!lifetime.signal.aborted) itemErrors[item.id] = videoFlowError(error); }
  finally { busyItems.delete(item.id); void refresh(); }
}

const previewOpen = ref(false);
const previewUrl = ref("");
const previewError = ref("");
let preview: ReturnType<typeof files.acquireUrl> | undefined;
function closePreview() { preview?.release(); preview = undefined; previewUrl.value = ""; previewError.value = ""; }
async function previewResult(item: Item) {
  const media = output(item);
  if (!media) return;
  closePreview();
  previewOpen.value = true;
  const acquiring = files.acquireUrl(media.path, media.mimeType);
  preview = acquiring;
  try { const url = await acquiring.url; if (preview === acquiring) previewUrl.value = url; }
  catch { if (preview === acquiring) previewError.value = "Chưa mở được MP4 đã lưu."; }
}
async function saveResult(item: Item, toLibrary: boolean) {
  const media = output(item);
  if (!media || !item.attempt || busyItems.has(item.id)) return;
  busyItems.add(item.id);
  itemErrors[item.id] = "";
  try {
    const filename = "videoTuLieu" + item.attempt.taskId.replaceAll("-", "") + ".mp4";
    const result = async () => new Blob([await files.read(media.path)], { type: "video/mp4" });
    if (toLibrary) {
      libraryNotice.value = "";
      await axios.put("/api/assets/save", await result(), { params: { path: filename }, signal: lifetime.signal, timeout: 120000,
        headers: { "Content-Type": "application/octet-stream" } });
      itemErrors[item.id] = "";
      issue.value = "";
      libraryNotice.value = "Đã lưu video vào thư viện MacFlow.";
    } else await saveFile(result, filename);
  } catch (error) { if (!lifetime.signal.aborted) itemErrors[item.id] = videoFlowError(error); }
  finally { busyItems.delete(item.id); }
}
const libraryNotice = ref("");
watch(() => props.active, active => { if (active) void refresh(); else clearTimeout(timer); });
onMounted(() => { void loadModels(); if (props.active) void refresh(); });
onScopeDispose(() => { lifetime.abort(); clearTimeout(timer); closePreview(); });
</script>

<style scoped>
.renderStudio { display: grid; grid-template-columns: minmax(310px, .95fr) minmax(335px, 1.15fr); gap: 18px; align-items: start; }
.setup, .jobs, .item { display: grid; min-width: 0; gap: 12px; }
h2, h3, p { margin: 0; }
h2 { font-size: 1rem; }
h3 { font-size: .94rem; overflow-wrap: anywhere; flex: 1; }
label { display: grid; gap: 6px; }
.hint, small { font-size: .8125rem; color: var(--el-text-color-secondary); line-height: 1.5; }
.issue { color: var(--el-color-danger); font-size: .875rem; }
.actions, .heading, .audio { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.heading { justify-content: space-between; }
.actions :deep(.el-button), .heading :deep(.el-button) { margin: 0; }
.scenes { display: grid; gap: 6px; padding: 0; list-style: none; }
.scenes li, .audio { padding: 9px 10px; border: 1px solid var(--el-border-color-light); border-radius: var(--ui-radius, 8px); }
.scenes li { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.sceneName { flex: 1 1 110px; min-width: 0; overflow-wrap: anywhere; }
.sceneName small, .audio small { display: block; }
.duration { flex: 0 0 84px; }
.duration :deep(.el-input-number) { width: 84px; }
.options { display: grid; grid-template-columns: repeat(auto-fit, minmax(125px, 1fr)); gap: 10px; margin: 14px 0; }
.audio { justify-content: space-between; }
.volume { flex: 1 1 100%; grid-template-columns: auto minmax(90px, 1fr) 36px; align-items: center; }
.item { border-top: 1px solid var(--el-border-color-light); padding: 15px 0; margin-top: 8px; }
.item > .el-button { justify-self: start; }
.promptActions, details, .contextLabel { margin: 10px 0; }
summary { cursor: pointer; color: var(--el-text-color-regular); margin-bottom: 8px; }
.preview { display: block; max-width: 100%; max-height: 72vh; margin: auto; background: #000; }
@media (max-width: 1000px) { .renderStudio { grid-template-columns: minmax(0, 1fr); } }
</style>
