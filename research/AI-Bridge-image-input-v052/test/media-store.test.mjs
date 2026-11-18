import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createMediaStore, matchesMediaSignature } from "../media-store.mjs";

const PNG = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(30, 1)]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom", "ascii"), Buffer.alloc(40, 2)]);
const WEBM = Buffer.concat([Buffer.from("1a45dfa3", "hex"), Buffer.alloc(50, 3)]);
const JPEG = Buffer.concat([Buffer.from("ffd8ff", "hex"), Buffer.alloc(30, 4)]);
const WEBP = Buffer.concat([Buffer.from("RIFF", "ascii"), Buffer.alloc(4), Buffer.from("WEBP", "ascii"), Buffer.alloc(30)]);

test("media store accepts verified image/video bytes, rejects incorrect MIME and serves only existing IDs", async (t) => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "bridge-media-"));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const store = createMediaStore(folder);
  assert.equal(matchesMediaSignature(PNG, "image/png"), true);
  assert.equal(matchesMediaSignature(MP4, "video/mp4"), true);
  assert.equal(matchesMediaSignature(WEBM, "video/webm"), true);
  assert.equal(matchesMediaSignature(JPEG, "image/jpeg"), true);
  assert.equal(matchesMediaSignature(WEBP, "image/webp"), true);
  assert.equal(matchesMediaSignature(PNG, "video/mp4"), false);
  for (const [kind, mimeType, bytes] of [["image", "image/png", PNG], ["video", "video/mp4", MP4], ["video", "video/webm", WEBM]]) {
    const job = { media: [], mediaKind: kind, upload: null };
    const transferId = crypto.randomUUID();
    store.begin(job, { transferId, kind, mimeType, size: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
    store.append(job, { transferId, sequence: 0, data: bytes.toString("base64") });
    assert.throws(() => store.append(job, { transferId, sequence: 0, data: bytes.toString("base64") }), /ordering/);
    const file = store.end(job, { transferId });
    assert.equal(file.kind, kind);
    assert.deepEqual(await fs.readFile(store.lookup(file.id).path), bytes);
    assert.equal(store.lookup("../foo"), null);
    store.abort(job, true);
    assert.equal(store.lookup(file.id), null);
  }
  const job = { media: [], mediaKind: "video", upload: null };
  assert.throws(() => store.begin(job, {
    transferId: crypto.randomUUID(), kind: "image", mimeType: "image/png", size: PNG.length,
    sha256: crypto.createHash("sha256").update(PNG).digest("hex"),
  }), /Unexpected media kind/);
  const bad = { media: [], mediaKind: "video", upload: null };
  const id = crypto.randomUUID();
  store.begin(bad, { transferId: id, kind: "video", mimeType: "video/mp4", size: PNG.length, sha256: crypto.createHash("sha256").update(PNG).digest("hex") });
  store.append(bad, { transferId: id, sequence: 0, data: PNG.toString("base64") });
  assert.throws(() => store.end(bad, { transferId: id }), /signature/);
  store.abort(bad, true);
  assert.equal((await fs.readdir(folder)).length, 0);
});
