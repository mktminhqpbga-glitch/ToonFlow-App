<template>
  <div class="bridgePanel">
    <el-alert
      v-if="loadError" type="error" :title="loadError" :closable="false" showIcon />
    <el-card shadow="never" class="bridgeCard">
      <div class="bridgeHeading">
        <div>
          <h3>Chrome Bridge mode</h3>
          <el-text type="info" size="small">Local stays on 127.0.0.1; Remote connects out to Render.</el-text>
        </div>
      </div>
      <el-radio-group :modelValue="status.mode || 'local'" :disabled="!!busy" @update:modelValue="changeMode">
        <el-radio-button value="local">Chrome on this Mac</el-radio-button>
        <el-radio-button value="remote">Chrome through Render</el-radio-button>
      </el-radio-group>
    </el-card>
    <el-card v-if="status.mode === 'remote'" shadow="never" class="bridgeCard">
      <div class="bridgeHeading">
        <div>
          <h3>Remote Relay · Render</h3>
          <el-text type="info" size="small">Both devices connect out over WSS or HTTPS. The Relay URL must point to your Render Web Service.</el-text>
        </div>
        <el-tag effect="plain" :type="status.remote?.transport === 'wss' ? 'success' : 'warning'">
          {{ status.remote?.transport || 'offline' }}
        </el-tag>
      </div>
      <el-input v-model="relayUrl" placeholder="https://your-render-service.onrender.com" aria-label="Render Relay HTTPS URL" />
      <el-input v-model="relayKey" type="password" showPassword autocomplete="off" placeholder="RELAY_OWNER_KEY" aria-label="Render owner key" />
      <div class="bridgeActions">
        <el-button type="primary" :loading="remoteBusy" @click="saveRelay">Connect Render</el-button>
        <el-button :loading="remoteBusy" :disabled="!status.remote?.configured" @click="loadDevices">Refresh devices</el-button>
      </div>
      <el-alert v-if="!status.remote?.configured" type="info" :closable="false"
        title="Enter Render Relay HTTPS URL and owner key to enable remote connections." />
      <div v-if="status.remote?.configured" class="remoteControls">
        <div class="bridgeActions">
          <el-button type="primary" :loading="remoteBusy" @click="newPairCode">New one-time pairing code</el-button>
        </div>
        <div v-if="status.pairingCode" class="pairControls">
          <el-input :modelValue="status.pairingCode" type="password" showPassword readonly aria-label="Remote device pairing code" />
          <el-button :icon="IconCopy" @click="copyPairing">Copy</el-button>
        </div>
        <el-text v-if="status.remote?.expiresAt" type="info" size="small">
          Pairing expires: {{ new Date(status.remote.expiresAt).toLocaleString() }}
        </el-text>
        <div v-for="pair in status.remote?.pending || []" :key="pair.pairId" class="remoteRow">
          <el-text>{{ pair.name }} · pending approval</el-text>
          <el-button size="small" :disabled="!!remoteBusy" type="primary" @click="approvePair(pair.pairId)">Approve device</el-button>
        </div>
        <el-select v-model="deviceSelection" class="tabSelector" filterable
          placeholder="Select paired Chrome device" aria-label="Remote Chrome device" @change="selectDevice">
          <el-option v-for="device in status.remote?.devices || []" :key="device.id"
            :label="device.name + (device.online ? ' · online' : ' · offline')" :value="device.id" />
        </el-select>
        <div v-if="deviceSelection" class="remoteRow">
          <el-input v-model="deviceName" placeholder="New device name" aria-label="Rename Chrome device" />
          <el-button :disabled="!deviceName.trim() || !!remoteBusy" @click="renameDevice">Rename</el-button>
          <el-button type="danger" plain :disabled="!!remoteBusy" @click="revokeDevice">Revoke</el-button>
        </div>
        <el-alert v-if="!status.connected" type="warning" :closable="false"
          title="Chrome offline or Relay not reachable. Check HTTPS access and pairing on the remote machine." />
      </div>
    </el-card>
    <el-card v-if="status.mode !== 'remote'" shadow="never" class="bridgeCard">
      <div class="bridgeHeading">
        <div>
          <h3>Chrome Companion</h3>
          <el-text type="info" size="small">仅通过本机 Chrome 中您主动选择的 AI 标签页工作。不会读取登录密码或 Cookie。</el-text>
        </div>
        <el-tag :type="status.connected ? 'success' : 'info'" effect="plain">
          {{ status.connected ? "已连接" : "未连接" }}
        </el-tag>
      </div>
      <el-alert
        v-if="!status.connected" type="info" :closable="false" showIcon
        title="先在 Chrome 安装 ToonFlow Companion 扩展并在扩展弹窗中输入配对码。" />
      <div class="pairControls" v-if="status.pairingCode">
        <el-input :modelValue="status.pairingCode" readonly type="password" showPassword aria-label="Chrome 配对码" />
        <el-button :icon="IconCopy" @click="copyPairing">复制配对码</el-button>
      </div>
      <div class="bridgeLinks">
        <el-text size="small" type="info">
          扩展位于项目 packages/chromeCompanion，Chrome 扩展管理页启用开发者模式后选择“加载已解压的扩展程序”。
        </el-text>
        <el-button text :icon="IconExternalLink" @click="openInstructions">安装说明</el-button>
      </div>
      <div class="bridgeActions">
        <el-button :loading="refreshing" :icon="IconRefresh" @click="refresh">刷新状态</el-button>
        <el-button v-if="status.connected" :loading="loadingTabs" :icon="IconBrowser" @click="fetchTabs">查找 AI 标签页</el-button>
      </div>
    </el-card>
    <el-card v-for="provider in providers" :key="provider.id" class="bridgeCard" shadow="never">
      <div class="bridgeHeading">
        <div>
          <h3>{{ provider.label }}</h3>
          <el-text type="info" size="small">{{ provider.description }}</el-text>
        </div>
        <el-tag effect="plain" :type="selected(provider.id) ? 'success' : 'info'">
          {{ currentState(provider.id) }}
        </el-tag>
      </div>
      <el-select
        v-model="tabSelection[provider.id]"
        filterable clearable class="tabSelector" :disabled="!status.connected || !!busy"
        :placeholder="'选择 ' + provider.label + ' 标签页'" aria-label="选择 Chrome 标签页">
        <el-option v-for="tab in tabs.filter(item => item.provider === provider.id)"
          :key="tab.id" :label="tab.title || tab.url" :value="tab.id" />
      </el-select>
      <div class="bridgeActions">
        <el-button type="primary" :disabled="!status.connected || tabSelection[provider.id] == null || !!busy"
          :loading="busy === provider.id" @click="connectProvider(provider.id)">连接</el-button>
        <el-button :disabled="!selected(provider.id) || !!busy"
          :loading="busy === provider.id" @click="refreshProvider(provider.id)">检查连接</el-button>
        <el-button :disabled="!selected(provider.id) || !!busy"
          @click="disconnectProvider(provider.id)">断开</el-button>
      </div>
      <el-text v-if="selected(provider.id)" type="info" size="small">
        可用能力：{{ selected(provider.id)?.capabilities.join("、") || "未确认" }}。
        仅显示已经从当前标签页检测到的能力；网站界面变更可能导致暂不可用。
      </el-text>
      <el-alert v-if="!status.connected" type="info" :closable="false" title="Chrome Companion 尚未配对" />
      <el-alert v-else-if="!selected(provider.id)" type="warning" :closable="false" title="请选择已登录并打开对话的标签页。若缺少输入框，检查登录状态。" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { ElAlert, ElButton, ElCard, ElInput, ElMessage, ElMessageBox, ElOption, ElRadioButton, ElRadioGroup, ElSelect, ElTag, ElText } from "element-plus";
