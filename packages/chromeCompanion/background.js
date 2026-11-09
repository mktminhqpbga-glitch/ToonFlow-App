/* Original implementation for ToonFlow, not copied from the GPL workflow repository. */
"use strict";
importScripts("remoteTransport.js");
// Tokens and E2E secrets are not readable by content scripts injected into AI websites.
void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }).catch(() => {});
let remote = null;
let remoteMode = "local";
let remotePending = null;
let remoteError = "";
let remotePendingTimer = null;
let socket = null;
let state = "disconnected";
const active = new Map();
let runLedgerQueue = Promise.resolve();
const serviceHosts = {
  muse: new Set(["muse.ai"]),
  gemini: new Set(["gemini.google.com"]),
  chatgpt: new Set(["chatgpt.com", "www.chatgpt.com", "chat.openai.com"]),
};
function providerFor(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.port || parsed.username || parsed.password) return null;
    if (parsed.hostname === "muse.ai" || parsed.hostname.endsWith(".muse.ai")) return "muse";
    return Object.keys(serviceHosts).find(name => serviceHosts[name].has(parsed.hostname)) || null;
  } catch { return null; }
}
function pairing(code) {
  const url = new URL(String(code || "").trim());
  if (url.protocol !== "toonflow-bridge:" || url.hostname !== "127.0.0.1" || !/^\d+$/.test(url.port)
    || Number(url.port) < 1 || Number(url.port) > 65535 || url.search || url.hash || url.username || url.password
    || !/^\/[a-f0-9]{64}$/.test(url.pathname)) throw Error("Mã ghép nối không hợp lệ");
  return { port: Number(url.port), token: url.pathname.slice(1) };
}
function send(data) {
  if (remoteMode === "remote") {
    if (!remote) throw Error("Remote Chrome Companion offline");
    void remote.send(data).catch(error => { remoteError = error.message || "Remote transfer failed"; });
    return;
  }
  if (socket?.readyState !== WebSocket.OPEN) throw Error("Chưa ghép nối ToonFlow");
  socket.send(JSON.stringify(data));
}
async function connect(code) {
  remote?.stop(); remote = null; remoteMode = "local";
  await chrome.storage.local.set({ remoteMode });
  if (socket) { socket.close(); socket = null; }
  const target = pairing(code);
  state = "connecting";
  return new Promise((resolve, reject) => {
    const connection = new WebSocket("ws://127.0.0.1:" + target.port + "/");
    socket = connection;
    const timer = setTimeout(() => connection.close(), 7000);
    let settled = false;
    function failed(reason) {
      clearTimeout(timer);
      if (!settled) { settled = true; reject(Error(reason)); }
    }
    connection.onopen = () => {
      try { connection.send(JSON.stringify({ type: "auth", token: target.token })); }
      catch { failed("Không gửi được thông tin ghép nối"); }
    };
    connection.onmessage = event => {
      let value;
      try { value = JSON.parse(event.data); } catch { return; }
      if (value.type === "ready") {
        if (socket !== connection) return;
        state = "connected"; clearTimeout(timer);
        if (!settled) { settled = true; resolve({ connected: true }); }
      } else if (value.type === "request" && typeof value.id === "string" && state === "connected") {
        void dispatch(value.operation, value.payload).then(result => {
          if (socket === connection) send({ type: "reply", id: value.id, result });
        }, error => {
          if (socket === connection) send({ type: "reply", id: value.id, error: error?.message || "Lỗi thao tác Chrome" });
        });
      }
    };
    connection.onerror = () => failed("Không kết nối được ToonFlow Desktop");
    connection.onclose = () => {
      clearTimeout(timer);
      if (socket === connection) { socket = null; state = "disconnected"; active.clear(); }
      failed("Kết nối đã đóng hoặc không được chấp nhận");
    };
  });
}
function disconnect() {
  socket?.close(); socket = null; state = "disconnected"; active.clear();
  return { connected: false };
}
function remotePairCode(code) {
  const url = new URL(String(code || ""));
  const relay = new URL(url.searchParams.get("relay") || "");
  if (url.protocol !== "toonflow-remote:" || !["", "/"].includes(url.pathname) || url.hostname !== "pair"
    || relay.protocol !== "https:" || relay.username || relay.password || relay.hash || relay.search
    || !["", "/"].includes(relay.pathname) || relay.port || !/^[0-9a-f-]{36}$/i.test(url.searchParams.get("id") || "")
    || !/^#[0-9a-f]{64}$/i.test(url.hash)) throw Error("Invalid Render pairing code");
  return { url: relay.origin, pairId: url.searchParams.get("id"), secret: url.hash.slice(1) };
}
async function remoteApi(url, path, payload) {
  const response = await fetch(url + path, { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(25000) });
  const value = await response.json();
  if (!response.ok) throw Error(value.error || "Render Relay request failed");
  return value;
}
async function remotePair(code, name) {
  const info = remotePairCode(code);
  if (typeof name !== "string" || !name.trim() || name.length > 80) throw Error("Invalid device name");
  const joined = await remoteApi(info.url, "/v1/pair/join", { pairId: info.pairId, name: name.trim() });
  remotePending = { ...info, claim: joined.claim, name: name.trim(), expires: Date.now() + 300000 };
  remoteMode = "remote"; remoteError = "";
  socket?.close(); socket = null; state = "disconnected";
  await chrome.storage.local.set({ remotePending, remoteMode });
  void checkRemotePairing();
  return { pending: true, state: "pending" };
}
async function checkRemotePairing() {
  if (!remotePending) return;
  if (remotePending.expires < Date.now()) {
    remoteError = "Remote pairing expired"; remotePending = null;
    await chrome.storage.local.remove("remotePending");
    return;
  }
  try {
    const value = await remoteApi(remotePending.url, "/v1/pair/claim",
      { pairId: remotePending.pairId, claim: remotePending.claim });
    if (value.state === "approved") {
      const config = { url: remotePending.url, deviceId: value.deviceId,
        deviceToken: value.deviceToken, secret: remotePending.secret };
      await chrome.storage.local.set({ remoteConfig: config, remoteMode: "remote" });
      await chrome.storage.local.remove("remotePending");
      remotePending = null;
      startRemote(config);
      return;
    }
  } catch (error) { remoteError = error.message || "Remote pairing unavailable"; }
  clearTimeout(remotePendingTimer);
  remotePendingTimer = setTimeout(() => void checkRemotePairing(), 7000);
}
function startRemote(config) {
  remote?.stop();
  remoteMode = "remote";
  remote = new ToonflowRemoteTransport(config, value => void remoteReceive(value),
    message => { remoteError = message; });
  remote.start();
}
async function remoteReceive(value) {
  if (!value || value.type !== "request" || typeof value.id !== "string") return;
  try {
    const answer = await dispatch(value.operation, value.payload);
    if (value.operation === "run" && answer?.accepted) {
      await chrome.storage.local.set({ remoteActive: [...active].map(([id, entry]) => ({ id, ...entry })) });
    }
    await remote.send({ type: "reply", id: value.id, result: answer });
  } catch (error) {
    await remote?.send({ type: "reply", id: value.id, error: error.message || "Chrome remote action failed" }).catch(() => {});
  }
}
async function remoteDisconnect() {
  remote?.stop(); remote = null; remoteMode = "local"; remotePending = null;
  clearTimeout(remotePendingTimer);
  await chrome.storage.local.remove(["remotePending", "remoteConfig", "remoteActive"]);
  await chrome.storage.local.set({ remoteMode: "local" });
  remoteError = ""; return { connected: false };
}
void chrome.storage.local.get(["remoteConfig", "remoteMode", "remotePending", "remoteActive"]).then(data => {
  remoteMode = data.remoteMode || "local";
  if (remoteMode !== "remote") return;
  for (const item of data.remoteActive || []) {
    if (typeof item.id === "string" && Number.isInteger(item.tabId)) active.set(item.id,
      { tabId: item.tabId, provider: item.provider, documentToken: item.documentToken, expectedUrl: item.expectedUrl });
  }
  remotePending = data.remotePending || null;
  if (remotePending) void checkRemotePairing();
  else if (data.remoteConfig) startRemote(data.remoteConfig);
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== "remoteCompanionWake" || remoteMode !== "remote") return;
  if (remotePending) void checkRemotePairing();
  else if (remote?.stopped) void chrome.storage.local.get("remoteConfig").then(value => {
    if (value.remoteConfig) startRemote(value.remoteConfig);
  });
});
chrome.alarms.create("remoteCompanionWake", { periodInMinutes: 1 });

