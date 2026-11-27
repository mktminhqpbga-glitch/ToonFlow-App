<template>
  <el-dialog v-model="visible" title="Kho nhân vật tham chiếu" width="min(900px, calc(100vw - 26px))" appendToBody destroyOnClose>
    <div class="characterPanel">
      <form class="characters" @submit.prevent="addCharacter">
        <label for="characterName">Tên nhân vật mới</label>
        <el-input id="characterName" v-model="name" maxlength="60" :disabled="busy" placeholder="Ví dụ: Mai · người mẫu" />
        <el-button nativeType="submit" :loading="adding" :disabled="!name.trim() || busy && !adding">Thêm nhân vật</el-button>
        <label for="characterSelect">Nhân vật đã lưu</label>
        <el-select id="characterSelect" v-model="selected" :loading="loading" :disabled="busy" placeholder="Chọn nhân vật">
          <el-option v-for="character in characters" :key="character.path" :label="character.name" :value="character.path" />
        </el-select>
      </form>
      <section class="characterPhotos" aria-label="Ảnh của nhân vật">
        <div class="galleryHeading">
          <h3>{{ current?.name ?? "Ảnh tham chiếu" }}</h3>
          <el-button v-if="current" type="primary" plain :loading="uploading" :disabled="busy && !uploading" @click="input?.click()">Tải ảnh lên</el-button>
        </div>
        <div v-if="photos.length" class="photoGrid">
          <article v-for="photo in photos" :key="photo.path" class="photoCard">
            <img :src="photoUrl(photo.path)" :alt="photo.name" loading="lazy" />
            <span :title="photo.name">{{ photo.name }}</span>
            <el-button v-if="canUse" text type="primary" @click="emit('select', photo)">Dùng ảnh này</el-button>
          </article>
        </div>
        <el-empty v-else :imageSize="65" :description="current ? 'Tải ảnh để dùng nhân vật này làm tham chiếu.' : 'Thêm nhân vật hoặc chọn một nhân vật đã lưu.'" />
        <input ref="input" type="file" hidden multiple accept="image/png,image/jpeg,image/webp" aria-label="Chọn ảnh nhân vật" @change="uploadPhotos" />
        <p v-if="current" class="hint">Dùng ảnh PNG, JPG hoặc WebP. Mỗi ảnh tối đa 20 MiB.</p>
      </section>
    </div>
    <el-alert v-if="issue" type="error" :title="issue" :closable="false" showIcon />
    <p v-if="notice" class="hint" role="status">{{ notice }}</p>
  </el-dialog>
</template>

<script setup lang="ts">
import axios from "axios";
import { computed, onMounted, onScopeDispose, ref } from "vue";

type Asset = { path: string; name: string; type: "file" | "directory"; children?: Asset[] };
defineProps<{ canUse?: boolean }>();
const emit = defineEmits<{ select: [asset: Asset] }>();
const visible = defineModel<boolean>({ required: true });
const directory = "NhanVatThamChieu";
const lifetime = new AbortController();
const name = ref("");
const selected = ref("");
const input = ref<HTMLInputElement>();
const characters = ref<Asset[]>([]);
const loading = ref(false);
const adding = ref(false);
const uploading = ref(false);
const busy = computed(() => loading.value || adding.value || uploading.value);
const issue = ref("");
const notice = ref("");
const current = computed(() => characters.value.find(character => character.path === selected.value));
const photos = computed(() => current.value?.children?.filter(item => item.type === "file" && /\.(png|jpe?g|webp)$/i.test(item.name)) ?? []);
const photoUrl = (path: string) => "/api/assets/read?" + new URLSearchParams({ path });
const config = { signal: lifetime.signal, timeout: 90000 };

function message(error: unknown) {
  return axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || "Chưa kết nối được Kho MacFlow."
    : error instanceof Error ? error.message : "Chưa xử lý được ảnh nhân vật.";
}

async function load() {
  loading.value = true;
  try {
    const { data } = await axios.get<{ data: { entries: Asset[] } }>("/api/assets/list", config);
    characters.value = data.data.entries.find(entry => entry.type === "directory" && entry.path === directory)?.children
      ?.filter(entry => entry.type === "directory") ?? [];
    if (!current.value) selected.value = characters.value[0]?.path ?? "";
  } finally { loading.value = false; }
}

