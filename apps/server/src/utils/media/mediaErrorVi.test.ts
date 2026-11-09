import { describe, expect, test } from "bun:test";
import { runWithLocale } from "@/lib/i18n";
import { mediaErrorText, viMediaErrorTranslations } from "./mediaErrorVi";

describe("HD-08 localized backend media errors (no provider requests)", () => {
  test("Vietnamese request context localizes storage, provider and validation failures", () => {
    runWithLocale("vi", () => {
      expect(mediaErrorText("请输入生成提示词")).toBe("Hãy nhập prompt để tạo media");
      expect(mediaErrorText("任务结果文件已被修改，不能覆盖")).toContain("đã bị thay đổi");
      expect(mediaErrorText("供应商未返回生成结果")).toContain("chưa trả về");
      expect(mediaErrorText("该任务没有可恢复的供应商凭据，不能重新提交生成")).toContain("không được gửi tạo lại");
    });
  });
  test("all explicitly mapped Vietnamese errors contain no Han characters", () => {
    expect(Object.keys(viMediaErrorTranslations).length).toBe(22);
    for (const [chinese, vietnamese] of Object.entries(viMediaErrorTranslations)) {
      expect(chinese).toMatch(/[\u3400-\u9fff]/);
      expect(vietnamese).not.toMatch(/[\u3400-\u9fff]/);
      expect(vietnamese.length).toBeGreaterThan(10);
    }
  });
  test("other languages do not receive forced Vietnamese", () => {
    expect(runWithLocale("zh-CN", () => mediaErrorText("请输入生成提示词"))).toBe("请输入生成提示词");
    expect(runWithLocale("vi", () => mediaErrorText("muse_video"))).toBe("muse_video");
  });
});