function snapshot(tab) { return { id: tab.id, title: tab.title || "", url: tab.url, provider: providerFor(tab.url) }; }
async function getTab(id, provider) {
  if (!Number.isInteger(id) || id < 0) throw Error("ID tab không hợp lệ");
  const tab = await chrome.tabs.get(id);
  if (tab.status === "loading") throw Error("Tab đang tải trang; chờ tải xong rồi chọn lại");
  if (providerFor(tab.url) !== provider) throw Error("Tab đã chuyển khỏi dịch vụ được chọn");
  return tab;
}
async function claimRun(id) {
  // Giữ lịch sử chung Local/Remote qua restart; không tự hết hạn rồi gửi lại Task ID cũ.
  const pending = runLedgerQueue.then(async () => {
    const stored = await chrome.storage.local.get("remoteRunLedger");
    const ledger = stored.remoteRunLedger || {};
    if (Object.hasOwn(ledger, id)) return false;
    const maxRecordedRuns = 20000;
    if (Object.keys(ledger).length >= maxRecordedRuns)
      throw Error("Lịch sử chống gửi trùng đã đầy; dừng gửi để không làm mất dấu tác vụ cũ");
    ledger[id] = Date.now();
    await chrome.storage.local.set({ remoteRunLedger: ledger });
    return true;
  });
  runLedgerQueue = pending.then(() => {}, () => {});
  return pending;
}
function persistActive() {
  if (remoteMode === "remote") return chrome.storage.local.set({ remoteActive: [...active].map(([id, entry]) => ({ id, ...entry })) });
  return Promise.resolve();
}
async function dispatch(operation, payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw Error("Gói dữ liệu không hợp lệ");
  if (operation === "tabs") return (await chrome.tabs.query({})).filter(tab => providerFor(tab.url)).map(snapshot);
  if (!["probe", "run", "cancel"].includes(operation)) throw Error("Lệnh Chrome không được phép");
  const record = operation === "cancel" ? active.get(payload.id) : undefined;
  const tabId = operation === "cancel" ? record?.tabId : payload.tabId;
  const provider = operation === "cancel" ? record?.provider : payload.provider;
  if (!provider || !serviceHosts[provider]) throw Error("Dịch vụ AI không hợp lệ");
  const targetTab = await getTab(tabId, provider);
  if (operation === "probe") return chrome.tabs.sendMessage(tabId, { command: "probe", provider }, { frameId: 0 });
  if (operation === "cancel") {
    return chrome.tabs.sendMessage(tabId, { command: "cancel", id: payload.id }, { frameId: 0 });
  }
  if (typeof payload.expectedUrl !== "string" || payload.expectedUrl !== targetTab.url
    || !/^[0-9a-f-]{36}$/i.test(payload.expectedDocumentToken || ""))
    throw Error("Tab hoặc phiên trang đã thay đổi; chọn lại tab AI trước khi gửi");
  if (!/^[0-9a-f-]{36}$/i.test(payload.id || "") || typeof payload.prompt !== "string" || !payload.prompt.trim() || payload.prompt.length > 100000
    || !["text", "image", "video"].includes(payload.kind) || !Array.isArray(payload.images) || payload.images.length > 4)
    throw Error("Nội dung yêu cầu không hợp lệ");
  if (active.has(payload.id)) return { accepted: true, uncertain: true };
  if ([...active.values()].some(item => item.tabId === tabId))
    throw Error("Tab đang chạy hoặc chưa rõ kết quả tác vụ cũ; kiểm tra website, không gửi lại tự động");
  const entry = { tabId, provider, documentToken: payload.expectedDocumentToken, expectedUrl: payload.expectedUrl };
  // Giữ tab trước mọi await; không tự kích hoạt, điều hướng hay chuyển sang tab khác.
  active.set(payload.id, entry);
  let dispatched = false;
  try {
    const probe = await chrome.tabs.sendMessage(tabId, { command: "probe", provider }, { frameId: 0 });
    if (!probe?.ready) throw Error(probe?.error || "Tab không còn sẵn sàng; chưa gửi prompt");
    if (probe.documentToken !== entry.documentToken || probe.url !== entry.expectedUrl)
      throw Error("Tab tải lại hoặc đổi cuộc trò chuyện sau khi chọn; chưa gửi prompt");
    if (!probe.capabilities?.includes(payload.kind)) throw Error("Chế độ tạo chưa được xác minh trên tab");
    const current = await getTab(tabId, provider);
    if (current.url !== entry.expectedUrl || active.get(payload.id) !== entry)
      throw Error("Tab thay đổi trước khi gửi; chưa gửi prompt");
    if (!await claimRun(payload.id)) {
      if (active.get(payload.id) === entry) active.delete(payload.id);
      await persistActive();
      return { accepted: true, uncertain: true };
    }
    // Lưu khóa trước dispatch để MV3 restart không làm mất tác vụ chưa xác nhận.
    await persistActive();
    const pinnedTab = await getTab(tabId, provider);
    if (pinnedTab.url !== entry.expectedUrl || active.get(payload.id) !== entry)
      throw Error("Phiên tab thay đổi trong khi chuẩn bị gửi; chưa gửi prompt");
    dispatched = true;
    const reply = await chrome.tabs.sendMessage(tabId, {
      command: "run", id: payload.id, kind: payload.kind, provider, expectedUrl: entry.expectedUrl,
      expectedDocumentToken: entry.documentToken, prompt: payload.prompt, images: payload.images, options: payload.options || {},
    }, { frameId: 0 });
    if (!reply?.accepted) {
      dispatched = false;
      throw Error(reply?.error || "Tab không nhận được yêu cầu");
    }
    return { accepted: true };
  } catch (error) {
    if (!dispatched && active.get(payload.id) === entry) { active.delete(payload.id); await persistActive(); }
    // Khi không rõ dispatch có tới trang hay chưa, giữ khóa tab đến khi có terminal event hoặc reload.
    throw error;
  }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !message || typeof message !== "object") return false;
  if (["popupStatus", "popupConnect", "popupDisconnect", "popupRemotePair", "popupRemoteStatus", "popupRemoteDisconnect"].includes(message.command)) {
    // Only the extension's own popup can pair; no AI webpage can request a pairing.
    if (sender.tab || !sender.url?.startsWith(chrome.runtime.getURL("popup.html"))) return false;
    const action = message.command === "popupStatus" ? async () => ({ connected: state === "connected", state, mode: remoteMode })
      : message.command === "popupConnect" ? () => connect(message.code)
      : message.command === "popupDisconnect" ? async () => disconnect()
      : message.command === "popupRemotePair" ? () => remotePair(message.code, message.name)
      : message.command === "popupRemoteStatus" ? async () => ({
        mode: remoteMode, connected: !!remote?.connected, transport: remote?.state || "offline",
        pending: !!remotePending, error: remoteError,
      }) : () => remoteDisconnect();
    void action().then(value => respond({ ok: true, ...value }), error => respond({ ok: false, error: error.message }));
    return true;
  }
  if (message.command === "job" && sender.tab && providerFor(sender.tab.url) === message.provider
    && typeof message.id === "string") {
    const record = active.get(message.id);
    if (!record || record.tabId !== sender.tab.id || record.provider !== message.provider || sender.frameId !== 0
      || message.documentToken !== record.documentToken
      || !["submitting", "running", "completed", "failed", "cancelled", "unknown"].includes(message.state)) return false;
    if (message.state === "completed" && sender.tab.url !== record.expectedUrl) return false;
    if (["completed", "failed", "cancelled"].includes(message.state)) {
      active.delete(message.id);
      void persistActive().catch(error => { remoteError = error.message || "Không lưu được trạng thái tác vụ"; });
    }
    try { send({ type: "job", id: message.id, tabId: sender.tab.id, provider: message.provider, state: message.state,
      result: message.result, error: message.error, documentToken: record.documentToken }); } catch {}
    respond({ ok: true });
  }
  return false;
});
chrome.tabs.onRemoved.addListener(tabId => {
  for (const [id, item] of active) {
    if (item.tabId !== tabId) continue;
    active.delete(id);
    void persistActive().catch(error => { remoteError = error.message || "Không lưu được trạng thái tác vụ"; });
    try { send({ type: "job", id, tabId, provider: item.provider, state: "unknown", documentToken: item.documentToken, error: "Tab đã đóng; tác vụ bên website có thể chưa dừng, không tự gửi lại" }); } catch {}
  }
});
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status !== "loading" && !change.url) return;
  for (const [id, item] of active) {
    if (item.tabId !== tabId) continue;
    active.delete(id);
    void persistActive().catch(error => { remoteError = error.message || "Không lưu được trạng thái tác vụ"; });
    try { send({ type: "job", id, tabId, provider: item.provider, state: "unknown", documentToken: item.documentToken, error: "Tab tải lại hoặc chuyển trang; hãy kiểm tra kết quả trên website, không gửi lại tự động" }); } catch {}
  }
});
