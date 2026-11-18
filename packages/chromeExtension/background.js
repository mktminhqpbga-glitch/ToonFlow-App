import { bindMuseConnection, closeMuseConnection, handleMuseMessage, handleMuseBytes, museState } from "./museTransport.js";
import { protocolVersion, isUuid } from "./requestReceiver.js";
import { parsePairingCode, relayPermission } from "./pairing.js";
import { connectVm } from "./relayConnection.js";
import { digest } from "./mediaTransfer.js";
import { verifyMuseNetwork } from "./profileGuard.js";
let socket;
let status = "Chưa kết nối";
let lastSeenAt = null;
let pairingDestination;

function localUrl(value, protocol) {
  const url = new URL(value);
  if (url.protocol !== protocol || !["localhost", "127.0.0.1"].includes(url.hostname) || url.username || url.password || url.search)
    throw new Error("Chỉ hỗ trợ địa chỉ localhost hoặc 127.0.0.1 trên cùng máy.");
  return url;
}

async function connect(config, pairing) {
  let target;
  if (config.mode === "vm") {
    const origin = relayPermission(config.socketUrl);
    if (!await chrome.permissions.contains({ origins: [origin] })) throw new Error("Extension chưa có quyền relay này. Tải ZIP extension từ MacFlow sau khi cấu hình relay rồi cài lại.");
  } else {
    target = localUrl(config.socketUrl, "ws:");
    if (target.pathname !== "/api/aiChrome/socket" || target.hash) throw new Error("Đường dẫn WebSocket không hợp lệ.");
    localUrl(config.appUrl, "http:");
  }
  pairingDestination = pairing ? { mode: config.mode, appUrl: config.appUrl, expiresAt: config.expiresAt } : undefined;
  const previous = socket;
  socket = undefined;
  previous?.close(); closeMuseConnection();
  status = "Đang kết nối";
  const current = socket = config.mode === "vm" ? connectVm(config) : new WebSocket(target.href);
  current.binaryType = "arraybuffer";
  current.onopen = () => {
    if (socket !== current) return;
    status = pairing ? "Đang ghép nối" : "Đang xác thực";
    current.send(JSON.stringify(pairing ? { type: "pair", code: pairing.code, name: pairing.name, protocolVersion }
      : { type: "authenticate", deviceId: config.deviceId, token: config.token }));
  };
  current.onmessage = async event => {
    if (socket !== current) return;
    try {
      if (event.data instanceof ArrayBuffer) { handleMuseBytes(event.data, current); return; }
      const message = JSON.parse(event.data);
      if (["paired", "ready"].includes(message.type) && message.protocolVersion !== protocolVersion) {
        status = "Khác phiên bản. Cập nhật cả MacFlow và extension rồi kết nối lại.";
        current.close(4001, "Protocol version mismatch"); return;
      }
      if (message.type === "ping") {
        lastSeenAt = Date.now();
        current.send(JSON.stringify({ type: "pong" }));
      } else if (message.type === "incompatible") {
        status = "Khác phiên bản. Cập nhật MacFlow và extension rồi tạo mã mới.";
        current.close(4001, "Protocol version mismatch"); return;
      }
      else if (message.type === "paired") {
        if (!/^[a-f0-9]{64}$/.test(message.token) || typeof message.deviceId !== "string") throw new Error("Invalid credentials");
        const { code: _code, expiresAt: _expiresAt, ...destination } = config;
        if (config.mode === "vm") {
          if (!/^[a-f0-9]{64}$/.test(message.vmCredentials?.key) || !/^[a-f0-9]{64}$/.test(message.vmCredentials?.ticket)) throw new Error("Invalid VM device credentials");
          destination.key = message.vmCredentials.key; destination.ticket = message.vmCredentials.ticket;
        }
        await chrome.storage.local.set({ connection: { ...destination, deviceId: message.deviceId, token: message.token, paused: false } });
        pairingDestination = undefined;
        if (socket === current) { status = config.mode === "vm" ? "Đã kết nối VM" : "Đã kết nối"; lastSeenAt = Date.now(); bindMuseConnection(current); }
      } else if (message.type === "ready") { status = config.mode === "vm" ? "Đã kết nối VM" : "Đã kết nối"; lastSeenAt = Date.now(); bindMuseConnection(current); }
      else if (message.type === "verifyMuseNetwork") {
        if (!isUuid(message.requestId)) throw new Error("Invalid network verification request");
        void verifyMuseNetwork().then(result => {
          if (socket === current && current.readyState === WebSocket.OPEN)
            current.send(JSON.stringify({ type: "museNetworkVerified", requestId: message.requestId, ...result }));
        });
      }
      else if (["prepare", "fileStart", "fileEnd", "packageEnd", "run", "fileAck", "saved", "cancel", "reset", "manageMuseTabs"].includes(message.type)) handleMuseMessage(message, current);
      else if (message.type === "revoked") {
        await chrome.storage.local.remove("connection");
        status = "MacFlow đã huỷ ghép nối";
        current.close();
      }
    } catch { status = "Phản hồi kết nối không hợp lệ"; current.close(); }
  };
  current.onerror = () => { if (socket === current) status = "Không kết nối được backend MacFlow"; };
  current.onclose = async event => {
    if (socket !== current) return;
    pairingDestination = undefined;
    socket = undefined; closeMuseConnection();
    if (event.code === 4003) {
      await chrome.storage.local.remove("connection");
      status = "MacFlow đã huỷ ghép nối";
    } else if (event.code === 4001 || event.code === 4002) {
      const { connection } = await chrome.storage.local.get("connection");
      if (connection) await chrome.storage.local.set({ connection: { ...connection, paused: true } });
      if (!status.startsWith("Khác phiên bản")) status = "Kết nối bị từ chối. Kiểm tra mã hoặc huỷ ghép nối trong MacFlow để ghép lại.";
    } else if (!status.includes("huỷ") && status !== "Đã tạm ngắt") status = "Đã mất kết nối";
  };
}

