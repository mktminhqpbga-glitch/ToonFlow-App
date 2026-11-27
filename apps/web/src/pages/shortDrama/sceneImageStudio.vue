<template>
  <section class="imageStudio" aria-labelledby="sceneImagesTitle">
    <header class="studioHeading">
      <div>
        <h2 id="sceneImagesTitle">Tạo ảnh theo cảnh</h2>
        <p>Dùng prompt của từng cảnh và ảnh từ kho phim. Hàng chờ chạy lần lượt, mỗi lần một cảnh.</p>
      </div>
      <el-button :icon="IconPhoto" @click="openReferences()">Kho tham chiếu của phim</el-button>
    </header>

    <div class="studioControls">
      <div class="modelFields">
        <label>
          <span>Mô hình ảnh</span>
          <el-select v-model="selection.model" filterable :loading="modelsLoading" :disabled="configurationLocked" aria-label="Mô hình ảnh" placeholder="Chọn mô hình ảnh">
            <el-option v-if="selection.model && !selectedModel" :value="selection.model" label="Mô hình đã lưu · chưa khả dụng" disabled />
            <el-option v-for="model in models" :key="getNodeModelKey(model)" :label="`${model.label} · ${model.providerLabel}`"
              :value="getNodeModelKey(model)" />
          </el-select>
        </label>
        <label v-if="selectedModel?.imageRatios?.length">
          <span>Tỷ lệ khung hình</span>
          <el-select v-model="selection.ratio" clearable placeholder="Mặc định" :disabled="configurationLocked" aria-label="Tỷ lệ khung hình">
            <el-option v-for="ratio in selectedModel.imageRatios" :key="ratio" :value="ratio" />
          </el-select>
        </label>
        <label v-if="selectedModel?.imageSizes?.length">
          <span>Độ phân giải</span>
          <el-select v-model="selection.size" clearable placeholder="Mặc định" :disabled="configurationLocked" aria-label="Độ phân giải">
            <el-option v-for="size in selectedModel.imageSizes" :key="size" :value="size" />
          </el-select>
        </label>
      </div>
      <div class="buttonRow">
        <el-button type="primary" :icon="IconSparkles" :disabled="!canStart || !scenes.length" @click="startAll">Chạy tất cả ảnh</el-button>
        <el-button v-if="pendingCount && !working" type="primary" plain :disabled="disabled || !!loadError" @click="resume">
          {{ currentStatus?.state === 'interrupted' || run?.active ? 'Kiểm tra và tiếp tục' : 'Tiếp tục hàng chờ' }}
        </el-button>
        <el-button v-if="working && pendingCount" :disabled="pauseRequested" @click="pauseRequested = true">
          {{ pauseRequested ? 'Sẽ dừng sau cảnh này' : 'Dừng sau cảnh này' }}
        </el-button>
        <el-button v-if="pendingCount && !working && !run?.active" text :disabled="disabled || !!loadError" @click="discardWaiting">Bỏ các cảnh đang chờ</el-button>
        <el-button v-if="!working && currentStatus?.canSkip" text type="warning" :disabled="disabled || !!loadError" @click="confirmSkip">Bỏ qua cảnh gián đoạn</el-button>
        <el-button text :loading="modelsLoading" @click="loadModels">Tải lại mô hình</el-button>
      </div>
      <p class="studioStatus" role="status">
        <template v-if="loading">Đang mở tiến độ…</template>
        <template v-else-if="pendingCount">{{ working && run?.queue[0] ? `Đang xử lý ${run.queue[0].title} · ` : '' }}{{ pendingCount }} cảnh trong hàng chờ</template>
        <template v-else>{{ completedCount }} / {{ scenes.length }} cảnh có ảnh</template>
      </p>
      <p v-if="modelError" class="errorText" role="alert">{{ modelError }}</p>
      <el-alert v-if="issue || loadError || referenceError" :title="issue || loadError || referenceError" type="error" :closable="false" showIcon>
        <el-button v-if="!working" size="small" text @click="reload">Tải lại dữ liệu</el-button>
      </el-alert>
    </div>

    <el-empty v-if="!scenes.length" description="Thêm cảnh hoặc chia kịch bản trong mục Phân cảnh để bắt đầu." :imageSize="90" />
    <div v-else class="sceneImageGrid">
      <article v-for="card in cards" :key="card.scene.id" class="sceneImageCard" :aria-label="card.title">
        <header>
          <h3>{{ card.title }}</h3>
          <el-tag :type="card.tag" size="small">{{ card.status }}</el-tag>
        </header>
        <storyboardImagePreview v-if="card.output && visible" :directory="directory" :path="card.output.path"
          :mimeType="card.output.mimeType" :alt="`Ảnh kết quả ${card.title}`" />
        <div v-else class="imagePlaceholder"><icon-photo :size="24" aria-hidden="true" /><span>Ảnh kết quả sẽ hiện ở đây</span></div>

        <div class="cardPrompt">
          <p class="promptText">{{ card.scene.imagePrompt || 'Chưa nhập prompt ảnh' }}</p>
          <el-button size="small" text :disabled="disabled || queuedIds.has(card.scene.id)" @click="editPrompt(card.scene)">Sửa prompt</el-button>
        </div>
        <div v-if="card.references.names.size" class="referenceTags" aria-label="Ảnh tham chiếu của cảnh">
          <el-tag v-for="[key, name] in card.references.names" :key="key" :type="card.references.missing.includes(name) ? 'danger' : 'info'" size="small">{{ name }}</el-tag>
        </div>
        <p v-if="card.message" class="errorText">{{ card.message }}</p>
        <div class="buttonRow">
          <el-button v-if="card.references.missing.length" type="warning" plain @click="openReferences(card.references.missing[0])">Bổ sung ảnh</el-button>
          <el-button type="primary" plain :disabled="!canStart" @click="startOne(card.scene, card.title)">
            {{ card.progress ? 'Chạy lại cảnh' : 'Chạy cảnh này' }}
          </el-button>
          <el-button v-if="card.output" size="small" text @click="downloadImage(card.output, card.title)">Tải ảnh</el-button>
        </div>
      </article>
    </div>

    <el-dialog v-model="promptVisible" title="Sửa prompt ảnh của cảnh" width="min(660px, calc(100vw - 24px))" appendToBody destroyOnClose>
      <div class="dialogFields">
        <p class="hint">Gõ @ để tìm ảnh trong kho phim. Bạn cũng có thể nhập trực tiếp @[Tên ảnh].</p>
        <el-mention v-model="promptDraft" :options="mentionOptions" :filterOption="filterMention" type="textarea"
          :autosize="{ minRows: 5, maxRows: 14 }" :maxlength="imagePromptLimit" showWordLimit aria-label="Prompt ảnh của cảnh" />
        <el-select :modelValue="''" filterable clearable placeholder="Chọn ảnh tham chiếu để chèn vào prompt" aria-label="Chèn ảnh tham chiếu" @change="insertReference">
          <el-option v-for="photo in photos" :key="photo.path" :value="photo.name" :label="photo.name" />
        </el-select>
      </div>
      <template #footer>
        <el-button @click="promptVisible = false">Hủy</el-button>
        <el-button type="primary" :disabled="disabled || promptDraft.length > imagePromptLimit" @click="applyPrompt">Lưu prompt</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="referencesVisible" title="Kho tham chiếu của phim" width="min(840px, calc(100vw - 24px))" appendToBody destroyOnClose>
      <p class="hint">Ảnh trong kho dùng chung cho mọi bảng phân cảnh của dự án phim. Mỗi tên gắn với một ảnh.</p>
      <div class="referenceForm">
        <label class="dialogFields">
          <span>Tên ảnh tham chiếu</span>
          <el-input v-model="referenceName" :maxlength="80" :disabled="referenceBusy" placeholder="Ví dụ: Mai hoặc Quán cà phê" />
        </label>
        <div class="buttonRow">
          <el-button type="primary" :loading="referenceBusy" :disabled="!referenceName.trim() || working" @click="photoInput?.click()">Tải ảnh lên</el-button>
          <el-button v-if="canUseCharacterLibrary" :disabled="!referenceName.trim() || referenceBusy || working" @click="characterVisible = true">Chọn từ Kho nhân vật</el-button>
        </div>
      </div>
      <input ref="photoInput" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Chọn ảnh cho kho phim" hidden @change="uploadPhoto" />
      <p class="hint">{{ referenceIndex.has(referenceKey(referenceName)) ? 'Ảnh bạn thêm sẽ thay ảnh được gọi bởi tên này ở các lượt chạy sau.' : 'PNG, JPG hoặc WebP, tối đa 20 MiB.' }}</p>
      <p v-if="referenceNotice" class="hint" role="status">{{ referenceNotice }}</p>
      <el-alert v-if="referenceError" :title="referenceError" type="error" :closable="false" showIcon />
      <div v-if="photos.length" class="libraryGrid">
        <article v-for="photo in photos" :key="photo.path" class="filmPhoto">
          <storyboardImagePreview v-if="paths.has(photo.path)" :directory="directory" :path="photo.path" :mimeType="photo.mimeType" :alt="photo.name" />
          <p v-else class="errorText">Thiếu tệp ảnh</p>
          <strong>{{ photo.name }}</strong>
          <el-button size="small" text :disabled="referenceBusy || working" @click="referenceName = photo.name">Đổi ảnh</el-button>
        </article>
      </div>
      <el-empty v-else description="Kho phim chưa có ảnh tham chiếu." :imageSize="75" />
    </el-dialog>
    <characterLibrary v-if="characterVisible" v-model="characterVisible" canUse @select="importCharacter" />
  </section>
