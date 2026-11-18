import { describe, expect, test } from "bun:test";
import { readFileSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { defaults, normalizePrompt, promptKey, validateSourceUrl, cachedItems, refreshSource, type PromptSource } from "../src/utils/promptLibrary";

const sampleDir = resolve(import.meta.dirname, "../../../research/prompt-library-samples");
describe("Thư viện prompt JSON 7 nguồn thật", () => {
  test("registry có đúng 7 nguồn HTTPS với định danh riêng", () => {
    expect(defaults.length).toBe(7);
    expect(new Set(defaults.map(s=>s.id)).size).toBe(7);
    expect(defaults.every(s=>s.url.startsWith("https://raw.githubusercontent.com/") && s.enabled)).toBe(true);
  });
  test("chuẩn hóa dữ liệu thực tế từ từng nguồn, không mất tác giả/metadata", () => {
    const keys=new Set<string>();
    for(const source of defaults){
      const raw=JSON.parse(readFileSync(resolve(sampleDir,`${source.id}.json`),"utf8")) as unknown[];
      expect(Array.isArray(raw)).toBe(true);
      expect(raw.length).toBeGreaterThan(0);
      const items=raw.map((v,index)=>normalizePrompt(source.id,v,index)).filter(Boolean);
      expect(items.length).toBeGreaterThan(0);
      for(const item of items){
        expect(item!.prompt.trim().length).toBeGreaterThan(0);
        expect(item!.sourceId).toBe(source.id);
        expect(Array.isArray(item!.referenceImageUrls)).toBe(true);
        expect(Array.isArray(item!.tags)).toBe(true);
        expect(keys.has(promptKey(item!))).toBe(false);
        keys.add(promptKey(item!));
      }
      const first=items[0]!;
      expect(first.author).toBe((raw[0] as Record<string,unknown>).author ?? "");
      expect(first.imageModel).toBe((raw[0] as Record<string,unknown>).imageModel ?? "");
      expect(first.id).toBe((raw[0] as Record<string,unknown>).id);
    }
  });
  test("không nhập nguồn nội bộ hoặc URL không an toàn", async () => {
    await expect(validateSourceUrl("http://example.com/data.json")).rejects.toThrow();
    await expect(validateSourceUrl("https://127.0.0.1/data.json")).rejects.toThrow();
    await expect(validateSourceUrl("https://localhost/data.json")).rejects.toThrow();
    await expect(validateSourceUrl("https://user:pass@example.com/data.json")).rejects.toThrow();
  });
  test("bản lưu cá nhân có định danh độc lập với nguồn", () => {
    const upstream=normalizePrompt("banana-prompt-quicker",{id:"same",prompt:"Prompt mẫu",author:"Tác giả"},0)!;
    const personal=normalizePrompt("personal",{id:"same",prompt:upstream.prompt,author:upstream.author},0)!;
    expect(promptKey(personal)).not.toBe(promptKey(upstream));
  });
  test("nguồn lỗi vẫn trả lại đúng dữ liệu JSON đã cache; không xóa cache", async () => {
    const previous = process.env.TOONFLOW_DATA_DIR;
    const directory = mkdtempSync(resolve(tmpdir(), "macflow-prompts-"));
    process.env.TOONFLOW_DATA_DIR = directory;
    const source: PromptSource = { id: crypto.randomUUID(), name: "Nguồn đang lỗi", homepage: "https://example.com/",
      url: "https://127.0.0.1/missing.json", enabled: true, builtIn: false };
    try {
      const item = normalizePrompt(source.id, { id: "one", title: "Mẫu đã cache", prompt: "Mẫu từ nguồn trước lỗi", author: "Người tạo" }, 0)!;
      mkdirSync(resolve(directory, "promptLibrary"), {recursive:true});
      writeFileSync(resolve(directory,"promptLibrary",`cache-${source.id}.json`), JSON.stringify([item]));
      await refreshSource(source,true);
      expect(source.error).toBeTruthy();
      const restored = await cachedItems(source);
      expect(restored).toHaveLength(1);
      expect(restored[0]?.author).toBe("Người tạo");
    } finally {
      process.env.TOONFLOW_DATA_DIR = previous;
      rmSync(directory,{recursive:true,force:true});
    }
  });
});
