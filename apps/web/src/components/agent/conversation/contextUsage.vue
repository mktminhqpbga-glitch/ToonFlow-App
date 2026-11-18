<template>
  <el-popover
    v-model:visible="visible"
    trigger="hover"
    placement="top"
    :width="280"
    :offset="10"
    :showArrow="false"
    popperClass="agentContextPopover">
    <template #reference>
      <el-button class="contextButton" text circle :disabled="disabled" :aria-label="usage?.tokens == null ? 'Xem mức sử dụng ngữ cảnh, chưa có dữ liệu' : `Xem mức sử dụng ngữ cảnh, đã dùng ${contextPercent.toFixed(1)}%`" title="Xem mức sử dụng ngữ cảnh">
        <el-progress type="circle" :width="14" :strokeWidth="2" :percentage="Math.min(100, contextPercent)" :color="contextColor" :showText="false" />
      </el-button>
    </template>
    <div class="contextUsage">
      <div class="contextHeader"><span>Mức sử dụng ngữ cảnh</span><span class="contextHint">Ước tính</span></div>
      <template v-if="usage?.tokens != null">
        <div class="contextTokens">
          <span>{{ usage.tokens.toLocaleString() }} / {{ contextWindow.toLocaleString() }} tok</span>
          <span>{{ contextPercent.toFixed(1) }}%</span>
        </div>
        <el-progress :percentage="Math.min(100, contextPercent)" :color="contextColor" :showText="false" />
      </template>
      <span v-else class="contextHint">{{ usage ? "Chờ phản hồi tiếp theo để cập nhật mức sử dụng" : "Chưa có dữ liệu sử dụng" }}</span>
      <div v-if="stats" class="contextStats">
        <div class="contextHeader">Tổng mức sử dụng trong hội thoại</div>
        <div class="contextTokens"><span>Đầu vào</span><span>{{ inputTokens.toLocaleString() }} tok</span></div>
        <div class="contextTokens"><span>Đầu ra</span><span>{{ stats.tokens.output.toLocaleString() }} tok</span></div>
        <div v-if="inputTokens > 0" class="contextTokens"><span>Lượt đọc bộ nhớ đệm</span><span>{{ (stats.tokens.cacheRead / inputTokens * 100).toFixed(1) }}%</span></div>
        <div v-if="stats.tokensPerSecond !== undefined" class="contextTokens"><span>Tốc độ tạo</span><span>{{ stats.tokensPerSecond.toFixed(1) }} tok/s</span></div>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AgentContext, AgentStats } from "@toonflow/server/agent/types";

const props = defineProps<{ usage?: AgentContext; stats?: AgentStats; contextWindow: number; disabled: boolean }>();
const visible = defineModel<boolean>("visible", { default: false });
const contextPercent = computed(() => (props.usage?.tokens ?? 0) / props.contextWindow * 100);
const contextColor = computed(() => contextPercent.value >= 90 ? "var(--el-color-danger)" : contextPercent.value >= 75 ? "var(--el-color-warning)" : "var(--el-color-primary)");
const inputTokens = computed(() => props.stats ? props.stats.tokens.input + props.stats.tokens.cacheRead + props.stats.tokens.cacheWrite : 0);
</script>

<style lang="scss">
.agentContextPopover {
  .contextUsage {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .contextStats {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .contextHeader,
    .contextTokens {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }

    .contextHeader {
      color: var(--el-text-color-primary);
    }

    .contextTokens {
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }

    .contextHint {
      color: var(--el-text-color-secondary);
      font-size: 12px;
    }
  }
}
</style>