</template>

<script setup lang="ts">
import axios from "axios";
import { computed, onMounted, onScopeDispose, ref, shallowRef, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { IconPhoto, IconSparkles } from "@tabler/icons-vue";
import { findNodeModel, getNodeModelKey, readNodeModels, type NodeMediaModel } from "@toonflow/nodes-scaffold/nodeAi";
import characterLibrary from "@/components/characterLibrary.vue";
import { currentUser, publicWeb } from "@/stores/multiTenant";
import useWorkspaceFiles, { type TextSnapshot } from "@/lib/workspaceFiles";
import saveFile from "@/lib/saveFile";
import { videoFlowError } from "@/pages/mediaStudio/useVideoFlowRun";
import type { FlowMediaFile } from "@/pages/mediaStudio/videoFlow";
import type { DramaScene } from "./shortDrama";
import { useStoryboardImages } from "./useStoryboardImages";
import storyboardImagePreview from "./storyboardImagePreview.vue";
import {
  filmReferencePath, filmReferenceSchema, imagePromptLimit, listFilmPhotos, maxFilmReferences, promptReferences, readImageDocument,
  referenceAvailability, referenceKey, saveFilmPhoto, writeImageDocument, type FilmReference, type ImageSelection,
} from "./storyboardImages";

const props = defineProps<{ directory: string; boardId: string; scenes: DramaScene[]; visible: boolean; disabled: boolean; saveBoard: () => Promise<boolean> }>();
const emit = defineEmits<{ prompt: [id: string, value: string]; catalog: [names: string[]]; queued: [pending: boolean] }>();
const files = useWorkspaceFiles(props.directory);
const lifetime = new AbortController();
const libraryLimit = 512 * 1024;
const models = shallowRef<NodeMediaModel[]>([]);
const modelsLoading = ref(false);
const modelError = ref("");
const selection = ref<ImageSelection>({ model: "", ratio: "", size: "" });
const selectedModel = computed(() => findNodeModel(models.value, selection.value.model));
const photos = shallowRef<FilmReference[]>([]);
const paths = shallowRef(new Set<string>());
const referenceIndex = computed(() => new Map(photos.value.map(photo => [referenceKey(photo.name), photo])));
const referencesVisible = ref(false);
const characterVisible = ref(false);
const canUseCharacterLibrary = computed(() => !publicWeb.value && currentUser.value?.role !== "user");
const photoInput = ref<HTMLInputElement>();
const referenceName = ref("");
const referenceError = ref("");
const referenceNotice = ref("");
const referenceBusy = ref(false);
let librarySnapshot: TextSnapshot | undefined;
let referenceLoad: Promise<void> | undefined;

async function refreshReferences() {
  if (!referenceLoad) {
    referenceLoad = (async () => {
      const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(12000)]);
      const [saved, listed] = await Promise.all([readImageDocument(files, filmReferencePath, libraryLimit, signal), listFilmPhotos(files, signal)]);
      const catalog = saved ? filmReferenceSchema.parse(JSON.parse(saved.text)).photos : [];
      lifetime.signal.throwIfAborted();
      const sorted = catalog.sort((a, b) => a.name.localeCompare(b.name, "vi"));
      librarySnapshot = saved;
      photos.value = sorted;
      paths.value = listed;
      emit("catalog", sorted.filter(photo => listed.has(photo.path)).map(photo => photo.name));
    })().finally(() => { referenceLoad = undefined; });
  }
  return referenceLoad;
}

