import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  server.close();
  await once(server, "close");
  return port;
}

async function harness(t, version = "0.6.0") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bridge-input-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const port = await freePort();
  const child = spawn(process.execPath, ["local-server.mjs", `--port=${port}`, "--token=test-token",
    `--settings-file=${path.join(root, "settings.json")}`,
    `--prompt-instructions-dir=${path.join(root, "prompts")}`], {
    cwd: projectRoot, env: { ...process.env, BRIDGE_API_KEY: "test-key", BRIDGE_MEDIA_DIR: path.join(root, "media") },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => child.kill());
  await once(child.stdout, "data");
  const ws = new WebSocket(`ws://127.0.0.1:${port}/bridge?token=test-token`);
  t.after(() => ws.close());
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const profileInstanceId = crypto.randomUUID();
  const target = { profileInstanceId, tabId: 77, documentToken: crypto.randomUUID(), url: "https://gemini.google.com/app" };
  ws.send(JSON.stringify({ type: "bridge:hello", profileInstanceId, version, providers: ["gemini"] }));
  ws.send(JSON.stringify({ type: "bridge:tabs", profileInstanceId, tabs: [
    { ...target, provider: "gemini", title: "Test tab", ready: true, busy: false },
  ] }));
  const headers = { Authorization: "Bearer test-key", "content-type": "application/json" };
  for (let attempt = 0; attempt < 30; attempt++) {
    const status = await (await fetch(`http://127.0.0.1:${port}/api/bridge/status`, { headers })).json();
    if (status.tabs.length) {
      assert.equal(status.input_image_support, true);
      assert.equal(status.tabs[0].input_image_support, version >= "0.6.0");
      break;
    }
    if (attempt === 29) assert.fail("Extension inventory was not received.");
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const invoke = async (options = {}) => {
    const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: "POST", headers, signal: AbortSignal.timeout(4000),
      body: JSON.stringify({ model: "bridge-gemini", messages: [{ role: "user", content: "Edit this photo" }],
        media_kind: "image", target, ...options }),
    });
    return { status: response.status, body: await response.json() };
  };
  return { ws, target, invoke, port, headers };
}

const pngBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64");
const jpegBytes = Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex");
const webpBytes = Buffer.concat([Buffer.from("RIFF", "ascii"), Buffer.alloc(4), Buffer.from("WEBPVP8 "), Buffer.alloc(12)]);
webpBytes.writeUInt32LE(webpBytes.length - 8, 4);
const input = (bytes = pngBytes, mime_type = "image/png", name = "reference.png") => ({ mime_type, data: bytes.toString("base64"), name });

test("valid input images reach the exact pinned extension in bridge:run", async (t) => {
  const { ws, invoke, target } = await harness(t);
  const received = [];
  ws.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.type !== "bridge:run") return;
    received.push(message);
    assert.deepEqual(message.target, target);
    ws.send(JSON.stringify({ type: "bridge:error", id: message.id, provider: "gemini", tabId: target.tabId,
      documentToken: target.documentToken, url: target.url, message: "Synthetic stop before real prompt" }));
  });
  const images = [input(), input(webpBytes, "image/webp", "reference.webp")];
  const result = await invoke({ input_images: images });
  assert.equal(result.status, 502);
  assert.equal(received.length, 1);
  assert.deepEqual(received[0].inputImages, images);
  assert.equal(received[0].mediaKind, "image");
});

test("OpenAI image_url data URLs become real verified image attachments, never prompt text", async t => {
  const { ws, invoke, target } = await harness(t);
  let received;
  ws.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.type !== "bridge:run") return;
    received = message;
    ws.send(JSON.stringify({ type: "bridge:error", id: message.id, provider: "gemini", tabId: target.tabId,
      documentToken: target.documentToken, url: target.url, message: "Synthetic stop before submission" }));
  });
  const result = await invoke({ messages: [{ role: "user", content: [
    { type: "text", text: "Please edit this reference image" },
    { type: "image_url", image_url: { url: `data:image/png;base64,${pngBytes.toString("base64")}` } },
  ] }] });
  assert.equal(result.status, 502);
  assert.equal(received.inputImages.length, 1);
  assert.equal(received.inputImages[0].data, pngBytes.toString("base64"));
  assert.ok(received.prompt.includes("Please edit this reference image"));
  assert.ok(!received.prompt.includes("Unsupported content part"));
  assert.ok(!received.prompt.includes("base64"));
});

