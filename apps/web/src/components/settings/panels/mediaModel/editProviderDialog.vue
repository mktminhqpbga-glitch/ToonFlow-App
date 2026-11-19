<template>
  <el-dialog
    v-model="visible"
    :title="`Sửa nhà cung cấp media: ${provider?.label ?? ''}`"
    width="min(800px, calc(100vw - 32px))"
    alignCenter
    appendToBody
    destroyOnClose
    :closeOnClickModal="false"
    :closeOnPressEscape="!saving"
    :showClose="!saving"
    @closed="formApi = undefined">
    <div class="providerEditor">
      <messageMarkdown v-if="provider?.readme" class="providerReadme" :content="provider.readme" />
      <form-create v-model="formValues" v-model:api="formApi" :rule="formRules" :option="formOptions" />
      <div class="modelHeader">
        <h4>Cấu hình mô hình <el-text type="info">{{ models.length }}</el-text></h4>
        <el-button :icon="IconPlus" size="small" :disabled="saving" @click="editModel()">Thêm thủ công</el-button>
      </div>
      <div class="modelList">
        <el-card v-for="(item, index) in models" :key="index" class="modelCard" shadow="never">
          <div class="topInfo">
            <div class="modelNameWrap">
              <modelIcon :model="item.id" :size="24" />
              <div class="modelInfo">
                <span class="modelName">{{ item.label }}</span>
                <el-text class="modelId" type="info" size="small">{{ item.id }}</el-text>
              </div>
            </div>
            <div class="actionButtons">
              <el-button v-if="usesStudioTest && (item.type === 'image' || item.type === 'video')" text size="small" :icon="IconPlayerPlay"
                :disabled="saving" :aria-label="`Thử mô hình ${item.label} trong xưởng`" @click="testModel(index)">Thử trong xưởng</el-button>
              <el-button v-else-if="!usesStudioTest" text size="small" :icon="IconPlayerPlay" :loading="loadingTestModel === index"
                :disabled="saving || loadingTestModel !== undefined || item.type === 'text'" :title="item.type === 'text' ? 'Tại đây hỗ trợ kiểm thử mô hình ảnh, video và âm thanh' : undefined"
                :aria-label="`Kiểm thử mô hình ${item.label}`" @click="testModel(index)">Kiểm thử</el-button>
            <el-button text size="small" :icon="IconEdit" :disabled="saving" :aria-label="`Sửa mô hình ${item.label}`" @click="editModel(index)">Sửa</el-button>
            <el-button text size="small" type="danger" :icon="IconTrash" :disabled="saving" :aria-label="`Xóa mô hình ${item.label}`" @click="models.splice(index, 1)">Xóa</el-button>
            </div>
          </div>
          <div class="modelTags">
            <el-tag size="small">{{ modelTypes[item.type] }}</el-tag>
            <el-tag v-for="(tag, tagIndex) in modelTags(item)" :key="tagIndex" size="small" type="info">{{ tag }}</el-tag>
          </div>
        </el-card>
        <el-text v-if="!models.length" type="info">Chưa có mô hình</el-text>
      </div>
    </div>
    <el-alert v-if="formError" class="formError" :title="formError" type="error" :closable="false" showIcon />
    <template #footer>
      <el-button :disabled="saving" @click="visible = false">Hủy</el-button>
      <el-button type="primary" :icon="IconDeviceFloppy" :loading="saving" :disabled="!formApi" @click="saveModels">Lưu</el-button>
    </template>
    <component
      :is="modelEditorDialog"
      v-model="modelEditorVisible"
      :model="editingModelIndex === undefined ? undefined : models[editingModelIndex]"
      :models="models"
      @confirmed="confirmModel" />
  </el-dialog>
  <el-dialog v-model="testVisible" :title="`Kiểm tra mô hình media: ${testProvider?.label ?? ''}`" width="min(1120px, calc(100vw - 32px))" alignCenter appendToBody destroyOnClose :closeOnClickModal="false">
    <div class="modelTestBody">
      <providerTestPanel v-if="testVisible && testProvider" :source="testSource" :provider="testProvider" :config="testConfig" :modelId="testModelId" :models="testProvider.models" />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { translate } from "@toonflow/i18n/vue";

import axios from "axios";
import { computed, defineAsyncComponent, onBeforeUnmount, ref, shallowRef, toRaw, watch, type Component } from "vue";
import { isNavigationFailure, NavigationFailureType, useRouter } from "vue-router";
import { IconPlus, IconTrash, IconDeviceFloppy, IconEdit, IconPlayerPlay } from "@tabler/icons-vue";
import formCreate, { type Api, type Options } from "@toonflow/provider-web/formCreate";
import { modelIcon } from "@toonflow/model-icons";
import messageMarkdown from "@/components/messageMarkdown.vue";
import type { MediaProvider, MediaProviderModel } from "@toonflow/provider-web/types";
import { settings, saveSettings } from "@/stores/settings";
import { invalidateNodeModels } from "@toonflow/nodes-scaffold/nodeAi";
import providerTestPanel from "./providerTestPanel.vue";

