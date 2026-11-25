<template>
  <main class="huobaoPage">
    <nav aria-label="Điều hướng MacFlow" class="huobaoNav">
      <router-link to="/home"><icon-home :size="17" /> Tổng quan</router-link>
      <router-link to="/workspace"><icon-layout-dashboard :size="17" /> Canvas</router-link>
    </nav>
    <header class="huobaoHeader">
      <div>
        <h1>Huobao Drama</h1>
        <p>Dựng phim ngắn trong ứng dụng Huobao, dùng tư liệu và mô hình từ MacFlow.</p>
      </div>
      <el-button tag="a" type="primary" :href="appUrl" target="_blank" rel="noopener noreferrer" :icon="IconExternalLink">Mở Huobao Drama</el-button>
    </header>

    <el-alert v-if="notice" :title="notice.text" :type="notice.type" :closable="false" showIcon />

    <el-card shadow="never">
      <template #header>
        <div class="cardHeader">
          <h2>Kết nối</h2>
          <el-button :icon="IconRefresh" :loading="busy === 'status'" :disabled="!!busy" @click="refresh">Kiểm tra lại</el-button>
        </div>
      </template>
      <p v-if="status" role="status" class="statusLine">{{ status.online ? "Huobao đang chạy" : "Chưa kết nối được Huobao" }} · {{ appUrl }}</p>
      <p v-if="status && (!status.online || !status.modelSetup)" class="statusLine">
        <a :href="setupUrl" target="_blank" rel="noopener noreferrer">Hướng dẫn chạy Huobao và mở kết nối mô hình</a>
      </p>
      <div v-if="status?.modelSetup" class="modelFields">
        <label v-for="service in services" :key="service">
          <span>{{ serviceLabels[service] }}</span>
          <el-select v-model="modelChoices[service]" filterable clearable placeholder="Chọn mô hình MacFlow"
            :loading="loadingModels" :disabled="!!busy">
            <el-option v-for="model in modelCatalog[service]" :key="modelKey(model)" :value="modelKey(model)" :label="`${model.label} · ${model.providerLabel}`" />
          </el-select>
        </label>
      </div>
      <el-button :icon="IconPlugConnected" :loading="busy === 'configure'" :disabled="!canConfigure" @click="configure">Kết nối mô hình MacFlow</el-button>
    </el-card>

    <el-card shadow="never">
      <template #header><h2>Kho tư liệu</h2></template>
      <div class="assetColumns">
        <form class="assetForm" @submit.prevent="exportAsset">
          <label for="huobaoAssetChoice">MacFlow → Huobao</label>
          <el-select id="huobaoAssetChoice" v-model="selectedAsset" filterable placeholder="Chọn tệp trong Kho MacFlow" :loading="loadingAssets" :disabled="!!busy">
            <el-option v-for="path in assets" :key="path" :label="path" :value="path" />
          </el-select>
          <div class="assetActions">
            <el-button :loading="busy === 'export'" :disabled="!status?.online || !selectedAsset || !!busy" nativeType="submit">Gửi sang Huobao</el-button>
            <el-button text :loading="loadingAssets" @click="loadAssets">Làm mới kho</el-button>
          </div>
          <a v-if="exported" :href="exported.url" target="_blank" rel="noopener noreferrer">{{ exported.path }}</a>
        </form>
        <form class="assetForm" @submit.prevent="importAsset">
          <label for="huobaoAssetPath">Huobao → MacFlow</label>
          <el-input id="huobaoAssetPath" v-model="sourceAsset" placeholder="Dán liên kết ảnh, video hoặc âm thanh từ Huobao" :maxlength="2048" :disabled="!!busy" />
          <el-button :loading="busy === 'import'" :disabled="!status?.online || !sourceAsset.trim() || !!busy" nativeType="submit">Lưu vào Kho MacFlow</el-button>
          <p v-if="importedPath" role="status" class="statusLine">Đã lưu vào {{ importedPath }}</p>
        </form>
      </div>
    </el-card>

    <router-link to="/shortDrama/storyboard" class="storyboardLink">Mở bảng phân cảnh MacFlow đã lưu</router-link>
  </main>
</template>

<script setup lang="ts">
import axios from "axios";
import { computed, onMounted, onScopeDispose, reactive, ref } from "vue";
import { IconExternalLink, IconPlugConnected, IconRefresh } from "@tabler/icons-vue";

type Service = "text" | "image" | "video";
type Status = { publicUrl: string; online: boolean; modelSetup: boolean; models: { service: Service; providerId: string; modelId: string }[] };
type Model = { providerId: string; modelId: string; label: string; providerLabel: string };
type Entry = { path: string; type: "file" | "directory"; children?: Entry[] };
const services = ["text", "image", "video"] as const;
const serviceLabels = { text: "Văn bản", image: "Ảnh", video: "Video" };
const setupUrl = "https://github.com/mktminhqpbga-glitch/ToonFlow-App/blob/feat/macflow-media-studios/docs/huobaoDrama.md";
const client = axios.create({ baseURL: "/api/huobao", headers: { "x-toonflow-workspace": "1" }, timeout: 45000 });
const lifetime = new AbortController();
const status = ref<Status>();
const appUrl = computed(() => status.value?.publicUrl ?? "http://127.0.0.1:5679");
const busy = ref<"status" | "configure" | "export" | "import">();
const notice = ref<{ type: "error" | "success"; text: string }>();
const modelCatalog = ref<Record<Service, Model[]>>({ text: [], image: [], video: [] });
const modelChoices = reactive<Record<Service, string>>({ text: "", image: "", video: "" });
const loadingModels = ref(false);
const canConfigure = computed(() => !busy.value && !loadingModels.value && status.value?.online && status.value.modelSetup
  && services.some(service => modelCatalog.value[service].some(model => modelKey(model) === modelChoices[service])));
