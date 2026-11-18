<template>
  <div v-loading="loading" class="deviceLink">
    <section v-if="isRemoteConnection" class="remoteConnection" aria-label="Thiết bị đang kết nối">
      <el-tag :type="mobileConnection.online === true ? mobileConnectionVersionWarning ? 'warning' : 'success' : mobileConnection.online === false ? 'danger' : 'info'">{{ mobileConnectionLabel }}</el-tag>
      <h3>{{ mobileConnection.name || 'Toonflow' }}</h3>
      <code>{{ mobileConnection.url }}</code>
      <p class="description">Hiện đang sử dụng dự án và cấu hình của thiết bị này. Sau khi ngắt và trở lại chế độ độc lập, bạn mới có thể cho phép thiết bị khác kết nối.</p>
      <el-alert v-if="mobileConnectionVersionWarning" :title="mobileConnectionVersionWarning" type="warning" :closable="false" showIcon />
      <el-button type="primary" :loading="saving" @click="disconnectRemote">Ngắt kết nối và chạy độc lập</el-button>
      <el-alert v-if="error" :title="error" type="error" :closable="false" showIcon />
    </section>
    <template v-else>
    <section class="settingSection" aria-labelledby="deviceLinkTitle">
      <div class="sectionHeader">
        <div class="settingInfo">
          <h3 id="deviceLinkTitle">Cho phép thiết bị khác kết nối</h3>
          <p class="description">Máy tính hoặc thiết bị Android khác có thể dùng dự án và cấu hình tại đây. Hãy giữ Toonflow đang chạy khi kết nối.</p>
        </div>
        <el-switch :modelValue="form.enabled" :disabled="busy || !status" aria-label="Cho phép thiết bị khác kết nối" @change="value => saveConfig(value === true)" />
      </div>
    </section>

    <template v-if="status?.enabled">
      <section class="settingSection pairingSection" :class="{ pairingUnavailable: !pairing }" aria-labelledby="pairingTitle">
        <div class="pairingIntro">
          <div class="sectionHeader">
            <h3 id="pairingTitle">Kết nối thiết bị mới</h3>
            <el-button :icon="IconQrcode" :loading="generating" :disabled="busy || !pairingUrl" text @click="generatePairing">{{ pairing ? 'Làm mới mã QR' : pairedSuccessfully ? 'Kết nối thiết bị khác' : 'Tạo mã QR' }}</el-button>
          </div>
          <p v-if="addressMode === 'lan'" class="description">Trên cùng mạng Wi-Fi, mở mục Liên kết thiết bị ở thiết bị khác rồi quét mã hoặc nhập thủ công.</p>
          <p v-else class="description">Mở mục Liên kết thiết bị ở thiết bị khác, quét mã hoặc nhập thủ công để kết nối qua Internet.</p>
        </div>
        <div class="pairingPanel">
          <div v-if="pairing" class="pairingCode">
            <q-r-code :value="pairing.qrCode" :size="176" type="svg" color="#18181b" bgColor="#ffffff" />
          </div>
          <p v-else-if="generating" class="description" role="status">Đang chuẩn bị mã QR…</p>
          <el-alert v-else-if="pairingNotice" :title="pairingNotice" :type="pairedSuccessfully && pairedDevice?.online ? 'success' : 'info'" :closable="false" showIcon />
          <el-alert v-else-if="!pairingUrl" :title="addressMode === 'lan' ? 'Không tìm thấy địa chỉ Wi-Fi khả dụng. Hãy kiểm tra kết nối máy tính hoặc chọn cách kết nối khác trong tùy chọn nâng cao.' : 'Hãy nhập và lưu địa chỉ kết nối công khai trong tùy chọn nâng cao.'" type="warning" :closable="false" showIcon />
        </div>
        <div v-if="pairing?.manualCode" class="manualConnection">
          <div class="manualField">
            <span>Địa chỉ kết nối</span>
            <div class="fieldValue">
              <code dir="ltr">{{ pairing.url }}</code>
              <el-button type="primary" link aria-label="Sao chép địa chỉ" @click="copyConnectionInfo(pairing.url)">Sao chép</el-button>
            </div>
          </div>
          <div class="manualField">
            <span>Mã ghép nối 12 chữ số</span>
            <div class="fieldValue">
              <code class="manualCode" dir="ltr">{{ formattedManualCode }}</code>
              <el-button type="primary" link aria-label="Sao chép mã ghép nối" @click="copyConnectionInfo(formattedManualCode)">Sao chép</el-button>
            </div>
          </div>
        </div>
      </section>

      <section class="settingSection devicePanel" aria-labelledby="linkedDevicesTitle">
        <div class="sectionHeader">
          <h3 id="linkedDevicesTitle">Trạng thái kết nối thiết bị</h3>
          <el-button :icon="IconRefresh" :disabled="busy" text aria-label="Làm mới trạng thái kết nối thiết bị" @click="loadStatus(false, true)">Làm mới</el-button>
        </div>
        <div v-for="device in status.devices" :key="device.id" class="deviceItem">
          <span class="deviceName">{{ device.name }}</span>
          <el-tag :type="device.online ? 'success' : 'info'" size="small">{{ device.online ? 'Đã kết nối' : 'Ngoại tuyến' }}</el-tag>
          <el-button type="danger" link :disabled="busy" @click="revokeDevice(device.id)">Thu hồi</el-button>
          <el-alert v-if="device.online && getDeviceVersionWarning(status.appVersion, device.appVersion)" class="deviceVersionWarning" :title="getDeviceVersionWarning(status.appVersion, device.appVersion)" type="warning" :closable="false" showIcon />
        </div>
        <p v-if="!status.devices.length" class="description">Đang chờ thiết bị kết nối</p>
      </section>
    </template>

    <el-alert v-if="error" :title="error" type="error" :closable="false" showIcon />
    <el-button v-if="!status && !loading" :icon="IconRefresh" @click="loadStatus()">Tải lại</el-button>

    <el-collapse class="advancedSettings">
      <el-collapse-item title="Tùy chọn nâng cao" name="advanced">
        <section class="settingSection" aria-label="Cài đặt kết nối">
          <el-form class="connectionForm" labelPosition="top" :disabled="busy || !status">
            <el-form-item label="Cách kết nối">
              <el-radio-group v-model="addressMode" aria-label="Cách kết nối">
                <el-radio-button value="lan">Cùng mạng Wi-Fi</el-radio-button>
                <el-radio-button value="public">Kết nối qua Internet</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item v-if="addressMode === 'lan'" label="Địa chỉ máy tính">
              <el-select v-if="(status?.addresses.length ?? 0) > 1" v-model="selectedAddress" aria-label="Địa chỉ mạng nội bộ">
                <el-option v-for="address in status?.addresses ?? []" :key="address" :label="address" :value="address" />
              </el-select>
              <code v-else class="connectionAddress">{{ selectedAddress || 'Không tìm thấy địa chỉ khả dụng' }}</code>
              <p class="description">Nếu không kết nối được, hãy thử địa chỉ khác và kiểm tra tường lửa có cho phép Toonflow truy cập mạng không.</p>
            </el-form-item>
            <el-form-item v-if="addressMode === 'public'" label="Địa chỉ HTTPS công khai">
              <el-input v-model="form.publicUrl" placeholder="https://toonflow.example.com" aria-label="Địa chỉ HTTPS công khai" />
              <p class="description">Hãy chuyển tiếp địa chỉ HTTPS này đến cổng liên kết bên dưới và giữ nguyên đường dẫn yêu cầu. Có hiệu lực sau khi lưu.</p>
            </el-form-item>
            <el-form-item label="Cổng liên kết">
              <el-input-number v-model="form.port" :min="1" :max="65535" :precision="0" controlsPosition="right" aria-label="Cổng liên kết" />
              <p class="description">Thông thường không cần thay đổi.</p>
            </el-form-item>
          </el-form>
        </section>
        <section class="settingSection" aria-labelledby="sharedDirectoriesTitle">
          <div class="sectionHeader">
            <h3 id="sharedDirectoriesTitle">Thư mục làm việc dùng chung</h3>
            <el-button :icon="IconFolderPlus" :disabled="busy || !status" @click="addDirectory">Thêm thư mục</el-button>
          </div>
          <p class="description">Các thiết bị được kết nối có thể truy cập những thư mục này, kể cả không gian làm việc trên máy chủ. Lần đầu bật sẽ dùng thư mục của dự án hiện có.</p>
          <div class="directoryList">
            <el-tag v-for="directory in form.directories" :key="directory" class="directoryTag" :closable="!busy" :title="directory" @close="removeDirectory(directory)">{{ directory }}</el-tag>
          </div>
        </section>
        <div class="advancedActions">
          <el-button type="primary" :loading="saving" :disabled="busy || !status || !dirty" @click="saveConfig()">Lưu thay đổi</el-button>
        </div>
      </el-collapse-item>
    </el-collapse>
    <workspacePicker ref="directoryPicker" hideTrigger />
    </template>
  </div>