const { provider } = defineProps<{ provider?: MediaProvider }>();
const modelEditorDialog = shallowRef<Component>();
const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ saved: [provider: MediaProvider]; studioOpened: [] }>();
const router = useRouter();
const usesStudioTest = computed(() => !!provider && ["mac2ApiMuse", "mac2ApiChatGpt", "mac2ApiGemini"].includes(provider.id));
const models = ref<MediaProviderModel[]>([]);
const modelEditorVisible = ref(false);
const editingModelIndex = ref<number>();
const saving = ref(false);
const formApi = shallowRef<Api>();
const formRules = shallowRef<ReturnType<typeof formCreate.copyRules>>([]);
const formValues = ref<Record<string, unknown>>({});
const formOptions = computed<Options>(() => ({ form: { labelPosition: "top", disabled: saving.value }, appendValue: false, submitBtn: false, resetBtn: false }));
const revision = ref("");
const formError = ref("");
const testVisible = ref(false);
const loadingTestModel = ref<number>();
const testModelId = ref("");
const testProvider = shallowRef<MediaProvider>();
const testSource = ref("");
const testConfig = ref<Record<string, unknown>>({});
let testLoading: AbortController | undefined;
const modelTypes = { get image() { return translate("图片"); }, get video() { return translate("视频"); }, get audio() { return translate("音频"); }, get text() { return translate("文本"); } };
const modeLabels: Record<string, string> = {
  singleImage: "Tham chiếu 1 ảnh", multiReference: "Tham chiếu nhiều ảnh", startEndRequired: "Bắt buộc khung đầu và cuối",
  endFrameOptional: "Có thể chọn khung cuối", startFrameOptional: "Có thể chọn khung đầu",
  imageReference: "Tham chiếu ảnh", videoReference: "Tham chiếu video", audioReference: "Tham chiếu âm thanh",
};

watch(visible, isVisible => {
  testLoading?.abort();
  testLoading = undefined;
  loadingTestModel.value = undefined;
  testVisible.value = false;
  if (!isVisible) return;
  formError.value = "";
  modelEditorVisible.value = false;
  editingModelIndex.value = undefined;
  const configs = settings.value.mediaProviderConfigs as Record<string, Record<string, unknown>> | undefined;
  formRules.value = formCreate.copyRules(provider?.rules ?? []);
  formValues.value = structuredClone(toRaw((provider && configs?.[provider.id]) ?? {}));
  revision.value = provider?.revision ?? "";
  models.value = JSON.parse(JSON.stringify(provider?.models ?? []));
}, { immediate: true });
onBeforeUnmount(() => testLoading?.abort());

async function testModel(index: number) {
  const model = models.value[index];
  if (saving.value || loadingTestModel.value !== undefined || !provider || !model || model.type === "text") return;
  formError.value = "";
  if (usesStudioTest.value) {
    if (model.type !== "image" && model.type !== "video") return;
    try {
      const failure = await router.push({ path: `/${model.type}`, query: { providerId: provider.id, modelId: model.id } });
      if (failure && !isNavigationFailure(failure, NavigationFailureType.duplicated)) throw failure;
      visible.value = false;
      emit("studioOpened");
    } catch {
      formError.value = "Không thể mở xưởng để kiểm thử mô hình. Vui lòng thử lại.";
    }
    return;
  }
  const controller = new AbortController();
  testLoading = controller;
  loadingTestModel.value = index;
  try {
    const currentProvider = { ...provider, models: JSON.parse(JSON.stringify(models.value)) as MediaProviderModel[] };
    const currentRevision = revision.value;
    const config = structuredClone(toRaw(formApi.value?.formData() ?? formValues.value));
    const modelId = model.id;
    const { data } = await axios.get<{ code: number; data: { source: string; revision: string }; message?: string }>("/api/providers/media/source", {
      params: { fileName: currentProvider.fileName }, headers: { "x-toonflow-workspace": "1" }, signal: controller.signal,
    });
    if (controller.signal.aborted) return;
    if (data.code !== 200 || !data.data) throw new Error(data.message || "Đọc mã nhà cung cấp thất bại");
    if (data.data.revision !== currentRevision) throw new Error("Mã nhà cung cấp đã thay đổi, hãy mở lại hộp thoại chỉnh sửa trước khi kiểm tra");
    testSource.value = data.data.source;
    testProvider.value = currentProvider;
    testConfig.value = config;
    testModelId.value = modelId;
    testVisible.value = true;
  } catch (error) {
    if (!controller.signal.aborted) formError.value = axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : "Đọc mã nhà cung cấp thất bại";
  } finally {
    if (testLoading === controller) { testLoading = undefined; loadingTestModel.value = undefined; }
  }
}

