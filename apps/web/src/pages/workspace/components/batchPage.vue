<template>
  <section class="batchPage" :aria-label="kind === 'image' ? 'Tạo ảnh hàng loạt' : 'Tạo video hàng loạt'">
    <header class="batchHeader">
      <h2>{{ kind === "image" ? "Tạo ảnh hàng loạt" : "Tạo video hàng loạt" }}</h2>
      <el-button :loading="loading" @click="refresh">Làm mới</el-button>
    </header>
    <div class="batchComposer">
      <label class="fieldLabel" for="batchModel">Mô hình AI</label>
      <el-select id="batchModel" v-model="modelKey" filterable placeholder="Chọn model đã cấu hình" :loading="modelsLoading">
        <el-option v-for="model in filteredModels" :key="keyFor(model)" :value="keyFor(model)" :label="model.providerLabel + ' · ' + model.label"
          :disabled="model.availability === 'needsConfiguration'">
          {{ model.providerLabel }} · {{ model.label }}{{ model.availability === "needsConfiguration" ? " — Chưa cấu hình" : "" }}
        </el-option>
      </el-select>
      <label class="fieldLabel" for="batchPrompts">Danh sách prompt (mỗi dòng là một cảnh độc lập)</label>
      <el-input id="batchPrompts" v-model="promptLines" type="textarea" :rows="6" placeholder="Một prompt trên mỗi dòng…" maxlength="100000" />
      <div class="batchOptions">
        <label>Tỷ lệ <el-select v-model="ratio"><el-option v-for="item in ratios" :key="item" :label="item" :value="item" /></el-select></label>
        <label v-if="kind === 'image'">Chất lượng / kích thước <el-input v-model="size" placeholder="Để trống nếu model tự quyết định" /></label>
        <label v-else>Thời lượng (giây) <el-input-number v-model="duration" :min="1" :max="120" /></label>
      </div>
      <label class="fieldLabel" for="batchReferences">Ảnh tham chiếu dùng chung cho các cảnh (không bắt buộc)</label>
      <input id="batchReferences" type="file" accept="image/png,image/jpeg,image/webp" multiple @change="selectImages" />
      <div v-if="referenceFiles.length" class="imageNames">{{ referenceFiles.map(file => file.name).join(", ") }}</div>
      <div class="batchSubmit">
        <span>{{ prompts.length }} cảnh · Chạy lần lượt, không tự gửi lại trạng thái UNKNOWN</span>
        <el-button type="primary" :loading="creating" :disabled="!directory || !selectedModel || !prompts.length || prompts.length > 100 || creating" @click="createBatch">Tạo hàng đợi</el-button>
      </div>
    </div>
    <h3>Hàng đợi đã lưu trong workspace</h3>
    <p v-if="!visibleBatches.length" class="muted">Chưa có hàng đợi thuộc loại này.</p>
    <article v-for="batch in visibleBatches" :key="batch.id" class="batchCard">
      <div class="batchTitle">
        <strong>{{ batch.kind === "image" ? "Ảnh" : "Video" }} · {{ batch.scenes.length }} cảnh</strong>
        <span>ID {{ batch.id }}</span>
        <span>{{ batch.state }}</span>
        <span v-if="batch.pauseReason" class="pauseReason" :title="batch.pauseReason">{{ batch.pauseReason }}</span>
      </div>
      <div class="batchActions">
        <el-button size="small" :disabled="batch.state !== 'running' || controlling === batch.id" @click="control(batch, 'pause')">Tạm dừng</el-button>
        <el-button size="small" :disabled="batch.state !== 'paused' || controlling === batch.id" @click="control(batch, 'resume')">Tiếp tục</el-button>
        <el-button size="small" type="danger" plain :disabled="['completed','partial','cancelled'].includes(batch.state) || controlling === batch.id" @click="control(batch, 'cancel')">Hủy</el-button>
        <el-button v-if="batch.kind === 'video' && batch.scenes.length > 1" size="small" type="primary"
          :loading="joining === batch.id" :disabled="joining !== '' || batch.state !== 'completed' || batch.scenes.some(scene => scene.state !== 'succeeded')"
          @click="mergeVideo(batch)">Ghép MP4 (FFmpeg)</el-button>
        <el-button v-if="batch.merged" size="small" link type="success" @click="download({ ...batch.merged, mediaType: 'video' })">Tải MP4 đã ghép</el-button>
        <el-button v-if="batch.merged" size="small" link type="primary" @click="emit('importMedia', { ...batch.merged, mediaType: 'video' })">Đưa MP4 vào Canvas</el-button>
      </div>
      <div class="sceneList">
        <div v-for="scene in batch.scenes" :key="scene.id" class="sceneRow">
          <span>Cảnh {{ scene.index + 1 }}</span>
          <span class="scenePrompt" :title="scene.request.prompt">{{ scene.request.prompt }}</span>
          <span :class="['sceneState', scene.state]">{{ scene.state }}</span>
          <el-button v-if="scene.result?.length" link type="primary" @click="download(scene.result[0])">Tải kết quả</el-button>
          <el-button v-if="scene.result?.length" link type="success" @click="emit('importMedia', scene.result[0])">Đưa vào Canvas</el-button>
          <small v-if="scene.error" :title="scene.error">{{ scene.error }}</small>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import axios from "axios";
