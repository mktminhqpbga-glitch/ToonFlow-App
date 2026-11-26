<template>
  <div class="flowWorkspace">
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" showIcon>
      <el-button size="small" @click="loadRun">Mở lại tiến độ</el-button>
    </el-alert>
    <el-alert v-else-if="saveError" type="error" :title="saveError" :closable="false" showIcon>
      <el-button size="small" :disabled="busy" @click="persist">Thử lưu lại</el-button>
    </el-alert>
    <el-alert v-if="operationError" type="error" :title="operationError" showIcon @close="operationError = ''" />
    <el-alert v-if="actionError" type="error" :title="actionError" showIcon @close="actionError = ''" />
    <p v-if="busy && !run" class="hint" role="status">Đang mở tiến độ dự án…</p>

    <div v-if="run || !busy" class="flowLayout" :class="{ hasRun: run }">
      <el-card v-if="!run" shadow="never">
        <template #header><h2>Đầu vào chung</h2></template>
        <div class="flowFields">
          <label for="flowPrompts">Danh sách prompt</label>
          <el-input id="flowPrompts" v-model="draft.prompts" type="textarea" :rows="7" :maxlength="promptLimit"
            placeholder="[Cảnh giới thiệu sản phẩm]&#10;[Cảnh hướng dẫn sử dụng]" />
          <p class="hint">Mỗi cặp [ ] là một mục. Luồng xử lý theo thứ tự đã nhập.</p>
          <div v-for="group in photoGroups" :key="group.key" class="photoGroup">
            <label :for="group.key">{{ group.label }}</label>
            <input :id="group.key" type="file" :accept="Object.keys(imageExtensions).join(',')" multiple :disabled="uploading"
              @change="addPhotos(group.key, $event)" />
            <ul v-if="draft[group.key].length" class="photoList">
              <li v-for="photo in draft[group.key]" :key="photo.path">
                <span>{{ photo.name }}</span>
                <el-button text size="small" :aria-label="'Bỏ ' + photo.name" :disabled="uploading" @click="removePhoto(group.key, photo.path)">Bỏ</el-button>
              </li>
            </ul>
          </div>
          <label for="flowSharedScript">Kịch bản chung <small>Tùy chọn</small></label>
          <el-input id="flowSharedScript" v-model="draft.sharedScript" type="textarea" :rows="3" :maxlength="contextLimit" />
          <label for="flowProduct">Mô tả sản phẩm <small>Tùy chọn</small></label>
          <el-input id="flowProduct" v-model="draft.product" type="textarea" :rows="2" :maxlength="contextLimit" />
        </div>
      </el-card>

      <el-card shadow="never" class="runControl">
        <template #header><h2>{{ run ? "Đợt đang mở" : "Cách chạy" }}</h2></template>
        <div class="flowFields">
          <p v-if="run" class="hint">Mẫu {{ run.template.name }}</p>
          <label for="flowMode">Tạo video</label>
          <select id="flowMode" :value="run?.input.mode ?? draft.mode" :disabled="busy || !!saveError" @change="changeMode">
            <option value="automatic">Tự động sau khi có khung hình đầu</option>
            <option value="review">Duyệt khung hình đầu trước khi tạo video</option>
          </select>
          <p v-if="!run" class="hint">Tách prompt → Dựng kịch bản → Tạo khung hình đầu → Tạo video</p>
          <p v-if="draftError && !run" class="error" role="alert">{{ draftError }}</p>
          <details>
            <summary>Nâng cao</summary>
            <div class="advanced">
              <template v-if="!run">
                <label for="flowTemplate">Mẫu luồng</label>
                <select id="flowTemplate" v-model="draft.templateId" :disabled="catalogLoading">
                  <option value="">Luồng video mặc định</option>
                  <option v-for="template in templates" :key="template.id" :value="template.id">{{ template.name }}</option>
                </select>
                <p class="hint">Tạo mẫu gồm ba bước Văn bản → Ảnh → Video trong mục Thiết lập luồng.</p>
              </template>
              <template v-for="kind in modelKinds" :key="kind.key">
                <label :for="'flowModel' + kind.key">Mô hình {{ kind.label }}</label>
                <select :id="'flowModel' + kind.key" :value="(run?.input ?? draft).models[kind.key]" :disabled="busy || catalogLoading || !!saveError"
                  @change="chooseModel(kind.key, $event)">
                  <option value="">{{ selectedTemplate?.steps[kind.index]?.model ? "Theo mẫu luồng" : "Tự chọn mô hình phù hợp" }}</option>
                  <option v-if="modelMissing(kind.key)" :value="(run?.input ?? draft).models[kind.key]" disabled>Mô hình đã chọn không còn khả dụng</option>
                  <option v-for="model in modelsFor(kind.key)" :key="getNodeModelKey(model)" :value="getNodeModelKey(model)">
                    {{ model.label }} · {{ model.providerLabel }}
                  </option>
                </select>
              </template>
              <p v-if="catalogError" class="error" role="alert">{{ catalogError }}</p>
              <el-button size="small" :loading="catalogLoading" :disabled="busy" @click="loadCatalog">Làm mới mô hình và mẫu</el-button>
              <el-button size="small" :disabled="busy" @click="emit('settings')">Mở cài đặt mô hình</el-button>
            </div>
          </details>

          <div v-if="!run" class="flowActions">
            <el-button type="primary" :disabled="busy || uploading || catalogLoading || !draft.prompts.trim() || !!loadError" @click="startBatch">Bắt đầu chạy</el-button>
          </div>
          <template v-else>
            <el-progress :percentage="percentage" :strokeWidth="8" aria-label="Tiến độ toàn đợt" />
            <p class="hint" role="status">{{ completed }} / {{ run.items.length }} video hoàn tất<span v-if="reviews.length"> · {{ reviews.length }} chờ duyệt</span><span v-if="failed"> · {{ failed }} mục cần kiểm tra</span></p>
            <div class="flowActions">
              <el-button v-if="working" @click="pause">Tạm dừng luồng</el-button>
              <el-button v-else-if="hasPending" type="primary" :disabled="busy || catalogLoading || !!saveError" @click="resume">Tiếp tục chạy</el-button>
              <el-button v-if="reviews.length && run.input.mode === 'review'" plain :disabled="busy || !!saveError" @click="confirmApproveAll">Duyệt tất cả khung hình</el-button>
              <el-button v-if="!working" text :disabled="busy || !!saveError" @click="prepareNext">Chuẩn bị đợt mới</el-button>
            </div>
            <p class="hint">Bạn có thể tải lại trang để tiếp tục. Sau khi đóng xưởng, ảnh hoặc video đã gửi vẫn có thể chạy trên máy chủ.</p>
          </template>
        </div>
      </el-card>

      <el-card v-if="run" shadow="never" class="runItems">
        <template #header><h2>Từng mục trong đợt</h2></template>
        <div class="itemLayout">
          <div class="itemList" aria-label="Danh sách mục">
            <button v-for="(item, index) in run.items" :key="item.id" type="button" class="itemButton" :aria-pressed="currentItem?.id === item.id"
              @click="selectedId = item.id">
              <strong>{{ index + 1 }}. {{ item.prompt || 'Prompt trống' }}</strong>
              <el-tag size="small" :type="stateType[itemState(item)]">{{ stateLabel(itemState(item)) }}</el-tag>
            </button>
          </div>
          <section v-if="currentItem" class="itemDetail" :aria-label="'Các bước của mục ' + (run.items.indexOf(currentItem) + 1)">
            <ol class="stageList">
              <li v-for="stage in flowStages" :key="stage" class="stage">
                <div class="stageHeading">
                  <strong>{{ stageLabels[stage] }}</strong>
                  <el-tag size="small" :type="stateType[currentItem.stages[stage].state]">{{ stateLabel(currentItem.stages[stage].state) }}</el-tag>
                </div>
                <p v-if="currentItem.stages[stage].message" class="error" role="status">{{ currentItem.stages[stage].message }}</p>
                <details v-if="currentItem.stages[stage].attempt && isError(currentItem, stage)" class="technical">
                  <summary>Mã tác vụ</summary><code>{{ currentItem.stages[stage].attempt?.id }}</code>
                  <el-button v-if="currentItem.stages[stage].attempt?.replaceable" size="small" text
                    :disabled="busy || !!saveError" @click="replaceTask(currentItem, stage)">Tạo tác vụ mới cho bước này</el-button>
                </details>
                <el-input v-if="stage === 'prepare' && isError(currentItem, stage)" v-model="repairPrompt" aria-label="Nội dung prompt của mục"
                  :maxlength="promptLimit" type="textarea" :rows="2" :disabled="busy" />
                <el-button v-if="isError(currentItem, stage)" size="small" plain :disabled="busy || !!saveError || (stage === 'prepare' && !repairPrompt.trim())"
                  @click="retryStage(currentItem, stage)">{{ currentItem.stages[stage].state === "interrupted" ? "Kiểm tra lại" : "Chạy lại bước này" }}</el-button>
                <p v-if="stage === 'prepare' && currentItem.prompt" class="contentText">{{ currentItem.prompt }}</p>
                <template v-if="stage === 'script' && currentItem.script">
                  <details open><summary>Xem kịch bản</summary><p class="contentText">{{ currentItem.script }}</p></details>
                  <el-button size="small" :loading="downloading === 'script'" @click="downloadScript">Tải kịch bản</el-button>
                </template>
                <template v-if="stage === 'frame' && currentItem.frame">
                  <div class="preview">
                    <img v-if="previews.frame" :src="previews.frame" alt="Khung hình đầu" @error="previewUnavailable('frame')" />
                    <p v-else class="hint">{{ previewErrors.frame || "Đang mở ảnh…" }}</p>
                  </div>
                  <el-button size="small" :loading="downloading === 'image'" @click="downloadMedia(currentItem.frame)">Tải ảnh</el-button>
                </template>
                <template v-if="stage === 'video'">
                  <el-button v-if="currentItem.stages.video.state === 'review' && run.input.mode === 'review'" type="primary" size="small"
                    :disabled="busy || !!saveError" @click="approve([currentItem])">Duyệt ảnh và tạo video</el-button>
                  <template v-if="currentItem.video">
                    <div class="preview">
                      <video v-if="previews.video" :src="previews.video" controls playsinline preload="metadata" aria-label="Video kết quả" @error="previewUnavailable('video')" />
                      <p v-else class="hint">{{ previewErrors.video || "Đang mở video…" }}</p>
                    </div>
                    <el-button type="primary" size="small" :loading="downloading === 'video'" @click="downloadMedia(currentItem.video)">Tải video</el-button>
                  </template>
                </template>
              </li>
            </ol>
          </section>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose, reactive, ref, shallowRef, watch } from "vue";
