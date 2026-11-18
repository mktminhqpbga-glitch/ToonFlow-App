<template>
  <el-dialog v-model="visible" :title="`Chỉnh sửa kỹ năng · ${skill.displayName}`" width="min(1080px, calc(100vw - 32px))" alignCenter appendToBody :beforeClose="close" @closed="emit('closed')">
    <div class="skillEditor" :aria-busy="filesLoading || fileLoading">
      <el-alert v-if="filesError" :title="filesError" type="error" :closable="false" showIcon />
      <template v-else>
        <div class="fileTree">
          <el-button
            v-if="isDirectorySkill"
            class="newFileButton"
            size="small"
            :icon="IconFilePlus"
            :loading="creating"
            :disabled="saving || moving"
            @click="createFile">
            Tạo tệp mới
          </el-button>
          <el-tree
            :key="treeVersion"
            class="tree"
            :data="[treeRoot]"
            :icon="IconChevronRight"
            nodeKey="key"
            :props="{ label: 'label', children: 'children' }"
            defaultExpandAll
            highlightCurrent
            :currentNodeKey="selectedPath"
            :draggable="isDirectorySkill"
            :allowDrag="allowDrag"
            :allowDrop="allowDrop"
            @nodeClick="handleNodeClick"
            @nodeDrop="handleNodeDrop">
            <template #default="{ data, node }">
              <span class="treeItem">
                <component v-if="data.type === 'directory'" :is="node.expanded && !node.isLeaf ? IconFolderOpen : IconFolder" :size="18" aria-hidden="true" />
                <icon-file v-else :size="18" aria-hidden="true" />
                <span class="treeLabel">{{ data.label }}</span>
                <span v-if="dirtyPaths.has(data.key)" class="dirtyMark" aria-hidden="true">●</span>
              </span>
            </template>
          </el-tree>
        </div>
        <div class="fileEditor">
          <el-alert v-if="fileError" :title="fileError" type="error" :closable="false" showIcon />
          <template v-else>
            <el-text v-if="selectedPath === mainPath" size="small" type="info">name là mã định danh kỹ năng, không thể chỉnh sửa</el-text>
            <el-input
              v-model="draft"
              class="sourceInput"
              type="textarea"
              :rows="20"
              resize="none"
              :disabled="fileLoading || saving"
              :aria-label="`${selectedPath} Mã nguồn`"
              :spellcheck="false" />
          </template>
        </div>
      </template>
    </div>
    <template #footer>
      <el-button :disabled="saving || moving || confirming" @click="close()">Đóng</el-button>
      <el-button type="primary" :loading="saving" :disabled="fileLoading || !!fileError || draft === original || confirming" @click="save">Lưu</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import axios from "axios";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { IconChevronRight, IconFile, IconFilePlus, IconFolder, IconFolderOpen } from "@tabler/icons-vue";
import type { Plugin } from "./types";

interface TreeNode {
  key: string;
  label: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

const { skill } = defineProps<{ skill: Plugin }>();
const emit = defineEmits<{ saved: []; closed: [] }>();
const visible = ref(true);
const files = ref<string[]>([]);
const mainPath = ref("");
const filesLoading = ref(true);
const filesError = ref("");
const treeVersion = ref(0);
const selectedPath = ref("");
const draft = ref("");
const original = ref("");
const fileLoading = ref(true);
const fileError = ref("");
const saving = ref(false);
const creating = ref(false);
const moving = ref(false);
const confirming = ref(false);
const drafts = new Map<string, string>();
const dirtyPaths = ref(new Set<string>());
const headers = { "x-toonflow-workspace": "1" };
let controller = new AbortController();

// 单文件技能只有主文件本身，没有可管理的附属文件目录。
const isDirectorySkill = computed(() => files.value.length > 1 || files.value[0] !== mainPath.value);
const treeRoot = computed<TreeNode>(() => {
  const root: TreeNode = { key: "", label: skill.displayName, type: "directory", children: [] };
  const directories = new Map<string, TreeNode>([["", root]]);
  for (const path of files.value) {
    const parts = path.split("/");
    let parentKey = "";
    for (let index = 0; index < parts.length - 1; index++) {
      const key = parts.slice(0, index + 1).join("/");
      if (!directories.has(key)) {
        const node: TreeNode = { key, label: parts[index]!, type: "directory", children: [] };
        directories.get(parentKey)!.children!.push(node);
        directories.set(key, node);
      }
      parentKey = key;
    }
    directories.get(parentKey)!.children!.push({ key: path, label: parts.at(-1)!, type: "file" });
  }
  return root;
});

onBeforeUnmount(() => controller.abort());
onMounted(loadFiles);

async function loadFiles() {
  filesLoading.value = true;
  filesError.value = "";
  try {
    const { data } = await axios.get("/api/skills/list", { params: { name: skill.name }, headers, signal: controller.signal });
    if (data.code !== 200 || typeof data.data?.mainPath !== "string" || !Array.isArray(data.data.files) || !data.data.files.every((path: unknown) => typeof path === "string")) {
      throw new Error(data.message || "Định dạng danh sách tệp kỹ năng không hợp lệ");
    }
    mainPath.value = data.data.mainPath;
    files.value = data.data.files;
    treeVersion.value++;
    if (!selectedPath.value || !files.value.includes(selectedPath.value)) await selectFile(mainPath.value);
  } catch (error) {
    if (!controller.signal.aborted) filesError.value = errorMessage(error, "Không đọc được danh sách tệp kỹ năng, hãy mở lại và thử tiếp");
  } finally {
    filesLoading.value = false;
  }
}

function errorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) return typeof error.response?.data?.message === "string" ? error.response.data.message : fallback;
  return error instanceof Error ? error.message : fallback;
}

