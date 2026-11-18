<template>
  <div class="editorEmpty" role="status" aria-label="Chưa mở tài liệu">
    <icon-file-text class="emptyIcon" :size="48" stroke="1.2" aria-hidden="true" />
    <p class="emptyTitle">Chưa mở tài liệu</p>
    <p class="emptyDescription">Chọn tệp hoặc node Canvas từ cây thư mục bên trái</p>
  </div>
</template>

<script setup lang="ts">
import { IconFileText } from "@tabler/icons-vue";
</script>

<style scoped lang="scss">
.editorEmpty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 24px;
  text-align: center;
  color: var(--el-text-color-secondary);

  .emptyIcon { color: var(--el-text-color-placeholder); }
  .emptyTitle { margin: 18px 0 8px; font-size: 16px; font-weight: 500; color: var(--el-text-color-regular); }
  .emptyDescription { margin: 0; font-size: 13px; line-height: 1.6; }
}
</style>
