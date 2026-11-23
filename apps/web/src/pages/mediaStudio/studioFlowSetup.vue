<template>
  <el-dialog :modelValue="modelValue" title="Thiết lập luồng" width="min(1060px, calc(100vw - 24px))" top="min(8vh, 64px)" appendToBody
    class="studioFlowDialog" :beforeClose="requestClose" :closeOnClickModal="false" @update:modelValue="emit('update:modelValue', $event)">
    <div class="flowSetup">
      <div class="libraryBar">
        <label class="flowField">
          <span>Mẫu trong dự án</span>
          <el-select :modelValue="savedTemplate?.id ?? ''" :disabled="busy || !templates.length" placeholder="Chưa chọn mẫu đã lưu" @change="openTemplate">
            <el-option v-for="template in templates" :key="template.id" :value="template.id" :label="templateLabel(template)" />
          </el-select>
        </label>
        <el-dropdown trigger="click" :disabled="busy" @command="openStarter">
          <el-button :icon="IconPlus" :disabled="busy">Mẫu mới</el-button>
          <template #dropdown><el-dropdown-menu>
            <el-dropdown-item command="image">Mẫu tạo ảnh</el-dropdown-item>
            <el-dropdown-item command="video">Mẫu tạo video</el-dropdown-item>
          </el-dropdown-menu></template>
        </el-dropdown>
        <label class="flowField flowName">
          <span>Tên mẫu</span>
          <input v-model="draft.name" :disabled="busy" placeholder="Ví dụ: Video giới thiệu sản phẩm" />
        </label>
      </div>

      <div v-if="loadError" class="flowNotice" role="alert">
        <p>{{ loadError }}</p>
        <el-button size="small" :loading="loading" @click="loadLibrary">Tải lại thư viện</el-button>
      </div>

      <div class="flowBoard">
        <section class="stepRail" aria-label="Thứ tự các bước">
          <h3>Thứ tự các bước</h3>
          <ol class="stepList">
            <li class="stepCard endpoint"><span class="stepIndex">A</span><span><strong>Đầu vào</strong><small>Ý tưởng, sản phẩm và tư liệu</small></span></li>
            <li v-for="(step, index) in draft.steps" :key="step.id" class="stepCard"
              :class="{ selected: selectedId === step.id, dragging: draggedId === step.id, dropBefore: dropTarget?.id === step.id && !dropTarget.after, dropAfter: dropTarget?.id === step.id && dropTarget.after }"
              @dragover="previewDrop($event, step.id)" @drop="dropStep($event, step.id)">
              <span class="dragHandle" :draggable="!busy" title="Kéo để đổi thứ tự" @dragstart="startDrag($event, step.id)" @dragend="endDrag">
                <icon-grip-vertical :size="17" aria-hidden="true" />
              </span>
              <button class="stepChoice" type="button" :disabled="busy" :aria-pressed="selectedId === step.id" @click="selectedId = step.id">
                <span class="stepIndex">{{ index + 1 }}</span>
                <span class="stepName"><strong>{{ step.name || "Bước chưa đặt tên" }}</strong><small>{{ kindLabels[step.kind] }}</small></span>
                <icon-alert-circle v-if="issues.steps.has(step.id)" class="stepWarning" :size="17" aria-label="Bước cần kiểm tra" />
              </button>
              <div class="stepMoves">
                <button type="button" :aria-label="`Đưa ${step.name || 'bước này'} lên trước`" title="Đưa lên trước" :disabled="busy || index === 0" @click="moveStep(index, index - 1)"><icon-chevron-up :size="15" /></button>
                <button type="button" :aria-label="`Đưa ${step.name || 'bước này'} xuống sau`" title="Đưa xuống sau" :disabled="busy || index === draft.steps.length - 1" @click="moveStep(index, index + 1)"><icon-chevron-down :size="15" /></button>
              </div>
            </li>
            <li class="stepCard endpoint"><span class="stepIndex">Z</span><span><strong>Kết quả</strong><small>{{ finalStep && finalStep.kind !== "text" ? `Nhận ${kindLabels[finalStep.kind].toLowerCase()} từ bước cuối` : "Chờ bước tạo ảnh hoặc video" }}</small></span></li>
          </ol>
          <el-dropdown trigger="click" :disabled="busy" @command="addStep">
            <el-button class="addStepButton" :icon="IconPlus" :disabled="busy">Thêm bước</el-button>
            <template #dropdown><el-dropdown-menu>
              <el-dropdown-item v-for="kind in stepKinds" :key="kind" :command="kind">{{ kindLabels[kind] }}</el-dropdown-item>
            </el-dropdown-menu></template>
          </el-dropdown>
        </section>

        <section class="stepEditor" aria-label="Cấu hình bước">
          <fieldset v-if="selectedStep" :key="selectedStep.id" class="editorFields" :disabled="busy">
            <div class="editorHeading">
              <h3>Chỉnh bước {{ selectedIndex + 1 }}</h3>
              <el-button text type="danger" :icon="IconTrash" :disabled="busy" @click="removeStep">Bỏ bước</el-button>
            </div>
            <div class="fieldPair">
              <label class="flowField"><span>Tên bước</span><input v-model="selectedStep.name" placeholder="Ví dụ: Tạo khung hình đầu" /></label>
              <label class="flowField"><span>Loại đầu ra</span>
                <select v-model="selectedStep.kind" @change="resetModel"><option v-for="kind in stepKinds" :key="kind" :value="kind">{{ kindLabels[kind] }}</option></select>
              </label>
            </div>
            <label class="flowField"><span>Prompt của bước</span><textarea ref="promptInput" v-model="selectedStep.prompt" rows="5" placeholder="Viết yêu cầu sẽ gửi tới mô hình…" /></label>
            <div v-if="textSources.length" class="tokenBar">
              <span>Chèn vào prompt</span>
              <button v-for="source in textSources" :key="source.id" class="tokenButton" type="button" @click="insertSource(source.id)">{{ source.label }}</button>
            </div>

            <details class="sourcePanel" open>
              <summary>Dữ liệu đưa vào <span>{{ selectedStep.sources.length }} nguồn</span></summary>
              <div class="sourceGroup">
                <strong>Từ Đầu vào A</strong>
                <label v-for="source in flowInputs" :key="source.id"><input v-model="selectedStep.sources" type="checkbox" :value="source.id" /> {{ source.label }}</label>
              </div>
              <div v-if="priorSources.length || unavailableSources.length" class="sourceGroup">
                <strong>Từ các bước trong luồng</strong>
                <label v-for="source in priorSources" :key="source.id"><input v-model="selectedStep.sources" type="checkbox" :value="source.id" /> {{ source.label }}</label>
                <label v-for="source in unavailableSources" :key="source.id" class="stepWarning">
                  <input v-model="selectedStep.sources" type="checkbox" :value="source.id" /> {{ source.label }}
                </label>
              </div>
            </details>

            <label class="flowField"><span>Mô hình cho bước này</span>
              <select v-model="selectedStep.model" @change="selectedStep.options = {}">
                <option value="">Chọn sau</option>
                <option v-if="selectedStep.model && !modelOptions.some(item => item.key === selectedStep?.model)" :value="selectedStep.model">Mô hình đã lưu · hiện không có trong danh sách</option>
                <option v-for="item in modelOptions" :key="item.key" :value="item.key">{{ item.label }}</option>
              </select>
            </label>
            <p v-if="selectedStep.kind === 'text' && modelError" class="flowHint" role="status">{{ modelError }}</p>
            <div v-if="ratios.length || sizes.length || durations.length || resolutions.length" class="fieldPair">
              <label v-if="ratios.length" class="flowField"><span>Tỷ lệ khung hình</span>
                <select v-model="selectedStep.options.ratio"><option :value="undefined">Mặc định</option><option v-for="value in ratios" :key="value" :value="value">{{ value }}</option></select>
              </label>
              <label v-if="sizes.length" class="flowField"><span>Kích thước ảnh</span>
                <select v-model="selectedStep.options.size"><option :value="undefined">Mặc định</option><option v-for="value in sizes" :key="value" :value="value">{{ value }}</option></select>
              </label>
              <label v-if="durations.length" class="flowField"><span>Thời lượng</span>
                <select v-model="selectedStep.options.duration" @change="checkResolution"><option :value="undefined">Mặc định</option><option v-for="value in durations" :key="value" :value="value">{{ value }} giây</option></select>
              </label>
              <label v-if="resolutions.length" class="flowField"><span>Độ phân giải video</span>
                <select v-model="selectedStep.options.resolution"><option :value="undefined">Mặc định</option><option v-for="value in resolutions" :key="value" :value="value">{{ value }}</option></select>
              </label>
            </div>
            <ul v-if="issues.steps.has(selectedStep.id)" class="stepIssues" aria-live="polite">
              <li v-for="issue in issues.steps.get(selectedStep.id)" :key="issue">{{ issue }}</li>
            </ul>
          </fieldset>
          <p v-else class="flowHint">Bấm <strong>Thêm bước</strong> để chọn đầu ra và viết prompt.</p>
        </section>
      </div>

      <ul v-if="issues.general.length" class="stepIssues" aria-live="polite"><li v-for="issue in issues.general" :key="issue">{{ issue }}</li></ul>
      <p v-if="saveError" class="saveError" role="alert">{{ saveError }}</p>
    </div>
    <template #footer>
      <div class="flowFooter">
        <p role="status">{{ footerStatus }}</p>
        <div>
          <el-button :disabled="saving" @click="requestClose(() => emit('update:modelValue', false))">Đóng</el-button>
          <el-button type="primary" :loading="saving" :disabled="!canSave" @click="saveTemplate">Lưu mẫu</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router";
