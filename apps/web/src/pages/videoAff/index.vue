<template>
  <main class="videoAffPage">
    <header class="pageHeader">
      <router-link class="backLink" to="/home" aria-label="Về tổng quan MacFlow">
        <icon-arrow-left :size="18" aria-hidden="true" /> <span>MacFlow</span>
      </router-link>
      <h1><icon-movie :size="21" aria-hidden="true" /> VideoAFF</h1>
      <div class="headerActions">
        <el-button v-if="status?.online" text aria-label="Tải lại xưởng" title="Tải lại xưởng" @click="frameRevision++">
          <icon-refresh :size="18" aria-hidden="true" />
        </el-button>
        <el-button plain @click="openSettings">Mô hình và Kho</el-button>
      </div>
    </header>

    <iframe v-if="dashboardUrl" :key="frameRevision" ref="studioFrame" class="studioFrame" :src="dashboardUrl" title="Xưởng VideoAFF" allow="clipboard-write; fullscreen"
      sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox" @load="syncAppearance" />

    <section v-else class="launchPanel" aria-labelledby="launchTitle">
      <h2 id="launchTitle">Xưởng video bán hàng</h2>
      <p v-if="booting" role="status">{{ status?.local.message || "Đang mở VideoAFF…" }}</p>
      <p v-else-if="status?.local.message" :role="status.local.phase === 'error' ? 'alert' : 'status'">{{ status.local.message }}</p>
      <p v-else>Chưa kết nối được với VideoAFF trên máy đang chạy MacFlow.</p>
      <el-alert v-if="connectionError" :title="connectionError" type="error" showIcon :closable="false" />
      <div class="actions">
        <el-button v-if="status?.canStart && !booting" type="primary" @click="startHere">Thử khởi động lại</el-button>
        <el-button v-else-if="!booting" @click="refresh(true)">Kiểm tra lại</el-button>
        <a :href="guide" target="_blank" rel="noopener noreferrer">Hướng dẫn cài VideoAFF</a>
      </div>
    </section>

    <el-drawer v-model="settingsVisible" title="Mô hình và Kho" size="min(720px, 100%)" appendToBody>
      <div class="settingsContent">
        <el-alert v-if="notice" :type="notice.type" :title="notice.text" showIcon @close="notice = undefined" />

        <el-card shadow="never">
          <template #header><h2>Mô hình từ MacFlow</h2></template>
          <p v-if="!status?.bridgeReady" class="hint">{{ status?.canStart ? "Khởi động VideoAFF để chọn mô hình trong MacFlow." : "Thiết lập mã kết nối theo hướng dẫn để VideoAFF dùng được mô hình trong MacFlow." }}</p>
          <template v-else>
            <p class="hint">Chọn mô hình phù hợp cho từng bước. VideoAFF dùng mô hình đọc được ảnh để viết và kiểm tra cảnh, cùng mô hình nhận ảnh đầu để tạo clip 15 giây.</p>
            <div class="modelGrid">
              <label v-for="kind in kinds" :key="kind.key">
                {{ kind.label }}
                <el-select v-model="choices[kind.key]" :disabled="loadingModels || saving" clearable placeholder="Chọn mô hình">
                  <el-option v-for="model in models[kind.key]" :key="modelKey(model)" :label="model.label + ' · ' + model.providerLabel" :value="modelKey(model)" />
                </el-select>
                <small v-if="!loadingModels && !models[kind.key].length">Chưa có mô hình phù hợp trong Cài đặt MacFlow.</small>
              </label>
            </div>
            <el-button type="primary" plain :disabled="loadingModels" :loading="saving" @click="saveModels">Lưu mô hình</el-button>
          </template>
        </el-card>

        <el-card v-if="status?.online" shadow="never">
          <template #header>
            <div class="cardHeader">
              <h2>Kho tài nguyên</h2>
              <el-button text :loading="loadingLibrary" @click="loadLibrary">Làm mới danh sách</el-button>
            </div>
          </template>
          <p v-if="libraryError" class="error" role="status">{{ libraryError }}</p>
          <div class="libraryGrid">
            <section aria-labelledby="affAddPhoto">
              <h3 id="affAddPhoto">Thêm ảnh người mẫu từ Kho MacFlow</h3>
              <p v-if="!people.length && !loadingLibrary" class="hint">Tạo người mẫu trong VideoAFF rồi làm mới danh sách.</p>
              <label>Người mẫu
                <el-select v-model="person" filterable :disabled="loadingLibrary || transferring" placeholder="Chọn người mẫu">
                  <el-option v-for="entry in people" :key="entry.id" :label="entry.name" :value="entry.id" />
                </el-select>
              </label>
              <label>Ảnh trong Kho MacFlow
                <el-select v-model="photo" filterable :disabled="loadingLibrary || transferring" placeholder="Chọn ảnh">
                  <el-option v-for="path in photos" :key="path" :label="path" :value="path" />
                </el-select>
              </label>
              <el-checkbox v-model="rights" :disabled="transferring">Tôi có quyền sử dụng ảnh này.</el-checkbox>
              <el-button :loading="transfer === 'photo'" :disabled="!person || !photo || !rights || transferring" @click="sendPhoto">Thêm ảnh vào VideoAFF</el-button>
            </section>
            <section aria-labelledby="affSaveVideo">
              <h3 id="affSaveVideo">Lưu kết quả từ VideoAFF vào Kho MacFlow</h3>
              <p v-if="!videos.length && !loadingLibrary" class="hint">Video đã ghép xong trong VideoAFF sẽ xuất hiện tại đây.</p>
              <label>Video đã hoàn thành
                <el-select v-model="video" filterable :disabled="loadingLibrary || transferring" placeholder="Chọn video">
                  <el-option v-for="entry in videos" :key="entry.id" :label="entry.name" :value="entry.id" />
                </el-select>
              </label>
              <div class="actions">
                <el-button :loading="transfer === 'video'" :disabled="!video || transferring" @click="saveOutput('video')">Lưu video</el-button>
                <el-button :loading="transfer === 'cover'" :disabled="!videos.find(entry => entry.id === video)?.hasCover || transferring" @click="saveOutput('cover')">Lưu ảnh bìa</el-button>
              </div>
            </section>
          </div>
        </el-card>
      </div>
    </el-drawer>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import axios from "axios";