async function showReferences() {
  referenceError.value = "";
  try { await refreshReferences(); }
  catch (error) { if (!lifetime.signal.aborted) referenceError.value = `Chưa mở được kho phim. ${videoFlowError(error)}`; }
}

const { run, loading, loadError, issue, working, pauseRequested, load, start, resume, skipInterrupted, discardWaiting } = useStoryboardImages(
  props.directory, props.boardId, {
    models: () => models.value, references: () => referenceIndex.value, refreshReferences, updateFiles: available => { paths.value = available; },
  },
);
const pendingCount = computed(() => run.value?.queue.length ?? 0);
const queuedIds = computed(() => new Set(run.value?.queue.map(scene => scene.id)));
const currentStatus = computed(() => run.value?.progress[run.value.queue[0]?.id ?? ""]);
const configurationLocked = computed(() => working.value || pendingCount.value > 0);
const canStart = computed(() => !props.disabled && !configurationLocked.value && !loading.value && !loadError.value
  && !modelsLoading.value && !referenceBusy.value && !!selectedModel.value && selectedModel.value.configured !== false);
const completedCount = computed(() => props.scenes.filter(scene => run.value?.progress[scene.id]?.output).length);
const statusText = { queued: "Đang chờ", running: "Đang tạo ảnh", interrupted: "Gián đoạn", blocked: "Cần bổ sung", error: "Tạo ảnh lỗi", done: "Hoàn thành" };
const statusTag = { queued: "info", running: "warning", interrupted: "warning", blocked: "warning", error: "danger", done: "success" } as const;
const cards = computed(() => props.scenes.map((scene, index) => {
  const progress = run.value?.progress[scene.id];
  const refs = referenceAvailability(scene.imagePrompt, referenceIndex.value, paths.value);
  const current = run.value?.queue[0]?.id === scene.id && !!run.value.active;
  const state = current && !working.value && progress?.state !== "interrupted" ? "interrupted" : progress?.state;
  const missing = refs.missing.length ? `Thiếu ảnh tham chiếu ${refs.missing.map(name => `“${name}”`).join(", ")}.` : "";
  const repaired = !refs.invalid && !missing && progress?.state === "blocked" && progress.message?.startsWith("Thiếu ảnh tham chiếu");
  return {
    scene, progress, references: refs, output: progress?.output, title: `Cảnh ${index + 1} · ${scene.title.trim() || "Chưa đặt tên"}`,
    message: current ? progress?.message : missing || (repaired ? "Đã đủ ảnh tham chiếu. Bấm Chạy lại cảnh." : progress?.message) || (refs.invalid ? "Sửa cách gọi ảnh thành @[Tên ảnh]." : ""),
    status: !current && missing && !working.value ? "Thiếu tham chiếu" : repaired ? "Sẵn sàng chạy lại" : state ? statusText[state] : "Chưa chạy",
    tag: !current && missing ? "danger" as const : state ? statusTag[state] : "info" as const,
  };
}));

