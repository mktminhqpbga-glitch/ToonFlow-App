import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";

// Standalone relay: no workspace/config imports and no media or credential persistence.
const hostKey = process.env.MACFLOW_CHROME_RELAY_KEY ?? "";
if (hostKey.length < 32) throw new Error("MACFLOW_CHROME_RELAY_KEY cần ít nhất 32 ký tự.");
const port = Number(process.env.MACFLOW_CHROME_RELAY_PORT ?? 8788);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Cổng relay không hợp lệ.");
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function equal(a: string, b: string) { const left = Buffer.from(a), right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); }
type Room = { id: string; host: WebSocket; guest?: WebSocket; ticketHash: string; expiresAt: number | null };
const rooms = new Map<string, Room>();
const server = createServer((req, res) => { res.writeHead(req.url === "/health" ? 200 : 404, { "Content-Type": "text/plain", "Cache-Control": "no-store" }); res.end(req.url === "/health" ? "MacFlow relay\n" : "Not found\n"); });
const sockets = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 + 128, perMessageDeflate: false });
function send(socket: WebSocket, value: object) { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value)); }
function forward(socket: WebSocket | undefined, data: Buffer | string, binary: boolean) {
  if (!socket || socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > 8 * 1024 * 1024) throw new Error("Peer unavailable or overloaded");
  socket.send(data, { binary });
}
server.on("upgrade", (req, socket, head) => {
  const host = equal(req.headers.authorization ?? "", `Bearer ${hostKey}`);
  const guest = /^chrome-extension:\/\/[a-p]{32}$/.test(req.headers.origin ?? "");
  if (req.url !== "/relay" || !host && !guest || sockets.clients.size >= 600) { socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); return; }
  sockets.handleUpgrade(req, socket, head, ws => {
    let room: Room | undefined;
    let registered = false;
    let alive = true;
    const deadline = setTimeout(() => ws.close(4001, "Registration required"), 10000);
    ws.on("error", () => {});
    ws.on("pong", () => { alive = true; });
    const heartbeat = setInterval(() => { if (!alive) ws.terminate(); else { alive = false; ws.ping(); } }, 20000);
    ws.on("close", () => {
      clearTimeout(deadline); clearInterval(heartbeat);
      if (!room) return;
      if (room.host === ws) { if (rooms.get(room.id) === room) rooms.delete(room.id); room.guest?.close(4000, "Host disconnected"); }
      else if (room.guest === ws) { room.guest = undefined; send(room.host, { type: "guestLeft" }); }
    });
    ws.on("message", (raw, binary) => {
      try {
        if (registered && binary) { if (!Buffer.isBuffer(raw)) throw new Error("Invalid bytes"); forward(host ? room?.guest : room?.host, raw, true); return; }
        if (binary || raw.toString().length > 4096) throw new Error("Invalid control");
        const value = JSON.parse(raw.toString());
        if (!registered) {
          if (host && value.type === "register") {
            if (!uuid.test(value.roomId) || !hashPattern.test(value.ticketHash) || rooms.has(value.roomId) || rooms.size >= 200
              || value.ttlMs !== null && (!Number.isInteger(value.ttlMs) || value.ttlMs < 1 || value.ttlMs > 300000)) throw new Error("Invalid room");
            room = { id: value.roomId, ticketHash: value.ticketHash, expiresAt: value.ttlMs === null ? null : Date.now() + value.ttlMs, host: ws };
            rooms.set(room.id, room); registered = true; clearTimeout(deadline); send(ws, { type: "registered" }); return;
          }
          if (!host && value.type === "join") {
            room = rooms.get(value.roomId);
            if (!room || room.guest || !hashPattern.test(value.ticket) || !equal(hash(value.ticket), room.ticketHash) || room.expiresAt !== null && room.expiresAt <= Date.now()) throw new Error("Invalid ticket");
            room.guest = ws; registered = true; clearTimeout(deadline);
            send(ws, { type: "joined" }); send(room.host, { type: "guestJoined" }); return;
          }
          throw new Error("Registration rejected");
        }
        if (host && value.type === "retain" && hashPattern.test(value.ticketHash)) { room!.expiresAt = null; room!.ticketHash = value.ticketHash; return; }
        if (host && value.type === "challenge" && hashPattern.test(value.nonce)) { forward(room?.guest, JSON.stringify(value), false); return; }
        if (!host && value.type === "hello" && hashPattern.test(value.nonce) && hashPattern.test(value.proof) && /^[a-p]{32}$/.test(value.extensionId)) { forward(room?.host, JSON.stringify(value), false); return; }
        throw new Error("Unexpected control");
      } catch { ws.close(4001, "Relay request rejected"); }
    });
  });
});
const expiry = setInterval(() => { for (const room of rooms.values()) if (room.expiresAt !== null && room.expiresAt <= Date.now()) room.host.close(4001, "Pairing expired"); }, 1000);
server.on("close", () => { clearInterval(expiry); for (const ws of sockets.clients) ws.terminate(); sockets.close(); });
server.listen(port, process.env.MACFLOW_CHROME_RELAY_BIND ?? "127.0.0.1", () => console.log(`MacFlow relay listening on port ${port}; publish /relay through WSS.`));