const kinds = [
  { key: "writer", label: "Viết kịch bản" },
  { key: "review", label: "Kiểm tra ảnh và video" },
  { key: "image", label: "Tạo ảnh cảnh" },
  { key: "video", label: "Tạo clip" },
  { key: "audio", label: "Tạo giọng đọc" },
] as const;
type Kind = typeof kinds[number]["key"];
type Selection = { providerId: string; modelId: string };
type Model = Selection & { label: string; providerLabel: string };
type LocalStatus = { phase: "idle" | "starting" | "running" | "error"; message: string };
type Status = { publicUrl: string; online: boolean; bridgeReady: boolean; canStart: boolean; local: LocalStatus; selections: Record<Kind, Selection | null> };
type Entry = { path: string; type: "file" | "directory"; children?: Entry[] };
type Person = { id: string; name: string };
type Output = { id: string; name: string; hasCover: boolean };

const guide = "https://github.com/mktminhqpbga-glitch/ToonFlow-App/blob/feat/macflow-media-studios/docs/videoAff.md";
const client = axios.create({ baseURL: "/api/videoAff", headers: { "x-toonflow-workspace": "1" }, timeout: 105_000 });
const lifetime = new AbortController();
const config = { signal: lifetime.signal };
const route = useRoute();
const status = ref<Status>();
const settingsVisible = ref(false);
const frameRevision = ref(0);
const studioFrame = ref<HTMLIFrameElement>();
const connectionError = ref("");
const dashboardUrl = computed(() => {
  if (!status.value?.online) return;
  const path = status.value.publicUrl;
  if (path !== "/api/videoAff/studio/dashboard/") return;
  const product = route.query.product;
  if (typeof product === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(product)) {
    return path + "studio/" + product;
  }
  return path;
});
const models = ref<Record<Kind, Model[]>>({ writer: [], review: [], image: [], video: [], audio: [] });
const choices = reactive<Record<Kind, string>>({ writer: "", review: "", image: "", video: "", audio: "" });
const loading = ref(false);
const starting = ref(false);
const booting = computed(() => loading.value || starting.value || status.value?.local.phase === "starting");
const saving = ref(false);
const loadingModels = ref(false);
const loadingLibrary = ref(false);
const libraryError = ref("");
const transfer = ref<"photo" | "video" | "cover">();
const transferring = computed(() => !!transfer.value);
const notice = ref<{ type: "success" | "error"; text: string }>();
const people = ref<Person[]>([]);
const videos = ref<Output[]>([]);
const photos = ref<string[]>([]);
const person = ref("");
const photo = ref("");
const video = ref("");
const rights = ref(false);
const modelKey = (model: Selection) => JSON.stringify([model.providerId, model.modelId]);
let poll: ReturnType<typeof setTimeout> | undefined;
const appearanceTokens = ["--el-bg-color", "--el-bg-color-page", "--el-fill-color-light", "--el-text-color-primary",
  "--el-text-color-regular", "--el-text-color-secondary", "--el-border-color-light", "--el-border-color",
  "--el-color-primary", "--el-color-primary-light-9", "--el-color-success", "--el-color-success-light-9",
  "--el-color-warning", "--el-color-warning-light-9", "--el-color-danger", "--el-color-danger-light-9", "--ui-radius"];
