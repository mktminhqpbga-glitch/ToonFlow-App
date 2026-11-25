// Apply the MacFlow localization layer to a writable copy of the pinned Huobao source.
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const root = process.argv[2];
if (!root) throw new Error("Usage: node prepareLocale.cjs <Huobao source directory>");

function replace(path, rules) {
  const file = join(root, path);
  let source = readFileSync(file, "utf8");
  for (const [before, after] of rules) {
    if (source.includes(after)) continue;
    if (!source.includes(before)) throw new Error(`Huobao locale contract changed in ${path}: ${before}`);
    source = source.replace(before, after);
  }
  writeFileSync(file, source);
}

const localeRoot = join(root, "frontend/app/locales");
const english = JSON.parse(readFileSync(join(localeRoot, "en.json"), "utf8"));
const dictionaries = JSON.parse(readFileSync(join(__dirname, "vietnamese.json"), "utf8"));
const vietnamese = {};
for (const [key, text] of Object.entries(dictionaries)) {
  const parts = key.split(".");
  const field = parts.pop();
  const original = parts.reduce((value, part) => value?.[part], english)?.[field];
  if (typeof original !== "string" && key !== "settings.general.langNameVi") throw new Error(`Unknown Huobao translation key: ${key}`);
  const placeholders = value => (value?.match(/\{\w+\}/g) ?? []).sort().join(",");
  if (placeholders(original) !== placeholders(text)) throw new Error(`Huobao translation placeholders changed: ${key}`);
  const target = parts.reduce((value, part) => value[part] ??= {}, vietnamese);
  target[field] = text;
}
writeFileSync(join(localeRoot, "vi.json"), JSON.stringify(vietnamese, null, 2) + "\n");
replace("frontend/app/composables/i18n.ts", [
  ["import ko from '../locales/ko.json'", "import ko from '../locales/ko.json'\nimport vi from '../locales/vi.json'"],
  ["'zh' | 'en' | 'ja' | 'ko'", "'zh' | 'en' | 'ja' | 'ko' | 'vi'"],
  ["  { value: 'zh', label: '中文' },", "  { value: 'vi', label: 'Tiếng Việt' },\n  { value: 'zh', label: '中文' },"],
  ["  return 'zh'", "  return 'vi'"],
  ["  fallbackLocale: 'zh',", "  fallbackLocale: 'en',"],
  ["messages: { zh, en, ja, ko }", "messages: { zh, en, ja, ko, vi }"],
]);
replace("frontend/app/composables/useUnifiedLanguage.ts", [
  ["ko: 'langNameKo'", "ko: 'langNameKo', vi: 'langNameVi'"],
]);
replace("frontend/app/pages/settings.vue", [
  ["  { value: 'ko', label: '한국어', shortLabel: '한국어' },",
    "  { value: 'ko', label: '한국어', shortLabel: '한국어' },\n  { value: 'vi', label: 'Tiếng Việt', shortLabel: 'Tiếng Việt' },"],
]);
replace("frontend/nuxt.config.ts", [["title: '火宝短剧'", "title: 'Huobao Drama'"]]);
replace("backend/src/services/app-settings.ts", [
  ["['zh', 'en', 'ja', 'ko'] as const", "['zh', 'en', 'ja', 'ko', 'vi'] as const"],
  ["? row.value : 'zh'", "? row.value : 'vi'"],
]);
replace("backend/src/agents/language.ts", [["  en: 'English',", "  vi: 'Tiếng Việt (Vietnamese)',\n  en: 'English',"]]);
