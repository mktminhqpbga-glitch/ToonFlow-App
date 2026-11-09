import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const file = readFileSync(resolve(import.meta.dirname, "../src/index.vue"), "utf8");
const panorama = readFileSync(resolve(import.meta.dirname, "../../imageNode/src/components/imagePanoramaPreview.vue"), "utf8");
describe("HD-08 runtime error and dynamic display translation guards", () => {
  test("frame analysis runtime errors use Vietnamese branches without changing AI schema", () => {
    for (const text of ["Không đọc được video", "Tệp video không được rỗng", "Hãy chọn model có thể hiểu hình ảnh",
      "Đã lưu phân cảnh cục bộ", "Không thể dọn tệp tạm"]) expect(file).toContain(text);
    expect(file).toContain('nodeText("视频读取失败", "Không đọc được video")');
    expect(file).toContain('vietnamese.value ? `Đã phân tích xong');
    expect(file).toContain('method: "adaptive" | "content"');
    expect(file).toContain('dataType: "VIDEO"');
  });
  test("panorama dynamic preview, screen-reader help and capture hints have Vietnamese branches", () => {
    expect(panorama).toContain('const vietnamese = useNodeVietnamese()');
    for (const text of ["So sánh ảnh gốc", "Ảnh toàn cảnh 720°", "Đang tải ảnh toàn cảnh",
      "Chụp ảnh và tạo node", "Mỗi ảnh 1280 × 720", "Không tải được ảnh toàn cảnh"]) {
      expect(panorama).toContain(text);
    }
    expect(panorama).toContain('captureCount = ref<1 | 4 | 12>(1)');
    expect(panorama).toContain('captureLayout = ref<"combined" | "separate">("combined")');
  });
});