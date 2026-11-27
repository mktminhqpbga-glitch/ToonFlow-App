<template>
  <div class="accountPanel">
    <div v-if="account" class="overview" :aria-busy="overviewLoading">
      <section class="profileCard" aria-label="Tài khoản hiện tại">
        <div class="profileIcon"><img :src="logoUrl" alt="Toonflow" /></div>
        <div class="profileInfo">
          <h3>{{ account.nickname || "Tài khoản Toonflow" }}</h3>
          <p v-if="account.contact">{{ account.contact }}</p>
        </div>
        <div class="profileActions">
          <el-button tag="a" href="https://api.toonflow.net/console/preview" target="_blank" rel="noopener noreferrer" text type="primary" :icon="IconExternalLink">Thông tin tài khoản khác</el-button>
          <el-button text :icon="IconRefresh" :loading="overviewLoading" :disabled="loggingOut" @click="refreshAccount">Làm mới</el-button>
          <el-button text type="danger" :icon="IconLogout" :loading="loggingOut" @click="logout">Đăng xuất</el-button>
        </div>
      </section>

      <div class="accountTabs">
        <el-segmented v-model="accountTab" class="tabSwitch" :options="accountOptions" ariaLabel="Trang tài khoản" />
        <div v-show="accountTab === 'overview'" class="overviewContent">
          <el-alert v-if="overviewError" :title="overviewError" type="error" :closable="false" showIcon />

          <div class="summaryGrid">
            <section class="summaryCard" aria-label="Số dư chính">
              <div class="summaryLabel"><span>Số dư chính</span><icon-wallet :size="20" aria-hidden="true" /></div>
              <strong>{{ formatMoney(previewData?.totalPoints, previewLoading) }}</strong>
              <el-button class="rechargeButton" type="primary" :icon="IconCreditCard" @click="accountTab = 'wallet'">Nạp tiền</el-button>
            </section>
            <section class="summaryCard" aria-label="Ưu đãi khả dụng">
              <div class="summaryLabel"><span>Ưu đãi khả dụng</span><icon-gift :size="20" aria-hidden="true" /></div>
              <strong>{{ formatMoney(previewData?.bonusBalance, previewLoading) }}</strong>
            </section>
            <section class="summaryCard" aria-label="Tổng số tiền đã sử dụng">
              <div class="summaryLabel"><span>Tổng số tiền đã sử dụng</span><icon-chart-bar :size="20" aria-hidden="true" /></div>
              <strong>{{ formatMoney(previewData?.totalConsumption, previewLoading) }}</strong>
            </section>
          </div>

          <section class="usageCard" aria-labelledby="usageTitle">
            <h3 id="usageTitle">Tổng quan sử dụng (hôm nay)</h3>
            <dl class="usageMetrics">
              <div>
                <dt>Số lần gọi API</dt>
                <dd>{{ usageStatistics?.summary?.totalRequests ?? (usageLoading ? "Đang tải…" : "Chưa có dữ liệu") }}</dd>
              </div>
              <div>
                <dt>Chi phí sử dụng</dt>
                <dd>{{ formatMoney(usageStatistics?.summary?.totalAmount, usageLoading) }}</dd>
              </div>
            </dl>
            <div class="chartHeader">
              <span>Số tiền sử dụng (CNY)</span>
            </div>
            <accountChart
              kind="bar"
              :dates="usageStatistics?.dates ?? []"
              :series="usageStatistics?.series ?? []"
              label="Chi phí theo mô hình"
              :loading="usageLoading" />
          </section>

          <section class="trendCard" aria-labelledby="trendTitle">
            <h3 id="trendTitle">Biến động số dư (14 ngày gần nhất)</h3>
            <accountChart kind="line" :dates="trendData.dates" :series="trendData.series" label="Biểu đồ biến động số dư trong 14 ngày gần nhất" :loading="previewLoading" />
          </section>
        </div>
        <wallet
          ref="walletPanel"
          v-show="accountTab === 'wallet'"
          v-model:loading="walletLoading"
          :visible="visible !== false && accountTab === 'wallet'"
          :token="accountToken"
          :balance="previewData?.totalPoints"
          @balanceChanged="refreshPreview" />
        <taskRecords
          ref="records"
          v-show="accountTab === 'taskRecords'"
          v-model:loading="recordsLoading"
          :visible="visible !== false && accountTab === 'taskRecords'"
          :token="accountToken" />
        <subAccounts
          ref="subAccountsPanel"
          v-show="accountTab === 'subAccounts'"
          v-model:loading="subAccountsLoading"
          :visible="visible !== false && accountTab === 'subAccounts'"
          :token="accountToken" />
        <modelCatalog
          ref="catalog"
          v-show="accountTab === 'models'"
          v-model:loading="modelsLoading"
          :visible="visible !== false && accountTab === 'models'"
          :token="accountToken" />
      </div>
    </div>

    <section v-else class="authSection" aria-label="Đăng nhập và đăng ký">
      <div class="authContent">
        <header class="authHeader">
          <div class="authLogo"><img :src="logoUrl" alt="Toonflow" /></div>
          <div class="authInfo">
            <h3>Toonflow</h3>
            <p>Chưa kết nối tài khoản. Đăng nhập để xem số dư và lịch sử sử dụng dịch vụ Toonflow.</p>
          </div>
          <el-segmented v-model="authTab" class="authTabs" :options="authOptions" :disabled="submitting" block aria-label="Đăng nhập hoặc đăng ký" />
        </header>
        <el-form v-if="authTab === 'login'" class="authForm" labelPosition="top" :disabled="submitting" @submit.prevent="submitLogin">
          <el-form-item label="Số điện thoại hoặc email">
            <el-input v-model="loginForm.account" autocomplete="username" placeholder="Nhập số điện thoại hoặc email" />
          </el-form-item>
          <el-form-item label="Mật khẩu">
            <el-input v-model="loginForm.password" type="password" autocomplete="current-password" showPassword placeholder="Nhập mật khẩu" />
          </el-form-item>
          <el-form-item label="Mã xác minh hình ảnh">
            <div class="verificationRow">
              <el-input v-model="loginForm.captcha" autocomplete="off" placeholder="Nhập kết quả phép tính" aria-label="Mã xác minh hình ảnh" />
              <el-button class="captchaButton" :class="{ captchaLoaded: !!captchaImage }" aria-label="Làm mới mã xác minh hình ảnh" :icon="captchaImage ? undefined : IconRefresh" :loading="captchaLoading" @click="refreshCaptcha">
                <img v-if="captchaImage" :src="captchaImage" alt="Mã xác minh hình ảnh" />
                <span v-else>Lấy mã xác minh</span>
              </el-button>
            </div>
          </el-form-item>
          <div class="authActions">
            <el-button link type="primary" @click="forgotPasswordVisible = true">Quên mật khẩu</el-button>
            <el-button class="submitButton" type="primary" nativeType="submit" :loading="submitting" :disabled="!loginReady">Đăng nhập</el-button>
          </div>
        </el-form>
        <el-form v-else class="authForm" labelPosition="top" :disabled="submitting" @submit.prevent="submitRegister">
          <el-form-item label="Số điện thoại">
            <el-input v-model="registerForm.phone" autocomplete="tel" placeholder="Nhập số điện thoại" />
          </el-form-item>
          <el-form-item label="Biệt danh">
            <el-input v-model="registerForm.nickname" autocomplete="nickname" placeholder="Nhập biệt danh" />
          </el-form-item>
          <el-form-item label="Mật khẩu">
            <el-input v-model="registerForm.password" type="password" autocomplete="new-password" showPassword placeholder="Nhập mật khẩu" />
          </el-form-item>
          <el-form-item label="Xác nhận mật khẩu" :error="registerForm.confirmPassword && registerForm.confirmPassword !== registerForm.password ? 'Mật khẩu nhập lại không khớp' : ''">
            <el-input v-model="registerForm.confirmPassword" type="password" autocomplete="new-password" showPassword placeholder="Nhập lại mật khẩu" />
          </el-form-item>
          <el-form-item label="Mã xác minh SMS">
            <div class="verificationRow">
              <el-input v-model="registerForm.verificationCode" autocomplete="one-time-code" placeholder="Nhập mã xác minh SMS" aria-label="Mã xác minh SMS" />
              <smsCodeButton :phone="registerForm.phone" :disabled="submitting" :visible="visible" />
            </div>
          </el-form-item>
          <el-button class="submitButton" type="primary" nativeType="submit" :loading="submitting" :disabled="!registerReady">Đăng ký</el-button>
        </el-form>
      </div>
    </section>
    <forgotPasswordDialog v-if="!account" v-model="forgotPasswordVisible" :phone="loginForm.account" @reset="onPasswordReset" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { translate } from "@toonflow/i18n/vue";