async function loadModels() {
  if (modelsLoading.value) return;
  modelsLoading.value = true;
  modelError.value = "";
  try {
    models.value = (await readNodeModels<NodeMediaModel>("media", AbortSignal.any([lifetime.signal, AbortSignal.timeout(15000)]), true))
      .filter(model => model.type === "image" && model.configured !== false)
      .sort((a, b) => Number(!!b.referenceLimits?.maxReferences) - Number(!!a.referenceLimits?.maxReferences));
    if (!models.value.length) modelError.value = "Chưa có mô hình ảnh sẵn sàng. Hãy kiểm tra Cài đặt MacFlow.";
    if (!selection.value.model && models.value[0]) selection.value.model = getNodeModelKey(models.value[0]);
  } catch {
    if (!lifetime.signal.aborted) modelError.value = "Chưa tải được mô hình ảnh. Hãy kiểm tra kết nối rồi thử lại.";
  } finally { modelsLoading.value = false; }
}

async function reload() {
  if (working.value) return;
  await Promise.all([load(), showReferences()]);
  if (run.value) selection.value = { ...run.value.selection };
}

function openReferences(missing = "") {
  referenceName.value = missing;
  referenceNotice.value = "";
  referencesVisible.value = true;
  void showReferences();
}

async function storePhoto(read: () => Promise<Blob>) {
  if (!referenceName.value.trim() || referenceBusy.value || working.value) return;
  referenceBusy.value = true;
  referenceNotice.value = referenceError.value = "";
  const name = referenceName.value;
  try {
    await refreshReferences();
    if (!referenceIndex.value.has(referenceKey(name)) && photos.value.length >= maxFilmReferences) throw new Error("Kho phim đã có tối đa 500 ảnh.");
    const photo = await saveFilmPhoto(files, name, await read());
    const next = [...photos.value.filter(item => referenceKey(item.name) !== referenceKey(photo.name)), photo];
    librarySnapshot = await writeImageDocument(files, filmReferencePath, { version: 1, photos: next }, libraryLimit, librarySnapshot);
    await refreshReferences();
    referenceNotice.value = `Đã lưu ảnh “${photo.name}” vào kho phim.`;
  } catch (error) {
    if (!lifetime.signal.aborted) referenceError.value = `Chưa lưu được ảnh. ${videoFlowError(error)}`;
  } finally { referenceBusy.value = false; }
}

