<template>
  <nav class="creativeNavigation" :class="{ compact }" aria-label="Điều hướng MacFlow">
    <router-link v-for="section in homeSections" :key="section.id"
      :to="{ path: '/home', query: section.id === 'home' ? {} : { section: section.id } }" :title="section.label" :aria-label="section.label">
      <component :is="section.icon" :size="18" aria-hidden="true" /> <span>{{ section.label }}</span>
    </router-link>
    <router-link v-for="item in links" :key="item.path" :to="item.path" :title="item.label" :aria-label="item.label"
      :class="{ currentLink: item.path === '/shortDrama' && route.path.startsWith('/shortDrama/') }"
      :aria-current="item.path === '/shortDrama' && route.path.startsWith('/shortDrama/') ? 'location' : undefined">
      <component :is="item.icon" :size="18" aria-hidden="true" /> <span>{{ item.label }}</span>
    </router-link>
    <button v-if="canOpenLibrary" type="button" title="Thư viện tài nguyên" aria-label="Thư viện tài nguyên" aria-haspopup="dialog" @click="libraryVisible = true">
      <icon-library-photo :size="18" aria-hidden="true" /> <span>Thư viện tài nguyên</span>
    </button>
    <button v-if="canOpenLibrary && !publicWeb" type="button" title="Kho nhân vật tham chiếu" aria-label="Kho nhân vật tham chiếu" aria-haspopup="dialog" @click="openCharacters">
      <icon-users :size="18" aria-hidden="true" /> <span>Kho nhân vật</span>
    </button>
    <button type="button" title="Cài đặt" aria-label="Cài đặt" aria-haspopup="dialog" @click="openSettings">
      <icon-settings :size="18" aria-hidden="true" /> <span>Cài đặt</span>
    </button>
  </nav>
  <assetLibraryDialog v-if="libraryVisible" v-model="libraryVisible" :directory="workspaceStore.project?.directory" />
  <characterLibrary v-if="charactersVisible" v-model="charactersVisible" />
  <settings v-if="settingsVisible" v-model="settingsVisible" />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from "vue";
import { useRoute } from "vue-router";
import { useWorkspaceStore } from "@/stores/workspace";
import { currentUser, publicWeb } from "@/stores/multiTenant";
import { creationLinks, homeSections } from "@/lib/mainNavigation";

const props = withDefaults(defineProps<{ compact?: boolean; showCharacters?: boolean; modelSettings?: boolean }>(), {
  compact: false, showCharacters: false, modelSettings: false,
});
const emit = defineEmits<{ characters: []; settings: [] }>();
const settings = defineAsyncComponent(() => import("@/components/settings/index.vue"));
const assetLibraryDialog = defineAsyncComponent(() => import("@/pages/home/assetLibraryDialog.vue"));
const characterLibrary = defineAsyncComponent(() => import("@/components/characterLibrary.vue"));
const route = useRoute();
const workspaceStore = useWorkspaceStore();
const libraryVisible = ref(false);
const charactersVisible = ref(false);
const settingsVisible = ref(false);
const canOpenLibrary = computed(() => currentUser.value?.role !== "user");
const links = computed(() => creationLinks.filter(item => !item.localOnly || !publicWeb.value));
function openCharacters() {
  if (props.showCharacters) emit("characters");
  else charactersVisible.value = true;
}
function openSettings() {
  if (props.modelSettings) emit("settings");
  else settingsVisible.value = true;
}
</script>

<style scoped>
.creativeNavigation { display: grid; gap: 4px; }
.creativeNavigation :is(a, button) {
  display: flex; align-items: center; min-height: 40px; gap: 10px; padding: 8px 11px;
  border: 0; border-radius: 9px; background: transparent; color: var(--el-text-color-regular);
  font: inherit; font-size: 14px; text-align: start; text-decoration: none; cursor: pointer;
}
.creativeNavigation svg { flex: 0 0 auto; }
.creativeNavigation :is(a, button):hover { background: var(--el-fill-color-light); color: var(--el-text-color-primary); }
.creativeNavigation :is(a, button):focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
.creativeNavigation :is(.router-link-exact-active, .currentLink) { color: var(--el-text-color-primary); background: var(--el-fill-color-darker); font-weight: 650; }
@media (max-width: 1050px) {
  .creativeNavigation.compact span { display: none; }
  .creativeNavigation.compact :is(a, button) { justify-content: center; padding-inline: 9px; }
}
@media (max-width: 730px) {
  .creativeNavigation.compact { display: flex; overflow-x: auto; padding-bottom: 3px; }
  .creativeNavigation.compact :is(a, button) { flex: 0 0 40px; }
}
</style>
