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
      <el-button class="panoramaButton" :icon="IconPanoramaHorizontal" :disabled="generating || deleting || uploading || editor?.busy || lighting?.generating || multiAngle?.generating || gridSplit?.splitting || panorama?.busy || !previewUrl" text :title="vietnamese ? 'Ảnh toàn cảnh' : '全景图'" :aria-label="vietnamese ? 'Ảnh toàn cảnh' : '全景图'" @click.stop="panorama?.open($event)">{{ vietnamese ? 'Ảnh toàn cảnh' : '全景图' }}<icon-chevron-down class="menuChevron" :size="14" /></el-button>
      <el-button :icon="IconBrush" :disabled="generating || deleting || uploading || lighting?.generating || multiAngle?.generating || panorama?.busy || !previewUrl || gridSplit?.splitting" text :title="vietnamese ? 'Vẽ lại một phần' : '局部重绘'" :aria-label="vietnamese ? 'Vẽ lại một phần' : '局部重绘'" @click.stop="startEditor('inpaint')">{{ vietnamese ? 'Vẽ lại một phần' : '局部重绘' }}</el-button>
      <el-button :icon="IconSun" :disabled="generating || deleting || uploading || lighting?.generating || multiAngle?.generating || panorama?.busy || !previewUrl || gridSplit?.splitting" text :title="vietnamese ? 'Điều chỉnh ánh sáng' : '打光'" :aria-label="vietnamese ? 'Điều chỉnh ánh sáng' : '打光'" @click.stop="openLighting">{{ vietnamese ? 'Điều chỉnh ánh sáng' : '打光' }}</el-button>
      <el-button :icon="IconCameraRotate" :disabled="generating || deleting || uploading || lighting?.generating || multiAngle?.generating || panorama?.busy || !previewUrl || gridSplit?.splitting" text :title="vietnamese ? 'Nhiều góc nhìn' : '多角度'" :aria-label="vietnamese ? 'Nhiều góc nhìn' : '多角度'" @click.stop="openMultiAngle">{{ vietnamese ? 'Nhiều góc nhìn' : '多角度' }}</el-button>
      <el-button :icon="IconLayoutGrid" :disabled="generating || deleting || uploading || lighting?.generating || multiAngle?.generating || panorama?.busy || !previewUrl" :loading="gridSplit?.splitting" text :title="vietnamese ? 'Chia ảnh thành ô' : '宫格切分'" :aria-label="vietnamese ? 'Chia ảnh thành ô' : '宫格切分'" @click.stop="gridSplit?.open($event)">{{ vietnamese ? 'Chia ảnh thành ô' : '宫格切分' }}</el-button>
      <mediaHistory mediaType="image" :current="outputFile" :disabled="generating || deleting || uploading || lighting?.generating || multiAngle?.generating || panorama?.busy" @select="outputs.image = { dataType: 'IMAGE', value: $event }" />
      <el-button :icon="IconTransfer" :loading="uploading" :disabled="generating || deleting || lighting?.generating || multiAngle?.generating || panorama?.busy" text :title="vietnamese ? 'Thay ảnh' : '替换图片'" :aria-label="vietnamese ? 'Thay ảnh' : '替换图片'" @click.stop="fileInput?.click()">{{ vietnamese ? 'Thay ảnh' : '替换图片' }}</el-button>
      <input ref="fileInput" type="file" accept="image/*" hidden :aria-label="vietnamese ? 'Chọn ảnh thay thế' : '选择替换图片'" :disabled="generating || deleting || uploading || lighting?.generating || multiAngle?.generating || panorama?.busy" @change="replaceOutput" />
    </template>
    <template #topRightActions>
      <el-button :icon="IconPencil" :disabled="generating || deleting || uploading || lighting?.generating || multiAngle?.generating || panorama?.busy || !previewUrl || gridSplit?.splitting" text :title="vietnamese ? 'Đánh dấu' : '标记'" :aria-label="vietnamese ? 'Đánh dấu' : '标记'" @click.stop="startEditor('mark')" />
    </template>
    <div v-loading="generating || uploading" class="imageContent nopan" :aria-busy="generating || uploading" :draggable="!!outputFile" @dragstart.capture="dragOutputReference">
      <imageEditor
        v-if="previewUrl"
        ref="editor"
        :src="previewUrl"
        :toolbarTarget="paintToolbar"
        :disabled="generating || deleting || uploading || lighting?.generating || multiAngle?.generating || panorama?.busy"
        :alt="vietnamese ? 'Tạo ảnh' : '生成图片'"
        @load="resizeImage"
        @error="showNodeError(nodeText("无法预览该图片", "Không xem trước được ảnh này"), nodeText("图片预览失败", "Không thể xem trước ảnh"))" />
      <div v-else-if="inpaintGuideUrl" class="inpaintGuide">
        <img :src="inpaintGuideUrl"  :alt="vietnamese ? 'Ảnh đánh dấu vùng cần vẽ lại' : '局部重绘标注图'" draggable="false" @load="resizeImage" @error="showNodeError('无法读取重绘标注图', '重绘标注读取失败')" />
        <span>{{ vietnamese ? "Vùng tô đỏ là khu vực cần vẽ lại" : "红色标注为重绘区域" }}</span>
      </div>
      <div v-else class="imageEmpty" role="img" :aria-label="vietnamese ? 'Chưa có ảnh được tạo' : '暂无生成图片'">
        <icon-photo-ai :size="48" stroke="1.25" aria-hidden="true" />
      </div>
    </div>
    <template v-if="editor?.mode !== 'mark'" #bottom>
      <div v-if="lightingVisible" ref="lightingTarget" />
      <div v-else-if="multiAngleVisible" ref="multiAngleTarget" />
      <el-card v-else class="promptCard" shadow="never" :bodyStyle="{ padding: '14px 16px 12px' }">
        <el-button v-if="inpaintGuideUrl && editor?.mode !== 'inpaint'" class="inpaintInfo" text :icon="IconBrush" @click="inpaintPreviewVisible = true">{{ vietnamese ? "Xem vùng đã đánh dấu" : "查看重绘标注" }}</el-button>
        <referenceItem
          v-if="refList.length"
          v-model="refList"
          @preview="setReferencePreview"
          @remove="removeReference" />
        <promptInput v-if="editor?.mode === 'inpaint'" v-model="data.inpaintPromptModel" v-model:text="data.inpaintPrompt" :references="referenceMentions" :materials="materialMentions" :selectMaterial="selectMaterialReference" :selectAsset="selectAssetReference" :selectAssetPath="selectAssetPathReference" expandable />
        <promptInput v-else v-model="data.promptModel" v-model:text="data.prompt" :references="referenceMentions" :materials="materialMentions" :selectMaterial="selectMaterialReference" :selectAsset="selectAssetReference" :selectAssetPath="selectAssetPathReference" expandable />
        <div v-if="ratioReport" class="cameraSnapshot">
          Camera đã dùng cho ảnh này: {{ ratioReport.camera.enabled
            ? [ratioReport.camera.body || 'Cinema camera', ratioReport.camera.lens || 'Lens mặc định', ratioReport.camera.focalLength + ' mm', 'f/' + ratioReport.camera.aperture].join(' · ')
            : 'Tắt Camera Studio' }} · {{ ratioReport.savedAt }}
        </div>
        <div v-if="ratioReport?.actualWidth" class="ratioFeedback" :class="{ mismatch: ratioReport.ratioMatched === false }">
          Ảnh đầu ra: {{ ratioReport.actualWidth }} × {{ ratioReport.actualHeight }} px · Yêu cầu {{ ratioReport.ratio }} ·
          {{ ratioReport.ratioMatched ? 'Khớp gần đúng' : 'Không khớp — tỷ lệ trong prompt không được bảo đảm' }}
        </div>
        <div class="promptFooter">
          <el-select
            v-if="editor?.mode !== 'inpaint'"
            :modelValue="selectedModel ? data.model : ''"
            class="modelSelect"
            filterable
            :loading="modelsLoading"
            :disabled="generating || deleting"
            :placeholder="vietnamese ? 'Chọn mô hình' : '选择模型'"
            :aria-label="vietnamese ? 'Mô hình tạo nội dung' : '生成模型'"
            :noDataText="vietnamese ? 'Chưa có model phù hợp. Hãy thêm trong Cài đặt.' : '请先在设置中添加图片模型'"
            placement="top-start"
            @update:modelValue="data.model = $event"
            @visible-change="(visible) => visible && loadModels().catch((error) => showNodeError(error, nodeText("模型读取失败", "Không đọc được danh sách model")))">
            <template v-if="!selectedModel" #prefix><icon-sparkles :size="17" /></template>
            <template #label="{ label }"><modelLabel :label="label" :providerId="selectedModel?.providerId" :modelId="selectedModel?.modelId" /></template>
            <el-option-group v-for="provider in modelGroups" :key="provider.id" :label="provider.label">
              <el-option
                v-for="item in provider.models"
                :key="item.modelId"
                :label="item.label"
                :disabled="item.availability === 'needsConfiguration'"
                :value="getNodeModelKey(item)">
                <modelLabel :label="item.label" :providerId="item.providerId" :modelId="item.modelId" /><span v-if="item.availability === 'needsConfiguration'" class="modelUnavailable">{{ vietnamese ? ' · Chưa cấu hình' : ' · 未配置' }}</span>
              </el-option>
            </el-option-group>
          </el-select>
          <imageGenerationSettings
            v-if="editor?.mode !== 'inpaint'"
            v-model:size="data.size"
            v-model:ratio="data.ratio"
            v-model:other="data.other"
            v-model:camera="data.camera"
            :model="selectedModel"
            :sizes="sizeOptions"
            :ratios="ratioOptions"
            :disabled="generating || deleting || !modelCanGenerate" />
          <el-button v-if="editor?.mode === 'inpaint'" class="confirmButton" type="primary" :icon="IconCheck" :loading="editor.busy" :disabled="deleting || uploading || !generationPrompt" @click="confirmInpaint().catch(error => showNodeError(error, '重绘节点创建失败'))">{{ vietnamese ? "Xác nhận" : "确认" }}</el-button>
          <div v-else class="generationActions">
            <mediaPrice v-if="priceInput" :input="{ ...priceInput, mediaType: 'image' }" :supported="selectedModel?.supportsPrice === true" />
            <el-button v-if="pendingRecovery" class="sendButton" :icon="IconPlayerStop" :loading="cancelling" :disabled="deleting || uploading" :title="vietnamese ? 'Hủy tác vụ' : '放弃任务'" :aria-label="vietnamese ? 'Hủy tác vụ' : '放弃任务'" @click="generationState.cancel().catch(error => showNodeError(error, '停止生成失败'))" />
            <el-button
              class="sendButton"
              :icon="generating ? IconPlayerStop : IconArrowUp"
              :disabled="cancelling || deleting || uploading || (!generating && (editor?.busy || (!pendingRecovery && (!generationPrompt || !modelCanGenerate))))"
              :title="generating ? (vietnamese ? 'Dừng tạo' : '停止生成') : pendingRecovery ? (vietnamese ? 'Kiểm tra lại tác vụ' : '复查任务') : (vietnamese ? 'Tạo ảnh' : '生成图片')"
              :aria-label="generating ? (vietnamese ? 'Dừng tạo' : '停止生成') : pendingRecovery ? (vietnamese ? 'Kiểm tra lại tác vụ' : '复查任务') : (vietnamese ? 'Tạo ảnh' : '生成图片')"
              @click="generating ? generationState.cancel().catch(error => showNodeError(error, nodeText("停止生成失败", "Không dừng được tác vụ tạo"))) : startGeneration().catch((error) => showNodeError(error, nodeText("图片生成失败", "Tạo ảnh thất bại")))" />
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
import { ElButton, ElCard, ElSelect, ElOption, ElOptionGroup, ElLoading, ElImageViewer } from "element-plus";
import { IconCheck, IconPhotoAi, IconSparkles, IconArrowUp, IconPlayerStop, IconTransfer, IconLayoutGrid, IconBrush, IconPencil, IconSun, IconCameraRotate, IconPanoramaHorizontal, IconChevronDown } from "@tabler/icons-vue";
import { findNodeModel, getNodeModelIdentity, getNodeModelKey, nodeSkeleton, nodeTools, useNode, useNodeModelSelection, z, type NodeMediaModel, type NodeImageRequest, type NodeHandle } from "@toonflow/nodes-scaffold/runtime";
import { groupNodeModels } from "@toonflow/node-shared/groupNodeModels";
import { nodeText, useNodeVietnamese } from "@toonflow/node-shared/nodeLanguage";
import { getMediaMimeType } from "@toonflow/node-shared/mediaTypes";
import modelLabel from "@toonflow/node-shared/modelLabel";
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
import { appendCameraInstructions, normalizeCameraSettings, type CameraSettings } from "@toonflow/node-shared/cameraStudio";

