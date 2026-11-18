import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { recognizeAiTabs } from "../extension/tab-recognition.js";

const profileToken = "11111111-1111-4111-8111-111111111111";
const providers = new Map([
  ["https://muse.ai/", "muse"],
  ["https://chatgpt.com/", "chatgpt"],
  ["https://gemini.google.com/", "gemini"],
]);
const providerForUrl = url => [...providers].find(([prefix]) => url.startsWith(prefix))?.[1] || null;

function createMockTabs(tabs, options = {}) {
  const discovered = new Map(options.present || []);
  const injected = [];
  const reloads = [];
  const requests = [];
  const chrome = {
    tabs: {
      async query(query) { requests.push(query); return tabs; },
      async get(id) { return options.changed?.get(id) ?? tabs.find(t => t.id === id); },
      async sendMessage(id, message) {
        assert.equal(message.type, "bridge:probe");
        const tab = tabs.find(t => t.id === id);
        if (!discovered.has(id)) throw new Error("Receiving end does not exist");
        return { provider: discovered.get(id), url: tab.url, documentToken: profileToken, ready: true, busy: false };
      },
      async reload(id) { reloads.push(id); },
    },
    scripting: options.noScripting ? undefined : {
      async executeScript({ target, files, world }) {
        injected.push({ id: target.tabId, files, world });
        if (options.injectionFails?.has(target.tabId)) throw new Error("Cannot access contents of page");
        const tab = tabs.find(t => t.id === target.tabId);
        discovered.set(tab.id, providerForUrl(tab.url));
      },
    },
  };
  return { chrome, injected, reloads, requests };
}

test("auto-recognizes already-open Muse, ChatGPT and Gemini without refreshing pages or touching other tabs", async () => {
  const tabs = [
    { id: 1, url: "https://muse.ai/chat/1", status: "complete" },
    { id: 2, url: "https://chatgpt.com/c/1", status: "complete" },
    { id: 3, url: "https://gemini.google.com/app", status: "complete" },
    { id: 4, url: "https://example.com/", status: "complete" },
  ];
  const mock = createMockTabs(tabs, { present: [[2, "chatgpt"]] });
  const result = await recognizeAiTabs({ chrome: mock.chrome,
    patterns: ["https://muse.ai/*", "https://chatgpt.com/*", "https://gemini.google.com/*"], providerForUrl });
  assert.deepEqual(result, { scanned: 3, recognized: 3, injected: 2, skipped: 0, failed: 0 });
  assert.deepEqual(mock.injected, [
    { id: 1, files: ["media-capture.js", "muse-content.js"], world: "ISOLATED" },
    { id: 3, files: ["media-capture.js", "content.js"], world: "ISOLATED" },
  ]);
  assert.deepEqual(mock.reloads, [], "Do not reload a tab with an unsent draft or an active conversation");
  assert.equal(mock.requests.length, 1);
});

test("does not inject into assigned, loading, discarded or navigated-away tabs", async () => {
  const tabs = [
    { id: 1, url: "https://muse.ai/chat/1", status: "complete" },
    { id: 2, url: "https://chatgpt.com/c/1", status: "loading" },
    { id: 3, url: "https://gemini.google.com/app", status: "complete", discarded: true },
    { id: 4, url: "https://muse.ai/chat/4", status: "complete" },
  ];
  const mock = createMockTabs(tabs, {
    changed: new Map([[4, { ...tabs[3], url: "https://example.com/" }]]),
  });
  const result = await recognizeAiTabs({ chrome: mock.chrome, patterns: [...providers.keys()], providerForUrl,
    isAssigned: id => id === 1 });
  assert.deepEqual(mock.injected, []);
  assert.deepEqual(mock.reloads, []);
  assert.equal(result.scanned, 2);
  assert.equal(result.skipped, 2);
});