import { IconChartBar, IconCreditCard, IconExternalLink, IconGift, IconLogout, IconRefresh, IconWallet } from "@tabler/icons-vue";
import logoUrl from "@toonflow/assets/logo.svg";
import type { Captcha, Login, PreviewData, UsageStatistics } from "@toonflow/server/channel";
import http from "@/lib/http";
import { refreshToonflowProvider, saveSettings, settings, toonflowProviderError, toonflowProviderLoading } from "@/stores/settings";
import smsCodeButton from "./smsCodeButton.vue";
import forgotPasswordDialog from "./forgotPasswordDialog.vue";
import accountChart from "./accountChart.vue";
import modelCatalog from "./modelCatalog.vue";
import taskRecords from "./taskRecords.vue";
import wallet from "./wallet.vue";
import subAccounts from "./subAccounts.vue";

type AccountData = {
  nickname: string;
  contact?: string;
};

const props = withDefaults(defineProps<{ visible?: boolean }>(), { visible: true });
const emit = defineEmits<{ loggedIn: [] }>();
const account = computed<AccountData | null>(() => {
  const saved = settings.value.toonflowAccount as Partial<Login> | null | undefined;
  if (!saved || typeof saved.token !== "string" || !saved.token.trim()
    || typeof saved.info?.userName !== "string" || typeof saved.info.phone !== "string") return null;
  return { nickname: saved.info.userName, contact: saved.info.phone };
});
const accountToken = computed(() => {
  const saved = settings.value.toonflowAccount as Partial<Login> | null | undefined;
  return account.value && typeof saved?.token === "string" ? saved.token.trim() : "";
});
const accountTab = ref("overview");
const catalog = ref<InstanceType<typeof modelCatalog>>();
const modelsLoading = ref(false);
const records = ref<InstanceType<typeof taskRecords>>();
const recordsLoading = ref(false);
const walletPanel = ref<InstanceType<typeof wallet>>();
const walletLoading = ref(false);
const subAccountsPanel = ref<InstanceType<typeof subAccounts>>();
const subAccountsLoading = ref(false);
const accountOptions = [{ label: "Tổng quan", value: "overview" }, { label: "Ví", value: "wallet" }, { label: "Lịch sử tác vụ", value: "taskRecords" }, { label: "Thông tin xác thực", value: "subAccounts" }, { label: "Danh sách mô hình", value: "models" }];
const previewData = ref<PreviewData>();
const usageStatistics = ref<UsageStatistics>();
const previewLoading = ref(false);
const usageLoading = ref(false);
const overviewLoading = computed(() => previewLoading.value || usageLoading.value || toonflowProviderLoading.value || modelsLoading.value || recordsLoading.value || walletLoading.value || subAccountsLoading.value);
const previewError = ref("");
const usageError = ref("");
const overviewError = computed(() => [...new Set([previewError.value, usageError.value, toonflowProviderError.value].filter(Boolean))].join("; "));
const trendData = computed(() => {
  const daily = [...(previewData.value?.daily ?? [])].sort((left, right) => left.date.localeCompare(right.date));
  return { dates: daily.map(item => item.date), series: [{ name: translate("消费金额"), data: daily.map(item => item.total) }] };
});
let previewRequest: AbortController | undefined;
let usageRequest: AbortController | undefined;
const authTab = ref("login");
const authOptions = [{ label: "Đăng nhập", value: "login" }, { label: "Đăng ký", value: "register" }];
const loginForm = reactive({ account: "", password: "", captcha: "" });
const registerForm = reactive({ phone: "", nickname: "", password: "", confirmPassword: "", verificationCode: "" });
const captchaImage = ref("");
const originalCaptcha = ref("");
const captchaLoading = ref(false);
const submitting = ref(false);
const loggingOut = ref(false);
const forgotPasswordVisible = ref(false);
let captchaRequest: AbortController | undefined;
let authRequest: AbortController | undefined;
const loginReady = computed(() => !!loginForm.account.trim() && !!loginForm.password && !!loginForm.captcha.trim()
  && !!originalCaptcha.value && !captchaLoading.value && !submitting.value);
