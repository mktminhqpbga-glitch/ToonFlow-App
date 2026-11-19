import { createHash } from "node:crypto";
import { z } from "zod";
import conf from "@/utils/conf";
import { capabilitySchema, type Mac2ApiCapabilities, type Mac2ApiProvider } from "./contract";

type Connection = { baseUrl: string; apiKey: string };
type Discovery = {
  state: "verified" | "legacy" | "unverified";
  capabilities?: Mac2ApiCapabilities;
  modelIds: string[];
  healthOk?: boolean;
  readyOk?: boolean;
  httpStatus?: number;
};

const apiKeySchema = z.string().trim().regex(/^m2c_[A-Za-z0-9_.~-]{12,512}$/, "Hãy dùng khóa client m2c_ của mac2API.");
const discoveryCache = new Map<string, { expires: number; result: Promise<Discovery> }>();
function connectionError(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }

export function normalizeMac2ApiUrl(value: string) {
  let url: URL;
  try { url = new URL(value.trim()); }
  catch { return connectionError("Base URL mac2API không hợp lệ."); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:"))
    || url.username || url.password || url.search || url.hash || !["", "/v1"].includes(url.pathname.replace(/\/+$/, ""))) {
    return connectionError("Dùng HTTPS hoặc HTTP loopback, với Base URL gốc hoặc /v1.");
  }
  return `${url.origin}/v1`;
}

export function settingsStatus() {
  const saved = conf.get("mac2Api");
  return { baseUrl: saved?.baseUrl ?? "", keySaved: !!saved?.apiKey };
}

export function saveConnection(baseUrl: string, key?: string) {
  baseUrl = normalizeMac2ApiUrl(baseUrl);
  const existing = conf.get("mac2Api");
  const keyResult = apiKeySchema.safeParse(key || (existing?.baseUrl === baseUrl ? existing.apiKey : ""));
  if (!keyResult.success) connectionError("Hãy dùng khóa client m2c_ hợp lệ của mac2API.");
  conf.set("mac2Api", { baseUrl, apiKey: keyResult.data });
  discoveryCache.clear();
  return settingsStatus();
}

export function getConnection(providerId?: Mac2ApiProvider): Connection | undefined {
  const shared = conf.get("mac2Api");
  if (shared) return shared;
  const configs = conf.get("settings", {}).mediaProviderConfigs as Record<string, unknown> | undefined;
  const legacy = z.object({ baseUrl: z.string(), apiKey: apiKeySchema }).safeParse(providerId && configs?.[providerId]);
  if (legacy.success && legacy.data.baseUrl.trim()) {
    try { return { ...legacy.data, baseUrl: normalizeMac2ApiUrl(legacy.data.baseUrl) }; }
    catch { return undefined; }
  }
}

export function connectionKey(connection: Connection) {
  return createHash("sha256").update(connection.baseUrl).update("\0").update(connection.apiKey).digest("hex");
}

export function apiRequest(connection: Connection, path: string, options?: RequestInit, signal?: AbortSignal, timeout = 8000) {
  const url = new URL(path, connection.baseUrl);
  if (url.origin !== new URL(connection.baseUrl).origin) throw new Error("Địa chỉ mac2API khác nguồn đã cấu hình.");
  return fetch(url, {
    ...options,
    headers: { Accept: "application/json", ...options?.headers, Authorization: `Bearer ${connection.apiKey}` },
    redirect: "error",
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout),
  });
}

export async function readSmallJson(response: Response) {
  return JSON.parse(Buffer.from(await readBytes(response, 1024 * 1024)).toString("utf8")) as unknown;
}

export async function readBytes(response: Response, limit: number) {
  if (!response.body || Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel();
    throw new Error("Phản hồi mac2API rỗng hoặc vượt giới hạn dung lượng.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.length;
      if (total > limit) throw new Error("Phản hồi mac2API vượt giới hạn dung lượng.");
      chunks.push(chunk.value);
    }
  } finally { void reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (!total) throw new Error("Phản hồi mac2API rỗng.");
  return Buffer.concat(chunks, total);
}

async function probeHealth(connection: Connection, path: "/healthz" | "/readyz") {
  try {
    const response = await fetch(new URL(path, connection.baseUrl), { redirect: "error", signal: AbortSignal.timeout(3000), cache: "no-store" });
    await response.body?.cancel();
    return response.ok;
  } catch { return false; }
}

async function discover(connection: Connection): Promise<Discovery> {
  try {
    const response = await apiRequest(connection, "/v1/capabilities");
    if (response.ok) {
      const parsed = capabilitySchema.safeParse(await readSmallJson(response));
      if (!parsed.success) return { state: "unverified", modelIds: [] };
      return { state: "verified", capabilities: parsed.data, modelIds: parsed.data.models.map(model => model.id) };
    }
    await response.body?.cancel();
    if (![404, 405, 501].includes(response.status)) return { state: "unverified", modelIds: [], httpStatus: response.status };
    const [catalog, healthOk, readyOk] = await Promise.all([
      apiRequest(connection, "/v1/models"), probeHealth(connection, "/healthz"), probeHealth(connection, "/readyz"),
    ]);
    if (!catalog.ok) { await catalog.body?.cancel(); return { state: "unverified", modelIds: [], healthOk, readyOk, httpStatus: catalog.status }; }
    const models = z.object({ data: z.array(z.object({ id: z.string().max(200) })).max(200) }).safeParse(await readSmallJson(catalog));
    return { state: models.success ? "legacy" : "unverified", modelIds: models.data?.data.map(model => model.id) ?? [], healthOk, readyOk };
  } catch { return { state: "unverified", modelIds: [] }; }
}

export function discoverMac2Api(connection: Connection, fresh = false) {
  const key = connectionKey(connection);
  const now = Date.now();
  for (const [id, entry] of discoveryCache) if (entry.expires <= now) discoveryCache.delete(id);
  const cached = discoveryCache.get(key);
  if (!fresh && cached) return cached.result;
  const result = discover(connection);
  discoveryCache.set(key, { expires: now + 15000, result });
  return result;
}
