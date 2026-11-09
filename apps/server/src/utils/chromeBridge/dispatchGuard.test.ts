import { describe, expect, test } from "bun:test";
import { assertTabDispatchAvailable, bridgeDiagnosis } from "./dispatchGuard";

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
