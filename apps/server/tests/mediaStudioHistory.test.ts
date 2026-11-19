import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import type { Server } from "node:http";
import { mkdir, open, realpath, rmSync, writeAtomic } from "@toonflow/file";

// Read the real Studio history implementation against disposable local records.
// This suite never starts the app or sends a media-generation request.
const sandboxId = "MACFLOW_MEDIA_STUDIO_TEST_SANDBOX";
const cleanupId = "MACFLOW_MEDIA_STUDIO_TEST_CLEANUP_REGISTERED";
const testRoot = process.env[sandboxId] ?? join(tmpdir(), "macflowMediaStudioTest" + randomUUID().replaceAll("-", ""));
process.env[sandboxId] = testRoot;
process.env.TOONFLOW_DATA_DIR = testRoot;
if (process.env[cleanupId] !== "1") {
  process.env[cleanupId] = "1";
  process.once("exit", () => { if (testRoot.startsWith(join(tmpdir(), "macflowMediaStudioTest"))) rmSync(testRoot, { recursive: true, force: true }); });
}
let workspace: string;
let taskRoot: string;
let listHistory: typeof import("../src/utils/mediaStudio/history")["listStudioHistory"];
let findTask: typeof import("../src/utils/mediaStudio/history")["findStudioTask"];
let httpServer: Server | undefined;
let httpOrigin: string;

const imageTask = "123e4567-e89b-42d3-a456-426614174101";
const videoTask = "123e4567-e89b-42d3-a456-426614174102";
const hiddenTask = "123e4567-e89b-42d3-a456-426614174103";
const chromeTask = "123e4567-e89b-42d3-a456-426614174104";
const audioTask = "123e4567-e89b-42d3-a456-426614174105";
const staleFilesTask = "123e4567-e89b-42d3-a456-426614174106";
const ownerId = "123e4567-e89b-42d3-a456-426614174201";
const outsiderId = "123e4567-e89b-42d3-a456-426614174202";
const output = { path: "assets/generated/example.png", mimeType: "image/png", mediaType: "image" };

async function putTask(taskId: string, fields: Record<string, unknown>, ageSeconds: number) {
  const path = join(taskRoot, "task" + taskId.replaceAll("-", "").toLowerCase() + ".json");
  await writeAtomic(path, JSON.stringify({
    version: 1,
    taskId,
    cwd: workspace,
    mediaType: "image",
    state: "interrupted",
    createdAt: 1763510000000 - ageSeconds * 1000,
    updatedAt: 1763510000000 - ageSeconds * 1000,
    request: { providerId: "mac2ApiMuse", modelId: "muse/image", prompt: "Mô tả giả lập" },
    checkpoint: { providerData: { id: taskId, kind: "image", base: "https://mock.local.test/v1", secret: "NOT_PUBLIC" } },
    ...fields,
  }));
  const mtime = new Date(1763510000000 - ageSeconds * 1000);
  const handle = await open(path, "r+");
  try { await handle.utimes(mtime, mtime); }
  finally { await handle.close(); }
  return path;
}

