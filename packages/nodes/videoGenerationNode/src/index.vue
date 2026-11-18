<template>
  <nodeSkeleton
    v-bind="nodeProps"
    v-model:bottomVisible="node.selected"
    :topVisible="node.selected"
    topWidth="max-content"
    :downloadUrl="previewUrl"
    :downloadName="outputFile?.url.split(/[\\/]/).at(-1)"
    @fullscreen="player?.enterFullscreen()"
    :bottomWidth="660"
    :style="{ width: previewUrl && videoWidth ? `${videoWidth + 18}px` : undefined }">
    <template #topActions>
      <el-button :icon="IconMusic" text :disabled="!outputFile || generating || deleting || uploading || actions?.processing" @click.stop="actions?.open('extractAudio')" title="Trích xuất âm thanh" aria-label="Trích xuất âm thanh" />
      <el-button :icon="IconLayersSubtract" text :disabled="!outputFile || generating || deleting || uploading || actions?.processing" @click.stop="actions?.open('separate')" title="Tách hình và tiếng" aria-label="Tách hình và tiếng" />
      <el-button :icon="IconScissors" text :disabled="!outputFile || generating || deleting || uploading || actions?.processing" @click.stop="actions?.open('trim')" title="Cắt đoạn video" aria-label="Cắt đoạn video" />
      <el-button :icon="IconMovie" text :loading="actions?.creatingAnalysis" :disabled="!outputFile || generating || deleting || uploading || actions?.processing || actions?.creatingAnalysis" @click.stop="actions?.createFrameAnalysis()" title="Phân tích từng khung hình" aria-label="Phân tích từng khung hình" />
      <mediaHistory mediaType="video" :current="outputFile" :disabled="generating || deleting || uploading" @select="outputs.video = { dataType: 'VIDEO', value: $event }" />
      <el-button :icon="IconTransfer" :loading="uploading" :disabled="generating || deleting" text title="Thay video" aria-label="Thay video" @click.stop="fileInput?.click()" />
      <input ref="fileInput" type="file" accept="video/*" hidden aria-label="Chọn video thay thế" :disabled="generating || deleting || uploading" @change="replaceOutput" />
    </template>
    <template #topRightActions>
      <el-dropdown trigger="click" placement="bottom-end" :disabled="!player?.ready || player?.capturing || generating || deleting || uploading" @command="player?.captureFrame($event)">
        <el-button :icon="IconPhotoScan" :loading="player?.capturing" :disabled="!player?.ready || player?.capturing || generating || deleting || uploading" text title="Chụp khung hình video" aria-label="Chụp khung hình video" />
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="current" :icon="IconPhotoScan">Chụp khung hình hiện tại</el-dropdown-item>
            <el-dropdown-item command="first" :icon="IconPlayerSkipBack">Chụp khung hình đầu</el-dropdown-item>
            <el-dropdown-item command="last" :icon="IconPlayerSkipForward">Chụp khung hình cuối</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </template>
    <div v-loading="generating || uploading" class="videoContent nopan" :aria-busy="generating || uploading">
      <videoPlayer
        v-if="previewUrl"
        ref="player"
        :src="previewUrl"
        label="Video được tạo"
        @loadedmetadata="resizeVideo" />
      <div v-else class="videoEmpty" role="img" aria-label="Chưa có video được tạo">
        <icon-camera-ai :size="48" stroke="1.25" aria-hidden="true" />
      </div>
    </div>
    <template #bottom>
      <el-card class="promptCard" shadow="never" :bodyStyle="{ padding: '14px 16px 12px' }">
        <referenceItem
          v-if="refList.length"
          v-model="refList"
          @preview="setReferencePreview"
          @remove="removeReference" />
        <div v-if="frameMode" class="referenceHint">
          {{ selectedMode === "startFrameOptional" ? "Nếu chỉ có một ảnh sẽ dùng làm khung hình cuối; nếu có hai ảnh, ảnh đầu là khung hình đầu, ảnh sau là khung hình cuối" : "Ảnh tham chiếu theo thứ tự khung hình đầu và cuối" }}
        </div>
        <promptInput v-model="data.promptModel" v-model:text="data.prompt" :references="referenceMentions" :materials="materialMentions" :selectMaterial="selectMaterialReference" :selectAsset="selectAssetReference" expandable />
        <div class="promptFooter">
          <chromeModelSelect
            :modelValue="data.model"
            :chromeTabId="data.chromeTabId"
            :bridgeTarget="data.bridgeTarget"
            :models="models"
            outputKind="video"
            :loading="modelsLoading"
            :disabled="generating || deleting"
            placeholder="Chọn mô hình"
            ariaLabel="Mô hình tạo video"
            noDataText="Hãy thêm mô hình tạo video trong Cài đặt"
            @update:modelValue="data.model = $event; data.chromeTabId = undefined; data.bridgeTarget = undefined"
            @update:chromeTabId="data.chromeTabId = $event"
            @update:bridgeTarget="data.bridgeTarget = $event"
            @open="loadModels().catch((error) => showNodeError(error, 'Lỗi tải mô hình'))" />
          <generationSettings
            v-model:duration="data.duration"
            v-model:resolution="data.resolution"
            v-model:ratio="data.ratio"
            v-model:mode="data.mode"
            v-model:generateAudio="data.generateAudio"
            v-model:other="data.other"
            :ratios="ratioOptions"
            :model="selectedModel"
            :disabled="generating || deleting || !selectedModel" />
          <div class="generationActions">
            <mediaPrice v-if="generationInput" :input="{ ...generationInput, mediaType: 'video' }" :supported="selectedModel?.supportsPrice === true" />
            <el-button v-if="pendingRecovery" class="sendButton" :icon="IconPlayerStop" :loading="cancelling" :disabled="deleting || uploading" title="Hủy tác vụ" aria-label="Hủy tác vụ" @click="generationState.cancel().catch(error => showNodeError(error, 'Không dừng được quá trình tạo'))" />
            <el-button
              class="sendButton"
              :icon="generating ? IconPlayerStop : IconArrowUp"
              :disabled="cancelling || deleting || uploading || (!generating && !pendingRecovery && (!generationPrompt || !selectedModel))"
              :title="generating ? 'Dừng tạo' : pendingRecovery ? 'Kiểm tra lại tác vụ' : 'Tạo video'"
              :aria-label="generating ? 'Dừng tạo' : pendingRecovery ? 'Kiểm tra lại tác vụ' : 'Tạo video'"
              @click="generating ? generationState.cancel().catch(error => showNodeError(error, 'Không dừng được quá trình tạo')) : startGeneration().catch((error) => showNodeError(error, 'Tạo video thất bại'))" />
          </div>
        </div>
      </el-card>
    </template>
  </nodeSkeleton>
  <videoActions ref="actions" :file="outputFile" :src="previewUrl" :disabled="generating || deleting || uploading" />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, ref, shallowRef, watch } from "vue";
