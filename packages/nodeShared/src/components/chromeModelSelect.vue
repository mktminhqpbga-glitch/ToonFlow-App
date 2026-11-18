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
      <el-option-group v-if="!loading" label="AI-Bridge · các AI được phát hiện">
        <el-option
          v-for="info in bridgeDiscoveries"
          :key="info.provider"
          :value="`__bridge_discovered_${info.provider}`"
          disabled
          :label="`${bridgeNames[info.provider] || info.provider} · ${info.ready} tab sẵn sàng · ${info.count ? info.capable ? 'đã xác nhận luồng' : missingBridgeKind : 'chưa có tab'}`"
        />
        <el-option v-if="!bridgeDiscoveries.length" value="__bridge_none" disabled
          label="Chưa phát hiện tab AI-Bridge phù hợp" />
        <el-option v-else value="__bridge_help" disabled
          label="Xem AI và trạng thái tab trong menu AI-Bridge bên cạnh" />
      </el-option-group>
      <el-option-group v-if="!loading" label="AI Chrome">
        <el-option value="__chrome_output_help" disabled :label="chromeModels.length ? 'Chọn dịch vụ → tab tại menu AI Chrome kế bên' : chromeMissingLabel">
          <span>{{ chromeModels.length ? 'Chọn dịch vụ → tab tại menu AI Chrome kế bên' : chromeMissingLabel }}</span>
        </el-option>
      </el-option-group>
      <el-option v-if="bridgeSelected && bridgeSelected.providerId !== 'aiBr'" :value="getNodeModelKey(bridgeSelected)" :label="bridgeSelected.label">
        <modelLabel :label="bridgeSelected.label" :providerId="bridgeSelected.providerId" :modelId="bridgeSelected.modelId" />
      </el-option>
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
    <el-cascader
      v-if="bridgeOptions.length"
      class="chromeTabs"
      :modelValue="bridgeChoice"
      :options="bridgeOptions"
      :props="{ expandTrigger: 'hover' }"
      :disabled="disabled"
      :showAllLevels="false"
      :clearable="false"
      :teleported="true"
      placement="top-start"
      placeholder="AI-Bridge · chọn AI/tab"
      ariaLabel="Chọn AI và tab qua AI-Bridge"
      @update:modelValue="chooseBridge"
      @visible-change="onBridgeOpen">
      <template #default="{ data: option }">
        <span v-if="option.status" class="statusDot" :class="option.status" aria-hidden="true" />
        <span>{{ option.label }}</span>
      </template>
    </el-cascader>
    <span v-if="bridgeSelected && bridgeTarget" class="tabHint" :title="selectedBridgeTab?.url || 'Phiên đã đổi hoặc mất kết nối'">
      AI-Bridge · {{ selectedBridgeTab ? `Tab ${selectedBridgeTab.tabId} · ${bridgeTabCanRun(selectedBridgeTab, outputKind) ? 'Đã xác minh' : missingBridgeKind}` : 'Phiên đã thay đổi, hãy chọn lại tab' }}
    </span>
    <span v-if="bridgeDiscoveries.length && !bridgeModels.length && outputKind !== 'text'" class="chromeNotice" role="status">
      AI-Bridge đã thấy {{ bridgeDiscoveries.reduce((sum, item) => sum + item.count, 0) }} tab,
      nhưng chưa có model {{ outputKind === 'image' ? 'tạo ảnh' : outputKind === 'video' ? 'tạo video' : 'âm thanh' }}
      được adapter xác minh. Danh sách dưới đây chỉ để kiểm tra kết nối.
    </span>
    <span v-if="bridgeError" class="tabError" role="status">{{ bridgeError }}</span>
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
import { bridgeTabCanRun, bridgeTabDiscoveries } from "../bridgeModelAvailability";
import { chromeServiceId, chromeServiceLabel, chromeTabLabel, chromeTargetService, readChromeTabs, type ChromeOutputKind, type ChromeServiceId, type ChromeTabTarget } from "../chromeTabs";
import modelLabel from "./modelLabel.vue";

