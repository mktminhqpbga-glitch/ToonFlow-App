<template>
  <div class="dramaPage">
    <aside class="navRail">
      <div class="brand"><img :src="logoUrl" alt="" /><strong>MacFlow</strong></div>
      <nav aria-label="Các trang sáng tạo">
        <router-link to="/home" aria-label="Tổng quan"><icon-home :size="18" /> <span>Tổng quan</span></router-link>
        <router-link to="/workspace" aria-label="Canvas"><icon-layout-dashboard :size="18" /> <span>Canvas</span></router-link>
        <router-link to="/image" aria-label="Xưởng tạo ảnh"><icon-photo :size="18" /> <span>Xưởng tạo ảnh</span></router-link>
        <router-link to="/video" aria-label="Xưởng tạo video"><icon-video :size="18" /> <span>Xưởng tạo video</span></router-link>
        <router-link to="/shortDrama" aria-label="Phim ngắn"><icon-movie :size="18" /> <span>Phim ngắn</span></router-link>
      </nav>
    </aside>
    <main class="dramaMain">
      <header class="pageHeader">
        <div>
          <h1>Phim ngắn</h1>
          <p v-if="workspaceStore.project">{{ workspaceStore.project.name }}</p>
        </div>
        <div v-if="directory" class="buttonRow">
          <el-button :icon="IconFileImport" :disabled="busy || !ready" @click="importVisible = true">Nhập từ Huobao</el-button>
          <el-button type="primary" :icon="IconDeviceFloppy" :loading="action === 'save'" :disabled="busy || !ready || !dirty" @click="saveBoard">Lưu dự án</el-button>
        </div>
      </header>

      <el-alert v-if="!directory" title="Mở một dự án để bắt đầu" type="warning" :closable="false" showIcon>
        <router-link to="/home">Chọn dự án ở Tổng quan</router-link>
      </el-alert>
      <p v-else-if="loading" role="status">Đang mở bảng phân cảnh…</p>
      <el-alert v-else-if="loadError" :title="loadError" type="error" :closable="false" showIcon>
        <el-button size="small" @click="loadBoard">Tải lại</el-button>
      </el-alert>

      <template v-else-if="ready">
        <el-alert v-if="message" class="notice" :title="message.text" :type="message.type" :closable="false" showIcon>
          <el-button v-if="draftConflict" size="small" :disabled="busy" @click="openSavedBoard">Mở bản đã lưu trong dự án</el-button>
        </el-alert>
        <div class="workArea">
          <el-card class="scriptCard" shadow="never">
            <template #header><h2><icon-file-text :size="20" /> Kịch bản</h2></template>
            <div class="formFields">
              <label class="dramaField"><span>Tên phim hoặc tập</span>
                <el-input v-model="board.title" :maxlength="200" :disabled="busy" placeholder="Ví dụ: Một ngày ở Đà Lạt" @input="markDirty" />
              </label>
              <label class="dramaField"><span>Nội dung kịch bản</span>
                <el-input v-model="board.script" type="textarea" :rows="12" :maxlength="scriptLimit" :disabled="busy"
                  placeholder="Dán kịch bản hoặc viết ý tưởng và lời thoại tại đây…" @input="markDirty" />
              </label>
              <label class="dramaField"><span>Mô hình văn bản</span>
                <el-select v-model="modelChoice" filterable :disabled="busy" :loading="modelsLoading" placeholder="Chọn mô hình từ Cài đặt">
                  <el-option v-if="board.model && !selectedModel" :value="board.model" label="Mô hình đã lưu · chưa khả dụng" disabled />
                  <el-option v-for="model in models" :key="getNodeModelKey(model)" :value="getNodeModelKey(model)" :label="`${model.label} · ${model.providerLabel}`" />
                </el-select>
              </label>
              <small v-if="modelError" class="muted">{{ modelError }}</small>
              <small v-else-if="board.model && !selectedModel && !modelsLoading" class="muted">Hãy chọn lại mô hình văn bản.</small>
              <div class="buttonRow">
                <el-button type="primary" :icon="IconSparkles" :loading="action === 'split'" :disabled="busy || !selectedModel || !board.script.trim()" @click="splitScript">AI chia phân cảnh</el-button>
                <el-button v-if="generation" @click="generation.abort()">Dừng</el-button>
                <el-button v-else :disabled="modelsLoading || busy" @click="loadModels">Tải lại mô hình</el-button>
              </div>
            </div>
          </el-card>

          <el-card class="sceneCard" shadow="never">
            <template #header>
              <div class="sceneHeader">
                <h2><icon-movie :size="20" /> Phân cảnh <span class="sceneCount">{{ board.scenes.length }}</span></h2>
                <el-button :icon="IconPlus" :disabled="busy || board.scenes.length >= sceneLimit" @click="addScene">Thêm cảnh</el-button>
              </div>
            </template>
            <div v-if="activeScene" class="sceneBody">
              <nav class="sceneTimeline" aria-label="Thứ tự phân cảnh">
                <button v-for="(scene, index) in board.scenes" :key="scene.id" type="button" class="sceneTab"
                  :class="{ active: scene.id === activeScene.id }" :aria-pressed="scene.id === activeScene.id" :disabled="busy" @click="activeId = scene.id">
                  <span class="sceneIndex">{{ index + 1 }}</span><span class="sceneTitle">{{ scene.title || `Cảnh ${index + 1}` }}</span>
                </button>
              </nav>
              <section class="formFields sceneEditor" aria-label="Chỉnh phân cảnh">
                <div class="sceneDetails">
                  <label class="dramaField"><span>Tên cảnh</span><el-input v-model="activeScene.title" :maxlength="200" :disabled="busy" @input="markDirty" /></label>
                  <label class="dramaField"><span>Thời lượng (giây)</span><el-input-number v-model="activeScene.duration" :min="0" :max="3600" :disabled="busy" @change="updateDuration" /></label>
                </div>
                <label class="dramaField"><span>Mô tả cảnh và góc máy</span><el-input v-model="activeScene.description" type="textarea" :rows="3" :maxlength="10000" :disabled="busy" @input="markDirty" /></label>
                <label class="dramaField"><span>Lời thoại</span><el-input v-model="activeScene.dialogue" type="textarea" :rows="2" :maxlength="10000" :disabled="busy" @input="markDirty" /></label>
                <div class="promptGrid">
                  <div class="promptPanel">
                    <label class="dramaField"><span>Prompt ảnh</span><el-input v-model="activeScene.imagePrompt" type="textarea" :rows="3" :maxlength="10000" :disabled="busy" @input="markDirty" /></label>
                    <el-button plain :icon="IconPhoto" :disabled="busy || !activeScene.imagePrompt.trim()" @click="openStudio('image')">Đưa sang Xưởng ảnh</el-button>
                  </div>
                  <div class="promptPanel">
                    <label class="dramaField"><span>Prompt video</span><el-input v-model="activeScene.videoPrompt" type="textarea" :rows="3" :maxlength="10000" :disabled="busy" @input="markDirty" /></label>
                    <el-button plain :icon="IconVideo" :disabled="busy || !activeScene.videoPrompt.trim()" @click="openStudio('video')">Đưa sang Xưởng video</el-button>
                  </div>
                </div>
                <div class="buttonRow sceneActions">
                  <el-button :icon="IconLanguage" :loading="action === 'translate'" :disabled="busy || !selectedModel" @click="translateScene">Việt hóa cảnh</el-button>
                  <el-button :icon="IconArrowLeft" aria-label="Đưa cảnh lên trước" title="Đưa cảnh lên trước" :disabled="busy || activeIndex < 1" @click="moveScene(-1)" />
                  <el-button :icon="IconArrowRight" aria-label="Đưa cảnh xuống sau" title="Đưa cảnh xuống sau" :disabled="busy || activeIndex === board.scenes.length - 1" @click="moveScene(1)" />
                  <el-button text type="danger" :disabled="busy" @click="removeScene">Bỏ cảnh</el-button>
                </div>
              </section>
            </div>
            <el-empty v-else description="Thêm cảnh, chia từ kịch bản hoặc nhập phân cảnh Huobao." :imageSize="105" />
          </el-card>
        </div>
        <footer class="outputBar">
          <span class="muted" role="status">{{ dirty ? (draftStored ? "Đã lưu nháp trên máy" : "Có thay đổi chưa lưu") : "Bảng phân cảnh trong dự án" }}</span>
          <div class="buttonRow">
            <el-button :icon="IconDownload" :disabled="busy || !hasContent" @click="downloadBoard">Tải Markdown</el-button>
            <el-button type="primary" plain :icon="IconLayoutDashboard" :disabled="busy || !hasContent" @click="sendToCanvas">Đưa vào Canvas</el-button>
          </div>
        </footer>
      </template>
    </main>

    <el-dialog v-model="importVisible" title="Nhập phân cảnh từ Huobao" width="min(480px, calc(100vw - 24px))" appendToBody>
      <div class="formFields">
        <p class="importHint">Mở JSON của tập trong Huobao, rồi chọn tệp đã lưu hoặc dán nội dung.</p>
        <label class="dramaField"><span>Địa chỉ Huobao</span><el-input v-model="huobaoAddress" placeholder="http://localhost:5679" /></label>
        <label class="dramaField"><span>ID tập</span><el-input v-model="huobaoEpisode" inputmode="numeric" placeholder="Ví dụ: 3" /></label>
        <div class="buttonRow">
          <el-button :disabled="!huobaoEpisode.trim()" @click="openHuobaoJson">Mở JSON của tập</el-button>
          <el-button type="primary" :loading="action === 'import'" :disabled="busy" @click="fileInput?.click()">Chọn tệp JSON</el-button>
        </div>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="importFile" />
        <details>
          <summary>Dán JSON</summary>
          <el-input v-model="pastedJson" type="textarea" :rows="4" :disabled="busy" aria-label="Nội dung JSON từ Huobao" />
          <el-button class="pasteAction" :disabled="busy || !pastedJson.trim()" @click="importJson(() => pastedJson)">Nhập nội dung đã dán</el-button>
        </details>
        <el-alert v-if="importError" :title="importError" type="error" :closable="false" showIcon />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import axios from "axios";
