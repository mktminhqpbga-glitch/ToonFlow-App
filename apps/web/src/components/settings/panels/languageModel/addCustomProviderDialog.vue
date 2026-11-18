<template>
  <el-dialog
    v-model="visible"
    :title="provider ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp tùy chỉnh'"
    width="min(760px, 94vw)"
    alignCenter
    appendToBody
    destroyOnClose
    :closeOnClickModal="false"
    :closeOnPressEscape="!saving"
    :showClose="!saving"
    @closed="resetForm">
    <el-scrollbar maxHeight="65vh">
      <el-form ref="providerForm" :model="form" :rules="rules" labelPosition="top" :disabled="saving" class="customProviderForm">
        <div class="formGrid">
          <el-form-item label="Provider ID" prop="id"><el-input v-model="form.id" placeholder="Ví dụ myProvider" /></el-form-item>
          <el-form-item label="Tên hiển thị" prop="label"><el-input v-model="form.label" placeholder="Tên hiển thị của nhà cung cấp" /></el-form-item>
          <el-form-item label="Địa chỉ API" prop="apiUrl"><el-input v-model="form.apiUrl" dir="ltr" placeholder="https://api.example.com/v1" /></el-form-item>
          <el-form-item label="Giao thức API" prop="protocol">
            <el-select v-model="form.protocol" aria-label="Giao thức API">
              <el-option v-for="protocol in protocols" :key="protocol" :label="protocol" :value="protocol" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="Khóa API" prop="apiKey">
          <el-input v-model="form.apiKey" type="password" dir="ltr" showPassword autocomplete="off" placeholder="Có thể để trống nếu dịch vụ nội bộ không yêu cầu xác thực" />
        </el-form-item>
        <el-form-item label="Header yêu cầu tùy chỉnh" prop="headers" class="requestHeaders">
          <div class="headersEditor">
            <div v-for="item in form.headers" :key="item.key" class="headerRow">
              <el-input v-model="item.name" class="headerName" dir="ltr" autocomplete="off" placeholder="Tên header" aria-label="Tên header" />
              <el-input v-model="item.value" type="password" dir="ltr" showPassword autocomplete="off" placeholder="Giá trị header (có thể để trống)" aria-label="Giá trị header" />
              <el-button text type="danger" :icon="IconTrash" aria-label="Xóa header" @click="form.headers = form.headers.filter(header => header.key !== item.key)" />
            </div>
            <el-button text :icon="IconPlus" @click="addRequestHeader">Thêm header</el-button>
          </div>
        </el-form-item>
        <div class="modelHeader">
          <el-text tag="strong">Danh sách mô hình</el-text>
          <el-button :icon="IconDownload" :loading="fetching" @click="fetchModels()">Lấy danh sách mô hình</el-button>
        </div>
        <div class="modelList">
          <div v-for="item in models" :key="item.key" class="modelItem">
            <div class="modelRow">
              <el-input v-model="item.id" placeholder="ID mô hình" aria-label="ID mô hình" />
              <el-input v-model="item.label" placeholder="Tên hiển thị" aria-label="Tên hiển thị của mô hình" />
              <el-button
                text
                :icon="expandedModels.has(item.key) ? IconChevronUp : IconChevronDown"
                :aria-expanded="expandedModels.has(item.key)"
                aria-label="Mở rộng cấu hình mô hình"
                @click="expandedModels.has(item.key) ? expandedModels.delete(item.key) : expandedModels.add(item.key)" />
              <el-button
                text
                type="danger"
                :icon="IconTrash"
                aria-label="Xóa mô hình"
                @click="models = models.filter((model) => model.key !== item.key)" />
            </div>
            <div v-if="expandedModels.has(item.key)" class="modelSettings">
              <div class="formGrid tokenSettings">
                <el-form-item label="Cửa sổ ngữ cảnh">
                  <el-input-number
                    v-model="item.contextWindow"
                    :min="1"
                    :max="Number.MAX_SAFE_INTEGER"
                    :precision="0"
                    controlsPosition="right"
                    placeholder="Chưa đặt"
                    aria-label="Cửa sổ ngữ cảnh" />
                </el-form-item>
                <el-form-item label="Số token đầu ra tối đa">
                  <el-input-number
                    v-model="item.maxOutputTokens"
                    :min="1"
                    :max="Number.MAX_SAFE_INTEGER"
                    :precision="0"
                    controlsPosition="right"
                    placeholder="Chưa đặt"
                    aria-label="Số token đầu ra tối đa" />
                </el-form-item>
              </div>
              <el-form-item class="reasoningMode" label="Mức độ suy luận">
                <el-select :modelValue="getReasoningMode(item)" aria-label="Cách cấu hình mức độ suy luận" @update:modelValue="setReasoningMode(item, $event)">
                  <el-option label="Theo danh mục mô hình" value="inherit" />
                  <el-option label="Tắt mức độ suy luận" value="disabled" />
                  <el-option label="Mức tùy chỉnh" value="custom" />
                </el-select>
              </el-form-item>
              <div v-if="getReasoningMode(item) === 'custom'" class="reasoningSettings">
                <div class="reasoningChoices" aria-label="Các mức suy luận được hỗ trợ">
                  <el-checkbox
                    v-for="level in thinkingLevels"
                    :key="level"
                    class="reasoningChoice"
                    border
                    :modelValue="hasReasoningLevel(item, level)"
                    @update:modelValue="setReasoningLevel(item, level, !!$event)">
                    {{ thinkingLevelLabels[level] }}
                  </el-checkbox>
                </div>
                <el-text type="info" size="small">Chọn các mức được hỗ trợ và nhập giá trị cho API; có thể để trống off để không chỉ định mức.</el-text>
                <div class="reasoningMappings">
                  <div v-for="level in thinkingLevels.filter(level => hasReasoningLevel(item, level))" :key="level" class="reasoningRow">
                    <div class="reasoningLevel">
                      <span>{{ thinkingLevelLabels[level] }}</span>
                      <span class="reasoningKey">{{ level }}</span>
                    </div>
                    <el-input
                      :modelValue="getReasoningValue(item, level)"
                      :placeholder="level === 'off' ? 'Để trống để dùng mặc định của giao thức' : 'Giá trị API, ví dụ ' + level"
                      :aria-label="level + ' - giá trị API'"
                      @update:modelValue="setReasoningValue(item, level, $event)" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <el-button class="manualAdd" :icon="IconPlus" @click="addManualModel">Thêm mô hình thủ công</el-button>
        <el-alert v-if="formError" :title="formError" type="error" :closable="false" showIcon />
      </el-form>
    </el-scrollbar>
    <template #footer>
      <el-button :disabled="saving" @click="visible = false">Hủy</el-button>
      <el-button type="primary" :loading="saving" :disabled="fetching" @click="addProvider">
        {{ provider ? "Lưu thay đổi" : "Xác nhận thêm nhà cung cấp" }}
      </el-button>
    </template>
  </el-dialog>
  <el-dialog v-model="resultsVisible" title="Chọn mô hình cần thêm" width="min(680px, 92vw)" alignCenter appendToBody destroyOnClose>
    <el-input v-model="modelSearch" clearable :prefixIcon="IconSearch" placeholder="Tìm ID hoặc tên hiển thị của mô hình" aria-label="Tìm mô hình" />
    <div class="modelResults">
      <el-auto-resizer>
        <template #default="{ height, width }">
          <el-table-v2
            :columns="resultColumns"
            :data="filteredModels"
            :width="width"
            :height="height"
            :rowHeight="38"
            :headerHeight="36"
            rowKey="id"
            fixed />
        </template>
      </el-auto-resizer>
    </div>
    <el-text type="info">{{ filteredModels.length }} kết quả, đã chọn {{ selectedIds.size }} mô hình</el-text>
    <template #footer>
      <el-button @click="resultsVisible = false">Hủy</el-button>
        <el-button type="primary" :disabled="!selectedIds.size" @click="addSelectedModels">Thêm mô hình đã chọn ({{ selectedIds.size }})</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, h, onBeforeUnmount, reactive, ref, shallowRef, watch } from "vue";
