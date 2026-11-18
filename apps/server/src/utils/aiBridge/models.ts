/** Built-in AI-Br text provider: read the real catalog, never require .ts imports. */
import { bridgeApiKey, bridgeConnection } from "@/utils/aiBridge/connection";

export type BrModel = { id: string; label: string; outputKinds: string[]; pinned: boolean };
const modelId = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const siteHosts: Record<string, string[]> = { chatgpt: ["chatgpt.com"], gemini: ["gemini.google.com"],
  grok: ["grok.com"], claude: ["claude.ai"], muse: ["muse.ai", "www.muse.ai"],
  deepseek: ["chat.deepseek.com"], perplexity: ["www.perplexity.ai"],
  qwen: ["chat.qwen.ai", "chat.qwenlm.ai"], kimi: ["www.kimi.com"], zai: ["chat.z.ai"] };

export async function fetchAiBrModels(signal?: AbortSignal): Promise<BrModel[]> {
  const { baseUrl } = bridgeConnection("custom");
  const response = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${bridgeApiKey("custom")}`, Accept: "application/json" },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5500)]) : AbortSignal.timeout(5500),
    redirect: "error", cache: "no-store",
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`AI-Br không xác thực hoặc không trả danh sách model (HTTP ${response.status}).`);
  }
  const data = await response.json() as { data?: unknown };
  if (!Array.isArray(data.data) || data.data.length > 2000) throw new Error("Danh sách model AI-Br không hợp lệ.");
  const seen = new Set<string>();
  return data.data.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    if (typeof entry.id !== "string" || !modelId.test(entry.id) || seen.has(entry.id)) return [];
    seen.add(entry.id);
    const raw = entry.outputKinds ?? entry.output_kinds ?? entry.capabilities;
    const outputKinds = Array.isArray(raw) ? raw.filter((v): v is string => ["text", "image", "video"].includes(String(v))) : [];
    if (typeof entry.type === "string" && ["text", "image", "video"].includes(entry.type) && !outputKinds.includes(entry.type)) outputKinds.push(entry.type);
    // Older AI-Br declares text-only bridge-* models without capability metadata.
    if (!outputKinds.length && /^bridge-(?!auto$|image$|video$)[a-z0-9-]+$/.test(entry.id)) outputKinds.push("text");
    const serverTarget = entry.target ?? entry.pinnedTarget ?? entry.pinned_target;
    const pinned = entry.pinned === true || entry.target_mode === "pinned"
      || !!serverTarget && typeof serverTarget === "object" && !Array.isArray(serverTarget)
        && uuid.test(String((serverTarget as Record<string, unknown>).profileInstanceId))
        && uuid.test(String((serverTarget as Record<string, unknown>).documentToken));
    return [{ id: entry.id, label: typeof entry.name === "string" && entry.name.trim()
      ? entry.name.slice(0, 150) : typeof entry.label === "string" && entry.label.trim()
        ? entry.label.slice(0, 150) : entry.id, outputKinds, pinned }];
  });
}

/** Validate an explicit Chrome tab before sending text; never use active-tab fallback. */
export async function verifyAiBrTextTarget(modelId: string, raw: string | undefined) {
  const catalog = await fetchAiBrModels();
  const model = catalog.find(item => item.id === modelId && item.outputKinds.includes("text"));
  if (!model) throw new Error("Model văn bản AI-Br không còn khả dụng hoặc đã bị tắt.");
  if (!raw) {
    if (!model.pinned) throw new Error("Hãy chọn tab AI-Br trong node hoặc ghim model vào tab tại Dashboard AI-Br trước khi gửi.");
    return undefined;
  }
  let values: unknown;
  try { values = JSON.parse(raw); } catch { throw new Error("Định danh tab AI-Br không hợp lệ."); }
  if (!Array.isArray(values) || values.length !== 4 || !uuid.test(values[0])
    || !Number.isSafeInteger(values[1]) || values[1] < 0 || !uuid.test(values[2]) || typeof values[3] !== "string")
    throw new Error("Định danh Profile/tab/phiên trang AI-Br không hợp lệ.");
  const target = { profileInstanceId: values[0] as string, tabId: values[1] as number,
    documentToken: values[2] as string, url: values[3] as string };
  const response = await fetch(`${bridgeConnection("custom").origin}/api/bridge/status`, {
    headers: { Authorization: `Bearer ${bridgeApiKey("custom")}` },
    redirect: "error", signal: AbortSignal.timeout(5500), cache: "no-store",
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`AI-Br chưa hỗ trợ xác minh phiên tab (HTTP ${response.status}).`);
  }
  const state = await response.json() as { tabs?: unknown };
  const tab = Array.isArray(state.tabs) ? state.tabs.find(item => !!item && typeof item === "object"
    && (item as Record<string, unknown>).profileInstanceId === target.profileInstanceId
    && (item as Record<string, unknown>).tabId === target.tabId
    && (item as Record<string, unknown>).documentToken === target.documentToken
    && (item as Record<string, unknown>).url === target.url
    && (item as Record<string, unknown>).ready === true
    && (item as Record<string, unknown>).busy === false) as Record<string, unknown> | undefined : undefined;
  if (!tab || typeof tab.provider !== "string" || !(Array.isArray(tab.outputKinds) && tab.outputKinds.includes("text")))
    throw new Error("Tab AI-Br đã đổi phiên, bận hoặc chưa xác nhận khả năng văn bản.");
  const matches = siteHosts[tab.provider];
  let url: URL;
  try { url = new URL(target.url); } catch { throw new Error("URL tab AI-Br không hợp lệ."); }
  if (!matches?.includes(url.hostname) || url.protocol !== "https:" || url.username || url.password)
    throw new Error("Tab AI-Br không thuộc website AI được nhận diện.");
  const specific = /^bridge-(chatgpt|gemini|grok|claude|muse|deepseek|perplexity|qwen|kimi|zai)$/.exec(modelId);
  if (specific && specific[1] !== tab.provider) throw new Error("Model AI-Br và tab AI đang chọn không khớp.");
  return target;
}

export async function getAiBrTextProvider() {
  const models = (await fetchAiBrModels()).filter(item => item.id !== "bridge-auto" && item.outputKinds.includes("text"));
  return {
    id: "aiBr", label: "AI-Br (OpenAI API)", apiUrl: bridgeConnection("custom").baseUrl,
    apiKey: bridgeApiKey("custom"), protocol: "openai-completions" as const,
    models: models.map(item => ({ id: item.id, label: item.label, reasoningEfforts: false as const })),
  };
}