import { ElMessageBox } from "element-plus";
import { IconArrowLeft, IconArrowRight, IconDeviceFloppy, IconDownload, IconFileImport, IconLanguage, IconLayoutDashboard, IconPhoto, IconPlus, IconSparkles, IconVideo } from "@tabler/icons-vue";
import { computed, onMounted, onScopeDispose, ref, shallowRef, watch } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { getNodeModelIdentity, getNodeModelKey, useNodeAi, type NodeAiModel } from "@toonflow/nodes-scaffold/nodeAi";
import logoUrl from "@toonflow/assets/logo.svg";
import { queueStudioMediaForCanvas } from "@/lib/mediaStudioTransfer";
import { queueStudioPrompt } from "@/lib/studioPromptTransfer";
import saveFile from "@/lib/saveFile";
import useWorkspaceFiles, { type TextSnapshot } from "@/lib/workspaceFiles";
import { useWorkspaceStore } from "@/stores/workspace";
import { currentUser } from "@/stores/multiTenant";
import { dramaPath, emptyBoard, huobaoStoryboardUrl, importByteLimit, importHuobaoScenes, newScene, readDramaBoard,
  readGeneratedScenes, readTranslatedScene, sceneLimit, scriptLimit, splitSystemPrompt, storyboardMarkdown, translateSystemPrompt, type DramaScene } from "./shortDrama";

