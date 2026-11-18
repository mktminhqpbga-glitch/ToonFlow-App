<template>
  <el-dialog v-model="visible" title="Thêm nhà cung cấp mô hình văn bản" width="min(860px, 94vw)" alignCenter appendToBody destroyOnClose :closeOnClickModal="false" :closeOnPressEscape="!saving" :showClose="!saving" @closed="resetForm">
    <div class="providerPicker">
      <aside class="providerSidebar" aria-label="Chọn nhà cung cấp">
        <button
          v-for="item in languageProviders"
          :key="item.id"
          class="providerItem"
          type="button"
          :disabled="saving"
          :aria-pressed="selectedProvider === item.id"
          @click="selectedProvider = item.id">
          <img v-if="item.icon" class="providerLogo" :src="item.icon" alt="" />
          <modelIcon v-else :model="item.id" :size="18" />
          <span>{{ item.label }}</span>
        </button>
      </aside>
      <el-scrollbar class="providerDetails">
        <section v-if="activeProvider" :key="selectedProvider" class="providerContent" :aria-label="activeProvider.label">
          <div class="providerHeader">
            <h3>{{ activeProvider.label }}</h3>
            <el-tag v-if="activeProvider.version" size="small" type="info" effect="plain">v{{ activeProvider.version }}</el-tag>
          </div>
          <messageMarkdown v-if="providerReadme" class="providerReadme" :content="providerReadme" />
          <el-divider v-if="providerReadme" contentPosition="left">Cấu hình kết nối</el-divider>
          <form-create v-model="formValues" v-model:api="formApi" :rule="providerRules" :option="formOptions" />
          <div class="modelHeader">
            <el-text tag="strong">Mô hình văn bản <el-text type="info">{{ models.length }}</el-text></el-text>
            <el-text v-if="fetching" type="info" size="small">Đang lấy từ API…</el-text>
            <el-button v-else-if="modelError" size="small" text :icon="IconRefresh" @click="modelRefresh++">Thử lại</el-button>
          </div>
          <el-alert v-if="modelError" :title="modelError" type="error" :closable="false" showIcon />
          <div v-else-if="models.length" class="modelList" :style="{ height: `${Math.min(280, models.length * 38 + 36)}px` }" aria-label="模型列表">
            <el-auto-resizer>
              <template #default="{ height, width }">
                <el-table-v2 :columns="modelColumns" :data="models" :width="width" :height="height" :rowHeight="38" :headerHeight="36" rowKey="id" fixed />
              </template>
            </el-auto-resizer>
          </div>
        <el-text v-else-if="!fetching" type="info" size="small">{{ formValues.apiKey ? 'API chưa trả về mô hình văn bản phù hợp.' : 'Nhập khóa kết nối để lấy danh sách mô hình.' }}</el-text>
          <el-text v-if="selectedProvider === 'muse2Api' && models.length" type="info" size="small">Danh sách lấy từ Muse2API; chỉ gồm ID văn bản đã xác định, không có model ảnh/video. Chưa thực hiện yêu cầu AI thử.</el-text>
          <el-alert v-if="formError" :title="formError" type="error" :closable="false" showIcon />
        </section>
      </el-scrollbar>
    </div>
    <template #footer>
      <el-button :disabled="saving" @click="visible = false">Hủy</el-button>
      <el-button type="primary" :loading="saving" :disabled="!activeProvider || fetching || !!modelError || !models.length" @click="addProvider">Thêm nhà cung cấp</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import axios from "axios";
import { IconRefresh } from "@tabler/icons-vue";
import formCreate, { type Api, type Options } from "@toonflow/provider-web/formCreate";
import { translateFormRules } from "@toonflow/i18n/vue";
import { languageProviders } from "@toonflow/providers";
import { modelIcon } from "@toonflow/model-icons";
import messageMarkdown from "@/components/messageMarkdown.vue";
import type { Column } from "element-plus";
import { saveSettings, settings, type CustomProviderModel } from "@/stores/settings";
import { museTextModels } from "./museCatalog";

const visible = defineModel<boolean>({ default: false });
const selectedProvider = ref<string>(languageProviders[0]?.id ?? "");
const formApi = shallowRef<Api>();
const formValues = ref<Record<string, unknown>>({});
const models = shallowRef<CustomProviderModel[]>([]);
const fetching = ref(false);
const modelError = ref("");
const modelRefresh = ref(0);
const modelColumns: Column[] = [
  { key: "id", dataKey: "id", title: "Mã mô hình", width: 220, flexGrow: 1 },
  { key: "label", dataKey: "label", title: "Tên hiển thị", width: 180, flexGrow: 1 },
];
const saving = ref(false);
const formError = ref("");
watch(selectedProvider, () => {
  formError.value = "";
  const config = (settings.value.mediaProviderConfigs as Record<string, Record<string, unknown>> | undefined)?.muse2Api;
  formValues.value = selectedProvider.value === "muse2Api" && config && typeof config.apiKey === "string"
    ? { apiUrl: typeof config.baseUrl === "string" ? config.baseUrl : "http://127.0.0.1:18610/v1", apiKey: config.apiKey }
    : {};
}, { flush: "sync" });
const activeProvider = computed(() => languageProviders.find(provider => provider.id === selectedProvider.value));
const providerReadme = computed(() => {
  const provider = activeProvider.value;
  return provider && "readme" in provider && typeof provider.readme === "string" ? provider.readme : "";
});
const formOptions = computed<Options>(() => ({ form: { labelPosition: "top", disabled: saving.value }, submitBtn: false, resetBtn: false }));
const providerRules = computed(() =>
  translateFormRules(formCreate.copyRules(activeProvider.value?.rules ?? [])),
);

