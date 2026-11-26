<template>
  <el-dialog v-model="visible" title="Hồ sơ sản phẩm" width="min(560px, calc(100vw - 24px))" appendToBody destroyOnClose
    :showClose="!busy" :closeOnClickModal="!busy" :closeOnPressEscape="!busy">
    <div class="profileFields" v-loading="loading">
      <p class="hint">Dùng lại mô tả và ảnh sản phẩm cho các đợt thuộc dự án này.</p>
      <p v-if="loadError" class="error" role="alert">{{ loadError }}</p>
      <el-button v-if="loadError" size="small" @click="openLibrary">Mở lại hồ sơ</el-button>
      <template v-else>
        <label for="productProfileChoice">Hồ sơ</label>
        <select id="productProfileChoice" :value="selectedId" :disabled="busy" @change="selectProfile(($event.target as HTMLSelectElement).value)">
          <option value="">{{ initialProduct ? 'Tạo hồ sơ từ đầu vào đang nhập' : 'Tạo hồ sơ mới' }}</option>
          <option v-for="profile in profiles" :key="profile.id" :value="profile.id">{{ profile.name }}</option>
        </select>
        <form class="profileFields" @submit.prevent="saveProfile">
          <label for="productProfileName">Tên sản phẩm</label>
          <el-input id="productProfileName" v-model="draft.name" :maxlength="100" :disabled="busy" placeholder="Ví dụ: Áo khoác mùa thu" />
          <label for="productProfileDescription">Mô tả sản phẩm</label>
          <el-input id="productProfileDescription" v-model="draft.description" type="textarea" :rows="4" :maxlength="contextLimit" :disabled="busy"
            placeholder="Đặc điểm, phong cách, lời kêu gọi mua hàng…" />
          <label for="productProfilePhotos">Ảnh sản phẩm · {{ draft.photos.length }}/{{ imageLimit }}</label>
          <input id="productProfilePhotos" type="file" :accept="Object.keys(imageExtensions).join(',')" multiple
            :disabled="busy || draft.photos.length >= imageLimit" @change="uploadPhotos" />
          <ul v-if="draft.photos.length" class="photos">
            <li v-for="photo in draft.photos" :key="photo.path">
              <span>{{ photo.name }}</span>
              <el-button size="small" text :disabled="busy" :aria-label="'Bỏ ' + photo.name" @click="draft.photos = draft.photos.filter(image => image.path !== photo.path)">Bỏ</el-button>
            </li>
          </ul>
          <div class="profileActions">
            <el-button type="primary" nativeType="submit" :loading="saving" :disabled="busy || !draft.name.trim()">Lưu hồ sơ</el-button>
            <el-button v-if="initialProduct && selectedId" :disabled="busy || dirty" @click="applyProfile">Dùng cho đợt này</el-button>
          </div>
          <p v-if="initialProduct && selectedId" class="hint">{{ dirty ? 'Lưu chỉnh sửa trước khi dùng hồ sơ.' : 'Hồ sơ sẽ thay mô tả và ảnh sản phẩm trong đầu vào chung.' }}</p>
        </form>
      </template>
      <p v-if="message" class="hint" role="status">{{ message }}</p>
      <p v-if="actionError" class="error" role="alert">{{ actionError }}</p>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from "vue";
import useWorkspaceFiles, { type TextSnapshot } from "@/lib/workspaceFiles";
import { fileErrorCode, videoFlowError } from "./useVideoFlowRun";
import { appendFlowPhotos, productProfilesPath, productProfileSchema, profileLimit, profilesMaxBytes, readProductProfiles, type ProductProfile } from "./productProfiles";
import { contextLimit, imageExtensions, imageLimit, type FlowPhoto } from "./videoFlow";

const props = defineProps<{ directory: string; initialProduct?: { description: string; photos: FlowPhoto[] }; availablePhotos?: number }>();
const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ apply: [profile: ProductProfile] }>();
const files = useWorkspaceFiles(props.directory);
const lifetime = new AbortController();
const profiles = ref<ProductProfile[]>([]);
const selectedId = ref("");
const draft = ref({ name: "", description: "", photos: [] as FlowPhoto[] });
const loading = ref(false);
const saving = ref(false);
const uploading = ref(false);
const busy = computed(() => loading.value || saving.value || uploading.value);
const loadError = ref("");
const actionError = ref("");
const message = ref("");
const selected = computed(() => profiles.value.find(profile => profile.id === selectedId.value));
const dirty = computed(() => !!selected.value && (
  selected.value.name !== draft.value.name || selected.value.description !== draft.value.description
  || JSON.stringify(selected.value.photos) !== JSON.stringify(draft.value.photos)));
let snapshot: TextSnapshot | undefined;

function selectProfile(id: string) {
  selectedId.value = id;
  message.value = actionError.value = "";
  const profile = selected.value;
  draft.value = { name: profile?.name ?? "", description: profile?.description ?? props.initialProduct?.description ?? "",
    photos: [...(profile?.photos ?? props.initialProduct?.photos ?? [])] };
}

