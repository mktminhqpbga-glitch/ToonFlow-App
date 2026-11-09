<template>
  <el-dialog v-model="visible" title="Thư viện vật liệu" width="min(800px, 94vw)" alignCenter appendToBody :closeOnClickModal="false">
    <p class="presetIntro">Chọn một công cụ, chỉnh prompt, sau đó tạo node thật trên Canvas. Không tự gửi AI khi chưa có model sẵn sàng.</p>
    <div class="presetGrid">
      <button v-for="item in presets" :key="item.id" type="button" class="presetItem"
        :class="{ active: selectedId === item.id }" :aria-pressed="selectedId === item.id"
        :disabled="!nodeType(item.kind)" @click="selectPreset(item.id)">
        <strong>{{ item.title }}</strong>
        <small>{{ nodeType(item.kind) ? item.description : 'Cần bật node tạo ảnh/video trong danh sách node' }}</small>
      </button>
    </div>
    <label class="promptLabel" for="materialPresetPrompt">Prompt cho node mới (chỉnh sửa trước khi tạo)</label>
    <el-input id="materialPresetPrompt" v-model="prompt" type="textarea" :rows="6" :maxlength="12000" showWordLimit />
    <template #footer>
      <el-button :disabled="creating" @click="visible = false">Hủy</el-button>
      <el-button type="primary" :loading="creating" :disabled="!selected || !nodeType(selected.kind) || !prompt.trim()" @click="createPreset">Tạo node với prompt</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElButton, ElDialog, ElInput, ElMessage } from "element-plus";

type Kind = "image" | "video";
type Preset = { id: string; title: string; description: string; kind: Kind; prompt: string };
const presets: Preset[] = [
  { id: "storyboard", title: "Storyboard", description: "Bố cục bảng phân cảnh", kind: "image", prompt: "Tạo một bảng storyboard gồm 6 khung hình theo trình tự thời gian, kể rõ hành động nhân vật và chuyển động camera. Mỗi khung có chú thích cảnh. Giữ nhân vật, ánh sáng và phong cách nhất quán." },
  { id: "sequence", title: "Phân cảnh liên tục", description: "Diễn tiến hình ảnh", kind: "image", prompt: "Tạo một dải 4 khung hình thể hiện một hành động liên tục, giữ nguyên nhân vật và bối cảnh, thay đổi thời điểm của cùng một hành động. Phong cách điện ảnh, ánh sáng nhất quán." },
  { id: "nineAngles", title: "Chín góc máy", description: "Contact sheet 3 × 3", kind: "image", prompt: "Tạo contact sheet 3×3 với 9 góc máy khác nhau của cùng một nhân vật và cùng bối cảnh: toàn cảnh, trung cảnh, cận cảnh, góc thấp, góc cao, sau lưng, nghiêng trái, nghiêng phải, ngang mắt. Giữ ngoại hình không đổi." },
  { id: "perspectives", title: "Nhiều góc nhìn", description: "Một đối tượng nhiều góc", kind: "image", prompt: "Tạo bảng tham khảo gồm các góc nhìn trước, trái, phải và sau của cùng một đối tượng. Duy trì hình dạng, tỷ lệ và chi tiết nhận dạng thống nhất." },
  { id: "character", title: "Thiết lập nhân vật", description: "Ảnh tham chiếu nhân vật", kind: "image", prompt: "Tạo ảnh thiết lập toàn thân nhân vật trên nền đơn giản, mô tả rõ trang phục, đường nét và cấu trúc cơ thể, thêm hình trước, nghiêng và sau. Giữ danh tính và tạo hình thống nhất." },
  { id: "environment", title: "Thiết lập bối cảnh", description: "Khóa bố cục không gian", kind: "image", prompt: "Tạo ảnh thiết lập bối cảnh điện ảnh, thể hiện bố cục, vật thể chính, nguồn sáng, màu sắc và chiều sâu không gian. Không thay đổi các đặc điểm kiến trúc giữa các góc nhìn." },
  { id: "product", title: "Thiết lập sản phẩm", description: "Ảnh sản phẩm nhất quán", kind: "image", prompt: "Tạo bảng ảnh giới thiệu cùng một sản phẩm ở góc chính diện, ba phần tư và chi tiết. Giữ nguyên chất liệu, màu sắc, logo và kích thước tương đối của sản phẩm." },
  { id: "lighting", title: "Ánh sáng điện ảnh", description: "Thiết lập nguồn sáng", kind: "image", prompt: "Tạo ảnh điện ảnh với key light có chủ đích, fill light tinh tế, rim light tách nền, bóng đổ tự nhiên, độ sâu lớp cảnh rõ rệt và màu sắc nhất quán." },
  { id: "videoScene", title: "Video phân cảnh", description: "Một cảnh phim có mô tả máy quay", kind: "video", prompt: "Tạo một cảnh phim điện ảnh với hành động rõ ràng, bối cảnh nhất quán, camera chuyển động mượt và ánh sáng ổn định. Không tự thêm cảnh ngoài yêu cầu." },
];
const props = defineProps<{
  availableNodes: { type: string; label: string }[];
  createNode: (preset: { nodeType: string; title: string; prompt: string }) => Promise<boolean>;
}>();
const visible = defineModel<boolean>({ default: false });
const selectedId = ref(presets[0]!.id);
const prompt = ref(presets[0]!.prompt);
const creating = ref(false);
const selected = computed(() => presets.find(item => item.id === selectedId.value));
function nodeType(kind: Kind) {
  const name = kind === "image" ? "imagegeneration" : "videogeneration";
  return props.availableNodes.find(item => item.type.toLowerCase().includes(name))?.type;
}
function selectPreset(id: string) {
  const choice = presets.find(item => item.id === id);
  if (!choice) return;
  selectedId.value = choice.id;
  prompt.value = choice.prompt;
}
watch(visible, value => { if (value) selectPreset(presets[0]!.id); });
async function createPreset() {
  const choice = selected.value;
  const type = choice && nodeType(choice.kind);
  if (!choice || !type || !prompt.value.trim() || creating.value) return;
  creating.value = true;
  try {
    if (await props.createNode({ nodeType: type, title: choice.title, prompt: prompt.value })) visible.value = false;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Không thể tạo node từ preset");
  } finally {
    creating.value = false;
  }
}
</script>

<style scoped lang="scss">
.presetIntro { margin: 0 0 12px; color: var(--el-text-color-secondary); }
.presetGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; max-height: 330px; overflow-y: auto; margin-bottom: 16px; }
.presetItem { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px; border: 1px solid var(--el-border-color); border-radius: 8px; background: var(--el-bg-color); color: var(--el-text-color-primary); text-align: left; cursor: pointer; }
.presetItem.active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.presetItem:disabled { color: var(--el-text-color-disabled); cursor: not-allowed; }
.presetItem small { font-size: 12px; color: var(--el-text-color-secondary); }
.promptLabel { display: block; margin-bottom: 8px; font-weight: 600; }
@media (max-width: 560px) { .presetGrid { grid-template-columns: 1fr; } }
</style>
