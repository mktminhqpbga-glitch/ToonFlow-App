<template>
  <el-dialog v-model="visible" :title="marketPlugin ? 'Gửi lại plugin' : 'Đăng plugin lên chợ'" width="min(520px, calc(100vw - 32px))" alignCenter appendToBody :closeOnClickModal="false" @closed="emit('closed')">
    <el-form :id="formId" class="uploadForm" labelPosition="top" :disabled="uploading" @submit.prevent="upload">
      <el-form-item label="Tên plugin" required>
        <el-input v-model="form.name" :maxlength="200" autocomplete="off" />
      </el-form-item>
      <el-form-item label="Mã định danh plugin" required>
        <el-input v-model="form.identifier" :readonly="!!plugin || !!marketPlugin" :maxlength="200" autocomplete="off" />
      </el-form-item>
      <el-form-item label="Loại plugin" required>
        <el-select v-model="form.type" :disabled="!!plugin || !!marketPlugin" aria-label="Loại plugin">
          <el-option v-for="option in typeOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="Số phiên bản" required>
        <el-input v-model="form.version" :readonly="!!pluginFile" :maxlength="128" autocomplete="off" placeholder="Ví dụ 1.0.0" />
      </el-form-item>
      <el-form-item label="Mô tả">
        <el-input v-model="form.desc" type="textarea" :rows="3" :maxlength="20000" resize="none" />
      </el-form-item>
      <el-form-item label="Tệp plugin" required>
        <div class="fileDetails">
          <template v-if="!plugin || marketPlugin">
            <el-button :disabled="uploading" @click="fileInput?.click()">{{ file ? 'Chọn lại tệp' : 'Chọn tệp' }}</el-button>
            <input ref="fileInput" type="file" :accept="fileExtension" :disabled="uploading" hidden @change="selectFile" />
          </template>
          <el-button v-if="marketPlugin && canLoadLocalFile" :loading="loadingFile" :disabled="uploading" @click="loadFile">Đọc tệp đã cài</el-button>
          <span v-if="fileName">{{ fileName }}</span>
          <el-text v-if="loadingFile" type="info" size="small">Đang đọc tệp plugin…</el-text>
          <el-text v-else-if="file" type="info" size="small">{{ (file.size / 1024 / 1024).toFixed(2) }} MB</el-text>
      <el-text v-if="!plugin || marketPlugin" type="info" size="small">Tệp {{ fileExtension }}, tối đa {{ maxFileMegabytes }} MB</el-text>
        </div>
      </el-form-item>
      <el-form-item v-if="mediaKind" :label="mediaLabel" required>
        <div class="mediaField">
          <videoPlayer v-if="mediaPreview && mediaKind === 'video'" class="mediaPreview" :src="mediaPreview" :label="mediaLabel" :active="visible" />
          <img v-else-if="mediaPreview" class="mediaPreview" :src="mediaPreview" alt="Xem trước ảnh bìa chụp node" />
          <div class="fileDetails">
          <el-button :disabled="uploading" @click="mediaInput?.click()">{{ mediaPreview ? 'Thay tài nguyên' : `Chọn ${mediaLabel}` }}</el-button>
            <el-button v-if="mediaFile && existingMediaUrl" text :disabled="uploading" @click="clearMedia">Hủy thay thế</el-button>
            <input ref="mediaInput" type="file" :accept="mediaKind === 'video' ? '.mp4,.webm' : '.jpg,.jpeg,.png,.webp'" :disabled="uploading" hidden @change="selectMedia" />
            <span v-if="mediaFile">{{ mediaFile.name }}</span>
            <el-text v-else-if="existingMediaUrl" type="info" size="small">Giữ tài nguyên đã tải lên</el-text>
          </div>
          <el-text type="info" size="small">{{ mediaKind === 'video' ? 'Minh họa tác dụng thực tế của Skill. Hỗ trợ MP4, WebM, tối đa 100 MB' : 'Minh họa giao diện hoặc kết quả node. Hỗ trợ JPG, PNG, WebP, tối đa 10 MB' }}</el-text>
          <el-progress v-if="mediaProgress >= 0" :percentage="mediaProgress" :strokeWidth="4" />
        </div>
      </el-form-item>
      <el-alert v-if="formError" :title="formError" type="error" :closable="false" showIcon />
      <el-alert v-if="fileError" :title="fileError" type="error" :closable="false" showIcon>
        <el-button v-if="canLoadLocalFile && !marketPlugin" size="small" :disabled="loadingFile || uploading" @click="loadFile">Đọc lại</el-button>
      </el-alert>
      <el-alert v-if="uploadError" :title="uploadError" type="error" :closable="false" showIcon />
    </el-form>
    <template #footer>
      <el-button @click="visible = false">Hủy</el-button>
      <el-button type="primary" nativeType="submit" :form="formId" :loading="uploading" :disabled="!ready">{{ marketPlugin ? 'Gửi xét duyệt lại' : 'Tải lên và gửi xét duyệt' }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import axios from "axios";
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, useId, watch } from "vue";
import { ElMessage } from "element-plus";
import { t, translate } from "@toonflow/i18n/vue";
import http from "@/lib/http";
import videoPlayer from "@/components/videoPlayer.vue";
import type { PluginUploadSignature } from "@toonflow/server/channel";
import type { Plugin, PluginType } from "./types";