defineOptions({
  inheritAttrs: false,
  icon: IconPhotoAi,
  handles: [
    { id: "in", type: "target", dataType: ["IMAGE", "STRING"], label: nodeText("图片、文本输入", "Đầu vào ảnh hoặc văn bản") },
    { id: "image", type: "source", dataType: "IMAGE", label: nodeText("图片输出", "Ảnh đầu ra") },
  ] satisfies NodeHandle[],
});
const vLoading = ElLoading.directive;
const { id, node, nodeProps, handles, nodeEvent, outputs, files, ai, updateNodeInternals } = useNode({
  label: () => { void vietnamese.value; return nodeText("图片生成", "Tạo ảnh"); },
  onModelsChanged: () => void refreshProviderModels(),
});
const vietnamese = useNodeVietnamese();

watch(vietnamese, () => {
  // Đổi nhãn hiển thị theo ngôn ngữ, không thay ID, kiểu dữ liệu hoặc cấu trúc kết nối.
  const inHandle = handles.value.find(item => item.id === "in");
  if (inHandle) inHandle.label = nodeText("图片、文本输入", "Đầu vào ảnh hoặc văn bản");
  const imageHandle = handles.value.find(item => item.id === "image");
  if (imageHandle) imageHandle.label = nodeText("图片输出", "Ảnh đầu ra");
}, { flush: "sync" });
type PromptModel = NonNullable<InstanceType<typeof promptInput>["$props"]["modelValue"]>;
const data = computed(() => node.data as { prompt: string; promptModel: PromptModel; inpaintPrompt: string; inpaintPromptModel: PromptModel; model: string; size: string; ratio: string; other: Record<string, unknown>; camera?: CameraSettings; cameraHistory?: Record<string, { camera: CameraSettings; ratio: string; submittedPrompt: string; savedAt: string; nodeId: string; actualWidth?: number; actualHeight?: number; ratioMatched?: boolean }>; inpaint?: ImageInpaint });
data.value.prompt ??= "";
data.value.promptModel ??= [];
data.value.inpaintPrompt ??= "";
data.value.inpaintPromptModel ??= [];
data.value.model ??= "";
data.value.size ??= "";
data.value.ratio ??= "16:9";
data.value.other ??= {};
const { refList, referenceMentions, materialMentions, selectMaterialReference, selectAssetReference, selectAssetPathReference, setReferencePreview, removeReference } = useNodeReferences();
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
    if (!recovery.input || !recovery.inpaint) throw new Error(nodeText("局部重绘任务缺少恢复素材", "Tác vụ vẽ lại một phần thiếu dữ liệu khôi phục"));
    return generateInpaint(recovery.input, recovery.inpaint, signal, results.filter(result => result.mediaType === "image"));
  },
});
const { generating, pendingRecovery, cancelling } = generationState;
let generation: Promise<void> | undefined;
let modelsRequest: Promise<void> | undefined;
watch(generating, value => { if (!value && !disposed && !deleting.value && !models.value.length) void loadModels().catch(error => showNodeError(error, nodeText("模型读取失败", "Không đọc được danh sách model"))); });
const selectedModel = useNodeModelSelection(models, computed({ get: () => data.value.model, set: value => { data.value.model = value; } }));
const { sizeOptions, ratioOptions } = useImageModelForm(data, selectedModel);
const modelGroups = computed(() => groupNodeModels(models.value));
const modelCanGenerate = computed(() => !!selectedModel.value && selectedModel.value.availability !== "needsConfiguration");
const generationPrompt = computed(() => {
  void vietnamese.value;
  return [
    (editor.value?.mode === "inpaint" ? data.value.inpaintPrompt : data.value.prompt).trim(),
    ...refList.value.flatMap((item, index) => (item.dataType === "STRING" && item.value?.trim() ? [`${nodeText("参考", "Tham chiếu")} ${index + 1}${nodeText("：", ":")}\n${item.value.trim()}`] : [])),
  ]
    .filter(Boolean)
    .join("\n\n");
});
const generationInput = computed<Omit<NodeImageRequest, "directory"> | undefined>(() => {
  void vietnamese.value;
  const choice = selectedModel.value;
  if (!choice) return;
  const inpaint = data.value.inpaint;
  const references = refList.value.filter(item => !inpaint || item.dataType !== "IMAGE" || item.value?.url !== inpaint.source);
  const input = {
    ...getNodeModelIdentity(choice),
    prompt: inpaint ? generationPrompt.value : appendCameraInstructions(generationPrompt.value, data.value.camera, document.documentElement.lang),
    size: data.value.size,
    ratio: data.value.ratio,
    other: Object.keys(data.value.other).length ? { ...data.value.other } : undefined,
    outputDirectory: `assets/${id}`,
    images: references.flatMap(item => item.dataType === "IMAGE" && item.value ? [{ path: item.value.url, mimeType: item.value.mimeType }] : []),
  };
  if (inpaint) {
    let imageIndex = 3 + (inpaint.images?.length ?? 0);
    const mapping = refList.value.flatMap((item, index) => item.dataType === "IMAGE" && item.value
      ? [`${nodeText("参考", "Tham chiếu")} ${index + 1} / {{ref ${index + 1}}}${nodeText(" 对应第 ", " tương ứng với ảnh thứ ")}${item.value.url === inpaint.source ? 1 : imageIndex++}${nodeText(" 张图", " ảnh")}`] : []);
    if (mapping.length) input.prompt += `\n${nodeText("当前节点参考编号对应关系：", "Quy chiếu số thứ tự tham chiếu của node hiện tại:")}${mapping.join(nodeText("；", "; "))}${nodeText("。", ".")}`;
  }
  return input;
});
const priceInput = computed(() => {
  const input = generationInput.value;
  const inpaint = data.value.inpaint;
  if (!input || inpaint && !Array.isArray(inpaint.images)) return;
  return inpaint ? buildInpaintRequest(input, inpaint) : input;
});
function dragOutputReference(event: DragEvent) {
  if (!outputFile.value || !event.dataTransfer) { event.preventDefault(); return; }
  event.dataTransfer.effectAllowed = "copy";
  // The drop target validates this real Canvas node + output handle before connecting it.
  event.dataTransfer.setData("application/toonflow-material-reference", encodeURIComponent(JSON.stringify([id, "image"])));
}

