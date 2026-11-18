<template>
  <nodeSkeleton
    v-bind="nodeProps"
    :topVisible="node.selected"
    :bottomVisible="node.selected"
    :bottomWidth="actions?.mode === 'speed' ? 440 : 660"
    topWidth="max-content"
    :downloadUrl="previewUrl"
    :downloadName="outputFile?.url.split(/[\\/]/).at(-1)"
    :fullscreenVisible="false"
    style="width: 360px">
    <template #topActions>
      <el-button :icon="IconTextRecognition" :loading="transcribing" :disabled="busy || !outputFile" text title="Chuyển âm thanh thành văn bản" aria-label="Chuyển âm thanh thành văn bản" @click.stop="transcribe" />
      <el-button v-if="transcribing" :icon="IconPlayerStop" text title="Hủy chuyển thành văn bản" aria-label="Hủy chuyển thành văn bản" @click.stop="cancelTranscription" />
      <el-button :icon="IconScissors" :disabled="busy || !previewUrl" text title="Cắt âm thanh" aria-label="Cắt âm thanh" @click.stop="actions?.open('clip')" />
      <el-button :icon="IconGauge" :disabled="busy || !previewUrl" text title="Đổi tốc độ âm thanh" aria-label="Đổi tốc độ âm thanh" @click.stop="actions?.open('speed')" />
      <el-button :icon="IconTransfer" :loading="uploading" :disabled="busy" text title="Thay âm thanh" aria-label="Thay âm thanh" @click.stop="fileInput?.click()" />
      <input ref="fileInput" type="file" accept="audio/*" hidden aria-label="Chọn âm thanh thay thế" :disabled="busy" @change="replaceOutput" />
    </template>
    <div v-loading="generating || uploading" class="audioContent nopan" :aria-busy="generating || uploading">
      <audioPlayer v-if="previewUrl" ref="player" v-model:pcmOptions="pcmOptions" class="audioPreview" :src="previewUrl" :mimeType="outputFile?.mimeType" @loadedmetadata="updateNodeInternals" />
      <div v-else class="audioEmpty" role="img" aria-label="Chưa có âm thanh được tạo"><icon-music-bolt :size="48" stroke="1.25" aria-hidden="true" /></div>
    </div>
    <template #bottom>
      <div v-if="actions?.mode === 'speed'" ref="speedTarget" />
      <el-card v-else class="promptCard" shadow="never" :bodyStyle="{ padding: '14px 16px 12px' }">
        <referenceItem v-if="refList.length" v-model="refList" @preview="setReferencePreview" @remove="removeReference" />
        <promptInput v-model="data.promptModel" v-model:text="data.prompt" :references="referenceMentions" :materials="materialMentions" :selectMaterial="selectMaterialReference" :selectAsset="selectAssetReference" placeholder="Mô tả âm thanh mong muốn hoặc nhập văn bản cần đọc" expandable />
        <div class="promptFooter">
          <chromeModelSelect
            :modelValue="data.model"
            :chromeTabId="data.chromeTabId"
            :models="models"
            outputKind="audio"
            :loading="modelsLoading"
            :disabled="busy"
            placeholder="Chọn mô hình"
            ariaLabel="Mô hình tạo âm thanh"
            noDataText="Hãy thêm mô hình tạo âm thanh trong Cài đặt"
            @update:modelValue="data.model = $event; data.chromeTabId = undefined"
            @update:chromeTabId="data.chromeTabId = $event"
            @open="loadModels().catch(error => showNodeError(error, 'Lỗi tải mô hình'))" />
          <generationSettings v-model:language="data.language" v-model:sampleRate="data.sampleRate" v-model:format="data.format" v-model:other="data.other" :model="selectedModel" :disabled="busy || !selectedModel" />
          <div class="generationActions">
            <mediaPrice v-if="generationInput" :input="{ ...generationInput, mediaType: 'audio' }" :supported="selectedModel?.supportsPrice === true" />
            <el-button v-if="pendingRecovery" class="sendButton" :icon="IconPlayerStop" :loading="cancelling" :disabled="deleting || uploading || transcribing || actions?.processing" title="Hủy tác vụ" aria-label="Hủy tác vụ" @click="generationState.cancel().catch(error => showNodeError(error, 'Không dừng được quá trình tạo'))" />
            <el-button
              class="sendButton"
              :icon="generating ? IconPlayerStop : IconArrowUp"
              :disabled="cancelling || deleting || uploading || transcribing || actions?.processing || (!generating && !pendingRecovery && (!generationPrompt || !selectedModel))"
              :title="generating ? 'Dừng tạo' : pendingRecovery ? 'Kiểm tra lại tác vụ' : 'Tạo âm thanh'"
              :aria-label="generating ? 'Dừng tạo' : pendingRecovery ? 'Kiểm tra lại tác vụ' : 'Tạo âm thanh'"
              @click="generating ? generationState.cancel().catch(error => showNodeError(error, 'Không dừng được quá trình tạo')) : startGeneration().catch(error => showNodeError(error, 'Tạo âm thanh thất bại'))" />
          </div>
        </div>
      </el-card>
    </template>
  </nodeSkeleton>
  <audioActions ref="actions" v-model:pcmOptions="pcmOptions" :file="outputFile" :src="previewUrl" :target="speedTarget" :disabled="generating || deleting || uploading || transcribing" @pause="player?.pause()" />