import { ElMessageBox } from "element-plus";
import { getNodeModelKey, readNodeModels, type NodeAiModel, type NodeMediaModel } from "@toonflow/nodes-scaffold/nodeAi";
import saveFile from "@/lib/saveFile";
import useWorkspaceFiles from "@/lib/workspaceFiles";
import { flowLibraryPath, makeStarterFlow, parseFlowLibrary, type StudioFlow } from "./studioFlows";
import { contextLimit, emptyFlowInput, flowStages, imageByteLimit, imageExtensions, imageLimit, isVideoFlowTemplate, makeVideoRun,
  promptLimit, readFlowInput, splitFlowPrompts, stageLabels, type FlowItem, type FlowMediaFile, type FlowStage, type StepProgress, type VideoFlowMode } from "./videoFlow";
import { supportsFlowPhotos, videoImageMode } from "./videoFlowTasks";
import { fileErrorCode, useVideoFlowRun, videoFlowError } from "./useVideoFlowRun";

const props = defineProps<{ directory: string; ownerId: string; catalogRevision: number }>();
const emit = defineEmits<{ settings: [] }>();
const files = useWorkspaceFiles(props.directory);
const draftKey = "macflow.videoFlow.draft.v1:" + JSON.stringify([props.ownerId, props.directory]);
const lifetime = new AbortController();
const draftError = ref("");
const actionError = ref("");
const draft = ref(emptyFlowInput());
try { draft.value = readFlowInput(JSON.parse(localStorage.getItem(draftKey) ?? "null")); }
catch { draftError.value = "Không đọc được bản nhập đã lưu trên trình duyệt này."; }
watch(draft, value => {
  try { localStorage.setItem(draftKey, JSON.stringify(value)); draftError.value = ""; }
  catch { draftError.value = "Trình duyệt không lưu được bản nhập. Hãy sao chép nội dung trước khi đóng trang."; }
}, { deep: true, flush: "sync" });