async function selectFile(path: string) {
  if (path === selectedPath.value || saving.value) return;
  const previousPath = selectedPath.value;
  if (previousPath) {
    if (draft.value !== original.value) {
      drafts.set(previousPath, draft.value);
      dirtyPaths.value.add(previousPath);
    } else {
      drafts.delete(previousPath);
      dirtyPaths.value.delete(previousPath);
    }
  }
  selectedPath.value = path;
  const cached = drafts.get(path);
  draft.value = cached ?? "";
  original.value = "";
  fileError.value = "";
  fileLoading.value = true;
  controller.abort();
  const requestController = new AbortController();
  controller = requestController;
  try {
    const { data } = await axios.get("/api/skills/read", {
      params: path === mainPath.value ? { name: skill.name } : { name: skill.name, path },
      headers,
      signal: requestController.signal,
    });
    if (requestController.signal.aborted || selectedPath.value !== path) return;
    if (data.code !== 200 || typeof data.data?.content !== "string") throw new Error(data.message || "Nội dung kỹ năng có định dạng không hợp lệ");
    original.value = data.data.content;
    if (cached === undefined) draft.value = data.data.content;
  } catch (error) {
    if (!requestController.signal.aborted && selectedPath.value === path) fileError.value = errorMessage(error, "Không đọc được tệp, hãy chọn lại và thử tiếp");
  } finally {
    if (selectedPath.value === path) fileLoading.value = false;
  }
}

function handleNodeClick(data: TreeNode) {
  if (data.type === "file") selectFile(data.key);
}

function allowDrag(node: { data: Record<string, unknown> }) {
  const data = node.data as unknown as TreeNode;
  return data.type === "file" && data.key !== mainPath.value && !saving.value && !moving.value;
}

function parentOf(path: string) {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}

function allowDrop(draggingNode: { data: Record<string, unknown> }, dropNode: { data: Record<string, unknown> }, type: string) {
  const drop = dropNode.data as unknown as TreeNode;
  if (type === "inner") return drop.type === "directory";
  // 仅允许拖到同目录内的兄弟文件前后调整顺序；跨目录移动统一走拖入目录节点。
  if (drop.type !== "file") return false;
  const dragging = draggingNode.data as unknown as TreeNode;
  return parentOf(dragging.key) === parentOf(drop.key);
}

async function handleNodeDrop(draggingNode: { data: Record<string, unknown> }, dropNode: { data: Record<string, unknown> }, dropType: string) {
  if (moving.value) return;
  const dragging = draggingNode.data as unknown as TreeNode;
  const drop = dropNode.data as unknown as TreeNode;
  const sourcePath = dragging.key;
  if (dropType === "inner") {
    const fileName = sourcePath.split("/").pop()!;
    const targetPath = drop.key ? `${drop.key}/${fileName}` : fileName;
    if (targetPath === sourcePath) { treeVersion.value++; return; }
    moving.value = true;
    try {
      const { data } = await axios.put("/api/skills/move", { name: skill.name, path: sourcePath, target: targetPath }, { headers });
      if (data.code !== 200) throw new Error(data.message || "Di chuyển tệp thất bại");
      if (drafts.has(sourcePath)) { drafts.set(targetPath, drafts.get(sourcePath)!); drafts.delete(sourcePath); }
      if (dirtyPaths.value.has(sourcePath)) { dirtyPaths.value.add(targetPath); dirtyPaths.value.delete(sourcePath); }
      if (selectedPath.value === sourcePath) selectedPath.value = targetPath;
      await loadFiles();
    } catch (error) {
    ElMessage.error(errorMessage(error, "Di chuyển tệp thất bại, vui lòng thử lại"));
      treeVersion.value++;
    } finally {
      moving.value = false;
    }
    return;
  }
  // 同目录内调整顺序（dropType 为 before/after），不改变文件路径。
  const siblings = files.value.filter(path => path !== mainPath.value && path !== sourcePath);
  const dropIndex = siblings.indexOf(drop.key);
  const insertIndex = dropIndex < 0 ? siblings.length : dropType === "before" ? dropIndex : dropIndex + 1;
  siblings.splice(insertIndex, 0, sourcePath);
  moving.value = true;
  try {
    const { data } = await axios.put("/api/skills/order", { name: skill.name, order: siblings }, { headers });
    if (data.code !== 200) throw new Error(data.message || "Lưu thứ tự thất bại");
    await loadFiles();
  } catch (error) {
    ElMessage.error(errorMessage(error, "Lưu thứ tự thất bại, vui lòng thử lại"));
    treeVersion.value++;
  } finally {
    moving.value = false;
  }
}

