import { computed, onScopeDispose, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue";
import { runAgentLoop, type AgentTool, type AgentToolResult } from "@earendil-works/pi-agent-core";
import { createAssistantMessageEventStream, type AssistantMessage, type Context, type Message, type Model } from "@earendil-works/pi-ai";
import { EventSourceParserStream } from "eventsource-parser/stream";
import type { MediaGenerationRequest, MediaModel } from "@toonflow/tools-scaffold/runtime";
import type { NodeOutput } from "./values";
import { readNodeModels, subscribeNodeModels } from "./modelCatalog";
export { invalidateNodeModels, readNodeModels, subscribeNodeModels } from "./modelCatalog";

export type NodeAiModel = {
  providerId: string;
  providerLabel: string;
  modelId: string;
  routeId?: string;
  label: string;
  protocol: "openai-completions" | "openai-responses" | "anthropic-messages" | "chrome";
  contextWindow?: number;
  maxOutputTokens?: number;
};
export type NodeMediaModel = Omit<MediaModel, "mode"> & {
  routeId?: string;
  mode?: (string | string[])[];
};
type ModelIdentity = { providerId: string; modelId: string; routeId?: string };

export function createNodeRequestId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 15) | 64;
  bytes[8] = (bytes[8]! & 63) | 128;
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")
    .replace(/^(........)(....)(....)(....)(............)$/, "$1-$2-$3-$4-$5");
}

export function getNodeModelIdentity(model: ModelIdentity) {
  return { providerId: model.providerId, modelId: model.providerId === "multiTenant" ? model.routeId ?? model.modelId : model.modelId };
}

export function getNodeModelKey(model: ModelIdentity) {
  const identity = getNodeModelIdentity(model);
  return JSON.stringify([identity.providerId, identity.modelId]);
}

export function findNodeModel<T extends ModelIdentity>(models: readonly T[], selection: string | Pick<ModelIdentity, "providerId" | "modelId">): T | undefined {
  let identity: Pick<ModelIdentity, "providerId" | "modelId">;
  if (typeof selection === "string") {
    let value: unknown;
    try { value = JSON.parse(selection); } catch { return; }
    if (!Array.isArray(value) || value.length !== 2 || !value.every(item => typeof item === "string")) return;
    identity = { providerId: value[0], modelId: value[1] };
  } else identity = selection;
  if (!identity || typeof identity.providerId !== "string" || !identity.providerId
    || typeof identity.modelId !== "string" || !identity.modelId) return;
  const modelId = identity.providerId === "aiChrome" && identity.modelId === "museImage" ? "museChrome" : identity.modelId;
  return models.find(model => model.providerId === identity.providerId && (model.modelId === modelId
    || identity.providerId === "multiTenant" && model.routeId === identity.modelId));
}

