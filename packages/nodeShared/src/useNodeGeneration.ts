import { computed, onScopeDispose, ref, watch, type Ref } from "vue";
import { translate } from "@toonflow/i18n/vue";
import { useNode, useVueFlow } from "@vue-flow/core";
import { nodeTools, z } from "@toonflow/nodes-scaffold/nodeTools";
import { useNodePersistence, type NodePersistenceContext } from "@toonflow/nodes-scaffold/nodeDocument";
import type { NodeAudioRequest, NodeImageRequest, NodeMediaResult, NodeMediaTaskStatus, NodeVideoRequest, useNodeAi } from "@toonflow/nodes-scaffold/nodeAi";
import type { NodeOutputs } from "@toonflow/nodes-scaffold/values";
import { showNodeError } from "./showNodeError";

export type NodeGenerationTask = {
  taskId: string;
  directory: string;
  canvasPath: string;
  nodeId: string;
  mediaType: "image" | "video" | "audio";
  providerId: string;
  modelId: string;
  state: "submitting" | NonNullable<NodeMediaTaskStatus["state"]>;
  resumable?: boolean;
  providerData?: unknown;
  recoveryData?: unknown;
  applied?: boolean;
};

type GenerationOptions = {
  ai: ReturnType<typeof useNodeAi>;
  recover?: (results: NodeMediaResult[], task: NodeGenerationTask, signal: AbortSignal) => Promise<NodeMediaResult[]>;
};

