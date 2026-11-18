/** Optional Vietnamese view of public prompt presets.
 * The source JSON is never edited: translations are content-addressed caches.
 * Only public preset text is sent to the translation service; personal copies
 * and workspace content are never submitted through this module.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { PromptItem } from "./index";

const translatorEndpoint = "https://translate.googleapis.com/translate_a/single";
const cacheRoot = () => resolve(process.env.TOONFLOW_DATA_DIR || resolve(import.meta.dirname, "../../../../../data"), "promptLibrary", "translations-vi");
const translationVersion = "vi-v1";
const inflight = new Map<string, Promise<string>>();

function cacheKey(original: string) {
  return createHash("sha256").update(translationVersion).update("\0").update(original).digest("hex");
}

function splitIntoChunks(text: string, maxLength = 2300): string[] {
  if (text.length <= maxLength) return [text];
  const result: string[] = [];
  let remaining = text;
  while (remaining.length) {
    if (remaining.length <= maxLength) { result.push(remaining); break; }
    let end = remaining.lastIndexOf("\n", maxLength);
    if (end < maxLength / 3) end = remaining.lastIndexOf(". ", maxLength);
    if (end < maxLength / 3) end = remaining.lastIndexOf(" ", maxLength);
    if (end < maxLength / 3) end = maxLength;
    else end += 1;
    result.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  return result;
}

async function fetchTranslatedText(text: string): Promise<string> {
  if (!text.trim()) return text;
  const params = new URLSearchParams({ client: "gtx", sl: "auto", tl: "vi", dt: "t", q: text });
  const response = await fetch(translatorEndpoint, {
    method: "POST", body: params, redirect: "error", signal: AbortSignal.timeout(16000),
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
  });
  if (!response.ok) throw new Error(`Dịch tự động đang không khả dụng (HTTP ${response.status}).`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) throw new Error("Dịch vụ không trả bản dịch hợp lệ.");
  const translated = payload[0].map((part: unknown) => Array.isArray(part) && typeof part[0] === "string" ? part[0] : "").join("");
  if (!translated.trim()) throw new Error("Bản dịch tiếng Việt đang trống.");
  return translated;
}

// Keep reference placeholders, URLs and fenced code exactly unchanged.
// Structured JSON is treated separately below to preserve syntax and keys.
const protectedPart = /(```[\s\S]*?```|\{\{[^{}]*\}\}|\{argument\s+[^{}]*\}|https?:\/\/[^\s<>"']+|\[[a-z][^\]\r\n]{0,70}\])/gi;
async function translateFreeText(original: string): Promise<string> {
  const tokens = original.split(protectedPart);
  const translated: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (i % 2 === 1 || !token.trim()) { translated.push(token); continue; }
    for (const chunk of splitIntoChunks(token)) translated.push(await fetchTranslatedText(chunk));
  }
  return translated.join("");
}

export async function translatePromptText(original: string): Promise<string> {
  if (!original.trim()) return original;
  if (original.length > 120000) throw new Error("Prompt quá dài để dịch tự động. Vẫn có thể xem bản gốc.");
  const trimmed = original.trim();
  if (trimmed[0] === "{" || trimmed[0] === "[") {
    try {
      const value: unknown = JSON.parse(original);
      let count = 0;
      const traverse = async (item: unknown): Promise<unknown> => {
        if (++count > 400) throw new Error("Prompt JSON có quá nhiều trường để dịch tự động.");
        if (typeof item === "string") return translateFreeText(item);
        if (Array.isArray(item)) return Promise.all(item.map(traverse));
        if (item && typeof item === "object") {
          const translated = await Promise.all(Object.entries(item).map(async ([key, val]) => [key, await traverse(val)] as const));
          return Object.fromEntries(translated);
        }
        return item;
      };
      return JSON.stringify(await traverse(value), null, 2);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      // Some sources are free text starting with '{'; translate normally.
    }
  }
  return translateFreeText(original);
}

export async function translateCached(original: string): Promise<string> {
  if (!original.trim()) return original;
  const digest = cacheKey(original);
  const cachedFile = join(cacheRoot(), `${digest}.json`);
  try {
    const cached = JSON.parse(await readFile(cachedFile, "utf8")) as { translated?: string };
    if (typeof cached.translated === "string" && cached.translated.trim()) return cached.translated;
  } catch { /* On cache miss, translate from the unchanged original. */ }
  if (inflight.has(digest)) return inflight.get(digest)!;
  const task = (async () => {
    const translated = await translatePromptText(original);
    await mkdir(cacheRoot(), { recursive: true });
    const temp = `${cachedFile}.${crypto.randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify({ translated }), { mode: 0o600 });
    await rename(temp, cachedFile);
    return translated;
  })().finally(() => inflight.delete(digest));
  inflight.set(digest, task);
  return task;
}

export async function translateTitle(item: PromptItem) { return translateCached(item.title); }
export async function translatePublicItem(item: PromptItem) {
  const [title, description, prompt] = await Promise.all([
    translateCached(item.title), translateCached(item.description), translateCached(item.prompt),
  ]);
  return { title, description, prompt };
}