const workspaceStore = useWorkspaceStore();
const router = useRouter();
const ai = useNodeAi();
const directory = computed(() => workspaceStore.project?.directory ?? "");
const board = ref(emptyBoard());
const loadedDirectory = ref("");
const ready = computed(() => !!directory.value && loadedDirectory.value === directory.value);
let snapshot: TextSnapshot | undefined;
let loadVersion = 0;
const dirty = ref(false);
const loading = ref(false);
const loadError = ref("");
const message = ref<{ type: "success" | "error" | "info"; text: string }>();
const action = ref<"save" | "import" | "split" | "translate" | "download">();
const busy = computed(() => loading.value || !!action.value);
const generation = shallowRef<AbortController>();
const models = shallowRef<NodeAiModel[]>([]);
const modelsLoading = ref(false);
const modelError = ref("");
const importVisible = ref(false);
const importError = ref("");
const huobaoAddress = ref("http://localhost:5679");
const huobaoEpisode = ref("");
const pastedJson = ref("");
const fileInput = ref<HTMLInputElement>();
const activeId = ref("");
const activeIndex = computed(() => board.value.scenes.findIndex(scene => scene.id === activeId.value));
const activeScene = computed(() => board.value.scenes[activeIndex.value]);
const hasContent = computed(() => !!board.value.script.trim() || board.value.scenes.length > 0);
const modelChoice = computed({
  get: () => board.value.model || (models.value[0] ? getNodeModelKey(models.value[0]) : ""),
  set: value => { board.value.model = value; markDirty(); },
});
const selectedModel = computed(() => models.value.find(model => getNodeModelKey(model) === modelChoice.value));