import { ElButton, ElCard, ElLoading, ElDropdown, ElDropdownMenu, ElDropdownItem } from "element-plus";
import { IconCameraAi, IconArrowUp, IconPlayerStop, IconTransfer, IconMusic, IconLayersSubtract, IconScissors, IconMovie, IconPhotoScan, IconPlayerSkipBack, IconPlayerSkipForward } from "@tabler/icons-vue";
import { findNodeModel, getNodeModelIdentity, getNodeModelKey, nodeSkeleton, nodeTools, useNode, useNodeModelSelection, z, type NodeMediaModel, type NodeVideoRequest, type NodeHandle } from "@toonflow/nodes-scaffold/runtime";
import { groupNodeModels } from "@toonflow/node-shared/groupNodeModels";
import { chromeServiceId, requireChromeTab } from "@toonflow/node-shared/chromeTabs";
import chromeModelSelect from "@toonflow/node-shared/chromeModelSelect";
import { showNodeError } from "@toonflow/node-shared/showNodeError";
import { useNodeGeneration } from "@toonflow/node-shared/useNodeGeneration";
import { getModelFormValues, useModelForm } from "@toonflow/node-shared/useModelForm";
import { useNodeReferences } from "@toonflow/node-shared/useNodeReferences";
import { getPromptText } from "@toonflow/node-shared/promptText";
import promptInput from "@toonflow/node-shared/promptInput";
import videoPlayer from "@toonflow/node-video/videoPlayer";
import { getMediaMimeType } from "@toonflow/node-shared/mediaTypes";
import videoActions from "@toonflow/node-video/videoActions";
import referenceItem from "@toonflow/node-shared/referenceItem";
import mediaHistory from "@toonflow/node-shared/mediaHistory";
import mediaPrice from "@toonflow/node-shared/mediaPrice";
import generationSettings from "./components/generationSettings.vue";

