<template>
  <div class="aiChrome">
    <section class="panelSection" aria-labelledby="aiChromeDownloadTitle">
      <div class="sectionHeader">
        <h3 id="aiChromeDownloadTitle">1. Tải và hướng dẫn cài đặt</h3>
        <el-tag type="info" size="small">Extension 0.8.6 — thử nghiệm</el-tag>
      </div>
      <el-button :loading="downloading" @click="download">Tải extension</el-button>
      <h4>Hướng dẫn cài đặt</h4>
      <ol class="instructions">
        <li>Tải và giải nén ZIP vào một thư mục cố định.</li>
        <li>Mở <code>chrome://extensions</code>, bật Chế độ nhà phát triển.</li>
        <li>Chọn Load unpacked (Tải tiện ích đã giải nén), chọn thư mục chứa <code>manifest.json</code>.</li>
        <li>Tạo mã ghép nối tại MacFlow, mở popup extension và dán mã vào ô Mã ghép nối. Extension tự bắt đầu kết nối khi dán đủ mã, hoặc bấm Kết nối.</li>
        <li>Nhấn Kết nối trên extension; MacFlow tự ghép nối ngay, không phải xác nhận thêm. Không cần chọn tab, đánh dấu đầu ra hay ghim tab trong extension.</li>
        <li>Mở Muse, ChatGPT hoặc Gemini trong đúng Chrome đã ghép nối và đăng nhập. Extension tự nhận diện tab và loại đầu ra do adapter hỗ trợ; chọn dịch vụ → tab tại từng node AI.</li>
      </ol>
    </section>

    <section class="panelSection" aria-labelledby="aiChromeConnectionTitle">
      <div class="sectionHeader">
        <h3 id="aiChromeConnectionTitle">2. Kết nối với Chrome</h3>
      </div>
      <el-tabs v-model="connectionMode" aria-label="Kiểu kết nối Chrome">
        <el-tab-pane label="Kết nối thông thường" name="normal" />
        <el-tab-pane label="Kết nối VM" name="vm" />
      </el-tabs>
      <div>
          <p v-if="connectionMode === 'vm'" class="hint">Cài extension trong Chrome của máy ảo Muse AI, rồi chỉ dán mã VM. {{ connection?.relay.configured ? (connection.relay.connected ? 'Relay đã kết nối.' : 'Relay đã cấu hình; tạo mã để kết nối.') : 'Máy chủ MacFlow cần cấu hình relay trước khi tạo mã VM.' }}</p>
          <el-alert v-if="connectionMode === 'vm' && connection?.relay.error" :title="connection.relay.error" type="error" :closable="false" />
          <p role="status" aria-live="polite">{{ statusError ? 'Không đọc được trạng thái' : !connection ? 'Đang đọc trạng thái…' : connection.connected ? 'Đã kết nối Chrome' : connection?.device ? 'Chrome đã ghép nối, chưa kết nối' : 'Chưa ghép nối Chrome' }}</p>
            <p class="hint">Các tác vụ Chrome được chuyển tới đúng tab được chọn trong node. Chỉ dùng các dịch vụ và loại kết quả mà extension thực tế báo sẵn sàng.</p>
            <p v-if="connection?.connected && connectedTargets.some(target => target.provider === 'muse' && !target.outputKinds.includes('image'))" class="hint">
              <strong>Tab Muse đã kết nối nhưng chưa báo hỗ trợ ảnh.</strong>
              Tải extension mới nhất trong mục này, cập nhật tại <code>chrome://extensions</code>, tải lại tab Muse
              rồi bấm <strong>Làm mới trạng thái</strong>. Không cần tích chọn đầu ra trong popup.
              Danh sách AI Chrome của node sẽ tự cập nhật từ adapter.
            </p>
          <dl class="connectionDetails" v-if="connection?.device">
            <template v-if="connection.device">
              <dt>Thiết bị</dt><dd>{{ connection.device.name }} · {{ connection.device.mode === "vm" ? "VM" : "Thông thường" }}</dd>
              <dt>Extension ID</dt><dd><code>{{ connection.device.extensionId }}</code></dd>
            </template>
          </dl>
          <template v-if="connection">
            <p v-if="connection.jobs.paused">Các tác vụ Chrome đang tạm khóa để bạn kiểm tra kết quả cũ.</p>
            <el-alert v-if="connection.connected && !connectedTargets.length && !connection.jobs.paused" type="warning" :closable="false" showIcon title="Chưa phát hiện tab AI đang kết nối" description="Mở Muse, ChatGPT hoặc Gemini trong Chrome đã cài extension và đăng nhập. Sau đó nhấn Làm mới trạng thái. Muse2API vẫn sử dụng kết nối API riêng." />
            <p>Đang chờ: {{ connection.jobs.waiting }} tác vụ</p>
            <p v-if="connection.jobs.recent.length">Trong {{ connection.jobs.recent.length }} tác vụ gần nhất: {{ connection.jobs.recent.filter(item => item.sentAt).length }} đã gửi đến AI; {{ connection.jobs.recent.filter(item => item.receivedAt).length }} nhận về; {{ connection.jobs.recent.filter(item => item.stage === 'saved').length }} đã lưu; {{ connection.jobs.recent.filter(item => item.sentAt && !item.receivedAt).length }} đã gửi chưa nhận về.</p>
            <p v-if="connection.jobs.current"><code>{{ connection.jobs.current.id }}</code> · {{ providerLabel(connection.jobs.current.provider) }} · {{ tabLabel(connection.jobs.current.tabId) }} · {{ stageLabel(connection.jobs.current.stage) }} · cập nhật {{ Math.max(0, Math.floor((Date.now() - connection.jobs.current.updatedAt) / 1000)) }} giây trước</p>
            <p v-if="connection.jobs.queued?.length">Đang xếp hàng: <span v-for="(task, index) in connection.jobs.queued" :key="task.id"><span v-if="index">; </span>{{ providerLabel(task.provider) }} · {{ tabLabel(task.tabId) }} · <code>{{ task.id }}</code></span></p>
            <ul v-if="connection.jobs.recent.length" class="taskHistory" aria-label="Chặng gần nhất của từng tác vụ Chrome">
              <li v-for="task in connection.jobs.recent.slice().reverse()" :key="task.id">
                <code>{{ task.id }}</code> · {{ providerLabel(task.provider) }} · {{ tabLabel(task.tabId) }} · {{ task.kind }} · {{ stageLabel(task.stage) }}
                <span v-if="task.failedAtStage"> · dừng tại {{ stageLabel(task.failedAtStage) }}</span>
                <span v-if="task.error"> · {{ task.error }}</span>
              </li>
            </ul>
            <el-alert v-if="connection.jobs.paused" title="Chrome đang giữ dấu vết tác vụ cũ. Hãy mở đúng tab AI đã dùng để kiểm tra prompt/kết quả trước khi tiếp tục. Không tự gửi lại tác vụ cũ; nhấn tiếp tục sẽ giải phóng trạng thái chờ trong extension." type="warning" :closable="false" />
            <el-button v-if="connection.jobs.paused" :loading="busy" @click="resume">Tôi đã kiểm tra tab — tiếp tục hàng đợi</el-button>
          </template>
          <div v-if="pairing && connection?.pairingExpiresAt && !connection.connected" class="pairingCode">
            <label for="aiChromePairingCode">Mã ghép nối — hết hạn lúc {{ new Date(pairing.expiresAt).toLocaleTimeString() }}</label>
            <el-input id="aiChromePairingCode" :modelValue="pairing.code" readonly autocomplete="off" />
          </div>
          <div class="actions">
            <el-button v-if="connection && !connection.connected" :disabled="connectionMode === 'vm' && !connection.relay.configured" :loading="busy" @click="createPairing">{{ pairing ? 'Tạo mã mới' : connection.device ? 'Tạo mã kết nối lại' : 'Tạo mã ghép nối' }}</el-button>
            <el-button v-if="connection?.device || connection?.pairingExpiresAt" :loading="busy" @click="disconnect">Huỷ ghép nối</el-button>
            <el-button :disabled="busy" @click="refresh">Làm mới trạng thái</el-button>
          </div>
      </div>
      <el-alert v-if="statusError || actionError" :title="actionError || statusError" type="error" :closable="false" />
    </section>

    <section class="panelSection" aria-labelledby="aiChromeMuseProfileTitle">
      <div class="sectionHeader">
        <h3 id="aiChromeMuseProfileTitle">3. Chrome Profile cho Muse2API</h3>
      </div>
      <p class="hint">Chọn profile Chrome đang dùng cho Muse2API. Chỉ Profile 22 đã được xác định; danh sách này không phải kết quả quét các profile trên máy.</p>
      <p class="hint">Để đối chiếu đúng profile: mở <code>chrome://version</code> trong Chrome đã cài extension, kiểm tra mục <strong>Profile Path</strong> kết thúc bằng <code>/Profile 22</code>. Chức năng này chỉ đọc proxy và IP, không đổi proxy của Chrome.</p>
      <div class="museProfileForm">
        <label for="aiChromeMuseProfile">Profile Chrome</label>
        <el-select id="aiChromeMuseProfile" v-model="profileDirectory" placeholder="Chọn profile Chrome" aria-label="Chọn Chrome Profile cho Muse2API" :disabled="busy">
          <el-option label="Profile 22" value="Profile 22" />
        </el-select>
        <el-checkbox v-model="confirmedExtensionInProfile" :disabled="busy">
          Tôi xác nhận extension MacFlow đang chạy trong Chrome Profile 22
        </el-checkbox>
        <el-button type="primary" :loading="busy" :disabled="!profileDirectory || !confirmedExtensionInProfile || busy" @click="verifyMuseProfile">
          Chọn &amp; kiểm tra IP Mỹ
        </el-button>
      </div>
      <el-alert v-if="profileError" type="error" :closable="false" showIcon title="Không kiểm tra được Profile 22" :description="profileError" />
      <el-alert
        v-else-if="!connection?.museProfile?.selectedProfile"
        type="warning"
        :closable="false"
        showIcon
        title="Chưa chọn Chrome Profile cho Muse2API"
        description="Chọn Profile 22, xác nhận extension đang chạy trong profile đó và yêu cầu máy chủ kiểm tra proxy cùng IP thoát tại Mỹ trước khi tạo tác vụ." />
      <el-alert
        v-else-if="connection.museProfile.verified && connection.museProfile.confirmed && connection.museProfile.countryCode === 'US' && ['fixed_servers', 'pac_script'].includes(connection.museProfile.proxyMode || '')"
        type="success"
        :closable="false"
        showIcon
        title="Máy chủ đã xác minh điều kiện proxy và IP Mỹ"
        description="Việc extension đang chạy trong Profile 22 là xác nhận của bạn; ứng dụng chưa tự phát hiện profile Chrome thực tế." />
      <el-alert
        v-else
        type="warning"
        :closable="false"
        showIcon
        title="Muse2API chưa đủ điều kiện chạy"
        :description="connection.museProfile.reason || (connection.museProfile.confirmed ? 'Chưa xác minh proxy và IP Mỹ.' : 'Chưa xác nhận extension chạy trong Profile 22.')" />
      <dl v-if="connection?.museProfile?.selectedProfile" class="connectionDetails museProfileDetails">
        <dt>Profile được chọn</dt><dd>{{ connection.museProfile.selectedProfile }}</dd>
        <template v-if="connection.museProfile.proxyMode">
          <dt>Chế độ proxy</dt><dd>{{ connection.museProfile.proxyMode }}</dd>
        </template>
        <template v-if="connection.museProfile.countryCode">
          <dt>Quốc gia IP thoát</dt><dd>{{ connection.museProfile.countryCode }}</dd>
        </template>
        <template v-if="connection.museProfile.checkedAt">
          <dt>Kiểm tra lần cuối</dt><dd>{{ new Date(connection.museProfile.checkedAt).toLocaleString("vi-VN") }}</dd>
        </template>
        <template v-if="connection.museProfile.reason">
          <dt>Thông tin xác minh</dt><dd>{{ connection.museProfile.reason }}</dd>
        </template>
      </dl>
    </section>

    <section class="panelSection" aria-labelledby="aiChromeTabsTitle">
      <div class="sectionHeader">
        <h3 id="aiChromeTabsTitle">4. Các tab AI trong Chrome</h3>
        <el-tag type="info" size="small">{{ connectedTargets.length }} tab đã nhận diện</el-tag>
      </div>
      <p class="hint" v-if="!connection?.connected">Chưa có Chrome đang kết nối.</p>
      <p class="hint" v-else-if="!connectedTargets.length">Extension chưa báo tab AI hợp lệ. Hãy kiểm tra tab và làm mới trạng thái.</p>
      <ol v-else class="connectedTabs" aria-label="Danh sách các tab AI đang kết nối">
        <li v-for="(target, index) in connectedTargets" :key="target.tabId" class="tabRow">
          <strong class="tabNumber">#{{ index + 1 }}</strong>
          <div class="tabDetails">
            <strong>{{ providerLabel(target.provider) }}</strong>
            <span v-if="target.title" class="tabTitle" :title="target.title">{{ target.title }}</span>
            <small :title="target.url">{{ target.url }} · ID {{ target.tabId }}</small>
            <small v-if="target.taskId">Tác vụ đang gắn: <code>{{ target.taskId }}</code></small>
            <small v-else-if="connection?.jobs.current?.tabId === target.tabId">Đang xử lý: <code>{{ connection.jobs.current.id }}</code></small>
            <small v-for="queued in (connection?.jobs.queued ?? []).filter(task => task.tabId === target.tabId)" :key="queued.id">Trong hàng đợi: <code>{{ queued.id }}</code> · {{ queued.kind }}</small>
            <small>Đầu ra: {{ target.outputKinds.join(", ") || "Chưa xác định" }}</small>
            <small v-if="target.provider === 'muse' && !target.outputKinds.includes('image')">
              Extension chưa công bố luồng ảnh. Hãy cập nhật extension và tải lại tab Muse; không cần thiết lập thủ công.
            </small>
          </div>
          <el-tag :type="target.blocked ? 'danger' : target.busy ? 'warning' : target.ready ? 'success' : 'info'" size="small">
            {{ target.blocked ? "Bị chặn" : target.busy ? "Đang chạy" : target.ready ? "Sẵn sàng" : "Chưa sẵn sàng" }}
          </el-tag>
        </li>
      </ol>
    </section>

    <section class="panelSection" aria-labelledby="aiChromeReportTitle">
      <div class="sectionHeader">
        <h3 id="aiChromeReportTitle">5. Báo cáo các AI đã hiển thị</h3>
        <el-tag type="info" size="small">Chưa phát triển</el-tag>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { readChromeStatus, pairChrome, disconnectChrome, downloadChromeExtension, resumeChromeQueue, saveChromeMuseProfile, type ChromeStatus } from "@/lib/aiChrome";
