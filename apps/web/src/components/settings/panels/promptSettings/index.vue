<template>
  <div class="promptSettings">
    <p class="help">Xem và chỉnh sửa prompt ẩn của các nút tạo ảnh và Đạo diễn 3D. Các thay đổi được lưu vào cấu hình MacFlow và áp dụng cho lần gửi yêu cầu mới, bao gồm cả Muse2API.</p>
    <el-alert type="info" :closable="false" title="Biến {prompt} giữ hướng dẫn gốc" description="Chèn {prompt} để giữ hướng dẫn mặc định và thêm yêu cầu riêng. Đối với Góc máy 3D và Ánh sáng, các con số thực tế trên bảng điều khiển vẫn luôn được gửi kèm, kể cả khi bạn thay toàn bộ prompt ẩn." showIcon />
    <div class="filterRow">
      <el-select v-model="group" class="groupSelect" aria-label="Nhóm prompt">
        <el-option label="Tất cả nhóm" value="" />
        <el-option v-for="name in groups" :key="name" :label="name" :value="name" />
      </el-select>
      <el-input v-model="search" clearable placeholder="Tìm nút hoặc prompt..." aria-label="Tìm prompt" />
    </div>
    <div class="editorLayout">
      <div class="promptList" role="list" aria-label="Danh sách prompt ẩn">
        <button v-for="item in filtered" :key="item.id" class="promptItem" type="button" :class="{ active: item.id === selectedId }" :aria-pressed="item.id === selectedId" @click="select(item.id)">
          <span>{{ item.label }}</span>
          <small>{{ item.group }}<template v-if="savedOverrides[item.id]"> · Đã tùy chỉnh</template></small>
        </button>
        <p v-if="!filtered.length" class="empty">Không tìm thấy nút phù hợp.</p>
      </div>
      <div class="promptEditor" v-if="selected">
        <strong>{{ selected.label }}</strong>
        <small>{{ selected.group }} · {{ selected.id }}</small>
        <p>{{ selected.description }}</p>
        <label for="promptDefault">{{ hasExactDefault ? 'Prompt mặc định của nút (thông số mẫu)' : 'Trích đoạn prompt mặc định (minh họa)' }}</label>
        <el-input id="promptDefault" type="textarea" :modelValue="defaultPrompt" :autosize="{ minRows: 4, maxRows: 7 }" readonly aria-label="Prompt mặc định" />
        <label for="promptOverride">Prompt tùy chỉnh</label>
        <el-input id="promptOverride" v-model="draft" type="textarea" :maxlength="nodePromptOverrideLimit" showWordLimit :autosize="{ minRows: 6, maxRows: 12 }" placeholder="Để trống = dùng prompt mặc định. Ví dụ: {prompt}&#10;Produce a high-quality result." aria-label="Chỉnh sửa prompt ẩn" />
        <p v-if="selected.id.startsWith('camera.')" class="variablesInfo">Biến góc máy tự động: <code>{azimuth}</code>, <code>{elevation}</code>, <code>{distance}</code>, <code>{lensMm}</code>, <code>{lensType}</code>, <code>{cameraX}</code>, <code>{cameraY}</code>, <code>{cameraZ}</code>. Ví dụ: <code>Góc ngang {azimuth}°, cao {elevation}°, ống kính {lensMm}mm</code>.</p>
        <p v-else-if="selected.id.startsWith('lighting.')" class="variablesInfo">Biến ánh sáng tự động: <code>{keyAzimuth}</code>, <code>{keyElevation}</code>, <code>{keyIntensity}</code>, <code>{keyColor}</code>, <code>{rimEnabled}</code>, <code>{rimAzimuth}</code>, <code>{rimElevation}</code>, <code>{rimIntensity}</code>, <code>{rimColor}</code>. Các giá trị được thay bằng số thực từ bảng điều khiển.</p>
        <div class="preview">
          <strong>Xem trước prompt kết hợp</strong>
          <pre>{{ promptPreview }}</pre>
          <small v-if="selected.group === 'Góc máy 3D' || selected.group === 'Ánh sáng'">Đây là ví dụ có số đo mẫu. Trong node, các biến được thay bằng giá trị thật bạn chọn. Khi bạn sửa prompt ẩn, hệ thống vẫn kèm khối thông số để không mất góc, khoảng cách, tiêu cự hoặc màu ánh sáng.</small>
        </div>
        <div class="actions">
          <el-button :disabled="saving || !draft.trim()" @click="draft = ''">Mặc định</el-button>
          <el-button type="primary" :loading="saving" :disabled="!changed" @click="save">Lưu prompt</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { nodePromptDefinitions, nodePromptOverrideLimit, composeNodePrompt, interpolateNodePrompt } from "@toonflow/node-shared/nodePrompts";