const appearanceObserver = new MutationObserver(syncAppearance);

function syncAppearance() {
  const root = studioFrame.value?.contentDocument?.documentElement;
  if (!root) return;
  const host = document.documentElement;
  const appearance = getComputedStyle(host);
  root.setAttribute("data-theme", host.classList.contains("dark") ? "dark" : "light");
  root.style.fontSize = appearance.fontSize;
  for (const token of appearanceTokens) root.style.setProperty(token, appearance.getPropertyValue(token));
}

function message(error: unknown) {
  return axios.isAxiosError<{ message?: string }>(error) && error.response?.data?.message
    || "Chưa thực hiện được thao tác. Hãy kiểm tra kết nối rồi thử lại.";
}

function showError(error: unknown) {
  if (!lifetime.signal.aborted) notice.value = { type: "error", text: message(error) };
}

async function refresh(autoStart = false) {
  if (loading.value) return;
  clearTimeout(poll);
  loading.value = true;
  connectionError.value = "";
  try {
    const { data } = await client.get<{ data: Status }>("/status", config);
    status.value = data.data;
    if (autoStart && !status.value.online && status.value.canStart && status.value.local.phase === "idle") {
      await requestStart();
    }
    if (settingsVisible.value && status.value.local.phase !== "starting") loadSettings();
  } catch (error) { if (!lifetime.signal.aborted) connectionError.value = message(error); }
  finally {
    loading.value = false;
    if (!lifetime.signal.aborted && status.value?.local.phase === "starting") poll = setTimeout(() => void refresh(), 2000);
  }
}

async function requestStart() {
  const { data } = await client.post<{ data: { local: LocalStatus } }>("/local/start", undefined, config);
  if (status.value) status.value.local = data.data.local;
}

async function startHere() {
  if (starting.value || !status.value?.canStart) return;
  starting.value = true;
  connectionError.value = "";
  try {
    await requestStart();
    await refresh();
  } catch (error) { if (!lifetime.signal.aborted) connectionError.value = message(error); }
  finally { starting.value = false; }
}

function openSettings() {
  settingsVisible.value = true;
  loadSettings();
}

function loadSettings() {
  if (status.value?.online) void loadLibrary();
  if (status.value?.bridgeReady) void loadModels();
}

async function loadModels() {
  if (loadingModels.value || saving.value) return;
  loadingModels.value = true;
  try {
    const catalog = await client.get<{ data: Record<Kind, Model[]> }>("/models", config);
    models.value = catalog.data.data;
    for (const kind of kinds) {
      const selection = status.value?.selections[kind.key];
      choices[kind.key] = selection ? modelKey(selection) : "";
    }
  } catch (error) { showError(error); }
  finally { loadingModels.value = false; }
}

async function saveModels() {
  if (saving.value) return;
  saving.value = true;
  notice.value = undefined;
  try {
    const selections = Object.fromEntries(kinds.map(({ key }) => {
      const picked = models.value[key].find(model => modelKey(model) === choices[key]);
      return [key, picked ? { modelId: picked.modelId, providerId: picked.providerId } : null];
    }));
    const { data } = await client.put<{ data: { selections: Status["selections"] } }>("/models", selections, config);
    if (status.value) status.value.selections = data.data.selections;
    notice.value = { type: "success", text: "Đã lưu mô hình VideoAFF." };
  } catch (error) { showError(error); }
  finally { saving.value = false; }
}

