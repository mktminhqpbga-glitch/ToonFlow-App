<template>
  <div class="mediaStudio">
    <aside class="studioSidebar" aria-label="Điều hướng MacFlow">
      <div class="studioBrand"><img :src="logoUrl" alt="" /><strong>MacFlow</strong></div>
      <creativeNavigation compact :showCharacters="!publicWeb" modelSettings @characters="charactersVisible = true" @settings="openMediaSettings" />
      <div class="studioSidebarFooter">
        <span v-if="workspaceStore.project" class="workspaceName" :title="workspaceStore.project.directory"><icon-folder :size="16" /> {{ workspaceStore.project.name }}</span>
      </div>
    </aside>

    <main class="studioMain">
      <header class="studioHeader">
        <div>
          <h1>{{ kind === "image" ? "Xưởng tạo ảnh" : "Xưởng tạo video" }}</h1>
          <p v-if="showVideoFlow">Từ ý tưởng đến kịch bản, ảnh mở đầu và video.</p>
          <p v-else-if="showMoneyPrinter">Ghép ảnh, clip, lời đọc và phụ đề thành video.</p>
          <p v-else-if="showClipForge">Dựng video từ ảnh sản phẩm và lời thoại tiếng Việt.</p>
          <p v-else>Biến mô tả thành {{ kind === "image" ? "hình ảnh" : "video" }} bằng mô hình đã cài trong MacFlow.</p>
        </div>
        <div v-if="!showClipForge && !showMoneyPrinter" class="studioHeaderActions">
          <el-button type="primary" plain :icon="IconGitBranch" :disabled="!directory" @click="flowSetupVisible = true">Thiết lập luồng</el-button>
          <el-button :icon="IconRefresh" :loading="modelsLoading || historyLoading" @click="refreshAll">Làm mới</el-button>
        </div>
      </header>

      <nav v-if="kind === 'video'" class="videoModes" aria-label="Cách tạo video">
        <el-button :type="studioMode === 'single' ? 'primary' : 'default'" :plain="studioMode !== 'single'" :aria-pressed="studioMode === 'single'" @click="switchStudio('single')">Tạo từng video</el-button>
        <el-button :type="showVideoFlow ? 'primary' : 'default'" :plain="!showVideoFlow" :aria-pressed="showVideoFlow" @click="switchStudio('flow')">Tự động theo luồng</el-button>
        <el-button :type="showClipForge ? 'primary' : 'default'" :plain="!showClipForge" :aria-pressed="showClipForge" @click="switchStudio('clipForge')">Video từ ảnh sản phẩm</el-button>
        <el-button v-if="canRenderFromMedia" :type="showMoneyPrinter ? 'primary' : 'default'" :plain="!showMoneyPrinter" :aria-pressed="showMoneyPrinter" @click="switchStudio('render')">Dựng video từ tư liệu</el-button>
      </nav>

      <el-alert v-if="!directory" type="warning" :closable="false" showIcon>
        <template #title>Chưa có dự án làm việc</template>
        Chọn hoặc mở một dự án ở trang Tổng quan để lưu yêu cầu và kết quả vào đúng nơi.
        <router-link to="/home">Mở Tổng quan</router-link>
      </el-alert>

      <clipForgeStudio v-if="kind === 'video' && directory && clipForgeOpened" v-show="showClipForge" :key="directory" :directory="directory" :active="showClipForge" />
      <moneyPrinterStudio v-if="kind === 'video' && directory && canRenderFromMedia && moneyPrinterOpened" v-show="showMoneyPrinter"
        :key="JSON.stringify([directory, ownerId])" :directory="directory" :ownerId="ownerId" :active="showMoneyPrinter" />

      <videoFlowRun v-if="kind === 'video' && directory && videoFlowOpened" v-show="showVideoFlow" :key="JSON.stringify([directory, ownerId])"
        :directory="directory" :ownerId="ownerId" :catalogRevision="flowCatalogRevision" @settings="openMediaSettings" />

      <div v-show="studioMode === 'single'" class="studioColumns">
        <section class="studioComposer" aria-label="Tạo nội dung">
          <el-card shadow="never">
            <template #header><div class="studioCardHeading"><span><icon-sparkles :size="19" /> Tạo {{ kind === "image" ? "ảnh mới" : "video mới" }}</span></div></template>

            <div class="promptHeading">
              <label class="fieldLabel" for="studioPrompt">Mô tả ý tưởng <span>*</span></label>
              <el-button v-if="kind === 'video'" size="small" plain :icon="IconSparkles" :disabled="!directory || submitting" @click="promptWriterVisible = true">Viết prompt</el-button>
            </div>
            <el-input id="studioPrompt" v-model="prompt" type="textarea" resize="vertical" :rows="6"
              :maxlength="100000" showWordLimit :placeholder="kind === 'image' ? 'Mô tả bối cảnh, nhân vật, ánh sáng và phong cách bạn muốn tạo…' : 'Mô tả cảnh quay, chuyển động, hành động và không khí video…'"
              :disabled="submitting" />

            <p v-if="model" class="fieldHint">Đang dùng {{ model.label }}</p>
            <details class="studioAdvanced">
              <summary>Cài đặt nâng cao</summary>
              <label class="fieldLabel" for="studioModel">Mô hình {{ kind === "image" ? "ảnh" : "video" }}</label>
              <el-select id="studioModel" v-model="modelKey" class="fullWidth" filterable :loading="modelsLoading" placeholder="Chọn mô hình tạo nội dung" @change="changeModel">
                <el-option v-for="model in availableModels" :key="modelKeyOf(model)" :value="modelKeyOf(model)"
                  :label="`${model.label} · ${model.providerLabel}`" />
              </el-select>
              <el-alert v-if="!modelsLoading && requestedModelKey && modelKey !== requestedModelKey" type="warning" :closable="false" showIcon
                title="Mô hình cần thử chưa có trong xưởng. Hãy lưu mô hình và kiểm tra kết nối mac2API trong Cài đặt, sau đó bấm Làm mới." />
              <el-alert v-if="model && ['chatgpt/image', 'gemini-web/image'].includes(model.modelId)" class="browserModelNotice" type="info" :closable="false" showIcon>
                Khi dùng ChatGPT Web hoặc Gemini Web, hãy mở Chrome trên máy đã kết nối với MacFlow.
              </el-alert>


              <div v-if="model && (ratioOptions.length || sizeOptions.length || durationOptions.length || resolutionOptions.length)" class="studioOptions">
                <div v-if="ratioOptions.length"><label class="fieldLabel" for="studioRatio">Tỷ lệ khung hình</label>
                  <el-select id="studioRatio" v-model="ratio" class="fullWidth" placeholder="Mặc định của mô hình" clearable><el-option v-for="item in ratioOptions" :key="item" :label="item" :value="item" /></el-select>
                </div>
                <div v-if="sizeOptions.length"><label class="fieldLabel" for="studioImageSize">Độ phân giải</label>
                  <el-select id="studioImageSize" v-model="size" class="fullWidth" placeholder="Mặc định" clearable><el-option v-for="item in sizeOptions" :key="item" :label="item === 'auto' ? 'Tự động' : item" :value="item" /></el-select>
                  <p v-if="model.localImageSizing" class="fieldHint">Chọn Tự động để giữ kích thước gốc của ảnh.</p>
                </div>
                <div v-if="durationOptions.length"><label class="fieldLabel" for="studioDuration">Thời lượng</label>
                  <el-select id="studioDuration" v-model="duration" class="fullWidth" placeholder="Mặc định" clearable><el-option v-for="item in durationOptions" :key="item" :label="`${item} giây`" :value="item" /></el-select>
                </div>
                <div v-if="resolutionOptions.length"><label class="fieldLabel" for="studioVideoSize">Độ phân giải</label>
                  <el-select id="studioVideoSize" v-model="resolution" class="fullWidth" placeholder="Mặc định" clearable><el-option v-for="item in resolutionOptions" :key="item" :label="item" :value="item" /></el-select>
                </div>
              </div>

              <div class="studioQueue">
                <label class="fieldLabel" for="studioQueueLimit">Số yêu cầu chạy cùng lúc</label>
                <el-select id="studioQueueLimit" :modelValue="queueLimit" class="fullWidth" aria-label="Số yêu cầu chạy cùng lúc"
                  :disabled="!directory || queueLimitSaving" @change="saveQueueLimit">
                  <el-option v-for="limit in 10" :key="limit" :value="limit" :label="String(limit)" />
                </el-select>
              </div>
            </details>
            <el-alert v-if="!modelsLoading && (!model || model.configured === false)" type="warning" :closable="false" showIcon>
              <template #title>Chưa có mô hình sẵn sàng</template>
              Kiểm tra kết nối hoặc chọn mô hình khác trong Cài đặt nâng cao.
              <el-button size="small" @click="openMediaSettings">Mở cài đặt mô hình</el-button>
            </el-alert>

            <div class="referenceHeading"><label class="fieldLabel">{{ kind === "image" || maxReferences > 1 ? "Ảnh tham chiếu" : "Ảnh khung đầu" }}</label><span v-if="supportsReferences">{{ references.length }} / {{ maxReferences }}</span></div>
            <div v-if="supportsReferences || references.length" class="referenceArea">
              <div v-for="reference in references" :key="reference.path" class="referenceItem">
                <img v-if="reference.preview" :src="reference.preview" :alt="reference.name" /><span v-else class="referenceUnavailable">{{ reference.missing ? "Chưa mở được ảnh" : "Đang mở…" }}</span>
                <el-button circle size="small" :icon="IconX" :disabled="submitting" :aria-label="`Bỏ ${reference.name}`" @click="removeReference(reference.path)" />
                <small :title="reference.name">{{ reference.name }}</small>
              </div>
              <button v-if="supportsReferences && references.length < maxReferences" class="referenceAdd" type="button" :disabled="submitting || !directory" @click="referenceInput?.click()"><icon-plus :size="21" /><span>Tải ảnh lên</span></button>
              <el-button v-if="supportsReferences && references.length < maxReferences && currentUser?.role !== 'user'" plain :disabled="submitting || !directory" @click="assetPickerVisible = true">Chọn từ thư viện</el-button>
              <el-button v-if="canUseCharacter" plain @click="charactersVisible = true">Chọn nhân vật</el-button>
              <el-button v-if="kind === 'image' && latestTask && fileOf(latestTask) && references.length < maxReferences" plain
                :disabled="submitting || referenceBusy" @click="useCurrentImage(latestTask)">Dùng ảnh hiện tại làm tham chiếu</el-button>
            </div>
            <p v-else class="fieldHint">Mô hình được chọn chỉ hỗ trợ tạo từ văn bản; không gửi ảnh tham chiếu.</p>
            <p v-if="kind === 'video' && supportsReferences && maxReferences === 1" class="fieldHint">Ảnh đã chọn sẽ được dùng làm khung đầu.</p>
            <p v-if="referenceIssue" class="taskError" role="status">{{ referenceIssue }}</p>
            <input ref="referenceInput" type="file" :accept="referenceMimeTypes.join(',')" hidden multiple :disabled="submitting" @change="uploadReferences" />

            <p class="fieldHint" role="status">{{ queueRunning }} đang chạy · {{ queueWaiting }} đang chờ</p>
            <p v-if="queueError" class="taskError" role="status">{{ queueError }}</p>
            <p v-if="draftWarning" class="taskError" role="status">{{ draftWarning }}</p>
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
                <div v-else class="previewLoading"><icon-loader-2 :size="26" /> Đang mở kết quả…</div>
              </div>
              <div v-else class="resultPlaceholder">
                <icon-loader-2 v-if="latestTask.state === 'running'" :size="34" class="spinning" />
                <icon-alert-circle v-else-if="latestTask.state === 'failed' || latestTask.state === 'interrupted'" :size="34" />
                <icon-sparkles v-else :size="34" />
                <span>{{ statusText(latestTask) }}</span>
              </div>
              <details class="studioAdvanced">
                <summary>Thông tin tác vụ</summary>
                <div class="taskInfo"><span>Mã tra cứu</span><code>{{ latestTask.taskId }}</code></div>
              </details>
              <p v-if="latestTask.result && latestTask.result.code !== 200" class="taskError">{{ describeStudioError(latestTask.result.message, latestTask.result.code) }}</p>
              <p v-if="latestTask.state === 'interrupted'" class="fieldHint">Bấm Kiểm tra lại để tìm kết quả của yêu cầu đã gửi.</p>
              <p v-if="latestTask.statusUnavailable" class="fieldHint" role="status">Chưa kiểm tra được kết quả. Hãy thử lại sau.</p>
              <el-button v-if="latestTask.state === 'queued' || latestTask.state === 'running'" type="danger" plain
                :loading="cancelling" @click="cancelTask(latestTask)">Hủy tác vụ</el-button>
              <div v-if="fileOf(latestTask)" class="resultActions">
                <el-button :icon="IconDownload" :loading="downloadedTaskId === latestTask.taskId" @click="downloadResult(latestTask)">Tải về</el-button>
                <el-button :icon="IconFolderPlus" :disabled="currentUser?.role === 'user'" @click="saveToLibrary(latestTask)">Lưu vào thư viện</el-button>
                <el-button type="primary" plain :icon="IconLayoutDashboard" @click="sendToCanvas(latestTask)">Đưa vào Canvas</el-button>
              </div>
              <el-button v-else-if="latestTask.state === 'failed'" type="primary" plain :disabled="submitting" @click="retryTask(latestTask)">Chạy lại</el-button>
              <el-button v-else-if="latestTask.state === 'interrupted' || latestTask.statusUnavailable" plain :disabled="statusBusy || submitting" @click="refreshStatuses(true)">Kiểm tra lại</el-button>
            </div>
            <el-empty v-else description="Kết quả mới sẽ xuất hiện tại đây" :imageSize="110" />
          </el-card>
          <el-card class="studioHistory" shadow="never">
            <template #header><div class="studioCardHeading"><span><icon-history :size="19" /> Lịch sử tác vụ</span><el-button text :loading="historyLoading" :icon="IconRefresh" @click="loadHistory">Làm mới</el-button></div></template>
            <div v-if="tasks.length" class="taskList">
              <button v-for="task in orderedTasks" :key="task.taskId" type="button" class="taskRow" :class="{ selected: selectedTaskId === task.taskId }" @click="selectedTaskId = task.taskId">
                <span class="taskIcon"><icon-photo v-if="kind === 'image'" :size="19" /><icon-video v-else :size="19" /></span>
                <span class="taskDescription"><strong>{{ task.prompt || task.modelId || "Tác vụ tạo nội dung" }}</strong><small>{{ formatDate(task.createdAt) }}</small></span>
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
      :directory="directory" :mediaModels="models" @saved="flowCatalogRevision++" />
    <settings v-model="settingsVisible" ref="settingsRef" />
    <writeVideoPrompt v-if="promptWriterVisible && kind === 'video' && directory" :key="directory" v-model="promptWriterVisible"
      :directory="directory" :ownerId="ownerId" :prompt="prompt" :ratio="ratio || ''" :duration="duration || null"
      :hasReference="!!references.length" @apply="prompt = $event" />
    <characterLibrary v-if="charactersVisible" v-model="charactersVisible" :canUse="canUseCharacter" @select="useCharacterPhoto" />
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
import { createNodeRequestId, readNodeModels, type NodeMediaModel } from "@toonflow/nodes-scaffold/nodeAi";
import { useWorkspaceStore } from "@/stores/workspace";
import { currentUser, publicWeb } from "@/stores/multiTenant";
import useWorkspaceFiles from "@/lib/workspaceFiles";
import { queueStudioMediaForCanvas } from "@/lib/mediaStudioTransfer";
import { takeStudioPrompt } from "@/lib/studioPromptTransfer";
import settings from "@/components/settings/index.vue";
import assetLibrary from "@/pages/workspace/panels/canvas/components/assetLibrary.vue";
import creativeNavigation from "@/components/creativeNavigation.vue";
import characterLibrary from "@/components/characterLibrary.vue";
import logoUrl from "@toonflow/assets/logo.svg";
import { describeStudioError, requestStudio, StudioRequestError } from "./studioRequests";
import { readStudioAttempts, readStudioDraft, saveStudioBrowserState, type StudioAttempt, type StudioSubmission } from "./studioBrowserState";
import saveFile from "@/lib/saveFile";