</template>

<script setup lang="ts">
import axios from "axios";
import { msg, translate, type MessageDescriptor } from "@toonflow/i18n/vue";
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { QRCode } from "tdesign-vue-next";
import { IconFolderPlus, IconQrcode, IconRefresh } from "@tabler/icons-vue";
import { useWorkspaceStore } from "@/stores/workspace";
import workspacePicker from "@/pages/home/workspacePicker.vue";
import { writeClipboardText } from "@/lib/clipboard";
import { changeDeviceConnection, deviceHubEnabled, getDeviceVersionWarning, mobileConnection, mobileConnectionLabel, mobileConnectionVersionWarning } from "@/lib/mobile";
import { isRemoteConnection } from "@/lib/platform";

type LinkStatus = { enabled: boolean; hubEnabled?: boolean; initialized: boolean; pairingAvailable: boolean; port: number; addresses: string[]; publicUrl: string; directories: string[]; appVersion?: string; devices: { id: string; name: string; online: boolean; lastSeen?: number; appVersion?: string }[] };
type Pairing = { qrCode: string; manualCode: string; url: string };
type ApiResponse<T> = { code: number; data: T; message?: string };

const props = withDefaults(defineProps<{ visible?: boolean }>(), { visible: true });
const workspaceStore = useWorkspaceStore();
const headers = { "x-toonflow-mobile-link": "1" };
const status = ref<LinkStatus>();
const form = reactive({ enabled: false, port: 43123, publicUrl: "", directories: [] as string[] });
const directoryPicker = ref<InstanceType<typeof workspacePicker>>();
const addressMode = ref<"lan" | "public">("lan");
const selectedAddress = ref("");
const pairing = ref<Pairing>();
const formattedManualCode = computed(() => (pairing.value?.manualCode ?? "").replace(/(\d{4})(?=\d)/g, "$1 "));
const pairingMessage = ref<string | MessageDescriptor>("");
const pairedSuccessfully = ref(false);
const pairingFinished = ref(false);
const pairedDevice = computed(() => status.value?.devices.find(device => !pairingDeviceIds.has(device.id)));
const pairingNotice = computed(() => {
  if (!pairedSuccessfully.value) return translate(pairingMessage.value);
  if (pairedDevice.value?.online) return translate("设备已连接");
  return pairedDevice.value?.lastSeen !== undefined ? translate("设备连接已断开") : translate("配对成功，等待设备连接");
});
const error = ref("");
const loading = ref(false);
const saving = ref(false);
const generating = ref(false);
const revoking = ref(false);
const selecting = ref(false);
const busy = computed(() => loading.value || saving.value || generating.value || revoking.value || selecting.value);
const pairingUrl = computed(() => addressMode.value === "public" ? status.value?.publicUrl ?? "" : selectedAddress.value);
const dirty = computed(() => !!status.value && (!status.value.initialized || form.enabled !== (status.value.hubEnabled ?? status.value.enabled) || form.port !== status.value.port
  || form.publicUrl.trim() !== status.value.publicUrl || JSON.stringify(form.directories) !== JSON.stringify(status.value.directories)));
