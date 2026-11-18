import { z, type NodeAiTool } from "@toonflow/nodes-scaffold/runtime";
import { sceneSchema, type SceneDocument } from "./scene";
import { directorPlanSchema, type DirectorPlan, type DirectorPlanItem } from "./sceneAnimation";

const pathSchema = z.array(z.union([
  z.string().max(100).refine(value => !["__proto__", "constructor", "prototype"].includes(value), "Đường dẫn không được truy cập prototype"),
  z.number().int().min(0).max(2000),
])).max(24);
const selection = {
  objectId: z.string().min(1).max(100).optional(),
  joint: directorPlanSchema.shape.tracks.element.shape.joint,
};
const readSchema = z.strictObject({
  section: z.enum(["scene", "plan", "history", "schema"]),
  ...selection,
  planId: z.string().min(1).max(100).optional(),
  path: pathSchema.optional(),
});
const operationSchema = z.strictObject({
  section: z.enum(["scene", "plan"]),
  ...selection,
  path: pathSchema,
  op: z.enum(["add", "replace", "remove"]),
  value: z.json().optional(),
});
const editSchema = z.strictObject({ operations: z.array(operationSchema).min(1).max(100) });
type Draft = { scene: SceneDocument; plan: Partial<DirectorPlan> };
type Path = z.infer<typeof pathSchema>;

function checkSize(value: unknown) {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 500000) throw new Error("Bản nháp hoặc tham số công cụ vượt 500 KB, hãy rút gọn cảnh hoặc keyframe");
}

function readPath(value: unknown, path: Path): unknown {
  for (const key of path) {
    if (!value || typeof value !== "object" || !Object.hasOwn(value, key)
      || (Array.isArray(value) && !/^(0|[1-9]\d*)$/.test(String(key)))) {
      throw new Error(`Đường dẫn không tồn tại: ${path.join(".")}`);
    }
    value = (value as Record<string | number, unknown>)[key];
  }
  return value;
}

function selectionPath(value: unknown, section: "scene" | "plan", objectId?: string, joint?: string): Path {
  if (joint && (section !== "plan" || !objectId)) throw new Error("joint chỉ được dùng cùng objectId của plan");
  if (!objectId) return [];
  const key = section === "scene" ? "objectList" : "tracks";
  const items = readPath(value, [key]) as (SceneDocument["objectList"][number] & DirectorPlan["tracks"][number])[];
  const index = items.findIndex(item => section === "scene" ? item.threeJsonId === objectId : item.objectId === objectId && item.joint === joint);
  if (index < 0) throw new Error(`Không tìm thấy ${section === "scene" ? "đối tượng" : "track"}: ${objectId}${joint ? ` / ${joint}` : ""}`);
  return [key, index];
}

function applyOperation(draft: Draft, operation: z.infer<typeof operationSchema>) {
  const { section, op, value } = operation;
  if (op !== "remove" && !Object.hasOwn(operation, "value")) throw new Error(`${op} phải cung cấp value`);
  const path = [...selectionPath(draft[section], section, operation.objectId, operation.joint), ...operation.path];
  if (!path.length) {
    if (op !== "replace") throw new Error("Chỉ được dùng replace cho toàn bộ scene hoặc plan; hãy dùng đường dẫn tương đối để thêm hoặc xóa trường");
    Object.assign(draft, { [section]: structuredClone(value) });
    return;
  }
  const key = path.pop()!;
  const parent = readPath(draft[section], path);
  if (!parent || typeof parent !== "object") throw new Error(`Đường dẫn không trỏ đến đối tượng hoặc mảng: ${path.join(".")}`);
  if (Array.isArray(parent)) {
    const index = key === "-" && op === "add" ? parent.length : /^(0|[1-9]\d*)$/.test(String(key)) ? Number(key) : -1;
    if (index < 0 || index >= parent.length + Number(op === "add")) throw new Error(`Vị trí mảng không tồn tại: ${[...path, key].join(".")}`);
    if (op === "remove") parent.splice(index, 1);
    else if (op === "add") parent.splice(index, 0, structuredClone(value));
    else parent[index] = structuredClone(value);
    return;
  }
  const object = parent as Record<string | number, unknown>;
  const exists = Object.hasOwn(object, key);
  if (op === "add" ? exists : !exists) throw new Error(`Trường ${exists ? "đã tồn tại, hãy dùng replace" : "không tồn tại"}: ${[...path, key].join(".")}`);
  if (op === "remove") delete object[key];
  else object[key] = structuredClone(value);
}

