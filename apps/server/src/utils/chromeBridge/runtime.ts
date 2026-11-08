import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { getRuntimePlatform } from "@/lib/platform";
import { prepareChromePrompt, requestedRatios } from "./ratio";

export type BridgeProvider = "muse" | "gemini" | "chatgpt";
export type BridgeCapability = "text" | "image" | "video";
export type BridgeResult = { kind: BridgeCapability; text?: string; data?: string; mimeType?: string; width?: number; height?: number; duration?: number };
export type BridgeTab = { id: number; title: string; url: string };
export type BridgeSelection = { tab: BridgeTab; capabilities: BridgeCapability[]; documentToken: string };
export type BridgeProbe = { ready?: boolean; capabilities?: BridgeCapability[]; error?: string; documentToken?: string; url?: string };
export type BridgeState = "idle" | "connecting" | "ready" | "submitting" | "running" | "completed" | "failed" | "cancelled" | "disconnected" | "unknown";

type SocketData = { authenticated: boolean; extensionId: string; authTimer?: ReturnType<typeof setTimeout> };
type Call = { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> };
type Job = { id: string; provider: BridgeProvider; tabId: number; documentToken: string; kind: BridgeCapability; state: BridgeState; nodeId?: string; resolve: (value: BridgeResult) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout>; abort?: () => void };

const allowedHosts: Record<BridgeProvider, string[]> = {
  muse: ["muse.ai"],
  gemini: ["gemini.google.com"],
  chatgpt: ["chatgpt.com", "www.chatgpt.com", "chat.openai.com"],
};
const maxResultBytes = 70 * 1024 * 1024;

export function isBridgeResult(value: unknown, kind: BridgeCapability): value is BridgeResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  if (result.kind !== kind) return false;
  if (kind === "text") return typeof result.text === "string" && !!result.text.trim() && result.text.length <= 1000000;
  if (typeof result.data !== "string" || result.data.length > 65 * 1024 * 1024 || result.data.length < 28
    || result.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(result.data)) return false;
  if (typeof result.mimeType !== "string" || !(kind === "image" ? /^image\/(png|jpeg|webp)$/ : /^video\/(mp4|webm|quicktime)$/).test(result.mimeType)) return false;
  if (![result.width, result.height].every(value => typeof value === "number" && Number.isInteger(value) && value > 0)) return false;
  return kind !== "video" || typeof result.duration === "number" && Number.isFinite(result.duration) && result.duration > 0;
}

