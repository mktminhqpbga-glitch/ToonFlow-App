import { readFile } from "@toonflow/file";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const packages = new Set<string>();
for (const workspace of manifest.workspaces as string[]) {
  for await (const path of new Bun.Glob(`${workspace}/package.json`).scan({ cwd: root })) packages.add(path);
}
let count = 0;
const failed: string[] = [];
for (const path of [...packages].sort()) {
  const entry = JSON.parse(await readFile(resolve(root, path), "utf8"));
  if (!entry.name?.startsWith("@toonflow/") || !entry.scripts?.typecheck) continue;
  console.log(`[typecheck] ${entry.name}`);
  const child = Bun.spawn([process.execPath, "run", "typecheck"], { cwd: resolve(root, path, ".."), stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) failed.push(entry.name);
  count++;
}
if (!count) throw new Error("Không tìm thấy workspace có lệnh typecheck");
console.log(`Đã kiểm tra ${count} workspace.`);

if (failed.length) {
  console.error(`Typecheck thất bại: ${failed.join(", ")}`);
  process.exit(1);
}
