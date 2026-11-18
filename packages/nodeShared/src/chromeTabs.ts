export type ChromeTabTarget = {
  tabId: number;
  provider: string;
  title?: string;
  url: string;
  documentToken: string;
  ready: boolean;
  blocked: boolean;
  busy: boolean;
  taskId?: string;
  outputKinds: ("text" | "image" | "video" | "audio")[];
};

export type ChromeOutputKind = ChromeTabTarget["outputKinds"][number];
export type ChromeServiceId = "museChrome" | "chatgptChrome" | "geminiChrome" | "claudeChrome" | "grokChrome" | "perplexityChrome";

const serviceLabels: Record<ChromeServiceId, string> = {
  museChrome: "Muse",
  chatgptChrome: "ChatGPT",
  geminiChrome: "Gemini",
  claudeChrome: "Claude",
  grokChrome: "Grok",
  perplexityChrome: "Perplexity",
};

export function chromeServiceId(model: { providerId: string; modelId: string }): ChromeServiceId | undefined {
  if (model.providerId !== "aiChrome") return;
  if (model.modelId === "museImage") return "museChrome";
  if (Object.hasOwn(serviceLabels, model.modelId)) return model.modelId as ChromeServiceId;
}

export function chromeTargetService(provider: string): ChromeServiceId | undefined {
  const value = provider.trim().toLowerCase();
  if (value === "muse" || value === "musechrome") return "museChrome";
  if (value === "chatgpt" || value === "chatgptchrome") return "chatgptChrome";
  if (value === "gemini" || value === "geminichrome") return "geminiChrome";
  if (value === "claude" || value === "claudechrome") return "claudeChrome";
  if (value === "grok" || value === "grokchrome") return "grokChrome";
  if (value === "perplexity" || value === "perplexitychrome") return "perplexityChrome";
}

export function chromeServiceLabel(service: ChromeServiceId) {
  return serviceLabels[service];
}

export function chromeTabLabel(tab: ChromeTabTarget) {
  if (tab.blocked) return "Bị chặn";
  if (tab.busy) return tab.taskId ? `Đang chạy · ${tab.taskId}` : "Đang chạy";
  return tab.ready ? "Sẵn sàng" : "Chưa sẵn sàng";
}

let pending: Promise<ChromeTabTarget[]> | undefined;
let cached: { tabs: ChromeTabTarget[]; at: number } | undefined;

export async function readChromeTabs(fresh = false): Promise<ChromeTabTarget[]> {
  if (!fresh && cached && Date.now() - cached.at < 2500) return cached.tabs;
  if (pending) return pending;
  pending = fetch("/api/aiChrome/status", {
    headers: { "x-toonflow-workspace": "1" },
    cache: "no-store",
  }).then(async response => {
    const body = await response.text();
    let payload: { code?: number; message?: string; data?: { connected?: boolean; targets?: unknown } };
    try { payload = JSON.parse(body); }
    catch { throw new Error("MacFlow không trả trạng thái tab Chrome hợp lệ. Hãy kiểm tra kết nối backend."); }
    if (!response.ok || !payload || payload.code !== 200 || !payload.data) throw new Error(payload?.message || "Không đọc được trạng thái các tab Chrome");
    // Chỉ công bố tab do extension đang kết nối xác nhận; không tự suy đoán từ URL.
    const tabs = payload.data.connected && Array.isArray(payload.data.targets) ? payload.data.targets : [];
    const result = tabs.filter((tab): tab is ChromeTabTarget => {
      if (!tab || typeof tab !== "object") return false;
      const item = tab as Partial<ChromeTabTarget>;
      return Number.isSafeInteger(item.tabId) && Number(item.tabId) >= 0
        && typeof item.provider === "string" && !!chromeTargetService(item.provider)
        && typeof item.url === "string" && typeof item.documentToken === "string" && !!item.documentToken
        && typeof item.ready === "boolean" && typeof item.blocked === "boolean" && typeof item.busy === "boolean"
        && Array.isArray(item.outputKinds);
    });
    cached = { tabs: result, at: Date.now() };
    return result;
  }).finally(() => { pending = undefined; });
  return pending;
}

export async function requireChromeTab(model: { providerId: string; modelId: string }, tabId: number | undefined, kind: ChromeOutputKind) {
  const service = chromeServiceId(model);
  if (!service) return;
  if (!Number.isSafeInteger(tabId) || tabId === undefined || tabId < 0) throw new Error("Hãy chọn tab Chrome trong menu AI Chrome trước khi gửi");
  const target = (await readChromeTabs(true)).find(item => item.tabId === tabId && chromeTargetService(item.provider) === service);
  if (!target) throw new Error("Tab Chrome đã chọn không còn kết nối; hãy chọn lại tab");
  if ((!target.ready && !target.busy) || target.blocked || !target.outputKinds.includes(kind)) throw new Error("Tab Chrome đã chọn chưa sẵn sàng cho tác vụ này; hãy kiểm tra rồi chọn lại");
}