let readController: AbortController | undefined;
let pairingController: AbortController | undefined;
let autoPairingUrl = "";
let pairingDeviceIds = new Set<string>();
let polling = false;
let timer: ReturnType<typeof setInterval> | undefined;

function errorMessage(cause: unknown) {
  return axios.isAxiosError<{ message?: string }>(cause) ? cause.response?.data?.message || cause.message : cause instanceof Error ? cause.message : translate("操作失败，请重试");
}

async function copyConnectionInfo(value: string) {
  try {
    await writeClipboardText(value);
    ElMessage.success("Đã sao chép");
  } catch {
    ElMessage.error("Sao chép thất bại, hãy chọn và sao chép thủ công");
  }
}

async function disconnectRemote() {
  if (saving.value) return;
  saving.value = true;
  error.value = "";
  try {
    await changeDeviceConnection("disconnect");
  } catch (cause) {
    error.value = errorMessage(cause);
    saving.value = false;
  }
}

async function loadStatus(resetForm = true, quiet = false) {
  if (isRemoteConnection) return;
  if (quiet && (busy.value || polling || !props.visible || document.hidden)) return;
  readController?.abort();
  const request = new AbortController();
  readController = request;
  polling = quiet;
  if (!quiet) {
    loading.value = true;
    error.value = "";
  }
  try {
    const { data } = await axios.get<ApiResponse<LinkStatus>>("/api/mobileLink/status", { headers, signal: request.signal, timeout: 8000 });
    if (request.signal.aborted) return;
    if (data.code !== 200) throw new Error(data.message || "Đọc trạng thái liên kết thất bại");
    const preserveForm = quiet || !resetForm && dirty.value;
    if (pairing.value && !data.data.pairingAvailable) {
      pairedSuccessfully.value = data.data.devices.some(device => !pairingDeviceIds.has(device.id));
      pairingMessage.value = pairedSuccessfully.value ? "" : msg`二维码已更新，请重新生成。`;
      pairingFinished.value = true;
      pairing.value = undefined;
    }
    if (pairedSuccessfully.value && !data.data.devices.some(device => !pairingDeviceIds.has(device.id))) {
      pairedSuccessfully.value = false;
      pairingMessage.value = msg`设备授权已撤销，可重新生成二维码。`;
    }
    status.value = data.data;
    deviceHubEnabled.value = data.data.hubEnabled ?? data.data.enabled;
    if (!preserveForm) Object.assign(form, {
      enabled: data.data.hubEnabled ?? data.data.enabled, port: data.data.port, publicUrl: data.data.publicUrl,
      directories: data.data.initialized === false ? [...new Set(workspaceStore.projectList.map(project => project.directory))] : [...data.data.directories],
    });
    if (!data.data.addresses.includes(selectedAddress.value)) selectedAddress.value = data.data.addresses[0] ?? "";
    if (!data.data.enabled) pairing.value = undefined;
    if (!quiet && !pairing.value && !pairingFinished.value) autoPairingUrl = "";
    return true;
  } catch (cause) {
    if (!request.signal.aborted) {
      if (!quiet) error.value = errorMessage(cause);
      else if (status.value) status.value = { ...status.value, devices: status.value.devices.map(device => ({ ...device, online: false })) };
    }
  } finally {
    if (readController === request) {
      loading.value = false;
      polling = false;
    }
  }
}