const modelKey = (model: Pick<Model, "providerId" | "modelId">) => JSON.stringify([model.providerId, model.modelId]);
const loadingAssets = ref(false);
const assets = ref<string[]>([]);
const selectedAsset = ref("");
const sourceAsset = ref("");
const exported = ref<{ path: string; url: string }>();
const importedPath = ref("");

function showError(error: unknown) {
  if (lifetime.signal.aborted) return;
  notice.value = { type: "error", text: axios.isAxiosError<{ message?: string }>(error)
    ? error.response?.data?.message || "Không liên hệ được máy chủ MacFlow."
    : "Thao tác Huobao chưa hoàn tất." };
}

async function loadAssets() {
  if (loadingAssets.value) return;
  loadingAssets.value = true;
  try {
    const { data } = await axios.get<{ data: { entries: Entry[] } }>("/api/assets/list", { signal: lifetime.signal });
    const files: string[] = [];
    function collect(entries: Entry[]) {
      for (const entry of entries) {
        if (entry.type === "directory") collect(entry.children ?? []);
        else if (/\.(png|jpe?g|webp|mp4|mov|webm|m4a|mp3|wav)$/i.test(entry.path)) files.push(entry.path);
      }
    }
    collect(data.data.entries);
    assets.value = files;
  } catch (error) { showError(error); }
  finally { loadingAssets.value = false; }
}

async function refresh() {
  busy.value = "status";
  notice.value = undefined;
  try {
    const { data } = await client.get<{ data: Status }>("/status", { signal: lifetime.signal });
    status.value = data.data;
    for (const service of services) {
      const model = data.data.models.find(item => item.service === service);
      modelChoices[service] = model ? modelKey(model) : "";
    }
    if (data.data.modelSetup) void loadModels();
  } catch (error) { showError(error); }
  finally { busy.value = undefined; }
}

async function loadModels() {
  if (loadingModels.value) return;
  loadingModels.value = true;
  try {
    const { data } = await client.get<{ data: Record<Service, Model[]> }>("/models", { signal: lifetime.signal });
    modelCatalog.value = data.data;
  } catch (error) { showError(error); }
  finally { loadingModels.value = false; }
}

async function configure() {
  busy.value = "configure";
  notice.value = undefined;
  try {
    const selected = Object.fromEntries(services.map(service => {
      const model = modelCatalog.value[service].find(item => modelKey(item) === modelChoices[service]);
      return [service, model ? { providerId: model.providerId, modelId: model.modelId } : null];
    }));
    const { data } = await client.post<{ data: { count: number } }>("/configure", selected, { signal: lifetime.signal });
    notice.value = { type: "success", text: `Đã kết nối ${data.data.count} loại mô hình MacFlow. Mở lại trang Cài đặt trong Huobao để xem.` };
  } catch (error) { showError(error); }
  finally { busy.value = undefined; }
}

async function exportAsset() {
  busy.value = "export";
  notice.value = undefined;
  exported.value = undefined;
  try {
    const { data } = await client.post<{ data: { path: string; url: string } }>("/exportAsset", { assetPath: selectedAsset.value }, { signal: lifetime.signal });
    exported.value = data.data;
    notice.value = { type: "success", text: "Đã gửi tư liệu. Mở liên kết để xem hoặc sao chép địa chỉ dùng trong Huobao." };
  } catch (error) { showError(error); }
  finally { busy.value = undefined; }
}

async function importAsset() {
  busy.value = "import";
  notice.value = undefined;
  importedPath.value = "";
  try {
    const { data } = await client.post<{ data: { path: string } }>("/importAsset", { assetPath: sourceAsset.value }, { signal: lifetime.signal });
    importedPath.value = data.data.path;
    void loadAssets();
  } catch (error) { showError(error); }
  finally { busy.value = undefined; }
}

onMounted(() => { void refresh(); void loadAssets(); });
onScopeDispose(() => lifetime.abort());
</script>

<style scoped>
.huobaoPage { min-height: 100%; max-width: 1080px; margin: auto; padding: clamp(18px, 4vw, 50px); display: grid; gap: 18px; align-content: start; }
.huobaoNav, .huobaoHeader, .cardHeader, .assetActions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.huobaoNav a { display: inline-flex; align-items: center; gap: 6px; }
.huobaoHeader, .cardHeader { justify-content: space-between; }
.huobaoHeader h1, h2 { margin: 0; }
h2 { font-size: 17px; }
.huobaoHeader p, .statusLine { color: var(--el-text-color-secondary); margin: 8px 0 12px; }
.modelFields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 14px 0; }
.modelFields label { display: grid; gap: 6px; min-width: 0; }
.assetColumns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.assetForm { display: grid; gap: 10px; align-content: start; }
.assetForm > .el-button { justify-self: start; }
.assetForm label { font-weight: 600; }
.assetForm a { overflow-wrap: anywhere; }
a { color: var(--el-color-primary); }
.storyboardLink { justify-self: start; }
@media (max-width: 680px) { .assetColumns, .modelFields { grid-template-columns: 1fr; } }
</style>
