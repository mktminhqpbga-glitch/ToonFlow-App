import { Database } from "bun:sqlite";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

// Standalone Render Web Service; this process never opens Chrome or stores AI prompt/media on disk.
const port = Number(process.env.PORT || 3000);
const ownerKey = process.env.RELAY_OWNER_KEY || "";
if (ownerKey.length < 32) throw new Error("RELAY_OWNER_KEY must contain at least 32 random characters");
const db = new Database(process.env.RELAY_DB_PATH || "./chromeRelay.sqlite", { create: true });
db.exec("PRAGMA journal_mode=WAL");
db.exec("CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, name TEXT NOT NULL, tokenHash TEXT NOT NULL, createdAt INTEGER NOT NULL)");
const findDevice = db.query("SELECT id,name,tokenHash,createdAt FROM devices WHERE id = ?");
const listDevices = db.query("SELECT id,name,createdAt FROM devices ORDER BY createdAt DESC");
const createDevice = db.query("INSERT INTO devices (id,name,tokenHash,createdAt) VALUES (?, ?, ?, ?)");
const deleteDevice = db.query("DELETE FROM devices WHERE id = ?");
const renameDevice = db.query("UPDATE devices SET name = ? WHERE id = ?");
const hash = value => createHash("sha256").update(value).digest("hex");
const safeEquals = (a, b) => typeof a === "string" && typeof b === "string"
  && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const json = (value, status = 200) => Response.json(value, { status, headers: {
  "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
} });
const denied = () => json({ error: "Unauthorized" }, 401);
const pendingCodes = new Map();
const pendingRequests = new Map();
const connections = new Set();
const queues = new Map();
const seen = new Map();
const activePolls = new Map();
const activity = new Map();
let ownerSocket = null;
const maxFrameBytes = 24576;
const maxQueue = 12;
const maxConnections = 32;
const pairTtlMs = 5 * 60 * 1000;
const maxClientsPerMinute = 120;
const isUuid = x => typeof x === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const isToken = x => typeof x === "string" && /^[0-9a-f]{64}$/i.test(x);
const isId = x => isUuid(x);
const extensionOrigin = value => /^chrome-extension:\/\/[a-p]{32}$/.test(value || "");
const now = () => Date.now();