import { ElMessageBox } from "element-plus";
import { IconAlertCircle, IconChevronDown, IconChevronUp, IconGripVertical, IconPlus, IconTrash } from "@tabler/icons-vue";
import axios from "axios";
import { getNodeModelKey, readNodeModels, type NodeAiModel, type NodeMediaModel } from "@toonflow/nodes-scaffold/nodeAi";
import useWorkspaceFiles, { type TextSnapshot } from "@/lib/workspaceFiles";
import { flowInputs, flowLibraryPath, getFlowIssues, kindLabels, makeFlowStep, makeStarterFlow, parseFlowLibrary, stepKinds, type StepKind, type StudioFlow, type StudioKind } from "./studioFlows";

type FlowMediaModel = Pick<NodeMediaModel, "type" | "providerId" | "providerLabel" | "modelId" | "routeId" | "label" | "imageRatios" | "imageSizes" | "durationResolutionMap">;
const props = defineProps<{ modelValue: boolean; directory: string; kind: StudioKind; mediaModels: FlowMediaModel[] }>();
const emit = defineEmits<{ "update:modelValue": [visible: boolean] }>();
const files = useWorkspaceFiles(props.directory);
const lifetime = new AbortController();
const draft = ref(makeStarterFlow(props.kind));
const unchanged = ref(JSON.stringify(draft.value));
const selectedId = ref(draft.value.steps[0]?.id);
const templates = shallowRef<StudioFlow[]>([]);
let snapshot: TextSnapshot | undefined;
const loading = ref(true);
const saving = ref(false);
const busy = computed(() => loading.value || saving.value);
const loadError = ref("");
const saveError = ref("");
const modelError = ref("");
const confirmationPending = ref(false);
const languageModels = shallowRef<NodeAiModel[]>([]);
const promptInput = ref<HTMLTextAreaElement>();
const draggedId = ref("");
const dropTarget = ref<{ id: string; after: boolean }>();
const finalStep = computed(() => draft.value.steps.at(-1));
const selectedIndex = computed(() => draft.value.steps.findIndex(step => step.id === selectedId.value));
const selectedStep = computed(() => draft.value.steps[selectedIndex.value]);
const savedTemplate = computed(() => templates.value.find(template => template.id === draft.value.id));
const dirty = computed(() => JSON.stringify(draft.value) !== unchanged.value);
const issues = computed(() => getFlowIssues(draft.value));
const canSave = computed(() => !busy.value && !loadError.value && !issues.value.general.length && !issues.value.steps.size && (dirty.value || !savedTemplate.value));
const footerStatus = computed(() => {
  if (loading.value) return "Đang tải thư viện mẫu…";
  if (issues.value.steps.size) return `${issues.value.steps.size} bước cần chỉnh trước khi lưu.`;
  if (savedTemplate.value && !dirty.value) return "Đã lưu trong dự án.";
  return dirty.value ? "Có thay đổi chưa lưu." : "Mẫu chưa được lưu.";
});

