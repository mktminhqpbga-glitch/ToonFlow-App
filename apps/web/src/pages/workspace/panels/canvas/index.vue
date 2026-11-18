<template>
  <div
    ref="canvasElement"
    class="canvas"
    :class="{ canvasUnselected: !canvasId, edgesHidden: !showEdges, handMode, multiSelectionMode: flow.multiSelectionActive.value, compositingEnabled: generalSettings.canvasCompositingEnabled }"
    :style="{ '--canvasEdgeColor': generalSettings.canvasEdgeColorMode === 'custom' ? generalSettings.canvasEdgeColor : 'var(--el-color-primary)' }"
    @dblclick="openNodeMenu"
    @wheel.capture="zoomCanvas"
    @gesturestart.capture="zoomCanvas"
    @gesturechange.capture="zoomCanvas"
    @gestureend.capture="zoomCanvas"
    @pointerdown.capture="updateCanvasSelection"
    @click.capture="updateCanvasSelection"
    @auxclick.capture="preventMiddleClick"
    @pointermove="pointerPosition = { x: $event.clientX, y: $event.clientY }; if (!$event.buttons) updateCanvasSelection($event)"
    @pointerleave="pointerPosition = undefined"
    @dragover="dragFilesOver"
    @drop="dropFiles">
    <vue-flow
      :id="runtimeKey"
      :only-render-visible-elements="false"
      :nodes-draggable="true"
      :node-types="nodeTypes"
      :snap-to-grid="snapEnabled"
      :snap-grid="[16, 16]"
      :min-zoom="0.2"
      :max-zoom="8"
      :nodes-connectable="true"
      :connection-mode="ConnectionMode.Strict"
      :nodes-focusable="false"
      :edges-focusable="false"
      :edges-updatable="false"
      :elevate-nodes-on-select="true"
      :elevate-edges-on-select="false"
      :disable-keyboard-a11y="true"
      :selectNodesOnDrag="false"
      :auto-pan-on-node-drag="false"
      :auto-pan-on-connect="false"
      :zoom-on-double-click="false"
      :zoomOnScroll="false"
      :zoomOnPinch="active && !settingsVisible"
      :panOnScroll="active && !settingsVisible && !defaultWheelZoom"
      :panOnScrollSpeed="1"
      :panOnDrag="handMode || isMobile ? true : defaultDragPan ? [0, 1] : [1]"
      :panOnScrollMode="PanOnScrollMode.Free"
      :delete-key-code="null"
      :selectionKeyCode="active && !settingsVisible && !handMode && !isMobile && selectionKeyPressed"
      :selectionMode="SelectionMode.Partial"
      :multi-selection-key-code="null"
      :zoomActivationKeyCode="zoomKeyPressed ? true : null"
      :pan-activation-key-code="null"
      v-model="flowData"
      @connect="addEdges"
      @edgeClick="showEdgeDisconnect"
      @paneClick="edgeDisconnect = undefined"
      @moveStart="edgeDisconnect = undefined"
      :default-edge-options="defaultEdgeOptions">
      <template v-for="type in remoteNodeTypes" :key="type" #[`node-${type}`]="nodeProps">
        <remoteNode
          v-bind="nodeProps"
          :component="nodeTypes[type]"
          :error="nodeErrors[type]"
          :loading="nodeLoads.has(type) || (nodeListLoading && !nodeTypes[type] && !nodeErrors[type])" />
      </template>
      <background v-if="canvasId" :gap="16" patternColor="var(--el-border-color)" />
      <div v-if="!canvasId" class="canvasOverlay" role="status" @contextmenu.prevent @dragover.prevent @drop.prevent>
        Mở một Canvas ở góc trên bên trái để bắt đầu sáng tạo
      </div>
      <canvasEmpty
        v-if="active && !settingsVisible && project?.directory && canvasReady && !flow.getNodes.value.length"
        :availableNodes="availableNodes"
        @create="createEmptyNode" />
      <canvasViewportHint v-if="active && !settingsVisible && project?.directory && canvasReady" :key="canvasId" />
      <canvasMenu ref="canvasMenuRef" v-model:canvasId="canvasId" :directory="project?.directory" :initialCanvasId="initialCanvasId" :activateCanvas="activateCanvas" :flushSave="flushCanvases ?? flushCanvasSave">
        <assetLibrary v-if="currentUser?.role !== 'user'" ref="assetLibraryRef" v-model="assetsVisible" :directory="project?.directory" />
      </canvasMenu>
      <canvasControls
        v-if="canvasId"
        ref="canvasControlsRef"
        v-model:assetsVisible="assetsVisible"
        v-model:snapEnabled="snapEnabled"
        v-model:showEdges="showEdges"
        :canvasId="canvasId"
        :directory="project?.directory"
        :batchHistory="canvasHistory.batch"
        @update:showEdges="edgeDisconnect = undefined" />
      <nodeMenu
        :key="JSON.stringify(['nodeMenu', project?.directory, canvasId])"
        ref="nodeMenuRef"
        :remoteNodes="availableNodes"
        :disabled="!active || settingsVisible || !project?.directory || !canvasReady"
        :pasteNode="pasteClipboardNode"
        :uploadFiles="canvasId && project?.directory ? selectFiles : undefined"
        :canUndo="canUndo"
        :canRedo="canRedo"
        :selectionBusy="selectionToolbarRef?.busy"
        :batchHistory="canvasHistory.batch"
        @duplicateSelection="selectionToolbarRef?.operate('duplicate')"
        @history="canvasHistory.commit"
        @undo="changeHistory('undo')"
        @redo="changeHistory('redo')" />
      <selectionToolbar
        :key="JSON.stringify(['selectionToolbar', project?.directory, canvasId])"
        ref="selectionToolbarRef"
        :batchHistory="canvasHistory.batch"
        :getSignal="() => canvasController.signal"
        :disabled="!canvasId || !project?.directory" />
      <nodeSearch ref="nodeSearchRef" :disabled="!active || settingsVisible || !canvasId || !project?.directory" />
    </vue-flow>
    <el-dialog v-if="currentUser?.role !== 'user'" :modelValue="!!assetSelection" class="referenceAssetDialog" title="Thư viện tài nguyên toàn cục" width="min(1200px, 88vw)" alignCenter appendToBody destroyOnClose @update:modelValue="finishAssetSelection()">
      <assetLibrary :modelValue="!!assetSelection" expanded :canSelect="canSelectAsset" :selecting="assetSelecting" @select="selectAsset" />
    </el-dialog>
    <teleport to="body">
      <el-button
        v-if="edgeDisconnect && findEdge(edgeDisconnect.id)"
        class="edgeDisconnect"
        type="danger"
        circle
        aria-label="Ngắt kết nối"
        title="Ngắt kết nối"
        :style="{ left: `${edgeDisconnect.x}px`, top: `${edgeDisconnect.y}px` }"
        @click.stop="
          removeEdges(edgeDisconnect.id);
          edgeDisconnect = undefined;
        "
        @mouseleave="edgeDisconnect = undefined">
        <icon-unlink :size="16" />
      </el-button>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { t, translate } from "@toonflow/i18n/vue";
import * as i18nRuntime from "@toonflow/i18n/vue";
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, onScopeDispose, provide, ref, shallowReactive, shallowRef, watch } from "vue";
import axios from "axios";
import { debounce } from "lodash-es";
import { ElMessage, ElMessageBox } from "element-plus";
import { actualPlatform, isMobile } from "@/lib/platform";
import { storeToRefs } from "pinia";
import { IconUnlink } from "@tabler/icons-vue";
import * as vueRuntime from "vue";
import * as vueFlowRuntime from "@vue-flow/core";
import * as elementPlusRuntime from "element-plus";
import * as threeRuntime from "three";
import * as modelIcons from "@toonflow/model-icons";
import { runAgentLoop } from "@earendil-works/pi-agent-core";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import "element-plus/dist/index.css";
import {
  VueFlow,
  PanOnScrollMode,
  ConnectionMode,
  SelectionMode,
  useVueFlow,
  isNode,
  type Node,
  type Edge,
  type GraphEdge,
  type GraphNode,
  type EdgeMouseEvent,
  type NodeTypesObject,
  type XYPosition,
} from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { useCanvasTools } from "./useCanvasTools";
import type { CanvasContext } from "@toonflow/tool-canvas/runtime";
import { loadNodeComponent } from "./loadNodeComponent";
import { useCanvasHistory } from "./useCanvasHistory";
import { copyNodeToClipboard, copyNodesToClipboard, nodeClipboardCommand, readClipboardNodes } from "./nodeClipboard";
import { remapNodeReferences } from "./canvasFiles";
import { readClipboardFiles, readClipboardText, writeClipboardImage } from "@/lib/clipboard";
import nodeMenu from "./components/nodeMenu.vue";
import remoteNode from "./components/remoteNode.vue";
import canvasMenu from "./components/canvasMenu.vue";
import canvasControls from "./components/canvasControls.vue";
import canvasEmpty from "./components/canvasEmpty.vue";
import canvasViewportHint from "./components/canvasViewportHint.vue";
import assetLibrary from "./components/assetLibrary.vue";
import groupNode from "./components/groupNode.vue";
import selectionToolbar from "./components/selectionToolbar.vue";
import nodeSearch from "./components/nodeSearch.vue";
import { finishGroupDrag, fitGroupBounds, getSelectionTree } from "./selectionNodes";
import type { NodeOutput } from "@toonflow/nodes-scaffold/values";
import { validateConnection, type NodeConnectionFeedback, type NodeHandle } from "@toonflow/nodes-scaffold/connection";
import { useNodeEvent } from "@toonflow/nodes-scaffold/nodeEvent";
import type { NodeDocumentContext, NodeDocumentState } from "@toonflow/nodes-scaffold/nodeDocument";
import { useNodeToolsContext } from "@toonflow/nodes-scaffold/nodeTools";
import { useWorkspaceStore } from "@/stores/workspace";
import { currentUser } from "@/stores/multiTenant";
import { generalSettings } from "@/stores/settings";
import { getShortcutBindings, shortcutLabel, shortcutMatches, shortcutPressed } from "@/lib/canvasShortcuts";
import useWorkspaceFiles from "@/lib/workspaceFiles";
import anonymousData from "@/lib/anonymousData";
import type { PromptItem } from "@/lib/promptLibrary";
import { createClipboardMediaFile, dropCanvasFiles, getCanvasFileType, getClipboardMediaFiles, importCanvasFiles, isCanvasFileDrag } from "./canvasDrop";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/minimap/dist/style.css";

