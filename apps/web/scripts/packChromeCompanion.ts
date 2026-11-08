import { readFile, mkdir, writeAtomic } from "@toonflow/file";
import { zipSync } from "fflate";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
// Chỉ đóng gói mã nguồn được phép; không đưa cấu hình ghép nối hoặc bí mật vào ZIP.
const names = ["manifest.json", "background.js", "remoteTransport.js", "content.js", "popup.html", "popup.js", "readme.md"];
const files: Record<string, Uint8Array> = {};
for (const name of names) files[name] = new Uint8Array(await readFile(resolve(root, "packages/chromeCompanion", name)));
const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"]));
if (manifest.manifest_version !== 3 || manifest.background?.service_worker !== "background.js"
  || manifest.action?.default_popup !== "popup.html") throw new Error("Manifest Chrome Companion không hợp lệ");
const directory = resolve(root, "apps/web/public");
await mkdir(directory, { recursive: true });
await writeAtomic(resolve(directory, "chromeCompanion.zip"), zipSync(files, { level: 9, mtime: new Date("2020-01-01T00:00:00Z") }));
console.log(`Chrome Companion: ${names.length} tệp → chromeCompanion.zip`);
