<template>
  <div class="clipForgeStudio">
    <el-card class="clipForgeConnection" shadow="never">
      <div class="connectionGrid">
        <label class="clipField"><span>Địa chỉ ClipForge</span>
          <el-input v-model="address" :disabled="busy" placeholder="http://127.0.0.1:3457" @input="online = ''" />
        </label>
        <el-button :icon="IconPlugConnected" :loading="action === 'connect'" :disabled="busy" @click="connect">Kiểm tra kết nối</el-button>
        <a href="https://github.com/xixihhhh/clipforge/releases" target="_blank" rel="noopener noreferrer">Tải ClipForge <icon-external-link :size="15" /></a>
      </div>
      <p v-if="online" class="clipStatus" role="status">Đã kết nối ClipForge{{ online === "unknown" ? "" : ` ${online}` }}.</p>
      <p v-else class="clipHint">Mở ClipForge trước. Khi dựng, ảnh và lời thoại sẽ được gửi đến địa chỉ đã chọn.</p>
    </el-card>

    <el-alert v-if="notice" :title="notice.text" :type="notice.type" :closable="false" showIcon />

    <div class="clipColumns">
      <el-card shadow="never">
        <template #header><h2><icon-photo :size="19" /> Ảnh sản phẩm và lời thoại</h2></template>
        <div class="clipForm">
          <div class="photoBox">
            <img v-if="photoUrl" :src="photoUrl" alt="Ảnh sản phẩm đã chọn" />
            <icon-photo v-else :size="28" aria-hidden="true" />
            <div>
              <p v-if="image" :title="image.name">{{ image.name }}</p>
              <el-button :disabled="busy" @click="imageInput?.click()">{{ image ? "Đổi ảnh" : "Chọn ảnh sản phẩm" }}</el-button>
              <small v-if="!image" class="clipHint">PNG, JPEG, WebP · tối đa 20 MiB</small>
            </div>
            <input ref="imageInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="selectImage" />
          </div>
          <label class="clipField"><span>Tên sản phẩm</span><el-input v-model="title" :maxlength="120" :disabled="busy" placeholder="Ví dụ: Bình giữ nhiệt 500 ml" /></label>
          <label class="clipField"><span>Điểm nổi bật <small class="clipHint">Tùy chọn</small></span><el-input v-model="description" type="textarea" :rows="2" :maxlength="1500" :disabled="busy" /></label>
          <label class="clipField"><span>Lời thoại tiếng Việt</span><el-input v-model="script" type="textarea" :rows="6" :maxlength="1500" :disabled="busy"
            placeholder="Mỗi dòng là một đoạn lời thoại, ví dụ: Một chiếc bình nhỏ gọn để mang đi làm…" /></label>
          <div class="clipOptions">
            <label class="clipField"><span>Tỷ lệ</span><select v-model="ratio" :disabled="busy"><option>9:16</option><option>16:9</option><option>1:1</option></select></label>
            <label class="clipField"><span>Độ phân giải</span><select v-model="resolution" :disabled="busy"><option>720p</option><option>1080p</option></select></label>
            <label class="clipField"><span>Giọng đọc</span><select v-model="voice" :disabled="busy">
              <option value="vi-VN-HoaiMyNeural">Hoài My · Nữ</option><option value="vi-VN-NamMinhNeural">Nam Minh · Nam</option><option value="">Chỉ phụ đề</option>
            </select></label>
          </div>
          <el-button class="renderButton" type="primary" :icon="IconPlayerPlay" :disabled="!canRender" :loading="action === 'render'" @click="renderVideo">Dựng video sản phẩm</el-button>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header><h2><icon-movie :size="19" /> Kết quả ClipForge</h2></template>
        <el-empty v-if="!receipt && !loading" description="MP4 sẽ xuất hiện sau khi ClipForge dựng xong." :imageSize="102" />
        <div v-else class="clipResult">
          <div class="resultInfo"><strong v-if="receipt">{{ receipt.title }}</strong><span role="status">{{ statusLabel }}</span></div>
          <video v-if="composition?.videoUrl" :key="composition.videoUrl" :src="composition.videoUrl" controls playsinline preload="metadata" aria-label="Video sản phẩm từ ClipForge" />
          <el-alert v-if="composition?.failedVoiceSegments" type="warning" :closable="false" showIcon
            :title="`ClipForge bỏ qua giọng đọc ở ${composition.failedVoiceSegments} đoạn. Bạn vẫn có thể tải MP4 và xem phụ đề.`" />
          <p v-if="receipt?.compositionId" class="clipId">ID lượt dựng <code>{{ receipt.compositionId }}</code></p>
          <p v-if="receipt?.savedPath" class="clipStatus" role="status">Đã lưu MP4 trong dự án.</p>
          <div class="clipActions">
            <el-button v-if="receipt?.projectId" :icon="IconRefresh" :loading="checking" :disabled="busy" @click="refreshResult(true)">Kiểm tra tiến độ</el-button>
            <el-button v-if="projectUrl" tag="a" :href="projectUrl" target="_blank" rel="noopener noreferrer" :icon="IconExternalLink">Mở dự án ClipForge</el-button>
            <el-button v-if="downloadUrl" tag="a" :href="downloadUrl" target="_blank" rel="noopener noreferrer" :icon="IconDownload">Tải MP4</el-button>
            <el-button v-if="composition?.videoUrl && !receipt?.savedPath" :icon="IconFolderPlus" :loading="action === 'save'" :disabled="busy" @click="saveVideo">Lưu vào dự án</el-button>
            <el-button v-if="composition?.videoUrl || receipt?.savedPath" type="primary" plain :icon="IconLayoutDashboard" :disabled="busy" @click="sendToCanvas">Đưa vào Canvas</el-button>
            <el-button v-if="isFollowing" text :disabled="busy || checking" @click="stopFollowing">Ngừng theo dõi</el-button>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "axios";
