<template>
  <div class="providerList">
    <div class="itemList">
      <toonflowProviderCard scope="text" :provider="customProviders.find(item => item.id.toLowerCase() === 'toonflow')" />
      <el-card v-for="item in visibleProviders" :key="item.id" class="providerItem" shadow="never">
        <div class="providerHeader">
          <div v-if="item.icon" class="providerMark" aria-hidden="true">
            <img class="providerLogo" :src="item.icon" alt="" />
          </div>
          <div class="providerInfo">
            <div class="providerHeading">
              <el-text class="providerName" tag="strong">{{ item.label }}</el-text>
            </div>
            <el-text class="providerId" size="small" type="info" :title="item.id">{{ item.id }}</el-text>
          </div>
        </div>
        <div class="providerFooter">
          <div class="providerMeta">
            <el-tag v-if="getProviderVersion(item)" size="small" type="info" effect="plain">v{{ getProviderVersion(item) }}</el-tag>
            <el-text size="small" type="info">{{ item.models.length }} mô hình</el-text>
          </div>
          <el-space class="itemActions" wrap>
            <el-button text :icon="IconEdit" :disabled="!!deletingId || syncingMuse" @click="openCustomProvider(item)">Chỉnh sửa</el-button>
            <el-popconfirm title="Xóa nhà cung cấp cùng các mô hình đã thêm?" confirmButtonText="Xóa" cancelButtonText="Hủy" @confirm="deleteProvider(item.id)">
              <template #reference><el-button text type="danger" :icon="IconTrash" :loading="deletingId === item.id" :disabled="!!deletingId || syncingMuse">Xóa</el-button></template>
            </el-popconfirm>
          </el-space>
        </div>
      </el-card>
    </div>
    <div class="providerActions">
      <el-button class="addButton" :icon="IconPlus" :loading="syncingMuse" :disabled="!!deletingId" @click="addMuseModels">Lấy AI văn bản từ Muse2API</el-button>
      <el-button class="addButton" :icon="IconPlus" :disabled="syncingMuse" @click="openProvider">Thêm nhà cung cấp</el-button>
      <el-button class="addButton" :icon="IconSettings" :disabled="syncingMuse" @click="openCustomProvider()">Thêm nhà cung cấp tùy chỉnh</el-button>
    </div>
    <el-alert v-if="museError" type="error" :closable="true" :title="museError" @close="museError = ''" />
    <component :is="addProviderDialog" v-model="providerDialogVisible" />
    <component :is="addCustomProviderDialog" v-model="customProviderDialogVisible" :provider="editingProvider" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, shallowRef, type Component } from "vue";
import axios from "axios";
import { ElMessage } from "element-plus";
import { customProviders, saveSettings, settings, type CustomProvider, type CustomProviderModel } from "@/stores/settings";
import { IconPlus, IconSettings, IconEdit, IconTrash } from "@tabler/icons-vue";
import { languageProviders } from "@toonflow/providers";
import toonflowProviderCard from "../../toonflowProviderCard.vue";
import { museTextModels } from "./museCatalog";

defineProps<{ visible?: boolean }>();
const addProviderDialog = shallowRef<Component>();
const addCustomProviderDialog = shallowRef<Component>();
const providerDialogVisible = ref(false);
const customProviderDialogVisible = ref(false);
const editingProvider = ref<CustomProvider>();
const deletingId = ref("");
const syncingMuse = ref(false);
const museError = ref("");
const visibleProviders = computed(() => customProviders.value.filter(item => item.id.toLowerCase() !== "toonflow"));

