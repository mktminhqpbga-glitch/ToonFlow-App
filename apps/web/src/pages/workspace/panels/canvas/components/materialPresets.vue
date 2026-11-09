<template>
  <el-dialog v-model="visible" title="Thư viện vật liệu" width="min(800px, 94vw)" alignCenter appendToBody :closeOnClickModal="false">
    <p class="presetIntro">Chọn một công cụ, chỉnh prompt, sau đó tạo node thật trên Canvas. Đây là mẫu prompt hướng dẫn cho node thật, không phải mô hình AI riêng; kết quả phụ thuộc model đang kết nối. Không tự gửi AI.</p>
    <div class="presetGrid">
      <button v-for="item in presets" :key="item.id" type="button" class="presetItem"
        :class="{ active: selectedId === item.id }" :aria-pressed="selectedId === item.id"
        :disabled="!nodeType(item.kind)" @click="selectPreset(item.id)">
        <strong>{{ item.title }}</strong>
        <small>{{ nodeType(item.kind) ? item.description : 'Cần bật node tạo ảnh/video trong danh sách node' }}</small>
      </button>
    </div>
    <label class="promptLabel" for="materialPresetPrompt">Prompt cho node mới (chỉnh sửa trước khi tạo)</label>
    <el-input id="materialPresetPrompt" v-model="prompt" type="textarea" :rows="6" :maxlength="12000" showWordLimit />
    <template #footer>
      <el-button :disabled="creating" @click="visible = false">Hủy</el-button>
      <el-button type="primary" :loading="creating" :disabled="!selected || !nodeType(selected.kind) || !prompt.trim()" @click="createPreset">Tạo node với prompt</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElButton, ElDialog, ElInput, ElMessage } from "element-plus";
import { findPresetNodeType, presets, type Kind } from "../materialPresetCatalog";

const props = defineProps<{
  availableNodes: { type: string; label: string }[];
  createNode: (preset: { nodeType: string; title: string; prompt: string }) => Promise<boolean>;
}>();
const visible = defineModel<boolean>({ default: false });
const selectedId = ref(presets[0]!.id);
const prompt = ref(presets[0]!.prompt);
const creating = ref(false);
const selected = computed(() => presets.find(item => item.id === selectedId.value));
function nodeType(kind: Kind) {
  return findPresetNodeType(props.availableNodes, kind);
}
function selectPreset(id: string) {
  const choice = presets.find(item => item.id === id);
  if (!choice) return;
  selectedId.value = choice.id;
  prompt.value = choice.prompt;
}
watch(visible, value => { if (value) selectPreset(presets[0]!.id); });
async function createPreset() {
  const choice = selected.value;
  const type = choice && nodeType(choice.kind);
  if (!choice || !type || !prompt.value.trim() || creating.value) return;
  creating.value = true;
  try {
    if (await props.createNode({ nodeType: type, title: choice.title, prompt: prompt.value })) visible.value = false;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Không thể tạo node từ preset");
  } finally {
    creating.value = false;
  }
}
</script>

<style scoped lang="scss">
.presetIntro { margin: 0 0 12px; color: var(--el-text-color-secondary); }
.presetGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; max-height: 330px; overflow-y: auto; margin-bottom: 16px; }
.presetItem { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px; border: 1px solid var(--el-border-color); border-radius: 8px; background: var(--el-bg-color); color: var(--el-text-color-primary); text-align: left; cursor: pointer; }
.presetItem.active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.presetItem:disabled { color: var(--el-text-color-disabled); cursor: not-allowed; }
.presetItem small { font-size: 12px; color: var(--el-text-color-secondary); }
.promptLabel { display: block; margin-bottom: 8px; font-weight: 600; }
@media (max-width: 560px) { .presetGrid { grid-template-columns: 1fr; } }
</style>
