<template>
  <div class="mcpPanel">
    <section class="settingSection" aria-labelledby="mcpEnabledTitle">
      <div class="settingHeader">
        <h3 id="mcpEnabledTitle">Bật MCP</h3>
        <el-switch :modelValue="mcpSettings.enabled" :loading="saving" aria-label="Bật MCP" @change="(value) => setEnabled(value === true)" />
      </div>
      <p class="description">Cho phép công cụ lập trình và Agent bên ngoài thao tác với Toonflow. Sau khi bật, hãy thêm cấu hình khách vào công cụ tương ứng.</p>
    </section>

    <section class="settingSection" aria-labelledby="mcpConnectionTitle">
      <div class="settingHeader">
        <h3 id="mcpConnectionTitle">Trạng thái kết nối</h3>
        <el-button text :icon="IconRefresh" :loading="loading" :disabled="saving" @click="refreshStatus">Làm mới</el-button>
      </div>
      <el-alert v-if="statusError" :title="statusError" type="error" :closable="false" showIcon />
      <template v-else-if="status">
        <div class="connectionState">
          <el-tag :type="status.enabled ? 'success' : 'info'" effect="plain">{{ status.enabled ? "Đã bật" : "Đã tắt" }}</el-tag>
          <span v-if="status.enabled">{{ status.connections.length }} giao diện đã kết nối</span>
        </div>
        <ul v-if="status.enabled && status.connections.length" class="connectionList">
          <li v-for="connection in status.connections" :key="connection.id">
            <span>{{ connection.state.directory || "Trang chủ" }}</span>
            <small v-if="connection.state.directory">{{ connection.state.panel === "document" ? "Tài liệu" : "Canvas" }}</small>
          </li>
        </ul>
      </template>
      <p class="description">Để thao tác Canvas và node, giao diện Toonflow phải được mở.</p>
    </section>

    <section class="settingSection" aria-labelledby="mcpEndpointTitle">
      <h3 id="mcpEndpointTitle">Địa chỉ dịch vụ</h3>
      <div class="portSetting">
        <label for="mcpPort">Cổng cục bộ ưu tiên</label>
        <el-input-number id="mcpPort" v-model="portDraft" :min="1" :max="65535" :precision="0" controlsPosition="right" size="small" :disabled="saving" />
        <el-button size="small" :loading="saving" :disabled="portDraft === undefined || portDraft === (status?.preferredPort ?? mcpSettings.port)" @click="savePort">Lưu</el-button>
      </div>
      <p class="description">Mặc định là cổng 10588; nếu bị chiếm, hệ thống tự chọn cổng tiếp theo. Sau khi lưu sẽ tự chuyển cổng MCP; nếu địa chỉ thay đổi, hãy sao chép lại cấu hình cho ứng dụng khách.</p>
      <el-input :modelValue="status?.endpoint ?? ''" dir="ltr" readonly aria-label="Địa chỉ dịch vụ MCP" />
      <p v-if="status?.port" class="description">Cổng đang lắng nghe cục bộ: {{ status.port }}</p>
      <p v-if="status?.port && status.port !== status.preferredPort && !status.error" class="description">Cổng ưu tiên {{ status.preferredPort }} đã bị chiếm, hệ thống chuyển sang {{ status.port }}.</p>
      <el-alert v-if="status?.error" class="listenerError" :title="status.error" type="error" :closable="false" showIcon />
      <div class="actions">
        <el-button :icon="IconCopy" :disabled="!mcpSettings.enabled || !status?.endpoint || saving" @click="copyConfig('http')">Sao chép cấu hình HTTP</el-button>
        <el-button v-if="status?.stdio" :icon="IconTerminal2" :disabled="!mcpSettings.enabled || saving" @click="copyConfig('stdio')">Sao chép cấu hình stdio</el-button>
      </div>
      <p class="description">Cấu hình HTTP chứa thông tin xác thực; chỉ cung cấp cho ứng dụng khách đáng tin cậy.</p>
    </section>

    <section class="settingSection" aria-labelledby="mcpSkillTitle">
      <h3 id="mcpSkillTitle">Toonflow Skill</h3>
      <p class="description">Hướng dẫn Agent bên ngoài phối hợp dùng công cụ Toonflow. Hãy cài SKILL.md vào thư mục kỹ năng của công cụ lập trình tương ứng.</p>
      <div class="actions">
        <el-button :icon="IconFileText" :loading="skillAction === 'view'" :disabled="!!skillAction" @click="handleSkill('view')">Xem Skill</el-button>
        <el-button :icon="IconCopy" :loading="skillAction === 'copy'" :disabled="!!skillAction" @click="handleSkill('copy')">Sao chép</el-button>
        <el-button :icon="IconDownload" :loading="skillAction === 'download'" :disabled="!!skillAction" @click="handleSkill('download')">Xuất Skill</el-button>
      </div>
    </section>

    <el-dialog v-model="skillVisible" title="Toonflow Skill" width="min(760px, calc(100vw - 32px))" alignCenter appendToBody>
      <div class="skillContent"><messageMarkdown :content="skillContent" /></div>
    </el-dialog>
    <el-dialog v-model="copyVisible" :title="`Sao chép ${copyTitle}`" width="min(680px, calc(100vw - 32px))" alignCenter appendToBody @opened="copyInput?.select()">
      <p class="copyHint">Trình duyệt không thể sao chép tự động; hãy chọn văn bản và sao chép thủ công.{{ copyHasCredential ? "Cấu hình này chứa thông tin xác thực; chỉ cung cấp cho ứng dụng khách đáng tin cậy." : "" }}</p>
      <el-input ref="copyInput" :modelValue="copyContent" type="textarea" dir="ltr" :autosize="{ minRows: 8, maxRows: 18 }" readonly :aria-label="copyTitle" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { translate } from "@toonflow/i18n/vue";
