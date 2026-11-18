<template>
  <nodeSkeleton
    v-bind="nodeProps"
    v-model:bottomVisible="node.selected"
    :topVisible="node.selected"
    topWidth="max-content"
    :downloadUrl="previewUrl"
    :downloadName="outputFile?.url.split(/[\\/]/).at(-1)"
    @fullscreen="previewVisible = true"
    :bottomWidth="660"
    :style="{ width: (previewUrl || inpaintGuideUrl) && imageWidth ? `${imageWidth + 18}px` : undefined }">
    <template v-if="editor?.mode" #top><div ref="paintToolbar" /></template>
    <template #topActions>
      <el-button class="panoramaButton" :icon="IconPanoramaHorizontal" :disabled="generating || deleting || uploading || editor?.busy || lighting?.generating || multiAngle?.generating || gridSplit?.splitting || panorama?.busy || !previewUrl" text title="Ảnh toàn cảnh" aria-label="Ảnh toàn cảnh" @click.stop="panorama?.open($event)" />
      <el-button :icon="IconBrush" :disabled="generating || deleting || uploading || lighting?.generating || multiAngle?.generating || panorama?.busy || !previewUrl || gridSplit?.splitting" text title="Vẽ lại một vùng" aria-label="Vẽ lại một vùng" @click.stop="startEditor('inpaint')" />
      <el-button :icon="IconSun" :disabled="generating || deleting || uploading || lighting?.generating || multiAngle?.generating || panorama?.busy || !previewUrl || gridSplit?.splitting" text title="Ánh sáng" aria-label="Ánh sáng" @click.stop="openLighting" />
      <el-button :icon="IconCameraRotate" :disabled="generating || deleting || uploading || lighting?.generating || multiAngle?.generating || panorama?.busy || !previewUrl || gridSplit?.splitting" text title="Nhiều góc nhìn" aria-label="Nhiều góc nhìn" @click.stop="openMultiAngle" />
      <el-button :icon="IconLayoutGrid" :disabled="generating || deleting || uploading || lighting?.generating || multiAngle?.generating || panorama?.busy || !previewUrl" :loading="gridSplit?.splitting" text title="Chia ảnh dạng lưới" aria-label="Chia ảnh dạng lưới" @click.stop="gridSplit?.open($event)" />
      <mediaHistory mediaType="image" :current="outputFile" :disabled="generating || deleting || uploading || lighting?.generating || multiAngle?.generating || panorama?.busy" @select="outputs.image = { dataType: 'IMAGE', value: $event }" />
      <el-button :icon="IconTransfer" :loading="uploading" :disabled="generating || deleting || lighting?.generating || multiAngle?.generating || panorama?.busy" text title="Thay ảnh" aria-label="Thay ảnh" @click.stop="fileInput?.click()" />
      <input ref="fileInput" type="file" accept="image/*" hidden aria-label="Chọn ảnh thay thế" :disabled="generating || deleting || uploading || lighting?.generating || multiAngle?.generating || panorama?.busy" @change="replaceOutput" />
    </template>
    <template #topRightActions>
      <el-button :icon="IconPencil" :disabled="generating || deleting || uploading || lighting?.generating || multiAngle?.generating || panorama?.busy || !previewUrl || gridSplit?.splitting" text title="Đánh dấu" aria-label="Đánh dấu" @click.stop="startEditor('mark')" />
    </template>
    <div v-loading="generating || uploading" class="imageContent nopan" :aria-busy="generating || uploading">
      <imageEditor
        v-if="previewUrl"
        ref="editor"
        :src="previewUrl"
        :toolbarTarget="paintToolbar"
        :disabled="generating || deleting || uploading || lighting?.generating || multiAngle?.generating || panorama?.busy"
        alt="Ảnh được tạo"
        @load="resizeImage"
        @error="showNodeError('Không thể xem trước ảnh này', 'Lỗi xem trước ảnh')" />
      <div v-else-if="inpaintGuideUrl" class="inpaintGuide">
        <img :src="inpaintGuideUrl" alt="Ảnh đánh dấu vùng vẽ lại" draggable="false" @load="resizeImage" @error="showNodeError('Không thể đọc ảnh đánh dấu vùng vẽ lại', 'Lỗi đọc ảnh đánh dấu')" />
        <span>Vùng tô đỏ sẽ được vẽ lại</span>
      </div>
      <div v-else class="imageEmpty" role="img" aria-label="Chưa có ảnh được tạo">
        <icon-photo-ai :size="48" stroke="1.25" aria-hidden="true" />
      </div>
    </div>
    <template v-if="editor?.mode !== 'mark'" #bottom>
      <div v-if="lightingVisible" ref="lightingTarget" />
      <div v-else-if="multiAngleVisible" ref="multiAngleTarget" />
      <el-card v-else class="promptCard" shadow="never" :bodyStyle="{ padding: '14px 16px 12px' }">
        <el-button v-if="inpaintGuideUrl && editor?.mode !== 'inpaint'" class="inpaintInfo" text :icon="IconBrush" @click="inpaintPreviewVisible = true">Xem vùng đánh dấu</el-button>
        <referenceItem
          v-if="refList.length"
          v-model="refList"
          @preview="setReferencePreview"
          @remove="removeReference" />
        <promptInput v-if="editor?.mode === 'inpaint'" v-model="data.inpaintPromptModel" v-model:text="data.inpaintPrompt" :references="referenceMentions" :materials="materialMentions" :selectMaterial="selectMaterialReference" :selectAsset="selectAssetReference" expandable />
        <promptInput v-else v-model="data.promptModel" v-model:text="data.prompt" :references="referenceMentions" :materials="materialMentions" :selectMaterial="selectMaterialReference" :selectAsset="selectAssetReference" expandable />
        <el-button v-if="editor?.mode !== 'inpaint'" text class="promptLibraryOpen" :disabled="generating || deleting || uploading || !!pendingRecovery" title="Mở thư viện prompt tạo ảnh" aria-label="Thư viện prompt tạo ảnh" @click.stop="openPromptLibrary">Thư viện prompt</el-button>
        <div class="promptFooter">
          <chromeModelSelect
            :modelValue="data.model"
            :chromeTabId="data.chromeTabId"
            :bridgeTarget="data.bridgeTarget"
            :models="models"
            outputKind="image"
            :loading="modelsLoading"
            :disabled="generating || deleting"
            placeholder="Chọn mô hình"
            ariaLabel="Mô hình tạo ảnh"
            noDataText="Hãy thêm mô hình tạo ảnh trong Cài đặt"
            @update:modelValue="data.model = $event; data.chromeTabId = undefined; data.bridgeTarget = undefined"
            @update:chromeTabId="data.chromeTabId = $event"
            @update:bridgeTarget="data.bridgeTarget = $event"
            @open="loadModels(true).catch((error) => showNodeError(error, 'Lỗi tải mô hình'))" />
          <imageGenerationSettings
            v-if="editor?.mode !== 'inpaint'"
            v-model:size="data.size"
            v-model:ratio="data.ratio"
            v-model:other="data.other"
            :model="selectedModel"
            :sizes="sizeOptions"
            :ratios="ratioOptions"
            :disabled="generating || deleting || !selectedModel" />
          <el-button v-if="editor?.mode === 'inpaint'" class="confirmButton" type="primary" :icon="IconCheck" :loading="editor.busy" :disabled="deleting || uploading || !generationPrompt" @click="confirmInpaint().catch(error => showNodeError(error, 'Không tạo được node vẽ lại'))">Xác nhận</el-button>
          <div v-else class="generationActions">
            <mediaPrice v-if="priceInput" :input="{ ...priceInput, mediaType: 'image' }" :supported="selectedModel?.supportsPrice === true" />
            <el-button v-if="pendingRecovery" class="sendButton" :icon="IconPlayerStop" :loading="cancelling" :disabled="deleting || uploading" title="Hủy tác vụ" aria-label="Hủy tác vụ" @click="generationState.cancel().catch(error => showNodeError(error, 'Không dừng được quá trình tạo'))" />
            <el-button
              class="sendButton"
              :icon="generating ? IconPlayerStop : IconArrowUp"
              :disabled="cancelling || deleting || uploading || (!generating && (editor?.busy || (!pendingRecovery && (!generationPrompt || !selectedModel))))"
              :title="generating ? 'Dừng tạo' : pendingRecovery ? 'Kiểm tra lại tác vụ' : 'Tạo ảnh'"
              :aria-label="generating ? 'Dừng tạo' : pendingRecovery ? 'Kiểm tra lại tác vụ' : 'Tạo ảnh'"
              @click="generating ? generationState.cancel().catch(error => showNodeError(error, 'Không dừng được quá trình tạo')) : startGeneration().catch((error) => showNodeError(error, 'Tạo ảnh thất bại'))" />
          </div>
        </div>
      </el-card>
    </template>
  </nodeSkeleton>
  <imageLighting v-if="lightingVisible" ref="lighting" :src="imagePreviewUrl" :source="outputFile" :target="lightingTarget" :disabled="generating || deleting || uploading || gridSplit?.splitting" @close="lightingVisible = false" />
  <imageMultiAngle v-if="multiAngleVisible" ref="multiAngle" :src="imagePreviewUrl" :source="outputFile" :target="multiAngleTarget" :disabled="generating || deleting || uploading || gridSplit?.splitting" @close="multiAngleVisible = false" />
  <imagePanorama ref="panorama" :src="imagePreviewUrl" :source="outputFile" :disabled="generating || deleting || uploading || editor?.busy || lighting?.generating || multiAngle?.generating || gridSplit?.splitting" @open="openPanorama" />
  <imageGridSplit ref="gridSplit" :src="imagePreviewUrl" :disabled="generating || deleting || uploading || lighting?.generating || multiAngle?.generating || panorama?.busy" :active="node.selected" />
  <el-image-viewer v-if="inpaintPreviewVisible && inpaintGuideUrl" :urlList="[inpaintGuideUrl]" teleported @close="inpaintPreviewVisible = false" />
  <el-image-viewer
    v-if="previewVisible && previewUrl"
    :urlList="[imagePreviewUrl]"
    teleported
    @close="previewVisible = false" />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, ref, shallowRef, watch } from "vue";