defineOptions({
  inheritAttrs: false,
  icon: IconCameraAi,
  handles: [
    { id: "in", type: "target", dataType: ["IMAGE", "VIDEO", "AUDIO", "STRING"], label: "Đầu vào ảnh, video, âm thanh, văn bản" },
    { id: "video", type: "source", dataType: "VIDEO", label: "Đầu ra video" },
  ] satisfies NodeHandle[],
});
const vLoading = ElLoading.directive;
const { id, node, nodeProps, nodeEvent, outputs, files, ai, updateNodeInternals } = useNode({
  label: "Tạo video",
  onModelsChanged: () => void refreshProviderModels(),
});
type PromptModel = NonNullable<InstanceType<typeof promptInput>["$props"]["modelValue"]>;
const data = computed(() => node.data as { prompt: string; promptModel: PromptModel; model: string; duration?: number; resolution: string; ratio: string; mode: string; generateAudio: boolean; other: Record<string, unknown>; chromeTabId?: number; bridgeTarget?: string });
data.value.prompt ??= "";
data.value.promptModel ??= [];
data.value.model ??= "";
data.value.resolution ??= "";
data.value.mode ??= "";
data.value.generateAudio ??= true;
data.value.ratio ??= "9:16";
data.value.other ??= {};
const { refList, referenceMentions, materialMentions, selectMaterialReference, selectAssetReference, setReferencePreview, removeReference } = useNodeReferences();
const models = shallowRef<NodeMediaModel[]>([]);
const modelsLoading = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement>();
let disposed = false;
const deleting = ref(false);
const player = ref<InstanceType<typeof videoPlayer>>();
const actions = ref<InstanceType<typeof videoActions>>();
const videoWidth = ref(0);
let generationController: AbortController | undefined;
const generationState = useNodeGeneration(outputs, () => generationController?.abort(), { ai });
const { generating, pendingRecovery, cancelling } = generationState;
let generation: Promise<void> | undefined;
let modelsRequest: Promise<void> | undefined;
watch(generating, value => { if (!value && !disposed && !deleting.value && !models.value.length) void loadModels().catch(error => showNodeError(error, "Lỗi tải mô hình")); });
// ACT: 供应商未声明视频比例范围，沿用界面的通用比例，具体支持范围由供应商校验。
const ratioOptions = ["16:9", "9:16", "1:1", "4:3", "3:4"];
const selectedModel = useNodeModelSelection(models, computed({ get: () => data.value.model, set: value => { data.value.model = value; } }));
useModelForm(data, selectedModel);
const selectedMode = computed(() => selectedModel.value?.mode?.find((item) => JSON.stringify(item) === data.value.mode) as NodeVideoRequest["mode"]);
const frameMode = computed(() => ["startEndRequired", "endFrameOptional", "startFrameOptional"].includes(String(selectedMode.value)));
const mediaCounts = computed(() => ({
  image: refList.value.filter((item) => item.dataType === "IMAGE").length,
  video: refList.value.filter((item) => item.dataType === "VIDEO").length,
  audio: refList.value.filter((item) => item.dataType === "AUDIO").length,
}));
const matchingModes = computed(() => getMatchingModes(selectedModel.value));