const props = defineProps<{ plugin?: Plugin; pluginFile?: File; marketPlugin?: Plugin; token: string }>();
const emit = defineEmits<{ uploaded: []; closed: [] }>();
const visible = ref(true);
const formId = useId();
const initialPlugin = props.marketPlugin ?? props.plugin;
const form = reactive({
  name: initialPlugin?.displayName ?? "", identifier: initialPlugin?.name ?? "", type: initialPlugin?.type ?? "node" as PluginType,
  version: initialPlugin?.version ?? "", desc: initialPlugin?.description ?? "",
});
const typeOptions: { label: string; value: PluginType }[] = [
  { label: "Node", value: "node" }, { label: "Tiện ích tệp", value: "ext" }, { label: "Kỹ năng", value: "skill" },
  { label: "Công cụ", value: "tool" }, { label: "Agent", value: "agent" },
];
const canLoadLocalFile = computed(() => !!props.plugin && !props.pluginFile && (!props.marketPlugin
  || (props.plugin.name === props.marketPlugin.name && props.plugin.type === props.marketPlugin.type)));
const fileName = ref("");
const fileInput = ref<HTMLInputElement>();
const file = shallowRef<Blob>();
const mediaInput = ref<HTMLInputElement>();
const mediaFile = shallowRef<File>();
const mediaObjectUrl = ref("");
const mediaProgress = ref(-1);
const mediaKind = computed(() => form.type === "skill" ? "video" : form.type === "node" ? "cover" : undefined);
const mediaLabel = computed(() => mediaKind.value === "video" ? "Video minh họa Skill" : "Ảnh bìa chụp node");
const existingMediaUrl = computed(() => mediaKind.value === "video" ? props.marketPlugin?.demoVideoUrl : mediaKind.value === "cover" ? props.marketPlugin?.coverUrl : undefined);
const mediaPreview = computed(() => mediaObjectUrl.value || existingMediaUrl.value || "");
const fileExtension = computed(() => form.type === "skill" || form.type === "agent" ? ".zip" : ".js");
const maxFileMegabytes = computed(() => fileExtension.value === ".zip" ? 20 : 10);
const loadingFile = ref(false);
const uploading = ref(false);
const fileError = ref("");
const uploadError = ref("");
const formError = computed(() => {
  for (const [value, label, limit] of [[form.name, "Tên plugin", 200], [form.identifier, "Mã định danh plugin", 200],
    [form.version, "Số phiên bản", 128], [form.desc, "Mô tả", 20000]] as const) {
    if (value.trim().length > limit) return t`${translate(label)}不能超过 ${limit} 个字符`;
  }
  return "";
});
const ready = computed(() => !!file.value && !!form.name.trim() && !!form.identifier.trim() && !!form.version.trim() && !!props.token.trim()
  && (!mediaKind.value || !!mediaFile.value || !!existingMediaUrl.value)
  && (!props.marketPlugin || (typeof props.marketPlugin.id === "number" && Number.isSafeInteger(props.marketPlugin.id)
    && props.marketPlugin.id > 0 && (props.marketPlugin.state === 1 || props.marketPlugin.state === 2)))
  && !formError.value && !fileError.value && !loadingFile.value && !uploading.value);
