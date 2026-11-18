/**
 * MacFlow's API client for independently managed AI-Bridge services.
 * We do not install, configure or inspect the custom bridge checkout.
 * Credentials for custom are owned by MacFlow's 0600 settings or its env.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import conf from "@/utils/conf";

export type BridgeSource = "original" | "custom";

const providerHosts: Record<string, readonly string[]> = {
  muse: ["muse.ai", "www.muse.ai"], chatgpt: ["chatgpt.com"], gemini: ["gemini.google.com"],
  claude: ["claude.ai"], grok: ["grok.com"], deepseek: ["chat.deepseek.com"],
  perplexity: ["www.perplexity.ai"], qwen: ["chat.qwen.ai", "chat.qwenlm.ai"],
  kimi: ["www.kimi.com"], zai: ["chat.z.ai"],
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function verifiedMediaTab(tab: unknown): boolean {
  if (!tab || typeof tab !== "object" || Array.isArray(tab)) return false;
  const t = tab as Record<string, unknown>;
  if (t.ready !== true || t.busy === true || typeof t.profileInstanceId !== "string"
    || !uuid.test(t.profileInstanceId) || !Number.isSafeInteger(t.tabId) || (t.tabId as number) < 0
    || typeof t.documentToken !== "string" || !uuid.test(t.documentToken)
    || typeof t.provider !== "string" || typeof t.url !== "string"
    || !Array.isArray(t.outputKinds)
    || !t.outputKinds.some(kind => kind === "image" || kind === "video")) return false;
  try {
    const url = new URL(t.url);
    return url.protocol === "https:" && !url.username && !url.password
      && (providerHosts[t.provider]?.includes(url.hostname) ?? false);
  } catch { return false; }
}

function configError(message: string): never {
  throw Object.assign(new Error(message), { status: 503 });
}
export function selectedBridgeSource(): BridgeSource {
  // An explicit choice in MacFlow wins over an older startup default.
  const value = conf.get("aiBridge")?.source ?? process.env.MACFLOW_AI_BRIDGE_SOURCE ?? "original";
  if (value !== "original" && value !== "custom") configError("Chỉ cho phép MACFLOW_AI_BRIDGE_SOURCE=original hoặc custom.");
  return value;
}
export function configureBridgeKey(apiKey: string, activate: boolean) {
  if (apiKey.length < 24 || apiKey.length > 256 || /\s/.test(apiKey))
    configError("API Key phải có từ 24 đến 256 ký tự và không có khoảng trắng.");
  const saved = conf.get("aiBridge") ?? {};
  // conf stores settings.json with mode 0600. No browser storage or log output.
  conf.set("aiBridge", { ...saved, customApiKey: apiKey, ...(activate ? { source: "custom" as const } : {}) });
}
export function bridgeConnection(source: BridgeSource = selectedBridgeSource()) {
  const custom = source === "custom";
  const origin = custom ? "http://127.0.0.1:4319" : "http://127.0.0.1:4320";
  return {
    source, origin, baseUrl: `${origin}/v1`,
    // Legacy Original uses its existing credential file until migration.
    // Custom never requires access to any file in the external AI-Bridge repo.
    apiKeyFile: custom ? undefined : join(homedir(), "Downloads", "AI-Bridge-Original-Data", "api-key"),
  };
}
function secret(file: string | undefined, supplied: string | undefined, label: string) {
  let value: string;
  try { value = (supplied || (file ? readFileSync(file, "utf8") : "")).trim(); }
  catch { return configError(`Không đọc được ${label} của AI-Bridge được chọn; giữ nguyên nguồn hiện tại.`); }
  if (value.length < 24 || value.length > 256 || /\s/.test(value))
    return configError(`${label} của AI-Bridge được chọn không hợp lệ.`);
  return value;
}
export function bridgeApiKey(source: BridgeSource = selectedBridgeSource()) {
  const c = bridgeConnection(source);
  const override = source === "custom" ? conf.get("aiBridge")?.customApiKey || process.env.MACFLOW_AI_BRIDGE_CUSTOM_API_KEY
    : process.env.MACFLOW_AI_BRIDGE_API_KEY;
  return secret(c.apiKeyFile, override, "API Key");
}

/** Local read-only probe. It never submits chat/media and cannot change source. */
export async function probeBridge(source: BridgeSource): Promise<{
  source: BridgeSource; origin: string; healthOk: boolean; authorized: boolean;
  connectedExtensions: number; readyTabs: number; canSelect: boolean;
}> {
  const c = bridgeConnection(source);
  let healthOk = false, authorized = false, connectedExtensions = 0, readyTabs = 0;
  try {
    const r = await fetch(`${c.origin}/health`, { signal: AbortSignal.timeout(3500), redirect: "error" });
    const data = await r.json().catch(() => null) as { ok?: unknown } | null;
    healthOk = r.ok && data?.ok === true;
  } catch { /* Offline: preserve active configuration. */ }
  if (healthOk) {
    try {
      const r = await fetch(`${c.origin}/api/bridge/status`, {
        headers: { Authorization: `Bearer ${bridgeApiKey(source)}` },
        signal: AbortSignal.timeout(3500), redirect: "error",
      });
      if (r.ok) {
        const data = await r.json() as { connected_extensions?: unknown; tabs?: unknown };
        authorized = true;
        connectedExtensions = typeof data.connected_extensions === "number" ? data.connected_extensions : 0;
        readyTabs = Array.isArray(data.tabs) ? data.tabs.filter(tab => !!tab && typeof tab === "object"
          && (tab as { ready?: boolean; busy?: boolean }).ready === true
          && (tab as { busy?: boolean }).busy !== true).length : 0;
      }
    } catch { /* No key, incompatible API or offline; never fall back to another key. */ }
  }
  return { source, origin: c.origin, healthOk, authorized, connectedExtensions,
    readyTabs, canSelect: healthOk && authorized && connectedExtensions > 0 && readyTabs > 0 };
}

