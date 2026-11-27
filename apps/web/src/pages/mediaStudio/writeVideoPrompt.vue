<template>
  <el-dialog v-model="visible" title="Viết prompt video" width="min(700px, calc(100vw - 24px))" appendToBody destroyOnClose>
    <div class="promptForm">
      <label for="videoPromptIdea">Ý tưởng gốc</label>
      <el-input id="videoPromptIdea" v-model="idea" type="textarea" :rows="4" :maxlength="90000" :disabled="writing"
        placeholder="Nhập cảnh, sản phẩm hoặc câu chuyện bạn muốn tạo…" />
      <label for="videoPromptModel">Mô hình viết prompt</label>
      <el-select id="videoPromptModel" v-model="choice" filterable :loading="loading" :disabled="writing" placeholder="Chọn mô hình văn bản trong MacFlow">
        <el-option v-for="model in models" :key="getNodeModelKey(model)" :value="getNodeModelKey(model)" :label="model.label + ' · ' + model.providerLabel" />
      </el-select>
      <p v-if="!loading && !models.length" class="hint">Mở Cài đặt mô hình để thêm mô hình văn bản rồi thử lại.</p>
      <details class="templateSection">
        <summary>Mẫu yêu cầu</summary>
        <label for="videoPromptTemplate">Chỉnh mẫu hướng dẫn AI</label>
        <el-input id="videoPromptTemplate" v-model="template" type="textarea" :rows="5" :maxlength="6000" :disabled="writing" />
        <el-button text :disabled="writing || template === defaultTemplate" @click="template = defaultTemplate">Dùng lại mẫu mặc định</el-button>
        <p v-if="templateError" class="hint" role="status">{{ templateError }}</p>
      </details>
      <el-alert v-if="issue" :title="issue" type="error" :closable="false" showIcon />
      <template v-if="proposal">
        <label for="videoPromptProposal">Prompt đã viết</label>
        <el-input id="videoPromptProposal" v-model="proposal" type="textarea" :rows="8" :maxlength="100000" :disabled="writing" />
      </template>
    </div>
    <template #footer>
      <div class="promptActions">
        <el-button @click="visible = false">Đóng</el-button>
        <el-button :loading="writing" :disabled="!selected || !idea.trim() || !template.trim()" @click="writePrompt">{{ proposal ? "Viết lại" : "Viết bằng AI" }}</el-button>
        <el-button v-if="proposal" type="primary" :disabled="writing || !proposal.trim()" @click="apply">Dùng prompt này</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, shallowRef, watch } from "vue";
import { findNodeModel, getNodeModelIdentity, getNodeModelKey, readNodeModels, useNodeAi, type NodeAiModel } from "@toonflow/nodes-scaffold/nodeAi";
import { videoFlowError } from "./useVideoFlowRun";

const props = defineProps<{ directory: string; ownerId: string; prompt: string; ratio: string; duration: number | null; hasReference: boolean }>();
const emit = defineEmits<{ apply: [prompt: string] }>();
const visible = defineModel<boolean>({ required: true });
const defaultTemplate = `Chuyển ý tưởng thành một prompt chi tiết để tạo video, giữ đúng mục đích và các chi tiết đã có.
Mô tả rõ chủ thể hoặc sản phẩm, bối cảnh, ánh sáng, màu sắc, góc máy, chuyển động máy quay và hành động theo trình tự.
Ưu tiên ít cảnh và chuyển động khả thi trong thời lượng đã chọn. Nếu có ảnh khung đầu, giữ tính nhất quán của chủ thể và bối cảnh.
Giữ nguyên lời thoại người dùng đã viết. Nếu ý tưởng yêu cầu lời thoại mới, viết câu ngắn tự nhiên và nêu rõ người nói. Chỉ bổ sung âm thanh hoặc chữ trên màn hình khi phù hợp với yêu cầu.
Trả về prompt có thể dùng ngay bằng ngôn ngữ của ý tưởng, không kèm giải thích hoặc tiêu đề Markdown.`;
const storageKey = "macflow.videoPromptWriter.v1:" + props.ownerId;
const lifetime = new AbortController();
const ai = useNodeAi();
const models = shallowRef<NodeAiModel[]>([]);
const choice = ref("");
const template = ref(defaultTemplate);
const idea = ref(props.prompt);
const issue = ref("");
const templateError = ref("");
const proposal = ref("");
const writing = ref(false);
const loading = ref(true);
let request: AbortController | undefined;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as { template?: unknown; model?: unknown } | null;
  if (typeof saved?.template === "string" && saved.template.trim()) template.value = saved.template.slice(0, 6000);
  if (typeof saved?.model === "string") choice.value = saved.model;
} catch { templateError.value = "Chưa đọc được mẫu đã lưu. Bạn có thể dùng hoặc chỉnh mẫu mặc định."; }

watch([template, choice], () => {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ template: template.value, model: choice.value }));
    templateError.value = "";
  } catch { templateError.value = "Trình duyệt chưa lưu được mẫu cho lần sau."; }
});
const selected = computed(() => findNodeModel(models.value, choice.value));
onMounted(async () => {
  try {
    models.value = await readNodeModels<NodeAiModel>("language", lifetime.signal, true);
    if (!selected.value && models.value[0]) choice.value = getNodeModelKey(models.value[0]);
  } catch (error) { if (!lifetime.signal.aborted) issue.value = videoFlowError(error); }
  finally { loading.value = false; }
});
watch(visible, open => { if (!open) request?.abort(); });
onScopeDispose(() => lifetime.abort());

async function writePrompt() {
  const model = selected.value;
  if (!model || writing.value || !idea.value.trim() || !template.value.trim()) return;
  const controller = new AbortController();
  request = controller;
  writing.value = true;
  issue.value = "";
  try {
    const video = [props.ratio && "Tỷ lệ " + props.ratio, props.duration && "Thời lượng " + props.duration + " giây",
      props.hasReference && "Có ảnh khung đầu"].filter(Boolean).join(". ");
    const answer = await ai.generate({
      ...getNodeModelIdentity(model), directory: props.directory, systemPrompt: template.value.trim(),
      prompt: [video, "Ý tưởng của người dùng", idea.value.trim()].filter(Boolean).join("\n\n"),
      signal: AbortSignal.any([controller.signal, lifetime.signal, AbortSignal.timeout(120000)]),
    });
    const text = answer.text.trim();
    if (!text || text.length > 100000) throw new Error("Mô hình trả prompt rỗng hoặc quá dài. Hãy thử viết lại.");
    proposal.value = text;
  } catch (error) {
    if (!controller.signal.aborted && !lifetime.signal.aborted) issue.value = videoFlowError(error);
  } finally { request = undefined; writing.value = false; }
}

function apply() {
  if (!proposal.value.trim() || writing.value) return;
  emit("apply", proposal.value.trim());
  visible.value = false;
}
</script>

<style scoped>
.promptForm { display: grid; gap: 9px; }
.promptForm label { color: var(--el-text-color-primary); font-weight: 600; }
.templateSection { border: 1px solid var(--el-border-color-light); border-radius: var(--ui-radius, 8px); padding: 9px 12px; }
.templateSection summary { cursor: pointer; }
.templateSection label { display: block; margin: 9px 0 7px; }
.hint { color: var(--el-text-color-secondary); margin: 0; font-size: .82rem; }
.promptActions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
.promptActions :deep(.el-button) { margin: 0; }
</style>