export function useNodeModelSelection<T extends ModelIdentity>(models: MaybeRefOrGetter<readonly T[]>, selection: Ref<string>) {
  const selected = computed(() => findNodeModel(toValue(models), selection.value));
  watch(selected, model => {
    if (!model || (model.providerId !== "multiTenant"
      && !(model.providerId === "aiChrome" && selection.value === JSON.stringify(["aiChrome", "museImage"])))) return;
    const key = getNodeModelKey(model);
    if (selection.value !== key) selection.value = key;
  }, { immediate: true, flush: "sync" });
  return selected;
}
export type NodeImageRequest = {
  directory: string;
  providerId: string;
  modelId: string;
  prompt: string;
  outputDirectory: string;
  images?: { path: string; mimeType: string }[];
  ratio?: string;
  size?: string;
  other?: Record<string, unknown>;
};
export type NodeImageResult = { path: string; mimeType: string; mediaType: "image" };
export type NodeVideoRequest = Omit<MediaGenerationRequest, "size"> & { directory: string; outputDirectory: string };
export type NodeVideoResult = { path: string; mimeType: string; mediaType: "video" };
export type NodeMediaPriceRequest = (NodeImageRequest & { mediaType: "image" }) | (NodeVideoRequest & { mediaType: "video" }) | (NodeAudioRequest & { mediaType: "audio" });
export type NodeMediaPrice = { price: string; tips: string; maximum?: string };
export type NodeAudioRequest = Pick<MediaGenerationRequest, "providerId" | "modelId" | "prompt" | "images" | "audios" | "voice" | "speed" | "volume" | "pitch" | "language" | "format" | "sampleRate" | "other"> & { directory: string; outputDirectory: string };
export type NodeAudioResult = { path: string; mimeType: string; mediaType: "audio" };
export type NodeAiRequest = {
  providerId: string;
  modelId: string;
  chromeTabId?: number;
  prompt: string;
  systemPrompt?: string;
  directory?: string;
  references?: Extract<NodeOutput, { dataType: "STRING" | "IMAGE" | "VIDEO" | "FILE" }>[];
  tools?: NodeAiTool[];
  onEvent?: (event: NodeAiEvent) => void;
  signal?: AbortSignal;
};
export type NodeAiResult = {
  text: string;
  reasoning?: string;
};
export type NodeAiEvent = { type: "text" | "reasoning"; delta: string }
  | { type: "toolStart"; id: string; name: string; args: unknown }
  | { type: "toolEnd"; id: string; name: string; result: unknown; isError: boolean };
export type NodeAiTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>, signal?: AbortSignal): unknown | Promise<unknown>;
};

async function readResult<T>(response: Response): Promise<T> {
  const result = await response.json();
  if (!response.ok || result.code !== 200) throw Object.assign(new Error(result.message || `Yêu cầu AI thất bại (HTTP  ${response.status}), vui lòng thử lại sau.`), { status: response.status });
  return result.data;
}

type MediaPriceCache = {
  prices: Map<string, { expires: number; value: Promise<NodeMediaPrice | null> }>;
  requestedAt: Map<string, number>;
};
const mediaPriceCacheKey = Symbol.for("toonflow.nodeMediaPrices");
const mediaPriceCacheHost = globalThis as typeof globalThis & { [mediaPriceCacheKey]?: MediaPriceCache };
const mediaPriceCache = mediaPriceCacheHost[mediaPriceCacheKey] ??= (() => {
  const cache: MediaPriceCache = { prices: new Map(), requestedAt: new Map() };
  if (typeof window !== "undefined") {
    subscribeNodeModels(type => { if (type === "media") cache.prices.clear(); });
  }
  return cache;
})();

export type NodeMediaResult = NodeImageResult | NodeVideoResult | NodeAudioResult;
type MediaTaskResult = { code: number; data: NodeMediaResult[] | null; message: string };
export type NodeMediaTaskStatus = {
  taskId: string;
  state?: "running" | "interrupted" | "succeeded" | "failed" | "cancelled";
  resumable?: boolean;
  providerData?: unknown;
  nodeId?: string;
  canvasPath?: string;
  billedCost?: { amount: string; currency: string };
  result?: MediaTaskResult;
};
export type NodeMediaTaskOptions = {
  taskId?: string;
  nodeId?: string;
  canvasPath?: string;
  onStatus?: (status: NodeMediaTaskStatus) => void | Promise<void>;
  isCancelled?: () => boolean;
};
type PendingMediaTask = { directory: string; failedAt?: number; resume?: boolean; onStatus?: NodeMediaTaskOptions["onStatus"]; finish: (result: MediaTaskResult) => void; fail: (error: unknown) => void };
const mediaTasksKey = Symbol.for("toonflow.nodeMediaTasks.v2");
const mediaTasksHost = globalThis as typeof globalThis & { [mediaTasksKey]?: ReturnType<typeof createMediaTasks> };
// ACT: 图片、视频等独立 UMD 共用短轮询；每批最多 100 项，不按节点占用长连接。
const mediaTasks = mediaTasksHost[mediaTasksKey] ??= createMediaTasks();