const outputFile = computed(() => outputs.value.image?.dataType === "IMAGE" ? outputs.value.image.value : undefined);
const ratioReport = computed(() => outputFile.value ? data.value.cameraHistory?.[outputFile.value.url] : undefined);
const inpaintGuideUrl = files.useFileUrl(
  () => data.value.inpaint?.guide ? { url: data.value.inpaint.guide, mimeType: "image/png" } : undefined,
  error => showNodeError(error, nodeText("重绘标注读取失败", "Không đọc được ảnh đánh dấu vùng vẽ lại"))
);
const previewUrl = files.useFileUrl(
  outputFile,
  (error) => showNodeError(error, nodeText("图片读取失败", "Không đọc được ảnh"))
);
const imagePreviewUrl = computed(() => editor.value?.previewSrc || previewUrl.value);

onMounted(() => {
  window.addEventListener("toonflow:plugin-installed", refreshProviderModels);
  window.addEventListener("toonflow:provider-config-changed", refreshProviderModels);
  void loadModels().catch(error => { if (!disposed) showNodeError(error, nodeText("模型读取失败", "Không đọc được danh sách model")); });
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
    if (!disposed) showNodeError(error, nodeText("模型读取失败", "Không đọc được danh sách model"));
  }
}

async function replaceOutput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || generating.value || deleting.value || uploading.value || lighting.value?.generating || multiAngle.value?.generating || panorama.value?.busy || disposed) return;
  const mimeType = getMediaMimeType(file);
  if (!mimeType.startsWith("image/")) return void showNodeError(nodeText("请选择图片文件", "Hãy chọn tệp ảnh"), nodeText("图片替换失败", "Không thể thay ảnh"));
  if (!file.size || file.size > 100 * 1024 * 1024) return void showNodeError(nodeText("图片不能为空且不能超过 100 MB", "Ảnh phải có dữ liệu và không vượt quá 100 MB"), nodeText("图片替换失败", "Không thể thay ảnh"));
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
    showNodeError(error, nodeText("图片替换失败", "Không thể thay ảnh"));
  } finally {
    uploading.value = false;
  }
}

