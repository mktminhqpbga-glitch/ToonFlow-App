import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vi from "../../../i18n/src/locales/vi.json";
import { collectMessages, transformSource } from "../../../i18n/src/transform";

const sourceFile = resolve(import.meta.dirname, "../src/index.vue");
const text = readFileSync(sourceFile, "utf8");
const template = text.split("</template>")[0]!;

describe("Audio Generation Vietnamese UI/validation regression", () => {
  test("the static Vue toolbar and accessibility labels do not expose raw Chinese", () => {
    expect([...template.matchAll(/(?<!:)\b(?:title|aria-label|placeholder|noDataText|emptyText)="[^"]*[\u3400-\u9fff][^"]*"/g)]).toHaveLength(0);
    expect([...template.matchAll(/>([^<{}]*[\u3400-\u9fff][^<{}]*)</g)]).toHaveLength(0);
    expect(text).toContain("const localized = (zh: string, vi: string)");
  });
  test("runtime errors and model validation use Vietnamese explicitly", () => {
    expect(text).toContain('nodeText("音频生成失败", "Tạo âm thanh thất bại")');
    expect(text).toContain('nodeText("音频读取失败", "Không đọc được âm thanh")');
    expect(text).toContain('nodeText("providerId 与 modelId 必须同时提供", "Phải cung cấp đồng thời providerId và modelId")');
    expect(text).toContain('nodeText("请选择音频文件", "Hãy chọn tệp âm thanh")');
  });
  test("the i18n compiler still covers dynamic Chinese display expressions, not model IDs", () => {
    const messages = collectMessages(text, sourceFile);
    expect(messages.filter(value => !Object.hasOwn(vi, value))).toEqual([]);
    const transformed = transformSource(text, sourceFile);
    expect(transformed?.code ?? text).toContain("providerId");
    expect(transformed?.code ?? text).toContain("modelId");
    expect(transformed?.code ?? text).toContain("nodeText(");
  });
});