function createMediaTasks() {
  const pending = new Map<string, PendingMediaTask>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let polling = false;

  function schedule(delay = 1000) {
    if (polling || timer !== undefined || !pending.size) return;
    timer = setTimeout(poll, delay);
  }

  async function poll() {
    timer = undefined;
    polling = true;
    try {
      const groups = new Map([...pending.values()].map(task => [JSON.stringify([task.directory, !!task.resume]), { directory: task.directory, resume: !!task.resume }]));
      for (const { directory, resume } of groups.values()) {
        const taskIds = [...pending].filter(([, task]) => task.directory === directory && !!task.resume === resume).map(([id]) => id);
        for (let offset = 0; offset < taskIds.length; offset += 100) {
          const batch = taskIds.slice(offset, offset + 100).filter(id => pending.has(id));
          if (!batch.length) continue;
          const waitingTasks = new Map(batch.map(id => [id, pending.get(id)]));
          try {
            const results = await fetch("/api/ai/media/tasks/status", {
              method: "POST", headers: { "Content-Type": "application/json", "x-toonflow-workspace": "1" },
              body: JSON.stringify({ directory, taskIds: batch, ...(resume ? { resume: true } : {}) }), signal: AbortSignal.timeout(10000),
            }).then(readResult<NodeMediaTaskStatus[]>);
            const byId = new Map(results.map(result => [result.taskId, result]));
            for (const id of batch) {
              const task = pending.get(id);
              if (!task || task !== waitingTasks.get(id)) continue;
              const item = byId.get(id);
              if (!item) throw new Error("Phản hồi tác vụ tạo nội dung chưa đầy đủ, vui lòng thử lại");
              task.resume = false;
              task.failedAt = undefined;
              try { await task.onStatus?.(item); }
              catch (error) { task.fail(error); continue; }
              if (item.result) task.finish(item.result);
            }
          } catch (error) {
            for (const id of batch) {
              const task = pending.get(id);
              if (!task || task !== waitingTasks.get(id)) continue;
              // ACT: 状态查询允许 90 秒临时断线，不因几次快速失败取消已经提交的生成。
              task.failedAt ??= Date.now();
              if (task.failedAt + 90000 <= Date.now()) task.fail(Object.assign(error instanceof Error ? error : new Error("Kết nối truy vấn trạng thái tạo nội dung bị gián đoạn"), { mediaTaskDisconnected: true }));
            }
          }
        }
      }
    } finally {
      polling = false;
      schedule();
    }
  }

  function wait(directory: string, taskId: string, signal: AbortSignal, options: NodeMediaTaskOptions = {}, resume = false) {
    signal.throwIfAborted();
    if (pending.has(taskId)) throw new Error("Tác vụ tạo nội dung đang được kiểm tra trong cửa sổ này, vui lòng chờ kết quả");
    return new Promise<NonNullable<MediaTaskResult["data"]>>((resolve, reject) => {
      const cleanup = () => {
        if (pending.get(taskId) === task) pending.delete(taskId);
        signal.removeEventListener("abort", abort);
        if (!pending.size) { clearTimeout(timer); timer = undefined; }
      };
      const abort = () => { cleanup(); reject(signal.reason); };
      const task: PendingMediaTask = {
        directory,
        resume,
        onStatus: options.onStatus,
        finish(result) {
          cleanup();
          if (result.code === 200 && result.data) resolve(result.data);
          else reject(new Error(result.message || "Tạo media thất bại"));
        },
        fail(error) { cleanup(); reject(error); },
      };
      pending.set(taskId, task);
      signal.addEventListener("abort", abort, { once: true });
      schedule();
    });
  }

  return { wait };
}

