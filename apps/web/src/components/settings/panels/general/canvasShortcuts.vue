<template>
  <section class="canvasShortcuts" aria-labelledby="canvasShortcutsTitle">
    <div class="shortcutHeader">
      <h3 id="canvasShortcutsTitle">Phím tắt Canvas</h3>
      <div class="shortcutActions">
        <el-dropdown trigger="click" @command="changeBindMode" @visibleChange="bindModeVisible = $event">
          <el-button text size="small" aria-label="Cách gán phím tắt">
            {{ bindMode === 'listen' ? 'Ghi nhận phím' : 'Nhập thủ công' }}
            <component :is="bindModeVisible ? IconChevronUp : IconChevronDown" :size="14" aria-hidden="true" />
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="listen" :icon="IconKeyboard">Ghi nhận phím</el-dropdown-item>
              <el-dropdown-item command="input" :icon="IconEdit">Nhập thủ công</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button text size="small" :icon="IconRestore" @click="resetShortcuts">Khôi phục mặc định</el-button>
      </div>
    </div>
    <p class="description">
      {{ bindMode === "listen" ? "Nhấn ô phím để ghi nhận, Esc để thoát; dấu × ở bên phải để bỏ gán, dùng menu mũi tên để chọn không cần phím." : "Dùng tên phím như Ctrl+KeyG / Alt+KeyG; None là không cần phím, có thể nhập None / Space; để trống để bỏ gán, Enter hoặc rời ô để lưu." }}
    </p>
    <p class="description">Trước khi đặt kéo Canvas thành không cần phím, hãy gán thao tác khoanh chọn node sang phím như Shift.</p>
    <el-form class="shortcutList">
      <el-form-item v-for="field in canvasShortcutFields" :key="`${field.id}:${resetKey}`" class="shortcutItem" :error="issues[field.id]">
        <div class="shortcutRow">
          <div class="shortcutInfo">
            <span class="shortcutName">{{ field.label }}</span>
            <span v-if="field.hold" class="shortcutHint">{{ shortcutDescriptions[field.id] }}</span>
          </div>
          <keyInput
            class="shortcutInput"
            :code="generalSettings.canvasShortcuts[field.id]"
            :mode="bindMode"
            :label="`${field.label}Phím tắt`"
            :hold="field.hold"
            :allowNone="field.allowNone"
            @change="setShortcut(field.id, $event)" />
        </div>
      </el-form-item>
      <div class="gestureRow"><span>Thu phóng bằng bàn di chuột</span><span class="gestureValue"><icon-hand-two-fingers :size="16" />Chụm hai ngón tay</span></div>
      <div class="gestureRow"><span>Vuốt hai ngón trên bàn di chuột</span><span class="gestureValue"><icon-hand-two-fingers :size="16" />Theo cài đặt con lăn</span></div>
      <div class="gestureRow"><span>Kéo bằng chuột</span><span class="gestureValue"><icon-mouse :size="16" />Kéo bằng nút giữa</span></div>
    </el-form>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { t, translate } from "@toonflow/i18n/vue";
import { IconRestore, IconChevronDown, IconChevronUp, IconKeyboard, IconEdit, IconHandTwoFingers, IconMouse } from "@tabler/icons-vue";
import { generalSettings, updateGeneralSettings } from "@/stores/settings";
import { canvasShortcutFields, defaultCanvasShortcuts, getShortcutBindings, isShortcutAllowed, normalizeShortcut, type CanvasShortcutAction } from "@/lib/canvasShortcuts";
import keyInput from "./keyInput.vue";

const bindMode = ref<"listen" | "input">("listen");
const bindModeVisible = ref(false);
const resetKey = ref(0);
const issues = ref<Partial<Record<CanvasShortcutAction, string>>>({});
const shortcutDescriptions: Partial<Record<CanvasShortcutAction, string>> = {
  copyOnDrag: "Nhấn giữ và kéo node",
  duplicateOnDrag: "Nhấn giữ và kéo node",
  zoom: "Cuộn chuột theo cấu hình",
  pan: "Không cần phím thì chỉ kéo trên vùng trống",
  selection: "Kéo chuột trái trên vùng trống để khoanh chọn",
  multiSelection: "Nhấp chuột trái để thêm hoặc bỏ chọn",
};

function changeBindMode(mode: "listen" | "input") {
  bindMode.value = mode;
  issues.value = {};
}

function setShortcut(action: CanvasShortcutAction, value: string) {
  const binding = normalizeShortcut(value);
  const field = canvasShortcutFields.find(field => field.id === action)!;
  if (binding === undefined || !isShortcutAllowed(field, binding)) {
    issues.value[action] = binding === undefined ? translate("请输入有效按键，例如 Ctrl+KeyG / Alt+KeyG。")
      : field.gesture === "drag" ? translate("拖拽操作只绑定修饰键，例如 Alt 或 Ctrl+Alt。")
      : field.gesture === "click" ? translate("追加选择只绑定修饰键，例如 Ctrl 或 Meta。") : translate("此操作需要普通按键，例如 KeyP 或 Ctrl+KeyZ。");
    return;
  }
  const bindings = getShortcutBindings(binding);
  const conflict = canvasShortcutFields.find(other => other.id !== action && other.gesture === field.gesture
    && getShortcutBindings(generalSettings.value.canvasShortcuts[other.id]).some(value => bindings.includes(value)));
  if (conflict) {
    issues.value[action] = t`与「${conflict.label}」重复，请换一个快捷键。`;
    return;
  }
  delete issues.value[action];
  updateGeneralSettings({ canvasShortcuts: { ...generalSettings.value.canvasShortcuts, [action]: binding } });
}

function resetShortcuts() {
  issues.value = {};
  resetKey.value++;
  updateGeneralSettings({ canvasShortcuts: { ...defaultCanvasShortcuts } });
}
</script>

<style lang="scss" scoped>
.canvasShortcuts {
  container-type: inline-size;

  .shortcutHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;

    h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    .shortcutActions {
      display: flex;
      align-items: center;
      gap: 4px;

      .el-button { margin-left: 0; }
      svg { margin-left: 4px; }
    }
  }

  .description {
    margin: 8px 0 12px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--el-text-color-secondary);
  }
  .shortcutList {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 4px 28px;

    .shortcutItem {
      min-width: 0;
      margin: 0;
      padding: 5px 0;

      :deep(.el-form-item__content) { min-width: 0; }
      :deep(.el-form-item__error) {
        position: static;
        padding-top: 4px;
        line-height: 1.5;
      }

      .shortcutRow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        width: 100%;
        min-height: 32px;

        .shortcutInfo {
          flex-shrink: 0;
          max-width: 50%;
          line-height: 1.5;

          .shortcutName { font-size: 13px; }
          .shortcutHint {
            display: block;
            color: var(--el-text-color-secondary);
            font-size: 11px;
          }
        }

        .shortcutInput { flex: 1; min-width: 0; }
      }
    }

    .gestureRow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 42px;
      color: var(--el-text-color-secondary);
      font-size: 12px;

      .gestureValue { display: inline-flex; align-items: center; gap: 6px; }
    }
  }

  @container (max-width: 560px) {
    .shortcutList { grid-template-columns: minmax(0, 1fr); }
  }
}
</style>
