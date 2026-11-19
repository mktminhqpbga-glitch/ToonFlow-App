import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile } from "@toonflow/file";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ProviderTaskData } from "@toonflow/providers";

const root = await mkdtemp(join(tmpdir(), "macflowMac2ApiContract"));
process.env.TOONFLOW_DATA_DIR = root;
const { createApp } = await import("../src/app");
const { discoverMac2Api, getConnection, saveConnection, settingsStatus } = await import("../src/utils/mac2Api/connection");
const { cancelMac2Api, generateMac2Api, resumeMac2Api } = await import("../src/utils/mac2Api/tasks");
const { listMediaProviders } = await import("../src/utils/media/provider");
const { listMediaModels } = await import("../src/utils/media/generation");
const localTasks = await import("../src/utils/media/tasks");

const clientKey = "m2c_local_contract_test_only";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVYoAAAAASUVORK5CYII=", "base64");
const models = [
  { id: "muse/image", provider: "muse", type: "image", ready: true, modes: ["text", "singleImage", "multiReference"], maxReferences: 4 },
  { id: "muse/video", provider: "muse", type: "video", ready: true, modes: ["text", "singleImage", "imageReference:4"], maxReferences: 4 },
  { id: "chatgpt/image", provider: "chatgpt", type: "image", ready: false },
  { id: "gemini-web/image", provider: "gemini-web", type: "image", ready: false },
];

let submitStatus = 200;
let useLegacy = false;
let lookupAvailable = true;
let cancelAvailable = true;
let cancelState = "confirmed";
let corruptedReceipt = false;
let invalidUrl = false;
let badMime = false;
let blocked = false;
let forceUnauthorized = false;
let delayReceipt = false;
let kind = "image";
let submissions = 0;
let lookups = 0;
let active = 0;
let peakActive = 0;
let beforeSubmit: (() => void) | undefined;
const keys = new Map<string, string>();
const outstanding = new Set<string>();
const payloads: Record<string, unknown>[] = [];

const upstream = Bun.serve({
  hostname: "127.0.0.1", port: 0,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (["/healthz", "/readyz"].includes(path)) return Response.json({ ok: true });
    if (request.headers.get("authorization") !== `Bearer ${clientKey}` || forceUnauthorized) return Response.json({}, { status: 401 });
    if (path === "/v1/capabilities") return useLegacy ? new Response(null, { status: 404 }) : Response.json({
      contractVersion: 1, serverVersion: "fixture",
      providers: [{ id: "muse", configured: true, connected: true, ready: true, busy: false }],
      models, limits: { perClientPending: 2, perKindPending: 2 },
      features: { idempotency: true, lookupByRequestKey: lookupAvailable, cancel: cancelAvailable },
    });
    if (path === "/v1/models") return Response.json({ data: models });
    if (request.method === "POST" && ["/v1/images/tasks", "/v1/videos"].includes(path)) {
      ++submissions;
      beforeSubmit?.();
      const key = request.headers.get("Idempotency-Key") ?? "";
      const payload = await request.json() as Record<string, unknown>;
      payloads.push(payload);
      if (submitStatus !== 200) return Response.json({}, { status: submitStatus, headers: { "Retry-After": "0" } });
      if (!key) return Response.json({}, { status: 400 });
      const id = `fake${submissions}`;
      keys.set(key, id);
      outstanding.add(id);
      peakActive = Math.max(peakActive, ++active);
      if (delayReceipt) await Bun.sleep(250);
      if (corruptedReceipt) return new Response("{");
      return Response.json({ id, task_id: id, status: "queued", kind });
    }
    if (path === "/v1/tasks/by-request") {
      ++lookups;
      const id = lookupAvailable && keys.get(request.headers.get("Idempotency-Key") ?? "");
      return id ? Response.json({ id, task_id: id, status: "processing", kind }) : new Response(null, { status: 404 });
    }
    if (path.endsWith("/cancel")) {
      const task_id = path.split("/").at(-2);
      if (cancelState === "requested") return Response.json({ task_id, status: "cancel_requested", cancelled: false }, { status: 202 });
      if (cancelState === "running") return Response.json({ code: "CANNOT_CANCEL_RUNNING", status: "processing" }, { status: 409 });
      if (cancelState === "terminal") return Response.json({ code: "ALREADY_TERMINAL" }, { status: 409 });
      return Response.json({ task_id, status: "cancelled", cancelled: true });
    }
    if (path.startsWith("/v1/media/")) {
      return new Response(badMime ? "not a PNG" : kind === "image" ? png : Buffer.from("0000ftypisom0000"), {
        headers: { "Content-Type": kind === "image" ? "image/png" : "video/mp4" },
      });
    }
    if (/^\/v1\/(?:images\/tasks|videos)\/fake\d+$/.test(path)) {
      const id = path.split("/").at(-1)!;
      if (blocked) return Response.json({ id, status: "processing" });
      if (outstanding.delete(id)) active--;
      return Response.json({ id, status: "completed", result: { url: invalidUrl ? "https://example.invalid/v1/media/unsafe.png" : "/v1/media/fake" } });
    }
    return new Response(null, { status: 404 });
  },
});

