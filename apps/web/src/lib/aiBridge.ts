/** MacFlow's API-only AI-Bridge settings client. Never persist API keys in browser storage. */
export type BridgeProvider = { id: string; label: string };
export type BridgeTab = {
  profileInstanceId: string;
  tabId: number;
  provider: string;
  title?: string;
  url: string;
  documentToken: string;
  ready: boolean;
  busy: boolean;
  input_image_support?: boolean;
  outputKinds?: ("text" | "image" | "video" | "audio")[];
};
export type BridgeStatus = {
  connected_extensions: number;
  providers: BridgeProvider[];
  tabs: BridgeTab[];
};
export type BridgeConfig = {
  source: "original" | "custom" | "cloud";
  baseUrl: string;
  customBaseUrl?: string;
  apiKeyConfigured: boolean;
  customKeySaved: boolean;
};
export type BridgeConnectResult = {
  saved: boolean; activated: boolean; apiOk: boolean; modelCount: number;
  statusOk: boolean; connectedExtensions: number; readyTabs: number; mediaReady: boolean; reason: string;
};
export type BridgeSourceCheck = {
  source: "original" | "custom"; origin: string; healthOk: boolean; authorized: boolean;
  connectedExtensions: number; readyTabs: number; canSelect: boolean;
};
export type BridgeSources = { active: "original" | "custom"; original: BridgeSourceCheck; custom: BridgeSourceCheck };
export type BridgeDiagnostics = {
  baseUrl: string;
  healthOk: boolean;
  modelsOk: boolean;
  modelCount: number;
  modelIds?: string[];
  statusOk: boolean;
};

export function normalizeBridgeBaseUrl(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); }
  catch { throw new Error("Base URL phải là địa chỉ HTTPS đầy đủ hoặc HTTP trên localhost."); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.port === "4319";
  if (!(url.protocol === "https:" || url.protocol === "http:" && local)
    || url.username || url.password || url.search || url.hash) {
    throw new Error("Base URL chỉ hỗ trợ HTTPS hoặc HTTP localhost:4319, không có tài khoản, tham số hay dấu #.");
  }
  if (url.protocol === "http:") url.hostname = "127.0.0.1";
  return url.toString().replace(/\/$/, "");
}

type ResponseEnvelope<T> = { code?: number; data?: T; message?: string };
async function request<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", headers: { "x-toonflow-workspace": "1" }, signal });
  const raw = await response.text();
  let value: ResponseEnvelope<T> | T;
  try { value = JSON.parse(raw); }
  catch { throw new Error(`MacFlow không trả JSON hợp lệ (${url}).`); }
  if (!response.ok) throw new Error((value as ResponseEnvelope<T>).message || `Không kết nối được AI-Bridge (HTTP ${response.status}).`);
  if (value && typeof value === "object" && "code" in value) {
    const payload = value as ResponseEnvelope<T>;
    if (payload.code !== 200 || !payload.data) throw new Error(payload.message || "MacFlow từ chối truy cập AI-Bridge.");
    return payload.data;
  }
  return value as T;
}
export const readBridgeStatus = (signal?: AbortSignal) => request<BridgeStatus>("/api/aiBridge/status", signal);
export const readBridgeConfig = (signal?: AbortSignal) => request<BridgeConfig>("/api/aiBridge/config", signal);
export const readBridgeDiagnostics = (signal?: AbortSignal) => request<BridgeDiagnostics>("/api/aiBridge/diagnostics", signal);
export const readBridgeSources = (signal?: AbortSignal) => request<BridgeSources>("/api/aiBridge/sources", signal);
export async function connectCustomBridge(options: { apiKey?: string; baseUrl?: string }, signal?: AbortSignal): Promise<BridgeConnectResult> {
  const response = await fetch("/api/aiBridge/connect", {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", "x-toonflow-workspace": "1" },
    body: JSON.stringify(options), signal,
  });
  const payload = await response.json().catch(() => null) as ResponseEnvelope<BridgeConnectResult> | null;
  if (!response.ok || !payload || payload.code !== 200 || !payload.data)
    throw new Error(payload?.message || `Không thể cấu hình API Key (HTTP ${response.status}).`);
  return payload.data;
}

export function bridgeTabKey(tab: Pick<BridgeTab, "profileInstanceId" | "tabId" | "documentToken">): string {
  return JSON.stringify([tab.profileInstanceId, tab.tabId, tab.documentToken]);
}
export function bridgeProviderName(provider: string): string {
  return ({ muse: "Muse", chatgpt: "ChatGPT", gemini: "Gemini", claude: "Claude", grok: "Grok", deepseek: "DeepSeek", perplexity: "Perplexity", qwen: "Qwen", kimi: "Kimi", zai: "Z.ai" } as Record<string, string>)[provider] ?? provider;
}
