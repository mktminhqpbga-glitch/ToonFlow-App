<template>
  <div class="mediaStudio">
    <aside class="studioSidebar" aria-label="Điều hướng MacFlow">
      <div class="studioBrand"><img :src="logoUrl" alt="" /><strong>MacFlow</strong></div>
      <nav class="studioNavigation" aria-label="Các trang sáng tạo">
        <router-link to="/home"><icon-home :size="18" /> Tổng quan</router-link>
        <router-link to="/workspace"><icon-layout-dashboard :size="18" /> Canvas</router-link>
        <router-link to="/image" :class="{ active: kind === 'image' }"><icon-photo :size="18" /> Xưởng tạo ảnh</router-link>
        <router-link to="/video" :class="{ active: kind === 'video' }"><icon-video :size="18" /> Xưởng tạo video</router-link>
        <router-link to="/shortDrama"><icon-movie :size="18" /> Phim ngắn</router-link>
      </nav>
      <div class="studioSidebarFooter">
        <span v-if="workspaceStore.project" class="workspaceName" :title="workspaceStore.project.directory"><icon-folder :size="16" /> {{ workspaceStore.project.name }}</span>
        <el-button text @click="openMediaSettings"><icon-settings :size="18" /> Cài đặt mô hình</el-button>
      </div>
    </aside>

    <main class="studioMain">
      <header class="studioHeader">
        <div>
          <div class="studioEyebrow">MACFLOW STUDIO / {{ kind === "image" ? "IMAGE" : "VIDEO" }}</div>
          <h1>{{ kind === "image" ? "Xưởng tạo ảnh" : "Xưởng tạo video" }}</h1>
          <p>Biến mô tả thành {{ kind === "image" ? "hình ảnh" : "video" }} bằng mô hình đã cài trong MacFlow.</p>
        </div>
        <div class="studioHeaderActions">
          <el-button type="primary" plain :icon="IconGitBranch" :disabled="!directory" @click="flowSetupVisible = true">Thiết lập luồng</el-button>
          <el-button :icon="IconRefresh" :loading="modelsLoading || historyLoading" @click="refreshAll">Làm mới</el-button>
        </div>
      </header>

      <el-alert v-if="!directory" type="warning" :closable="false" showIcon>
        <template #title>Chưa có dự án làm việc</template>
        Chọn hoặc mở một dự án ở trang Tổng quan để lưu tác vụ và kết quả đúng workspace.
        <router-link to="/home">Mở Tổng quan</router-link>
      </el-alert>

      <div class="studioColumns">
        <section class="studioComposer" aria-label="Tạo nội dung">
          <el-card shadow="never">
            <template #header><div class="studioCardHeading"><span><icon-sparkles :size="19" /> Tạo {{ kind === "image" ? "ảnh mới" : "video mới" }}</span><el-tag size="small" type="info">1 kết quả / tác vụ</el-tag></div></template>

            <label class="fieldLabel" for="studioPrompt">Mô tả ý tưởng <span>*</span></label>
            <el-input id="studioPrompt" v-model="prompt" type="textarea" resize="vertical" :rows="6"
              :maxlength="100000" showWordLimit :placeholder="kind === 'image' ? 'Mô tả bối cảnh, nhân vật, ánh sáng và phong cách bạn muốn tạo…' : 'Mô tả cảnh quay, chuyển động, hành động và không khí video…'"
              :disabled="submitting" />

            <label class="fieldLabel" for="studioModel">Mô hình {{ kind === "image" ? "ảnh" : "video" }}</label>
            <el-select id="studioModel" v-model="modelKey" class="fullWidth" filterable :loading="modelsLoading" placeholder="Chọn mô hình đa phương tiện" @change="changeModel">
              <el-option v-for="model in availableModels" :key="modelKeyOf(model)" :value="modelKeyOf(model)"
                :label="`${model.label} · ${model.providerLabel} (${model.providerId})`" />
            </el-select>
            <div v-if="!modelsLoading && !availableModels.length" class="emptyModels">
              <el-empty :description="`Chưa có mô hình ${kind === 'image' ? 'ảnh' : 'video'} phù hợp`" :imageSize="72" />
              <el-button type="primary" plain @click="openMediaSettings">Cài đặt → Mô hình đa phương tiện</el-button>
            </div>
            <p v-else-if="model" class="fieldHint">Nguồn: {{ model.providerLabel }} ({{ model.providerId }}). Chỉ gửi những tuỳ chọn mà mô hình công bố hỗ trợ.</p>
            <el-alert v-if="!modelsLoading && requestedModelKey && modelKey !== requestedModelKey" type="warning" :closable="false" showIcon
              title="Mô hình cần thử chưa có trong xưởng. Hãy lưu mô hình và kiểm tra kết nối mac2API trong Cài đặt, sau đó bấm Làm mới." />
            <el-alert v-if="model && ['chatgpt/image', 'gemini-web/image'].includes(model.modelId)" class="browserModelNotice" type="info" :closable="false" showIcon>
              ChatGPT Web và Gemini Web cần Chrome được kết nối trên máy chủ mac2API. Danh sách mô hình cho biết nguồn đã cài, không có nghĩa tab AI đang sẵn sàng. Backend sẽ kiểm tra trước khi gửi tạo ảnh.
            </el-alert>

            <p v-if="model?.referenceLimits && !ratioOptions.length" class="fieldHint">mac2API chưa công bố tỉ lệ có thể chọn. Xưởng dùng tỉ lệ mặc định của mô hình.</p>

            <div v-if="model && (ratioOptions.length || sizeOptions.length || durationOptions.length || resolutionOptions.length)" class="studioOptions">
              <div v-if="ratioOptions.length"><label class="fieldLabel">Tỷ lệ khung hình</label>
                <el-select v-model="ratio" class="fullWidth" placeholder="Mặc định của mô hình" clearable><el-option v-for="item in ratioOptions" :key="item" :label="item" :value="item" /></el-select>
              </div>
              <div v-if="sizeOptions.length"><label class="fieldLabel">Độ phân giải</label>
                <el-select v-model="size" class="fullWidth" placeholder="Mặc định" clearable><el-option v-for="item in sizeOptions" :key="item" :label="item" :value="item" /></el-select>
                <p v-if="model.localImageSizing" class="fieldHint">MacFlow đổi kích thước theo cạnh dài. Auto giữ kích thước gốc.</p>
              </div>
              <div v-if="durationOptions.length"><label class="fieldLabel">Thời lượng</label>
                <el-select v-model="duration" class="fullWidth" placeholder="Mặc định" clearable><el-option v-for="item in durationOptions" :key="item" :label="`${item} giây`" :value="item" /></el-select>
              </div>
              <div v-if="resolutionOptions.length"><label class="fieldLabel">Độ phân giải</label>
                <el-select v-model="resolution" class="fullWidth" placeholder="Mặc định" clearable><el-option v-for="item in resolutionOptions" :key="item" :label="item" :value="item" /></el-select>
              </div>
            </div>

            <div class="referenceHeading"><label class="fieldLabel">{{ kind === "image" || maxReferences > 1 ? "Ảnh tham chiếu" : "Ảnh khung đầu" }}</label><span v-if="supportsReferences">{{ references.length }} / {{ maxReferences }}</span></div>
            <div v-if="supportsReferences" class="referenceArea">
              <div v-for="reference in references" :key="reference.path" class="referenceItem">
                <img :src="reference.preview" :alt="reference.name" />
                <el-button circle size="small" :icon="IconX" :disabled="submitting" :aria-label="`Bỏ ${reference.name}`" @click="removeReference(reference.path)" />
                <small :title="reference.name">{{ reference.name }}</small>
              </div>
              <button v-if="references.length < maxReferences" class="referenceAdd" type="button" :disabled="submitting || !directory" @click="referenceInput?.click()"><icon-plus :size="21" /><span>Tải ảnh lên</span></button>
              <el-button v-if="references.length < maxReferences && currentUser?.role !== 'user'" plain :disabled="submitting || !directory" @click="assetPickerVisible = true">Chọn từ thư viện</el-button>
              <el-button v-if="kind === 'image' && latestTask && fileOf(latestTask) && references.length < maxReferences" plain
                :disabled="submitting || referenceBusy" @click="useCurrentImage(latestTask)">Dùng ảnh hiện tại làm tham chiếu</el-button>
            </div>
            <p v-else class="fieldHint">Mô hình được chọn chỉ hỗ trợ tạo từ văn bản; không gửi ảnh tham chiếu.</p>
            <p v-if="kind === 'video' && supportsReferences && maxReferences === 1" class="fieldHint">Ảnh đã chọn sẽ được dùng làm khung đầu.</p>
            <input ref="referenceInput" type="file" :accept="referenceMimeTypes.join(',')" hidden multiple :disabled="submitting" @change="uploadReferences" />

            <div class="studioQueue">
              <label class="fieldLabel" for="studioQueueLimit">Số tác vụ chạy cùng lúc</label>
              <el-select id="studioQueueLimit" :modelValue="queueLimit" class="fullWidth" aria-label="Số tác vụ chạy cùng lúc"
                :disabled="!directory || queueLimitSaving" @change="saveQueueLimit">
                <el-option v-for="limit in 10" :key="limit" :value="limit" :label="String(limit)" />
              </el-select>
              <p class="fieldHint" role="status">{{ queueRunning }} đang chạy · {{ queueWaiting }} đang chờ</p>
              <p v-if="queueError" class="taskError" role="status">{{ queueError }}</p>
            </div>
            <div class="studioSubmit">
              <el-button type="primary" size="large" :icon="IconSparkles" :loading="submitting" :disabled="!canSubmit" @click="submitTask">
                {{ submitting ? "Đang thêm tác vụ…" : "Thêm vào hàng chờ" }}
              </el-button>
            </div>
            <el-alert v-if="submitError" :title="submitError" type="error" showIcon :closable="true" @close="submitError = ''" />
          </el-card>
        </section>

        <section class="studioResults" aria-label="Kết quả và lịch sử">
          <el-card shadow="never">
            <template #header><div class="studioCardHeading"><span><icon-photo-scan v-if="kind === 'image'" :size="19" /><icon-player-play v-else :size="19" /> Kết quả</span><el-tag size="small">{{ tasks.length }} tác vụ</el-tag></div></template>
            <div v-if="latestTask" class="resultCard">
              <div class="resultMeta"><el-tag :type="statusTag(latestTask.state)" size="small">{{ statusText(latestTask) }}</el-tag><span>{{ formatDate(latestTask.createdAt) }}</span></div>
              <div v-if="selectedMedia" class="mediaPreview">
                <div v-if="previewError" class="previewLoading" role="status">
                  <icon-alert-circle :size="22" /><span>{{ previewError }}</span>
                  <el-button size="small" @click="previewRefresh++">Tải lại bản xem trước</el-button>
                </div>
                <img v-else-if="kind === 'image' && previewUrl" :src="previewUrl" alt="Ảnh kết quả" @error="previewDecodeFailed" />
                <video v-else-if="kind === 'video' && previewUrl" :src="previewUrl" controls playsinline preload="metadata" @error="previewDecodeFailed" />
                <div v-else class="previewLoading"><icon-loader-2 :size="26" /> Đang tải file từ workspace…</div>
              </div>
              <div v-else class="resultPlaceholder">
                <icon-loader-2 v-if="latestTask.state === 'running'" :size="34" class="spinning" />
                <icon-alert-circle v-else-if="latestTask.state === 'failed' || latestTask.state === 'interrupted'" :size="34" />
                <icon-sparkles v-else :size="34" />
                <span>{{ statusText(latestTask) }}</span>
              </div>
              <div class="taskInfo"><small>ID tác vụ</small><code>{{ latestTask.taskId }}</code></div>
              <p v-if="latestTask.result && latestTask.result.code !== 200" class="taskError">{{ describeError(latestTask.result.message) }}</p>
              <p v-if="latestTask.state === 'interrupted'" class="fieldHint">Chỉ kiểm tra/khôi phục ID này, không gửi yêu cầu tạo mới. Nếu chưa rõ trạng thái, kiểm tra mac2API → Tác vụ.</p>
              <el-button v-if="latestTask.state === 'queued' || latestTask.state === 'running'" type="danger" plain
                :loading="cancelling" @click="cancelTask(latestTask)">Hủy tác vụ</el-button>
              <div v-if="fileOf(latestTask)" class="resultActions">
                <el-button :icon="IconDownload" @click="downloadResult(latestTask)">Tải về</el-button>
                <el-button :icon="IconFolderPlus" :disabled="currentUser?.role === 'user'" @click="saveToLibrary(latestTask)">Lưu vào thư viện</el-button>
                <el-button type="primary" plain :icon="IconLayoutDashboard" @click="sendToCanvas(latestTask)">Đưa vào Canvas</el-button>
              </div>
              <el-button v-else-if="latestTask.state === 'interrupted' && latestTask.resumable" plain :disabled="statusBusy" @click="refreshStatuses(true)">Kiểm tra / khôi phục tác vụ</el-button>
            </div>
            <el-empty v-else description="Kết quả mới sẽ xuất hiện tại đây" :imageSize="110" />
          </el-card>
          <el-card class="studioHistory" shadow="never">
            <template #header><div class="studioCardHeading"><span><icon-history :size="19" /> Lịch sử tác vụ</span><el-button text :loading="historyLoading" :icon="IconRefresh" @click="loadHistory">Làm mới</el-button></div></template>
            <div v-if="tasks.length" class="taskList">
              <button v-for="task in orderedTasks" :key="task.taskId" type="button" class="taskRow" :class="{ selected: selectedTaskId === task.taskId }" @click="selectedTaskId = task.taskId">
                <span class="taskIcon"><icon-photo v-if="kind === 'image'" :size="19" /><icon-video v-else :size="19" /></span>
                <span class="taskDescription"><strong>{{ task.prompt || task.modelId || "Tác vụ tạo nội dung" }}</strong><small>{{ formatDate(task.createdAt) }} · {{ task.modelId || task.taskId.slice(0, 8) }}</small></span>
                <el-tag :type="statusTag(task.state)" size="small">{{ statusText(task) }}</el-tag>
              </button>
            </div>
            <el-empty v-else :description="historyLoading ? 'Đang tải lịch sử…' : 'Chưa có tác vụ trong xưởng này'" :imageSize="84" />
            <p v-if="historyError" class="taskError">{{ historyError }}</p>
          </el-card>
        </section>
      </div>
    </main>

    <studioFlowSetup v-if="flowSetupVisible && directory" :key="directory" v-model="flowSetupVisible" :kind="kind"
      :directory="directory" :mediaModels="models" />
    <settings v-model="settingsVisible" ref="settingsRef" />
    <el-dialog v-if="currentUser?.role !== 'user'" v-model="assetPickerVisible" title="Chọn ảnh từ thư viện tài nguyên" width="min(980px, 95vw)" alignCenter appendToBody destroyOnClose>
      <assetLibrary v-model="assetPickerVisible" expanded :canSelect="canSelectAsset" :selecting="referenceBusy" @select="selectAsset" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import axios from "axios";
