import axios from "axios";
import { computed, onScopeDispose, ref } from "vue";
import { findNodeModel, getNodeModelIdentity, useNodeAi, type NodeAiModel, type NodeMediaModel } from "@toonflow/nodes-scaffold/nodeAi";
import useWorkspaceFiles, { type TextSnapshot } from "@/lib/workspaceFiles";
import { describeStudioError } from "./studioRequests";
import { buildFlowPrompt, contextLimit, flowStages, readVideoRun, runMaxBytes, runPath,
  type FlowItem, type FlowStage, type VideoFlowMode, type VideoFlowRun } from "./videoFlow";
import { finishFlowMedia, makeMediaRequest, VideoFlowTaskError } from "./videoFlowTasks";

const kindForStage = { script: "text", frame: "image", video: "video" } as const;
const scriptInstruction = "Bạn viết kịch bản quay video ngắn bằng tiếng Việt. Trả về kịch bản có trình tự cảnh, hình ảnh và hành động mở đầu, chuyển động, lời thoại nếu cần. Bám ngữ cảnh, thông tin sản phẩm và kịch bản chung được cung cấp.";

export function fileErrorCode(error: unknown) {
  return axios.isAxiosError(error) ? error.response?.data?.data?.code as string | undefined : undefined;
}

export function videoFlowError(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || "Không kết nối được với máy chủ MacFlow. Hãy thử lại.";
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "Đã quá thời gian chờ phản hồi. Hãy kiểm tra kết nối rồi thử lại.";
  }
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) return "Kết nối với máy chủ đã gián đoạn. Hãy thử lại.";
  return describeStudioError(error instanceof Error ? error.message : undefined);
}

