import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Server } from "node:http";
import type { Request } from "express";
import { WebSocket, WebSocketServer } from "ws";
import conf from "@/utils/conf";
import { assertAppRequest, getAppOrigin } from "@/utils/mcp/control";
import { clientMessage, chromeModelIds, chromeProtocolVersion, chromeProviders, providerForChromeModel } from "./protocol";
import type { ChromeTarget } from "./protocol";
import { startRelay, stopRelay, retainRelay, relaySettings, relayStatus, relayTicketHash, type ChromeSocket } from "./relay";
import { handleJobMessage, receiveBytes, connectionLost, jobStatus, blockQueue } from "./jobs";
import { isVerifiedUsProxy } from "./museNetworkPolicy";
export { relaySettings } from "./relay";
export { runTask, completeTask, failTask, resumeQueue } from "./jobs";
export { buildChromeRequest } from "./request";

type Peer = { socket: ChromeSocket; mode: "normal" | "vm"; extensionId: string; authenticated: boolean; lastSeenAt: number };
let active: Peer | undefined;
let pending: { id: string; name: string; peer: Peer } | undefined;
let pairing: { codeHash: string; expiresAt: number; mode: "normal" | "vm" } | undefined;
let attached = false;
let targets: ChromeTarget[] = [];
let managedMuseTabIds: number[] = [];
let manageRequest: { id: string; resolve(ids: number[]): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> } | undefined;
type MuseNetworkState = {
  ok: boolean; proxyMode: "fixed_servers" | "pac_script" | "direct" | "system" | "auto_detect" | "unknown";
  countryCode?: string; ipHint?: string; checkedAt: number; error?: string;
};
let chosenMuseProfile: { deviceId: string; extensionId: string; profileDirectory: "Profile 22" } | undefined;
let lastMuseNetwork: MuseNetworkState | undefined;
let pendingMuseNetwork: { id: string; resolve(value: MuseNetworkState): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> } | undefined;
const chromeNames = { muse: "Muse", chatgpt: "ChatGPT", gemini: "Gemini", claude: "Claude", grok: "Grok", perplexity: "Perplexity" };
const peers = new Set<Peer>();
const loopback = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function equal(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function invalid(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }
function enabled() { return conf.get("settings", {}).multiTenantEnabled !== true; }
function send(peer: Peer, message: object) { if (peer.socket.readyState === WebSocket.OPEN) peer.socket.send(JSON.stringify(message)); }
export function online() { return !!active && active.socket.readyState === WebSocket.OPEN && enabled() && Date.now() - active.lastSeenAt < 45000; }
export function knownTargets() { return online() ? targets : []; }
export function getTarget(tabId: number) { return knownTargets().find(item => item.tabId === tabId); }
export function managedMuseTargets() {
  if (!online() || managedMuseTabIds.length !== 5) return [];
  const selected = managedMuseTabIds.map(id => getTarget(id));
  if (selected.some(target => !target || target.provider !== "muse" || target.blocked)) return [];
  return selected as ChromeTarget[];
}
function resetMuseProfile(reason = "Kết nối Chrome thay đổi, cần chọn lại Profile 22.") {
  chosenMuseProfile = undefined; lastMuseNetwork = undefined;
  if (pendingMuseNetwork) {
    const pending = pendingMuseNetwork; pendingMuseNetwork = undefined;
    clearTimeout(pending.timer); pending.reject(new Error(reason));
  }
}
export function museProfileStatus() {
  const device = conf.get("aiChrome");
  const selected = !!chosenMuseProfile && online() && device?.id === chosenMuseProfile.deviceId
    && device?.extensionId === chosenMuseProfile.extensionId && active?.extensionId === device.extensionId;
  const fresh = selected && !!lastMuseNetwork && Date.now() - lastMuseNetwork.checkedAt <= 30000;
  return {
    selectedProfile: selected ? chosenMuseProfile!.profileDirectory : null,
    confirmed: selected,
    verified: !!(fresh && lastMuseNetwork?.ok && lastMuseNetwork.countryCode === "US"
      && ["fixed_servers", "pac_script"].includes(lastMuseNetwork.proxyMode)),
    ...(selected && lastMuseNetwork ? {
      proxyMode: lastMuseNetwork.proxyMode, countryCode: lastMuseNetwork.countryCode,
      ipHint: lastMuseNetwork.ipHint, checkedAt: lastMuseNetwork.checkedAt,
      reason: lastMuseNetwork.error,
    } : {}),
  };
}
export async function verifyMuseNetwork(): Promise<MuseNetworkState> {
  if (!museProfileStatus().confirmed) throw new Error("Chưa chọn và xác nhận Chrome Profile 22 trong Cài đặt → AI Chrome.");
  if (pendingMuseNetwork) throw new Error("Đang kiểm tra proxy/IP Chrome Profile 22; chưa được gửi Muse2API.");
  const id = randomUUID();
  lastMuseNetwork = undefined; // fail closed immediately, including while probe is running.
  const answer = await new Promise<MuseNetworkState>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pendingMuseNetwork?.id !== id) return;
      pendingMuseNetwork = undefined;
      reject(new Error("Không xác minh được proxy/IP Mỹ từ Chrome. Muse2API không chạy."));
    }, 20000);
    pendingMuseNetwork = { id, resolve, reject, timer };
    try { sendControl({ type: "verifyMuseNetwork", requestId: id }); }
    catch (cause) {
      clearTimeout(timer); pendingMuseNetwork = undefined;
      reject(cause instanceof Error ? cause : new Error(String(cause)));
    }
  });
  if (!museProfileStatus().confirmed) throw new Error("Profile đã thay đổi trong khi kiểm tra proxy/IP.");
  const valid = isVerifiedUsProxy(answer);
  lastMuseNetwork = { ...answer, ok: valid, error: valid ? undefined
    : (answer.error || "Không chứng minh được proxy Chrome đang hoạt động với IP Mỹ.") };
  if (!valid) throw new Error(lastMuseNetwork.error);
  return lastMuseNetwork;
}
export async function selectMuseProfile(value: { profileDirectory: string; confirmedExtensionInProfile: boolean }) {
  if (value.profileDirectory !== "Profile 22" || value.confirmedExtensionInProfile !== true)
    throw new Error("Hãy chọn Profile 22 và tự xác nhận extension đang cài trong đúng profile đó.");
  const device = conf.get("aiChrome");
  if (!device || !online() || !active || active.mode !== "normal" || active.extensionId !== device.extensionId)
    throw new Error("Cần ghép và kết nối extension trong Chrome Profile 22 trên máy này.");
  const jobs = jobStatus();
  if (jobs.current || jobs.waiting || jobs.paused) throw new Error("Chưa thể đổi profile khi còn tác vụ Chrome đang chạy hoặc chưa xác định.");
  chosenMuseProfile = { deviceId: device.id, extensionId: device.extensionId, profileDirectory: "Profile 22" };
  lastMuseNetwork = undefined;
  // Selection alone is NOT network verification and never opens a browser.
  await verifyMuseNetwork();
  return museProfileStatus();
}
function resetManagedMuse(error = "Extension bị ngắt trước khi xác minh 5 tab Muse.") {
  managedMuseTabIds = [];
  if (manageRequest) {
    const waiting = manageRequest; manageRequest = undefined;
    clearTimeout(waiting.timer); waiting.reject(new Error(error));
  }
}
export function manageMuseTabs(): Promise<number[]> {
  if (!online() || manageRequest) throw new Error("Extension chưa kết nối hoặc đang kiểm tra danh sách 5 tab Muse.");
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (manageRequest?.id !== id) return;
      manageRequest = undefined;
      reject(new Error("Extension chưa xác nhận đủ tab Muse. Không tự thử lại."));
    }, 45000);
    manageRequest = { id, resolve, reject, timer };
    try { sendControl({ type: "manageMuseTabs", requestId: id, count: 5 }); }
    catch (cause) {
      clearTimeout(timer); manageRequest = undefined;
      reject(cause instanceof Error ? cause : new Error(String(cause)));
    }
  });
}
export function selectedTarget(tabId?: number, modelId?: string) {
  const provider = modelId ? providerForChromeModel(modelId) : undefined;
  if (modelId && !provider) return null;
  const candidates = knownTargets().filter(item => (!provider || item.provider === provider)
    && (tabId === undefined || item.tabId === tabId) && !item.blocked);
  // Never silently route to an unrelated tab when several Chrome tabs exist.
  return candidates.length === 1 ? candidates[0]! : null;
}
export function sendControl(message: object) { if (!online()) throw new Error("Chrome đã ngắt kết nối."); active!.socket.send(JSON.stringify(message)); }
export function sendBytes(bytes: Uint8Array) { if (!online()) throw new Error("Chrome đã ngắt kết nối."); active!.socket.send(bytes); }
export function chromeModels() {
  if (!online()) return [];
  return chromeProviders.flatMap(provider => {
    const capable = knownTargets().filter(item => item.provider === provider && !item.blocked);
    const kinds = [...new Set(capable.flatMap(item => item.outputKinds))].filter(kind => kind !== "text");
    return kinds.map(kind => ({
    providerId: "aiChrome", providerLabel: "AI chrome", modelId: chromeModelIds[provider], label: `${chromeNames[provider]} • Chrome (đặc tả bằng chữ)`, type: kind,
    rules: [], supportsPrice: false,
    ...(kind === "image" ? { imageSizes: ["1024x1024", "1536x1024", "1024x1536"], imageRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"] } : {}),
    ...(kind === "video" ? { mode: ["text", "singleImage", "startEndRequired", "startFrameOptional", ["imageReference:8", "videoReference:8", "audioReference:8"]], audio: "optional", durationResolutionMap: [{ duration: [3, 5, 6, 8, 10, 15, 20, 30, 60], resolution: ["480p", "720p", "1080p", "2160p"] }] } : {}),
    }));
  });
}
export function chromeTextModels() {
  return chromeProviders.filter(provider => knownTargets().some(item => item.provider === provider && !item.blocked && item.outputKinds.includes("text")))
    .map(provider => ({ providerId: "aiChrome", providerLabel: "AI chrome", modelId: chromeModelIds[provider], label: `${chromeNames[provider]} • Chrome`, protocol: "chrome" as const, supportsAgent: false, contextWindow: 24000, maxOutputTokens: 16000, reasoningLevels: [] }));
}
function expirePairing() {
  if (pairing && pairing.expiresAt <= Date.now()) {
    if (pairing.mode === "vm") { stopRelay(); conf.delete("aiChromeRelay"); }
    pairing = undefined;
    pending?.peer.socket.close(4001, "Pairing expired");
    pending = undefined;
  }
}

export function authorize(req: Request) {
  assertAppRequest(req);
  if (!enabled() || req.res?.locals.multiTenantWeb || !loopback.has(req.socket.remoteAddress ?? "") || !localHosts.has(req.hostname))
    invalid("AI chrome thông thường chỉ dùng trên cùng máy, ở chế độ độc lập.", 403);
}

export function status() {
  expirePairing();
  const device = conf.get("aiChrome");
  return {
    connected: online(),
    device: device ? { id: device.id, name: device.name, extensionId: device.extensionId, pairedAt: device.pairedAt, mode: device.mode ?? "normal" } : null,
    pending: pending ? { id: pending.id, name: pending.name, extensionId: pending.peer.extensionId } : null,
    pairingExpiresAt: pairing?.expiresAt ?? null, pairingMode: pairing?.mode ?? null, relay: relayStatus(),
    lastSeenAt: active?.lastSeenAt ?? null,
    target: selectedTarget() ?? null, targets: knownTargets(), jobs: jobStatus(), museProfile: museProfileStatus(),
  };
}

export async function createPairing(req: Request, mode: "normal" | "vm" = "normal") {
  if (conf.get("aiChrome")) {
    if (online()) invalid("Chrome đang kết nối. Hãy ngắt kết nối hiện tại trước khi ghép thiết bị khác.", 409);
    const jobs = jobStatus();
    if (jobs.current || jobs.waiting || jobs.paused) invalid("Còn tác vụ Chrome chưa xác định trạng thái; hãy kiểm tra kết quả trước khi ghép lại.", 409);
  }
  const app = new URL(getAppOrigin(req));
  const serverPort = req.socket.localPort;
  const appPort = Number(app.port || "80");
  if (mode === "normal" && (app.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(app.hostname)
    || !serverPort || !Number.isInteger(appPort) || appPort < 1 || appPort > 65535)) invalid("Ghép nối thông thường cần mở MacFlow bằng HTTP trên localhost hoặc 127.0.0.1.");
  const settings = mode === "vm" ? relaySettings() : null;
  if (mode === "vm" && !settings) invalid("Cần cấu hình MACFLOW_CHROME_RELAY_URL và MACFLOW_CHROME_RELAY_KEY trước khi tạo mã VM.", 503);
  pending?.peer.socket.close(4001, "Pairing replaced"); pending = undefined;
  stopRelay(); conf.delete("aiChromeRelay");
  const expiresAt = Math.floor((Date.now() + 300000) / 1000) * 1000;
  if (mode === "vm" && settings) {
    const ticket = randomBytes(32).toString("hex"), key = randomBytes(32).toString("hex"), roomId = randomUUID();
    const code = `MV1.${Buffer.from(JSON.stringify({ v: 1, url: settings.url, roomId, ticket, key, expiresAt })).toString("base64url")}`;
    const config = { url: settings.url, roomId, ticketHash: relayTicketHash(ticket), key, expiresAt };
    const codeHash = hash(`MVH.${hash(code)}`);
    pairing = { codeHash, expiresAt, mode }; conf.set("aiChromeRelay", config);
    try {
      await startRelay(config, (socket, extensionId) => registerPeer(socket, extensionId, "vm"));
      if (pairing?.codeHash !== codeHash) invalid("Phiên ghép nối đã được thay thế.", 409);
      return { code, expiresAt, mode };
    } catch (cause) {
      if (pairing?.codeHash === codeHash) { pairing = undefined; stopRelay(); conf.delete("aiChromeRelay"); }
      throw cause;
    }
  }
  const code = ["MC1", serverPort, app.hostname === "localhost" ? "l" : "4", appPort, expiresAt / 1000, randomBytes(12).toString("hex")].join(".");
  pairing = { codeHash: hash(code), expiresAt, mode };
  return { code, expiresAt, mode };
}

export function approve(id: string) {
  expirePairing();
  if (!pending || pending.id !== id || !pairing || pending.peer.socket.readyState !== WebSocket.OPEN)
    invalid("Yêu cầu ghép nối đã hết hạn hoặc extension đã ngắt kết nối.", 409);
  const { peer, name } = pending;
  const token = randomBytes(32).toString("hex");
  const device = { id: randomUUID(), name, extensionId: peer.extensionId, tokenHash: hash(token), pairedAt: Date.now(), mode: peer.mode };
  let vmCredentials: { key: string; ticket: string } | undefined;
  // Credentials stay outside the user-editable settings object and public responses.
  if (peer.mode === "vm") {
    const relay = conf.get("aiChromeRelay");
    if (!relay) invalid("Phiên relay đã hết hạn.", 409);
    vmCredentials = { key: randomBytes(32).toString("hex"), ticket: randomBytes(32).toString("hex") };
    relay.expiresAt = null; relay.key = vmCredentials.key; relay.ticketHash = relayTicketHash(vmCredentials.ticket);
    conf.set("aiChromeRelay", relay); retainRelay({ key: relay.key, ticketHash: relay.ticketHash });
  }
  conf.set("aiChrome", device);
  resetMuseProfile();
  active = peer;
  peer.authenticated = true;
  pairing = undefined;
  pending = undefined;
  send(peer, { type: "paired", protocolVersion: chromeProtocolVersion, deviceId: device.id, token, ...(vmCredentials ? { vmCredentials } : {}) });
  return status();
}

export function disconnect() {
  connectionLost(); targets = []; resetManagedMuse();
  resetMuseProfile();
  // Revocation changes connection credentials only; workspace/media data is untouched.
  conf.delete("aiChrome");
  pairing = undefined;
  pending = undefined;
  for (const peer of peers) { send(peer, { type: "revoked" }); peer.socket.close(4003, "Revoked"); }
  active = undefined; stopRelay(); conf.delete("aiChromeRelay");
  return status();
}

export function attach(server: Server) {
  if (attached) throw new Error("AI chrome socket already attached");
  attached = true;
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 65576, perMessageDeflate: false });
  server.on("upgrade", (req, socket, head) => {
    if (req.url?.split("?")[0] !== "/api/aiChrome/socket") return;
    const origin = /^chrome-extension:\/\/([a-p]{32})$/.exec(req.headers.origin ?? "");
    let host = "";
    try { host = new URL(`http://${req.headers.host}`).hostname; } catch { /* reject below */ }
    if (req.url !== "/api/aiChrome/socket" || !enabled() || !origin || !loopback.has(req.socket.remoteAddress ?? "") || !localHosts.has(host) || peers.size >= 4) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); return;
    }
    sockets.handleUpgrade(req, socket, head, ws => registerPeer(ws, origin[1]!, "normal"));
  });
  const savedRelay = conf.get("aiChromeRelay");
  if (enabled() && conf.get("aiChrome")?.mode === "vm" && savedRelay) {
    savedRelay.expiresAt = null;
    void startRelay(savedRelay, (socket, extensionId) => registerPeer(socket, extensionId, "vm")).catch(() => console.error("Không khôi phục được kết nối relay VM. Kiểm tra cấu hình relay."));
  }
  const heartbeat = setInterval(() => {
    expirePairing();
    for (const peer of peers) {
      try {
        if (!enabled() || Date.now() - peer.lastSeenAt > 45000) peer.socket.terminate();
        else send(peer, { type: "ping" });
      } catch { peer.socket.terminate(); }
    }
  }, 20000);
  heartbeat.unref();
  server.once("close", () => { clearInterval(heartbeat); stopRelay(); for (const peer of peers) peer.socket.terminate(); sockets.close(); });
}

