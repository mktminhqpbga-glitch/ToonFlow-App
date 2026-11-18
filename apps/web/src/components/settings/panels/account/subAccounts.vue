<template>
  <section class="subAccountsPanel" aria-label="Chứng thực" :aria-busy="loading">
    <div class="accountsToolbar">
      <el-form class="searchForm" :disabled="mutationBusy" @submit.prevent="submitSearch">
        <el-input v-model="search" class="credentialSearch" type="password" showPassword :prefixIcon="IconSearch" autocomplete="off" placeholder="Tìm chứng thực" aria-label="Tìm chứng thực" :maxlength="1000" clearable @clear="clearSearch" />
        <el-button nativeType="submit" :disabled="listLoading">Tra cứu</el-button>
        <el-button :disabled="listLoading || (!search && !activeSearch)" @click="clearSearch">Xóa bộ lọc</el-button>
      </el-form>
      <el-button type="primary" :icon="IconPlus" :disabled="mutationBusy" @click="createVisible = true">Tạo chứng thực</el-button>
    </div>
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" showIcon>
      <el-button size="small" @click="refresh">Thử lại</el-button>
    </el-alert>
    <div v-loading="listLoading" class="accountsList">
      <el-table :data="accounts" rowKey="id" emptyText="">
        <el-table-column label="Tên chứng thực" minWidth="155">
          <template #default="{ row }">
            <div class="accountIdentity"><strong>{{ row.name }}</strong><time>{{ formatTime(row.createdAt) }}</time></div>
          </template>
        </el-table-column>
        <el-table-column label="Chứng thực" minWidth="230">
          <template #default="{ row }">
            <div class="credentialCell">
              <code>{{ shownCredentials.has(row.id) ? row.credential : '••••••••••••' }}</code>
              <div class="credentialActions">
                <el-button link :icon="shownCredentials.has(row.id) ? IconEyeOff : IconEye" :aria-label="`${shownCredentials.has(row.id) ? 'Ẩn' : 'Hiện'} ${row.name}  - chứng thực`" @click="toggleCredential(row.id)" />
                <el-button link :icon="IconCopy" :aria-label="`Sao chép ${row.name}  - chứng thực`" @click="copyCredential(row as SubAccount)" />
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Hạn mức khả dụng" minWidth="110">
          <template #default="{ row }">{{ row.quotaType === 0 ? 'Không giới hạn' : formatMoney(row.balance) }}</template>
        </el-table-column>
        <el-table-column label="Thời hạn hiệu lực" minWidth="155">
          <template #default="{ row }">{{ expirationLabel(row as SubAccount) }}</template>
        </el-table-column>
        <el-table-column label="Trạng thái" width="85">
          <template #default="{ row }"><el-tag :type="row.state === 1 ? 'success' : 'info'" size="small">{{ stateLabel(row.state) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="Thao tác" width="70" align="right">
          <template #default="{ row }">
            <el-button link type="danger" :loading="deletingId === row.id" :disabled="mutationBusy" :aria-label="`Xóa chứng thực ${row.name}`" @click="removeAccount(row as SubAccount)">Xóa</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <el-pagination
      v-if="!errorMessage"
      class="accountsPagination"
      :currentPage="page"
      :pageSize="pageSize"
      :pageSizes="[10, 20, 50]"
      :total="total"
      :disabled="loading"
      :pagerCount="5"
      layout="total, sizes, prev, pager, next"
      size="small"
      @update:currentPage="changePage"
      @update:pageSize="changePageSize" />

    <el-dialog v-model="createVisible" title="Tạo chứng thực" width="min(480px, calc(100vw - 32px))" alignCenter appendToBody destroyOnClose :closeOnClickModal="!creating" :closeOnPressEscape="!creating" :showClose="!creating">
      <div class="createContent">
        <el-form :id="createFormId" class="createForm" labelPosition="top" :disabled="creating" @submit.prevent="createAccount">
          <el-form-item label="Tên chứng thực">
            <el-input v-model="createForm.name" :maxlength="200" autocomplete="off" placeholder="Nhập tên chứng thực" />
          </el-form-item>
          <el-form-item label="Cài đặt hạn mức">
            <el-segmented v-model="createForm.quotaType" class="formSwitch" :options="quotaOptions" block aria-label="Cài đặt hạn mức" />
          </el-form-item>
          <el-form-item v-if="createForm.quotaType === 1" label="Hạn mức khả dụng (CNY)">
            <el-input-number v-model="createForm.balance" :min="0" :controls="false" placeholder="Nhập hạn mức khả dụng" />
          </el-form-item>
          <el-form-item label="Thời hạn hiệu lực">
            <el-segmented v-model="createForm.expirationType" class="formSwitch" :options="expirationOptions" block aria-label="Cài đặt hiệu lực" />
          </el-form-item>
          <el-form-item v-if="createForm.expirationType === 1" label="Thời điểm hết hạn" :error="expirationError">
            <el-date-picker v-model="createForm.expirationDate" type="datetime" format="YYYY-MM-DD HH:mm:ss" :disabledDate="disabledDate" placeholder="Hãy chọn thời điểm hết hạn" />
          </el-form-item>
        </el-form>
        <el-alert v-if="createError" :title="createError" type="error" :closable="false" showIcon />
      </div>
      <template #footer>
        <el-button :disabled="creating" @click="createVisible = false">Hủy</el-button>
        <el-button type="primary" nativeType="submit" :form="createFormId" :loading="creating" :disabled="!createReady">Tạo</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, useId, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { t, translate } from "@toonflow/i18n/vue";