import { ElMessageBox } from "element-plus";
import { IconDownload, IconExternalLink, IconFolderPlus, IconLayoutDashboard, IconPlayerPlay, IconPlugConnected, IconRefresh } from "@tabler/icons-vue";
import { computed, onMounted, onScopeDispose, ref, shallowRef, watch } from "vue";
import { useRouter } from "vue-router";
import { queueStudioMediaForCanvas } from "@/lib/mediaStudioTransfer";
import useWorkspaceFiles, { type TextSnapshot } from "@/lib/workspaceFiles";
import { checkClipForge, clipForgeOrigin, clipForgeReceiptPath, composeClipForge, downloadClipForgeMp4, parseClipForgeReceipt,
  prepareClipForge, readClipForgeComposition, validateClipForgeImage, type ClipForgeOptions, type ClipForgeReceipt } from "./clipForgeApi";

const props = defineProps<{ directory: string; active: boolean }>();
const router = useRouter();
const files = useWorkspaceFiles(props.directory);
const lifetime = new AbortController();
const address = ref("http://127.0.0.1:3457");
const online = ref("");
const title = ref("");
const description = ref("");
const script = ref("");
const ratio = ref<ClipForgeOptions["ratio"]>("9:16");
const resolution = ref<ClipForgeOptions["resolution"]>("720p");
const voice = ref("vi-VN-HoaiMyNeural");
const image = shallowRef<File>();
const imageInput = ref<HTMLInputElement>();
const photoUrl = ref("");
const receipt = shallowRef<ClipForgeReceipt>();
const composition = shallowRef<Awaited<ReturnType<typeof readClipForgeComposition>>>(null);
const loading = ref(true);
const loadFailed = ref(false);
const action = ref<"connect" | "render" | "save">();
const checking = ref(false);
const notice = ref<{ type: "error" | "warning" | "success"; text: string }>();
let snapshot: TextSnapshot | undefined;
let timer: ReturnType<typeof setInterval> | undefined;

