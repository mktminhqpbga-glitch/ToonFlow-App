import { chunkSize, digest, frame } from "./mediaTransfer.js";
import { isUuid, receiveRequest, matchReference, probedOutputKinds } from "./requestReceiver.js";
import { downloadMessage, clearDownload } from "./mediaDownload.js";

let socket, target = null, targets = [], job, incoming, ack;
let selectionHint = "missing";
let readinessError = "";
function readinessMessage(probe) {
  return ({ MUSE_COMPOSER_NOT_FOUND: "Chưa tìm thấy duy nhất ô Message có thể nhập trên Muse.", MUSE_DRAFT_TEXT: "Ô Message trên Muse đang có văn bản nháp.",
    MUSE_DRAFT_FILES: "Vùng soạn tin Muse còn tệp đính kèm hoặc ô chọn tệp chưa được giải phóng.", MUSE_UPLOAD_PENDING: "Vùng soạn tin Muse đang tải tệp.",
    MUSE_GENERATING: "Muse đang trả lời trong vùng soạn tin này.", MUSE_TASK_ACTIVE: "Tab Muse đang xử lý một tác vụ của extension.",
    MUSE_PREPARING: "Tab Muse đang chuẩn bị tham chiếu cho một tác vụ." })[probe?.notReadyReason] || "Muse chưa sẵn sàng. Nếu vừa cập nhật extension, hãy tải lại tab Muse.";
}
let probing = false;
let mustReprobe = false;
let probeCompletion = Promise.resolve();
let targetEpoch = 0;
let controls = Promise.resolve();
let pageMessages = Promise.resolve();
let taskWrites = Promise.resolve();
function send(message) { if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error("MacFlow đã ngắt kết nối."); socket.send(JSON.stringify(message)); }
function guardConnection(connection, value) {
  if (socket !== connection || connection?.readyState !== WebSocket.OPEN || value && (job !== value || value.cancelled)) throw new Error("Kết nối hoặc tác vụ đã thay đổi; không tiếp tục gửi.");
}
function storeTask(value, stage, details = {}, receipts) {
  value.stage = stage;
  const record = { id: value.id, requestHash: value.requestHash, tabId: value.target.tabId, provider: value.target.provider, documentToken: value.target.documentToken, url: value.target.url, kind: value.kind,
    stage, updatedAt: Date.now(), expectedReferenceCount: value.payload.attachments.length, receivedReferenceCount: value.receivedCount, receivedReferenceBytes: value.referenceBytes, ...details };
  taskWrites = taskWrites.catch(() => {}).then(async () => {
    if (job !== value || value.cancelled && stage !== "unknown" && stage !== "failed") return;
    await chrome.storage.local.set({ chromeTask: record, ...(receipts ? { chromeReceipts: receipts } : {}) });
  });
  return taskWrites;
}
function pageCall(value, message) { return chrome.tabs.sendMessage(value.target.tabId, { ...message, requestId: value.id, documentToken: value.target.documentToken, expectedUrl: value.target.url }).then(result => { if (!result?.ok) throw Object.assign(new Error(result?.error || "Tab AI Chrome không xác nhận thao tác."), { code: result?.code, notSubmitted: result?.notSubmitted === true }); return result; }); }
function encode(bytes) { let value = ""; for (let i = 0; i < bytes.length; i += 8192) value += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(value); }
function decode(value) { return Uint8Array.from(atob(value), ch => ch.charCodeAt(0)); }
const servicePatterns = [
  "https://muse.ai/*", "https://*.muse.ai/*",
  "https://chatgpt.com/*", "https://chat.openai.com/*", "https://gemini.google.com/*",
];
function providerForUrl(address) {
  try {
    const url = new URL(address);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (url.hostname === "muse.ai" || url.hostname.endsWith(".muse.ai")) return "muse";
    if (url.hostname === "chatgpt.com" || url.hostname === "chat.openai.com") return "chatgpt";
    if (url.hostname === "gemini.google.com") return "gemini";
  } catch {}
  return null;
}
async function verifiedManagedMuseTabs(stored) {
  if (!Array.isArray(stored) || stored.length > 5 || new Set(stored).size !== stored.length
    || stored.some(id => !Number.isSafeInteger(id) || id < 0))
    throw new Error("Danh sách tab Muse được quản lý không hợp lệ; cần kiểm tra trước khi tạo tab.");
  const live = [];
  for (const id of stored) {
    let tab;
    try { tab = await chrome.tabs.get(id); }
    catch (error) {
      if (/No tab with id/i.test(String(error?.message || error))) continue;
      throw error;
    }
    // A newly created tab may still expose only pendingUrl while it navigates.
    if (tab.id === id && (providerForUrl(tab.url) === "muse" || providerForUrl(tab.pendingUrl) === "muse")) live.push(id);
  }
  return live;
}
async function manageMuseTabs(message, connection) {
  if (!isUuid(message.requestId) || message.count !== 5)
    throw new Error("Yêu cầu quản lý tab Muse không hợp lệ.");
  if (job) throw new Error("Đang có tác vụ Chrome; không thể quản lý tab Muse.");
  await taskWrites;
  guardConnection(connection);
  const { chromeTask, managedMuseTabIds = [] } = await chrome.storage.local.get(["chromeTask", "managedMuseTabIds"]);
  guardConnection(connection);
  if (job || chromeTask) throw new Error("Còn tác vụ Chrome chưa xác định trạng thái; không thể quản lý tab Muse.");
  const live = await verifiedManagedMuseTabs(managedMuseTabIds);
  guardConnection(connection);
  if (live.length !== managedMuseTabIds.length)
    await chrome.storage.local.set({ managedMuseTabIds: live });
  while (live.length < 5) {
    guardConnection(connection);
    const tab = await chrome.tabs.create({ url: "https://muse.ai/thread/new", active: false });
    if (!Number.isSafeInteger(tab?.id) || tab.id < 0 || live.includes(tab.id))
      throw new Error("Chrome không xác nhận ID tab Muse mới.");
    live.push(tab.id);
    // Persist each owned ID immediately, including when a later tab cannot be opened.
    await chrome.storage.local.set({ managedMuseTabIds: [...live] });
  }
  guardConnection(connection);
  return live;
}
export async function listChromeTabs(managedMuseTabIds = []) {
  const managedIds = new Set(managedMuseTabIds);
  const tabs = (await chrome.tabs.query({ url: servicePatterns }))
    .filter(tab => Number.isInteger(tab.id) && tab.url?.length <= 1400 && providerForUrl(tab.url))
    .sort((a, b) => Number(managedIds.has(b.id)) - Number(managedIds.has(a.id))
      || a.windowId - b.windowId || a.index - b.index || a.id - b.id);
  return tabs.slice(0, 25).map((tab, i) => ({
    id: tab.id, tabId: tab.id, number: i + 1, provider: providerForUrl(tab.url),
    title: (tab.title || "").slice(0, 120), url: tab.url,
  }));
}
async function probeTab(tabId, provider, allowInstall) {
  try { return await chrome.tabs.sendMessage(tabId, { type: "probe" }); }
  catch (error) {
    if (!allowInstall) throw error;
    const tab = await chrome.tabs.get(tabId);
    if (providerForUrl(tab.url) !== provider) throw new Error("Tab đã rời dịch vụ AI được chọn.");
    await chrome.scripting.executeScript({
      target: { tabId }, files: [provider === "muse" ? "museBridge.js" : "siteBridge.js"],
    });
    return chrome.tabs.sendMessage(tabId, { type: "probe" });
  }
}
export async function reportTarget(force = false) {
  if (probing) { if (force) mustReprobe = true; return probeCompletion; }
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  probing = true;
  let finishProbe;
  probeCompletion = new Promise(resolve => { finishProbe = resolve; });
  const connection = socket;
  const revision = targetEpoch;
  try {
    const { chromeTask, managedMuseTabIds = [] } = await chrome.storage.local.get(["chromeTask", "managedMuseTabIds"]);
    const verifiedManagedIds = await verifiedManagedMuseTabs(managedMuseTabIds);
    const running = !!job && !job.cancelled;
    readinessError = "";
    const tabs = await listChromeTabs(verifiedManagedIds);
    const nextTargets = [];
    for (const tab of tabs) {
      if (socket !== connection || revision !== targetEpoch) return;
      let answer;
      try { answer = await probeTab(tab.id, tab.provider, !running || job?.target.tabId !== tab.id); }
      catch (error) {
        if (tab.provider === "muse" && !readinessError) readinessError = String(error?.message || error).slice(0, 250);
        continue; // Never fabricate documentToken for an unresponsive/offline page.
      }
      if (!answer || answer.url !== tab.url || !isUuid(answer.documentToken)
        || answer.provider && answer.provider !== tab.provider) continue;
      const attached = running && job.target.tabId === tab.id && job.target.documentToken === answer.documentToken;
      const recovered = chromeTask && chromeTask.tabId === tab.id && chromeTask.documentToken === answer.documentToken;
      const outputKinds = probedOutputKinds(tab.provider, answer);
      if (!outputKinds.length) continue;
      const blocked = !!chromeTask && !running || !answer.capable;
      nextTargets.push({
        tabId: tab.id, url: tab.url, documentToken: answer.documentToken,
        provider: tab.provider, title: tab.title, outputKinds,
        ready: !!answer.ready && !blocked && !attached, blocked: !!blocked,
        busy: !!answer.busy || attached,
        ...(attached ? { taskId: job.id } : recovered && isUuid(chromeTask.id) ? { taskId: chromeTask.id } : {}),
      });
      if (tab.provider === "muse" && !answer.ready && !readinessError) readinessError = readinessMessage(answer);
    }
    if (socket !== connection || revision !== targetEpoch) return;
    targets = nextTargets;
    // Do not assign a destination from a popup or a default Muse tab. The
    // person chooses a specific tab in each node; backend pins its document.
    target = targets.find(item => item.provider === "muse" && item.tabId === job?.target?.tabId) || null;
    selectionHint = !targets.length ? "missing" : chromeTask && !running ? "blocked"
      : targets.some(item => item.provider === "muse" && item.ready) ? "ready" : "notReady";
    send({ type: "tabStatus", targets, recoveryRequired: !!chromeTask && !running, managedMuseTabIds: verifiedManagedIds });
  } catch (error) {
    if (socket === connection && revision === targetEpoch) {
      readinessError = String(error?.message || error).slice(0, 250);
      targets = []; target = null;
      try { send({ type: "tabStatus", targets: [], recoveryRequired: !!job && job.cancelled, managedMuseTabIds: [] }); } catch {}
    }
  } finally {
    probing = false;
    // A capability change during a full tab scan invalidates that scan.
    // Publish a fresh status promptly rather than waiting for the 5s timer.
    try {
      if (mustReprobe) {
        mustReprobe = false;
        await reportTarget();
      }
    } finally { finishProbe(); }
  }
}
function waitAck(transferId, sequence, action) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ack = undefined; reject(new Error("Mất xác nhận chuyển kết quả.")); }, 15000);
    ack = { transferId, sequence, resolve, reject, timer };
    try { action(); } catch (error) { clearTimeout(timer); ack = undefined; reject(error); }
  });
}
async function cancelJob(error) {
  if (!job) return;
  const value = job;
  if (value.cancelled) { await taskWrites; return; }
  const failedAtStage = value.stage;
  value.cancelled = true; value.references = []; incoming = undefined;
  clearDownload(value);
  if (ack) { clearTimeout(ack.timer); ack.reject(new Error("Tác vụ đã dừng.")); ack = undefined; }
  try { await storeTask(value, error?.notSubmitted === true ? "failed" : "unknown", { failedAtStage, code: error?.code || "CHROME_INTERRUPTED", error: String(error?.message || error || "Tác vụ đã dừng; kiểm tra tab trước khi tiếp tục.").slice(0, 1000) }); }
  finally { if (value.running) await pageCall(value, { type: "cancel" }).catch(() => {}); }
}
export function closeMuseConnection() { socket = undefined; void cancelJob().catch(() => {}); }
export async function museState() { const { chromeTask } = await chrome.storage.local.get("chromeTask"); return { target, targets, chromeTask, selectionHint, readinessError }; }
export function bindMuseConnection(value) { socket = value; void reportTarget(); }
async function run(value, connection) {
  try {
    guardConnection(connection, value);
    // The server chose this precise tab+document during prepare. Never auto-route.
    const [tab, probe] = await Promise.all([
      chrome.tabs.get(value.target.tabId),
      chrome.tabs.sendMessage(value.target.tabId, { type: "probe" }),
    ]);
    guardConnection(connection, value);
    if (tab.url !== value.target.url || probe?.url !== value.target.url
      || probe.documentToken !== value.target.documentToken || providerForUrl(tab.url) !== value.target.provider
      || !probe.ready) throw Object.assign(new Error("Tab AI đã thay đổi hoặc không sẵn sàng; chưa gửi prompt."),
        { code: "CHROME_TAB_CHANGED", notSubmitted: true });
    await pageCall(value, { type: "prepareReferences", count: value.references.length });
    for (const [index, file] of value.references.entries()) {
      guardConnection(connection, value);
      await pageCall(value, { type: "referenceStart", index, size: file.bytes.length, mimeType: file.mimeType, name: file.name, sha256: file.sha256 });
      let sequence = 0;
      for (let offset = 0; offset < file.bytes.length; offset += chunkSize) {
        guardConnection(connection, value);
        await pageCall(value, { type: "referenceChunk", sequence: sequence++, data: encode(file.bytes.subarray(offset, offset + chunkSize)) });
      }
      await pageCall(value, { type: "referenceEnd" }); file.bytes = new Uint8Array();
    }
    value.references = [];
    guardConnection(connection, value);
    const result = await pageCall(value, { type: "generate", kind: value.kind, prompt: value.prompt, response: value.payload.response });
    if (job !== value || value.cancelled) return;
    if (!result.transferred) throw new Error("Tab chưa chuyển kết quả về MacFlow.");
  } catch (error) {
    if (job === value && !value.cancelled) await rejectPackage(connection, value.id, error);
  }
}
async function rejectPackage(connection, id, error) {
  if (socket !== connection) return;
  try { await cancelJob(error); }
  catch { connection?.close(4001, "Could not record interrupted task"); return; }
  if (socket === connection && isUuid(id)) try { send({ type: "jobError", requestId: id, ...(error.notSubmitted === true ? { code: "MUSE_NOT_SUBMITTED" } : /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code || "") ? { code: error.code } : {}), error: String(error.message || error).slice(0, 1000) }); } catch {}
}
export function handleMuseMessage(message, connection) {
  controls = controls.then(async () => {
    if (socket !== connection) return;
    guardConnection(connection);
    if (message.type === "manageMuseTabs") {
      const tabIds = await manageMuseTabs(message, connection);
      await reportTarget(true);
      guardConnection(connection);
      send({ type: "museTabsManaged", requestId: message.requestId, tabIds });
      return;
    }
    if (message.type === "reset") {
      await cancelJob(); guardConnection(connection);
      await chrome.storage.local.remove("chromeTask"); guardConnection(connection);
      job = undefined; incoming = undefined; targetEpoch++; await reportTarget(); return;
    }
    if (message.type === "prepare") {
      const selected = targets.find(item => item.tabId === message.target?.tabId
        && item.provider === message.target?.provider
        && item.url === message.target?.url && item.documentToken === message.target?.documentToken);
      if (!selected || selected.blocked || !selected.ready || selected.busy)
        throw Object.assign(new Error("Tab AI Chrome được chọn không còn sẵn sàng."), { code: "CHROME_TAB_NOT_READY", notSubmitted: true });
      const payload = await receiveRequest(message.payload, message.requestId, message.requestHash, selected.provider);
      guardConnection(connection);
      const { chromeTask, chromeReceipts = [] } = await chrome.storage.local.get(["chromeTask", "chromeReceipts"]);
      guardConnection(connection);
      if (!Array.isArray(chromeReceipts) || chromeReceipts.length > 100 || chromeReceipts.some(item => !item || !isUuid(item.id))) throw new Error("Lịch sử nhận gói Chrome không hợp lệ; chưa giao việc cho tab.");
      if (chromeReceipts.some(item => item.id === payload.requestId)) throw new Error("Extension đã nhận ID này trước đó; không chạy lại.");
      if (job || chromeTask || !selected.outputKinds.includes(payload.kind)) throw new Error("Tab hoặc tác vụ Chrome chưa sẵn sàng.");
      const tab = await chrome.tabs.get(selected.tabId); const probe = await chrome.tabs.sendMessage(selected.tabId, { type: "probe" });
      guardConnection(connection);
      if (job || !targets.some(item => item.tabId === selected.tabId && item.provider === selected.provider
        && item.url === selected.url && item.documentToken === selected.documentToken)
        || tab.url !== selected.url || providerForUrl(tab.url) !== selected.provider
        || probe.url !== selected.url || probe.documentToken !== selected.documentToken)
        throw Object.assign(new Error("Tab hoặc document Chrome đã đổi trước khi nhận gói; chưa gửi prompt."), { code: "CHROME_TAB_CHANGED", notSubmitted: true });
      if (!probe.ready) throw Object.assign(new Error("Trang AI chưa sẵn sàng. Chưa gửi prompt."), { code: "CHROME_NOT_READY", notSubmitted: true });
      const value = job = { id: payload.requestId, kind: payload.kind, target: selected, documentUrl: selected.url, payload, requestHash: message.requestHash, prompt: payload.prompt,
        references: [], referenceBytes: 0, receivedCount: 0, transfers: new Set(), ready: false, running: false, cancelled: false };
      const receipts = [...chromeReceipts.slice(-99), { id: value.id, requestHash: value.requestHash, acceptedAt: Date.now() }];
      await storeTask(value, "metadataReceived", {}, receipts);
      guardConnection(connection, value);
      send({ type: "packageAck", requestId: value.id, requestHash: value.requestHash, phase: "accepted" }); return;
    }
    if (message.type === "fileAck") {
      if (!ack || ack.transferId !== message.transferId || ack.sequence !== message.sequence) throw new Error("Xác nhận tệp không khớp.");
      clearTimeout(ack.timer); const pending = ack; ack = undefined; pending.resolve(); return;
    }
    if (message.type === "cancel" && !job) return;
    if (!job || message.requestId !== job.id) throw new Error("Thông điệp không khớp tác vụ Chrome đang nhận.");
    const value = job;
    if (message.type === "cancel") { await cancelJob(); return; }
    if (message.type === "saved") {
      if (job.cancelled || !job.result?.ended) throw new Error("MacFlow xác nhận lưu khi tác vụ chưa chuyển đủ kết quả.");
      await taskWrites; guardConnection(connection, value);
      await chrome.storage.local.remove("chromeTask"); guardConnection(connection, value);
      job = undefined; await reportTarget(); return;
    }
    if (job.cancelled) return;
    if (message.type === "fileStart") {
      if (incoming || value.running || value.ready) throw new Error("Tác vụ không ở chặng nhận tham chiếu.");
      const file = matchReference(message, value.payload, value.receivedCount, value.transfers);
      value.transfers.add(message.transferId);
      incoming = { ...file, transferId: message.transferId, chunks: [], length: 0, sequence: 0 };
      await storeTask(value, "receivingReferences", { receivingAttachmentId: file.id });
      guardConnection(connection, value);
      send({ type: "fileAck", requestId: value.id, transferId: message.transferId, sequence: -1 });
    } else if (message.type === "fileEnd") {
      const file = incoming;
      if (!file || file.transferId !== message.transferId || file.length !== file.size) throw new Error("Thiếu dữ liệu tham chiếu.");
      const bytes = new Uint8Array(file.size); let offset = 0;
      for (const chunk of file.chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      if (await digest(bytes) !== file.sha256) throw new Error("Checksum tham chiếu không khớp.");
      guardConnection(connection, value);
      value.references.push({ bytes, attachmentId: file.id, mimeType: file.mimeType, name: file.name, sha256: file.sha256 });
      value.referenceBytes += file.size; value.receivedCount++; incoming = undefined;
      await storeTask(value, "receivingReferences");
      guardConnection(connection, value);
      send({ type: "fileAck", requestId: value.id, transferId: file.transferId, sequence: file.sequence });
    } else if (message.type === "packageEnd") {
      if (value.running || value.ready || incoming || message.requestHash !== value.requestHash || value.receivedCount !== value.payload.attachments.length
        || value.references.length !== value.receivedCount || value.referenceBytes !== value.payload.totalReferenceBytes) throw new Error("Chưa nhận đủ gói yêu cầu hoặc checksum manifest đã đổi.");
      await storeTask(value, "packageReady");
      guardConnection(connection, value);
      value.ready = true;
      send({ type: "packageAck", requestId: value.id, requestHash: value.requestHash, phase: "ready" });
    } else if (message.type === "run") {
      if (!value.ready || value.running || incoming || message.requestHash !== value.requestHash || value.receivedCount !== value.payload.attachments.length) throw new Error("Chưa xác nhận nhận đủ gói hoặc tác vụ đã chạy.");
      await storeTask(value, "dispatchingToPage");
      guardConnection(connection, value);
      value.running = true; void run(value, connection);
    }
  }).catch(async error => {
    if (message.type === "manageMuseTabs") {
      if (socket === connection && connection.readyState === WebSocket.OPEN) {
        try { send({ type: "museTabsManaged", requestId: message.requestId, tabIds: [], error: String(error?.message || error).slice(0, 400) }); } catch {}
        void reportTarget(true);
      }
      return;
    }
    if (message.type === "prepare" && !job?.running) error.notSubmitted = true;
    await rejectPackage(connection, job?.id || message.requestId, error);
  });
}
export function handleMuseBytes(buffer, connection) {
  controls = controls.then(() => {
    if (socket !== connection) return;
    guardConnection(connection);
    const bytes = new Uint8Array(buffer); const file = incoming;
    if (!job || job.cancelled || !file || bytes.length <= 40 || bytes.length > chunkSize + 40 || new TextDecoder().decode(bytes.subarray(0, 36)) !== file.transferId || new DataView(buffer).getUint32(36) !== file.sequence || file.length + bytes.length - 40 > file.size) throw new Error("Khối tham chiếu không hợp lệ.");
    file.chunks.push(bytes.slice(40)); file.length += bytes.length - 40;
    send({ type: "fileAck", requestId: job.id, transferId: file.transferId, sequence: file.sequence++ });
  }).catch(error => rejectPackage(connection, job?.id, error));
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !job || job.cancelled || sender.tab?.id !== job.target.tabId || message.documentToken !== job.target.documentToken || message.requestId !== job.id) return false;
  if (message.type === "museNavigation") {
    const value = job, connection = socket;
    pageMessages = pageMessages.then(async () => {
      guardConnection(connection, value);
      if (!value.running || value.stage !== "referencesAttached" || message.fromUrl !== value.target.url
        || typeof message.url !== "string" || message.url.length > 2048
        || new URL(message.url).origin !== new URL(value.target.url).origin
        || providerForUrl(message.url) !== value.target.provider)
        throw new Error("Không chấp nhận chuyển cuộc hội thoại này.");
      const tab = await chrome.tabs.get(value.target.tabId);
      guardConnection(connection, value);
      if (tab.url !== message.url) throw new Error("URL tab không khớp cuộc hội thoại mới.");
      targetEpoch++; value.target = { ...value.target, url: message.url };
      if (value.target.provider === "muse") target = { ...value.target };
      targets = targets.map(item => item.tabId === value.target.tabId
        ? { ...value.target, ready: false, busy: true, blocked: false, taskId: value.id }
        : item);
      await storeTask(value, value.stage); guardConnection(connection, value);
      send({ type: "navigation", requestId: value.id, documentToken: value.target.documentToken, fromUrl: message.fromUrl, url: message.url });
      const { managedMuseTabIds = [] } = await chrome.storage.local.get("managedMuseTabIds");
      const liveManagedIds = await verifiedManagedMuseTabs(managedMuseTabIds);
      guardConnection(connection, value);
      send({ type: "tabStatus", targets, managedMuseTabIds: liveManagedIds }); reply({ ok: true });
    }).catch(error => { reply({ ok: false, error: error.message }); return rejectPackage(connection, value.id, error); });
    return true;
  }
  if (sender.url !== job.target.url && sender.url !== job.documentUrl) return false;
  if (["museDownloadStart", "museDownloadChunk", "museDownloadCancel"].includes(message.type)) {
    const value = job;
    downloadMessage(value, message).then(result => reply({ ok: true, ...result }), error => reply({ ok: false, code: error.code || "MUSE_DOWNLOAD_FAILED", error: String(error.message || error).slice(0, 1000) }));
    return true;
  }
  if (message.type === "museStage" && ["referencesAttached", "submitted", "waitingResult"].includes(message.stage)) {
    const value = job, connection = socket;
    pageMessages = pageMessages.then(async () => {
      guardConnection(connection, value);
      if (!value.running) throw new Error("Tab báo tiến độ trước khi nhận lệnh chạy.");
      await storeTask(value, message.stage);
      guardConnection(connection, value);
      send({ type: "stage", requestId: value.id, stage: message.stage });
      reply({ ok: true });
    }).catch(error => { reply({ ok: false, error: error.message }); return rejectPackage(connection, value.id, error); });
    return true;
  }
  if (!["museResultStart", "museResultChunk", "museResultEnd"].includes(message.type)) return false;
  const value = job;
  pageMessages = pageMessages.then(async () => {
    if (job !== value || value.cancelled || !value.running) throw new Error("Tác vụ đã dừng.");
    if (message.type === "museResultStart") {
      if (value.result || !Number.isInteger(message.size) || message.size <= 0 || message.size > value.payload.response.maxBytes || !value.payload.response.mimeTypes.includes(message.mimeType) || !/^[a-f0-9]{64}$/.test(message.sha256)) throw new Error("Đầu ra không khớp yêu cầu.");
      const transferId = crypto.randomUUID(); value.result = { transferId, length: 0, size: message.size, sequence: 0 };
      await waitAck(transferId, -1, () => send({ type: "resultStart", requestId: value.id, transferId, size: message.size, mimeType: message.mimeType, sha256: message.sha256 }));
    } else if (message.type === "museResultChunk") {
      const result = value.result;
      if (!result || result.ended || message.sequence !== result.sequence || typeof message.data !== "string" || message.data.length > 90000) throw new Error("Khối đầu ra không hợp lệ.");
      const bytes = decode(message.data);
      if (!bytes.length || bytes.length > chunkSize || result.length + bytes.length > result.size) throw new Error("Dung lượng đầu ra không khớp.");
      await waitAck(result.transferId, result.sequence, () => socket.send(frame(result.transferId, result.sequence, bytes)));
      result.length += bytes.length; result.sequence++;
    } else {
      const result = value.result;
      if (!result || result.ended || result.length !== result.size) throw new Error("Chưa chuyển đủ đầu ra.");
      result.ended = true; send({ type: "resultEnd", requestId: value.id, transferId: result.transferId });
    }
    reply({ ok: true });
  }).catch(error => reply({ ok: false, error: String(error.message || error).slice(0, 1000) }));
  return true;
});
setInterval(() => void reportTarget(), 5000);