watch(
  [visible, activeProvider, () => formValues.value.apiKey, () => formValues.value.apiUrl, modelRefresh],
  ([isVisible, provider, key], _previous, onCleanup) => {
    models.value = [];
    modelError.value = "";
    fetching.value = false;
    if (!isVisible || !provider) return;
    if (provider.models.length) {
      models.value = structuredClone(provider.models);
      return;
    }
    const apiKey = typeof key === "string" ? key.trim() : "";
    if (!apiKey) return;
    const controller = new AbortController();
    fetching.value = true;
    // ACT: 输入停顿后自动获取；输入变化时立即取消旧请求，避免逐字请求和结果串到新密钥。
    const timer = setTimeout(async () => {
      try {
        const { data } = await axios.post("/api/providers/models", {
          apiUrl: typeof formValues.value.apiUrl === "string" && formValues.value.apiUrl.trim() || provider.apiUrl,
          protocol: provider.protocol, apiKey,
        }, { signal: controller.signal, timeout: 35000, headers: { "x-toonflow-workspace": "1" } });
        if (controller.signal.aborted) return;
        if (data.code !== 200 || !Array.isArray(data.data)) throw new Error(data.message || "Không lấy được danh sách mô hình.");
        models.value = provider.id === "geminiWebToApi" ? data.data.filter((model: CustomProviderModel) =>
          /^gemini-/i.test(model.id) && !/(?:^|-)(?:image|video|music|canvas|audio)(?:-|$)/i.test(model.id))
          : provider.id === "muse2Api" ? museTextModels(data.data)
          : provider.id === "gemini" ? data.data.map((model: CustomProviderModel) => ({ ...model, id: model.id.replace(/^models\//, "") }))
            .filter((model: CustomProviderModel) => /^gemini-(?:\d+(?:\.\d+)?-(?:pro|flash)(?:-|$)|(?:pro|flash)-latest$)/.test(model.id)
              && !/(?:^|-)(?:image|tts|live|audio|transcribe)(?:-|$)/.test(model.id))
          : data.data;
        if (provider.id === "muse2Api" && !models.value.length) throw new Error("Muse2API chưa liệt kê mô hình văn bản được hỗ trợ.");
      } catch (error) {
        if (!controller.signal.aborted) modelError.value = axios.isAxiosError(error)
          ? error.response?.data?.message || (provider.id === "muse2Api"
            ? "Không lấy được mô hình. Kiểm tra API Key và địa chỉ Muse2API."
            : "Không lấy được mô hình. Kiểm tra API Key, địa chỉ API và kết nối mạng.")
          : error instanceof Error ? error.message : "Không lấy được danh sách mô hình.";
      } finally {
        if (!controller.signal.aborted) fetching.value = false;
      }
    }, 500);
    onCleanup(() => {
      clearTimeout(timer);
      controller.abort();
    });
  },
  { immediate: true, flush: "sync" },
);

function resetForm() {
  selectedProvider.value = languageProviders[0]?.id ?? "";
  formError.value = "";
  formApi.value = undefined;
  formValues.value = {};
}

async function addProvider() {
  if (saving.value || fetching.value || modelError.value || !models.value.length || !activeProvider.value || !formApi.value) return;
  formError.value = "";
  const provider = activeProvider.value;
  const values = formApi.value.formData();
  const apiKey = typeof values.apiKey === "string" ? values.apiKey.trim() : "";
  if (!apiKey) {
    formError.value = "Hãy nhập API Key.";
    return;
  }
  saving.value = true;
  try {
    const addedProvider = {
      id: provider.id,
      label: provider.label,
      icon: provider.icon,
      apiKey,
      apiUrl: typeof values.apiUrl === "string" ? values.apiUrl.trim() : "apiUrl" in provider ? provider.apiUrl : "",
      protocol: "protocol" in provider ? provider.protocol : "",
      models: models.value.map(model => ({ ...model })),
    };
    await saveSettings(settings => {
      const existing = settings.customProviders;
      if (existing !== undefined && !Array.isArray(existing)) throw new Error("Cấu hình nhà cung cấp đã lưu không hợp lệ.");
      if (existing?.some(item => typeof item?.id === "string" && item.id.toLowerCase() === provider.id.toLowerCase())) {
        throw new Error("Nhà cung cấp đã được thêm. Hãy chỉnh sửa trong danh sách.");
      }
      return { customProviders: [...(existing ?? []), addedProvider] };
    });
    visible.value = false;
  } catch (error) {
    formError.value = error instanceof Error ? error.message : "Lưu thất bại, hãy thử lại.";
  } finally { saving.value = false; }
}
</script>

<style lang="scss" scoped>
.providerPicker {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  height: min(560px, 70dvh);
  gap: 24px;

  .providerSidebar {
    overflow-y: auto;
    border-right: 1px solid var(--el-border-color-lighter);

    padding: 2px;

    .providerItem {
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
      text-align: left;
      cursor: pointer;

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

      .providerLogo {
        width: 18px;
        height: 18px;
        object-fit: contain;
      }
    }
  }

  .providerDetails {
    min-width: 0;

    .providerContent {
      padding-right: 12px;

      .providerHeader {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
        margin: 4px 0 24px;

        h3 {
          margin: 0;
          color: var(--el-text-color-primary);
          font-size: 18px;
          overflow-wrap: anywhere;
        }
      }

      .providerReadme {
        margin-bottom: 24px;
        overflow-wrap: anywhere;
      }

      .modelHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin: 8px 0 12px;
      }

      .modelList {
        margin-bottom: 16px;
      }
    }
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 16px;

    .providerSidebar {
      max-height: 128px;
      border-right: 0;
      border-bottom: 1px solid var(--el-border-color-lighter);
    }
  }
}
</style>
