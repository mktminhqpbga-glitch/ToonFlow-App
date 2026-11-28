// Apply the MacFlow localization layer to a writable copy of the pinned Huobao source.
const { copyFileSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const root = process.argv[2];
if (!root) throw new Error("Usage: node prepareLocale.cjs <Huobao source directory>");

function replace(path, rules) {
  const file = join(root, path);
  let source = readFileSync(file, "utf8");
  for (const [before, after] of rules) {
    if (source.includes(after)) continue;
    if (!source.includes(before)) throw new Error(`Huobao locale contract changed in ${path}: ${before}`);
    source = source.replaceAll(before, after);
  }
  writeFileSync(file, source);
}

const localeRoot = join(root, "frontend/app/locales");
const english = JSON.parse(readFileSync(join(localeRoot, "en.json"), "utf8"));
const dictionaries = JSON.parse(readFileSync(join(__dirname, "vietnamese.json"), "utf8"));
const additionalKeys = new Set(["settings.general.langNameVi", "errors.imageModelRequired", "errors.videoModelRequired"]);
const vietnamese = {};
for (const [key, text] of Object.entries(dictionaries)) {
  const parts = key.split(".");
  const field = parts.pop();
  const original = parts.reduce((value, part) => value?.[part], english)?.[field];
  if (typeof original !== "string" && !additionalKeys.has(key)) throw new Error(`Unknown Huobao translation key: ${key}`);
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
  ["import BaseSelect from '~/components/BaseSelect.vue'",
    "import BaseSelect from '~/components/BaseSelect.vue'\nimport { stylePresetName, stylePresetDescription } from '~/composables/stylePresetLocale'"],
  ["{{ p.name }}</span>", "{{ stylePresetName(p.value, p.name) }}</span>"],
  ["{{ p.description }}</div>", "{{ stylePresetDescription(p) }}</div>"],
  ["{ name: styleToDelete?.name }", "{ name: styleToDelete ? stylePresetName(styleToDelete.value, styleToDelete.name) : '' }"],
  ["    name: p.name,", "    name: stylePresetName(p.value, p.name),"],
  ["    description: p.description || '',", "    description: stylePresetDescription(p),"],
  ["    if (styleEditId.value) {\n      await stylePresetAPI.update", "    if (styleEditId.value) {\n      const original = stylePresets.value.find(p => p.id === styleEditId.value)\n      await stylePresetAPI.update"],
  ["        name: styleForm.name,", "        name: original && styleForm.name === stylePresetName(original.value, original.name) ? undefined : styleForm.name,"],
  ["        description: styleForm.description,", "        description: styleForm.description === stylePresetDescription(original) ? undefined : styleForm.description,"],
  ["const providerPresets = {", "const officialLabel = (name) => locale.value === 'vi' ? `${name} chính thức` : `${name} 官方`\nconst providerPresets = computed(() => ({"],
  ["}\nconst huobaoQuickConfigs", "}))\nconst huobaoQuickConfigs"],
  ["const group = providerPresets[type]", "const group = providerPresets.value[type]"],
  ["const preset = providerPresets[type]", "const preset = providerPresets.value[type]"],
  ...["Gemini", "OpenAI", "Seedance 2.0", "MiniMax H3"].map(name =>
    [`label: '${name} 官方'`, `label: officialLabel('${name}')`]),
  ["label: '阿里云百炼 Wan 3.0'", "label: locale.value === 'vi' ? 'Alibaba Cloud · Wan 3.0' : '阿里云百炼 Wan 3.0'"],
]);
copyFileSync(join(__dirname, "stylePresetLocale.ts"), join(root, "frontend/app/composables/stylePresetLocale.ts"));
replace("frontend/app/layouts/default.vue", [
  ['alt="火宝短剧"', 'alt=""'],
  ['class="brand-fallback">火</span>', 'class="brand-fallback" aria-hidden="true">H</span>'],
  ['class="brand-name">火宝短剧</span>', 'class="brand-name">{{ t(\'app.title\') }}</span>'],
  ['<span class="brand-sub">Huobao Shorts</span>', '<span v-if="locale === \'zh\'" class="brand-sub">Huobao Shorts</span>'],
]);
replace("frontend/app/pages/index.vue", [
  ["import BaseSelect from '~/components/BaseSelect.vue'",
    "import BaseSelect from '~/components/BaseSelect.vue'\nimport { stylePresetName, stylePresetDescription } from '~/composables/stylePresetLocale'"],
  ["{ n: stylePresets.length }", "{ n: activeStylePresets.length }"],
  ["const styleSelectOptions = computed(() => stylePresets.value.map(p => ({ label: p.name, value: p.value })))",
    "const activeStylePresets = computed(() => stylePresets.value.filter(p => p.is_active))\nconst styleSelectOptions = computed(() => activeStylePresets.value.map(p => ({ label: stylePresetName(p.value, p.name), value: p.value })))"],
  ["stylePresets.value.find(p => p.value === form.value.style)?.description || ''",
    "stylePresetDescription(activeStylePresets.value.find(p => p.value === form.value.style))"],
  ["  return stylePresets.value.find(p => p.value === key)?.name || key || ''",
    "  const preset = stylePresets.value.find(p => p.value === key)\n  return stylePresetName(key, preset?.name)"],
  ["stylePresetAPI.list()", "stylePresetAPI.list(true)"],
  ["if (!form.value.style && stylePresets.value.length) {\n      form.value.style = stylePresets.value[0].value",
    "if (!form.value.style && activeStylePresets.value.length) {\n      form.value.style = activeStylePresets.value[0].value"],
]);
replace("frontend/app/views/drama/detail.vue", [
  ["{{ drama.style }}", "{{ styleLabel }}"],
  ["uploadAPI } from '~/composables/useApi'", "uploadAPI, stylePresetAPI } from '~/composables/useApi'\nimport { stylePresetName } from '~/composables/stylePresetLocale'"],
  ["const drama = ref(null)", "const drama = ref(null)\nconst stylePresets = ref([])\nconst styleLabel = computed(() => {\n  const key = drama.value?.style\n  const preset = stylePresets.value.find(p => p.value === key)\n  return stylePresetName(key, preset?.name)\n})"],
  ["onMounted(load)", "onMounted(() => {\n  load()\n  stylePresetAPI.list(true).then(presets => { stylePresets.value = presets || [] }).catch(() => {})\n})"],
]);
replace("frontend/app/composables/useToast.ts", [
  ["  if (msg.length <= 40 && CJK_RE.test(msg) && !TECHY_RE.test(msg)) return msg",
    `  if (i18n.global.locale.value === 'vi') {
    if (msg === '未找到启用的图片生成配置，请先在设置中心添加') return t('errors.imageModelRequired')
    if (msg === '未找到启用的视频生成配置，请先在设置中心添加') return t('errors.videoModelRequired')
  } else if (msg.length <= 40 && CJK_RE.test(msg) && !TECHY_RE.test(msg)) return msg`],
]);
replace("frontend/nuxt.config.ts", [["title: '火宝短剧'", "title: 'Huobao Drama'"]]);
replace("backend/src/services/app-settings.ts", [
  ["['zh', 'en', 'ja', 'ko'] as const", "['zh', 'en', 'ja', 'ko', 'vi'] as const"],
  ["? row.value : 'zh'", "? row.value : 'vi'"],
]);
replace("backend/src/agents/language.ts", [["  en: 'English',", "  vi: 'Tiếng Việt (Vietnamese)',\n  en: 'English',"]]);
replace("backend/src/routes/episodes.ts", [
  ["import { getActiveConfigId } from '../services/ai.js'",
    "import { getActiveConfigId } from '../services/ai.js'\nimport { getContentLanguage } from '../services/app-settings.js'"],
  ["title: body.title || `第${nextNum}集`,",
    "title: body.title || (getContentLanguage() === 'vi' ? `Tập ${nextNum}` : `第${nextNum}集`),"],
]);