import { invalidateNodeModels } from "@toonflow/nodes-scaffold/nodeAi";

const props = defineProps<{ visible: boolean }>();
const connectionMode = ref<"normal" | "vm">("normal");
const connection = ref<ChromeStatus>();
const connectedTargets = computed(() => connection.value?.connected
  ? (connection.value.targets ?? []).filter(target => Number.isSafeInteger(target.tabId) && target.tabId >= 0 && !!target.documentToken)
  : []);
const pairing = ref<{ code: string; expiresAt: number }>();
const profileDirectory = ref<"Profile 22" | "">("");
const confirmedExtensionInProfile = ref(false);
const profileError = ref("");
const busy = ref(false);
const downloading = ref(false);
const statusError = ref("");
const actionError = ref("");
const controller = new AbortController();
let timer: ReturnType<typeof setInterval> | undefined;
let reading = false;

async function refresh() {
  if (reading || controller.signal.aborted) return;
  reading = true;
  try {
    const previous = modelIdentity(connection.value);
    connection.value = await readChromeStatus(controller.signal);
    if (connection.value.museProfile?.selectedProfile === "Profile 22") profileDirectory.value = "Profile 22";
    if (previous !== modelIdentity(connection.value)) { invalidateNodeModels("media"); invalidateNodeModels("language"); }
    if (pairing.value?.expiresAt !== connection.value.pairingExpiresAt) pairing.value = undefined;
    statusError.value = "";
  } catch (error) { if (!controller.signal.aborted) statusError.value = error instanceof Error ? error.message : "Không đọc được trạng thái."; }
  finally { reading = false; }
}
watch([() => props.visible, connectionMode], ([visible]) => {
  clearInterval(timer);
  if (visible) {
    void refresh();
    timer = setInterval(() => void refresh(), 5000);
  }
}, { immediate: true });
onBeforeUnmount(() => { clearInterval(timer); controller.abort(); });

