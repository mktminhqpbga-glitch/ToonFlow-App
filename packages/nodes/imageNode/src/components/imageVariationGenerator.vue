<template>
  <footer class="variationFooter">
    <el-select :modelValue="selectedModel ? settings.model : ''" class="modelSelect" filterable :loading="modelsLoading" :disabled="busy" placeholder="Chọn mô hình tạo ảnh" :aria-label="`Mô hình ${label}`" noDataText="Hãy thêm mô hình ảnh trong phần Cài đặt" placement="top-start" @update:modelValue="settings.model = $event" @visible-change="visible => visible && refreshModels()">
      <template #label="{ label }"><modelLabel :label="label" :providerId="selectedModel?.providerId" :modelId="selectedModel?.modelId" /></template>
      <el-option-group v-for="provider in modelGroups" :key="provider.id" :label="provider.label">
        <el-option v-for="model in provider.models" :key="model.modelId" :label="model.label" :value="getNodeModelKey(model)">
          <modelLabel :label="model.label" :providerId="model.providerId" :modelId="model.modelId" />
        </el-option>
      </el-option-group>
    </el-select>
    <el-popover trigger="click" placement="top" :width="220" :disabled="busy || !selectedModel" :showArrow="false">
      <template #reference><el-button class="sizeButton" text :disabled="busy || !selectedModel" :aria-label="`Cài đặt đầu ra ${label}`">{{ settings.ratio || 'Tỉ lệ' }} · {{ settings.size || 'Độ phân giải' }}</el-button></template>
      <div class="variationSettings nodrag nopan nowheel" @pointerdown.stop @mousedown.stop @wheel.stop @keydown.stop>
        <label>Độ phân giải<el-select v-model="settings.size" :disabled="busy" :aria-label="`Độ phân giải ${label}`"><el-option v-for="size in sizeOptions" :key="size" :label="size" :value="size" /></el-select></label>
        <label>Tỉ lệ khung hình<el-select v-model="settings.ratio" :disabled="busy" :aria-label="`Tỉ lệ ${label}`" @change="ratioFromSource = false"><el-option v-for="ratio in ratioOptions" :key="ratio" :label="ratio" :value="ratio" /></el-select></label>
      </div>
    </el-popover>
    <el-button type="primary" :icon="IconSparkles" :loading="generating" :disabled="busy || modelsLoading || !source || !selectedModel || !prompt.trim()" @click="generate">{{ buttonLabel ?? 'Tạo ảnh' }}</el-button>
  </footer>
</template>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from "vue";
import { useNode, useVueFlow } from "@vue-flow/core";
import { ElButton, ElOption, ElOptionGroup, ElPopover, ElSelect } from "element-plus";
import { IconSparkles } from "@tabler/icons-vue";
import { getNodeModelKey, useNodeAi, useNodeModelSelection, useNodeToolsContext, type NodeMediaModel, type NodeMediaValue } from "@toonflow/nodes-scaffold/runtime";
import { groupNodeModels } from "@toonflow/node-shared/groupNodeModels";
import modelLabel from "@toonflow/node-shared/modelLabel";
import { showNodeError } from "@toonflow/node-shared/showNodeError";
import { interpolateNodePrompt, resolveNodePrompt } from "@toonflow/node-shared/nodePrompts";
import { useImageVariationNode } from "../useImageVariationNode";

const props = defineProps<{
  settings: { model: string; size: string; ratio: string };
  source?: NodeMediaValue;
  aspectRatio: number;
  prompt: string;
  promptId?: string;
  parameterSummary?: string;
  promptVariables?: Record<string, string | number>;
  label: string;
  buttonLabel?: string;
  disabled?: boolean;
}>();
const emit = defineEmits<{ generated: [] }>();
const generating = defineModel<boolean>("generating", { default: false });
const { id, node } = useNode();
const { findNode, getEdges } = useVueFlow();
const ai = useNodeAi({ onModelsChanged: () => void refreshModels() });
const getNodeTools = useNodeToolsContext();
const createVariation = useImageVariationNode();
const models = ref<NodeMediaModel[]>([]);
const modelsLoading = ref(false);
const busy = computed(() => props.disabled || generating.value);
const modelGroups = computed(() => groupNodeModels(models.value));
const selectedModel = useNodeModelSelection(models, computed({ get: () => props.settings.model, set: value => { props.settings.model = value; } }));
const sizeOptions = computed(() => selectedModel.value?.imageSizes?.length ? selectedModel.value.imageSizes : ["2K"]);
const ratioOptions = computed(() => selectedModel.value?.imageRatios?.length ? selectedModel.value.imageRatios : ["16:9"]);
let generationController: AbortController | undefined;
let disposed = false;
let inheritModelConfig = true;
let ratioFromSource = !props.settings.ratio;

