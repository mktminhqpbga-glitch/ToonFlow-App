<template>
  <div class="about">
    <div class="brand">
      <div class="brandMark"><img class="brandLogo" :src="logoUrl" alt="MacFlow" /></div>
      <div class="brandInfo">
        <h3>MacFlow</h3>
        <div class="brandMeta">
          <span v-if="currentVersion">v{{ currentVersion }}</span>
          <el-tag v-if="clientBuild?.channel || snapshot?.channel" type="info" size="small" round>{{ clientBuild?.channel || snapshot?.channel }}</el-tag>
        </div>
      </div>
    </div>

    <el-card v-if="!publicWeb && !actualPlatform.isDesktop && !isMobile" class="infoCard updateCard" shadow="never">
      <div class="cardHeader">
        <div class="cardLabel">
          <icon-refresh :size="18" aria-hidden="true" />
          <span>Cập nhật phiên bản web</span>
        </div>
        <div v-if="macFlowUpdate" class="updateActions">
          <el-button size="small" plain :loading="macFlowUpdate.phase === 'checking'" :disabled="webUpdateBusy" @click="changeMacFlowUpdate({ type: 'check' })">
            Kiểm tra cập nhật
          </el-button>
          <el-button v-if="macFlowUpdate.latest && macFlowUpdate.latest !== macFlowUpdate.current" size="small" type="primary"
            :loading="macFlowUpdate.phase === 'building' || macFlowUpdate.phase === 'restarting'" :disabled="webUpdateBusy" @click="changeMacFlowUpdate({ type: 'install' })">
            Cài bản mới nhất
          </el-button>
        </div>
        <el-button v-else tag="a" size="small" type="primary" plain :href="webUpdateGuide" target="_blank" rel="noopener noreferrer">
          Hướng dẫn cập nhật
        </el-button>
      </div>
      <template v-if="macFlowUpdate">
        <div class="autoUpdateSetting">
          <span>Tự động cài bản mới</span>
          <el-switch size="small" :modelValue="macFlowUpdate.automatic" :disabled="macFlowUpdatePending || macFlowUpdate.phase === 'restarting'"
            aria-label="Tự động cài bản mới" @change="(value) => changeMacFlowUpdate({ type: 'automatic', enabled: value === true })" />
        </div>
        <p class="webUpdateHint" role="status">{{ webUpdateMessage }}</p>
      </template>
      <p v-else class="webUpdateHint">Cập nhật trên máy đang chạy MacFlow, khởi động lại ứng dụng rồi tải lại trang này.</p>
      <div v-if="macFlowUpdate?.current || webRevision" class="buildInfo"><span>Mã bản dựng</span><code>{{ macFlowUpdate?.current || webRevision }}</code></div>
    </el-card>
    <el-card v-else-if="!publicWeb && (isMobile || !isRemoteConnection)" class="infoCard updateCard" shadow="never">
      <div class="cardHeader">
        <div class="updateCopy">
          <div class="cardLabel">
            <icon-refresh :size="18" aria-hidden="true" />
            <span>Cập nhật phiên bản</span>
          </div>
        </div>
        <div class="updateActions">
          <el-button v-if="isMobile" tag="a" size="small" type="primary" plain :href="`${repositoryUrl}/releases/latest`" target="_blank" rel="noopener noreferrer">
            Xem bản cập nhật trên GitHub
          </el-button>
          <template v-else>
            <el-select :modelValue="updateSource" aria-label="Nguồn cập nhật" size="small" :disabled="working || sourceSaving" @change="saveUpdateSource">
              <template #prefix>
                <icon-brand-github v-if="updateSource === 'github'" :size="14" aria-hidden="true" />
                <icon-world v-else :size="14" aria-hidden="true" />
              </template>
              <el-option label="Nguồn chính thức" value="official" />
              <el-option label="GitHub" value="github" />
              <el-option v-if="customUpdateUrl" label="Nguồn tùy chỉnh" value="custom" />
            </el-select>
            <el-badge isDot :hidden="!hasDesktopUpdate">
              <el-button size="small" type="primary" plain :loading="checking" :disabled="sourceSaving" @click="openUpdate">
                {{ snapshot?.installFailure ? "Xem nguyên nhân cập nhật thất bại" : snapshot?.updateReady ? "Bản cập nhật đã sẵn sàng" : snapshot?.updating || action === "download" ? "Xem tiến độ cập nhật" : "Kiểm tra cập nhật" }}
              </el-button>
            </el-badge>
          </template>
        </div>
      </div>
      <div v-if="isLocalDesktop" class="autoUpdateSetting">
        <span>Tự động cập nhật</span>
        <el-switch :modelValue="desktopAutoUpdate" size="small" :loading="autoUpdateSaving" :disabled="!actualPlatform.isLocalDesktop" aria-label="Tự động cập nhật" @change="(value) => saveAutoUpdate(value === true)" />
      </div>
      <div v-if="!isMobile && snapshot?.hash" class="buildInfo">
        <span>Mã bản dựng</span>
        <code>{{ snapshot.hash }}</code>
      </div>
      <div v-if="!isMobile && snapshot?.installFailure" class="installFailureNotice" role="alert">
        <strong>Lần cập nhật trước thất bại</strong>
        <p>{{ snapshot.installFailure.message }}</p>
        <p>Hãy mở trang phát hành mới nhất trên GitHub, tải bộ cài đầy đủ phù hợp với hệ điều hành, đóng ứng dụng rồi cài lại.</p>
        <el-button tag="a" type="primary" size="small" :href="snapshot.installFailure.downloadUrl" target="_blank" rel="noopener noreferrer">Đến trang tải xuống</el-button>
      </div>
    </el-card>

    <el-card class="infoCard repositoryCard" shadow="never">
      <a class="repositoryLink" :href="`${macflowRepository}/tree/${macflowBranch}`" target="_blank" rel="noopener noreferrer" aria-label="Kho mã nguồn MacFlow trên GitHub">
        <icon-brand-github class="repositoryIcon" :size="22" aria-hidden="true" />
        <div class="repositoryInfo">
          <span class="repositoryTitle">Kho mã nguồn MacFlow</span>
        </div>
        <icon-external-link class="externalIcon" :size="16" aria-hidden="true" />
      </a>
    </el-card>

    <el-card class="infoCard" shadow="never">
      <div class="cardHeader">
        <div class="cardLabel">
          <icon-brand-wechat :size="20" aria-hidden="true" />
          <span>Nhóm trao đổi WeChat</span>
        </div>
        <el-popover trigger="click" placement="top" title="Quét mã WeChat để tham gia nhóm trao đổi" :width="196">
          <template #reference>
            <el-button size="small" :icon="IconQrcode">Hiển thị mã QR</el-button>
          </template>
          <q-r-code
            :value="communityUrl"
            :size="168"
            type="svg"
            color="#000000"
            bgColor="#ffffff"
            borderless
            role="img"
            aria-label="Mã QR nhóm trao đổi Toonflow" />
          <div class="tips">
            Toonflow là dự án mã nguồn mở được phát triển từ niềm đam mê. Rất mong mọi người trao đổi lịch sự và góp ý thiện chí. Phản hồi có thể mất thời gian; cảm ơn bạn đã thông cảm và tôn trọng nhau.
          </div>
        </el-popover>
      </div>
    </el-card>

    <el-card class="infoCard" shadow="never">
      <div class="cardHeader">
        <div class="cardLabel">
          <icon-shield-lock :size="20" aria-hidden="true" />
          <span>Quyền riêng tư</span>
        </div>
        <el-button size="small" aria-haspopup="dialog" @click="privacyVisible = true">Xem</el-button>
      </div>
    </el-card>

    <section class="sponsorPanel" aria-label="Nhà tài trợ">
      <h3 class="sponsorTitle">
        <icon-gift :size="20" aria-hidden="true" />
        Nhà tài trợ
        <span class="sponsorHint">Không xếp theo thứ tự ưu tiên</span>
        <el-popover trigger="click" placement="top" title="Quét mã WeChat để trao đổi hợp tác" :width="196">
          <template #reference>
            <el-button class="sponsorContact" size="small" type="primary" link>Trở thành nhà tài trợ</el-button>
          </template>
          <q-r-code
            value="https://work.weixin.qq.com/u/vc0f54596c5837d05a?v=5.0.8.70675"
            :size="168"
            type="svg"
            color="#000000"
            bgColor="#ffffff"
            borderless
            role="img"
            aria-label="Mã QR hợp tác Toonflow" />
        </el-popover>
      </h3>
      <div v-if="sponsors.length" class="sponsorGrid" @keydown.esc="closeSponsor">
        <el-popover
          v-for="sponsor in sponsors"
          :key="sponsor.id"
          role="dialog"
          placement="top-start"
          :title="sponsor.name"
          width="min(360px, calc(100vw - 32px))"
          :visible="activeSponsorId === sponsor.id"
          :hideAfter="0"
          :persistent="false"
          @update:visible="(visible) => setSponsorVisible(sponsor.id, visible)">
          <template #reference>
            <button class="sponsorEntry" type="button" :aria-label="`Xem ${sponsor.name} - chi tiết`">
              <span v-if="sponsor.logoUrl" class="sponsorLogo"><img :src="sponsor.logoUrl" :alt="`${sponsor.name} logo`" /></span>
              <span class="sponsorName">{{ sponsor.name }}</span>
            </button>
          </template>
          <messageMarkdown v-if="sponsor.readme.trim()" class="sponsorReadme" :content="sponsor.readme" @keydown.esc="closeSponsor" />
        </el-popover>
      </div>
    </section>

    <el-dialog v-model="privacyVisible" title="Quyền riêng tư" width="min(660px, calc(100vw - 32px))" alignCenter appendToBody destroyOnClose>
      <privacy />
    </el-dialog>

    <el-dialog v-model="resultVisible" title="Cập nhật phiên bản" width="min(480px, 92vw)" alignCenter appendToBody>
      <div class="updateResult" aria-live="polite" :aria-busy="working">
        <div class="resultHeader">
          <span class="resultIcon" :class="{ warning: !!updateError, success: !working && !updateError && !snapshot?.updateAvailable }">
            <icon-refresh v-if="working" class="loadingIcon" :size="22" aria-hidden="true" />
            <icon-alert-circle v-else-if="updateError" :size="22" aria-hidden="true" />
            <icon-arrow-up-circle v-else-if="snapshot?.updateAvailable" :size="22" aria-hidden="true" />
            <icon-circle-check v-else :size="22" aria-hidden="true" />
          </span>
          <div class="resultCopy">
            <h3>{{ resultTitle }}</h3>
            <p>{{ resultMessage }}</p>
          </div>
        </div>
        <div
          v-if="!updateError && !snapshot?.installFailure && (action === 'download' || updateProgress || (snapshot?.updateReady && !updateInProgress))"
          class="updateProgress">
          <div v-if="updateInProgress" class="progressHeader">
            <span>{{ updateProgress?.phase === "preparing" ? "Đang giải nén và xác minh gói cập nhật" : "Tiến độ tải" }}</span>
            <span v-if="updateProgress && (updateProgress.received > 0 || updateProgress.total)">
              {{ formatBytes(updateProgress.received) }}<template v-if="updateProgress.total"> / {{ formatBytes(updateProgress.total) }}</template>
            </span>
          </div>
          <el-progress
            v-if="updateProgress?.total || (!updateInProgress && snapshot?.updateReady)"
            :percentage="updatePercentage"
            :status="!updateInProgress && snapshot?.updateReady ? 'success' : undefined" />
        </div>
        <div v-if="!checking && !updateError && snapshot?.updateAvailable" class="releaseInfo">
          <div class="versionComparison">
            <div class="versionItem">
              <span>Phiên bản hiện tại</span>
              <strong>v{{ currentVersion }}</strong>
            </div>
            <icon-arrow-right class="versionArrow" :size="18" aria-hidden="true" />
            <div class="versionItem latestVersion">
              <span>Phiên bản mới nhất</span>
              <strong>v{{ snapshot.latestVersion }}</strong>
            </div>
          </div>
          <div v-if="snapshot.channel || snapshot.latestHash" class="releaseMeta">
            <el-tag v-if="snapshot.channel" type="info" size="small" round>{{ snapshot.channel }}</el-tag>
            <code v-if="snapshot.latestHash" :title="snapshot.latestHash">{{ snapshot.latestHash }}</code>
          </div>
        </div>
      </div>
      <template #footer>
          <el-button size="small" @click="resultVisible = false">Đóng</el-button>
        <el-button v-if="updateError && !snapshot?.installFailure && !updateInProgress" tag="a" size="small" :href="`${repositoryUrl}/releases/latest`" target="_blank" rel="noopener noreferrer">Đến trang tải xuống</el-button>
        <el-button v-if="snapshot?.installFailure" tag="a" type="primary" size="small" :href="snapshot.installFailure.downloadUrl" target="_blank" rel="noopener noreferrer">Đến trang tải xuống</el-button>
        <el-button v-else-if="snapshot?.updating && !working" size="small" type="primary" @click="runUpdate('read')">Đọc lại trạng thái</el-button>
        <el-button
          v-else-if="snapshot?.canUpdate && snapshot.updateAvailable"
          size="small"
          :type="snapshot.updateReady ? 'danger' : 'primary'"
          :loading="working"
          @click="runUpdate(snapshot.updateReady ? 'apply' : 'download')">
          {{ snapshot.updateReady ? "Khởi động lại và cập nhật" : "Tải bản cập nhật" }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { translate, t } from "@toonflow/i18n/vue";

import { computed, defineAsyncComponent, onMounted, onBeforeUnmount, ref } from "vue";
import { publicWeb } from "@/stores/multiTenant";
import axios from "axios";
import { ElMessage } from "element-plus";
import { actualPlatform, isMobile, isLocalDesktop, isRemoteConnection } from "@/lib/platform";
import { QRCode } from "tdesign-vue-next";
import {
  IconRefresh,
  IconBrandGithub,
  IconExternalLink,
  IconAlertCircle,
  IconArrowUpCircle,
  IconCircleCheck,
  IconArrowRight,
  IconGift,
  IconBrandWechat,
  IconQrcode,
} from "@tabler/icons-vue";
import logoUrl from "@toonflow/assets/logo.svg";
import type { Sponsor } from "@toonflow/server/channel";
import http from "@/lib/http";
import { saveSettings } from "@/stores/settings";
import { changeMacFlowUpdate, macFlowUpdate, macFlowUpdateError, macFlowUpdatePending } from "@/stores/macFlowUpdate";
import {
  desktopAutoUpdate,
  desktopUpdateSource as updateSource,
  desktopUpdateCustomUrl as customUpdateUrl,
  desktopUpdateSnapshot as snapshot,
  desktopUpdateError as updateError,
  desktopUpdateAction as action,
  desktopUpdateChecking,
  hasDesktopUpdate,
  runDesktopUpdate,
  startDesktopUpdate,
} from "@/stores/desktopUpdate";

const messageMarkdown = defineAsyncComponent(() => import("@/components/messageMarkdown.vue"));
const privacy = defineAsyncComponent(() => import("./privacy.vue"));
const repositoryUrl = "https://github.com/HBAI-Ltd/Toonflow-app";
const macflowRepository = "https://github.com/mktminhqpbga-glitch/ToonFlow-App";
const macflowBranch = "feat/macflow-media-studios";
const webUpdateGuide = `${macflowRepository}/blob/${macflowBranch}/docs/macFlowDevelopment.md#chạy-macflow-từ-repo`;
const webRevision = import.meta.env.macflowRevision as string;
const webUpdateBusy = computed(() => macFlowUpdatePending.value || ["checking", "building", "restarting"].includes(macFlowUpdate.value?.phase ?? ""));
const webUpdateMessage = computed(() => {
  const state = macFlowUpdate.value;
  if (!state) return "";
  if (macFlowUpdateError.value || state.message) return macFlowUpdateError.value || state.message;
  return {
    idle: state.latest ? "Bạn đang dùng bản mới nhất." : "MacFlow sẽ kiểm tra bản mới trên GitHub.",
    checking: "Đang kiểm tra bản mới trên GitHub…",
    available: `Đã có bản mới ${state.latest?.slice(0, 12) ?? ""}.`,
    building: "Đang tải và chuẩn bị bản mới. Bạn có thể tiếp tục làm việc.",
    waiting: "Bản mới đã sẵn sàng. MacFlow đang chờ tác vụ hiện tại hoàn tất.",
    restarting: "Đang khởi động lại. Trang sẽ tự tải lại khi phiên bản mới sẵn sàng.",
    error: "Chưa hoàn tất cập nhật. Hãy thử lại.",
  }[state.phase];
});
const communityUrl = "https://work.weixin.qq.com/u/vc36adcc89845edcbe?v=5.0.3.63936&bb=85b8d228e8";
const clientBuild = ref<{ version: string; channel: string }>();
const currentVersion = computed(() => actualPlatform.isDesktop && actualPlatform.isRemoteConnection
  ? clientBuild.value?.version || "" : snapshot.value?.version || import.meta.env.appVersion);
const sourceSaving = ref(false);
const autoUpdateSaving = ref(false);
const checking = computed(() => desktopUpdateChecking.value);
const working = computed(() => !!action.value);
const updateInProgress = computed(() => working.value || !!snapshot.value?.updating);
const updateProgress = computed(() => snapshot.value?.updateProgress);
const updatePercentage = computed(() => !updateInProgress.value && snapshot.value?.updateReady ? 100
  : updateProgress.value?.total ? Math.min(100, Math.floor(updateProgress.value.received / updateProgress.value.total * 100)) : 0);
const resultVisible = ref(false);
const privacyVisible = ref(false);
const activeSponsorId = ref<number>();
const controller = new AbortController();
const resultTitle = computed(() => {
  if (snapshot.value?.installFailure) return translate("上次更新未成功");
  if (updateError.value) return translate("更新未完成");
  if (checking.value) return translate("正在检查更新");
  if (action.value === "read") return translate("正在读取更新状态");
  if (action.value === "apply") return translate("正在重启并更新");
  if (working.value) return translate("正在准备更新");
  if (snapshot.value?.updateReady) return translate("更新已准备完成");
  return snapshot.value?.updateAvailable ? translate("发现新版本") : translate("暂无更新");
});
const resultMessage = computed(() => {
  if (snapshot.value?.installFailure) return snapshot.value.installFailure.message;
  if (updateError.value) return updateError.value;
  if (checking.value) return translate("正在获取最新版本信息…");
  if (action.value === "read") return translate("正在确认客户端的更新状态，请稍候…");
  if (action.value === "apply") return translate("客户端即将关闭，更新完成后会自动重新打开。");
  if (working.value) return translate("正在下载并校验更新包，可以关闭此弹窗继续使用。");
  if (snapshot.value?.updateReady) return translate("点击“重启并更新”安装新版本，请先完成正在进行的任务。");
  if (!snapshot.value?.updateAvailable) return t`当前已是最新版本 v${currentVersion.value}`;
  return snapshot.value.canUpdate ? translate("有新的版本可用，下载完成后可重启更新。") : translate("当前客户端不支持应用内更新，请下载安装包。");
});

const sponsors = ref<Sponsor[]>([]);

onMounted(async () => {
  try {
    sponsors.value = await http<Sponsor[]>({ method: "GET", url: "/api/channel/community/getSponsorList", signal: controller.signal });
  } catch (error) {
    if (!controller.signal.aborted) ElMessage.error(getUpdateError(error));
  }
});

onMounted(async () => {
  if (!actualPlatform.isDesktop) return;
  try {
    if (actualPlatform.isRemoteConnection) {
      const { data } = await axios.get<{ data: { version: string; channel: string } }>("/api/desktop/update", { signal: controller.signal, timeout: 10000 });
      clientBuild.value = data.data;
      return;
    }
    await runDesktopUpdate("read");
  } catch {
    // ACT: 本机版本读取失败不阻塞关于页；远程页面的构建版本不冒充客户端版本。
  }
});
onBeforeUnmount(() => controller.abort());

function setSponsorVisible(id: number, visible: boolean) {
  if (visible || activeSponsorId.value === id) activeSponsorId.value = visible ? id : undefined;
}

function closeSponsor(event: KeyboardEvent) {
  if (!activeSponsorId.value) return;
  event.stopPropagation();
  activeSponsorId.value = undefined;
}

function openUpdate() {
  resultVisible.value = true;
  if (working.value || snapshot.value?.updateReady || snapshot.value?.installFailure) return;
  void runUpdate("check");
}

async function saveUpdateSource(source: string) {
  if (actualPlatform.isRemoteConnection) return;
  if (source === updateSource.value || sourceSaving.value || working.value) return;
  if (source !== "official" && source !== "github" && (source !== "custom" || !customUpdateUrl.value)) return;
  sourceSaving.value = true;
  try {
    await saveSettings(() => ({ desktopUpdateSource: source }));
  } catch (error) {
    ElMessage.error(getUpdateError(error));
  } finally {
    sourceSaving.value = false;
  }
}

async function saveAutoUpdate(enabled: boolean) {
  if (!actualPlatform.isLocalDesktop || autoUpdateSaving.value || enabled === desktopAutoUpdate.value) return;
  autoUpdateSaving.value = true;
  try {
    await saveSettings(() => ({ desktopAutoUpdate: enabled }));
    if (enabled) void startDesktopUpdate().catch(() => {});
  } catch (error) {
    ElMessage.error(getUpdateError(error));
  } finally {
    autoUpdateSaving.value = false;
  }
}

function getUpdateError(error: unknown) {
  return axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || error.message : String(error);
}

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

async function runUpdate(nextAction: "read" | "check" | "download" | "apply") {
  if (working.value || sourceSaving.value) return;
  updateError.value = "";
  try {
    await runDesktopUpdate(nextAction);
    if (snapshot.value?.channel === "dev") updateError.value = "Phiên bản dành cho phát triển không hỗ trợ kiểm tra cập nhật; hãy dùng ứng dụng desktop phát hành chính thức.";
  } catch {
    // 错误与交接状态由全局 Store 保留，关闭面板不取消更新观察。
  }
}
</script>

<style lang="scss" scoped>
.webUpdateHint {
  margin: 12px 0 0;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.about {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 4px 0 12px;

    .brandMark {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 60px;
      height: 60px;
      border-radius: calc(var(--ui-radius) * 1.5);
      background: var(--el-fill-color-light);

      .brandLogo {
        width: 42px;
        height: 42px;
        object-fit: contain;

        .dark & {
          filter: invert(1);
        }
      }
    }

    .brandInfo {
      min-width: 0;

      h3 {
        margin: 0 0 8px;
        color: var(--el-text-color-primary);
        font-size: 20px;
        font-weight: 600;
      }

      .brandMeta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        color: var(--el-text-color-secondary);
        font-size: 12px;
      }
    }
  }

  .infoCard {
    min-width: 0;
    border-radius: calc(var(--ui-radius) * 1);

    :deep(.el-card__body) {
      padding: 14px;
    }

    .cardHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;

      .cardLabel {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--el-text-color-primary);
        font-size: 14px;
        font-weight: 600;
      }
    }

    &.updateCard {
      .autoUpdateSetting {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-top: 8px;
        color: var(--el-text-color-primary);
        font-size: 13px;
      }

      .cardHeader {
        .updateCopy {
          flex: 1;
          min-width: 120px;

          .cardDescription {
            margin-top: 4px;
          }
        }

        .updateActions {
          display: flex;
          align-items: center;
          gap: 8px;

          a {
            text-decoration: none;
          }

          :deep(.el-select) {
            width: 120px;
          }
        }
      }
    }

    .buildInfo {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 8px 12px;
      margin-top: 12px;
      color: var(--el-text-color-secondary);
      font-size: 12px;

      code {
        overflow-wrap: anywhere;
      }
    }

    .installFailureNotice {
      margin-top: 14px;
      padding: 12px;
      border-radius: var(--ui-radius);
      background: var(--el-color-danger-light-9);

      strong { color: var(--el-color-danger); }
      p { margin: 8px 0 12px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
    }

    &.repositoryCard {
      transition: border-color 0.2s;

      :deep(.el-card__body) {
        padding: 0;
      }
      &:hover {
        border-color: var(--el-border-color-darker);
      }

      .repositoryLink {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px;
        color: var(--el-text-color-primary);
        text-decoration: none;

        &:focus-visible {
          outline: 2px solid var(--el-color-primary);
          outline-offset: -2px;
          border-radius: calc(var(--ui-radius) * 1);
        }

        .repositoryIcon,
        .externalIcon {
          flex-shrink: 0;
        }
        .externalIcon {
          color: var(--el-text-color-secondary);
        }

        .repositoryInfo {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 6px;
          min-width: 0;

          .repositoryTitle {
            font-size: 14px;
            font-weight: 600;
          }
        }
      }
    }
  }

  .sponsorPanel {
    margin-top: 8px;
    min-width: 0;

    .sponsorTitle {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 8px;
      color: var(--el-text-color-primary);
      font-size: 16px;
      font-weight: 600;

      .sponsorHint {
        color: var(--el-text-color-secondary);
        font-size: 12px;
        font-weight: 400;
      }

      .sponsorContact {
        margin-left: auto;
      }
    }

    .sponsorGrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 110px), 1fr));
      gap: 6px;

      .sponsorEntry {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        height: 48px;
        padding: 7px 8px;
        border: 1px solid var(--el-border-color-lighter);
        border-radius: var(--ui-radius);
        background: var(--el-bg-color);
        color: var(--el-text-color-primary);
        font: inherit;
        text-align: left;
        cursor: pointer;

        &:hover,
        &[aria-expanded="true"] {
          border-color: var(--el-border-color-darker);
          background: var(--el-fill-color-light);
        }

        &:focus-visible {
          outline: 2px solid var(--el-color-primary);
          outline-offset: 2px;
        }

        .sponsorLogo {
          display: block;
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          padding: 4px;
          box-sizing: border-box;
          border-radius: var(--ui-radius);
          background: #fff;

          img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
        }

        .sponsorName {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          font-weight: 500;
        }
      }
    }
  }
}

