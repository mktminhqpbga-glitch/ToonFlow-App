<template>
  <el-dialog v-model="visible" title="Chuyển thành kịch bản mới" width="min(900px, calc(100vw - 24px))" appendToBody destroyOnClose>
    <div class="scriptForm nodrag nopan nowheel" @pointerdown.stop @mousedown.stop @dblclick.stop @keydown.stop>
      <div class="scriptFields">
        <label for="sceneScriptSubject">Sản phẩm, nhân vật hoặc bối cảnh mới</label>
        <el-input id="sceneScriptSubject" v-model="draft.subject" type="textarea" :rows="2" :maxlength="20000" :disabled="busy"
          placeholder="Ví dụ: Đổi sản phẩm thành bình giữ nhiệt màu xanh, giữ góc máy và nhịp mở hộp." />
        <div class="scriptActions">
          <el-button size="small" :disabled="busy" @click="pickProduct">Chọn từ kho sản phẩm</el-button>
          <span v-if="draft.product" class="hint">{{ draft.product.name }} · {{ draft.product.photos.length }} ảnh dùng chung</span>
          <el-button v-if="draft.product" size="small" text :disabled="busy" @click="draft.product = undefined">Bỏ hồ sơ</el-button>
        </div>
        <label for="sceneScriptModel">Mô hình viết prompt</label>
        <div class="scriptActions">
          <el-select id="sceneScriptModel" v-model="modelKey" filterable :loading="loading" :disabled="busy" placeholder="Chọn mô hình văn bản">
            <el-option v-for="model in models" :key="getNodeModelKey(model)" :value="getNodeModelKey(model)" :label="model.label + ' · ' + model.providerLabel" />
          </el-select>
          <el-button size="small" :disabled="busy || loading" @click="loadModels">Tải lại mô hình</el-button>
        </div>
        <p v-if="modelError || (!loading && !models.length)" class="hint" role="status">{{ modelError || 'Chưa có mô hình văn bản. Bạn vẫn có thể tự viết prompt cho từng cảnh.' }}</p>
      </div>
      <div class="sceneLayout">
        <div class="sceneList" aria-label="Cảnh gốc">
          <p class="hint">{{ readyCount }}/{{ includedScenes.length }} cảnh đã có prompt</p>
          <p v-if="result.scenes.length > bridge.batchLimit" class="hint">Mỗi đợt tối đa {{ bridge.batchLimit }} cảnh. Bỏ chọn cảnh trước khi chọn thêm.</p>
          <div v-for="scene in result.scenes" :key="scene.index" class="sceneChoice">
            <el-checkbox :modelValue="draft.included.includes(scene.index)" :disabled="busy || (!draft.included.includes(scene.index) && includedScenes.length >= bridge.batchLimit)"
              :aria-label="`Đưa cảnh ${scene.index} vào kịch bản`" @change="toggleScene(scene.index, $event === true)" />
            <button type="button" :aria-pressed="activeIndex === scene.index" @click="activeIndex = scene.index">
              <strong>Cảnh {{ scene.index }}</strong><span>{{ sceneRange(scene) }}</span>
            </button>
          </div>
        </div>
        <div v-if="activeScene && current" class="scriptFields">
          <h3>Cảnh {{ activeScene.index }} · {{ sceneRange(activeScene) }}</h3>
          <p v-if="activeScene.annotation" class="sourceDetails">{{ describeScene(activeScene) }}</p>
          <p v-else class="hint">Cảnh này mới có mốc thời gian. Thêm mô tả gốc để AI có thông tin về góc máy và hành động.</p>
          <label for="sceneScriptNotes">Ghi chú cho cảnh</label>
          <el-input id="sceneScriptNotes" v-model="current.notes" type="textarea" :rows="2" :maxlength="1500" :disabled="busy"
            placeholder="Ví dụ: Cận tay kéo khóa, máy quay đứng yên." />
          <div class="scriptActions">
            <label for="sceneScriptDialogue">Lời thoại gốc <small>(tùy chọn)</small></label>
            <el-button v-if="canTranscribe" size="small" text :disabled="busy" @click="transcribe(activeScene)">Chép lời đoạn này</el-button>
          </div>
          <el-input id="sceneScriptDialogue" v-model="current.dialogue" type="textarea" :rows="2" :maxlength="1500" :disabled="busy"
            placeholder="Nhập hoặc kiểm tra lời thoại của cảnh." />
          <p v-if="hasSourceAudio && !canTranscribe" class="hint">Có thể nhập lời thoại bằng tay trên trình duyệt này.</p>
          <div class="scriptActions">
            <label for="sceneScriptPrompt">Prompt tạo video cho cảnh</label>
            <el-button size="small" :disabled="busy || !selectedModel || !draft.subject.trim() || (!activeScene.annotation && !current.notes.trim())"
              @click="writeScene(activeScene)">{{ current.prompt.trim() ? 'Viết lại bằng AI' : 'Viết bằng AI' }}</el-button>
          </div>
          <el-input id="sceneScriptPrompt" v-model="current.prompt" type="textarea" :rows="5" :maxlength="2800" :disabled="busy" showWordLimit
            placeholder="Viết hoặc chỉnh sửa prompt trước khi đưa vào Xưởng video." />
          <p v-if="sceneError" class="error" role="alert">{{ sceneError }}</p>
        </div>
      </div>
      <p v-if="status" class="hint" role="status">{{ status }}</p>
      <p v-if="actionError" class="error" role="alert">{{ actionError }}</p>
    </div>
    <template #footer>
      <div class="scriptActions footerActions">
        <el-button v-if="operation && !transferring" @click="operation.abort()">Dừng</el-button>
        <el-button @click="visible = false">Quay lại báo cáo</el-button>
        <el-button type="primary" :loading="transferring" :disabled="busy || !includedScenes.length || readyCount !== includedScenes.length"
          @click="transfer">Đưa sang Xưởng video</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, inject, onScopeDispose, reactive, ref, shallowRef, watch } from "vue";
