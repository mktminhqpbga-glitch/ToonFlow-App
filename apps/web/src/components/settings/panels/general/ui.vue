<template>
  <div class="ui">
    <p class="intro">Tùy chỉnh không gian sáng tạo theo thói quen của bạn. Các thay đổi được lưu tự động.</p>

    <section v-if="isMobile" class="settingSection" aria-labelledby="mobileScaleTitle">
      <div class="settingHeader">
        <h3 id="mobileScaleTitle">Tỉ lệ giao diện</h3>
        <span class="settingValue">{{ mobileScale }}%</span>
      </div>
      <p class="description">Thu nhỏ để hiển thị nhiều nội dung hơn; bạn vẫn có thể chỉnh riêng cỡ chữ.</p>
      <el-slider
        v-model="mobileScale"
        class="settingSlider"
        :min="50"
        :max="100"
        :step="5"
        :marks="{ 50: '50%', 75: '75% (mặc định)', 100: '100%' }"
        showStops
        aria-label="Tỉ lệ giao diện"
        @change="value => typeof value === 'number' && updateUiSettings({ mobileScale: value })" />
    </section>

    <section class="settingSection" aria-labelledby="languageTitle">
      <h3 id="languageTitle"><icon-language :size="18" />Ngôn ngữ</h3>
      <p class="description">Ngôn ngữ giao diện được áp dụng ngay. Mặc định là tiếng Việt.</p>
      <languageSelect class="languageCards" />
    </section>

    <section class="settingSection" aria-labelledby="themeTitle">
      <h3 id="themeTitle">
        <icon-sun-moon :size="18" />
        Chế độ giao diện
      </h3>
      <el-radio-group
        class="themeOptions"
        :modelValue="uiSettings.theme"
        aria-label="Chế độ giao diện"
        @click="captureThemeClickPoint"
        @change="(value) => changeTheme(String(value))">
        <el-radio v-for="item in themes" :key="item.value" :value="item.value" border>
          <span class="themeLabel">
            <component :is="item.icon" :size="22" />
            <strong>{{ item.label }}</strong>
            <small>{{ item.description }}</small>
          </span>
        </el-radio>
      </el-radio-group>
    </section>

    <section class="settingSection" aria-labelledby="colorTitle">
      <div class="settingHeader">
        <h3 id="colorTitle">
          <icon-palette :size="18" />
          Màu chủ đề
        </h3>
        <span class="settingValue">{{ uiSettings.primaryColor.toUpperCase() }}</span>
      </div>
      <p class="description">Áp dụng cho nút bấm, trạng thái chọn và nền sáng tạo.</p>
      <div class="colorOptions">
        <el-button
          v-for="color in colors"
          :key="color.value"
          class="colorSwatch"
          circle
          :style="{ '--swatchColor': color.value }"
          :aria-label="color.label"
          :aria-pressed="uiSettings.primaryColor.toLowerCase() === color.value"
          :title="color.label"
          @click="updateUiSettings({ primaryColor: color.value })">
          <icon-check v-if="uiSettings.primaryColor.toLowerCase() === color.value" :size="18" />
        </el-button>
        <el-color-picker
          :modelValue="uiSettings.primaryColor"
          colorFormat="hex"
          aria-label="Tùy chỉnhMàu chủ đề"
          @change="changeColor" />
        <span class="description">Tùy chỉnh</span>
      </div>
    </section>

    <section class="settingSection" aria-labelledby="fontTitle">
      <div class="settingHeader">
        <h3 id="fontTitle">
          <icon-text-size :size="18" />
          Cỡ chữ
        </h3>
        <span class="settingValue">{{ fontScale }}%</span>
      </div>
      <p class="description">Điều chỉnh đồng bộ cỡ chữ của giao diện, hội thoại và node.</p>
      <el-slider
        v-model="fontScale"
        class="settingSlider"
        :min="85"
        :max="125"
        :step="5"
        :marks="{ 85: 'Nhỏ hơn', 100: 'Mặc định', 125: 'Lớn hơn' }"
        aria-label="Cỡ chữ"
        @change="(value) => typeof value === 'number' && updateUiSettings({ fontScale: value })" />
    </section>

    <section class="settingSection" aria-labelledby="radiusTitle">
      <div class="settingHeader">
        <h3 id="radiusTitle">
          <icon-border-radius :size="18" />
          Độ bo góc giao diện
        </h3>
        <span class="settingValue">{{ radius }} px</span>
      </div>
      <el-slider
        v-model="radius"
        class="settingSlider"
        :min="0"
        :max="16"
        :step="2"
        :marks="{ 0: 'Góc vuông', 8: 'Mặc định', 16: 'Bo tròn' }"
        aria-label="Độ bo góc giao diện"
        @change="(value) => typeof value === 'number' && updateUiSettings({ radius: value })" />
    </section>

    <el-card class="appearancePreview" shadow="never">
      <div class="previewIcon"><icon-sparkles :size="20" /></div>
      <div class="previewText">
        <strong>Toonflow - Mọi ý tưởng đều xứng đáng được thể hiện</strong>
        <p>Đây là bản xem trước màu sắc, phông chữ và góc bo hiện tại.</p>
      </div>
      <el-tag type="primary" effect="light">Xem trước</el-tag>
    </el-card>

    <div class="settingsFooter">
      <el-button :icon="IconRestore" @click="updateUiSettings({ ...defaultUiSettings, language: uiSettings.language, startupAnimation: uiSettings.startupAnimation })">Khôi phục cài đặt giao diện mặc định</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watchEffect } from "vue";
