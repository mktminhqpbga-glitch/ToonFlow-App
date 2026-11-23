import { $ } from "bun";
import { readFile } from "@toonflow/file";
import { dirname, resolve } from "node:path";
import rootPackage from "../package.json";

const root = resolve(import.meta.dirname, "..");
const [script, ...groups] = process.argv.slice(2);
const patterns = rootPackage.workspaces.filter(pattern => !groups.length || groups.includes(pattern.slice(0, -2)));
if (!script || groups.some(group => !patterns.includes(`${group}/*`))) throw new Error("Chỉ định lệnh và nhóm workspace trong package.json.");

// ACT: Bun 1.4.3 --filter lowercases directory names on Linux. Glob keeps their on-disk spelling.
const manifests = new Set<string>();
for (const pattern of patterns) {
  for await (const path of new Bun.Glob(`${pattern}/package.json`).scan({ cwd: root })) manifests.add(path);
}

const failures: string[] = [];
let count = 0;
for (const path of [...manifests].sort()) {
  const manifest = JSON.parse(await readFile(resolve(root, path), "utf8")) as { scripts?: Record<string, string> };
  if (!manifest.scripts?.[script]) continue;
  const directory = dirname(path);
  console.log(`\n${directory} · ${script}`);
  count++;
  const result = await $`${process.execPath} run ${script}`.cwd(resolve(root, directory)).nothrow();
  if (result.exitCode !== 0) failures.push(directory);
}

console.log(`\n${script}: ${count - failures.length}/${count} workspace hoàn tất.`);
if (!count || failures.length) {
  if (failures.length) console.error(`Workspace lỗi: ${failures.join(", ")}`);
  process.exitCode = 1;
}
