import { randomBytes, timingSafeEqual } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Router } from "express";
import u from "@/utils";
import { requireDirectModelAccess } from "@/utils/multiTenant/gateway";
import { fail, videoAffFetch } from "./config";

const router = Router();
const collectorRoutes = new Set([
  "POST /api/v1/products/ingest", "GET /api/v1/products/queue", "GET /api/v1/products/reference-queue",
  "GET /api/v1/products/export", "POST /api/v1/products/media/download",
]);
const extensionDownload = "/api/v1/extension/download";
const requestHeaders = ["accept", "content-type", "content-length", "range", "if-range", "if-none-match", "if-modified-since"];
const responseHeaders = ["content-type", "content-disposition", "content-range", "accept-ranges", "etag", "last-modified", "retry-after"];

router.use(async (req, res) => {
  requireDirectModelAccess();
  const [path] = req.url.split("?", 1);
  if (!path || !/^\/[a-zA-Z0-9_./-]*$/.test(path) || path.includes("//") || path.split("/").some(part => part === "." || part === "..")) {
    fail("Đường dẫn VideoAFF không hợp lệ.");
  }
  const reads = req.method === "GET" || req.method === "HEAD";
  const dashboard = path.startsWith("/dashboard/");
  const api = /^\/api\/v1\/(?:products(?:\/|$)|marketing\/creative-knowledge(?:\/|$)|notifications(?:\/|$)|ai-usage\/summary$|extension\/download$)/.test(path);
  if (!(dashboard && reads || api && (reads || ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)))) {
    fail("Không tìm thấy trang VideoAFF.", 404);
  }

  const headers = new Headers({ "accept-encoding": "identity" });
  for (const name of requestHeaders) {
    const value = req.get(name);
    if (value) headers.set(name, value);
  }

  const supplied = req.get("x-video-aff-collector");
  if (supplied !== undefined) {
    const expected = u.conf.get("videoAffCollectorToken");
    if (!collectorRoutes.has(`${req.method} ${path}`) || typeof expected !== "string" ||
      !/^[a-f0-9]{64}$/.test(supplied) || !/^[a-f0-9]{64}$/.test(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) fail("Tiện ích chưa kết nối với MacFlow này.", 403);
  } else {
    const origin = u.mcpControl.getAppOrigin(req);
    if (path === extensionDownload && req.method === "GET") {
      const stored = u.conf.get("videoAffCollectorToken");
      const token = typeof stored === "string" && /^[a-f0-9]{64}$/.test(stored) ? stored : randomBytes(32).toString("hex");
      if (token !== stored) u.conf.set("videoAffCollectorToken", token);
      headers.set("x-video-aff-collector-origin", origin);
      headers.set("x-video-aff-collector-token", token);
    }
  }

  const lifetime = new AbortController();
  const stop = () => lifetime.abort();
  res.once("close", stop);
  try {
    const hasBody = !reads && !!(req.get("content-length") || req.get("transfer-encoding"));
    const upstream = await videoAffFetch(req.url, {
      method: req.method, headers, body: hasBody ? Readable.toWeb(req) as ReadableStream<Uint8Array> : undefined,
      signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(300_000)]),
    }).catch(() => fail("VideoAFF chưa phản hồi. Hãy quay lại xưởng rồi thử lại.", 502));
    // No forwarding of upstream cookies or redirects to a separate host.
    res.status(upstream.status);
    for (const name of responseHeaders) {
      const value = upstream.headers.get(name);
      if (value) res.set(name, value);
    }
    const length = upstream.headers.get("content-length");
    if (length && !upstream.headers.has("content-encoding")) res.set("Content-Length", length);
    res.set("Cache-Control", dashboard && path.startsWith("/dashboard/assets/") && upstream.ok ? "private, max-age=31536000, immutable" : "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "same-origin");
    res.set("Content-Security-Policy", dashboard
      ? "frame-ancestors 'self'; object-src 'none'; base-uri 'none'; script-src 'self'; form-action 'self'"
      : "default-src 'none'; frame-ancestors 'none'");

    if (!upstream.body) res.end();
    else await pipeline(Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]), res);
  } catch (error) {
    if (!lifetime.signal.aborted) throw error;
  } finally {
    res.off("close", stop);
  }
});

export default router;
