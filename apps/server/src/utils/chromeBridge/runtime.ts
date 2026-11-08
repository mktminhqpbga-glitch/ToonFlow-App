import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { getRuntimePlatform } from "@/lib/platform";

export type BridgeProvider = "muse" | "gemini" | "chatgpt";
export type BridgeCapability = "text" | "image" | "video";
export type BridgeResult = { kind: BridgeCapability; text?: string; data?: string; mimeType?: string };
export type BridgeTab = { id: number; title: string; url: string };
export type BridgeSelection = { tab: BridgeTab; capabilities: BridgeCapability[] };
export type BridgeState = "idle" | "connecting" | "ready" | "submitting" | "running" | "completed" | "failed" | "cancelled" | "disconnected";

type SocketData = { authenticated: boolean; extensionId: string; authTimer?: ReturnType<typeof setTimeout> };
type Call = { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> };
type Job = { id: string; provider: BridgeProvider; tabId: number; state: BridgeState; nodeId?: string; resolve: (value: BridgeResult) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout>; abort?: () => void };

const allowedHosts: Record<BridgeProvider, string[]> = {
  muse: ["muse.ai"],
  gemini: ["gemini.google.com"],
  chatgpt: ["chatgpt.com", "www.chatgpt.com", "chat.openai.com"],
};
const maxResultBytes = 70 * 1024 * 1024;

export function providerForUrl(value: string): BridgeProvider | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return;
    // Muse sử dụng cả subdomain riêng; chỉ nới trong miền muse.ai.
    if (url.hostname === "muse.ai" || url.hostname.endsWith(".muse.ai")) return "muse";
    return (Object.entries(allowedHosts) as [BridgeProvider, string[]][]).find(([, hosts]) =>
      hosts.includes(url.hostname))?.[0];
  } catch { return; }
}

class ChromeBridgeRuntime {
  private server?: { port: number; stop: (closeActiveConnections?: boolean) => void };
  private socket?: { data: SocketData; send: (data: string) => unknown; close: (code?: number, reason?: string) => void };
  private token = "";
  private selections = new Map<BridgeProvider, BridgeSelection>();
  private calls = new Map<string, Call>();
  private jobs = new Map<string, Job>();

  get enabled() { const platform = getRuntimePlatform(); return platform.desktop && platform.os === "darwin"; }
  get connected() { return !!this.socket && this.socket.data.authenticated; }

  start() {
    if (!this.enabled) return;
    if (this.server) return;
    this.token = randomBytes(32).toString("hex");
    this.server = Bun.serve<SocketData>({
      hostname: "127.0.0.1", port: 0,
      fetch: (request, server) => {
        const origin = request.headers.get("origin") ?? "";
        const match = /^chrome-extension:\/\/([a-p]{32})$/.exec(origin);
        const url = new URL(request.url);
        if (!match || url.pathname !== "/" || url.search || url.hash || request.method !== "GET") return new Response(null, { status: 403 });
        if (server.upgrade(request, { data: { authenticated: false, extensionId: match[1]! } })) return undefined;
        return new Response(null, { status: 400 });
      },
      websocket: {
        maxPayloadLength: maxResultBytes, idleTimeout: 120, sendPings: true,
        open: (socket) => {
          const verification = setTimeout(() => {
            if (!socket.data.authenticated) socket.close(1008, "Pairing timed out");
          }, 5000);
          socket.data.authTimer = verification;
        },
        message: (socket, message) => {
          let value: Record<string, unknown>;
          try {
            const parsed: unknown = JSON.parse(String(message));
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
            value = parsed as Record<string, unknown>;
          } catch { socket.close(1008, "Invalid message"); return; }
          if (!socket.data.authenticated) {
            const candidate = typeof value.token === "string" && /^[a-f0-9]{64}$/.test(value.token) ? Buffer.from(value.token, "hex") : null;
            const correct = value.type === "auth" && !!candidate && timingSafeEqual(candidate, Buffer.from(this.token, "hex"));
            if (!correct || this.connected) { socket.close(1008, "Pairing rejected"); return; }
            socket.data.authenticated = true;
            clearTimeout(socket.data.authTimer);
            // ACT: mã ghép nối cũ hết hiệu lực ngay sau khi được chấp nhận; ngắt kết nối phải ghép nối lại.
            this.token = randomBytes(32).toString("hex");
            this.socket = socket;
            socket.send(JSON.stringify({ type: "ready" }));
            return;
          }
          if (socket !== this.socket) { socket.close(1008, "Not paired"); return; }
          if (value.type === "reply" && typeof value.id === "string") {
            const call = this.calls.get(value.id);
            if (!call) return;
            this.calls.delete(value.id);
            clearTimeout(call.timer);
            if (typeof value.error === "string") call.reject(new Error(value.error));
            else call.resolve(value.result);
          } else if (value.type === "job" && typeof value.id === "string") {
            const job = this.jobs.get(value.id);
            if (!job || job.tabId !== value.tabId || job.provider !== value.provider) return;
            if (value.state === "submitting" || value.state === "running") job.state = value.state;
            else if (value.state === "completed" && value.result && typeof value.result === "object") {
              const result = value.result as BridgeResult;
              if (result.kind !== "text" && result.kind !== "image" && result.kind !== "video") { this.finishJob(job, new Error("Kết quả AI không đúng loại")); return; }
              if (result.kind === "text" && (!result.text?.trim() || result.text.length > 1000000)
                || result.kind !== "text" && (!result.data || result.data.length > maxResultBytes || !/^(image\/(png|jpeg|webp)|video\/(mp4|webm|quicktime))$/.test(result.mimeType ?? ""))) {
                this.finishJob(job, new Error("Kết quả AI không hợp lệ hoặc vượt giới hạn")); return;
              }
              this.finishJob(job, undefined, result);
            } else if (value.state === "failed" || value.state === "cancelled") {
              this.finishJob(job, new Error(typeof value.error === "string" ? value.error : "AI không hoàn thành tác vụ"));
            }
          }
        },
        close: (socket) => {
          clearTimeout(socket.data.authTimer);
          if (socket !== this.socket) return;
          this.socket = undefined;
          this.selections.clear();
          for (const [id, call] of this.calls) { clearTimeout(call.timer); call.reject(new Error("Chrome đã ngắt kết nối")); this.calls.delete(id); }
          for (const job of [...this.jobs.values()]) this.finishJob(job, new Error("Chrome bị ngắt: trạng thái tác vụ đã gửi chưa xác định; không tự gửi lại"));
        },
      },
    });
  }