function validateDraft(draft: Draft, complete = false) {
  checkSize(draft);
  const scene = sceneSchema.parse(draft.scene);
  const plan = directorPlanSchema.safeParse(draft.plan);
  const issues = plan.success ? [] : plan.error.issues;
  // ACT: 仅允许顶层必填项尚未补齐；字段结构、数值和已完整方案的约束仍拒绝整批修改。
  const incomplete = (issue: z.core.$ZodIssue) => issue.path.length === 1 && (
    (issue.code === "invalid_type" && !Object.hasOwn(draft.plan, issue.path[0]!))
    || (issue.code === "too_small" && issue.path[0] === "cameraFrames" && draft.plan.cameraFrames?.length === 0)
    || (issue.code === "custom" && issue.path[0] === "cameraFrames" && draft.plan.cameraFrames?.length === 0)
  );
  const invalid = complete ? issues : issues.filter(issue => !incomplete(issue));
  if (invalid.length) throw new Error(invalid.slice(0, 8).map(issue => `plan.${issue.path.join(".")}：${issue.message}`).join("\n"));
  const objects = new Map(scene.objectList.map(object => [object.threeJsonId, object]));
  for (const track of draft.plan.tracks ?? []) {
    const object = objects.get(track.objectId);
    if (!object) throw new Error(`tracks tham chiếu đối tượng không tồn tại: ${track.objectId}; khi xóa đối tượng phải xóa cả track tương ứng`);
    if (track.joint && object.objType !== "mannequin") throw new Error(`Chỉ hình nhân hỗ trợ track khớp: ${track.objectId} / ${track.joint}`);
  }
  draft.scene = scene;
  if (plan.success) draft.plan = plan.data;
  return { valid: plan.success, issues: issues.map(issue => `plan.${issue.path.join(".")}：${issue.message}`) };
}

export function createDirectorDraft(scene: SceneDocument, plan?: DirectorPlan, plans: DirectorPlanItem[] = []) {
  let draft: Draft = structuredClone({ scene, plan: plan ?? { tracks: [], cameraFrames: [] } });
  const history = structuredClone(plans);
  validateDraft(draft);
  const originalScene = JSON.stringify(draft.scene);
  let edited = false;

  const tools: NodeAiTool[] = [{
    name: "readDocument",
    description: "Đọc scene / plan của bản nháp riêng ở lượt này; objectId chọn đối tượng trong cảnh hoặc track trong phương án, joint chọn track khớp của hình nhân, path là đường dẫn trường tương đối. history chỉ đọc và bắt buộc có planId. Có thể đọc JSON Schema bằng schema với path ['scene'] / ['plan']. Chỉ đọc phần cần thiết, tránh đọc lại toàn bộ tài liệu nhiều lần.",
    parameters: z.toJSONSchema(readSchema),
    execute(args, signal) {
      signal?.throwIfAborted();
      const { section, objectId, joint, planId, path = [] } = readSchema.parse(args);
      if (section === "schema") {
        if (objectId || joint || planId) throw new Error("schema không hỗ trợ objectId, joint hoặc planId");
        return readPath({ scene: z.toJSONSchema(sceneSchema), plan: z.toJSONSchema(directorPlanSchema) }, path);
      }
      let value: unknown = section === "history" ? history.find(item => item.id === planId) : draft[section];
      if (section === "history" && (!planId || !value)) throw new Error("Phương án trong lịch sử không tồn tại; hãy chọn planId hợp lệ từ bản tóm tắt");
      if (section !== "history" && planId) throw new Error("planId chỉ dùng với history chỉ đọc");
      const selected = selectionPath(value, section === "scene" ? "scene" : "plan", objectId, joint);
      value = readPath(value, [...selected, ...path]);
      checkSize(value);
      return { value: structuredClone(value), ...validateDraft(draft) };
    },
  }, {
    name: "editDocument",
    description: "Chỉnh sửa theo lô nguyên tử bản nháp scene / plan của lượt này, không thay đổi lịch sử hoặc dữ liệu trên đĩa. objectId / joint chọn đối tượng/track hiện có theo ID ổn định, path là đường dẫn tương đối. add thêm trường mới hoặc chèn phần tử mảng; chỉ số '-' nghĩa là thêm vào cuối. replace / remove phải trỏ đến đường dẫn hiện có. Thêm đối tượng qua ['objectList','-'] của scene, thêm track qua ['tracks','-'] của plan. Bất kỳ thao tác sai nào sẽ hủy cả lô. Khi valid=false, mới lưu bản nháp chưa hoàn tất; cần xử lý từng issues cho đến valid=true.",
    parameters: z.toJSONSchema(editSchema),
    execute(args, signal) {
      signal?.throwIfAborted();
      checkSize(args);
      const { operations } = editSchema.parse(args);
      const next = structuredClone(draft);
      operations.forEach(operation => applyOperation(next, operation));
      const validation = validateDraft(next);
      signal?.throwIfAborted();
      draft = next;
      edited = true;
      return { applied: operations.length, ...validation };
    },
  }];

  return {
    tools,
    get edited() { return edited; },
    get sceneChanged() { return JSON.stringify(draft.scene) !== originalScene; },
    summary() {
      return {
        objects: draft.scene.objectList.map(({ threeJsonId, name, objType }) => ({ threeJsonId, name, objType })),
        plan: { name: draft.plan.name, duration: draft.plan.duration, tracks: draft.plan.tracks?.map(({ objectId, joint, frames }) => ({ objectId, joint, frames: frames.length })), cameraFrames: draft.plan.cameraFrames?.length },
        history: history.map(({ id, name, duration, tracks, cameraFrames }) => ({ id, name, duration, tracks: tracks.length, cameraFrames: cameraFrames.length })),
        ...validateDraft(draft),
      };
    },
    read(): { scene: SceneDocument; plan: DirectorPlan } {
      validateDraft(draft, true);
      return structuredClone(draft) as { scene: SceneDocument; plan: DirectorPlan };
    },
  };
}
