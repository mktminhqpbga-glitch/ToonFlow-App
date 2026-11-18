import axios from "axios";
import { t, translate } from "@toonflow/i18n/vue";
import { ElMessage } from "element-plus";
import { invalidateNodeModels } from "@toonflow/nodes-scaffold/nodeAi";
import type { PluginInstallRequest, PluginInstallType } from "@toonflow/server/desktop";
import { confirmPluginInstall, pluginTypeLabels } from "./pluginInstallConfirmation";

declare global {
  interface WindowEventMap {
    "toonflow:install-plugin": CustomEvent<PluginInstallRequest>;
    "toonflow:plugin-installed": CustomEvent<{ type: PluginInstallType; name: string }>;
  }
}

export function registerDesktopProtocol() {
  const pending = new Set<string>();
  let queue = Promise.resolve();

  const handleInstall = (event: WindowEventMap["toonflow:install-plugin"]) => {
    const request = event.detail;
    if (!request || !Object.hasOwn(pluginTypeLabels, request.type) || typeof request.url !== "string" || typeof request.fileName !== "string") return;
    const key = `${request.type}:${request.url}`;
    if (pending.has(key)) return;
    if (pending.size >= 20) {
      ElMessage.warning("Có quá nhiều yêu cầu cài đặt đang chờ xác nhận; hãy thử lại sau");
      return;
    }
    pending.add(key);
    queue = queue.then(() => confirmInstall(request)).catch(error => {
      ElMessage.error(error instanceof Error ? error.message : "Cài plugin thất bại");
    }).finally(() => pending.delete(key));
  };
  window.addEventListener("toonflow:install-plugin", handleInstall);

  async function confirmInstall(request: PluginInstallRequest) {
    const url = new URL(request.url);
    const confirmed = await confirmPluginInstall({ name: request.fileName, type: request.type, source: url.origin + url.pathname });
    if (!confirmed) return;

    const loading = ElMessage({ message: "Đang cài plugin…", duration: 0 });
    try {
      const { data } = await axios.post("/api/desktop/plugins/install", { type: request.type, url: request.url }, {
        headers: { "x-toonflow-desktop": "1" },
        timeout: 60000,
      });
      if (data?.code !== 200) throw new Error(typeof data?.message === "string" && data.message.trim() ? data.message : "Phản hồi API cài đặt không hợp lệ, không thể xác nhận kết quả. Hãy kiểm tra danh sách plugin; nếu chưa cài, hãy khởi động lại hoặc cập nhật Toonflow rồi thử lại.");
      if (typeof data.data?.name !== "string" || !data.data.name.trim()) throw new Error("API cài đặt không trả về tên plugin hợp lệ; hãy kiểm tra danh sách plugin để xác nhận đã cài hay chưa.");
      if (request.type === "provider") invalidateNodeModels("media");
      window.dispatchEvent(new CustomEvent("toonflow:plugin-installed", { detail: { type: request.type, name: data.data.name } }));
      if (request.type === "ext") window.dispatchEvent(new CustomEvent("toonflow:ext-updated", { detail: { name: data.data.name } }));
      ElMessage({ type: "success", message: `${translate(pluginTypeLabels[request.type])} đã được cài đặt` });
    } catch (error) {
      let message = error instanceof Error ? error.message : translate("安装失败，请稍后重试");
      if (axios.isAxiosError(error)) {
        const response = error.response;
        const data = response?.data;
        if (typeof data?.message === "string" && data.message.trim()) {
          message = data.message;
          if (Array.isArray(data.data) && data.data.every((item: unknown) => typeof item === "string")) message += `: ${data.data.join("; ")}`;
        } else if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
          message = translate("安装请求等待超时，请先查看插件是否已安装，再重试");
        } else if (!response) {
          message = translate("无法连接 Toonflow 本机服务，请确认应用已正常运行后重试。");
        } else {
          message = t`安装接口返回异常（HTTP ${response.status}），请重启或更新 Toonflow 后重试。`;
        }
      }
      ElMessage({ type: "error", message: `${translate(pluginTypeLabels[request.type])} “${request.fileName}” cài đặt thất bại: ${message}`, duration: 10000, showClose: true });
    } finally {
      loading.close();
    }
  }
  return () => window.removeEventListener("toonflow:install-plugin", handleInstall);
}
