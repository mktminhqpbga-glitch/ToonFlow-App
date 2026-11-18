<template>
  <el-form class="network" labelPosition="top" :disabled="busy" @submit.prevent="saveNetwork">
    <div class="networkHeader">
      <el-radio-group v-model="form.mode" class="proxyModes" aria-label="Chế độ proxy">
        <el-radio value="none">Không dùng proxy</el-radio>
        <el-radio value="system">Sử dụng cấu hình proxy hệ thống</el-radio>
        <el-radio value="custom">Proxy tùy chỉnh</el-radio>
      </el-radio-group>
      <div class="networkActions">
      <el-button :loading="testing" :disabled="busy" @click="testNetwork">Kiểm tra</el-button>
      <el-button type="primary" nativeType="submit" :loading="saving" :disabled="busy">Xác nhận</el-button>
      </div>
    </div>

    <p class="description">Điều khiển các yêu cầu mạng của AI, media và các dịch vụ trên máy chủ; có hiệu lực sau khi lưu.</p>
    <p v-if="form.mode === 'system'" class="description">Dùng proxy HTTP(S) hệ thống của thiết bị chạy máy chủ. Windows/macOS đọc proxy tĩnh, các nền tảng khác đọc biến môi trường. Chưa hỗ trợ cấu hình PAC tự động.</p>

    <div v-if="form.mode === 'custom'" class="customProxy">
      <el-form-item label="Giao thức proxy">
        <el-select v-model="form.protocol" class="protocolSelect" aria-label="Giao thức proxy">
          <el-option label="Proxy HTTP" value="http" />
          <el-option label="Proxy HTTPS" value="https" />
        </el-select>
      </el-form-item>
      <div class="proxyFields">
        <el-form-item label="Máy chủ" required>
          <el-input v-model="form.host" dir="ltr" placeholder="Nhập địa chỉ IP hoặc tên miền" autocomplete="off" />
        </el-form-item>
        <el-form-item label="Cổng" required>
          <el-input-number v-model="form.port" :min="1" :max="65535" :precision="0" :controls="false" aria-label="Cổng proxy" />
        </el-form-item>
        <el-form-item label="Tên người dùng">
          <el-input v-model="form.username" autocomplete="off" />
        </el-form-item>
        <el-form-item label="Mật khẩu">
          <el-input v-model="form.password" type="password" showPassword autocomplete="off" />
        </el-form-item>
      </div>
    </div>

    <p class="description">Địa chỉ kiểm tra: <span dir="ltr">https://www.baidu.com/robots.txt</span></p>
    <el-alert v-if="requestError" :title="requestError" type="error" :closable="false" showIcon />
    <el-alert v-else-if="testLatency !== null" :title="`Kết nối thành công, mất ${testLatency} ms`" type="success" :closable="false" showIcon />
  </el-form>
</template>

<script setup lang="ts">
import { translate } from "@toonflow/i18n/vue";
import axios from "axios";
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { saveSettings, settings } from "@/stores/settings";

type NetworkSettings = {
  mode: "none" | "system" | "custom";
  protocol: "http" | "https";
  host: string;
  port: number;
  username: string;
  password: string;
};
const raw = settings.value.network;
const saved = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Partial<NetworkSettings> : {};
const form = reactive<NetworkSettings>({
  mode: saved.mode === "system" || saved.mode === "custom" ? saved.mode : "none",
  protocol: saved.protocol === "https" ? "https" : "http",
  host: typeof saved.host === "string" ? saved.host : "",
  port: typeof saved.port === "number" ? saved.port : 80,
  username: typeof saved.username === "string" ? saved.username : "",
  password: typeof saved.password === "string" ? saved.password : "",
});
const testing = ref(false);
const saving = ref(false);
const busy = computed(() => testing.value || saving.value);
const requestError = ref("");
const testLatency = ref<number | null>(null);
const controller = new AbortController();
onBeforeUnmount(() => controller.abort());
watch(form, () => {
  requestError.value = "";
  testLatency.value = null;
});

function readForm() {
  const network = { ...form, host: form.host.trim() };
  const validPort = Number.isInteger(network.port) && network.port >= 1 && network.port <= 65535;
  if (network.mode === "custom") {
    if (!network.host || /[\s/@?#]/.test(network.host)) throw new Error("Hãy nhập IP hoặc tên miền proxy hợp lệ, không kèm giao thức hoặc đường dẫn");
    if (!validPort) throw new Error("Cổng proxy phải là số nguyên từ 1 đến 65535");
  } else if (!validPort) network.port = 80;
  return network;
}

function errorMessage(cause: unknown) {
  return axios.isAxiosError<{ message?: string }>(cause)
    ? cause.response?.data?.message || cause.message
    : cause instanceof Error ? cause.message : translate("网络设置操作失败");
}

async function testNetwork() {
  if (busy.value) return;
  testing.value = true;
  requestError.value = "";
  testLatency.value = null;
  try {
    const { data } = await axios.post<{ code: number; data: { latency: number }; message?: string }>(
      "/api/settings/network/test", { network: readForm() }, { headers: { "x-toonflow-workspace": "1" }, signal: controller.signal },
    );
    if (data.code !== 200) throw new Error(data.message || "Kiểm tra kết nối proxy thất bại");
    testLatency.value = Math.round(data.data.latency);
  } catch (cause) {
    if (!controller.signal.aborted) requestError.value = errorMessage(cause);
  } finally {
    testing.value = false;
  }
}

async function saveNetwork() {
  if (busy.value) return;
  saving.value = true;
  requestError.value = "";
  try {
    const network = readForm();
    await saveSettings(() => ({ network }));
    ElMessage.success("Đã lưu cấu hình mạng");
  } catch (cause) {
    requestError.value = errorMessage(cause);
    if (controller.signal.aborted) ElMessage.error(requestError.value);
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" scoped>
.network {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0 4px 8px;

  .networkHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;

    .proxyModes {
      gap: 4px 20px;

      .el-radio { margin-right: 0; }
    }

    .networkActions {
      display: flex;
      flex-shrink: 0;
      gap: 8px;

      .el-button { margin-left: 0; }
    }
  }

  .description {
    margin: 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  .customProxy {
    .protocolSelect { width: 200px; max-width: 100%; }

    .proxyFields {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0 20px;

      .el-input-number { width: 100%; }

      @media (max-width: 700px) { grid-template-columns: minmax(0, 1fr); }
    }
  }
}
</style>