const modelKinds = [{ key: "text", label: "văn bản", index: 0 }, { key: "image", label: "ảnh", index: 1 }, { key: "video", label: "video", index: 2 }] as const;
type ModelKind = typeof modelKinds[number]["key"];
const photoGroups = [{ key: "references", label: "Ảnh tham chiếu" }, { key: "products", label: "Ảnh sản phẩm" }] as const;
type PhotoKind = typeof photoGroups[number]["key"];
const textModels = shallowRef<NodeAiModel[]>([]);
const mediaModels = shallowRef<NodeMediaModel[]>([]);
const templates = shallowRef<StudioFlow[]>([]);
const catalogLoading = ref(false);
const catalogError = ref("");
const uploading = ref(false);

const starter = makeStarterFlow("video");
const selectedTemplate = computed(() => run.value?.template ?? templates.value.find(template => template.id === draft.value.templateId) ?? starter);

function modelsFor(kind: ModelKind) {
  if (kind === "text") return textModels.value;
  const configured = mediaModels.value.filter(model => model.configured !== false);
  if (kind === "video") return configured.filter(model => model.type === "video" && videoImageMode(model) && model.referenceLimits?.maxReferences !== 0);
  const input = run.value?.input ?? draft.value;
  const required = input.references.length + input.products.length;
  return configured.filter(model => model.type === "image").sort((left, right) =>
    Number(supportsFlowPhotos(right, required)) - Number(supportsFlowPhotos(left, required))
    || Number(!!right.referenceLimits) - Number(!!left.referenceLimits));
}