const props = withDefaults(defineProps<{
  active?: boolean;
  settingsVisible?: boolean;
  runtimeKey?: string;
  initialCanvasId?: string;
  activateCanvas?: (canvasId: string, signal?: AbortSignal) => Promise<void>;
  resolveCanvasContext?: (canvasId: string) => CanvasContext | undefined;
  flushCanvases?: (action?: () => Promise<void>) => Promise<void>;
}>(), { active: true, settingsVisible: false });
const { project } = storeToRefs(useWorkspaceStore());

const canvasElement = ref<HTMLElement>();
const flowData = ref<(Node | Edge)[]>([]);
const canvasId = ref("");
const nodeMenuRef = ref<InstanceType<typeof nodeMenu>>();
const canvasMenuRef = ref<InstanceType<typeof canvasMenu>>();
const canvasControlsRef = ref<InstanceType<typeof canvasControls>>();
const selectionToolbarRef = ref<InstanceType<typeof selectionToolbar>>();
const nodeSearchRef = ref<InstanceType<typeof nodeSearch>>();
const nodeTypes = shallowRef<NodeTypesObject>({ canvasGroup: markRaw(groupNode) });
const nodeConfigs = shallowRef<Record<string, Record<string, unknown>>>({});
const nodeOptions = ref<{ type: string; label: string }[]>([]);
const nodeLoads = shallowReactive(new Map<string, Promise<void>>());
const nodeReloads = new Set<string>();
const handledPluginEvents = new WeakSet<Event>();
const nodeErrors = ref<Record<string, string>>({});
const availableNodes = computed(() => nodeOptions.value.filter(node => nodeTypes.value[node.type] && !nodeErrors.value[node.type]));
const nodeListLoading = ref(true);
const remoteNodeTypes = computed(() => [
  ...new Set((flowData.value as { type?: string }[]).map((item) => item.type).filter((type): type is string => !!type?.startsWith("remote-"))),
]);
let loadRequest = 0;
const snapEnabled = ref(false);
const zoomKeyPressed = ref(false);
const panKeyPressed = ref(false);
const selectionKeyPressed = ref(false);
const defaultWheelZoom = computed(() => getShortcutBindings(generalSettings.value.canvasShortcuts.zoom).includes("None"));
const defaultDragPan = computed(() => getShortcutBindings(generalSettings.value.canvasShortcuts.pan).includes("None"));
const selectedTool = defineModel<"move" | "hand">("selectedTool", { default: "move" });
const handMode = computed(() => props.active && !props.settingsVisible && (selectedTool.value === "hand" || panKeyPressed.value));
let pointerPosition: XYPosition | undefined;
const pressedCodes = new Set<string>();
let gestureScale: number | undefined;
let copyingNodes = false;
const showEdges = ref(true);
const assetsVisible = ref(false);
const assetLibraryRef = ref<InstanceType<typeof assetLibrary>>();
const edgeDisconnect = ref<{ id: string; x: number; y: number }>();
const flow = useVueFlow(props.runtimeKey);
const nodeDocument: NodeDocumentContext = { targets: shallowReactive(new Map()), mounts: new Map(), states: shallowReactive(new Map()) };
const canvasDirty = ref(false);
const canvasSaveError = ref("");
const documentObservers = new Set<() => void>();
onScopeDispose(() => { for (const release of documentObservers) release(); });
provide("nodeDocument", nodeDocument);
onScopeDispose(anonymousData.observeCanvas(() => props.active && canvasId.value
  ? { nodes: flow.nodes.value, edgeCount: flow.edges.value.length }
  : undefined));
let dragCopy: ReturnType<InstanceType<typeof selectionToolbar>["startDragCopy"]>;
flow.onNodeDragStart(({ event, nodes }) => {
  dragCopy = undefined;
  if (!props.active || props.settingsVisible) return;
  const shortcuts = generalSettings.value.canvasShortcuts;
  const withEdges = shortcutPressed(event, shortcuts.duplicateOnDrag, pressedCodes);
  if (withEdges || shortcutPressed(event, shortcuts.copyOnDrag, pressedCodes)) {
    dragCopy = selectionToolbarRef.value?.startDragCopy(nodes, withEdges);
  }
});
flow.onNodeDrag(() => dragCopy?.update());
flow.onNodeDragStop(({ nodes }) => {
  const copy = dragCopy;
  dragCopy = undefined;
  if (copy) copy.finish();
  else finishGroupDrag(flow.getNodes.value, nodes);
});
const canvasHistory = useCanvasHistory(flow, () =>
  project.value?.directory && canvasId.value ? JSON.stringify([project.value.directory, canvasId.value]) : ""
);
const { canUndo, canRedo } = canvasHistory;
provide("batchCanvasHistory", canvasHistory.batch);
const getNodeTools = useNodeToolsContext();
const { addNodes, addEdges, removeEdges, findEdge, findNode, toObject, viewport, screenToFlowCoordinate } = flow;
provide("copyNodeToClipboard", async (node: Parameters<typeof copyNodeToClipboard>[0]) => {
  const directory = project.value?.directory;
  if (!directory) throw new Error("Hãy chọn thư mục làm việc trước");
  if (await copyImageNodeToClipboard(directory, node)) return;
  await copyNodeToClipboard(node, directory);
});
provide("retainNodeFiles", true);
provide("selectionConnection", shallowRef<NodeConnectionFeedback>());
provide("saveNodeToAssets", currentUser.value?.role === "user" ? undefined : (label: string, outputs: { label: string; output: NodeOutput }[]) => assetLibraryRef.value?.openSave(label, outputs));
let canvasController = new AbortController();
let workspaceController = new AbortController();
type AssetReference = { source: string; sourceHandle: string };
type AssetSelection = { target: GraphNode; targetHandleId: string; directory: string; sourceId: string; controller: AbortController; signal: AbortSignal; resolve: (reference?: AssetReference) => void };
const assetSelection = shallowRef<AssetSelection>();
const assetSelecting = ref(false);
provide("selectNodeAsset", (targetId: string, targetHandleId: string) => {
  finishAssetSelection();
  const target = findNode(targetId);
  const directory = project.value?.directory;
  if (currentUser.value?.role === "user" || !target || !directory || !props.active || !canvasId.value) return Promise.resolve(undefined);
  return new Promise<AssetReference | undefined>(resolve => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, canvasController.signal, workspaceController.signal]);
    assetSelection.value = { target, targetHandleId, directory, sourceId: crypto.randomUUID(), controller, signal, resolve };
    signal.addEventListener("abort", () => {
      if (assetSelection.value?.signal === signal) finishAssetSelection();
    }, { once: true });
  });
});
function finishAssetSelection(reference?: AssetReference) {
  const selection = assetSelection.value;
  assetSelection.value = undefined;
  assetSelecting.value = false;
  selection?.controller.abort();
  selection?.resolve(reference);
}
watch(() => assetSelection.value && (!props.active || props.settingsVisible || assetSelection.value.directory !== project.value?.directory
  || findNode(assetSelection.value.target.id) !== assetSelection.value.target), invalid => {
  if (invalid) finishAssetSelection();
});
onScopeDispose(() => finishAssetSelection());

function assetConnection(type: string, selection: AssetSelection, source?: GraphNode) {
  const target = selection.target;
  if (selection.signal.aborted || findNode(target.id) !== target || !flow.nodesConnectable.value || target.connectable === false) return;
  const sourceNode = source ?? { ...target, id: selection.sourceId, type, data: { handles: (nodeTypes.value[type] as { handles?: NodeHandle[] })?.handles }, connectable: true };
  const nodes = source ? flow.getNodes.value : [...flow.getNodes.value, sourceNode];
  return (sourceNode.data.handles as NodeHandle[] | undefined)?.filter(handle => handle.type === "source")
    .map(handle => ({ source: sourceNode.id, sourceHandle: handle.id, target: target.id, targetHandle: selection.targetHandleId }))
    .find(connection => sourceNode.connectable !== false && validateConnection(connection, { sourceNode, targetNode: target, nodes, edges: flow.getEdges.value }));
}

function canSelectAsset(entry: { name: string; type: string }) {
  const selection = assetSelection.value;
  const { type } = getCanvasFileType({ name: entry.name, type: "" });
  return !!selection && entry.type === "file" && !!type && availableNodes.value.some(node => node.type === type) && !!assetConnection(type, selection);
}

