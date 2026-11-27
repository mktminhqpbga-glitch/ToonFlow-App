import { mkdir, mkdtemp, rename, rm } from "@toonflow/file";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { raw, Router } from "express";
import { unzip, type Unzipped } from "fflate";
import u from "@/utils";
import { success } from "@/lib/responseFormat";

const maxBytes = 1024 * 1024 * 1024;
const maxEntries = 10000;
let restoring = false;

function invalidBackup(message: string, status = 400) {
  return Object.assign(new Error(message), { status });
}

async function readArchive(bytes: Uint8Array): Promise<Unzipped> {
  const entries = new Map<string, { name: string; path: string; directory: boolean; size: number }>();
  const directories = new Map<string, string>();
  let total = 0;
  await new Promise<void>((resolve, reject) => {
    unzip(bytes, {
      filter({ name, originalSize }) {
        const directory = name.endsWith("/");
        const path = directory ? name.slice(0, -1) : name;
        const parts = path.split("/");
        if (path.length > 4096 || parts.length > 100 || parts.some(part => (
          !part || /[<>:"\\|?*\u0000-\u001f]/.test(part) || /[. ]$/.test(part)
          || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)
        ))) throw invalidBackup("Tệp ZIP có đường dẫn không hợp lệ.");
        const key = path.normalize("NFC").toLowerCase();
        if (entries.has(key) || (directory && originalSize)) throw invalidBackup("Tệp ZIP có mục trùng hoặc thư mục không hợp lệ.");
        entries.set(key, { name, path, directory, size: originalSize });
        total += originalSize;
        if (entries.size > maxEntries || total > maxBytes) throw invalidBackup("Bản sao vượt giới hạn 1 GB hoặc 10.000 mục.", 413);
        return false;
      },
    }, cause => {
      if (cause) return reject(invalidBackup("Không đọc được tệp ZIP. Hãy chọn bản sao đã tải từ MacFlow."));
      if (!entries.size) return reject(invalidBackup("Tệp ZIP không có dữ liệu dự án."));
      resolve();
    });
  });
  for (const { path } of entries.values()) {
    for (let parent = dirname(path); parent !== "."; parent = dirname(parent)) {
      const key = parent.normalize("NFC").toLowerCase();
      const saved = directories.get(key);
      const entry = entries.get(key);
      if (saved && saved !== parent || entry && (!entry.directory || entry.path !== parent)) {
        throw invalidBackup("Tệp ZIP có tên thư mục bị trùng.");
      }
      directories.set(key, parent);
    }
  }
  return new Promise((resolve, reject) => {
    unzip(bytes, (cause, files) => {
      if (cause || [...entries.values()].some(({ name, size }) => !Object.hasOwn(files, name) || files[name]!.byteLength !== size)) {
        return reject(invalidBackup("Tệp ZIP bị hỏng hoặc thiếu dữ liệu."));
      }
      resolve(files);
    });
  });
}

export default Router().post("/", (req, res, next) => {
  u.mcpControl.assertAppRequest(req);
  if (res.locals.multiTenantWeb || res.locals.multiTenantUser?.role === "user") {
    throw invalidBackup("Khôi phục dự án chỉ có trên bản MacFlow riêng.", 403);
  }
  if (!req.is("application/octet-stream")) throw invalidBackup("Hãy gửi tệp ZIP để khôi phục.");
  if (restoring) throw invalidBackup("Đang khôi phục một dự án khác. Hãy thử lại sau.", 409);
  restoring = true;
  raw({ type: "application/octet-stream", limit: maxBytes, inflate: false })(req, res, cause => {
    if (cause) restoring = false;
    next(cause);
  });
}, async (req, res) => {
  let temporary = "";
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length < 22) throw invalidBackup("Tệp sao lưu ZIP không hợp lệ.");
    const files = await readArchive(req.body);
    const root = await u.workspace.getWorkspaceRoot(req);
    temporary = await mkdtemp(join(root, ".restore-"));
    for (const [name, bytes] of Object.entries(files)) {
      if (res.destroyed) return;
      const path = join(temporary, name);
      if (name.endsWith("/")) await mkdir(path, { recursive: true, mode: 0o700 });
      else {
        await mkdir(dirname(path), { recursive: true, mode: 0o700 });
        await u.workspaceFile.writeWorkspaceFile(path, bytes, true);
      }
    }
    if (res.destroyed) return;
    const directory = join(root, `KhoiPhuc-${randomUUID()}`);
    await rename(temporary, directory);
    temporary = "";
    res.json(success({ directory }));
  } finally {
    try { if (temporary) await rm(temporary, { force: true, recursive: true }); }
    finally { restoring = false; }
  }
});