function modelTags(model: MediaProviderModel) {
  const modes = Array.isArray(model.mode) ? model.mode.flat().filter((mode): mode is string => typeof mode === "string") : [];
  return modes.map(mode => {
    if (mode === "text") return model.type === "image" ? translate("文生图") : translate("文生视频");
    const reference = /^(imageReference|videoReference|audioReference):(\d+)$/.exec(mode);
    return reference ? `${modeLabels[reference[1]!]} ×${reference[2]}` : modeLabels[mode] ?? mode;
  });
}

function editModel(index?: number) {
  modelEditorDialog.value ??= defineAsyncComponent(() => import("@toonflow/provider-web/modelEditor"));
  editingModelIndex.value = index;
  modelEditorVisible.value = true;
}

function confirmModel(model: MediaProviderModel) {
  const index = editingModelIndex.value;
  if (index === undefined) models.value.push(model);
  else models.value.splice(index, 1, model);
}

async function saveModels() {
  if (saving.value || !provider || !formApi.value) return;
  const { id: providerId, fileName } = provider;
  formError.value = "";
  let modelsSaved = false;
  let configSaved = false;
  saving.value = true;
  try {
    if (!(await formApi.value.validate().then(() => true, () => false))) return;
    const config = formApi.value.formData();
    if ("apiKey" in config) {
      config.apiKey = typeof config.apiKey === "string" ? config.apiKey.trim() : "";
      if ((config.apiKey as string).length > 8192) throw new Error("API Key quá dài");
    }
    const ids = new Set<string>();
    const values = models.value.map((item, index) => {
      const id = item.id.trim();
      const label = item.label.trim();
      if (!id || !label) throw new Error(`Vui lòng điền mô hình thứ ${index + 1} - ID và tên hiển thị`);
      if (ids.has(id)) throw new Error(`ID mô hình trùng lặp: ${id}`);
      ids.add(id);
      return { ...item, id, label };
    });
    const { data } = await axios.put<{ code: number; data: MediaProvider; message?: string }>("/api/providers/media/save", {
      fileName, revision: revision.value, models: values,
    });
    if (data.code !== 200 || !data.data) throw new Error(data.message || "Lưu mô hình thất bại");
    revision.value = data.data.revision;
    modelsSaved = true;
    invalidateNodeModels("media");
    await saveSettings(settings => {
      const configs = settings.mediaProviderConfigs as Record<string, Record<string, unknown>> | undefined;
      if (configs !== undefined && (!configs || typeof configs !== "object" || Array.isArray(configs))) throw new Error("Cấu hình nhà cung cấp media không hợp lệ");
      const current = configs?.[providerId];
      if (current !== undefined && (!current || typeof current !== "object" || Array.isArray(current))) throw new Error("Cấu hình nhà cung cấp hiện tại không hợp lệ");
      if (Object.entries(config).every(([field, value]) => JSON.stringify(value) === JSON.stringify(current?.[field]))) return;
      return { mediaProviderConfigs: { ...configs, [providerId]: { ...current, ...config } } };
    });
    configSaved = true;
    const response = await axios.get<{ code: number; data: MediaProvider[]; message?: string }>("/api/providers/media/list");
    if (response.data.code !== 200 || !Array.isArray(response.data.data)) throw new Error(response.data.message || "Đọc mô hình mới nhất thất bại");
    const latest = response.data.data.find(item => item.fileName === fileName);
    if (!latest) throw new Error("Nhà cung cấp không còn tồn tại");
    revision.value = latest.revision;
    emit("saved", latest);
    visible.value = false;
  } catch (error) {
    const message = axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : translate("保存失败，请重试");
    formError.value = configSaved ? `Đã lưu mô hình và cấu hình kết nối, nhưng không đọc được mô hình mới nhất: ${message}. Hãy mở lại trình chỉnh sửa.`
      : modelsSaved ? `Đã lưu mô hình nhưng chưa lưu cấu hình kết nối: ${message}. Nội dung đã nhập vẫn được giữ, vui lòng thử lại.` : message;
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" scoped>
.providerEditor {
  max-height: 65dvh;
  padding: 8px 4px;
  overflow-y: auto;
  overscroll-behavior: contain;

  .providerReadme { margin-bottom: 20px; }

  .modelHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;

    h4 { margin: 0; }
  }

  .modelList {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .modelCard {
      .topInfo {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;

        .modelNameWrap {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;

          .modelInfo {
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 0;
            overflow-wrap: anywhere;

            .modelName { font-size: 15px; font-weight: 600; }
            .modelId { align-self: flex-start; }
          }
        }

        .actionButtons {
          display: flex;
          flex-shrink: 0;
          margin-left: auto;
        }
      }

      .modelTags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 16px;
      }
    }
  }
}

.formError { margin-top: 16px; }
.modelTestBody { height: min(660px, calc(100dvh - 160px)); min-height: 0; }
</style>
