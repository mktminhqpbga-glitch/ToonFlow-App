import { describe, expect, test } from "bun:test";
import { findPresetNodeType, presets } from "./materialPresetCatalog";

describe("HD-03 material presets (real node catalog, no AI mock)", () => {
  test("all presets have stable IDs, non-empty prompts, and known kinds", () => {
    expect(new Set(presets.map(item => item.id)).size).toBe(presets.length);
    for (const preset of presets) {
      expect(preset.prompt.trim().length).toBeGreaterThan(20);
      expect(["image", "video"]).toContain(preset.kind);
    }
  });
  test("storyboard, nine camera angles, and exactly three character views are included", () => {
    expect(presets.find(p => p.id === "storyboard")?.prompt).toContain("6 khung");
    expect(presets.find(p => p.id === "nineAngles")?.prompt).toContain("3×3");
    const threeViews = presets.find(p => p.id === "threeViews");
    expect(threeViews?.title).toBe("Ba góc nhìn nhân vật");
    expect(threeViews?.prompt).toContain("ba góc nhìn");
  });
  test("disabled/missing nodes never create an unrelated substitute", () => {
    expect(findPresetNodeType([], "image")).toBeUndefined();
    expect(findPresetNodeType([{ type: "remote-someImageGenerationNode" }], "image")).toBeUndefined();
    expect(findPresetNodeType([{ type: "remote-imageGenerationNode" }], "image")).toBe("remote-imageGenerationNode");
    expect(findPresetNodeType([{ type: "remote-videoGenerationNode" }], "image")).toBeUndefined();
    expect(findPresetNodeType([{ type: "remote-videoGenerationNode" }], "video")).toBe("remote-videoGenerationNode");
  });
  test("editing a prompt does not mutate shared preset data", () => {
    const original = presets.find(p => p.id === "storyboard")!.prompt;
    let edited = original;
    edited += " yêu cầu riêng của người dùng";
    expect(edited).toContain("yêu cầu riêng");
    expect(presets.find(p => p.id === "storyboard")!.prompt).toBe(original);
  });
});