function loadModels() {
  if (modelsRequest) return modelsRequest;
  modelsLoading.value = true;
  modelsRequest = ai.getMediaModels().then((items) => {
    if (disposed || generating.value || deleting.value) return;
    models.value = items.filter((item) => item.type === "image");
    // ACT: 只给空配置选默认模型，保留暂时不可用的旧选择及其参数。
    if (!data.value.model) {
      const first = models.value.find(model => model.availability !== "needsConfiguration");
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
  if (!inpaintEditor || inpaintEditor.mode !== "inpaint") throw new Error(nodeText("请先进入局部重绘", "Hãy mở chế độ vẽ lại một phần trước"));
  if (inpaintEditor.busy || generating.value || deleting.value || uploading.value) return;
  if (!generationPrompt.value) throw new Error(nodeText("请输入重绘提示词", "Hãy nhập prompt cho vùng cần vẽ lại"));
  if (refList.value.some(item => item.value === undefined)) throw new Error(nodeText("引用节点暂无内容，请先补充引用内容", "Node tham chiếu chưa có nội dung, hãy bổ sung trước"));
  let prompt = generationPrompt.value.replace(/\{\{ref (\d+)\}\}/g, nodeText("重绘参考 $1", "Tham chiếu vẽ lại $1")).replace(/^(?:参考|Tham chiếu) (\d+)[：:]/gm, nodeText("重绘参考 $1", "Tham chiếu vẽ lại $1") + nodeText("：", ":"));
  const images = refList.value.flatMap(item => item.dataType === "IMAGE" && item.value ? [{ path: item.value.url, mimeType: item.value.mimeType }] : []);
  const imageReferences = refList.value.flatMap((item, index) => item.dataType === "IMAGE" && item.value ? [index + 1] : []);
  if (imageReferences.length) prompt += `\n${nodeText("重绘参考编号对应关系（前两张为原图和区域引导图）：", "Quy chiếu số thứ tự tham chiếu vẽ lại (hai ảnh đầu tiên là ảnh gốc và ảnh hướng dẫn vùng chỉnh sửa):")}${imageReferences.map((reference, index) => `${nodeText("重绘参考 ", "Tham chiếu vẽ lại ")}${reference}${nodeText(" 对应第 ", " tương ứng với ảnh thứ ")}${index + 3}${nodeText(" 张图", " ảnh")}`).join(nodeText("；", "; "))}${nodeText("。", ".")}`;
  await inpaintEditor.createInpaint({ prompt, images }, new AbortController().signal);
}

async function startGeneration() {
  if (cancelling.value) throw new Error(nodeText("任务正在取消，请稍后重试", "Tác vụ đang được hủy, hãy thử lại sau"));
  if (generating.value) throw new Error(nodeText("图片正在生成，请等待完成", "Ảnh đang được tạo, hãy chờ hoàn tất"));
  if (panorama.value?.visible) throw new Error(nodeText("请先关闭全景图，再启动图片生成", "Hãy đóng chế độ ảnh toàn cảnh trước khi tạo ảnh"));
  if (uploading.value) throw new Error(nodeText("图片正在替换，请等待完成", "Đang thay ảnh, hãy chờ hoàn tất"));
  if (deleting.value) throw new Error(nodeText("节点正在删除", "Node đang bị xóa"));
  if (lightingVisible.value) throw new Error(nodeText("请先退出打光，再启动图片生成", "Hãy thoát công cụ ánh sáng trước khi tạo ảnh"));
  if (multiAngleVisible.value) throw new Error(nodeText("请先退出多角度，再启动图片生成", "Hãy thoát chế độ nhiều góc nhìn trước khi tạo ảnh"));
  if (editor.value?.busy || editor.value?.mode === "mark") throw new Error(nodeText("请先完成图片标记", "Hãy hoàn thành đánh dấu ảnh trước"));
  if (editor.value?.mode === "inpaint") throw new Error(nodeText("请先确认局部重绘，再到子节点生成", "Hãy xác nhận vùng vẽ lại trước khi tạo ở node con"));
  if (pendingRecovery.value) {
    generation = generationState.resume().catch(error => showNodeError(error, nodeText("图片任务复查失败", "Không kiểm tra lại được tác vụ ảnh")));
    return { status: "generating" };
  }
  if (!modelCanGenerate.value) throw new Error("Model chưa được cấu hình, hãy kiểm tra Cài đặt.");
  const input = generationInput.value;
  if (!generationPrompt.value) throw new Error(nodeText("请输入生成提示词", "Hãy nhập prompt tạo nội dung"));
  const references = refList.value.filter(item => !data.value.inpaint || item.dataType !== "IMAGE" || item.value?.url !== data.value.inpaint.source);
  if (references.some(item => item.value === undefined)) throw new Error(nodeText("引用节点暂无内容，请先补充引用内容", "Node tham chiếu chưa có nội dung, hãy bổ sung trước"));
  if (!input) throw new Error(nodeText("请先选择图片模型", "Hãy chọn model ảnh trước"));
  const workspace = files.getWorkspaceFiles();
  const controller = new AbortController();
  const inpaintData = data.value.inpaint;
  const cameraSnapshot = normalizeCameraSettings(data.value.camera);
  const submittedPrompt = input.prompt;
  const submittedRatio = input.ratio ?? data.value.ratio;
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
      if (!result) throw new Error(nodeText("供应商未返回图片", "Nhà cung cấp không trả về ảnh"));
      outputs.value.image = { dataType: "IMAGE", value: { url: result.path, mimeType: result.mimeType } };
      (data.value.cameraHistory ??= {})[result.path] = {
        camera: cameraSnapshot, ratio: submittedRatio, submittedPrompt, savedAt: new Date().toISOString(), nodeId: id,
      };
    }))
    .catch((error) => showNodeError(error, nodeText("图片生成失败", "Tạo ảnh thất bại")))
    .finally(() => {
      generationController = undefined;
    });
  return { status: "generating" };
}

