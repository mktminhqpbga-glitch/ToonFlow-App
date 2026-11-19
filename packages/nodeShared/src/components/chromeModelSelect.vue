<template>
  <div class="chromeModelSelect">
    <el-select v-if="!chromeOnly"
      class="modelSelect"
      :modelValue="selectedModel ? modelValue : ''"
      filterable
      :loading="loading"
      :disabled="disabled"
      :placeholder="placeholder"
      :ariaLabel="ariaLabel"
      :noDataText="noDataText"
      placement="top-start"
      @update:modelValue="chooseModel"
      @visible-change="onModelOpen">
      <template v-if="!selectedModel" #prefix><icon-sparkles :size="17" /></template>
      <template #label="{ label }">
        <modelLabel :label="label" :providerId="selectedModel?.providerId" :modelId="selectedModel?.modelId" />
      </template>
      <el-option-group v-for="group in regularGroups" :key="group.id" :label="group.label">
        <el-option v-for="item in group.models" :key="getNodeModelKey(item)" :value="getNodeModelKey(item)" :label="item.label">
          <modelLabel :label="item.label" :providerId="item.providerId" :modelId="item.modelId" />
        </el-option>
      </el-option-group>
      <el-option-group v-if="!loading" label="AI Chrome">
        <el-option value="__chrome_output_help" disabled :label="chromeModels.length ? 'Chọn dịch vụ → tab tại menu AI Chrome kế bên' : chromeMissingLabel">
          <span>{{ chromeModels.length ? 'Chọn dịch vụ → tab tại menu AI Chrome kế bên' : chromeMissingLabel }}</span>
        </el-option>
      </el-option-group>
      <el-option v-if="chromeSelected" :value="getNodeModelKey(chromeSelected)" :label="chromeSelected.label">
        <modelLabel :label="chromeSelected.label" :providerId="chromeSelected.providerId" :modelId="chromeSelected.modelId" />
      </el-option>
    </el-select>
    <el-cascader
      v-if="chromeOptions.length"
      class="chromeTabs"
      :modelValue="chromeChoice"
      :options="chromeOptions"
      :props="{ expandTrigger: 'hover' }"
      :disabled="disabled"
      :showAllLevels="false"
      :clearable="false"
      :teleported="true"
      placement="top-start"
      placeholder="AI Chrome · chọn tab"
      ariaLabel="Chọn dịch vụ AI Chrome và tab"
      @update:modelValue="chooseChrome"
      @visible-change="onChromeOpen">
      <template #default="{ data: option }">
        <span v-if="option.status" class="statusDot" :class="option.status" aria-hidden="true" />
        <span>{{ option.label }}</span>
        <small v-if="option.taskId" class="tabTask"> · Tác vụ {{ option.taskId }}</small>
      </template>
    </el-cascader>
    <span v-if="museConnectedButKindDisabled" class="chromeNotice" role="status">
      Đã thấy tab Muse, nhưng extension chưa báo hỗ trợ
      {{ outputKind === "image" ? "Ảnh" : outputKind === "video" ? "Video" : "Âm thanh" }}.
      Hãy cập nhật extension và tải lại trang Muse.
    </span>
    <span v-if="chromeSelected && chromeTabId !== undefined" class="tabHint" :title="selectedTarget ? chromeTabLabel(selectedTarget) : 'Tab đã ngắt kết nối'">
      {{ selectedOrdinal ? `Tab #${selectedOrdinal}` : `Tab ID ${chromeTabId}` }}
      · {{ selectedTarget ? chromeTabLabel(selectedTarget) : "Mất kết nối" }}
    </span>
    <span v-if="chromeError" class="tabError" role="status">{{ chromeError }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from "vue";
import { ElCascader, ElSelect, ElOption, ElOptionGroup } from "element-plus";
import { IconSparkles } from "@tabler/icons-vue";
import { findNodeModel, getNodeModelKey, type NodeAiModel, type NodeMediaModel } from "@toonflow/nodes-scaffold/nodeAi";
import { groupNodeModels } from "../groupNodeModels";
import { chromeServiceId, chromeServiceLabel, chromeTabLabel, chromeTargetService, readChromeTabs, type ChromeOutputKind, type ChromeServiceId, type ChromeTabTarget } from "../chromeTabs";
import modelLabel from "./modelLabel.vue";

type ModelItem = NodeAiModel | NodeMediaModel;
const props = defineProps<{
  modelValue: string;
  chromeTabId?: number;
  models: readonly ModelItem[];
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  noDataText?: string;
  outputKind: ChromeOutputKind;
  chromeOnly?: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:chromeTabId": [value: number | undefined];
  open: [];
}>();
const targets = ref<ChromeTabTarget[]>([]);
const chromeError = ref("");
const selectedModel = computed(() => findNodeModel(props.models, props.modelValue));
const chromeSelected = computed(() => selectedModel.value && chromeServiceId(selectedModel.value) ? selectedModel.value : undefined);
const chromeModels = computed(() => props.models.filter(model => chromeServiceId(model)));
const museConnectedButKindDisabled = computed(() => !chromeModels.value.length
  && props.outputKind !== "text" && targets.value.some(tab => tab.provider === "muse"
    && (tab.ready || tab.busy) && !tab.outputKinds.includes(props.outputKind)));
const chromeMissingLabel = computed(() => ({
  text: "Chưa có tab Chrome hỗ trợ văn bản",
  image: "Muse đã kết nối: extension chưa báo luồng Ảnh",
  video: "Muse đã kết nối: extension chưa báo luồng Video",
  audio: "Muse đã kết nối: extension chưa báo luồng Âm thanh",
})[props.outputKind]);
const regularGroups = computed(() => groupNodeModels(props.models.filter(model => !chromeServiceId(model))));
const selectedTarget = computed(() => targets.value.find(tab => tab.tabId === props.chromeTabId && chromeTargetService(tab.provider) === (chromeSelected.value && chromeServiceId(chromeSelected.value))));
const selectedOrdinal = computed(() => selectedTarget.value ? targets.value.indexOf(selectedTarget.value) + 1 : 0);
const chromeChoice = computed(() => chromeSelected.value && selectedTarget.value
  ? [getNodeModelKey(chromeSelected.value), String(selectedTarget.value.tabId)] : []);
const chromeOptions = computed(() => {
  // Show real, connected Chrome tabs even before they advertise this node's
  // output kind. Visibility is not permission to send: incompatible leaves
  // remain disabled, and chooseChrome still requires an actual catalog model.
  const services = new Map<ChromeServiceId, ModelItem | undefined>();
  for (const model of chromeModels.value) services.set(chromeServiceId(model)!, model);
  for (const tab of targets.value) {
    const service = chromeTargetService(tab.provider);
    if (service && !services.has(service)) services.set(service, undefined);
  }
  return [...services].map(([service, model]) => {
    const options = targets.value.flatMap((tab, index) => {
      if (chromeTargetService(tab.provider) !== service) return [];
      const supportsKind = tab.outputKinds.includes(props.outputKind);
      const reason = supportsKind ? chromeTabLabel(tab)
        : props.outputKind === "image" ? "Chưa hỗ trợ luồng ảnh"
          : props.outputKind === "video" ? "Chưa hỗ trợ luồng video"
            : props.outputKind === "audio" ? "Chưa hỗ trợ luồng âm thanh" : "Chưa hỗ trợ văn bản";
      return [{
        value: String(tab.tabId),
        label: `#${index + 1} · ${tab.title || chromeServiceLabel(service)} · ${reason}`,
        taskId: tab.taskId,
        status: tab.blocked ? "blocked" : tab.busy ? "busy" : tab.ready ? "ready" : "offline",
        disabled: !model || !supportsKind || (!tab.ready && !tab.busy) || tab.blocked,
      }];
    });
    return {
      value: model ? getNodeModelKey(model) : JSON.stringify(["aiChrome", service]),
      label: chromeServiceLabel(service) + (model ? "" : ` · chưa có luồng ${props.outputKind}`),
      disabled: !options.length,
      children: options,
    };
  });
});
let disposed = false;
let refreshTimer: ReturnType<typeof setInterval> | undefined;

async function refresh(fresh = false) {
  try {
    const latest = await readChromeTabs(fresh);
    if (!disposed) {
      targets.value = latest;
      chromeError.value = "";
    }
  } catch (error) {
    if (!disposed) {
      targets.value = [];
      chromeError.value = error instanceof Error ? error.message : "Không đọc được danh sách tab Chrome";
    }
  }
}
function chooseModel(value: string) {
  emit("update:modelValue", value);
  if (value !== props.modelValue) emit("update:chromeTabId", undefined);
}
function onModelOpen(visible: boolean) {
  if (visible) emit("open");
}
function onChromeOpen(visible: boolean) {
  if (!visible) return;
  emit("open");
  void refresh(true);
}
function chooseChrome(value: unknown) {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(item => typeof item === "string")) return;
  const [modelKey, tabKey] = value;
  const model = findNodeModel(chromeModels.value, modelKey);
  const tab = targets.value.find(item => String(item.tabId) === tabKey);
  if (!model || !tab || (!tab.ready && !tab.busy) || tab.blocked || !tab.outputKinds.includes(props.outputKind)
    || chromeTargetService(tab.provider) !== chromeServiceId(model)) return;
  emit("update:modelValue", modelKey);
  emit("update:chromeTabId", tab.tabId);
}
onMounted(() => { void refresh(); refreshTimer = setInterval(() => {
  if (chromeSelected.value) void refresh();
}, 5000); });
watch(() => chromeModels.value.length, amount => { if (amount) void refresh(); });
onScopeDispose(() => { disposed = true; clearInterval(refreshTimer); });
</script>

<style lang="scss" scoped>
.chromeModelSelect {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
  flex: 0 1 auto;
  .modelSelect { width: 185px; min-width: 120px; }
  .chromeTabs { width: 154px; }
  .statusDot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 5px; background: var(--el-text-color-placeholder); }
  .statusDot.ready { background: var(--el-color-success); }
  .statusDot.busy { background: var(--el-color-warning); }
  .statusDot.blocked { background: var(--el-color-danger); }
  .tabHint, .tabError { color: var(--el-text-color-secondary); font-size: 11px; max-width: 230px; overflow-wrap: anywhere; }
  .tabError { color: var(--el-color-danger); }
  .chromeNotice { color: var(--el-color-warning); font-size: 11px; max-width: 260px; line-height: 1.45; }
}
</style>