async function selectAsset(entry: { name: string; path: string; type: string }) {
  const selection = assetSelection.value;
  if (!selection || assetSelecting.value || !canSelectAsset(entry)) return;
  assetSelecting.value = true;
  try {
    const { data } = await axios.get<Blob>("/api/assets/read", { params: { path: entry.path }, responseType: "blob", signal: selection.signal });
    selection.signal.throwIfAborted();
    await canvasHistory.batch(async () => {
      let importedId: string | undefined;
      let created: GraphNode | undefined;
      let connected = false;
      const target = selection.target;
      const position = { x: target.computedPosition.x - 440, y: target.computedPosition.y };
      try {
        [importedId] = await importCanvasFiles([new File([data], entry.name, { type: data.type })], position, {
          directory: selection.directory, availableNodes: availableNodes.value, signal: selection.signal, flow,
        });
        if (!importedId) return;
        created = findNode(importedId);
        await nextTick();
        if (!created || findNode(importedId) !== created) throw new Error("Node tài nguyên đã bị xóa, vui lòng chọn lại");
        await useNodeEvent(importedId, flow).emit("save");
        selection.signal.throwIfAborted();
        const connection = assetConnection(created.type ?? "", selection, created);
        if (!connection) throw new Error("Node hiện tại không thể tham chiếu tài nguyên này");
        const width = created.dimensions.width || 360;
        created.position.x = target.computedPosition.x - width - 80;
        addEdges(connection);
        connected = true;
        finishAssetSelection({ source: importedId, sourceHandle: connection.sourceHandle });
      } finally {
        if (importedId && !connected) {
          if (created && findNode(importedId) === created) flow.removeNodes(importedId, true);
          await useWorkspaceFiles(selection.directory).remove(`assets/${importedId}`, true).catch(cleanupError => {
            if (cleanupError?.response?.data?.data?.code !== "ENOENT") ElMessage.error(cleanupError?.response?.data?.message || cleanupError.message);
          });
        }
      }
    });
  } catch (error) {
    if (!selection.signal.aborted) ElMessage.error(axios.isAxiosError<{ message: string }>(error) ? error.response?.data.message || error.message : (error as Error).message);
  } finally {
    if (assetSelection.value === selection) assetSelecting.value = false;
  }
}
const { createCanvasContext, getNodeRevision } = useCanvasTools({
  availableNodes,
  flushSave: flushCanvasSave,
  async reloadPlugin(type, name) {
    const event = new CustomEvent("toonflow:plugin-installed", { detail: { type, name } });
    // ACT: 当前画布等待目标节点加载，其他监听者仍通过安装事件刷新，避免本画布重复请求。
    handledPluginEvents.add(event);
    window.dispatchEvent(event);
    if (type === "node") await loadRemoteNodes(name, true);
  },
  menu() {
    if (!canvasMenuRef.value) throw new Error("Menu Canvas chưa sẵn sàng");
    return canvasMenuRef.value;
  },
  getCanvasBinding: () => ({ id: canvasId.value, signal: canvasController.signal }),
  resolveCanvasContext: id => props.resolveCanvasContext?.(id),
});
function getCanvasContext() {
  return canvasId.value || canvasMenuRef.value?.initialized ? createCanvasContext(canvasId.value, canvasController.signal, workspaceController.signal) : undefined;
}
const canvasReady = computed(() => !!canvasId.value && !nodeListLoading.value && nodeLoads.size === 0);
provide("canvas", getCanvasContext);
provide("nodePersistence", () => {
  const directory = project.value?.directory;
  const canvasPath = canvasId.value;
  if (!directory || !canvasPath) return;
  return {
    directory,
    canvasPath,
    async save(signal?: AbortSignal) {
      signal?.throwIfAborted();
      if (project.value?.directory !== directory || canvasId.value !== canvasPath) throw new Error("Đã chuyển Canvas, không thể lưu tác vụ của node");
      let abort = () => {};
      try {
        const saving = flushCanvasSave();
        await (signal ? Promise.race([saving, new Promise<never>((_resolve, reject) => {
          abort = () => reject(signal.reason);
          signal.addEventListener("abort", abort, { once: true });
        })]) : saving);
      } finally { signal?.removeEventListener("abort", abort); }
      signal?.throwIfAborted();
      if (project.value?.directory !== directory || canvasId.value !== canvasPath) throw new Error("Đã chuyển Canvas, không thể xác nhận kết quả lưu tác vụ node");
    },
  };
});
defineExpose({ canvasId, canvasReady, getCanvasContext, addNodeAtPointer, readDocumentNode, saveDocumentNode, mountDocumentNode, observeDocumentNode, prepareCanvasDelete, flushSave: flushCanvasSave, cancelSave: cancelCanvasSave,
  applyPromptTemplate,
  openNodeSearch: () => nodeSearchRef.value?.open(),
  getCanvases: (signal?: AbortSignal) => {
    if (!canvasMenuRef.value) throw new Error("Menu Canvas chưa sẵn sàng");
    return canvasMenuRef.value.getCanvases(signal);
  },
  syncCanvasPath: (previous: string, target: string) => canvasMenuRef.value?.syncCanvasPath(previous, target),
  getMentionNodes: () => flow.nodes.value, findMentionNode: flow.findNode,
  getMentionRevision: () => `${props.runtimeKey}:${getNodeRevision()}`,
  getRetainedNodes: canvasHistory.getRetainedNodes,
  get canvasListReady() { return canvasMenuRef.value?.initialized ?? false; },
  get saveBusy() { return savePaused; }, get loadError() { return canvasMenuRef.value?.loadError ?? ""; },
});

async function prepareCanvasDelete() {
  const directory = project.value?.directory;
  const fileName = canvasId.value;
  const nodes = [...flow.getNodes.value];
  const signal = AbortSignal.any([workspaceController.signal, canvasController.signal]);
  function checkCanvas() {
    signal.throwIfAborted();
    if (!directory || directory !== project.value?.directory || !fileName || fileName !== canvasId.value) {
      throw new Error("Không gian làm việc hoặc Canvas đã thay đổi, vui lòng xóa lại");
    }
  }
  checkCanvas();
  await nextTick();
  checkCanvas();
  // 宿主已暂停画布保存；这里只执行节点生命周期，文件删除成功后由宿主取消保存并卸载。
  for (const node of nodes) {
    if (flow.findNode(node.id) !== node) throw new Error("Node Canvas đã thay đổi, vui lòng xóa lại");
    await useNodeEvent(node.id, flow).emit("delete");
    checkCanvas();
    if (flow.findNode(node.id) !== node) throw new Error("Node Canvas đã thay đổi, vui lòng xóa lại");
  }
  if (flow.getNodes.value.length !== nodes.length || nodes.some(node => flow.findNode(node.id) !== node)) {
    throw new Error("Node Canvas đã thay đổi, vui lòng xóa lại");
  }
}

type DocumentNodeData = { label?: string; handles?: NodeHandle[]; outputs?: Record<string, NodeOutput | undefined>; textPath?: string };

function checkDocumentDirectory(directory: string) {
  if (!directory || directory !== project.value?.directory) throw new Error("Thư mục làm việc đã thay đổi, hãy mở lại node");
}

function observeDocumentNode(directory: string, canvasPath: string, nodeId: string, onState: (state: NodeDocumentState) => void) {
  checkDocumentDirectory(directory);
  if (canvasId.value !== canvasPath || !findNode(nodeId)) throw new Error("Node không tồn tại, hãy làm mới cây tệp");
  const stop = watch((): NodeDocumentState => {
    const node = findNode(nodeId);
    const state = nodeDocument.states.get(nodeId);
    return { dirty: !!node && (canvasDirty.value || !!state?.dirty),
      error: state?.error || canvasSaveError.value || (node && nodeErrors.value[node.type]) || "", deleted: !node };
  }, onState, { immediate: true, flush: "sync" });
  const release = () => { stop(); documentObservers.delete(dispose); };
  const dispose = () => { onState({ dirty: false, error: "", deleted: true }); release(); };
  documentObservers.add(dispose);
  return {
    release,
    async flushSave() {
      checkDocumentDirectory(directory);
      if (!findNode(nodeId)) throw new Error("Node đã bị xóa, hãy làm mới cây tệp");
      await flushCanvasSave();
    },
  };
}

async function mountDocumentNode(directory: string, canvasPath: string, nodeId: string, target: HTMLElement) {
  checkDocumentDirectory(directory);
  if (canvasId.value !== canvasPath) throw new Error("Canvas đã thay đổi, hãy mở lại node");
  await nextTick();
  checkDocumentDirectory(directory);
  const node = findNode(nodeId);
  if (!node) throw new Error("Node đã bị xóa, hãy làm mới cây tệp");
  if (nodeErrors.value[node.type]) throw new Error(nodeErrors.value[node.type]);
  const mount = nodeDocument.mounts.get(nodeId);
  if (!mount) throw new Error("Node hiện tại không cung cấp chế độ xem tài liệu, hãy kiểm tra node đã tải và cập nhật plugin node");
  const release = mount(target);
  try {
    await nextTick();
    checkDocumentDirectory(directory);
    if (!target.isConnected || !target.querySelector(".documentNode")) throw new Error("Không tải được chế độ xem tài liệu của node, hãy mở lại node");
    return release;
  } catch (error) {
    release();
    throw error;
  }
}