import {
  IconAlertCircle, IconDownload, IconFolderPlus, IconGitBranch, IconHistory, IconLayoutDashboard, IconLoader2,
  IconRefresh, IconSparkles, IconX,
} from "@tabler/icons-vue";
import { readNodeModels, type NodeMediaModel } from "@toonflow/nodes-scaffold/nodeAi";
import { useWorkspaceStore } from "@/stores/workspace";
import { currentUser } from "@/stores/multiTenant";
import useWorkspaceFiles from "@/lib/workspaceFiles";
import { queueStudioMediaForCanvas } from "@/lib/mediaStudioTransfer";
import { takeStudioPrompt } from "@/lib/studioPromptTransfer";
import settings from "@/components/settings/index.vue";
import assetLibrary from "@/pages/workspace/panels/canvas/components/assetLibrary.vue";
import logoUrl from "@toonflow/assets/logo.svg";

type MediaFile = { path: string; mimeType: string; mediaType: "image" | "video" };
type StudioTask = {
  taskId: string; state: "queued" | "running" | "interrupted" | "succeeded" | "failed" | "cancelled";
  resumable?: boolean; createdAt?: number; updatedAt?: number; prompt?: string; providerId?: string; modelId?: string;
  result?: { code: number; message: string; data: MediaFile[] | null };
  cancelDisposition?: "confirmed" | "requested" | "running" | "terminal" | "localOnly" | "notSent";
};
type ImageReference = { path: string; mimeType: string; name: string; preview: string; digest: string; file?: File };
type AssetEntry = { name: string; type: "file" | "directory"; path: string };
type PendingStudioId = { taskId: string; directory: string; kind: "image" | "video"; ownerId: string; createdAt: number };
type StudioQueueStatus = { limit: number; running: number; queued: number };
const pendingStorageKey = "macflow.mediaStudio.pending.v1";

