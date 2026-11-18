import type { ClientMessage, ChromeKind } from "./protocol";
import { mkdir, writeAtomic } from "@toonflow/file";
import { dirname, join } from "node:path";
import conf from "@/utils/conf";
import { buildChromeRequest, type ChromeRequestInput, type ChromeRequestPayload } from "./request";
import { chunkSize, digest, frame, newTransfer, validateFile, type ReferenceFile, type ChromeResult } from "./files";
import { sendControl, sendBytes, selectedTarget, getTarget, online } from "./index";

type Target = NonNullable<ReturnType<typeof selectedTarget>>;
type Job = {
  id: string; ledger: string; kind: ChromeKind; target: Target; request: ChromeRequestPayload; requestHash: string; files: ReferenceFile[];
  stage: string; updatedAt: number; submitted: boolean; settled: boolean; runSent: boolean;
  sentAt: number | null; receivedAt: number | null;
  failedAtStage?: string; error?: string; errorCode?: string;
  save(stage: string): Promise<void>;
  preflight?: () => Promise<unknown>;
  resolve(file: ChromeResult): void; reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>; cleanup(): void;
  ack?: { transferId: string; sequence: number; resolve(): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> };
  packageAck?: { phase: "accepted" | "ready"; resolve(): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> };
  incoming?: { id: string; size: number; hash: string; mimeType: string; length: number; sequence: number; chunks: Buffer[] };
};
let current: Job | undefined;
let paused = false;
let nextAt = 0;
let wake: ReturnType<typeof setTimeout> | undefined;
const queue: Job[] = [];
const history: { id: string; tabId: number; provider: string; kind: ChromeKind; stage: string; updatedAt: number; sentAt: number | null; receivedAt: number | null; failedAtStage?: string; error?: string }[] = [];
function ledgerRecord(job: Job) {
  return { version: 1, id: job.id, kind: job.kind, tabId: job.target.tabId, provider: job.target.provider, stage: job.stage, updatedAt: job.updatedAt, sentAt: job.sentAt, receivedAt: job.receivedAt, failedAtStage: job.failedAtStage, error: job.error, errorCode: job.errorCode, request: job.request, requestHash: job.requestHash };
}
function remember(job: Job) {
  const record = history.find(item => item.id === job.id);
  const value = { id: job.id, kind: job.kind, tabId: job.target.tabId, provider: job.target.provider, stage: job.stage, updatedAt: job.updatedAt, sentAt: job.sentAt, receivedAt: job.receivedAt, failedAtStage: job.failedAtStage, error: job.error };
  if (record) Object.assign(record, value);
  else { history.push(value); if (history.length > 50) history.shift(); }
}
async function stage(job: Job, value: string) {
  if (value === "submitted" && !job.sentAt) job.sentAt = Date.now();
  job.stage = value; job.updatedAt = Date.now(); remember(job);
  await job.save(value);
}
function failure(job: Job, error: Error, notSubmitted = false) {
  if (job.settled) return;
  const uncertain = job.submitted && !notSubmitted;
  job.settled = true; job.cleanup(); clearTimeout(job.timer);
  if (job.ack) { clearTimeout(job.ack.timer); job.ack.reject(error); job.ack = undefined; }
  if (job.packageAck) { clearTimeout(job.packageAck.timer); job.packageAck.reject(error); job.packageAck = undefined; }
  job.incoming = undefined; job.files = [];
  job.failedAtStage = job.stage; job.error = error.message.slice(0, 1000);
  job.errorCode = typeof (error as NodeJS.ErrnoException).code === "string" ? (error as NodeJS.ErrnoException).code : undefined;
  job.stage = uncertain ? "unknown" : "failed"; job.updatedAt = Date.now(); remember(job);
  void writeAtomic(job.ledger, JSON.stringify(ledgerRecord(job)), { mode: 0o600 }).catch(cause => console.error("Không lưu được trạng thái lỗi AI chrome:", cause));
  if (current === job && job.submitted) {
    paused = true; try { if (online()) sendControl({ type: "cancel", requestId: job.id }); } catch { /* Lost delivery stays unknown; never retry. */ }
    for (const waiting of queue.splice(0)) failure(waiting, new Error("Hàng đợi Chrome đã dừng. Kiểm tra tab trước khi tiếp tục."));
  } else if (current === job) { current = undefined; void pump(); }
  job.reject(Object.assign(error, uncertain ? {} : { code: "MEDIA_TASK_FAILED" }));
}
function waitAck(job: Job, transferId: string, sequence: number, send: () => void) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { job.ack = undefined; reject(new Error("Mất xác nhận truyền tệp sang Chrome.")); }, 15000);
    job.ack = { transferId, sequence, resolve, reject, timer };
    try { send(); } catch (error) { clearTimeout(timer); job.ack = undefined; reject(error); }
  });
}
function waitPackageAck(job: Job, phase: "accepted" | "ready", send: () => void) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { job.packageAck = undefined; reject(new Error(`Extension chưa xác nhận gói yêu cầu (${phase}); không tự gửi lại.`)); }, 15000);
    job.packageAck = { phase, resolve, reject, timer };
    try { send(); } catch (error) { clearTimeout(timer); job.packageAck = undefined; reject(error); }
  });
}
async function dispatch(job: Job) {
  // A queued request stays bound to its original service, tab and document.
  // Wait for a busy composer to become idle; never send simultaneously to that tab.
  while (!job.settled) {
    const target = getTarget(job.target.tabId);
    if (!online() || !target || target.provider !== job.target.provider || target.documentToken !== job.target.documentToken || target.url !== job.target.url || target.blocked)
      throw new Error("Tab AI Chrome đã đổi nội dung, bị khóa hoặc mất kết nối. Không gửi lại tác vụ.");
    if (target.ready && !target.busy) break;
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  if (job.settled) return;
  if (job.preflight) {
    await job.preflight();
    if (job.settled) return;
    const target = getTarget(job.target.tabId);
    if (!target || target.documentToken !== job.target.documentToken || target.url !== job.target.url || !target.ready || target.blocked || target.busy)
      throw new Error("Tab đã thay đổi khi đang kiểm tra proxy/IP Mỹ. Không gửi Muse.");
  }
  await stage(job, "dispatching");
  if (job.settled) return;
  // Persist the uncertain boundary before any browser command; never retry this ID automatically.
  job.submitted = true;
  await waitPackageAck(job, "accepted", () => sendControl({ type: "prepare", requestId: job.id, target: job.target, payload: job.request, requestHash: job.requestHash }));
  if (job.settled) return;
  for (const [index, file] of job.files.entries()) {
    const transferId = newTransfer();
    const metadata = job.request.attachments[index]!;
    await waitAck(job, transferId, -1, () => sendControl({ type: "fileStart", requestId: job.id, transferId, index, attachmentId: metadata.id, name: metadata.name, label: metadata.label, size: metadata.size, mimeType: metadata.mimeType, sha256: metadata.sha256 }));
    let sequence = 0;
    for (let offset = 0; offset < file.bytes.byteLength; offset += chunkSize) {
      if (job.settled) return;
      const part = file.bytes.subarray(offset, offset + chunkSize);
      await waitAck(job, transferId, sequence, () => sendBytes(frame(transferId, sequence, part))); sequence++;
    }
    await waitAck(job, transferId, sequence, () => sendControl({ type: "fileEnd", requestId: job.id, transferId }));
  }
  job.files = [];
  if (job.settled) return;
  await waitPackageAck(job, "ready", () => sendControl({ type: "packageEnd", requestId: job.id, requestHash: job.requestHash }));
  if (job.preflight && !job.settled) {
    // Fail closed at the actual paid-send boundary. Never automatically retry
    // after this point or silently switch to another Chrome tab/profile.
    await job.preflight();
  }
  if (!job.settled) { job.runSent = true; sendControl({ type: "run", requestId: job.id, requestHash: job.requestHash }); }
}
async function pump() {
  if (current || paused || !queue.length) return;
  if (Date.now() < nextAt) { clearTimeout(wake); wake = setTimeout(() => void pump(), nextAt - Date.now()); return; }
  current = queue.shift()!;
  const job = current;
  try { await dispatch(job); } catch (error) { failure(job, error instanceof Error ? error : new Error(String(error))); }
}
export async function runTask(input: ChromeRequestInput & { save(stage: string): Promise<void>; preflight?: () => Promise<unknown> }, signal?: AbortSignal) {
  signal?.throwIfAborted();
  // Never infer a destination tab from a single available Chrome target.
  // Node selections must pin the tab explicitly; even one open tab could
  // belong to a different user/profile or change while an AI task is queued.
  if (input.tabId === undefined)
    throw Object.assign(new Error("Hãy chọn chính xác Dịch vụ → Tab trong node trước khi gửi AI Chrome; không tự chọn tab."), { code: "MEDIA_TASK_FAILED" });
  const { payload: request, files } = buildChromeRequest(input);
  const { requestId: id, kind, totalReferenceBytes } = request;
  const requestHash = digest(Buffer.from(JSON.stringify(request), "utf8"));
  const saveStage = input.save;
  const target = selectedTarget(input.tabId, request.modelId);
  if (paused || !online() || !target?.outputKinds.includes(kind) || target.blocked || queue.length >= 20)
    throw Object.assign(new Error(input.tabId === undefined ? "Hãy chọn đúng tab AI Chrome trong menu hai tầng của node trước khi gửi." : "Tab AI đã chọn không còn kết nối, không hỗ trợ đầu ra hoặc hàng đợi đã dừng."), { code: "MEDIA_TASK_FAILED" });
  if (!target.ready && !target.busy) throw Object.assign(new Error("Tab AI Chrome chưa sẵn sàng. Kiểm tra trang AI, bản nháp hoặc tệp đang tải."), { code: "MEDIA_TASK_FAILED" });
  const buffered = [...queue, ...(current ? [current] : [])].reduce((sum, job) => sum + job.files.reduce((size, file) => size + file.bytes.byteLength, 0), 0);
  if (buffered + totalReferenceBytes > 128 * 1024 * 1024) throw Object.assign(new Error("Tệp chờ trong hàng đợi Chrome vượt 128 MB. Hãy chờ tác vụ trước hoàn tất."), { code: "MEDIA_TASK_FAILED" });
  if (current?.id === id || queue.some(job => job.id === id) || history.some(job => job.id === id)) throw new Error("Mã tác vụ Chrome đã dùng; không gửi lại.");
  const root = join(dirname(conf.path), "aiChromeTasks");
  await mkdir(root, { recursive: true });
  const ledger = join(root, `${id}.json`);
  await writeAtomic(ledger, JSON.stringify({ version: 1, id, kind, tabId: target.tabId, provider: target.provider, stage: "queued", updatedAt: Date.now(), request, requestHash }), { exclusive: true, mode: 0o600 });
  signal?.throwIfAborted();
  const queuedBytes = [...queue, ...(current ? [current] : [])].reduce((sum, job) => sum + job.files.reduce((size, file) => size + file.bytes.byteLength, 0), 0);
  if (queue.length >= 20 || paused || !online() || queuedBytes + totalReferenceBytes > 128 * 1024 * 1024) throw new Error("Chrome hoặc dung lượng hàng đợi đã đổi khi lưu tác vụ. Không gửi lại ID này.");
  return new Promise<ChromeResult>((resolve, reject) => {
    const abort = () => { const index = queue.indexOf(job); if (index >= 0) queue.splice(index, 1); failure(job, new Error("Tác vụ Chrome đã bị huỷ. Kiểm tra tab nếu đã gửi.")); };
    const job: Job = { id, ledger, kind, target: { ...target }, request, requestHash, files,
      stage: "queued", updatedAt: Date.now(), submitted: false, settled: false, runSent: false, sentAt: null, receivedAt: null,
      preflight: input.preflight, save: async value => { await persist(); await saveStage(value); }, resolve, reject,
      timer: setTimeout(() => { const index = queue.indexOf(job); if (index >= 0) queue.splice(index, 1); failure(job, new Error("Hết thời gian chờ Chrome; không tự gửi lại.")); }, 20 * 60 * 1000),
      cleanup: () => signal?.removeEventListener("abort", abort),
    };
    async function persist() {
      await writeAtomic(ledger, JSON.stringify(ledgerRecord(job)), { mode: 0o600 });
    }
    queue.push(job); remember(job); signal?.addEventListener("abort", abort, { once: true }); void pump();
  });
}
export async function handleJobMessage(message: Exclude<ClientMessage, { type: "pair" | "authenticate" | "pong" | "tabStatus" }>) {
  const job = current;
  if (!job || message.requestId !== job.id || job.settled) throw new Error("Unexpected Chrome task");
  if (message.type === "packageAck") {
    const ack = job.packageAck;
    if (!ack || ack.phase !== message.phase || message.requestHash !== job.requestHash || job.ack || job.runSent) throw new Error("Unexpected package acknowledgement");
    await stage(job, message.phase === "accepted" ? "receivingPackage" : "received");
    if (job.settled) return;
    clearTimeout(ack.timer); job.packageAck = undefined; ack.resolve();
  } else if (message.type === "fileAck") {
    const ack = job.ack;
    if (!ack || ack.transferId !== message.transferId || ack.sequence !== message.sequence) throw new Error("Unexpected file acknowledgement");
    clearTimeout(ack.timer); job.ack = undefined; ack.resolve();
  } else if (message.type === "navigation") {
    if (!job.runSent || job.stage !== "referencesAttached" || message.documentToken !== job.target.documentToken || message.fromUrl !== job.target.url || new URL(message.url).origin !== new URL(message.fromUrl).origin) throw new Error("Unexpected conversation navigation");
    const old = { ...job.target };
    const matches = (value: Target) => value.tabId === old.tabId && value.documentToken === old.documentToken && value.url === old.url;
    for (const item of [job, ...queue]) if (matches(item.target)) item.target = { ...item.target, url: message.url };
    const selected = getTarget(job.target.tabId); if (selected && matches(selected)) selected.url = message.url;
    await job.save(job.stage);
  } else if (message.type === "stage") {
    const expected = { referencesAttached: "received", submitted: "referencesAttached", waitingResult: "submitted" };
    if (!job.runSent || expected[message.stage] !== job.stage) throw new Error("Unexpected Chrome stage");
    await stage(job, message.stage);
  } else if (message.type === "jobError") {
    const notSubmitted = message.code === "MUSE_NOT_SUBMITTED" && !job.sentAt
      && ((!job.runSent && job.stage === "dispatching" && job.packageAck?.phase === "accepted")
        || (job.runSent && ["received", "referencesAttached"].includes(job.stage)));
    failure(job, Object.assign(new Error(message.error), { code: message.code }), notSubmitted);
  }
  else if (message.type === "resultStart") {
    if (!job.runSent || job.ack || job.stage !== "waitingResult" || job.incoming) throw new Error("Unexpected result file or task stage");
    if (job.kind === "text" ? message.mimeType !== "text/plain" || message.size > 1024 * 1024 : !message.mimeType.startsWith(`${job.kind}/`)) throw new Error("Result type does not match the Chrome request");
    await stage(job, "receivingResult");
    job.incoming = { id: message.transferId, size: message.size, hash: message.sha256, mimeType: message.mimeType, length: 0, sequence: 0, chunks: [] };
    sendControl({ type: "fileAck", transferId: message.transferId, sequence: -1 });
  } else if (message.type === "resultEnd") {
    const file = job.incoming;
    if (!file || file.id !== message.transferId || file.length !== file.size) throw new Error("Incomplete result");
    const bytes = Buffer.concat(file.chunks, file.length);
    if (digest(bytes) !== file.hash || validateFile(bytes, file.mimeType, job.kind) !== file.mimeType) throw new Error("Result integrity check failed");
    job.incoming = undefined;
    job.receivedAt = Date.now();
    await stage(job, "saving");
    job.resolve({ kind: job.kind, bytes, mimeType: file.mimeType });
  }
}
export function receiveBytes(bytes: Buffer) {
  const job = current; const file = job?.incoming;
  if (!job || job.settled || !file || bytes.length <= 40 || bytes.length > chunkSize + 40 || bytes.toString("ascii", 0, 36) !== file.id || bytes.readUInt32BE(36) !== file.sequence || file.length + bytes.length - 40 > file.size) throw new Error("Invalid result chunk");
  file.chunks.push(Buffer.from(bytes.subarray(40))); file.length += bytes.length - 40;
  sendControl({ type: "fileAck", transferId: file.id, sequence: file.sequence++ });
}
export async function completeTask(id: string) {
  if (current?.id !== id || current.settled) return;
  const job = current;
  await writeAtomic(job.ledger, JSON.stringify({ ...ledgerRecord(job), stage: "saved", updatedAt: Date.now() }), { mode: 0o600 });
  if (current !== job || job.settled) return;
  job.settled = true; job.cleanup(); clearTimeout(job.timer);
  job.stage = "saved"; job.updatedAt = Date.now(); remember(job);
  try { if (online()) sendControl({ type: "saved", requestId: id }); else paused = true; } catch { paused = true; }
  current = undefined; nextAt = Date.now() + 5000; void pump();
}
export function failTask(id: string, error: unknown) { if (current?.id === id) failure(current, error instanceof Error ? error : new Error(String(error))); }
export function connectionLost() {
  if (current) failure(current, new Error("Mất kết nối Chrome. Không tự gửi lại tác vụ."));
  for (const job of queue.splice(0)) failure(job, new Error("Chrome đã mất kết nối trước khi gửi."));
}
export function resumeQueue() {
  if (!paused) throw new Error("Hàng đợi không bị dừng.");
  if (!online()) throw new Error("Hãy kết nối Chrome trước.");
  current = undefined; paused = false; nextAt = Date.now() + 5000;
  sendControl({ type: "reset" }); void pump();
}
export function jobStatus() {
  return {
    paused, waiting: queue.length,
    current: current ? { id: current.id, tabId: current.target.tabId, provider: current.target.provider, stage: current.stage, updatedAt: current.updatedAt } : null,
    queued: queue.map(job => ({ id: job.id, tabId: job.target.tabId, provider: job.target.provider, kind: job.kind, stage: job.stage })),
    recent: history.slice(-20),
  };
}

export function blockQueue() { paused = true; if (current && !current.settled) failure(current, new Error("Extension đã khôi phục với tác vụ chưa rõ kết quả.")); }