async function requestModel(input: NodeAiRequest, context: Context, model: Model<NodeAiModel["protocol"]>, signal: AbortSignal) {
  const { providerId, modelId, references, directory, onEvent } = input;
  const stream = createAssistantMessageEventStream();
  try {
    signal.throwIfAborted();
    const response = await fetch("/api/ai/generate", {
      method: "POST", headers: { "Content-Type": "application/json", "x-toonflow-workspace": "1" },
      body: JSON.stringify({ providerId, modelId, context, directory, references, chromeTabId: input.chromeTabId, requestId: createNodeRequestId() }), signal,
    });
    if (!response.ok) await readResult(response);
    if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) throw new Error("AI không trả về luồng SSE như mong đợi nên không thể nhận nội dung tạo ra.");
    const reader = response.body.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream()).getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        signal.throwIfAborted();
        if (done) throw new Error("Luồng dữ liệu AI kết thúc sớm; nội dung có thể chưa đầy đủ, vui lòng thử lại.");
        const event = JSON.parse(value.data);
        if (event.type === "error") throw new Error(event.message || "Tạo nội dung bằng AI thất bại");
        if (event.type === "text" || event.type === "reasoning") onEvent?.(event);
        if (event.type !== "done") continue;
        const message = event.message as AssistantMessage;
        if (message?.role !== "assistant" || !Array.isArray(message.content)) throw new Error("Thông điệp AI trả về chưa đầy đủ; hãy kiểm tra backend Toonflow đã cập nhật rồi thử lại.");
        if (message.stopReason === "deferred" || message.stopReason === "pending") throw new Error("Tác vụ AI trả về chưa hoàn tất; lần tạo nội dung này không kết thúc bình thường.");
        if (message.stopReason === "error" || message.stopReason === "aborted") throw new Error(message.errorMessage || "Yêu cầu AI thất bại");
        // ACT: 增量直接通知 UI；SDK 只消费完整单轮消息，避免每个 token 传输全量快照。
        stream.push({ type: "start", partial: { ...message, content: [], stopReason: "pending" } });
        stream.push({ type: "done", reason: message.stopReason, message });
        break;
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  } catch (error) {
    const reason = signal.aborted ? "aborted" : "error";
    stream.push({ type: "error", reason, error: {
      role: "assistant", content: [], api: model.api, provider: model.provider, model: model.id, timestamp: Date.now(),
      stopReason: reason, errorMessage: error instanceof Error ? error.message : "Yêu cầu AI thất bại",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    } });
  }
  return stream;
}

