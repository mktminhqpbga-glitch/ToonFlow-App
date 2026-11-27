<template>
  <el-dialog v-model="visible" title="Viết prompt video" width="min(700px, calc(100vw - 24px))" appendToBody destroyOnClose>
    <div class="promptForm">
      <label for="videoPromptIdea">Ý tưởng gốc</label>
      <el-input id="videoPromptIdea" v-model="idea" type="textarea" :rows="4" :maxlength="90000" :disabled="writing"
        placeholder="Nhập cảnh, sản phẩm hoặc câu chuyện bạn muốn tạo…" />
      <label for="videoPromptModel">Mô hình văn bản qua API</label>
      <div class="modelField">
        <el-select id="videoPromptModel" v-model="choice" filterable :loading="loading" :disabled="writing || loading" placeholder="Chọn mô hình văn bản">
          <el-option v-for="model in models" :key="getNodeModelKey(model)" :value="getNodeModelKey(model)" :label="model.label + ' · ' + model.providerLabel" />
        </el-select>
        <el-button :disabled="writing || loading" @click="loadModels">Tải lại mô hình</el-button>
      </div>
      <p v-if="modelIssue" class="hint" role="status">{{ modelIssue }}</p>
      <p v-else-if="!loading && !models.length" class="hint">Thêm mô hình trong Cài đặt → Mô hình văn bản rồi bấm Tải lại mô hình.</p>
      <details class="templateSection">
        <summary>Mẫu gửi kèm AI</summary>
        <label for="videoPromptTemplate">Mẫu hướng dẫn và bố cục prompt</label>
        <el-input id="videoPromptTemplate" v-model="template" type="textarea" :rows="8" :maxlength="6000" :disabled="writing" />
        <el-button text :disabled="writing || template === defaultTemplate" @click="template = defaultTemplate">Dùng lại mẫu mặc định</el-button>
        <p v-if="templateError" class="hint" role="status">{{ templateError }}</p>
      </details>
      <el-alert v-if="issue" :title="issue" type="error" :closable="false" showIcon />
      <p v-if="writing" class="hint" role="status">Đang chờ mô hình văn bản viết prompt…</p>
      <template v-if="proposal || receiving">
        <label for="videoPromptProposal">{{ writing ? 'Prompt đang nhận' : 'Prompt từ mô hình' }}</label>
        <el-input id="videoPromptProposal" :modelValue="writing ? receiving : proposal" type="textarea" :rows="8" :maxlength="100000"
          :readonly="writing" @update:modelValue="proposal = $event" />
      </template>
    </div>
    <template #footer>
      <div class="promptActions">
        <el-button @click="visible = false">Đóng</el-button>
        <el-button :type="proposal ? 'default' : 'primary'" :loading="writing" :disabled="loading || !selected || !idea.trim() || !template.trim()" @click="writePrompt">{{ proposal ? "Viết lại" : "Gửi viết prompt" }}</el-button>
        <el-button v-if="proposal" type="primary" :disabled="writing || !proposal.trim()" @click="apply">Dùng prompt này</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, shallowRef, watch } from "vue";
import { findNodeModel, getNodeModelIdentity, getNodeModelKey, useNodeAi, type NodeAiModel } from "@toonflow/nodes-scaffold/nodeAi";
import { videoFlowError } from "./useVideoFlowRun";

const props = defineProps<{ directory: string; ownerId: string; prompt: string; ratio: string; duration: number | null; hasReference: boolean }>();
const emit = defineEmits<{ apply: [prompt: string] }>();
const visible = defineModel<boolean>({ required: true });
const originalTemplate = `Chuyển ý tưởng thành một prompt chi tiết để tạo video, giữ đúng mục đích và các chi tiết đã có.
Mô tả rõ chủ thể hoặc sản phẩm, bối cảnh, ánh sáng, màu sắc, góc máy, chuyển động máy quay và hành động theo trình tự.
Ưu tiên ít cảnh và chuyển động khả thi trong thời lượng đã chọn. Nếu có ảnh khung đầu, giữ tính nhất quán của chủ thể và bối cảnh.
Giữ nguyên lời thoại người dùng đã viết. Nếu ý tưởng yêu cầu lời thoại mới, viết câu ngắn tự nhiên và nêu rõ người nói. Chỉ bổ sung âm thanh hoặc chữ trên màn hình khi phù hợp với yêu cầu.
Trả về prompt có thể dùng ngay bằng ngôn ngữ của ý tưởng, không kèm giải thích hoặc tiêu đề Markdown.`;
const defaultTemplate = `${originalTemplate}
Dùng các mục dưới đây làm bố cục. Viết nội dung hoàn chỉnh thay cho phần hướng dẫn trong ngoặc.
Chủ thể và bối cảnh [mô tả nhân vật hoặc sản phẩm, không gian và thời điểm]
Góc máy và ánh sáng [mô tả khung hình, chuyển động máy quay, ánh sáng và màu sắc]
Diễn biến [mô tả hành động từ đầu đến cuối trong thời lượng video]
Lời thoại và âm thanh [ghi lời thoại và âm thanh phù hợp nếu có]
Chi tiết cần giữ [nêu những đặc điểm của nhân vật, sản phẩm hoặc khung hình đầu cần nhất quán]`;
const storageKey = "macflow.videoPromptWriter.v1:" + props.ownerId;
const lifetime = new AbortController();
const ai = useNodeAi();
const models = shallowRef<NodeAiModel[]>([]);
const choice = ref("");
const template = ref(defaultTemplate);
const idea = ref(props.prompt);
const issue = ref("");
const modelIssue = ref("");
const templateError = ref("");
const proposal = ref("");
const receiving = ref("");
const writing = ref(false);
const loading = ref(false);
let request: AbortController | undefined;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as { template?: unknown; model?: unknown } | null;
  if (typeof saved?.template === "string" && saved.template.trim() && saved.template.trim() !== originalTemplate) template.value = saved.template.slice(0, 6000);
  if (typeof saved?.model === "string") choice.value = saved.model;
} catch { templateError.value = "Chưa đọc được mẫu đã lưu. Bạn có thể dùng hoặc chỉnh mẫu mặc định."; }

