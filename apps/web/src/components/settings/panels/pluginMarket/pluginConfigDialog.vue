<template>
  <el-dialog v-model="visible" :title="`${plugin.displayName} - cấu hình`" width="min(520px, 94vw)" alignCenter appendToBody destroyOnClose :closeOnClickModal="false" :closeOnPressEscape="!saving" :showClose="!saving" @closed="formApi = undefined">
    <form-create v-model="formValues" v-model:api="formApi" :rule="formRules" :option="formOptions" />
    <el-alert v-if="configError" :title="configError" type="error" :closable="false" showIcon />
    <template #footer>
      <el-button :disabled="saving" @click="visible = false">Hủy</el-button>
      <el-button type="primary" :loading="saving" :disabled="!canManage || !formApi" @click="saveConfig">Lưu</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import axios from "axios";
import { computed, ref, shallowRef, toRaw, watch } from "vue";
import formCreate, { type Api, type Options } from "@toonflow/provider-web/formCreate";
import { translateFormRules } from "@toonflow/i18n/vue";
import { ElMessage } from "element-plus";
import type { Plugin } from "./types";
import { extensionConfig, saveExtensionConfig } from "@/pages/workspace/panels/document/extensions";

const { plugin, canManage } = defineProps<{ plugin: Plugin; canManage: boolean }>();
const visible = defineModel<boolean>({ default: false });
const formApi = shallowRef<Api>();
const formRules = shallowRef<ReturnType<typeof formCreate.copyRules>>([]);
const formValues = ref<Record<string, unknown>>({});
const saving = ref(false);
const configError = ref("");
const formOptions = computed<Options>(() => ({ form: { labelPosition: "top", size: "small", disabled: saving.value }, submitBtn: false, resetBtn: false }));

watch(() => [visible.value, plugin], () => {
  if (!visible.value) return;
  formApi.value = undefined;
  formRules.value = translateFormRules(formCreate.copyRules(plugin.configRules ?? []));
  formValues.value = structuredClone(toRaw(plugin.config ?? {}));
  configError.value = "";
}, { immediate: true });

async function saveConfig() {
  if (!canManage || saving.value || !formApi.value) return;
  saving.value = true;
  configError.value = "";
  try {
    if (!(await formApi.value.validate().catch(() => false))) return;
    const path = plugin.type === "ext" ? "ext" : plugin.type === "node" ? "nodes" : "tools";
    if (plugin.type === "ext") {
      await saveExtensionConfig(plugin.name, formApi.value.formData());
      plugin.config = extensionConfig(plugin.name);
    } else {
      const { data } = await axios.put(`/api/${path}/save`, { name: plugin.name, config: formApi.value.formData() }, { headers: { "x-toonflow-workspace": "1" } });
      if (data.code !== 200) throw new Error(data.message || "Lưu cấu hình plugin thất bại");
      plugin.config = data.data;
    }
    if (plugin.type === "node") window.dispatchEvent(new Event("toonflow:node-config-updated"));
    visible.value = false;
    ElMessage.success("Đã lưu cấu hình plugin");
  } catch (error) {
    configError.value = axios.isAxiosError(error)
      ? error.response?.data?.message || "Lưu thất bại, vui lòng thử lại; nội dung đã nhập vẫn được giữ"
      : error instanceof Error ? error.message : "Lưu thất bại, vui lòng thử lại";
  } finally { saving.value = false; }
}
</script>