let controller: AbortController | undefined;
let fileReader: FileReader | undefined;

async function loadFile() {
  const { plugin, pluginFile } = props;
  if (!visible.value || uploading.value || !plugin) return;
  if (pluginFile) {
    fileName.value = pluginFile.name;
    fileError.value = validateFile(pluginFile, pluginFile.name);
    file.value = fileError.value ? undefined : pluginFile;
    return;
  }
  if (!canLoadLocalFile.value) return;
  controller?.abort();
  const request = new AbortController();
  controller = request;
  file.value = undefined;
  fileName.value = `${plugin.name}.${plugin.type === "node" || plugin.type === "ext" ? "umd.js" : plugin.type === "tool" ? "tool.js" : plugin.type === "agent" ? "agent.zip" : "zip"}`;
  loadingFile.value = true;
  fileError.value = "";
  uploadError.value = "";
  try {
    const { data } = await axios.get<Blob>("/api/plugins/export", {
      params: { type: plugin.type, name: plugin.name }, responseType: "blob", signal: request.signal,
      headers: { "x-toonflow-workspace": "1", "Cache-Control": "no-cache" },
    });
    if (request.signal.aborted) return;
    const message = validateFile(data, fileName.value);
    if (message) throw new Error(message);
    file.value = data;
  } catch (error) {
    let message = error instanceof Error ? error.message : translate("读取插件文件失败");
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      const body = await error.response.data.text().then(JSON.parse).catch(() => null);
      if (typeof body?.message === "string") message = body.message;
    }
    if (!request.signal.aborted) fileError.value = message;
  } finally {
    if (controller === request) loadingFile.value = false;
  }
}

function validateFile(value: Blob, name: string) {
  if (!name.trim() || name.trim().length > 255) return translate("插件文件名须为 1 至 255 个字符");
  if (!name.trim().toLowerCase().endsWith(fileExtension.value)) return t`此类插件只支持 ${fileExtension.value} 文件`;
  if (!value.size) return translate("插件文件内容为空");
  if (value.size > maxFileMegabytes.value * 1024 * 1024) return t`插件文件不能超过 ${maxFileMegabytes.value} MB`;
  return "";
}

function selectFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const selected = input.files?.[0];
  input.value = "";
  if (!selected || uploading.value || !visible.value || (props.plugin && !props.marketPlugin)) return;
  controller?.abort();
  controller = undefined;
  loadingFile.value = false;
  fileError.value = validateFile(selected, selected.name);
  uploadError.value = "";
  file.value = fileError.value ? undefined : selected;
  fileName.value = fileError.value ? "" : selected.name;
}

async function upload() {
  if (!visible.value || !ready.value || !file.value) return;
  const request = new AbortController();
  controller = request;
  const token = props.token;
  const marketPlugin = props.marketPlugin;
  const selectedMedia = mediaFile.value;
  const kind = mediaKind.value;
  const metadata = {
    name: form.name.trim(),
    desc: form.desc.trim(), fileName: fileName.value.trim(), version: form.version.trim(),
    ...(marketPlugin ? { id: marketPlugin.id } : { identifier: form.identifier.trim(), type: form.type }),
  };
  uploading.value = true;
  uploadError.value = "";
  try {
    let mediaFields: { demoVideoKey?: string; coverKey?: string } = {};
    if (selectedMedia && kind) {
      const signature = await http<PluginUploadSignature>({
        method: "POST", url: "/api/channel/plugin/getUploadSignature", data: { kind, fileName: selectedMedia.name },
        signal: request.signal, headers: { Authorization: `Bearer ${token}` },
      });
      if (request.signal.aborted) return;
      mediaProgress.value = 0;
      await axios.put(signature.uploadUrl, selectedMedia, {
        headers: { "Content-Type": signature.contentType }, signal: request.signal, timeout: 10 * 60 * 1000,
        onUploadProgress: event => {
          if (!request.signal.aborted && event.total) mediaProgress.value = Math.min(100, Math.round(event.loaded / event.total * 100));
        },
      });
      if (request.signal.aborted) return;
      mediaFields = kind === "video" ? { demoVideoKey: signature.fileKey } : { coverKey: signature.fileKey };
    }
    const fileBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      fileReader = reader;
      reader.onload = () => resolve((reader.result as string).split(",", 2)[1]!);
      reader.onerror = () => reject(reader.error ?? new Error("Đọc tệp plugin thất bại"));
      reader.onabort = () => reject(new DOMException("Đã hủy đọc tệp", "AbortError"));
      reader.readAsDataURL(file.value!);
    });
    if (request.signal.aborted) return;
    const message = await http<string>({
      method: "POST", url: marketPlugin ? "/api/channel/plugin/updatePlugin" : "/api/channel/plugin/uploadPlugin", data: { ...metadata, fileBase64, ...mediaFields },
      signal: request.signal, headers: { Authorization: `Bearer ${token}` }, timeout: 65000,
    });
    if (request.signal.aborted) return;
    ElMessage.success(message || (marketPlugin ? "Đã gửi lại thành công, đang chờ xét duyệt" : "Đã tải lên thành công, đang chờ xét duyệt"));
    emit("uploaded");
    visible.value = false;
  } catch (error) {
    if (!request.signal.aborted) uploadError.value = error instanceof Error ? error.message : marketPlugin ? "Gửi lại plugin thất bại" : "Tải plugin lên thất bại";
  } finally {
    if (controller === request) uploading.value = false;
    mediaProgress.value = -1;
    fileReader = undefined;
  }
}

