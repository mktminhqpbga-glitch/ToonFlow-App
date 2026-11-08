<template>
  <div class="cameraStudio nodrag nopan nowheel" @mousedown.stop @pointerdown.stop @dblclick.stop @wheel.stop>
    <div class="cameraHeading">
      <strong>Camera Studio · Thiết lập máy ảnh</strong>
      <el-switch :modelValue="camera?.enabled === true" :disabled="disabled" aria-label="Bật Camera Studio" @change="update('enabled', $event === true)" />
    </div>
    <el-text type="info" size="small">Các thông số chỉ hướng dẫn phong cách hình ảnh AI; không điều khiển quang học thật.</el-text>
    <label>Thân máy ảnh</label>
    <el-select :modelValue="camera?.body ?? ''" :disabled="disabled" aria-label="Thân máy ảnh" @update:modelValue="update('body', String($event))">
      <el-option v-for="item in cameraBodies" :key="item" :value="item" :label="item || 'Không chỉ định'" />
    </el-select>
    <label>Ống kính</label>
    <el-select :modelValue="camera?.lens ?? ''" :disabled="disabled" aria-label="Ống kính" @update:modelValue="update('lens', String($event))">
      <el-option v-for="item in cameraLenses" :key="item" :value="item" :label="item || 'Không chỉ định'" />
    </el-select>
    <div class="cameraPair">
      <div><label>Tiêu cự · mm</label><el-input-number :modelValue="camera?.focalLength ?? 35" :min="12" :max="200" :step="1" :disabled="disabled" aria-label="Tiêu cự (12–200 mm)" @update:modelValue="$event != null && update('focalLength', $event)" /></div>
      <div><label>Khẩu độ mô phỏng</label>
        <el-select :modelValue="camera?.aperture ?? 2.8" :disabled="disabled" aria-label="Khẩu độ" @update:modelValue="update('aperture', Number($event))">
          <el-option v-for="item in aperturePresets" :key="item" :value="item" :label="`f/${item}`" />
        </el-select>
      </div>
    </div>
    <el-text v-if="camera?.enabled" type="primary" size="small">Đang áp dụng: {{ camera.body || 'Cinema camera' }} · {{ camera.lens || 'Lens mặc định' }} · {{ camera.focalLength }} mm · f/{{ camera.aperture }}</el-text>
    <el-input v-model="presetName" maxlength="60" :disabled="disabled" placeholder="Tên preset dùng chung" aria-label="Tên preset camera" />
    <div class="presetActions">
      <el-button size="small" :disabled="disabled || !presetName.trim()" @click="savePreset">Lưu preset</el-button>
      <el-select v-model="selectedName" class="presetSelect" clearable filterable :disabled="disabled" placeholder="Preset đã lưu" aria-label="Preset camera dùng chung">
        <el-option v-for="item in savedPresets" :key="item.name" :value="item.name" :label="item.name" />
      </el-select>
      <el-button size="small" :disabled="disabled || !selectedName" @click="applyPreset">Áp dụng</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElButton, ElInput, ElInputNumber, ElMessage, ElOption, ElSelect, ElSwitch, ElText } from "element-plus";
import { aperturePresets, cameraBodies, cameraLenses, normalizeCameraSettings, type CameraSettings } from "../cameraStudio";
defineProps<{ disabled?: boolean }>();
const camera = defineModel<CameraSettings | undefined>({ default: undefined });
const savedPresets = ref<{ name: string; camera: CameraSettings }[]>([]);
const presetName = ref("");
const selectedName = ref("");
const storageKey = "toonflowCameraStudioPresetsV1";
function update(key: keyof CameraSettings, value: string | number | boolean) {
  camera.value = normalizeCameraSettings({ ...normalizeCameraSettings(camera.value), [key]: value });
}
function loadPresets() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(value)) return;
    savedPresets.value = value.filter(item => item && typeof item.name === "string"
      && item.name.length > 0 && item.name.length <= 60 && item.camera && typeof item.camera === "object")
      .slice(-30).map(item => ({ name: item.name as string, camera: normalizeCameraSettings(item.camera) }));
  } catch { savedPresets.value = []; }
}
function savePreset() {
  const name = presetName.value.trim();
  if (!name) return;
  const list = [...savedPresets.value.filter(item => item.name !== name),
    { name, camera: normalizeCameraSettings(camera.value) }].slice(-30);
  try {
    localStorage.setItem(storageKey, JSON.stringify(list));
    savedPresets.value = list;
    selectedName.value = name;
    ElMessage.success("Đã lưu preset dùng chung trên trình duyệt");
  } catch { ElMessage.error("Trình duyệt không cho phép lưu preset"); }
}
function applyPreset() {
  const item = savedPresets.value.find(item => item.name === selectedName.value);
  if (!item) return void ElMessage.warning("Không tìm thấy preset đã chọn");
  camera.value = normalizeCameraSettings(item.camera);
}
onMounted(loadPresets);
</script>

<style scoped lang="scss">
.cameraStudio {
  display: flex; flex-direction: column; gap: 8px; padding-top: 12px;
  border-top: 1px solid var(--el-border-color-light);
  > label, .cameraPair label { font-size: 12px; color: var(--el-text-color-secondary); }
  .cameraHeading { display: flex; align-items: center; justify-content: space-between; gap: 8px; strong { font-size: 13px; } }
  .cameraPair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
    > div { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  }
  .presetActions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
    .presetSelect { min-width: 120px; flex: 1; }
  }
}
</style>
