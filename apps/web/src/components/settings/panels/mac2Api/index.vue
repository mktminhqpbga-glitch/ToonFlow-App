<template>
  <div class="mac2ApiSettings">
    <el-form labelPosition="top" @submit.prevent="save">
      <el-form-item label="Base URL mac2API">
        <el-input v-model="baseUrl" maxlength="2048" placeholder="HTTPS hoặc HTTP loopback" aria-label="Base URL mac2API" />
      </el-form-item>
      <el-form-item label="Khóa client mac2API">
        <el-input v-model="apiKey" type="password" maxlength="520" autocomplete="new-password"
          :placeholder="connection?.keySaved ? 'Khóa đã lưu' : 'Nhập khóa m2c_'" aria-label="Khóa client mac2API" />
      </el-form-item>
      <el-button type="primary" nativeType="submit" :loading="saving" :disabled="!baseUrl.trim()">Lưu kết nối</el-button>
      <el-button :loading="loading" :disabled="saving" @click="refresh(true)">Kiểm tra kết nối</el-button>
    </el-form>

    <el-alert v-if="message" :title="message" type="error" :closable="false" showIcon />
    <p>ChatGPT Web và Gemini Web cần Chrome kết nối trên máy chạy mac2API.</p>

    <section v-if="discovery" aria-label="Trạng thái mac2API">
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
    </section>
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

async function refresh(fresh = false) {
  if (loading.value) return;
  loading.value = true;
  message.value = "";
  try {
    const status = await http<ConnectionStatus>({ method: "GET", url: "/api/mac2Api/status", params: fresh ? { refresh: "1" } : undefined, headers });
    connection.value = status;
    if (!fresh) baseUrl.value = status.baseUrl;
  } catch { message.value = "Không đọc được trạng thái mac2API."; }
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
    await refresh(true);
    invalidateNodeModels("media");
  } catch { message.value = "Không lưu được kết nối. Hãy kiểm tra Base URL và khóa client m2c_."; }
  finally { apiKey.value = ""; saving.value = false; }
}
onMounted(() => void refresh());
</script>

<style scoped lang="scss">
.mac2ApiSettings {
  display: grid;
  gap: 12px;
  p, h3 { margin: 0; }
  li { margin-block: 6px; }
}
</style>
