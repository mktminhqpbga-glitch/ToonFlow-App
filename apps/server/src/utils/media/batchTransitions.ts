// Pure state rules shared by the persistent batch dispatcher and regression tests.
// No network, filesystem, provider or mocked AI calls are involved here.
export type SceneState = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "unknown";
export type BatchState = "running" | "paused" | "completed" | "cancelled";
export type SceneRecord = { state: SceneState; taskId: string };
export type TaskObservation = {
  state: string;
  active: boolean;
  validResult: boolean;
};

export function nextQueuedIndex(scenes: readonly SceneRecord[]) {
  return scenes.findIndex(scene => scene.state === "queued");
}

export function recoverRunningScene(observation: TaskObservation): SceneState {
  if (observation.state === "succeeded") return observation.validResult ? "succeeded" : "unknown";
  if (observation.state === "failed") return "failed";
  if (observation.state === "cancelled") return "cancelled";
  // A running task with no active in-process worker may have been sent by a
  // previous process. It is unsafe to resubmit it or infer a failed response.
  if (observation.state === "running" && observation.active) return "running";
  return "unknown";
}

export function canDispatchBatch(state: BatchState, scenes: readonly SceneRecord[]) {
  return state === "running" && scenes.some(scene => scene.state === "queued" || scene.state === "running");
}

export function mayResumeBatch(state: BatchState, scenes: readonly SceneRecord[]) {
  return state === "paused" && !scenes.some(scene => scene.state === "unknown")
    && scenes.some(scene => scene.state === "queued");
}

export function outstandingScenes(scenes: readonly SceneRecord[]) {
  return scenes.filter(scene => scene.state === "queued" || scene.state === "running").length;
}
