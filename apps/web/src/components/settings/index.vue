<template>
  <el-dialog v-model="visible" title="Cài đặt" width="min(1080px, calc(100vw - 32px))" alignCenter appendToBody>
    <div class="settings">
      <aside class="sidebar" aria-label="Danh mục cài đặt">
        <template v-for="item in mainPanels" :key="item.id">
          <h3 v-if="item.groupLabel" class="settingsGroupLabel">{{ item.groupLabel }}</h3>
          <button
            class="settingsItem"
            type="button"
          :aria-label="item.id === 'about' && hasDesktopUpdate ? `${item.label}, có phiên bản mới` : item.label"
            :aria-pressed="activePanel.id === item.id"
            @click="activePanel = item">
            <el-badge class="panelIcon" isDot :hidden="item.id !== 'about' || !hasDesktopUpdate">
              <component :is="item.icon" :size="18" aria-hidden="true" />
            </el-badge>
            <span>{{ item.label }}</span>
          </button>
        </template>
        <template v-if="morePanels.length">
          <button
            class="settingsItem moreToggle"
            type="button"
            :aria-label="moreExpanded ? 'Thu gọn' : 'Xem thêm'"
            :aria-expanded="moreExpanded"
            aria-controls="settingsMorePanels"
            @click="moreExpanded = !moreExpanded">
            <icon-dots :size="18" aria-hidden="true" />
            <span>{{ moreExpanded ? 'Thu gọn' : 'Xem thêm' }}</span>
            <icon-chevron-down class="moreChevron" :class="{ expanded: moreExpanded }" :size="16" aria-hidden="true" />
          </button>
          <div v-if="moreExpanded" id="settingsMorePanels" class="morePanelList">
            <button
              v-for="item in morePanels"
              :key="item.id"
              class="settingsItem"
              type="button"
          :aria-label="item.id === 'about' && hasDesktopUpdate ? `${item.label}, có phiên bản mới` : item.label"
              :aria-pressed="activePanel.id === item.id"
              @click="activePanel = item">
              <el-badge class="panelIcon" isDot :hidden="item.id !== 'about' || !hasDesktopUpdate">
                <component :is="item.icon" :size="18" aria-hidden="true" />
              </el-badge>
              <span>{{ item.label }}</span>
            </button>
          </div>
        </template>
      </aside>
      <section class="content" :aria-label="activePanel.label" tabindex="0">
        <h2 class="panelTitle">{{ activePanel.label }}</h2>
        <div class="panelContent">
          <transition name="el-fade-in" mode="out-in">
            <keep-alive include="personalization">
              <userAccount v-if="publicWeb && activePanel.id === 'account'" :request="http" :userName="currentUser?.userName ?? ''" :role="currentUser?.role" @loggedOut="loggedOut" />
              <component
                v-else
                :is="activePanel.component"
                v-bind="
                  ['account', 'pluginMarket', 'languageModel', 'mediaModel', 'personalization', 'deviceLink', 'aiChrome'].includes(activePanel.id) ? { visible } : {}
                "
                v-on="activePanel.id === 'mediaModel' ? { studioOpened: () => visible = false } : {}" />
            </keep-alive>
          </transition>
        </div>
      </section>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { translate } from "@toonflow/i18n/vue";
import { computed, defineAsyncComponent, ref, shallowRef, watch } from "vue";
import userAccount from "@toonflow/multi-tenant-user-web/account";
import { hasDesktopUpdate } from "@/stores/desktopUpdate";
import { multiTenantEnabled } from "@/stores/settings";
import { currentUser, publicWeb } from "@/stores/multiTenant";
import http from "@/lib/http";
import { isMobile } from "@/lib/platform";
import {
  IconSettings,
  IconPhotoVideo,
  IconBuildingStore,
  IconInfoCircle,
  IconCode,
  IconPlugConnected,
  IconUserCog,
  IconSubtitlesAi,
  IconDevices,
  IconNetwork,
  IconUserCircle,
  IconUsersGroup,
  IconBrandChrome,
  IconMessageCode,
  IconDots,
  IconChevronDown,
} from "@tabler/icons-vue";