test("fails closed when extension injection is unavailable; never reloads page or sends prompts", async () => {
  const tabs = [{ id: 10, url: "https://muse.ai/chat/10", status: "complete" }];
  const first = createMockTabs(tabs, { noScripting: true });
  const result1 = await recognizeAiTabs({ chrome: first.chrome, patterns: [...providers.keys()], providerForUrl });
  assert.equal(result1.failed, 1);
  assert.deepEqual(first.reloads, []);
  const second = createMockTabs(tabs, { injectionFails: new Set([10]) });
  const result2 = await recognizeAiTabs({ chrome: second.chrome, patterns: [...providers.keys()], providerForUrl });
  assert.equal(result2.failed, 1);
  assert.deepEqual(second.reloads, []);
});

test("does not inject after the bridge connection changes during inventory", async () => {
  const tabs = [{ id: 12, url: "https://muse.ai/chat/12", status: "complete" }];
  const mock = createMockTabs(tabs);
  let calls = 0;
  const result = await recognizeAiTabs({ chrome: mock.chrome, patterns: [...providers.keys()], providerForUrl,
    stillCurrent: () => ++calls < 2 });
  assert.equal(result.injected, 0);
  assert.deepEqual(mock.injected, []);
});

test("successful pairing automatically recognizes tabs without a popup scan click", async () => {
  const source = await fs.readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../extension/background.js"), "utf8");
  const listeners = new Map();
  const sent = [];
  const installed = new Set();
  const tab = { id: 52, url: "https://muse.ai/chat/test", status: "complete" };
  const probe = () => ({ documentToken: profileToken, provider: "muse", url: tab.url, ready: true, busy: false });
  class FakeWebSocket {
    static OPEN = 1;
    static CONNECTING = 0;
    constructor(url) {
      assert.match(url, /^ws:\/\/127\.0\.0\.1:4320\/bridge\?token=/);
      this.readyState = 0;
      setImmediate(() => { this.readyState = 1; this.onopen?.(); });
    }
    send(value) { sent.push(JSON.parse(value)); }
    close() { this.readyState = 3; this.onclose?.(); }
  }
  const event = name => ({ addListener(fn) { listeners.set(name, fn); } });
  const chrome = {
    runtime: { id: "test-extension", onInstalled: event("installed"), onStartup: event("startup"),
      onMessage: event("runtime-message"), getManifest: () => ({ version: "0.5.2" }) },
    storage: { local: {
      async get() { return { serverUrl: "http://127.0.0.1:4320", token: "test-token", paused: false,
        defaultProvider: "auto", bridgeProfileInstanceId: profileToken }; },
      async set() {},
    }, onChanged: event("storage-changed") },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
    tabs: {
      onCreated: event("tab-created"), onRemoved: event("tab-removed"), onUpdated: event("tab-updated"),
      onMoved: event("tab-moved"), onAttached: event("tab-attached"), onDetached: event("tab-detached"),
      async query() { return [tab]; }, async get() { return tab; },
      async sendMessage(id, message) {
        assert.equal(id, 52);
        if (message.type === "bridge:probe") {
          if (!installed.has(id)) throw new Error("Receiver not found");
          return probe();
        }
        return { ok: true };
      },
    },
    scripting: { async executeScript({ target, files }) {
      assert.deepEqual(files, ["media-capture.js", "muse-content.js"]);
      installed.add(target.tabId);
    } },
  };
  const code = source.replace('import { recognizeAiTabs } from "./tab-recognition.js";',
    "const recognizeAiTabs = globalThis.__recognizeAiTabs;");
  const context = vm.createContext({ chrome, crypto, URL, WebSocket: FakeWebSocket,
    __recognizeAiTabs: recognizeAiTabs, setTimeout, clearTimeout, setInterval() { return 1; }, clearInterval() {} });
  vm.runInContext(code, context, { filename: "background.js" });
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.deepEqual([...installed], [52]);
  assert.ok(sent.some(item => item.type === "bridge:hello" && item.version === "0.5.2"));
  const getState = listeners.get("runtime-message");
  const state = await new Promise(resolve => getState({ type: "bridge:get-state" }, {}, resolve));
  assert.equal(state.recognitionStatus.state, "complete");
  assert.equal(state.recognitionStatus.recognized, 1);
  assert.equal(state.recognitionStatus.injected, 1);
});