async function perform(action: () => Promise<unknown>) {
  if (busy.value) return;
  busy.value = true; actionError.value = "";
  try { await action(); await refresh(); }
  catch (error) { actionError.value = error instanceof Error ? error.message : "Không thực hiện được thao tác."; }
  finally { busy.value = false; }
}
function createPairing() { return perform(async () => { pairing.value = await pairChrome(connectionMode.value); }); }
function disconnect() { return perform(async () => { await disconnectChrome(); pairing.value = undefined; }); }
function resume() { return perform(() => resumeChromeQueue()); }
async function verifyMuseProfile() {
  if (busy.value || profileDirectory.value !== "Profile 22" || !confirmedExtensionInProfile.value) return;
  busy.value = true;
  profileError.value = "";
  try {
    await saveChromeMuseProfile({ profileDirectory: "Profile 22", confirmedExtensionInProfile: true });
    const previous = modelIdentity(connection.value);
    connection.value = await readChromeStatus(controller.signal);
    if (previous !== modelIdentity(connection.value)) { invalidateNodeModels("media"); invalidateNodeModels("language"); }
    statusError.value = "";
  } catch (error) {
    if (!controller.signal.aborted) profileError.value = error instanceof Error ? error.message : "Không kiểm tra được proxy và IP Mỹ.";
  } finally {
    busy.value = false;
  }
}
function modelIdentity(value?: ChromeStatus) {
  return JSON.stringify([value?.connected, value?.targets?.map(item => [item.tabId, item.provider, item.documentToken, item.outputKinds, item.ready, item.blocked]), value?.target?.tabId]);
}
function providerLabel(value: string) {
  return ({ muse: "Muse", museChrome: "Muse", chatgpt: "ChatGPT", chatgptChrome: "ChatGPT", gemini: "Gemini", geminiChrome: "Gemini", claude: "Claude", claudeChrome: "Claude", grok: "Grok", grokChrome: "Grok", perplexity: "Perplexity", perplexityChrome: "Perplexity" } as Record<string, string>)[value] || value;
}
function tabLabel(tabId: number) {
  const index = connectedTargets.value.findIndex(tab => tab.tabId === tabId);
  return index >= 0 ? `Tab #${index + 1}` : `Tab ID ${tabId}`;
}
function stageLabel(stage: string) {
  return ({ queued: "Đang xếp hàng", dispatching: "Đang chuyển sang extension", received: "Extension đã nhận", referencesAttached: "Tham chiếu đã sẵn sàng", submitted: "Đã gửi lên dịch vụ AI", waitingResult: "Đang chờ đầu ra", receivingPackage: "Đang nhận gói tại extension", receivingResult: "Đang nhận kết quả về", saving: "Đang lưu vào workspace", saved: "Đã lưu", unknown: "Chưa xác định kết quả", failed: "Đã dừng trước khi gửi" } as Record<string, string>)[stage] ?? stage;
}
async function download() {
  if (downloading.value) return;
  downloading.value = true; actionError.value = "";
  try { await downloadChromeExtension(); }
  catch (error) { if (!(error instanceof Error && error.name === "AbortError")) actionError.value = error instanceof Error ? error.message : "Không tải được extension."; }
  finally { downloading.value = false; }
}
</script>

