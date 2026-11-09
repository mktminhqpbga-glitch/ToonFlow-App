import { describe, expect, test } from "bun:test";
import { resolveServerLocalePreference } from "./i18n";

describe("Vietnamese backend language defaults (without rewriting settings)", () => {
  test("old implicit Chinese and English settings cannot override Vietnamese default", () => {
    expect(resolveServerLocalePreference(undefined, "zh-CN")).toBe("vi");
    expect(resolveServerLocalePreference({ language: "zh-CN" }, "zh-CN")).toBe("vi");
    expect(resolveServerLocalePreference({ language: "en", languageChosen: false }, "en-US")).toBe("vi");
    expect(resolveServerLocalePreference({ language: "system" }, "zh-CN")).toBe("vi");
  });
  test("explicit user language choices are preserved", () => {
    expect(resolveServerLocalePreference({ language: "en", languageChosen: true }, "vi-VN")).toBe("en");
    expect(resolveServerLocalePreference({ language: "zh-CN", languageChosen: true }, "vi-VN")).toBe("zh-CN");
    expect(resolveServerLocalePreference({ language: "vi-VN", languageChosen: true }, "zh-CN")).toBe("vi");
    expect(resolveServerLocalePreference({ language: "system", languageChosen: true }, "en-US")).toBe("en");
  });
  test("invalid saved locale defaults to Vietnamese without mutating stored config", () => {
    const existing = { language: "invalid-locale", languageChosen: true };
    expect(resolveServerLocalePreference(existing, "zh-CN")).toBe("vi");
    expect(existing.language).toBe("invalid-locale");
  });
});