type BridgeTab = { profileInstanceId: string; tabId: number; provider: string; title?: string; url: string; documentToken: string; ready: boolean; busy: boolean; input_image_support?: boolean; outputKinds?: string[] };
type BridgeProvider = { id: string; label: string };
type BridgeSnapshot = { tabs: BridgeTab[]; providers: BridgeProvider[] };
function bridgeKey(tab: BridgeTab) { return JSON.stringify([tab.profileInstanceId, tab.tabId, tab.documentToken, tab.url]); }
const bridgeNames: Record<string, string> = { muse: "Muse", chatgpt: "ChatGPT", gemini: "Gemini", claude: "Claude", grok: "Grok", deepseek: "DeepSeek", perplexity: "Perplexity", qwen: "Qwen", kimi: "Kimi", zai: "Z.ai" };
async function readBridgeTabs(custom = false): Promise<BridgeSnapshot> {
  const path = custom ? "/api/aiBridge/custom/status" : "/api/aiBridge/status";
  const response = await fetch(path, { headers: { "x-toonflow-workspace": "1" }, cache: "no-store", signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error("Không kết nối được AI-Bridge; kiểm tra Cài đặt → AI-Bridge Control Center.");
  const payload = await response.json();
  const status = payload?.data ?? payload;
  const tabs: BridgeTab[] = Array.isArray(status?.tabs) ? status.tabs.filter((tab: Partial<BridgeTab>): tab is BridgeTab => Number.isSafeInteger(tab.tabId) && typeof tab.provider === "string"
    && Object.hasOwn(bridgeNames, tab.provider) && typeof tab.profileInstanceId === "string" && !!tab.profileInstanceId
    && typeof tab.documentToken === "string" && !!tab.documentToken && typeof tab.url === "string" && tab.url.startsWith("https://")
    && typeof tab.ready === "boolean" && typeof tab.busy === "boolean") : [];
  const providers: BridgeProvider[] = Array.isArray(status?.providers)
    ? status.providers.filter((item: Partial<BridgeProvider>): item is BridgeProvider =>
      !!item && typeof item.id === "string" && Object.hasOwn(bridgeNames, item.id)
      && typeof item.label === "string" && !!item.label)
    : [];
  return { tabs, providers };
}


type ModelItem = NodeAiModel | NodeMediaModel;
const props = defineProps<{
  modelValue: string;
  chromeTabId?: number;
  bridgeTarget?: string;
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
  "update:bridgeTarget": [value: string | undefined];
  open: [];
}>();
const targets = ref<ChromeTabTarget[]>([]);
const bridgeTabs = ref<BridgeTab[]>([]);
const customBridgeTabs = ref<BridgeTab[]>([]);
const bridgeProviders = ref<BridgeProvider[]>([]);
const bridgeError = ref("");
const bridgeModels = computed(() => props.models.filter(model => model.providerId === "aiBridge" || model.providerId === "aiBridgeLocal" || model.providerId === "aiBr"));
const bridgeDiscoveries = computed(() => {
  const detected = bridgeTabDiscoveries(bridgeTabs.value, props.outputKind);
  const found = new Map(detected.map(item => [item.provider, item]));
  return [...bridgeProviders.value.map(provider => found.get(provider.id) ?? {
    provider: provider.id, count: 0, ready: 0, capable: 0,
  }), ...detected.filter(item => !bridgeProviders.value.some(provider => provider.id === item.provider))];
});
const missingBridgeKind = computed(() => props.outputKind === "image" ? "chưa xác minh tạo ảnh"
  : props.outputKind === "video" ? "chưa xác minh tạo video"
    : props.outputKind === "audio" ? "chưa xác minh âm thanh" : "chưa có model văn bản");
const bridgeSelected = computed(() => selectedModel.value && (selectedModel.value.providerId === "aiBridge" || selectedModel.value.providerId === "aiBridgeLocal" || selectedModel.value.providerId === "aiBr") ? selectedModel.value : undefined);
const selectedBridgeTab = computed(() => (bridgeSelected.value?.providerId === "aiBridgeLocal" || bridgeSelected.value?.providerId === "aiBr"
  ? customBridgeTabs.value : bridgeTabs.value).find(tab => bridgeKey(tab) === props.bridgeTarget
  && (bridgeSelected.value?.providerId === "aiBridgeLocal" || bridgeSelected.value?.providerId === "aiBr" || tab.provider === bridgeSelected.value?.modelId)));
const bridgeChoice = computed(() => selectedBridgeTab.value && bridgeSelected.value
  ? [getNodeModelKey(bridgeSelected.value), bridgeKey(selectedBridgeTab.value)] : []);
const bridgeOptions = computed(() => bridgeModels.value.map(model => {
  const entries = model.providerId === "aiBridgeLocal" || model.providerId === "aiBr" ? customBridgeTabs.value : bridgeTabs.value;
  const children = entries.filter(tab => model.providerId === "aiBridgeLocal" || model.providerId === "aiBr" || tab.provider === model.modelId).map(tab => ({
    value: bridgeKey(tab), label: `${tab.title || bridgeNames[tab.provider]} · Tab ${tab.tabId} · Profile ${tab.profileInstanceId.slice(0, 8)} · ${bridgeTabCanRun(tab, props.outputKind) ? 'Sẵn sàng' : missingBridgeKind.value}`,
    status: tab.busy ? "busy" : tab.ready ? "ready" : "offline",
    disabled: !bridgeTabCanRun(tab, props.outputKind),
  }));
  return { value: getNodeModelKey(model), label: model.label, disabled: !children.length, children };
}).concat(bridgeDiscoveries.value.filter(info => info.count > 0 && !bridgeModels.value.some(model =>
  model.providerId === "aiBridge" && model.modelId === info.provider)).map(info => ({
  value: `__bridge_unverified_${info.provider}`,
  label: `${bridgeNames[info.provider] || info.provider} · ${missingBridgeKind.value}`,
  disabled: false,
  children: bridgeTabs.value.filter(tab => tab.provider === info.provider).map(tab => ({
    value: bridgeKey(tab),
    label: `Tab ${tab.tabId} · Profile ${tab.profileInstanceId.slice(0, 8)} · ${tab.busy ? 'Đang chạy' : !tab.ready ? 'Ngoại tuyến' : missingBridgeKind.value}`,
    status: tab.busy ? "busy" : tab.ready ? "ready" : "offline",
    disabled: true,
  })),
}))));
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
// Cloud AI-Br models are selectable without choosing a tab when the dashboard
// has pinned the target. The optional tab picker remains available beside it.
const regularGroups = computed(() => groupNodeModels(props.models.filter(model => !chromeServiceId(model) && model.providerId !== "aiBridge" && model.providerId !== "aiBridgeLocal")));
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
  if (value !== props.modelValue) { emit("update:chromeTabId", undefined); emit("update:bridgeTarget", undefined); }
}
function onModelOpen(visible: boolean) {
  if (visible) emit("open");
}
function onChromeOpen(visible: boolean) {
  if (!visible) return;
  emit("open");
  void refresh(true);
}
async function refreshBridge() {
  const [normal, custom] = await Promise.allSettled([readBridgeTabs(false), readBridgeTabs(true)]);
  bridgeTabs.value = normal.status === "fulfilled" ? normal.value.tabs : [];
  bridgeProviders.value = normal.status === "fulfilled" ? normal.value.providers : [];
  customBridgeTabs.value = custom.status === "fulfilled" ? custom.value.tabs : [];
  const error = bridgeSelected.value?.providerId === "aiBridgeLocal" || bridgeSelected.value?.providerId === "aiBr" ? custom : normal;
  bridgeError.value = error.status === "rejected"
    ? error.reason instanceof Error ? error.reason.message : "Không đọc được tab AI-Bridge."
    : "";
}
function onBridgeOpen(visible: boolean) { if (visible) { emit("open"); void refreshBridge(); } }
function chooseBridge(value: unknown) {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(item => typeof item === "string")) return;
  const model = findNodeModel(bridgeModels.value, value[0]);
  const tab = (model?.providerId === "aiBridgeLocal" || model?.providerId === "aiBr" ? customBridgeTabs.value : bridgeTabs.value)
    .find(item => bridgeKey(item) === value[1]);
  if (!model || !tab || !bridgeTabCanRun(tab, props.outputKind)
    || model.providerId !== "aiBridgeLocal" && model.providerId !== "aiBr" && model.modelId !== tab.provider) return;
  emit("update:modelValue", value[0]);
  emit("update:chromeTabId", undefined);
  emit("update:bridgeTarget", bridgeKey(tab));
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
  emit("update:bridgeTarget", undefined);
}
onMounted(() => { void refresh(); void refreshBridge(); refreshTimer = setInterval(() => {
  if (chromeSelected.value) void refresh();
  if (bridgeSelected.value) void refreshBridge();
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
