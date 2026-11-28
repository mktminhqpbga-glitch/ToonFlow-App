import { existsSync, lstat, mkdir, readFile, readdir, writeAtomic } from "@toonflow/file";
import { delimiter, dirname, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { macFlowBranch, macFlowRepository, updateChannel, type UpdateFromLauncher, type UpdateFromServer, type UpdateSnapshot } from "./macFlowUpdateProtocol";

const root = resolve(import.meta.dirname, "..");
const sourceServer = resolve(root, "apps/server");
const data = resolve(sourceServer, process.env.TOONFLOW_DATA_DIR || resolve(root, "data"));
const storage = resolve(data, "macFlowUpdate");
const statePath = resolve(storage, "state.json");
const revisionPattern = /^[a-f0-9]{40}$/;
const updateRef = "refs/macflow/latest";
const checkInterval = 5 * 60_000;
const buildTimeout = 20 * 60_000;
const release = (revision: string) => resolve(storage, revision);
const builtServer = (path: string) => resolve(path, "build/server/index.js");
const built = (path: string) => existsSync(builtServer(path)) && existsSync(resolve(path, "build/web/index.html"));
const lifetime = new AbortController();

function localGit(...args: string[]) {
  try {
    const proc = Bun.spawnSync(["git", ...args], { cwd: root, stderr: "ignore" });
    return proc.success ? proc.stdout.toString().trim() : undefined;
  } catch {
    return undefined;
  }
}

const base = localGit("rev-parse", "HEAD") || "";
const remote = localGit("config", "--get", "remote.origin.url");
const correctOrigin = [macFlowRepository, macFlowRepository + ".git",
  "git@github.com:mktminhqpbga-glitch/ToonFlow-App.git"].includes(remote || "");
const managed = ["darwin", "linux"].includes(process.platform) && correctOrigin && revisionPattern.test(base)
  && localGit("branch", "--show-current") === macFlowBranch
  && localGit("status", "--porcelain", "--untracked-files=no", "--ignore-submodules=dirty") === "";

let run: Bun.Subprocess | undefined;
let staging: Bun.Subprocess | undefined;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    lifetime.abort();
    run?.kill(signal);
    staging?.kill(signal);
  });
}