const props = defineProps<{ kind: "image" | "video" }>();
const studioFlowSetup = defineAsyncComponent(() => import("./studioFlowSetup.vue"));
const router = useRouter();
const route = useRoute();
const workspaceStore = useWorkspaceStore();
const directory = computed(() => workspaceStore.project?.directory ?? "");
const files = useWorkspaceFiles(directory);
const models = ref<NodeMediaModel[]>([]);
const modelsLoading = ref(false);
const flowSetupVisible = ref(false);
const modelKey = ref("");
const prompt = ref("");
const ratio = ref("");
const size = ref("");
const duration = ref<number | "">("");
const resolution = ref("");
const references = ref<ImageReference[]>([]);
const referenceBusy = ref(false);
const referenceInput = ref<HTMLInputElement>();
const assetPickerVisible = ref(false);
const settingsRef = ref<InstanceType<typeof settings>>();
const settingsVisible = ref(false);
const tasks = ref<StudioTask[]>([]);
const selectedTaskId = ref("");
const submitting = ref(false);
const submitError = ref("");
const historyLoading = ref(false);
const historyError = ref("");
const queueError = ref("");
const queueLimit = ref(1);
const queueRunning = ref(0);
const queueWaiting = ref(0);
const queueLimitSaving = ref(false);
const statusBusy = ref(false);
const cancelling = ref(false);
const previewUrl = ref("");
const previewError = ref("");
const previewRefresh = ref(0);
let historySequence = 0;
let scopeVersion = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let mounted = false;

