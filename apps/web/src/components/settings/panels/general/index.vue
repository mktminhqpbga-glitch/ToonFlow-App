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
    <section v-if="!publicWeb" class="settingSection" aria-labelledby="projectBackupTitle">
      <div class="settingHeader">
        <div class="settingInfo">
          <h3 id="projectBackupTitle">Sao lưu và khôi phục dự án</h3>
          <p class="description">{{ project ? `Dự án đang mở · ${project.name}` : "Hãy mở một dự án để sao lưu." }}</p>
          <p class="description">Tệp ZIP chứa dữ liệu trong thư mục dự án. Khi khôi phục, MacFlow mở một bản dự án mới và giữ nguyên thư mục hiện tại.</p>
        </div>
        <div class="backupActions">
          <el-button size="small" :disabled="!project || restoring" :loading="exporting" @click="backupProject">Sao lưu dữ liệu</el-button>
          <el-button size="small" :disabled="exporting" :loading="restoring" @click="restoreInput?.click()">Khôi phục dữ liệu</el-button>
        </div>
        <input ref="restoreInput" type="file" accept=".zip,application/zip" hidden @change="restoreProject" />
      </div>
    </section>
    <nodeMenuSettings />
    <canvasShortcuts />
    <extensionAssociationsDialog v-if="!publicWeb" v-model="associationsVisible" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import axios from "axios";
import { defaultUiSettings, generalSettings, uiSettings, updateGeneralSettings, updateUiSettings } from "@/stores/settings";
import { publicWeb } from "@/stores/multiTenant";
import { getNotificationPermission, requestNotificationPermission } from "@/lib/notification";
import { actualPlatform } from "@/lib/platform";
import { useWorkspaceStore } from "@/stores/workspace";
import { exportWorkspace } from "@/lib/exportWorkspace";
import { restoreWorkspaceBackup } from "@/lib/workspaceFiles";
import ui from "./ui.vue";
import canvasShortcuts from "./canvasShortcuts.vue";
import nodeMenuSettings from "./nodeMenuSettings.vue";
import extensionAssociationsDialog from "./extensionAssociationsDialog.vue";

const associationsVisible = ref(false);
const notificationPermission = ref(getNotificationPermission());
const requestingPermission = ref(false);
const workspace = useWorkspaceStore();
const project = computed(() => workspace.project);
const exporting = ref(false);
const restoring = ref(false);
const restoreInput = ref<HTMLInputElement>();
const lifetime = new AbortController();

async function backupProject() {
  if (!project.value || exporting.value) return;
  exporting.value = true;
  try {
    if (await exportWorkspace(project.value, lifetime.signal)) ElMessage.success("Đã xuất bản sao dự án.");
  } catch (cause) {
    if (!lifetime.signal.aborted) ElMessage.error(cause instanceof Error ? cause.message : "Không sao lưu được dự án.");
  } finally { exporting.value = false; }
}

async function restoreProject(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || restoring.value || exporting.value) return;
  if (!/\.zip$/i.test(file.name) || file.size > 1024 ** 3) {
    ElMessage.warning("Hãy chọn tệp sao lưu ZIP tối đa 1 GB.");
    return;
  }
  const current = project.value?.directory;
  const accepted = await ElMessageBox.confirm(
    `MacFlow sẽ mở bản sao từ “${file.name}” làm dự án hiện tại. Dữ liệu đang có vẫn nằm trong thư mục cũ.`,
    "Khôi phục dữ liệu?", { confirmButtonText: "Khôi phục", cancelButtonText: "Hủy", type: "warning" },
  ).then(() => true, () => false);
  if (!accepted || lifetime.signal.aborted || restoring.value || current !== project.value?.directory) return;
  restoring.value = true;
  try {
    const directory = await restoreWorkspaceBackup(file);
    const name = `${file.name.slice(0, -4)} (khôi phục)`;
    if (!lifetime.signal.aborted && current === project.value?.directory) {
      await workspace.openProject(directory);
      workspace.renameProject(directory, name);
      ElMessage.success("Đã khôi phục và mở dự án.");
    } else {
      await workspace.addProject(directory, name);
      ElMessage.success("Đã khôi phục dự án. Bạn có thể mở trong danh sách Dự án.");
    }
  } catch (cause) {
    const message = axios.isAxiosError<{ message?: string }>(cause) ? cause.response?.data?.message : cause instanceof Error ? cause.message : undefined;
    ElMessage.error(message || "Chưa khôi phục được dự án. Hãy kiểm tra tệp ZIP rồi thử lại.");
  } finally { restoring.value = false; }
}

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
onBeforeUnmount(() => {
  lifetime.abort();
  window.removeEventListener("focus", refreshNotificationPermission);
});
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
      flex-wrap: wrap;
      gap: 12px;

      > .el-switch { flex-shrink: 0; }
      .backupActions { display: flex; flex-wrap: wrap; gap: 8px; }
      .backupActions :deep(.el-button) { margin-left: 0; }

      .edgeColorControls {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;

        .el-select { width: 140px; }
      }

      .settingInfo {
        flex: 1 1 220px;
        min-width: 0;
        overflow-wrap: anywhere;

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
            height: auto;
            line-height: inherit;
            white-space: normal;
            vertical-align: baseline;
          }
        }
      }
    }
  }
}
</style>