const busy = computed(() => loading.value || !!action.value);
const isFollowing = computed(() => {
  const stage = receipt.value?.stage;
  return (stage === "awaiting" || stage === "accepted") && composition.value?.status !== "done" && composition.value?.status !== "failed";
});
const canRender = computed(() => !busy.value && !checking.value && !loadFailed.value && !isFollowing.value
  && !!online.value && !!image.value && !!title.value.trim() && script.value.trim().length >= 2);
const projectUrl = computed(() => receipt.value?.projectId ? new URL(`/project/${receipt.value.projectId}/export`, receipt.value.origin).href : "");
const downloadUrl = computed(() => composition.value?.videoUrl ? `${composition.value.videoUrl}?download=1` : "");
const statusLabel = computed(() => {
  if (loading.value) return "Đang đọc lượt dựng trước…";
  if (action.value === "render") return "Đang gửi ảnh và lời thoại tới ClipForge…";
  if (composition.value) return { pending: "Đang chờ dựng", composing: "Đang dựng MP4", done: "Đã dựng xong", failed: "Dựng thất bại" }[composition.value.status];
  if (receipt.value?.stage === "detached") return "Đã ngừng theo dõi trong MacFlow";
  if (receipt.value?.stage === "setupFailed" || receipt.value?.stage === "preparing") return "Chưa bắt đầu dựng";
  return "Đang chờ xác nhận từ ClipForge";
});

function workspaceCode(error: unknown) {
  return axios.isAxiosError<{ data?: { code?: string } }>(error) ? error.response?.data?.data?.code : undefined;
}

function showError(error: unknown) {
  if (lifetime.signal.aborted) return;
  const code = workspaceCode(error);
  const text = ["ESTALE", "EEXIST", "EBUSY"].includes(code ?? "") ? "Lượt dựng đã đổi ở cửa sổ khác. Mở lại Xưởng video để đọc bản mới."
    : axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || "Không lưu được dữ liệu dự án."
      : error instanceof Error ? error.message : "Không hoàn tất được thao tác ClipForge.";
  notice.value = { type: "error", text };
}

async function storeReceipt(value: ClipForgeReceipt) {
  const text = JSON.stringify(value, null, 2);
  if (snapshot) snapshot = { ...snapshot, text, revision: await files.writeTextSnapshot(clipForgeReceiptPath, text, snapshot) };
  else {
    await files.write(clipForgeReceiptPath, text, true, lifetime.signal);
    const saved = await files.readTextSnapshot(clipForgeReceiptPath, { maxBytes: 8192, signal: lifetime.signal });
    if (saved.text !== text) throw new Error("Lượt dựng đã đổi ở cửa sổ khác. Mở lại Xưởng video để đọc bản mới.");
    snapshot = saved;
  }
  receipt.value = value;
}

async function loadReceipt() {
  try {
    const saved = await files.readTextSnapshot(clipForgeReceiptPath, { maxBytes: 8192, signal: lifetime.signal });
    const value = parseClipForgeReceipt(saved.text);
    snapshot = saved;
    receipt.value = value;
    address.value = value.origin;
  } catch (error) {
    if (!lifetime.signal.aborted && workspaceCode(error) !== "ENOENT") { loadFailed.value = true; showError(error); }
  } finally { loading.value = false; }
  if (props.active) void refreshResult();
}

async function connect() {
  action.value = "connect";
  notice.value = undefined;
  online.value = "";
  try {
    const origin = clipForgeOrigin(address.value);
    if (origin === location.origin) throw new Error("Nhập địa chỉ ClipForge đang chạy ở cổng khác MacFlow.");
    online.value = await checkClipForge(origin, lifetime.signal);
    address.value = origin;
  } catch (error) { showError(error); }
  finally { action.value = undefined; }
}

function selectImage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try { validateClipForgeImage(file); image.value = file; notice.value = undefined; }
  catch (error) { showError(error); }
}

