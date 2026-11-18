import assert from "node:assert/strict";
import crypto from "node:crypto";
import { once } from "node:events";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  server.close();
  await once(server, "close");
  return port;
}

async function harness(t) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "bridge-media-e2e-"));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const port = await freePort();
  const env = { ...process.env, BRIDGE_API_KEY: "test-media-api-key", BRIDGE_MEDIA_DIR: path.join(folder, "media") };
  const child = spawn(process.execPath, ["local-server.mjs", `--port=${port}`, "--token=test-extension-key",
    `--settings-file=${path.join(folder, "settings.json")}`, `--prompt-instructions-dir=${path.join(folder, "instructions")}`],
    { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => child.kill());
  await once(child.stdout, "data");
  const ws = new WebSocket(`ws://127.0.0.1:${port}/bridge?token=test-extension-key`);
  t.after(() => ws.close());
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.send(JSON.stringify({ type: "bridge:hello", version: "0.5.0", providers: ["gemini"] }));
  const call = (media_kind) => fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: "Bearer test-media-api-key", "Content-Type": "application/json" },
    body: JSON.stringify({ model: "bridge-gemini", media_kind, messages: [{ role: "user", content: "generate" }] }),
  });
  return { port, folder, ws, call };
}

test("media transfer acknowledges each chunk and serves binary output through authenticated API", async (t) => {
  const { port, ws, call } = await harness(t);
  const bytes = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(24, 1)]);
  const responses = [];
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    responses.push(message);
    if (message.type !== "bridge:run") return;
    const transferId = crypto.randomUUID();
    ws.send(JSON.stringify({ type: "bridge:media:start", id: message.id, transferId, kind: "image",
      mimeType: "image/png", size: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") }));
    ws.send(JSON.stringify({ type: "bridge:media:chunk", id: message.id, transferId, sequence: 0, data: bytes.toString("base64") }));
    ws.send(JSON.stringify({ type: "bridge:media:end", id: message.id, transferId }));
    ws.send(JSON.stringify({ type: "bridge:complete", id: message.id, text: "Here is the image" }));
  });
  const response = await call("image");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.choices[0].message.content, "Here is the image");
  assert.equal(body.media.length, 1);
  assert.equal(body.media[0].kind, "image");
  assert.equal(body.choices[0].message.media.length, 1);
  const wrong = await fetch(body.media[0].url);
  assert.equal(wrong.status, 401);
  const file = await fetch(body.media[0].url, { headers: { Authorization: "Bearer test-media-api-key" } });
  assert.equal(file.status, 200);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
  assert.ok(responses.some((item) => item.type === "bridge:media:ack" && item.stage === "bridge:media:end" && item.ok));
  const nonexistent = await fetch(`http://127.0.0.1:${port}/v1/media/${crypto.randomUUID()}`, { headers: { Authorization: "Bearer test-media-api-key" } });
  assert.equal(nonexistent.status, 404);
});

test("rejects incomplete media without returning false-positive success", async (t) => {
  const { ws, call } = await harness(t);
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type !== "bridge:run") return;
    ws.send(JSON.stringify({ type: "bridge:complete", id: message.id, text: "Done" }));
  });
  const response = await call("video");
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, "bridge_error");
});

