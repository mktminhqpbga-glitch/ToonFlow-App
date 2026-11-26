<template>
  <div class="subtitlePanel">
    <p class="hint">Mốc thời gian tính theo video sau khi cắt và chuyển cảnh.</p>
    <div class="actions">
      <input ref="picker" hidden type="file" accept=".srt,application/x-subrip" @change="importSrt" />
      <el-button size="small" :disabled="disabled || importing" @click="picker?.click()">Nhập SRT</el-button>
      <el-button size="small" :disabled="disabled || importing || !settings.cues.length" @click="download">Tải SRT</el-button>
      <el-button size="small" :disabled="disabled || importing" @click="addCue">Thêm dòng</el-button>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <fieldset v-if="settings.cues.length" :disabled="disabled || importing" class="controls">
      <div class="cueList">
        <div v-for="(cue, index) in settings.cues" :key="cue.id" class="cue">
          <div class="timing">
            <label>Từ (giây)<input v-model.number="cue.start" type="number" min="0" step="0.01" :aria-label="'Bắt đầu phụ đề ' + (index + 1)" /></label>
            <label>Đến (giây)<input v-model.number="cue.end" type="number" min="0" step="0.01" :aria-label="'Kết thúc phụ đề ' + (index + 1)" /></label>
            <el-button text :icon="IconX" :aria-label="'Xóa phụ đề ' + (index + 1)" @click="settings.cues.splice(index, 1)" />
          </div>
          <textarea v-model="cue.text" rows="2" placeholder="Nội dung phụ đề" :aria-label="'Nội dung phụ đề ' + (index + 1)" />
        </div>
      </div>
      <label class="checkbox"><input v-model="settings.burn" type="checkbox" /> Gắn phụ đề vào MP4</label>
      <div v-if="settings.burn" class="timing">
        <label>Vị trí
          <select v-model="settings.position"><option value="bottom">Dưới</option><option value="top">Trên</option></select>
        </label>
        <label>Cỡ chữ
          <select v-model.number="settings.size"><option :value="3">Nhỏ</option><option :value="4.5">Vừa</option><option :value="6">Lớn</option></select>
        </label>
      </div>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElButton } from "element-plus";
import { IconX } from "@tabler/icons-vue";
import { createSrt, parseSrt, type SubtitleSettings } from "./subtitles";

defineProps<{ disabled: boolean }>();
const settings = defineModel<SubtitleSettings>({ required: true });
const picker = ref<HTMLInputElement>();
const importing = ref(false);
const error = ref("");

function addCue() {
  const last = settings.value.cues.at(-1)?.end;
  const start = typeof last === "number" && Number.isFinite(last) ? last : 0;
  settings.value.cues.push({ id: crypto.randomUUID(), start, end: start + 2, text: "" });
  error.value = "";
}

async function importSrt(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  importing.value = true;
  error.value = "";
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error("Hãy chọn tệp SRT tối đa 2 MiB.");
    settings.value.cues.push(...parseSrt(await file.text()));
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Không đọc được tệp SRT.";
  } finally {
    importing.value = false;
  }
}

function download() {
  error.value = "";
  try {
    const url = URL.createObjectURL(new Blob([createSrt(settings.value.cues)], { type: "application/x-subrip;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "phuDe.srt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Không xuất được tệp SRT.";
  }
}
</script>

<style scoped>
.subtitlePanel, .controls, .cueList, .cue { display: grid; gap: 8px; }
.controls { border: 0; margin: 0; padding: 0; min-width: 0; }
.hint, .error { margin: 0; font-size: 12px; line-height: 1.4; }
.hint { color: var(--el-text-color-secondary); }
.error { color: var(--el-color-danger); }
.actions, .timing, .checkbox { display: flex; align-items: center; gap: 6px; }
.actions { flex-wrap: wrap; }
.actions :deep(.el-button) { margin: 0; }
.timing label { display: grid; flex: 1; min-width: 0; gap: 3px; font-size: 12px; }
.cueList { max-height: 220px; overflow: auto; padding: 2px; }
.cue { border: 1px solid var(--el-border-color-lighter); border-radius: 6px; padding: 6px; }
input[type="number"], select, textarea { box-sizing: border-box; width: 100%; padding: 4px 6px; border: 1px solid var(--el-border-color); border-radius: 4px; font: inherit; color: var(--el-text-color-primary); background: var(--el-bg-color); }
textarea { resize: vertical; }
.checkbox { font-size: 12px; }
</style>