import { IconCopy, IconEye, IconEyeOff, IconPlus, IconSearch } from "@tabler/icons-vue";
import type { CreateSubAccountParams, SubAccount, SubAccountsPage } from "@toonflow/server/channel";
import { writeClipboardText } from "@/lib/clipboard";
import http from "@/lib/http";

const props = defineProps<{ visible: boolean; token: string }>();
const loading = defineModel<boolean>("loading", { default: false });
const accounts = ref<SubAccount[]>([]);
const search = ref("");
const activeSearch = ref("");
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const errorMessage = ref("");
const listLoading = ref(false);
const shownCredentials = ref(new Set<number>());
const createVisible = ref(false);
const creating = ref(false);
const createError = ref("");
const deletingId = ref<number>();
const mutationBusy = computed(() => creating.value || deletingId.value !== undefined);
const createFormId = useId();
const createForm = reactive<{ name: string; quotaType: 0 | 1; expirationType: 0 | 1; balance: number | undefined; expirationDate: Date | null }>({
  name: "", quotaType: 0, expirationType: 0, balance: undefined, expirationDate: null,
});
const quotaOptions = [{ label: "Không giới hạn", value: 0 }, { label: "Có hạn mức", value: 1 }];
const expirationOptions = [{ label: "Không giới hạn thời hạn", value: 0 }, { label: "Chọn thời điểm hết hạn", value: 1 }];
const expirationError = computed(() => createForm.expirationType === 1 && createForm.expirationDate
  && (!Number.isFinite(createForm.expirationDate.getTime()) || createForm.expirationDate.getTime() <= Date.now()) ? translate("请选择未来的到期时间") : "");
const createReady = computed(() => !!createForm.name.trim() && !creating.value
  && (createForm.quotaType === 0 || typeof createForm.balance === "number" && Number.isFinite(createForm.balance) && createForm.balance >= 0)
  && (createForm.expirationType === 0 || !!createForm.expirationDate && !expirationError.value));
const moneyFormat = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 6 });
const timeFormat = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
let listRequest: AbortController | undefined;
let createRequest: AbortController | undefined;
let removeRequest: AbortController | undefined;
let deleteConfirmation: AbortController | undefined;

function formatMoney(value: number) {
  return moneyFormat.format(value);
}

function formatTime(value: number) {
  return timeFormat.format(value);
}

