import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { webcrypto, randomUUID, createHash } from "node:crypto";

// No Chrome process or website is launched. This drives the REAL Muse content
// script with a tiny fake composer, and deliberately never returns a Muse reply.
// It verifies the potentially billable Send click is one, after all references.
const source = readFileSync(new URL("../../../packages/chromeExtension/museBridge.js", import.meta.url), "utf8");
const requestId = "123e4567-e89b-42d3-a456-426614174000";
const url = "https://muse.ai/thread/test-offline";
const prompt = `[REQUEST_BEGIN:${requestId}]\nHãy dùng cả hai ảnh theo đúng thứ tự.\n[REQUEST_END:${requestId}]`;
const refs = [
  { name: "reference-1.png", data: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1]) },
  { name: "reference-2.png", data: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 2]) },
];

function fakeMuseComposer(options: { hideSecondPreview?: boolean; corruptPromptOnUpload?: boolean } = {}) {
  const actions: string[] = [];
  let listener: ((message: any, sender: any, reply: (result: any) => void) => boolean) | undefined;
  const previews: any[] = [];
  let clock = 1_000;
  let currentValue = "";

  class Textarea {
    get value() { return currentValue; }
    set value(next: string) { currentValue = next; }
    disabled = false;
    readOnly = false;
    getClientRects() { return [1]; }
    getAttribute(name: string) { return name === "placeholder" ? "Message" : null; }
    focus() {}
    closest(name: string) { return name === "form" ? root : null; }
    dispatchEvent(event: { type: string }) { if (event.type === "input") actions.push("prompt"); }
  }
  class Input {
    private _files: File[] = [];
    disabled = false;
    accept = "image/png";
    get files() { return this._files; }
    set files(value: File[]) { this._files = value; }
    dispatchEvent(event: { type: string }) {
      if (event.type !== "change") return;
      const file = this.files[0];
      if (!file) return;
      actions.push(`upload:${file.name}`);
      if (options.corruptPromptOnUpload) currentValue = "PROMPT CỦA TRANG KHÁC";
      if (options.hideSecondPreview && previews.length === 1) return;
      previews.push({
        matches: () => false,
        contains: () => false,
        getClientRects: () => [1],
        querySelectorAll: (selector: string) => selector === "img"
          ? [{ complete: true, naturalWidth: 512 }] : [],
      });
    }
  }
  const textarea = new Textarea();
  const fileInput = new Input();
  const sendButton = {
    isConnected: true,
    getClientRects: () => [1],
    getAttribute: (name: string) => name === "aria-label" ? "Send"
      : name === "data-testid" ? "hatch-composer-send-button" : null,
    matches: (selector: string) => selector === '[data-testid="hatch-composer-send-button"]',
    querySelectorAll: () => [],
    closest: (selector: string) => selector === "form" ? root : null,
    click: () => { actions.push("SEND_CLICK"); },
  };
  const root = {
    isConnected: true,
    querySelector: () => null,
    querySelectorAll: (selector: string) => {
      if (selector === 'input[type="file"]') return [fileInput];
      if (selector.startsWith('[data-testid^="hatch-chat-attachment-presentation-"]')) return previews;
      if (selector === 'button,[role="button"],input[type="submit"]') return [sendButton];
      return [];
    },
  };
  const document = {
    body: { innerText: "" },
    querySelector: () => null,
    querySelectorAll: (selector: string) => selector === "textarea" ? [textarea]
      : selector === 'input[type="file"]' ? [fileInput] : [],
    getElementById: () => null,
  };
  class DataTransfer {
    files: File[] = [];
    items = { add: (file: File) => { this.files.push(file); } };
  }
  class FakeDate extends Date { static now() { return clock += 300; } }
  const chrome = {
    runtime: {
      id: "fake-extension",
      onMessage: { addListener(callback: typeof listener) { listener = callback; } },
      sendMessage: async (message: any) => {
        if (message.type === "museStage") actions.push(`stage:${message.stage}`);
        return { ok: true };
      },
    },
  };
  const context = {
    chrome, document, HTMLTextAreaElement: Textarea, HTMLInputElement: Input, DataTransfer,
    File, Blob, Uint8Array, AbortController, crypto: webcrypto, atob, btoa,
    Date: FakeDate, location: { href: url }, Node: { DOCUMENT_POSITION_FOLLOWING: 4 },
    Event: class { constructor(public type: string) {} },
    getComputedStyle: () => ({ visibility: "visible", display: "block" }),
    setTimeout: (callback: () => void, delay: number) => {
      if (delay < 100_000) queueMicrotask(callback);
      return 1;
    },
    clearTimeout: () => {},
    console,
  };
  runInNewContext(source, context, { filename: "museBridge.js", timeout: 2000 });
  const send = async (message: any) => new Promise<any>(resolve => {
    if (!listener) throw new Error("Missing Muse content listener");
    listener(message, { id: chrome.runtime.id, frameId: 0 }, resolve);
  });
  return { send, actions };
}

