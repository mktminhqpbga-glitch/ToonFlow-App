<template>
  <el-tooltip v-model:visible="infoVisible" :content="priceLabel" :disabled="!priceLabel" placement="top" :showArrow="false" :trigger="['hover', 'focus']" :triggerKeys="[]" :popperStyle="{ maxWidth: '280px', lineHeight: '1.6', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }">
    <button type="button" class="mediaPrice" :aria-label="price?.price || priceLabel" :aria-busy="loading" @pointerdown.stop @click.stop="infoVisible = Boolean(priceLabel)">
      <span>{{ loading ? localized("正在估价…", "Đang ước tính…") : price ? price.price : localized("无法计算价格", "Chưa tính được chi phí") }}</span>
      <icon-info-circle v-if="!loading && (!price || price.tips)" :size="14" aria-hidden="true" />
    </button>
  </el-tooltip>
</template>

<script setup lang="ts">
import { computed, inject, onScopeDispose, ref, watch } from "vue";
import { ElTooltip } from "element-plus";
import { IconInfoCircle } from "@tabler/icons-vue";
import { subscribeNodeModels, useNodeAi, type NodeMediaPrice, type NodeMediaPriceRequest } from "@toonflow/nodes-scaffold/nodeAi";
import { useNodeVietnamese } from "../nodeLanguage";

const vietnamese = useNodeVietnamese();
const localized = (zh: string, vi: string) => vietnamese.value ? vi : zh;
const props = defineProps<{ input: Omit<NodeMediaPriceRequest, "directory">; supported: boolean }>();
const ai = useNodeAi();
const getDirectory = inject<(() => string) | undefined>("workspaceDirectory", undefined);
const price = ref<NodeMediaPrice | null>();
const infoVisible = ref(false);
const loading = ref(false);
const error = ref("");
const revision = ref(0);
const priceLabel = computed(() => !props.supported
  ? localized("当前供应商尚未提供预估价格，无法提前计算费用。你仍可发起生成，实际费用以供应商结算为准.", "Nhà cung cấp chưa hỗ trợ ước tính trước chi phí. Bạn vẫn có thể tạo; phí thực tế do nhà cung cấp tính.")
  : loading.value ? localized("正在查询预估价格", "Đang tra cứu chi phí dự kiến")
  : error.value ? localized(`价格查询失败：${error.value}。请检查供应商配置或稍后重试。`, `Không tra cứu được chi phí: ${error.value}. Hãy kiểm tra cấu hình nhà cung cấp hoặc thử lại sau.`)
  : price.value ? price.value.tips
  : localized("当前模型或参数组合暂无预估价格。你仍可发起生成，实际费用以供应商结算为准。", "Chưa có giá ước tính cho model/thông số này. Bạn vẫn có thể tạo; phí thực tế do nhà cung cấp tính."));

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
  // ACT: 仅底部设置挂载时查询；合并连续输入，素材只传路径，不在节点端读取文件。
  const timer = setTimeout(async () => {
    try {
      if (!directory) throw new Error(localized("请先选择工作目录", "Hãy chọn thư mục làm việc trước"));
      const result = await ai.getMediaPrice({ ...JSON.parse(serialized), directory }, controller.signal);
      if (!controller.signal.aborted) price.value = result;
    } catch (failure) {
      if (!controller.signal.aborted) error.value = failure instanceof Error ? failure.message : localized("价格查询失败", "Không tra cứu được giá");
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
