<template>
  <el-dialog v-model="visible" class="homeAssetLibraryDialog" title="素材库" width="min(1440px, 88vw)" alignCenter appendToBody destroyOnClose>
    <div class="homeLibraryNavigation">
      <el-button type="primary" plain @click="promptVisible = true">Thư viện prompt tạo ảnh</el-button>
      <span>Kho tài nguyên và thư viện prompt dùng chung với Canvas.</span>
    </div>
    <assetLibrary v-model="visible" expanded />
  </el-dialog>
  <PromptLibraryDialog v-model="promptVisible" />
</template>

<script setup lang="ts">
import { ref } from "vue";
import PromptLibraryDialog from "@/components/promptLibrary/PromptLibraryDialog.vue";
import assetLibrary from "@/pages/workspace/panels/canvas/components/assetLibrary.vue";

const visible = defineModel<boolean>({ default: false });
const promptVisible = ref(false);
</script>

<style lang="scss">
.homeLibraryNavigation{display:flex;align-items:center;gap:12px;padding:8px 14px;flex-wrap:wrap;font-size:12px;color:var(--el-text-color-secondary)}
.homeAssetLibraryDialog.el-dialog {
  display: flex;
  flex-direction: column;
  height: 84dvh;
  max-height: calc(100dvh - 32px);
  overflow: hidden;
  .el-dialog__header { flex-shrink: 0; }

  .el-dialog__body { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; padding: 0; overflow: hidden; }

  @media (max-width: 700px) {
    width: calc(100vw - 24px);
    height: calc(100dvh - 32px);
  }
}
</style>