function getMatchingModes(choice?: NodeMediaModel) {
  return (choice?.mode ?? []).filter((mode) => {
    const { image, video, audio } = mediaCounts.value;
    if (Array.isArray(mode)) return image + video + audio > 0 && Object.entries(mediaCounts.value).every(([type, count]) =>
      count <= Number(mode.find((item) => item.startsWith(`${type}Reference:`))?.split(":")[1] ?? 0)
    );
    if (mode === "text") return image + video + audio === 0;
    if (video || audio) return false;
    if (mode === "singleImage") return image === 1;
    if (mode === "startEndRequired") return image === 2;
    return ["endFrameOptional", "startFrameOptional"].includes(mode) && image >= 1 && image <= 2;
  });
}

function getDurations(choice: NodeMediaModel) {
  return [...new Set((choice.durationResolutionMap ?? []).flatMap((item) => item.duration))].sort((a, b) => a - b);
}

function getResolutions(choice: NodeMediaModel, duration?: number) {
  // ACT: 当前视频分辨率使用 p 单位；出现其他单位时再统一换算。
  return [...new Set((choice.durationResolutionMap ?? []).filter((item) => item.duration.includes(duration!)).flatMap((item) => item.resolution))]
    .sort((left, right) => (Number.parseFloat(left) || Infinity) - (Number.parseFloat(right) || Infinity));
}
// ACT: 引用改变时只替换不适用的模式；普通媒体优先作为参考，避免自动变成首尾帧。
watch([selectedModel, matchingModes, () => data.value.mode], ([choice, matches]) => {
  if (!choice || matches.some((item) => JSON.stringify(item) === data.value.mode)) return;
  const modes = choice.mode ?? [];
  const mode = matches.find(Array.isArray) ?? matches.find((item) => item === "singleImage")
    ?? matches.find((item) => item === "endFrameOptional") ?? matches[0]
    ?? modes.find((item) => JSON.stringify(item) === data.value.mode) ?? modes.find(Array.isArray) ?? modes[0];
  data.value.mode = mode === undefined ? "" : JSON.stringify(mode);
}, { flush: "sync" });
// ACT: 参数在节点内归一化，未选中、未挂载底部设置时也可由 Agent 直接生成。
watch([selectedModel, () => data.value.duration], ([choice]) => {
  if (!choice) return;
  const durations = getDurations(choice);
  if (!durations.includes(data.value.duration!)) data.value.duration = durations[0];
  const resolutions = getResolutions(choice, data.value.duration);
  if (!resolutions.includes(data.value.resolution)) data.value.resolution = resolutions[0] ?? "";
  if (!ratioOptions.includes(data.value.ratio)) data.value.ratio = "9:16";
  if (choice.audio !== "optional") data.value.generateAudio = choice.audio === true;
}, { flush: "sync" });
const modelGroups = computed(() => groupNodeModels(models.value));
function getGenerationPrompt(prompt: string, references = refList.value) {
  return [
    prompt.trim(),
    ...references.flatMap((item, index) => (item.dataType === "STRING" && item.value?.trim() ? [`Tham chiếu ${index + 1}:\n${item.value.trim()}`] : [])),
  ]
    .filter(Boolean)
    .join("\n\n");
}
const generationPrompt = computed(() => getGenerationPrompt(data.value.prompt));
const generationInput = computed(() => getGenerationInput(data.value.prompt));