nodeEvent.on("save", (reason) => {
  if (reason === "reload" && (generating.value || uploading.value || deleting.value || editor.value?.busy || lighting.value?.generating || multiAngle.value?.generating || panorama.value?.busy)) throw new Error(nodeText("图片处理中，请完成后再刷新节点", "Đang xử lý ảnh, hãy chờ xong trước khi làm mới node"));
});
nodeEvent.on("delete", async () => {
  if (uploading.value || lighting.value?.generating || multiAngle.value?.generating || panorama.value?.busy || (editor.value?.busy && !generating.value)) throw new Error(nodeText("图片处理中，请稍后删除节点", "Đang xử lý ảnh, hãy xóa node sau"));
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
  const report = ratioReport.value;
  if (report) {
    const [requestedWidth, requestedHeight] = report.ratio.split(":").map(Number);
    const desired = requestedWidth! / requestedHeight!;
    report.actualWidth = image.naturalWidth;
    report.actualHeight = image.naturalHeight;
    report.ratioMatched = Number.isFinite(desired) && desired > 0
      && Math.abs(image.naturalWidth / image.naturalHeight - desired) / desired <= 0.025;
  }
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
  description: () => nodeText("读取此图片生成节点的当前模型、分辨率、比例、自定义配置 other 及可选图片模型能力，models 中的 rules 声明自定义字段，不含密钥；未声明分辨率或比例时分别使用 2K、16:9", "Đọc model hiện tại, độ phân giải, tỷ lệ ảnh, cấu hình tùy chỉnh other và các khả năng model ảnh có thể chọn của node tạo ảnh này. rules trong models mô tả các trường tùy chỉnh và không chứa khóa bí mật. Nếu chưa khai báo độ phân giải hoặc tỷ lệ, lần lượt dùng 2K và 16:9."),
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
  description: () => nodeText("修改此图片生成节点的模型、分辨率、比例或自定义配置 other；先用 getConfig 查询可选能力，providerId 与 modelId 必须同时提供；other 按目标模型 rules 的 field 和值要求填写，仅更新传入字段，其余保留，切换模型时使用新模型默认值；不修改提示词、不启动生成", "Thay model, độ phân giải, tỷ lệ hoặc cấu hình tùy chỉnh other của node tạo ảnh này. Trước hết dùng getConfig để tra khả năng có thể chọn; bắt buộc cung cấp đồng thời providerId và modelId. Điền other theo field và giá trị được quy định trong rules của model đích. Chỉ cập nhật những trường được truyền vào, giữ nguyên các trường khác; khi đổi model thì dùng giá trị mặc định của model mới. Không sửa prompt và không bắt đầu tạo ảnh."),
  parameters: z.strictObject({
    providerId: z.string().min(1).optional(),
    modelId: z.string().min(1).optional(),
    size: z.string().min(1).optional(),
    ratio: z.string().min(1).optional(),
    other: z.record(z.string(), z.json()).optional(),
  }).refine((args) => (args.providerId === undefined) === (args.modelId === undefined), nodeText("providerId 与 modelId 必须同时提供", "Phải cung cấp đồng thời providerId và modelId")),
  async execute(args, { signal }) {
    signal?.throwIfAborted();
    if (generating.value || deleting.value) throw new Error(nodeText("节点正在生成或删除，请稍后修改配置", "Node đang tạo nội dung hoặc bị xóa, hãy sửa cấu hình sau"));
    await loadModels();
    signal?.throwIfAborted();
    if (generating.value || deleting.value) throw new Error(nodeText("节点正在生成或删除，请稍后修改配置", "Node đang tạo nội dung hoặc bị xóa, hãy sửa cấu hình sau"));
    const choice = args.modelId === undefined ? selectedModel.value
      : findNodeModel(models.value, { providerId: args.providerId ?? "", modelId: args.modelId });
    if (!choice) throw new Error(nodeText("请选择 getConfig 返回的有效图片模型", "Hãy chọn model ảnh hợp lệ từ getConfig"));
    const sizes = choice.imageSizes?.length ? choice.imageSizes : ["2K"];
    const ratios = choice.imageRatios?.length ? choice.imageRatios : ["16:9"];
    if (args.size !== undefined && !sizes.includes(args.size)) throw new Error(nodeText(`当前模型不支持分辨率 ${args.size}，可选：${sizes.join("、")}`, `Model không hỗ trợ độ phân giải ${args.size}; các giá trị: ${sizes.join(", ")}`));
    if (args.ratio !== undefined && !ratios.includes(args.ratio)) throw new Error(nodeText(`当前模型不支持比例 ${args.ratio}，可选：${ratios.join("、")}`, `Model không hỗ trợ tỷ lệ ${args.ratio}; các giá trị: ${ratios.join(", ")}`));
    const other = getModelFormValues(choice, choice === selectedModel.value ? data.value.other : {}, args.other);
    data.value.model = getNodeModelKey(choice);
    if (args.size !== undefined) data.value.size = args.size;
    if (args.ratio !== undefined) data.value.ratio = args.ratio;
    data.value.other = other;
    return getConfig();
  },
});