const { run, busy, working, loadRun, loadError, saveError, operationError, persist, start, resume, retry, approve, setMode, selectRunModel, pause }
  = useVideoFlowRun(props.directory, modelsFor);
const selectedId = ref("");
const repairPrompt = ref("");
const currentItem = computed(() => run.value?.items.find(item => item.id === selectedId.value) ?? run.value?.items[0]);
watch(currentItem, item => { repairPrompt.value = item?.prompt ?? ""; });
const preparingNew = ref(false);
const reviews = computed(() => run.value?.items.filter(item => item.stages.video.state === "review") ?? []);
const completed = computed(() => run.value?.items.filter(item => item.stages.video.state === "done").length ?? 0);
const failed = computed(() => run.value?.items.filter(item => flowStages.some(stage => isError(item, stage))).length ?? 0);
const percentage = computed(() => run.value ? Math.round(100 * run.value.items.reduce((count, item) =>
  count + flowStages.filter(stage => item.stages[stage].state === "done").length, 0) / (run.value.items.length * flowStages.length)) : 0);
const hasPending = computed(() => !!run.value?.items.some(item => {
  const stage = flowStages.find(step => item.stages[step].state !== "done");
  if (!stage || isError(item, stage)) return false;
  const progress = item.stages[stage];
  return stage !== "video" || run.value!.input.mode === "automatic" || item.approved || !!progress.attempt;
}));