async function addMuseModels() {
  if (syncingMuse.value || deletingId.value) return;
  museError.value = "";
  const stored = customProviders.value.find(item => item.id.toLowerCase() === "muse2api");
  const mediaConfig = (settings.value.mediaProviderConfigs as Record<string, Record<string, unknown>> | undefined)?.muse2Api;
  const apiKey = stored?.apiKey?.trim() || (typeof mediaConfig?.apiKey === "string" ? mediaConfig.apiKey.trim() : "");
  const apiUrl = stored?.apiUrl?.trim() || (typeof mediaConfig?.baseUrl === "string" ? mediaConfig.baseUrl.trim() : "");
  if (!apiKey || !apiUrl) {
    museError.value = "Chưa có API Muse2API. Hãy cấu hình Muse2API trong Mô hình ảnh/video trước, hoặc thêm nhà cung cấp Muse2API bằng API Key.";
    return;
  }
  syncingMuse.value = true;
  try {
    // Chỉ yêu cầu GET /v1/models ở phía backend; không gọi chat/completions, không tốn tác vụ AI.
    const { data } = await axios.post<{ code: number; message?: string; data: CustomProviderModel[] }>(
      "/api/providers/models", { apiUrl, apiKey, protocol: "openai-completions" },
      { headers: { "x-toonflow-workspace": "1" }, timeout: 35000 },
    );
    if (data.code !== 200 || !Array.isArray(data.data)) throw new Error(data.message || "Muse2API chưa trả về danh sách mô hình.");
    const incoming = museTextModels(data.data);
    if (!incoming.length) throw new Error("Muse2API chưa liệt kê mô hình văn bản phù hợp; không thêm mô hình ảnh/video vào danh sách chat.");
    let added = 0;
    await saveSettings(snapshot => {
      const providers = snapshot.customProviders;
      if (providers !== undefined && !Array.isArray(providers)) throw new Error("Cấu hình nhà cung cấp không hợp lệ.");
      const existing = (providers ?? []) as CustomProvider[];
      const previous = existing.find(item => item.id?.toLowerCase() === "muse2api");
      const known = new Set(previous?.models.map(item => item.id) ?? []);
      const updates = incoming.filter(item => !known.has(item.id));
      added = updates.length;
      const provider: CustomProvider = previous
        ? { ...previous, models: [...previous.models, ...updates] }
        : { id: "muse2Api", label: "Muse2API (Python / Go)", apiUrl, apiKey, protocol: "openai-completions", models: incoming };
      return { customProviders: previous
        ? existing.map(item => item.id === previous.id ? provider : item)
        : [...existing, provider] };
    });
    ElMessage.success(added ? `Đã thêm ${added} mô hình văn bản từ Muse2API.` : "Các mô hình Muse2API đã có trong danh sách.");
  } catch (error) {
    museError.value = axios.isAxiosError<{ message?: string }>(error)
      ? error.response?.data?.message || "Không tải được mô hình từ Muse2API. Kiểm tra kết nối và API Key."
      : error instanceof Error ? error.message : "Không thể thêm mô hình Muse2API.";
  } finally {
    syncingMuse.value = false;
  }
}

function getProviderVersion(provider: CustomProvider) {
  const version = languageProviders.find(item => item.id.toLowerCase() === provider.id.toLowerCase())?.version ?? provider.version;
  return typeof version === "string" ? version.trim() : "";
}

function openProvider() {
  addProviderDialog.value ??= defineAsyncComponent(() => import("./addProviderDialog.vue"));
  providerDialogVisible.value = true;
}

function openCustomProvider(provider?: CustomProvider) {
  if (provider?.id.toLowerCase() === "toonflow") return;
  addCustomProviderDialog.value ??= defineAsyncComponent(() => import("./addCustomProviderDialog.vue"));
  editingProvider.value = provider;
  customProviderDialogVisible.value = true;
}

async function deleteProvider(id: string) {
  if (id.toLowerCase() === "toonflow" || deletingId.value) return;
  deletingId.value = id;
  try {
    await saveSettings(settings => {
      const current = settings.customProviders;
      if (!Array.isArray(current)) throw new Error("配置格式错误");
      return { customProviders: current.filter(item => item?.id !== id) };
    });
  } catch { ElMessage.error("Không thể xóa nhà cung cấp. Hãy thử lại."); }
  finally { deletingId.value = ""; }
}
</script>

<style lang="scss" scoped src="../../providerList.scss"></style>