function authenticate(key, deviceId) {
  if (safeEquals(key, ownerKey)) return { role: "owner" };
  if (!isId(deviceId) || !isToken(key)) return null;
  const device = findDevice.get(deviceId);
  return device && safeEquals(device.tokenHash, hash(key)) ? { role: "device", deviceId: device.id } : null;
}
function authorize(request) {
  const token = /^Bearer (.+)$/i.exec(request.headers.get("authorization") || "")?.[1];
  const origin = request.headers.get("origin");
  if (origin && !extensionOrigin(origin)) return null;
  return token ? authenticate(token, request.headers.get("x-relay-device-id")) : null;
}
function cleanExpired() {
  for (const [id, p] of pendingCodes) if (p.expires < now()) pendingCodes.delete(id);
  for (const [id, p] of pendingRequests) if (p.expires < now()) pendingRequests.delete(id);
  for (const [id, t] of seen) if (t < now()) seen.delete(id);
}
function queueName(role, deviceId) { return role + ":" + deviceId; }
function getQueue(role, deviceId) {
  const key = queueName(role, deviceId);
  let queue = queues.get(key);
  if (!queue) queues.set(key, queue = new Map());
  return queue;
}
function allowedDevice(auth, id) {
  return isId(id) && (auth.role === "owner" ? !!findDevice.get(id) : auth.deviceId === id);
}
function deliver(role, deviceId) {
  const recipient = role === "owner" ? ownerSocket
    : [...connections].find(socket => socket.data.auth?.role === "device" && socket.data.auth.deviceId === deviceId);
  if (!recipient || recipient.readyState !== 1) return;
  const messages = [...getQueue(role, deviceId).values()].slice(0, maxQueue);
  for (const message of messages) recipient.send(JSON.stringify({ type: "frame", deviceId, frame: message }));
}
function sendFrame(auth, deviceId, frame) {
  if (!allowedDevice(auth, deviceId)) throw Error("Forbidden device");
  if (!frame || typeof frame !== "object" || !isUuid(frame.id) || !isUuid(frame.transferId)
    || !Number.isSafeInteger(frame.index) || !Number.isSafeInteger(frame.total)
    || frame.index < 0 || frame.total < 1 || frame.total > 10000 || frame.index >= frame.total
    || !/^[0-9a-f]{64}$/i.test(frame.sha256 || "")
    || !/^[a-zA-Z0-9+/]+={0,2}$/.test(frame.data || "") || frame.data.length > maxFrameBytes) throw Error("Invalid encrypted frame");
  const recipientRole = auth.role === "owner" ? "device" : "owner";
  const key = queueName(recipientRole, deviceId);
  const itemKey = key + ":" + frame.id;
  if (seen.has(itemKey)) return { accepted: true, duplicate: true };
  const queue = getQueue(recipientRole, deviceId);
  if (queue.size >= maxQueue) return { accepted: false, busy: true };
  seen.set(itemKey, now() + 10 * 60 * 1000);
  queue.set(frame.id, frame);
  deliver(recipientRole, deviceId);
  const listener = activePolls.get(key);
  listener?.();
  return { accepted: true };
}
function ackFrame(auth, deviceId, id) {
  if (!allowedDevice(auth, deviceId) || !isUuid(id)) throw Error("Forbidden acknowledgement");
  const queue = getQueue(auth.role, deviceId);
  queue.delete(id);
}
function online(id) {
  const live = [...connections].some(socket => socket.data.auth?.role === "device"
    && socket.data.auth.deviceId === id && socket.readyState === 1);
  return live || (activity.get(id) || 0) > now() - 45000;
}
function removeDevice(id) {
  deleteDevice.run(id);
  for (const socket of connections) if (socket.data.auth?.deviceId === id) socket.close(1008, "Device revoked");
  queues.delete(queueName("owner", id));
  queues.delete(queueName("device", id));
  activity.delete(id);
}
function parseJson(raw) {
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid request");
  return value;
}
async function body(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 50000) throw Error("Payload too large");
  const value = await request.text();
  if (value.length > 50000) throw Error("Payload too large");
  return parseJson(value);
}
function rateLimited(request) {
  const address = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]
    || "unknown";
  const value = activity.get("rate:" + address) || { timestamp: now(), count: 0 };
  if (now() - value.timestamp > 60000) { value.timestamp = now(); value.count = 0; }
  value.count++;
  activity.set("rate:" + address, value);
  return value.count > maxClientsPerMinute;
}
function allowCors(request) {
  const origin = request.headers.get("origin");
  if (!origin || !extensionOrigin(origin)) return {};
  return { "access-control-allow-origin": origin, "vary": "Origin",
    "access-control-allow-headers": "authorization, content-type, x-relay-device-id",
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS" };
}
async function poll(role, deviceId, request) {
  const queue = getQueue(role, deviceId);
  if (queue.size) return json({ messages: [...queue.values()].slice(0, maxQueue) });
  const key = queueName(role, deviceId);
  if (activePolls.has(key)) return json({ error: "Only one pending poll per channel" }, 409);
  const timeout = Math.max(1000, Math.min(20000, Number(new URL(request.url).searchParams.get("wait") || 20000)));
  return new Promise(resolve => {
    let finish;
    const timer = setTimeout(() => finish(), timeout);
    finish = () => {
      clearTimeout(timer); activePolls.delete(key);
      resolve(json({ messages: [...queue.values()].slice(0, maxQueue) }));
    };
    activePolls.set(key, finish);
    request.signal.addEventListener("abort", finish, { once: true });
  });
}
function replyCode(request, id, claim) {
  const pending = pendingRequests.get(id);
  if (!pending || !safeEquals(pending.claimHash, hash(claim || ""))) return denied();
  if (pending.expires < now()) { pendingRequests.delete(id); return json({ error: "Pairing expired" }, 410); }
  if (!pending.approved) return json({ state: "pending" });
  pendingRequests.delete(id);
  return json({ state: "approved", deviceId: pending.deviceId, deviceToken: pending.deviceToken });
}
async function endpoint(request, server) {
  cleanExpired();
  const url = new URL(request.url), path = url.pathname;
  const cors = allowCors(request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (rateLimited(request)) return json({ error: "Rate limited" }, 429);
  if (path === "/healthz") return json({ status: "ok" });
  if (path === "/v1/ws") {
    if (connections.size >= maxConnections) return json({ error: "Too many connections" }, 503);
    if (!server.upgrade(request, { data: { auth: null, timer: null } })) return json({ error: "Upgrade required" }, 426);
    return;
  }
  try {
    if (path === "/v1/pair/join" && request.method === "POST") {
      const input = await body(request);
      const code = pendingCodes.get(input.pairId);
      if (!code || code.expires < now() || pendingRequests.has(input.pairId)
        || !isUuid(input.pairId) || typeof input.name !== "string") return json({ error: "Pairing unavailable" }, 410);
      const name = input.name.trim().slice(0, 80);
      if (!name || name.length > 80) return json({ error: "Invalid name" }, 400);
      pendingCodes.delete(input.pairId);
      const claim = randomBytes(32).toString("hex");
      pendingRequests.set(input.pairId, { name, claimHash: hash(claim), expires: code.expires, approved: false });
      return json({ claim, pairId: input.pairId, state: "pending" });
    }
    if (path === "/v1/pair/claim" && request.method === "POST") {
      const input = await body(request);
      return replyCode(request, input.pairId, input.claim);
    }
    const auth = authorize(request);
    if (!auth) return denied();
    if (auth.role === "owner") {
      if (path === "/v1/owner/pair" && request.method === "POST") {
        const input = await body(request);
        if (!isUuid(input.pairId) || pendingCodes.has(input.pairId) || pendingRequests.has(input.pairId))
          return json({ error: "Invalid pairing ID" }, 400);
        if (pendingCodes.size + pendingRequests.size > 32) return json({ error: "Too many pending pairs" }, 429);
        pendingCodes.set(input.pairId, { expires: now() + pairTtlMs });
        return json({ pairId: input.pairId, expiresAt: now() + pairTtlMs });
      }
      if (path === "/v1/owner/pending" && request.method === "GET")
        return json({ pending: [...pendingRequests.entries()].filter(([, value]) => !value.approved)
          .map(([id, value]) => ({ pairId: id, name: value.name, expiresAt: value.expires })) });
      if (path === "/v1/owner/approve" && request.method === "POST") {
        const input = await body(request), pending = pendingRequests.get(input.pairId);
        if (!pending || pending.approved || pending.expires < now()) return json({ error: "No pending pairing" }, 409);
        const id = randomUUID(), token = randomBytes(32).toString("hex");
        createDevice.run(id, pending.name, hash(token), now());
        Object.assign(pending, { approved: true, deviceId: id, deviceToken: token });
        return json({ deviceId: id, name: pending.name });
      }
      if (path === "/v1/owner/devices" && request.method === "GET")
        return json({ devices: listDevices.all().map(device =>
          ({ id: device.id, name: device.name, online: online(device.id), createdAt: device.createdAt })) });
      if (path === "/v1/owner/rename" && request.method === "POST") {
        const input = await body(request);
        if (!isId(input.deviceId) || typeof input.name !== "string"
          || !input.name.trim() || input.name.length > 80) return json({ error: "Invalid device" }, 400);
        renameDevice.run(input.name.trim(), input.deviceId); return json({ ok: true });
      }
      if (path === "/v1/owner/revoke" && request.method === "POST") {
        const input = await body(request);
        if (!isId(input.deviceId)) return json({ error: "Invalid device" }, 400);
        removeDevice(input.deviceId); return json({ ok: true });
      }
    }
    const deviceId = auth.role === "owner" ? url.searchParams.get("deviceId") : auth.deviceId;
    if (path === "/v1/channel/poll" && request.method === "GET") {
      if (!allowedDevice(auth, deviceId)) return json({ error: "Invalid target device" }, 403);
      if (auth.role === "device") activity.set(deviceId, now());
      return poll(auth.role, deviceId, request);
    }
    if (path === "/v1/channel/send" && request.method === "POST") {
      const input = await body(request);
      const destination = auth.role === "owner" ? input.deviceId : auth.deviceId;
      const answer = sendFrame(auth, destination, input.frame);
      return json(answer, answer.busy ? 429 : 202);
    }
    if (path === "/v1/channel/ack" && request.method === "POST") {
      const input = await body(request);
      ackFrame(auth, auth.role === "owner" ? input.deviceId : auth.deviceId, input.id);
      return json({ ok: true });
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return json({ error: error?.message || "Bad request" }, 400);
  }
}
const relay = Bun.serve({
  hostname: "0.0.0.0", port,
  maxRequestBodySize: 65536,
  fetch: async (request, server) => {
    const response = await endpoint(request, server);
    if (!response) return undefined;
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(allowCors(request))) headers.set(name, value);
    return new Response(response.body, { status: response.status, headers });
  },
  websocket: {
    maxPayloadLength: 65536, idleTimeout: 90, sendPings: true,
    open(socket) {
      connections.add(socket);
      socket.data.timer = setTimeout(() => {
        if (!socket.data.auth) socket.close(1008, "Authentication timed out");
      }, 5000);
    },
    message(socket, raw) {
      let data;
      try { data = parseJson(String(raw)); } catch { socket.close(1008, "Invalid JSON"); return; }
      if (!socket.data.auth) {
        const auth = authenticate(data.key, data.deviceId);
        if (data.type !== "auth" || !auth || auth.role !== data.role) { socket.close(1008, "Unauthorized"); return; }
        if (auth.role === "owner") {
          if (ownerSocket && ownerSocket !== socket) { socket.close(1008, "Owner already connected"); return; }
          ownerSocket = socket;
        } else {
          const other = [...connections].find(item => item !== socket && item.data.auth?.deviceId === auth.deviceId);
          if (other) other.close(1008, "Reconnected");
          activity.set(auth.deviceId, now());
        }
        clearTimeout(socket.data.timer); socket.data.auth = auth;
        socket.send(JSON.stringify({ type: "ready", role: auth.role }));
        if (auth.role === "owner") {
          for (const device of listDevices.all()) deliver("owner", device.id);
        } else deliver("device", auth.deviceId);
        return;
      }
      const auth = socket.data.auth;
      try {
        if (data.type === "frame") {
          const id = auth.role === "owner" ? data.deviceId : auth.deviceId;
          const answer = sendFrame(auth, id, data.frame);
          socket.send(JSON.stringify({ type: "receipt", id: data.frame?.id, ...answer }));
        } else if (data.type === "ack") {
          ackFrame(auth, auth.role === "owner" ? data.deviceId : auth.deviceId, data.id);
        } else if (data.type === "ping") {
          socket.send(JSON.stringify({ type: "pong" }));
        } else throw Error("Invalid command");
      } catch (error) { socket.send(JSON.stringify({ type: "error", id: data.frame?.id, error: error.message })); }
    },
    close(socket) {
      clearTimeout(socket.data.timer);
      connections.delete(socket);
      if (socket === ownerSocket) ownerSocket = null;
    },
  },
});
console.log("Chrome Relay listening", relay.port, "database configured");
