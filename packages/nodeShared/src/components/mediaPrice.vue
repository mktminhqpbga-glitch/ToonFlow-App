<template>
  <el-tooltip v-model:visible="infoVisible" :content="priceLabel" :disabled="!priceLabel" placement="top" :showArrow="false" :trigger="['hover', 'focus']" :triggerKeys="[]" :popperStyle="{ maxWidth: '280px', lineHeight: '1.6', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }">
    <button type="button" class="mediaPrice" :aria-label="price?.price || priceLabel" :aria-busy="loading" @pointerdown.stop @click.stop="infoVisible = Boolean(priceLabel)">
      <span>{{ loading ? "Đang tính giá…" : price ? price.price : "Không tính được giá" }}</span>
      <icon-info-circle v-if="!loading && (!price || price.tips)" :size="14" aria-hidden="true" />
    </button>
  </el-tooltip>
</template>

<script setup lang="ts">
import { computed, inject, onScopeDispose, ref, watch } from "vue";
import { ElTooltip } from "element-plus";
import { IconInfoCircle } from "@tabler/icons-vue";
import { subscribeNodeModels, useNodeAi, type NodeMediaPrice, type NodeMediaPriceRequest } from "@toonflow/nodes-scaffold/nodeAi";

const props = defineProps<{ input: Omit<NodeMediaPriceRequest, "directory">; supported: boolean }>();
const ai = useNodeAi();
const getDirectory = inject<(() => string) | undefined>("workspaceDirectory", undefined);
const price = ref<NodeMediaPrice | null>();
const infoVisible = ref(false);
const loading = ref(false);
const error = ref("");
const revision = ref(0);
const priceLabel = computed(() => !props.supported ? "Nhà cung cấp chưa hỗ trợ báo giá trước. Bạn vẫn có thể tạo nội dung; chi phí thực tế theo nhà cung cấp." : loading.value ? "Đang tra cứu giá dự kiến" : error.value
  ? `Tra cứu giá thất bại: ${error.value}. Kiểm tra cấu hình nhà cung cấp hoặc thử lại sau.`
  : price.value ? price.value.tips : "Chưa có giá dự kiến cho mô hình và thông số này. Bạn vẫn có thể tạo nội dung; phí thực tế theo nhà cung cấp.");

onScopeDispose(subscribeNodeModels(type => { if (type === "media") revision.value++; }));

function currentDirectory() {
  try { return getDirectory?.(); }
  catch { return undefined; }
}

watch([() => JSON.stringify(props.input), () => props.supported, currentDirectory, revision], ([serialized, supported, directory], _previous, onCleanup) => {
  price.value = undefined;
  error.value = "";
  loading.value = false;
  if (!supported) return;
  const controller = new AbortController();
  loading.value = true;
  // ACT: 仅底部设置挂载时查询；合并连续输入，素材只传路径，不在节点端读取Tệp。
  const timer = setTimeout(async () => {
    try {
      if (!directory) throw new Error("Hãy chọn thư mục làm việc trước");
      const result = await ai.getMediaPrice({ ...JSON.parse(serialized), directory }, controller.signal);
      if (!controller.signal.aborted) price.value = result;
    } catch (failure) {
      if (!controller.signal.aborted) error.value = failure instanceof Error ? failure.message : "Tra cứu giá thất bại";
    } finally {
      if (!controller.signal.aborted) loading.value = false;
    }
  }, 800);
  onCleanup(() => {
    clearTimeout(timer);
    controller.abort();
  });
}, { immediate: true });
</script>

<style lang="scss" scoped>
.mediaPrice {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  max-width: 160px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--el-text-color-secondary);
  font-family: inherit;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  cursor: help;

  > span { overflow: hidden; text-overflow: ellipsis; }
  > svg { flex-shrink: 0; transform: translateY(1px); }
  &:hover { color: var(--el-text-color-primary); }
  &:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 3px; border-radius: 2px; }
}
</style>