function getGenerationInput(prompt: string): Omit<NodeVideoRequest, "directory"> | undefined {
  const choice = selectedModel.value;
  if (!choice) return;
  const references = refList.value;
  const images: NonNullable<NodeVideoRequest["images"]> = [];
  const videos: NonNullable<NodeVideoRequest["videos"]> = [];
  const audios: NonNullable<NodeVideoRequest["audios"]> = [];
  const referenceOrder: NonNullable<NodeVideoRequest["referenceOrder"]> = references.map(item => {
    if (item.dataType === "IMAGE" && item.value) {
      const index = images.push({ path: item.value.url, mimeType: item.value.mimeType }) - 1;
      return { type: "image", index };
    }
    if (item.dataType === "VIDEO" && item.value) {
      const index = videos.push({ path: item.value.url, mimeType: item.value.mimeType }) - 1;
      return { type: "video", index };
    }
    if (item.dataType === "AUDIO" && item.value) {
      const index = audios.push({ path: item.value.url, mimeType: item.value.mimeType }) - 1;
      return { type: "audio", index };
    }
    return { type: "text" };
  });
  const firstFrame = frameMode.value && (selectedMode.value !== "startFrameOptional" || images.length > 1) ? images[0] : undefined;
  const lastFrame = frameMode.value ? images[selectedMode.value === "startFrameOptional" && images.length === 1 ? 0 : 1] : undefined;
  return {
    ...getNodeModelIdentity(choice),
    prompt: getGenerationPrompt(prompt, references),
    mode: selectedMode.value,
    duration: data.value.duration,
    resolution: data.value.resolution || undefined,
    ratio: data.value.ratio,
    generateAudio: choice.audio === "optional" ? data.value.generateAudio : choice.audio,
    other: choice.providerId === "aiBridge" || choice.providerId === "aiBridgeLocal" || choice.providerId === "aiBr" ? { ...data.value.other, bridgeTarget: data.value.bridgeTarget }
      : chromeServiceId(choice) ? { ...data.value.other, chromeTabId: data.value.chromeTabId }
        : Object.keys(data.value.other).length ? { ...data.value.other } : undefined,
    outputDirectory: `assets/${id}`,
    images: frameMode.value ? undefined : images,
    firstFrame,
    lastFrame,
    videos,
    audios,
    referenceOrder: referenceOrder.map(reference => frameMode.value && reference.type === "image"
      ? { type: reference.index === 0 && firstFrame ? "firstFrame" : "lastFrame" } : reference),
  };
}
const outputFile = computed(() => outputs.value.video?.dataType === "VIDEO" ? outputs.value.video.value : undefined);
const previewUrl = files.useFileUrl(
  outputFile,
  (error) => showNodeError(error, "Lỗi đọc video")
);

onMounted(() => {
  window.addEventListener("toonflow:plugin-installed", refreshProviderModels);
  window.addEventListener("toonflow:provider-config-changed", refreshProviderModels);
  void loadModels().catch(error => { if (!disposed) showNodeError(error, "Lỗi tải mô hình"); });
});
onScopeDispose(() => {
  disposed = true;
  window.removeEventListener("toonflow:plugin-installed", refreshProviderModels);
  window.removeEventListener("toonflow:provider-config-changed", refreshProviderModels);
  generationController?.abort();
});

async function refreshProviderModels(event?: Event) {
  if (event?.type === "toonflow:plugin-installed" && (event as CustomEvent<{ type?: string }>).detail?.type !== "provider") return;
  try {
    await generation;
    if (!disposed && !deleting.value) await loadModels();
  } catch (error) {
    if (!disposed) showNodeError(error, "Lỗi tải mô hình");
  }
}

async function replaceOutput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || generating.value || deleting.value || uploading.value || disposed) return;
  const mimeType = getMediaMimeType(file);
  if (!mimeType.startsWith("video/")) return void showNodeError("Hãy chọn tệp video", "Thay video thất bại");
  if (!file.size || file.size > 100 * 1024 * 1024) return void showNodeError("Video không được rỗng hoặc vượt quá 100 MB", "Thay video thất bại");
  uploading.value = true;
  try {
    const workspace = files.getWorkspaceFiles();
    const url = await files.uploadFile(file);
    if (disposed) {
      await workspace.remove(url);
      return;
    }
    // ACT: 保留历史输出文件，避免破坏撤销记录和复制节点的引用。
    outputs.value.video = { dataType: "VIDEO", value: { url, mimeType } };
  } catch (error) {
    showNodeError(error, "Thay video thất bại");
  } finally {
    uploading.value = false;
  }
}