function errorText(error: unknown) {
  return axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || error.message
    : error instanceof SyntaxError ? "JSON không hợp lệ. Hãy mở và lưu lại phản hồi đầy đủ." : error instanceof Error ? error.message : "Không thể hoàn tất thao tác.";
}
function errorCode(error: unknown) {
  return axios.isAxiosError<{ data?: { code?: string } }>(error) ? error.response?.data?.data?.code : undefined;
}
const draftKey = (target: string) => "macflow.storyboard.draft:" + JSON.stringify([currentUser.value?.id ?? "standalone", target]);
const draftStored = ref(false);
const draftConflict = ref(false);
let draftBase = "";
function markDirty() {
  dirty.value = true;
  try {
    localStorage.setItem(draftKey(directory.value), JSON.stringify({
      revision: draftConflict.value ? draftBase : snapshot?.revision ?? "", text: JSON.stringify(board.value), activeId: activeId.value,
    }));
    draftStored.value = true;
  } catch { draftStored.value = false; }
}

function restoreDraft(target: string) {
  try {
    const entry = JSON.parse(localStorage.getItem(draftKey(target)) ?? "null") as { revision: string; text: string; activeId?: string } | null;
    if (!entry || typeof entry.text !== "string") return;
    const recovered = readDramaBoard(entry.text);
    if (JSON.stringify(recovered) === JSON.stringify(board.value)) return;
    draftBase = typeof entry.revision === "string" ? entry.revision : "";
    draftConflict.value = draftBase !== (snapshot?.revision ?? "");
    board.value = recovered;
    activeId.value = recovered.scenes.find(scene => scene.id === entry.activeId)?.id ?? recovered.scenes[0]?.id ?? "";
    dirty.value = draftStored.value = true;
    if (draftConflict.value) message.value = { type: "info", text: "Dự án đã đổi ở cửa sổ khác. Bạn có thể tải bản nháp này để giữ nội dung." };
  } catch { /* Nội dung dự án vẫn mở được nếu bản nháp cũ hỏng. */ }
}

async function loadBoard() {
  const target = directory.value;
  const version = ++loadVersion;
  generation.value?.abort();
  loadedDirectory.value = "";
  snapshot = undefined;
  message.value = undefined;
  loadError.value = "";
  loading.value = !!target;
  dirty.value = draftStored.value = draftConflict.value = false;
  board.value = emptyBoard();
  activeId.value = "";
  if (!target) return;
  try {
    const saved = await useWorkspaceFiles(target).readTextSnapshot(dramaPath, { maxBytes: importByteLimit });
    if (version !== loadVersion) return;
    board.value = readDramaBoard(saved.text);
    snapshot = saved;
    activeId.value = board.value.scenes[0]?.id ?? "";
    loadedDirectory.value = target;
    restoreDraft(target);
  } catch (error) {
    if (version !== loadVersion) return;
    if (errorCode(error) === "ENOENT") { loadedDirectory.value = target; restoreDraft(target); }
    else loadError.value = `Không mở được bảng phân cảnh. ${errorText(error)}`;
  } finally {
    if (version === loadVersion) loading.value = false;
  }
}

async function openSavedBoard() {
  const target = directory.value;
  const accepted = await ElMessageBox.confirm("Bạn có thể tải bản nháp trước để giữ nội dung. Mở bản đã lưu sẽ bỏ bản nháp đang sửa trên máy này.",
    "Mở bản đã lưu?", { confirmButtonText: "Mở bản đã lưu", cancelButtonText: "Giữ bản nháp" }).then(() => true, () => false);
  if (!accepted || target !== directory.value) return;
  try { localStorage.removeItem(draftKey(target)); }
  catch { return; }
  await loadBoard();
}

