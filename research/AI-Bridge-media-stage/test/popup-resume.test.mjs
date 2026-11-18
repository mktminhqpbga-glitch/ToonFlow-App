import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

test("Save & connect resumes a paused bridge instead of staying at Connecting", async () => {
  const filename = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../extension/popup.js");
  const script = await fs.readFile(filename, "utf8");
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      id, value: "", hidden: true, className: "", textContent: "",
      listeners: new Map(), children: [],
      addEventListener(event, fn) { this.listeners.set(event, fn); },
      append(child) { this.children.push(child); },
      prepend(child) { this.children.unshift(child); },
    });
    return nodes.get(id);
  };
  const state = { serverUrl: "http://127.0.0.1:4320/v1", token: "test-extension-token", defaultProvider: "auto", paused: true };
  const stored = [];
  const actions = [];
  const chrome = {
    storage: { local: { async set(patch) { stored.push(patch); Object.assign(state, patch); } } },
    runtime: { async sendMessage(payload) {
      actions.push(payload.type);
      if (payload.type === "bridge:get-state") return {
        settings: { ...state }, providers: {}, socketState: state.paused ? "paused" : "connecting", lastError: "",
      };
      return { ok: true };
    } },
  };
  const timers = [];
  const context = vm.createContext({
    chrome,
    URL,
    document: { querySelector: node, createElement: () => ({ textContent: "", value: "" }) },
    setInterval(fn) { timers.push(fn); return 1; },
    setTimeout(fn) { timers.push(fn); return 1; },
  });
  vm.runInContext(script, context, { filename });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(node("#pause").textContent, "Continue");
  await node("#save").listeners.get("click")();
  assert.equal(stored.at(-1).paused, false);
  assert.ok(actions.includes("bridge:reconnect"));
  assert.equal(node("#pause").textContent, "Continue"); // Save just began reconnecting; poll will refresh.
  await timers.at(-1)();
  assert.equal(node("#pause").textContent, "Pause");
  assert.equal(node("#status").textContent, "Connecting…");
  assert.ok(timers.length > 0, "Popup must poll connection status");
});
