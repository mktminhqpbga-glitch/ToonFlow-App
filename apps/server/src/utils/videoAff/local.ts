import { cp, lstat, mkdir, mkdtemp, open, readFile, readdir, rm, writeAtomic } from "@toonflow/file";
import { createHash, randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { delimiter, dirname, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { parseEnv } from "node:util";
import type { Request } from "express";
import u from "@/utils";
import { fail, setLocalVideoAffConnection, videoAffFetch, videoAffStudioPath, videoAffToken } from "./config";

const loopback = "127.0.0.1";
const frontendFiles = ["index.html", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "src",
  "tsconfig.json", "tsconfig.app.json", "tsconfig.node.json", "vite.config.ts"];
type LocalStatus = { phase: "idle" | "starting" | "running" | "error"; message: string };
let status: LocalStatus = { phase: "idle", message: "" };
let startup: Promise<void> | undefined;
let managedProcess: { readonly pid: number } | undefined;

export async function localVideoAffAvailable(req: Request) {
  const root = typeof req.app.locals.videoAffRoot === "string" && req.app.locals.videoAffRoot;
  if (!root || process.env.TOONFLOW_VIDEO_AFF_ORIGIN || !["darwin", "linux"].includes(process.platform)) return false;
  return (await lstat(resolve(root, "localRunner.py")).catch(() => undefined))?.isFile() === true;
}

export function localVideoAffStatus() {
  return status;
}

async function frontendRevision(frontend: string) {
  const hash = createHash("sha256");
  hash.update(videoAffStudioPath).update("\0");
  async function add(path: string) {
    const source = resolve(frontend, path);
    hash.update(path).update("\0");
    if ((await lstat(source)).isDirectory()) {
      for (const name of (await readdir(source)).sort()) await add(`${path}/${name}`);
    } else hash.update(await readFile(source));
    hash.update("\0");
  }
  for (const path of frontendFiles) await add(path);
  return hash.digest("hex");
}

async function providerEnvironment(resource: string, token: string, callback: string) {
  const allowed = /^AIC_(?:SCREENING_(?:BASE_URL|API_KEY)|(?:WRITER|REVIEW)_MODEL|IMAGE_(?:BASE_URL|API_KEY|MODEL|API)|VIDEO_(?:BASE_URL|API_KEY|MODEL|FRAME_FIELDS)|TTS_(?:BASE_URL|API_KEY|MODEL|VOICE|SPEED)|TEXT_EMBEDDING_(?:BASE_URL|API_KEY|MODEL)|EMBEDDING_MODEL|CLIP_SPEED|DUPLICATE_SIMILARITY)$/;
  const overrides: Record<string, string> = {};
  const settings = await readFile(resolve(resource, "../../.env.videoAff"), "utf-8").catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return "";
  });
  for (const [key, value] of Object.entries({ ...parseEnv(settings), ...process.env })) {
    if (allowed.test(key) && value?.trim()) overrides[key] = value;
  }
  return {
    AIC_SCREENING_BASE_URL: callback, AIC_SCREENING_API_KEY: token, AIC_WRITER_MODEL: "macflow-writer", AIC_REVIEW_MODEL: "macflow-review",
    AIC_IMAGE_BASE_URL: callback, AIC_IMAGE_API_KEY: token, AIC_IMAGE_MODEL: "macflow-image", AIC_IMAGE_API: "edits",
    AIC_VIDEO_BASE_URL: callback, AIC_VIDEO_API_KEY: token, AIC_VIDEO_MODEL: "macflow-video", AIC_VIDEO_FRAME_FIELDS: "image",
    AIC_TTS_BASE_URL: callback, AIC_TTS_API_KEY: token, AIC_TTS_MODEL: "macflow-audio",
    ...overrides,
  };
}