<style lang="scss" scoped>
.aiChrome {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 8px;

  .instructions { padding-left: 20px; line-height: 1.8; font-size: 13px; }
  .hint { color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.7; }
  .taskHistory { max-height: 180px; overflow-y: auto; padding-left: 20px; font-size: 12px; line-height: 1.8; overflow-wrap: anywhere; }
  .connectedTabs { display: grid; gap: 10px; padding: 0; list-style: none; }
  .tabRow { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border: 1px solid var(--el-border-color-light); border-radius: var(--el-border-radius-base); }
  .tabNumber { min-width: 36px; color: var(--el-color-primary); }
  .tabDetails { display: grid; flex: 1; min-width: 0; gap: 3px; }
  .tabTitle { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tabDetails small { color: var(--el-text-color-secondary); overflow-wrap: anywhere; }
  .connectionDetails { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; font-size: 13px; }
  .connectionDetails dd { margin: 0; overflow-wrap: anywhere; }
  .pairingCode { display: grid; gap: 8px; margin: 16px 0; font-size: 13px; }
  .museProfileForm { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; margin: 16px 0; font-size: 13px; }
  .museProfileForm .el-select { width: min(320px, 100%); }
  .museProfileDetails { margin-top: 14px; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
  .actions :deep(.el-button + .el-button) { margin-left: 0; }

  .panelSection {
    padding: 20px;
    border: 1px solid var(--el-border-color-light);
    border-radius: var(--el-border-radius-base);
    background: var(--el-bg-color);

    .sectionHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 16px;

      h3 {
        margin: 0;
        color: var(--el-text-color-primary);
        font-size: 14px;
        line-height: 1.6;
      }
    }

    h4 {
      margin: 20px 0 0;
      color: var(--el-text-color-regular);
      font-size: 13px;
      font-weight: 500;
    }

    @media (max-width: 700px) {
      padding: 14px;
    }
  }
}
</style>