</template>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, shallowRef, watch } from "vue";
import { ElButton, ElCard, ElLoading } from "element-plus";
import { IconArrowUp, IconGauge, IconMusicBolt, IconPlayerStop, IconScissors, IconTransfer, IconTextRecognition } from "@tabler/icons-vue";
import { findNodeModel, getNodeModelIdentity, getNodeModelKey, getTargetValues, isTypeCompatible, nodeSkeleton, nodeTools, useNode, useNodeModelSelection, z, type NodeAudioRequest, type NodeHandle, type NodeInputValue, type NodeMediaModel } from "@toonflow/nodes-scaffold/runtime";
import { groupNodeModels } from "@toonflow/node-shared/groupNodeModels";
import { chromeServiceId, requireChromeTab } from "@toonflow/node-shared/chromeTabs";
import chromeModelSelect from "@toonflow/node-shared/chromeModelSelect";
import { showNodeError } from "@toonflow/node-shared/showNodeError";
import { useNodeGeneration } from "@toonflow/node-shared/useNodeGeneration";
import { useAudioTranscription } from "@toonflow/node-shared/useAudioTranscription";
import { getMediaMimeType } from "@toonflow/node-shared/mediaTypes";
import type { PcmOptions } from "@toonflow/node-shared/pcmPreview";
import { useNodeReferences } from "@toonflow/node-shared/useNodeReferences";
import { getModelFormValues, useModelForm } from "@toonflow/node-shared/useModelForm";
import audioPlayer from "@toonflow/node-audio/audioPlayer";
import audioActions from "@toonflow/node-audio/audioActions";
import promptInput from "@toonflow/node-shared/promptInput";
import referenceItem from "@toonflow/node-shared/referenceItem";
import mediaPrice from "@toonflow/node-shared/mediaPrice";
import generationSettings from "./components/generationSettings.vue";
import { formatOptions, languageOptions, sampleRateOptions } from "./audioSettings";