const priorSources = computed(() => draft.value.steps.slice(0, Math.max(0, selectedIndex.value)).map(step => ({ id: step.id, label: step.name || "Bước chưa đặt tên", kind: step.kind })));
const validSources = computed(() => [...flowInputs, ...priorSources.value]);
const textSources = computed(() => validSources.value.filter(source => source.kind === "text" && selectedStep.value?.sources.includes(source.id)));
const unavailableSources = computed(() => (selectedStep.value?.sources ?? []).filter(id => !validSources.value.some(source => source.id === id)).map(id => {
  const step = draft.value.steps.find(item => item.id === id);
  return { id, label: step ? `${step.name || "Bước chưa đặt tên"} · chưa có kết quả ở bước này` : `Nguồn đã bị xóa (${id})` };
}));

const modelOptions = computed(() => {
  const kind = selectedStep.value?.kind;
  const models = kind === "text" ? languageModels.value : props.mediaModels.filter(model => model.type === kind);
  return models.map(model => ({ key: getNodeModelKey(model), label: `${model.label} · ${model.providerLabel}` }));
});
const mediaModel = computed(() => props.mediaModels.find(model => model.type === selectedStep.value?.kind && getNodeModelKey(model) === selectedStep.value?.model));
const ratios = computed(() => mediaModel.value?.imageRatios ?? []);
const sizes = computed(() => selectedStep.value?.kind === "image" ? mediaModel.value?.imageSizes ?? [] : []);
const durations = computed(() => [...new Set(mediaModel.value?.durationResolutionMap?.flatMap(item => item.duration) ?? [])]);
const resolutions = computed(() => [...new Set(mediaModel.value?.durationResolutionMap
  ?.filter(item => !selectedStep.value?.options.duration || item.duration.includes(selectedStep.value.options.duration)).flatMap(item => item.resolution) ?? [])]);

