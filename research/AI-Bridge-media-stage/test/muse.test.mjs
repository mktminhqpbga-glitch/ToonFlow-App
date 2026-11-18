import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { PROVIDER_DISPLAY_NAMES } from "../prompt-instructions.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const extension = path.resolve(root, "../extension");

function mockMusePage(source, { draft = "", includeUserReceipt = true, includeAnswer = true } = {}) {
  const handlers = [];
  const messages = [];
  const users = [];
  const answers = [];
  const body = { tagName: "BODY" };
  const root = {
    tagName: "FORM", parentElement: body,
    querySelector() { return null; },
    querySelectorAll(selector) { return selector.includes('button,[role="button"]') ? [sendButton] : []; },
  };
  const visible = () => [1];
  const bubble = (text) => ({
    textContent: text, innerText: text, getClientRects: visible,
    closest() { return null; }, contains() { return false; },
    compareDocumentPosition() { return 4; },
    cloneNode() { return { textContent: text, innerText: text, querySelectorAll() { return []; } }; },
  });
  // Existing history must never be mistaken for the new response.
  users.push(bubble("old prompt"));
  answers.push(bubble("historical reply"));

  class TextArea {
    constructor() { this.value = draft; this.parentElement = root; }
    get value() { return this._value ?? ""; }
    set value(value) { this._value = value; }
    focus() {}
    dispatchEvent() {}
    getClientRects() { return [1]; }
    closest(selector) { return selector === "form" ? root : null; }
    getAttribute(name) { return name === "placeholder" ? "Message Muse" : null; }
  }
  const input = new TextArea();
  let clicks = 0;
  const sendButton = {
    isConnected: true, disabled: false,
    getClientRects: visible,
    getAttribute(name) { return name === "data-testid" ? "hatch-composer-send-button" : null; },
    matches(selector) { return selector.includes("hatch-composer-send-button"); },
    querySelectorAll() { return []; },
    closest() { return root; },
    click() {
      clicks += 1;
      if (includeUserReceipt) users.push(bubble(input.value));
      if (includeAnswer) answers.push(bubble("new Muse reply"));
    },
  };
  const document = {
    body,
    querySelectorAll(selector) {
      if (selector === "textarea") return [input];
      if (selector.includes('button[data-testid="hatch-composer-stop-button"]')) return [];
      if (selector.includes('[data-message-author-role="user"]')) return users;
      if (selector.includes('[data-message-author-role="assistant"]')) return answers;
      return [];
    },
  };
  const context = {
    crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
    chrome: {
      runtime: {
        onMessage: { addListener(handler) { handlers.push(handler); } },
        sendMessage(message) { messages.push(message.message); return Promise.resolve({ ok: true }); },
      },
    },
    HTMLTextAreaElement: TextArea,
    Event: class Event {},
    Node: { DOCUMENT_POSITION_FOLLOWING: 4 },
    location: { hostname: "muse.ai", href: "https://muse.ai/thread/test" },
    document,
    getComputedStyle() { return { display: "block", visibility: "visible" }; },
    setTimeout,
    URL,
    Date: class FastDate extends Date { static now() { return Date.now() * 100; } },
  };
  vm.runInNewContext(source, context, { filename: "muse-content.js" });
  function run(prompt = "new prompt") {
    let accepted;
    handlers[0]({ type: "bridge:run", id: "test-muse-request", prompt }, {}, (result) => { accepted = result; });
    return accepted;
  }
  return { run, get clicks() { return clicks; }, messages, users, answers, bubble };
}

test("Muse is registered in popup permissions and server model names", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(extension, "manifest.json"), "utf8"));
  const museScript = manifest.content_scripts.find((item) => item.js.includes("muse-content.js"));
  assert.ok(museScript);
  assert.deepEqual(museScript.matches, ["https://muse.ai/*", "https://www.muse.ai/*"]);
  assert.ok(manifest.host_permissions.includes("https://muse.ai/*"));
  assert.equal(PROVIDER_DISPLAY_NAMES.muse, "Muse");
  const background = await fs.readFile(path.join(extension, "background.js"), "utf8");
  const server = await fs.readFile(path.resolve(root, "../local-server.mjs"), "utf8");
  assert.match(background, /muse:\s*\{ label: "Muse"/);
  assert.match(server, /"kimi", "muse"/);
});

test("Muse refuses to overwrite an existing user draft", async () => {
  const source = await fs.readFile(path.join(extension, "muse-content.js"), "utf8");
  const page = mockMusePage(source, { draft: "my unsent message" });
  assert.equal(page.run().ok, true);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(page.clicks, 0);
  assert.ok(page.messages.some((item) => item.type === "bridge:error" && /draft/i.test(item.message)));
});

test("Muse sends exactly once and returns a provably new reply, not old history", async () => {
  const source = await fs.readFile(path.join(extension, "muse-content.js"), "utf8");
  const page = mockMusePage(source);
  assert.equal(page.run().ok, true);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(page.clicks, 1, JSON.stringify(page.messages));
  const complete = page.messages.find((item) => item.type === "bridge:complete");
  assert.ok(complete, JSON.stringify(page.messages));
  assert.equal(complete.text, "new Muse reply");
  assert.ok(!page.messages.some((item) => item.text === "historical reply"));
});

test("Muse does not claim a response when the matching user turn never appeared", async () => {
  const source = await fs.readFile(path.join(extension, "muse-content.js"), "utf8");
  const page = mockMusePage(source, { includeUserReceipt: false });
  assert.equal(page.run().ok, true);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(page.clicks, 1, JSON.stringify(page.messages));
  assert.ok(!page.messages.some((item) => item.type === "bridge:complete"));
});