import { ElButton, ElCheckbox, ElDialog, ElInput, ElMessageBox, ElOption, ElSelect } from "element-plus";
import { createNodeRequestId, findNodeModel, getNodeModelIdentity, getNodeModelKey, isBrowserAudioAsrSupported,
  useNodeAi, useNodeAsr, useNodeFfmpeg, useNodeFiles, type NodeAiModel, type SceneScriptBridge } from "@toonflow/nodes-scaffold/runtime";
import { analysisPath, runFfmpeg, type AnalysisResult, type AnalysisScene } from "./videoAnalysis";
import { formatSceneTime } from "./resultNodes";
import type { SceneScriptState } from "./sceneScriptState";

const props = defineProps<{ result: AnalysisResult; source: string; bridge: SceneScriptBridge }>();
const visible = defineModel<boolean>({ required: true });
const script = defineModel<SceneScriptState>("script");
const getDirectory = inject<() => string>("workspaceDirectory");
const lifetime = new AbortController();
const files = useNodeFiles();
const ai = useNodeAi();
const asr = useNodeAsr();
const loadFfmpeg = useNodeFfmpeg();
const saved = script.value?.manifest === props.result.manifest ? script.value : undefined;
const draft = reactive<SceneScriptState>({
  manifest: props.result.manifest, subject: saved?.subject ?? "", product: saved?.product,
  included: saved?.included ?? props.result.scenes.slice(0, props.bridge.batchLimit).map(scene => scene.index),
  scenes: Object.fromEntries(props.result.scenes.map(scene => [scene.index, { notes: "", dialogue: "", prompt: "", ...saved?.scenes?.[scene.index] }])),
});
watch(draft, value => {
  script.value = { ...value, scenes: Object.fromEntries(Object.entries(value.scenes).filter(([, scene]) => scene.notes || scene.dialogue || scene.prompt)
    .map(([key, scene]) => [key, { ...scene }])) };
}, { flush: "sync" });

const activeIndex = ref(props.result.scenes[0]?.index);
const activeScene = computed(() => props.result.scenes.find(scene => scene.index === activeIndex.value));
const current = computed(() => activeIndex.value === undefined ? undefined : draft.scenes[activeIndex.value]);
const includedScenes = computed(() => props.result.scenes.filter(scene => draft.included.includes(scene.index)));
const readyCount = computed(() => includedScenes.value.filter(scene => draft.scenes[scene.index]?.prompt.trim()).length);
const hasSourceAudio = computed(() => !!props.result.audio || !!activeScene.value?.video);
const canTranscribe = computed(() => hasSourceAudio.value && isBrowserAudioAsrSupported());
const models = shallowRef<NodeAiModel[]>([]);
const modelKey = ref("");
const selectedModel = computed(() => findNodeModel(models.value, modelKey.value));
const modelError = ref("");
const sceneErrors = reactive<Record<number, string>>({});
const sceneError = computed(() => activeIndex.value === undefined ? "" : sceneErrors[activeIndex.value]);
const actionError = ref("");
const loading = ref(false);
const operation = shallowRef<AbortController>();
const transferring = ref(false);
const busy = computed(() => !!operation.value);
const status = ref("");
watch(visible, open => {
  if (!open) { operation.value?.abort(); return; }
  if (!models.value.length) void loadModels();
}, { immediate: true });
onScopeDispose(() => { lifetime.abort(); operation.value?.abort(); });