nodeTools.register({
  name: "setPrompt",
  description: () => nodeText("修改此节点的普通图片生成提示词，仅接收 prompt，支持 {{ref 1}} 等参考标记；分辨率 size、比例 ratio 等配置须先用 node:getConfig 查询能力，再单独调用 node:setConfig；不修改局部重绘提示词，不启动生成", "Thay prompt tạo ảnh thông thường của node này; chỉ nhận trường prompt và hỗ trợ các dấu tham chiếu như {{ref 1}}. Với cấu hình như độ phân giải size hoặc tỷ lệ ratio, phải tra khả năng bằng node:getConfig trước rồi gọi riêng node:setConfig. Không sửa prompt vẽ lại cục bộ và không bắt đầu tạo ảnh."),
  parameters: z.strictObject({ prompt: z.string() }),
  execute({ prompt: value }) {
    if (deleting.value) throw new Error(nodeText("节点正在删除，请稍后修改", "Node đang bị xóa, hãy chỉnh sửa sau"));
    data.value.prompt = value;
    data.value.promptModel = value.split("\n").map((text) => [{ type: "Write", text }]);
    return { prompt: value };
  },
});

nodeTools.register({
  name: "generateImage",
  description: () => nodeText("启动此节点的后台普通图片生成，使用普通生成提示词、模型、分辨率、比例和参考图片；局部重绘模式下须先退出；立即返回已开始，用 getGenerationStatus 查询完成结果，cancelGeneration 停止生成", "Bắt đầu tác vụ nền để tạo ảnh thông thường trên node này, sử dụng prompt tạo ảnh, model, độ phân giải, tỷ lệ và ảnh tham chiếu đang có. Nếu đang ở chế độ vẽ lại cục bộ thì phải thoát chế độ đó trước. Trả về trạng thái 'đã bắt đầu' ngay; dùng getGenerationStatus để kiểm tra kết quả hoàn tất và cancelGeneration để dừng."),
  parameters: z.strictObject({}),
  execute(_args, { signal }) {
    signal?.throwIfAborted();
    return startGeneration();
  },
});
</script>

<style scoped lang="scss">
.cameraSnapshot { font-size: 12px; color: var(--el-text-color-secondary); margin: 6px 0; }
.ratioFeedback { font-size: 12px; color: var(--el-color-success); margin-top: 6px;
  &.mismatch { color: var(--el-color-warning); }
}
.panoramaButton {
  &[aria-expanded="true"] .menuChevron { transform: rotate(180deg); }
}

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