/** Tests only read-only endpoints. Never sends a prompt or media request. */
export async function verifyCustomBridgeKey(apiKey: string): Promise<{
  apiOk: boolean; modelCount: number; statusOk: boolean;
  connectedExtensions: number; readyTabs: number; mediaReady: boolean; reason: string;
}> {
  const c = bridgeConnection("custom");
  const headers = { Authorization: `Bearer ${apiKey}` };
  const result = { apiOk: false, modelCount: 0, statusOk: false,
    connectedExtensions: 0, readyTabs: 0, mediaReady: false, reason: "" };
  const request = async (path: string, authenticated = true) => {
    const response = await fetch(`${c.origin}${path}`, {
      redirect: "error", signal: AbortSignal.timeout(5500),
      ...(authenticated ? { headers } : {}),
    });
    return response;
  };
  try {
    const health = await request("/health", false);
    if (!health.ok) { result.reason = "Máy chủ AI-Bridge cổng 4319 chưa sẵn sàng."; return result; }
    await health.body?.cancel();
  } catch {
    result.reason = "Không kết nối được máy chủ AI-Bridge tại cổng 4319.";
    return result;
  }
  try {
    const response = await request("/v1/models");
    if (response.status === 401 || response.status === 403) {
      result.reason = "API Key không đúng hoặc không có quyền truy cập máy chủ 4319.";
      await response.body?.cancel();
      return result;
    }
    if (!response.ok) {
      result.reason = `Không xác thực được API Key (HTTP ${response.status}).`;
      await response.body?.cancel();
      return result;
    }
    const body = await response.json() as { data?: unknown };
    if (!Array.isArray(body.data) || body.data.length < 1) {
      result.reason = "Máy chủ không trả danh sách model hợp lệ.";
      return result;
    }
    result.apiOk = true;
    result.modelCount = body.data.length;
  } catch {
    result.reason = "Không kiểm tra được API Key hoặc danh sách model.";
    return result;
  }
  try {
    const response = await request("/api/bridge/status");
    if (!response.ok) {
      result.reason = response.status === 404
        ? "API Key hợp lệ nhưng AI-Bridge 4319 thiếu /api/bridge/status; chưa thể chọn tab trong MacFlow."
        : `API Key hợp lệ nhưng chưa lấy được trạng thái extension (HTTP ${response.status}).`;
      await response.body?.cancel();
      return result;
    }
    const body = await response.json() as { connected_extensions?: unknown; extension_versions?: unknown; tabs?: unknown };
    if (!Array.isArray(body.tabs)) {
      result.reason = "Phiên bản AI-Bridge hiện tại chưa hỗ trợ xác minh tab.";
      return result;
    }
    result.statusOk = true;
    result.connectedExtensions = typeof body.connected_extensions === "number" ? body.connected_extensions : 0;
    result.readyTabs = body.tabs.filter(tab => !!tab && typeof tab === "object"
      && (tab as { ready?: boolean; busy?: boolean }).ready === true
      && (tab as { busy?: boolean }).busy !== true).length;
    const versions = Array.isArray(body.extension_versions) ? body.extension_versions : [];
    const currentExtensions = versions.length === result.connectedExtensions && versions.length > 0 && versions.every(value => {
      if (typeof value !== "string") return false;
      const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
      return !!match && (Number(match[1]) > 0 || Number(match[2]) >= 6);
    });
    result.mediaReady = result.connectedExtensions > 0 && result.readyTabs > 0 && currentExtensions
      && body.tabs.some(verifiedMediaTab);
    result.reason = result.mediaReady ? ""
      : result.connectedExtensions === 0 || result.readyTabs === 0
        ? "API Key hợp lệ nhưng chưa có extension và tab sẵn sàng; chưa chuyển kết nối."
        : "API Key hợp lệ, nhưng extension chưa xác minh khả năng tạo ảnh/video và phiên bản 0.6.0; chưa chuyển kết nối.";
  } catch {
    result.reason = "API Key hợp lệ nhưng extension chưa trả trạng thái tab.";
  }
  return result;
}
