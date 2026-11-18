<template>
  <mini-map
    v-if="showMap"
    class="canvasMiniMap"
    position="bottom-left"
    :pannable="true"
    :zoomable="true"
    nodeColor="var(--el-fill-color-dark)"
    maskColor="var(--el-mask-color-extra-light)"
    @click="({ position }) => setCenter(position.x, position.y, { zoom: viewport.zoom, duration: 250 })" />
  <panel class="canvasControlsPanel" position="bottom-left">
    <el-card class="canvasControlsCard" shadow="never" :bodyStyle="{ padding: '2px 4px' }">
      <div class="canvasControls">
        <el-tooltip v-if="currentUser?.role !== 'user'" :showArrow="false" :content="assetsVisible ? 'Đóng thư viện tài nguyên' : 'Mở thư viện tài nguyên'" placement="top" :hideAfter="0" :enterable="false" :triggerKeys="[]">
          <el-button
            class="toolButton"
            text
            :type="assetsVisible ? 'primary' : 'default'"
            :aria-pressed="assetsVisible"
            aria-label="Thư viện tài nguyên"
            @click="assetsVisible = !assetsVisible">
            <icon-folders :size="18" />
          </el-button>
        </el-tooltip>
        <!-- trigger 用 contextmenu 是为了让整理按钮只由 arrangeNodes 控制显隐，同时仍保留点击外部自动关闭 -->
        <el-tooltip :showArrow="false" content="Sắp xếp Canvas" placement="top" :hideAfter="0" :enterable="false" :triggerKeys="[]" :disabled="undoPopoverVisible">
          <span class="toolTrigger">
            <el-popover trigger="contextmenu" placement="top-start" :width="180" v-model:visible="undoPopoverVisible">
              <template #reference>
                <el-button class="toolButton" text :disabled="!canArrange" aria-label="Sắp xếp Canvas" @click="arrangeNodes">
                  <icon-sitemap :size="18" />
                </el-button>
              </template>
              <div class="zoomMenu">
                <el-button class="zoomAction" style="width: 100%" text @click="undoArrange">Hoàn tác sắp xếp</el-button>
              </div>
            </el-popover>
          </span>
        </el-tooltip>
        <el-tooltip :showArrow="false" :content="showMap ? 'Ẩn bản đồ' : 'Hiện bản đồ'" placement="top" :hideAfter="0" :enterable="false" :triggerKeys="[]">
          <el-button
            class="toolButton"
            text
            :type="showMap ? 'primary' : 'default'"
            :aria-pressed="showMap"
            aria-label="Hiện hoặc ẩn bản đồ"
            @click="showMap = !showMap">
            <icon-map :size="18" />
          </el-button>
        </el-tooltip>
        <el-tooltip :showArrow="false" :content="snapEnabled ? 'Tắt căn vào lưới' : 'Bật căn vào lưới'" placement="top" :hideAfter="0" :enterable="false" :triggerKeys="[]">
          <el-button
            class="toolButton"
            text
            :type="snapEnabled ? 'primary' : 'default'"
            :aria-pressed="snapEnabled"
            aria-label="Căn vào lưới"
            @click="snapEnabled = !snapEnabled">
            <icon-magnet :size="18" />
          </el-button>
        </el-tooltip>
        <el-tooltip :showArrow="false" :content="showEdges ? 'Ẩn dây nối' : 'Hiện dây nối'" placement="top" :hideAfter="0" :enterable="false" :triggerKeys="[]">
          <el-button
            class="toolButton"
            text
            :type="showEdges ? 'primary' : 'default'"
            :aria-pressed="showEdges"
            aria-label="Hiện hoặc ẩn dây nối"
            @click="showEdges = !showEdges">
            <icon-arrow-guide :size="18" />
          </el-button>
        </el-tooltip>
        <el-tooltip :showArrow="false" content="Vừa khung nhìn" placement="top" :hideAfter="0" :enterable="false" :triggerKeys="[]">
          <el-button class="toolButton" text aria-label="Vừa khung nhìn" @click="fitView({ duration: 250 })">
            <icon-focus-centered :size="18" />
          </el-button>
        </el-tooltip>
        <el-tooltip :showArrow="false"
          content="Menu thu phóng (điều chỉnh bằng con lăn)"
          placement="top"
          :hideAfter="0"
          :enterable="false"
          :triggerKeys="[]"
          :disabled="zoomMenuVisible">
          <span class="toolTrigger">
            <el-popover v-model:visible="zoomMenuVisible" trigger="click" placement="top-start" :width="216">
              <template #reference>
                <el-button
                  class="toolButton"
                  text
                  aria-label="Menu thu phóng"
                  @wheel.stop.prevent="$event.deltaY && applyZoom(Math.min(800, Math.max(20, zoomPercent - Math.sign($event.deltaY))))">
                  {{ zoomPercent }}%
                </el-button>
              </template>
              <div class="zoomMenu">
                <el-input-number
                  class="zoomInput"
                  :model-value="zoomPercent"
                  :min="20"
                  :max="800"
                  :controls="false"
                  aria-label="Phần trăm thu phóng"
                  @change="applyZoom">
                  <template #suffix>%</template>
                </el-input-number>
                <el-button class="zoomAction" text @click="zoomIn()">Phóng to</el-button>
                <el-button class="zoomAction" text @click="zoomOut()">Thu nhỏ</el-button>
                <el-button class="zoomAction" text @click="fitView({ duration: 250 })">Vừa màn hình</el-button>
              </div>
            </el-popover>
          </span>
        </el-tooltip>
      </div>
    </el-card>
  </panel>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Panel, useVueFlow, type XYPosition } from "@vue-flow/core";
