import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  clearStudioMediaForCanvas,
  pendingStudioMediaForCanvas,
  queueStudioMediaForCanvas,
  type StudioMediaTransfer,
} from "../src/lib/mediaStudioTransfer";

// All tests are local: no browser, live server, workspace writes, or AI calls.
const image = (directory = "/studio/projectA"): StudioMediaTransfer => ({
  directory, path: "assets/generated/ảnh thử.png", mimeType: "image/png", mediaType: "image",
});
const video = (directory = "/studio/projectA"): StudioMediaTransfer => ({
  directory, path: "assets/generated/video thử.mp4", mimeType: "video/mp4", mediaType: "video",
});

function drainPending() {
  const pending = pendingStudioMediaForCanvas();
  if (pending) clearStudioMediaForCanvas(pending);
}

beforeEach(drainPending);
afterEach(drainPending);

describe("Xưởng → Canvas: single-slot transfer", () => {
  test("starts with no pending transfer", () => {
    expect(pendingStudioMediaForCanvas()).toBeUndefined();
  });

  test("retains exact image object and its workspace-relative path", () => {
    const item = image();
    queueStudioMediaForCanvas(item);
    expect(pendingStudioMediaForCanvas()).toBe(item);
    expect(pendingStudioMediaForCanvas()).toEqual({
      directory: "/studio/projectA", path: "assets/generated/ảnh thử.png",
      mimeType: "image/png", mediaType: "image",
    });
  });

  test("retains video type, MIME type, and original transfer reference", () => {
    const item = video();
    queueStudioMediaForCanvas(item);
    expect(pendingStudioMediaForCanvas()).toBe(item);
    expect(pendingStudioMediaForCanvas()?.mediaType).toBe("video");
    expect(pendingStudioMediaForCanvas()?.mimeType).toBe("video/mp4");
  });

  test("last selection replaces earlier image with video in the same workspace", () => {
    const first = image();
    const next = video();
    queueStudioMediaForCanvas(first);
    queueStudioMediaForCanvas(next);
    expect(pendingStudioMediaForCanvas()).toBe(next);
    expect(pendingStudioMediaForCanvas()).not.toBe(first);
  });

  test("last selection replaces transfer from a different workspace", () => {
    const first = image("/studio/projectA");
    const next = image("/studio/projectB");
    queueStudioMediaForCanvas(first);
    queueStudioMediaForCanvas(next);
    expect(pendingStudioMediaForCanvas()).toBe(next);
    expect(pendingStudioMediaForCanvas()?.directory).toBe("/studio/projectB");
  });

  test("clears only the currently queued object", () => {
    const item = image();
    queueStudioMediaForCanvas(item);
    clearStudioMediaForCanvas(item);
    expect(pendingStudioMediaForCanvas()).toBeUndefined();
  });

  test("cannot clear a different object even if every field is identical", () => {
    const item = image();
    queueStudioMediaForCanvas(item);
    clearStudioMediaForCanvas({ ...item });
    expect(pendingStudioMediaForCanvas()).toBe(item);
  });

  test("stale import completion must not clear a newly queued item", async () => {
    const first = image();
    const next = video("/studio/projectB");
    queueStudioMediaForCanvas(first);
    let release!: () => void;
    const inFlightRead = new Promise<void>(resolve => { release = resolve; });
    const staleImport = (async () => {
      await inFlightRead;
      clearStudioMediaForCanvas(first);
    })();
    queueStudioMediaForCanvas(next);
    release();
    await staleImport;
    expect(pendingStudioMediaForCanvas()).toBe(next);
  });

  test("the same media can be selected again after successful clear", () => {
    const item = image();
    queueStudioMediaForCanvas(item);
    clearStudioMediaForCanvas(item);
    queueStudioMediaForCanvas(item);
    expect(pendingStudioMediaForCanvas()).toBe(item);
    clearStudioMediaForCanvas(item);
    expect(pendingStudioMediaForCanvas()).toBeUndefined();
  });
});