import { ElButton, ElCard, ElLoading, ElImageViewer } from "element-plus";
import { IconCheck, IconPhotoAi, IconArrowUp, IconPlayerStop, IconTransfer, IconLayoutGrid, IconBrush, IconPencil, IconSun, IconCameraRotate, IconPanoramaHorizontal } from "@tabler/icons-vue";
import { findNodeModel, getNodeModelIdentity, getNodeModelKey, nodeSkeleton, nodeTools, useNode, useNodeModelSelection, z, type NodeMediaModel, type NodeImageRequest, type NodeHandle } from "@toonflow/nodes-scaffold/runtime";
import { groupNodeModels } from "@toonflow/node-shared/groupNodeModels";
import { chromeServiceId, requireChromeTab } from "@toonflow/node-shared/chromeTabs";
import { getMediaMimeType } from "@toonflow/node-shared/mediaTypes";
import chromeModelSelect from "@toonflow/node-shared/chromeModelSelect";
import { showNodeError } from "@toonflow/node-shared/showNodeError";
import { useNodeGeneration } from "@toonflow/node-shared/useNodeGeneration";
import { useNodeReferences } from "@toonflow/node-shared/useNodeReferences";
import { getModelFormValues, useImageModelForm } from "@toonflow/node-shared/useModelForm";
import promptInput from "@toonflow/node-shared/promptInput";
import referenceItem from "@toonflow/node-shared/referenceItem";
import mediaHistory from "@toonflow/node-shared/mediaHistory";
import mediaPrice from "@toonflow/node-shared/mediaPrice";
import imageGridSplit from "@toonflow/node-image/imageGridSplit";
import imageEditor from "@toonflow/node-image/imageEditor";
import { buildInpaintRequest, useImageInpaint, type ImageInpaint } from "@toonflow/node-image/imageInpaint";
import imageLighting from "@toonflow/node-image/imageLighting";
import imagePanorama from "@toonflow/node-image/imagePanorama";
import imageMultiAngle from "@toonflow/node-image/imageMultiAngle";
import imageGenerationSettings from "@toonflow/node-shared/imageGenerationSettings";