type MediaFile = { path: string; mimeType: string; mediaType: "image" | "video" };
type StudioTask = {
  taskId: string; state: "queued" | "running" | "interrupted" | "succeeded" | "failed" | "cancelled";
  resumable?: boolean; statusUnavailable?: boolean; createdAt?: number; updatedAt?: number; prompt?: string; providerId?: string; modelId?: string;
  result?: { code: number; message: string; data: MediaFile[] | null };
  cancelDisposition?: "confirmed" | "requested" | "running" | "terminal" | "localOnly" | "notSent";
};
type ImageReference = { path: string; mimeType: string; name: string; preview: string; digest?: string; bytes: number; missing?: boolean; release: () => void };
type AssetEntry = { name: string; type: "file" | "directory"; path: string };
type StudioQueueStatus = { limit: number; running: number; queued: number };


const props = defineProps<{ kind: "image" | "video" }>();
const studioFlowSetup = defineAsyncComponent(() => import("./studioFlowSetup.vue"));
const clipForgeStudio = defineAsyncComponent(() => import("./clipForgeStudio.vue"));
const moneyPrinterStudio = defineAsyncComponent(() => import("./moneyPrinterStudio.vue"));
const writeVideoPrompt = defineAsyncComponent(() => import("./writeVideoPrompt.vue"));
const promptWriterVisible = ref(false);
const charactersVisible = ref(false);
const videoFlowRun = defineAsyncComponent(() => import("./videoFlowRun.vue"));
const router = useRouter();
const route = useRoute();
const canRenderFromMedia = computed(() => !publicWeb.value && currentUser.value?.role !== "user");
const studioMode = computed(() => {
  if (props.kind !== "video") return "single";
  if (route.query.studio === "render" && canRenderFromMedia.value) return "render";
  return route.query.studio === "clipForge" ? "clipForge" : route.query.studio === "flow" ? "flow" : "single";
});
const showClipForge = computed(() => studioMode.value === "clipForge");
const showMoneyPrinter = computed(() => studioMode.value === "render");
const showVideoFlow = computed(() => studioMode.value === "flow");
const clipForgeOpened = ref(showClipForge.value);
const moneyPrinterOpened = ref(showMoneyPrinter.value);
const videoFlowOpened = ref(showVideoFlow.value);
const flowCatalogRevision = ref(0);
const ownerId = computed(() => currentUser.value?.id ?? "standalone");
watch(showClipForge, active => { if (active) clipForgeOpened.value = true; });
watch(showMoneyPrinter, active => { if (active) moneyPrinterOpened.value = true; });
watch(showVideoFlow, active => { if (active) videoFlowOpened.value = true; });

