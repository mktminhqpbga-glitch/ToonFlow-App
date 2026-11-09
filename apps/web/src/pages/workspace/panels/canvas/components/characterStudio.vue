<template>
  <el-dialog v-model="visible" title="Studio nhân vật" width="min(920px, 96vw)" alignCenter appendToBody>
    <div class="studioToolbar">
      <el-input v-model="search" clearable placeholder="Tìm nhân vật theo tên hoặc Character ID" />
      <el-button type="primary" :disabled="!directory || saving" @click="openEditor()">Tạo nhân vật</el-button>
    </div>
    <p class="studioNote">Mỗi nhân vật chỉ có một bộ ảnh tham chiếu cố định. Thay bộ ảnh sẽ cập nhật hồ sơ hiện tại, không tạo phiên bản nhân vật mới.</p>
    <div v-if="loading" role="status">Đang tải thư viện nhân vật…</div>
    <div v-else-if="!filtered.length" class="emptyStudio">Chưa có nhân vật trong workspace này.</div>
    <div v-else class="characterGrid">
      <article v-for="item in filtered" :key="item.id" class="characterCard">
        <img v-if="item.images[0] && previews[item.images[0].path]" class="characterPhoto" :src="previews[item.images[0].path]" :alt="item.name" />
        <div v-else class="characterPlaceholder"><icon-user :size="30" /></div>
        <strong>{{ item.name }}</strong>
        <small :title="item.id">ID: {{ item.id }}</small>
        <small>{{ item.images.length }} ảnh tham chiếu</small>
        <div class="characterActions">
          <el-button size="small" :disabled="saving || !item.images.length" @click="addToCanvas(item)">Đưa vào Canvas</el-button>
          <el-button size="small" text :disabled="saving" @click="openEditor(item)">Sửa</el-button>
          <el-button size="small" text type="danger" :disabled="saving" @click="deleteCharacter(item)">Xóa</el-button>
        </div>
      </article>
    </div>
    <template #footer><el-button @click="visible = false">Đóng</el-button></template>
  </el-dialog>

  <el-dialog v-model="editVisible" :title="editingId ? 'Chỉnh sửa nhân vật' : 'Tạo nhân vật'" width="min(560px, 94vw)" alignCenter appendToBody :closeOnClickModal="false">
    <label class="fieldLabel" for="characterName">Tên nhân vật</label>
    <el-input id="characterName" v-model="draftName" :maxlength="120" />
    <label class="fieldLabel" for="characterDescription">Mô tả</label>
    <el-input id="characterDescription" v-model="draftDescription" type="textarea" :rows="3" :maxlength="2000" />
    <label class="fieldLabel">Bộ ảnh tham chiếu (tối đa 9 ảnh)</label>
    <p v-if="editingId" class="studioNote">Nếu không chọn ảnh mới, bộ ảnh cũ được giữ nguyên.</p>
    <input ref="imageInput" type="file" accept="image/png,image/jpeg,image/webp" multiple @change="changePhotos" />
    <p v-if="draftFiles.length">{{ draftFiles.map(file => file.name).join(", ") }}</p>
    <template #footer>
      <el-button :disabled="saving" @click="editVisible = false">Hủy</el-button>
      <el-button type="primary" :loading="saving" :disabled="!draftName.trim() || (!editingId && !draftFiles.length)" @click="saveCharacter">Lưu nhân vật</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { ElButton, ElDialog, ElInput, ElMessage, ElMessageBox } from "element-plus";
import { IconUser } from "@tabler/icons-vue";
import axios from "axios";
import useWorkspaceFiles from "@/lib/workspaceFiles";
import { uploadNodeFile } from "@toonflow/nodes-scaffold/workspaceFiles";

export type CharacterImage = { path: string; name: string; mimeType: string };
export type CharacterRecord = { id: string; name: string; description: string; images: CharacterImage[]; updatedAt: string };
const storePath = "characters/index.json";
const props = defineProps<{ directory?: string; addCharacter: (character: CharacterRecord) => Promise<boolean> }>();
const visible = defineModel<boolean>({ default: false });
const editVisible = ref(false);
const loading = ref(false);
const saving = ref(false);
const search = ref("");
const characters = ref<CharacterRecord[]>([]);
const filtered = computed(() => characters.value.filter(item => (item.name + " " + item.id).toLocaleLowerCase().includes(search.value.toLocaleLowerCase())));
const previews = ref<Record<string, string>>({});
const acquired = new Map<string, { release(): void }>();
const imageInput = ref<HTMLInputElement>();
const editingId = ref("");
const draftName = ref("");
const draftDescription = ref("");
const draftFiles = ref<File[]>([]);
let snapshot: { revision: string; encoding: "utf-8" | "utf-8-bom" | "utf-16le" | "utf-16be" } | undefined;
let loadToken = 0;

