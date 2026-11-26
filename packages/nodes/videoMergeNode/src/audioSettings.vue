<template>
  <fieldset class="audioSettings" :disabled="disabled">
    <label class="gain">
      <span>Âm thanh gốc</span>
      <input v-model.number="settings.originalVolume" type="range" min="0" max="200" />
      <span>{{ settings.originalVolume }}%</span>
    </label>
    <div v-for="{ kind, label } in fields" :key="kind" class="track">
      <div class="trackHeader">
        <strong>{{ label }}</strong>
        <template v-if="!connections[kind]">
          <label class="fileButton">
            <span>{{ trackFile(kind) ? "Đổi tệp" : "Chọn tệp" }}</span>
            <input type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac" :aria-label="'Chọn tệp ' + label.toLowerCase()" @change="emit('upload', kind, $event)" />
          </label>
          <el-button v-if="trackFile(kind)" :disabled="disabled" text :icon="IconX" :aria-label="'Bỏ tệp ' + label.toLowerCase()" @click="emit('remove', kind)" />
        </template>
      </div>
      <small v-if="connections[kind] || trackFile(kind)" :class="{ trackError: connections[kind]?.error }" :title="connections[kind]?.label || trackFile(kind)?.name">
        {{ connections[kind]?.label || trackFile(kind)?.name }}
      </small>
      <small v-else>Chọn tệp hoặc nối node Âm thanh vào cổng {{ label.toLowerCase() }}.</small>
      <label v-if="connections[kind] || trackFile(kind)" class="gain">
        <span>Âm lượng {{ label.toLowerCase() }}</span>
        <input v-model.number="settings[kind === 'music' ? 'musicVolume' : 'voiceVolume']" type="range" min="0" max="200" />
        <span>{{ settings[kind === 'music' ? 'musicVolume' : 'voiceVolume'] }}%</span>
      </label>
      <div v-if="kind === 'music' && (connections.music || settings.musicFile)" class="musicOptions">
        <label><input v-model="settings.loop" type="checkbox" /> Lặp nhạc đến hết video</label>
        <label><input v-model="settings.fade" type="checkbox" /> Tăng/giảm dần ở đầu và cuối</label>
        <label><input v-model="settings.duck" type="checkbox" /> Hạ nhạc khi có lời đọc</label>
      </div>
      <label v-if="kind === 'voice' && (connections.voice || settings.voiceFile)" class="offset">
        Bắt đầu lời đọc ở giây
        <input v-model.number="settings.voiceOffset" type="number" min="0" step="0.1" />
      </label>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import { ElButton } from "element-plus";
import { IconX } from "@tabler/icons-vue";
import type { AudioSettings } from "./audioMix";

type TrackKind = "music" | "voice";
defineProps<{ disabled: boolean; connections: Partial<Record<TrackKind, { label: string; error?: boolean }>> }>();
const settings = defineModel<AudioSettings>({ required: true });
const emit = defineEmits<{ upload: [kind: TrackKind, event: Event]; remove: [kind: TrackKind] }>();
const fields = [{ kind: "music", label: "Nhạc nền" }, { kind: "voice", label: "Lời đọc" }] as const;
const trackFile = (kind: TrackKind) => kind === "music" ? settings.value.musicFile : settings.value.voiceFile;
</script>

<style scoped>
.audioSettings { display: grid; gap: 8px; border: 0; margin: 0; padding: 0; min-width: 0; font-size: 12px; }
.track { display: grid; gap: 6px; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; padding: 7px; }
.trackHeader, .gain, .offset, .musicOptions label { display: flex; align-items: center; gap: 6px; }
.trackHeader strong { margin-right: auto; }
.track small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--el-text-color-secondary); }
.track .trackError { white-space: normal; color: var(--el-color-danger); }
.gain input { flex: 1; min-width: 20px; accent-color: var(--el-color-primary); }
.gain span:last-child { min-width: 34px; text-align: right; font-variant-numeric: tabular-nums; }
.fileButton { position: relative; overflow: hidden; border: 1px solid var(--el-border-color); border-radius: 4px; padding: 4px 7px; cursor: pointer; }
.fileButton:focus-within { outline: 2px solid var(--el-color-primary); outline-offset: 2px; }
.fileButton input { position: absolute; inset: 0; width: 100%; opacity: 0; cursor: pointer; }
.musicOptions { display: grid; gap: 3px; }
.offset input { box-sizing: border-box; width: 74px; color: var(--el-text-color-primary); background: var(--el-bg-color); border: 1px solid var(--el-border-color); border-radius: 4px; font: inherit; padding: 4px 6px; }
</style>