async function saveConfig(enabled = form.enabled) {
  if (isRemoteConnection || busy.value || !status.value) return;
  form.enabled = enabled;
  saving.value = true;
  error.value = "";
  try {
    if (!Number.isInteger(form.port) || form.port < 1 || form.port > 65535) throw new Error("Vui lòng nhập cổng từ 1 đến 65535");
    const { data } = await axios.put<ApiResponse<LinkStatus>>("/api/mobileLink/config", { ...form, publicUrl: form.publicUrl.trim() }, { headers });
    if (data.code !== 200) throw new Error(data.message || "Lưu cấu hình thất bại");
    deviceHubEnabled.value = data.data.hubEnabled ?? data.data.enabled;
    pairing.value = undefined;
    pairingMessage.value = "";
    pairedSuccessfully.value = pairingFinished.value = false;
    autoPairingUrl = "";
    if (await loadStatus()) ElMessage.success("Đã lưu cấu hình liên kết");
  } catch (cause) {
    form.enabled = status.value.hubEnabled ?? status.value.enabled;
    error.value = errorMessage(cause);
  } finally {
    saving.value = false;
  }
}

async function addDirectory() {
  if (busy.value) return;
  selecting.value = true;
  try {
    const directory = await directoryPicker.value?.chooseDirectory();
    if (directory && !form.directories.includes(directory)) form.directories.push(directory);
  } finally {
    selecting.value = false;
  }
}

