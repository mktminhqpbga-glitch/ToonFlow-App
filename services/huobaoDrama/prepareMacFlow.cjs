const { copyFileSync, readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const root = process.argv[2]
if (!root) throw new Error('Usage: node prepareMacFlow.cjs <Huobao source directory>')

function replace(path, rules) {
  const file = join(root, path)
  let source = readFileSync(file, 'utf8')
  for (const [before, after] of rules) {
    if (source.includes(after)) continue
    if (!(before instanceof RegExp ? before.test(source) : source.includes(before))) throw new Error(`Huobao integration changed in ${path}: ${before}`)
    source = source.replace(before, after)
  }
  writeFileSync(file, source)
}

for (const file of ['macFlowModels.vue', 'macFlowImagePicker.vue']) {
  copyFileSync(join(__dirname, file), join(root, 'frontend/app/components', file))
}
copyFileSync(join(__dirname, 'macFlowRoutes.ts'), join(root, 'backend/src/routes/macFlow.ts'))

replace('backend/src/index.ts', [
  ["import serverUpdate from './routes/serverUpdate.js'", "import serverUpdate from './routes/serverUpdate.js'\nimport macFlow from './routes/macFlow.js'"],
  ["api.route('/server-update', serverUpdate)", "api.route('/server-update', serverUpdate)\napi.route('/macFlow', macFlow)"],
])
replace('backend/src/routes/aiConfigs.ts', [
  ['function withParsedFields(r: any) {\n  return {', `function withParsedFields(r: any) {
  const macFlowManaged = typeof r.baseUrl === 'string' && r.baseUrl.endsWith('/api/huobao/bridge')
  return {`],
  ['    ...toSnakeCase(r),', "    ...toSnakeCase(r),\n    ...(macFlowManaged ? { api_key: '' } : {}),"],
])
replace('frontend/app/pages/settings.vue', [
  ["import BaseSelect from '~/components/BaseSelect.vue'", "import BaseSelect from '~/components/BaseSelect.vue'\nimport macFlowModels from '~/components/macFlowModels.vue'"],
  ['          <section class="card quick-card">', '          <macFlowModels @saved="loadCfgs" />\n          <details class="serviceOptions">\n            <summary>Dịch vụ AI khác</summary>\n          <section class="card quick-card">'],
  ['          </div>\n        </div>\n\n        <!-- ===== 风格预设 ===== -->', '          </div>\n          </details>\n        </div>\n\n        <!-- ===== 风格预设 ===== -->'],
  ['function byType(t) { return cfgs.value.filter(c => c.service_type === t) }', "function byType(t) { return cfgs.value.filter(c => c.service_type === t && !c.base_url?.endsWith('/api/huobao/bridge')) }"],
  ['<style scoped>\n', '<style scoped>\n.serviceOptions > summary { padding: 10px 0; cursor: pointer; }\n'],
])
replace('frontend/app/layouts/default.vue', [
  ['      <div class="header-left">', '      <div class="header-left">\n        <a v-if="macFlowHome" :href="macFlowHome" class="nav-link">← MacFlow</a>'],
  ["import { aiConfigAPI } from '~/composables/useApi'", "import { api, aiConfigAPI } from '~/composables/useApi'"],
  ['const showBrandImage = ref(true)', 'const showBrandImage = ref(true)\nconst macFlowHome = ref(\'\')\nonMounted(async () => {\n  try { macFlowHome.value = new URL(\'/#/home\', (await api.get(\'/macFlow/info\')).macFlowUrl).href } catch { /* Huobao can open independently. */ }\n})'],
])
replace('frontend/app/views/drama/episode.vue', [
  ["import LocaleSwitcher from '~/components/LocaleSwitcher.vue'", "import LocaleSwitcher from '~/components/LocaleSwitcher.vue'\nimport macFlowImagePicker from '~/components/macFlowImagePicker.vue'"],
  ['      <ConfirmDialog\n        :open="assetDelete.open"', `      <macFlowImagePicker v-if="assetImageTarget" :busy="isUploadingAsset(assetImageTarget.kind, assetImageTarget.id)"
        @close="assetImageTarget = null" @local="file => saveAssetImage(() => uploadAPI.image(file))"
        @use="assetPath => saveAssetImage(() => api.post('/macFlow/useImage', { assetPath }))" />
      <ConfirmDialog
        :open="assetDelete.open"`],
  [/^function pickFile\(accept, cb\) \{[\s\S]*?^}/m, 'const assetImageTarget = ref(null)'],
  [/^function uploadAssetImage\(kind, id\) \{[\s\S]*?^}/m, `function uploadAssetImage(kind, id) {
  if (!isUploadingAsset(kind, id)) assetImageTarget.value = { kind, id }
}

async function saveAssetImage(upload) {
  const target = assetImageTarget.value
  if (!target || isUploadingAsset(target.kind, target.id)) return
  const { kind, id } = target
  const key = kind + ':' + id
  uploadingAssetKeys.value.push(key)
  try {
    const res = await upload()
    const payload = { image_url: res.path, local_path: res.path }
    if (kind === 'character') await characterAPI.update(id, payload)
    else if (kind === 'scene') await sceneAPI.update(id, payload)
    else await propAPI.update(id, payload)
    assetImageTarget.value = null
    toast.success(t('episode.upload.assetDone', { type: assetUploadLabelMap.value[kind] || '' }))
    await refresh()
  } catch (error) {
    toastError(error)
  } finally {
    uploadingAssetKeys.value = uploadingAssetKeys.value.filter(k => k !== key)
  }
}`],
])
