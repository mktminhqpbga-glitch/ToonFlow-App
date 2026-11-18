// Local, bounded binary artifact storage. Never fetch a URL received from a chat tab.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const MAX_MEDIA_FILES = 4;
export const MAX_MEDIA_BYTES = 64 * 1024 * 1024;
export const MAX_MEDIA_CHUNK = 48 * 1024;
export const MEDIA_TTL_MS = 60 * 60 * 1000;
const MIME = Object.freeze({
  "image/png": { kind: "image", ext: "png", max: 16 * 1024 * 1024 },
  "image/jpeg": { kind: "image", ext: "jpg", max: 16 * 1024 * 1024 },
  "image/webp": { kind: "image", ext: "webp", max: 16 * 1024 * 1024 },
  "video/mp4": { kind: "video", ext: "mp4", max: MAX_MEDIA_BYTES },
  "video/webm": { kind: "video", ext: "webm", max: MAX_MEDIA_BYTES },
});

export function matchesMediaSignature(bytes, mimeType) {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
  if (bytes.length < 12) return false;
  switch (mimeType) {
    case "image/png": return bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
    case "image/jpeg": return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/webp": return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    case "video/mp4": return bytes.toString("ascii", 4, 8) === "ftyp";
    case "video/webm": return bytes.subarray(0, 4).equals(Buffer.from("1a45dfa3", "hex"));
    default: return false;
  }
}

export function createMediaStore(directory) {
  const root = path.resolve(directory);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const available = new Map();

  function expire() {
    const now = Date.now();
    for (const [id, file] of available) {
      if (file.expiresAt > now) continue;
      available.delete(id);
      try { fs.unlinkSync(file.path); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  }

  function begin(job, metadata) {
    expire();
    if (job.upload || job.media.length >= MAX_MEDIA_FILES) throw new Error("Too many simultaneous or completed media files.");
    const { transferId, kind, mimeType, size, sha256 } = metadata;
    if (typeof transferId !== "string" || !/^[a-f0-9-]{36}$/.test(transferId)) throw new Error("Invalid media transfer ID.");
    const format = MIME[mimeType];
    if (!format || format.kind !== kind || !Number.isSafeInteger(size) || size < 12 || size > format.max ||
        typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error("Invalid media type, size, or checksum.");
    if (job.mediaKind === "none" || (job.mediaKind !== "auto" && job.mediaKind !== kind)) throw new Error("Unexpected media kind.");
    if (job.media.reduce((n, item) => n + item.size, 0) + size > MAX_MEDIA_BYTES) throw new Error("Media total exceeds 64 MiB.");
    const id = crypto.randomUUID();
    const filename = `bridge-media-${id}.${format.ext}`;
    const tempPath = path.join(root, `bridge-media-${id}.part`);
    const fd = fs.openSync(tempPath, "wx+", 0o600);
    job.upload = { transferId, id, mimeType, kind, size, sha256, fd, tempPath, filename, written: 0, sequence: 0, hash: crypto.createHash("sha256") };
  }

  function append(job, { transferId, sequence, data }) {
    const file = job.upload;
    if (!file || file.transferId !== transferId || !Number.isSafeInteger(sequence) || sequence !== file.sequence ||
        typeof data !== "string" || data.length > Math.ceil(MAX_MEDIA_CHUNK / 3) * 4 || data.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error("Invalid media chunk ordering or encoding.");
    const bytes = Buffer.from(data, "base64");
    if (!bytes.length || bytes.length > MAX_MEDIA_CHUNK || bytes.toString("base64") !== data || file.written + bytes.length > file.size) {
      throw new Error("Invalid media chunk size or content.");
    }
    fs.writeSync(file.fd, bytes);
    file.hash.update(bytes);
    file.written += bytes.length;
    file.sequence++;
  }

  function end(job, { transferId }) {
    const file = job.upload;
    if (!file || file.transferId !== transferId || file.written !== file.size || file.hash.digest("hex") !== file.sha256) {
      throw new Error("Media file length/checksum mismatch.");
    }
    const head = Buffer.alloc(16);
    fs.readSync(file.fd, head, 0, 16, 0);
    if (!matchesMediaSignature(head, file.mimeType)) throw new Error("Media payload signature does not match its MIME type.");
    fs.closeSync(file.fd);
    file.fd = null;
    const finalPath = path.join(root, file.filename);
    fs.renameSync(file.tempPath, finalPath);
    const meta = { id: file.id, kind: file.kind, mime_type: file.mimeType, size: file.size, sha256: file.sha256 };
    available.set(file.id, { ...meta, path: finalPath, expiresAt: Date.now() + MEDIA_TTL_MS });
    job.media.push(meta);
    job.upload = null;
    return meta;
  }

  function abort(job, discard = false) {
    if (job.upload) {
      const file = job.upload;
      job.upload = null;
      if (file.fd !== null) fs.closeSync(file.fd);
      try { fs.unlinkSync(file.tempPath); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    if (discard) {
      for (const item of job.media) {
        const file = available.get(item.id);
        available.delete(item.id);
        if (file) fs.unlinkSync(file.path);
      }
      job.media.length = 0;
    }
  }

  function lookup(id) {
    expire();
    return /^[0-9a-f-]{36}$/.test(id) ? available.get(id) ?? null : null;
  }

  return { begin, append, end, abort, lookup, expire };
}