import axios from "axios";
import { t } from "@toonflow/i18n/vue";
import { ElCheckbox, type FormInstance, type FormRules, type Column } from "element-plus";
import {
  IconPlus,
  IconDownload,
  IconTrash,
  IconChevronDown,
  IconChevronUp,
  IconSearch,
} from "@tabler/icons-vue";
import { saveSettings, type CustomProvider, type CustomProviderModel } from "@/stores/settings";
import { languageProviders } from "@toonflow/providers";
import { thinkingLevels, type ThinkingLevel, type ReasoningEfforts } from "@toonflow/server/modelReasoning";

const props = defineProps<{ provider?: CustomProvider }>();
const visible = defineModel<boolean>({ default: false });
const providerForm = ref<FormInstance>();
const form = reactive({ id: "", label: "", apiUrl: "", protocol: "openai-completions", apiKey: "", headers: [] as { key: string; name: string; value: string }[] });
const models = ref<(CustomProviderModel & { key: string })[]>([]);
const expandedModels = ref(new Set<string>());
const fetchedModels = shallowRef<CustomProviderModel[]>([]);
const selectedIds = ref(new Set<string>());
const modelSearch = ref("");
const saving = ref(false);
const thinkingLevelLabels: Record<ThinkingLevel, string> = { off: "Tắt", minimal: "Tối thiểu", low: "Thấp", medium: "Trung bình", high: "Cao", xhigh: "Rất cao", max: "Cao nhất" };
const protocols = ["openai-completions", "openai-responses", "anthropic-messages"];
const addedIds = computed(() => new Set(models.value.map((item) => item.id.trim())));
const filteredModels = computed(() => {
  const query = modelSearch.value.trim().toLowerCase();
  return query ? fetchedModels.value.filter((item) => `${item.id} ${item.label}`.toLowerCase().includes(query)) : fetchedModels.value;
});
const resultColumns = computed<Column[]>(() => [
  {
    key: "selection",
    width: 42,
    cellRenderer: ({ rowData }) =>
      h(ElCheckbox, {
        modelValue: selectedIds.value.has(rowData.id),
        disabled: addedIds.value.has(rowData.id),
        ariaLabel: t`选择 ${rowData.id}`,
        onChange: (value: boolean | string | number) => {
          if (value) selectedIds.value.add(rowData.id);
          else selectedIds.value.delete(rowData.id);
        },
      }),
  },
  { key: "id", dataKey: "id", title: "ID mô hình", width: 240, flexGrow: 1 },
  { key: "label", dataKey: "label", title: "Tên hiển thị", width: 200, flexGrow: 1 },
]);
const resultsVisible = ref(false);
const fetching = ref(false);
const formError = ref("");
let request: AbortController | undefined;
const rules: FormRules = {
  id: [
    { required: true, message: "Hãy nhập Provider ID", trigger: "blur" },
    { pattern: /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, message: "Chỉ hỗ trợ chữ cái, chữ số, dấu chấm, gạch dưới và gạch ngang", trigger: "blur" },
  ],
  label: [{ required: true, whitespace: true, message: "Hãy nhập tên hiển thị", trigger: "blur" }],
  apiUrl: [
    {
      validator: (_rule, value, callback) => {
        try {
          const url = new URL(value);
          if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
          callback();
        } catch {
          callback(new Error("Hãy nhập địa chỉ gốc HTTP API hợp lệ, không chứa tham số truy vấn"));
        }
      },
      trigger: "blur",
    },
  ],
  headers: [{
    validator: (_rule, _value, callback) => {
      try { getProviderHeaders(); callback(); }
      catch (error) { callback(error as Error); }
    },
    trigger: "blur",
  }],
};