function loadModels() {
  if (modelsRequest) return modelsRequest;
  modelsLoading.value = true;
  modelsRequest = ai.getMediaModels().then((items) => {
    if (disposed || generating.value || deleting.value) return;
    models.value = items.filter((item) => item.type === "video");
    // ACT: 只给空配置选默认模型，保留暂时不可用的旧选择及其参数。
    if (!data.value.model) {
      const first = modelGroups.value[0]?.models[0];
      data.value.model = first ? getNodeModelKey(first) : "";
    }
  }).finally(() => {
    modelsLoading.value = false;
    modelsRequest = undefined;
  });
  return modelsRequest;
}

async function startGeneration() {
  if (cancelling.value) throw new Error("Đang hủy tác vụ, vui lòng thử lại sau");
  if (generating.value) throw new Error("Đang tạo video, hãy chờ hoàn tất");
  if (uploading.value) throw new Error("Đang thay video, hãy chờ hoàn tất");
  if (deleting.value) throw new Error("Đang xóa node");
  if (pendingRecovery.value) {
    generation = generationState.resume().catch(error => showNodeError(error, "Không kiểm tra lại được tác vụ video"));
    return { status: "generating" };
  }
  const choice = selectedModel.value;
  // ACT: 提交时按稳定 ID 解析，避免依赖编辑器挂载及异步重排同步。
  const references = referenceMentions.value;
  const prompt = data.value.promptModel.length ? getPromptText(data.value.promptModel, referenceId => {
    const value = references.find(reference => reference.id === referenceId)?.value;
    if (value === undefined) throw new Error("Tư liệu tham chiếu trong prompt đã hết hiệu lực, hãy chọn lại");
    return value;
  }) : data.value.prompt;
  const input = getGenerationInput(prompt);
  if (!choice || !input) throw new Error("Hãy chọn mô hình tạo video");
  await requireChromeTab(choice, data.value.chromeTabId, "video");
  if ((choice.providerId === "aiBridge" || choice.providerId === "aiBridgeLocal") && !data.value.bridgeTarget)
    throw new Error("Hãy chọn AI và tab trong menu AI-Bridge của node trước khi tạo video.");
  if (!input.prompt) throw new Error("Hãy nhập mô tả tạo video");
  if (refList.value.some(item => item.value === undefined)) throw new Error("Node tham chiếu chưa có nội dung, hãy bổ sung nội dung");
  for (const match of input.prompt.matchAll(/\{\{ref (\d+)\}\}/g)) {
    const reference = refList.value[Number(match[1]) - 1];
    if (reference?.dataType === "STRING" && !reference.value?.trim()) throw new Error(`Văn bản của tham chiếu ${match[1]} đang rỗng; hãy bổ sung hoặc xóa tham chiếu trong prompt`);
  }
  if (choice.mode?.length && !matchingModes.value.length) throw new Error("Mô hình hiện tại không có chế độ tạo phù hợp với tư liệu tham chiếu; hãy đổi mô hình hoặc điều chỉnh tham chiếu");
  const workspace = files.getWorkspaceFiles();
  const controller = new AbortController();
  generationController = controller;
  // ACT: 工具立即返回；任务身份先保存，卸载只停止等待，重新打开后复查。
  generation = generationState.run(() => workspace
    .list()
    .then(({ directory }) => {
      controller.signal.throwIfAborted();
      return generationState.generate("video", { ...input, directory }, controller.signal);
    })
    .then(([result]) => {
      controller.signal.throwIfAborted();
      if (!result) throw new Error("Nhà cung cấp không trả về video");
      outputs.value.video = { dataType: "VIDEO", value: { url: result.path, mimeType: result.mimeType } };
    }))
    .catch((error) => showNodeError(error, "Tạo video thất bại"))
    .finally(() => {
      generationController = undefined;
    });
  return { status: "generating" };
}

nodeEvent.on("save", (reason) => {
  if (reason === "reload" && (generating.value || uploading.value || deleting.value)) throw new Error("Đang xử lý video, hãy hoàn tất trước khi làm mới node");
});
nodeEvent.on("delete", async () => {
  if (uploading.value) throw new Error("Đang thay video, hãy xóa node sau");
  deleting.value = true;
  try {
    await generationState.cancel(false);
    await generation;
    await files.removeNodeFiles();
  } finally {
    deleting.value = false;
  }
});