function templateLabel(template: StudioFlow) {
  const result = template.steps.at(-1);
  return result ? `${template.name} · ${kindLabels[result.kind]}` : template.name;
}

function errorCode(error: unknown) {
  return axios.isAxiosError(error) ? error.response?.data?.data?.code as string | undefined : undefined;
}

async function loadLibrary() {
  loading.value = true;
  loadError.value = "";
  try {
    const saved = await files.readTextSnapshot(flowLibraryPath, { signal: lifetime.signal });
    templates.value = parseFlowLibrary(saved.text);
    snapshot = saved;
  } catch (error) {
    if (lifetime.signal.aborted) return;
    if (errorCode(error) === "ENOENT") { templates.value = []; snapshot = undefined; }
    else loadError.value = error instanceof SyntaxError ? "Tệp thư viện mẫu luồng không hợp lệ." : "Không đọc được thư viện mẫu. Hãy thử tải lại.";
  } finally {
    loading.value = false;
  }
}

async function saveTemplate() {
  if (!canSave.value) return;
  saving.value = true;
  saveError.value = "";
  try {
    const template = JSON.parse(JSON.stringify(draft.value)) as StudioFlow;
    template.name = template.name.trim();
    const next = savedTemplate.value ? templates.value.map(item => item.id === template.id ? template : item) : [...templates.value, template];
    const text = `${JSON.stringify({ version: 1, templates: next }, null, 2)}\n`;
    if (snapshot) {
      const revision = await files.writeTextSnapshot(flowLibraryPath, text, snapshot);
      snapshot = { ...snapshot, text, revision };
      templates.value = next;
    } else {
      await files.write(flowLibraryPath, text, true);
      snapshot = await files.readTextSnapshot(flowLibraryPath, { signal: lifetime.signal });
      templates.value = parseFlowLibrary(snapshot.text);
    }
    if (!lifetime.signal.aborted) setDraft(template, selectedId.value);
  } catch (error) {
    if (lifetime.signal.aborted) return;
    const code = errorCode(error);
    saveError.value = code === "ESTALE" || code === "EEXIST"
      ? "Thư viện đã thay đổi ở cửa sổ khác. Bản chỉnh của bạn vẫn ở đây. Hãy sao chép phần cần giữ trước khi mở lại thư viện."
      : "Lưu mẫu thất bại. Hãy thử lưu lại.";
  } finally {
    saving.value = false;
  }
}

function setDraft(flow: StudioFlow, stepId = flow.steps[0]?.id) {
  draft.value = JSON.parse(JSON.stringify(flow)) as StudioFlow;
  unchanged.value = JSON.stringify(draft.value);
  selectedId.value = stepId;
  saveError.value = "";
  endDrag();
}