function cancelRequests() {
  controller?.abort();
  fileReader?.abort();
  file.value = undefined;
  clearMedia();
}

function clearMedia() {
  if (mediaObjectUrl.value) URL.revokeObjectURL(mediaObjectUrl.value);
  mediaObjectUrl.value = "";
  mediaFile.value = undefined;
}

function selectMedia(event: Event) {
  const input = event.target as HTMLInputElement;
  const selected = input.files?.[0];
  input.value = "";
  if (!selected || uploading.value || !visible.value || !mediaKind.value) return;
  const video = mediaKind.value === "video";
  const extension = video ? /\.(mp4|webm)$/i : /\.(jpe?g|png|webp)$/i;
  const mimeTypes = video ? ["video/mp4", "video/webm"] : ["image/jpeg", "image/png", "image/webp"];
  if (!extension.test(selected.name) || (selected.type && !mimeTypes.includes(selected.type))) {
    ElMessage.warning(video ? "Hãy chọn video MP4 hoặc WebM" : "Hãy chọn ảnh chụp JPG, PNG hoặc WebP");
    return;
  }
  const maxMegabytes = video ? 100 : 10;
  if (!selected.size || selected.size > maxMegabytes * 1024 * 1024 || selected.name.length > 255) {
  ElMessage.warning(`Tài nguyên không được rỗng hoặc vượt quá ${maxMegabytes} MB, tên tệp không được vượt quá 255 ký tự`);
    return;
  }
  clearMedia();
  mediaFile.value = selected;
  mediaObjectUrl.value = URL.createObjectURL(selected);
  uploadError.value = "";
}

watch(visible, value => { if (!value) cancelRequests(); }, { flush: "sync" });
watch(() => [props.token, props.plugin?.key, props.pluginFile, props.marketPlugin?.key], () => { visible.value = false; }, { flush: "sync" });
watch(() => form.type, () => {
  if (props.plugin || props.marketPlugin) return;
  clearMedia();
  uploadError.value = "";
  fileError.value = file.value ? validateFile(file.value, fileName.value) : "";
  if (fileError.value) {
    file.value = undefined;
    fileName.value = "";
  }
}, { flush: "sync" });
onMounted(loadFile);
onBeforeUnmount(cancelRequests);
</script>

<style lang="scss" scoped>
.uploadForm {
  max-height: calc(100dvh - 220px);
  overflow-y: auto;

  .mediaField {
    width: 100%;

    .mediaPreview {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: contain;
      background: var(--el-fill-color-light);
      border-radius: var(--el-border-radius-base);
      overflow: hidden;
      margin-bottom: 10px;
    }

    .el-progress { margin-top: 8px; }
  }

  .fileDetails {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    overflow-wrap: anywhere;
  }

  .el-alert + .el-alert { margin-top: 12px; }
}
</style>