  status() {
    return {
      enabled: this.enabled, connected: this.connected,
      pairingCode: this.enabled && this.server && !this.connected ? "toonflow-bridge://127.0.0.1:" + this.server.port + "/" + this.token : null,
      selected: Object.fromEntries([...this.selections].map(([id, selection]) => [id, selection])),
      jobs: [...this.jobs.values()].map(job => ({ id: job.id, provider: job.provider, state: job.state, tabId: job.tabId, nodeId: job.nodeId })),
    };
  }

  private call(operation: string, payload: object, timeout = 15000): Promise<unknown> {
    if (!this.connected || !this.socket) return Promise.reject(new Error("Chưa ghép nối Chrome Companion"));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.calls.delete(id); reject(new Error("Chrome không phản hồi; không tự gửi lại")); }, timeout);
      this.calls.set(id, { resolve, reject, timer });
      try { this.socket!.send(JSON.stringify({ type: "request", id, operation, payload })); }
      catch (error) { clearTimeout(timer); this.calls.delete(id); reject(error); }
    });
  }

  async tabs(): Promise<(BridgeTab & { provider: BridgeProvider })[]> {
    const result = await this.call("tabs", {});
    if (!Array.isArray(result)) throw new Error("Danh sách tab không hợp lệ");
    return result.filter(tab => tab && Number.isInteger(tab.id) && typeof tab.url === "string" && providerForUrl(tab.url))
      .map(tab => ({ id: tab.id, title: String(tab.title ?? "").slice(0, 200), url: tab.url, provider: providerForUrl(tab.url)! }));
  }

  async select(provider: BridgeProvider, id: number) {
    if (!allowedHosts[provider] || !Number.isInteger(id) || id < 0) throw new Error("Nhà cung cấp hoặc tab không hợp lệ");
    if ([...this.jobs.values()].some(job => job.provider === provider)) throw new Error("Tab này đang có tác vụ; hãy hủy trước khi đổi tab");
    const found = (await this.tabs()).find(tab => tab.id === id && tab.provider === provider);
    if (!found) throw new Error("Không tìm thấy tab AI được phép");
    const result = await this.call("probe", { tabId: id, provider }) as { ready?: boolean; capabilities?: BridgeCapability[]; error?: string };
    if (!result?.ready) throw new Error(result?.error || "Tab chưa đăng nhập hoặc không tìm thấy ô nhập prompt");
    const capabilities = (["text", "image", "video"] as BridgeCapability[]).filter(capability => result.capabilities?.includes(capability));
    if (!capabilities.length) throw new Error("Tab không có chức năng đã được xác minh");
    this.selections.set(provider, { tab: found, capabilities });
    return this.status();
  }

  unselect(provider: BridgeProvider) {
    if (!allowedHosts[provider]) throw new Error("Nhà cung cấp không hợp lệ");
    if ([...this.jobs.values()].some(job => job.provider === provider)) throw new Error("Có tác vụ đang chạy; hãy hủy trước khi ngắt");
    this.selections.delete(provider);
    return this.status();
  }

  async refresh(provider: BridgeProvider) {
    const selection = this.selections.get(provider);
    if (!selection) throw new Error("Chưa chọn tab " + provider);
    return this.select(provider, selection.tab.id);
  }

  models(kind: BridgeCapability) {
    if (!this.enabled || !this.connected) return [];
    return [...this.selections.entries()].filter(([, value]) => value.capabilities.includes(kind))
      .map(([provider]) => ({
        providerId: "chromeBridge", providerLabel: "Chrome Companion",
        modelId: provider + "_" + kind, label: provider === "muse" ? "Muse · Chrome" : provider === "gemini" ? "Gemini · Chrome" : "ChatGPT · Chrome",
        type: kind, ...(kind === "image" ? { imageSizes: ["Theo giao diện AI"], imageRatios: ["16:9"] } : {}),
        ...(kind === "video" ? { mode: ["text", "singleImage"], audio: false, durationResolutionMap: [] } : {}),
      }));
  }

  async run(provider: BridgeProvider, kind: BridgeCapability, prompt: string, images: { data: string; mimeType: string }[] = [],
    options: object = {}, signal?: AbortSignal, requestId = randomUUID(), nodeId?: string): Promise<BridgeResult> {
    const selection = this.selections.get(provider);
    if (!selection || !this.connected) throw new Error("Chưa kết nối tab " + provider);
    if (!selection.capabilities.includes(kind)) throw new Error(provider + " chưa hỗ trợ " + kind + " trên tab được chọn");
    if (!prompt.trim() || prompt.length > 100000 || !/^[0-9a-f-]{36}$/i.test(requestId)) throw new Error("Yêu cầu AI không hợp lệ");
    if (images.length > 4 || images.some(image => !/^image\/(png|jpeg|webp)$/.test(image.mimeType) || image.data.length > 20 * 1024 * 1024)) throw new Error("Ảnh tham chiếu không được hỗ trợ hoặc quá lớn");
    if (this.jobs.has(requestId)) throw new Error("Tác vụ đã được gửi; không gửi trùng");
    return new Promise<BridgeResult>((resolve, reject) => {
      const job: Job = {
        id: requestId, provider, tabId: selection.tab.id, nodeId, state: "submitting", resolve, reject,
        timer: setTimeout(() => this.finishJob(job, new Error("Quá thời gian; yêu cầu có thể đã được AI nhận. Hãy kiểm tra tab, không tự gửi lại")), 15 * 60 * 1000),
      };
      const cancel = () => {
        void this.call("cancel", { id: requestId, tabId: job.tabId }).catch(() => {});
        this.finishJob(job, new DOMException("Đã yêu cầu hủy; kết quả trên website có thể vẫn tiếp tục", "AbortError"));
      };
      job.abort = () => signal?.removeEventListener("abort", cancel);
      this.jobs.set(requestId, job);
      if (signal?.aborted) { cancel(); return; }
      signal?.addEventListener("abort", cancel, { once: true });
      void this.call("run", { id: requestId, tabId: selection.tab.id, provider, kind, prompt, images, options }).then(result => {
        if (!(result as { accepted?: boolean } | null)?.accepted && this.jobs.has(requestId)) this.finishJob(job, new Error("Tiện ích Chrome không chấp nhận yêu cầu"));
      }, error => {
        // Không chắc lệnh đã tới tab hay chưa; không tự gửi lại.
        if (this.jobs.has(requestId)) this.finishJob(job, new Error("Không xác nhận được việc gửi cho Chrome: " + error.message));
      });
    });
  }

  private finishJob(job: Job, failure?: Error, result?: BridgeResult) {
    if (this.jobs.get(job.id) !== job) return;
    this.jobs.delete(job.id); clearTimeout(job.timer); job.abort?.();
    if (failure) job.reject(failure);
    else if (result) job.resolve(result);
  }

  async stop() {
    for (const job of [...this.jobs.values()]) this.finishJob(job, new Error("Ứng dụng đã đóng; chưa xác định tác vụ bên website"));
    for (const [id, call] of this.calls) { clearTimeout(call.timer); call.reject(new Error("Ứng dụng đã đóng")); this.calls.delete(id); }
    this.socket?.close(); this.socket = undefined;
    this.server?.stop(true); this.server = undefined; this.selections.clear(); this.token = "";
  }
}

export const chromeBridge = new ChromeBridgeRuntime();
