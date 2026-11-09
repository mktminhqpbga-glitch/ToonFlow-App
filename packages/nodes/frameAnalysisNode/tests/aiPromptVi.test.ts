import { describe, expect, test } from "bun:test";
import { overviewPromptVi, overviewSystemPromptVi, shotPromptVi, shotSystemPromptVi } from "../src/aiPromptVi";

const containsHan = (value: string) => /[\u3400-\u9fff]/.test(value);
describe("Vietnamese hidden prompts for AI frame analysis", () => {
  test("both system prompts are Vietnamese without translating protocol identifiers", () => {
    expect(containsHan(shotSystemPromptVi)).toBe(false);
    expect(containsHan(overviewSystemPromptVi)).toBe(false);
    expect(shotSystemPromptVi).toContain("JSON");
    expect(overviewSystemPromptVi).toContain("JSON");
  });
  test("shot schema stays unchanged and does not echo untrusted focus as instructions", () => {
    const text = shotPromptVi(2, 4.3, "Có 2 khung hình theo thứ tự.", 2, "chỉ phân tích màu sắc");
    expect(containsHan(text)).toBe(false);
    for (const key of ["shotSize", "cameraAngle", "movement", "description"])
      expect(text).toContain('"' + key + '"');
    expect(text).toContain("cảnh quay thứ 3");
    expect(text).toContain("4.300 giây");
    expect(text).toContain('"chỉ phân tích màu sắc"');
  });
  test("single-frame uncertainty is explicit, no inferred camera movement", () => {
    const text = shotPromptVi(0, 1, "Chỉ một ảnh.", 1);
    expect(text).toContain("Không thể xác nhận");
    expect(containsHan(text)).toBe(false);
  });
  test("overview output has exactly the five original JSON field names", () => {
    const body = overviewPromptVi(12.5, [{ shot: 1, startSeconds: 0, endSeconds: 12.5 }], "");
    expect(containsHan(body)).toBe(false);
    for (const key of ["summary", "narrative", "rhythm", "editing", "focusResponse"])
      expect(body).toContain('"' + key + '"');
    expect(body).toContain("12.500");
    expect(body).toContain('focusResponse bắt buộc là chuỗi rỗng');
  });
});