import { computed, onMounted, ref, watch } from "vue";
import axios from "axios";
import { ElMessage, type InputInstance } from "element-plus";
import { IconCopy, IconDownload, IconFileText, IconRefresh, IconTerminal2 } from "@tabler/icons-vue";
import { saveSettings, settings } from "@/stores/settings";
import saveFile from "@/lib/saveFile";
import { writeClipboardText } from "@/lib/clipboard";
import messageMarkdown from "@/components/messageMarkdown.vue";

type McpStatus = {
  enabled: boolean;
  connections: { id: string; state: { directory?: string; panel?: string; canvasId?: string } }[];
  endpoint: string | null;
  stdio: { command: string; args: string[] } | null;
  preferredPort: number;
  port: number | null;
  error: string | null;
};

const headers = { "x-toonflow-workspace": "1" };
const mcpSettings = computed(() => {
  const raw = settings.value.mcp;
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return {
    enabled: value.enabled === true,
    token: typeof value.token === "string" ? value.token : "",
    port: typeof value.port === "number" && Number.isInteger(value.port) && value.port >= 1 && value.port <= 65535 ? value.port : 10588,
  };
});
const portDraft = ref<number | undefined>(mcpSettings.value.port);
watch(() => mcpSettings.value.port, port => { portDraft.value = port; });
const status = ref<McpStatus>();
const statusError = ref("");
const loading = ref(false);
const saving = ref(false);
const skillContent = ref("");
const skillVisible = ref(false);
const skillAction = ref<"view" | "copy" | "download" | "">("");
const copyVisible = ref(false);
const copyContent = ref("");
const copyTitle = ref("");
const copyHasCredential = ref(false);
const copyInput = ref<InputInstance>();

function errorMessage(error: unknown) {
  return axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : translate("操作失败");
}

async function refreshStatus() {
  loading.value = true;
  statusError.value = "";
  try {
    const { data } = await axios.get<{ code: number; data: McpStatus; message?: string }>("/api/mcp/status", { headers });
    if (data.code !== 200) throw new Error(data.message || "Đọc trạng thái MCP thất bại");
    if (portDraft.value === (status.value?.preferredPort ?? mcpSettings.value.port)) portDraft.value = data.data.preferredPort;
    status.value = data.data;
  } catch (error) {
    statusError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

async function setEnabled(enabled: boolean) {
  saving.value = true;
  try {
    await saveSettings(current => {
      const raw = current.mcp;
      const mcp = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
      let token = typeof mcp.token === "string" ? mcp.token : "";
      if (enabled && !token) token = Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, "0")).join("");
      return { mcp: { ...mcp, enabled, token } };
    });
    await refreshStatus();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

async function savePort() {
  const port = portDraft.value;
  if (port === undefined || !Number.isInteger(port) || port < 1 || port > 65535) {
    ElMessage.error("Cổng phải là số nguyên từ 1 đến 65535");
    return;
  }
  saving.value = true;
  try {
    await saveSettings(current => {
      const raw = current.mcp;
      const mcp = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
      return { mcp: { ...mcp, port } };
    });
    await refreshStatus();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

async function copyConfig(transport: "http" | "stdio") {
  if (!status.value || !mcpSettings.value.enabled) return;
  const config = transport === "stdio" ? status.value.stdio : {
    url: status.value.endpoint,
    headers: { Authorization: `Bearer ${mcpSettings.value.token}` },
  };
  if (!config) return;
  await copyText(JSON.stringify({ mcpServers: { toonflow: config } }, null, 2), translate("MCP 配置"), transport === "http");
}

async function copyText(content: string, title: string, hasCredential = false) {
  try {
    await writeClipboardText(content);
    ElMessage.success(`${title}Đã sao chép`);
    return;
  } catch {
    // ACT: HTTP 页面或剪贴板权限受限时保留手动复制入口。
  }
  copyContent.value = content;
  copyTitle.value = title;
  copyHasCredential.value = hasCredential;
  copyVisible.value = true;
}

async function handleSkill(action: "view" | "copy" | "download") {
  skillAction.value = action;
  try {
    const readSkill = () => axios.get<Blob>("/api/mcp/skill", { headers, responseType: "blob" }).then(({ data }) => data);
    if (action === "download") {
      await saveFile(readSkill, "SKILL.md");
      return;
    }
    skillContent.value ||= await (await readSkill()).text();
    if (action === "view") skillVisible.value = true;
    else await copyText(skillContent.value, "Skill");
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    skillAction.value = "";
  }
}

onMounted(refreshStatus);
</script>

<style lang="scss" scoped>
.mcpPanel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 0 4px 8px;

  .settingSection {
    min-width: 0;

    h3 {
      margin: 0 0 12px;
      color: var(--el-text-color-primary);
      font-size: 14px;
      font-weight: 600;
    }

    .settingHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;

      h3 { margin: 0; }
    }

    .description {
      margin: 8px 0 0;
      color: var(--el-text-color-secondary);
      font-size: 12px;
      line-height: 1.6;
    }

    .portSetting {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;

      .el-input-number { width: 120px; }
    }

    .description + .el-input { margin-top: 12px; }

    .listenerError { margin-top: 8px; }

    .connectionState, .actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
      font-size: 13px;

      .el-button { margin-left: 0; }
    }

    .connectionList {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 0;
      margin: 12px 0 0;
      list-style: none;

      li {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        font-size: 12px;
        overflow-wrap: anywhere;

        small { flex-shrink: 0; color: var(--el-text-color-secondary); }
      }
    }
  }
}

.skillContent {
  max-height: 65vh;
  overflow: auto;
}

.copyHint {
  margin: 0 0 12px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
</style>
