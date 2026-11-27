import { onScopeDispose, ref, shallowRef } from "vue";
import { createNodeRequestId, findNodeModel, type NodeMediaModel } from "@toonflow/nodes-scaffold/nodeAi";
import useWorkspaceFiles, { type TextSnapshot } from "@/lib/workspaceFiles";
import { finishFlowMedia, VideoFlowTaskError } from "@/pages/mediaStudio/videoFlowTasks";
import { videoFlowError } from "@/pages/mediaStudio/useVideoFlowRun";
import {
  imageDocumentLimit, listFilmPhotos, readImageDocument, referenceAvailability, sceneImageRequest, storyboardImagePath,
  storyboardImageSchema, writeImageDocument, type FilmReference, type ImageRun, type ImageSelection, type QueuedScene,
} from "./storyboardImages";

type Options = {
  models: () => NodeMediaModel[];
  references: () => Map<string, FilmReference>;
  refreshReferences: () => Promise<void>;
  updateFiles: (available: Set<string>) => void;
};

export function useStoryboardImages(directory: string, boardId: string, options: Options) {
  const files = useWorkspaceFiles(directory);
  const path = storyboardImagePath(boardId);
  const lifetime = new AbortController();
  let snapshot: TextSnapshot | undefined;
  const run = shallowRef<ImageRun>();
  const loading = ref(true);
  const loadError = ref("");
  const issue = ref("");
  const working = ref(false);
  const pauseRequested = ref(false);

  async function load() {
    if (working.value) return;
    loading.value = true;
    issue.value = loadError.value = "";
    try {
      const saved = await readImageDocument(files, path, imageDocumentLimit, AbortSignal.any([lifetime.signal, AbortSignal.timeout(12000)]));
      const parsed = saved ? storyboardImageSchema.parse(JSON.parse(saved.text)) : undefined;
      lifetime.signal.throwIfAborted();
      snapshot = saved;
      run.value = parsed;
    } catch {
      if (!lifetime.signal.aborted) loadError.value = "Chưa mở được tiến độ tạo ảnh. Hãy kiểm tra kết nối và tải lại.";
    } finally { loading.value = false; }
  }

  async function save(next: ImageRun) {
    lifetime.signal.throwIfAborted();
    snapshot = await writeImageDocument(files, path, next, imageDocumentLimit, snapshot);
    lifetime.signal.throwIfAborted();
    run.value = next;
  }

  function withProgress(current: ImageRun, id: string, progress: ImageRun["progress"][string]): ImageRun {
    return { ...current, progress: { ...current.progress, [id]: { output: current.progress[id]?.output, ...progress } } };
  }

  async function finishScene(current: ImageRun, progress: ImageRun["progress"][string]) {
    await save({ ...withProgress(current, current.queue[0]!.id, progress), queue: current.queue.slice(1), active: undefined });
  }

  async function processQueue() {
    let referencesLoaded = false;
    while (!pauseRequested.value && run.value?.queue.length) {
      lifetime.signal.throwIfAborted();
      let current = run.value;
      const scene = current.queue[0]!;
      const existing = !!current.active;
      if (!current.active) {
        if (!referencesLoaded) { await options.refreshReferences(); referencesLoaded = true; }
        if (pauseRequested.value) return;
        const available = await listFilmPhotos(files, AbortSignal.any([lifetime.signal, AbortSignal.timeout(12000)]));
        if (pauseRequested.value) return;
        options.updateFiles(available);
        const references = referenceAvailability(scene.prompt, options.references(), available);
        const invalid = references.missing.length ? `Thiếu ảnh tham chiếu ${references.missing.map(name => `“${name}”`).join(", ")}.`
          : references.invalid ? "Sửa thẻ tham chiếu chưa đúng. Dùng @[Tên ảnh] cho tên có khoảng trắng."
          : !references.text ? "Nhập prompt ảnh cho cảnh này." : "";
        if (invalid) {
          await finishScene(current, { state: "blocked", message: invalid.slice(0, 2000) });
          continue;
        }

        const model = findNodeModel(options.models(), current.selection.model);
        if (!model || model.configured === false) throw new Error("Mô hình ảnh của hàng chờ chưa sẵn sàng. Hãy kiểm tra kết nối và tải lại mô hình.");
        let request: NonNullable<ImageRun["active"]>["request"];
        try { request = sceneImageRequest(references.text, references.photos, model, current.selection); }
        catch (error) {
          await finishScene(current, { state: "blocked", message: error instanceof Error ? error.message : "Kiểm tra lại mô hình và ảnh tham chiếu." });
          continue;
        }
        current = { ...withProgress(current, scene.id, { state: "queued" }), active: { id: createNodeRequestId(), request } };
        await save(current);
      }
      const attempt = current.active!;
      let progressSaveFailed = false;
      let output: Awaited<ReturnType<typeof finishFlowMedia>>;
      try {
        output = await finishFlowMedia(directory, attempt, existing, lifetime.signal, async state => {
          if (!run.value || run.value.progress[scene.id]?.state === state) return;
          try { await save(withProgress(run.value, scene.id, { state })); }
          catch (error) { progressSaveFailed = true; throw error; }
        });
      } catch (error) {
        lifetime.signal.throwIfAborted();
        if (progressSaveFailed) throw error;
        current = run.value!;
        if (!(error instanceof VideoFlowTaskError) || error.uncertain) {
          await save(withProgress(current, scene.id, {
            state: "interrupted", message: videoFlowError(error).slice(0, 2000),
            ...(error instanceof VideoFlowTaskError && error.replaceable ? { canSkip: true } : {}),
          }));
          return;
        }
        await finishScene(current, { state: "error", message: error.message.slice(0, 2000) });
        continue;
      }
      await finishScene(run.value!, { state: "done", output });
    }
  }

  async function perform(task: () => Promise<void>) {
    if (working.value || loading.value || loadError.value || lifetime.signal.aborted) return;
    working.value = true;
    issue.value = "";
    pauseRequested.value = false;
    try { await task(); }
    catch (error) { if (!lifetime.signal.aborted) issue.value = videoFlowError(error); }
    finally { working.value = false; }
  }

  function start(queue: QueuedScene[], selection: ImageSelection, availableScenes: string[], saveBoard: () => Promise<boolean>) {
    if (run.value?.queue.length || !queue.length) return;
    return perform(async () => {
      if (!await saveBoard()) return;
      lifetime.signal.throwIfAborted();
      const keys = new Set(availableScenes);
      const progress = Object.fromEntries(Object.entries(run.value?.progress ?? {}).filter(([id]) => keys.has(id)));
      for (const { id } of queue) progress[id] = { state: "queued", output: progress[id]?.output };
      await save({ version: 1, selection, queue, progress });
      await processQueue();
    });
  }

  function resume() {
    return perform(processQueue);
  }

  function skipInterrupted() {
    const current = run.value;
    const id = current?.queue[0]?.id;
    if (!current || !id || !current.active || !current.progress[id]?.canSkip) return;
    return perform(() => finishScene(current, { state: "error", message: "Đã bỏ qua tác vụ bị gián đoạn." }));
  }

  function discardWaiting() {
    const current = run.value;
    if (!current || current.active || !current.queue.length) return;
    return perform(() => {
      const progress = { ...current.progress };
      for (const { id } of current.queue) {
        const previous = progress[id]?.output;
        if (previous) progress[id] = { state: "done", output: previous };
        else delete progress[id];
      }
      return save({ ...current, progress, queue: [] });
    });
  }

  onScopeDispose(() => lifetime.abort());
  return { run, loading, loadError, issue, working, pauseRequested, load, start, resume, skipInterrupted, discardWaiting };
}