async function saveBoard() {
  if (!ready.value || busy.value) return false;
  if (draftConflict.value) {
    message.value = { type: "error", text: "Dự án đã đổi ở cửa sổ khác. Hãy tải bản nháp đang mở để giữ nội dung của bạn." };
    return false;
  }
  if (!dirty.value) return true;
  const target = directory.value;
  const version = loadVersion;
  action.value = "save";
  try {
    const files = useWorkspaceFiles(target);
    const text = JSON.stringify(board.value, null, 2);
    if (new Blob([text]).size > importByteLimit) throw new Error("Bảng phân cảnh vượt 4 MiB. Hãy rút gọn một số cảnh rồi lưu lại.");
    readDramaBoard(text);
    let saved: TextSnapshot;
    if (snapshot) saved = { ...snapshot, text, revision: await files.writeTextSnapshot(dramaPath, text, snapshot) };
    else {
      await files.write(dramaPath, text, true);
      saved = await files.readTextSnapshot(dramaPath, { maxBytes: importByteLimit });
      if (saved.text !== text) throw new Error("Bảng phân cảnh đã thay đổi trong lúc lưu. Hãy giữ bản đang chỉnh trước khi mở lại trang.");
    }
    if (version !== loadVersion) return false;
    snapshot = saved;
    dirty.value = draftStored.value = false;
    try {
      const key = draftKey(target);
      const draft = JSON.parse(localStorage.getItem(key) ?? "null");
      if (draft?.text === JSON.stringify(board.value)) localStorage.removeItem(key);
    } catch { /* Đã lưu thành công vào dự án. */ }
    message.value = { type: "success", text: "Đã lưu bảng phân cảnh trong dự án." };
    return true;
  } catch (error) {
    if (version === loadVersion) message.value = { type: "error", text: ["ESTALE", "EEXIST"].includes(errorCode(error) ?? "")
      ? "Bảng phân cảnh đã thay đổi ở cửa sổ khác. Bạn có thể tải Markdown để giữ bản đang chỉnh trước khi mở lại trang."
      : `Chưa lưu được bảng phân cảnh. ${errorText(error)}` };
    return false;
  } finally { action.value = undefined; }
}

async function loadModels() {
  modelsLoading.value = true;
  modelError.value = "";
  try {
    models.value = (await ai.getModels(undefined, true)).filter(model => model.protocol !== "chrome");
    if (!models.value.length) modelError.value = "Hãy thêm mô hình văn bản dùng API trong Cài đặt MacFlow.";
  } catch (error) { modelError.value = errorText(error); }
  finally { modelsLoading.value = false; }
}

async function confirmReplace() {
  if (!board.value.scenes.length) return true;
  return ElMessageBox.confirm("Thao tác này thay danh sách cảnh đang chỉnh. Bạn có thể tải Markdown để giữ một bản trước.", "Thay phân cảnh hiện tại?",
    { type: "warning", confirmButtonText: "Thay phân cảnh", cancelButtonText: "Giữ lại" }).then(() => true, () => false);
}

function replaceScenes(scenes: DramaScene[]) {
  board.value.scenes = scenes;
  activeId.value = scenes[0]?.id ?? "";
  markDirty();
}

function openHuobaoJson() {
  importError.value = "";
  try { window.open(huobaoStoryboardUrl(huobaoAddress.value, huobaoEpisode.value), "_blank", "noopener,noreferrer"); }
  catch { importError.value = "Nhập địa chỉ HTTP(S) của Huobao và ID tập hợp lệ."; }
}

function importFile(event: Event) {
  const control = event.target as HTMLInputElement;
  const file = control.files?.[0];
  control.value = "";
  if (file) void importJson(() => {
    if (file.size > importByteLimit) throw new Error("Tệp JSON vượt 4 MiB. Hãy nhập từng tập.");
    return file.text();
  });
}