async function canDiscard() {
  if (saving.value || confirmationPending.value) return false;
  if (!dirty.value) return true;
  confirmationPending.value = true;
  try {
    await ElMessageBox.confirm("Thay đổi trong mẫu này chưa được lưu.", "Bỏ thay đổi?", { type: "warning", confirmButtonText: "Bỏ thay đổi", cancelButtonText: "Tiếp tục chỉnh" });
    return true;
  } catch { return false; }
  finally { confirmationPending.value = false; }
}

async function requestClose(done: () => void) {
  if (await canDiscard()) done();
}

async function openTemplate(id: string) {
  const template = templates.value.find(item => item.id === id);
  if (template && await canDiscard()) setDraft(template);
}

async function openStarter(kind: StudioKind) {
  if (await canDiscard()) setDraft(makeStarterFlow(kind));
}

function addStep(kind: StepKind) {
  const step = makeFlowStep(draft.value, kind);
  draft.value.steps.push(step);
  selectedId.value = step.id;
}

function removeStep() {
  const index = selectedIndex.value;
  draft.value.steps.splice(index, 1);
  selectedId.value = draft.value.steps[Math.min(index, draft.value.steps.length - 1)]?.id;
}

function moveStep(from: number, to: number) {
  if (from === to || !draft.value.steps[from] || !draft.value.steps[to]) return;
  const [step] = draft.value.steps.splice(from, 1);
  draft.value.steps.splice(to, 0, step!);
  selectedId.value = step!.id;
}

function startDrag(event: DragEvent, id: string) {
  if (busy.value || !event.dataTransfer) return;
  draggedId.value = id;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", id);
}

function previewDrop(event: DragEvent, id: string) {
  if (!draggedId.value || busy.value) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  dropTarget.value = { id, after: event.clientY >= rect.top + rect.height / 2 };
}

function dropStep(event: DragEvent, id: string) {
  previewDrop(event, id);
  const target = dropTarget.value;
  if (target && draggedId.value && !busy.value) {
    const from = draft.value.steps.findIndex(step => step.id === draggedId.value);
    const index = draft.value.steps.findIndex(step => step.id === target.id);
    const insertion = index + Number(target.after);
    moveStep(from, insertion - Number(from < insertion));
  }
  endDrag();
}

function endDrag() {
  draggedId.value = "";
  dropTarget.value = undefined;
}

async function insertSource(id: string) {
  const step = selectedStep.value;
  const input = promptInput.value;
  if (!step || !input) return;
  const { selectionStart, selectionEnd } = input;
  const token = `{{${id}}}`;
  step.prompt = step.prompt.slice(0, selectionStart) + token + step.prompt.slice(selectionEnd);
  await nextTick();
  input.focus();
  input.setSelectionRange(selectionStart + token.length, selectionStart + token.length);
}

function resetModel() {
  if (!selectedStep.value) return;
  selectedStep.value.model = "";
  selectedStep.value.options = {};
}

function checkResolution() {
  const options = selectedStep.value?.options;
  if (options?.resolution && !resolutions.value.includes(options.resolution)) options.resolution = undefined;
}

onMounted(() => {
  void loadLibrary();
  void readNodeModels<NodeAiModel>("language", lifetime.signal).then(models => {
    languageModels.value = models;
  }).catch(() => { if (!lifetime.signal.aborted) modelError.value = "Chưa tải được danh sách mô hình văn bản."; });
});
onBeforeRouteLeave(canDiscard);
onBeforeRouteUpdate(canDiscard);
onBeforeUnmount(() => lifetime.abort());
</script>