function modelKeyOf(item: Pick<NodeMediaModel, "providerId" | "modelId" | "routeId">) { return JSON.stringify([item.providerId, item.providerId === "multiTenant" ? item.routeId ?? item.modelId : item.modelId]); }
const requestedModelKey = computed(() => {
  const { providerId, modelId } = route.query;
  return route.path === `/${props.kind}` && typeof providerId === "string" && typeof modelId === "string" && providerId && modelId
    ? modelKeyOf({ providerId, modelId }) : "";
});
const availableModels = computed(() => models.value.filter(item => item.type === props.kind)
  .sort((left, right) => Number(!!right.referenceLimits) - Number(!!left.referenceLimits)
    || Number(right.providerId.startsWith("mac2Api")) - Number(left.providerId.startsWith("mac2Api"))));
const model = computed(() => availableModels.value.find(item => modelKeyOf(item) === modelKey.value));
const modes = computed<string[]>(() => {
  const raw = model.value?.mode;
  const values = typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw : [];
  return values.filter((value): value is string => typeof value === "string");
});
const supportsReferences = computed(() => model.value?.referenceLimits
  ? model.value.referenceLimits.maxReferences > 0
  : modes.value.some(value => ["singleImage", "multiReference", "startFrameOptional", "startEndRequired", "endFrameOptional"].includes(value)));
const maxReferences = computed(() => model.value?.referenceLimits?.maxReferences
  ?? (props.kind === "video" || !modes.value.includes("multiReference") ? 1 : 4));
const referenceMimeTypes = computed(() => model.value?.referenceLimits?.allowedMimeTypes
  ?? ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
const maxReferenceBytes = computed(() => model.value?.referenceLimits?.maxReferenceBytes ?? 20 * 1024 * 1024);
const ratioOptions = computed(() => model.value?.imageRatios ?? []);
const sizeOptions = computed(() => model.value?.imageSizes ?? []);
const durationOptions = computed(() => [...new Set(model.value?.durationResolutionMap?.flatMap(item => item.duration) ?? [])]);
const resolutionOptions = computed(() => [...new Set((model.value?.durationResolutionMap ?? []).filter(item => !duration.value || item.duration.includes(Number(duration.value))).flatMap(item => item.resolution))]);
const canSubmit = computed(() => !!directory.value && !!prompt.value.trim() && !!model.value && !submitting.value
  && !modelsLoading.value && !referenceBusy.value && (!requestedModelKey.value || modelKey.value === requestedModelKey.value));
const latestTask = computed(() => tasks.value.find(task => task.taskId === selectedTaskId.value) ?? tasks.value[0]);
const selectedMedia = computed(() => latestTask.value && fileOf(latestTask.value));
const orderedTasks = computed(() => [
  ...tasks.value.filter(task => task.state === "running"),
  ...tasks.value.filter(task => task.state === "queued").sort((left, right) => (left.createdAt ?? 0) - (right.createdAt ?? 0)),
  ...tasks.value.filter(task => task.state !== "running" && task.state !== "queued"),
]);

function statusText(task: StudioTask) {
  if (task.state === "cancelled" && task.cancelDisposition) {
    return ({ confirmed: "Đã hủy trên mac2API", requested: "Đã yêu cầu hủy", running: "Đã dừng theo dõi",
      terminal: "Đã dừng theo dõi", localOnly: "Đã dừng cục bộ", notSent: "Đã hủy trước khi gửi" })[task.cancelDisposition];
  }
  return ({ queued: "Đang chờ", running: "Đang xử lý", interrupted: "Chưa rõ / gián đoạn", succeeded: "Hoàn tất", failed: "Thất bại", cancelled: "Đã huỷ" })[task.state];
}
function statusTag(state: StudioTask["state"]) {
  return ({ queued: "info", running: "warning", interrupted: "info", succeeded: "success", failed: "danger", cancelled: "info" } as const)[state];
}
function formatDate(value?: number) { return value ? new Date(value).toLocaleString("vi-VN") : "Chưa rõ thời gian"; }
function describeError(value?: string) {
  if (!value) return "Không có chi tiết lỗi từ nhà cung cấp.";
  if (/参考素材上传未确认|reference.*upload.*not.confirmed/i.test(value)) {
    return "Muse chưa xác nhận ảnh tham chiếu (0/1). Đã dừng trước khi gửi yêu cầu tạo nội dung.";
  }
  return value;
}
function fileOf(task: StudioTask): MediaFile | undefined {
  if (task.state !== "succeeded" || task.result?.code !== 200) return;
  return task.result.data?.find(item => item.mediaType === props.kind && !!item.path);
}
function resetModelOptions() {
  ratio.value = "";
  size.value = "";
  duration.value = "";
  resolution.value = "";
  clearReferences();
}
function clearReferences() {
  for (const entry of references.value) URL.revokeObjectURL(entry.preview);
  references.value = [];
}
function changeModel() {
  resetModelOptions();
  if (requestedModelKey.value) {
    void router.replace({ query: { ...route.query, providerId: undefined, modelId: undefined } });
  }
}
function removeReference(path: string) {
  const item = references.value.find(entry => entry.path === path);
  if (item) URL.revokeObjectURL(item.preview);
  references.value = references.value.filter(entry => entry.path !== path);
}
async function loadModels() {
  const version = scopeVersion;
  modelsLoading.value = true;
  try {
    const loaded = await readNodeModels<NodeMediaModel>("media", undefined, true);
    if (version !== scopeVersion) return;
    models.value = loaded;
    const preferredKey = requestedModelKey.value || modelKey.value;
    const preferredModel = availableModels.value.find(item => modelKeyOf(item) === preferredKey);
    const nextModel = preferredModel ?? (requestedModelKey.value ? undefined : availableModels.value[0]);
    const nextKey = nextModel ? modelKeyOf(nextModel) : "";
    if (nextKey !== modelKey.value) {
      modelKey.value = nextKey;
      resetModelOptions();
    }
  } catch (cause) { if (version === scopeVersion) ElMessage.error(messageOf(cause)); }
  finally { if (version === scopeVersion) modelsLoading.value = false; }
}
function messageOf(cause: unknown) {
  return axios.isAxiosError<{ message?: string }>(cause) ? cause.response?.data.message || cause.message
    : cause instanceof Error ? cause.message : "Không thể hoàn tất thao tác";
}

function readPendingIds(): PendingStudioId[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(pendingStorageKey) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is PendingStudioId => {
      return item && typeof item === "object" && /^[0-9a-f-]{36}$/i.test(item.taskId)
        && typeof item.directory === "string" && typeof item.ownerId === "string"
        && ["image", "video"].includes(item.kind) && Number.isFinite(item.createdAt);
    }).slice(-100) : [];
  } catch { return []; }
}
function savePendingIds(entries: PendingStudioId[]) {
  try { sessionStorage.setItem(pendingStorageKey, JSON.stringify(entries.slice(-100))); }
  catch { /* HTTP server still keeps accepted task IDs even without browser session storage. */ }
}
function rememberPendingId(taskId: string, taskDirectory: string) {
  savePendingIds([...readPendingIds().filter(item => item.taskId !== taskId), {
    taskId, directory: taskDirectory, kind: props.kind, ownerId: currentUser.value?.id ?? "standalone", createdAt: Date.now(),
  }]);
}
function forgetPendingId(taskId: string) {
  savePendingIds(readPendingIds().filter(item => item.taskId !== taskId));
}