function removeDirectory(directory: string) {
  if (!busy.value) form.directories = form.directories.filter(item => item !== directory);
}

async function generatePairing() {
  if (busy.value || !props.visible || !status.value?.enabled || !pairingUrl.value) return;
  const url = pairingUrl.value;
  if (polling) readController?.abort();
  autoPairingUrl = url;
  const request = new AbortController();
  pairingController = request;
  generating.value = true;
  pairing.value = undefined;
  pairingMessage.value = "";
  pairedSuccessfully.value = pairingFinished.value = false;
  error.value = "";
  try {
    const { data } = await axios.post<ApiResponse<Pairing>>("/api/mobileLink/pairing", { url }, { headers, signal: request.signal });
    if (request.signal.aborted || !props.visible || url !== pairingUrl.value) return;
    if (data.code !== 200) throw new Error(data.message || "Tạo mã QR thất bại");
    pairing.value = data.data;
    pairingDeviceIds = new Set(status.value.devices.map(device => device.id));
  } catch (cause) {
    if (!request.signal.aborted) error.value = errorMessage(cause);
  } finally {
    if (pairingController === request) generating.value = false;
  }
}

async function revokeDevice(id: string) {
  if (busy.value) return;
  revoking.value = true;
  error.value = "";
  try {
    await ElMessageBox.confirm("Sau khi thu hồi quyền, thiết bị này sẽ không thể truy cập Toonflow hiện tại.", "Thu hồi quyền thiết bị", { confirmButtonText: "Thu hồi quyền", cancelButtonText: "Hủy", type: "warning" });
    const { data } = await axios.post<ApiResponse<unknown>>("/api/mobileLink/revoke", { id }, { headers });
    if (data.code !== 200) throw new Error(data.message || "Thu hồi quyền thất bại");
    await loadStatus(false);
  } catch (cause) {
    if (cause !== "cancel" && cause !== "close") error.value = errorMessage(cause);
  } finally {
    revoking.value = false;
  }
}

watch(pairingUrl, () => {
  pairing.value = undefined;
  pairingMessage.value = "";
  pairedSuccessfully.value = pairingFinished.value = false;
  autoPairingUrl = "";
});
watch(() => props.visible, visible => {
  clearInterval(timer);
  readController?.abort();
  pairingController?.abort();
  pairingController = undefined;
  generating.value = false;
  loading.value = polling = false;
  pairing.value = undefined;
  pairingMessage.value = "";
  pairedSuccessfully.value = pairingFinished.value = false;
  autoPairingUrl = "";
  if (!visible || isRemoteConnection) return;
  addressMode.value = "lan";
  selectedAddress.value = "";
  void loadStatus();
  updatePolling();
}, { immediate: true });
watch([() => props.visible, () => status.value?.enabled, pairingUrl, pairing, busy], () => {
  if (props.visible && status.value?.enabled && pairingUrl.value && !pairing.value && !pairingFinished.value && !busy.value && autoPairingUrl !== pairingUrl.value) {
    void generatePairing();
  }
});

function updatePolling() {
  clearInterval(timer);
  if (props.visible && !isRemoteConnection && !document.hidden) timer = setInterval(() => { void loadStatus(false, true); }, 3000);
}

function visibilityChanged() {
  updatePolling();
  if (!document.hidden) void loadStatus(false, true);
}

