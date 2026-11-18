<template>
  <div class="bridgeSettings">
    <section class="panelSection">
      <header class="sectionHeader">
        <h3>Kết nối AI-Bridge (API)</h3>
        <el-tag size="small" :type="apiStateType">{{ apiStateLabel }}</el-tag>
      </header>
      <p class="hint">MacFlow sử dụng API do AI-Bridge cung cấp. Chọn AI, tab và thực hiện tạo ảnh/video trong các node trên Canvas.</p>
      <p class="hint">Nguồn API đang dùng: <strong>{{ config ? config.source === 'custom' ? 'Tùy chỉnh (4319)' : 'Gốc (4320)' : 'Chưa đọc được cấu hình' }}</strong>
        <span v-if="config"> · <code>{{ config.baseUrl }}</code></span>
      </p>

      <div class="keySetup">
        <label for="bridgeSetupKey">API Key AI-Bridge tùy chỉnh (4319)</label>
        <el-input
          id="bridgeSetupKey"
          v-model="setupKey"
          type="password"
          showPassword
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="Dán API Key"
          :disabled="settingUp"
          @keyup.enter="connectKey"
        />
        <p class="hint">API Key được gửi tới backend MacFlow để xác minh và lưu trên máy Mac. MacFlow không lưu khóa trong bộ nhớ trình duyệt.</p>
        <div class="actions">
          <el-button type="primary" :loading="settingUp" :disabled="loading || settingUp || (!setupKey.trim() && !savedKeyAvailable)" @click="connectKey">
            {{ setupKey.trim() ? 'Xác minh và lưu API Key' : 'Kiểm tra lại kết nối' }}
          </el-button>
          <el-tag v-if="config?.source === 'custom'" type="success">Đang dùng API 4319</el-tag>
          <el-tag v-else-if="savedKeyAvailable" type="info">Đã lưu khóa của 4319</el-tag>
        </div>
        <el-alert v-if="setupError" type="error" :title="setupError" :closable="false" showIcon />
        <el-alert v-if="setupResult?.saved && !setupResult.activated" type="warning" :closable="false" showIcon
          :title="setupResult.reason || 'API Key hợp lệ và đã lưu, nhưng chưa kích hoạt nguồn 4319.'"
          description="Số model hợp lệ chưa bảo đảm tab tạo ảnh/video sẵn sàng. Có thể kiểm tra lại khi AI/tab đã được xác minh." />
        <el-alert v-else-if="setupResult?.activated" type="success" :closable="false" showIcon
          title="API Key được xác minh, nguồn 4319 đã kích hoạt"
          :description="'API trả về ' + setupResult.modelCount + ' model; ' + setupResult.readyTabs + ' tab sẵn sàng tại thời điểm kiểm tra.'" />
      </div>

      <div class="actions">
        <el-button :loading="loading" :disabled="settingUp" @click="refresh">Làm mới trạng thái API và AI/tab</el-button>
      </div>
      <el-alert v-if="configError" type="warning" :title="configError" :closable="false" showIcon />
      <div class="statusSummary">
        <strong>Trạng thái API đang sử dụng</strong>
        <template v-if="diagnostics">
          <p class="hint">Máy chủ: {{ diagnostics.healthOk ? 'Có phản hồi' : 'Không xác minh được' }} ·
            Danh sách model: {{ diagnostics.modelsOk ? diagnostics.modelCount + ' model' : 'Chưa truy cập được' }} ·
            API danh sách tab: {{ diagnostics.statusOk ? 'Có phản hồi' : 'Không truy cập được' }}</p>
          <p class="hint">Địa chỉ API: <code>{{ diagnostics.baseUrl }}</code></p>
          <p class="hint">Danh sách model hợp lệ chỉ xác nhận API phản hồi; khả năng tạo ảnh/video còn phụ thuộc AI và tab được chọn trên Canvas.</p>
        </template>
        <p v-else class="hint">Chưa có kết quả kiểm tra API.</p>
        <el-alert v-if="diagnosticsError" type="warning" :title="diagnosticsError" :closable="false" showIcon />
      </div>

      <details class="sourceDetails">
        <summary>Thông tin các nguồn API (chỉ xem)</summary>
        <template v-if="sources">
          <p v-for="item in [sources.original, sources.custom]" :key="item.source" class="hint">
            <strong>{{ item.source === 'custom' ? 'Tùy chỉnh (4319)' : 'Gốc (4320)' }}</strong>
            {{ item.source === sources.active ? ' · Đang sử dụng' : '' }} ·
            <code>{{ item.origin }}</code> ·
            {{ item.healthOk ? 'Máy chủ có phản hồi' : 'Chưa kết nối máy chủ' }} ·
            {{ item.authorized ? 'API xác thực được' : 'Chưa xác thực API' }} ·
            {{ item.readyTabs }} tab sẵn sàng
          </p>
        </template>
        <p v-else class="hint">Chưa có dữ liệu hai nguồn API.</p>
        <el-alert v-if="sourcesError" type="warning" :title="sourcesError" :closable="false" showIcon />
      </details>
    </section>

    <section class="panelSection">
      <header class="sectionHeader">
        <h3>AI và tab được AI-Bridge phát hiện</h3>
        <el-tag size="small" type="info">{{ status ? tabs.length + ' tab · ' + status.connected_extensions + ' kết nối' : 'Chưa có dữ liệu' }}</el-tag>
      </header>
      <p class="hint">Danh sách chỉ để theo dõi. Mỗi node Canvas tự chọn đúng AI và tab; khi tab tải lại trang hoặc đổi phiên, MacFlow cần xác minh lại trước khi gửi yêu cầu.</p>
      <el-alert v-if="statusError" type="warning" :title="statusError" :closable="false" showIcon />
      <p v-if="status && !status.connected_extensions" class="hint">Chưa có kết nối AI nào được AI-Bridge báo về.</p>
      <p v-else-if="status && !providers.length" class="hint">AI-Bridge chưa báo danh sách nhà cung cấp hoặc tab.</p>
      <div v-for="provider in providers" :key="provider.id" class="providerGroup">
        <div class="providerHeader">
          <strong>{{ provider.label }}</strong>
          <el-tag size="small" :type="groupTabs(provider.id).some(tab => tab.ready && !tab.busy) ? 'success' : 'info'">
            {{ groupTabs(provider.id).length }} tab
          </el-tag>
        </div>
        <p v-if="!groupTabs(provider.id).length" class="hint">Chưa phát hiện tab cho AI này.</p>
        <div v-for="tab in groupTabs(provider.id)" :key="bridgeTabKey(tab)" class="tabItem">
          <div class="tabContent">
            <strong>{{ tab.title || provider.label }}</strong>
            <small :title="tab.url">{{ tab.url }}</small>
            <small>Profile {{ tab.profileInstanceId.slice(0, 8) }} · Tab {{ tab.tabId }} · Phiên {{ tab.documentToken.slice(0, 8) }}</small>
            <small v-if="tab.outputKinds?.length">Đầu ra: {{ tab.outputKinds.join(', ') }}</small>
          </div>
          <el-tag size="small" :type="tab.busy ? 'warning' : tab.ready ? 'success' : 'info'">
            {{ tab.busy ? 'Đang chạy' : tab.ready ? 'Sẵn sàng' : 'Chưa sẵn sàng' }}
          </el-tag>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  bridgeProviderName, bridgeTabKey, connectCustomBridge, readBridgeConfig,
  readBridgeDiagnostics, readBridgeSources, readBridgeStatus,
  type BridgeConfig, type BridgeConnectResult, type BridgeDiagnostics,
  type BridgeSources, type BridgeStatus, type BridgeTab,
} from "@/lib/aiBridge";