import { ElButton, ElInput, ElInputNumber, ElMessage, ElOption, ElSelect } from "element-plus";
import { uploadNodeFile } from "@toonflow/nodes-scaffold/workspaceFiles";
import useWorkspaceFiles from "@/lib/workspaceFiles";
type Kind = "image" | "video";
type Model = { providerId: string; providerLabel: string; modelId: string; routeId?: string; label: string; type: Kind | "audio"; availability?: "ready" | "configured" | "needsConfiguration" };
type Result = { path: string; mimeType: string; mediaType: Kind };
type Scene = { id: string; taskId: string; index: number; request: { prompt: string }; state: string; result?: Result[]; error?: string };
type Batch = { id: string; kind: Kind; state: string; scenes: Scene[]; createdAt: number; merged?: { path: string; mimeType: string }; pauseReason?: string };
const props = defineProps<{ kind: Kind; directory?: string; active: boolean }>();
const emit = defineEmits<{ importMedia: [result: Result] }>();
const ratios = ["16:9", "9:16", "1:1", "4:3", "3:4"];
const modelKey = ref("");
const models = ref<Model[]>([]);
const modelsLoading = ref(false);
const promptLines = ref("");
const prompts = computed(() => promptLines.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
const ratio = ref("16:9");
const size = ref("");
const duration = ref(5);
const referenceFiles = ref<File[]>([]);
const creating = ref(false);
const loading = ref(false);
const controlling = ref("");
const joining = ref("");
const batches = ref<Batch[]>([]);
const visibleBatches = computed(() => batches.value.filter(batch => batch.kind === props.kind));
const filteredModels = computed(() => models.value.filter(model => model.type === props.kind));
function keyFor(model: Model) { return JSON.stringify([model.providerId, model.providerId === "multiTenant" ? model.routeId ?? model.modelId : model.modelId]); }
const selectedModel = computed(() => filteredModels.value.find(model => keyFor(model) === modelKey.value && model.availability !== "needsConfiguration"));
let pollTimer: ReturnType<typeof setInterval> | undefined;
let runToken = 0;
async function readModels() {
  modelsLoading.value = true;
  try {
    const { data } = await axios.get<{ data: Model[] }>("/api/ai/media/models");
    models.value = data.data;
    if (!selectedModel.value) modelKey.value = filteredModels.value.find(model => model.availability !== "needsConfiguration") ? keyFor(filteredModels.value.find(model => model.availability !== "needsConfiguration")!) : "";
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Không thể đọc model AI");
  } finally { modelsLoading.value = false; }
}
async function refresh() {
  const directory = props.directory;
  if (!directory || !props.active) return;
  const token = ++runToken;
  loading.value = true;
  try {
    const { data } = await axios.post<{ data: Batch[] }>("/api/ai/media/batches/list", { directory });
    if (token === runToken && directory === props.directory) batches.value = data.data;
  } catch (error) {
    if (token === runToken) ElMessage.error(error instanceof Error ? error.message : "Không thể tải hàng đợi");
  } finally {
    if (token === runToken) loading.value = false;
  }
}
function selectImages(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (files.length > 4 || files.some(file => !["image/png","image/jpeg","image/webp"].includes(file.type) || file.size > 25 * 1024 * 1024)) {
    ElMessage.warning("Tối đa 4 ảnh PNG/JPEG/WebP, mỗi ảnh không quá 25 MB");
    referenceFiles.value = [];
    input.value = "";
    return;
  }
  referenceFiles.value = files;
}
async function createBatch() {
  const directory = props.directory;
  const model = selectedModel.value;
  if (!directory || !model || !prompts.value.length || prompts.value.length > 100 || creating.value) return;
  creating.value = true;
  try {
    const references: { path: string; mimeType: string }[] = [];
    const files = useWorkspaceFiles(directory);
    const owner = crypto.randomUUID();
    for (const file of referenceFiles.value) {
      const path = await uploadNodeFile(files, owner, file);
      references.push({ path, mimeType: file.type });
    }
    if (directory !== props.directory) throw new Error("Workspace đã thay đổi trong khi tải ảnh");
    const requests = prompts.value.map(prompt => ({
      providerId: model.providerId, modelId: model.providerId === "multiTenant" ? model.routeId ?? model.modelId : model.modelId,
      prompt, ratio: ratio.value,
      ...(references.length ? { images: references } : {}),
      ...(props.kind === "image" ? { ...(size.value.trim() ? { size: size.value.trim() } : {}) }
        : { duration: duration.value, mode: references.length ? "singleImage" : "text" }),
    }));
    await axios.post("/api/ai/media/batches/create", { directory, kind: props.kind, requests });
    await refresh();
  } catch (error) {
    ElMessage.error(axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || error.message : (error as Error).message);
  } finally { creating.value = false; }
}
async function control(batch: Batch, action: "pause" | "resume" | "cancel") {
  if (!props.directory || controlling.value) return;
  controlling.value = batch.id;
  try {
    await axios.post("/api/ai/media/batches/control", { directory: props.directory, id: batch.id, action });
    await refresh();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Không thể thay đổi hàng đợi");
  } finally { controlling.value = ""; }
}
async function mergeVideo(batch: Batch) {
  if (!props.directory || joining.value || batch.kind !== "video") return;
  joining.value = batch.id;
  try {
    await axios.post("/api/ai/media/batches/merge", { directory: props.directory, id: batch.id });
    await refresh();
    ElMessage.success("Đã ghép video từ các cảnh được FFprobe xác nhận");
  } catch (error) {
    ElMessage.error(axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || error.message : "Không thể ghép MP4");
  } finally { joining.value = ""; }
}
async function download(result: Result) {
  if (!props.directory) return;
  try {
    const content = await useWorkspaceFiles(props.directory).read(result.path);
    const url = URL.createObjectURL(new Blob([content], { type: result.mimeType }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.path.split("/").pop() ?? (props.kind === "image" ? "image.png" : "video.mp4");
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : "Không thể tải media"); }
}
watch([() => props.active, () => props.directory, () => props.kind], ([active]) => {
  ++runToken;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = undefined;
  batches.value = [];
  if (!active || !props.directory) return;
  ratio.value = props.kind === "image" ? "16:9" : "9:16";
  void readModels();
  void refresh();
  pollTimer = setInterval(() => { if (!loading.value) void refresh(); }, 3000);
}, { immediate: true });
onBeforeUnmount(() => { ++runToken; if (pollTimer) clearInterval(pollTimer); });
</script>

<style scoped lang="scss">
.batchPage { position: absolute; inset: 0; overflow-y: auto; padding: 80px 36px 80px; background: var(--el-bg-color); z-index: 3; }
.batchHeader,.batchSubmit,.batchTitle,.batchActions { display: flex; align-items: center; gap: 12px; }
.batchHeader,.batchSubmit { justify-content: space-between; }
.batchHeader h2 { margin: 0; }
.batchComposer,.batchCard { border: 1px solid var(--el-border-color); border-radius: 10px; padding: 20px; background: var(--el-bg-color-overlay); margin: 16px 0; }
.fieldLabel { display: block; font-weight: 600; margin: 12px 0 8px; }
.batchComposer > .el-select { width: 100%; }
.batchOptions { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 12px; }
.batchOptions label { display: flex; align-items: center; gap: 8px; }
.batchOptions .el-select { width: 115px; }
.batchSubmit { margin-top: 20px; }
.batchTitle { flex-wrap: wrap; }
.batchTitle span { font-size: 12px; color: var(--el-text-color-secondary); }
.batchTitle .pauseReason { color: var(--el-color-warning); flex-basis: 100%; }
.batchActions { margin: 12px 0; }
.sceneRow { display: grid; grid-template-columns: 65px minmax(180px,1fr) 100px auto; gap: 8px; align-items: center; border-top: 1px solid var(--el-border-color-lighter); padding: 9px 0; }
.scenePrompt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sceneState { font-weight: 600; font-size: 12px; }
.sceneState.succeeded { color: var(--el-color-success); }
.sceneState.failed,.sceneState.unknown { color: var(--el-color-danger); }
.sceneState.running { color: var(--el-color-warning); }
.sceneRow small { grid-column: 2 / -1; color: var(--el-color-danger); }
.muted,.imageNames { color: var(--el-text-color-secondary); font-size: 12px; }
@media (max-width: 700px) { .batchPage { padding: 75px 14px 65px; } .sceneRow { grid-template-columns: 60px 1fr; } }
</style>