async function resizeVideo(event: Event) {
  const video = event.currentTarget as HTMLVideoElement;
  if (!video.videoWidth || !video.videoHeight) return;
  videoWidth.value = Math.max(180, (240 * video.videoWidth) / video.videoHeight);
  await nextTick();
  updateNodeInternals();
}

function getConfig() {
  return {
    config: {
      providerId: selectedModel.value?.providerId ?? "",
      modelId: selectedModel.value?.modelId ?? "",
      duration: data.value.duration,
      resolution: data.value.resolution,
      ratio: data.value.ratio,
      mode: selectedMode.value,
      generateAudio: data.value.generateAudio,
      other: data.value.other,
    },
    models: models.value,
    ratios: ratioOptions,
    matchingModes: matchingModes.value,
  };
}

nodeTools.register({
  name: "getConfig",
  description: "Đọc cấu hình hiện tại, cấu hình tùy chỉnh other, khả năng các mô hình video, tỷ lệ chung và chế độ phù hợp với tham chiếu của node. rules trong models khai báo trường tùy chỉnh, không chứa khóa bí mật. Thời lượng và độ phân giải phải tuân theo durationResolutionMap.",
  parameters: z.strictObject({}),
  async execute(_args, { signal }) {
    signal?.throwIfAborted();
    await loadModels();
    signal?.throwIfAborted();
    return getConfig();
  },
});

nodeTools.register({
  name: "setConfig",
  description: "Sửa mô hình, thời lượng, độ phân giải, tỷ lệ, chế độ, âm thanh hoặc cấu hình other của node tạo video. Trước tiên dùng getConfig kiểm tra khả năng; providerId và modelId phải cung cấp cùng nhau. Điền other theo field và giá trị trong rules của mô hình đích. Chỉ cập nhật trường được truyền; khi đổi mô hình, dùng mặc định của mô hình mới. mode phải dùng nguyên chuỗi hoặc mảng do getConfig trả về và phù hợp với tham chiếu hiện tại. Không sửa prompt hoặc bắt đầu tạo.",
  parameters: z.strictObject({
    providerId: z.string().min(1).optional(),
    modelId: z.string().min(1).optional(),
    duration: z.number().positive().optional(),
    resolution: z.string().min(1).optional(),
    ratio: z.enum(ratioOptions).optional(),
    mode: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
    generateAudio: z.boolean().optional(),
    other: z.record(z.string(), z.json()).optional(),
  }).refine((args) => (args.providerId === undefined) === (args.modelId === undefined), "Phải cung cấp providerId và modelId cùng nhau"),
  async execute(args, { signal }) {
    signal?.throwIfAborted();
    if (generating.value || deleting.value) throw new Error("Node đang tạo video hoặc bị xóa, hãy sửa cấu hình sau");
    await loadModels();
    signal?.throwIfAborted();
    if (generating.value || deleting.value) throw new Error("Node đang tạo video hoặc bị xóa, hãy sửa cấu hình sau");
    const choice = args.modelId === undefined ? selectedModel.value
      : findNodeModel(models.value, { providerId: args.providerId ?? "", modelId: args.modelId });
    if (!choice) throw new Error("Hãy chọn mô hình video hợp lệ do getConfig trả về");
    const durations = getDurations(choice);
    if (args.duration !== undefined && !durations.includes(args.duration)) throw new Error(`Mô hình hiện tại không hỗ trợ thời lượng ${args.duration}; lựa chọn: ${durations.join(", ")}`);
    const duration = args.duration ?? (durations.includes(data.value.duration!) ? data.value.duration : durations[0]);
    const resolutions = getResolutions(choice, duration);
    if (args.resolution !== undefined && !resolutions.includes(args.resolution)) throw new Error(`Thời lượng hiện tại không hỗ trợ độ phân giải ${args.resolution}; lựa chọn: ${resolutions.join(", ")}`);
    const resolution = args.resolution ?? (resolutions.includes(data.value.resolution) ? data.value.resolution : resolutions[0] ?? "");
    if (args.mode !== undefined && !getMatchingModes(choice).some((item) => JSON.stringify(item) === JSON.stringify(args.mode))) throw new Error("Chế độ đã chọn không được mô hình hỗ trợ hoặc không phù hợp với tham chiếu; hãy chọn theo khả năng mô hình và tư liệu đã kết nối");
    if (args.generateAudio !== undefined && choice.audio !== "optional" && args.generateAudio !== (choice.audio === true)) throw new Error("Mô hình hiện tại không hỗ trợ bật/tắt âm thanh; hãy xem khả năng audio do getConfig trả về");
    const other = getModelFormValues(choice, choice === selectedModel.value ? data.value.other : {}, args.other);
    const modelKey = getNodeModelKey(choice);
    if (data.value.model !== modelKey) data.value.chromeTabId = undefined;
    data.value.model = modelKey;
    data.value.duration = duration;
    data.value.resolution = resolution;
    if (args.ratio !== undefined) data.value.ratio = args.ratio;
    if (args.mode !== undefined) data.value.mode = JSON.stringify(args.mode);
    if (args.generateAudio !== undefined) data.value.generateAudio = args.generateAudio;
    data.value.other = other;
    return getConfig();
  },
});