const props = defineProps<{ visible?: boolean }>();
const config = ref<BridgeConfig>();
const status = ref<BridgeStatus>();
const diagnostics = ref<BridgeDiagnostics>();
const sources = ref<BridgeSources>();
const setupKey = ref("");
const setupResult = ref<BridgeConnectResult>();
const setupError = ref("");
const configError = ref("");
const statusError = ref("");
const diagnosticsError = ref("");
const sourcesError = ref("");
const loading = ref(false);
const settingUp = ref(false);
const polling = ref(false);
const controller = new AbortController();
let poll: ReturnType<typeof setInterval> | undefined;
let viewGeneration = 0;
let loadingGeneration = -1;

const savedKeyAvailable = computed(() => config.value?.customKeySaved === true || setupResult.value?.saved === true);
const apiStateType = computed(() => diagnostics.value?.modelsOk ? "success" : diagnostics.value ? "warning" : "info");
const apiStateLabel = computed(() => diagnostics.value?.modelsOk ? "Danh sách model truy cập được" : diagnostics.value ? "API chưa xác minh" : "Chưa kiểm tra");
const tabs = computed(() => (Array.isArray(status.value?.tabs) ? status.value.tabs : []).filter(tab =>
  tab && typeof tab.provider === "string" && typeof tab.profileInstanceId === "string"
  && typeof tab.documentToken === "string" && typeof tab.url === "string"
  && tab.url.startsWith("https://") && Number.isSafeInteger(tab.tabId)));
const providers = computed(() => {
  const known = new Map<string, string>();
  for (const provider of Array.isArray(status.value?.providers) ? status.value.providers : []) {
    if (provider && typeof provider.id === "string") known.set(provider.id, provider.label || bridgeProviderName(provider.id));
  }
  for (const tab of tabs.value) if (!known.has(tab.provider)) known.set(tab.provider, bridgeProviderName(tab.provider));
  return Array.from(known, ([id, label]) => ({ id, label }));
});
function groupTabs(providerId: string): BridgeTab[] { return tabs.value.filter(tab => tab.provider === providerId); }
function visibleNow(generation: number) { return props.visible !== false && !controller.signal.aborted && generation === viewGeneration; }
function message(cause: unknown, fallback: string) { return cause instanceof Error ? cause.message : fallback; }