defineOptions({
  inheritAttrs: false,
  icon: IconPhotoAi,
  handles: [
    { id: "in", type: "target", dataType: ["IMAGE", "STRING"], label: "Đầu vào ảnh và văn bản" },
    { id: "image", type: "source", dataType: "IMAGE", label: "Đầu ra ảnh" },
  ] satisfies NodeHandle[],
});
const vLoading = ElLoading.directive;
const { id, node, nodeProps, nodeEvent, outputs, files, ai, updateNodeInternals } = useNode({
  label: "Tạo ảnh",
  onModelsChanged: () => void refreshProviderModels(),
});
type PromptModel = NonNullable<InstanceType<typeof promptInput>["$props"]["modelValue"]>;
const data = computed(() => node.data as { prompt: string; promptModel: PromptModel; inpaintPrompt: string; inpaintPromptModel: PromptModel; model: string; size: string; ratio: string; other: Record<string, unknown>; chromeTabId?: number; bridgeTarget?: string; inpaint?: ImageInpaint });
function openPromptLibrary() {
  window.dispatchEvent(new CustomEvent("macflow:open-prompt-library", { detail: { nodeId: id } }));
}
data.value.prompt ??= "";
data.value.promptModel ??= [];
data.value.inpaintPrompt ??= "";
data.value.inpaintPromptModel ??= [];
data.value.model ??= "";
data.value.size ??= "";
data.value.ratio ??= "16:9";
data.value.other ??= {};
const { refList, referenceMentions, materialMentions, selectMaterialReference, selectAssetReference, setReferencePreview, removeReference } = useNodeReferences();
const models = shallowRef<NodeMediaModel[]>([]);
const modelsLoading = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement>();
const gridSplit = ref<InstanceType<typeof imageGridSplit>>();
const editor = ref<InstanceType<typeof imageEditor>>();
const generateInpaint = useImageInpaint((input, signal, recoveryData) => generationState.generate("image", input, signal, recoveryData));
const paintToolbar = ref<HTMLElement>();
const lighting = ref<InstanceType<typeof imageLighting>>();
const lightingTarget = ref<HTMLElement>();
const lightingVisible = ref(false);
const multiAngle = ref<InstanceType<typeof imageMultiAngle>>();
const multiAngleTarget = ref<HTMLElement>();
const multiAngleVisible = ref(false);
const panorama = ref<InstanceType<typeof imagePanorama>>();
let disposed = false;
const deleting = ref(false);
const previewVisible = ref(false);
const inpaintPreviewVisible = ref(false);
const imageWidth = ref(0);
let generationController: AbortController | undefined;
const generationState = useNodeGeneration(outputs, () => generationController?.abort(), {
  ai,
  async recover(results, task, signal) {
    if (!task.recoveryData) return results;
    const recovery = task.recoveryData as { input: NodeImageRequest; inpaint: ImageInpaint };
    if (!recovery.input || !recovery.inpaint) throw new Error("Tác vụ vẽ lại một vùng thiếu tư liệu để khôi phục");
    return generateInpaint(recovery.input, recovery.inpaint, signal, results.filter(result => result.mediaType === "image"));
  },
});
const { generating, pendingRecovery, cancelling } = generationState;
let generation: Promise<void> | undefined;
let modelsRequest: Promise<void> | undefined;
watch(generating, value => { if (!value && !disposed && !deleting.value && !models.value.length) void loadModels().catch(error => showNodeError(error, "Lỗi tải mô hình")); });
const selectedModel = useNodeModelSelection(models, computed({ get: () => data.value.model, set: value => { data.value.model = value; } }));
const { sizeOptions, ratioOptions } = useImageModelForm(data, selectedModel);
const modelGroups = computed(() => groupNodeModels(models.value));
const generationPrompt = computed(() =>
  [
    (editor.value?.mode === "inpaint" ? data.value.inpaintPrompt : data.value.prompt).trim(),
    ...refList.value.flatMap((item, index) => (item.dataType === "STRING" && item.value?.trim() ? [`Tham chiếu ${index + 1}:\n${item.value.trim()}`] : [])),
  ]
    .filter(Boolean)
    .join("\n\n")
);
const generationInput = computed<Omit<NodeImageRequest, "directory"> | undefined>(() => {
  const choice = selectedModel.value;
  if (!choice) return;
  const inpaint = data.value.inpaint;
  const references = refList.value.filter(item => !inpaint || item.dataType !== "IMAGE" || item.value?.url !== inpaint.source);
  const input = {
    ...getNodeModelIdentity(choice),
    prompt: generationPrompt.value,
    size: data.value.size,
    ratio: data.value.ratio,
    other: choice.providerId === "aiBridge" || choice.providerId === "aiBridgeLocal" ? { ...data.value.other, bridgeTarget: data.value.bridgeTarget }
      : chromeServiceId(choice) ? { ...data.value.other, chromeTabId: data.value.chromeTabId }
        : Object.keys(data.value.other).length ? { ...data.value.other } : undefined,
    outputDirectory: `assets/${id}`,
    images: references.flatMap(item => item.dataType === "IMAGE" && item.value ? [{ path: item.value.url, mimeType: item.value.mimeType }] : []),
  };
  if (choice.providerId === "aiChrome") {
    let imageIndex = 0;
    input.other = { ...input.other, aiChromeReferenceMap: references.flatMap((item, index) => item.dataType === "IMAGE" && item.value ? [`{{ref ${index + 1}}} = attached image ${++imageIndex}`] : []) };
  }
  if (choice.providerId === "muse2Api") {
    let imageIndex = 0;
    const mapping = references.flatMap((item, index) => item.dataType === "IMAGE" && item.value ? [`{{ref ${index + 1}}} = ảnh tham chiếu ${++imageIndex}`] : []);
    if (mapping.length) input.prompt += `\n\nÁnh xạ ảnh đính kèm: ${mapping.join("; ")}.`;
  }
  if (inpaint) {
    let imageIndex = 3 + (inpaint.images?.length ?? 0);
    const mapping = refList.value.flatMap((item, index) => item.dataType === "IMAGE" && item.value
      ? [`Tham chiếu ${index + 1} / {{ref ${index + 1}}} tương ứng với ảnh số ${item.value.url === inpaint.source ? 1 : imageIndex++}`] : []);
    if (mapping.length) input.prompt += `\nThứ tự tham chiếu của node hiện tại: ${mapping.join("; ")}.`;
  }
  return input;
});
const priceInput = computed(() => {
  const input = generationInput.value;
  const inpaint = data.value.inpaint;
  if (!input || inpaint && !Array.isArray(inpaint.images)) return;
  return inpaint ? buildInpaintRequest(input, inpaint) : input;
});
const outputFile = computed(() => outputs.value.image?.dataType === "IMAGE" ? outputs.value.image.value : undefined);
const inpaintGuideUrl = files.useFileUrl(
  () => data.value.inpaint?.guide ? { url: data.value.inpaint.guide, mimeType: "image/png" } : undefined,
  error => showNodeError(error, "Lỗi đọc vùng đánh dấu vẽ lại")
);
const previewUrl = files.useFileUrl(
  outputFile,
  (error) => showNodeError(error, "Lỗi đọc ảnh")
);
const imagePreviewUrl = computed(() => editor.value?.previewSrc || previewUrl.value);

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
  if (!file || generating.value || deleting.value || uploading.value || lighting.value?.generating || multiAngle.value?.generating || panorama.value?.busy || disposed) return;
  const mimeType = getMediaMimeType(file);
  if (!mimeType.startsWith("image/")) return void showNodeError("Hãy chọn tệp ảnh", "Thay ảnh thất bại");
  if (!file.size || file.size > 100 * 1024 * 1024) return void showNodeError("Ảnh không được rỗng hoặc vượt quá 100 MB", "Thay ảnh thất bại");
  uploading.value = true;
  try {
    const workspace = files.getWorkspaceFiles();
    const url = await files.uploadFile(file);
    if (disposed) {
      await workspace.remove(url);
      return;
    }
    // ACT: 保留历史输出文件，避免破坏撤销记录和复制节点的引用。
    outputs.value.image = { dataType: "IMAGE", value: { url, mimeType } };
  } catch (error) {
    showNodeError(error, "Thay ảnh thất bại");
  } finally {
    uploading.value = false;
  }
}

