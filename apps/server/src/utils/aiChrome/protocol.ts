import { z } from "zod";

export type ChromeDevice = { id: string; name: string; extensionId: string; tokenHash: string; pairedAt: number; mode?: "normal" | "vm" };
export type ChromeRelayConfig = { url: string; roomId: string; ticketHash: string; key: string; expiresAt: number | null };
export const chromeProtocolVersion = 7;
export const pairingCodePattern = /^(?:MC1\.[1-9]\d{0,4}\.[l4]\.[1-9]\d{0,4}\.\d{10}\.[a-f0-9]{24}|MVH\.[a-f0-9]{64})$/;
export const chromeKinds = ["text", "image", "video", "audio"] as const;
export type ChromeKind = typeof chromeKinds[number];
export const chromeProviders = ["muse", "chatgpt", "gemini", "claude", "grok", "perplexity"] as const;
export type ChromeProvider = typeof chromeProviders[number];
export const chromeModelIds: Record<ChromeProvider, string> = {
  muse: "museChrome", chatgpt: "chatgptChrome", gemini: "geminiChrome",
  claude: "claudeChrome", grok: "grokChrome", perplexity: "perplexityChrome",
};
const providerHosts: Record<ChromeProvider, readonly string[]> = {
  muse: ["muse.ai"], chatgpt: ["chatgpt.com", "chat.openai.com"], gemini: ["gemini.google.com"],
  claude: ["claude.ai"], grok: ["grok.com"], perplexity: ["perplexity.ai"],
};
export function isChromeProviderUrl(provider: ChromeProvider, address: string) {
  try {
    const url = new URL(address);
    return url.protocol === "https:" && !url.username && !url.password
      && providerHosts[provider].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}
export function providerForChromeModel(modelId: string): ChromeProvider | undefined {
  if (modelId === "museImage") return "muse";
  return chromeProviders.find(provider => chromeModelIds[provider] === modelId);
}
export const chromeMimeTypes = ["text/plain", "image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm", "audio/mpeg", "audio/wav", "audio/ogg", "audio/flac", "audio/mp4", "audio/webm"] as const;
const targetFields = z.strictObject({
  tabId: z.number().int().nonnegative(), provider: z.enum(chromeProviders),
  title: z.string().max(180).optional(),
  url: z.url().max(2048), documentToken: z.uuid(),
  outputKinds: z.array(z.enum(chromeKinds)).min(1).max(4),
  ready: z.boolean(), blocked: z.boolean(), busy: z.boolean(),
  taskId: z.uuid().optional(),
}).refine(target => isChromeProviderUrl(target.provider, target.url), "Tab AI Chrome không thuộc dịch vụ đã khai báo.");
export const clientMessage = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("pair"), code: z.string().max(2048).regex(pairingCodePattern), name: z.string().trim().min(1).max(80), protocolVersion: z.number().int().min(1).max(1000) }),
  z.strictObject({ type: z.literal("authenticate"), deviceId: z.uuid(), token: z.string().regex(/^[a-f0-9]{64}$/) }),
  z.strictObject({ type: z.literal("pong") }),
  z.strictObject({ type: z.literal("tabStatus"), targets: z.array(targetFields).max(25).refine(items => new Set(items.map(item => item.tabId)).size === items.length, "Trùng ID tab Chrome."), recoveryRequired: z.boolean().optional(),
    managedMuseTabIds: z.array(z.number().int().nonnegative()).max(5).refine(items => new Set(items).size === items.length, "Trùng tab Muse được quản lý.").optional() }),
  z.strictObject({ type: z.literal("museTabsManaged"), requestId: z.uuid(), tabIds: z.array(z.number().int().nonnegative()).max(5).refine(items => new Set(items).size === items.length), error: z.string().min(1).max(400).optional() }),
  z.strictObject({ type: z.literal("museNetworkVerified"), requestId: z.uuid(), ok: z.boolean(),
    proxyMode: z.enum(["fixed_servers", "pac_script", "direct", "system", "auto_detect", "unknown"]),
    countryCode: z.string().regex(/^[A-Z]{2}$/).optional(),
    ipHint: z.string().max(48).optional(),
    checkedAt: z.number().int().nonnegative(), error: z.string().min(1).max(400).optional() }),
  z.strictObject({ type: z.literal("fileAck"), requestId: z.uuid(), transferId: z.uuid(), sequence: z.number().int().min(-1).max(1024) }),
  z.strictObject({ type: z.literal("packageAck"), requestId: z.uuid(), requestHash: z.string().regex(/^[a-f0-9]{64}$/), phase: z.enum(["accepted", "ready"]) }),
  z.strictObject({ type: z.literal("stage"), requestId: z.uuid(), stage: z.enum(["referencesAttached", "submitted", "waitingResult"]) }),
  z.strictObject({ type: z.literal("navigation"), requestId: z.uuid(), documentToken: z.uuid(), fromUrl: z.url().max(2048), url: z.url().max(2048) }),
  z.strictObject({ type: z.literal("jobError"), requestId: z.uuid(), code: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/).optional(), error: z.string().min(1).max(1000) }),
  z.strictObject({ type: z.literal("resultStart"), requestId: z.uuid(), transferId: z.uuid(), size: z.number().int().positive().max(64 * 1024 * 1024), mimeType: z.enum(chromeMimeTypes), sha256: z.string().regex(/^[a-f0-9]{64}$/) }),
  z.strictObject({ type: z.literal("resultEnd"), requestId: z.uuid(), transferId: z.uuid() }),
]);
export type ClientMessage = z.infer<typeof clientMessage>;
export type ChromeTarget = Extract<ClientMessage, { type: "tabStatus" }>["targets"][number];