async function driveReferences(
  testUi: ReturnType<typeof fakeMuseComposer>,
  files: typeof refs = refs,
) {
  const probe = await testUi.send({ type: "probe" });
  const base = { requestId, documentToken: probe.documentToken, expectedUrl: url };
  expect(probe.ready).toBe(true);
  expect(probe.outputKinds).toEqual(["text", "image", "video", "audio"]);
  expect((await testUi.send({ ...base, type: "prepareReferences", count: files.length })).ok).toBe(true);
  for (const [index, file] of files.entries()) {
    const sha256 = createHash("sha256").update(file.data).digest("hex");
    expect((await testUi.send({ ...base, type: "referenceStart", index, size: file.data.length, mimeType: "image/png", name: file.name, sha256 })).ok).toBe(true);
    expect((await testUi.send({ ...base, type: "referenceChunk", sequence: 0, data: Buffer.from(file.data).toString("base64") })).ok).toBe(true);
    expect((await testUi.send({ ...base, type: "referenceEnd" })).ok).toBe(true);
  }
  const reply = await testUi.send({
    ...base, type: "generate", kind: "image", prompt,
    response: { kind: "image", mimeTypes: ["image/png"], maxBytes: 20_000_000 },
  });
  // This fake Muse never responds to the click; the command must not be
  // automatically re-sent just because a receipt is missing.
  expect(reply.ok).toBe(false);
  return reply;
}

describe("Muse content script: prompt và ảnh tham chiếu theo thứ tự", () => {
  test("điền prompt trước, tải hai ảnh lần lượt, xác nhận rồi click Send đúng một lần", async () => {
    const testUi = fakeMuseComposer();
    const reply = await driveReferences(testUi);
    expect(testUi.actions).toEqual([
      "prompt", "upload:reference-1.png", "upload:reference-2.png",
      "stage:referencesAttached", "SEND_CLICK",
    ]);
    expect(reply.code).toBe("MUSE_SUBMISSION_UNKNOWN");
    expect(testUi.actions.filter(action => action === "SEND_CLICK")).toHaveLength(1);
  });
  test("thiếu preview của ảnh thứ hai thì KHÔNG nhấn Send", async () => {
    const testUi = fakeMuseComposer({ hideSecondPreview: true });
    const reply = await driveReferences(testUi);
    expect(reply.code).toBe("MUSE_UPLOAD_TIMEOUT");
    expect(testUi.actions).not.toContain("SEND_CLICK");
  });
  test("website đổi prompt sau khi nhận ảnh thì KHÔNG nhấn Send", async () => {
    const testUi = fakeMuseComposer({ corruptPromptOnUpload: true });
    const reply = await driveReferences(testUi);
    expect(reply.code).toBe("MUSE_COMPOSER_CHANGED");
    expect(testUi.actions).not.toContain("SEND_CLICK");
  });
});
