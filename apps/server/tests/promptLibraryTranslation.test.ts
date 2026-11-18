import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { translateCached, translatePromptText } from "../src/utils/promptLibrary/translate";

const previousFetch = globalThis.fetch;
const previousDirectory = process.env.TOONFLOW_DATA_DIR;
afterEach(() => {
  globalThis.fetch = previousFetch;
  if (previousDirectory === undefined) delete process.env.TOONFLOW_DATA_DIR;
  else process.env.TOONFLOW_DATA_DIR = previousDirectory;
});

describe("Chuyển thể prompt tiếng Việt giữ nguyên cấu trúc và bản gốc", () => {
  test("dịch giá trị JSON, không đổi tên trường, số và tham chiếu", async () => {
    const requests: string[] = [];
    globalThis.fetch = (async (_url, init) => {
      const q = new URLSearchParams(init?.body as string).get("q")!;
      requests.push(q);
      return new Response(JSON.stringify([[[`vi: ${q}`,q]]]), {status:200, headers:{"Content-Type":"application/json"}});
    }) as typeof fetch;
    const raw = JSON.stringify({ style:"Watercolor image", reference:"{{ref 1}}", url:"https://example.com/image.png", amount:4, subtitle:"Soft lighting" });
    const out = JSON.parse(await translatePromptText(raw));
    expect(Object.keys(out)).toEqual(["style","reference","url","amount","subtitle"]);
    expect(out.style).toBe("vi: Watercolor image");
    expect(out.subtitle).toBe("vi: Soft lighting");
    expect(out.reference).toBe("{{ref 1}}");
    expect(out.url).toBe("https://example.com/image.png");
    expect(out.amount).toBe(4);
    expect(requests).toEqual(["Watercolor image", "Soft lighting"]);
  });
  test("dịch một lần rồi đọc bộ nhớ đệm mà không gọi dịch vụ lần nữa", async () => {
    const directory = mkdtempSync(resolve(tmpdir(), "macflow-vi-"));
    process.env.TOONFLOW_DATA_DIR = directory;
    let calls = 0;
    try {
      globalThis.fetch = (async (_url, init) => {
        calls++;
        const q = new URLSearchParams(init?.body as string).get("q")!;
        return new Response(JSON.stringify([[[`dịch: ${q}`,q]]]), {status:200});
      }) as typeof fetch;
      const original = "An original public image prompt."
      expect(await translateCached(original)).toBe("dịch: An original public image prompt.");
      expect(await translateCached(original)).toBe("dịch: An original public image prompt.");
      expect(calls).toBe(1);
    } finally { rmSync(directory,{recursive:true,force:true}); }
  });
});
