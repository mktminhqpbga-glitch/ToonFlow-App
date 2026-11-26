<template>
  <aside v-if="summary || readError" class="flowReminder" aria-label="Đợt video trong dự án">
    <div>
      <strong>Đợt video gần nhất</strong>
      <p v-if="summary">{{ summary.done }}/{{ summary.total }} video hoàn thành<span v-if="summary.review"> · {{ summary.review }} chờ duyệt</span><span v-if="summary.failed"> · {{ summary.failed }} cảnh cần kiểm tra</span><span v-if="summary.pending"> · {{ summary.pending }} cảnh cần tiếp tục</span></p>
      <p v-else>Chưa đọc được tiến độ. Mở Xưởng video để kiểm tra.</p>
    </div>
    <router-link class="openFlow" :to="{ path: '/video', query: { studio: 'flow' } }">
      {{ summary?.review || summary?.failed || summary?.pending ? 'Tiếp tục đợt đang làm' : 'Mở Xưởng video' }}
    </router-link>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import useWorkspaceFiles from "@/lib/workspaceFiles";
import { fileErrorCode } from "@/pages/mediaStudio/useVideoFlowRun";
import { canResumeProgress, flowStages, readVideoRun, runMaxBytes, runPath } from "@/pages/mediaStudio/videoFlow";

const props = defineProps<{ directory: string }>();
const summary = ref<{ done: number; total: number; review: number; failed: number; pending: number }>();
const readError = ref(false);
watch(() => props.directory, async (directory, _previous, onCleanup) => {
  summary.value = undefined;
  readError.value = false;
  const controller = new AbortController();
  onCleanup(() => controller.abort());
  try {
    const saved = await useWorkspaceFiles(directory).readTextSnapshot(runPath, {
      maxBytes: runMaxBytes, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]),
    });
    if (controller.signal.aborted) return;
    const run = readVideoRun(saved.text);
    const counts = { done: 0, total: run.items.length, review: 0, failed: 0, pending: 0 };
    for (const item of run.items) {
      if (item.stages.video.state === "done") counts.done++;
      const unfinished = flowStages.map(stage => item.stages[stage]).find(stage => stage.state !== "done");
      const versions = item.variants?.map(variant => variant.progress) ?? [];
      const progress = unfinished ? [unfinished, ...versions] : versions;
      if (unfinished?.state === "review") counts.review++;
      if (progress.some(step => step.state === "error" || step.state === "interrupted")) counts.failed++;
      if (progress.some(canResumeProgress)) counts.pending++;
    }
    summary.value = counts;
  } catch (error) {
    if (!controller.signal.aborted && fileErrorCode(error) !== "ENOENT") readError.value = true;
  }
}, { immediate: true });
</script>

<style scoped>
.flowReminder { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px 20px; padding: 12px 14px; margin-top: 12px; border: 1px solid var(--el-border-color-light); border-radius: 12px; background: var(--el-bg-color); }
.flowReminder p { margin: 4px 0 0; color: var(--el-text-color-secondary); font-size: 13px; }
.openFlow { color: var(--el-color-primary); text-underline-offset: 3px; }
</style>