async function renderVideo() {
  if (!canRender.value || !image.value) return;
  action.value = "render";
  notice.value = undefined;
  const options: ClipForgeOptions = { title: title.value.trim().normalize("NFC"), description: description.value.trim().normalize("NFC"),
    script: script.value.trim().normalize("NFC"), image: image.value,
    ratio: ratio.value, resolution: resolution.value, voice: voice.value };
  let ownReceipt: ClipForgeReceipt | undefined;
  async function updateReceipt(value: ClipForgeReceipt) {
    await storeReceipt(value);
    ownReceipt = value;
  }
  try {
    const origin = clipForgeOrigin(address.value);
    await updateReceipt({ version: 1, origin, title: options.title, stage: "preparing" });
    composition.value = null;
    const { projectId, scriptId } = await prepareClipForge(origin, options, lifetime.signal, async id => {
      await updateReceipt({ version: 1, origin, title: options.title, stage: "preparing", projectId: id });
    });
    await updateReceipt({ version: 1, origin, title: options.title, stage: "awaiting", projectId });
    const accepted = await composeClipForge(origin, projectId, scriptId, options, lifetime.signal);
    await updateReceipt({ version: 1, origin, title: options.title, stage: "accepted", projectId, compositionId: accepted.compositionId });
  } catch (error) {
    if (!lifetime.signal.aborted && ownReceipt?.stage === "preparing") {
      try { await storeReceipt({ ...ownReceipt, stage: "setupFailed" }); }
      catch (saveError) { showError(saveError); return; }
    }
    showError(error);
  } finally { action.value = undefined; }
  await refreshResult();
}

async function refreshResult(manual = false) {
  const current = receipt.value;
  if (!current?.projectId || checking.value || busy.value || (!manual && !isFollowing.value)) return;
  checking.value = true;
  try {
    const result = await readClipForgeComposition(current, lifetime.signal);
    if (!result) {
      if (manual) notice.value = { type: "warning", text: "ClipForge chưa trả lượt dựng cho dự án này. Bạn có thể kiểm tra lại sau." };
      return;
    }
    if (current.stage === "awaiting" || current.stage === "detached") await storeReceipt({ ...current, stage: "accepted", compositionId: result.id });
    composition.value = result;
    notice.value = result.status === "failed" ? { type: "error", text: "ClipForge dựng thất bại. Mở dự án ClipForge để kiểm tra chi tiết." } : undefined;
  } catch (error) { if (manual || !notice.value) showError(error); }
  finally { checking.value = false; }
}

async function stopFollowing() {
  const current = receipt.value;
  if (!current) return;
  const confirmed = await ElMessageBox.confirm("MacFlow sẽ dừng theo dõi. Bạn vẫn có thể mở dự án ở ClipForge để xem lượt dựng này.", "Ngừng theo dõi lượt dựng?",
    { type: "warning", confirmButtonText: "Ngừng theo dõi", cancelButtonText: "Tiếp tục" }).then(() => true, () => false);
  if (!confirmed || receipt.value !== current || checking.value || busy.value) return;
  action.value = "save";
  try { await storeReceipt({ ...current, stage: "detached" }); composition.value = null; notice.value = undefined; }
  catch (error) { showError(error); }
  finally { action.value = undefined; }
}

async function saveVideo() {
  const current = receipt.value;
  const url = composition.value?.videoUrl;
  if (!current || busy.value || checking.value) return;
  if (current.savedPath) return current.savedPath;
  if (!url) return;
  action.value = "save";
  try {
    const video = await downloadClipForgeMp4(url, lifetime.signal);
    for (const dir of ["assets", "assets/generated"]) {
      await files.mkdir(dir).catch(error => { if (workspaceCode(error) !== "EEXIST") throw error; });
    }
    const path = `assets/generated/clipForge${crypto.randomUUID()}.mp4`;
    await files.write(path, video, true, lifetime.signal);
    await storeReceipt({ ...current, savedPath: path });
    notice.value = { type: "success", text: "Đã lưu video sản phẩm vào workspace MacFlow." };
    return path;
  } catch (error) { showError(error); }
  finally { action.value = undefined; }
}