// Source-level wiring checks guard accidental removal of critical paths.
// These are not substitutes for mounting Vue, interacting with a browser,
// checking server status, or verifying the resulting Canvas nodes visually.
function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Xưởng ↔ MacFlow: source wiring smoke checks", () => {
  test("image/video routes are separate and existing Canvas route is preserved", () => {
    const router = source("../src/router/index.ts");
    expect(router).toMatch(/path:\s*"\/image"[\s\S]*?props:\s*\{\s*kind:\s*"image"\s*\}/);
    expect(router).toMatch(/path:\s*"\/video"[\s\S]*?props:\s*\{\s*kind:\s*"video"\s*\}/);
    expect(router).toMatch(/path:\s*"\/canvas"[\s\S]*?redirect:\s*"\/workspace"/);
    const home = source("../src/pages/home/index.vue");
    const workspaceMenu = source("../src/pages/workspace/components/workspaceMenu.vue");
    for (const target of ["/image", "/video"]) {
      expect(home).toContain(`router.push('${target}')`);
      expect(workspaceMenu).toContain(`router.push('${target}')`);
    }
  });

  test("Studio creates a durable task ID before POST and resumes with status endpoint", () => {
    const studio = source("../src/pages/mediaStudio/index.vue");
    const savedId = studio.indexOf("rememberPendingId(taskId, studioDirectory)");
    const submission = studio.indexOf('request<{ taskId: string }>("/api/ai/media/generate"');
    expect(savedId).toBeGreaterThan(-1);
    expect(submission).toBeGreaterThan(savedId);
    expect(studio).toContain('request<StudioTask[]>("/api/ai/media/tasks/status"');
    expect(studio).toContain('request<{ entries: StudioTask[] }>(`/api/mediaStudio/list?directory=');
    expect(studio).toContain('if (current.providerId.startsWith("mac2Api")) input.mode = referencesSnapshot.length ? "singleImage" : "text"');
    expect(studio).not.toContain("/api/aiBridge");
  });

  test("library action copies the workspace file into the existing assets endpoint", () => {
    const studio = source("../src/pages/mediaStudio/index.vue");
    const start = studio.indexOf("async function saveToLibrary(");
    const end = studio.indexOf("async function sendToCanvas(", start);
    const action = studio.slice(start, end);
    expect(action).toContain('if (currentUser.value?.role === "user") return');
    expect(action).toContain("await files.read(media.path)");
    expect(action).toContain('await axios.put("/api/assets/save"');
    expect(action).toContain('"Content-Type": "application/octet-stream"');
    expect(action).not.toContain("/api/workspaces/files/");
  });

  test("Canvas checks workspace and readiness, imports file, then clears only after success", () => {
    const studio = source("../src/pages/mediaStudio/index.vue");
    const canvas = source("../src/pages/workspace/panels/canvas/index.vue");
    const producer = studio.slice(studio.indexOf("async function sendToCanvas("), studio.indexOf("function openMediaSettings(") );
    const consumer = canvas.slice(canvas.indexOf("async function importPendingStudioMedia()"), canvas.indexOf("watch([() => props.active", canvas.indexOf("async function importPendingStudioMedia()")));
    expect(producer).toContain("queueStudioMediaForCanvas({ directory: directory.value, ...media })");
    expect(producer).toContain('await router.push("/workspace")');
    expect(consumer).toContain("pending.directory !== directory");
    expect(consumer).toContain("!props.active");
    expect(consumer).toContain("!canvasReady.value");
    expect(consumer).toContain("!canvasId.value");
    expect(consumer).toContain("remote-${pending.mediaType}Node");
    expect(consumer).toContain("await useWorkspaceFiles(directory).read(pending.path)");
    expect(consumer).toContain("pendingStudioMediaForCanvas() !== pending");
    expect(consumer).toContain("project.value?.directory !== directory");
    expect(consumer).toContain("await importCanvasFiles(");
    const failureIndex = consumer.indexOf("if (!imported) throw");
    const clearIndex = consumer.indexOf("clearStudioMediaForCanvas(pending)");
    expect(failureIndex).toBeGreaterThan(-1);
    expect(clearIndex).toBeGreaterThan(failureIndex);
    expect(canvas).toContain('watch([() => props.active, canvasReady, canvasId, availableNodes');
  });
});
