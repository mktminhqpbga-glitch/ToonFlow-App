<template>
  <section class="card macFlowModels" aria-label="Mô hình từ MacFlow">
    <header class="modelHeader">
      <div>
        <h3>Mô hình từ MacFlow</h3>
        <p>Chọn các mô hình đã cài trong MacFlow để làm phim.</p>
      </div>
      <button type="button" class="btn btn-sm" :disabled="busy" @click="load">Tải lại danh sách</button>
    </header>
    <div v-if="catalog" class="modelFields">
      <label v-for="service in services" :key="service.type">
        <span>{{ service.label }}</span>
        <select v-model="choices[service.type]" :disabled="busy">
          <option value="">{{ catalog[service.type].length ? 'Chọn mô hình' : 'MacFlow chưa có mô hình phù hợp' }}</option>
          <option v-if="missing(service.type)" :value="choices[service.type]" disabled>Mô hình đã lưu không còn khả dụng</option>
          <option v-for="model in catalog[service.type]" :key="modelKey(model)" :value="modelKey(model)">
            {{ model.label }} · {{ model.providerLabel }}
          </option>
        </select>
      </label>
    </div>
    <div class="modelActions">
      <button type="button" class="btn btn-primary" :disabled="busy || !catalog || !Object.values(choices).some(Boolean) || services.some(service => missing(service.type))" @click="save">
        {{ saving ? 'Đang lưu…' : 'Lưu mô hình' }}
      </button>
      <p v-if="issue" class="modelError" role="alert">{{ issue }}</p>
      <p v-else-if="message || loading" role="status">{{ message || 'Đang lấy mô hình từ MacFlow…' }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { api } from '~/composables/useApi'

type Service = 'text' | 'image' | 'video'
type Selection = { providerId: string; modelId: string }
type Model = Selection & { label: string; providerLabel: string }
type Catalog = Record<Service, Model[]> & { selected: Record<Service, Selection | null> }
const services = [
  { type: 'text', label: 'Viết kịch bản' },
  { type: 'image', label: 'Tạo ảnh' },
  { type: 'video', label: 'Tạo video' },
] as const
const emit = defineEmits<{ saved: [] }>()
const catalog = ref<Catalog>()
const choices = reactive<Record<Service, string>>({ text: '', image: '', video: '' })
const loading = ref(false)
const saving = ref(false)
const busy = computed(() => loading.value || saving.value)
const issue = ref('')
const message = ref('')
const modelKey = (model: Selection) => JSON.stringify([model.providerId, model.modelId])

function missing(service: Service) {
  return !!choices[service] && !catalog.value?.[service].some(model => modelKey(model) === choices[service])
}

async function load() {
  if (busy.value) return
  loading.value = true
  issue.value = message.value = ''
  try {
    const data = await api.get<Catalog>('/macFlow/models')
    catalog.value = data
    for (const { type } of services) {
      const current = data.selected[type]
      choices[type] = current ? modelKey(current) : ''
    }
  } catch (error) { issue.value = error instanceof Error ? error.message : 'Chưa tải được mô hình từ MacFlow.' }
  finally { loading.value = false }
}

async function save() {
  if (busy.value || !catalog.value) return
  const selected = Object.fromEntries(services.map(({ type }) => {
    const model = catalog.value?.[type].find(item => modelKey(item) === choices[type])
    return [type, model ? { providerId: model.providerId, modelId: model.modelId } : null]
  }))
  saving.value = true
  issue.value = message.value = ''
  try {
    await api.post('/macFlow/configure', selected)
    message.value = 'Đã lưu. Các tập mới dùng mô hình MacFlow đã chọn.'
    emit('saved')
  } catch (error) { issue.value = error instanceof Error ? error.message : 'Chưa lưu được mô hình. Hãy thử lại.' }
  finally { saving.value = false }
}

onMounted(load)
</script>

<style scoped>
.macFlowModels { display: grid; gap: 14px; padding: 16px; margin-bottom: 16px; }
.modelHeader, .modelActions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.modelHeader { justify-content: space-between; }
.modelHeader h3, .modelHeader p, .modelActions p { margin: 0; }
.modelHeader p { color: var(--text-2); }
.modelFields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 12px; }
.modelFields label { min-width: 0; display: grid; gap: 5px; }
.modelFields select { padding: 8px; color: var(--text-0); background: var(--bg-base); border: 1px solid var(--border); border-radius: 6px; width: 100%; }
.modelActions .modelError { color: var(--error); }
</style>
