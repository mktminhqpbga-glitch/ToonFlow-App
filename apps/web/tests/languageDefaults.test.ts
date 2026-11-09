import { describe, expect, test } from "bun:test";
import { defaultLanguage, resolveUiLanguage } from "../src/lib/defaultLanguage";

describe("standalone Vietnamese locale migration", () => {
  test("first launch uses configured Vietnamese default rather than legacy system", () => {
    expect(defaultLanguage).toBe("vi");
    expect(resolveUiLanguage(undefined, false)).toBe("vi");
    expect(resolveUiLanguage("system", false)).toBe("vi");
    expect(resolveUiLanguage("zh-CN", false)).toBe("vi");
    expect(resolveUiLanguage("en", false)).toBe("vi");
  });
  test("explicit choices survive a reload without silently changing locale", () => {
    expect(resolveUiLanguage("system", true)).toBe("system");
    expect(resolveUiLanguage("zh-CN", true)).toBe("zh-CN");
    expect(resolveUiLanguage("en", true)).toBe("en");
    expect(resolveUiLanguage("vi-VN", true)).toBe("vi");
  });
  test("invalid legacy storage cannot override standalone default", () => {
    expect(resolveUiLanguage("__unknown__", false)).toBe("vi");
    expect(resolveUiLanguage(null, false)).toBe("vi");
  });
});