const registerReady = computed(() => !!registerForm.phone.trim() && !!registerForm.nickname.trim() && !!registerForm.password
  && registerForm.password === registerForm.confirmPassword && !!registerForm.verificationCode.trim() && !submitting.value);
const moneyFormat = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" });

function formatMoney(value?: number, loading = false) {
  if (typeof value === "number" && Number.isFinite(value)) return moneyFormat.format(value);
  return loading ? "Đang tải…" : "Chưa có dữ liệu";
}

function loadError(error: unknown, fallback: string) {
  if (error instanceof Error && "status" in error && error.status === 401) return translate("账号登录已失效，请重新登录");
  return error instanceof Error ? error.message : fallback;
}

async function refreshPreview() {
  previewRequest?.abort();
  previewData.value = undefined;
  previewError.value = "";
  previewLoading.value = false;
  const token = accountToken.value;
  if (props.visible === false || !token) return;
  const request = new AbortController();
  previewRequest = request;
  previewLoading.value = true;
  try {
    const result = await http<PreviewData>({
      method: "GET", url: "/api/channel/account/getPreviewData", signal: request.signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!request.signal.aborted && accountToken.value === token) previewData.value = result;
  } catch (error) {
    if (!request.signal.aborted) previewError.value = loadError(error, translate("加载余额失败，请刷新重试"));
  } finally {
    if (previewRequest === request) previewLoading.value = false;
  }
}

async function refreshUsage() {
  usageRequest?.abort();
  usageStatistics.value = undefined;
  usageError.value = "";
  usageLoading.value = false;
  const token = accountToken.value;
  if (props.visible === false || !token) return;
  const request = new AbortController();
  usageRequest = request;
  usageLoading.value = true;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const finish = new Date(start);
  finish.setHours(23, 59, 59, 999);
  try {
    const result = await http<UsageStatistics>({
      method: "POST", url: "/api/channel/account/getUsageStatistics", signal: request.signal,
      headers: { Authorization: `Bearer ${token}` },
      data: { startTime: start.getTime(), finishTime: finish.getTime(), groupBy: "model" },
    });
    if (!request.signal.aborted && accountToken.value === token) usageStatistics.value = result;
  } catch (error) {
    if (!request.signal.aborted) usageError.value = loadError(error, translate("加载用量失败，请刷新重试"));
  } finally {
    if (usageRequest === request) usageLoading.value = false;
  }
}

function refreshOverview() {
  void refreshPreview();
  void refreshUsage();
}

function refreshAccount() {
  refreshOverview();
  void refreshToonflowProvider();
  if (accountTab.value === "models") void catalog.value?.refresh();
  if (accountTab.value === "taskRecords") void records.value?.refresh();
  if (accountTab.value === "wallet") void walletPanel.value?.refresh();
  if (accountTab.value === "subAccounts") void subAccountsPanel.value?.refresh();
}

async function refreshCaptcha() {
  if (props.visible === false || account.value || authTab.value !== "login") return;
  captchaRequest?.abort();
  const request = new AbortController();
  captchaRequest = request;
  captchaLoading.value = true;
  captchaImage.value = "";
  originalCaptcha.value = "";
  loginForm.captcha = "";
  try {
    const result = await http<Captcha>({ method: "GET", url: "/api/channel/user/getCaptcha", signal: request.signal });
    if (request.signal.aborted) return;
    captchaImage.value = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`;
    originalCaptcha.value = result.captcha;
  } catch (error) {
    if (!request.signal.aborted) ElMessage.error(error instanceof Error ? error.message : "Không lấy được mã xác minh hình ảnh");
  } finally {
    if (captchaRequest === request) captchaLoading.value = false;
  }
}

async function submitLogin() {
  if (!loginReady.value || props.visible === false) return;
  const request = new AbortController();
  authRequest = request;
  submitting.value = true;
  try {
    const result = await http<Login>({
      method: "POST", url: "/api/channel/user/login", signal: request.signal,
      data: {
        userName: loginForm.account.trim(), password: loginForm.password,
        captcha: loginForm.captcha.trim(), originalCaptcha: originalCaptcha.value,
      },
    });
    const saved = await saveSettings(() => request.signal.aborted ? undefined : { toonflowAccount: result });
    if (saved && !request.signal.aborted) {
      ElMessage.success("Đăng nhập thành công");
      emit("loggedIn");
    }
  } catch (error) {
    if (!request.signal.aborted) {
      ElMessage.error(error instanceof Error ? error.message : "Đăng nhập thất bại");
      void refreshCaptcha();
    }
  } finally {
    if (authRequest === request) submitting.value = false;
  }
}

async function submitRegister() {
  if (!registerReady.value || props.visible === false) return;
  const request = new AbortController();
  authRequest = request;
  submitting.value = true;
  const phone = registerForm.phone.trim();
  try {
    await http({
      method: "POST", url: "/api/channel/user/register", signal: request.signal,
      data: {
        userName: registerForm.nickname.trim(), phone, password: registerForm.password,
        verificationCode: registerForm.verificationCode.trim(),
      },
    });
    if (request.signal.aborted) return;
    clearForms();
    loginForm.account = phone;
    authTab.value = "login";
    ElMessage.success("Đăng ký thành công, hãy đăng nhập");
  } catch (error) {
    if (!request.signal.aborted) ElMessage.error(error instanceof Error ? error.message : "Đăng ký thất bại");
  } finally {
    if (authRequest === request) submitting.value = false;
  }
}

async function logout() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  try {
    await saveSettings(() => ({ toonflowAccount: null }));
    ElMessage.success("Đã đăng xuất");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Đăng xuất thất bại");
  } finally {
    loggingOut.value = false;
  }
}

function onPasswordReset(phone: string) {
  clearForms();
  loginForm.account = phone;
  authTab.value = "login";
  void refreshCaptcha();
}

function clearForms() {
  Object.assign(loginForm, { account: "", password: "", captcha: "" });
  Object.assign(registerForm, { phone: "", nickname: "", password: "", confirmPassword: "", verificationCode: "" });
}

watch([() => props.visible, account], ([visible, currentAccount]) => {
  if (visible === false || currentAccount) {
    forgotPasswordVisible.value = false;
    clearForms();
    authTab.value = "login";
  }
  if (visible === false) {
    authRequest?.abort();
    submitting.value = false;
  }
});

watch([() => props.visible, accountToken], refreshOverview, { immediate: true, flush: "sync" });

watch([() => props.visible, () => !!account.value, authTab], () => {
  captchaRequest?.abort();
  captchaImage.value = "";
  originalCaptcha.value = "";
  loginForm.captcha = "";
  void refreshCaptcha();
}, { immediate: true });

onBeforeUnmount(() => {
  previewRequest?.abort();
  usageRequest?.abort();
  captchaRequest?.abort();
  authRequest?.abort();
});
</script>

<style lang="scss" scoped>
.accountPanel {
  padding: 0 4px 24px;

  .overview {
    display: grid;
    gap: 16px;

    .profileCard {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px;
      border: 1px solid var(--el-border-color-light);
      border-radius: var(--ui-radius-large);
      background: var(--el-fill-color-extra-light);

      .profileActions {
        display: flex;
        flex-shrink: 0;
        flex-wrap: wrap;
        justify-content: flex-end;
        margin-left: auto;
      }

      .profileIcon {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        width: 48px;
        height: 48px;
        border-radius: var(--ui-radius);
        background: var(--el-fill-color-light);

        img {
          width: 34px;
          height: 34px;
          object-fit: contain;

          .dark & { filter: invert(1); }
        }
      }

      .profileInfo {
        flex: 1;
        min-width: 0;

        h3 { margin: 0; color: var(--el-text-color-primary); font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
        p { margin: 6px 0 0; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
      }
    }

    .accountTabs {
      display: grid;
      gap: 16px;
      min-width: 0;

      .tabSwitch {
        --el-border-radius-base: var(--ui-radius);
        justify-self: start;
      }

      .overviewContent {
        display: grid;
        gap: 16px;

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;

          .summaryCard {
            display: grid;
            justify-items: start;
            gap: 14px;
            min-width: 0;
            padding: 18px;
            border: 1px solid var(--el-border-color-light);
            border-radius: var(--ui-radius-large);
            background: var(--el-fill-color-extra-light);

            .summaryLabel {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              width: 100%;
              color: var(--el-text-color-secondary);
              font-size: 13px;
            }

            strong {
              color: var(--el-text-color-primary);
              font-size: 26px;
              font-variant-numeric: tabular-nums;
              overflow-wrap: anywhere;
            }

            .rechargeButton {
              width: 100%;
              min-height: 36px;
              font-weight: 600;
            }
          }
        }

        .usageCard, .trendCard {
          padding: 18px;
          border: 1px solid var(--el-border-color-light);
          border-radius: var(--ui-radius-large);

          h3 { margin: 0 0 18px; color: var(--el-text-color-primary); font-size: 14px; }

          .chartHeader {
            margin-top: 24px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--el-border-color-lighter);
            color: var(--el-text-color-regular);
            font-size: 13px;
          }

          .usageMetrics {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin: 0;

            > div {
              display: grid;
              gap: 8px;
              min-width: 0;

              dt { color: var(--el-text-color-secondary); font-size: 12px; }
              dd { margin: 0; color: var(--el-text-color-primary); font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
            }
          }
        }
      }
    }
  }

  .authSection {
    container-type: inline-size;

    .authContent {
      width: 100%;

      .authHeader {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        margin-bottom: 24px;
        padding-bottom: 20px;
        border-bottom: 1px solid var(--el-border-color-lighter);

        .authLogo {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: var(--ui-radius);
          background: var(--el-fill-color-light);

          img {
            width: 32px;
            height: 32px;
            object-fit: contain;

            .dark & { filter: invert(1); }
          }
        }

        .authInfo {
          min-width: 0;

          h3 { margin: 0; color: var(--el-text-color-primary); font-size: 15px; font-weight: 600; }
          p { margin: 6px 0 0; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.5; }
        }

        .authTabs {
          --el-segmented-bg-color: var(--el-fill-color);
          --el-segmented-item-selected-bg-color: var(--el-bg-color);
          --el-segmented-item-selected-color: var(--el-text-color-primary);
          width: 160px;
          padding: 4px;
          border-radius: var(--ui-radius);

          :deep(.el-segmented__item-selected) { border: 1px solid var(--el-border-color-light); }
        }
      }

      .authForm {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 20px;

        :deep(.el-form-item) { min-width: 0; margin-bottom: 0; }
        :deep(.el-form-item__label) { height: auto; margin-bottom: 6px; font-size: 12px; line-height: 18px; }
        :deep(.el-input__wrapper) { min-height: 36px; background: var(--el-bg-color); }

        .verificationRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 116px;
          gap: 8px;
          width: 100%;

          .el-input { min-width: 0; }
          .el-button { height: 36px; margin: 0; padding: 0 10px; font-size: 12px; }

          .captchaButton {
            min-width: 0;
            padding: 0;
            overflow: hidden;

            &.captchaLoaded {
              background: #fff;

              :deep(> span) { width: 100%; height: 100%; min-width: 0; }
            }
            img { display: block; width: 100%; height: 100%; object-fit: contain; }
          }
        }

        .submitButton { justify-self: end; align-self: end; min-width: 112px; height: 36px; margin: 0; }

        .authActions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          align-self: end;
          gap: 16px;
        }
      }

      @container (max-width: 560px) {
        .authHeader {
          grid-template-columns: auto minmax(0, 1fr);

          .authTabs { grid-column: 1 / -1; width: 100%; }
        }

        .authForm {
          grid-template-columns: minmax(0, 1fr);

          .submitButton { width: 100%; }
        }
      }
    }
  }

  @media (max-width: 700px) {
    .overview {
      .profileCard { flex-wrap: wrap; padding: 14px; }
      .accountTabs .overviewContent {
        .summaryGrid { grid-template-columns: minmax(0, 1fr); }
        .usageCard .usageMetrics { grid-template-columns: minmax(0, 1fr); }
      }
    }
  }
}
</style>
