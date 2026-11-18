import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const png = Buffer.from("89504e470d0a1a0a0000000049454e44ae426082", "hex").toString("base64");
const image = { mime_type: "image/png", data: png, name: "example.png" };

async function helper(env = {}) {
  const source = await fs.readFile(path.join(root, "extension/image-input.js"), "utf8");
  class FakeFile {
    constructor(bytes, name, options) {
      this.bytes = bytes;
      this.name = name;
      this.type = options.type;
    }
  }
  class FakeDataTransfer {
    files = [];
    items = { add: file => this.files.push(file) };
  }
  const context = {
    globalThis: {},
    document: { body: {}, documentElement: {} },
    File: FakeFile,
    DataTransfer: FakeDataTransfer,
    Uint8Array,
    atob: input => Buffer.from(input, "base64").toString("binary"),
    getComputedStyle: () => ({ display: "block", visibility: "visible" }),
    setTimeout,
    ...env,
  };
  vm.runInNewContext(source, context, { filename: "image-input.js" });
  return context.globalThis.AI_BRIDGE_IMAGE_INPUT;
}

test("image helper and manifest advertise version 0.6.0", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root, "extension/manifest.json"), "utf8"));
  assert.equal(manifest.version, "0.6.0");
  for (const entry of manifest.content_scripts) {
    assert.ok(entry.js.includes("image-input.js"));
    assert.ok(entry.js.indexOf("image-input.js") < entry.js.indexOf(entry.js.at(-1)));
  }
  assert.equal((await helper()).version, "0.6.0");
});

test("rejects malformed image payloads, wrong MIME, oversized image and wrong magic bytes", async () => {
  const api = await helper();
  assert.equal(api.checkImages([image])[0].name, "example.png");
  for (const bad of [
    [], [image, image, image],
    [{ ...image, mime_type: "image/svg+xml" }],
    [{ ...image, data: "not-valid" }],
    [{ ...image, mime_type: "image/jpeg" }],
    [{ ...image, data: Buffer.alloc(3 * 1024 * 1024 + 1, 10).toString("base64") }],
  ]) {
    assert.throws(() => api.checkImages(bad));
  }
});

test("Muse refuses image input before any file or prompt interaction", async () => {
  const api = await helper();
  await assert.rejects(api.attach([image], {}, "muse"), /Muse/);
});

test("fails closed when no composer-bound image file picker can be verified", async () => {
  const api = await helper();
  const rootElement = {
    querySelectorAll: () => [],
    contains: () => true,
    parentElement: null,
  };
  const composer = { isConnected: true, closest: () => null, parentElement: rootElement };
  await assert.rejects(api.attach([image], composer, "chatgpt"), /Không tìm thấy ô tải ảnh/);
});

test("does not confuse an avatar-only file control for an image attachment", async () => {
  const api = await helper();
  const avatar = { id: "avatar-image", accept: "image/*", disabled: false, closest: () => null };
  const rootElement = {
    querySelectorAll: () => [avatar, { ...avatar }],
    contains: () => true,
    parentElement: null,
  };
  const composer = { isConnected: true, closest: () => null, parentElement: rootElement };
  await assert.rejects(api.attach([image], composer, "chatgpt"), /Không tìm thấy ô tải ảnh/);
});

test("rejects a single avatar picker even if it advertises image/*", async () => {
  const api = await helper();
  const avatar = { id: "profile-photo", accept: "image/*", disabled: false, closest: () => null };
  const rootElement = { querySelectorAll: () => [avatar], contains: () => true, parentElement: null };
  const composer = { isConnected: true, closest: () => null, parentElement: rootElement };
  await assert.rejects(api.attach([image], composer, "chatgpt"), /Không tìm thấy ô tải ảnh/);
});

test("an explicitly named attachment picker is considered, not nearby profile inputs", async () => {
  const api = await helper();
  const upload = { id: "attach-file", accept: "image/*", disabled: false, closest: () => null };
  const avatar = { id: "user-avatar", accept: "image/*", disabled: false, closest: () => null };
  const rootElement = { querySelectorAll: () => [upload, avatar], contains: () => true, parentElement: null };
  const composer = { isConnected: true, closest: () => null, parentElement: rootElement };
  // The safe input is unique, so we reach the next validation step. No fake
  // input is mutated (both lack parentElement) and no Send action occurs.
  await assert.rejects(api.attach([image], composer, "chatgpt"), /Không xác định được khu vực xem trước ảnh/);
});

test("requires a composer-local thumbnail to remain visible immediately before sending", async () => {
  const api = await helper({ Event: class { constructor(type) { this.type = type; } } });
  let visiblePreview = false;
  let uploading = false;
  const thumbnail = { getClientRects: () => [{}], closest: () => null };
  const progress = { getClientRects: () => [{}] };
  const rootElement = {
    isConnected: true,
    parentElement: null,
    contains: node => node === composer || node === input,
    querySelectorAll: selector => selector === 'input[type="file"]' ? [input]
      : selector.includes('upload-progress') ? (uploading ? [progress] : [])
      : selector.includes('attachment') ? (visiblePreview ? [thumbnail] : [])
      : [],
  };
  const input = {
    id: "attach-file", accept: "image/*", disabled: false, files: [], multiple: true,
    isConnected: true, parentElement: rootElement, closest: () => null,
    dispatchEvent: event => { if (event.type === "change") visiblePreview = true; },
  };
  const composer = { isConnected: true, closest: () => null, parentElement: rootElement };
  assert.equal(await api.attach([image], composer, "chatgpt"), true);
  assert.equal(api.assertAttached(composer, 1), true);
  uploading = true;
  assert.throws(() => api.assertAttached(composer, 1), /vẫn đang tải lên/);
  uploading = false;
  visiblePreview = false;
  assert.throws(() => api.assertAttached(composer, 1), /không còn hiển thị/);
});