async function sendToCanvas() {
  const path = await saveVideo();
  if (!path || lifetime.signal.aborted) return;
  queueStudioMediaForCanvas({ directory: props.directory, path, mimeType: "video/mp4", mediaType: "video" });
  await router.push("/workspace");
}

watch(image, (file, _previous, cleanup) => {
  const url = file ? URL.createObjectURL(file) : "";
  photoUrl.value = url;
  cleanup(() => { if (url) URL.revokeObjectURL(url); });
});
watch(() => props.active, active => { if (active) void refreshResult(); });
onMounted(() => {
  void loadReceipt();
  timer = setInterval(() => { if (props.active && document.visibilityState !== "hidden") void refreshResult(); }, 3500);
});
onScopeDispose(() => { clearInterval(timer); lifetime.abort(); });
</script>

<style scoped lang="scss">
.clipForgeStudio { display: grid; gap: 15px; margin-top: 18px; }
.clipForgeStudio h2 { display: flex; align-items: center; gap: 8px; font-size: 16px; margin: 0; }
.connectionGrid { display: grid; grid-template-columns: minmax(180px, 1fr) auto auto; gap: 10px; align-items: end; }
.connectionGrid a { display: flex; align-items: center; gap: 5px; min-height: 32px; color: var(--el-color-primary); text-decoration: none; font-size: 13px; }
.clipHint, .clipStatus { margin: 8px 0 0; font-size: 13px; line-height: 1.5; }
.clipHint { color: var(--el-text-color-secondary); }
.clipStatus { color: var(--el-color-success-dark-2, var(--el-color-success)); }
.clipColumns { display: grid; grid-template-columns: minmax(300px, .9fr) minmax(0, 1.28fr); gap: 15px; align-items: start; }
.clipColumns > :deep(.el-card) { min-width: 0; }
.clipForm, .clipResult { display: grid; gap: 13px; min-width: 0; }
.clipField { display: grid; gap: 6px; min-width: 0; font-size: 13px; font-weight: 650; }
.clipField small { font-weight: 400; margin-left: 4px; }
.clipField select { min-height: 32px; min-width: 0; padding: 4px 8px; border: 1px solid var(--el-border-color); border-radius: 6px; background: var(--el-bg-color); color: var(--el-text-color-regular); font: inherit; font-weight: 400; }
.clipOptions { display: grid; grid-template-columns: minmax(60px, .75fr) minmax(70px, .84fr) minmax(112px, 1.4fr); gap: 8px; }
.photoBox { display: flex; gap: 11px; align-items: center; min-width: 0; background: var(--el-fill-color-lighter); border: 1px dashed var(--el-border-color); border-radius: 10px; padding: 10px; }
.photoBox img { flex: 0 0 72px; width: 72px; height: 64px; object-fit: contain; border-radius: 5px; background: var(--el-bg-color); }
.photoBox div { min-width: 0; }
.photoBox p { margin: 0 0 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.photoBox small { display: block; }
.renderButton { justify-self: start; }
.resultInfo, .clipActions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.resultInfo { justify-content: space-between; }
.resultInfo span { font-size: 13px; color: var(--el-text-color-secondary); }
.clipResult video { width: 100%; max-height: 500px; display: block; border-radius: 10px; background: #121219; }
.clipId { margin: 0; display: flex; flex-wrap: wrap; gap: 6px; font-size: 12px; color: var(--el-text-color-secondary); overflow-wrap: anywhere; }
.clipActions :deep(.el-button) { margin-left: 0; }
@media (max-width: 980px) { .clipColumns { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 570px) {
  .connectionGrid { grid-template-columns: minmax(0, 1fr) auto; }
  .connectionGrid .clipField { grid-column: 1 / -1; }
}
</style>