beforeAll(async () => {
  await mkdir(join(testRoot, "workspaces", "workspace"), { recursive: true });
  workspace = await realpath(join(testRoot, "workspaces", "workspace"));
  const key = process.platform === "win32" ? workspace.toLowerCase() : workspace;
  taskRoot = join(testRoot, "mediaTasks", "workspace" + createHash("sha256").update(key).digest("hex"));
  await mkdir(taskRoot, { recursive: true });
  const { default: conf } = await import("../src/utils/conf");
  if (dirname(conf.path) !== await realpath(testRoot)) throw new Error("Media Studio tests need an isolated, disposable settings directory.");
  const history = await import("../src/utils/mediaStudio/history");
  listHistory = history.listStudioHistory;
  findTask = history.findStudioTask;
  const { default: express } = await import("express");
  const { default: listRoute } = await import("../src/routes/mediaStudio/list");
  const app = express();
  app.use("/api/mediaStudio/list", listRoute);
  app.use((cause: Error & { status?: number }, _req: unknown, res: import("express").Response, _next: unknown) => {
    res.status(cause.status ?? 500).json({ code: cause.status ?? 500 });
  });
  httpServer = await new Promise<Server>(resolve => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("Local mock HTTP listener did not start");
  httpOrigin = "http://127.0.0.1:" + address.port;
});

afterAll(async () => {
  if (httpServer) await new Promise<void>(resolve => httpServer!.close(() => resolve()));
});

describe("Media Studio: persisted worker history", () => {
  test("empty directory is a safe, read-only history result", async () => {
    expect(await listHistory(workspace)).toEqual({ entries: [], hasMore: false });
  });

  test("history filters by media type, ignores audio and malformed records", async () => {
    await putTask(imageTask, {}, 20);
    await putTask(videoTask, {
      mediaType: "video",
      state: "succeeded",
      request: { providerId: "mac2ApiMuse", modelId: "muse/video", prompt: "Video giả lập" },
      checkpoint: {},
      result: { code: 200, message: "OK", data: [
        { path: "assets/generated/clip.mp4", mimeType: "video/mp4", mediaType: "video" },
      ] },
    }, 10);
    await putTask(audioTask, { mediaType: "audio" }, 5);
    const brokenId = randomUUID();
    const brokenPath = await putTask(brokenId, { cwd: "/different/workspace" }, 1);
    const malformedId = randomUUID();
    await putTask(malformedId, { request: { providerId: 10 } }, 2);

    const images = await listHistory(workspace, undefined, { mediaType: "image" });
    expect(images.entries.map(entry => entry.taskId)).toEqual([imageTask]);
    const videos = await listHistory(workspace, undefined, { mediaType: "video" });
    expect(videos.entries.map(entry => entry.taskId)).toEqual([videoTask]);
    expect(videos.entries[0]?.result?.data?.[0]?.mediaType).toBe("video");
    const all = await listHistory(workspace);
    expect(all.entries.map(entry => entry.taskId)).toEqual([videoTask, imageTask]);
    expect(all.hasMore).toBe(false);
    // A same-file-name record for the wrong workspace cannot enter this history.
    expect(brokenPath).toEndWith(brokenId.replaceAll("-", "").toLowerCase() + ".json");
  });

  test("pagination uses latest file first and exposes no checkpoint secrets", async () => {
    const first = await listHistory(workspace, undefined, { limit: 1, offset: 0 });
    const second = await listHistory(workspace, undefined, { limit: 1, offset: 1 });
    expect(first.entries).toHaveLength(1);
    expect(first.hasMore).toBe(true);
    expect(second.entries).toHaveLength(1);
    expect(second.hasMore).toBe(false);
    expect(first.entries[0]?.taskId).toBe(videoTask);
    expect(second.entries[0]?.taskId).toBe(imageTask);
    expect(first.entries[0]).not.toHaveProperty("checkpoint");
    expect(second.entries[0]).not.toHaveProperty("providerData");
    expect(JSON.stringify(second.entries)).not.toContain("NOT_PUBLIC");
    expect(second.entries[0]?.resumable).toBe(true);
    expect(first.entries[0]?.resumable).toBe(false);
  });

  test("AI Chrome interrupted tasks are never advertised as resumable", async () => {
    await putTask(chromeTask, {
      request: { providerId: "aiChrome", modelId: "museImage", prompt: "Chrome giả lập" },
    }, 0);
    const record = await findTask(workspace, chromeTask);
    expect(record.resumable).toBe(false);
  });

  test("separates user-owned tasks and allows admin inspection", async () => {
    await putTask(hiddenTask, { ownerUserId: ownerId }, 0);
    const outsider = { id: outsiderId, role: "user" } as const;
    const own = { id: ownerId, role: "user" } as const;
    const admin = { id: ownerId, role: "admin" } as const;
    expect((await listHistory(workspace, outsider)).entries).toEqual([]);
    expect((await listHistory(workspace, own)).entries.map(entry => entry.taskId)).toEqual([hiddenTask]);
    expect((await listHistory(workspace, admin)).entries.some(entry => entry.taskId === hiddenTask)).toBe(true);
    await expect(findTask(workspace, hiddenTask, outsider)).rejects.toMatchObject({ status: 404 });
    expect((await findTask(workspace, hiddenTask, own)).taskId).toBe(hiddenTask);
  });

  test("does not advertise a file-only resume checkpoint when its output is missing", async () => {
    await putTask(staleFilesTask, {
      checkpoint: { assetCount: 1, files: [{ ...output, hash: "a".repeat(64) }] },
    }, 0);
    expect((await findTask(workspace, staleFilesTask)).resumable).toBe(false);
    await mkdir(join(workspace, "assets/generated"), { recursive: true });
    await writeAtomic(join(workspace, output.path), "mock-output-not-actual-image");
    expect((await findTask(workspace, staleFilesTask)).resumable).toBe(true);
  });

  test("Studio history HTTP endpoint validates media kind, app origin and returns no-store results", async () => {
    const resource = httpOrigin + "/api/mediaStudio/list?directory=" + encodeURIComponent(workspace)
      + "&mediaType=image&limit=2";
    const headers = { Origin: httpOrigin, "x-toonflow-workspace": "1" };
    const result = await fetch(resource, { headers });
    const body = await result.json();
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(body.code).toBe(200);
    expect(body.data.entries.every((item: { mediaType: string }) => item.mediaType === "image")).toBe(true);
    expect(JSON.stringify(body.data)).not.toContain("NOT_PUBLIC");

    const invalid = await fetch(resource.replace("mediaType=image", "mediaType=audio"), { headers });
    expect(invalid.status).toBe(400);
    const forbidden = await fetch(resource, { headers: { Origin: httpOrigin } });
    expect(forbidden.status).toBe(403);
  });
});