import { MiniMap } from "@vue-flow/minimap";
import { IconMap, IconMagnet, IconFocusCentered } from "@tabler/icons-vue";
import { ElMessage } from "element-plus";
import { currentUser } from "@/stores/multiTenant";
import { arrangeCanvas } from "../arrangeCanvas";

const props = defineProps<{
  canvasId: string;
  directory: string | undefined;
  batchHistory: (action: () => Promise<void>) => Promise<void>;
}>();
const snapEnabled = defineModel<boolean>("snapEnabled", { required: true });
const showEdges = defineModel<boolean>("showEdges", { required: true });
const assetsVisible = defineModel<boolean>("assetsVisible", { default: false });
const showMap = ref(false);
const zoomMenuVisible = ref(false);
const flow = useVueFlow();
const { viewport, zoomTo, zoomIn, zoomOut, fitView, setCenter, getNodes, updateNode } = flow;
const zoomPercent = computed(() => Math.round(viewport.value.zoom * 100));
const layoutSnapshot = ref<{ id: string; position: XYPosition }[]>();
const undoPopoverVisible = ref(false);
const arranging = ref(false);
let arrangeController: AbortController | undefined;
const canArrange = computed(() => {
  const nodes = getNodes.value.filter((node) => !node.parentNode);
  return (
    !!props.canvasId &&
    !!props.directory &&
    !arranging.value &&
    nodes.length > 0 &&
    nodes.every((node) => node.dimensions.width > 0 && node.dimensions.height > 0)
  );
});
defineExpose({ arrangeNodes });

watch(
  () => [props.canvasId, props.directory],
  () => {
    arrangeController?.abort();
    layoutSnapshot.value = undefined;
    undoPopoverVisible.value = false;
  },
  { flush: "sync" }
);
onBeforeUnmount(() => arrangeController?.abort());

function applyZoom(value: number | undefined) {
  if (value !== undefined && Number.isFinite(value)) void zoomTo(value / 100);
}

async function arrangeNodes() {
  if (!canArrange.value) return;
  const controller = new AbortController();
  arrangeController = controller;
  arranging.value = true;
  try {
    await props.batchHistory(async () => {
      const { snapshot, arrangedNodeIds } = await arrangeCanvas(flow, controller.signal);
      controller.signal.throwIfAborted();
      if (!arrangedNodeIds.length) return;
      layoutSnapshot.value = snapshot;
      undoPopoverVisible.value = true;
    });
  } catch (error) {
    if (!controller.signal.aborted) ElMessage.error(error instanceof Error ? error.message : "Sắp xếp Canvas thất bại");
  } finally {
    arrangeController = undefined;
    arranging.value = false;
  }
}

async function undoArrange() {
  const snapshot = layoutSnapshot.value;
  if (!snapshot) return;
  try {
    await props.batchHistory(async () => {
      const nodeIds = new Set(getNodes.value.map((node) => node.id));
      snapshot.forEach(({ id, position }) => {
        if (nodeIds.has(id)) updateNode(id, { position });
      });
      layoutSnapshot.value = undefined;
      undoPopoverVisible.value = false;
    });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Hoàn tác sắp xếp thất bại");
  }
}
</script>

<style lang="scss" scoped>
.canvasMiniMap.vue-flow__minimap { bottom: 46px; }

@container canvasWorkspace (max-width: 1040px) {
  .canvasControlsPanel.vue-flow__panel { bottom: 46px; }
  .canvasMiniMap.vue-flow__minimap { bottom: 92px; }
}

.canvasControlsCard { height: 34px; box-sizing: border-box; }

.canvasControls {
  display: flex;
  align-items: center;
  gap: 2px;

  .toolTrigger {
    display: inline-flex;
  }

  .toolButton {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    margin-left: 0;
    padding: 0;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
}

.zoomMenu {
  display: flex;
  flex-direction: column;

  .zoomInput {
    width: 100%;
  }

  .zoomAction {
    justify-content: flex-start;
    margin-left: 0;
  }
}
</style>
