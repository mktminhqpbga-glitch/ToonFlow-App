import { $ } from "bun";
import { readdir, rm } from "@toonflow/file";
import { resolve } from "node:path";

// Use the same per-directory Bun build strategy already proven in buildStandalone.ts.
// Bun's --filter can return FileNotFound on Linux for camelCase workspace paths.
const group = process.argv[2];
if (group !== "tools" && group !== "ext" && group !== "nodes")
  throw new Error("Expected build group: tools, ext or nodes");

const projectDir = resolve(import.meta.dirname, "../../..");
const groupDirectory = resolve(projectDir, "packages", group);
const entries = (await readdir(groupDirectory, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .sort((left, right) => left.name.localeCompare(right.name));
if (!entries.length) throw new Error(`No packages found in ${groupDirectory}`);

// Clean only generated output, never source directories, repositories or user files.
await rm(resolve(projectDir, "build", group), { recursive: true, force: true });
for (const entry of entries) {
  console.log(`[build:${group}] ${entry.name}`);
  await $`${process.execPath} run build`
    .cwd(resolve(groupDirectory, entry.name))
    .env({ ...process.env, NODE_ENV: "production" });
}