type FlowState = StepProgress["state"];
const stateNames: Record<FlowState, string> = { waiting: "Đang chờ", queued: "Trong hàng chờ", running: "Đang chạy", done: "Hoàn tất", review: "Chờ duyệt", error: "Lỗi", interrupted: "Gián đoạn" };
const stateType = { waiting: "info", queued: "warning", running: "warning", done: "success", review: "warning", error: "danger", interrupted: "danger" } as const;
function stateLabel(state: FlowState) { return !working.value && (state === "running" || state === "queued") ? "Cần tiếp tục" : stateNames[state]; }
function isError(item: FlowItem, stage: FlowStage) { return ["error", "interrupted"].includes(item.stages[stage].state); }
function itemState(item: FlowItem) { return flowStages.map(stage => item.stages[stage].state).find(state => state !== "done") ?? "done"; }

async function loadCatalog() {
  if (catalogLoading.value) return;
  catalogLoading.value = true;
  catalogError.value = "";
  const signals = AbortSignal.any([lifetime.signal, AbortSignal.timeout(15_000)]);
  const [text, media, library] = await Promise.allSettled([
    readNodeModels<NodeAiModel>("language", signals, true),
    readNodeModels<NodeMediaModel>("media", signals, true),
    files.readTextSnapshot(flowLibraryPath, { signal: signals, maxBytes: 4 * 1024 * 1024 })
      .then(saved => parseFlowLibrary(saved.text).filter(isVideoFlowTemplate)),
  ]);
  if (lifetime.signal.aborted) return;
  const issues: string[] = [];
  if (text.status === "fulfilled") textModels.value = text.value.filter(model => model.protocol !== "chrome");
  else issues.push("văn bản");
  if (media.status === "fulfilled") mediaModels.value = media.value.filter(model => model.providerId !== "aiChrome");
  else issues.push("ảnh và video");
  if (library.status === "fulfilled") templates.value = library.value;
  else if (fileErrorCode(library.reason) !== "ENOENT") issues.push("mẫu luồng");
  if (issues.length) catalogError.value = "Chưa tải được cấu hình " + issues.join(", ") + ". Hãy thử làm mới.";
  catalogLoading.value = false;
}

function modelMissing(kind: ModelKind) {
  const key = (run.value?.input ?? draft.value).models[kind];
  return !!key && !modelsFor(kind).some(model => getNodeModelKey(model) === key);
}
function chooseModel(kind: ModelKind, event: Event) {
  const key = (event.target as HTMLSelectElement).value;
  if (run.value) void selectRunModel(kind, key);
  else draft.value.models[kind] = key;
}
function changeMode(event: Event) {
  const mode = (event.target as HTMLSelectElement).value as VideoFlowMode;
  if (run.value) void setMode(mode);
  else draft.value.mode = mode;
}

async function addPhotos(kind: PhotoKind, event: Event) {
  const input = event.target as HTMLInputElement;
  const picked = Array.from(input.files ?? []);
  input.value = "";
  if (!picked.length || uploading.value) return;
  uploading.value = true;
  actionError.value = "";
  try {
    if (draft.value.references.length + draft.value.products.length + picked.length > imageLimit) {
      throw new Error("Chọn tối đa " + imageLimit + " ảnh chung cho một đợt.");
    }
    if (picked.some(file => !Object.hasOwn(imageExtensions, file.type) || !file.size || file.size > imageByteLimit)) {
      throw new Error("Chọn ảnh JPEG, PNG, WebP, GIF hoặc AVIF tối đa 20 MiB mỗi tệp.");
    }
    await files.mkdir("assets", AbortSignal.any([lifetime.signal, AbortSignal.timeout(15_000)])).catch(error => {
      if (fileErrorCode(error) !== "EEXIST") throw error;
    });
    for (const file of picked) {
      lifetime.signal.throwIfAborted();
      const path = "assets/videoFlow" + crypto.randomUUID() + "." + imageExtensions[file.type];
      await files.write(path, file, true, AbortSignal.any([lifetime.signal, AbortSignal.timeout(60_000)]));
      lifetime.signal.throwIfAborted();
      draft.value[kind].push({ name: file.name.slice(0, 300), mimeType: file.type, bytes: file.size, path });
    }
  } catch (error) {
    if (!lifetime.signal.aborted) actionError.value = "Chưa lưu đủ ảnh. " + videoFlowError(error);
  } finally { uploading.value = false; }
}