async function refresh() {
  if (loading.value && loadingGeneration === viewGeneration
    || settingUp.value || props.visible === false || controller.signal.aborted) return;
  const generation = viewGeneration;
  loadingGeneration = generation;
  loading.value = true;
  try {
    const [nextConfig, nextStatus, nextDiagnostics, nextSources] = await Promise.allSettled([
      readBridgeConfig(controller.signal), readBridgeStatus(controller.signal),
      readBridgeDiagnostics(controller.signal), readBridgeSources(controller.signal),
    ]);
    if (!visibleNow(generation)) return;
    config.value = nextConfig.status === "fulfilled" ? nextConfig.value : undefined;
    status.value = nextStatus.status === "fulfilled" ? nextStatus.value : undefined;
    diagnostics.value = nextDiagnostics.status === "fulfilled" ? nextDiagnostics.value : undefined;
    sources.value = nextSources.status === "fulfilled" ? nextSources.value : undefined;
    configError.value = nextConfig.status === "rejected" ? message(nextConfig.reason, "Không đọc được cấu hình API.") : "";
    statusError.value = nextStatus.status === "rejected" ? message(nextStatus.reason, "Không đọc được danh sách AI/tab.") : "";
    diagnosticsError.value = nextDiagnostics.status === "rejected" ? message(nextDiagnostics.reason, "Không kiểm tra được danh sách model.") : "";
    sourcesError.value = nextSources.status === "rejected" ? message(nextSources.reason, "Không đọc được trạng thái nguồn API.") : "";
  } finally { if (loadingGeneration === generation) loading.value = false; }
}

async function refreshTabs() {
  if (polling.value || loading.value || props.visible === false || controller.signal.aborted) return;
  const generation = viewGeneration;
  polling.value = true;
  try {
    const nextStatus = await readBridgeStatus(controller.signal);
    if (visibleNow(generation)) { status.value = nextStatus; statusError.value = ""; }
  } catch (cause) {
    if (visibleNow(generation)) {
      status.value = undefined;
      statusError.value = message(cause, "Không cập nhật được trạng thái AI/tab.");
    }
  } finally { polling.value = false; }
}

async function connectKey() {
  const apiKey = setupKey.value.trim();
  if (settingUp.value || loading.value || (!apiKey && !savedKeyAvailable.value)) return;
  const generation = viewGeneration;
  settingUp.value = true;
  setupError.value = "";
  setupResult.value = undefined;
  try {
    const next = await connectCustomBridge(apiKey || undefined, controller.signal);
    if (!visibleNow(generation)) return;
    setupResult.value = next;
    if (next.saved) setupKey.value = "";
    else setupError.value = next.reason || "API Key chưa được xác minh hoặc lưu.";
  } catch (cause) {
    if (visibleNow(generation)) setupError.value = message(cause, "Không kết nối được AI-Bridge.");
  } finally {
    settingUp.value = false;
    if (visibleNow(generation)) void refresh();
  }
}

watch(() => props.visible, visible => {
  viewGeneration += 1;
  clearInterval(poll);
  if (visible !== false) {
    void refresh();
    poll = setInterval(() => void refreshTabs(), 8000);
  } else {
    setupKey.value = "";
    setupResult.value = undefined;
    setupError.value = "";
    config.value = undefined;
    status.value = undefined;
    diagnostics.value = undefined;
    sources.value = undefined;
    configError.value = "";
    statusError.value = "";
    diagnosticsError.value = "";
    sourcesError.value = "";
  }
}, { immediate: true });
onBeforeUnmount(() => {
  clearInterval(poll);
  controller.abort();
  setupKey.value = "";
  setupResult.value = undefined;
  config.value = undefined;
});
</script>

<style scoped lang="scss">
.bridgeSettings { display: grid; gap: 16px; padding-bottom: 12px; }
.panelSection { display: grid; gap: 12px; padding: 16px; border: 1px solid var(--el-border-color-light); border-radius: 10px; background: var(--el-bg-color); }
.sectionHeader { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.sectionHeader h3 { margin: 0; font-size: 14px; }
.hint { margin: 0; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.hint code { user-select: text; overflow-wrap: anywhere; }
.keySetup { display: grid; gap: 10px; padding: 14px; border: 1px solid var(--el-border-color); border-radius: 8px; }
.keySetup label { font-size: 13px; font-weight: 600; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.statusSummary { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; }
.sourceDetails { display: grid; gap: 8px; }
.sourceDetails summary { cursor: pointer; color: var(--el-text-color-secondary); font-size: 12px; }
.sourceDetails[open] > *:not(summary) { margin-top: 8px; }
.providerGroup { display: grid; gap: 8px; padding-top: 12px; border-top: 1px solid var(--el-border-color-lighter); }
.providerHeader { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tabItem { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; padding: 10px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; }
.tabContent { display: grid; gap: 3px; min-width: 0; font-size: 12px; }
.tabContent small { overflow-wrap: anywhere; color: var(--el-text-color-secondary); }
</style>