watch(visible, (value) => {
  if (value) {
    resetForm();
    if (props.provider) {
      const { models: providerModels, id, label, apiUrl, protocol, apiKey, headers } = props.provider;
      Object.assign(form, { id, label, apiUrl, protocol, apiKey });
      form.headers = Object.entries(headers ?? {}).map(([name, value]) => ({ key: crypto.randomUUID(), name, value }));
      models.value = providerModels.map((item) => ({ ...item, key: crypto.randomUUID() }));
    }
  } else {
    request?.abort();
    resultsVisible.value = false;
  }
}, { immediate: true });
onBeforeUnmount(() => request?.abort());
watch([() => form.id, () => form.apiUrl, () => form.protocol, () => form.apiKey], () => request?.abort());
watch(() => form.headers, () => request?.abort(), { deep: true });

function resetForm() {
  Object.assign(form, { id: "", label: "", apiUrl: "", protocol: "openai-completions", apiKey: "" });
  form.headers = [];
  models.value = [];
  expandedModels.value = new Set();
  fetchedModels.value = [];
  selectedIds.value = new Set();
  modelSearch.value = "";
  formError.value = "";
}

function addRequestHeader() {
  form.headers.push({ key: crypto.randomUUID(), name: "", value: "" });
}

function getProviderHeaders() {
  const entries: [string, string][] = [];
  const names = new Set<string>();
  for (const item of form.headers) {
    const name = item.name.trim();
    if (!name && /^[\t ]*$/.test(item.value)) continue;
    if (!name) throw new Error("Hãy nhập tên header");
    if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)) throw new Error("Tên header chỉ được chứa chữ cái, chữ số và ký tự token HTTP");
    if (names.has(name.toLowerCase())) throw new Error("Tên header không được trùng (không phân biệt chữ hoa và chữ thường)");
    if (!/^[\t\x20-\x7e\x80-\xff]*$/.test(item.value)) throw new Error("Giá trị header không được chứa ký tự điều khiển, xuống dòng hoặc ký tự ngoài Latin1");
    names.add(name.toLowerCase());
    entries.push([name, item.value]);
  }
  return entries.length ? Object.fromEntries(entries) : undefined;
}

