import { describe, expect, test } from "bun:test";
import { assertTabDispatchAvailable, bridgeDiagnosis, verifyProbeCapabilities } from "./dispatchGuard";

const first = "a6c14c36-cb0b-445b-97f8-52791d743d25";
const second = "3c3122b2-c1a0-4c11-9b38-362e37be95c6";
const active = new Map([[first, { id: first, provider: "muse" as const, tabId: 7, state: "running" as const }]]);

describe("HD-07 Chrome Bridge safety and diagnostic regressions", () => {
  test("a second Task ID cannot submit to the same occupied tab", () => {
    expect(() => assertTabDispatchAvailable("muse", 7, second, active, [])).toThrow(/chồng prompt/);
    expect(() => assertTabDispatchAvailable("muse", 8, second, active, [])).not.toThrow();
  });
  test("the same Task ID cannot be dispatched twice, including recent tasks", () => {
    expect(() => assertTabDispatchAvailable("muse", 8, first, active, [])).toThrow(/Task ID/);
    expect(() => assertTabDispatchAvailable("muse", 8, second, new Map(), [
      { id: second, provider: "muse", tabId: 8, state: "completed" },
    ])).toThrow(/Task ID/);
  });
  test("UNKNOWN tab is quarantined until deliberate re-selection", () => {
    expect(() => assertTabDispatchAvailable("muse", 7, second, new Map(), [
      { id: first, provider: "muse", tabId: 7, state: "unknown" },
    ])).toThrow(/UNKNOWN/);
  });
  test("model readiness is revoked on logout, tab reload and lost capability", () => {
    const token = "41a4f04c-9c73-4fb7-a255-c00384c83173";
    const selection = { tab: { url: "https://muse.ai/chat" }, documentToken: token };
    const valid = { ready: true, url: selection.tab.url, documentToken: token, capabilities: ["image", "video"] };
    expect(verifyProbeCapabilities("muse", selection, valid)).toEqual(["image", "video"]);
    expect(verifyProbeCapabilities("muse", selection, { ...valid, ready: false })).toEqual([]);
    expect(verifyProbeCapabilities("muse", selection, { ...valid, documentToken: "cb21aa49-6c37-4dfc-9cb9-af6294219d80" })).toEqual([]);
    expect(verifyProbeCapabilities("muse", selection, { ...valid, url: "https://muse.ai/other" })).toEqual([]);
    expect(verifyProbeCapabilities("muse", selection, { ...valid, capabilities: ["text"] })).toEqual([]);
    expect(verifyProbeCapabilities("gemini", selection, { ...valid, capabilities: ["text", "image", "video"] })).toEqual(["text", "image"]);
  });
  test("no credentials or pairing tokens appear in diagnostics", () => {
    const data = bridgeDiagnosis({ enabled: true, connected: true, mode: "remote",
      remote: { url: "https://render.example", configured: true, transport: "wss",
        selectedDeviceId: "device-1", devices: [{ id: "device-1", online: true }] },
      selected: { muse: { tab: { id: 7 }, capabilities: ["image", "video"] } },
      jobs: [{ provider: "muse", tabId: 7, state: "running" }],
    });
    expect(data.stages.every(step => step.ready)).toBe(true);
    expect(data.providers.find(item => item.provider === "muse")?.state).toBe("running");
    expect(data.pendingJobs).toBe(1);
    expect(JSON.stringify(data)).not.toContain("render.example");
  });
  test("disconnect overrides stale running and UNKNOWN indicators without clearing recorded tasks", () => {
    const selected = { muse: { tab: { id: 7 }, capabilities: ["image", "video"] } };
    for (const state of ["running", "unknown"]) {
      const diagnostics = bridgeDiagnosis({
        enabled: true, connected: false, mode: "remote",
        remote: { configured: true, url: "https://relay.example", transport: "wss",
          selectedDeviceId: "device-1", devices: [{ id: "device-1", online: false }] },
        selected,
        jobs: [{ provider: "muse", tabId: 7, state }],
      });
      const muse = diagnostics.providers.find(item => item.provider === "muse");
      expect(muse?.state).toBe("offline");
      expect(muse?.connected).toBe(false);
      expect(muse?.capabilities).toEqual([]);
      expect(muse?.reason).toContain("Kiểm tra Relay");
      expect(diagnostics.stages.map(item => item.ready)).toEqual([true, false, false]);
      expect(diagnostics.pendingJobs).toBe(state === "running" ? 1 : 0);
    }
  });
  test("a selected tab with no verified capabilities is not reported ready", () => {
    const result = bridgeDiagnosis({ enabled: true, connected: true, mode: "local",
      selected: { muse: { tab: { id: 11 }, capabilities: [] } } });
    const muse = result.providers.find(item => item.provider === "muse");
    expect(muse?.tabId).toBe(11);
    expect(muse?.connected).toBe(false);
    expect(muse?.state).toBe("offline");
    expect(muse?.capabilities).toEqual([]);
    expect(muse?.reason).toContain("chưa có khả năng AI");
  });
  test("an older UNKNOWN job on another tab does not mislabel the freshly selected tab", () => {
    const result = bridgeDiagnosis({ enabled: true, connected: true, mode: "local",
      selected: { muse: { tab: { id: 9 }, capabilities: ["image"] } },
      jobs: [{ provider: "muse", tabId: 7, state: "unknown" }] });
    expect(result.providers.find(item => item.provider === "muse")?.state).toBe("ready");
  });
  test("missing relay/device/extension and tab capability have distinct reasons", () => {
    const offline = bridgeDiagnosis({ enabled: true, connected: false, mode: "remote",
      remote: { configured: false, transport: "offline", selectedDeviceId: "", devices: [] } });
    expect(offline.stages.map(item => item.ready)).toEqual([false, false, false]);
    expect(offline.providers.every(item => item.state === "offline")).toBe(true);
    const connected = bridgeDiagnosis({ enabled: true, connected: true, mode: "local",
      selected: { chatgpt: { tab: { id: 2 }, capabilities: ["text", "image"] } } });
    expect(connected.providers.find(item => item.provider === "chatgpt")?.capabilities).toEqual(["text", "image"]);
    expect(connected.providers.find(item => item.provider === "muse")?.reason).toContain("Chưa chọn");
  });
});