function switchStudio(mode: "single" | "flow" | "clipForge" | "render") {
  void router.replace({ query: { ...route.query, studio: mode === "single" ? undefined : mode } });
}
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
const draftWarning = ref("");
const downloadedTaskId = ref("");
const attempts = ref<StudioAttempt[]>([]);
const browserKey = computed(() => "macflow.studio.v2:" + JSON.stringify([directory.value, props.kind, ownerId.value]));
let restoringDraft = false;
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
  .sort((left, right) => Number(right.configured !== false) - Number(left.configured !== false)
    || Number(!!right.referenceLimits) - Number(!!left.referenceLimits)
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
const canUseCharacter = computed(() => canRenderFromMedia.value && !!directory.value && !submitting.value
  && !referenceBusy.value && supportsReferences.value && references.value.length < maxReferences.value);
const referenceMimeTypes = computed(() => model.value?.referenceLimits?.allowedMimeTypes
  ?? ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
const maxReferenceBytes = computed(() => model.value?.referenceLimits?.maxReferenceBytes ?? 20 * 1024 * 1024);
const ratioOptions = computed(() => model.value?.imageRatios ?? []);
const sizeOptions = computed(() => model.value?.imageSizes ?? []);
const durationOptions = computed(() => [...new Set(model.value?.durationResolutionMap?.flatMap(item => item.duration) ?? [])]);
const resolutionOptions = computed(() => [...new Set((model.value?.durationResolutionMap ?? []).filter(item => !duration.value || item.duration.includes(Number(duration.value))).flatMap(item => item.resolution))]);
const referenceIssue = computed(() => {
  if (references.value.some(ref => ref.missing)) return "Một ảnh tham chiếu không còn trong dự án. Hãy bỏ ảnh đó rồi thêm lại.";
  if (!modelsLoading.value && model.value && references.value.length && (!supportsReferences.value
    || references.value.length > maxReferences.value || references.value.some(ref => ref.bytes > maxReferenceBytes.value || !referenceMimeTypes.value.includes(ref.mimeType)))) {
    return "Một số ảnh vượt giới hạn của mô hình đang chọn. Hãy bỏ ảnh hoặc đổi mô hình trong phần Cài đặt nâng cao.";
  }
  return "";
});
const canSubmit = computed(() => !!directory.value && !!prompt.value.trim() && !!model.value && model.value.configured !== false && !submitting.value
  && !modelsLoading.value && !referenceBusy.value && !referenceIssue.value && (!requestedModelKey.value || modelKey.value === requestedModelKey.value));
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
  return ({ queued: "Đang chờ", running: "Đang xử lý", interrupted: "Gián đoạn", succeeded: "Hoàn thành", failed: "Lỗi", cancelled: "Đã huỷ" })[task.state];
}
function statusTag(state: StudioTask["state"]) {
  return ({ queued: "info", running: "warning", interrupted: "info", succeeded: "success", failed: "danger", cancelled: "info" } as const)[state];
}
function formatDate(value?: number) { return value ? new Date(value).toLocaleString("vi-VN") : "Chưa rõ thời gian"; }
function fileOf(task: StudioTask): MediaFile | undefined {
  if (task.state !== "succeeded" || task.result?.code !== 200) return;
  return task.result.data?.find(item => item.mediaType === props.kind && !!item.path);
}
function resetModelOptions() {
  ratio.value = "";
  size.value = "";
  duration.value = "";
  resolution.value = "";
}
function clearReferences() {
  for (const entry of references.value) entry.release();
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
  item?.release();
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
    const nextModel = preferredModel ?? (preferredKey ? undefined : availableModels.value.find(item => item.configured !== false));
    const nextKey = nextModel ? modelKeyOf(nextModel) : preferredKey;
    if (nextKey !== modelKey.value) {
      modelKey.value = nextKey;
      resetModelOptions();
    }
  } catch (cause) { if (version === scopeVersion) ElMessage.error(messageOf(cause)); }
  finally { if (version === scopeVersion) modelsLoading.value = false; }
}
function messageOf(cause: unknown) {
  if (cause instanceof StudioRequestError) return cause.message;
  if (axios.isAxiosError<{ message?: string }>(cause)) return describeStudioError(cause.response?.data?.message, cause.response?.status);
  return describeStudioError(cause instanceof Error ? cause.message : undefined);
}

