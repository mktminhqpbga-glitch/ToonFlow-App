import { describe, expect, test } from "bun:test";
import muse2Api from "../../../packages/providers/src/media/muse2Api";

// All HTTP responses are synthetic. This suite NEVER calls Muse or submits a task.
type HttpCall = { method: string; path: string; payload?: Record<string, any> };

function makeContext(version = "0.4.0", pythonAlias = false) {
  const calls: HttpCall[] = [];
  const snapshots: Record<string, unknown>[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const method = init?.method ?? "GET";
    const payload = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, payload });
    if (path === "/readyz") return Response.json({
      ready: true, driver: { driver: "browser", ok: true, tabs: 5 },
    });
    if (path === "/healthz") return Response.json({ ok: true, version });
    if (path === "/openapi.json") return Response.json({
      paths: pythonAlias ? { "/v1/images/tasks": { post: {} } } : {},
    });
    if (method === "POST") return Response.json({ id: "task_mock_1", status: "queued" });
    if (path.startsWith("/v1/images/generations/task_") || path.startsWith("/v1/images/tasks/task_")) {
      return Response.json({
        id: "task_mock_1", status: "succeeded",
        result: { data: [{ url: "http://127.0.0.1:18610/v1/media/test.png" }] },
      });
    }
    if (path.startsWith("/v1/videos/task_")) {
      return Response.json({
        id: "task_mock_1", status: "succeeded",
        result: { url: "http://127.0.0.1:18610/v1/media/test.mp4" },
      });
    }
    if (path === "/v1/media/test.mp4") {
      return new Response(Uint8Array.from([0, 0, 0, 24]), {
        headers: { "content-type": "video/mp4" },
      });
    }
    if (path === "/v1/media/test.png") {
      return new Response(Uint8Array.from([137, 80, 78, 71]), {
        headers: { "content-type": "image/png" },
      });
    }
    throw new Error("Unexpected mock endpoint: " + path);
  };
  const ctx = {
    config: { baseUrl: "http://127.0.0.1:18610/v1", apiKey: "mock-test-only" },
    tool: { fetch, errorMessage: () => "" },
    saveTaskData: async (value: Record<string, unknown>) => {
      snapshots.push(value);
    },
  };
  return { ctx, calls, snapshots };
}

const ref = (x: number) => ({ type: "binary" as const, mimeType: "image/png", data: Uint8Array.from([137, 80, 78, 71, x]) });

describe("Muse2API Python 0.4.0 API compatibility (mock HTTP only)", () => {
  test("Python image preserves ordered references and asynchronously polls canonical endpoint", async () => {
    const { ctx, calls, snapshots } = makeContext();
    const assets = await muse2Api.generateImage.call(ctx as any, {
      model: "muse-image", prompt: "Giữ cả hai ảnh", ratio: "9:16", images: [ref(1), ref(2)],
    });
    const submitted = calls.find(c => c.method === "POST");
    expect(submitted?.path).toBe("/v1/images/generations");
    expect(submitted?.payload?.async).toBe(true);
    expect(submitted?.payload?.size).toBe("9:16");
    expect(submitted?.payload?.images).toBeUndefined();
    expect(submitted?.payload?.image?.length).toBe(2);
    expect(submitted?.payload?.image[0]).toEndWith("iVBORwE=");
    expect(submitted?.payload?.image[1]).toEndWith("iVBORwI=");
    expect(calls.some(c => c.path === "/v1/images/generations/task_mock_1")).toBe(true);
    expect(snapshots.at(-1)?.taskId).toBe("task_mock_1");
    expect(snapshots.at(-1)?.protocol).toBe("python04");
    expect(assets[0]?.mimeType).toBe("image/png");
  });

  test("Go path remains unchanged for existing users", async () => {
    const { ctx, calls, snapshots } = makeContext("2.1.0");
    await muse2Api.generateImage.call(ctx as any, {
      model: "muse-image", prompt: "giữ đường đi cũ", images: [ref(3)],
    });
    expect(calls.find(c => c.method === "POST")?.path).toBe("/v1/images/tasks");
    expect(calls.some(c => c.path === "/v1/images/tasks/task_mock_1")).toBe(true);
    expect(snapshots.at(-1)?.protocol).toBe("vip0014");
  });

  test("Running Python's custom /images/tasks alias is preserved when exposed", async () => {
    const { ctx, calls, snapshots } = makeContext("0.4.0", true);
    await muse2Api.generateImage.call(ctx as any, {
      model: "muse-image", prompt: "Ảnh tham chiếu được giữ nguyên",
      images: [ref(1), ref(2)],
    });
    const submitted = calls.find(c => c.method === "POST");
    expect(submitted?.path).toBe("/v1/images/tasks");
    expect(submitted?.payload?.images).toHaveLength(2);
    expect(submitted?.payload?.image).toHaveLength(2);
    expect(calls.some(c => c.path === "/v1/images/tasks/task_mock_1")).toBe(true);
    expect(snapshots.at(-1)?.protocol).toBe("python04alias");
  });

  test("Python video rejects multiple references instead of silently discarding any", async () => {
    const { ctx, calls } = makeContext();
    await expect(muse2Api.generateVideo.call(ctx as any, {
      model: "muse-video", prompt: "Video", images: [ref(1), ref(2)],
    })).rejects.toThrow(/chỉ nhận một ảnh tham chiếu/);
    expect(calls.some(c => c.method === "POST")).toBe(false);
  });

  test("Python video preserves its single first-frame image and downloads the result", async () => {
    const { ctx, calls } = makeContext();
    const assets = await muse2Api.generateVideo.call(ctx as any, {
      model: "muse-video", prompt: "Chuyển động nhẹ", duration: 10,
      firstFrame: ref(9), ratio: "16:9",
    });
    const submitted = calls.find(c => c.method === "POST");
    expect(submitted?.path).toBe("/v1/videos");
    expect(submitted?.payload?.image).toEndWith("iVBORwk=");
    expect(submitted?.payload?.images).toBeUndefined();
    expect(calls.some(c => c.path === "/v1/videos/task_mock_1")).toBe(true);
    expect(assets[0]?.mimeType).toBe("video/mp4");
  });

  test("Unknown Python wire version never sends a Go-shaped task", async () => {
    const { ctx, calls } = makeContext("0.5.0");
    await expect(muse2Api.generateImage.call(ctx as any, {
      model: "muse-image", prompt: "Không gửi", images: [ref(1)],
    })).rejects.toThrow(/Chưa xác minh được phiên bản/);
    expect(calls.some(c => c.method === "POST")).toBe(false);
  });

  test("Python task without ID never resubmits when idempotency is not guaranteed", async () => {
    const { ctx, calls } = makeContext();
    await expect(muse2Api.resumeTask.call(ctx as any, {
      transport: "muse2Api", kind: "image",
      serviceUrl: "http://127.0.0.1:18610/v1",
      protocol: "python04", idempotencyKey: "macflow.abc.def.ghi",
      payload: { prompt: "Never resubmit" },
    })).rejects.toThrow(/không xác nhận Idempotency-Key/);
    expect(calls).toHaveLength(0);
  });
});