function documentHandles(node: Node<DocumentNodeData>) {
  const handles = node.data?.handles;
  if (Array.isArray(handles) && handles.length) {
    return handles.filter(
      (handle) =>
        handle &&
        typeof handle.id === "string" &&
        handle.type === "source" &&
        (Array.isArray(handle.dataType) ? handle.dataType.includes("STRING") : handle.dataType === "STRING")
    );
  }
  return Object.entries(node.data?.outputs ?? {}).flatMap(([id, output]) => (output?.dataType === "STRING" ? [{ id, label: id }] : []));
}

async function readDocumentCanvas(directory: string, canvasPath: string, nodeId: string) {
  checkDocumentDirectory(directory);
  const files = useWorkspaceFiles(directory);
  const canvas = await files.readJson<{ toonflowCanvas?: boolean; nodes?: Node<DocumentNodeData>[] }>(canvasPath);
  checkDocumentDirectory(directory);
  if (canvas?.toonflowCanvas !== true || !Array.isArray(canvas.nodes)) throw new Error("Tệp không phải Canvas hợp lệ");
  const node = canvas.nodes.find((item) => item && item.id === nodeId);
  if (!node) throw new Error("Node đã bị xóa, hãy làm mới cây tệp");
  if (node.data !== undefined && (!node.data || typeof node.data !== "object" || Array.isArray(node.data))) throw new Error("Dữ liệu node không hợp lệ");
  const liveNode = canvasId.value === canvasPath ? findNode(nodeId) : undefined;
  if (canvasId.value === canvasPath && !liveNode) throw new Error("Node đã bị xóa, hãy làm mới cây tệp");
  const textPath = node.data?.textPath;
  if (
    textPath !== undefined &&
    (typeof textPath !== "string" ||
      !textPath.trim() ||
      /^(?:[a-z][a-z\d+.-]*:|[\\/])/i.test(textPath) ||
      textPath.includes("\0") ||
      textPath.split(/[\\/]/).includes(".."))
  )
    throw new Error("Đường dẫn tệp văn bản phải nằm trong không gian làm việc");
  return { files, canvas, node, liveNode, textPath };
}

async function readDocumentNode(directory: string, canvasPath: string, nodeId: string) {
  checkDocumentDirectory(directory);
  await flushCanvasSave();
  const { files, node, liveNode, textPath } = await readDocumentCanvas(directory, canvasPath, nodeId);
  const source = liveNode ?? node;
  const handles = documentHandles(source);
  const storedText = textPath === undefined ? undefined : await files.readText(textPath);
  checkDocumentDirectory(directory);
  return {
    label: typeof source.data?.label === "string" ? source.data.label : nodeId,
    outputs: handles.map((handle) => {
      const output = source.data?.outputs?.[handle.id];
      return {
        id: handle.id,
        label: handle.label || handle.id,
        text: output?.dataType === "STRING" && typeof output.value === "string" ? output.value : storedText ?? "",
      };
    }),
  };
}

async function saveDocumentNode(directory: string, canvasPath: string, nodeId: string, handleId: string, text: string, expectedText?: string) {
  checkDocumentDirectory(directory);
  await flushCanvasSave(async () => {
    const { files, canvas, node, liveNode, textPath } = await readDocumentCanvas(directory, canvasPath, nodeId);
    if (!documentHandles(liveNode ?? node).some((handle) => handle.id === handleId)) throw new Error("Đầu ra văn bản đã bị xóa, hãy mở lại node");
    if (expectedText !== undefined) {
      const output = (liveNode ?? node).data?.outputs?.[handleId];
      const currentText = output?.dataType === "STRING" && typeof output.value === "string" ? output.value : textPath === undefined ? "" : await files.readText(textPath);
      if (currentText !== expectedText) throw new Error("Nội dung tài liệu đã thay đổi, hãy đọc lại trước khi sửa");
    }
    if (liveNode?.type === "remote-textNode") {
      await getNodeTools().call({ nodeId, name: "node:setText", args: { text } }, canvasController.signal);
      checkDocumentDirectory(directory);
      // 节点工具已同步输出并排队保存；等待期间用户可能继续编辑，不能再写入旧文本快照。
      return;
    }
    if (liveNode && canvasId.value === canvasPath && findNode(nodeId) === liveNode) {
      const output = liveNode.data.outputs?.[handleId];
      if (output?.dataType === "STRING") output.value = text;
      else if (textPath === undefined) (liveNode.data.outputs ??= {})[handleId] = { dataType: "STRING", value: text };
    }
    canvasMenuRef.value?.syncDocumentNode(canvasPath, nodeId, handleId, text, textPath === undefined);
    if (textPath !== undefined) {
      await files.write(textPath, text);
    } else {
      const data = (node.data ??= {});
      const output = data.outputs?.[handleId];
      if (output?.dataType === "STRING") output.value = text;
      else (data.outputs ??= {})[handleId] = { dataType: "STRING", value: text };
      await files.writeJson(canvasPath, canvas);
    }
    checkDocumentDirectory(directory);
  });
}

function showEdgeDisconnect({ event, edge }: EdgeMouseEvent) {
  if (!(event instanceof MouseEvent)) return;
  event.stopPropagation();
  edgeDisconnect.value = { id: edge.id, x: event.clientX, y: event.clientY };
}

function dragFilesOver(event: DragEvent) {
  if (!props.active || props.settingsVisible || !canvasId.value || !project.value?.directory || !isCanvasFileDrag(event)) return;
  if (!(event.target instanceof Element) || !event.target.closest(".vue-flow__pane")) return;
  event.preventDefault();
  event.dataTransfer!.dropEffect = "copy";
  return true;
}

async function dropFiles(event: DragEvent) {
  const directory = project.value?.directory;
  if (!directory || !dragFilesOver(event)) return;
  try {
    await canvasHistory.batch(() => dropCanvasFiles(event, { directory, availableNodes: availableNodes.value, signal: canvasController.signal, flow }));
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Nhập tệp thất bại");
  }
}

function selectFiles(position: { x: number; y: number }) {
  const directory = project.value?.directory;
  if (!props.active || props.settingsVisible || !canvasId.value || !directory) return;
  const context = { directory, availableNodes: availableNodes.value, signal: canvasController.signal, flow };
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.onchange = async () => {
    const files = Array.from(input.files ?? []);
    if (!files.length || context.signal.aborted) return;
    try {
      await canvasHistory.batch(async () => { await importCanvasFiles(files, position, context); });
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : "Nhập tệp thất bại");
    }
  };
  input.click();
}

function openNodeMenu(event: MouseEvent) {
  if (event.target instanceof Element && event.target.classList.contains("vue-flow__pane")) nodeMenuRef.value?.openMenu(event, true);
}

