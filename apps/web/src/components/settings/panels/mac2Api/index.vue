<template>
  <div class="mac2ApiSettings">
    <el-alert :title="connectionTitle" :type="connectionType" :closable="false" showIcon>
      {{ connectionHint }}
    </el-alert>
    <el-form labelPosition="top" @submit.prevent="save">
      <el-form-item label="Địa chỉ kết nối">
        <el-input v-model="baseUrl" maxlength="2048" placeholder="Dán địa chỉ do nơi cung cấp đưa cho bạn" :disabled="saving || loading" aria-label="Địa chỉ kết nối" />
      </el-form-item>
      <el-form-item label="Khóa kết nối">
        <el-input v-model="apiKey" type="password" showPassword maxlength="520" autocomplete="new-password"
          :placeholder="connection?.keySaved ? 'Khóa đã lưu' : 'Dán khóa kết nối'" :disabled="saving || loading" aria-label="Khóa kết nối" />
      </el-form-item>
      <el-button type="primary" nativeType="submit" :loading="saving" :disabled="loading || !baseUrl.trim()">Lưu kết nối</el-button>
      <el-button :loading="loading" :disabled="saving || !connection?.keySaved" @click="refresh(true)">Kiểm tra kết nối</el-button>
    </el-form>

    <el-alert v-if="message" :title="message" type="error" :closable="false" showIcon />

    <details v-if="discovery" class="connectionDetails">
      <summary>Cài đặt nâng cao và thông tin kết nối</summary>
      <h3>{{ discovery.capabilities ? `mac2API ${discovery.capabilities.serverVersion}` : "Khả năng chưa xác minh" }}</h3>
      <p v-if="discovery.httpStatus">Máy chủ trả HTTP {{ discovery.httpStatus }}.</p>
      <p v-if="discovery.state === 'legacy'">
        Máy chủ phản hồi danh sách mô hình. Khả năng và độ sẵn sàng của từng mô hình chưa xác minh.
        Health {{ discovery.healthOk ? "có phản hồi" : "chưa xác minh" }} · Ready {{ discovery.readyOk ? "có phản hồi" : "chưa xác minh" }}.
      </p>
      <ul v-if="discovery.capabilities">
        <li v-for="provider in discovery.capabilities.providers" :key="provider.id">
          <strong>{{ providerNames[provider.id] }}</strong>
          · {{ provider.configured ? "Đã cấu hình" : "Chưa cấu hình" }}
          · {{ provider.connected ? "Đã kết nối" : "Chưa kết nối" }}
          · {{ provider.ready ? "Sẵn sàng" : "Chưa sẵn sàng" }}
          <template v-if="provider.busy"> · Đang bận</template>
        </li>
      </ul>
      <p v-if="discovery.capabilities">
        Tối đa {{ discovery.capabilities.limits.perClientPending }} tác vụ chờ mỗi client
        và {{ discovery.capabilities.limits.perKindPending }} tác vụ chờ mỗi loại.
      </p>
      <ul v-if="discovery.capabilities">
        <li v-for="model in discovery.capabilities.models" :key="model.id">
          <strong>{{ model.id }}</strong> · {{ model.ready ? "Sẵn sàng" : "Chưa sẵn sàng" }}
          <template v-if="model.modes?.length"> · {{ model.modes.join(", ") }}</template>
          <template v-if="model.maxReferences !== undefined"> · Tối đa {{ model.maxReferences }} tham chiếu</template>
          <template v-if="model.maxReferenceBytes"> · Giới hạn {{ (model.maxReferenceBytes / (1024 * 1024)).toFixed(1) }} MiB/tệp</template>
          <template v-if="model.allowedMimeTypes?.length"> · {{ model.allowedMimeTypes.join(", ") }}</template>
        </li>
      </ul>
      <ul v-else-if="discovery.modelIds.length"><li v-for="id in discovery.modelIds" :key="id">{{ id }}</li></ul>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { invalidateNodeModels } from "@toonflow/nodes-scaffold/nodeAi";
import http from "@/lib/http";