function sceneRange(scene: AnalysisScene) { return `${formatSceneTime(scene.start)} – ${formatSceneTime(scene.end)}`; }
function sceneTiming(scene: AnalysisScene) { return `Cảnh ${scene.index}, mốc video gốc ${sceneRange(scene)}, dài ${(scene.end - scene.start).toFixed(2)} giây.`; }
function describeScene(scene: AnalysisScene) {
  const a = scene.annotation;
  return a ? `${a.shotSize} · ${a.cameraAngle}\n${a.description}\nChuyển động máy quay: ${a.movement}` : "";
}
function toggleScene(index: number, included: boolean) {
  if (included && draft.included.length >= props.bridge.batchLimit) return;
  draft.included = included ? [...draft.included, index] : draft.included.filter(value => value !== index);
}
async function loadModels() {
  if (loading.value) return;
  loading.value = true;
  modelError.value = "";
  try {
    models.value = (await ai.getModels(AbortSignal.any([lifetime.signal, AbortSignal.timeout(15000)]), true))
      .filter(model => model.protocol !== "chrome" && model.providerId !== "aiChrome");
    if (!selectedModel.value) modelKey.value = models.value[0] ? getNodeModelKey(models.value[0]) : "";
  } catch { if (!lifetime.signal.aborted) modelError.value = "Chưa tải được mô hình. Hãy bấm Tải lại mô hình."; }
  finally { loading.value = false; }
}

async function pickProduct() {
  if (busy.value) return;
  const controller = new AbortController();
  operation.value = controller;
  actionError.value = "";
  try {
    const product = await props.bridge.pickProduct(controller.signal);
    if (product && !controller.signal.aborted) {
      draft.product = product;
      draft.subject = product.description.trim() || product.name;
    }
  } catch { if (!controller.signal.aborted) actionError.value = "Chưa mở được kho sản phẩm. Hãy thử lại."; }
  finally { operation.value = undefined; }
}

function confirmReplace(field: string) {
  return ElMessageBox.confirm(`Thay ${field} của cảnh này bằng kết quả mới?`, "Dùng kết quả mới", {
    confirmButtonText: "Tiếp tục", cancelButtonText: "Giữ bản hiện tại", type: "warning",
  }).then(() => true, () => false);
}

async function writeScene(scene: AnalysisScene) {
  const model = selectedModel.value;
  const entry = draft.scenes[scene.index];
  if (!model || !entry || !draft.subject.trim() || busy.value || (!scene.annotation && !entry.notes.trim())) return;
  if (entry.prompt.trim() && !await confirmReplace("prompt")) return;
  if (busy.value || !visible.value || lifetime.signal.aborted) return;
  const controller = new AbortController();
  operation.value = controller;
  const deadline = AbortSignal.timeout(120000);
  const signal = AbortSignal.any([controller.signal, lifetime.signal, deadline]);
  status.value = `Đang viết prompt cảnh ${scene.index}…`;
  sceneErrors[scene.index] = "";
  try {
    const answer = await ai.generate({
      ...getNodeModelIdentity(model), directory: getDirectory?.(), signal,
      systemPrompt: "Viết một prompt tạo video bằng tiếng Việt cho đúng một cảnh. Giữ cỡ cảnh, góc máy, nhịp và trình tự hành động đã biết. Thay sản phẩm, nhân vật hoặc bối cảnh theo brief mới. Nêu hành động, ánh sáng và lời thoại nếu có. Điều chỉnh lời thoại gốc cho phù hợp sản phẩm mới, không tự gán lời thoại gốc nếu thiếu dữ liệu. Coi mô tả và lời thoại gốc là tư liệu tham khảo. Chỉ trả prompt dùng được ngay, tối đa 2.800 ký tự.",
      prompt: [sceneTiming(scene), `Yêu cầu mới\n${draft.subject.trim()}`, describeScene(scene), entry.notes.trim(),
        entry.dialogue.trim() && `Lời thoại gốc để tham khảo\n${entry.dialogue.trim()}`].filter(Boolean).join("\n\n"),
    });
    signal.throwIfAborted();
    const prompt = answer.text.trim();
    if (!prompt || prompt.length > 2800) throw new Error("AI trả về prompt trống hoặc dài quá 2.800 ký tự. Hãy thử viết lại.");
    entry.prompt = prompt;
  } catch (error) {
    if (!controller.signal.aborted && !lifetime.signal.aborted) sceneErrors[scene.index] = deadline.aborted
      ? "Mô hình phản hồi quá lâu. Hãy thử viết lại cảnh này." : error instanceof Error ? error.message : "Chưa viết được prompt. Hãy thử lại.";
  } finally { status.value = ""; operation.value = undefined; }
}