defineOptions({
  inheritAttrs: false,
  icon: IconMusicBolt,
  handles: [
    { id: "in", type: "target", dataType: ["IMAGE", "AUDIO", "STRING"], label: "Tối đa 1 ảnh hoặc âm thanh; không giới hạn văn bản" },
    { id: "audio", type: "source", dataType: "AUDIO", label: "Đầu ra âm thanh" },
  ] satisfies NodeHandle[],
});
const vLoading = ElLoading.directive;
const { id, node, nodeProps, nodeEvent, outputs, files, ai, updateNodeInternals } = useNode({ label: "Tạo âm thanh", onModelsChanged: () => void refreshProviderModels() });
type PromptModel = NonNullable<InstanceType<typeof promptInput>["$props"]["modelValue"]>;
const data = computed(() => node.data as { prompt: string; promptModel: PromptModel; model: string; language: string; sampleRate: number; format: string; other: Record<string, unknown>; chromeTabId?: number });
data.value.prompt ??= "";
data.value.promptModel ??= [];
data.value.model ??= "";
data.value.language ??= "zh-CN";
data.value.sampleRate ??= 24000;
data.value.format ??= "wav";
data.value.other ??= {};
const { refList, referenceMentions, materialMentions, selectMaterialReference, selectAssetReference, setReferencePreview, removeReference } = useNodeReferences();
const models = shallowRef<NodeMediaModel[]>([]);
const modelsLoading = ref(false);
const uploading = ref(false);
const deleting = ref(false);
const fileInput = ref<HTMLInputElement>();
const player = ref<InstanceType<typeof audioPlayer>>();
const actions = ref<InstanceType<typeof audioActions>>();
const speedTarget = ref<HTMLElement>();
const outputFile = computed(() => outputs.value.audio?.dataType === "AUDIO" ? outputs.value.audio.value : undefined);
const pcmOptions = ref<Partial<PcmOptions>>({});
watch(() => outputFile.value?.url, () => { pcmOptions.value = {}; }, { flush: "sync" });
const { processing: transcribing, transcribe, cancel: cancelTranscription, cancelAndWait: cancelTranscriptionAndWait } = useAudioTranscription(outputFile);
let disposed = false;
let generationController: AbortController | undefined;
let generation: Promise<void> | undefined;
let modelsRequest: Promise<void> | undefined;
let modelsRefreshPending = false;
const generationState = useNodeGeneration(outputs, () => generationController?.abort(), { ai });
const { generating, pendingRecovery, cancelling } = generationState;
const busy = computed(() => generating.value || uploading.value || deleting.value || transcribing.value || !!actions.value?.processing);
watch(busy, value => { if (!value && modelsRefreshPending) void refreshProviderModels(); });
const selectedModel = useNodeModelSelection(models, computed({ get: () => data.value.model, set: value => { data.value.model = value; } }));
useModelForm(data, selectedModel);
const modelGroups = computed(() => groupNodeModels(models.value));
const generationPrompt = computed(() => [data.value.prompt.trim(), ...refList.value.flatMap((item, index) =>
  item.dataType === "STRING" && item.value?.trim() ? [`Tham chiếu ${index + 1}:\n${item.value.trim()}`] : [])].filter(Boolean).join("\n\n"));
const generationInput = computed<Omit<NodeAudioRequest, "directory"> | undefined>(() => {
  const choice = selectedModel.value;
  if (!choice) return;
  return {
    ...getNodeModelIdentity(choice),
    prompt: generationPrompt.value,
    language: data.value.language,
    sampleRate: data.value.sampleRate,
    format: data.value.format,
    other: chromeServiceId(choice) ? { ...data.value.other, chromeTabId: data.value.chromeTabId } : Object.keys(data.value.other).length ? { ...data.value.other } : undefined,
    outputDirectory: `assets/${id}`,
    images: refList.value.flatMap(item => item.dataType === "IMAGE" && item.value ? [{ path: item.value.url, mimeType: item.value.mimeType }] : []),
    audios: refList.value.flatMap(item => item.dataType === "AUDIO" && item.value ? [{ path: item.value.url, mimeType: item.value.mimeType }] : []),
  };
});
const previewUrl = files.useFileUrl(outputFile, error => showNodeError(error, "Lỗi đọc âm thanh"));

