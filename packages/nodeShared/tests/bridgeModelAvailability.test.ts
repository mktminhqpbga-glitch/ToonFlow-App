import { describe, expect, test } from "bun:test";
import { bridgeTabCanRun, bridgeTabDiscoveries } from "../src/bridgeModelAvailability";

describe("AI-Bridge output availability in model picker", () => {
  test("ready tabs without reported outputKinds are visible but not selectable for images", () => {
    const tabs = [
      { provider: "muse", ready: true, busy: false },
      { provider: "muse", ready: true, busy: false },
      { provider: "chatgpt", ready: true, busy: false },
    ];
    expect(bridgeTabDiscoveries(tabs, "image")).toEqual([
      { provider: "muse", count: 2, ready: 2, capable: 0 },
      { provider: "chatgpt", count: 1, ready: 1, capable: 0 },
    ]);
    expect(tabs.every(tab => !bridgeTabCanRun(tab, "image"))).toBe(true);
    expect(bridgeTabCanRun(tabs[0]!, "text")).toBe(true);
  });
  test("only exact declared output kind on ready idle tab enables model", () => {
    const tab = { provider: "chatgpt", ready: true, busy: false, outputKinds: ["image"] };
    expect(bridgeTabCanRun(tab, "image")).toBe(true);
    expect(bridgeTabCanRun(tab, "video")).toBe(false);
    expect(bridgeTabCanRun({ ...tab, busy: true }, "image")).toBe(false);
    expect(bridgeTabCanRun({ ...tab, ready: false }, "image")).toBe(false);
  });
});
