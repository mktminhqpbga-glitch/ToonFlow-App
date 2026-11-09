import { readdir, readFile } from "@toonflow/file";
import { resolve, relative } from "node:path";
import vi from "./locales/vi.json";
import { collectMessages } from "./transform";

const root = resolve(import.meta.dirname, "../../..");
const scopes = [
  "apps/web/src", "packages/nodeShared/src", "packages/nodeScaffold/src", "packages/nodes",
];
const chinese = /[\u3400-\u9fff]/;
const found = new Map<string, Set<string>>();
const failures: string[] = [];
const excluded = new Set(["node_modules", "dist", "build", "tests", "test", "locales", "fixtures"]);

async function scan(directory: string) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.isDirectory()) {
      if (!excluded.has(item.name)) await scan(resolve(directory, item.name));
      continue;
    }
    if (!item.isFile() || !/\.(vue|ts|tsx)$/.test(item.name) || /\.d\.ts$/.test(item.name)) continue;
    const path = resolve(directory, item.name);
    const name = relative(root, path).replaceAll("\\", "/");
    try {
      for (const message of collectMessages(await readFile(path, "utf8"), path)) {
        if (!chinese.test(message)) continue;
        const references = found.get(message) ?? new Set<string>();
        references.add(name);
        found.set(message, references);
      }
    } catch (error) {
      failures.push(name + ": " + (error instanceof Error ? error.message : String(error)));
    }
  }
}

for (const scope of scopes) await scan(resolve(root, scope));
const dictionary = vi as Record<string, string>;
const missing = [...found.entries()].filter(([key]) => !Object.hasOwn(dictionary, key))
  .map(([key, files]) => ({ key, files: [...files] }))
  .sort((a, b) => a.files[0]!.localeCompare(b.files[0]!));
const untranslatedValues = Object.entries(dictionary).filter(([, value]) => chinese.test(value));
const stats = {
  date: new Date().toISOString().slice(0, 10),
  scope: scopes, candidateUiStrings: found.size, dictionaryEntries: Object.keys(dictionary).length,
  missingVietnameseEntries: missing.length, untranslatedVietnameseValues: untranslatedValues.length,
  parseFailures: failures.length,
};
console.log("[VI AUDIT] " + JSON.stringify(stats));
for (const item of missing.slice(0, 60)) console.log("[VI MISSING] " + JSON.stringify(item));
if (missing.length > 60) console.log("[VI MISSING] " + (missing.length - 60) + " additional keys; see --strict or local catalog output.");
for (const item of failures.slice(0, 20)) console.error("[VI PARSE ERROR] " + item);
if (failures.length || untranslatedValues.length || process.argv.includes("--strict") && missing.length) {
  process.exitCode = 1;
}