function uploadPhoto(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file) void storePhoto(async () => file);
}

function importCharacter(asset: { path: string }) {
  characterVisible.value = false;
  void storePhoto(async () => (await axios.get<Blob>("/api/assets/read", {
    params: { path: asset.path }, responseType: "blob", signal: lifetime.signal, timeout: 60000,
  })).data);
}

const promptVisible = ref(false);
const editingId = ref("");
const promptDraft = ref("");
const mentionOptions = computed(() => photos.value.map(photo => ({ value: `[${photo.name}]`, label: photo.name })));
function filterMention(pattern: string, option: { value: string | number; label?: string }) {
  return referenceKey(option.label || String(option.value)).includes(referenceKey(pattern.replace(/^\[/, "")));
}
function editPrompt(scene: DramaScene) {
  editingId.value = scene.id;
  promptDraft.value = scene.imagePrompt;
  promptVisible.value = true;
}
function insertReference(name?: string) {
  if (!name || promptReferences(promptDraft.value).names.has(referenceKey(name))) return;
  const input = `${promptDraft.value.trimEnd()} @[${name}]`.trimStart();
  if (input.length <= imagePromptLimit) promptDraft.value = input;
  else ElMessage.warning("Prompt đã đạt giới hạn ký tự.");
}
function applyPrompt() {
  if (!props.disabled && !queuedIds.value.has(editingId.value) && props.scenes.some(scene => scene.id === editingId.value)) {
    emit("prompt", editingId.value, promptDraft.value);
    promptVisible.value = false;
  }
}

function startOne(scene: DramaScene, title: string) {
  if (!canStart.value) return;
  return start([{ id: scene.id, title, prompt: scene.imagePrompt }], { ...selection.value }, props.scenes.map(item => item.id), props.saveBoard);
}

async function startAll() {
  if (!canStart.value || !props.scenes.length) return;
  const plan = props.scenes.map((scene, index) => ({ id: scene.id, title: `Cảnh ${index + 1} · ${scene.title.trim() || "Chưa đặt tên"}`, prompt: scene.imagePrompt }));
  const accepted = await ElMessageBox.confirm(
    `MacFlow sẽ lần lượt tạo ảnh mới cho ${plan.length} cảnh. Cảnh thiếu dữ liệu sẽ báo lỗi riêng. Chi phí tùy mô hình ảnh đã chọn.`,
    "Chạy tất cả ảnh?", { confirmButtonText: "Chạy tất cả ảnh", cancelButtonText: "Quay lại" },
  ).then(() => true, () => false);
  if (!accepted || !canStart.value) return;
  await start(plan, { ...selection.value }, props.scenes.map(scene => scene.id), props.saveBoard);
}

async function confirmSkip() {
  const accepted = await ElMessageBox.confirm("Nhà cung cấp có thể vẫn đang xử lý cảnh này. MacFlow sẽ bỏ qua trạng thái của lần gửi hiện tại.",
    "Bỏ qua cảnh gián đoạn?", { confirmButtonText: "Bỏ qua", cancelButtonText: "Quay lại" }).then(() => true, () => false);
  if (accepted) await skipInterrupted();
}

async function downloadImage(output: FlowMediaFile, title: string) {
  try {
    const extension = output.path.split(".").at(-1);
    const name = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").slice(0, 80);
    await saveFile(() => files.read(output.path).then(bytes => new Blob([bytes], { type: output.mimeType })), `${name}.${extension}`);
  } catch { ElMessage.error("Chưa tải được ảnh. Hãy kiểm tra tệp trong dự án."); }
}

watch(() => selection.value.model, () => {
  if (selection.value.ratio && !selectedModel.value?.imageRatios?.includes(selection.value.ratio) && selectedModel.value) selection.value.ratio = "";
  if (selection.value.size && !selectedModel.value?.imageSizes?.includes(selection.value.size) && selectedModel.value) selection.value.size = "";
});
watch(() => props.visible, visible => { if (visible && !models.value.length) void loadModels(); }, { immediate: true });
watch(pendingCount, count => emit("queued", count > 0), { immediate: true });
onMounted(() => void reload());
onScopeDispose(() => lifetime.abort());
</script>

<style scoped>
.imageStudio, .studioControls { display: grid; gap: 16px; max-width: 1500px; margin-inline: auto; }
.studioHeading { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.studioHeading h2, .studioHeading p, .studioStatus, .hint, .errorText { margin: 0; }
.studioHeading h2 { font-size: 21px; }
.studioHeading p, .studioStatus, .hint { color: var(--el-text-color-regular); font-size: 13px; line-height: 1.55; }
.studioHeading p { margin-top: 4px; }
.studioControls, .sceneImageCard { padding: 15px; border: 1px solid var(--el-border-color-light); border-radius: 12px; background: var(--el-bg-color); }
.modelFields, .referenceForm { display: flex; flex-wrap: wrap; align-items: end; gap: 10px; }
.modelFields label { display: grid; gap: 6px; min-width: 145px; max-width: 330px; flex: 1; font-size: 13px; }
.modelFields label:first-child { min-width: min(230px, 100%); }
.buttonRow, .referenceTags { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.buttonRow :deep(.el-button + .el-button) { margin-left: 0; }
.sceneImageGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr)); gap: 12px; }
.sceneImageCard { min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.sceneImageCard header { display: flex; align-items: start; justify-content: space-between; gap: 6px; }
.sceneImageCard header h3 { min-width: 0; margin: 0; font-size: 15px; overflow-wrap: anywhere; }
.sceneImageCard > .buttonRow { margin-top: auto; }
.imagePlaceholder { display: grid; place-content: center; justify-items: center; gap: 5px; min-height: 90px; border-radius: 8px; color: var(--el-text-color-regular); background: var(--el-fill-color-light); font-size: 13px; }
.cardPrompt { display: flex; align-items: start; gap: 5px; justify-content: space-between; }
.promptText { display: -webkit-box; min-width: 0; margin: 0; overflow: hidden; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow-wrap: anywhere; font-size: 14px; }
.errorText { color: var(--el-color-danger); font-size: 13px; line-height: 1.5; }
.dialogFields { display: grid; gap: 7px; }
.referenceForm { margin: 12px 0 8px; }
.referenceForm label { flex: 1 1 220px; }
.libraryGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(138px, 1fr)); gap: 10px; margin-top: 12px; max-height: 42dvh; overflow: auto; }
.filmPhoto { display: grid; gap: 6px; padding: 8px; border: 1px solid var(--el-border-color-light); border-radius: 8px; overflow-wrap: anywhere; }
.filmPhoto :deep(button) { justify-self: start; }
</style>