const allSettingsPanels = [
  { id: "account", label: "Tài khoản và số dư", icon: IconUserCircle, component: defineAsyncComponent(() => import("./panels/account/index.vue")) },
  { id: "general", label: "Cài đặt chung", icon: IconSettings, component: defineAsyncComponent(() => import("./panels/general/index.vue")) },
  { id: "promptSettings", label: "Prompt", icon: IconMessageCode, component: defineAsyncComponent(() => import("./panels/promptSettings/index.vue")) },
  {
    id: "languageModel",
    label: "Mô hình văn bản",
    icon: IconSubtitlesAi,
    groupLabel: "Mô hình bên thứ ba",
    component: defineAsyncComponent(() => import("./panels/languageModel/index.vue")),
  },
  { id: "mediaModel", label: "Mô hình media", icon: IconPhotoVideo, component: defineAsyncComponent(() => import("./panels/mediaModel/index.vue")) },
  { id: "mac2Api", label: "Kết nối mac2API", icon: IconPlugConnected, component: defineAsyncComponent(() => import("./panels/mac2Api/index.vue")) },
  { id: "aiChrome", label: "AI chrome", icon: IconBrandChrome, component: defineAsyncComponent(() => import("./panels/aiChrome/index.vue")) },
  {
    id: "pluginMarket",
    label: "Chợ plugin",
    icon: IconBuildingStore,
    groupLabel: "Chợ plugin",
    component: defineAsyncComponent(() => import("./panels/pluginMarket/index.vue")),
  },
  { id: "mcp", label: "MCP", icon: IconPlugConnected, groupLabel: "Kết nối", component: defineAsyncComponent(() => import("./panels/mcp/index.vue")) },
  { id: "network", label: "Cài đặt mạng", icon: IconNetwork, component: defineAsyncComponent(() => import("./panels/network/index.vue")) },
  ...(!isMobile
    ? [{ id: "deviceLink", label: "Liên kết thiết bị", icon: IconDevices, component: defineAsyncComponent(() => import("./panels/deviceLink/index.vue")) }]
    : []),
  {
    id: "personalization",
    label: "Cá nhân hóa",
    icon: IconUserCog,
    groupLabel: "Khác",
    component: defineAsyncComponent(() => import("./panels/personalization/index.vue")),
  },
  { id: "developer", label: "Tùy chọn nhà phát triển", icon: IconCode, component: defineAsyncComponent(() => import("./panels/developer/index.vue")) },
  { id: "multiTenant", label: "Chức năng đa thuê bao", icon: IconUsersGroup, component: defineAsyncComponent(() => import("./panels/multiTenant/developmentNotice.vue")) },
  { id: "about", label: "Giới thiệu", icon: IconInfoCircle, component: defineAsyncComponent(() => import("./panels/about/index.vue")) },
];
const publicAccountPanel = { ...allSettingsPanels[0]!, get label() { return translate("账号"); } };
const settingsPanels = computed(() => allSettingsPanels.filter(item => {
  if (publicWeb.value && currentUser.value?.role === "user") return ["account", "general", "about"].includes(item.id);
  if (publicWeb.value && ["multiTenant", "deviceLink", "network", "mcp", "developer", "pluginMarket", "aiChrome", "mac2Api"].includes(item.id)) return false;
  return !multiTenantEnabled.value || !["languageModel", "mediaModel", "aiChrome", "mac2Api", "developer"].includes(item.id);
}).map(item => publicWeb.value && item.id === "account" ? publicAccountPanel : item));
const morePanelIds = new Set(["account", "aiChrome", "mcp", "network", "deviceLink", "developer", "multiTenant", "about"]);
const mainPanels = computed(() => settingsPanels.value.filter(item => !morePanelIds.has(item.id)));
const morePanels = computed(() => settingsPanels.value.filter(item => morePanelIds.has(item.id)));
const moreExpanded = ref(false);
const activePanel = shallowRef(mainPanels.value[0] ?? settingsPanels.value[0]!);
const visible = defineModel<boolean>({ default: false });

watch(settingsPanels, panels => {
  activePanel.value = panels.find(item => item.id === activePanel.value.id) ?? mainPanels.value[0] ?? panels[0]!;
  if (morePanelIds.has(activePanel.value.id)) moreExpanded.value = true;
});

function loggedOut() { window.location.reload(); }

function openPanel(id: string) {
  const panel = settingsPanels.value.find(item => item.id === id);
  if (!panel) return false;
  activePanel.value = panel;
  if (morePanelIds.has(id)) moreExpanded.value = true;
  visible.value = true;
  return true;
}

defineExpose({ openPanel });
</script>

<style lang="scss" scoped>
.settings {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  height: min(72vh, calc(100dvh - 140px));
  overflow: hidden;

  .sidebar {
    min-height: 0;
    overflow-y: auto;
    padding: 2px;

    .settingsGroupLabel {
      margin: 14px 12px 6px;
      color: var(--el-text-color-secondary);
      font-size: 12px;
      font-weight: 400;
      line-height: 1.5;
    }

    .settingsItem {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 10px 12px;
      margin-bottom: 4px;
      border: 0;
      border-radius: var(--el-border-radius-base);
      background: transparent;
      color: var(--el-text-color-regular);
      font: inherit;
      text-align: start;
      cursor: pointer;

      .panelIcon {
        display: inline-flex;
        flex-shrink: 0;
      }

      > span {
        min-width: 0;
        overflow-wrap: anywhere;
      }

      &:hover {
        background: var(--el-fill-color-light);
      }

      &[aria-pressed="true"] {
        background: var(--el-color-primary-light-9);
        color: var(--el-color-primary);
      }

      &:focus-visible {
        outline: 2px solid var(--el-color-primary);
      }
    }
    .moreToggle {
      .moreChevron {
        margin-left: auto;
        transition: transform 150ms ease;
        &.expanded { transform: rotate(180deg); }
      }
    }
    .morePanelList {
      padding-left: 8px;
      border-left: 1px solid var(--el-border-color-lighter);
      margin-left: 11px;
    }
  }

  .content {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0 20px;
    overflow: hidden;

    .panelTitle {
      flex-shrink: 0;
      margin: 0 0 20px;
      font-size: 18px;
    }

    .panelContent {
      flex: 1;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding-left: 5px;
      padding-right: 5px;
      padding-bottom: 50px;

      > :deep(.el-fade-in-enter-active),
      > :deep(.el-fade-in-leave-active) {
        transition-duration: 100ms;
      }
    }
  }

  @media (max-width: 700px) {
    grid-template-columns: 44px minmax(0, 1fr);

    .sidebar {
      .settingsGroupLabel {
        margin: 12px 0 6px;
        text-align: center;
      }

      .settingsItem {
        justify-content: center;
        padding: 12px;
        span {
          display: none;
        }
      }
      .moreToggle .moreChevron { display: none; }
      .morePanelList { padding-left: 0; margin-left: 0; border-left: 0; }
    }

    .content {
      padding: 0 8px 0 16px;
    }
  }
}
</style>