<style scoped lang="scss">
.flowSetup {
  display: grid;
  gap: 16px;
  color: var(--el-text-color-primary);

  .libraryBar, .fieldPair, .flowBoard { display: grid; gap: 12px; }
  .libraryBar { grid-template-columns: minmax(140px, 1fr) auto minmax(170px, 1fr); align-items: end; }
  .flowBoard { grid-template-columns: minmax(225px, .83fr) minmax(0, 1.4fr); gap: 14px; align-items: start; }
  .fieldPair { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .flowField {
    display: grid;
    gap: 6px;
    min-width: 0;
    font-weight: 600;
    font-size: 13px;

    input, select, textarea {
      box-sizing: border-box;
      width: 100%;
      min-height: 34px;
      padding: 7px 9px;
      border: 1px solid var(--el-border-color);
      border-radius: 7px;
      font: inherit;
      font-weight: 400;
      color: var(--el-text-color-primary);
      background: var(--el-bg-color);
    }
    textarea { min-height: 88px; resize: vertical; line-height: 1.55; }
  }

  .stepRail, .stepEditor { min-width: 0; border: 1px solid var(--el-border-color-light); border-radius: 11px; padding: 14px; }
  .stepRail { background: var(--el-fill-color-lighter); }
  h3 { margin: 0; font-size: 15px; font-weight: 670; }
  .stepList { list-style: none; display: grid; gap: 8px; margin: 12px 0; padding: 0; }
  .stepCard {
    position: relative;
    display: flex;
    min-width: 0;
    align-items: center;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-bg-color);

    &.selected { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
    &.dragging { opacity: .5; }
    &.dropBefore { box-shadow: 0 -3px var(--el-color-primary); }
    &.dropAfter { box-shadow: 0 3px var(--el-color-primary); }
    &.endpoint { min-height: 54px; gap: 10px; padding: 0 10px; border-style: dashed; }
    small { display: block; font-size: 12px; color: var(--el-text-color-secondary); }
    strong { font-size: 13px; }
  }
  .stepIndex {
    display: grid;
    place-items: center;
    flex: 0 0 24px;
    height: 24px;
    border-radius: 6px;
    color: var(--el-text-color-regular);
    background: var(--el-fill-color);
    font-size: 12px;
    font-weight: 700;
  }
  .dragHandle { display: grid; place-items: center; flex: 0 0 25px; height: 38px; color: var(--el-text-color-secondary); cursor: grab; }
  .stepChoice, .stepMoves button, .tokenButton {
    border: 0;
    color: inherit;
    background: transparent;
    font: inherit;
    cursor: pointer;
    &:disabled { cursor: default; opacity: .36; }
  }
  .stepChoice { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; min-height: 54px; padding: 5px 4px 5px 0; text-align: left; }
  .stepName { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .stepMoves { display: grid; flex: 0 0 auto; padding-right: 5px; }
  .stepMoves button { display: grid; place-items: center; width: 27px; height: 25px; border-radius: 4px; &:hover:not(:disabled) { background: var(--el-fill-color); } }
  .addStepButton { width: 100%; margin-top: 2px; }

  .editorFields { display: grid; gap: 12px; min-width: 0; padding: 0; margin: 0; border: 0; }
  .editorHeading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .sourcePanel { padding: 9px 11px; border: 1px solid var(--el-border-color-light); border-radius: 8px; }
  .sourcePanel summary { cursor: pointer; font-weight: 600; span { float: right; font-size: 12px; font-weight: 400; color: var(--el-text-color-secondary); } }
  .sourceGroup {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px 10px;
    margin-top: 10px;
    strong { grid-column: 1 / -1; color: var(--el-text-color-secondary); font-size: 12px; }
    label { display: flex; align-items: start; gap: 6px; font-size: 13px; overflow-wrap: anywhere; cursor: pointer; }
    input { accent-color: var(--el-color-primary); }
  }
  .tokenBar { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; color: var(--el-text-color-secondary); font-size: 12px; }
  .tokenButton { padding: 3px 7px; border: 1px solid var(--el-border-color-light); border-radius: 5px; color: var(--el-color-primary); }
  .flowHint, .saveError, .flowNotice p { margin: 0; }
  .flowHint { color: var(--el-text-color-secondary); font-size: 13px; }
  .stepWarning, .stepIssues, .saveError, .flowNotice { color: var(--el-color-danger); }
  .stepWarning { flex-shrink: 0; }
  .stepIssues { margin: 0; padding: 0 0 0 17px; }
  .flowNotice { display: flex; gap: 10px; align-items: center; justify-content: space-between; }

  :is(input, select, textarea, button, summary):focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 2px; }
}
.flowFooter {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  p { margin: 0; color: var(--el-text-color-secondary); font-size: 13px; }
}
@media (max-width: 690px) {
  .flowSetup {
    .flowBoard { grid-template-columns: minmax(0, 1fr); }
    .libraryBar { grid-template-columns: minmax(0, 1fr) auto; }
    .flowName { grid-column: 1 / -1; }
    .stepRail, .stepEditor { padding: 10px; }
  }
}
@media (max-width: 420px) { .flowSetup .sourceGroup { grid-template-columns: minmax(0, 1fr); } }
</style>