function expirationLabel(account: SubAccount) {
  return account.expirationType === 0 ? translate("永久有效") : account.expiresAt > 0 ? formatTime(account.expiresAt) : translate("未设置");
}

function stateLabel(state: number) {
  return state === 1 ? translate("启用") : state === 0 ? translate("停用") : t`状态 ${state}`;
}

function requestError(error: unknown, fallback: string) {
  return error instanceof Error && "status" in error && error.status === 401 ? translate("账号登录已失效，请重新登录")
    : error instanceof Error ? error.message : fallback;
}

function toggleCredential(id: number) {
  if (shownCredentials.value.has(id)) shownCredentials.value.delete(id);
  else shownCredentials.value.add(id);
}

async function copyCredential(account: SubAccount) {
  const token = props.token;
  if (!props.visible || !token) return;
  try {
    await writeClipboardText(account.credential);
    if (props.visible && props.token === token) ElMessage.success("Đã sao chép chứng thực");
  } catch {
    if (props.visible && props.token === token) ElMessage.error("Sao chép chứng thực thất bại");
  }
}

function submitSearch() {
  activeSearch.value = search.value.trim();
  page.value = 1;
  void refresh();
}

function clearSearch() {
  search.value = "";
  submitSearch();
}

function changePage(value: number) {
  if (page.value === value) return;
  page.value = value;
  void refresh();
}

function changePageSize(value: number) {
  pageSize.value = value;
  page.value = 1;
  void refresh();
}

async function refresh() {
  listRequest?.abort();
  listLoading.value = false;
  accounts.value = [];
  shownCredentials.value.clear();
  errorMessage.value = "";
  const token = props.token;
  if (!props.visible || !token) return;
  const request = new AbortController();
  listRequest = request;
  listLoading.value = true;
  try {
    const result = await http<SubAccountsPage>({
      method: "POST", url: "/api/channel/subAccounts/get", signal: request.signal,
      headers: { Authorization: `Bearer ${token}` },
      data: { page: page.value, limit: pageSize.value, ...(activeSearch.value ? { credential: activeSearch.value } : {}) },
    });
    if (request.signal.aborted || props.token !== token) return;
    accounts.value = result.list;
    total.value = result.total;
  } catch (error) {
    if (!request.signal.aborted) errorMessage.value = requestError(error, translate("获取凭证失败"));
  } finally {
    if (listRequest === request) listLoading.value = false;
  }
}

