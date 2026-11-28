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
const additionalKeys = new Set([
  "settings.general.langNameVi", "errors.imageModelRequired", "errors.videoModelRequired", "errors.macFlowModels", "errors.macFlowImages",
  "common.seconds", "settings.cfg.tempLabel", "settings.cfg.reached", "settings.cfg.testDetails", "settings.cfg.testNotReached",
  "settings.cfg.keyLabel", "settings.cfg.addressLabel",
  "settings.agents.promptLabel", "settings.agents.skillsLabel", "detail.ep.label",
  "settings.cfg.testKey", "settings.agents.skillNames.rewrite", "settings.agents.skillNames.extract", "settings.agents.skillNames.storyboard",
  "settings.agents.skillNames.character", "settings.agents.skillNames.scene", "settings.agents.skillNames.prop", "settings.agents.skillNames.video",
]);
const vietnamese = {};
for (const [key, text] of Object.entries(dictionaries)) {
  const parts = key.split(".");
  const field = parts.pop();
  const original = parts.reduce((value, part) => value?.[part], english)?.[field];
  if (typeof original !== "string" && !additionalKeys.has(key)) throw new Error(`Unknown Huobao translation key: ${key}`);
  const placeholders = value => (value?.match(/\{\w+\}/g) ?? []).sort().join(",");
  if (typeof original === "string" && placeholders(original) !== placeholders(text)) throw new Error(`Huobao translation placeholders changed: ${key}`);
  const target = parts.reduce((value, part) => value[part] ??= {}, vietnamese);
  target[field] = text;
}
function requireTranslation(dictionary, keys = []) {
  for (const [key, value] of Object.entries(dictionary)) {
    const path = [...keys, key];
    if (typeof value === "object") requireTranslation(value, path);
    else if (!dictionaries[path.join(".")]?.trim()) throw new Error(`Missing Huobao Vietnamese label: ${path.join(".")}`);
  }
}
requireTranslation(english);

const templateFiles = {
  "prompts/script_rewriter.vi.md": "scriptRewriter",
  "prompts/extractor.vi.md": "extractor",
  "prompts/storyboard_breaker.vi.md": "storyboardBreaker",
  "prompts/prompt_generator.vi.md": "promptGenerator",
  "skills/script-rewriter/SKILL.vi.md": "rewriteSkill",
  "skills/extractor/SKILL.vi.md": "extractSkill",
  "skills/storyboard-breaker/SKILL.vi.md": "storyboardSkill",
  "skills/prompt-generator/character-prompt/SKILL.vi.md": "characterSkill",
  "skills/prompt-generator/scene-prompt/SKILL.vi.md": "sceneSkill",
  "skills/prompt-generator/prop-prompt/SKILL.vi.md": "propSkill",
  "skills/prompt-generator/video-prompt/SKILL.vi.md": "videoSkill",
};
const templates = Object.entries(templateFiles).map(([path, name]) => [path, readFileSync(join(__dirname, "vietnameseContent", `${name}.md`), "utf8")]);
writeFileSync(join(root, "backend/src/agents/vietnameseTemplates.ts"), `const templates = new Map<string, string>(${JSON.stringify(templates, null, 2)});\nexport const vietnameseTemplate = (path: string) => templates.get(path);\n`);