test("remote and invalid image_url parts reject before dispatch, no text-only fallback", async t => {
  const { ws, invoke } = await harness(t);
  let dispatches = 0;
  ws.addEventListener("message", event => { if (JSON.parse(event.data).type === "bridge:run") dispatches++; });
  for (const image_url of ["https://example.com/image.png", "file:///tmp/a.png", "data:image/png;base64,broken"])
    assert.equal((await invoke({ messages: [{ role: "user", content: [
      { type: "text", text: "Send with image" }, { type: "image_url", image_url: { url: image_url } },
    ] }] })).status, 400);
  assert.equal(dispatches, 0);
});

test("large inline image_url remains a binary attachment above the text-only request cap", async t => {
  const { ws, invoke, target } = await harness(t);
  let received;
  ws.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.type !== "bridge:run") return;
    received = message;
    ws.send(JSON.stringify({ type: "bridge:error", id: message.id, provider: "gemini", tabId: target.tabId,
      documentToken: target.documentToken, url: target.url, message: "Synthetic stop" }));
  });
  const large = Buffer.concat([pngBytes.subarray(0, pngBytes.length - 8), Buffer.alloc(800 * 1024), pngBytes.subarray(-8)]);
  const outcome = await invoke({ messages: [{ role: "user", content: [
    { type: "text", text: "Keep face unchanged" },
    { type: "image_url", image_url: { url: `data:image/png;base64,${large.toString("base64")}` } },
  ] }] });
  assert.equal(outcome.status, 502);
  assert.equal(received.inputImages.length, 1);
  assert.equal(Buffer.from(received.inputImages[0].data, "base64").length, large.length);
});

test("validation rejects bad base64, MIME, signatures, count, filenames, size and unpinned requests without dispatch", async (t) => {
  const { ws, invoke } = await harness(t);
  let dispatches = 0;
  ws.addEventListener("message", event => {
    if (JSON.parse(event.data).type === "bridge:run") dispatches++;
  });
  const invalid = [
    { input_images: [] },
    { input_images: [input(), input(), input()] },
    { input_images: [input(pngBytes, "image/gif")] },
    { input_images: [{ ...input(), data: "SGVsbG8=" }] },
    { input_images: [{ ...input(), data: "!!!!" }] },
    { input_images: [{ ...input(), data: input().data + "=" }] },
    { input_images: [input(pngBytes, "image/jpeg")] },
    { input_images: [{ ...input(), name: "../unsafe.png" }] },
    { input_images: [{ ...input(), injected: true }] },
    { input_images: [input(Buffer.alloc(3 * 1024 * 1024 + 1))] },
    { input_images: [input()], target: undefined },
    { input_images: [input()], media_kind: "none" },
  ];
  for (const [index, item] of invalid.entries()) {
    const result = await invoke(item);
    assert.equal(result.status, 400, `Invalid case ${index}: ${JSON.stringify(result.body).slice(0, 200)}`);
  }
  assert.equal(dispatches, 0);
});

test("input images require extension >=0.6.0 while older media requests remain supported", async (t) => {
  const { ws, invoke, target } = await harness(t, "0.5.2");
  let count = 0;
  ws.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.type !== "bridge:run") return;
    count++;
    assert.equal(message.inputImages, undefined);
    ws.send(JSON.stringify({ type: "bridge:error", id: message.id, provider: "gemini", tabId: target.tabId,
      documentToken: target.documentToken, url: target.url, message: "Synthetic stop" }));
  });
  const blocked = await invoke({ input_images: [input()] });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.error.code, "input_images_extension_outdated");
  assert.equal(count, 0);
  const legacy = await invoke();
  assert.equal(legacy.status, 502);
  assert.equal(count, 1);
});

test("valid JPEG and video reference images pass input validation", async (t) => {
  const { ws, invoke, target } = await harness(t);
  const sent = [];
  ws.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.type !== "bridge:run") return;
    sent.push(message);
    ws.send(JSON.stringify({ type: "bridge:error", id: message.id, provider: "gemini", tabId: target.tabId,
      documentToken: target.documentToken, url: target.url, message: "Synthetic stop" }));
  });
  const result = await invoke({ media_kind: "video", input_images: [input(jpegBytes, "image/jpeg", "a.jpg")] });
  assert.equal(result.status, 502);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].inputImages[0].mime_type, "image/jpeg");
});

test("Muse rejects unverified image upload before any pinned dispatch", async (t) => {
  const { ws, invoke } = await harness(t);
  let dispatches = 0;
  ws.addEventListener("message", event => { if (JSON.parse(event.data).type === "bridge:run") dispatches++; });
  const result = await invoke({ model: "bridge-muse", input_images: [input()] });
  assert.equal(result.status, 409);
  assert.equal(result.body.error.code, "input_images_provider_unsupported");
  assert.equal(dispatches, 0);
});
