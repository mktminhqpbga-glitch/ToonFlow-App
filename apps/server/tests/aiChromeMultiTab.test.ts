import { describe, expect, test } from "bun:test";
import {
  chromeModelIds, chromeProtocolVersion, clientMessage, isChromeProviderUrl, providerForChromeModel,
} from "../src/utils/aiChrome/protocol";
import { buildChromeRequest } from "../src/utils/aiChrome/request";
import { runTask } from "../src/utils/aiChrome/jobs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { probedOutputKinds, receiveRequest } from "../../../packages/chromeExtension/requestReceiver.js";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const makeTab = (tabId: number, provider: "chatgpt" | "gemini", url: string) => ({
  tabId, provider, url, documentToken: requestId, title: "Tab kiểm thử", outputKinds: ["text"] as const,
  ready: true, blocked: false, busy: false,
});

describe("AI Chrome nhiều dịch vụ / nhiều tab", () => {
  test("popup chỉ ghép nối bằng mã, không còn checkbox hoặc nút ghim tab", () => {
    const popup = readFileSync(new URL("../../../packages/chromeExtension/popup.html", import.meta.url), "utf8");
    const popupScript = readFileSync(new URL("../../../packages/chromeExtension/popup.js", import.meta.url), "utf8");
    expect(popup).toContain('id="code"');
    expect(popup).toContain('id="connect"');
    expect(popup).not.toMatch(/type="checkbox"|id="museTab"|id="selectMuse"|museOutputs/);
    expect(popupScript).not.toMatch(/selectMuse|museSelections|museTabId|museKind/);
  });
  test("Muse tự công bố các luồng adapter qua probe, không có ô chọn đầu ra hoặc tab ghim", () => {
    const liveProbe = { capable: true, ready: true, outputKinds: ["text", "image", "video", "audio"] };
    expect(probedOutputKinds("muse", liveProbe)).toEqual(["text", "image", "video", "audio"]);
    expect(probedOutputKinds("muse", { ...liveProbe, outputKinds: ["text", "image", "image"] })).toEqual(["text", "image"]);
    expect(probedOutputKinds("muse", { capable: false, outputKinds: ["text", "image"] })).toEqual(["text"]);
    expect(probedOutputKinds("muse", { capable: true })).toEqual(["text"]); // pre-0.8.2
    expect(probedOutputKinds("muse", { ...liveProbe, outputKinds: ["image", "unknown"] })).toEqual(["text"]);
    expect(probedOutputKinds("chatgpt", liveProbe)).toEqual(["text"]);
    expect(probedOutputKinds("gemini", liveProbe)).toEqual(["text"]);
  });
  test("không tự chọn tab ngay cả khi người dùng chưa chỉ định tab", async () => {
    await expect(runTask({
      id: requestId, modelId: "museChrome", kind: "image",
      prompt: "Chỉ là kiểm thử đóng gói", files: [], save: async () => {},
    })).rejects.toThrow(/không tự chọn tab/);
  });
  test("giao thức mới và ánh xạ dịch vụ không đổi định danh Muse cũ", () => {
    expect(chromeProtocolVersion).toBe(7);
    expect(chromeModelIds.muse).toBe("museChrome");
    expect(providerForChromeModel("museImage")).toBe("muse");
    expect(providerForChromeModel("chatgptChrome")).toBe("chatgpt");
    expect(providerForChromeModel("geminiChrome")).toBe("gemini");
    expect(providerForChromeModel("unknownChrome")).toBeUndefined();
  });

  test("nhận danh sách tab riêng theo ChatGPT và Gemini", () => {
    const targets = [
      makeTab(10, "chatgpt", "https://chatgpt.com/c/example"),
      makeTab(20, "gemini", "https://gemini.google.com/app/example"),
    ].map(item => ({ ...item, outputKinds: [...item.outputKinds] }));
    expect(clientMessage.safeParse({ type: "tabStatus", targets }).success).toBe(true);
    expect(clientMessage.safeParse({ type: "tabStatus", targets: [targets[0], targets[0]] }).success).toBe(false);
  });

  test("không nhận giả mạo URL, giao thức sai hoặc nguồn khác dịch vụ", () => {
    expect(isChromeProviderUrl("chatgpt", "https://chatgpt.com.attacker.invalid/")).toBe(false);
    expect(isChromeProviderUrl("gemini", "http://gemini.google.com/app")).toBe(false);
    expect(isChromeProviderUrl("chatgpt", "https://gemini.google.com/app")).toBe(false);
    const target = makeTab(10, "chatgpt", "https://gemini.google.com/app");
    expect(clientMessage.safeParse({ type: "tabStatus", targets: [target] }).success).toBe(false);
  });

  test("đóng gói ảnh tham chiếu đúng thứ tự và sao chép snapshot trước khi gửi", () => {
    const first = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    const second = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 1]);
    const { payload, files } = buildChromeRequest({
      id: requestId, modelId: "geminiChrome", kind: "image", prompt: "Giữ thứ tự tham chiếu",
      specification: { ratio: "16:9", referenceBindings: [{ marker: "{{ref 1}}", attachment: 1 }] },
      files: [{ label: "Nhân vật", mimeType: "image/png", bytes: first }, { label: "Bối cảnh", mimeType: "image/png", bytes: second }],
    });
    first[8] = 255;
    expect(payload.modelId).toBe("geminiChrome");
    expect(payload.attachments.map(file => [file.index, file.label, file.id])).toEqual([
      [0, "Nhân vật", `${requestId}:1`], [1, "Bối cảnh", `${requestId}:2`],
    ]);
    expect(payload.prompt).toContain("1. Nhân vật");
    expect(payload.prompt).toContain("2. Bối cảnh");
    expect(payload.prompt).toContain("{{ref 1}}");
    expect(files[0]?.bytes[8]).toBe(0);
  });

  test("từ chối dịch vụ lạ và tệp sai định dạng trước khi tạo tác vụ", () => {
    const input = { id: requestId, kind: "image" as const, modelId: "unknownChrome", prompt: "Vẽ", files: [] };
    expect(() => buildChromeRequest(input)).toThrow();
    expect(() => buildChromeRequest({
      ...input, modelId: "chatgptChrome",
      files: [{ label: "Không phải ảnh", mimeType: "image/png", bytes: Uint8Array.from([0, 1, 2]) }],
    })).toThrow();
  });

  test("backend và extension thống nhất model ID, checksum và dịch vụ đích", async () => {
    const { payload } = buildChromeRequest({
      id: requestId, modelId: "chatgptChrome", kind: "text", prompt: "Kiểm tra gói, không gửi AI",
      files: [], specification: { temperature: 0 },
    });
    const hash = createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
    expect((await receiveRequest(payload, requestId, hash, "chatgpt")).modelId).toBe("chatgptChrome");
    await expect(receiveRequest(payload, requestId, hash, "gemini")).rejects.toThrow();
    await expect(receiveRequest(payload, requestId, hash.replace(/^./, hash[0] === "a" ? "b" : "a"), "chatgpt")).rejects.toThrow();
  });
});