const schema = readFileSync(join(root, "backend/src/db/sqlite-schema.ts"), "utf8");
const styles = [...schema.matchAll(/^    name: '[^']+', value: '([^']+)', sortOrder: \d+,\n    prompt: '([^']+)',/gm)].map(([, key, prompt]) => [key, prompt]);
if (styles.length !== 8) throw new Error("Huobao default style prompts changed");
writeFileSync(join(root, "frontend/app/composables/originalStylePrompts.ts"), `export const originalStylePrompts = new Map<string, string>(${JSON.stringify(styles, null, 2)});\n`);
copyFileSync(join(__dirname, "vietnameseErrors.ts"), join(root, "frontend/app/composables/vietnameseErrors.ts"));
writeFileSync(join(localeRoot, "vi.json"), JSON.stringify(vietnamese, null, 2) + "\n");
replace("frontend/app/composables/i18n.ts", [
  ["import ko from '../locales/ko.json'", "import ko from '../locales/ko.json'\nimport vi from '../locales/vi.json'"],
  ["'zh' | 'en' | 'ja' | 'ko'", "'zh' | 'en' | 'ja' | 'ko' | 'vi'"],
  ["  { value: 'zh', label: '中文' },", "  { value: 'vi', label: 'Tiếng Việt' },\n  { value: 'zh', label: '中文' },"],
  ["  return 'zh'", "  return 'vi'"],
  ["  fallbackLocale: 'zh',", "  fallbackLocale: 'en',"],
  ["messages: { zh, en, ja, ko }", "messages: { zh, en, ja, ko, vi }"],
]);
copyFileSync(join(__dirname, "useUnifiedLanguage.ts"), join(root, "frontend/app/composables/useUnifiedLanguage.ts"));
replace("frontend/app/pages/settings.vue", [
  ["  { value: 'ko', label: '한국어', shortLabel: '한국어' },",
    "  { value: 'ko', label: '한국어', shortLabel: '한국어' },\n  { value: 'vi', label: 'Tiếng Việt', shortLabel: 'Tiếng Việt' },"],
  ["import { useI18n } from 'vue-i18n'",
    "import { useI18n } from 'vue-i18n'\nimport { stylePresetName, stylePresetDescription, stylePresetPrompt } from '~/composables/stylePresetLocale'"],
  ["{{ p.name }}</span>", "{{ stylePresetName(p.value, p.name) }}</span>"],
  ["{{ p.description }}</div>", "{{ stylePresetDescription(p) }}</div>"],
  ["{{ p.prompt }}</div>", "{{ stylePresetPrompt(p) }}</div>"],
  ["{ name: styleToDelete?.name }", "{ name: styleToDelete ? stylePresetName(styleToDelete.value, styleToDelete.name) : '' }"],
  ["    name: p.name,", "    name: stylePresetName(p.value, p.name),"],
  ["    description: p.description || '',", "    description: stylePresetDescription(p),"],
  ["    prompt: p.prompt,", "    prompt: stylePresetPrompt(p),"],
  ["    if (styleEditId.value) {\n      await stylePresetAPI.update", "    if (styleEditId.value) {\n      const original = stylePresets.value.find(p => p.id === styleEditId.value)\n      await stylePresetAPI.update"],
  ["        name: styleForm.name,", "        name: original && styleForm.name === stylePresetName(original.value, original.name) ? undefined : styleForm.name,"],
  ["        description: styleForm.description,", "        description: styleForm.description === stylePresetDescription(original) ? undefined : styleForm.description,"],
  ["        prompt: styleForm.prompt,", "        prompt: styleForm.prompt === stylePresetPrompt(original) ? undefined : styleForm.prompt,"],
  ["const providerPresets = {", "const officialLabel = (name) => locale.value === 'vi' ? `${name} chính thức` : `${name} 官方`\nconst providerPresets = computed(() => ({"],
  ["}\nconst huobaoQuickConfigs", "}))\nconst huobaoQuickConfigs"],
  ["const group = providerPresets[type]", "const group = providerPresets.value[type]"],
  ["const preset = providerPresets[type]", "const preset = providerPresets.value[type]"],
  ...["Gemini", "OpenAI", "Seedance 2.0", "MiniMax H3"].map(name =>
    [`label: '${name} 官方'`, `label: officialLabel('${name}')`]),
  ["label: '阿里云百炼 Wan 3.0'", "label: locale.value === 'vi' ? 'Alibaba Cloud · Wan 3.0' : '阿里云百炼 Wan 3.0'"],
  ['placeholder="Huobao API Key"', ':placeholder="t(\'settings.cfg.testKey\')"'],
  ['>API Key</span>', ">{{ t('settings.cfg.keyLabel') }}</span>"],
  ['>Base URL</span>', ">{{ t('settings.cfg.addressLabel') }}</span>"],
  ['>System Prompt', ">{{ t('settings.agents.promptLabel') }}"],
  ['Skills<template v-if="agentSkillCount', "{{ t('settings.agents.skillsLabel') }}<template v-if=\"agentSkillCount"],
  ['>Temperature <span', ">{{ t('settings.cfg.tempLabel') }} <span"],
  ["cfgTestResult.status || 'ERROR'", "cfgTestResult.status || t('errors.unknown')"],
  ['{{ cfgTestResult.message }}', `{{ cfgTestResult.ok ? t('settings.cfg.reached') : mapError(cfgTestResult.status ? String(cfgTestResult.status) : cfgTestResult.message, { fallback: 'settings.cfg.testNotReached' }) }}`],
  ['            <div class="mono test-result-url">{{ cfgTestResult.method }} {{ cfgTestResult.url }}</div>\n            <div v-if="cfgTestResult.response_preview" class="mono test-result-preview">{{ cfgTestResult.response_preview }}</div>', `            <details>
              <summary>{{ t('settings.cfg.testDetails') }}</summary>
              <div class="mono test-result-url">{{ cfgTestResult.method }} {{ cfgTestResult.url }}</div>
            </details>`],
  ['{{ updateState.error }}', '{{ mapError(updateState.error) }}'],
  ["import { toastError } from '~/composables/useToast'", "import { mapError, toastError } from '~/composables/useToast'"],
  ['{{ s.name }}', '{{ skillLabel(s) }}'],
  ["const selectedAgentType = computed(() => selectedAgent.value)", `const skillNames = new Map([
  ['script-rewriter', 'rewrite'], ['extractor', 'extract'], ['storyboard-breaker', 'storyboard'],
  ['prompt-generator/character-prompt', 'character'], ['prompt-generator/scene-prompt', 'scene'],
  ['prompt-generator/prop-prompt', 'prop'], ['prompt-generator/video-prompt', 'video'],
])
function skillLabel(skill) {
  const key = skillNames.get(skill.id)
  return locale.value === 'vi' && key && skill.name === skill.id.split('/').at(-1)
    ? t('settings.agents.skillNames.' + key) : skill.name
}

const selectedAgentType = computed(() => selectedAgent.value)`],
  ['.toLocaleString() })', ".toLocaleString(locale === 'zh' ? 'zh-CN' : locale) })"],
  ["const contentLanguage = ref('zh')", "const contentLanguage = ref(locale.value)"],
  ["(await settingsAPI.contentLanguage())?.language || 'zh'", "(await settingsAPI.contentLanguage())?.language || locale.value"],
  ["    contentLanguage.value = lang\n    editLang.value = lang  // Agent 编辑器默认跟随内容语言", "    contentLanguage.value = lang"],
  ...[["文本", "Văn bản"], ["图片", "Ảnh"], ["视频", "Video"]].map(([original, label]) => [
    `name: '火宝${original}服务 · `, `name: 'Huobao · ${label} · `,
  ]),
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
  ["{{ ep.title }}", "{{ episodeTitle(ep) }}"],
  ['class="ep-num-label">EP', 'class="ep-num-label">{{ t(\'detail.ep.label\') }}'],
  ["{{ ep.duration }}s", "{{ t('common.seconds', { n: ep.duration }) }}"],
  ["episodeToDelete?.title || t('detail.ep.episodeN', { n: episodeToDelete?.episode_number || episodeToDelete?.episodeNumber })", "episodeToDelete ? episodeTitle(episodeToDelete) : ''"],
  ["const { t, locale } = useI18n()", "const { t, locale } = useI18n()\nfunction episodeTitle(episode) {\n  const n = episode.episode_number ?? episode.episodeNumber\n  if (!episode.title || (locale.value === 'vi' && episode.title === '第' + n + '集')) return t('detail.ep.episodeN', { n })\n  return episode.title\n}"],
  ["uploadAPI } from '~/composables/useApi'", "uploadAPI, stylePresetAPI } from '~/composables/useApi'\nimport { stylePresetName } from '~/composables/stylePresetLocale'"],
  ["const drama = ref(null)", "const drama = ref(null)\nconst stylePresets = ref([])\nconst styleLabel = computed(() => {\n  const key = drama.value?.style\n  const preset = stylePresets.value.find(p => p.value === key)\n  return stylePresetName(key, preset?.name)\n})"],
  ["onMounted(load)", "onMounted(() => {\n  load()\n  stylePresetAPI.list(true).then(presets => { stylePresets.value = presets || [] }).catch(() => {})\n})"],
]);
replace("frontend/app/app.vue", [
  ["const { t } = useI18n()", "const { t, locale } = useI18n()"],
  ["useHead(() => ({ title: t('app.title') }))", "useHead(() => ({ title: t('app.title'), htmlAttrs: { lang: locale.value } }))"],
]);
replace("frontend/app/components/ModelSelect.vue", [
  ["const { t } = useI18n()", `const { t, locale } = useI18n()
const macFlowAliases = new Map([
  ['macflow-text', 'MacFlow · Văn bản'], ['gpt-image-macflow', 'MacFlow · Ảnh'],
  ['doubao-seedance-2-0-macflow', 'MacFlow · Video'],
])
function modelLabel(model) {
  return locale.value === 'vi' ? macFlowAliases.get(model) ?? model : model
}`],
  ["const effectiveDefaultLabel = computed(() => props.defaultLabel || t('common.default'))", `const effectiveDefaultLabel = computed(() => {
  const model = props.options[0]?.model
  return model && macFlowAliases.has(model) && locale.value === 'vi'
    ? t('episode.model.defaultWith', { model: modelLabel(model) }) : props.defaultLabel || t('common.default')
})`],
  ["currentOption.value?.model || effectiveDefaultLabel.value", "currentOption.value ? modelLabel(currentOption.value.model) : effectiveDefaultLabel.value"],
  ['{{ o.model }}', '{{ modelLabel(o.model) }}'],
  ['${o.model}${o.configName', '${modelLabel(o.model)}${o.configName'],
]);
replace("frontend/app/pages/index.vue", [
  ["localeCompare(String(b.title || ''), 'zh-CN')", "localeCompare(String(b.title || ''), locale.value === 'zh' ? 'zh-CN' : locale.value)"],
]);
replace("frontend/app/views/drama/episode.vue", [
  ...["task.duration", "selectedSb.duration", "m.duration", "sb.duration", "previewShot.duration", "activeMerge.duration"].map(field => [
    `{{ ${field} }}s`, `{{ t('common.seconds', { n: ${field} }) }}`,
  ]),
  [':title="task.error"', ':title="videoErrorLabel(task.id, task.error)"'],
  [':title="m.status === \'failed\' ? m.error_msg : null"', ':title="m.status === \'failed\' ? mapError(m.error_msg, { fallback: \'episode.export.mergeFailed\' }) : null"'],
  [':title="row.errorMsg"', ':title="mapError(row.errorMsg)"'],
  ["t.error_msg || 'Task failed'", "t.error_msg || mapError(null)"],
  ["['旁白', '画外音', 'narrator'", "['thuyết minh', 'lời dẫn', '旁白', '画外音', 'narrator'"],
  ["return prompt.replace(/@([^\\s@#]+)/g, (m, raw) => {", "return prompt.replace(/@([^@#]+)/g, (m, raw) => {"],
]);
replace("frontend/app/composables/useMigrateState.ts", [
  ["state.message = p.message || phaseText(p.phase)", "state.message = i18n.global.locale.value === 'vi' ? phaseText(p.phase) : p.message || phaseText(p.phase)"],
]);
replace("frontend/app/composables/useToast.ts", [
  ["import { i18n } from '~/composables/i18n'", "import { i18n } from '~/composables/i18n'\nimport { vietnameseError } from '~/composables/vietnameseErrors'"],
  ["  if (NETWORK_RE.test(msg))", "  const vi = i18n.global.locale.value === 'vi'\n  const translation = vi ? vietnameseError(msg) : undefined\n  if (translation) return translation\n  if (NETWORK_RE.test(msg))"],
  ["  if (msg.length <= 40 && CJK_RE.test(msg) && !TECHY_RE.test(msg)) return msg",
    `  if (vi) {
    if (msg === '未找到启用的图片生成配置，请先在设置中心添加') return t('errors.imageModelRequired')
    if (msg === '未找到启用的视频生成配置，请先在设置中心添加') return t('errors.videoModelRequired')
    if (msg.length <= 240 && !CJK_RE.test(msg) && !TECHY_RE.test(msg) && /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/i.test(msg)) return msg
  } else if (msg.length <= 40 && CJK_RE.test(msg) && !TECHY_RE.test(msg)) return msg`],
]);
replace("frontend/nuxt.config.ts", [["title: '火宝短剧'", "title: 'Huobao Drama'"]]);
replace("backend/src/services/app-settings.ts", [
  ["['zh', 'en', 'ja', 'ko'] as const", "['zh', 'en', 'ja', 'ko', 'vi'] as const"],
  ["? row.value : 'zh'", "? row.value : 'vi'"],
]);
replace("backend/src/agents/language.ts", [["  en: 'English',", "  vi: 'Tiếng Việt (Vietnamese)',\n  en: 'English',"]]);
replace("backend/src/agents/voice-reference-instructions.ts", [
  ['  en: `## Character voice references in video_prompt', `  vi: \`## Giọng tham chiếu trong video_prompt
- Dùng has_voice và voice_reference từ read_storyboard_context. Khi viết lại cảnh có sẵn, chỉ dùng giọng trong available_voice_references. Khi chia lần đầu, chỉ dùng giọng của nhân vật trong character_ids ở cảnh đó.
- Ghi đúng giọng ngay cạnh mỗi lượt nói trong khoảng thời gian tương ứng, kể cả khi một người nói nhiều lần hoặc nhiều người đối đáp. Không gom giọng lên đầu.
- Sao chép nguyên văn voice_reference, ví dụ #Minh. @Tên dùng cho ảnh, #Tên dùng cho giọng. Không dịch tên, rút gọn hoặc thêm hậu tố.
- Bỏ tham chiếu nếu nhân vật im lặng, chưa gắn vào cảnh hoặc thiếu tệp giọng. Lời thuyết minh chỉ dùng giọng khi kịch bản nêu rõ người nói là nhân vật đã gắn và có giọng.
- Giữ nguyên lời thoại và thời điểm trong description. Giọng mẫu chỉ cung cấp âm sắc. Không thêm lời, người hoặc cảnh quay chỉ để dùng giọng.
- Trước khi lưu, kiểm tra người nói khớp với ảnh và giọng. Giữ thẻ #Tên để hệ thống tự nối tệp âm thanh.\`,
  en: \`## Character voice references in video_prompt`],
]);
replace("backend/src/agents/prompts.ts", [
  ["import { skillsManagerWorkspace } from './skills.js'", "import { skillsManagerWorkspace } from './skills.js'\nimport { vietnameseTemplate } from './vietnameseTemplates.js'"],
  ["  if (!localized) return base\n  return { ...localized, model: base?.model || '' }",
    "  const builtin = lang === 'vi' ? vietnameseTemplate(promptFilePath(agentType, lang)) : undefined\n  const translated = localized ?? (builtin ? parsePromptFile(builtin) : null)\n  if (!translated) return base\n  return { ...translated, model: base?.model || '' }"],
]);
replace("backend/src/routes/prompts.ts", [
  ["const LANGS = ['zh', 'en', 'ja', 'ko']", "import { vietnameseTemplate } from '../agents/vietnameseTemplates.js'\nconst LANGS = ['zh', 'en', 'ja', 'ko', 'vi']"],
  ["  const variantExists = lang !== 'zh' && await fsm().exists(promptFilePath(type, lang))",
    "  const variantPath = promptFilePath(type, lang)\n  const variantExists = lang !== 'zh' && (await fsm().exists(variantPath) || (lang === 'vi' && Boolean(vietnameseTemplate(variantPath))))"],
  ["name: base?.name || file.name || DEFAULT_PROMPTS[type].name,", "name: lang === 'vi' && variantExists ? file.name : base?.name || file.name || DEFAULT_PROMPTS[type].name,"],
]);
replace("backend/src/agents/skills.ts", [
  ["import fs from 'fs'", "import fs from 'fs'\nimport { vietnameseTemplate } from './vietnameseTemplates.js'"],
  ["    if (!await fsm.exists(p)) return null\n    const body = stripFrontmatter(String(await fsm.readFile(p, { encoding: 'utf-8' })))",
    "    const raw = await fsm.exists(p) ? String(await fsm.readFile(p, { encoding: 'utf-8' })) : lang === 'vi' ? vietnameseTemplate(p) : undefined\n    const body = raw ? stripFrontmatter(raw) : ''"],
]);
replace("backend/src/routes/skills.ts", [
  ["const LANGS = ['zh', 'en', 'ja', 'ko']", "import { vietnameseTemplate } from '../agents/vietnameseTemplates.js'\nconst LANGS = ['zh', 'en', 'ja', 'ko', 'vi']"],
  ["// GET /skills?lang=", `async function localizedSkill(id: string, lang: string) {
  if (lang === 'zh') return undefined
  const path = skillFile(id, lang)
  if (await fsm().exists(path)) return String(await fsm().readFile(path, { encoding: 'utf-8' }))
  if (lang === 'vi') return vietnameseTemplate(path)
}

// GET /skills?lang=`],
  ["    if (lang !== 'zh' && await fsm().exists(skillFile(id, lang))) {\n      const raw = String(await fsm().readFile(skillFile(id, lang), { encoding: 'utf-8' }))",
    "    const raw = await localizedSkill(id, lang)\n    if (raw !== undefined) {"],
  ["  const variantExists = lang !== 'zh' && await fsm().exists(skillFile(id, lang))\n  const content = await fsm().readFile(skillFile(id, variantExists ? lang : undefined), { encoding: 'utf-8' })\n  return success(c, { id, lang, content, is_default: lang !== 'zh' && !variantExists })",
    "  const localized = await localizedSkill(id, lang)\n  const content = localized ?? await fsm().readFile(skillFile(id), { encoding: 'utf-8' })\n  return success(c, { id, lang, content, is_default: lang !== 'zh' && localized === undefined })"],
  ["Write your skill content here.", "Viết nội dung hướng dẫn tại đây."],
]);
replace("backend/src/routes/episodes.ts", [
  ["import { getActiveConfigId } from '../services/ai.js'",
    "import { getActiveConfigId } from '../services/ai.js'\nimport { getContentLanguage } from '../services/app-settings.js'"],
  ["title: body.title || `第${nextNum}集`,",
    "title: body.title || (getContentLanguage() === 'vi' ? `Tập ${nextNum}` : `第${nextNum}集`),"],
]);
