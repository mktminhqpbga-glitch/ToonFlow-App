import { isUuid } from "./requestReceiver.js";

export function relayPermission(value) {
  const url = new URL(value);
  if (url.protocol !== "wss:" && !(url.protocol === "ws:" && ["localhost", "127.0.0.1"].includes(url.hostname)) || url.pathname !== "/relay" || url.username || url.password || url.search || url.hash) throw new Error("Địa chỉ relay VM không hợp lệ.");
  return `${url.protocol === "wss:" ? "https:" : "http:"}//${url.hostname}/*`;
}
export function parsePairingCode(value) {
  if (typeof value !== "string") throw new Error("Hãy nhập mã ghép nối từ MacFlow.");
  const code = value.trim();
  if (code.startsWith("MV1.")) {
    if (!/^MV1\.[A-Za-z0-9_-]{100,2000}$/.test(code)) throw new Error("Mã VM không hợp lệ.");
    let data;
    try { data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(code.slice(4).replaceAll("-", "+").replaceAll("_", "/")), ch => ch.charCodeAt(0)))); }
    catch { throw new Error("Không đọc được mã VM. Hãy tạo mã mới trong MacFlow."); }
    if (!data || data.v !== 1 || typeof data.url !== "string" || !isUuid(data.roomId) || !/^[a-f0-9]{64}$/.test(data.ticket) || !/^[a-f0-9]{64}$/.test(data.key)
      || !Number.isSafeInteger(data.expiresAt) || data.expiresAt <= 0) throw new Error("Mã VM sai định dạng.");
    relayPermission(data.url);
    return { code, mode: "vm", socketUrl: new URL(data.url).href, roomId: data.roomId, ticket: data.ticket, key: data.key, expiresAt: data.expiresAt };
  }
  const match = /^MC1\.([1-9]\d{0,4})\.([l4])\.([1-9]\d{0,4})\.(\d{10})\.([a-f0-9]{24})$/.exec(code);
  if (!match || code.length > 96) throw new Error("Mã ghép nối không hợp lệ. Hãy tạo mã mới trong MacFlow.");
  const serverPort = Number(match[1]), appPort = Number(match[3]);
  if (serverPort > 65535 || appPort > 65535) throw new Error("Mã ghép nối chứa cổng không hợp lệ.");
  const expiresAt = Number(match[4]) * 1000;
  if (expiresAt <= Date.now()) throw new Error("Mã ghép nối đã hết hạn. Hãy tạo mã mới trong MacFlow.");
  if (expiresAt > Date.now() + 301000) throw new Error("Thời hạn mã ghép nối không hợp lệ. Hãy tạo mã mới trong MacFlow.");
  const appHost = match[2] === "l" ? "localhost" : "127.0.0.1";
  return { code, mode: "normal", expiresAt, socketUrl: `ws://127.0.0.1:${serverPort}/api/aiChrome/socket`, appUrl: new URL(`http://${appHost}:${appPort}`).origin };
}