export function isBridgeDocumentToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
}

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
  private server?: { port?: number; stop: (closeActiveConnections?: boolean) => void };
  private socket?: { data: SocketData; send: (data: string) => unknown; close: (code?: number, reason?: string) => void };
  private token = "";
  private selections = new Map<BridgeProvider, BridgeSelection>();
  private calls = new Map<string, Call>();
  private jobs = new Map<string, Job>();
  // ACT: chỉ lưu metadata ngắn của các lần hoàn tất, không lưu prompt, ảnh, video hoặc thông tin đăng nhập.
  private recentJobs: { id: string; provider: BridgeProvider; nodeId?: string; tabId: number; state: BridgeState }[] = [];

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
            if (!job || job.tabId !== value.tabId || job.provider !== value.provider || job.documentToken !== value.documentToken) return;
            if (value.state === "submitting" || value.state === "running") job.state = value.state;
            else if (value.state === "completed" && value.result && typeof value.result === "object") {
              const result = value.result;
              if (!isBridgeResult(result, job.kind)) {
                this.finishJob(job, new Error("Kết quả AI không đúng tác vụ, định dạng hoặc kích thước hợp lệ")); return;
              }
              this.finishJob(job, undefined, result);
            } else if (value.state === "failed" || value.state === "cancelled" || value.state === "unknown") {
              this.finishJob(job, new Error(typeof value.error === "string" ? value.error : "AI không hoàn thành tác vụ"), undefined,
                value.state === "unknown" ? "unknown" : undefined);
            }
          }
        },
        close: (socket) => {
          clearTimeout(socket.data.authTimer);
          if (socket !== this.socket) return;
          this.socket = undefined;
          this.selections.clear();
          for (const [id, call] of this.calls) { clearTimeout(call.timer); call.reject(new Error("Chrome đã ngắt kết nối")); this.calls.delete(id); }
          for (const job of [...this.jobs.values()]) this.finishJob(job, new Error("Chrome bị ngắt: trạng thái tác vụ đã gửi chưa xác định; không tự gửi lại"), undefined, "unknown");
        },
      },
    });
  }

  status() {
    return {
      enabled: this.enabled, connected: this.connected,
      pairingCode: this.enabled && this.server?.port !== undefined && !this.connected ? "toonflow-bridge://127.0.0.1:" + this.server.port + "/" + this.token : null,
      selected: Object.fromEntries([...this.selections].map(([id, selection]) => [id, selection])),
      jobs: [
        ...[...this.jobs.values()].map(job => ({ id: job.id, provider: job.provider, state: job.state, tabId: job.tabId, nodeId: job.nodeId })),
        ...this.recentJobs,
      ],
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
    const result = await this.call("probe", { tabId: id, provider }) as BridgeProbe;
    if (!result?.ready) throw new Error(result?.error || "Tab chưa đăng nhập hoặc không tìm thấy ô nhập prompt");
    if (!isBridgeDocumentToken(result.documentToken) || result.url !== found.url)
      throw new Error("Phiên tab thay đổi hoặc Extension quá cũ; cập nhật Extension và chọn lại tab");
    const capabilities = (["text", "image", "video"] as BridgeCapability[]).filter(capability => result.capabilities?.includes(capability));
    if (!capabilities.length) throw new Error("Tab không có chức năng đã được xác minh");
    this.selections.set(provider, { tab: found, capabilities, documentToken: result.documentToken });
    this.recentJobs = this.recentJobs.filter(job => job.provider !== provider);
    return this.status();
  }

  unselect(provider: BridgeProvider) {
    if (!allowedHosts[provider]) throw new Error("Nhà cung cấp không hợp lệ");
    if ([...this.jobs.values()].some(job => job.provider === provider)) throw new Error("Có tác vụ đang chạy; hãy hủy trước khi ngắt");
    this.selections.delete(provider);
    this.recentJobs = this.recentJobs.filter(job => job.provider !== provider);
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
        type: kind, ...(kind === "image" ? { imageSizes: ["Theo giao diện AI"], imageRatios: [...requestedRatios] } : {}),
        ...(kind === "video" ? { mode: ["text", "singleImage"], audio: false, durationResolutionMap: [] } : {}),
      }));
  }

  async run(provider: BridgeProvider, kind: BridgeCapability, prompt: string, images: { data: string; mimeType: string }[] = [],
    options: object = {}, signal?: AbortSignal, requestId: string = randomUUID(), nodeId?: string): Promise<BridgeResult> {
    const selection = this.selections.get(provider);
    if (!selection || !this.connected) throw new Error("Chưa kết nối tab " + provider);
    if (!selection.capabilities.includes(kind)) throw new Error(provider + " chưa hỗ trợ " + kind + " trên tab được chọn");
    if (!prompt.trim() || prompt.length > 100000 || !/^[0-9a-f-]{36}$/i.test(requestId)) throw new Error("Yêu cầu AI không hợp lệ");
    if (images.length > 4 || images.some(image => !/^image\/(png|jpeg|webp)$/.test(image.mimeType) || image.data.length > 20 * 1024 * 1024)) throw new Error("Ảnh tham chiếu không được hỗ trợ hoặc quá lớn");
    if (this.jobs.has(requestId)) throw new Error("Tác vụ đã được gửi; không gửi trùng");
    const preparedPrompt = prepareChromePrompt(kind, prompt, options);
    return new Promise<BridgeResult>((resolve, reject) => {
      const job: Job = {
        id: requestId, provider, tabId: selection.tab.id, nodeId, documentToken: selection.documentToken, kind, state: "submitting", resolve, reject,
        timer: setTimeout(() => this.finishJob(job, new Error("Quá thời gian; yêu cầu có thể đã được AI nhận. Hãy kiểm tra tab, không tự gửi lại"), undefined, "unknown"), 15 * 60 * 1000),
      };
      const cancel = () => {
        void this.call("cancel", { id: requestId, tabId: job.tabId }).catch(() => {});
        this.finishJob(job, new DOMException("Đã yêu cầu hủy; kết quả trên website có thể vẫn tiếp tục", "AbortError"));
      };
      job.abort = () => signal?.removeEventListener("abort", cancel);
      this.jobs.set(requestId, job);
      if (signal?.aborted) { cancel(); return; }
      signal?.addEventListener("abort", cancel, { once: true });
      void this.call("run", { id: requestId, tabId: selection.tab.id, expectedUrl: selection.tab.url, expectedDocumentToken: selection.documentToken, provider, kind, prompt: preparedPrompt, images, options }).then(result => {
        if ((result as { uncertain?: boolean } | null)?.uncertain) {
          this.finishJob(job, new Error("Tác vụ đã gửi nhưng chưa rõ kết quả; không gửi lại tự động"), undefined, "unknown"); return;
        }
        if (!(result as { accepted?: boolean } | null)?.accepted && this.jobs.has(requestId)) this.finishJob(job, new Error("Tiện ích Chrome không chấp nhận yêu cầu"));
      }, error => {
        // Không chắc lệnh đã tới tab hay chưa; không tự gửi lại.
        if (this.jobs.has(requestId)) this.finishJob(job, new Error("Không xác nhận được việc gửi cho Chrome: " + error.message), undefined, "unknown");
      });
    });
  }

  private finishJob(job: Job, failure?: Error, result?: BridgeResult, failureState?: "unknown") {
    if (this.jobs.get(job.id) !== job) return;
    this.jobs.delete(job.id); clearTimeout(job.timer); job.abort?.();
    const state: BridgeState = failureState ?? (failure
      ? failure.name === "AbortError" ? "cancelled" : /ngắt kết nối|bị ngắt|disconnected/i.test(failure.message) ? "disconnected" : "failed"
      : "completed");
    this.recentJobs.unshift({ id: job.id, provider: job.provider, tabId: job.tabId, nodeId: job.nodeId, state });
    if (this.recentJobs.length > 20) this.recentJobs.length = 20;
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