function storeAttempt(key: string, entries: StudioAttempt[]) {
  if (key === browserKey.value) attempts.value = entries;
  try { saveStudioBrowserState(key + ":attempts", entries); }
  catch {
    if (key === browserKey.value) draftWarning.value = "Trình duyệt chưa lưu được nội dung đang làm. Hãy giữ trang mở để tiếp tục.";
  }
}

function restoreDraft() {
  restoringDraft = true;
  clearReferences();
  const draft = directory.value ? readStudioDraft(browserKey.value) : undefined;
  const transferredPrompt = takeStudioPrompt(directory.value, props.kind);
  prompt.value = transferredPrompt ?? draft?.prompt ?? "";
  modelKey.value = draft?.modelKey ?? "";
  ratio.value = draft?.ratio ?? "";
  size.value = draft?.size ?? "";
  duration.value = draft?.duration ?? "";
  resolution.value = draft?.resolution ?? "";
  selectedTaskId.value = draft?.selectedTaskId ?? "";
  attempts.value = directory.value ? readStudioAttempts(browserKey.value + ":attempts", { directory: directory.value, kind: props.kind, ownerId: ownerId.value }) : [];
  restoringDraft = false;
  if (transferredPrompt) ElMessage.success("Đã điền prompt từ bảng phân cảnh. Bạn có thể xem lại trước khi tạo.");
  if (!draft || !directory.value) return;
  const projectFiles = useWorkspaceFiles(directory.value);
  const version = scopeVersion;
  for (const saved of draft.references) {
    const lease = projectFiles.acquireUrl(saved.path, saved.mimeType);
    const reference = reactive<ImageReference>({ ...saved, preview: "", release: lease.release });
    references.value.push(reference);
    void lease.url.then(url => {
      if (version === scopeVersion) reference.preview = url;
    }).catch(() => { if (version === scopeVersion) reference.missing = true; });
  }
}