async function importJson(read: () => string | Promise<string>) {
  if (!ready.value || busy.value) return;
  action.value = "import";
  const version = loadVersion;
  importError.value = "";
  try {
    const text = await read();
    if (new Blob([text]).size > importByteLimit) throw new Error("Dữ liệu JSON vượt 4 MiB. Hãy nhập từng tập.");
    const scenes = importHuobaoScenes(text);
    if (version !== loadVersion || !(await confirmReplace()) || version !== loadVersion) return;
    replaceScenes(scenes);
    pastedJson.value = "";
    importVisible.value = false;
    message.value = { type: "success", text: `Đã nhập ${scenes.length} cảnh từ Huobao.` };
  } catch (error) { if (version === loadVersion) importError.value = errorText(error); }
  finally { action.value = undefined; }
}

async function runModel(kind: "split" | "translate", prompt: string, accept: (text: string) => void) {
  const model = selectedModel.value;
  if (!model || !ready.value || busy.value) return;
  const owner = new AbortController();
  const version = loadVersion;
  generation.value = owner;
  action.value = kind;
  message.value = undefined;
  try {
    const answer = await ai.generate({ ...getNodeModelIdentity(model), directory: directory.value, prompt,
      systemPrompt: kind === "split" ? splitSystemPrompt : translateSystemPrompt, signal: AbortSignal.any([owner.signal, AbortSignal.timeout(120000)]) });
    owner.signal.throwIfAborted();
    if (version === loadVersion) accept(answer.text);
  } catch (error) {
    if (version === loadVersion) message.value = owner.signal.aborted ? { type: "info", text: "Đã dừng yêu cầu." }
      : { type: "error", text: errorText(error) };
  } finally { generation.value = undefined; action.value = undefined; }
}

async function splitScript() {
  const script = board.value.script.trim();
  const version = loadVersion;
  if (!script || busy.value || !(await confirmReplace()) || version !== loadVersion) return;
  await runModel("split", script, text => {
    const scenes = readGeneratedScenes(text);
    replaceScenes(scenes);
    message.value = { type: "success", text: `Đã chia ${scenes.length} cảnh. Bạn có thể sửa từng cảnh trước khi tạo media.` };
  });
}

function translateScene() {
  const scene = activeScene.value;
  if (!scene) return;
  void runModel("translate", JSON.stringify(scene), text => {
    board.value.scenes[activeIndex.value] = readTranslatedScene(text, scene);
    markDirty();
    message.value = { type: "success", text: "Đã Việt hóa cảnh đang chọn." };
  });
}

function addScene() {
  const scene = newScene(`Cảnh ${board.value.scenes.length + 1}`);
  board.value.scenes.push(scene);
  activeId.value = scene.id;
  markDirty();
}

function updateDuration(value?: number) {
  if (activeScene.value) activeScene.value.duration = value ?? 0;
  markDirty();
}

function moveScene(offset: number) {
  const index = activeIndex.value;
  const target = index + offset;
  if (index < 0 || target < 0 || target >= board.value.scenes.length) return;
  const [scene] = board.value.scenes.splice(index, 1);
  board.value.scenes.splice(target, 0, scene!);
  markDirty();
}

function removeScene() {
  const index = activeIndex.value;
  if (index < 0) return;
  board.value.scenes.splice(index, 1);
  activeId.value = board.value.scenes[Math.min(index, board.value.scenes.length - 1)]?.id ?? "";
  markDirty();
}

async function openStudio(kind: "image" | "video") {
  const prompt = (kind === "image" ? activeScene.value?.imagePrompt : activeScene.value?.videoPrompt)?.trim();
  if (!prompt || !(await saveBoard())) return;
  queueStudioPrompt({ directory: directory.value, kind, prompt });
  await router.push(`/${kind}`);
}

async function sendToCanvas() {
  if (!(await saveBoard())) return;
  queueStudioMediaForCanvas({ directory: directory.value, mediaType: "text", name: "Phân cảnh phim ngắn.md", text: storyboardMarkdown(board.value) });
  await router.push("/workspace");
}

async function downloadBoard() {
  action.value = "download";
  try { await saveFile(new Blob([storyboardMarkdown(board.value)], { type: "text/markdown;charset=utf-8" }), "phanCanhPhimNgan.md"); }
  catch (error) { message.value = { type: "error", text: errorText(error) }; }
  finally { action.value = undefined; }
}

