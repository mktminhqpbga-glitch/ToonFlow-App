import conf from "@/utils/conf";
import { chromeBridge as localBridge, type BridgeCapability, type BridgeProvider } from "./runtime";
import { remoteBridge } from "./remote";

// The original local loopback transport is retained unchanged and never depends on Render.
class BridgeManager {
  private mode: "local" | "remote" = conf.get("chromeBridgeMode", "local") === "remote" ? "remote" : "local";
  get currentMode() { return this.mode; }
  get enabled() { return localBridge.enabled; }
  get connected() { return this.mode === "local" ? localBridge.connected : remoteBridge.connected; }
  start() {
    localBridge.start();
    if (this.mode === "remote") remoteBridge.start();
  }
  async stop() { remoteBridge.stop(); await localBridge.stop(); }
  status() {
    return this.mode === "local"
      ? { ...localBridge.status(), mode: "local" as const }
      : remoteBridge.status();
  }
  async refreshStatus() {
    if (this.mode === "remote") {
      try { await remoteBridge.refreshDevices(); } catch { /* Keep last verified state, render disconnection. */ }
    }
    return this.status();
  }
  setMode(mode: "local" | "remote") {
    if (mode !== this.mode) {
      const current = this.status();
      if (current.jobs.some(job => job.state === "submitting" || job.state === "running"))
        throw new Error("Cancel or finish AI jobs before changing Chrome Bridge mode");
      if (this.mode === "remote") remoteBridge.stop();
      this.mode = mode;
      conf.set("chromeBridgeMode", mode);
      if (mode === "remote") remoteBridge.start();
    }
    return this.status();
  }
  configureRemote(url: string, ownerKey: string) { return remoteBridge.configure(url, ownerKey); }
  listDevices() { return remoteBridge.refreshDevices(); }
  createPairing() { return remoteBridge.pair(); }
  approvePairing(pairId: string) { return remoteBridge.approve(pairId); }
  selectDevice(deviceId: string) { return remoteBridge.selectDevice(deviceId); }
  renameDevice(deviceId: string, name: string) { return remoteBridge.rename(deviceId, name); }
  revokeDevice(deviceId: string) { return remoteBridge.revoke(deviceId); }
  tabs() { return this.mode === "remote" ? remoteBridge.tabs() : localBridge.tabs(); }
  select(provider: BridgeProvider, tabId: number) {
    return this.mode === "remote" ? remoteBridge.select(provider, tabId) : localBridge.select(provider, tabId);
  }
  refresh(provider: BridgeProvider) {
    return this.mode === "remote" ? remoteBridge.refresh(provider) : localBridge.refresh(provider);
  }
  unselect(provider: BridgeProvider) {
    return this.mode === "remote" ? remoteBridge.unselect(provider) : localBridge.unselect(provider);
  }
  models(kind: BridgeCapability) {
    return this.mode === "remote" ? remoteBridge.models(kind) : localBridge.models(kind);
  }
  run(provider: BridgeProvider, kind: BridgeCapability, prompt: string,
    images: { data: string; mimeType: string }[] = [], options: object = {}, signal?: AbortSignal,
    requestId?: string, nodeId?: string) {
    return this.mode === "remote"
      ? remoteBridge.run(provider, kind, prompt, images, options, signal, requestId, nodeId)
      : localBridge.run(provider, kind, prompt, images, options, signal, requestId, nodeId);
  }
}
export const chromeBridge = new BridgeManager();