import { saveSettings, settings } from "@/stores/settings";
import { buildMultiAnglePrompt, buildMultiAngleParameters, getMultiAnglePromptVariables, multiAnglePresets, readMultiAngleSettings } from "../../../../../../../packages/nodes/imageNode/src/imageMultiAngle";
import { buildLightingPrompt, buildLightingParameters, getLightingPromptVariables, lightingPresets, readLightingSettings } from "../../../../../../../packages/nodes/imageNode/src/imageLighting";
import { buildPanoramaPrompt } from "../../../../../../../packages/nodes/imageNode/src/imagePanorama";
import { directorPrompt } from "../../../../../../../packages/nodes/director3dNode/src/agentPrompt";

const groups = [...new Set(nodePromptDefinitions.map(item => item.group))];
const group = ref("");
const search = ref("");
const selectedId = ref(nodePromptDefinitions[0]!.id);
const selected = computed(() => nodePromptDefinitions.find(item => item.id === selectedId.value));
const hasExactDefault = computed(() => !!selected.value && (/^(camera|lighting|panorama)\./.test(selected.value.id) || selected.value.id === "director3d.system" || ["analysis.shotSystem", "analysis.overviewSystem"].includes(selected.value.id)));
const defaultPrompt = computed(() => {
  const item = selected.value;
  if (!item) return "";
  if (item.id.startsWith("camera.")) {
    const preset = multiAnglePresets.find(preset => `camera.${preset.id}` === item.id);
    return buildMultiAnglePrompt(readMultiAngleSettings(preset?.settings));
  }
  if (item.id.startsWith("lighting.")) {
    const preset = lightingPresets.find(preset => `lighting.${preset.id}` === item.id);
    return buildLightingPrompt(readLightingSettings(preset ? { ...preset.settings, preset: preset.id } : {}));
  }
  if (item.id.startsWith("panorama.")) return buildPanoramaPrompt(item.id === "panorama.sphere" ? "sphere" : "cylinder");
  if (item.id === "director3d.system") return directorPrompt;
  return item.example;
});
const promptPreview = computed(() => {
  const prompt = composeNodePrompt(defaultPrompt.value, draft.value);
  const item = selected.value;
  if (!item) return prompt;
  if (item.id.startsWith("camera.")) {
    const preset = multiAnglePresets.find(preset => `camera.${preset.id}` === item.id);
    const controls = readMultiAngleSettings(preset?.settings);
    const rendered = interpolateNodePrompt(prompt, getMultiAnglePromptVariables(controls));
    return prompt === defaultPrompt.value ? rendered : `${rendered}\n\n${buildMultiAngleParameters(controls)}`;
  }
  if (item.id.startsWith("lighting.")) {
    const preset = lightingPresets.find(preset => `lighting.${preset.id}` === item.id);
    const controls = readLightingSettings(preset ? { ...preset.settings, preset: preset.id } : {});
    const rendered = interpolateNodePrompt(prompt, getLightingPromptVariables(controls));
    return prompt === defaultPrompt.value ? rendered : `${rendered}\n\n${buildLightingParameters(controls)}`;
  }
  return prompt;
});
const savedOverrides = computed<Record<string, string>>(() => {
  const raw = settings.value.nodePromptOverrides;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([key, value]) =>
    nodePromptDefinitions.some(item => item.id === key) && typeof value === "string" && value.length <= nodePromptOverrideLimit)) as Record<string, string>;
});
const draft = ref(savedOverrides.value[selectedId.value] ?? "");
const saving = ref(false);
const changed = computed(() => draft.value !== (savedOverrides.value[selectedId.value] ?? ""));
const filtered = computed(() => nodePromptDefinitions.filter(item =>
  (!group.value || group.value === item.group) && (!search.value || [item.id, item.label, item.group, item.description, item.example].some(text => text.toLowerCase().includes(search.value.trim().toLowerCase())))));

