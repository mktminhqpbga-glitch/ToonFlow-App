import { describe, expect, test } from "bun:test";
import { canDispatchBatch, canDispatchChromeScene, finishedBatchState, mayResumeBatch, nextQueuedIndex, outstandingScenes, recoverRunningScene, type SceneRecord } from "./batchTransitions";

const scenes = (states: SceneRecord["state"][]): SceneRecord[] =>
  states.map((state, index) => ({ state, taskId: `task-${index}` }));

describe("persistent media batch recovery (no provider calls)", () => {
  test("FAILED scenes do not block independent queued scenes", () => {
    const records = scenes(["succeeded", "failed", "queued", "queued"]);
    expect(nextQueuedIndex(records)).toBe(2);
    expect(canDispatchBatch("running", records)).toBe(true);
    expect(outstandingScenes(records)).toBe(2);
  });
  test("pause and cancel never dispatch queued scenes", () => {
    const records = scenes(["queued", "queued"]);
    expect(canDispatchBatch("paused", records)).toBe(false);
    expect(canDispatchBatch("cancelled", records)).toBe(false);
    expect(canDispatchBatch("completed", records)).toBe(false);
    expect(mayResumeBatch("paused", records)).toBe(true);
  });
  test("crash after provider submission is UNKNOWN; never auto retry", () => {
    expect(recoverRunningScene({ state: "running", active: false, validResult: false })).toBe("unknown");
    expect(recoverRunningScene({ state: "interrupted", active: false, validResult: false })).toBe("unknown");
    expect(recoverRunningScene({ state: "unknown", active: false, validResult: false })).toBe("unknown");
    const records = scenes(["unknown", "queued"]);
    expect(mayResumeBatch("paused", records)).toBe(false);
    expect(canDispatchBatch("paused", records)).toBe(false);
  });
  test("only an active persisted worker can continue running", () => {
    expect(recoverRunningScene({ state: "running", active: true, validResult: false })).toBe("running");
    expect(recoverRunningScene({ state: "running", active: false, validResult: true })).toBe("unknown");
  });
  test("successful media requires an actual matching result", () => {
    expect(recoverRunningScene({ state: "succeeded", active: false, validResult: true })).toBe("succeeded");
    expect(recoverRunningScene({ state: "succeeded", active: false, validResult: false })).toBe("unknown");
    expect(recoverRunningScene({ state: "failed", active: false, validResult: false })).toBe("failed");
    expect(recoverRunningScene({ state: "cancelled", active: false, validResult: false })).toBe("cancelled");
  });
  test("restart dispatches only queued/running work from a running batch", () => {
    expect(canDispatchBatch("running", scenes(["succeeded", "failed"]))).toBe(false);
    expect(canDispatchBatch("running", scenes(["failed", "queued"]))).toBe(true);
    expect(canDispatchBatch("running", scenes(["running", "queued"]))).toBe(true);
    expect(canDispatchBatch("paused", scenes(["unknown", "queued"]))).toBe(false);
  });
  test("batch COMPLETED requires all scene results to have succeeded", () => {
    expect(finishedBatchState(scenes(["succeeded", "succeeded"]))).toBe("completed");
    expect(finishedBatchState(scenes(["succeeded", "failed"]))).toBe("partial");
    expect(finishedBatchState(scenes(["succeeded", "cancelled"]))).toBe("partial");
    expect(finishedBatchState(scenes([]))).toBe("partial");
  });
  test("Chrome unplugged or wrong tab never consumes queued Task IDs", () => {
    expect(canDispatchChromeScene(true, false, 2, "local", ["image"], "image")).toBe(false);
    expect(canDispatchChromeScene(true, true, undefined, "local", ["image"], "image")).toBe(false);
    expect(canDispatchChromeScene(true, true, 2, undefined, ["image"], "image")).toBe(false);
    expect(canDispatchChromeScene(true, true, 2, "local", ["video"], "image")).toBe(false);
    expect(canDispatchChromeScene(true, true, 2, "local", ["image"], "image")).toBe(true);
    expect(canDispatchChromeScene(false, false, undefined, undefined, undefined, "video")).toBe(true);
  });
  test("duplicate dispatch guards ignore completed scene IDs", () => {
    const records = scenes(["succeeded", "succeeded", "cancelled"]);
    expect(nextQueuedIndex(records)).toBe(-1);
    expect(outstandingScenes(records)).toBe(0);
  });
});
