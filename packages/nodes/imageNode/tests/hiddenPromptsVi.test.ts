import { describe, expect, test } from "bun:test";
import { buildPanoramaPrompt } from "../src/imagePanorama";
import { buildMultiAnglePrompt, readMultiAngleSettings } from "../src/imageMultiAngle";
import { buildLightingPrompt, readLightingSettings } from "../src/imageLighting";

// These tests exercise real hidden-prompt builders; no provider or model is mocked.
function inVietnamese<T>(action: () => T) {
  const old = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: { lang: "vi" } } });
  try { return action(); }
  finally {
    if (old) Object.defineProperty(globalThis, "document", old);
    else Reflect.deleteProperty(globalThis, "document");
  }
}

describe("HD-08 hidden media prompts in Vietnamese", () => {
  test("spherical and cylindrical panoramas keep reference marker and aspect constraints", () => {
    const sphere = inVietnamese(() => buildPanoramaPrompt("sphere"));
    const cylinder = inVietnamese(() => buildPanoramaPrompt("cylinder"));
    for (const prompt of [sphere, cylinder]) {
      expect(prompt).toContain("{{ref 1}}");
      expect(prompt).not.toMatch(/[\u3400-\u9fff]/);
      expect(prompt).toContain("giữ");
    }
    expect(sphere).toContain("2:1");
    expect(cylinder).toContain("4:1");
    expect(buildPanoramaPrompt("sphere")).not.toContain("Không");
  });
  test("multi-angle camera uses real 3D numbers and no changed user reference or IDs", () => {
    const settings = readMultiAngleSettings({ azimuth: -135, elevation: 25, distance: 4.8 });
    const prompt = inVietnamese(() => buildMultiAnglePrompt(settings));
    expect(prompt).toContain("{{ref 1}}");
    expect(prompt).toContain("135 độ");
    expect(prompt).toContain("+X");
    expect(prompt).toContain("4.8");
    expect(prompt).not.toMatch(/[\u3400-\u9fff]/);
  });
  test("lighting prompt keeps user-entered description verbatim", () => {
    const settings = readLightingSettings({ preset: "neon", azimuth: -45, elevation: 20, brightness: 60, smartMode: true, smartDesc: "Giữ đèn biển xanh của tôi." });
    const prompt = inVietnamese(() => buildLightingPrompt(settings));
    expect(prompt).toContain("{{ref 1}}");
    expect(prompt).toContain("Giữ đèn biển xanh của tôi.");
    expect(prompt).toContain("-45");
    expect(prompt).not.toMatch(/[\u3400-\u9fff]/);
  });
});