async function saveReference(file: File, version: number, existingPath?: string) {
  if (version !== scopeVersion || !directory.value || !supportsReferences.value || references.value.length >= maxReferences.value) return;
  if (!referenceMimeTypes.value.includes(file.type) || !file.size || file.size > maxReferenceBytes.value) {
    throw new Error(`Ảnh tham chiếu phải đúng định dạng và không vượt ${(maxReferenceBytes.value / 1024 / 1024).toFixed(1)} MiB.`);
  }
  const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" } as Record<string, string>)[file.type];
  if (!extension) throw new Error("Ảnh phải có định dạng PNG, JPEG, WebP, GIF hoặc AVIF.");
  const path = existingPath ?? `studioReference${crypto.randomUUID().replaceAll("-", "")}.${extension}`;
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())), byte => byte.toString(16).padStart(2, "0")).join("");
  if (version !== scopeVersion) return;
  if (references.value.some(item => item.path === path || item.digest === digest)) return;
  references.value.push({ path, mimeType: file.type, name: file.name, preview: URL.createObjectURL(file), digest, file: existingPath ? undefined : file });
}
async function uploadReferences(event: Event) {
  const input = event.target as HTMLInputElement;
  const candidates = Array.from(input.files ?? []);
  input.value = "";
  if (!candidates.length || referenceBusy.value) return;
  const version = scopeVersion;
  if (candidates.length > maxReferences.value - references.value.length) {
    ElMessage.warning(`Mô hình này nhận tối đa ${maxReferences.value} ảnh tham chiếu.`);
    return;
  }
  referenceBusy.value = true;
  try {
    for (const file of candidates) await saveReference(file, version);
  } catch (cause) { ElMessage.error(messageOf(cause)); }
  finally { referenceBusy.value = false; }
}
function canSelectAsset(entry: AssetEntry) {
  return entry.type === "file" && /\.(png|jpe?g|webp|gif|avif)$/i.test(entry.name);
}
async function useCurrentImage(task: StudioTask) {
  const media = fileOf(task);
  if (!media || media.mediaType !== "image" || referenceBusy.value) return;
  const version = scopeVersion;
  referenceBusy.value = true;
  try {
    const bytes = await files.read(media.path);
    const file = new File([bytes], media.path.split("/").at(-1) ?? "Ảnh hiện tại", { type: media.mimeType });
    await saveReference(file, version, media.path);
  } catch (cause) { ElMessage.error(messageOf(cause)); }
  finally { referenceBusy.value = false; }
}
async function selectAsset(entry: AssetEntry) {
  if (!canSelectAsset(entry) || referenceBusy.value) return;
  const version = scopeVersion;
  referenceBusy.value = true;
  try {
    const response = await axios.get<Blob>("/api/assets/read", { params: { path: entry.path }, responseType: "blob" });
    const mime = response.data.type || ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif" } as Record<string, string>)[entry.name.split(".").at(-1)?.toLowerCase() ?? ""] || "";
    await saveReference(new File([response.data], entry.name, { type: mime }), version);
    if (version === scopeVersion) assetPickerVisible.value = false;
  } catch (cause) { ElMessage.error(messageOf(cause)); }
  finally { referenceBusy.value = false; }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store", signal: AbortSignal.timeout(15000), ...options,
    headers: { "x-toonflow-workspace": "1", ...(options?.body ? { "Content-Type": "application/json" } : {}), ...options?.headers },
  });
  const result = await response.json().catch(() => null) as { code: number; message: string; data: T } | null;
  if (!result || result.code === undefined) throw Object.assign(new Error(`Máy chủ trả phản hồi không đọc được (HTTP ${response.status}).`), { status: response.status });
  if (!response.ok || result.code !== 200) throw Object.assign(new Error(describeError(result.message)), { status: response.status });
  return result.data;
}
function updateQueue(queue?: StudioQueueStatus) {
  if (!queue) return false;
  if (!queueLimitSaving.value) queueLimit.value = queue.limit;
  const changed = queueRunning.value !== queue.running || queueWaiting.value !== queue.queued;
  queueRunning.value = queue.running;
  queueWaiting.value = queue.queued;
  return changed;
}
async function saveQueueLimit(limit: number) {
  const version = scopeVersion;
  queueLimitSaving.value = true;
  try {
    const result = await request<{ limit: number }>("/api/mediaStudio/queueLimit", {
      method: "PUT", body: JSON.stringify({ mediaType: props.kind, limit }),
    });
    if (version === scopeVersion) queueLimit.value = result.limit;
  } catch (cause) {
    if (version === scopeVersion) ElMessage.error(messageOf(cause));
  } finally {
    queueLimitSaving.value = false;
    void refreshStatuses();
  }
}
async function loadHistory() {
  if (!directory.value) { tasks.value = []; return; }
  const sequence = ++historySequence;
  historyLoading.value = true;
  historyError.value = "";
  try {
    const data = await request<{ entries: StudioTask[] }>(`/api/mediaStudio/list?directory=${encodeURIComponent(directory.value)}&mediaType=${props.kind}&includeActive=1`);
    if (sequence !== historySequence) return;
    const known = new Set(data.entries.map(item => item.taskId));
    const fromSession = readPendingIds().filter(item => item.directory === directory.value
      && item.kind === props.kind && item.ownerId === (currentUser.value?.id ?? "standalone"));
    const localPending = tasks.value.filter(item => ["queued", "running", "interrupted"].includes(item.state) && !known.has(item.taskId));
    const localIds = new Set(localPending.map(item => item.taskId));
    const unresolved = fromSession.filter(item => !known.has(item.taskId) && !localIds.has(item.taskId))
      .map(item => ({ taskId: item.taskId, state: "interrupted" as const, resumable: false, createdAt: item.createdAt }));
    for (const item of fromSession) if (known.has(item.taskId)) forgetPendingId(item.taskId);
    tasks.value = [...localPending, ...unresolved, ...data.entries].sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0));
    if (!tasks.value.some(task => task.taskId === selectedTaskId.value)) selectedTaskId.value = tasks.value[0]?.taskId ?? "";
  } catch (cause) { if (sequence === historySequence) historyError.value = messageOf(cause); }
  finally { if (sequence === historySequence) historyLoading.value = false; }
}
async function refreshStatuses(resume = false) {
  if (!mounted || !directory.value || statusBusy.value || submitting.value || cancelling.value) return;
  const version = scopeVersion;
  const active = resume ? tasks.value.filter(item => item.taskId === latestTask.value?.taskId && item.state === "interrupted")
    : orderedTasks.value.filter(item => item.state === "queued" || item.state === "running");
  statusBusy.value = true;
  try {
    const taskIds = active.slice(0, 100).map(item => item.taskId);
    const [queue, items] = await Promise.all([
      request<{ queue?: StudioQueueStatus }>(`/api/mediaStudio/list?directory=${encodeURIComponent(directory.value)}&mediaType=${props.kind}&queueOnly=1`),
      taskIds.length ? request<StudioTask[]>("/api/ai/media/tasks/status", {
        method: "POST", body: JSON.stringify({ directory: directory.value, taskIds, ...(resume ? { resume: true } : {}) }),
      }) : Promise.resolve([]),
    ]);
    if (version !== scopeVersion) return;
    queueError.value = "";
    let changed = updateQueue(queue.queue);
    if (resume && items[0]?.state === "interrupted" && (queueWaiting.value || queueRunning.value >= queueLimit.value)) {
      ElMessage.info("Hãy đợi hàng chờ có chỗ trống trước khi khôi phục tác vụ.");
    }
    for (const item of items) {
      const task = tasks.value.find(task => task.taskId === item.taskId);
      if (!task) continue;
      changed ||= task.state !== item.state;
      Object.assign(task, item);
    }
    if (changed) void loadHistory();
  } catch (cause) {
    if (version === scopeVersion) queueError.value = `Không thể cập nhật hàng chờ: ${messageOf(cause)}`;
  }
  finally { statusBusy.value = false; }
}
async function cancelTask(task: StudioTask) {
  if (cancelling.value || !directory.value) return;
  const version = scopeVersion;
  cancelling.value = true;
  try {
    await request("/api/ai/media/tasks/cancel", {
      method: "POST", body: JSON.stringify({ directory: directory.value, taskIds: [task.taskId] }), signal: AbortSignal.timeout(30000),
    });
    if (version === scopeVersion) await loadHistory();
  } catch (cause) { if (version === scopeVersion) ElMessage.error(messageOf(cause)); }
  finally { cancelling.value = false; }
}
watch([directory, () => selectedMedia.value?.path, () => selectedMedia.value?.mimeType, previewRefresh],
  ([workspace, path, mimeType], _previous, onCleanup) => {
    previewUrl.value = "";
    previewError.value = "";
    if (!workspace || !path) return;
    const lease = files.acquireUrl(path, mimeType);
    let active = true;
    onCleanup(() => { active = false; lease.release(); });
    void lease.url.then(url => {
      if (active) previewUrl.value = url;
    }, () => {
      if (active) previewError.value = "Không đọc được tệp kết quả trong dự án.";
    });
  });