async function reconnect() {
  if (socket && socket.readyState <= WebSocket.OPEN) return;
  const { connection } = await chrome.storage.local.get("connection");
  if (connection?.token && !connection.paused) await connect(connection);
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL("popup.html")) return false;
  (async () => {
    const { connection } = await chrome.storage.local.get("connection");
    if (message.type === "status") return { ...(await museState()), status, connected: socket?.readyState === WebSocket.OPEN && ["Đã kết nối", "Đã kết nối VM"].includes(status), lastSeenAt, paired: !!connection?.token, appUrl: connection?.appUrl, socketUrl: connection?.socketUrl };
    if (message.type === "pair") {
      const config = parsePairingCode(message.code);
      const proof = config.mode === "vm" ? `MVH.${await digest(new TextEncoder().encode(config.code))}` : config.code;
      await connect(config, { code: proof, name: config.mode === "vm" ? "Chrome trên VM Muse AI" : "Chrome của tôi" });
    } else if (message.type === "reconnect") {
      if (!connection?.token) throw new Error("Chưa ghép nối.");
      await chrome.storage.local.set({ connection: { ...connection, paused: false } });
      const previous = socket; socket = undefined; previous?.close(); closeMuseConnection();
      await reconnect();
    } else if (message.type === "pause") {
      if (connection) await chrome.storage.local.set({ connection: { ...connection, paused: true } });
      const previous = socket; socket = undefined; previous?.close(); closeMuseConnection();
      status = "Đã tạm ngắt";
    } else if (message.type === "open") {
      const destination = connection?.token ? connection : pairingDestination?.expiresAt > Date.now() ? pairingDestination : parsePairingCode(message.code);
      if (destination.mode === "vm") throw new Error("MacFlow nằm trên máy chủ. Hãy mở MacFlow trên máy đã tạo mã VM để xác nhận thiết bị.");
      const url = localUrl(destination.appUrl, "http:");
      url.hash = "/home";
      const candidates = await chrome.tabs.query({ url: `${url.protocol}//${url.hostname}/*` });
      const tabs = candidates.filter(tab => { try { return new URL(tab.url).origin === url.origin; } catch { return false; } });
      if (tabs[0]?.id) { await chrome.tabs.update(tabs[0].id, { active: true }); await chrome.windows.update(tabs[0].windowId, { focused: true }); }
      else await chrome.tabs.create({ url: url.href });
    } else throw new Error("Thao tác không hợp lệ.");
    return { ok: true };
  })().then(reply, error => reply({ error: error.message || "Không thực hiện được thao tác." }));
  return true;
});

async function initialize() {
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  await chrome.alarms.create("reconnect", { periodInMinutes: 0.5 });
  await reconnect();
}
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === "reconnect") void reconnect().catch(() => { status = "Không kết nối được backend MacFlow"; }); });
void initialize().catch(() => { status = "Không khởi tạo được kết nối"; });