watch([template, choice], () => {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ template: template.value, model: choice.value }));
    templateError.value = "";
  } catch { templateError.value = "Trình duyệt chưa lưu được mẫu cho lần sau."; }
});
const selected = computed(() => findNodeModel(models.value, choice.value));
async function loadModels() {
  if (loading.value || writing.value) return;
  loading.value = true;
  modelIssue.value = "";
  try {
    const list = await ai.getModels(lifetime.signal, true);
    models.value = list.filter(model => model.protocol !== "chrome" && model.providerId !== "aiChrome");
    if (!selected.value) choice.value = models.value[0] ? getNodeModelKey(models.value[0]) : "";
  } catch {
    if (!lifetime.signal.aborted) modelIssue.value = "Chưa tải được mô hình văn bản. Hãy bấm Tải lại mô hình.";
  } finally { loading.value = false; }
}
onMounted(loadModels);
watch(visible, open => { if (!open) request?.abort(); });
onScopeDispose(() => lifetime.abort());

async function writePrompt() {
  const model = selected.value;
  if (!model || loading.value || writing.value || !idea.value.trim() || !template.value.trim()) return;
  const controller = new AbortController();
  request = controller;
  writing.value = true;
  issue.value = "";
  receiving.value = "";
  const deadline = AbortSignal.timeout(120000);
  const signal = AbortSignal.any([controller.signal, lifetime.signal, deadline]);
  try {
    const video = [props.ratio && "Tỷ lệ " + props.ratio, props.duration && "Thời lượng " + props.duration + " giây",
      props.hasReference && "Có ảnh khung đầu"].filter(Boolean).join(". ");
    const answer = await ai.generate({
      ...getNodeModelIdentity(model), directory: props.directory, systemPrompt: template.value.trim(),
      prompt: [video, "Ý tưởng của người dùng", idea.value.trim()].filter(Boolean).join("\n\n"),
      signal,
      onEvent: event => {
        if (event.type === "text" && !signal.aborted) receiving.value = (receiving.value + event.delta).slice(0, 100000);
      },
    });
    signal.throwIfAborted();
    const text = answer.text.trim();
    if (!text || text.length > 100000) throw new Error("Mô hình trả prompt rỗng hoặc quá dài. Hãy thử viết lại.");
    proposal.value = text;
  } catch (error) {
    if (!controller.signal.aborted && !lifetime.signal.aborted) {
      issue.value = deadline.aborted ? "Mô hình phản hồi quá lâu. Hãy gửi lại yêu cầu hoặc chọn mô hình khác." : videoFlowError(error);
    }
  } finally {
    request = undefined;
    writing.value = false;
    receiving.value = "";
  }
}

function apply() {
  if (!proposal.value.trim() || writing.value) return;
  emit("apply", proposal.value.trim());
}
</script>

<style scoped>
.promptForm { display: grid; gap: 9px; }
.promptForm label { color: var(--el-text-color-primary); font-weight: 600; }
.modelField { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.modelField :deep(.el-select) { flex: 1 1 210px; }
.templateSection { border: 1px solid var(--el-border-color-light); border-radius: var(--ui-radius, 8px); padding: 9px 12px; }
.templateSection summary { cursor: pointer; }
.templateSection label { display: block; margin: 9px 0 7px; }
.hint { color: var(--el-text-color-secondary); margin: 0; font-size: .82rem; }
.promptActions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
.promptActions :deep(.el-button) { margin: 0; }
</style>