function listImages(entries: Entry[]): string[] {
  return entries.flatMap(entry => entry.type === "directory" ? listImages(entry.children ?? [])
    : /\.(png|jpe?g|webp)$/i.test(entry.path) ? [entry.path] : []);
}

async function loadLibrary() {
  if (loadingLibrary.value) return;
  loadingLibrary.value = true;
  libraryError.value = "";
  try {
    const results = await Promise.allSettled([
      client.get<{ data: { people: Person[]; videos: Output[] } }>("/library", config)
        .then(({ data }) => {
          people.value = data.data.people;
          videos.value = data.data.videos;
          if (!people.value.some(entry => entry.id === person.value)) person.value = "";
          if (!videos.value.some(entry => entry.id === video.value)) video.value = "";
        }),
      axios.get<{ data: { entries: Entry[] } }>("/api/assets/list", config)
        .then(({ data }) => { photos.value = listImages(data.data.entries); if (!photos.value.includes(photo.value)) photo.value = ""; }),
    ]);
    if (results.some(result => result.status === "rejected")) libraryError.value = "Chưa tải đủ nội dung trong Kho. Hãy làm mới danh sách.";
  } finally { loadingLibrary.value = false; }
}

async function sendPhoto() {
  if (transferring.value || !rights.value) return;
  transfer.value = "photo";
  notice.value = undefined;
  try {
    await client.post("/personPhoto", { id: person.value, path: photo.value, rights: rights.value }, config);
    notice.value = { type: "success", text: "Đã thêm ảnh vào người mẫu trong VideoAFF." };
    rights.value = false;
  } catch (error) { showError(error); }
  finally { transfer.value = undefined; }
}

async function saveOutput(kind: "video" | "cover") {
  if (transferring.value) return;
  transfer.value = kind;
  notice.value = undefined;
  try {
    const { data } = await client.post<{ data: { path: string } }>("/saveOutput", { id: video.value, kind }, config);
    notice.value = { type: "success", text: "Đã lưu vào Kho MacFlow tại " + data.data.path };
  } catch (error) { showError(error); }
  finally { transfer.value = undefined; }
}

onMounted(() => {
  appearanceObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
  void refresh(true);
});
onScopeDispose(() => { lifetime.abort(); appearanceObserver.disconnect(); clearTimeout(poll); });
</script>

<style scoped>
.videoAffPage { box-sizing: border-box; height: 100dvh; display: flex; flex-direction: column; background: var(--el-bg-color); }
.pageHeader, .headerActions, .cardHeader, .actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.pageHeader { flex: none; min-height: 56px; padding: 8px clamp(12px, 3vw, 28px); border-bottom: 1px solid var(--el-border-color-light); }
.backLink, h1 { display: flex; align-items: center; gap: 7px; }
.backLink { padding: 6px 12px 6px 0; border-right: 1px solid var(--el-border-color-light); color: var(--el-text-color-regular); font-size: 14px; text-decoration: none; }
.backLink:hover { color: var(--el-color-primary); }
h1 svg { color: var(--el-color-primary); }
.headerActions { margin-left: auto; gap: 4px; }
.headerActions :deep(.el-button) { margin: 0; }
.cardHeader { justify-content: space-between; }
.studioFrame { flex: 1; min-height: 0; width: 100%; border: 0; }
.launchPanel { display: grid; gap: 12px; align-content: center; justify-items: start; flex: 1; width: min(100%, 650px); margin: auto; padding: 20px; box-sizing: border-box; }
.settingsContent { display: grid; gap: 12px; }
h1, h2, h3, p { margin: 0; }
h1 { font-size: 17px; }
h2 { font-size: 17px; }
h3 { font-size: 15px; }
.launchPanel p, .hint, small { color: var(--el-text-color-secondary); }
.hint, small { font-size: 13px; line-height: 1.5; }
.error { color: var(--el-color-danger); margin-bottom: 10px; }
a { color: var(--el-color-primary); text-underline-offset: 3px; }
.modelGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 14px 0; }
.libraryGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.libraryGrid section, label { display: grid; align-content: start; gap: 8px; min-width: 0; }
.libraryGrid section > .el-button { justify-self: start; }
.actions :deep(.el-button) { margin: 0; }
@media (max-width: 690px) {
  .libraryGrid, .modelGrid { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 420px) {
  .backLink span { display: none; }
}
</style>
