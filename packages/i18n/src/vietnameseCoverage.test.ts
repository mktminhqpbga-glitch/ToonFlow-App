import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vi from "./locales/vi.json";
import { translate, setLocale } from "./index";
import { collectMessages, transformSource } from "./transform";

describe("HD-08 Vietnamese display transform safety", () => {
  test("all nine built-in node UMD bundles opt in to Vietnamese Vite transform", () => {
    const root = resolve(import.meta.dirname, "../../..");
    for (const name of [
      "audioGenerationNode", "audioNode", "director3dNode", "frameAnalysisNode",
      "imageGenerationNode", "imageNode", "textNode", "videoGenerationNode", "videoNode",
    ]) {
      const config = readFileSync(resolve(root, "packages/nodes", name, "vite.config.ts"), "utf8");
      expect(config).toContain("localizeBuiltIn: true");
    }
    const vite = readFileSync(resolve(root, "packages/nodeScaffold/index.ts"), "utf8");
    expect(vite).toContain("toonflowBuiltInNodeI18n");
    expect(vite).toContain("return transformSource(source, path)");
  });

  test("shared media UI strings resolve to Vietnamese; original IDs remain unchanged", () => {
    const dictionary = vi as Record<string, string>;
    for (const [zh, expected] of [
      ["音频生成失败", "Tạo âm thanh thất bại"],
      ["音频生成模型", "Model tạo âm thanh"],
      ["图片生成失败", "Tạo ảnh thất bại"],
      ["视频生成失败", "Tạo video thất bại"],
      ["历史记录", "Lịch sử"],
      ["生成视频", "Tạo video"],
    ]) expect(dictionary[zh]).toBe(expected);
    expect(Object.values(dictionary).filter(value => /[\u3400-\u9fff]/.test(value))).toHaveLength(0);
    setLocale("vi");
    expect(translate("生成视频")).toBe("Tạo video");
    expect(translate("nonexistent-model-id")).toBe("nonexistent-model-id");
    setLocale("zh-CN");
  });
  test("Vue generation node display translates while model IDs, JSON and hidden instructions are preserved", () => {
    const source = `<template><div title="生成视频">生成视频</div></template>
<script setup lang="ts">
const modelId = "muse_video";
const data = { providerId: "chromeBridge", modelId: "muse_video" };
const systemPrompt = "你是一个视频生成助手";
</script>`;
    const converted = transformSource(source, "/workspace/packages/nodes/videoGenerationNode/src/index.vue");
    expect(converted?.code).toContain("toonflowTranslate");
    expect(converted?.code).toContain("muse_video");
    expect(converted?.code).toContain('providerId: "chromeBridge"');
    expect(converted?.code).toContain('systemPrompt = "你是一个视频生成助手"');
    expect(collectMessages(source, "/workspace/packages/nodes/videoGenerationNode/src/index.vue")).toContain("生成视频");
  });
  test("shared component aria-labels and tooltips are extracted; user data is not transformed", () => {
    const source = `<template><el-button title="历史记录" aria-label="历史记录">历史记录</el-button><span>{{ userText }}</span></template>
<script setup lang="ts">const userText = "原始输入";</script>`;
    const result = transformSource(source, "/workspace/packages/nodeShared/src/components/mediaHistory.vue");
    expect(result?.code).toContain("toonflowTranslate");
    expect(result?.code).toContain('userText = "原始输入"');
    expect(collectMessages(source, "/workspace/packages/nodeShared/src/components/mediaHistory.vue")).toContain("历史记录");
  });
});
