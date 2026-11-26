import { z } from "@toonflow/nodes-scaffold/nodeTools";

export const stepKinds = ["text", "image", "video"] as const;
export const kindLabels = { text: "Văn bản", image: "Ảnh", video: "Video" };

export const flowInputs = [
  { id: "idea", label: "Ý tưởng", kind: "text" },
  { id: "product", label: "Thông tin sản phẩm", kind: "text" },
  { id: "sharedScript", label: "Kịch bản chung", kind: "text" },
  { id: "referenceImages", label: "Ảnh tham chiếu", kind: "image" },
  { id: "productImages", label: "Ảnh sản phẩm", kind: "image" },
  { id: "sampleVideo", label: "Video mẫu", kind: "video" },
] as const;

const stepSchema = z.object({
  id: z.string().regex(/^step[1-9]\d*$/),
  name: z.string(),
  kind: z.enum(stepKinds),
  prompt: z.string(),
  sources: z.array(z.string()),
  model: z.string(),
  options: z.object({ ratio: z.string().optional(), size: z.string().optional(), duration: z.number().positive().optional(), resolution: z.string().optional() }),
});

export const studioFlowSchema = z.object({ id: z.uuid(), name: z.string(), nextStep: z.number().int().positive(), steps: z.array(stepSchema) })
  .refine(flow => new Set(flow.steps.map(step => step.id)).size === flow.steps.length
    && flow.steps.every(step => Number(step.id.slice(4)) < flow.nextStep));
const librarySchema = z.object({ version: z.literal(1), templates: z.array(studioFlowSchema) })
  .refine(library => new Set(library.templates.map(flow => flow.id)).size === library.templates.length);

export type FlowStep = z.infer<typeof stepSchema>;
export type StudioFlow = z.infer<typeof studioFlowSchema>;
export type StepKind = FlowStep["kind"];
export type StudioKind = Exclude<StepKind, "text">;
export const flowLibraryPath = ".macflowStudioFlows.json";

export function parseFlowLibrary(text: string): StudioFlow[] {
  const result = librarySchema.safeParse(JSON.parse(text));
  if (!result.success) throw new Error("Tệp thư viện mẫu luồng không hợp lệ.");
  return result.data.templates;
}

export function makeFlowStep(flow: StudioFlow, kind: StepKind, values: Partial<Pick<FlowStep, "name" | "prompt" | "sources">> = {}): FlowStep {
  return {
    id: `step${flow.nextStep++}`,
    kind,
    name: kind === "text" ? "Soạn văn bản" : kind === "image" ? "Tạo ảnh" : "Tạo video",
    prompt: "",
    sources: [flow.steps.at(-1)?.id ?? "idea"],
    model: "",
    options: {},
    ...values,
  };
}

export function makeStarterFlow(kind: StudioKind): StudioFlow {
  const flow: StudioFlow = { id: crypto.randomUUID(), name: kind === "image" ? "Mẫu tạo ảnh" : "Mẫu tạo video", nextStep: 1, steps: [] };
  if (kind === "image") {
    flow.steps.push(makeFlowStep(flow, "image", {
      sources: ["idea", "referenceImages", "productImages"],
      prompt: "Tạo ảnh từ ý tưởng đã nhập. Bám bố cục của ảnh tham chiếu và giữ đặc điểm của sản phẩm nếu có.",
    }));
  } else {
    const script = makeFlowStep(flow, "text", {
      name: "Viết kịch bản",
      sources: ["idea", "product", "sharedScript"],
      prompt: "Viết kịch bản theo từng cảnh từ ý tưởng và thông tin sản phẩm. Bám kịch bản chung nếu có.",
    });
    const frame = makeFlowStep(flow, "image", {
      name: "Tạo khung hình đầu",
      sources: [script.id, "referenceImages", "productImages"],
      prompt: "Tạo khung hình mở đầu theo kịch bản. Dùng tư liệu đã chọn để giữ nhất quán bối cảnh và sản phẩm.",
    });
    const video = makeFlowStep(flow, "video", {
      sources: [frame.id, script.id],
      prompt: "Dùng ảnh đã tạo làm khung hình đầu. Bám kịch bản để dựng chuyển động và nhịp cảnh.",
    });
    flow.steps.push(script, frame, video);
  }
  return flow;
}

export function getFlowIssues(flow: StudioFlow) {
  const general: string[] = [];
  const steps = new Map<string, string[]>();
  if (!flow.name.trim()) general.push("Nhập tên mẫu luồng.");
  if (!flow.steps.length) general.push("Thêm ít nhất một bước tạo ảnh hoặc video.");
  if (flow.steps.at(-1)?.kind === "text") general.push("Bước cuối phải tạo ảnh hoặc video để đưa sang Kết quả.");
  const positions = new Map(flow.steps.map((step, index) => [step.id, index]));
  const inputIds = new Set<string>(flowInputs.map(input => input.id));
  for (const [index, step] of flow.steps.entries()) {
    const issues: string[] = [];
    if (!step.name.trim()) issues.push("Nhập tên bước.");
    if (!step.prompt.trim()) issues.push("Nhập prompt cho bước này.");
    for (const source of step.sources) {
      if (inputIds.has(source)) continue;
      const position = positions.get(source);
      if (position === undefined) issues.push("Một nguồn dữ liệu đã bị xóa. Hãy bỏ nguồn đó hoặc chọn nguồn khác.");
      else if (position >= index) issues.push(`Bước này dùng dữ liệu từ “${flow.steps[position]!.name || "Bước chưa đặt tên"}”. Hãy đưa nguồn đó lên trước hoặc đổi nguồn dữ liệu.`);
    }
    for (const [token, source = ""] of step.prompt.matchAll(/\{\{(step[1-9]\d*|idea|product|sharedScript)\}\}/g)) {
      if (!step.sources.includes(source)) issues.push(`Prompt có tham chiếu ${token}. Hãy chọn lại nguồn đó hoặc bỏ tham chiếu trong prompt.`);
      const sourceIndex = positions.get(source);
      if (sourceIndex !== undefined && flow.steps[sourceIndex]?.kind !== "text") {
        issues.push(`Nguồn ${token} đã đổi sang ảnh hoặc video. Bỏ mã này khỏi prompt để dùng nguồn dưới dạng tệp đính kèm.`);
      }
    }
    if (issues.length) steps.set(step.id, [...new Set(issues)]);
  }
  return { general, steps };
}