if (!managed) {
  console.log("MacFlow đang dùng cách khởi động thông thường. Tự cập nhật cần bản cài Git MacFlow trên macOS hoặc Linux.");
  run = Bun.spawn([process.execPath, builtServer(root)], { cwd: sourceServer, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  process.exit(await run.exited);
}
if (!built(root)) {
  console.error("Chưa có bản MacFlow đã dựng. Chạy bun run build:server trước.");
  process.exit(1);
}

await mkdir(storage, { recursive: true, mode: 0o700 });
if (!(await lstat(storage)).isDirectory()) throw new Error("Thư mục cập nhật MacFlow không hợp lệ.");
type Saved = { base?: string; installed?: string; automatic?: boolean };
const saved: Saved = await readFile(statePath, "utf8").then(text => JSON.parse(text)).catch(() => ({})) ?? {};
const installed = saved.base === base && typeof saved.installed === "string" && revisionPattern.test(saved.installed)
  && built(release(saved.installed)) ? saved.installed : base;
let snapshot: UpdateSnapshot = { current: installed, automatic: saved.automatic === true, phase: "idle" };
let prepared: string | undefined;
let rejected: string | undefined;
let manual = false;
let busy = false;
let handoff = false;
let nextCheck = 0;
let drain: { id: string; resolve: (ready: boolean) => void } | undefined;

function send(message: UpdateFromLauncher) {
  try { run?.send({ channel: updateChannel, ...message }); }
  catch { /* The server can exit while an update is starting. */ }
}

function publish(fields: Partial<UpdateSnapshot>) {
  snapshot = { ...snapshot, ...fields };
  send({ type: "snapshot", snapshot });
}

async function stageCommand(args: string[], cwd: string, timeout = 120_000) {
  const argsEnv = {
    ...process.env, GIT_TERMINAL_PROMPT: "0", PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ""}`,
  };
  delete argsEnv.NODE_ENV;
  const child = Bun.spawn(args, { cwd, env: argsEnv, stdin: "ignore", stdout: "inherit", stderr: "inherit",
    signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(timeout)]) });
  staging = child;
  try {
    if (await child.exited !== 0) throw new Error("Không chạy xong lệnh cập nhật");
    lifetime.signal.throwIfAborted();
  } finally {
    staging = undefined;
  }
}

async function persist(current: string, automatic: boolean) {
  await writeAtomic(statePath, JSON.stringify({ base, installed: current, automatic }));
}

async function check() {
  nextCheck = Date.now() + checkInterval;
  publish({ phase: "checking", message: undefined });
  await stageCommand(["git", "fetch", "--no-tags", "--no-recurse-submodules", macFlowRepository, `refs/heads/${macFlowBranch}:${updateRef}`], root);
  const latest = localGit("rev-parse", updateRef) || "";
  if (!revisionPattern.test(latest)) throw new Error("Không đọc được phiên bản trên GitHub.");
  if (latest !== snapshot.current && localGit("merge-base", "--is-ancestor", snapshot.current, latest) === undefined) {
    if (localGit("merge-base", "--is-ancestor", latest, snapshot.current) === "") {
      publish({ phase: "idle", latest: undefined });
      return;
    }
    throw new Error("Lịch sử bản cài và nhánh GitHub đã tách nhau. Hãy cập nhật theo hướng dẫn.");
  }
  if (prepared !== latest) prepared = undefined;
  publish({ latest, phase: latest === snapshot.current ? "idle" : "available" });
}

async function removeRelease(revision: string) {
  const target = release(revision);
  const info = await lstat(target);
  // Only a launcher-owned checkout of this exact commit may be removed.
  if (!info.isDirectory() || localGit("-C", target, "rev-parse", "HEAD") !== revision
    || localGit("worktree", "list", "--porcelain")?.split("\n").includes(`worktree ${target}`) !== true)
    throw new Error("Thư mục chuẩn bị bản mới không hợp lệ.");
  await stageCommand(["git", "worktree", "remove", "--force", target], root);
}

async function build(revision: string) {
  publish({ phase: "building" });
  const target = release(revision);
  if (existsSync(target)) await removeRelease(revision);
  await stageCommand(["git", "worktree", "add", "--detach", target, revision], root);
  try {
    await stageCommand([process.execPath, "install", "--frozen-lockfile"], target, buildTimeout);
    await stageCommand([process.execPath, "run", "--cwd", "apps/server", "routes"], target);
    await stageCommand([process.execPath, "run", "build:server"], target, buildTimeout);
    if (!built(target)) throw new Error("Bản mới dựng chưa đầy đủ.");
  } catch (cause) {
    if (!lifetime.signal.aborted) await removeRelease(revision).catch(console.error);
    throw cause;
  }
  prepared = revision;
  publish({ phase: "waiting" });
}

function askToDrain() {
  const id = crypto.randomUUID();
  const answer = Promise.withResolvers<boolean>();
  drain = { id, resolve: answer.resolve };
  send({ type: "drain", id, automatic: !manual });
  return Promise.race([answer.promise, setTimeout(3000, false)]).finally(() => { drain = undefined; });
}

async function stopServer() {
  const child = run;
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([child.exited, setTimeout(5000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
  await child.exited;
}

async function launch(revision: string) {
  const path = revision === base ? root : release(revision);
  const ready = Promise.withResolvers<boolean>();
  const child = Bun.spawn([process.execPath, builtServer(path)], {
    cwd: resolve(path, "apps/server"), stdin: "ignore", stdout: "inherit", stderr: "inherit",
    env: { ...process.env, TOONFLOW_DATA_DIR: data, MACFLOW_INSTALL_ROOT: root },
    ipc(message: UpdateFromServer & { channel?: string }, sender) {
      if (sender !== run || message?.channel !== updateChannel) return;
      if (message.type === "ready") ready.resolve(true);
      else if (message.type === "drain" && message.id === drain?.id) drain.resolve(message.ready);
      else if (message.type === "automatic") {
        void persist(snapshot.current, message.enabled).then(() => publish({ automatic: message.enabled }), report);
      } else if (message.type === "check") schedule(true);
      else if (message.type === "install") {
        if (!snapshot.latest || snapshot.latest === snapshot.current) return;
        manual = true;
        rejected = undefined;
        schedule();
      }
    },
  });
  run = child;
  const timer = new AbortController();
  const started = await Promise.race([
    ready.promise, child.exited.then(() => false), setTimeout(60_000, false, { signal: timer.signal }).catch(() => false),
  ]);
  timer.abort();
  if (!started) {
    await stopServer();
    throw new Error("MacFlow không khởi động được.");
  }
  void child.exited.then(code => {
    if (run === child && !handoff && !lifetime.signal.aborted) process.exit(code);
  });
}

async function activate(revision: string) {
  if (!await askToDrain()) {
    publish({ phase: "waiting" });
    return;
  }
  const previous = snapshot.current;
  handoff = true;
  try {
    publish({ phase: "restarting" });
    await stopServer();
    lifetime.signal.throwIfAborted();
    try {
      await launch(revision);
      await persist(revision, snapshot.automatic);
    } catch (cause) {
      await stopServer();
      lifetime.signal.throwIfAborted();
      await launch(previous);
      throw new Error("Bản mới chưa khởi động được. MacFlow đã mở lại bản trước.", { cause });
    }
  } finally {
    handoff = false;
  }
  prepared = undefined;
  manual = false;
  publish({ current: revision, phase: "idle", message: undefined });
  try {
    for (const name of await readdir(storage)) {
      if (name !== revision && name !== previous && revisionPattern.test(name)) await removeRelease(name);
    }
  } catch (cause) {
    console.error("[MacFlow] Chưa dọn được bản dựng cũ", cause);
  }
}

function report(error: unknown) {
  if (lifetime.signal.aborted) return;
  console.error("[MacFlow] Cập nhật thất bại", error);
  const fallback = snapshot.phase === "checking"
    ? "Không kiểm tra được bản mới trên GitHub. Hãy thử lại."
    : "Chưa cài được bản mới. MacFlow vẫn dùng phiên bản trước.";
  publish({ phase: "error", message: error instanceof Error && error.message !== "Không chạy xong lệnh cập nhật" ? error.message : fallback });
}

function schedule(checkNow = false) {
  if (busy || lifetime.signal.aborted) return;
  busy = true;
  void (async () => {
    if (checkNow || Date.now() >= nextCheck) await check();
    const latest = snapshot.latest;
    if (!latest || latest === snapshot.current || latest === rejected || (!manual && !snapshot.automatic)) return;
    try {
      if (prepared !== latest) await build(latest);
      if (manual || snapshot.automatic) await activate(latest);
      else publish({ phase: "available" });
    } catch (error) {
      rejected = latest;
      prepared = undefined;
      manual = false;
      throw error;
    }
  })().catch(report).finally(() => { busy = false; });
}

try {
  await launch(installed);
} catch (cause) {
  if (installed === base || lifetime.signal.aborted) throw cause;
  await launch(base);
  await persist(base, snapshot.automatic);
  publish({ current: base, phase: "error", message: "Đã mở lại MacFlow từ bản cài ban đầu." });
}
publish({});
schedule();
const interval = setInterval(() => schedule(), 5000);
lifetime.signal.addEventListener("abort", () => clearInterval(interval), { once: true });