function removePhoto(kind: PhotoKind, path: string) { draft.value[kind] = draft.value[kind].filter(photo => photo.path !== path); }

async function startBatch() {
  actionError.value = "";
  try {
    const prompts = splitFlowPrompts(draft.value.prompts);
    if (draft.value.templateId && !templates.value.some(template => template.id === draft.value.templateId)) {
      throw new Error("Mẫu đã chọn không còn khả dụng. Hãy chọn lại mẫu trong phần Nâng cao.");
    }
    const template = selectedTemplate.value;
    const missing = modelKinds.find(kind => {
      const key = draft.value.models[kind.key] || template.steps[kind.index]?.model;
      const available = modelsFor(kind.key);
      return key ? !available.some(model => getNodeModelKey(model) === key) : !available.length;
    });
    if (missing) throw new Error("Chưa có mô hình " + missing.label + " phù hợp. Hãy chọn trong phần Nâng cao hoặc cài đặt mô hình.");
    selectedId.value = "";
    await start(makeVideoRun(draft.value, template, prompts));
  } catch (error) { actionError.value = videoFlowError(error); }
}

function retryStage(item: FlowItem, stage: FlowStage) {
  void retry(item, stage, stage === "prepare" ? { prompt: repairPrompt.value.trim() } : undefined);
}
async function replaceTask(item: FlowItem, stage: FlowStage) {
  const accepted = await ElMessageBox.confirm("Hãy kiểm tra mã tác vụ cũ ở nhà cung cấp trước. Nếu tác vụ cũ vẫn chạy, tạo tác vụ mới có thể sinh kết quả trùng hoặc phát sinh phí.",
    "Tạo tác vụ mới?", { confirmButtonText: "Tạo tác vụ mới", cancelButtonText: "Quay lại", type: "warning" }).then(() => true, () => false);
  if (accepted) await retry(item, stage, { newTask: true });
}

async function confirmApproveAll() {
  const accepted = await ElMessageBox.confirm("Tạo video từ " + reviews.value.length + " khung hình đang chờ duyệt?", "Duyệt tất cả",
    { confirmButtonText: "Duyệt và tạo video", cancelButtonText: "Xem lại", type: "warning" }).then(() => true, () => false);
  if (accepted) await approve(reviews.value);
}
async function prepareNext() {
  if (preparingNew.value || !run.value) return;
  preparingNew.value = true;
  try {
    const accepted = await ElMessageBox.confirm("Khi bắt đầu đợt mới, màn hình sẽ hiển thị tiến độ đợt mới. Ảnh và video của đợt này vẫn nằm trong dự án. Bạn có thể tải kịch bản trước khi tiếp tục.",
      "Chuẩn bị đợt mới", { confirmButtonText: "Chuẩn bị đợt mới", cancelButtonText: "Quay lại", type: "warning" }).then(() => true, () => false);
    if (!accepted) return;
    run.value = undefined;
    selectedId.value = "";
    repairPrompt.value = "";
  } finally { preparingNew.value = false; }
}