const baseUrl = `http://127.0.0.1:${upstream.port}`;
const input = { model: "muse/image", prompt: "local fixture" };
const generate = (id: string, save: (data: ProviderTaskData) => Promise<void>) => generateMac2Api("mac2ApiMuse", "image", id, input, save);
const ignore = async () => {};
const project = join(root, "workspaces", "project");
const otherProject = join(root, "workspaces", "other");

beforeAll(async () => {
  await Promise.all([mkdir(project, { recursive: true }), mkdir(otherProject, { recursive: true })]);
  await createApp({ dataDirectory: root, webRoot: root, providersRoot: resolve(import.meta.dirname, "../../../packages/providers/src") });
});
beforeEach(() => {
  submitStatus = 200;
  useLegacy = corruptedReceipt = invalidUrl = badMime = blocked = forceUnauthorized = delayReceipt = false;
  lookupAvailable = cancelAvailable = true;
  cancelState = "confirmed";
  kind = "image";
  submissions = lookups = active = peakActive = 0;
  beforeSubmit = undefined;
  keys.clear(); outstanding.clear(); payloads.length = 0;
  saveConnection(baseUrl, clientKey);
});
afterAll(() => upstream.stop(true));

describe("MacFlow mac2API client contract with HTTP loopback fixture", () => {
  test("installs three providers, preserves Muse2API and advertises only actual media kinds", async () => {
    const providers = await listMediaProviders();
    expect(providers.map(provider => provider.id)).toEqual(expect.arrayContaining(["mac2ApiMuse", "mac2ApiChatGpt", "mac2ApiGemini", "muse2Api"]));
    const catalog = (await listMediaModels()).filter(model => model.providerId.startsWith("mac2Api"));
    expect(catalog.map(model => [model.modelId, model.type]).sort()).toEqual(models.map(model => [model.id, model.type]).sort());
    expect(settingsStatus()).toEqual({ baseUrl: baseUrl + "/v1", keySaved: true });
  });

  test("persists request UUID and hash before POST, then polls and checks output bytes", async () => {
    const id = crypto.randomUUID();
    const checkpoints: ProviderTaskData[] = [];
    beforeSubmit = () => { expect(checkpoints.at(-1)).toMatchObject({ idempotencyKey: id, localTaskId: id, stage: "prepared" }); };
    const result = await generate(id, async data => { checkpoints.push(data); });
    expect(result[0]).toMatchObject({ mediaType: "image", mimeType: "image/png", type: "binary" });
    expect(checkpoints[0]?.requestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(checkpoints[1]?.upstreamTaskId).toBe("fake1");
    expect(keys.get(id)).toBe("fake1");
    expect(JSON.stringify(checkpoints)).not.toContain(clientKey);
  });

  test("malformed receipt or unresolved lookup never retries POST; resume only polls", async () => {
    corruptedReceipt = true;
    const id = crypto.randomUUID();
    let data: ProviderTaskData = {};
    await generate(id, async checkpoint => { data = checkpoint; });
    expect([submissions, lookups]).toEqual([1, 1]);
    await resumeMac2Api(data, id, ignore);
    expect([submissions, lookups]).toEqual([1, 1]);
    submitStatus = 503;
    const refused = crypto.randomUUID();
    await expect(generate(refused, async checkpoint => { data = checkpoint; })).rejects.toThrow("Chưa rõ");
    await expect(resumeMac2Api(data, refused, ignore)).rejects.toThrow("Chưa tìm thấy");
    expect([submissions, lookups]).toEqual([2, 3]);
  });

  test("definite upstream rejection and unauthenticated catalog", async () => {
    for (const status of [404, 409, 429]) {
      submitStatus = status;
      await expect(generate(crypto.randomUUID(), ignore)).rejects.toMatchObject({ status });
    }
    expect([submissions, lookups]).toEqual([3, 0]);
    forceUnauthorized = true;
    saveConnection(baseUrl, clientKey);
    await expect(generate(crypto.randomUUID(), ignore)).rejects.toMatchObject({ status: 401 });
    expect(submissions).toBe(3);
  });

  test("a client deadline after submission keeps only a lookup-capable checkpoint", async () => {
    delayReceipt = true;
    const controller = new AbortController();
    const id = crypto.randomUUID();
    let data: ProviderTaskData = {};
    beforeSubmit = () => setTimeout(() => controller.abort(), 50);
    await expect(generateMac2Api("mac2ApiMuse", "image", id, input, async checkpoint => { data = checkpoint; },
      controller.signal)).rejects.toThrow();
    expect(data.stage).toBe("prepared");
    await resumeMac2Api(data, id, ignore);
    expect([submissions, lookups]).toEqual([1, 1]);
  });

  test("refuses a concurrent POST for the same stable request ID", async () => {
    blocked = true;
    const id = crypto.randomUUID();
    const first = generate(id, ignore);
    for (let attempt = 0; attempt < 80 && !submissions; attempt++) await Bun.sleep(20);
    expect(submissions).toBe(1);
    try { await expect(generate(id, ignore)).rejects.toMatchObject({ status: 409 }); }
    finally { blocked = false; await first; }
    expect(submissions).toBe(1);
  });

  test("rejects output URLs outside the configured service and invalid content signatures", async () => {
    invalidUrl = true;
    await expect(generate(crypto.randomUUID(), ignore)).rejects.toThrow("ngoài kho media");
    invalidUrl = false;
    badMime = true;
    await expect(generate(crypto.randomUUID(), ignore)).rejects.toThrow("Chữ ký tệp");
  });

  test("shows legacy capability fallback and distinguishes upstream cancellation states", async () => {
    useLegacy = true;
    expect(await discoverMac2Api(getConnection()!)).toMatchObject({ state: "legacy", readyOk: true });
    let data: ProviderTaskData = {};
    await generate(crypto.randomUUID(), async checkpoint => { data = checkpoint; });
    expect(await cancelMac2Api(data)).toBe("localOnly");
    useLegacy = false;
    saveConnection(baseUrl, clientKey);
    for (const state of ["confirmed", "requested", "running", "terminal"]) {
      cancelState = state;
      expect(await cancelMac2Api(data)).toBe(state);
    }
  });

  test("keeps 9:16 structured video ratio and remaps deduplicated node references", async () => {
    kind = "video";
    const ref = { type: "base64" as const, data: png.toString("base64"), mimeType: "image/png" };
    const bytes = await generateMac2Api("mac2ApiMuse", "video", crypto.randomUUID(), {
      model: "muse/video", prompt: "{{ref 2}} rồi {{ref 1}}", ratio: "9:16", resolution: "1080p", firstFrame: ref,
      images: [ref], referenceOrder: [{ type: "firstFrame" }, { type: "image", index: 0 }],
    }, ignore);
    expect(bytes[0]?.mediaType).toBe("video");
    expect(payloads[0]).toMatchObject({ aspect_ratio: "9:16", resolution: "1080p", prompt: "ảnh tham chiếu 1 rồi ảnh tham chiếu 1" });
    expect(payloads[0]?.images).toHaveLength(1);
    await expect(generateMac2Api("mac2ApiMuse", "video", crypto.randomUUID(), {
      model: "muse/video", prompt: "snapshot", images: [{ ...ref, mimeType: "image/jpeg" }],
    }, ignore)).rejects.toThrow("không đúng loại");
    expect(submissions).toBe(1);
  });

  test("queues 3+ across workspaces under one client limit and persists output before success", async () => {
    blocked = true;
    localTasks.setStudioQueueLimit("image", 3);
    const tasks = [project, otherProject, project].map(directory => ({ id: crypto.randomUUID(), directory }));
    for (const task of tasks) {
      await localTasks.start(task.directory, task.id, "image", { providerId: "mac2ApiMuse", modelId: "muse/image", prompt: "local fixture" }, {}, undefined, true);
    }
    for (let attempt = 0; attempt < 50 && submissions < 2; attempt++) await Bun.sleep(30);
    expect(submissions).toBe(2);
    blocked = false;
    for (const task of tasks) {
      let output: Awaited<ReturnType<typeof localTasks.status>>[number] | undefined;
      for (let attempt = 0; attempt < 100; attempt++) {
        [output] = await localTasks.status(task.directory, [task.id]);
        if (output?.state === "succeeded") break;
        await Bun.sleep(35);
      }
      expect(output?.state).toBe("succeeded");
      expect(await readFile(join(task.directory, output!.result!.data![0]!.path))).toEqual(png);
    }
    expect(peakActive).toBe(2);
    expect(submissions).toBe(3);
    expect((await localTasks.status(otherProject, [tasks[0]!.id]))[0]?.result?.code).toBe(404);
    await expect(localTasks.status(project, [tasks[0]!.id], false, { id: crypto.randomUUID(), role: "user" }))
      .rejects.toMatchObject({ status: 403 });
  });

  test("stores cancellation disposition while dropping queued work before POST", async () => {
    blocked = true;
    localTasks.setStudioQueueLimit("image", 1);
    const running = crypto.randomUUID();
    const queued = crypto.randomUUID();
    const request = { providerId: "mac2ApiMuse", modelId: "muse/image", prompt: "local fixture" };
    await localTasks.start(project, running, "image", request, {}, undefined, true);
    await localTasks.start(project, queued, "image", request, {}, undefined, true);
    for (let attempt = 0; attempt < 50 && submissions < 1; attempt++) await Bun.sleep(30);
    await localTasks.cancel(project, [queued]);
    expect((await localTasks.status(project, [queued]))[0]).toMatchObject({ state: "cancelled", cancelDisposition: "notSent" });
    cancelState = "running";
    await localTasks.cancel(project, [running]);
    expect((await localTasks.status(project, [running]))[0]).toMatchObject({ state: "cancelled", cancelDisposition: "running" });
    expect(submissions).toBe(1);
  });

  test("fresh process recovers a queued request and polls the previously sent request by ID", async () => {
    const restartedProject = join(root, "workspaces", "restart");
    await mkdir(restartedProject);
    blocked = true;
    const first = crypto.randomUUID();
    const next = crypto.randomUUID();
    const shared = {
      cwd: resolve(import.meta.dirname, ".."),
      env: { ...process.env, TOONFLOW_DATA_DIR: root, TEST_WORKSPACE: restartedProject, TEST_FIRST: first, TEST_NEXT: next },
      stdout: "pipe" as const, stderr: "pipe" as const,
    };
    const init = `const { TEST_WORKSPACE: directory, TEST_FIRST: first, TEST_NEXT: next } = process.env;
      const tasks = await import("./src/utils/media/tasks.ts");`;
    const worker = Bun.spawn([process.execPath, "-e", init + `
      tasks.setStudioQueueLimit("image", 1);
      const request = { providerId: "mac2ApiMuse", modelId: "muse/image", prompt: "local fixture" };
      await tasks.start(directory, first, "image", request, {}, undefined, true);
      await tasks.start(directory, next, "image", request, {}, undefined, true);
      console.log("enqueued");
      setInterval(() => {}, 1000);
    `], shared);
    try {
      const reader = worker.stdout.getReader();
      const output = await Promise.race([reader.read(), Bun.sleep(3500).then(() => undefined)]);
      reader.releaseLock();
      expect(new TextDecoder().decode(output?.value)).toContain("enqueued");
      for (let attempt = 0; attempt < 80 && submissions < 1; attempt++) await Bun.sleep(30);
      expect(submissions).toBe(1);
      await Bun.sleep(100);
    } finally { worker.kill(); await worker.exited; }
    blocked = false;
    const recovery = Bun.spawn([process.execPath, "-e", init + `
      await tasks.getStudioQueueStatus(directory, "image");
      const wait = async (id, resume = false) => {
        for (let i = 0; i < 100; i++) {
          const [entry] = await tasks.status(directory, [id], resume && i === 0);
          if (entry?.state === "succeeded") return;
          await Bun.sleep(30);
        }
        throw new Error("Task did not complete");
      };
      await wait(next);
      await wait(first, true);
    `], shared);
    try {
      expect(await Promise.race([recovery.exited, Bun.sleep(7000).then(() => -1)])).toBe(0);
      expect(submissions).toBe(2);
      expect([...keys.keys()].sort()).toEqual([first, next].sort());
    } finally { if (recovery.exitCode === null) recovery.kill(); }
  }, 12000);
});