async function openLibrary() {
  loading.value = true;
  loadError.value = "";
  snapshot = undefined;
  profiles.value = [];
  selectProfile("");
  try {
    const stored = await files.readTextSnapshot(productProfilesPath, { maxBytes: profilesMaxBytes, signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(15_000)]) });
    profiles.value = readProductProfiles(stored.text);
    snapshot = stored;
  } catch (error) {
    if (!lifetime.signal.aborted && fileErrorCode(error) !== "ENOENT") loadError.value = "Không mở được hồ sơ. " + videoFlowError(error);
  } finally { loading.value = false; }
}

async function uploadPhotos(event: Event) {
  const input = event.target as HTMLInputElement;
  const picked = Array.from(input.files ?? []);
  input.value = "";
  if (!picked.length || busy.value) return;
  message.value = actionError.value = "";
  if (picked.length + draft.value.photos.length > imageLimit) {
    actionError.value = "Mỗi hồ sơ chứa tối đa " + imageLimit + " ảnh.";
    return;
  }
  uploading.value = true;
  try { await appendFlowPhotos(files, picked, draft.value.photos, lifetime.signal); }
  catch (error) { if (!lifetime.signal.aborted) actionError.value = "Chưa lưu đủ ảnh. " + videoFlowError(error); }
  finally { uploading.value = false; }
}

async function saveProfile() {
  if (busy.value || loadError.value) return;
  message.value = actionError.value = "";
  if (!selectedId.value && profiles.value.length >= profileLimit) {
    actionError.value = "Dự án đã có " + profileLimit + " hồ sơ. Bạn có thể chỉnh sửa hồ sơ đã lưu.";
    return;
  }
  const result = productProfileSchema.safeParse({ ...draft.value, id: selectedId.value || crypto.randomUUID() });
  if (!result.success) { actionError.value = "Hãy kiểm tra tên, mô tả và ảnh sản phẩm."; return; }
  const profile = result.data;
  const next = selectedId.value ? profiles.value.map(entry => entry.id === profile.id ? profile : entry) : [...profiles.value, profile];
  const text = JSON.stringify({ version: 1, profiles: next });
  if (new Blob([text]).size > profilesMaxBytes) { actionError.value = "Hồ sơ đã vượt dung lượng lưu. Hãy rút gọn mô tả."; return; }
  saving.value = true;
  try {
    const signal = AbortSignal.timeout(15_000);
    try {
      if (snapshot) {
        const revision = await files.writeTextSnapshot(productProfilesPath, text, snapshot, signal);
        snapshot = { ...snapshot, revision, text };
      } else {
        await files.write(productProfilesPath, text, true, signal);
        const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        const revision = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
        snapshot = { text, revision, encoding: "utf-8" };
      }
    } catch (cause) {
      const confirmed = await files.readTextSnapshot(productProfilesPath, { maxBytes: profilesMaxBytes, signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
      if (confirmed?.text !== text) throw cause;
      snapshot = confirmed;
    }
    profiles.value = next;
    selectProfile(profile.id);
    message.value = "Đã lưu hồ sơ sản phẩm.";
  } catch (error) {
    actionError.value = ["ESTALE", "EEXIST"].includes(fileErrorCode(error) ?? "")
      ? "Hồ sơ đã thay đổi ở cửa sổ khác. Hãy sao chép phần vừa nhập, đóng và mở lại danh sách."
      : "Chưa lưu được hồ sơ. " + videoFlowError(error);
  } finally { saving.value = false; }
}

function applyProfile() {
  if (busy.value || dirty.value || !selected.value) return;
  if (selected.value.photos.length > (props.availablePhotos ?? imageLimit)) {
    actionError.value = "Hãy bớt ảnh tham chiếu trong đầu vào chung để dùng hồ sơ ảnh này.";
    return;
  }
  emit("apply", selected.value);
  visible.value = false;
}

watch(visible, opened => { if (opened) void openLibrary(); }, { immediate: true });
onScopeDispose(() => lifetime.abort());
</script>

<style scoped>
.profileFields, .photos { display: grid; min-width: 0; gap: 8px; }
.profileFields { margin: 0; }
.profileFields label { font-weight: 600; }
.profileFields select { padding: 7px; border: 1px solid var(--el-border-color); border-radius: 6px; background: var(--el-bg-color); color: var(--el-text-color-primary); font: inherit; width: 100%; }
.profileFields input[type="file"] { max-width: 100%; }
.hint, .error { margin: 0; overflow-wrap: anywhere; }
.hint { color: var(--el-text-color-secondary); }
.error { color: var(--el-color-danger); }
.photos { padding: 0; margin: 0; list-style: none; }
.photos li, .profileActions { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.photos span { overflow-wrap: anywhere; }
.profileActions { justify-content: flex-start; }
.profileActions :deep(.el-button) { margin: 0; }
</style>