function registerPeer(ws: ChromeSocket, extensionId: string, mode: "normal" | "vm") {
  const peer: Peer = { socket: ws, extensionId, mode, authenticated: false, lastSeenAt: Date.now() };
  peers.add(peer);
  const authDeadline = setTimeout(() => { if (!peer.authenticated && pending?.peer !== peer) ws.close(4001, "Authentication required"); }, 10000);
  ws.on("error", () => {});
  ws.on("close", () => {
    clearTimeout(authDeadline); peers.delete(peer);
    if (active === peer) { connectionLost(); active = undefined; targets = []; resetManagedMuse(); resetMuseProfile(); }
    if (pending?.peer === peer) pending = undefined;
  });
  let messages = Promise.resolve();
  ws.on("message", (data, binary) => {
    messages = messages.then(async () => {
      try {
        if (!enabled()) throw new Error("Invalid frame");
        if (binary) {
          if (active !== peer || !peer.authenticated || !Buffer.isBuffer(data)) throw new Error("Not authenticated");
          receiveBytes(data); peer.lastSeenAt = Date.now(); return;
        }
        const control = data.toString();
        if (control.length > 60000) throw new Error("Control message too large");
        const input = clientMessage.parse(JSON.parse(control));
        if (input.type !== "tabStatus" && control.length > 8192) throw new Error("Control message too large");
        if (input.type === "pair") {
          expirePairing();
          if (peer.authenticated || online() || !pairing || pairing.mode !== mode || pending || !equal(hash(input.code), pairing.codeHash)) throw new Error("Invalid pairing");
          if (input.protocolVersion !== chromeProtocolVersion) {
            send(peer, { type: "incompatible", protocolVersion: chromeProtocolVersion });
            ws.close(4001, "Protocol version mismatch"); return;
          }
          targets = []; resetManagedMuse();
          pending = { id: randomUUID(), name: input.name, peer };
          // ACT: the short-lived, one-use pairing code already authorizes this
          // local Chrome extension; finish in the same WebSocket exchange.
          // Keep the existing token, extension-ID and loopback checks.
          approve(pending.id);
        } else if (input.type === "authenticate") {
          const device = conf.get("aiChrome");
          if (!device || device.id !== input.deviceId || device.extensionId !== peer.extensionId || (device.mode ?? "normal") !== mode || !equal(hash(input.token), device.tokenHash)) throw new Error("Invalid token");
          if (active && active !== peer) { connectionLost(); targets = []; resetManagedMuse(); resetMuseProfile(); active.socket.close(4002, "Connection replaced"); }
          active = peer; peer.authenticated = true;
          send(peer, { type: "ready", protocolVersion: chromeProtocolVersion, deviceId: device.id });
        } else if (input.type === "pong") { if (!peer.authenticated && pending?.peer !== peer) throw new Error("Not authenticated"); }
        else {
          if (!peer.authenticated || active !== peer) throw new Error("Not authenticated");
          if (input.type === "tabStatus") {
            targets = input.targets;
            managedMuseTabIds = (input.managedMuseTabIds ?? []).filter(id =>
              input.targets.some(target => target.tabId === id && target.provider === "muse"));
            if (input.recoveryRequired) blockQueue();
          }
          else if (input.type === "museTabsManaged") {
            const waiting = manageRequest;
            // An ACK can arrive after the management timeout. Never tear down
            // the authenticated browser connection for a harmless late ACK.
            if (waiting?.id === input.requestId) {
              clearTimeout(waiting.timer); manageRequest = undefined;
              if (input.error || input.tabIds.length !== 5) waiting.reject(new Error(input.error || "Extension chưa tạo đủ 5 tab Muse."));
              else waiting.resolve(input.tabIds);
            }
          }
          else if (input.type === "museNetworkVerified") {
            const pending = pendingMuseNetwork;
            if (pending?.id === input.requestId) {
              pendingMuseNetwork = undefined; clearTimeout(pending.timer);
              pending.resolve({
                ok: input.ok, proxyMode: input.proxyMode, countryCode: input.countryCode,
                ipHint: input.ipHint, checkedAt: input.checkedAt, error: input.error,
              });
            }
          }
          else await handleJobMessage(input);
        }
        peer.lastSeenAt = Date.now();
      } catch { ws.close(4001, "Authentication or message rejected"); }
    });
  });
}