const previews = reactive({ frame: "", video: "" });
const previewErrors = reactive({ frame: "", video: "" });
for (const key of ["frame", "video"] as const) {
  watch(() => currentItem.value?.[key], (file, _previous, onCleanup) => {
    previews[key] = previewErrors[key] = "";
    if (!file) return;
    const lease = files.acquireUrl(file.path, file.mimeType);
    let active = true;
    onCleanup(() => { active = false; lease.release(); });
    void lease.url.then(url => { if (active) previews[key] = url; },
      () => { if (active) previewErrors[key] = "Không mở được tệp xem trước trong dự án."; });
  }, { immediate: true });
}
function previewUnavailable(kind: "frame" | "video") {
  previews[kind] = "";
  previewErrors[kind] = "Trình duyệt không mở được bản xem trước. Bạn vẫn có thể thử tải tệp kết quả.";
}
const downloading = ref("");
async function downloadResult(kind: string, action: () => Promise<unknown>) {
  if (downloading.value) return;
  downloading.value = kind;
  actionError.value = "";
  try { await action(); }
  catch (error) { actionError.value = "Không tải được kết quả. " + videoFlowError(error); }
  finally { downloading.value = ""; }
}
function downloadScript() {
  const item = currentItem.value;
  if (!item?.script || !run.value) return;
  const name = "kich-ban-" + (run.value.items.indexOf(item) + 1) + ".txt";
  void downloadResult("script", () => saveFile(new Blob([item.script!], { type: "text/plain;charset=utf-8" }), name));
}
function downloadMedia(file: FlowMediaFile) {
  void downloadResult(file.mediaType, () => saveFile(async () => new Blob([await files.read(file.path)], { type: file.mimeType }),
    file.path.split("/").at(-1) ?? "ket-qua"));
}
watch(() => props.catalogRevision, () => void loadCatalog());
onMounted(() => { void loadRun(); void loadCatalog(); });
onScopeDispose(() => lifetime.abort());
</script>

<style scoped>
.flowWorkspace, .flowFields, .advanced, .stageList, .stage { display: grid; min-width: 0; gap: 10px; }
.flowLayout { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); align-items: start; gap: 18px; }
.flowLayout.hasRun { grid-template-columns: minmax(0, 1fr); }
.runItems { min-width: 0; }
h2 { font-size: 16px; margin: 0; }
.flowFields label { font-size: 13px; font-weight: 650; }
.flowFields label small, .hint { color: var(--el-text-color-secondary); font-weight: normal; }
.hint, .error { margin: 0; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
.error { color: var(--el-color-danger); }
.flowFields select { width: 100%; min-width: 0; box-sizing: border-box; padding: 8px; color: var(--el-text-color-primary); background: var(--el-bg-color); border: 1px solid var(--el-border-color); border-radius: 6px; font: inherit; }
.photoGroup { display: grid; gap: 7px; padding: 8px 10px; border: 1px solid var(--el-border-color-light); border-radius: 8px; }
.photoGroup input { max-width: 100%; font: inherit; }
.photoList { margin: 0; padding: 0; list-style: none; }
.photoList li, .stageHeading, .flowActions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.photoList span { overflow-wrap: anywhere; flex: 1; }
.stageHeading { justify-content: space-between; }
.flowActions :deep(.el-button) { margin: 0; }
.advanced { margin: 10px 0 0; padding: 10px; border: 1px solid var(--el-border-color-light); border-radius: 8px; }
summary { cursor: pointer; color: var(--el-text-color-regular); font-size: 13px; }
.itemLayout { display: grid; align-items: start; grid-template-columns: minmax(150px, 1fr) minmax(0, 2.2fr); gap: 16px; }
.itemList { display: grid; max-height: 470px; overflow: auto; gap: 6px; padding: 3px; }
.itemButton { text-align: left; display: grid; justify-items: start; gap: 5px; border-radius: 8px; padding: 8px; color: inherit; background: var(--el-bg-color); border: 1px solid var(--el-border-color-light); cursor: pointer; }
.itemButton strong { width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.itemButton[aria-pressed="true"] { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.stageList { list-style: none; margin: 0; padding: 0; }
.stage { justify-items: start; border: 1px solid var(--el-border-color-light); border-radius: 10px; padding: 11px; }
.stageHeading, .preview, .stage details { width: 100%; }
.contentText { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; max-height: 230px; overflow: auto; font-size: 13px; line-height: 1.5; }
details .contentText { margin-top: 8px; }
.technical code { overflow-wrap: anywhere; }
.preview { background: var(--el-fill-color-light); border-radius: 8px; overflow: hidden; display: grid; place-items: center; }
.preview img, .preview video { display: block; max-width: 100%; max-height: 380px; object-fit: contain; }
.preview p { padding: 10px; }
@media (max-width: 820px) {
  .flowLayout, .itemLayout { grid-template-columns: minmax(0, 1fr); }
  .itemList { max-height: 180px; }
}
</style>