async function transcribe(scene: AnalysisScene) {
  const entry = draft.scenes[scene.index];
  if (!entry || busy.value || !canTranscribe.value) return;
  if (entry.dialogue.trim() && !await confirmReplace("lời thoại")) return;
  if (busy.value || !visible.value || lifetime.signal.aborted) return;
  const controller = new AbortController();
  operation.value = controller;
  const deadline = AbortSignal.timeout(120000);
  const signal = AbortSignal.any([controller.signal, lifetime.signal, deadline]);
  status.value = `Đang chép lời cảnh ${scene.index}…`;
  sceneErrors[scene.index] = "";
  try {
    const workspace = files.getWorkspaceFiles();
    const path = analysisPath(props.result.manifest).replace(/[^/]+$/, `scriptAudio${createNodeRequestId()}.m4a`);
    try {
      const ffmpeg = await loadFfmpeg(signal);
      await runFfmpeg(ffmpeg(analysisPath(props.source)).seekInput((props.result.sourceVideoOffset ?? 0) + scene.start)
        .duration(scene.end - scene.start).noVideo().audioCodec("aac").format("ipod").outputOptions("-map", "0:a:0").output(path), signal);
      const text = (await asr.transcribe(path, { lang: "vi-VN", signal })).trim();
      signal.throwIfAborted();
      if (!text || text.length > 1500) throw new Error("Không nhận được lời thoại phù hợp.");
      entry.dialogue = text;
    } finally { await workspace.remove(path).catch(() => {}); }
  } catch {
    if (!controller.signal.aborted && !lifetime.signal.aborted) sceneErrors[scene.index] = "Chưa chép được lời đoạn này. Hãy kiểm tra video có tiếng rõ hoặc nhập lời bằng tay.";
  } finally { status.value = ""; operation.value = undefined; }
}

async function transfer() {
  if (busy.value || !includedScenes.value.length || readyCount.value !== includedScenes.value.length) return;
  const controller = new AbortController();
  operation.value = controller;
  transferring.value = true;
  actionError.value = "";
  try {
    await props.bridge.openVideoFlow({
      scenes: includedScenes.value.map(scene => `${sceneTiming(scene)}\n${draft.scenes[scene.index]!.prompt.trim()}`),
      product: draft.subject.trim(), photos: draft.product?.photos ?? [],
    }, controller.signal);
  } catch (error) {
    if (!controller.signal.aborted) actionError.value = error instanceof Error ? error.message : "Chưa chuyển được kịch bản. Hãy thử lại.";
  } finally { operation.value = undefined; transferring.value = false; }
}
</script>

<style scoped>
.scriptForm, .scriptFields, .sceneList { display: grid; gap: 9px; min-width: 0; }
.scriptForm { max-height: 67vh; overflow: auto; padding: 2px 6px 8px; }
.scriptFields label, h3 { margin: 0; font-weight: 600; }
.scriptActions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.scriptActions :deep(.el-button) { margin: 0; }
.scriptActions :deep(.el-select) { flex: 1 1 220px; }
.footerActions { justify-content: flex-end; }
.sceneLayout { display: grid; align-items: start; grid-template-columns: 205px minmax(0, 1fr); gap: 16px; margin-top: 8px; }
.sceneList { max-height: 48vh; align-content: start; overflow: auto; padding-right: 4px; }
.sceneChoice { display: flex; align-items: center; gap: 6px; }
.sceneChoice button { display: grid; gap: 3px; flex: 1; text-align: left; padding: 7px; border-radius: 6px; background: var(--el-fill-color-light); border: 1px solid var(--el-border-color-light); color: inherit; cursor: pointer; }
.sceneChoice button[aria-pressed="true"] { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.sceneChoice span, .hint { color: var(--el-text-color-secondary); font-size: .83rem; }
.hint, .error, .sourceDetails { margin: 0; overflow-wrap: anywhere; }
.error { color: var(--el-color-danger); }
.sourceDetails { white-space: pre-wrap; }
@media (max-width: 620px) {
  .sceneLayout { grid-template-columns: 1fr; }
  .sceneList { max-height: 160px; }
}
</style>