function disabledDate(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

async function createAccount() {
  const token = props.token;
  if (!props.visible || !token || !createVisible.value || mutationBusy.value || !createReady.value) return;
  const expiresAt = createForm.expirationDate?.getTime();
  if (createForm.expirationType === 1 && (!expiresAt || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now())) {
    createError.value = "Hãy chọn thời điểm hết hạn trong tương lai";
    return;
  }
  const data: CreateSubAccountParams = {
    name: createForm.name.trim(), quotaType: createForm.quotaType, expirationType: createForm.expirationType,
    ...(createForm.quotaType === 1 ? { balance: createForm.balance } : {}),
    ...(createForm.expirationType === 1 ? { expiresAt } : {}),
  };
  const request = new AbortController();
  createRequest = request;
  creating.value = true;
  createError.value = "";
  try {
    await http<null>({ method: "POST", url: "/api/channel/subAccounts/create", data, signal: request.signal, headers: { Authorization: `Bearer ${token}` } });
    if (request.signal.aborted || props.token !== token) return;
    ElMessage.success("Đã tạo chứng thực");
    createVisible.value = false;
    search.value = "";
    activeSearch.value = "";
    page.value = 1;
    await refresh();
  } catch (error) {
    if (!request.signal.aborted) createError.value = requestError(error, translate("创建凭证失败"));
  } finally {
    if (createRequest === request) creating.value = false;
  }
}

async function removeAccount(account: SubAccount) {
  const token = props.token;
  if (!props.visible || !token || mutationBusy.value) return;
  const request = new AbortController();
  removeRequest = request;
  deleteConfirmation = request;
  deletingId.value = account.id;
  try {
    await ElMessageBox.confirm(`Xóa chứng thực “${account.name}” sẽ khiến chứng thực này không thể sử dụng nữa.`, "Xóa chứng thực", {
      confirmButtonText: "Xóa", cancelButtonText: "Hủy", type: "warning",
    });
    if (deleteConfirmation === request) deleteConfirmation = undefined;
    if (request.signal.aborted || props.token !== token || !props.visible) return;
    await http<null>({ method: "POST", url: "/api/channel/subAccounts/remove", data: { id: account.id }, signal: request.signal, headers: { Authorization: `Bearer ${token}` } });
    if (request.signal.aborted || props.token !== token) return;
    ElMessage.success("Đã xóa chứng thực");
    page.value = Math.min(page.value, Math.max(1, Math.ceil(Math.max(0, total.value - 1) / pageSize.value)));
    await refresh();
  } catch (error) {
    if (!request.signal.aborted && error !== "cancel" && error !== "close") errorMessage.value = requestError(error, translate("删除凭证失败"));
  } finally {
    if (deleteConfirmation === request) deleteConfirmation = undefined;
    if (removeRequest === request) deletingId.value = undefined;
  }
}

watch([listLoading, creating, deletingId], () => {
  loading.value = listLoading.value || mutationBusy.value;
}, { flush: "sync" });

watch(createVisible, () => {
  createRequest?.abort();
  creating.value = false;
  createError.value = "";
  Object.assign(createForm, { name: "", quotaType: 0, expirationType: 0, balance: undefined, expirationDate: null });
}, { flush: "sync" });

function cancelRequests() {
  listRequest?.abort();
  createRequest?.abort();
  removeRequest?.abort();
  if (deleteConfirmation) {
    ElMessageBox.close();
    deleteConfirmation = undefined;
  }
  listLoading.value = false;
  creating.value = false;
  deletingId.value = undefined;
}

watch([() => props.visible, () => props.token], ([visible, token], previous) => {
  cancelRequests();
  createVisible.value = false;
  accounts.value = [];
  shownCredentials.value.clear();
  search.value = "";
  activeSearch.value = "";
  if (token !== previous?.[1]) {
    page.value = 1;
    total.value = 0;
  }
  if (visible && token) void refresh();
}, { immediate: true, flush: "sync" });

onBeforeUnmount(() => {
  cancelRequests();
  loading.value = false;
});

defineExpose({ refresh });
</script>

<style lang="scss" scoped>
.subAccountsPanel {
  display: grid;
  gap: 16px;
  min-width: 0;

  .accountsToolbar {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 12px;

    .searchForm {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      max-width: 100%;

      .credentialSearch { width: 240px; max-width: 100%; }
      .el-button { margin: 0; }
    }
  }
  .accountsList {
    min-width: 0;
    min-height: 120px;

    .accountIdentity {
      display: grid;
      gap: 6px;
      padding: 6px 0;
      overflow-wrap: anywhere;

      strong { color: var(--el-text-color-primary); font-size: 13px; }
      time { color: var(--el-text-color-secondary); font-size: 11px; }
    }
    .credentialCell {
      display: flex;
      align-items: center;
      gap: 8px;

      code { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: 12px; }
      .credentialActions { display: flex; align-items: center; flex-shrink: 0; gap: 8px; .el-button { margin: 0; } }
    }
  }
  .accountsPagination { justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
}
.createContent {
  display: grid;
  gap: 14px;
  max-height: min(480px, calc(100dvh - 220px));
  overflow-y: auto;

  .createForm {
    display: grid;
    gap: 18px;
    padding: 2px;

    :deep(.el-form-item) { margin: 0; min-width: 0; }
    :deep(.el-input-number), :deep(.el-date-editor) { width: 100%; }
    .formSwitch { width: 100%; }
  }
}
</style>
