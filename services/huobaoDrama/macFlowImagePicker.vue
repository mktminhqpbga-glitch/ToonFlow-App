<template>
  <dialog ref="dialog" class="imagePicker" aria-labelledby="macFlowImageTitle" @cancel.prevent="close">
    <header class="pickerActions">
      <h3 id="macFlowImageTitle">Chọn ảnh</h3>
      <button type="button" class="btn" :disabled="busy" @click="close">Đóng</button>
    </header>
    <div class="pickerActions">
      <button type="button" class="btn" :disabled="busy" @click="localInput?.click()">Tải ảnh từ máy</button>
      <input ref="localInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="useLocal" />
      <button type="button" class="btn" :disabled="busy || loading" :aria-expanded="opened" @click="openLibrary">Chọn từ Kho MacFlow</button>
    </div>
    <section v-if="opened" class="imageLibrary" aria-label="Kho MacFlow">
      <div v-if="folder" class="pickerActions">
        <button type="button" class="btn btn-sm" :disabled="busy || loading" @click="load(folder.split('/').slice(0, -1).join('/'))">Thư mục trên</button>
        <span>{{ folder }}</span>
      </div>
      <div v-if="items.length" class="imageChoices">
        <button v-for="item in items" :key="item.path" type="button" class="btn" :disabled="busy || loading"
          :aria-pressed="item.type === 'file' ? selected === item.path : undefined" @click="choose(item)">
          <span v-if="item.type === 'directory'" aria-hidden="true">📁 </span>{{ item.name }}
        </button>
      </div>
      <p v-else-if="!loading && !issue && !cursor" role="status">Thư mục này chưa có ảnh.</p>
      <button v-if="cursor" type="button" class="btn btn-sm" :disabled="busy || loading" @click="load(folder, cursor)">Xem thêm</button>
      <p v-if="loading" role="status">Đang mở kho ảnh…</p>
      <p v-if="issue" role="alert">{{ issue }}</p>
      <div v-if="selected" class="selectionPreview">
        <img v-if="!previewFailed" :key="selected" :src="'/api/v1/macFlow/image?path=' + encodeURIComponent(selected)"
          :alt="selected.split('/').at(-1)" @error="previewFailed = true" />
        <p v-else role="alert">Chưa xem được ảnh này.</p>
        <button type="button" class="btn btn-primary" :disabled="busy || previewFailed" @click="emit('use', selected)">
          {{ busy ? 'Đang dùng ảnh…' : 'Dùng ảnh này' }}
        </button>
      </div>
    </section>
  </dialog>
</template>

<script setup lang="ts">
import { api } from '~/composables/useApi'

type Entry = { path: string; name: string; type: 'directory' | 'file' }
const props = defineProps<{ busy: boolean }>()
const emit = defineEmits<{ close: []; local: [File]; use: [string] }>()
const dialog = ref<HTMLDialogElement>()
const localInput = ref<HTMLInputElement>()
const loading = ref(false)
const opened = ref(false)
const issue = ref('')
const folder = ref('')
const selected = ref('')
const cursor = ref('')
const previewFailed = ref(false)
const items = ref<Entry[]>([])

onMounted(() => dialog.value?.showModal())
function close() { if (!props.busy) emit('close') }
function useLocal(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('local', file)
}
function openLibrary() {
  opened.value = true
  if (!items.value.length) void load(folder.value)
}
function choose(item: Entry) {
  if (item.type === 'directory') { void load(item.path); return }
  previewFailed.value = false
  selected.value = item.path
}
async function load(path: string, next?: string) {
  if (loading.value || props.busy) return
  loading.value = true
  issue.value = ''
  const query = new URLSearchParams()
  if (path) query.set('path', path)
  if (next) query.set('cursor', next)
  try {
    const result = await api.get<{ items: Entry[]; nextCursor?: string }>('/macFlow/images?' + query)
    items.value = next ? [...items.value, ...result.items] : result.items
    folder.value = path
    cursor.value = result.nextCursor ?? ''
    if (!next) selected.value = ''
  } catch (error) {
    if (next) cursor.value = ''
    issue.value = error instanceof Error ? error.message : 'Chưa mở được kho ảnh MacFlow.'
  } finally { loading.value = false }
}
</script>

<style scoped>
.imagePicker { width: min(580px, calc(100vw - 26px)); max-height: 85dvh; overflow: auto; padding: 18px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg-base); color: var(--text-0); }
.imagePicker::backdrop { background: rgb(0 0 0 / 62%); }
.imagePicker h3, .imagePicker p { margin: 0; }
.pickerActions { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.imageLibrary, .imageChoices, .selectionPreview { display: grid; gap: 8px; }
.imageChoices { max-height: 26vh; overflow: auto; }
.imageChoices button { justify-content: start; overflow-wrap: anywhere; white-space: normal; }
.imageChoices button[aria-pressed='true'] { border-color: var(--accent); }
.selectionPreview { justify-items: start; }
.selectionPreview img { display: block; max-width: 100%; max-height: 180px; object-fit: contain; }
</style>
