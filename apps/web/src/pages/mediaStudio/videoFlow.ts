import { z } from "@toonflow/nodes-scaffold/nodeTools";
import { kindLabels, getFlowIssues, studioFlowSchema, type StepKind, type StudioFlow } from "./studioFlows";

export const flowId = "video_factory_sequential_flow";
export const flowStages = ["prepare", "script", "frame", "video"] as const;
export type FlowStage = typeof flowStages[number];
export const stageLabels = { prepare: "Tách ý tưởng", script: "Dựng kịch bản", frame: "Tạo khung hình đầu", video: "Tạo video" };
export const runPath = ".macflowVideoFlow.json";
export const runMaxBytes = 12 * 1024 * 1024;
export const promptLimit = 100000;
export const contextLimit = 20000;
export const batchLimit = 30;
export const imageLimit = 8;
export const imageByteLimit = 20 * 1024 * 1024;

export const imageExtensions: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif",
};
const path = z.string().min(1).max(2048).refine(value => !/^[\\/]|[:\u0000-\u001f]/.test(value) && value.split(/[\\/]/).every(part => part && part !== "." && part !== ".."));
const imageMime = z.string().regex(/^image\/[a-z0-9.+-]+$/i);
const referenceSchema = z.object({ path, mimeType: imageMime });
export const photoSchema = referenceSchema.extend({ name: z.string().min(1).max(300), bytes: z.number().int().positive().max(imageByteLimit) });
export type FlowPhoto = z.infer<typeof photoSchema>;
export const flowFileSchema = z.object({ path, mimeType: z.string().regex(/^(image|video)\/[a-z0-9.+-]+$/i), mediaType: z.enum(["image", "video"]) })
  .refine(file => file.mimeType.toLowerCase().startsWith(file.mediaType + "/"));
const modeSchema = z.enum(["singleImage", "startFrameOptional", "endFrameOptional"]);
const choiceSchema = z.object({ text: z.string().max(512), image: z.string().max(512), video: z.string().max(512) });
const runModeSchema = z.enum(["automatic", "review"]);
const inputSchema = z.object({
  prompts: z.string().max(promptLimit),
  sharedScript: z.string().max(contextLimit),
  product: z.string().max(contextLimit),
  references: z.array(photoSchema).max(imageLimit),
  products: z.array(photoSchema).max(imageLimit),
  templateId: z.string().max(64),
  mode: runModeSchema,
  models: choiceSchema,
});
const requestSchema = z.object({
  mediaType: z.enum(["image", "video"]), providerId: z.string().min(1), modelId: z.string().min(1),
  prompt: z.string().min(1).max(promptLimit), images: z.array(referenceSchema).optional(), firstFrame: referenceSchema.optional(),
  mode: modeSchema.optional(), ratio: z.string().optional(),
  size: z.string().optional(), duration: z.number().positive().optional(), resolution: z.string().optional(),
});
const progressSchema = z.object({
  state: z.enum(["waiting", "queued", "running", "done", "review", "error", "interrupted"]),
  message: z.string().max(2000).optional(),
  attempt: z.object({ id: z.uuid(), request: requestSchema, uncertain: z.boolean().optional(), replaceable: z.boolean().optional() }).optional(),
});
export const variantLimit = 12;
const variantSchema = z.object({
  id: z.uuid(), kind: z.enum(["frame", "video"]), adjustment: z.string().max(2000),
  sourceFrame: flowFileSchema.optional(), progress: progressSchema, file: flowFileSchema.optional(),
});
const itemSchema = z.object({
  id: z.uuid(), prompt: z.string().max(promptLimit), script: z.string().max(contextLimit).optional(),
  frame: flowFileSchema.optional(), video: flowFileSchema.optional(), approved: z.boolean(),
  stages: z.object({ prepare: progressSchema, script: progressSchema, frame: progressSchema, video: progressSchema }),
  variants: z.array(variantSchema).max(variantLimit).optional(),
  preferred: z.object({ frame: z.uuid().optional(), video: z.uuid().optional() }).optional(),
});
const runSchema = z.object({
  version: z.literal(1), flowId: z.literal(flowId), id: z.uuid(), writeId: z.uuid().optional(),
  input: inputSchema, template: studioFlowSchema, items: z.array(itemSchema).min(1).max(batchLimit),
}).refine(run => new Set(run.items.map(item => item.id)).size === run.items.length);

export type VideoFlowInput = z.infer<typeof inputSchema>;
export type VideoFlowRun = z.infer<typeof runSchema>;
export type FlowItem = VideoFlowRun["items"][number];
export type FlowVariant = z.infer<typeof variantSchema>;
export type FlowOutputKind = FlowVariant["kind"];
export type StepProgress = FlowItem["stages"][FlowStage];
export type MediaAttempt = NonNullable<StepProgress["attempt"]>;
export type FlowMediaFile = z.infer<typeof flowFileSchema>;
export type VideoFlowMode = z.infer<typeof runModeSchema>;
export type VideoFlowRequest = z.infer<typeof requestSchema>;

export function flowOutput(item: FlowItem, kind: FlowOutputKind) {
  return item.variants?.find(variant => variant.kind === kind && variant.id === item.preferred?.[kind] && variant.progress.state === "done")?.file ?? item[kind];
}

