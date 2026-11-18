<template>
  <div class="general">
    <ui />
    <section v-if="!publicWeb" class="settingSection" aria-labelledby="extensionAssociationsTitle">
      <div class="settingHeader">
        <div class="settingInfo">
          <h3 id="extensionAssociationsTitle">Cách mở mặc định</h3>
          <p class="description">Chọn tiện ích mặc định theo loại tệp.</p>
        </div>
          <el-button size="small" aria-label="Cấu hình cách mở mặc định" @click="associationsVisible = true">Cài đặt</el-button>
      </div>
    </section>
    <section class="settingSection" aria-labelledby="startupTitle">
      <div class="settingHeader">
        <div class="settingInfo">
          <h3 id="startupTitle">Hiệu ứng khởi động</h3>
          <p class="description">Phát hiệu ứng khi khởi động. Tắt có thể tăng tốc độ mở nhưng đôi khi gây nháy màn hình; có hiệu lực từ lần khởi động sau.</p>
        </div>
        <el-switch
          :modelValue="uiSettings.startupAnimation"
          aria-label="Hiệu ứng khởi động"
          @change="(value) => updateUiSettings({ startupAnimation: value === true })" />
      </div>
    </section>
    <section class="settingSection" aria-labelledby="agentNotificationsTitle">
      <div class="settingHeader">
        <div class="settingInfo">
          <h3 id="agentNotificationsTitle">Thông báo Agent</h3>
          <p class="description">
            Khi cửa sổ không hoạt động, Agent sẽ gửi thông báo khi trả lời xong hoặc chờ xác nhận.
            <template v-if="!actualPlatform.isDesktop && generalSettings.agentNotificationsEnabled">
              <template v-if="notificationPermission === 'default'">
                Trình duyệt cần được cấp quyền, <el-button class="permissionAction" link type="primary" :loading="requestingPermission" @click="authorizeNotifications">Nhấn để cấp quyền</el-button>.
              </template>
              <template v-else-if="notificationPermission === 'granted'">Trình duyệt đã được cấp quyền.</template>
              <template v-else-if="notificationPermission === 'denied'">Hãy cho phép thông báo trong cài đặt trang web của trình duyệt.</template>
              <template v-else-if="notificationPermission === 'insecure'">Thông báo trình duyệt yêu cầu HTTPS hoặc localhost.</template>
              <template v-else>Trình duyệt này không hỗ trợ thông báo hệ thống.</template>
            </template>
          </p>
        </div>
        <el-switch
          :modelValue="generalSettings.agentNotificationsEnabled"
          aria-label="Thông báo Agent"
          @change="(value) => updateGeneralSettings({ agentNotificationsEnabled: value === true })" />
      </div>
    </section>
    <section class="settingSection" aria-labelledby="canvasCompositingTitle">
      <div class="settingHeader">
        <div class="settingInfo">
          <h3 id="canvasCompositingTitle">Tối ưu dựng Canvas</h3>
          <p class="description">Tối ưu thao tác kéo và thu phóng khi có nhiều node. Có thể tăng sử dụng bộ nhớ đồ họa và gây mờ; áp dụng ngay.</p>
        </div>
        <el-switch
          :modelValue="generalSettings.canvasCompositingEnabled"
          aria-label="Tối ưu dựng Canvas"
          @change="(value) => updateGeneralSettings({ canvasCompositingEnabled: value === true })" />
      </div>
    </section>
    <section class="settingSection" aria-labelledby="canvasEdgeAnimationTitle">
      <div class="settingHeader">
        <div class="settingInfo">
          <h3 id="canvasEdgeAnimationTitle">Hiệu ứng dây nối node</h3>
          <p class="description">Khi chọn hoặc kéo node, các dây nối trực tiếp sẽ có hiệu ứng chuyển động. Tắt hiệu ứng vẫn giữ nổi bật; áp dụng ngay.</p>
        </div>
        <el-switch
          :modelValue="generalSettings.canvasEdgeAnimationEnabled"
          aria-label="Hiệu ứng dây nối node"
          @change="(value) => updateGeneralSettings({ canvasEdgeAnimationEnabled: value === true })" />
      </div>
    </section>
    <section class="settingSection" aria-labelledby="canvasEdgeColorTitle">
      <div class="settingHeader">
        <div class="settingInfo">
          <h3 id="canvasEdgeColorTitle">Màu nổi bật của dây nối node</h3>
          <p class="description">Đặt màu nổi bật cho các dây nối trực tiếp của node khi chọn hoặc kéo; áp dụng ngay.</p>
        </div>
        <div class="edgeColorControls">
          <el-select
            :modelValue="generalSettings.canvasEdgeColorMode"
            aria-label="Chế độ màu dây nối"
            @change="(value) => updateGeneralSettings({ canvasEdgeColorMode: value })">
            <el-option label="Không dùng màu nổi bật" value="none" />
            <el-option label="Theo màu chủ đề" value="theme" />
            <el-option label="Chọn màu tùy ý" value="custom" />
          </el-select>
          <el-color-picker
            v-if="generalSettings.canvasEdgeColorMode === 'custom'"
            :modelValue="generalSettings.canvasEdgeColor"
            colorFormat="hex"
            aria-label="Màu dây nối tùy chỉnh"
            @change="(value) => updateGeneralSettings({ canvasEdgeColor: value || defaultUiSettings.primaryColor })" />
        </div>
      </div>
    </section>
    <nodeMenuSettings />
    <canvasShortcuts />
    <extensionAssociationsDialog v-if="!publicWeb" v-model="associationsVisible" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { defaultUiSettings, generalSettings, uiSettings, updateGeneralSettings, updateUiSettings } from "@/stores/settings";
import { publicWeb } from "@/stores/multiTenant";
import { getNotificationPermission, requestNotificationPermission } from "@/lib/notification";
import { actualPlatform } from "@/lib/platform";
import ui from "./ui.vue";
import canvasShortcuts from "./canvasShortcuts.vue";
import nodeMenuSettings from "./nodeMenuSettings.vue";
import extensionAssociationsDialog from "./extensionAssociationsDialog.vue";

const associationsVisible = ref(false);
const notificationPermission = ref(getNotificationPermission());
const requestingPermission = ref(false);

function refreshNotificationPermission() {
  notificationPermission.value = getNotificationPermission();
}

async function authorizeNotifications() {
  if (requestingPermission.value) return;
  requestingPermission.value = true;
  try { notificationPermission.value = await requestNotificationPermission(); }
  catch { ElMessage.error("Không xin được quyền thông báo; hãy kiểm tra cài đặt trang web trong trình duyệt"); }
  finally { requestingPermission.value = false; }
}

onMounted(() => window.addEventListener("focus", refreshNotificationPermission));
onBeforeUnmount(() => window.removeEventListener("focus", refreshNotificationPermission));
</script>

<style lang="scss" scoped>
.general {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0 4px 8px;

  .settingSection {
    .settingHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;

      > .el-switch { flex-shrink: 0; }

      .edgeColorControls {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;

        .el-select { width: 140px; }
      }

      .settingInfo {
        min-width: 0;

        h3 {
          margin: 0;
          color: var(--el-text-color-primary);
          font-size: 14px;
          font-weight: 600;
        }

        .description {
          margin: 6px 0 0;
          color: var(--el-text-color-secondary);
          font-size: 12px;
          line-height: 1.6;

          .permissionAction {
            padding: 0;
            font-size: inherit;
            vertical-align: baseline;
          }
        }
      }
    }
  }
}
</style>