nodeTools.register({
  name: "setPrompt",
  description: "Sửa prompt tạo video của node, chỉ nhận prompt và hỗ trợ tham chiếu như {{ref 1}}. Với duration, độ phân giải và các cấu hình khác, trước tiên dùng node:getConfig kiểm tra rồi gọi riêng node:setConfig. Không bắt đầu tạo video.",
  parameters: z.strictObject({ prompt: z.string() }),
  execute({ prompt: value }) {
    if (deleting.value) throw new Error("Node đang bị xóa, hãy sửa sau");
    data.value.prompt = value;
    data.value.promptModel = value.split("\n").map((text) => [{ type: "Write", text }]);
    return { prompt: value };
  },
});

nodeTools.register({
  name: "generateVideo",
  description: "Bắt đầu tạo video ở chế độ nền với prompt, mô hình, chế độ, thời lượng, độ phân giải, tỷ lệ và tư liệu tham chiếu hiện tại. Trả về ngay trạng thái đã bắt đầu; dùng getGenerationStatus để kiểm tra kết quả và cancelGeneration để dừng tạo.",
  parameters: z.strictObject({}),
  execute(_args, { signal }) {
    signal?.throwIfAborted();
    return startGeneration();
  },
});
</script>

<style scoped lang="scss">
.videoContent {
  .nodeSkeleton.resized & {
    height: 100%;
    min-height: 0;
    grid-template: minmax(0, 1fr) / minmax(0, 1fr);
    --nodeMediaHeight: 100%;

    .videoEmpty { min-height: 0; height: 100%; }
  }

  position: relative;
  display: grid;
  place-items: center;
  min-height: 144px;
  overflow: hidden;
  border-radius: var(--el-border-radius-base);

  .videoEmpty {
    display: grid;
    place-items: center;
    min-height: 144px;
    color: var(--el-text-color-placeholder);
  }

  :deep(.el-loading-mask) {
    pointer-events: none;
  }

}

.promptCard {
  .referenceHint {
    margin: 8px 0;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .promptFooter {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;

    .modelSelect {
      width: 280px;
      min-width: 0;

      &:deep(.el-select__wrapper) {
        gap: 6px;
        padding: 0;
        box-shadow: none;
        background: transparent;
      }
    }

    .generationActions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;

      .sendButton {
        width: 32px;
        height: 32px;
        margin-left: 0;
        padding: 0;
        --el-button-bg-color: var(--el-text-color-primary);
        --el-button-border-color: transparent;
        --el-button-text-color: var(--el-bg-color);
        --el-button-hover-bg-color: var(--el-text-color-regular);
        --el-button-hover-border-color: transparent;
        --el-button-hover-text-color: var(--el-bg-color);
      }
    }
  }
}
</style>