async function mkdir(path: string, allowExisting = false) {
  try { await axios.post("/api/assets/mkdir", { path }, config); }
  catch (error) {
    if (!(allowExisting && axios.isAxiosError<{ data?: { code?: string } }>(error) && error.response?.data?.data?.code === "EEXIST")) throw error;
  }
}

async function addCharacter() {
  if (busy.value) return;
  const label = name.value.trim().normalize("NFC");
  issue.value = "";
  notice.value = "";
  if (!label || label.length > 60 || /[\\/<>:"|?*\x00-\x1f]|\.$/.test(label) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(label)) {
    issue.value = "Nhập tên nhân vật hợp lệ, không chứa ký tự dành cho đường dẫn.";
    return;
  }
  adding.value = true;
  try {
    await mkdir(directory, true);
    const path = directory + "/" + label;
    await mkdir(path);
    await load();
    selected.value = path;
    name.value = "";
    notice.value = "Đã thêm nhân vật. Bạn có thể tải ảnh lên ngay.";
  } catch (error) { if (!lifetime.signal.aborted) issue.value = message(error); }
  finally { adding.value = false; }
}

async function uploadPhotos(event: Event) {
  const field = event.target as HTMLInputElement;
  const files = Array.from(field.files ?? []);
  field.value = "";
  if (!current.value || !files.length || busy.value) return;
  const folder = current.value.path;
  issue.value = "";
  notice.value = "";
  uploading.value = true;
  let saved = 0;
  try {
    for (const file of files) {
      const extension = file.name.match(/\.(png|jpe?g|webp)$/i)?.[1]?.toLowerCase();
      const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const detected = bytes.length < 12 ? "" : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "jpg"
        : bytes[0] === 137 && String.fromCharCode(...bytes.slice(1, 4)) === "PNG" ? "png"
        : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" ? "webp" : "";
      if (!extension || detected !== (extension === "jpeg" ? "jpg" : extension) || file.size > 20 * 1024 * 1024) {
        throw new Error(`Ảnh “${file.name}” không đúng định dạng hoặc vượt 20 MiB.`);
      }
      const title = file.name.slice(0, -(extension.length + 1)).normalize("NFC")
        .replace(/[^\p{L}\p{M}\p{N}_-]+/gu, "-").slice(0, 45) || "anh";
      const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), value => value.toString(16).padStart(2, "0")).join("");
      await axios.put("/api/assets/save", file, { ...config, params: { path: `${folder}/${title}-${id}.${extension}` },
        headers: { "Content-Type": "application/octet-stream" } });
      saved++;
    }
  } catch (error) { if (!lifetime.signal.aborted) issue.value = message(error); }
  finally {
    if (saved && !lifetime.signal.aborted) {
      await load().catch(error => { issue.value ||= message(error); });
      notice.value = `Đã lưu ${saved} ảnh vào nhân vật.`;
    }
    uploading.value = false;
  }
}

onMounted(() => { void load().catch(error => { if (!lifetime.signal.aborted) issue.value = message(error); }); });
onScopeDispose(() => lifetime.abort());
</script>

<style scoped>
.characterPanel { display: grid; grid-template-columns: minmax(175px, 240px) minmax(0, 1fr); gap: 20px; }
.characters { display: grid; align-content: start; gap: 8px; }
.characters label { font-weight: 600; }
.characters label:nth-of-type(2) { margin-top: 12px; }
.galleryHeading { display: flex; justify-content: space-between; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
.galleryHeading h3 { margin: 0; overflow-wrap: anywhere; }
.photoGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 135px), 1fr)); gap: 10px; max-height: 52dvh; overflow: auto; }
.photoCard { display: grid; gap: 4px; padding: 6px; border: 1px solid var(--el-border-color-light); border-radius: var(--ui-radius, 8px); min-width: 0; text-align: center; }
.photoCard img { width: 100%; aspect-ratio: 1 / 1; object-fit: contain; background: var(--el-fill-color-light); border-radius: 6px; }
.photoCard span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hint { color: var(--el-text-color-secondary); font-size: .82rem; }
@media (max-width: 600px) { .characterPanel { grid-template-columns: minmax(0, 1fr); gap: 14px; } }
</style>