export function useNodeGeneration(outputs: Readonly<Ref<NodeOutputs>>, cancel: () => void, options?: GenerationOptions) {
  const { id, node } = useNode();
  const { findNode } = useVueFlow();
  const getPersistence = useNodePersistence();
  const savedData = computed(() => node.data as { mediaTask?: NodeGenerationTask });
  const lifetime = new AbortController();
  let executionController: AbortController | undefined;
  let recoveryController: AbortController | undefined;
  let recovering: Promise<void> | undefined;
  let attemptedTaskId = "";
  const status = ref<"idle" | "running" | "succeeded" | "failed">("idle");
  const error = ref("");
  const cancelling = ref(false);
  const generating = computed(() => status.value === "running");
  const pendingRecovery = computed(() => !generating.value && needsRecovery());
  const getStatus = () => ({ status: status.value, outputs: outputs.value, ...(error.value ? { error: error.value } : {}),
    ...(savedData.value.mediaTask ? { task: { taskId: savedData.value.mediaTask.taskId, state: savedData.value.mediaTask.state, resumable: savedData.value.mediaTask.resumable } } : {}) });

  nodeTools.register({
    name: "getGenerationStatus",
    description: "Kiểm tra trạng thái tạo/khôi phục node (idle/running/succeeded/failed), đầu ra hiện tại và lỗi gần nhất. Nếu gián đoạn, giữ tác vụ; lần tạo tiếp theo phải kiểm tra tác vụ cũ trước, không gửi lại.",
    parameters: z.strictObject({}),
    execute: getStatus,
  });
  nodeTools.register({
    name: "cancelGeneration",
    description: "Chủ động bỏ tác vụ và ngừng chờ, cho phép tạo lại về sau. Nếu chưa rõ kết quả, hãy kiểm tra phía nhà cung cấp. cancellationRequested chỉ cho biết đã yêu cầu dừng, không xóa đầu ra cũ và không bảo đảm nhà cung cấp hủy tác vụ hay phí.",
    parameters: z.strictObject({}),
    async execute() {
      const cancellationRequested = generating.value || needsRecovery();
      if (cancellationRequested) await cancelGeneration();
      return { ...getStatus(), cancellationRequested };
    },
  });

  function needsRecovery() {
    const task = savedData.value.mediaTask;
    // ACT: applied 仅在成功后释放任务；替换输出不能放弃仍可能已接单的任务。
    return !!task && task.state !== "failed" && task.state !== "cancelled" && (task.state !== "succeeded" || !task.applied);
  }

  function checkTask(task: NodeGenerationTask, context: NodePersistenceContext) {
    lifetime.signal.throwIfAborted();
    if (task.state === "cancelled") throw new DOMException("Đã hủy tạo nội dung", "AbortError");
    if (findNode(id) !== node || savedData.value.mediaTask?.taskId !== task.taskId || task.directory !== context.directory || getPersistence?.()?.directory !== context.directory) {
      throw new Error("Node hoặc workspace đã thay đổi; không áp dụng kết quả của tác vụ này");
    }
  }

  function taskOptions(task: NodeGenerationTask, context: NodePersistenceContext, signal: AbortSignal) {
    return {
      taskId: task.taskId, nodeId: id, canvasPath: task.canvasPath,
      isCancelled: () => task.state === "cancelled",
      async onStatus(value: NodeMediaTaskStatus) {
        checkTask(task, context);
        if (value.nodeId && value.nodeId !== id) throw new Error("Tác vụ tạo nội dung không thuộc node hiện tại");
        if (value.canvasPath && value.canvasPath !== task.canvasPath) throw new Error("Tác vụ thuộc Canvas gốc khác");
        const before = JSON.stringify([task.state, task.resumable, task.providerData]);
        if (value.state) task.state = value.state;
        if (value.resumable !== undefined) task.resumable = value.resumable;
        if (value.providerData !== undefined) task.providerData = value.providerData;
        if (before !== JSON.stringify([task.state, task.resumable, task.providerData])) {
          const current = getPersistence?.();
          if (!current) throw new Error("Canvas đã đóng, không thể lưu trạng thái tác vụ");
          await current.save(signal);
        }
        if (task.state === "interrupted" && task.resumable === false) {
          throw new Error([value.result?.message, translate("Chưa rõ kết quả tạo trước; nhà cung cấp có thể đã nhận và tính phí. Hãy kiểm tra tác vụ phía nhà cung cấp; nếu muốn tạo lại, bấm “Bỏ tác vụ”.")].filter(Boolean).join("\n"));
        }
      },
    };
  }

  async function generate<T extends "image" | "video" | "audio">(mediaType: T, input: NodeImageRequest | NodeVideoRequest | NodeAudioRequest, signal: AbortSignal, recoveryData?: unknown) {
    if (!options) throw new Error("Node này không có chức năng tạo media");
    if (needsRecovery()) throw new Error("Node vẫn có tác vụ chưa được xác nhận; kiểm tra hoặc chủ động bỏ tác vụ trước khi tạo mới");
    const context = getPersistence?.();
    if (!context || context.directory !== input.directory) throw new Error("Canvas chưa sẵn sàng để lưu tác vụ");
    let task: NodeGenerationTask = {
      taskId: crypto.randomUUID(), directory: context.directory, canvasPath: context.canvasPath, nodeId: id,
      mediaType, providerId: input.providerId, modelId: input.modelId, state: "submitting",
      ...(recoveryData === undefined ? {} : { recoveryData: JSON.parse(JSON.stringify(recoveryData)) }),
    };
    savedData.value.mediaTask = task;
    task = savedData.value.mediaTask;
    const waitingSignal = AbortSignal.any([lifetime.signal, signal]);
    try { await context.save(waitingSignal); }
    catch (error) { if (task.state !== "cancelled") task.state = "failed"; throw error; }
    signal.throwIfAborted();
    checkTask(task, context);
    const requestOptions = taskOptions(task, context, waitingSignal);
    try {
      const result = mediaType === "image" ? await options.ai.generateImage(input as NodeImageRequest, signal, requestOptions)
        : mediaType === "video" ? await options.ai.generateVideo(input as NodeVideoRequest, signal, requestOptions)
        : await options.ai.generateAudio(input as NodeAudioRequest, signal, requestOptions);
      checkTask(task, context);
      signal.throwIfAborted();
      return result as Extract<NodeMediaResult, { mediaType: T }>[];
    } catch (error) {
      // 只有明确拒绝接单的响应才能释放任务；断线、超时、冲突和 5xx 仍须先按 ID 复查。
      if (task.state === "submitting" && (error as { mediaTaskRejected?: boolean })?.mediaTaskRejected === true) {
        task.state = "failed";
        task.resumable = false;
        const current = getPersistence?.();
        if (current?.directory === context.directory && findNode(id) === node && savedData.value.mediaTask?.taskId === task.taskId) await current.save();
      }
      throw error;
    }
  }

  async function finish(signal: AbortSignal) {
    const task = savedData.value.mediaTask;
    if (!options || !task) return;
    const context = getPersistence?.();
    if (!context) throw new Error("Canvas đã đóng; kết quả sẽ được khôi phục khi mở lại");
    checkTask(task, context);
    const applied = task.applied;
    task.applied = true;
    try { await context.save(signal); }
    catch (error) { task.applied = applied; throw error; }
  }

  async function execute<T>(action: () => Promise<T>): Promise<T> {
    if (cancelling.value) throw new Error("Đang hủy tác vụ, vui lòng thử lại sau");
    if (generating.value) throw new Error("Node đang tạo nội dung, hãy chờ hoàn tất");
    const controller = executionController = new AbortController();
    status.value = "running";
    error.value = "";
    try {
      const result = await action();
      await finish(AbortSignal.any([lifetime.signal, controller.signal]));
      status.value = "succeeded";
      return result;
    } catch (failure) {
      status.value = "failed";
      const message = (failure as { response?: { data?: { message?: string } } })?.response?.data?.message;
      error.value = failure instanceof Error && failure.name === "AbortError" ? "Đã hủy tạo nội dung"
        : message || (failure instanceof Error ? failure.message : "Tạo nội dung thất bại");
      throw failure;
    } finally {
      if (executionController === controller) executionController = undefined;
    }
  }

  function resume() {
    if (recovering) return recovering;
    const task = savedData.value.mediaTask;
    const context = getPersistence?.();
    if (!options || !task || !context || !needsRecovery()) return Promise.resolve();
    if (task.nodeId !== id || task.directory !== context.directory || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(task.taskId)
      || !["image", "video", "audio"].includes(task.mediaType)) return Promise.reject(new Error("Thông tin sở hữu tác vụ đã lưu không hợp lệ; hãy bỏ tác vụ trước khi tạo lại"));
    recoveryController = new AbortController();
    const signal = AbortSignal.any([lifetime.signal, recoveryController.signal]);
    recovering = execute(async () => {
      let results = await options.ai.resumeMedia(task.directory, task.taskId, signal, taskOptions(task, context, signal));
      checkTask(task, context);
      if (task.applied) return;
      if (options.recover) results = await options.recover(results, task, signal);
      signal.throwIfAborted();
      checkTask(task, context);
      const result = results[0];
      if (!result || result.mediaType !== task.mediaType) throw new Error("Tác vụ không trả về kết quả media phù hợp");
      if (result.mediaType === "image") outputs.value.image = { dataType: "IMAGE", value: { url: result.path, mimeType: result.mimeType } };
      else if (result.mediaType === "video") outputs.value.video = { dataType: "VIDEO", value: { url: result.path, mimeType: result.mimeType } };
      else outputs.value.audio = { dataType: "AUDIO", value: { url: result.path, mimeType: result.mimeType } };
    }).finally(() => { recovering = undefined; recoveryController = undefined; });
    return recovering;
  }

  async function run(action: () => Promise<void>) {
    if (needsRecovery()) return resume();
    return execute(action);
  }

  async function cancelGeneration(persist = true) {
    if (cancelling.value) throw new Error("Đang hủy tác vụ, vui lòng thử lại sau");
    cancelling.value = true;
    try {
      const task = savedData.value.mediaTask;
      const context = getPersistence?.();
      if (options && task && needsRecovery()) {
        if (!context) throw new Error("Workspace đã thay đổi, không thể hủy tác vụ của node");
        // ACT: 项目移动后的旧任务仅在当前节点放弃，不请求原目录的后台任务。
        if (task.directory === context.directory) await options.ai.cancelMedia(task.directory, task.taskId);
        const current = getPersistence?.();
        if (savedData.value.mediaTask?.taskId === task.taskId && current?.directory === context.directory && findNode(id) === node) {
          const { state, resumable } = task;
          task.state = "cancelled";
          task.resumable = false;
          try { if (persist) await current.save(); }
          catch (error) { task.state = state; task.resumable = resumable; throw error; }
        }
      }
      recoveryController?.abort();
      executionController?.abort();
      cancel();
      await recovering?.catch(() => {});
    } finally {
      cancelling.value = false;
    }
  }

  watch(() => getPersistence?.()?.canvasPath, path => {
    const task = savedData.value.mediaTask;
    if (!path || !options || !task || generating.value || !needsRecovery() || attemptedTaskId === task.taskId) return;
    attemptedTaskId = task.taskId;
    void resume().catch(error => { if (!lifetime.signal.aborted) showNodeError(error, "Khôi phục tác vụ thất bại"); });
  }, { immediate: true, flush: "post" });
  watch(outputs, () => {
    // 保留用户替换或编辑的输出；未决任务仍须复查完成或明确放弃，不能借此重新提交。
    if (!generating.value && needsRecovery() && savedData.value.mediaTask) savedData.value.mediaTask.applied = true;
  }, { deep: true, flush: "sync" });
  onScopeDispose(() => lifetime.abort());

  return { generating, pendingRecovery, cancelling, run, generate, resume, cancel: cancelGeneration };
}