async function fetchModels() {
  if (fetching.value || !(await providerForm.value?.validateField(["apiUrl", "headers"]).catch(() => false))) return;
  fetching.value = true;
  formError.value = "";
  const controller = new AbortController();
  request = controller;
  try {
    const { data } = await axios.post(
      "/api/providers/models",
      { apiUrl: form.apiUrl.trim(), protocol: form.protocol, apiKey: form.apiKey.trim(), headers: getProviderHeaders() },
      { signal: controller.signal, timeout: 35000 }
    );
    if (controller.signal.aborted) return;
    if (data.code !== 200 || !Array.isArray(data.data)) throw new Error(data.message || "Không lấy được danh sách mô hình");
    fetchedModels.value = data.data;
    selectedIds.value = new Set();
    modelSearch.value = "";
    resultsVisible.value = true;
  } catch (error) {
    if (!controller.signal.aborted) {
      formError.value = axios.isAxiosError(error)
        ? error.response?.data?.message || "Không lấy được danh sách mô hình, hãy kiểm tra cấu hình kết nối"
        : error instanceof Error
        ? error.message
        : "Không lấy được danh sách mô hình";
    }
  } finally {
    fetching.value = false;
  }
}

function addSelectedModels() {
  const added = new Set(addedIds.value);
  for (const item of fetchedModels.value) {
    if (selectedIds.value.has(item.id) && !added.has(item.id)) {
      models.value.push({ ...item, key: crypto.randomUUID() });
      added.add(item.id);
    }
  }
  resultsVisible.value = false;
}

function addManualModel() {
  const key = crypto.randomUUID();
  models.value.push({ key, id: "", label: "" });
}

function getReasoningMode(model: CustomProviderModel) {
  return model.reasoningEfforts === undefined ? "inherit" : model.reasoningEfforts === false ? "disabled" : "custom";
}

function setReasoningMode(model: CustomProviderModel, mode: string) {
  model.reasoningEfforts = mode === "inherit" ? undefined : mode === "disabled" ? false : {};
}

function hasReasoningLevel(model: CustomProviderModel, level: ThinkingLevel) {
  return !!model.reasoningEfforts && Object.hasOwn(model.reasoningEfforts, level);
}

function getReasoningValue(model: CustomProviderModel, level: ThinkingLevel) {
  return model.reasoningEfforts && model.reasoningEfforts[level] || "";
}

function setReasoningLevel(model: CustomProviderModel, level: ThinkingLevel, enabled: boolean) {
  const efforts = { ...(model.reasoningEfforts || {}) };
  if (enabled) efforts[level] = level === "off" ? null : level;
  else delete efforts[level];
  model.reasoningEfforts = efforts;
}

function setReasoningValue(model: CustomProviderModel, level: ThinkingLevel, value: string) {
  model.reasoningEfforts = { ...(model.reasoningEfforts || {}), [level]: level === "off" && !value ? null : value };
}