type ConnectionStatus = {
  baseUrl: string;
  keySaved: boolean;
  discovery?: {
    state: "verified" | "legacy" | "unverified";
    modelIds: string[];
    httpStatus?: number;
    healthOk?: boolean;
    readyOk?: boolean;
    capabilities?: {
      serverVersion: string;
      providers: { id: "muse" | "chatgpt" | "gemini-web"; configured: boolean; connected: boolean; ready: boolean; busy: boolean }[];
      models: { id: string; ready: boolean; modes?: string[]; maxReferences?: number; maxReferenceBytes?: number; allowedMimeTypes?: string[] }[];
      limits: { perClientPending: number; perKindPending: number };
    };
  };
};
const providerNames = { muse: "Muse", chatgpt: "ChatGPT Web", "gemini-web": "Gemini Web" };
const connection = ref<ConnectionStatus>();
const discovery = computed(() => connection.value?.discovery);
const baseUrl = ref("");
const apiKey = ref("");
const loading = ref(false);
const saving = ref(false);
const message = ref("");
const headers = { "x-toonflow-workspace": "1" };
const connectionTitle = computed(() => {
  if (saving.value) return "Đang lưu kết nối…";
  if (loading.value) return "Đang kiểm tra kết nối…";
  if (!connection.value?.keySaved) return "Chưa lưu kết nối";
  if (discovery.value?.state === "verified" && discovery.value.capabilities?.models.some(model => model.ready)) return "Đã kết nối và có mô hình sẵn sàng";
  if (discovery.value?.state === "verified" || discovery.value?.state === "legacy") return "Đã kết nối, cần kiểm tra mô hình";
  return "Chưa xác nhận được kết nối";
});
const connectionType = computed(() => connectionTitle.value === "Đã kết nối và có mô hình sẵn sàng" ? "success" : connection.value?.keySaved ? "warning" : "info");
const connectionHint = computed(() => {
  if (loading.value || saving.value) return "Kết quả sẽ xuất hiện ngay tại đây.";
  if (!connection.value?.keySaved) return "Dán địa chỉ và khóa do nơi cung cấp đưa cho bạn, rồi bấm Lưu kết nối.";
  if (discovery.value?.httpStatus === 401 || discovery.value?.httpStatus === 403) return "Khóa kết nối chưa được chấp nhận. Hãy nhập khóa mới và lưu lại.";
  if (connectionType.value === "success") return "Bạn có thể quay lại xưởng để tạo ảnh hoặc video.";
  if (discovery.value?.state === "verified" || discovery.value?.state === "legacy") return "Nếu xưởng chưa tạo được nội dung, hãy kiểm tra mô hình hoặc mở Chrome trên máy đã kết nối.";
  return "Hãy kiểm tra địa chỉ, mạng và máy đang chạy dịch vụ rồi bấm Kiểm tra kết nối.";
});

async function refresh(fresh = false) {
  if (loading.value) return;
  loading.value = true;
  message.value = "";
  try {
    const status = await http<ConnectionStatus>({ method: "GET", url: "/api/mac2Api/status", params: fresh ? { refresh: "1" } : undefined, headers });
    connection.value = status;
    if (!fresh) baseUrl.value = status.baseUrl;
  } catch { message.value = "Chưa kiểm tra được kết nối. Hãy thử lại."; }
  finally { loading.value = false; }
}

async function save() {
  if (saving.value || loading.value || !baseUrl.value.trim()) return;
  saving.value = true;
  message.value = "";
  try {
    const status = await http<ConnectionStatus>({ url: "/api/mac2Api/save", method: "PUT",
      data: { baseUrl: baseUrl.value, apiKey: apiKey.value.trim() || undefined }, headers });
    baseUrl.value = status.baseUrl;
    connection.value = status;
    apiKey.value = "";
    await refresh(true);
    invalidateNodeModels("media");
  } catch { message.value = "Chưa lưu được kết nối. Hãy kiểm tra lại địa chỉ và khóa bạn vừa nhập."; }
  finally { saving.value = false; }
}
onMounted(() => void refresh());
</script>

<style scoped lang="scss">
.mac2ApiSettings {
  display: grid;
  gap: 12px;
  p, h3 { margin: 0; }
  li { margin-block: 6px; }
  summary { cursor: pointer; margin-bottom: 10px; }
  .connectionDetails { border: 1px solid var(--el-border-color-light); border-radius: 8px; padding: 10px; overflow-wrap: anywhere; }
}
</style>
