import { createCipheriv, createDecipheriv, createHmac, createHash, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { EventEmitter } from "node:events";
import { WebSocket } from "ws";
import type { ChromeRelayConfig } from "./protocol";

export type ChromeSocket = {
  readonly readyState: number;
  send(value: string | Uint8Array): void;
  close(code?: number, reason?: string): void;
  terminate(): void;
  on(event: string, listener: (...args: any[]) => void): unknown;
};
let transport: WebSocket | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;
let epoch = 0;
let currentConfig: ChromeRelayConfig | undefined;
let cancelOpening: (() => void) | undefined;
let state = { configured: false, connected: false, error: "" };
export function relaySettings() {
  const raw = process.env.MACFLOW_CHROME_RELAY_URL?.trim();
  const key = process.env.MACFLOW_CHROME_RELAY_KEY ?? "";
  if (!raw || key.length < 32) return null;
  const url = new URL(raw);
  if (url.protocol !== "wss:" && !(url.protocol === "ws:" && ["localhost", "127.0.0.1"].includes(url.hostname)) || url.pathname !== "/relay" || url.username || url.password || url.search || url.hash) throw new Error("Relay cần URL wss://tên-miền/relay; WS chỉ dành cho localhost.");
  return { url: url.href, key };
}
export function relayStatus() { try { return { ...state, configured: !!relaySettings() }; } catch { return { ...state, configured: false, error: "Cấu hình relay không hợp lệ." }; } }
export function stopRelay() { epoch++; cancelOpening?.(); cancelOpening = undefined; clearTimeout(retry); const ws = transport; transport = undefined; currentConfig = undefined; state.connected = false; state.error = ""; ws?.close(); }
export function retainRelay(credentials: { key: string; ticketHash: string }) {
  if (currentConfig) Object.assign(currentConfig, credentials, { expiresAt: null });
  if (transport?.readyState === WebSocket.OPEN) transport.send(JSON.stringify({ type: "retain", ticketHash: credentials.ticketHash }));
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function relayTicketHash(ticket: string) { return hash(ticket); }
function equal(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }

export async function startRelay(config: ChromeRelayConfig, accept: (socket: ChromeSocket, extensionId: string) => void): Promise<void> {
  stopRelay();
  const generation = epoch;
  currentConfig = config;
  const settings = relaySettings();
  if (!settings || settings.url !== config.url) {
    state.error = "Thiếu cấu hình relay hoặc URL đã đổi. Kiểm tra URL/khóa, hủy ghép nối cũ và tạo mã mới.";
    throw new Error(state.error);
  }
  state = { configured: true, connected: false, error: "" };
  return new Promise((resolve, reject) => {
    let resolved = false;
    const cancelled = () => { if (!resolved) { resolved = true; reject(new Error("Phiên kết nối relay đã được hủy hoặc thay thế.")); } };
    cancelOpening = cancelled;
    function connect() {
      if (generation !== epoch || config.expiresAt !== null && config.expiresAt <= Date.now()) { cancelled(); return; }
      const ws = transport = new WebSocket(config.url, { headers: { Authorization: `Bearer ${settings!.key}` }, maxPayload: 2 * 1024 * 1024 + 128, perMessageDeflate: false });
      let virtual: (EventEmitter & ChromeSocket) | undefined;
      let hostNonce = "";
      let deadline = setTimeout(() => ws.close(4001, "Relay registration timeout"), 10000);
      ws.on("error", () => { if (generation === epoch) state.error = "Không kết nối được relay."; });
      ws.on("open", () => { if (generation === epoch) ws.send(JSON.stringify({ type: "register", roomId: config.roomId, ticketHash: config.ticketHash, ttlMs: config.expiresAt === null ? null : Math.max(1, Math.min(300000, config.expiresAt - Date.now())) })); else ws.close(); });
      ws.on("close", () => {
        clearTimeout(deadline); virtual?.emit("close");
        if (generation !== epoch) return;
        state.connected = false; state.error ||= "Relay đã ngắt kết nối.";
        if (!resolved) { resolved = true; reject(new Error(state.error)); }
        retry = setTimeout(connect, 5000); retry.unref();
      });
      ws.on("message", (raw, binary) => {
        if (generation !== epoch) return;
        try {
          if (binary) { if (!virtual || !Buffer.isBuffer(raw)) throw new Error("Channel not authenticated"); virtual.emit("encrypted", raw); return; }
          if (raw.toString().length > 4096) throw new Error("Invalid relay control");
          const message = JSON.parse(raw.toString());
          if (message.type === "registered") { clearTimeout(deadline); state.connected = true; state.error = ""; if (!resolved) { resolved = true; if (cancelOpening === cancelled) cancelOpening = undefined; resolve(); } return; }
          if (message.type === "guestLeft") { clearTimeout(deadline); virtual?.emit("close"); virtual = undefined; hostNonce = ""; return; }
          if (message.type === "guestJoined") {
            if (virtual || hostNonce) throw new Error("Duplicate guest");
            hostNonce = randomBytes(32).toString("hex"); ws.send(JSON.stringify({ type: "challenge", nonce: hostNonce }));
            deadline = setTimeout(() => ws.close(4001, "VM authentication timeout"), 10000); return;
          }
          if (message.type !== "hello" || !hostNonce || virtual || !/^[a-f0-9]{64}$/.test(message.nonce) || !/^[a-p]{32}$/.test(message.extensionId)) throw new Error("Invalid VM hello");
          const transcript = `macflow-vm/1|${config.roomId}|${hostNonce}|${message.nonce}|${message.extensionId}`;
          const proof = createHmac("sha256", Buffer.from(config.key, "hex")).update(transcript).digest("hex");
          if (typeof message.proof !== "string" || !equal(proof, message.proof)) throw new Error("VM proof rejected");
          clearTimeout(deadline);
          virtual = encryptedSocket(ws, config, hostNonce, message.nonce);
          virtual.send(JSON.stringify({ type: "welcome" }));
          accept(virtual, message.extensionId);
        } catch { ws.close(4001, "VM channel rejected"); }
      });
    }
    connect();
  });
}

function encryptedSocket(ws: WebSocket, config: ChromeRelayConfig, hostNonce: string, guestNonce: string): EventEmitter & ChromeSocket {
  const salt = Buffer.from(hostNonce + guestNonce, "hex");
  const derive = (direction: string) => Buffer.from(hkdfSync("sha256", Buffer.from(config.key, "hex"), salt, Buffer.from(`macflow-vm/1/${config.roomId}/${direction}`), 32));
  const outbound = derive("host"), inbound = derive("guest");
  let sent = 0n, received = 0n, closed = false;
  const peer = new EventEmitter() as EventEmitter & ChromeSocket;
  Object.defineProperty(peer, "readyState", { get: () => closed ? WebSocket.CLOSED : ws.readyState });
  peer.send = value => {
    if (closed || ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > 8 * 1024 * 1024) throw new Error("VM channel unavailable");
    const bytes = typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    const header = Buffer.alloc(9); header[0] = typeof value === "string" ? 0 : 1; header.writeBigUInt64BE(sent++, 1);
    const iv = Buffer.alloc(12); header.copy(iv, 4, 1);
    const cipher = createCipheriv("aes-256-gcm", outbound, iv); cipher.setAAD(header);
    ws.send(Buffer.concat([header, cipher.update(bytes), cipher.final(), cipher.getAuthTag()]));
  };
  peer.on("encrypted", (frame: Buffer) => {
    try {
      if (closed || frame.length < 25 || frame[0]! > 1 || frame.readBigUInt64BE(1) !== received) throw new Error("Invalid VM frame");
      const header = frame.subarray(0, 9), iv = Buffer.alloc(12); header.copy(iv, 4, 1);
      const decipher = createDecipheriv("aes-256-gcm", inbound, iv); decipher.setAAD(header); decipher.setAuthTag(frame.subarray(-16));
      const bytes = Buffer.concat([decipher.update(frame.subarray(9, -16)), decipher.final()]); received++;
      peer.emit("message", bytes, frame[0] === 1);
    } catch { peer.close(4001, "Invalid encrypted VM frame"); }
  });
  peer.once("close", () => { closed = true; });
  peer.close = (code = 4000, reason = "VM disconnected") => { if (closed) return; closed = true; ws.close(code, reason); peer.emit("close"); };
  peer.terminate = () => { if (closed) return; closed = true; ws.terminate(); peer.emit("close"); };
  return peer;
}
