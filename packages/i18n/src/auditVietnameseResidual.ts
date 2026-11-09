import { readdir, readFile } from "@toonflow/file";
import { resolve, relative } from "node:path";
import { collectMessages } from "./transform";

const root = resolve(import.meta.dirname, "../../..");
const sources = ["apps/web/src", "apps/server/src", "packages/nodeShared/src",
  "packages/nodeScaffold/src", "packages/nodes"];
const skip = new Set(["node_modules", "build", "dist", "tests", "test", "fixtures", "locales"]);
const chinese = /[\u3400-\u9fff]/;
const quoted = /(["'`])([^"'\r\n]*[\u3400-\u9fff][^"'\r\n]*)\1/g;
const report = { auditedFiles: 0, sourceChineseLiteralOccurrences: 0, guardedOrTranslated: 0,
  needsManualReview: 0, promptRelatedCandidates: 0, parseFailures: 0 };
const byFile = new Map<string, number>();
for (const source of sources) await walk(resolve(root, source));

async function walk(directory: string) {
  for (const file of await readdir(directory, { withFileTypes: true })) {
    if (file.isDirectory()) { if (!skip.has(file.name)) await walk(resolve(directory, file.name)); continue; }
    if (!file.isFile() || !/\.(vue|ts|tsx|js)$/.test(file.name) || /\.d\.ts$/.test(file.name)) continue;
    const filePath = resolve(directory, file.name);
    const path = relative(root, filePath).replaceAll("\\", "/");
    const contents = await readFile(filePath, "utf8");
    report.auditedFiles++;
    const extracted = new Set<string>();
    try { for (const value of collectMessages(contents, filePath)) extracted.add(value); }
    catch { report.parseFailures++; }
    for (const line of contents.split(/\r?\n/)) {
      if (!chinese.test(line) || /^\s*(?:\/\/|\*|\/\*|<!--)/.test(line)) continue;
      // Literal-only heuristic: the compiler audit is authoritative for recognized UI messages.
      // Chinese alternatives of explicitly locale-controlled text are deliberately retained.
      for (const match of line.matchAll(quoted)) {
        report.sourceChineseLiteralOccurrences++;
        const key = match[2]!;
        if (extracted.has(key) ||
          /\b(?:nodeText|localized|toonflowTranslate|translate|i18n\.t)\s*\(/.test(line) ||
          /\b(?:vietnamese\.value|document\.documentElement\.lang|\bgetLocale\(\)\s*===?\s*["']vi["'])/.test(line) ||
          /\b(?:promptVi|systemPromptVi|instructionVi|directorPromptVi)\b/.test(line)) {
          report.guardedOrTranslated++;
          continue;
        }
        report.needsManualReview++;
        byFile.set(path, (byFile.get(path) ?? 0) + 1);
        if (/\b(?:prompt|instruction|system|agent)\b/i.test(line)) report.promptRelatedCandidates++;
      }
    }
  }
}
console.log("[VI RESIDUAL REVIEW] " + JSON.stringify({
  ...report, metric: "Lexical candidates, NOT proven visible untranslated strings",
  topFiles: [...byFile.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([file,count])=>({file,count})),
}));