test("video metadata is emitted in SSE and wrong-format payload fails closed", async (t) => {
  const { port, ws } = await harness(t);
  let invalid = false;
  const video = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(30)]);
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type !== "bridge:run") return;
    const bytes = invalid ? Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(30)]) : video;
    const transferId = crypto.randomUUID();
    ws.send(JSON.stringify({ type: "bridge:media:start", id: message.id, transferId, kind: "video",
      mimeType: "video/mp4", size: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") }));
    ws.send(JSON.stringify({ type: "bridge:media:chunk", id: message.id, transferId,
      sequence: 0, data: bytes.toString("base64") }));
    ws.send(JSON.stringify({ type: "bridge:media:end", id: message.id, transferId }));
    if (!invalid) ws.send(JSON.stringify({ type: "bridge:complete", id: message.id, text: "Video ready" }));
  });
  const call = () => fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: "Bearer test-media-api-key", "Content-Type": "application/json" },
    body: JSON.stringify({ model: "bridge-gemini", media_kind: "video", stream: true,
      messages: [{ role: "user", content: "video" }] }),
  });
  const good = await call();
  assert.equal(good.status, 200);
  const events = await good.text();
  assert.match(events, /"media":\[\{/);
  assert.match(events, /"kind":"video"/);
  assert.match(events, /data: \[DONE\]/);
  invalid = true;
  const bad = await call();
  assert.equal(bad.status, 200); // SSE headers are committed before media validation.
  const errorStream = await bad.text();
  assert.match(errorStream, /Media transfer rejected/);
  assert.doesNotMatch(errorStream, /"media":\[\{/);
});

test("MacFlow media stays pinned to exact Profile, tab, URL and document after navigation", async (t) => {
  const { port, ws } = await harness(t);
  const profile = crypto.randomUUID();
  const doc = crypto.randomUUID();
  const target = { profileInstanceId: profile, tabId: 37, documentToken: doc, url: "https://gemini.google.com/app" };
  const headers = { Authorization: "Bearer test-media-api-key", "Content-Type": "application/json" };
  ws.send(JSON.stringify({ type: "bridge:hello", version: "0.5.0", providers: ["gemini"], profileInstanceId: profile }));
  ws.send(JSON.stringify({ type: "bridge:tabs", profileInstanceId: profile, tabs: [
    { ...target, provider: "gemini", title: "Gemini media", ready: true, busy: false },
  ] }));
  for (let i = 0; i < 20; i++) {
    const response = await fetch(`http://127.0.0.1:${port}/api/bridge/status`, { headers });
    if ((await response.json()).tabs?.length === 1) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  const invoke = (pin) => fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
    method: "POST", headers, body: JSON.stringify({ model: "bridge-gemini", media_kind: "image",
      target: pin, messages: [{ role: "user", content: "image" }] }),
  });
  const stale = await invoke({ ...target, documentToken: crypto.randomUUID() });
  assert.equal(stale.status, 409);
  const bytes = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(24, 1)]);
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type !== "bridge:run") return;
    assert.deepEqual(msg.target, target);
    assert.equal(msg.mediaKind, "image");
    const transferId = crypto.randomUUID();
    const base = { id: msg.id, provider: "gemini", tabId: target.tabId, url: target.url, documentToken: target.documentToken };
    ws.send(JSON.stringify({ ...base, type: "bridge:media:start", transferId, kind: "image", mimeType: "image/png", size: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex") }));
    ws.send(JSON.stringify({ ...base, type: "bridge:media:chunk", transferId, sequence: 0, data: bytes.toString("base64") }));
    ws.send(JSON.stringify({ ...base, type: "bridge:media:end", transferId }));
    ws.send(JSON.stringify({ ...base, type: "bridge:complete", text: "" }));
  });
  const valid = await invoke(target);
  assert.equal(valid.status, 200);
  const payload = await valid.json();
  assert.equal(payload.media.length, 1);
  assert.equal(payload.media[0].kind, "image");
  const file = await fetch(payload.media[0].url, { headers });
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
});

test("rejects media on an older connected Chrome extension without submitting the prompt", async (t) => {
  const { port, ws } = await harness(t);
  const profile = crypto.randomUUID();
  const target = { profileInstanceId: profile, tabId: 9, documentToken: crypto.randomUUID(), url: "https://gemini.google.com/app" };
  let dispatched = 0;
  ws.addEventListener("message", event => { if (JSON.parse(event.data).type === "bridge:run") dispatched++; });
  ws.send(JSON.stringify({ type: "bridge:hello", version: "0.4.0", providers: ["gemini"], profileInstanceId: profile }));
  ws.send(JSON.stringify({ type: "bridge:tabs", profileInstanceId: profile,
    tabs: [{ ...target, provider: "gemini", title: "Old extension", ready: true, busy: false }] }));
  const headers = { Authorization: "Bearer test-media-api-key", "Content-Type": "application/json" };
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`http://127.0.0.1:${port}/api/bridge/status`, { headers });
    if ((await res.json()).tabs?.length === 1) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  const res = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
    method: "POST", headers, body: JSON.stringify({ model: "bridge-gemini", media_kind: "image", target,
      messages: [{ role: "user", content: "do not submit" }] }),
  });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error.code, "media_extension_outdated");
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(dispatched, 0);
});
