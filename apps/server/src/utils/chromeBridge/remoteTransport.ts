import { createHash, randomBytes, randomUUID } from "node:crypto";

export type TransportFrame = { id: string; transferId: string; index: number; total: number; sha256: string; data: string };
type Assembly = { chunks: string[]; total: number; checksum: string; size: number; received: number; expires: number };
type Receipt = { resolve: () => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> };
const maxTransferBytes = 48 * 1024 * 1024;
const chunkBytes = 12 * 1024;
const isHexKey = (value: string) => /^[a-f0-9]{64}$/i.test(value);

export class RemoteTransport {
  private ws?: WebSocket;
  private state: "wss" | "https" | "offline" = "offline";
  private stopped = true;
  private polling = false;
  private retry?: ReturnType<typeof setTimeout>;
  private receipts = new Map<string, Receipt>();
  private transfers = new Map<string, Assembly>();
  private completed = new Map<string, number>();
  private busy = false;

  constructor(private readonly url: string, private readonly token: string, private readonly deviceId: string,
    private readonly deviceSecret: string, private readonly role: "owner" | "device",
    private readonly receive: (message: unknown) => void, private readonly lost: (message: string) => void) {
    if (!url.startsWith("https://") || !isHexKey(deviceSecret)) throw new Error("Invalid remote channel");
  }
  get transport() { return this.state; }
  start() {
    if (!this.stopped) return;
    this.stopped = false;
    void this.connect();
  }
  stop() {
    this.stopped = true; clearTimeout(this.retry);
    this.ws?.close(); this.ws = undefined; this.state = "offline";
    for (const receipt of this.receipts.values()) { clearTimeout(receipt.timeout); receipt.reject(new Error("Relay disconnected")); }
    this.receipts.clear(); this.transfers.clear();
  }
  private async api(path: string, method = "GET", payload?: unknown) {
    const response = await fetch(this.url + path, { method, headers: {
      Authorization: "Bearer " + this.token, "x-relay-device-id": this.deviceId,
      ...(payload ? { "Content-Type": "application/json" } : {}),
    }, ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(25000) });
    const data = await response.json() as Record<string, any>;
    if (!response.ok) throw new Error(String(data.error ?? "Relay unavailable"));
    return data;
  }
  private async connect() {
    if (this.stopped || this.busy) return;
    this.busy = true;
    const socket = new WebSocket(this.url.replace(/^https:/, "wss:") + "/v1/ws");
    this.ws = socket;
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("WSS connection timed out")), 7000);
        let ready = false;
        socket.onopen = () => socket.send(JSON.stringify({ type: "auth", role: this.role,
          key: this.token, ...(this.role === "device" ? { deviceId: this.deviceId } : {}) }));
        socket.onmessage = event => {
          let data: any;
          try { data = JSON.parse(String(event.data)); } catch { return; }
          if (data.type === "ready") {
            clearTimeout(timeout); ready = true; this.state = "wss"; resolve();
          } else if (data.type === "frame" && data.deviceId === this.deviceId)
            void this.acceptFrame(data.frame);
          else if (data.type === "receipt") {
            const receipt = this.receipts.get(data.id);
            if (!receipt) return;
            this.receipts.delete(data.id); clearTimeout(receipt.timeout);
            data.accepted ? receipt.resolve() : receipt.reject(new Error("Relay backpressure"));
          }
        };
        socket.onerror = () => { clearTimeout(timeout); if (!ready) reject(new Error("WSS failed")); };
        socket.onclose = () => { clearTimeout(timeout); if (!ready) reject(new Error("WSS closed")); };
      });
      socket.onclose = () => {
        if (this.stopped || this.ws !== socket) return;
        this.ws = undefined; this.state = "https";
        this.lost("WSS disconnected; AI submission state may be unknown");
        this.failReceipts(); void this.poll();
        this.retry = setTimeout(() => void this.connect(), 15000);
      };
    } catch {
      if (this.ws === socket) this.ws = undefined;
      socket.close();
      this.state = "https"; void this.poll();
      this.retry = setTimeout(() => void this.connect(), 15000);
    } finally { this.busy = false; }
  }
  private failReceipts() {
    for (const [id, receipt] of this.receipts) {
      clearTimeout(receipt.timeout); receipt.reject(new Error("Relay connection interrupted"));
      this.receipts.delete(id);
    }
  }
  private async poll() {
    if (this.polling || this.stopped) return;
    this.polling = true;
    while (!this.stopped && this.state === "https") {
      try {
        const messages = await this.api("/v1/channel/poll?deviceId=" + encodeURIComponent(this.deviceId) + "&wait=18000");
        for (const frame of messages.messages ?? []) await this.acceptFrame(frame);
      } catch {
        this.state = "offline";
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (!this.stopped) this.state = "https";
      }
    }
    this.polling = false;
  }
  private async ack(id: string) {
    if (this.state === "wss" && this.ws?.readyState === WebSocket.OPEN)
      this.ws.send(JSON.stringify({ type: "ack", deviceId: this.deviceId, id }));
    else await this.api("/v1/channel/ack", "POST", { deviceId: this.deviceId, id });
  }
  private async acceptFrame(frame: TransportFrame) {
    if (!frame || !/^[0-9a-f-]{36}$/i.test(frame.id) || !/^[0-9a-f-]{36}$/i.test(frame.transferId)) return;
    const key = frame.transferId;
    if ((this.completed.get(key) || 0) > Date.now()) { await this.ack(frame.id); return; }
    let transfer = this.transfers.get(key);
    if (!transfer) {
      if (this.transfers.size > 3 || !Number.isInteger(frame.total) || frame.total < 1 || frame.total > 10000
        || !/^[a-f0-9]{64}$/i.test(frame.sha256)) return;
      transfer = { chunks: Array(frame.total), total: frame.total, checksum: frame.sha256, size: 0,
        received: 0, expires: Date.now() + 180000 };
      this.transfers.set(key, transfer);
    }
    if (frame.index < 0 || frame.index >= transfer.total || frame.total !== transfer.total
      || transfer.checksum !== frame.sha256 || transfer.expires < Date.now()) {
      this.transfers.delete(key); return;
    }
    if (!transfer.chunks[frame.index]) {
      const size = Buffer.byteLength(frame.data, "base64");
      if (size > chunkBytes || transfer.size + size > maxTransferBytes) { this.transfers.delete(key); return; }
      transfer.chunks[frame.index] = frame.data;
      transfer.size += size; transfer.received++;
    }
    await this.ack(frame.id);
    if (transfer.received !== transfer.total) return;
    this.transfers.delete(key);
    const encrypted = Buffer.concat(transfer.chunks.map(value => Buffer.from(value, "base64")));
    if (createHash("sha256").update(encrypted).digest("hex") !== transfer.checksum) return;
    this.completed.set(key, Date.now() + 600000);
    try {
      const iv = encrypted.subarray(0, 12), body = encrypted.subarray(12);
      const secret = await crypto.subtle.importKey("raw", new Uint8Array(Buffer.from(this.deviceSecret, "hex")),
        "AES-GCM", false, ["decrypt"]);
      const decoded = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) },
        secret, new Uint8Array(body));
      this.receive(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decoded)));
    } catch {
      this.lost("Remote encrypted message invalid; no automatic AI retry");
    }
  }
  private async sendFrame(frame: TransportFrame) {
    if (this.state === "wss" && this.ws?.readyState === WebSocket.OPEN) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => { this.receipts.delete(frame.id); reject(new Error("Relay receipt timed out")); }, 9000);
        this.receipts.set(frame.id, { resolve, reject, timeout });
        try { this.ws!.send(JSON.stringify({ type: "frame", deviceId: this.deviceId, frame })); }
        catch (error) { clearTimeout(timeout); this.receipts.delete(frame.id); reject(error); }
      }); return;
    }
    await this.api("/v1/channel/send", "POST", { deviceId: this.deviceId, frame });
  }
  async send(message: unknown, signal?: AbortSignal) {
    if (this.stopped || this.state === "offline") throw new Error("Render Relay offline");
    const text = new TextEncoder().encode(JSON.stringify(message));
    if (text.length > maxTransferBytes - 64) throw new Error("Remote AI message too large");
    const key = await crypto.subtle.importKey("raw", new Uint8Array(Buffer.from(this.deviceSecret, "hex")),
      "AES-GCM", false, ["encrypt"]);
    const iv = new Uint8Array(randomBytes(12));
    const encrypted = Buffer.concat([iv,
      Buffer.from(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, text))]);
    const sha256 = createHash("sha256").update(encrypted).digest("hex");
    const transferId = randomUUID();
    const total = Math.ceil(encrypted.length / chunkBytes);
    for (let index = 0; index < total; index++) {
      signal?.throwIfAborted();
      const frame: TransportFrame = { id: randomUUID(), transferId, index, total, sha256,
        data: encrypted.subarray(index * chunkBytes, (index + 1) * chunkBytes).toString("base64") };
      for (let attempt = 0; ; attempt++) {
        try { await this.sendFrame(frame); break; }
        catch (error) {
          if (attempt >= 5 || !/backpressure|queue|429/i.test(String(error))) throw error;
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
    }
  }
}
