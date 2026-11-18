<template>
  <el-dialog v-model="visible" title="Cách mở mặc định" width="min(660px, calc(100vw - 32px))" alignCenter appendToBody>
    <div class="extensionAssociations" v-loading="loading">
      <p>Chọn tiện ích mặc định cho từng loại tệp. Khi xóa lựa chọn, hệ thống sẽ hỏi lại nếu có nhiều tiện ích khả dụng.</p>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-table :data="rows" maxHeight="420" emptyText="Chưa cài tiện ích tệp hoặc chưa có liên kết mặc định">
        <el-table-column label="Loại tệp" width="140">
          <template #default="{ row }">{{ row.suffix === 'canvasNode' ? 'Node Canvas' : `.${row.suffix}` }}</template>
        </el-table-column>
        <el-table-column label="Tiện ích mặc định">
          <template #default="{ row }">
            <el-select :modelValue="extensionAssociations[row.suffix] ?? ''" placeholder="Tự chọn / Hỏi mỗi lần" clearable
              :disabled="saving" :aria-label="`${row.suffix} Tiện ích mặc định`" @change="id => save(row.suffix, id)">
              <el-option v-if="row.unavailable" :value="row.unavailable" :label="`${row.unavailable}(không khả dụng)`" disabled />
              <el-option v-for="extension in row.candidates" :key="extension.id" :value="extension.id" :label="`${extension.displayName} · ${extension.id}`" />
            </el-select>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <template #footer><el-button @click="visible = false">Hoàn tất</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { ElAlert, ElButton, ElDialog, ElMessage, ElOption, ElSelect, ElTable, ElTableColumn } from "element-plus";
import { extensionAssociations, listExtensions, setExtensionAssociation, type InstalledExtension } from "@/pages/workspace/panels/document/extensions";

const visible = defineModel<boolean>({ required: true });
const extensions = shallowRef<InstalledExtension[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const rows = computed(() => {
  const available = extensions.value.filter(extension => extension.enabled && !extension.loadError);
  const suffixes = new Set([...Object.keys(extensionAssociations.value), ...available.flatMap(extension => extension.resourceKind === "canvasNode" ? ["canvasNode"] : extension.extensions)]);
  return [...suffixes].sort().map(suffix => {
    const candidates = available.filter(extension => suffix === "canvasNode" ? extension.resourceKind === "canvasNode" : extension.resourceKind === "file" && extension.extensions.includes(suffix));
    const selected = extensionAssociations.value[suffix];
    return { suffix, candidates, unavailable: selected && !candidates.some(extension => extension.id === selected) ? selected : undefined };
  });
});

watch(visible, async value => {
  if (!value) return;
  loading.value = true;
  error.value = "";
  try { extensions.value = await listExtensions(); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "Đọc tiện ích tệp thất bại"; }
  finally { loading.value = false; }
}, { immediate: true });

async function save(suffix: string, id: string) {
  saving.value = true;
  try { await setExtensionAssociation(suffix, id || undefined); }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : "Lưu cách mở mặc định thất bại"); }
  finally { saving.value = false; }
}
</script>

<style scoped lang="scss">
.extensionAssociations {
  p { margin: 0 0 16px; color: var(--el-text-color-secondary); line-height: 1.6; }
  :deep(.el-select) { width: 100%; }
}
</style>