function referencesAllowed(values: NodeInputValue[]) {
  return values.filter(item => isTypeCompatible(item.dataType, ["IMAGE", "AUDIO"])).length <= 1;
}

nodeEvent.on("canConnect", (connection, context) => {
  // ACT: 重验已有连线时不重复计数；未产出内容的来源仍按声明类型占位。
  const edges = context.edges.filter(edge => edge.source !== connection.source || edge.sourceHandle !== connection.sourceHandle
    || edge.target !== connection.target || edge.targetHandle !== connection.targetHandle);
  return referencesAllowed(getTargetValues(id, "in", context.nodes, [...edges, connection]));
});

onMounted(() => {
  window.addEventListener("toonflow:plugin-installed", refreshProviderModels);
  window.addEventListener("toonflow:provider-config-changed", refreshProviderModels);
  void refreshProviderModels();
});
onScopeDispose(() => {
  disposed = true;
  window.removeEventListener("toonflow:plugin-installed", refreshProviderModels);
  window.removeEventListener("toonflow:provider-config-changed", refreshProviderModels);
  generationController?.abort();
});

async function refreshProviderModels(event?: Event) {
  if (event?.type === "toonflow:plugin-installed" && (event as CustomEvent<{ type?: string }>).detail?.type !== "provider") return;
  modelsRefreshPending = true;
  if (disposed || busy.value) return;
  try {
    await modelsRequest;
    if (disposed || busy.value) return;
    modelsRefreshPending = false;
    await loadModels();
  } catch (error) {
    if (!disposed) showNodeError(error, "Lỗi tải mô hình");
  }
}

function loadModels() {
  if (modelsRequest) return modelsRequest;
  modelsLoading.value = true;
  modelsRequest = ai.getMediaModels().then(items => {
    if (disposed) return;
    if (busy.value) {
      modelsRefreshPending = true;
      return;
    }
    models.value = items.filter(item => item.type === "audio");
    // ACT: 仅空配置选择默认模型，临时不可用的模型保持原选择，避免静默换供应商。
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
  if (busy.value || disposed) throw new Error("Đang xử lý âm thanh hoặc node đã đóng, hãy thử lại sau");
  if (pendingRecovery.value) {
    generation = generationState.resume().catch(error => showNodeError(error, "Không kiểm tra lại được tác vụ âm thanh"));
    return { status: "generating" };
  }
  const input = generationInput.value;
  if (!input) throw new Error("Hãy chọn mô hình tạo âm thanh");
  await requireChromeTab(selectedModel.value!, data.value.chromeTabId, "audio");
  if (!generationPrompt.value) throw new Error("Hãy nhập mô tả tạo âm thanh hoặc văn bản cần đọc");
  if (!referencesAllowed(refList.value)) throw new Error("Không thể tham chiếu cả ảnh và âm thanh cùng lúc, tổng cộng chỉ được một mục; không giới hạn văn bản");
  if (refList.value.some(item => item.value === undefined)) throw new Error("Node tham chiếu chưa có nội dung, hãy bổ sung nội dung");
  if (!languageOptions.some(item => item.value === data.value.language) || !sampleRateOptions.includes(data.value.sampleRate) || !formatOptions.includes(data.value.format)) throw new Error("Hãy chọn lại ngôn ngữ, tần số lấy mẫu và định dạng đầu ra hợp lệ");
  const workspace = files.getWorkspaceFiles();
  const controller = new AbortController();
  generationController = controller;
  generation = generationState.run(async () => {
    const { directory } = await workspace.list();
    controller.signal.throwIfAborted();
    const [result] = await generationState.generate("audio", { ...input, directory }, controller.signal);
    controller.signal.throwIfAborted();
    if (!result) throw new Error("Nhà cung cấp không trả về âm thanh");
    outputs.value.audio = { dataType: "AUDIO", value: { url: result.path, mimeType: result.mimeType } };
  }).catch(error => showNodeError(error, "Tạo âm thanh thất bại")).finally(() => {
    generationController = undefined;
  });
  return { status: "generating" };
}

async function replaceOutput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || busy.value || disposed) return;
  const mimeType = getMediaMimeType(file);
  if (!mimeType.startsWith("audio/")) return void showNodeError("Hãy chọn tệp âm thanh", "Thay âm thanh thất bại");
  if (!file.size || file.size > 100 * 1024 * 1024) return void showNodeError("Âm thanh không được rỗng hoặc vượt quá 100 MB", "Thay âm thanh thất bại");
  uploading.value = true;
  try {
    const workspace = files.getWorkspaceFiles();
    const url = await files.uploadFile(file);
    if (disposed) {
      await workspace.remove(url);
      return;
    }
    // ACT: 替换不删除旧音频，保留复制节点与撤销记录的文件引用。
    outputs.value.audio = { dataType: "AUDIO", value: { url, mimeType } };
  } catch (error) {
    showNodeError(error, "Thay âm thanh thất bại");
  } finally {
    uploading.value = false;
  }
}