.tips {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.7;
}

.sponsorReadme {
  max-height: min(320px, 50vh);
  overflow-y: auto;
  overflow-wrap: anywhere;
}

.updateResult {
  padding: 8px 0;

  .resultHeader {
    display: flex;
    align-items: flex-start;
    gap: 12px;

    .resultIcon {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: calc(var(--ui-radius) * 1.25);
      background: var(--el-color-primary-light-9);
      color: var(--el-color-primary);

      &.warning {
        background: var(--el-color-warning-light-9);
        color: var(--el-color-warning);
      }
      &.success {
        background: var(--el-color-success-light-9);
        color: var(--el-color-success);
      }
      .loadingIcon {
        animation: spin 1.2s linear infinite;
      }
    }

    .resultCopy {
      min-width: 0;

      h3 {
        margin: 0 0 6px;
        color: var(--el-text-color-primary);
        font-size: 15px;
        font-weight: 600;
      }
      p {
        margin: 0;
        color: var(--el-text-color-secondary);
        font-size: 13px;
        line-height: 1.6;
        overflow-wrap: anywhere;
      }
    }
  }

  .updateProgress {
    margin-top: 20px;

    .progressHeader {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
      color: var(--el-text-color-secondary);
      font-size: 12px;
    }
  }

  .releaseInfo {
    margin-top: 20px;
    padding: 14px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: calc(var(--ui-radius) * 1);

    .versionComparison {
      display: flex;
      align-items: center;
      gap: 16px;

      .versionItem {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 8px;
        min-width: 0;

        span {
          color: var(--el-text-color-secondary);
          font-size: 12px;
        }
        strong {
          color: var(--el-text-color-primary);
          font-size: 18px;
          font-weight: 600;
          overflow-wrap: anywhere;
        }
        &.latestVersion strong {
          color: var(--el-color-primary);
        }
      }

      .versionArrow {
        flex-shrink: 0;
        color: var(--el-text-color-placeholder);
      }
    }

    .releaseMeta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid var(--el-border-color-lighter);
      color: var(--el-text-color-secondary);
      font-size: 12px;

      code {
        overflow-wrap: anywhere;
      }
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .updateResult .resultHeader .resultIcon .loadingIcon {
    animation: none;
  }
}
</style>