function previewDecodeFailed() {
  if (previewUrl.value) previewError.value = "Trình duyệt không mở được định dạng hoặc nội dung tệp kết quả.";
}
async function refreshAll() { await Promise.all([loadModels(), loadHistory()]); await refreshStatuses(); }
async function submitTask() {
  if (!canSubmit.value || !model.value) return;
  const current = model.value;
  const taskId = crypto.randomUUID();
  const referencesSnapshot = [...references.value];
  const studioDirectory = directory.value;
  const version = scopeVersion;
  const input: Record<string, unknown> = {
    directory: studioDirectory, mediaType: props.kind, taskId, studioQueue: true,
    providerId: current.providerId, modelId: current.modelId, prompt: prompt.value.trim(), outputDirectory: "assets/generated",
  };
  if (ratio.value && ratioOptions.value.includes(ratio.value)) input.ratio = ratio.value;
  if (props.kind === "image") {
    if (size.value && sizeOptions.value.includes(size.value)) input.size = size.value;
    if (supportsReferences.value && referencesSnapshot.length) input.images = referencesSnapshot.map(item => ({ path: item.path, mimeType: item.mimeType }));
  } else {
    if (duration.value && durationOptions.value.includes(Number(duration.value))) input.duration = Number(duration.value);
    if (resolution.value && resolutionOptions.value.includes(resolution.value)) input.resolution = resolution.value;
    if (supportsReferences.value && referencesSnapshot[0]) input.firstFrame = { path: referencesSnapshot[0].path, mimeType: referencesSnapshot[0].mimeType };
    if (current.providerId.startsWith("mac2Api")) input.mode = referencesSnapshot.length ? "singleImage" : "text";
    if (current.referenceLimits && referencesSnapshot.length > 1) {
      delete input.firstFrame;
      input.images = referencesSnapshot.map(item => ({ path: item.path, mimeType: item.mimeType }));
      input.mode = [`imageReference:${referencesSnapshot.length}`];
    }
  }
  const task = reactive<StudioTask>({ taskId, state: "queued", createdAt: Date.now(), prompt: prompt.value.trim(), providerId: current.providerId, modelId: current.modelId });
  submitError.value = "";
  submitting.value = true;
  let submittingRequest = false;
  try {
    const targetFiles = useWorkspaceFiles(studioDirectory);
    for (const reference of referencesSnapshot) {
      if (version !== scopeVersion) return;
      if (reference.file) {
        await targetFiles.write(reference.path, reference.file, true);
        reference.file = undefined;
      }
    }
    if (version !== scopeVersion) return;
    // ACT: Sau khi ghi ảnh tham chiếu thành công, lưu ID trước khi gửi. Không tự gửi lại khi mất phản hồi.
    rememberPendingId(taskId, studioDirectory);
    tasks.value.unshift(task);
    selectedTaskId.value = taskId;
    submittingRequest = true;
    const result = await request<{ taskId: string }>("/api/ai/media/generate", { method: "POST", body: JSON.stringify(input), signal: AbortSignal.timeout(30000) });
    if (result.taskId !== taskId) throw new Error("Máy chủ trả ID tác vụ khác ID đã lưu. Cần kiểm tra thủ công trước khi tiếp tục.");
    forgetPendingId(taskId);
  } catch (cause) {
    if (!submittingRequest) {
      if (version === scopeVersion) submitError.value = `Không lưu được ảnh tham chiếu: ${messageOf(cause)}`;
      return;
    }
    const status = (cause as { status?: number })?.status;
    const rejected = status !== undefined && [400, 401, 403, 404, 405, 413, 415, 422, 429].includes(status);
    if (rejected) {
      forgetPendingId(taskId);
      task.state = "failed";
      task.result = { code: status, message: messageOf(cause), data: null };
    } else {
      task.state = "interrupted";
      task.resumable = true;
    }
    if (version !== scopeVersion) return;
    const detail = messageOf(cause);
    submitError.value = status === 429 ? "Quá nhiều tác vụ (HTTP 429). Hãy chờ và kiểm tra tác vụ hiện tại trước khi tạo tiếp."
      : rejected ? detail : `Chưa xác nhận được tác vụ ${taskId}. Hãy kiểm tra ID này trong lịch sử trước khi gửi lại. ${detail}`;
  } finally {
    submitting.value = false;
    if (mounted && version === scopeVersion) {
      void loadHistory();
      void refreshStatuses();
    }
  }
}
async function downloadResult(task: StudioTask) {
  const media = fileOf(task);
  if (!media) return;
  try {
    const bytes = await files.read(media.path);
    const url = URL.createObjectURL(new Blob([bytes], { type: media.mimeType }));
    const a = document.createElement("a");
    a.href = url; a.download = media.path.split("/").at(-1) ?? "media";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (cause) { ElMessage.error(messageOf(cause)); }
}
async function saveToLibrary(task: StudioTask) {
  if (currentUser.value?.role === "user") return;
  const media = fileOf(task);
  if (!media) return;
  try {
    const bytes = await files.read(media.path);
    const extension = media.path.split(".").at(-1) ?? (props.kind === "image" ? "png" : "mp4");
    const name = `xuong${props.kind === "image" ? "Anh" : "Video"}-${task.taskId.replaceAll("-", "")}.${extension}`;
    await axios.put("/api/assets/save", new Blob([bytes], { type: media.mimeType }), {
      params: { path: name }, headers: { "Content-Type": "application/octet-stream" },
    });
    ElMessage.success("Đã lưu bản sao vào thư viện tài nguyên MacFlow.");
  } catch (cause) { ElMessage.error(messageOf(cause)); }
}
async function sendToCanvas(task: StudioTask) {
  const media = fileOf(task);
  if (!media || !directory.value) return;
  queueStudioMediaForCanvas({ directory: directory.value, ...media });
  await router.push("/workspace");
}
function openMediaSettings() {
  if (currentUser.value?.role === "user") {
    ElMessage.info("Tài khoản này không có quyền sửa mô hình đa phương tiện. Hãy liên hệ quản trị viên MacFlow để cấu hình.");
    return;
  }
  settingsVisible.value = true;
  nextTick(() => settingsRef.value?.openPanel("mediaModel"));
}
watch(requestedModelKey, key => { if (key && !modelsLoading.value) void loadModels(); });
watch([() => props.kind, directory, () => currentUser.value?.id], async () => {
  scopeVersion++;
  historySequence++;
  tasks.value = [];
  selectedTaskId.value = "";
  submitError.value = "";
  historyError.value = "";
  queueError.value = "";
  historyLoading.value = false;
  queueLimit.value = 1;
  queueRunning.value = 0;
  queueWaiting.value = 0;
  clearReferences();
  modelKey.value = "";
  resetModelOptions();
  await refreshAll();
}, { immediate: false });
onMounted(() => {
  mounted = true;
  prompt.value = takeStudioPrompt(directory.value, props.kind) ?? prompt.value;
  void refreshAll();
  timer = setInterval(() => { if (document.visibilityState !== "hidden") void refreshStatuses(); }, 3000);
});
onBeforeUnmount(() => {
  mounted = false;
  scopeVersion++;
  historySequence++;
  if (timer) clearInterval(timer);
  clearReferences();
  // ACT: Không abort task server khi đổi xưởng; ID và tiến độ được lưu server để khôi phục.
});
</script>

<style scoped lang="scss">
.mediaStudio {
  display: grid;
  grid-template-columns: 226px minmax(0, 1fr);
  height: 100dvh;
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  .studioSidebar {
    display: flex; flex-direction: column; padding: 23px 14px 18px;
    background: var(--el-bg-color); border-right: 1px solid var(--el-border-color-light);
    .studioBrand { display: flex; gap: 11px; align-items: center; padding: 3px 13px 27px; font-size: 20px; img { width: 31px; height: 31px; } }
    .studioNavigation { display: grid; gap: 7px;
      a { display: flex; align-items: center; gap: 12px; text-decoration: none; padding: 12px; border-radius: 10px; color: var(--el-text-color-regular); font-weight: 500; transition: background .12s;
        &:hover { background: var(--el-fill-color-light); }
        &.active, &.router-link-active { background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
      }
    }
    .studioSidebarFooter { margin-top: auto; display: grid; gap: 8px; min-width: 0; .workspaceName { display: flex; gap: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; align-items: center; font-size: 12px; color: var(--el-text-color-secondary); } }
  }
  .studioMain { overflow: auto; padding: clamp(18px, 3vw, 40px); }
  .studioHeader { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 26px;
    h1 { margin: 5px 0 7px; font-size: clamp(24px, 3vw, 32px); font-weight: 700; }
    p { margin: 0; color: var(--el-text-color-secondary); font-size: 14px; }
    .studioEyebrow { font-size: 11px; letter-spacing: .16em; font-weight: 700; color: var(--el-color-primary); }
  }
  .studioHeaderActions { display: flex; flex-wrap: wrap; gap: 8px; :deep(.el-button) { margin-left: 0; } }
  .studioColumns { display: grid; grid-template-columns: minmax(320px, 440px) minmax(0, 1fr); align-items: start; gap: 22px; margin-top: 20px; }
  :deep(.el-card) { border-radius: 16px; }
  :deep(.el-card__header) { padding: 19px 22px; }
  :deep(.el-card__body) { padding: 22px; }
  .studioCardHeading { display: flex; justify-content: space-between; align-items: center; gap: 8px; > span { display: flex; gap: 10px; align-items: center; font-size: 15px; font-weight: 650; } }
  .fieldLabel { display: block; margin: 22px 0 8px; font-size: 13px; font-weight: 650; span { color: var(--el-color-danger); } }
  .fieldHint { color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.5; }
  .browserModelNotice { margin-top: 12px; line-height: 1.5; }
  .fullWidth { width: 100%; }
  .studioOptions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 13px; }
  .referenceHeading { display: flex; justify-content: space-between; align-items: end; color: var(--el-text-color-secondary); font-size: 12px; }
  .referenceArea { display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
    .referenceItem { position: relative; width: 94px; img { width: 94px; height: 94px; object-fit: cover; border-radius: 10px; } small { display: block; max-width: 94px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      :deep(.el-button) { position: absolute; top: 3px; right: 3px; }
    }
    .referenceAdd { display: grid; place-content: center; gap: 7px; justify-items: center; color: var(--el-text-color-secondary); border: 1px dashed var(--el-border-color); background: var(--el-fill-color-light); border-radius: 10px; width: 94px; height: 94px; cursor: pointer; font: inherit; font-size: 11px; }
  }
  .emptyModels { text-align: center; margin-top: 10px; }
  .studioSubmit { display: grid; margin: 16px 0 14px; }
  .studioResults { display: grid; gap: 22px; min-width: 0; }
  .resultCard { display: grid; gap: 15px; }
  .resultMeta { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--el-text-color-secondary); }
  .mediaPreview, .resultPlaceholder { min-height: 230px; max-height: 520px; border-radius: 12px; display: grid; place-content: center; background: var(--el-fill-color-light); overflow: hidden;
    img, video { display: block; width: 100%; max-height: 520px; object-fit: contain; }
  }
  .previewLoading, .resultPlaceholder { display: flex; justify-content: center; align-items: center; flex-direction: column; gap: 12px; color: var(--el-text-color-secondary); }
  .spinning { animation: studioSpin 2s linear infinite; }
  .taskInfo { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; small { color: var(--el-text-color-secondary); } code { overflow-wrap: anywhere; font-size: 11px; } }
  .taskError { color: var(--el-color-danger); font-size: 12px; overflow-wrap: anywhere; }
  .resultActions { display: flex; flex-wrap: wrap; gap: 8px; }
  .taskList { display: grid; gap: 6px; max-height: 460px; overflow: auto; }
  .taskRow { width: 100%; display: flex; align-items: center; gap: 12px; text-align: left; padding: 12px; border: 1px solid transparent; border-radius: 10px; background: transparent; cursor: pointer; color: inherit;
    &:hover, &.selected { background: var(--el-fill-color-light); }
    &.selected { border-color: var(--el-color-primary-light-5); }
    .taskDescription { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; } small { font-size: 11px; color: var(--el-text-color-secondary); } }
    .taskIcon { flex: none; }
  }
}
@keyframes studioSpin { to { transform: rotate(360deg); } }
@media (max-width: 1080px) { .mediaStudio { grid-template-columns: 68px minmax(0, 1fr); .studioSidebar { padding: 15px 6px; .studioBrand { justify-content: center; padding: 3px 0 20px; strong { display: none; } } .studioNavigation a { font-size: 0; justify-content: center; padding: 12px; } .studioSidebarFooter { .workspaceName { display: none; } :deep(.el-button) { font-size: 0; } } } .studioColumns { grid-template-columns: minmax(0, 1fr); } } }
@media (max-width: 600px) { .mediaStudio { grid-template-columns: 1fr; grid-template-rows: auto minmax(0,1fr); .studioSidebar { padding: 8px 12px; flex-direction: row; align-items: center; justify-content: space-between; border-right: 0; border-bottom: 1px solid var(--el-border-color-light); .studioBrand { display: none; } .studioNavigation { display: flex; gap: 3px; a { font-size: 0; padding: 10px; } } .studioSidebarFooter { margin: 0; } } .studioMain { padding: 18px 12px; } .studioColumns { gap: 13px; } :deep(.el-card__body) { padding: 16px; } } }
@media (max-width: 600px) { .mediaStudio .studioHeader { flex-wrap: wrap; } }
</style>