watch(directory, () => void loadBoard(), { immediate: true });
onMounted(() => void loadModels());
onScopeDispose(() => { loadVersion++; generation.value?.abort(); });
onBeforeRouteLeave(async () => {
  if (action.value) return false;
  if (!dirty.value || draftStored.value) return true;
  return ElMessageBox.confirm("Bảng phân cảnh còn thay đổi chưa lưu.", "Rời trang Phim ngắn?",
    { type: "warning", confirmButtonText: "Rời trang", cancelButtonText: "Tiếp tục chỉnh" }).then(() => true, () => false);
});
</script>

<style scoped lang="scss">
.dramaPage {
  display: grid;
  grid-template-columns: 226px minmax(0, 1fr);
  height: 100dvh;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color-page);
}
.navRail {
  padding: 23px 14px;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-light);

  .brand { display: flex; align-items: center; gap: 11px; padding: 3px 13px 27px; font-size: 20px; }
  img { width: 31px; height: 31px; }
  nav { display: grid; gap: 7px; }
  a {
    display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 10px;
    text-decoration: none; color: var(--el-text-color-regular); font-weight: 500;
    &:hover { background: var(--el-fill-color-light); }
    &.router-link-exact-active { color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
  }
}
.dramaMain { overflow: auto; padding: clamp(18px, 3vw, 40px); }
.pageHeader { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 23px; }
.pageHeader h1 { margin: 0; font-size: clamp(25px, 3vw, 33px); line-height: 1.2; }
.pageHeader p { margin: 7px 0 0; color: var(--el-text-color-secondary); }
.workArea { display: grid; grid-template-columns: minmax(265px, .8fr) minmax(0, 1.5fr); gap: 17px; align-items: start; }
.scriptCard, .sceneCard { min-width: 0; border-radius: 14px; }
.scriptCard h2, .sceneCard h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; }
.sceneHeader, .outputBar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.sceneCount { display: inline-grid; place-items: center; min-width: 23px; height: 23px; border-radius: 6px; background: var(--el-fill-color-light); color: var(--el-text-color-regular); font-size: 12px; }
.formFields { display: grid; gap: 13px; min-width: 0; }
.dramaField { display: grid; gap: 7px; min-width: 0; font-size: 13px; font-weight: 620; }
.sceneTimeline { display: flex; gap: 6px; overflow-x: auto; margin: 0 0 14px; padding: 2px 2px 8px; }
.sceneTab {
  display: flex; align-items: center; flex: 0 0 auto; gap: 7px; max-width: 185px; padding: 6px 9px 6px 6px;
  border: 1px solid var(--el-border-color-light); border-radius: 7px; background: var(--el-fill-color-lighter);
  color: var(--el-text-color-regular); font: inherit; cursor: pointer;
  &.active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
  &:disabled { cursor: default; }
  &:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 1px; }
}
.sceneIndex { padding: 2px 5px; border-radius: 4px; background: var(--el-bg-color); font-weight: 650; }
.sceneTitle { max-width: 140px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.sceneDetails { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
.promptGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.promptPanel { min-width: 0; display: grid; gap: 8px; padding: 10px; border-radius: 9px; background: var(--el-fill-color-lighter); }
.promptPanel :deep(.el-button) { justify-self: start; max-width: 100%; white-space: normal; height: auto; min-height: 32px; }
.buttonRow { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.buttonRow :deep(.el-button) { margin-left: 0; }
.sceneActions { padding-top: 4px; }
.outputBar { margin-top: 16px; padding: 11px 0; }
.notice { margin-bottom: 14px; }
.muted, .importHint { color: var(--el-text-color-secondary); font-size: 13px; }
.importHint { margin: 0; line-height: 1.6; }
.pasteAction { margin-top: 8px; }
@media (max-width: 1050px) {
  .dramaPage { grid-template-columns: 68px minmax(0, 1fr); }
  .navRail {
    padding: 14px 6px;
    .brand, a { justify-content: center; padding-inline: 0; }
    .brand strong, a span { display: none; }
  }
}
@media (max-width: 730px) {
  .workArea, .promptGrid { grid-template-columns: minmax(0, 1fr); }
  .dramaPage { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
  .navRail {
    padding: 6px 12px; border-right: 0; border-bottom: 1px solid var(--el-border-color-light);
    .brand { display: none; }
    nav { display: flex; }
    a { padding: 10px 12px; }
  }
}
</style>
