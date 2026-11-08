<template>
  <el-dialog v-model="visible" :title="translate('设置')" width="min(1080px, calc(100vw - 32px))" alignCenter appendToBody>
    <div class="settings">
      <aside class="sidebar" :aria-label="translate('设置分类')">
        <template v-for="item in visibleSettingsPanels" :key="item.id">
          <h3 v-if="item.groupLabel" class="settingsGroupLabel">{{ item.groupLabel }}</h3>
          <button
            class="settingsItem"
            type="button"
            :aria-label="item.id === 'about' && hasDesktopUpdate ? `${item.label}，有新版本可用` : item.label"
            :aria-pressed="activePanel.id === item.id"
            @click="activePanel = item">
            <el-badge class="panelIcon" isDot :hidden="item.id !== 'about' || !hasDesktopUpdate">
              <component :is="item.icon" :size="18" aria-hidden="true" />
            </el-badge>
            <span>{{ item.label }}</span>
          </button>
        </template>
        <button v-if="independentMode && advancedPanels.length" class="settingsItem" type="button"
          :aria-expanded="showAdvanced" :aria-label="translate('Advanced settings')" :title="translate('Advanced settings')" @click="showAdvanced = !showAdvanced">
          <icon-settings :size="18" aria-hidden="true" />
          <span>{{ translate('Advanced settings') }} {{ showAdvanced ? '▴' : '▾' }}</span>
        </button>
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
                  ['account', 'pluginMarket', 'languageModel', 'mediaModel', 'personalization', 'deviceLink'].includes(activePanel.id) ? { visible } : {}
                " />
            </keep-alive>
          </transition>
        </div>
      </section>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { translate } from "@toonflow/i18n/vue";
import { computed, defineAsyncComponent, onMounted, ref, shallowRef, watch } from "vue";
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
} from "@tabler/icons-vue";
import { actualPlatform } from "@/lib/platform";

const allSettingsPanels = [
  { id: "account", label: "账号与余额", icon: IconUserCircle, component: defineAsyncComponent(() => import("./panels/account/index.vue")) },
  { id: "general", label: "通用设置", icon: IconSettings, component: defineAsyncComponent(() => import("./panels/general/index.vue")) },
  {
    id: "languageModel",
    label: "文本模型",
    icon: IconSubtitlesAi,
    groupLabel: "第三方模型",
    component: defineAsyncComponent(() => import("./panels/languageModel/index.vue")),
  },
  { id: "mediaModel", label: "媒体模型", icon: IconPhotoVideo, component: defineAsyncComponent(() => import("./panels/mediaModel/index.vue")) },
  { id: "chromeBridge", label: "AI Bridge · Chrome", icon: IconPlugConnected,
    component: defineAsyncComponent(() => import("./panels/chromeBridge/index.vue")) },
  {
    id: "pluginMarket",
    label: "插件市场",
    icon: IconBuildingStore,
    groupLabel: "市场",
    component: defineAsyncComponent(() => import("./panels/pluginMarket/index.vue")),
  },
  { id: "mcp", label: "MCP", icon: IconPlugConnected, groupLabel: "通讯", component: defineAsyncComponent(() => import("./panels/mcp/index.vue")) },
  { id: "network", label: "网络设置", icon: IconNetwork, component: defineAsyncComponent(() => import("./panels/network/index.vue")) },
  ...(!isMobile
    ? [{ id: "deviceLink", label: "设备互联", icon: IconDevices, component: defineAsyncComponent(() => import("./panels/deviceLink/index.vue")) }]
    : []),
  {
    id: "personalization",
    label: "个性化",
    icon: IconUserCog,
    groupLabel: "其他",
    component: defineAsyncComponent(() => import("./panels/personalization/index.vue")),
  },
  { id: "developer", label: "开发者选项", icon: IconCode, component: defineAsyncComponent(() => import("./panels/developer/index.vue")) },
  { id: "multiTenant", label: "多租户能力", icon: IconUsersGroup, component: defineAsyncComponent(() => import("./panels/multiTenant/developmentNotice.vue")) },
  { id: "about", label: "关于", icon: IconInfoCircle, component: defineAsyncComponent(() => import("./panels/about/index.vue")) },
];
const publicAccountPanel = { ...allSettingsPanels[0]!, get label() { return translate("账号"); } };
const localWebBridgeAvailable = ref(false);
const independentMode = computed(() => !publicWeb.value && import.meta.env.VITE_TOONFLOW_LEGACY_UI !== "1");
const showAdvanced = ref(false);
const advancedIds = new Set(["mcp", "pluginMarket", "developer", "network", "deviceLink", "multiTenant", "personalization"]);
onMounted(async () => {
  if (actualPlatform.isLocalDesktop || !actualPlatform.isMac || publicWeb.value) return;
  try {
    const response = await fetch("/api/desktop/chromeBridge/status", {
      cache: "no-store", headers: { "x-toonflow-desktop": "1", "x-toonflow-workspace": "1" },
    });
    if (response.ok) {
      const body = await response.json();
      localWebBridgeAvailable.value = body?.code === 200 && body?.data?.enabled === true;
    }
  } catch { /* Unavailable public or non-loopback Web server: keep remote controls hidden. */ }
});
const settingsPanels = computed(() => allSettingsPanels.filter(item => {
  if (independentMode.value && item.id === "account") return false;
  if (item.id === "chromeBridge" && !(actualPlatform.isLocalDesktop && actualPlatform.isMac
      || localWebBridgeAvailable.value && actualPlatform.isMac && !publicWeb.value)) return false;
  // The upstream commercial plugin marketplace is not part of the independent local distribution.
  if (item.id === "pluginMarket" && !publicWeb.value) return false;
  if (publicWeb.value && currentUser.value?.role === "user") return ["account", "general", "about"].includes(item.id);
  if (publicWeb.value && ["multiTenant", "deviceLink", "network", "mcp", "developer", "pluginMarket"].includes(item.id)) return false;
  return !multiTenantEnabled.value || !["languageModel", "mediaModel", "developer"].includes(item.id);
}).map(item => publicWeb.value && item.id === "account" ? publicAccountPanel : item));
const advancedPanels = computed(() => settingsPanels.value.filter(item => advancedIds.has(item.id)));
const visibleSettingsPanels = computed(() => !independentMode.value ? settingsPanels.value
  : [...settingsPanels.value.filter(item => !advancedIds.has(item.id)), ...(showAdvanced.value ? advancedPanels.value : [])]);
const activePanel = shallowRef(settingsPanels.value.find(item => item.id === "general") ?? settingsPanels.value[0]!);
const visible = defineModel<boolean>({ default: false });

watch(settingsPanels, panels => {
  activePanel.value = panels.find(item => item.id === activePanel.value.id) ?? panels[0]!;
});

function loggedOut() { window.location.reload(); }

function openPanel(id: string) {
  const panel = settingsPanels.value.find(item => item.id === id);
  if (!panel) return false;
  activePanel.value = panel;
  if (advancedIds.has(id)) showAdvanced.value = true;
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
      .settingsGroupLabel { display: none; }

      .settingsItem {
        justify-content: center;
        padding: 12px;
        span {
          display: none;
        }
      }
    }

    .content {
      padding: 0 8px 0 16px;
    }
  }
}
</style>