export function useVideoFlowRun(directory: string, modelsFor: (kind: "text" | "image" | "video") => (NodeAiModel | NodeMediaModel)[]) {
  const ai = useNodeAi();
  const files = useWorkspaceFiles(directory);
  const run = ref<VideoFlowRun>();
  const loading = ref(true);
  const saving = ref(false);
  const loadError = ref("");
  const saveError = ref("");
  const operationError = ref("");
  const working = ref(false);
  const busy = computed(() => working.value || saving.value || loading.value);
  const lifetime = new AbortController();
  let execution: AbortController | undefined;
  let snapshot: TextSnapshot | undefined;
  let pendingWrite: string | undefined;

  async function loadRun() {
    loading.value = true;
    loadError.value = "";
    try {
      const saved = await files.readTextSnapshot(runPath, {
        maxBytes: runMaxBytes, signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(15_000)]),
      });
      const stored = readVideoRun(saved.text);
      if (!lifetime.signal.aborted) { snapshot = saved; run.value = stored; }
    } catch (error) {
      if (!lifetime.signal.aborted && fileErrorCode(error) !== "ENOENT") {
        loadError.value = "Không mở được tiến độ của dự án. " + videoFlowError(error);
      }
    } finally { loading.value = false; }
  }

  async function persist() {
    if (saving.value || !run.value) return false;
    if (!pendingWrite) {
      run.value.writeId = crypto.randomUUID();
      pendingWrite = JSON.stringify(run.value);
    }
    saving.value = true;
    const text = pendingWrite;
    try {
      if (new Blob([text]).size > runMaxBytes) throw new Error("Đợt này vượt giới hạn lưu của dự án. Hãy tải các kết quả đã có.");
      const timeout = AbortSignal.timeout(15_000);
      try {
        if (snapshot) {
          const revision = await files.writeTextSnapshot(runPath, text, snapshot, timeout);
          snapshot = { ...snapshot, text, revision };
        } else {
          await files.write(runPath, text, true, timeout);
          const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
          snapshot = { text, revision: Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join(""), encoding: "utf-8" };
        }
      } catch (cause) {
        // ACT: Nếu lượt ghi đã thành công nhưng mất phản hồi, nhận lại đúng bản
        // vừa gửi. Mọi nội dung khác vẫn phải qua kiểm tra phiên bản.
        const confirmed = await files.readTextSnapshot(runPath, { maxBytes: runMaxBytes, signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
        if (confirmed?.text !== text) throw cause;
        snapshot = confirmed;
      }
      pendingWrite = undefined;
      saveError.value = "";
      return true;
    } catch (error) {
      saveError.value = ["ESTALE", "EEXIST"].includes(fileErrorCode(error) ?? "")
        ? "Tiến độ đã thay đổi ở cửa sổ khác. Hãy mở lại trang để lấy bản mới nhất."
        : "Chưa lưu được tiến độ. Hãy bấm “Thử lưu lại” trước khi chạy tiếp. " + videoFlowError(error);
      return false;
    } finally { saving.value = false; }
  }

  async function processStage(batch: VideoFlowRun, item: FlowItem, stage: FlowStage, signal: AbortSignal) {
    const progress = item.stages[stage];
    progress.state = "running";
    progress.message = undefined;
    if (!await persist()) return false;
    signal.throwIfAborted();
    try {
      if (stage === "prepare") {
        if (!item.prompt.trim()) throw new Error("Prompt trong cặp [ ] này đang trống. Nhập nội dung cho mục rồi chạy lại bước này.");
      } else if (stage === "script") {
        const step = batch.template.steps[0]!;
        const modelKey = batch.input.models.text || step.model;
        const models = modelsFor("text");
        const model = modelKey ? findNodeModel(models, modelKey) : models[0];
        if (!model) throw new Error("Chưa có mô hình dựng kịch bản phù hợp. Hãy chọn lại mô hình văn bản trong phần Nâng cao.");
        const deadline = AbortSignal.timeout(120_000);
        const referenceImages = [
          ...(step.sources.includes("referenceImages") ? batch.input.references : []),
          ...(step.sources.includes("productImages") ? batch.input.products : []),
        ];
        const answer = await ai.generate({
          ...getNodeModelIdentity(model), directory, prompt: buildFlowPrompt(batch, item, "text"), systemPrompt: scriptInstruction,
          references: referenceImages.map(({ path, mimeType }) => ({ dataType: "IMAGE" as const, value: { url: path, mimeType } })),
          signal: AbortSignal.any([signal, deadline]),
        }).catch(error => {
          if (deadline.aborted) throw new Error("Mô hình chưa hoàn thành kịch bản trong 2 phút. Hãy thử lại bước này.");
          throw error;
        });
        const text = answer.text.trim();
        if (!text || text.length > contextLimit) throw new Error("Mô hình trả kịch bản rỗng hoặc quá dài. Hãy thử chạy lại bước này.");
        item.script = text;
      } else {
        const existing = !!progress.attempt;
        if (!progress.attempt) {
          const kind = kindForStage[stage];
          const step = batch.template.steps[stage === "frame" ? 1 : 2]!;
          const modelKey = batch.input.models[kind] || step.model;
          const models = modelsFor(kind) as NodeMediaModel[];
          const model = modelKey ? findNodeModel(models, modelKey) : models[0];
          if (!model) throw new Error("Chưa có mô hình phù hợp cho bước này. Hãy chọn lại trong phần Nâng cao.");
          progress.attempt = { id: crypto.randomUUID(), request: makeMediaRequest(batch, item, model, kind) };
          progress.state = "queued";
          if (!await persist()) return false;
          signal.throwIfAborted();
        }
        const file = await finishFlowMedia(directory, progress.attempt, existing, signal, async state => {
          if (progress.state === state) return;
          progress.state = state;
          if (!await persist()) throw new Error(saveError.value);
        });
        if (stage === "frame") item.frame = file;
        else item.video = file;
      }
      signal.throwIfAborted();
      progress.state = "done";
    } catch (error) {
      signal.throwIfAborted();
      if (saveError.value) return false;
      if (progress.attempt) {
        progress.attempt.uncertain = !(error instanceof VideoFlowTaskError) || error.uncertain;
        progress.attempt.replaceable = error instanceof VideoFlowTaskError && error.replaceable;
      }
      progress.state = progress.attempt?.uncertain ? "interrupted" : "error";
      progress.message = videoFlowError(error).slice(0, 2000);
    }
    return persist();
  }

  async function processItems(batch: VideoFlowRun, items: FlowItem[], signal: AbortSignal) {
    for (const item of items) {
      for (const stage of flowStages) {
        signal.throwIfAborted();
        const progress = item.stages[stage];
        if (progress.state === "done") continue;
        if (progress.state === "error" || progress.state === "interrupted") break;
        if (stage === "video" && !progress.attempt && batch.input.mode === "review" && !item.approved) {
          if (progress.state !== "review") {
            progress.state = "review";
            if (!await persist()) return;
          }
          break;
        }
        if (!await processStage(batch, item, stage, signal)) return;
        if (item.stages[stage].state !== "done") break;
      }
    }
  }

  async function perform(action: (signal: AbortSignal) => Promise<void>) {
    if (busy.value || saveError.value || loadError.value) return;
    execution = new AbortController();
    const signal = AbortSignal.any([lifetime.signal, execution.signal]);
    working.value = true;
    operationError.value = "";
    try {
      if (navigator.locks) {
        await navigator.locks.request("macflow:videoFlow:" + directory, { ifAvailable: true }, async lock => {
          if (!lock) throw new Error("Đợt này đang được xử lý ở một tab khác. Hãy mở tab đó hoặc tải lại trang sau khi tab kia dừng.");
          signal.throwIfAborted();
          await action(signal);
        });
      } else await action(signal);
    } catch (error) {
      if (!signal.aborted) operationError.value = "Đợt chạy đã tạm dừng. " + videoFlowError(error);
    } finally { working.value = false; execution = undefined; }
  }

  function start(batch: VideoFlowRun) {
    return perform(async signal => {
      run.value = batch;
      if (await persist()) await processItems(run.value, run.value.items, signal);
    });
  }

  function resume() {
    return perform(async signal => {
      if (run.value) await processItems(run.value, run.value.items, signal);
    });
  }

  function retry(item: FlowItem, stage: FlowStage, options?: { prompt?: string; newTask?: boolean }) {
    return perform(async signal => {
      if (!run.value) return;
      const step = item.stages[stage];
      if (step.state !== "error" && step.state !== "interrupted") return;
      if (options?.newTask && !step.attempt?.replaceable) return;
      if (options?.prompt !== undefined && stage === "prepare") item.prompt = options.prompt;
      if (!step.attempt?.uncertain || options?.newTask) step.attempt = undefined;
      step.state = "waiting";
      await processItems(run.value, [item], signal);
    });
  }

  function approve(items: FlowItem[]) {
    return perform(async signal => {
      if (!run.value) return;
      for (const item of items) item.approved = true;
      if (await persist()) await processItems(run.value, items, signal);
    });
  }

  function setMode(mode: VideoFlowMode) {
    return perform(async () => {
      if (!run.value) return;
      run.value.input.mode = mode;
      for (const item of run.value.items) {
        const stage = item.stages.video;
        if (!item.frame || item.approved || stage.attempt) continue;
        if (mode === "review" && stage.state === "waiting") stage.state = "review";
        if (mode === "automatic" && stage.state === "review") stage.state = "waiting";
      }
      await persist();
    });
  }

  function selectRunModel(kind: "text" | "image" | "video", key: string) {
    return perform(async () => {
      if (!run.value) return;
      run.value.input.models[kind] = key;
      await persist();
    });
  }

  onScopeDispose(() => lifetime.abort());
  return { run, busy, working, loadRun, loadError, saveError, operationError, persist, start, resume, retry, approve, setMode, selectRunModel,
    pause: () => execution?.abort() };
}