function missing(error: unknown) {
  return axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.data?.data?.code === "ENOENT");
}
function releasePreviews() {
  for (const entry of acquired.values()) entry.release();
  acquired.clear();
  previews.value = {};
}
function refreshPreviews() {
  releasePreviews();
  const directory = props.directory;
  if (!directory || !visible.value) return;
  const files = useWorkspaceFiles(directory);
  for (const photo of characters.value.flatMap(item => item.images)) {
    if (acquired.has(photo.path)) continue;
    const token = files.acquireUrl(photo.path, photo.mimeType);
    acquired.set(photo.path, token);
    void token.url.then(url => {
      if (acquired.get(photo.path) === token) previews.value = { ...previews.value, [photo.path]: url };
    }).catch(() => {});
  }
}
async function loadCharacters() {
  const directory = props.directory;
  const token = ++loadToken;
  if (!directory) { characters.value = []; snapshot = undefined; return; }
  loading.value = true;
  try {
    const files = useWorkspaceFiles(directory);
    let contents: CharacterRecord[] = [];
    let loaded: typeof snapshot;
    try {
      const current = await files.readTextSnapshot(storePath);
      const parsed: unknown = JSON.parse(current.text);
      if (!Array.isArray(parsed) || !parsed.every(item => item && typeof item.id === "string" && typeof item.name === "string" && Array.isArray(item.images)
        && item.images.every((image: CharacterImage) => image && typeof image.path === "string" && typeof image.name === "string" && typeof image.mimeType === "string")))
        throw new Error("Dữ liệu nhân vật không hợp lệ; không ghi đè tệp cũ");
      contents = parsed as CharacterRecord[];
      loaded = { revision: current.revision, encoding: current.encoding };
    } catch (error) {
      if (!missing(error)) throw error;
    }
    if (token !== loadToken) return;
    characters.value = contents;
    snapshot = loaded;
    refreshPreviews();
  } catch (error) {
    if (token === loadToken) ElMessage.error(error instanceof Error ? error.message : "Không thể đọc thư viện nhân vật");
  } finally {
    if (token === loadToken) loading.value = false;
  }
}
async function persist(next: CharacterRecord[], directory = props.directory) {
  if (directory !== props.directory) throw new Error("Workspace đã thay đổi; hãy mở lại Studio nhân vật");
  if (!directory) throw new Error("Chưa có workspace");
  const files = useWorkspaceFiles(directory);
  if (snapshot) {
    const revision = await files.writeTextSnapshot(storePath, JSON.stringify(next, null, 2) + "\n", snapshot);
    snapshot = { ...snapshot, revision };
  } else {
    try { await files.mkdir("characters"); } catch (error) { if (!axios.isAxiosError(error) || error.response?.data?.data?.code !== "EEXIST") throw error; }
    await files.writeJson(storePath, next, true);
    const current = await files.readTextSnapshot(storePath);
    snapshot = { revision: current.revision, encoding: current.encoding };
  }
  characters.value = next;
  refreshPreviews();
}
function openEditor(character?: CharacterRecord) {
  editingId.value = character?.id ?? "";
  draftName.value = character?.name ?? "";
  draftDescription.value = character?.description ?? "";
  draftFiles.value = [];
  if (imageInput.value) imageInput.value.value = "";
  editVisible.value = true;
}
function changePhotos(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (files.length > 9 || files.some(file => !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 25 * 1024 * 1024)) {
    ElMessage.warning("Chỉ nhận tối đa 9 ảnh PNG/JPEG/WebP, mỗi ảnh không quá 25 MB");
    input.value = "";
    draftFiles.value = [];
    return;
  }
  draftFiles.value = files;
}
async function saveCharacter() {
  const directory = props.directory;
  if (!directory || saving.value || !draftName.value.trim()) return;
  const existing = characters.value.find(item => item.id === editingId.value);
  if (!existing && !draftFiles.value.length) return;
  saving.value = true;
  try {
    const id = existing?.id ?? crypto.randomUUID();
    const files = useWorkspaceFiles(directory);
    let images = existing?.images ?? [];
    if (draftFiles.value.length) {
      images = [];
      for (const file of draftFiles.value) {
        const path = await uploadNodeFile(files, id, file);
        images.push({ path, name: file.name, mimeType: file.type });
      }
    }
    const record: CharacterRecord = {
      id, name: draftName.value.trim(), description: draftDescription.value.trim(),
      images, updatedAt: new Date().toISOString(),
    };
    await persist(existing ? characters.value.map(item => item.id === id ? record : item) : [...characters.value, record], directory);
    editVisible.value = false;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Không thể lưu nhân vật");
  } finally {
    saving.value = false;
  }
}
async function deleteCharacter(character: CharacterRecord) {
  if (saving.value) return;
  try { await ElMessageBox.confirm(`Xóa hồ sơ "${character.name}" khỏi danh sách? Ảnh gốc trên workspace vẫn được giữ lại.`, "Xác nhận xóa", { type: "warning" }); }
  catch { return; }
  saving.value = true;
  try { await persist(characters.value.filter(item => item.id !== character.id)); }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : "Không thể xóa hồ sơ"); }
  finally { saving.value = false; }
}
async function addToCanvas(character: CharacterRecord) {
  try { if (await props.addCharacter(character)) visible.value = false; }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : "Không thể thêm nhân vật vào Canvas"); }
}
watch(visible, value => { if (value) void loadCharacters(); else { ++loadToken; releasePreviews(); } });
watch(() => props.directory, () => { ++loadToken; characters.value = []; snapshot = undefined; releasePreviews(); if (visible.value) void loadCharacters(); });
onBeforeUnmount(() => { ++loadToken; releasePreviews(); });
</script>

<style scoped lang="scss">
.studioToolbar { display: flex; gap: 10px; margin-bottom: 12px; }
.studioToolbar .el-input { flex: 1; }
.studioNote { color: var(--el-text-color-secondary); font-size: 12px; margin: 8px 0 12px; }
.characterGrid { display: grid; grid-template-columns: repeat(auto-fill,minmax(190px,1fr)); gap: 12px; max-height: 55vh; overflow-y: auto; }
.characterCard { border: 1px solid var(--el-border-color); border-radius: 8px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.characterCard small { color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.characterPhoto,.characterPlaceholder { width: 100%; height: 148px; object-fit: cover; background: var(--el-fill-color); border-radius: 6px; }
.characterPlaceholder { display: grid; place-items: center; }
.characterActions { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
.characterActions .el-button { margin-left: 0; }
.fieldLabel { display: block; font-weight: 600; margin: 12px 0 7px; }
.emptyStudio { padding: 28px; text-align: center; color: var(--el-text-color-secondary); }
</style>
