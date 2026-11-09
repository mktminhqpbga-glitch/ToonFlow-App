import { randomBytes, randomUUID } from "node:crypto";
import conf from "@/utils/conf";
import { isBridgeResult, isBridgeDocumentToken, providerForUrl, type BridgeProbe, type BridgeCapability, type BridgeProvider, type BridgeResult, type BridgeSelection, type BridgeState } from "./runtime";
import { RemoteTransport } from "./remoteTransport";
import { prepareChromePrompt, requestedRatios } from "./ratio";
import { assertTabDispatchAvailable } from "./dispatchGuard";

type RemoteSettings = { url: string; ownerKey: string; deviceId: string; secrets: Record<string, string> };
type RemoteDevice = { id: string; name: string; online: boolean; createdAt: number };
type Pending = { pairId: string; name: string; expiresAt: number };
type Call = { resolve: (result: unknown) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> };
type Job = { id: string; provider: BridgeProvider; tabId: number; nodeId?: string; documentToken: string; kind: BridgeCapability; state: BridgeState;
  resolve: (value: BridgeResult) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout>; cleanup: () => void };
const providers: BridgeProvider[] = ["muse", "gemini", "chatgpt"];
const empty = (): RemoteSettings => ({ url: "", ownerKey: "", deviceId: "", secrets: {} });
function load(): RemoteSettings { const config = conf.get("chromeBridgeRemote", empty()); return { ...empty(), ...config, secrets: config.secrets ?? {} }; }
function persist(value: RemoteSettings) { conf.set("chromeBridgeRemote", value); }
function checkUrl(input: string): string {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash
    || !["", "/"].includes(url.pathname)) throw new Error("Render Relay URL must be an HTTPS origin");
  return url.origin;
}
class RemoteBridge {
  private settings = load();
  private channel?: RemoteTransport;
  private enabled = false;
  private devices: RemoteDevice[] = [];
  private pending: Pending[] = [];
  private pendingCode?: { pairId: string; secret: string; code: string; expires: number };
  private selected = new Map<BridgeProvider, BridgeSelection>();
  private calls = new Map<string, Call>();
  private jobs = new Map<string, Job>();
  private recent: { id: string; provider: BridgeProvider; tabId: number; nodeId?: string; state: BridgeState }[] = [];
  get active() { return this.enabled; }
  get connected() {
    return this.enabled && !!this.channel && this.channel.transport !== "offline"
      && !!this.devices.find(device => device.id === this.settings.deviceId && device.online);
  }
  status() {
    return { enabled: true, connected: this.connected, pairingCode: this.pendingCode?.code || null,
      selected: Object.fromEntries(this.selected),
      jobs: [...[...this.jobs.values()].map(x => ({ id: x.id, provider: x.provider, tabId: x.tabId,
        nodeId: x.nodeId, state: x.state })), ...this.recent],
      remote: { url: this.settings.url, configured: !!this.settings.ownerKey,
        transport: this.channel?.transport ?? "offline", devices: this.devices,
        pending: this.pending, selectedDeviceId: this.settings.deviceId, expiresAt: this.pendingCode?.expires || null },
      mode: "remote" as const,
    };
  }
  private async request(path: string, method = "GET", payload?: object) {
    if (!this.settings.url || !this.settings.ownerKey) throw new Error("Configure Render Relay first");
    const response = await fetch(this.settings.url + path, { method, headers: {
      Authorization: "Bearer " + this.settings.ownerKey, ...(payload ? { "Content-Type": "application/json" } : {}),
    }, ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(25000) });
    const data = await response.json() as Record<string, any>;
    if (!response.ok) throw new Error(String(data.error || "Render Relay HTTP " + response.status));
    return data;
  }
  private createChannel() {
    this.channel?.stop();
    const deviceId = this.settings.deviceId, secret = this.settings.secrets[deviceId];
    if (!this.enabled || !deviceId || !secret || !this.settings.ownerKey || !this.settings.url) return;
    this.channel = new RemoteTransport(this.settings.url, this.settings.ownerKey, deviceId, secret, "owner",
      value => this.onMessage(value), error => this.rejectPending(error));
    this.channel.start();
  }
  start() {
    this.enabled = true;
    if (this.settings.url && this.settings.ownerKey) {
      void this.refreshDevices().then(() => this.createChannel()).catch(() => this.createChannel());
    }
  }
  stop() {
    this.enabled = false;
    this.channel?.stop(); this.channel = undefined;
    this.rejectPending("Remote Bridge stopped; AI task may still be running");
    this.selected.clear();
  }
  private rejectPending(reason: string) {
    // A Relay transport loss invalidates any prior tab/document readiness; require a fresh probe.
    this.selected.clear();
    for (const [id, call] of this.calls) {
      clearTimeout(call.timeout); call.reject(new Error(reason)); this.calls.delete(id);
    }
    for (const job of [...this.jobs.values()]) this.finishJob(job, new Error(reason), undefined, "unknown");
  }
  async configure(url: string, ownerKey: string) {
    if (this.jobs.size) throw new Error("Finish or cancel remote AI tasks before changing the Relay");
    const next = checkUrl(url);
    if (ownerKey.trim().length < 32) throw new Error("Owner key must have at least 32 characters");
    const old = this.settings;
    const preserve = old.url === next && old.ownerKey === ownerKey.trim();
    const candidate: RemoteSettings = { url: next, ownerKey: ownerKey.trim(),
      deviceId: preserve ? old.deviceId : "", secrets: preserve ? { ...old.secrets } : {} };
    this.stop();
    this.settings = candidate;
    try {
      // Only verified Relay credentials may replace the persisted, working configuration.
      await this.request("/v1/owner/devices");
      await this.refreshDevices();
      persist(this.settings);
      this.enabled = true;
      this.createChannel();
      return this.status();
    } catch (error) {
      // An incorrect key or unreachable Render endpoint must never destroy a previously paired device.
      this.settings = old;
      this.enabled = true;
      if (old.url && old.ownerKey) this.createChannel();
      throw error;
    }
  }
  async refreshDevices() {
    const [devices, pending] = await Promise.all([
      this.request("/v1/owner/devices"), this.request("/v1/owner/pending"),
    ]);
    this.devices = Array.isArray(devices.devices) ? devices.devices : [];
    this.pending = Array.isArray(pending.pending) ? pending.pending : [];
    if (this.settings.deviceId && !this.devices.some(device => device.id === this.settings.deviceId)) {
      this.settings.deviceId = ""; this.selected.clear(); persist(this.settings);
      this.channel?.stop(); this.channel = undefined;
    }
    return this.status();
  }
  async pair() {
    if (!this.settings.url) throw new Error("Configure Render Relay before pairing");
    const pairId = randomUUID(), secret = randomBytes(32).toString("hex");
    const result = await this.request("/v1/owner/pair", "POST", { pairId });
    this.pendingCode = { pairId, secret, expires: Number(result.expiresAt),
      code: "toonflow-remote://pair?relay=" + encodeURIComponent(this.settings.url) +
        "&id=" + pairId + "#" + secret };
    return this.status();
  }
  async approve(pairId: string) {
    const code = this.pendingCode;
    if (!code || code.pairId !== pairId || code.expires < Date.now())
      throw new Error("The one-time pairing secret expired or is unavailable");
    const device = await this.request("/v1/owner/approve", "POST", { pairId });
    this.settings.secrets[device.deviceId] = code.secret;
    this.settings.deviceId = device.deviceId; this.pendingCode = undefined;
    persist(this.settings);
    await this.refreshDevices(); this.selected.clear(); this.createChannel();
    return this.status();
  }
  async selectDevice(deviceId: string) {
    if (this.jobs.size) throw new Error("Cancel active tasks before switching Chrome devices");
    if (!this.devices.some(device => device.id === deviceId) || !this.settings.secrets[deviceId])
      throw new Error("Selected device does not have a local encryption key");
    this.settings.deviceId = deviceId; persist(this.settings);
    this.selected.clear(); this.recent = []; this.createChannel();
    return this.status();
  }
  async rename(deviceId: string, name: string) {
    await this.request("/v1/owner/rename", "POST", { deviceId, name });
    return this.refreshDevices();
  }
  async revoke(deviceId: string) {
    if (this.jobs.size) throw new Error("Cancel tasks before revoking devices");
    await this.request("/v1/owner/revoke", "POST", { deviceId });
    delete this.settings.secrets[deviceId];
    if (this.settings.deviceId === deviceId) this.settings.deviceId = "";
    persist(this.settings); this.selected.clear(); this.channel?.stop(); this.channel = undefined;
    await this.refreshDevices(); return this.status();
  }
  private call(operation: string, payload: object, timeoutMs = 20000) {
    if (!this.connected || !this.channel) return Promise.reject(new Error("Remote Chrome offline"));
    const id = randomUUID(), channel = this.channel;
    return new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => { this.calls.delete(id); reject(new Error("Remote request unconfirmed; do not retry AI prompts")); }, timeoutMs);
      this.calls.set(id, { resolve, reject, timeout });
      void channel.send({ type: "request", id, operation, payload }).catch(error => {
        clearTimeout(timeout); this.calls.delete(id); reject(error);
      });
    });
  }
  async tabs(): Promise<{ id: number; title: string; url: string; provider: BridgeProvider }[]> {
    const result = await this.call("tabs", {});
    if (!Array.isArray(result)) throw new Error("Invalid remote tab list");
    return result.filter(item => Number.isInteger(item.id) && providerForUrl(item.url) === item.provider);
  }
  async select(provider: BridgeProvider, tabId: number, confirmUnknown = true) {
    if (!providers.includes(provider)) throw new Error("Unsupported provider");
    if ([...this.jobs.values()].some(x => x.provider === provider)) throw new Error("AI task already running");
    const tab = (await this.tabs()).find(tab => tab.provider === provider && tab.id === tabId);
    if (!tab) throw new Error("Remote tab not found");
    const probe = await this.call("probe", { provider, tabId }) as BridgeProbe;
    if (!probe?.ready) throw new Error(probe?.error || "AI tab not logged in");
    if (!isBridgeDocumentToken(probe.documentToken) || probe.url !== tab.url)
      throw new Error("Phiên tab thay đổi hoặc Extension quá cũ; cập nhật Extension và chọn lại tab");
    const capabilities = (["text", "image", "video"] as BridgeCapability[]).filter(kind =>
      probe.capabilities?.includes(kind) && (provider === "muse" ? kind !== "text" : kind !== "video"));
    if (!capabilities.length) throw new Error("No capability verified in remote tab");
    this.selected.set(provider, { tab, capabilities, documentToken: probe.documentToken });
    if (confirmUnknown) this.recent = this.recent.filter(job => job.tabId !== tabId || job.state !== "unknown");
    return this.status();
  }
  async refresh(provider: BridgeProvider) {
    const tab = this.selected.get(provider)?.tab;
    if (!tab) throw new Error("No selected AI tab");
    return this.select(provider, tab.id, false);
  }
  unselect(provider: BridgeProvider) {
    if (this.jobs.size) throw new Error("Cancel active tasks first");
    this.selected.delete(provider); return this.status();
  }
  async verifySelections() {
    if (!this.connected) { this.selected.clear(); return; }
    for (const [provider, selection] of [...this.selected.entries()]) {
      if ([...this.jobs.values()].some(job => job.provider === provider)) continue;
      try {
        const probe = await this.call("probe", { tabId: selection.tab.id, provider }) as BridgeProbe;
        if (!probe?.ready || !isBridgeDocumentToken(probe.documentToken)
          || probe.documentToken !== selection.documentToken || probe.url !== selection.tab.url) {
          this.selected.delete(provider);
        } else {
          const capabilities = (["text", "image", "video"] as BridgeCapability[]).filter(kind =>
            probe.capabilities?.includes(kind) && (provider === "muse" ? kind !== "text" : kind !== "video"));
          if (!capabilities.length) this.selected.delete(provider);
          else this.selected.set(provider, { ...selection, capabilities });
        }
      } catch { this.selected.delete(provider); }
    }
  }
  models(kind: BridgeCapability) {
    if (!this.connected) return [];
    return [...this.selected.entries()].filter(([, choice]) => choice.capabilities.includes(kind))
      .map(([provider]) => ({ providerId: "chromeBridge", providerLabel: "Chrome Companion",
        modelId: provider + "_" + kind, label: provider + " · Remote Chrome", type: kind,
        ...(kind === "image" ? { imageSizes: ["Default"], imageRatios: [...requestedRatios] } : {}),
        ...(kind === "video" ? { mode: ["text", "singleImage"], audio: false, durationResolutionMap: [] } : {}),
      }));
  }
  async run(provider: BridgeProvider, kind: BridgeCapability, prompt: string,
    images: { data: string; mimeType: string }[] = [], options: object = {},
    signal?: AbortSignal, requestId: string = randomUUID(), nodeId?: string): Promise<BridgeResult> {
    const choice = this.selected.get(provider);
    if (!this.connected || !choice?.capabilities.includes(kind)) throw new Error("Remote AI not ready");
    if (!prompt.trim() || prompt.length > 100000 || !/^[0-9a-f-]{36}$/i.test(requestId)
      || images.length > 4 || images.some(img => !/^image\/(png|jpeg|webp)$/.test(img.mimeType)
        || img.data.length > 20 * 1024 * 1024)) throw new Error("Invalid remote AI prompt or reference image");
    assertTabDispatchAvailable(provider, choice.tab.id, requestId, this.jobs, this.recent);
    const preparedPrompt = prepareChromePrompt(kind, prompt, options);
    return new Promise((resolve, reject) => {
      const tabId = choice.tab.id;
      const job: Job = { id: requestId, provider, tabId, nodeId, kind, documentToken: choice.documentToken, state: "submitting", resolve, reject,
        timeout: setTimeout(() => this.finishJob(job, new Error("AI result timeout; check Chrome before resubmitting"), undefined, "unknown"), 15 * 60 * 1000),
        cleanup: () => {},
      };
      const onAbort = () => {
        void this.call("cancel", { id: requestId, tabId }).catch(() => {});
        this.finishJob(job, new DOMException("Remote cancel requested; website may still run", "AbortError"), undefined, "unknown");
      };
      job.cleanup = () => signal?.removeEventListener("abort", onAbort);
      this.jobs.set(requestId, job);
      if (signal?.aborted) { onAbort(); return; }
      signal?.addEventListener("abort", onAbort, { once: true });
      void this.call("run", { id: requestId, tabId, expectedUrl: choice.tab.url, expectedDocumentToken: choice.documentToken, provider, kind, prompt: preparedPrompt, images, options }).then(answer => {
        if ((answer as { uncertain?: boolean })?.uncertain) {
          this.finishJob(job, new Error("Tác vụ đã gửi nhưng chưa rõ kết quả; không gửi lại tự động"), undefined, "unknown"); return;
        }
        if (!(answer as { accepted?: boolean })?.accepted) this.finishJob(job, new Error("Remote AI refused request"));
      }, error => this.finishJob(job, new Error("Submission uncertain: " + error.message), undefined, "unknown"));
    });
  }
  private onMessage(raw: unknown) {
    if (!raw || typeof raw !== "object") return;
    const msg = raw as Record<string, any>;
    if (msg.type === "reply" && typeof msg.id === "string") {
      const call = this.calls.get(msg.id); if (!call) return;
      this.calls.delete(msg.id); clearTimeout(call.timeout);
      if (typeof msg.error === "string") call.reject(new Error(msg.error));
      else call.resolve(msg.result);
    } else if (msg.type === "job" && typeof msg.id === "string") {
      const job = this.jobs.get(msg.id);
      if (!job || msg.provider !== job.provider || msg.tabId !== job.tabId || msg.documentToken !== job.documentToken) return;
      if (msg.state === "submitting" || msg.state === "running") job.state = msg.state;
      else if (msg.state === "completed") {
        const result = msg.result;
        if (!isBridgeResult(result, job.kind))
          this.finishJob(job, new Error("AI returned invalid or mismatched output"));
        else this.finishJob(job, undefined, result);
      } else if (msg.state === "failed" || msg.state === "cancelled" || msg.state === "unknown")
        this.finishJob(job, new Error(String(msg.error || "Remote AI task failed")), undefined,
          msg.state === "unknown" ? "unknown" : undefined);
    }
  }
  private finishJob(job: Job, error?: Error, result?: BridgeResult, failureState?: "unknown") {
    if (this.jobs.get(job.id) !== job) return;
    this.jobs.delete(job.id); clearTimeout(job.timeout); job.cleanup();
    const state: BridgeState = failureState ?? (error ? error.name === "AbortError" ? "cancelled" : "failed" : "completed");
    this.recent.unshift({ id: job.id, provider: job.provider, tabId: job.tabId, nodeId: job.nodeId, state });
    if (this.recent.length > 20) this.recent.length = 20;
    if (error) job.reject(error); else if (result) job.resolve(result);
  }
}
export const remoteBridge = new RemoteBridge();