function nearestRatio() {
  const numeric = ratioOptions.value.map(value => ({ value, number: value.split(":").map(Number).reduce((width, height) => width / height) })).filter(item => Number.isFinite(item.number) && item.number > 0);
  return props.aspectRatio && numeric.length ? numeric.sort((left, right) => Math.abs(Math.log(left.number / props.aspectRatio)) - Math.abs(Math.log(right.number / props.aspectRatio)))[0]!.value : ratioOptions.value[0]!;
}

watch(selectedModel, choice => {
  if (!choice) return;
  if (!sizeOptions.value.includes(props.settings.size)) props.settings.size = sizeOptions.value.toSorted((left, right) => (Number.parseFloat(left) || Infinity) - (Number.parseFloat(right) || Infinity))[0]!;
  if (!ratioOptions.value.includes(props.settings.ratio)) props.settings.ratio = nearestRatio();
  if (ratioFromSource && props.aspectRatio) { props.settings.ratio = nearestRatio(); ratioFromSource = false; }
}, { flush: "sync" });
watch(() => props.aspectRatio, value => {
  if (value && ratioFromSource && selectedModel.value) { props.settings.ratio = nearestRatio(); ratioFromSource = false; }
});
watch(() => [props.source?.url, props.source?.mimeType], () => generationController?.abort(), { flush: "sync" });
onMounted(refreshModels);
onScopeDispose(() => { disposed = true; generationController?.abort(); });

async function refreshModels() {
  if (modelsLoading.value || busy.value) return;
  modelsLoading.value = true;
  try {
    const result = await ai.getMediaModels();
    if (disposed) return;
    if (inheritModelConfig) {
      for (const key of ["model", "size", "ratio"] as const) {
        const value = node.data[key];
        if (typeof value === "string" && value.trim()) props.settings[key] = value;
      }
      ratioFromSource = !props.settings.ratio;
      inheritModelConfig = false;
    }
    models.value = result.filter(item => item.type === "image");
    if (!props.settings.model) {
      const choice = modelGroups.value[0]?.models[0];
      props.settings.model = choice ? getNodeModelKey(choice) : "";
    }
  } catch (error) { if (!disposed) showNodeError(error, "Không tải được danh sách mô hình"); }
  finally { modelsLoading.value = false; }
}

async function generate() {
  if (disposed || busy.value || modelsLoading.value || !selectedModel.value || !props.source || !props.prompt.trim()) return;
  const controller = generationController = new AbortController();
  generating.value = true;
  try {
    const parameters = props.parameterSummary?.trim();
    const prompt = props.promptId ? await resolveNodePrompt(props.promptId, props.prompt, controller.signal) : props.prompt;
    // Các số trên điều khiển luôn đi kèm yêu cầu, kể cả prompt ẩn đã được thay thế.
    const renderedPrompt = interpolateNodePrompt(prompt, props.promptVariables);
    // Prompt gốc đã có đầy đủ số liệu. Nếu người dùng sửa prompt, bổ sung
    // khối thông số cuối cùng để các điều khiển không bị xóa hoặc ghi đè.
    const finalPrompt = parameters && prompt !== props.prompt ? `${renderedPrompt}\n\n${parameters}` : renderedPrompt;
    const { nodeId, edgeId } = await createVariation({ ...props.settings, label: props.label, prompt: finalPrompt }, controller.signal);
    const createdNode = findNode(nodeId);
    await getNodeTools().call({ nodeId, name: "node:getConfig", args: {} }, controller.signal);
    if (!createdNode || findNode(nodeId) !== createdNode || !getEdges.value.some(edge => edge.id === edgeId && edge.source === id && edge.sourceHandle === "image" && edge.target === nodeId && edge.targetHandle === "in")) {
      throw new Error("Node mới hoặc kết nối ảnh gốc đã thay đổi. Hãy kiểm tra node trước khi tạo.");
    }
    await getNodeTools().call({ nodeId, name: "node:generateImage", args: {} }, controller.signal);
    emit("generated");
  } catch (error) { if (!controller.signal.aborted && !disposed) showNodeError(error, `Tạo ảnh ${props.label} thất bại`); }
  finally { generating.value = false; generationController = undefined; }
}
</script>

<style scoped lang="scss">
.variationFooter {
  display: flex; align-items: center; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--el-border-color-lighter);
  .modelSelect { flex: 1; min-width: 0; }
  .sizeButton { max-width: 180px; overflow: hidden; }
  > .el-button { margin-left: 0; flex-shrink: 0; }
}
.variationSettings {
  display: grid; gap: 12px;
  label { display: grid; gap: 6px; font-size: 12px; }
}
</style>
