/** Local image-prompt library: registry, stale-while-error JSON cache and editable personal copies. */
import { mkdir, readFile, writeFile, rename, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { downloadPublicFile } from "@/utils/workspace/download";

export type PromptItem = {
  sourceId: string; id: string; title: string; prompt: string; description: string;
  coverUrl: string; referenceImageUrls: string[]; tags: string[]; author: string;
  sourceUrl: string; imageModel: string; imageMode: string; createdAt: string;
  personalId?: string; originalKey?: string;
};
export type PromptSource = { id: string; name: string; url: string; homepage: string; enabled: boolean; builtIn: boolean; error?: string; updatedAt?: string; count?: number };
const BASE = "https://raw.githubusercontent.com/yukkcat/image-prompts/main/dist/sources";
const registry: [string, string, string][] = [
  ["banana-prompt-quicker", "Banana Prompt Quicker", "https://glidea.github.io/banana-prompt-quicker/"],
  ["davidwu-gpt-image2-prompts", "DavidWu GPT Image 2", "https://github.com/davidwuw0811-boop/awesome-gpt-image2-prompts"],
  ["freestylefly-gpt-image-2", "Freestylefly GPT Image 2", "https://github.com/freestylefly/awesome-gpt-image-2"],
  ["awesome-gpt-image", "Awesome GPT Image", "https://github.com/ZeroLu/awesome-gpt-image"],
  ["awesome-gpt4o-image-prompts", "Awesome GPT-4o", "https://github.com/ImgEdify/Awesome-GPT4o-Image-Prompts"],
  ["youmind-gpt-image-2", "YouMind GPT Image 2", "https://github.com/YouMind-OpenLab/awesome-gpt-image-2"],
  ["youmind-nano-banana-pro", "YouMind Nano Banana Pro", "https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts"],
];
export const defaults = registry.map(([id, name, homepage]): PromptSource => ({ id, name, homepage, url: `${BASE}/${id}.json`, enabled: true, builtIn: true }));
const folder = () => resolve(process.env.TOONFLOW_DATA_DIR || resolve(import.meta.dirname, "../../../../../data"), "promptLibrary");
const inFlight = new Map<string, Promise<void>>();
const sourceCache = new Map<string, PromptItem[]>();
let sourcesPromise: Promise<PromptSource[]> | undefined;
const urlOrEmpty = (value: unknown) => typeof value === "string" && /^https?:\/\//i.test(value) && value.length < 3000 ? value : "";
const string = (value: unknown, max = 200000) => typeof value === "string" ? value.slice(0, max) : "";
const strings = (v: unknown, max = 30) => Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map(x => x.slice(0, 150)))].slice(0, max) : [];
export const promptKey = (item: Pick<PromptItem, "sourceId" | "id">) => JSON.stringify([item.sourceId, item.id]);
export function normalizePrompt(sourceId: string, raw: unknown, index: number): PromptItem | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const value = raw as Record<string, unknown>;
  const prompt = string(value.prompt).trim();
  if (!prompt) return;
  // Preserve IDs from the upstream registry (even if they already contain sourceId:).
  const id = string(value.id, 250) || `${sourceId}:${index}`;
  return { sourceId, id, prompt, title: string(value.title, 300) || prompt.slice(0, 75),
    description: string(value.description, 8000), coverUrl: urlOrEmpty(value.coverUrl),
    referenceImageUrls: strings(value.referenceImageUrls, 16).map(urlOrEmpty).filter(Boolean),
    tags: strings(value.tags), author: string(value.author, 250), sourceUrl: urlOrEmpty(value.sourceUrl),
    imageModel: string(value.imageModel, 160), imageMode: string(value.imageMode, 160), createdAt: string(value.createdAt, 100) };
}
async function readJson<T>(name: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(join(folder(), name), "utf8")) as T; }
  catch { return fallback; }
}
async function saveJson(name: string, value: unknown) {
  await mkdir(folder(), { recursive: true });
  const file = join(folder(), name);
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value), { mode: 0o600 });
  await rename(temp, file);
}
export async function loadSources(): Promise<PromptSource[]> {
  if (!sourcesPromise) sourcesPromise = readJson<PromptSource[]>("sources.json", defaults).then(saved => {
    const byId = new Map(saved.map(s => [s.id, s]));
    return [...defaults.map(s => ({ ...s, enabled: byId.get(s.id)?.enabled ?? true })),
      ...saved.filter(s => !s.builtIn && !defaults.some(d => d.id === s.id))];
  }).catch(err => { sourcesPromise = undefined; throw err; });
  return sourcesPromise;
}
export async function saveSources(values: PromptSource[]) { sourcesPromise = Promise.resolve(values); await saveJson("sources.json", values); }
export async function cachedItems(source: PromptSource): Promise<PromptItem[]> {
  if (sourceCache.has(source.id)) return sourceCache.get(source.id)!;
  const cache = await readJson<PromptItem[]>(`cache-${source.id}.json`, []);
  sourceCache.set(source.id, cache);
  return cache;
}
function forbiddenIp(ip: string) {
  if (ip.includes(":")) return /^(?:fe80:|fc|fd|::|2001:db8:)/i.test(ip) || ip === "::1";
  const octets = ip.split(".").map(Number);
  return octets[0] === 0 || octets[0] === 10 || octets[0] === 127 || octets[0] >= 224 ||
    octets[0] === 192 && (octets[1] === 168 || octets[1] === 0) ||
    octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 ||
    octets[0] === 169 && octets[1] === 254 || octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127;
}
export async function validateSourceUrl(raw: string): Promise<string> {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.port || !url.hostname.includes(".") || url.hostname.length > 200) throw new Error("Nguồn JSON phải sử dụng URL HTTPS công khai.");
  if (isIP(url.hostname)) throw new Error("Không cho phép nguồn JSON là địa chỉ IP.");
  const records = await lookup(url.hostname, { all: true });
  if (!records.length || records.some(record => forbiddenIp(record.address))) throw new Error("Địa chỉ nguồn JSON thuộc mạng nội bộ hoặc không hợp lệ.");
  return url.href;
}
export async function refreshSource(source: PromptSource, force = false): Promise<void> {
  if (!source.enabled && !force) return;
  if (inFlight.has(source.id)) return inFlight.get(source.id)!;
  const work = (async () => {
    try {
      const cached = await cachedItems(source);
      const cacheFile = join(folder(), `cache-${source.id}.json`);
      const age = await stat(cacheFile).then(info => Date.now() - info.mtimeMs).catch(() => Infinity);
      if (!force && cached.length && age < 6 * 60 * 60 * 1000) return;
      await validateSourceUrl(source.url);
      // Reuse the app's hardened public-file downloader. It validates DNS and
      // pins the resolved public IP, preventing custom-source DNS rebinding and
      // private-network redirects while honoring a strict size/time limit.
      const bytes = await downloadPublicFile(source.url, { signal: AbortSignal.timeout(25000),
        maxBytes: 8 * 1024 * 1024, label: "JSON prompt", httpsOnly: true, accept: "application/json" });
      const text = bytes.toString("utf8");
      const raw: unknown = JSON.parse(text);
      const collection = Array.isArray(raw) ? raw : raw && typeof raw === "object" && !Array.isArray(raw)
        ? Object.values(raw).find(Array.isArray) : undefined;
      if (!Array.isArray(collection)) throw new Error("Nguồn không chứa mảng prompt hợp lệ.");
      const seen = new Set<string>();
      const items = collection.map((item, index) => normalizePrompt(source.id, item, index))
        .filter((item): item is PromptItem => !!item && !seen.has(promptKey(item)) && !!seen.add(promptKey(item)));
      if (!items.length) throw new Error("Nguồn không có prompt hợp lệ.");
      sourceCache.set(source.id, items);
      await saveJson(`cache-${source.id}.json`, items);
      source.updatedAt = new Date().toISOString(); source.count = items.length; source.error = "";
    } catch (error) { source.error = error instanceof Error ? error.message : "Không thể tải nguồn JSON"; }
  })().finally(() => inFlight.delete(source.id));
  inFlight.set(source.id, work);
  return work;
}
export async function loadCatalog(force = false) {
  const sources = await loadSources();
  await Promise.all(sources.filter(s => s.enabled).map(s => refreshSource(s, force)));
  return sources;
}
export async function personalItems(): Promise<PromptItem[]> { return readJson<PromptItem[]>("personal.json", []); }
export async function savePersonal(items: PromptItem[]) { await saveJson("personal.json", items); }
export async function favorites(): Promise<string[]> { return readJson<string[]>("favorites.json", []); }
export async function saveFavorites(items: string[]) { await saveJson("favorites.json", items); }