export function canResumeProgress(progress: StepProgress) {
  return progress.state === "waiting" || progress.state === "running" || progress.state === "queued";
}

export function emptyFlowInput(): VideoFlowInput {
  return { prompts: "", sharedScript: "", product: "", references: [], products: [], templateId: "", mode: "automatic", models: { text: "", image: "", video: "" } };
}

export function readFlowInput(value: unknown): VideoFlowInput {
  const result = inputSchema.safeParse(value);
  return result.success ? result.data : emptyFlowInput();
}

export function readVideoRun(value: string) {
  const result = runSchema.safeParse(JSON.parse(value));
  if (!result.success || !isVideoFlowTemplate(result.data.template)) throw new Error("Tệp tiến độ của dự án không đúng định dạng.");
  return result.data;
}

export function splitFlowPrompts(input: string) {
  const prompts: string[] = [];
  let start = -1;
  let depth = 0;
  for (let index = 0; index < input.length; index++) {
    const char = input[index]!;
    if (depth === 0 && /\s/.test(char)) continue;
    if (depth === 0 && char !== "[") throw new Error(`Dùng [ ] bao quanh từng prompt. Có nội dung ngoài dấu ngoặc tại ký tự ${index + 1}.`);
    if (depth > 0 && char === "\\" && (input[index + 1] === "[" || input[index + 1] === "]" || input[index + 1] === "\\")) {
      index++;
      continue;
    }
    if (char === "[" && depth++ === 0) start = index;
    if (char === "]" && --depth === 0) {
      prompts.push(input.slice(start + 1, index).replace(/\\([\[\]\\])/g, "$1").trim());
      if (prompts.length > batchLimit) throw new Error(`Mỗi đợt hỗ trợ tối đa ${batchLimit} prompt. Hãy chia danh sách thành các đợt nhỏ hơn.`);
    }
  }
  if (depth) throw new Error(`Thiếu dấu ] cho prompt mở tại ký tự ${start + 1}.`);
  if (!prompts.length) throw new Error("Nhập ít nhất một prompt trong dấu [ ].");
  return prompts;
}

export function isVideoFlowTemplate(template: StudioFlow) {
  const issues = getFlowIssues(template);
  return template.steps.length === 3 && template.steps[0]?.kind === "text" && template.steps[1]?.kind === "image" && template.steps[2]?.kind === "video"
    && !template.steps.some(step => step.sources.includes("sampleVideo")) && !issues.general.length && !issues.steps.size;
}

export function makeVideoRun(input: VideoFlowInput, template: StudioFlow, prompts: string[]): VideoFlowRun {
  return runSchema.parse({
    version: 1, flowId, id: crypto.randomUUID(), input, template,
    items: prompts.map(prompt => ({ id: crypto.randomUUID(), prompt, approved: false,
      stages: { prepare: { state: "waiting" }, script: { state: "waiting" }, frame: { state: "waiting" }, video: { state: "waiting" } } })),
  });
}

export function buildFlowPrompt(run: VideoFlowRun, item: FlowItem, kind: StepKind, adjustment = "") {
  const index = { text: 0, image: 1, video: 2 }[kind];
  const step = run.template.steps[index]!;
  const values: Record<string, string | undefined> = {
    idea: item.prompt, product: run.input.product, sharedScript: run.input.sharedScript,
    [run.template.steps[0]!.id]: item.script,
  };
  const includedValues = new Set<string>();
  const stepPrompt = step.prompt.replace(/\{\{(step[1-9]\d*|idea|product|sharedScript)\}\}/g, (_token, source: string) => {
    includedValues.add(source);
    return values[source] || "";
  });
  const base = [
    stepPrompt,
    !includedValues.has("idea") && `Ý tưởng của mục này:\n${item.prompt}`,
    !includedValues.has("product") && run.input.product.trim() && `Thông tin sản phẩm:\n${run.input.product.trim()}`,
    !includedValues.has("sharedScript") && run.input.sharedScript.trim() && `Kịch bản chung:\n${run.input.sharedScript.trim()}`,
    kind !== "text" && !includedValues.has(run.template.steps[0]!.id) && item.script && `Kịch bản đã dựng cho mục này:\n${item.script}`,
  ].filter(Boolean);
  if (kind === "image" && run.input.references.length) base.push(`${run.input.references.length} ảnh đính kèm đầu tiên là ảnh tham chiếu.`);
  if (kind === "image" && run.input.products.length) base.push(`${run.input.products.length} ảnh đính kèm cuối là ảnh sản phẩm. Giữ đúng nhận diện và chi tiết sản phẩm.`);
  if (kind === "video") base.push("Dùng ảnh đính kèm làm khung hình mở đầu và dựng chuyển động theo kịch bản của mục này.");
  if (adjustment) base.push("Điều chỉnh cho lần tạo lại này:\n" + adjustment);
  const prompt = base.join("\n\n");
  if (prompt.length > promptLimit) throw new Error(`Nội dung cho bước ${kindLabels[kind].toLowerCase()} quá dài. Hãy rút gọn mẫu hoặc đầu vào chung trước khi tạo đợt mới.`);
  return prompt;
}