watch(selectedId, () => { draft.value = savedOverrides.value[selectedId.value] ?? ""; });
watch(() => savedOverrides.value[selectedId.value], value => { if (!changed.value) draft.value = value ?? ""; });

function select(id: string) {
  if (changed.value && !window.confirm("Bạn có prompt chưa lưu. Bỏ thay đổi để chuyển sang nút khác?")) return;
  selectedId.value = id;
}

async function save() {
  if (!selected.value || saving.value || !changed.value) return;
  saving.value = true;
  try {
    const id = selectedId.value;
    const text = draft.value.trim();
    const ok = await saveSettings(current => {
      const previous = current.nodePromptOverrides;
      const next = previous && typeof previous === "object" && !Array.isArray(previous) ? { ...previous as Record<string, string> } : {};
      if (text) next[id] = text;
      else delete next[id];
      return { nodePromptOverrides: next };
    });
    if (ok) ElMessage.success("Đã lưu prompt. Lần tạo tiếp theo sẽ sử dụng nội dung mới.");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Không lưu được prompt");
  } finally { saving.value = false; }
}
</script>

<style scoped lang="scss">
.promptSettings {
  display: flex; flex-direction: column; gap: 16px; min-width: 0;
  .help { margin: 0; line-height: 1.7; color: var(--el-text-color-regular); }
  .filterRow { display: flex; gap: 10px; .groupSelect { width: 185px; flex-shrink: 0; } }
  .editorLayout { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 14px; min-height: 360px; }
  .promptList { display: flex; flex-direction: column; gap: 4px; min-width: 0; max-height: 56vh; overflow-y: auto; }
  .promptItem {
    display: grid; gap: 4px; text-align: left; padding: 10px 12px; border: 1px solid transparent;
    border-radius: 8px; color: var(--el-text-color-primary); background: transparent; cursor: pointer;
    &:hover { background: var(--el-fill-color-light); }
    &.active { border-color: var(--el-color-primary); background: var(--el-fill-color-light); }
    small { color: var(--el-text-color-secondary); }
  }
  .empty { color: var(--el-text-color-secondary); padding: 10px; }
  .promptEditor { display: flex; flex-direction: column; gap: 9px; min-width: 0; overflow-y: auto; max-height: 56vh; padding-right: 6px;
    > small, > p { color: var(--el-text-color-secondary); margin: 0; line-height: 1.5; }
    .variablesInfo { line-height: 1.7; code { font-size: 12px; color: var(--el-text-color-primary); background: var(--el-fill-color-light); padding: 1px 3px; border-radius: 3px; } }
    > label { font-weight: 600; margin-top: 7px; font-size: 13px; }
    .preview { display: grid; gap: 8px; margin-top: 8px; > strong { font-size: 13px; }
      pre { margin: 0; padding: 12px; background: var(--el-fill-color-light); border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
        max-height: 180px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; line-height: 1.55; }
      small { color: var(--el-text-color-secondary); }
    }
    .actions { display: flex; justify-content: flex-end; gap: 8px; padding: 6px 0 12px; }
  }
  @media (max-width: 760px) {
    .filterRow { flex-direction: column; .groupSelect { width: 100%; } }
    .editorLayout { display: flex; flex-direction: column; }
    .promptList { max-height: 170px; }
    .promptEditor { max-height: none; }
  }
}
</style>