async function createFile() {
  if (creating.value || saving.value || !isDirectorySkill.value) return;
  const directory = selectedPath.value.includes("/") ? selectedPath.value.slice(0, selectedPath.value.lastIndexOf("/")) : "";
  let fileName: string;
  try {
    const { value } = await ElMessageBox.prompt(directory ? `Tệp mới sẽ được tạo trong “${directory}”` : "Tệp mới sẽ được tạo trong thư mục gốc kỹ năng", "Tạo tệp mới", {
      inputPattern: /^[^\\/]+$/,
      inputValidator: value => !!value?.trim() || "Hãy nhập tên tệp",
      inputErrorMessage: "Tên không được chứa dấu gạch chéo",
      confirmButtonText: "Tạo",
      cancelButtonText: "Hủy",
    });
    fileName = value.trim();
  } catch { return; }
  const path = directory ? `${directory}/${fileName}` : fileName;
  creating.value = true;
  try {
    const { data } = await axios.post("/api/skills/create", { name: skill.name, path }, { headers });
    if (data.code !== 200) throw new Error(data.message || "Tạo tệp thất bại");
    await loadFiles();
    await selectFile(path);
  } catch (error) {
    ElMessage.error(errorMessage(error, "Tạo tệp thất bại, vui lòng thử lại"));
  } finally {
    creating.value = false;
  }
}

async function close(done?: () => void) {
  if (saving.value || confirming.value) return;
  if (draft.value !== original.value || dirtyPaths.value.size) {
    confirming.value = true;
    try {
      await ElMessageBox.confirm("Các thay đổi chưa được lưu. Bạn có chắc muốn bỏ thay đổi và đóng?", "Thay đổi chưa lưu", { confirmButtonText: "Bỏ thay đổi", cancelButtonText: "Tiếp tục chỉnh sửa", type: "warning" });
    } catch { return; }
    finally { confirming.value = false; }
  }
  if (done) done();
  else visible.value = false;
}

async function save() {
  if (fileLoading.value || saving.value || fileError.value || confirming.value || draft.value === original.value) return;
  saving.value = true;
  const path = selectedPath.value;
  const content = draft.value;
  try {
    const { data } = await axios.put("/api/skills/save", { name: skill.name, ...(path === mainPath.value ? {} : { path }), content }, { headers });
    if (data.code !== 200) throw new Error(data.message || "Lưu tệp thất bại");
    if (selectedPath.value === path) original.value = content;
    drafts.delete(path);
    dirtyPaths.value.delete(path);
    emit("saved");
    ElMessage.success("Đã lưu");
  } catch (error) {
    ElMessage.error(errorMessage(error, "Lưu tệp thất bại, vui lòng thử lại"));
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" scoped>
.skillEditor {
  display: flex;
  gap: 16px;
  min-height: min(60vh, 560px);

  .fileTree {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: 8px;
    width: 220px;

    .newFileButton {
      width: 100%;
      margin-left: 0;
    }

    .tree {
      overflow-y: auto;
    }

    .treeItem {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      font-size: 13px;
      overflow-wrap: anywhere;

      svg {
        flex-shrink: 0;
        color: var(--el-text-color-secondary);
      }

      .treeLabel {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .dirtyMark {
        flex-shrink: 0;
        color: var(--el-color-warning);
      }
    }
  }

  .fileEditor {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  .sourceInput {
    flex: 1;

    :deep(textarea) {
      height: 100%;
      min-height: min(56vh, 520px);
      font-family: ui-monospace, Consolas, monospace;
      line-height: 1.6;
      tab-size: 2;
    }
  }
}
</style>
