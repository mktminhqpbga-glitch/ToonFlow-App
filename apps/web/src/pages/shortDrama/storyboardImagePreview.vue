<template>
  <div ref="element" class="imagePreview">
    <a v-if="url && !failed" :href="url" target="_blank" rel="noopener" :title="alt">
      <img :src="url" :alt="alt" @error="failed = true" />
    </a>
    <span v-else>{{ failed ? "Chưa mở được ảnh" : "Đang mở ảnh…" }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import useWorkspaceFiles from "@/lib/workspaceFiles";

const props = defineProps<{ directory: string; path: string; mimeType: string; alt: string }>();
const element = ref<HTMLElement>();
const url = ref("");
const failed = ref(false);

watch([element, () => props.directory, () => props.path, () => props.mimeType], ([box, directory, path, mimeType], _previous, onCleanup) => {
  url.value = "";
  failed.value = false;
  if (!box) return;
  let active = true;
  let release: (() => void) | undefined;
  const load = () => {
    const lease = useWorkspaceFiles(directory).acquireUrl(path, mimeType);
    release = lease.release;
    void lease.url.then(result => { if (active) url.value = result; }, () => { if (active) failed.value = true; });
  };
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    load();
  }, { rootMargin: "160px" });
  observer.observe(box);
  onCleanup(() => { active = false; observer.disconnect(); release?.(); });
}, { flush: "post" });
</script>

<style scoped>
.imagePreview { display: grid; place-items: center; min-height: 80px; background: var(--el-fill-color-light); color: var(--el-text-color-regular); border-radius: 8px; overflow: hidden; font-size: 13px; }
.imagePreview a { display: block; width: 100%; }
.imagePreview img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: contain; }
</style>
