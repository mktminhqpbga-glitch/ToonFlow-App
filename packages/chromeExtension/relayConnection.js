function fromHex(value) { return Uint8Array.from(value.match(/../g), part => parseInt(part, 16)); }
function toHex(value) { return [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
const encode = value => new TextEncoder().encode(value);

// Only the two paired devices hold the channel key; relay forwards ciphertext.
export function connectVm(config) {
  const raw = new WebSocket(config.socketUrl); raw.binaryType = "arraybuffer";
  let opened = false, closed = false, outbound, inbound, sent = 0n, received = 0n, challenged = false;
  let incoming = Promise.resolve(), outgoing = Promise.resolve();
  const channel = {
    get readyState() { return closed ? WebSocket.CLOSED : opened ? raw.readyState : WebSocket.CONNECTING; },
    onopen: null, onmessage: null, onclose: null, onerror: null,
    close(code = 1000, reason = "") { if (!closed) raw.close(code, reason); },
    send(value) {
      if (!opened || closed || raw.readyState !== WebSocket.OPEN) throw new Error("Kênh VM chưa sẵn sàng.");
      outgoing = outgoing.then(async () => {
        if (closed || raw.readyState !== WebSocket.OPEN || raw.bufferedAmount > 8 * 1024 * 1024) throw new Error("Kênh VM đã ngắt hoặc quá tải.");
        const bytes = typeof value === "string" ? encode(value) : new Uint8Array(value);
        const header = new Uint8Array(9); header[0] = typeof value === "string" ? 0 : 1; new DataView(header.buffer).setBigUint64(1, sent++);
        const iv = new Uint8Array(12); iv.set(header.subarray(1), 4);
        const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: header }, outbound, bytes));
        const frame = new Uint8Array(header.length + encrypted.length); frame.set(header); frame.set(encrypted, header.length); raw.send(frame);
      }).catch(fail);
    },
  };
  function fail() { channel.onerror?.({ message: "Không xác thực được kênh VM." }); if (raw.readyState <= WebSocket.OPEN) raw.close(4001, "VM channel rejected"); }
  const deadline = setTimeout(() => { if (!opened) raw.close(4001, "VM handshake timeout"); }, 15000);
  raw.onopen = () => raw.send(JSON.stringify({ type: "join", roomId: config.roomId, ticket: config.ticket }));
  raw.onerror = () => channel.onerror?.({ message: "Không kết nối được relay VM." });
  raw.onclose = event => { closed = true; clearTimeout(deadline); channel.onclose?.(event); };
  raw.onmessage = event => {
    incoming = incoming.then(async () => {
      if (closed) return;
      if (typeof event.data === "string") {
        if (event.data.length > 4096 || opened) throw new Error("Unexpected relay control");
        const message = JSON.parse(event.data);
        if (message.type === "joined" && !challenged) return;
        if (message.type !== "challenge" || challenged || !/^[a-f0-9]{64}$/.test(message.nonce)) throw new Error("Invalid relay challenge");
        challenged = true;
        const guestNonce = toHex(crypto.getRandomValues(new Uint8Array(32)));
        const transcript = `macflow-vm/1|${config.roomId}|${message.nonce}|${guestNonce}|${chrome.runtime.id}`;
        const secret = fromHex(config.key);
        const hmac = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const proof = toHex(await crypto.subtle.sign("HMAC", hmac, encode(transcript)));
        const material = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
        const salt = fromHex(message.nonce + guestNonce);
        const derive = direction => crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: encode(`macflow-vm/1/${config.roomId}/${direction}`) }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
        outbound = await derive("guest"); inbound = await derive("host");
        raw.send(JSON.stringify({ type: "hello", nonce: guestNonce, extensionId: chrome.runtime.id, proof })); return;
      }
      const frame = new Uint8Array(event.data);
      if (!inbound || frame.length < 25 || frame.length > 2 * 1024 * 1024 + 128 || frame[0] > 1 || new DataView(frame.buffer).getBigUint64(1) !== received) throw new Error("Invalid VM frame");
      const header = frame.slice(0, 9), iv = new Uint8Array(12); iv.set(header.subarray(1), 4);
      const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: header }, inbound, frame.subarray(9)); received++;
      if (!opened) {
        if (frame[0] !== 0 || JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)).type !== "welcome") throw new Error("Invalid VM welcome");
        opened = true; clearTimeout(deadline); channel.onopen?.(); return;
      }
      channel.onmessage?.({ data: frame[0] === 1 ? bytes : new TextDecoder("utf-8", { fatal: true }).decode(bytes) });
    }).catch(fail);
  };
  return channel;
}