watch(() => ({
  prompt: prompt.value, modelKey: modelKey.value, ratio: ratio.value || "", size: size.value || "",
  duration: duration.value || "" as const, resolution: resolution.value || "", selectedTaskId: selectedTaskId.value,
  references: references.value.map(({ path, mimeType, name, digest, bytes }) => ({ path, mimeType, name, digest, bytes })),
}), draft => {
  if (!mounted || !directory.value || restoringDraft) return;
  try { saveStudioBrowserState(browserKey.value, draft); }
  catch { draftWarning.value = "Trình duyệt chưa lưu được nội dung đang làm. Hãy giữ trang mở để tiếp tục."; }
}, { flush: "sync" });

async function saveReference(file: File, version: number, existingPath?: string) {
  if (version !== scopeVersion || !directory.value || !supportsReferences.value || references.value.length >= maxReferences.value) return;
  if (!referenceMimeTypes.value.includes(file.type) || !file.size || file.size > maxReferenceBytes.value) {
    throw new Error(`Ảnh tham chiếu phải đúng định dạng và không vượt ${(maxReferenceBytes.value / 1024 / 1024).toFixed(1)} MiB.`);
  }
  const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" } as Record<string, string>)[file.type];
  if (!extension) throw new Error("Ảnh phải có định dạng PNG, JPEG, WebP, GIF hoặc AVIF.");
  const projectFiles = useWorkspaceFiles(directory.value);
  const path = existingPath ?? `studioReference${createNodeRequestId().replaceAll("-", "")}.${extension}`;
  const digest = crypto.subtle ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())),
    byte => byte.toString(16).padStart(2, "0")).join("") : undefined;
  if (version !== scopeVersion) return;
  if (references.value.some(item => item.path === path || digest && item.digest === digest)) return;
  if (!existingPath) await projectFiles.write(path, file, true, AbortSignal.timeout(60000));
  if (version !== scopeVersion) return;
  const preview = URL.createObjectURL(file);
  references.value.push({ path, mimeType: file.type, name: file.name.slice(0, 300), preview, digest, bytes: file.size,
    release: () => URL.revokeObjectURL(preview) });
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
    const response = await axios.get<Blob>("/api/assets/read", { params: { path: entry.path }, responseType: "blob", timeout: 60000 });
    const mime = response.data.type || ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif" } as Record<string, string>)[entry.name.split(".").at(-1)?.toLowerCase() ?? ""] || "";
    await saveReference(new File([response.data], entry.name, { type: mime }), version);
    if (version === scopeVersion) assetPickerVisible.value = false;
  } catch (cause) { ElMessage.error(messageOf(cause)); }
  finally { referenceBusy.value = false; }
}