nodeEvent.on("save", reason => {
  if (uploading.value || (reason === "reload" && busy.value)) throw new Error("Đang xử lý âm thanh, hãy hoàn tất hoặc hủy trước khi làm mới node");
});
nodeEvent.on("delete", async () => {
  if (uploading.value) throw new Error("Đang thay âm thanh, hãy xóa node sau");
  deleting.value = true;
  try {
    await generationState.cancel(false);
    await Promise.all([generation, actions.value?.cancelAndWait(), cancelTranscriptionAndWait()]);
    await files.removeNodeFiles();
  } finally {
    deleting.value = false;
  }
});

function getConfig() {
  return {
    config: { providerId: selectedModel.value?.providerId ?? "", modelId: selectedModel.value?.modelId ?? "", language: data.value.language, sampleRate: data.value.sampleRate, format: data.value.format, other: { ...data.value.other } },
    models: models.value,
    languages: languageOptions,
    sampleRates: sampleRateOptions,
    formats: formatOptions,
    inputLimits: { text: "unlimited", imageOrAudio: 1 },
  };
}

nodeTools.register({
  name: "getConfig",
  description: "Đọc cấu hình node tạo âm thanh, cấu hình tùy chỉnh other, các mô hình âm thanh, ngôn ngữ, tần số lấy mẫu, định dạng đầu ra và giới hạn số lượng đầu vào. rules trong models khai báo trường tùy chỉnh và không chứa khóa bí mật. Không giới hạn văn bản; ảnh và âm thanh loại trừ nhau và tổng cộng tối đa một mục. Nhà cung cấp kiểm tra khả năng cụ thể của mô hình.",
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
  description: "Sửa mô hình tạo âm thanh, ngôn ngữ, tần số lấy mẫu, định dạng hoặc cấu hình other. Trước tiên dùng getConfig xem các lựa chọn; providerId và modelId phải cung cấp cùng nhau. Điền other theo field và giá trị trong rules của mô hình đích. Chỉ cập nhật các trường được truyền; khi đổi mô hình dùng mặc định của mô hình mới. Không sửa prompt hoặc bắt đầu tạo.",
  parameters: z.strictObject({
    providerId: z.string().min(1).optional(),
    modelId: z.string().min(1).optional(),
    language: z.string().optional(),
    sampleRate: z.number().int().positive().optional(),
    format: z.string().optional(),
    other: z.record(z.string(), z.json()).optional(),
  }).refine(args => (args.providerId === undefined) === (args.modelId === undefined), "Phải cung cấp providerId và modelId cùng nhau"),
  async execute(args, { signal }) {
    signal?.throwIfAborted();
    if (busy.value || disposed) throw new Error("Đang xử lý âm thanh hoặc node đã đóng, hãy sửa cấu hình sau");
    await loadModels();
    signal?.throwIfAborted();
    if (busy.value || disposed) throw new Error("Đang xử lý âm thanh hoặc node đã đóng, hãy sửa cấu hình sau");
    const choice = args.modelId === undefined ? selectedModel.value : findNodeModel(models.value, { providerId: args.providerId ?? "", modelId: args.modelId });
    if (!choice) throw new Error("Hãy chọn mô hình âm thanh hợp lệ do getConfig trả về");
    if (args.language !== undefined && !languageOptions.some(item => item.value === args.language)) throw new Error("Hãy chọn ngôn ngữ hợp lệ do getConfig trả về");
    if (args.sampleRate !== undefined && !sampleRateOptions.includes(args.sampleRate)) throw new Error("Hãy chọn tần số lấy mẫu hợp lệ do getConfig trả về");
    if (args.format !== undefined && !formatOptions.includes(args.format)) throw new Error("Hãy chọn định dạng đầu ra hợp lệ do getConfig trả về");
    const other = getModelFormValues(choice, choice === selectedModel.value ? data.value.other : {}, args.other);
    const modelKey = getNodeModelKey(choice);
    if (data.value.model !== modelKey) data.value.chromeTabId = undefined;
    data.value.model = modelKey;
    if (args.language !== undefined) data.value.language = args.language;
    if (args.sampleRate !== undefined) data.value.sampleRate = args.sampleRate;
    if (args.format !== undefined) data.value.format = args.format;
    data.value.other = other;
    return getConfig();
  },
});
nodeTools.register({
  name: "setPrompt",
  description: "Sửa prompt tạo âm thanh hoặc văn bản cần đọc của node, chỉ nhận prompt và hỗ trợ tham chiếu như {{ref 1}}. Với cấu hình language, sampleRate, format..., trước tiên dùng node:getConfig kiểm tra khả năng rồi gọi riêng node:setConfig. Không bắt đầu tạo.",
  parameters: z.strictObject({ prompt: z.string() }),
  execute({ prompt }) {
    if (deleting.value || disposed) throw new Error("Node đang bị xóa hoặc đã đóng, hãy sửa sau");
    data.value.prompt = prompt;
    data.value.promptModel = prompt.split("\n").map(text => [{ type: "Write", text }]);
    return { prompt };
  },
});
nodeTools.register({
  name: "generateAudio",
  description: "Bắt đầu tạo âm thanh ở chế độ nền bằng prompt, mô hình, ngôn ngữ, tần số lấy mẫu, định dạng và ảnh hoặc âm thanh tham chiếu tùy chọn. Ảnh và âm thanh loại trừ nhau, tổng cộng tối đa một mục; không giới hạn văn bản. Trả về ngay trạng thái đã bắt đầu, dùng getGenerationStatus để kiểm tra kết quả và cancelGeneration để dừng.",
  parameters: z.strictObject({}),
  execute(_args, { signal }) {
    signal?.throwIfAborted();
    return startGeneration();
  },
});
</script>

<style scoped lang="scss">
.audioContent {
  position: relative;
  min-height: 144px;
  display: flex;
  align-items: center;

  .nodeSkeleton.resized & {
    height: 100%;
    min-height: 0;
    align-items: flex-start;

    .audioEmpty { height: 100%; min-height: 0; }
  }

  .audioPreview { display: block; width: 100%; border-radius: var(--el-border-radius-base); }
  .audioEmpty { display: grid; place-items: center; width: 100%; min-height: 144px; color: var(--el-text-color-placeholder); }
  :deep(.el-loading-mask) { pointer-events: none; }
}
.promptCard {
  .promptFooter {
    display: flex;
    align-items: center;
    gap: 12px;

    .modelSelect {
      width: 280px;
      min-width: 0;
      &:deep(.el-select__wrapper) { gap: 6px; padding: 0; box-shadow: none; background: transparent; }
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