import {
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconSunMoon,
  IconPalette,
  IconSparkles,
  IconCheck,
  IconRestore,
} from "@tabler/icons-vue";
import { defaultUiSettings, uiSettings, updateUiSettings } from "@/stores/settings";
import { isMobile } from "@/lib/platform";
import languageSelect from "@/components/languageSelect.vue";

const mobileScale = ref(uiSettings.value.mobileScale);
const fontScale = ref(uiSettings.value.fontScale);
const radius = ref(uiSettings.value.radius);
watchEffect(() => {
  mobileScale.value = uiSettings.value.mobileScale;
  fontScale.value = uiSettings.value.fontScale;
  radius.value = uiSettings.value.radius;
});

const themes = [
  { value: "light", label: "Sáng", description: "Sáng và rõ", icon: IconSun },
  { value: "dark", label: "Tối", description: "Tập trung sáng tạo", icon: IconMoon },
  { value: "system", label: "Theo hệ thống", description: "Tự động chuyển", icon: IconDeviceDesktop },
];
const colors = [
  { value: "#409eff", label: "Xanh da trời" },
  { value: "#6366f1", label: "Tím diên vĩ" },
  { value: "#a855f7", label: "Tím oải hương" },
  { value: "#e34b83", label: "Hồng phấn" },
  { value: "#e89524", label: "Cam hổ phách" },
  { value: "#18a17c", label: "Xanh ngọc" },
];
function changeColor(value: string | null) {
  if (value) updateUiSettings({ primaryColor: value });
}

// ACT: 圆心固定用视口中心，实际点击坐标由 captureThemeClickPoint 在 change 前写入。
let themeClickPoint = { x: innerWidth / 2, y: innerHeight / 2 };
function captureThemeClickPoint(event: MouseEvent) {
  themeClickPoint = { x: event.clientX, y: event.clientY };
}
function changeTheme(value: string) {
  const { x, y } = themeClickPoint;
  const root = document.documentElement;
  root.style.setProperty("--themeX", `${x}px`);
  root.style.setProperty("--themeY", `${y}px`);
  root.style.setProperty("--themeR", `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
  if (!document.startViewTransition) {
    updateUiSettings({ theme: value });
    return;
  }
  document.startViewTransition(async () => {
    updateUiSettings({ theme: value });
    await nextTick();
  });
}
</script>

<style lang="scss" scoped>
.ui {
  display: flex;
  flex-direction: column;
  gap: 24px;

  .intro,
  .description {
    margin: 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.6;
  }

  .settingSection {
    min-width: 0;

    h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px;
      color: var(--el-text-color-primary);
      font-size: 14px;
      font-weight: 600;
    }

    .settingHeader {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;

      h3 {
        margin-bottom: 6px;
      }
      .settingValue {
        color: var(--el-text-color-secondary);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }
    }

    .languageCards { margin-top: 14px; }

    .themeOptions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      width: 100%;

      :deep(.el-radio) {
        height: auto;
        margin: 0;
        padding: 14px 10px;
        align-items: flex-start;
        background: var(--el-fill-color-extra-light);

        &.is-checked {
          background: var(--el-color-primary-light-9);
        }
        .el-radio__input {
          margin-top: 4px;
        }
        .el-radio__label {
          min-width: 0;
          padding-left: 8px;
        }
      }

      .themeLabel {
        display: flex;
        flex-direction: column;
        gap: 8px;
        white-space: normal;

        strong {
          font-size: 13px;
          font-weight: 500;
        }
        small {
          color: var(--el-text-color-secondary);
          font-size: 12px;
        }
      }
    }

    .colorOptions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 14px;

      .colorSwatch {
        width: 30px;
        height: 30px;
        margin: 0;
        border: 0;
        color: #fff;
        background: var(--swatchColor);

        &[aria-pressed="true"] {
          outline: 2px solid var(--swatchColor);
          outline-offset: 3px;
        }
        &:focus-visible {
          outline: 2px solid var(--el-text-color-primary);
          outline-offset: 3px;
        }
      }
    }

    .settingSlider {
      width: calc(100% - 48px);
      margin: 10px 24px 20px;

      :deep(.el-slider__stop) {
        background-color: var(--el-text-color-secondary);
        box-shadow: 0 0 0 1px var(--el-bg-color-overlay);
      }
    }
  }

  .appearancePreview {
    background: var(--el-fill-color-extra-light);

    :deep(.el-card__body) {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px;
    }
    .previewIcon {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: var(--el-border-radius-base);
      background: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
    }
    .previewText {
      flex: 1;
      min-width: 0;
      strong {
        font-size: 15px;
        font-weight: 500;
        color: var(--el-text-color-primary);
      }
      p {
        margin: 6px 0 0;
        color: var(--el-text-color-secondary);
        font-size: 12px;
        line-height: 1.6;
      }
    }
  }

  .settingsFooter {
    display: flex;
    justify-content: flex-end;
  }

  @media (max-width: 700px) {
    .settingSection .themeOptions {
      grid-template-columns: 1fr;
      .themeLabel {
        flex-direction: row;
        align-items: center;
        flex-wrap: wrap;
      }
    }
    .appearancePreview {
      :deep(.el-card__body) {
        flex-wrap: wrap;
        padding: 12px;
      }
    }
  }
}
</style>