async function addProvider() {
  if (fetching.value) return;
  formError.value = "";
  if (saving.value || !(await providerForm.value?.validate().catch(() => false))) return;
  if (form.id.toLowerCase() === "toonflow") {
    formError.value = "ID toonflow được dành riêng cho nhà cung cấp tài khoản, hãy chọn ID khác";
    return;
  }
  const providerId = props.provider?.id;
  const ids = models.value.map((item) => item.id.trim());
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
    formError.value = "ID mô hình không được trống hoặc trùng lặp";
    return;
  }
  if (
    models.value.some((item) =>
      [item.contextWindow, item.maxOutputTokens].some((value) => value != null && (!Number.isSafeInteger(value) || value < 1))
    )
  ) {
    formError.value = "Giới hạn token phải là số nguyên dương hoặc để trống";
    return;
  }
  for (const item of models.value) {
    const efforts = item.reasoningEfforts;
    if (!efforts) continue;
    if (!Object.keys(efforts).some(level => level !== "off")) {
      formError.value = `${item.id} cần bật ít nhất một mức suy luận hoặc chọn Theo danh mục / Tắt`;
      return;
    }
    if (Object.entries(efforts).some(([level, value]) => !(level === "off" && value === null) && (typeof value !== "string" || !value.trim()))) {
      formError.value = `${item.id} phải có giá trị API cho mức suy luận, chỉ off được để trống`;
      return;
    }
  }
  saving.value = true;
  try {
    const updatedProvider = {
      ...form,
      label: form.label.trim(),
      apiUrl: form.apiUrl.trim(),
      apiKey: form.apiKey.trim(),
      headers: getProviderHeaders(),
      models: models.value.map(({ key, ...item }) => ({
        ...item,
        id: item.id.trim(),
        label: item.label.trim() || item.id.trim(),
        contextWindow: item.contextWindow ?? undefined,
        maxOutputTokens: item.maxOutputTokens ?? undefined,
        reasoningEfforts: item.reasoningEfforts
          ? Object.fromEntries(Object.entries(item.reasoningEfforts).map(([level, value]) => [level, value === null ? null : value.trim()])) as ReasoningEfforts
          : item.reasoningEfforts,
      })),
    };
    await saveSettings(settings => {
      const existing = settings.customProviders;
      if (existing !== undefined && !Array.isArray(existing)) throw new Error("Định dạng cấu hình nhà cung cấp đã lưu không hợp lệ");
      if (languageProviders.some(item => item.id !== providerId && item.id.toLowerCase() === updatedProvider.id.toLowerCase())
        || existing?.some(item => typeof item?.id === "string" && item.id !== providerId && item.id.toLowerCase() === updatedProvider.id.toLowerCase())) {
        throw new Error("Provider ID đã tồn tại");
      }
      if (providerId && !existing?.some(item => item.id === providerId)) throw new Error("Nhà cung cấp không còn tồn tại");
      return { customProviders: providerId
        ? existing!.map(item => item.id === providerId ? { ...item, ...updatedProvider } : item)
        : [...(existing ?? []), updatedProvider] };
    });
    visible.value = false;
  } catch (error) {
    formError.value = error instanceof Error ? error.message : "Lưu thất bại, vui lòng thử lại; nội dung đã nhập vẫn được giữ";
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" scoped>
.customProviderForm {
  padding-right: 12px;

  .requestHeaders {
    .headersEditor {
      width: 100%;

      .headerRow {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr) auto;
        gap: 8px;
        margin-bottom: 8px;

        @media (max-width: 560px) {
          grid-template-columns: minmax(0, 1fr) auto;

          .headerName {
            grid-column: 1 / -1;
          }
        }
      }
    }
  }

  .formGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 20px;

    .el-input-number {
      width: 100%;
    }
  }

  .modelHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 8px 0 16px;
  }

  .modelList {
    .modelItem {
      padding: 8px 0;
      border-bottom: 1px solid var(--el-border-color-lighter);

      .modelRow {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 28px 28px;
        align-items: center;
        gap: 8px;

        .el-button {
          margin: 0;
          padding: 4px;
        }
      }

      .modelSettings {
        display: grid;
        gap: 16px;
        margin-top: 12px;
        padding: 16px;
        border-radius: var(--el-border-radius-base);
        background: var(--el-fill-color-light);

        .tokenSettings {
          .el-form-item {
            margin-bottom: 0;
          }
        }

        .reasoningMode {
          margin-bottom: 0;
        }

        .reasoningSettings {
          display: grid;
          gap: 12px;

          .reasoningChoices {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
            gap: 8px;

            .reasoningChoice {
              display: flex;
              justify-content: center;
              height: 32px;
              margin: 0;
              padding: 0 8px;
              background: var(--el-bg-color);
              border-color: var(--el-border-color);

              &.is-checked {
                border-color: var(--el-color-primary);
                background: var(--el-color-primary-light-9);
              }
            }
          }

          .reasoningMappings {
            display: grid;
            gap: 8px;

            .reasoningRow {
              display: grid;
              grid-template-columns: 112px minmax(0, 1fr);
              align-items: center;
              gap: 12px;

              .reasoningLevel {
                display: flex;
                align-items: center;
                gap: 8px;
                color: var(--el-text-color-primary);
                font-size: 13px;

                .reasoningKey {
                  color: var(--el-text-color-secondary);
                  font-size: 12px;
                }
              }

              @media (max-width: 420px) {
                grid-template-columns: minmax(0, 1fr);
                gap: 6px;
              }
            }
          }
        }
      }
    }
  }

  .manualAdd {
    width: 100%;
    margin: 16px 0;
  }

  @media (max-width: 560px) {
    .formGrid {
      grid-template-columns: 1fr;
    }
  }
}
.modelResults {
  height: min(420px, 55dvh);
  margin: 12px 0;
}
</style>