onMounted(() => document.addEventListener("visibilitychange", visibilityChanged));
onBeforeUnmount(() => {
  readController?.abort();
  pairingController?.abort();
  clearInterval(timer);
  document.removeEventListener("visibilitychange", visibilityChanged);
});
</script>

<style lang="scss" scoped>
:global(.settings .panelContent:has(.deviceLink)) {
  padding-bottom: 8px;
  scrollbar-width: none;
}
:global(.settings .panelContent:has(.deviceLink)::-webkit-scrollbar) { display: none; }

.deviceLink {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 4px 8px;
  container-type: inline-size;

  h3 { margin: 0; color: var(--el-text-color-primary); font-size: 14px; font-weight: 600; }
  .description { margin: 6px 0 0; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.6; }

  .settingSection {
    min-width: 0;

    .sectionHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;

      .settingInfo { min-width: 0; }
      > .el-switch, > .el-button { flex-shrink: 0; }
    }
    .connectionForm { .el-form-item { margin-bottom: 16px; } .description { flex-basis: 100%; } }
    .directoryList { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .directoryTag { max-width: 100%; height: auto; padding: 6px 10px; :deep(.el-tag__content) { overflow-wrap: anywhere; white-space: normal; } }
    .connectionAddress { overflow-wrap: anywhere; user-select: text; }
  }

  .pairingSection {
    display: grid;
    grid-template-columns: 208px minmax(0, 1fr);
    grid-template-rows: auto 1fr;
    grid-template-areas: "qr intro" "qr manual";
    gap: 16px 24px;
    padding: 16px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);
    background: var(--el-fill-color-extra-light);

    .pairingIntro {
      grid-area: intro;
      min-width: 0;
      .sectionHeader { flex-wrap: wrap; gap: 8px 12px; }
    }
    .pairingPanel {
      grid-area: qr;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      min-width: 0;

      .pairingCode {
        display: flex;
        box-sizing: border-box;
        max-width: 100%;
        padding: 16px;
        border-radius: var(--el-border-radius-base);
        background: #fff;

        :deep(.t-qrcode) { min-width: 0; max-width: 100%; height: auto !important; }
        :deep(svg) { display: block; width: 100%; height: auto; }
      }
    }
    .manualConnection {
      grid-area: manual;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;

      .manualField {
        display: grid;
        gap: 6px;
        min-width: 0;
        > span { color: var(--el-text-color-regular); font-size: 12px; }
        .fieldValue {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 10px;
          border: 1px solid var(--el-border-color-lighter);
          border-radius: var(--el-border-radius-base);
          background: var(--el-bg-color);

          code { min-width: 0; overflow-wrap: anywhere; user-select: text; font-size: 13px; line-height: 1.5; }
          .manualCode { font-size: 18px; letter-spacing: 1px; font-variant-numeric: tabular-nums; }
          .el-button { flex-shrink: 0; }
        }
      }
    }
    &.pairingUnavailable {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas: "intro" "qr";
      .pairingPanel { align-items: stretch; }
    }
  }
  .devicePanel {
    .deviceItem {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 16px;
      padding: 12px 0;
      border-bottom: 1px solid var(--el-border-color-extra-light);

      .deviceName { min-width: 0; overflow-wrap: anywhere; }
      .deviceVersionWarning { grid-column: 1 / -1; }
      &:last-child { border-bottom: 0; padding-bottom: 0; }
    }
  }
  .advancedSettings {
    --el-collapse-border-color: transparent;
    border-top: 1px solid var(--el-border-color-lighter);
    .settingSection + .settingSection { margin-top: 20px; }
    .advancedActions { display: flex; justify-content: flex-end; margin-top: 20px; }
  }
  .remoteConnection {
    display: grid;
    justify-items: start;
    gap: 16px;
    padding: 20px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);
    h3, p { margin: 0; }
    code { max-width: 100%; overflow-wrap: anywhere; user-select: text; }
  }

  @container (max-width: 560px) {
    .pairingSection {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto;
      grid-template-areas: "intro" "qr" "manual";
      gap: 16px;
    }
  }
}
</style>
