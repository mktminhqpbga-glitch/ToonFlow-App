/* Browser-side Render transport. Credentials never leave chrome.storage.local except as Relay authentication. */
"use strict";
class ToonflowRemoteTransport {
  constructor(config, onMessage, onLost) {
    this.config = config;
    this.onMessage = onMessage;
    this.onLost = onLost;
    this.state = "offline";
    this.socket = null;
    this.stopped = true;
    this.receipts = new Map();
    this.transfers = new Map();
    this.completed = new Map();
    this.polling = false;
    this.connecting = false;
    this.retryTimer = null;
    this.keepalive = null;
    this.encoder = new TextEncoder();
  }
  get connected() { return this.state !== "offline"; }
  async api(path, method = "GET", payload) {
    const response = await fetch(this.config.url + path, {
      method, headers: { "Authorization": "Bearer " + this.config.deviceToken,
        "x-relay-device-id": this.config.deviceId,
        ...(payload ? { "Content-Type": "application/json" } : {}) },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      signal: AbortSignal.timeout(25000),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Render Relay HTTP " + response.status);
    return data;
  }
  start() {
    if (!this.stopped) return;
    this.stopped = false;
    void this.connect();
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer); clearInterval(this.keepalive);
    this.socket?.close(); this.socket = null; this.state = "offline";
    for (const pending of this.receipts.values()) { clearTimeout(pending.timeout); pending.reject(Error("Relay disconnected")); }
    this.receipts.clear(); this.transfers.clear();
  }
  async connect() {
    if (this.stopped || this.connecting) return;
    this.connecting = true;
    const ws = new WebSocket(this.config.url.replace(/^https:/, "wss:") + "/v1/ws");
    this.socket = ws;
    try {
      await new Promise((resolve, reject) => {
        let ready = false;
        const timeout = setTimeout(() => reject(Error("Remote WSS timeout")), 7000);
        ws.onopen = () => ws.send(JSON.stringify({
          type: "auth", role: "device", key: this.config.deviceToken, deviceId: this.config.deviceId,
        }));
        ws.onmessage = event => {
          let data;
          try { data = JSON.parse(event.data); } catch { return; }
          if (data.type === "ready") {
            clearTimeout(timeout); ready = true; this.state = "wss"; resolve();
          } else if (data.type === "frame" && data.deviceId === this.config.deviceId)
            void this.acceptFrame(data.frame);
          else if (data.type === "receipt") {
            const receipt = this.receipts.get(data.id);
            if (!receipt) return;
            clearTimeout(receipt.timeout); this.receipts.delete(data.id);
            data.accepted ? receipt.resolve() : receipt.reject(Error("Relay backpressure"));
          }
        };
        ws.onerror = () => { clearTimeout(timeout); if (!ready) reject(Error("Remote WSS unavailable")); };
        ws.onclose = () => { clearTimeout(timeout); if (!ready) reject(Error("Remote WSS closed")); };
      });
      clearInterval(this.keepalive);
      this.keepalive = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
      }, 22000);
      ws.onclose = () => {
        if (this.stopped || this.socket !== ws) return;
        clearInterval(this.keepalive); this.socket = null; this.state = "https";
        for (const receipt of this.receipts.values()) { clearTimeout(receipt.timeout); receipt.reject(Error("WSS closed")); }
        this.receipts.clear();
        this.onLost("Render WSS disconnected; do not resubmit unconfirmed AI requests");
        void this.poll();
        this.retryTimer = setTimeout(() => void this.connect(), 15000);
      };
    } catch {
      if (this.socket === ws) this.socket = null;
      ws.close(); this.state = "https";
      void this.poll(); this.retryTimer = setTimeout(() => void this.connect(), 15000);
    } finally { this.connecting = false; }
  }
  async poll() {
    if (this.polling || this.stopped) return;
    this.polling = true;
    while (!this.stopped && this.state === "https") {
      try {
        const data = await this.api("/v1/channel/poll?wait=18000");
        for (const frame of data.messages || []) await this.acceptFrame(frame);
      } catch {
        this.state = "offline";
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (!this.stopped) this.state = "https";
      }
    }
    this.polling = false;
  }
  async ack(id) {
    if (this.state === "wss" && this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify({ type: "ack", id }));
    else await this.api("/v1/channel/ack", "POST", { id });
  }
  static async key(secret, usage) {
    if (!/^[a-f0-9]{64}$/i.test(secret)) throw Error("Invalid device encryption key");
    const raw = Uint8Array.from(secret.match(/../g), part => parseInt(part, 16));
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [usage]);
  }
  static toB64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }
  static fromB64(value) {
    const raw = atob(value);
    return Uint8Array.from(raw, character => character.charCodeAt(0));
  }
  static async hash(bytes) {
    return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map(byte => byte.toString(16).padStart(2, "0")).join("");
  }
  async acceptFrame(frame) {
    if (!frame || !/^[0-9a-f-]{36}$/i.test(frame.id) || !/^[0-9a-f-]{36}$/i.test(frame.transferId)) return;
    const key = frame.transferId;
    if ((this.completed.get(key) || 0) > Date.now()) { await this.ack(frame.id); return; }
    let transfer = this.transfers.get(key);
    if (!transfer) {
      if (this.transfers.size > 3 || !Number.isInteger(frame.total) || frame.total < 1
        || frame.total > 10000 || !/^[a-f0-9]{64}$/i.test(frame.sha256)) return;
      transfer = { chunks: Array(frame.total), total: frame.total, received: 0, size: 0,
        checksum: frame.sha256, expires: Date.now() + 180000 };
      this.transfers.set(key, transfer);
    }
    if (frame.total !== transfer.total || transfer.checksum !== frame.sha256
      || frame.index < 0 || frame.index >= frame.total || transfer.expires < Date.now()) {
      this.transfers.delete(key); return;
    }
    if (!transfer.chunks[frame.index]) {
      const part = ToonflowRemoteTransport.fromB64(frame.data);
      if (part.length > 12288 || transfer.size + part.length > 48 * 1024 * 1024) {
        this.transfers.delete(key); return;
      }
      transfer.chunks[frame.index] = part; transfer.size += part.length; transfer.received++;
    }
    await this.ack(frame.id);
    if (transfer.received !== transfer.total) return;
    this.transfers.delete(key);
    const bytes = new Uint8Array(transfer.size);
    let offset = 0;
    for (const part of transfer.chunks) { bytes.set(part, offset); offset += part.length; }
    if (await ToonflowRemoteTransport.hash(bytes) !== transfer.checksum) return;
    this.completed.set(key, Date.now() + 600000);
    try {
      const iv = bytes.subarray(0, 12), payload = bytes.subarray(12);
      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv },
        await ToonflowRemoteTransport.key(this.config.secret, "decrypt"), payload);
      this.onMessage(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decrypted)));
    } catch { this.onLost("Remote encrypted payload failed checksum/authentication"); }
  }
  async sendFrame(frame) {
    if (this.state === "wss" && this.socket?.readyState === WebSocket.OPEN) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { this.receipts.delete(frame.id); reject(Error("Relay receipt timeout")); }, 9000);
        this.receipts.set(frame.id, { resolve, reject, timeout });
        try { this.socket.send(JSON.stringify({ type: "frame", frame })); }
        catch (error) { clearTimeout(timeout); this.receipts.delete(frame.id); reject(error); }
      });
      return;
    }
    await this.api("/v1/channel/send", "POST", { frame });
  }
  async send(message) {
    if (this.stopped || this.state === "offline") throw Error("Render Relay offline");
    const text = this.encoder.encode(JSON.stringify(message));
    if (text.length > 48 * 1024 * 1024 - 64) throw Error("Remote message too large");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv },
      await ToonflowRemoteTransport.key(this.config.secret, "encrypt"), text));
    const encrypted = new Uint8Array(iv.length + cipher.length);
    encrypted.set(iv); encrypted.set(cipher, iv.length);
    const sha256 = await ToonflowRemoteTransport.hash(encrypted);
    const transferId = crypto.randomUUID();
    const total = Math.ceil(encrypted.length / 12288);
    for (let index = 0; index < total; index++) {
      const frame = { id: crypto.randomUUID(), transferId, index, total, sha256,
        data: ToonflowRemoteTransport.toB64(encrypted.subarray(index * 12288, (index + 1) * 12288)) };
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
