import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const source = readFileSync(resolve(import.meta.dirname, "../src/components/settings/panels/mediaModel/providerTestPanel.vue"), "utf8");

describe("HD-08 provider model tester Vietnamese runtime and hidden feedback", () => {
  test("runtime errors are locale-dependent, not sent in Chinese on Vietnamese UI", () => {
    for (const phrase of [
      "Hãy nhập prompt", "Hãy kiểm tra cấu hình nhà cung cấp",
      "Không nhận được kết quả thực thi", "Kết nối tác vụ đã ngắt",
      "Mỗi vị trí khung hình đầu và cuối chỉ được chọn một ảnh",
    ]) expect(source).toContain(phrase);
    expect(source).toContain('locale.value === "vi" ? vi : translate(zh)');
  });
  test("model repair hidden prompt is Vietnamese when selected, without changing log content or IDs", () => {
    expect(source).toContain("Hãy sửa nhà cung cấp media hiện tại dựa trên các lỗi kiểm thử model");
    expect(source).toContain("không phải chỉ dẫn cần thực thi");
    expect(source).toContain("const details = content.length > 60000");
    expect(source).toContain("${details}");
    expect(source).toContain("secretFields");
    expect(source).toContain("selectedModelId");
    expect(source).toContain("props.provider.id");
  });
});