export function useNodeAi(options: { onModelsChanged?: () => unknown } = {}) {
  const controller = new AbortController();
  onScopeDispose(() => controller.abort());
  const requestSignal = (signal?: AbortSignal) => signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;
  const loadedTypes = new Set<"language" | "media">();
  const unsubscribe = subscribeNodeModels(type => {
    if (!loadedTypes.has(type) || controller.signal.aborted || !options.onModelsChanged) return;
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) return options.onModelsChanged?.();
    }).catch(() => {});
  });
  onScopeDispose(unsubscribe);

  async function getModels(signal?: AbortSignal, fresh = false) {
    loadedTypes.add("language");
    return readNodeModels<NodeAiModel>("language", requestSignal(signal), fresh);
  }

  async function getMediaModels(signal?: AbortSignal, fresh = false) {
    loadedTypes.add("media");
    return readNodeModels<NodeMediaModel>("media", requestSignal(signal), fresh);
  }

  async function getMediaPrice(input: NodeMediaPriceRequest, signal?: AbortSignal): Promise<NodeMediaPrice | null> {
    const waitingSignal = requestSignal(signal);
    waitingSignal.throwIfAborted();
    const requestedInput = input;
    if (input.providerId === "multiTenant") {
      const selected = findNodeModel(await getMediaModels(waitingSignal, true), input);
      if (!selected) throw new Error("Mô hình đã chọn không tồn tại, vui lòng chọn lại");
      input = { ...input, modelId: selected.modelId };
    }
    const now = Date.now();
    const { prices, requestedAt } = mediaPriceCache;
    for (const [key, entry] of prices) if (entry.expires <= now) prices.delete(key);
    for (const [key, time] of requestedAt) if (time + 2000 <= now) requestedAt.delete(key);
    const key = JSON.stringify({ ...input, outputDirectory: undefined });
    let entry = prices.get(key);
    if (!entry) {
      // ACT: 节流状态跨节点面板重建保留；每个节点最多每 2 秒发起一次新报价。
      const nodeKey = JSON.stringify([input.directory, input.outputDirectory, input.providerId]);
      const delay = (requestedAt.get(nodeKey) ?? 0) + 2000 - now;
      if (delay > 0) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let cancel = () => {};
        try {
          await new Promise<void>((resolve, reject) => {
            timer = setTimeout(resolve, delay);
            cancel = () => reject(waitingSignal.reason);
            waitingSignal.addEventListener("abort", cancel, { once: true });
          });
          return await getMediaPrice(requestedInput, signal);
        } finally {
          clearTimeout(timer);
          waitingSignal.removeEventListener("abort", cancel);
        }
      }
      requestedAt.set(nodeKey, now);
      if (requestedAt.size > 500) requestedAt.delete(requestedAt.keys().next().value!);
      if (prices.size >= 500) prices.delete(prices.keys().next().value!);
      const hasReferences = !!(input.images?.length || ("videos" in input && input.videos?.length) || ("audios" in input && input.audios?.length)
        || ("firstFrame" in input && input.firstFrame) || ("lastFrame" in input && input.lastFrame));
      const pending = { expires: Infinity, value: Promise.resolve<NodeMediaPrice | null>(null) };
      // ACT: 最多缓存 500 条 / 30 秒；参考文件没有前端修订号，只合并进行中的查询，避免同路径覆盖后复用旧价。
      pending.value = fetch("/api/ai/media/price", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-toonflow-workspace": "1" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(15000),
      }).then(readResult<NodeMediaPrice | null>).then(price => {
        if (price !== null && (!price || typeof price.price !== "string" || !price.price.trim() || typeof price.tips !== "string"
          || (price.maximum !== undefined && typeof price.maximum !== "string"))) {
          throw new Error("Định dạng dữ liệu giá trả về không hợp lệ");
        }
        pending.expires = hasReferences ? 0 : Date.now() + 30000;
        return price;
      }).catch(error => {
        pending.expires = Date.now() + 5000;
        throw error;
      });
      prices.set(key, pending);
      entry = pending;
    }
    // 单个节点退出只取消自己的等待，共用请求继续为其他节点提供结果。
    let cancel = () => {};
    try {
      const price = await Promise.race([entry.value, new Promise<never>((_resolve, reject) => {
        cancel = () => reject(waitingSignal.reason);
        waitingSignal.addEventListener("abort", cancel, { once: true });
      })]);
      waitingSignal.throwIfAborted();
      return prices.get(key) === entry ? price : getMediaPrice(requestedInput, signal);
    } finally {
      waitingSignal.removeEventListener("abort", cancel);
    }
  }

  async function generateMedia<T extends "image" | "video" | "audio">(mediaType: T, input: NodeImageRequest | NodeVideoRequest | NodeAudioRequest, signal?: AbortSignal, options: NodeMediaTaskOptions = {}) {
    const waitingSignal = requestSignal(signal);
    waitingSignal.throwIfAborted();
    if (input.providerId === "multiTenant") {
      const selected = findNodeModel(await getMediaModels(waitingSignal, true), input);
      if (!selected) throw new Error("Mô hình đã chọn không tồn tại, vui lòng chọn lại");
      input = { ...input, modelId: selected.modelId };
      waitingSignal.throwIfAborted();
    }
    const taskId = options.taskId ?? crypto.randomUUID();
    // 提交使用独立超时；断线或卸载只结束等待，任务仍可按提交前保存的 ID 查询。
    const submitted = fetch("/api/ai/media/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-toonflow-workspace": "1" },
      body: JSON.stringify({ ...input, mediaType, taskId, nodeId: options.nodeId, canvasPath: options.canvasPath }), signal: AbortSignal.timeout(30000),
    }).then(response => readResult<{ taskId: string }>(response).catch(error => {
      // 仅标记提交响应的明确拒绝；取消请求和后续状态查询失败不能释放任务身份。
      if (!waitingSignal.aborted && error instanceof Error && [400, 401, 403, 404, 405, 413, 415, 422, 429].includes(response.status)) {
        Object.assign(error, { mediaTaskRejected: true });
      }
      throw error;
    })).then(async result => {
      if (options.isCancelled?.()) await cancelMedia(input.directory, taskId);
      return result;
    });
    const explicitCancel = () => {
      if (!options.taskId) void submitted.then(() => cancelMedia(input.directory, taskId), () => cancelMedia(input.directory, taskId)).catch(() => {});
    };
    waitingSignal.addEventListener("abort", explicitCancel, { once: true });
    let abort = () => {};
    try {
      const started = await Promise.race([submitted, new Promise<never>((_resolve, reject) => {
        abort = () => reject(waitingSignal.reason);
        waitingSignal.addEventListener("abort", abort, { once: true });
      })]);
      waitingSignal.throwIfAborted();
      if (started.taskId !== taskId) throw new Error("Phản hồi tác vụ tạo nội dung không hợp lệ, không thể xác nhận trạng thái; hãy kiểm tra backend Toonflow đã cập nhật rồi thử lại.");
    } catch (error) {
      if (!waitingSignal.aborted) explicitCancel();
      waitingSignal.removeEventListener("abort", explicitCancel);
      throw error;
    } finally {
      waitingSignal.removeEventListener("abort", abort);
    }
    try {
      return await mediaTasks.wait(input.directory, taskId, waitingSignal, options) as { path: string; mimeType: string; mediaType: T }[];
    } catch (error) {
      if (!options.taskId && (error as { mediaTaskDisconnected?: boolean })?.mediaTaskDisconnected) void cancelMedia(input.directory, taskId).catch(() => {});
      throw error;
    } finally {
      waitingSignal.removeEventListener("abort", explicitCancel);
    }
  }

  function generateImage(input: NodeImageRequest, signal?: AbortSignal, options?: NodeMediaTaskOptions) {
    return generateMedia("image", input, signal, options);
  }

  function generateVideo(input: NodeVideoRequest, signal?: AbortSignal, options?: NodeMediaTaskOptions) {
    return generateMedia("video", input, signal, options);
  }

  function generateAudio(input: NodeAudioRequest, signal?: AbortSignal, options?: NodeMediaTaskOptions) {
    return generateMedia("audio", input, signal, options);
  }

  function resumeMedia(directory: string, taskId: string, signal?: AbortSignal, options?: NodeMediaTaskOptions) {
    return mediaTasks.wait(directory, taskId, requestSignal(signal), options, true);
  }

  async function cancelMedia(directory: string, taskId: string) {
    await fetch("/api/ai/media/tasks/cancel", {
      method: "POST", headers: { "Content-Type": "application/json", "x-toonflow-workspace": "1" },
      body: JSON.stringify({ directory, taskIds: [taskId] }), signal: AbortSignal.timeout(10000),
    }).then(readResult);
  }

  async function generate(input: NodeAiRequest): Promise<NodeAiResult> {
    const signal = requestSignal(input.signal);
    const callSignal = input.tools?.length ? AbortSignal.any([signal, AbortSignal.timeout(600000)]) : signal;
    const { providerId, modelId, prompt, systemPrompt, onEvent } = input;
    if (!prompt.trim()) throw new Error("Vui lòng nhập prompt");
    const definitions = input.tools ?? [];
    if (new Set(definitions.map(tool => tool.name)).size !== definitions.length) throw new Error("Tên công cụ không được trùng nhau");
    const selected = findNodeModel(await getModels(callSignal, providerId === "multiTenant"), { providerId, modelId });
    if (!selected) throw new Error("Mô hình đã chọn không tồn tại, vui lòng chọn lại");
    const model: Model<NodeAiModel["protocol"]> = {
      id: selected.modelId, name: selected.label, provider: selected.providerId, api: selected.protocol, baseUrl: "",
      reasoning: false, input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: selected.contextWindow ?? 262144, maxTokens: selected.maxOutputTokens ?? 32768,
    };
    const tools: AgentTool[] = definitions.map(tool => ({
      name: tool.name, label: tool.name, description: tool.description, parameters: tool.parameters,
      async execute(_id, args, toolSignal) {
        callSignal.throwIfAborted();
        if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Tham số công cụ sai định dạng: phải là đối tượng.");
        const result = await tool.execute(args as Record<string, unknown>, toolSignal) ?? null;
        callSignal.throwIfAborted();
        return { content: [{ type: "text", text: JSON.stringify(result) ?? "null" }], details: undefined };
      },
    }));
    let turns = 0;
    let requests = 0;
    const identity = getNodeModelIdentity(selected);
    const messages = await runAgentLoop([{ role: "user", content: prompt, timestamp: Date.now() }], {
      systemPrompt: systemPrompt ?? "", messages: [], tools,
    }, {
      model, convertToLlm: messages => messages as Message[], toolExecution: "sequential",
      shouldStopAfterTurn: ({ message }) => ++turns >= 40 || message.stopReason === "length",
    }, event => {
      callSignal.throwIfAborted();
      if (event.type === "tool_execution_start") onEvent?.({ type: "toolStart", id: event.toolCallId, name: event.toolName, args: event.args });
      if (event.type === "tool_execution_end" && onEvent) {
        const text = (event.result as AgentToolResult<unknown>).content.filter(part => part.type === "text").map(part => part.text).join("\n");
        onEvent({ type: "toolEnd", id: event.toolCallId, name: event.toolName, result: event.isError ? text : JSON.parse(text), isError: event.isError });
      }
    }, callSignal, async (_model, context) => {
      const current = requests++ === 0 || selected.providerId !== "multiTenant" ? selected
        : findNodeModel(await getModels(callSignal, true), identity);
      if (!current) throw new Error("Mô hình đã chọn không tồn tại, vui lòng chọn lại");
      return requestModel({ ...input, providerId: current.providerId, modelId: current.modelId }, context, model, callSignal);
    });
    callSignal.throwIfAborted();
    const message = messages.findLast((message): message is AssistantMessage => message.role === "assistant");
    if (!message) throw new Error("AI không trả về kết quả");
    if (message.stopReason === "error" || message.stopReason === "aborted") throw new Error(message.errorMessage || "Yêu cầu AI thất bại");
    if (definitions.length && message.stopReason === "length") throw new Error("Đầu ra mô hình đã đạt giới hạn, hãy rút gọn yêu cầu rồi thử lại");
    if (message.content.some(part => part.type === "toolCall")) throw new Error("AI đã đạt giới hạn 40 vòng gọi công cụ, hãy thu hẹp yêu cầu rồi thử lại");
    const text = message.content.filter(part => part.type === "text").map(part => part.text).join("");
    const reasoning = message.content.filter(part => part.type === "thinking").map(part => part.thinking).join("");
    return { text, ...(reasoning ? { reasoning } : {}) };
  }

  return { getModels, getMediaModels, getMediaPrice, generateImage, generateVideo, generateAudio, resumeMedia, cancelMedia, generate };
}