function createEmptyNode(type: string) {
  if (!props.active || props.settingsVisible || !project.value?.directory || !canvasReady.value || flow.getNodes.value.length) return;
  const rect = canvasElement.value?.getBoundingClientRect();
  if (!rect) return;
  const center = screenToFlowCoordinate({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  void nodeMenuRef.value?.addNode(type, { x: center.x - 200, y: center.y - 160 });
}

function addNodeAtPointer() {
  if (!props.active || props.settingsVisible || !project.value?.directory || !canvasReady.value) return;
  const rect = canvasElement.value?.getBoundingClientRect();
  if (!rect) return;
  const position = pointerPosition ?? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  void nodeMenuRef.value?.openMenu(new MouseEvent("contextmenu", { clientX: position.x, clientY: position.y }), true);
}

/** Prepare a prompt without invoking generation. Uses native Canvas history,
 * existing workspace image import and node-data autosave contracts. */
async function applyPromptTemplate(item: PromptItem, options: { nodeId?: string; includeReferences?: boolean } = {}): Promise<boolean> {
  const directory = project.value?.directory;
  if (!directory || !props.active || props.settingsVisible || !canvasId.value || !canvasReady.value || !item.prompt?.trim()) return false;
  const type = "remote-imageGenerationNode";
  if (!availableNodes.value.some(node => node.type === type)) throw new Error("Hãy cài hoặc bật node Tạo ảnh để sử dụng thư viện prompt.");
  const target = flow.getNodes.value.find(n => n.type === type && n.id === options.nodeId)
    || flow.getNodes.value.find(n => n.type === type && n.selected);
  const activeTask = target?.data?.mediaTask as { state?: string; applied?: boolean } | undefined;
  if (activeTask && activeTask.state !== "failed" && activeTask.state !== "cancelled"
    && (activeTask.state !== "succeeded" || !activeTask.applied))
    throw new Error("Node đang có tác vụ tạo ảnh chưa hoàn tất hoặc chưa xác nhận. Hãy xử lý tác vụ trước khi thay prompt.");
  let prompt = item.prompt.trim();
  const current = typeof target?.data?.prompt === "string" ? target.data.prompt.trim() : "";
  if (current && current !== prompt) {
    const action = await ElMessageBox.confirm("Node đang có prompt. Bạn muốn thay thế hay chèn thêm mẫu mới?", "Dùng mẫu prompt", {
      confirmButtonText: "Thay thế", cancelButtonText: "Chèn thêm", distinguishCancelAndClose: true, type: "warning",
    }).then(() => "replace" as const, reason => reason === "cancel" ? "append" as const : "close" as const);
    if (action === "close") return false;
    if (action === "append") prompt = `${current}\n\n${prompt}`;
  }
  const references = options.includeReferences ? item.referenceImageUrls.filter(url => /^https:\/\//i.test(url)).slice(0, 8) : [];
  if (references.length && !availableNodes.value.some(node => node.type === "remote-imageNode"))
    throw new Error("Node ảnh tham chiếu chưa được cài đặt. Hãy bỏ chọn ảnh tham chiếu hoặc bật node Ảnh.");
  const imported: { path: string; mimeType: string; url: string }[] = [];
  if (references.length) {
    const workspaceFiles = useWorkspaceFiles(directory);
    for (const url of references) {
      const result = await workspaceFiles.importImage(url);
      imported.push({ ...result, url });
    }
  }
  const rect = canvasElement.value?.getBoundingClientRect();
  if (!rect) return false;
  const center = screenToFlowCoordinate({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  await canvasHistory.batch(async () => {
    const targetId = target?.id || crypto.randomUUID();
    const position = target?.position || { x: center.x - 200, y: center.y - 170 };
    const promptModel = prompt.split("\n").map(text => [{ type: "Write", text }]);
    if (target) {
      target.data.prompt = prompt;
      target.data.promptModel = promptModel;
    } else {
      addNodes({ id: targetId, type, position, data: { label: "Tạo ảnh", prompt, promptModel } });
    }
    if (imported.length) {
      await nextTick();
      const targetNode = findNode(targetId);
      if (!targetNode) throw new Error("Không thể xác định node tạo ảnh.");
      const edges = [];
      for (const [index, reference] of imported.entries()) {
        const sourceId = crypto.randomUUID();
        addNodes({ id: sourceId, type: "remote-imageNode",
          position: { x: position.x - 440, y: position.y + index * 220 },
          data: { label: `Tham chiếu ${index + 1} · ${item.title}`,
            outputs: { image: { dataType: "IMAGE", value: { url: reference.path, mimeType: reference.mimeType } } } },
        });
        edges.push({ id: crypto.randomUUID(), source: sourceId, sourceHandle: "image", target: targetId, targetHandle: "in" });
      }
      await nextTick();
      addEdges(edges);
    }
    flow.removeSelectedElements();
    const selectedNode = findNode(targetId);
    if (selectedNode) flow.addSelectedNodes([selectedNode]);
  });
  ElMessage.success(`Đã chuẩn bị prompt “${item.title}” trên Canvas. Nhấn Tạo ảnh khi bạn sẵn sàng.`);
  return true;
}

async function changeHistory(direction: "undo" | "redo") {
  try {
    await canvasHistory[direction]();
    edgeDisconnect.value = undefined;
  } catch (error) {
    ElMessage.error(
      axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data.message || "Khôi phục Canvas thất bại"
        : error instanceof Error
        ? error.message
        : "Khôi phục Canvas thất bại"
    );
  }
}

let saving = Promise.resolve();
let flushing = Promise.resolve();
let saveError: unknown;
let savePaused = false;
let saveCancelled = false;
let changedWhilePaused = false;
let saveRevision = 0;
const saveCanvas = debounce((directory: string, fileName: string) => {
  const flow = toObject();
  const revision = saveRevision;
  // ACT: 同页保存按顺序完成，防止慢请求覆盖后续修改；不处理多个客户端的并发编辑。
  saving = saving.then(async () => {
    try {
      await useWorkspaceFiles(directory).writeJson(fileName, { toonflowCanvas: true, nodes: flow.nodes, edges: flow.edges, viewport: flow.viewport });
      saveError = undefined;
      canvasSaveError.value = "";
      if (revision === saveRevision) canvasDirty.value = false;
    } catch (err) {
      saveError = err;
      canvasSaveError.value = axios.isAxiosError<{ message?: string }>(err) ? err.response?.data.message || err.message : err instanceof Error ? err.message : "Lưu Canvas thất bại";
      ElMessage.error(
        axios.isAxiosError<{ message?: string }>(err)
          ? err.response?.data.message || "Lưu Canvas thất bại"
          : err instanceof Error
          ? err.message
          : "Lưu Canvas thất bại"
      );
    }
  });
}, 500);

function scheduleCanvasSave() {
  if (saveCancelled) return;
  canvasDirty.value = true;
  saveRevision++;
  if (savePaused) {
    changedWhilePaused = true;
    return;
  }
  const directory = project.value?.directory;
  if (directory && canvasId.value) saveCanvas(directory, canvasId.value);
}

function scheduleCanvasChange() {
  scheduleCanvasSave();
  canvasHistory.record();
}

const elementSaveWatchers = new Map<Node | Edge, () => void>();
const nodeRuntimeFields = new Set([
  "data",
  "computedPosition",
  "handleBounds",
  "selected",
  "dimensions",
  "isParent",
  "resizing",
  "dragging",
  "events",
]);
const edgeRuntimeFields = new Set(["data", "selected", "sourceNode", "targetNode", "sourceX", "sourceY", "targetX", "targetY", "events"]);
// ACT: 仅增删、替换元素时扫描列表；位移与 data 各自监听，单个节点变化不遍历其余节点。
watch(
  () => [...flow.nodes.value, ...flow.edges.value],
  (elements) => {
    const current = new Set<Node | Edge>(elements);
    for (const [element, stop] of elementSaveWatchers) {
      if (!current.has(element)) {
        stop();
        elementSaveWatchers.delete(element);
      }
    }
    for (const element of elements) {
      if (elementSaveWatchers.has(element)) continue;
      // 与 toObject 排除的运行态字段保持一致，其他自定义持久字段仍参与自动保存。
      const runtimeFields = isNode(element) ? nodeRuntimeFields : edgeRuntimeFields;
      const stopFields = watch(
        () =>
          Object.keys(element)
            .filter((key) => !runtimeFields.has(key))
            .map((key) => Reflect.get(element, key)),
        scheduleCanvasChange,
        { deep: true, flush: "post" }
      );
      const stopData = watch(() => element.data, scheduleCanvasSave, { deep: true, flush: "post" });
      const stopName = isNode(element)
        ? watch(
            () => element.data?.label,
            () => canvasHistory.record(),
            { flush: "post" }
          )
        : () => {};
      let stopDimensions = () => {};
      if (isNode(element)) {
        const parents = computed(() => {
          const result: GraphNode[] = [];
          const visited = new Set([element.id]);
          let parent = findNode(element.parentNode);
          while (parent && !visited.has(parent.id)) {
            visited.add(parent.id);
            result.push(parent);
            parent = findNode(parent.parentNode);
          }
          return result;
        });
        let dimensionsChanged = false;
        stopDimensions = watch(
          [
            () => element.dimensions.width,
            () => element.dimensions.height,
            () => [element, ...parents.value].some(node => node.dragging || node.resizing),
          ],
          ([width, height, interacting], [previousWidth, previousHeight]) => {
            dimensionsChanged ||= width !== previousWidth || height !== previousHeight;
            if (!dimensionsChanged || interacting) return;
            dimensionsChanged = false;
            // ACT: 尺寸变化延后到拖动、缩放结束贴合，只调整祖先分组，不改变节点归属。
            const groups = new Set(parents.value.filter(node => node.type === "canvasGroup"));
            if (groups.size) fitGroupBounds(flow.getNodes.value, groups);
          },
          { flush: "post" },
        );
      }
      elementSaveWatchers.set(element, () => {
        stopFields();
        stopData();
        stopName();
        stopDimensions();
      });
    }
    scheduleCanvasChange();
  },
  { immediate: true, flush: "post" }
);
onScopeDispose(() => elementSaveWatchers.forEach((stop) => stop()));
watch(() => [viewport.value.x, viewport.value.y, viewport.value.zoom], scheduleCanvasSave, { flush: "post" });

watch(
  [() => project.value?.directory, canvasId],
  ([directory, fileName], [previousDirectory, previousFileName]) => {
    if (directory !== previousDirectory) {
      workspaceController.abort(new Error("Đã chuyển không gian làm việc, thao tác Canvas hiện tại đã dừng"));
      workspaceController = new AbortController();
    }
    edgeDisconnect.value = undefined;
    dragCopy = undefined;
    pointerPosition = undefined;
    resetCanvasKeys();
    // 同一实例只在重新装载画布时失效；重命名仅更新保存路径。
    if (directory !== previousDirectory || !fileName || !previousFileName) {
      canvasController.abort(new Error("Canvas đã tải lại, lần gọi Canvas này đã dừng"));
      canvasController = new AbortController();
    }
    if (!savePaused) saveCanvas.flush();
  },
  { flush: "sync" }
);

// ACT: 切换显示面板不会卸载画布；仅清理交互，不中断本轮工具调用。
watch(() => props.active, (active) => {
  if (!active) assetsVisible.value = false;
  edgeDisconnect.value = undefined;
  dragCopy = undefined;
  pointerPosition = undefined;
  resetCanvasKeys();
}, { flush: "sync" });

function flushCanvasSave(action?: () => Promise<void>): Promise<void> {
  // ACT: 完整保存及其文件操作串行执行，重命名暂停期间的显式保存也必须等待。
  const next = flushing.then(() => saveCanvasState(action)).then(() => { canvasSaveError.value = ""; }, error => {
    canvasSaveError.value = axios.isAxiosError<{ message?: string }>(error) ? error.response?.data.message || error.message : error instanceof Error ? error.message : "Lưu Canvas thất bại";
    throw error;
  });
  flushing = next.catch(() => {});
  return next;
}

async function saveCanvasState(action?: () => Promise<void>) {
  if (saveCancelled) throw new Error("Đã hủy lưu Canvas");
  await Promise.all(flow.getNodes.value.map((node) => useNodeEvent(node.id, flow).emit("save")));
  await nextTick();
  if (saveCancelled) throw new Error("Đã hủy lưu Canvas");
  if (saveError && project.value?.directory && canvasId.value) saveCanvas(project.value.directory, canvasId.value);
  if (action) savePaused = true;
  try {
    let revision: number;
    do {
      if (saveCancelled) throw new Error("Đã hủy lưu Canvas");
      revision = saveRevision;
      if (changedWhilePaused && project.value?.directory && canvasId.value) {
        saveCanvas(project.value.directory, canvasId.value);
        changedWhilePaused = false;
      }
      saveCanvas.flush();
      await saving;
      if (saveError) throw saveError;
      // 画布写入期间节点可能完成生成，等新增落盘后重新保存变化。
      await Promise.all(flow.getNodes.value.map((node) => useNodeEvent(node.id, flow).emit("save")));
      await nextTick();
    } while (revision !== saveRevision);
    if (saveCancelled) throw new Error("Đã hủy lưu Canvas");
    await action?.();
  } finally {
    if (action && !saveCancelled) {
      savePaused = false;
      if (changedWhilePaused && project.value?.directory && canvasId.value) saveCanvas(project.value.directory, canvasId.value);
      changedWhilePaused = false;
    }
  }
}

function cancelCanvasSave() {
  saveCancelled = true;
  savePaused = true;
  changedWhilePaused = false;
  saveCanvas.cancel();
}
function canUseCanvasClipboard(event: Event) {
  const target = event.target;
  return props.active && !event.defaultPrevented && !props.settingsVisible && !!canvasId.value && !!project.value?.directory
    && target instanceof Element
    && !target.closest("input, textarea, select, button, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='slider'], [role='dialog'], #agentPanel")
    && (target === document.body || target === document.documentElement || canvasElement.value?.contains(target));
}

function beforeClipboard(event: Event) {
  if (!canUseCanvasClipboard(event)) return;
  if (event.type === "beforecopy" && (!flow.getSelectedNodes.value.length || window.getSelection()?.toString())) return;
  // ACT: WKWebView 通过 beforecopy/beforepaste 判定非输入区能否使用原生编辑菜单。
  event.preventDefault();
}

function copyNode(event: ClipboardEvent) {
  if (!canUseCanvasClipboard(event) || !flow.getSelectedNodes.value.length || window.getSelection()?.toString()) return;
  event.preventDefault();
  void copySelectedNodes();
}

function imageOutput(data: { outputs?: Record<string, NodeOutput | undefined> } | undefined) {
  for (const output of Object.values(data?.outputs ?? {})) {
    if (output?.dataType !== "IMAGE" || !output.value || typeof output.value !== "object") continue;
    if (typeof output.value.url === "string" && output.value.url) return output.value;
  }
}

async function copyImageNodeToClipboard(directory: string, node: Parameters<typeof copyNodeToClipboard>[0]) {
  const output = imageOutput(node.data);
  if (!output) return false;
  const content = await useWorkspaceFiles(directory).read(output.url);
  await writeClipboardImage(new Blob([content], { type: output.mimeType || "image/png" }));
  return true;
}

async function copySelectedNodes() {
  if (copyingNodes || !project.value?.directory) return;
  const nodes = getSelectionTree(flow.getSelectedNodes.value, flow.getNodes.value);
  if (!nodes.length) return;
  const directory = project.value.directory;
  const signal = canvasController.signal;
  copyingNodes = true;
  try {
    if (nodes.length === 1 && await copyImageNodeToClipboard(directory, { data: nodes[0]!.data ?? {} })) {
      ElMessage.success("Đã sao chép ảnh");
      return;
    }
    const ids = new Set(nodes.map(node => node.id));
    const snapshot = toObject();
    const savedNodes = new Map(snapshot.nodes.map(node => [node.id, node]));
    const copies = await Promise.all(nodes.map(async node => {
      const patch = await useNodeEvent(node.id, flow).emit("copy");
      const saved = savedNodes.get(node.id)!;
      const parentNode = ids.has(saved.parentNode ?? "") ? saved.parentNode : undefined;
      return { ...saved, data: { ...saved.data, ...patch }, parentNode,
        ...(saved.parentNode && !parentNode ? { extent: undefined, expandParent: false } : {}),
        position: parentNode ? { ...saved.position } : { x: node.computedPosition.x, y: node.computedPosition.y } };
    }));
    signal.throwIfAborted();
    if (nodes.some(node => findNode(node.id) !== node)) throw new Error("Node đã thay đổi, hãy sao chép lại");
    const edges = snapshot.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target));
    await copyNodesToClipboard(copies, edges, directory);
  } catch (error) {
    if (!signal.aborted) ElMessage.error(error instanceof Error ? error.message : "Sao chép node thất bại");
  } finally {
    copyingNodes = false;
  }
}

async function pasteNode(event: ClipboardEvent) {
  if (!canUseCanvasClipboard(event)) return;
  const text = event.clipboardData?.getData("text/plain") ?? "";
  if (nodeClipboardCommand.test(text)) {
    event.preventDefault();
    await pasteNodeAtCenter(text);
    return;
  }
  const canvasSignal = canvasController.signal;
  let files = getClipboardMediaFiles(event);
  if (files.length || text.trim()) event.preventDefault();
  // ACT: 部分 WebView 不向 paste 事件暴露剪贴板文件，桌面端回退到原生剪贴板读取。
  if (!files.length && actualPlatform.isDesktop) files = await readClipboardFiles().catch(() => []);
  if (canvasSignal.aborted) return;
  if (!files.length && text.trim()) files = [new File([text], "Văn bản đã dán.txt", { type: "text/plain" })];
  if (!files.length) return;
  event.preventDefault();
  const position = pastePosition();
  if (position) await importCanvasContent(files, position);
}

function pastePosition() {
  const rect = canvasElement.value?.getBoundingClientRect();
  if (!rect) return;
  const point = pointerPosition && pointerPosition.x >= rect.left && pointerPosition.x <= rect.right && pointerPosition.y >= rect.top && pointerPosition.y <= rect.bottom
    ? pointerPosition
    : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  return screenToFlowCoordinate(point);
}

async function pasteNodeAtCenter(command?: string) {
  const position = pastePosition();
  if (position) await pasteClipboardNode(position, command);
}

async function importCanvasContent(files: File[], position: { x: number; y: number }) {
  const directory = project.value?.directory;
  if (!directory) return false;
  const canvasSignal = canvasController.signal;
  try {
    await canvasHistory.batch(async () => { await importCanvasFiles(files, position, { directory, availableNodes: availableNodes.value, signal: canvasSignal, flow }); });
    return true;
  } catch (error) {
    if (!canvasSignal.aborted) ElMessage.error(error instanceof Error ? error.message : "Nhập nội dung bảng nhớ tạm thất bại");
    return false;
  }
}

async function pasteClipboardNode(position: { x: number; y: number }, command?: string) {
  if (!props.active || !canvasId.value || !project.value?.directory) return false;
  const canvasSignal = canvasController.signal;
  try {
    const directory = project.value.directory;
    const text = command ?? (await readClipboardText());
    const snapshot = await readClipboardNodes(text, directory);
    if (canvasSignal.aborted) return false;
    if (snapshot) {
      if (snapshot.nodes.some(node => node.type !== "canvasGroup" && !availableNodes.value.some(item => item.type === node.type))) {
        throw new Error("Hãy cài đặt và bật plugin node tương ứng trước");
      }
      const ids = new Map(snapshot.nodes.map(node => [node.id, crypto.randomUUID()]));
      for (const node of snapshot.nodes) remapNodeReferences(node, ids);
      const roots = snapshot.nodes.filter(node => !node.parentNode);
      const left = Math.min(...roots.map(node => node.position.x));
      const top = Math.min(...roots.map(node => node.position.y));
      await canvasHistory.batch(async () => {
        flow.removeSelectedElements();
        addNodes(snapshot.nodes.map(node => ({ ...node, id: ids.get(node.id)!, parentNode: ids.get(node.parentNode ?? ""), selected: true,
          position: node.parentNode ? node.position : { x: position.x + node.position.x - left, y: position.y + node.position.y - top } })));
        await nextTick();
        if (canvasSignal.aborted) return;
        addEdges(snapshot.edges.map(edge => ({ ...edge, id: crypto.randomUUID(), source: ids.get(edge.source)!, target: ids.get(edge.target)! })));
      });
      return true;
    }
    const files = await readClipboardFiles().catch((error): File[] => {
      if (text.trim()) return [];
      throw error;
    });
    if (canvasSignal.aborted) return false;
    if (!files.length && text.trim()) files.push(new File([text], "Văn bản đã dán.txt", { type: "text/plain" }));
    if (!files.length) throw new Error("Bảng nhớ tạm không có node, văn bản, ảnh, video hoặc âm thanh để dán");
    return await importCanvasContent(files, position);
  } catch (error) {
    const pasteShortcut = generalSettings.value.canvasShortcuts.paste;
    const clipboardMessage = getShortcutBindings(pasteShortcut).some(binding => /^(Ctrl|Meta)\+KeyV$/.test(binding))
      ? t`无法读取剪贴板，请在画布上按 ${shortcutLabel(pasteShortcut)} 粘贴`
      : translate("无法读取剪贴板，请允许浏览器访问剪贴板");
    if (!canvasSignal.aborted)
      ElMessage.error(
        error instanceof DOMException && error.name === "NotAllowedError" ? clipboardMessage : error instanceof Error ? error.message : "Dán nội dung bảng nhớ tạm thất bại"
      );
    return false;
  }
}
function zoomCanvas(event: WheelEvent | (Event & { scale: number })) {
  if (event.type === "gestureend") gestureScale = undefined;
  if (!props.active || props.settingsVisible || document.fullscreenElement || flow.userSelectionActive.value) return;
  if (!(event.target instanceof Element) || !event.target.closest(".vue-flow__pane, .vue-flow__node, .vue-flow__edge, .vue-flow__nodesselection")) return;
  let factor: number;
  let point = pointerPosition;
  if ("scale" in event) {
    if (!Number.isFinite(event.scale) || event.scale <= 0) return;
    factor = event.type === "gesturechange" && gestureScale !== undefined ? event.scale / gestureScale : 1;
    gestureScale = event.type === "gestureend" ? undefined : event.scale;
  } else {
    // ACT: Chromium 捏合发送 Ctrl+wheel，但不发送 Control 按键；WebKit 使用上方原生 gesture 事件。
    const pinching = event.ctrlKey && !pressedCodes.has("ControlLeft") && !pressedCodes.has("ControlRight");
    // 无需按键的滚轮缩放让节点控件保留自己的滚动；显式缩放快捷键及捏合仍沿用原行为。
    if (defaultWheelZoom.value && !pinching && !zoomKeyPressed.value
      && event.target.closest(".nowheel, input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='slider']")) return;
    if (!pinching && !shortcutPressed(event, generalSettings.value.canvasShortcuts.zoom, pressedCodes)) {
      if (!event.ctrlKey) return;
      // 实体 Ctrl 未绑定缩放时，阻止 Vue Flow 和节点骨架将它误判为捏合。
      factor = 1;
    } else if (pinching && gestureScale !== undefined) {
      factor = 1;
    } else if (pinching) {
      factor = 2 ** (-event.deltaY * 0.02);
    } else {
      // ACT: 捏合已单独处理；实体滚轮只按 deltaMode 换算，避免 Vue Flow 基于 UA 的额外倍率。
      const delta = -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002);
      factor = 2 ** delta;
    }
    point = { x: event.clientX, y: event.clientY };
  }
  const zoom = flow.d3Zoom.value;
  const selection = flow.d3Selection.value;
  if (!zoom || !selection) return;
  event.preventDefault();
  event.stopPropagation();
  if (factor === 1) return;
  const bounds = selection.node()?.getBoundingClientRect();
  if (!bounds) return;
  point ??= { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
  selection.call<[number, [number, number], Event]>(zoom.scaleBy, factor, [point.x - bounds.left, point.y - bounds.top], event);
}

function preventMiddleClick(event: MouseEvent) {
  if (event.button === 1) event.preventDefault();
}

function updateCanvasSelection(event: MouseEvent | KeyboardEvent) {
  // 失焦期间可能漏掉修饰键；不能在按下到抬起之间改变已命中的选区，避免 click 落到画布清空选择。
  if (event.type === "pointerdown" && event.target instanceof Element && event.target.closest(".vue-flow__nodesselection-rect")) return;
  flow.multiSelectionActive.value = props.active && !props.settingsVisible && !handMode.value
    && shortcutPressed(event, generalSettings.value.canvasShortcuts.multiSelection, pressedCodes);
}

function updateCanvasKeys(event: KeyboardEvent) {
  if (event.type === "keydown") {
    pressedCodes.add(event.code);
  } else pressedCodes.delete(event.code);
  if (!props.active || props.settingsVisible) return resetCanvasKeys();
  const target = event.target;
  const shortcuts = generalSettings.value.canvasShortcuts;
  const inCanvas =
    target instanceof Element &&
    !target.closest("[role='dialog'], #agentPanel") &&
    (target === document.body || target === document.documentElement || canvasElement.value?.contains(target));
  // None 只配置默认鼠标手势，不能触发会禁用节点交互的临时抓手或节点内部缩放。
  zoomKeyPressed.value = !event.isComposing && shortcutPressed(event, getShortcutBindings(shortcuts.zoom).filter(binding => binding !== "None").join(" / "), pressedCodes);
  selectionKeyPressed.value = !event.isComposing && shortcutPressed(event, shortcuts.selection, pressedCodes);
  if (!selectionKeyPressed.value && !flow.userSelectionActive.value) flow.userSelectionRect.value = null;
  const editing =
    !(target instanceof Element) ||
    !!target.closest("input, textarea, select, button, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='slider']");
  panKeyPressed.value = !!inCanvas && !editing && !event.isComposing
    && shortcutPressed(event, getShortcutBindings(shortcuts.pan).filter(binding => binding !== "None").join(" / "), pressedCodes);
  updateCanvasSelection(event);
  if (event.type === "keyup" || event.defaultPrevented || event.isComposing || !inCanvas || editing) return;
  const action = ([
    "group", "mergeGroup", "ungroup", "addNode", "moveTool", "handTool", "arrange", "search",
    "delete", "copy", "paste", "undo", "redo", "zoomIn", "zoomOut", "fitView",
  ] as const).find((action) =>
    shortcutMatches(event, shortcuts[action])
  );
  if (!action) {
    const nativeClipboardKey = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey
      && (event.code === "KeyV" || event.code === "KeyC" && flow.getSelectedNodes.value.length && !window.getSelection()?.toString());
    if (panKeyPressed.value || nativeClipboardKey) event.preventDefault();
    return;
  }
  if (!canvasId.value || !project.value?.directory) return;
  if (action === "copy" && (!flow.getSelectedNodes.value.length || window.getSelection()?.toString())) return;
  // 桌面快捷键直接复用原生剪贴板桥接；浏览器 Ctrl/Cmd+V 保留原生事件，避免额外读取权限。
  if (!actualPlatform.isDesktop && action === "paste" && event.code === "KeyV" && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) return;
  event.preventDefault();
  if (event.repeat) return;
  if (action === "delete") {
    const nodes = [...flow.getSelectedNodes.value];
    const menu = nodeMenuRef.value;
    if (!menu || !nodes.some((node) => node.deletable !== false)) return;
    void canvasHistory
      .batch(() => menu.deleteSelection(nodes))
      .catch((error) => {
        ElMessage.error(error instanceof Error ? error.message : "Xóa node thất bại");
      });
    return;
  }
  if (action === "copy") void copySelectedNodes();
  else if (action === "paste") void pasteNodeAtCenter();
  else if (action === "undo" || action === "redo") void changeHistory(action);
  else if (action === "group" || action === "mergeGroup" || action === "ungroup") {
    void selectionToolbarRef.value?.operate(action);
  } else if (action === "addNode") addNodeAtPointer();
  else if (action === "moveTool" || action === "handTool") selectedTool.value = action === "handTool" ? "hand" : "move";
  else if (action === "arrange") void canvasControlsRef.value?.arrangeNodes();
  else if (action === "search") nodeSearchRef.value?.open();
  else void flow[action]();
}

function resetCanvasKeys() {
  pressedCodes.clear();
  gestureScale = undefined;
  zoomKeyPressed.value = false;
  panKeyPressed.value = false;
  selectionKeyPressed.value = getShortcutBindings(generalSettings.value.canvasShortcuts.selection).includes("None");
  flow.multiSelectionActive.value = false;
  if (!flow.userSelectionActive.value) flow.userSelectionRect.value = null;
}

watch([() => props.active, () => props.settingsVisible, () => generalSettings.value.canvasShortcuts], resetCanvasKeys, { deep: true, flush: "sync", immediate: true });

function refreshInstalled(event: WindowEventMap["toonflow:plugin-installed"]) {
  if (event.detail.type === "node" && !handledPluginEvents.has(event)) void loadRemoteNodes(event.detail.name);
}

const refreshNodeConfig = () => { void loadRemoteNodes(); };

onMounted(() => {
  // 在捕获阶段同步修饰键，避免节点编辑器截断 keydown/keyup 后缩放状态丢失或卡住。
  window.addEventListener("keydown", updateCanvasKeys, true);
  window.addEventListener("keyup", updateCanvasKeys, true);
  window.addEventListener("blur", resetCanvasKeys);
  window.addEventListener("toonflow:plugin-installed", refreshInstalled);
  window.addEventListener("toonflow:node-config-updated", refreshNodeConfig);
  document.addEventListener("paste", pasteNode);
  document.addEventListener("copy", copyNode);
  document.addEventListener("beforecopy", beforeClipboard);
  document.addEventListener("beforepaste", beforeClipboard);
  void loadRemoteNodes();
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", updateCanvasKeys, true);
  window.removeEventListener("keyup", updateCanvasKeys, true);
  window.removeEventListener("blur", resetCanvasKeys);
  window.removeEventListener("toonflow:plugin-installed", refreshInstalled);
  window.removeEventListener("toonflow:node-config-updated", refreshNodeConfig);
  document.removeEventListener("paste", pasteNode);
  document.removeEventListener("copy", copyNode);
  document.removeEventListener("beforecopy", beforeClipboard);
  document.removeEventListener("beforepaste", beforeClipboard);
  workspaceController.abort(new Error("Không gian làm việc đã đóng"));
  canvasController.abort(new Error("Canvas đã đóng"));
  saveCanvas.flush();
  loadRequest++;
});

const nodeWindow = window as typeof window & {
  toonflowNodeHost?: { vue: typeof vueRuntime; vueFlow: typeof vueFlowRuntime; elementPlus: typeof elementPlusRuntime; three: typeof threeRuntime; modelIcons: typeof modelIcons; i18n: typeof i18nRuntime; ai: { runAgentLoop: typeof runAgentLoop; createAssistantMessageEventStream: typeof createAssistantMessageEventStream } };
  toonflowNodes?: NodeTypesObject;
};
nodeWindow.toonflowNodeHost = { vue: vueRuntime, vueFlow: vueFlowRuntime, elementPlus: elementPlusRuntime, three: threeRuntime, modelIcons, i18n: i18nRuntime, ai: { runAgentLoop, createAssistantMessageEventStream } };
provide("nodeConfig", (nodeType: string) => nodeConfigs.value[nodeType] ?? {});
provide("workspaceFiles", () => {
  const directory = project.value?.directory;
  if (!directory) throw new Error("Hãy chọn thư mục làm việc trước");
  return useWorkspaceFiles(directory);
});
provide("workspaceDirectory", () => {
  const directory = project.value?.directory;
  if (!directory) throw new Error("Hãy chọn thư mục làm việc trước");
  return directory;
});
provide("reloadRemoteNode", (type: string) => {
  const name = type.replace(/^remote-/, "");
  if (!type.startsWith("remote-") || !/^[a-z][a-zA-Z0-9]*$/.test(name)) throw new Error("Loại node không hợp lệ");
  return loadNode(name, `/api/nodes/files?name=${name}`, true);
});

async function loadNode(name: string, url: string, force = false): Promise<void> {
  const nodeType = `remote-${name}`;
  const signal = canvasController.signal;
  const pending = nodeLoads.get(nodeType);
  if (pending) {
    if (!force) return pending;
    await pending.catch(() => {});
  }
  if (!force && nodeTypes.value[nodeType] && !nodeErrors.value[nodeType]) return;
  if (force) {
    signal.throwIfAborted();
    // ACT: 复用画布修订号收敛等待期间的编辑；持续修改画布时延后刷新，不额外维护节点修订状态。
    let revision: number;
    do {
      revision = saveRevision;
      await Promise.all(flow.getNodes.value.filter(node => node.type === nodeType).map(node => useNodeEvent(node.id, flow).emit("save", "reload")));
      await nextTick();
      signal.throwIfAborted();
    } while (revision !== saveRevision);
    const loading = nodeLoads.get(nodeType);
    if (loading) return loading;
  }
  delete nodeErrors.value[nodeType];
  const nodeLoad = loadNodeComponent(name, url, force)
    .then((remoteNode) => {
      // 同类型节点共享组件，运行错误由每个节点自己的边界显示。
      nodeTypes.value = { ...nodeTypes.value, [nodeType]: markRaw(remoteNode) };
    })
    .catch((error) => {
      nodeErrors.value[nodeType] = error instanceof Error ? error.message : String(error);
      throw error;
    })
    .finally(() => nodeLoads.delete(nodeType));
  nodeLoads.set(nodeType, nodeLoad);
  return nodeLoad;
}

async function loadRemoteNodes(reloadName?: string, requireReload = false) {
  if (reloadName) nodeReloads.add(reloadName);
  const requestId = ++loadRequest;
  const signal = canvasController.signal;
  nodeListLoading.value = true;
  try {
    const { data } = await axios.get<{ code: number; data: { name: string; displayName: string; url: string; enabled?: boolean; config?: Record<string, unknown> }[] }>(
      "/api/nodes/get",
      { headers: { "Cache-Control": "no-cache", "x-toonflow-workspace": "1" } }
    );
    if (requestId !== loadRequest) {
      if (requireReload) throw new Error("Canvas đang tải hoặc chỉnh sửa, vui lòng thử lại sau");
      return;
    }
    if (data.code !== 200 || !Array.isArray(data.data)) throw new Error("Định dạng danh sách node không hợp lệ");
    const nodes = data.data.filter(node => {
      if (!node || typeof node.name !== "string" || !/^[a-z][a-zA-Z0-9]*$/.test(node.name) || node.url !== `/api/nodes/files?name=${node.name}`) {
        console.error("Địa chỉ node không hợp lệ", node);
        return false;
      }
      return true;
    });
    nodeConfigs.value = Object.fromEntries(nodes.map(node => [`remote-${node.name}`, node.config ?? {}]));
    const enabledNodes = nodes.filter(node => node.enabled !== false);
    // 节点各自加载完成后即可出现在菜单中，不等待其他节点的脚本。
    nodeOptions.value = enabledNodes.map(node => ({ type: `remote-${node.name}`, get label() { return translate(node.displayName); } }))
      .sort((left, right) => left.type.localeCompare(right.type));
    if (requireReload && !enabledNodes.some(node => node.name === reloadName)) throw new Error("Loại node chưa được bật hoặc tải, hãy gọi getCanvas trước");
    // ACT: 安装事件合并到最新列表请求，避免连续更新不同节点时丢失较早的刷新名称。
    const reloadNames = new Set(nodeReloads);
    nodeReloads.clear();
    await Promise.all(
      enabledNodes.map(async (node) => {
        const nodeType = `remote-${node.name}`;
        try {
          if (nodeTypes.value[nodeType] && !nodeErrors.value[nodeType] && !reloadNames.has(node.name)) return;
          await loadNode(node.name, node.url, reloadNames.has(node.name));
        } catch (error) {
          if (requireReload && node.name === reloadName) throw error;
          console.error("Tải node từ xa thất bại", node, error);
          // 保存拒绝时旧组件仍可用，不从节点菜单中移除；脚本加载错误仍排除。
          if (nodeTypes.value[nodeType] && !nodeErrors.value[nodeType]) {
            if (reloadNames.has(node.name) && !signal.aborted) ElMessage.warning({
              message: `${node.displayName}đã được cài đặt nhưng không thể làm mới node hiện tại. Hãy đợi tác vụ hoàn tất rồi nhấn nút làm mới ở góc trên bên phải node.`,
              grouping: true,
            });
          }
        }
      })
    );
    if (requireReload && !availableNodes.value.some(node => node.type === `remote-${reloadName}`)) throw new Error("Node từ xa chưa được tải, hãy kiểm tra plugin đã cài đặt và bật");
  } catch (error) {
    if (requireReload) throw error;
    if (requestId === loadRequest) console.error("Không lấy được danh sách node từ xa", error);
  } finally {
    if (requestId === loadRequest) nodeListLoading.value = false;
  }
}

const defaultEdgeOptions = markRaw({
  type: "simplebezier",
  animated: false,
  class: ({ sourceNode, targetNode }: GraphEdge) => {
    if (!sourceNode.selected && !sourceNode.dragging && !targetNode.selected && !targetNode.dragging) return "";
    return ["edgeNodeActive", generalSettings.value.canvasEdgeColorMode !== "none" && "edgeActive", generalSettings.value.canvasEdgeAnimationEnabled && "animated"].filter(Boolean).join(" ");
  },
  focusable: false,
  selectable: false,
  updatable: false,
  interactionWidth: 40,
});
</script>

<style lang="scss" scoped>
:global(.referenceAssetDialog) {
  display: flex;
  flex-direction: column;
  height: 80dvh;
  max-height: calc(100dvh - 32px);
  overflow: hidden;
}

:global(.referenceAssetDialog .el-dialog__body) {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.canvas {
  width: 100%;
  height: 100%;

  &.canvasUnselected :deep(.vue-flow__viewport) {
    visibility: hidden;
    pointer-events: none;
  }

  .canvasOverlay {
    position: absolute;
    inset: 0;
    z-index: 4;
    display: grid;
    place-items: center;
    padding: 24px;
    background: var(--el-bg-color);
    color: var(--el-text-color-secondary);
    font-size: 14px;
    line-height: 1.6;
    text-align: center;
    cursor: default;
  }

  &.compositingEnabled :deep(.vue-flow__transformationpane) {
    will-change: transform;
  }

  &.handMode :deep(.vue-flow__transformationpane),
  &.handMode :deep(.vue-flow__transformationpane *) {
    pointer-events: none !important;
  }

  &.handMode :deep(.vue-flow__pane) {
    cursor: grab;
  }

  &.edgesHidden :deep(.vue-flow__edges:not(:has(.edgeNodeActive))) {
    display: none;
  }
  &.edgesHidden :deep(.vue-flow__handle:not(.connectedNodeActive)) {
    // Vue Flow 仍会测量隐藏端口，必须保留布局以免零尺寸污染连线坐标。
    visibility: hidden !important;
  }

  :deep(.vue-flow__edge.edgeActive .vue-flow__edge-path) {
    stroke: var(--canvasEdgeColor);
  }

  &:has(.selectionConnection) :deep(.vue-flow__node:not(.selected) .nodeHandle.target .handleIcon) {
    opacity: 1;
  }

  :deep(.vue-flow__nodesselection-rect) {
    box-sizing: content-box;
    padding: 8px;
    margin: -8px;
    border-radius: 4px;
  }

  &.multiSelectionMode :deep(.vue-flow__nodesselection-rect) {
    pointer-events: none;
  }
}
.edgeDisconnect {
  position: fixed;
  z-index: 1000;
  width: 32px;
  height: 32px;
  padding: 0;
  transform: translate(-50%, -50%);
}
</style>