function loadModels(fresh = false) {
  if (modelsRequest) return modelsRequest;
  modelsLoading.value = true;
  modelsRequest = ai.getMediaModels(undefined, fresh).then((items) => {
    if (disposed || generating.value || deleting.value) return;
    models.value = items.filter((item) => item.type === "image");
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

async function confirmInpaint() {
  const inpaintEditor = editor.value;
  if (!inpaintEditor || inpaintEditor.mode !== "inpaint") throw new Error("Hãy mở chế độ vẽ lại một vùng");
  if (inpaintEditor.busy || generating.value || deleting.value || uploading.value) return;
  if (!generationPrompt.value) throw new Error("Hãy nhập mô tả vẽ lại");
  if (refList.value.some(item => item.value === undefined)) throw new Error("Node tham chiếu chưa có nội dung, hãy bổ sung nội dung");
  let prompt = generationPrompt.value.replace(/\{\{ref (\d+)\}\}/g, "Tham chiếu vẽ lại $1").replace(/^Tham chiếu (\d+):/gm, "Tham chiếu vẽ lại $1:");
  const images = refList.value.flatMap(item => item.dataType === "IMAGE" && item.value ? [{ path: item.value.url, mimeType: item.value.mimeType }] : []);
  const imageReferences = refList.value.flatMap((item, index) => item.dataType === "IMAGE" && item.value ? [index + 1] : []);
  if (imageReferences.length) prompt += `\nThứ tự ảnh tham chiếu vẽ lại (hai ảnh đầu là ảnh gốc và ảnh đánh dấu vùng): ${imageReferences.map((reference, index) => `tham chiếu vẽ lại ${reference} tương ứng ảnh số ${index + 3}`).join("; ")}.`;
  await inpaintEditor.createInpaint({ prompt, images }, new AbortController().signal);
}

async function startGeneration() {
  if (cancelling.value) throw new Error("Đang hủy tác vụ, vui lòng thử lại sau");
  if (generating.value) throw new Error("Đang tạo ảnh, hãy chờ hoàn tất");
  if (panorama.value?.visible) throw new Error("Hãy đóng ảnh toàn cảnh trước khi tạo ảnh");
  if (uploading.value) throw new Error("Đang thay ảnh, hãy chờ hoàn tất");
  if (deleting.value) throw new Error("Đang xóa node");
  if (lightingVisible.value) throw new Error("Hãy thoát chế độ ánh sáng trước khi tạo ảnh");
  if (multiAngleVisible.value) throw new Error("Hãy thoát chế độ nhiều góc nhìn trước khi tạo ảnh");
  if (editor.value?.busy || editor.value?.mode === "mark") throw new Error("Hãy hoàn tất đánh dấu ảnh");
  if (editor.value?.mode === "inpaint") throw new Error("Hãy xác nhận vùng vẽ lại rồi tạo ảnh ở node con");
  if (pendingRecovery.value) {
    generation = generationState.resume().catch(error => showNodeError(error, "Không kiểm tra lại được tác vụ ảnh"));
    return { status: "generating" };
  }
  const input = generationInput.value;
  if (!generationPrompt.value) throw new Error("Hãy nhập mô tả tạo ảnh");
  const references = refList.value.filter(item => !data.value.inpaint || item.dataType !== "IMAGE" || item.value?.url !== data.value.inpaint.source);
  if (references.some(item => item.value === undefined)) throw new Error("Node tham chiếu chưa có nội dung, hãy bổ sung nội dung");
  if (!input) throw new Error("Hãy chọn mô hình tạo ảnh");
  await requireChromeTab(selectedModel.value!, data.value.chromeTabId, "image");
  if ((selectedModel.value?.providerId === "aiBridge" || selectedModel.value?.providerId === "aiBridgeLocal") && !data.value.bridgeTarget)
    throw new Error("Hãy chọn AI và tab trong menu AI-Bridge của node trước khi tạo ảnh.");
  const workspace = files.getWorkspaceFiles();
  const controller = new AbortController();
  const inpaintData = data.value.inpaint;
  generationController = controller;
  // ACT: 工具立即返回；任务身份先保存，卸载只停止等待，重新打开后复查。
  generation = generationState.run(() => workspace.list()
    .then(({ directory }) => {
      controller.signal.throwIfAborted();
      return inpaintData
        ? generateInpaint({ ...input, directory }, inpaintData, controller.signal)
        : generationState.generate("image", { ...input, directory }, controller.signal);
    })
    .then(([result]) => {
      controller.signal.throwIfAborted();
      if (!result) throw new Error("Nhà cung cấp không trả về ảnh");
      outputs.value.image = { dataType: "IMAGE", value: { url: result.path, mimeType: result.mimeType } };
    }))
    .catch((error) => showNodeError(error, "Tạo ảnh thất bại"))
    .finally(() => {
      generationController = undefined;
    });
  return { status: "generating" };
}

nodeEvent.on("save", (reason) => {
  if (reason === "reload" && (generating.value || uploading.value || deleting.value || editor.value?.busy || lighting.value?.generating || multiAngle.value?.generating || panorama.value?.busy)) throw new Error("Đang xử lý ảnh, hãy hoàn tất trước khi làm mới node");
});
nodeEvent.on("delete", async () => {
  if (uploading.value || lighting.value?.generating || multiAngle.value?.generating || panorama.value?.busy || (editor.value?.busy && !generating.value)) throw new Error("Đang xử lý ảnh, hãy xóa node sau");
  deleting.value = true;
  try {
    await generationState.cancel(false);
    await generation;
    await files.removeNodeFiles();
  } finally {
    deleting.value = false;
  }
});

async function resizeImage(event: Event) {
  const image = event.currentTarget as HTMLImageElement;
  if (!image.naturalWidth || !image.naturalHeight) return;
  imageWidth.value = (240 * image.naturalWidth) / image.naturalHeight;
  await nextTick();
  updateNodeInternals();
}

function openPanorama() {
  editor.value?.cancel();
  lightingVisible.value = false;
  multiAngleVisible.value = false;
}

function openLighting() {
  if (generating.value || deleting.value || uploading.value || editor.value?.busy || lighting.value?.generating || multiAngle.value?.generating || panorama.value?.busy || gridSplit.value?.splitting || !previewUrl.value) return;
  editor.value?.cancel();
  multiAngleVisible.value = false;
  lightingVisible.value = true;
}

function openMultiAngle() {
  if (generating.value || deleting.value || uploading.value || editor.value?.busy || lighting.value?.generating || multiAngle.value?.generating || panorama.value?.busy || gridSplit.value?.splitting || !previewUrl.value) return;
  editor.value?.cancel();
  lightingVisible.value = false;
  multiAngleVisible.value = true;
}

function startEditor(mode: "inpaint" | "mark") {
  if (generating.value || deleting.value || uploading.value || editor.value?.busy || lighting.value?.generating || multiAngle.value?.generating || panorama.value?.busy || gridSplit.value?.splitting) return;
  lightingVisible.value = false;
  multiAngleVisible.value = false;
  editor.value?.start(mode);
}

function getConfig() {
  return {
    config: {
      providerId: selectedModel.value?.providerId ?? "",
      modelId: selectedModel.value?.modelId ?? "",
      size: data.value.size,
      ratio: data.value.ratio,
      other: { ...data.value.other },
    },
    models: models.value,
  };
}

nodeTools.register({
  name: "getConfig",
  description: "Đọc mô hình, độ phân giải, tỷ lệ, cấu hình tùy chỉnh other và khả năng các mô hình tạo ảnh của node này. rules trong models khai báo trường tùy chỉnh, không chứa khóa bí mật. Mặc định dùng 2K và 16:9 nếu chưa khai báo độ phân giải hoặc tỷ lệ.",
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
  description: "Sửa mô hình, độ phân giải, tỷ lệ hoặc cấu hình tùy chỉnh other của node tạo ảnh này. Trước tiên dùng getConfig kiểm tra tính năng; providerId và modelId phải cung cấp cùng nhau. Điền other theo field và giá trị trong rules của mô hình đích. Chỉ cập nhật các trường đã truyền, giữ nguyên những trường khác; khi đổi mô hình, dùng giá trị mặc định của mô hình mới. Không sửa prompt và không bắt đầu tạo ảnh.",
  parameters: z.strictObject({
    providerId: z.string().min(1).optional(),
    modelId: z.string().min(1).optional(),
    size: z.string().min(1).optional(),
    ratio: z.string().min(1).optional(),
    other: z.record(z.string(), z.json()).optional(),
  }).refine((args) => (args.providerId === undefined) === (args.modelId === undefined), "Phải cung cấp providerId và modelId cùng nhau"),
  async execute(args, { signal }) {
    signal?.throwIfAborted();
    if (generating.value || deleting.value) throw new Error("Node đang tạo ảnh hoặc bị xóa, hãy sửa cấu hình sau");
    await loadModels();
    signal?.throwIfAborted();
    if (generating.value || deleting.value) throw new Error("Node đang tạo ảnh hoặc bị xóa, hãy sửa cấu hình sau");
    const choice = args.modelId === undefined ? selectedModel.value
      : findNodeModel(models.value, { providerId: args.providerId ?? "", modelId: args.modelId });
    if (!choice) throw new Error("Hãy chọn mô hình tạo ảnh hợp lệ do getConfig trả về");
    const sizes = choice.imageSizes?.length ? choice.imageSizes : ["2K"];
    const ratios = choice.imageRatios?.length ? choice.imageRatios : ["16:9"];
    if (args.size !== undefined && !sizes.includes(args.size)) throw new Error(`Mô hình hiện tại không hỗ trợ độ phân giải ${args.size}; lựa chọn: ${sizes.join(", ")}`);
    if (args.ratio !== undefined && !ratios.includes(args.ratio)) throw new Error(`Mô hình hiện tại không hỗ trợ tỷ lệ ${args.ratio}; lựa chọn: ${ratios.join(", ")}`);
    const other = getModelFormValues(choice, choice === selectedModel.value ? data.value.other : {}, args.other);
    const modelKey = getNodeModelKey(choice);
    if (data.value.model !== modelKey) data.value.chromeTabId = undefined;
    data.value.model = modelKey;
    if (args.size !== undefined) data.value.size = args.size;
    if (args.ratio !== undefined) data.value.ratio = args.ratio;
    data.value.other = other;
    return getConfig();
  },
});

nodeTools.register({
  name: "setPrompt",
  description: "Sửa prompt tạo ảnh thông thường của node, chỉ nhận prompt và hỗ trợ tham chiếu như {{ref 1}}. Với cấu hình size, ratio..., phải dùng node:getConfig kiểm tra khả năng rồi gọi riêng node:setConfig. Không sửa prompt vẽ lại một vùng và không bắt đầu tạo ảnh.",
  parameters: z.strictObject({ prompt: z.string() }),
  execute({ prompt: value }) {
    if (deleting.value) throw new Error("Node đang bị xóa, hãy sửa sau");
    data.value.prompt = value;
    data.value.promptModel = value.split("\n").map((text) => [{ type: "Write", text }]);
    return { prompt: value };
  },
});

nodeTools.register({
  name: "generateImage",
  description: "Bắt đầu tạo ảnh thông thường ở chế độ nền bằng prompt, mô hình, độ phân giải, tỷ lệ và ảnh tham chiếu hiện tại. Nếu đang vẽ lại một vùng, hãy thoát chế độ đó trước. Trả về ngay trạng thái đã bắt đầu; dùng getGenerationStatus để xem kết quả và cancelGeneration để dừng tạo.",
  parameters: z.strictObject({}),
  execute(_args, { signal }) {
    signal?.throwIfAborted();
    return startGeneration();
  },
});
</script>

<style scoped lang="scss">
.imageContent {
  .nodeSkeleton.resized & {
    height: 100%;
    min-height: 0;
    grid-template: minmax(0, 1fr) / minmax(0, 1fr);

    .inpaintGuide,
    .imageEmpty {
      height: 100%;
      min-height: 0;
    }

    .inpaintGuide img { height: 100%; object-fit: contain; }
  }

  position: relative;
  display: grid;
  place-items: center;
  min-height: 144px;
  overflow: hidden;
  border-radius: var(--el-border-radius-base);

  .inpaintGuide {
    position: relative;
    width: 100%;
    img { display: block; width: 100%; }
    span { position: absolute; bottom: 8px; left: 8px; padding: 4px 8px; border-radius: 4px; background: #0009; color: #fff; font-size: 12px; }
  }

  .imageEmpty {
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
  .inpaintInfo { margin-bottom: 8px; }
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

    .confirmButton { margin-left: auto; }

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