function useCharacterPhoto(entry: AssetEntry) {
  if (!canUseCharacter.value) return;
  charactersVisible.value = false;
  void selectAsset(entry);
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
    const result = await requestStudio<{ limit: number }>("/api/mediaStudio/queueLimit", {
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
    const data = await requestStudio<{ entries: StudioTask[] }>(`/api/mediaStudio/list?directory=${encodeURIComponent(directory.value)}&mediaType=${props.kind}&includeActive=1`);
    if (sequence !== historySequence) return;
    const known = new Set(data.entries.map(item => item.taskId));
    const remainingAttempts = attempts.value.filter(attempt => !known.has(attempt.taskId));
    if (remainingAttempts.length !== attempts.value.length) storeAttempt(browserKey.value, remainingAttempts);
    const current = new Map(tasks.value.map(task => [task.taskId, task]));
    const local = remainingAttempts.map(attempt => current.get(attempt.taskId) ?? {
      taskId: attempt.taskId, state: attempt.failure ? "failed" as const : "interrupted" as const,
      createdAt: attempt.createdAt, prompt: attempt.request?.prompt,
      ...(attempt.failure ? { result: { code: 400, message: attempt.failure, data: null } } : {}),
    });
    tasks.value = [...local, ...data.entries.map(task => {
      const old = current.get(task.taskId);
      return old && (old.updatedAt ?? 0) > (task.updatedAt ?? 0) ? old : task;
    })].sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0));
    if (!tasks.value.some(task => task.taskId === selectedTaskId.value)) selectedTaskId.value = tasks.value[0]?.taskId ?? "";
  } catch (cause) { if (sequence === historySequence) historyError.value = messageOf(cause); }
  finally { if (sequence === historySequence) historyLoading.value = false; }
}
async function refreshStatuses(resume = false) {
  if (!mounted || !directory.value || statusBusy.value || submitting.value || cancelling.value) return;
  const version = scopeVersion;
  const active = resume ? tasks.value.filter(item => item.taskId === latestTask.value?.taskId && (item.state === "interrupted" || item.statusUnavailable))
    : orderedTasks.value.filter(item => item.state === "queued" || item.state === "running");
  statusBusy.value = true;
  try {
    const taskIds = active.slice(0, 100).map(item => item.taskId);
    const [queue, items] = await Promise.allSettled([
      requestStudio<{ queue?: StudioQueueStatus }>(`/api/mediaStudio/list?directory=${encodeURIComponent(directory.value)}&mediaType=${props.kind}&queueOnly=1`),
      taskIds.length ? requestStudio<StudioTask[]>("/api/ai/media/tasks/status", {
        method: "POST", body: JSON.stringify({ directory: directory.value, taskIds, ...(resume ? { resume: true } : {}) }),
      }) : Promise.resolve([]),
    ]);
    if (version !== scopeVersion) return;
    queueError.value = queue.status === "rejected" || items.status === "rejected" ? "Chưa cập nhật được hàng chờ. MacFlow sẽ thử lại." : "";
    let changed = queue.status === "fulfilled" && updateQueue(queue.value.queue);
    if (items.status === "rejected") return;
    if (resume && items.value[0]?.state === "interrupted" && (queueWaiting.value || queueRunning.value >= queueLimit.value)) {
      ElMessage.info("Hãy đợi hàng chờ có chỗ trống trước khi khôi phục tác vụ.");
    }
    for (const item of items.value) {
      const task = tasks.value.find(task => task.taskId === item.taskId);
      if (!task || (item.updatedAt !== undefined && (task.updatedAt ?? 0) > item.updatedAt)) continue;
      if (item.statusUnavailable) { task.statusUnavailable = true; continue; }
      task.statusUnavailable = false;
      changed ||= task.state !== item.state;
      Object.assign(task, item);
      if (!item.result) delete task.result;
      const pending = attempts.value.find(attempt => attempt.taskId === task.taskId);
      if (resume && item.result?.code === 404 && (pending?.request || pending?.previousTaskId) && !pending.failure) {
        // Cùng mã và nội dung nên máy chủ sẽ nhận lại yêu cầu cũ một lần nếu chưa có bản ghi.
        statusBusy.value = false;
        return await sendAttempt(pending, directory.value);
      }
    }
    if (changed) void loadHistory();
  } catch (cause) {
    if (version === scopeVersion) queueError.value = "Chưa cập nhật được hàng chờ. MacFlow sẽ thử lại.";
  }
  finally { statusBusy.value = false; }
}
async function cancelTask(task: StudioTask) {
  if (cancelling.value || !directory.value) return;
  const version = scopeVersion;
  cancelling.value = true;
  try {
    await requestStudio("/api/ai/media/tasks/cancel", {
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
function submitTask() {
  if (!canSubmit.value || !model.value) return;
  const current = model.value;
  const input: StudioSubmission = { providerId: current.providerId, modelId: current.modelId, prompt: prompt.value.trim() };
  const photos = references.value.map(({ path, mimeType }) => ({ path, mimeType }));
  if (ratio.value && ratioOptions.value.includes(ratio.value)) input.ratio = ratio.value;
  if (props.kind === "image") {
    if (size.value && sizeOptions.value.includes(size.value)) input.size = size.value;
    if (photos.length) input.images = photos;
  } else {
    if (duration.value && durationOptions.value.includes(duration.value)) input.duration = duration.value;
    if (resolution.value && resolutionOptions.value.includes(resolution.value)) input.resolution = resolution.value;
    if (photos[0]) input.firstFrame = photos[0];
    if (current.providerId.startsWith("mac2Api")) input.mode = photos.length ? "singleImage" : "text";
    if (current.referenceLimits && photos.length > 1) {
      delete input.firstFrame;
      input.images = photos;
      input.mode = ["imageReference:" + photos.length];
    }
  }
  void sendAttempt({ taskId: createNodeRequestId(), createdAt: Date.now(), request: input }, directory.value);
}

function retryTask(task: StudioTask) {
  if (task.state !== "failed") return;
  const local = attempts.value.find(item => item.taskId === task.taskId);
  void sendAttempt({ taskId: createNodeRequestId(), createdAt: Date.now(),
    ...(local?.request ? { request: local.request } : { previousTaskId: local?.previousTaskId ?? task.taskId }) }, directory.value, task.prompt);
}

async function sendAttempt(attempt: StudioAttempt, studioDirectory: string, description?: string) {
  if (submitting.value || !studioDirectory || (!attempt.request && !attempt.previousTaskId)) return;
  const key = browserKey.value;
  const version = scopeVersion;
  const { taskId, request, previousTaskId } = attempt;
  const kind = props.kind;
  const pending = [...attempts.value.filter(item => item.taskId !== taskId), attempt].slice(-20);
  const task = reactive<StudioTask>({ taskId, state: "queued", createdAt: attempt.createdAt, prompt: request?.prompt ?? description,
    providerId: request?.providerId, modelId: request?.modelId });
  storeAttempt(key, pending);
  tasks.value = [task, ...tasks.value.filter(item => item.taskId !== taskId)];
  selectedTaskId.value = taskId;
  submitError.value = "";
  submitting.value = true;
  try {
    const url = previousTaskId ? "/api/mediaStudio/retry" : "/api/ai/media/generate";
    const body = previousTaskId ? { directory: studioDirectory, taskId, previousTaskId }
      : { ...request, directory: studioDirectory, mediaType: kind, taskId, studioQueue: true, outputDirectory: "assets/generated" };
    const result = await requestStudio<{ taskId: string }>(url, { method: "POST", body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    if (result?.taskId !== taskId) throw new Error("Chưa xác nhận được thông tin gửi đi.");
  } catch (cause) {
    const rejected = cause instanceof StudioRequestError && [400, 401, 403, 404, 405, 409, 413, 415, 422, 429].includes(cause.status);
    const detail = rejected ? messageOf(cause) : "Kết nối bị gián đoạn. Bấm Kiểm tra lại để tìm kết quả của lần gửi này.";
    if (rejected) {
      attempt.failure = detail.slice(0, 1000);
      storeAttempt(key, pending);
      task.result = { code: cause.status, message: detail, data: null };
    }
    task.state = rejected ? "failed" : "interrupted";
    if (version === scopeVersion) submitError.value = detail;
  } finally {
    submitting.value = false;
    if (mounted && version === scopeVersion) { void loadHistory(); void refreshStatuses(); }
  }
}
async function downloadResult(task: StudioTask) {
  const media = fileOf(task);
  if (!media || downloadedTaskId.value) return;
  const projectFiles = useWorkspaceFiles(directory.value);
  downloadedTaskId.value = task.taskId;
  try {
    await saveFile(async () => new Blob([await projectFiles.read(media.path)], { type: media.mimeType }),
      media.path.split("/").at(-1) ?? (props.kind === "image" ? "anh" : "video"));
  } catch (cause) { ElMessage.error(messageOf(cause)); }
  finally { downloadedTaskId.value = ""; }
}
async function saveToLibrary(task: StudioTask) {
  if (currentUser.value?.role === "user") return;
  const media = fileOf(task);
  if (!media) return;
  try {
    if (media.mediaType === "video") {
      await requestStudio("/api/mediaStudio/publishVideo", { method: "POST", body: JSON.stringify({ directory: directory.value, path: media.path }) });
      ElMessage.success("Video đã có trong Kho tài nguyên MacFlow.");
      return;
    }
    const bytes = await useWorkspaceFiles(directory.value).read(media.path);
    const extension = media.path.split(".").at(-1) ?? (props.kind === "image" ? "png" : "mp4");
    const name = `xuong${props.kind === "image" ? "Anh" : "Video"}-${task.taskId.replaceAll("-", "")}.${extension}`;
    await axios.put("/api/assets/save", new Blob([bytes], { type: media.mimeType }), {
      params: { path: name }, timeout: 120000, headers: { "Content-Type": "application/octet-stream" },
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
watch(browserKey, async () => {
  if (!mounted) return;
  scopeVersion++;
  historySequence++;
  tasks.value = [];
  submitError.value = "";
  historyError.value = "";
  queueError.value = "";
  historyLoading.value = false;
  queueLimit.value = 1;
  queueRunning.value = 0;
  queueWaiting.value = 0;
  draftWarning.value = "";
  restoreDraft();
  await refreshAll();
});
function reconnectStudio() { void refreshAll(); }
onMounted(() => {
  window.addEventListener("online", reconnectStudio);
  mounted = true;
  restoreDraft();
  void refreshAll();
  timer = setInterval(() => { if (document.visibilityState !== "hidden") void refreshStatuses(); }, 3000);
});
onBeforeUnmount(() => {
  mounted = false;
  scopeVersion++;
  historySequence++;
  if (timer) clearInterval(timer);
  clearReferences();
  window.removeEventListener("online", reconnectStudio);
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
    display: flex; flex-direction: column; overflow: auto; padding: 23px 14px 18px;
    background: var(--el-bg-color); border-right: 1px solid var(--el-border-color-light);
    .studioBrand { display: flex; gap: 11px; align-items: center; padding: 3px 13px 27px; font-size: 20px; img { width: 31px; height: 31px; } }
    .studioSidebarFooter { margin-top: auto; display: grid; gap: 8px; min-width: 0; .workspaceName { display: flex; gap: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; align-items: center; font-size: 12px; color: var(--el-text-color-secondary); } }
  }
  .studioMain { overflow: auto; padding: clamp(18px, 3vw, 40px); }
  .studioHeader { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 26px;
    h1 { margin: 5px 0 7px; font-size: clamp(24px, 3vw, 32px); font-weight: 700; }
    p { margin: 0; color: var(--el-text-color-secondary); font-size: 14px; }
    }
  .studioHeaderActions { display: flex; flex-wrap: wrap; gap: 8px; :deep(.el-button) { margin-left: 0; } }
  .videoModes { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; :deep(.el-button) { margin-left: 0; } }
  .studioColumns { display: grid; grid-template-columns: minmax(320px, 440px) minmax(0, 1fr); align-items: start; gap: 22px; margin-top: 20px; }
  :deep(.el-card) { border-radius: 16px; }
  :deep(.el-card__header) { padding: 19px 22px; }
  :deep(.el-card__body) { padding: 22px; }
  .studioCardHeading { display: flex; justify-content: space-between; align-items: center; gap: 8px; > span { display: flex; gap: 10px; align-items: center; font-size: 15px; font-weight: 650; } }
  .fieldLabel { display: block; margin: 22px 0 8px; font-size: 13px; font-weight: 650; span { color: var(--el-color-danger); } }
  .promptHeading { display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap; margin: 20px 0 8px; .fieldLabel { margin: 0; } }
  .fieldHint { color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.5; }
  .browserModelNotice { margin-top: 12px; line-height: 1.5; }
  .fullWidth { width: 100%; }
  .studioAdvanced { margin: 12px 0; padding: 9px 12px; border: 1px solid var(--el-border-color-light); border-radius: 8px; summary { cursor: pointer; font-size: 13px; } }
  .referenceUnavailable { display: grid; place-content: center; height: 94px; border-radius: 8px; padding: 6px; background: var(--el-fill-color-light); font-size: 12px; }
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
@media (max-width: 1050px) { .mediaStudio { grid-template-columns: 68px minmax(0, 1fr); .studioSidebar { padding: 15px 6px; .studioBrand { justify-content: center; padding: 3px 0 20px; strong { display: none; } } .studioSidebarFooter { .workspaceName { display: none; } :deep(.el-button) { font-size: 0; } } } .studioColumns { grid-template-columns: minmax(0, 1fr); } } }
@media (max-width: 730px) { .mediaStudio { grid-template-columns: 1fr; grid-template-rows: auto minmax(0,1fr); .studioSidebar { padding: 8px 12px; border-right: 0; border-bottom: 1px solid var(--el-border-color-light); .studioBrand { display: none; } .studioSidebarFooter { margin: 0; } } .studioMain { padding: 18px 12px; } .studioColumns { gap: 13px; } :deep(.el-card__body) { padding: 16px; } } }
@media (max-width: 600px) { .mediaStudio .studioHeader { flex-wrap: wrap; } }
</style>