import { IconBrowser, IconCopy, IconExternalLink, IconRefresh } from "@tabler/icons-vue";
import { invalidateNodeModels } from "@toonflow/nodes-scaffold/nodeAi";

type Provider = "muse" | "gemini" | "chatgpt";
type Tab = { id: number; title: string; url: string; provider: Provider };
type Selection = { tab: Tab; capabilities: string[] };
type Status = {
  enabled: boolean; connected: boolean; pairingCode: string | null; mode?: "local" | "remote";
  remote?: { url: string; configured: boolean; transport: "wss" | "https" | "offline";
    devices: { id: string; name: string; online: boolean; createdAt: number }[];
    pending: { pairId: string; name: string; expiresAt: number }[];
    selectedDeviceId: string; expiresAt: number | null; };
  selected: Partial<Record<Provider, Selection>>;
  jobs: { id: string; provider: Provider; tabId: number; state: string }[];
};

const props = defineProps<{ visible?: boolean }>();
const providers: { id: Provider; label: string; description: string }[] = [
  { id: "muse", label: "Muse", description: "图片和视频：只有网站当前显示生成模式时才允许启用。" },
  { id: "gemini", label: "Gemini", description: "文本；图片生成需在当前帐号显示相应入口。不提供视频。" },
  { id: "chatgpt", label: "ChatGPT", description: "文本；图片生成需在当前帐号显示相应入口。不提供视频。" },
];
const empty = (): Status => ({ enabled: false, connected: false, pairingCode: null, selected: {}, jobs: [] });
const status = ref<Status>(empty());
const tabs = ref<Tab[]>([]);
const tabSelection = reactive<Record<Provider, number | undefined>>({ muse: undefined, gemini: undefined, chatgpt: undefined });
const busy = ref<Provider | "">("");
const refreshing = ref(false);
const loadingTabs = ref(false);
const loadError = ref("");
const remoteBusy = ref(false);
const relayUrl = ref("");
const relayKey = ref("");
const deviceSelection = ref("");
const deviceName = ref("");
let timer: ReturnType<typeof setInterval> | undefined;
function selected(provider: Provider) { return status.value.selected[provider]; }
function currentState(provider: Provider) {
  if (!status.value.connected) return "disconnected";
  if (busy.value === provider) return "connecting";
  if (!selected(provider)) return "idle";
  const job = status.value.jobs.find(item => item.provider === provider);
  return job?.state || "ready";
}
async function api<T>(path: string, body?: object): Promise<T> {
  const response = await fetch("/api/desktop/chromeBridge/" + path, {
    method: body ? "POST" : "GET", cache: "no-store",
    headers: { "x-toonflow-desktop": "1", "x-toonflow-workspace": "1",
      ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok || result.code !== 200) throw new Error(result.message || "Chrome Bridge 请求失败");
  return result.data as T;
}
function invalidate() {
  invalidateNodeModels("language");
  invalidateNodeModels("media");
}
async function refresh() {
  if (refreshing.value) return;
  refreshing.value = true;
  try {
    const next = await api<Status>("status");
    const changed = JSON.stringify(status.value.selected) !== JSON.stringify(next.selected)
      || status.value.connected !== next.connected;
    const modeChanged = status.value.mode !== next.mode
      || status.value.remote?.selectedDeviceId !== next.remote?.selectedDeviceId;
    status.value = next;
    if (!next.connected || modeChanged) tabs.value = [];
    if (modeChanged) invalidate();
    if (next.remote?.url && !relayUrl.value) relayUrl.value = next.remote.url;
    if (next.remote?.selectedDeviceId) deviceSelection.value = next.remote.selectedDeviceId;
    if (changed) invalidate();
    loadError.value = "";
  } catch (error) { loadError.value = error instanceof Error ? error.message : "无法查询连接状态"; }
  finally { refreshing.value = false; }
}
async function fetchTabs() {
  loadingTabs.value = true;
  try {
    tabs.value = await api<Tab[]>("tabs");
    if (!tabs.value.length) ElMessage.warning("未发现 Muse、Gemini 或 ChatGPT 标签页；请在 Chrome 中打开并登录。");
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : "无法读取 Chrome 标签页"); }
  finally { loadingTabs.value = false; }
}
async function action(provider: Provider, path: string, data: object) {
  if (busy.value) return;
  busy.value = provider;
  try {
    status.value = await api<Status>(path, data);
    invalidate();
    ElMessage.success("设置已更新");
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : "操作失败"); }
  finally { busy.value = ""; }
}
async function remoteAction(path: string, body?: object) {
  if (remoteBusy.value) return;
  remoteBusy.value = true;
  try {
    status.value = await api<Status>(path, body || {});
    invalidate();
    ElMessage.success("Remote settings updated");
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : "Remote error"); }
  finally { remoteBusy.value = false; }
}
function changeMode(value: string | number | boolean | undefined) {
  if (value !== "local" && value !== "remote") return;
  void remoteAction("mode", { mode: value });
}
function saveRelay() {
  if (!relayUrl.value.trim() || !relayKey.value.trim()) {
    ElMessage.warning("Enter Relay URL and owner key"); return;
  }
  void remoteAction("remote/config", { url: relayUrl.value.trim(), ownerKey: relayKey.value.trim() })
    .then(() => { relayKey.value = ""; });
}
function loadDevices() { void refresh(); }
function newPairCode() { void remoteAction("remote/pair", {}); }
function approvePair(pairId: string) { void remoteAction("remote/approve", { pairId }); }
function selectDevice(deviceId: string) {
  deviceSelection.value = deviceId;
  void remoteAction("remote/selectDevice", { deviceId });
}
function renameDevice() {
  if (deviceSelection.value) void remoteAction("remote/rename", { deviceId: deviceSelection.value, name: deviceName.value.trim() });
}
async function revokeDevice() {
  if (!deviceSelection.value) return;
  try {
    await ElMessageBox.confirm("Revoke this Chrome device? Running tasks cannot be recovered.", "Revoke device", { type: "warning" });
    await remoteAction("remote/revoke", { deviceId: deviceSelection.value });
    deviceSelection.value = "";
  } catch { /* User cancelled the confirmation. */ }
}
function connectProvider(provider: Provider) {
  const tabId = tabSelection[provider];
  if (tabId != null) void action(provider, "select", { provider, tabId });
}
function refreshProvider(provider: Provider) { void action(provider, "refresh", { provider }); }
function disconnectProvider(provider: Provider) { void action(provider, "disconnect", { provider }); }
async function copyPairing() {
  if (!status.value.pairingCode) return;
  try { await navigator.clipboard.writeText(status.value.pairingCode); ElMessage.success("已复制配对码"); }
  catch { ElMessage.error("复制失败，请手动选择并复制配对码"); }
}
function openInstructions() {
  window.open("https://github.com/mktminhqpbga-glitch/ToonFlow-App/tree/feat/chromeBridgeMuseGeminiChatgpt/packages/chromeCompanion", "_blank", "noopener,noreferrer");
}
onMounted(() => {
  void refresh();
  timer = setInterval(() => { if (props.visible !== false) void refresh(); }, 10000);
});
onBeforeUnmount(() => { if (timer) clearInterval(timer); });
watch(() => status.value.connected, connected => { if (connected && !tabs.value.length) void fetchTabs(); });
</script>

<style scoped lang="scss">
.bridgePanel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 2px 0 20px;

  .bridgeCard {
    border-color: var(--el-border-color-lighter);
    background: var(--el-bg-color);
    :deep(.el-card__body) { display: flex; flex-direction: column; gap: 12px; }
  }

  .bridgeHeading {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 12px;
    h3 { margin: 0 0 6px; font-size: 14px; font-weight: 600; color: var(--el-text-color-primary); }
    > div { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  }

  .tabSelector { width: 100%; }
  .bridgeActions, .bridgeLinks, .pairControls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .bridgeLinks { justify-content: space-between; }
  .pairControls :deep(.el-input) { flex: 1; min-width: 180px; }
  .remoteControls { display: flex; flex-direction: column; gap: 10px; }
  .remoteRow { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  .remoteRow :deep(.el-input) { flex: 1; min-width: 140px; }
}
</style>
