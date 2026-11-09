import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../../..");
const source = (file: string) => readFileSync(resolve(root, file), "utf8");
const han = /[\u3400-\u9fff]/;

function constantBody(path: string, variable: string) {
  const text = source(path);
  const start = text.indexOf("export const " + variable + " = `");
  if (start < 0) throw new Error("Missing Vietnamese hidden prompt: " + variable);
  const offset = start + ("export const " + variable + " = `").length;
  const end = text.indexOf("`;", offset);
  if (end < 0) throw new Error("Unterminated prompt: " + variable);
  return text.slice(offset, end);
}

describe("HD-08 Vietnamese hidden prompts are truly selected, not just documented", () => {
  test("agent system prompt has a complete Vietnamese variant with required template placeholders", () => {
    const path = "apps/server/src/agent/runtime/prompt.ts";
    const body = constantBody(path, "defaultSystemPromptVi");
    expect(body.length).toBeGreaterThan(3000);
    expect(han.test(body)).toBe(false);
    for (const marker of ["{{tools}}", "{{environment}}", "{{#guidelines}}", "{{/guidelines}}"])
      expect(body).toContain(marker);
    expect(source(path)).toContain('getLocale() === "vi" ? defaultSystemPromptVi : defaultSystemPrompt');
  });
  test("director 3D prompt keeps literal schema fields and Vietnamese user instructions", () => {
    const path = "packages/nodes/director3dNode/src/agentPrompt.ts";
    const body = constantBody(path, "directorPromptVi");
    expect(body.length).toBeGreaterThan(2000);
    expect(han.test(body)).toBe(false);
    for (const key of ["objectId", "threeJsonId", "readDocument", "editDocument", "{{ref N}}"])
      expect(body).toContain(key);
    expect(source("packages/nodes/director3dNode/src/index.vue"))
      .toContain('document.documentElement.lang === "vi" ? directorPromptVi : directorPrompt');
  });
  test("custom provider integration prompt has Vietnamese variant and preserves type definitions", () => {
    const path = "apps/web/src/components/settings/panels/mediaModel/providerPromptVi.ts";
    const body = constantBody(path, "providerPromptVi");
    expect(body.length).toBeGreaterThan(3000);
    expect(han.test(body)).toBe(false);
    expect(body).toContain("ComfyUI");
    expect(source("apps/web/src/components/settings/panels/mediaModel/providerAgentDialog.vue"))
      .toContain('locale.value === "vi"');
  });
  test("delegated agent selects Vietnamese instructions but leaves JSON task payload unchanged", () => {
    const sourceText = source("apps/server/src/agent/runtime/subAgent.ts");
    expect(sourceText).toContain('getLocale() === "vi"');
    expect(sourceText).toContain("Bạn đang thực hiện một nhiệm vụ con");
    expect(sourceText).toContain("JSON.stringify({ name, task })");
  });
  test("inpaint keeps user input and uses a Vietnamese instruction branch", () => {
    const sourceText = source("packages/nodes/imageNode/src/imageInpaint.ts");
    expect(sourceText).toContain("inpaintInstructionVi");
    expect(sourceText).toContain('document.documentElement.lang === "vi"');
    expect(sourceText).toContain("return prompt");
    expect(sourceText).toContain("Yêu cầu vẽ lại:");
  });
  test("generation nodes and audio node select Vietnamese reference labels in AI prompts", () => {
    for (const path of [
      "packages/nodes/imageGenerationNode/src/index.vue",
      "packages/nodes/videoGenerationNode/src/index.vue",
      "packages/nodes/audioGenerationNode/src/index.vue",
    ]) {
      const code = source(path);
      expect(code).toContain('nodeText("参考", "Tham chiếu")');
      expect(code).toContain("void vietnamese.value");
    }
  });
});