function toolPath() {
  const home = homedir();
  return [
    process.env.PATH, resolve(home, ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin",
    "/opt/homebrew/opt/postgresql@17/bin", "/usr/local/opt/postgresql@17/bin",
    "/usr/lib/postgresql/17/bin", "/usr/bin", "/bin",
  ].filter(Boolean).join(delimiter);
}

async function prepareVideoAff(resource: string, macFlowPort: number) {
  if (process.getuid?.() === 0) fail("Hãy chạy MacFlow bằng tài khoản máy tính thường để mở cơ sở dữ liệu VideoAFF.");
  const source = resolve(resource, "upstream");
  const root = resolve(dirname(u.conf.path), "videoAff");
  await mkdir(root, { recursive: true, mode: 0o700 });
  if ((await lstat(root)).isSymbolicLink()) fail("Thư mục dữ liệu VideoAFF phải là thư mục thông thường.");
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !(key.startsWith("AIC_") || key.startsWith("TOONFLOW_") || key.startsWith("PG"))));
  const PATH = toolPath();
  const binaries = ["uv", "node", "pnpm", "postgres", "ffmpeg", "ffprobe"] as const;
  const tools = Object.fromEntries(binaries.map(name => [name, Bun.which(name, { PATH })])) as Record<typeof binaries[number], string | null>;
  const missing = binaries.filter(name => !tools[name]);
  if (missing.length) fail("Máy còn thiếu " + missing.join(", ") + ". Cài công cụ theo hướng dẫn rồi thử lại.");
  const pgBin = dirname(tools.postgres!);
  const pgTools = await Promise.all(["initdb", "pg_isready"].map(name =>
    lstat(resolve(pgBin, name)).then(info => info.isFile() || info.isSymbolicLink(), () => false)));
  if (!pgTools.every(Boolean)) {
    fail("Chưa tìm đủ công cụ PostgreSQL. Hãy cài PostgreSQL 17 theo hướng dẫn.");
  }

  const upstreamFrontend = resolve(source, "frontend");
  const virtualEnv = resolve(root, "venv");
  const pnpmStore = resolve(root, "pnpmStore");
  const log = await open(resolve(root, "start.log"), "a", 0o600);
  const commandEnv = { ...env, PATH, UV_PROJECT_ENVIRONMENT: virtualEnv, CI: "true",
    VITE_VIDEO_AFF_BASE: `${videoAffStudioPath}/dashboard/` };
  async function run(args: string[], cwd: string, message: string) {
    status = { phase: "starting", message };
    const child = Bun.spawn(args, { cwd, env: commandEnv, stdin: "ignore", stdout: log.fd, stderr: log.fd,
      signal: AbortSignal.timeout(12 * 60_000) });
    if (await child.exited !== 0) fail(message + " gặp lỗi. Mở nhật ký start.log trong thư mục dữ liệu VideoAFF để xem chi tiết.");
  }

  try {
    const revision = await frontendRevision(upstreamFrontend);
    const frontend = resolve(root, "frontend", revision);
    const stamp = resolve(frontend, "macFlowRevision.txt");
    const previous = await readFile(stamp, "utf-8").catch(() => "");
    const dist = resolve(frontend, "dist");
    const built = await lstat(resolve(dist, "index.html")).catch(() => undefined);
    if (revision !== previous || !built?.isFile()) {
      await mkdir(frontend, { recursive: true });
      for (const path of frontendFiles) await cp(resolve(upstreamFrontend, path), resolve(frontend, path), { recursive: true });
      await run([tools.pnpm!, "install", "--store-dir", pnpmStore, "--frozen-lockfile"], frontend, "Cài thư viện giao diện");
      await run([tools.pnpm!, "build"], frontend, "Chuẩn bị giao diện VideoAFF");
      await writeAtomic(stamp, revision);
    }
    await run([tools.uv!, "sync", "--frozen", "--no-dev", "--python", ">=3.11,<3.14"], source, "Cài thư viện Python");

    const stored = u.conf.get("videoAffLocalToken");
    const configured = videoAffToken();
    const token = configured ?? (typeof stored === "string" && /^[a-f0-9]{64}$/.test(stored) ? stored : randomBytes(32).toString("hex"));
    if (!configured && token !== stored) u.conf.set("videoAffLocalToken", token);
    const callback = `http://${loopback}:${macFlowPort}/api/videoAff/bridge/v1`;
    const providers = await providerEnvironment(resource, token, callback);
    status = { phase: "starting", message: "Đang mở cơ sở dữ liệu và VideoAFF…" };
    const socketDirectory = await mkdtemp("/tmp/macflowVideoAff");
    const socket = resolve(socketDirectory, "api.sock");
    const runner = Bun.spawn([
      resolve(virtualEnv, "bin/python"), resolve(resource, "localRunner.py"), source, root, pgBin, socket,
    ], { cwd: source, env: { ...commandEnv, ...providers, AIC_DASHBOARD_DIR: dist, BAML_LOG: "OFF" },
      stdin: "pipe", stdout: log.fd, stderr: log.fd });
    managedProcess = runner;
    setLocalVideoAffConnection({ token, callback, socket });
    let exited = false;
    void runner.exited.then(() => {
      exited = true;
      void rm(socketDirectory, { recursive: true, force: true }).catch(console.error);
      if (managedProcess !== runner) return;
      managedProcess = undefined;
      setLocalVideoAffConnection();
      status = { phase: "error", message: "VideoAFF đã dừng. Mở nhật ký start.log trong thư mục dữ liệu VideoAFF để xem chi tiết." };
    });
    const deadline = Date.now() + 150_000;
    while (!exited && Date.now() < deadline) {
      const ready = await videoAffFetch("/health/ready", {
        signal: AbortSignal.timeout(1200),
      }).then(async response => {
        if (!response.ok) return false;
        const health = await response.json() as { status?: string; service?: string };
        return health.status === "ok" && health.service === "affiliate-content-api";
      }).catch(() => false);
      if (ready && !exited) {
        status = { phase: "running", message: "" };
        return;
      }
      await setTimeout(900);
    }
    if (!exited) runner.kill();
    await runner.exited;
    fail("VideoAFF chưa khởi động xong. Mở nhật ký start.log trong thư mục dữ liệu VideoAFF để xem chi tiết.");
  } finally { await log.close(); }
}

export function startLocalVideoAff(req: Request) {
  if (startup || status.phase === "running") return;
  const port = req.socket.localPort;
  if (!port) fail("Không xác định được địa chỉ MacFlow trên máy này.", 503);
  status = { phase: "starting", message: "Đang kiểm tra công cụ trên máy…" };
  startup = prepareVideoAff(req.app.locals.videoAffRoot as string, port).catch(error => {
    const message = error && typeof error === "object" && "status" in error && error instanceof Error ? error.message
      : "Chưa khởi động được VideoAFF. Kiểm tra công cụ đã cài và nhật ký start.log trong thư mục dữ liệu VideoAFF.";
    status = { phase: "error", message };
  }).finally(() => { startup = undefined; });
}
