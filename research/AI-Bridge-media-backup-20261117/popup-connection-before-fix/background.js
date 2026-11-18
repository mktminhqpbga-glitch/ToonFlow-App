const PROVIDERS = {
  grok: { label: "Grok", home: "https://grok.com/", matches: ["https://grok.com/*"] },
  gemini: { label: "Gemini", home: "https://gemini.google.com/app", matches: ["https://gemini.google.com/*"] },
  deepseek: { label: "DeepSeek", home: "https://chat.deepseek.com/", matches: ["https://chat.deepseek.com/*"] },
  perplexity: { label: "Perplexity", home: "https://www.perplexity.ai/", matches: ["https://www.perplexity.ai/*"] },
  qwen: { label: "Qwen", home: "https://chat.qwen.ai/", matches: ["https://chat.qwen.ai/*", "https://chat.qwenlm.ai/*"] },
  chatgpt: { label: "ChatGPT", home: "https://chatgpt.com/", matches: ["https://chatgpt.com/*"] },
  claude: { label: "Claude", home: "https://claude.ai/", matches: ["https://claude.ai/*"] },
  zai: { label: "Z.ai", home: "https://chat.z.ai/", matches: ["https://chat.z.ai/*"] },
  kimi: { label: "Kimi", home: "https://www.kimi.com/", matches: ["https://www.kimi.com/*"] },
  muse: { label: "Muse", home: "https://muse.ai/", matches: ["https://muse.ai/*", "https://www.muse.ai/*"] },
};

const DEFAULT_SETTINGS = {
  serverUrl: "http://127.0.0.1:4317",
  token: "",
  defaultProvider: "auto",
  paused: false,
};

const HEARTBEAT_INTERVAL_MS = 20_000;
let socket = null;
let reconnectTimer = null;
let heartbeatTimer = null;
let socketState = "disconnected";
let lastError = "";
let closingForPause = false;
let profileInstanceId = "";
let reportTimer = null;
let reporting = false;
let mustReportAgain = false;
const requestTabs = new Map();
const mediaAcks = new Map();
function clearMediaAcks(reason) {
  for (const ack of mediaAcks.values()) { clearTimeout(ack.timer); ack.respond({ ok: false, error: reason }); }
  mediaAcks.clear();
  requestTabs.clear();
}
const supportedPatterns = Object.values(PROVIDERS).flatMap(item => item.matches);
function safeProviderForUrl(address) {
  try {
    const url = new URL(address);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return providerForUrl(url.href);
  } catch { return null; }
}
async function ensureProfileId() {
  if (profileInstanceId) return profileInstanceId;
  const saved = await chrome.storage.local.get(["bridgeProfileInstanceId"]);
  const candidate = saved.bridgeProfileInstanceId;
  if (typeof candidate === "string" && /^[a-f0-9-]{36}$/i.test(candidate)) profileInstanceId = candidate;
  else {
    profileInstanceId = crypto.randomUUID();
    await chrome.storage.local.set({ bridgeProfileInstanceId: profileInstanceId });
  }
  return profileInstanceId;
}
function scheduleInventory() {
  if (reportTimer) clearTimeout(reportTimer);
  reportTimer = setTimeout(() => { reportTimer = null; void reportInventory(); }, 250);
}
async function reportInventory() {
  if (reporting) { mustReportAgain = true; return; }
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  reporting = true;
  const current = socket;
  try {
    const id = await ensureProfileId();
    const tabs = (await chrome.tabs.query({ url: supportedPatterns })).slice(0, 80);
    const entries = [];
    for (const tab of tabs) {
      if (socket !== current || current.readyState !== WebSocket.OPEN) return;
      const provider = safeProviderForUrl(tab.url);
      if (!provider || !Number.isSafeInteger(tab.id) || !tab.url || tab.url.length > 2000) continue;
      try {
        const probe = await chrome.tabs.sendMessage(tab.id, { type: "bridge:probe" });
        if (!probe || probe.url !== tab.url || probe.provider !== provider || !/^[a-f0-9-]{36}$/i.test(probe.documentToken)) continue;
        entries.push({ profileInstanceId: id, tabId: tab.id, provider, title: (tab.title || "").slice(0, 160),
          url: tab.url, documentToken: probe.documentToken, ready: probe.ready === true, busy: probe.busy === true });
      } catch { /* Tab is not ready or its content script predates the current extension version. */ }
      if (entries.length >= 40) break;
    }
    if (socket === current && current.readyState === WebSocket.OPEN) sendToServer({ type: "bridge:tabs", profileInstanceId: id, tabs: entries });
  } catch { /* Keep the last known status only until the backend expires the snapshot. */ }
  finally {
    reporting = false;
    if (mustReportAgain) { mustReportAgain = false; scheduleInventory(); }
  }
}
for (const event of [chrome.tabs.onCreated, chrome.tabs.onRemoved, chrome.tabs.onUpdated,
  chrome.tabs.onMoved, chrome.tabs.onAttached, chrome.tabs.onDetached]) {
  event?.addListener(scheduleInventory);
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(DEFAULT_SETTINGS);
  await chrome.storage.local.set(existing);
  connect();
});

chrome.runtime.onStartup.addListener(connect);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.paused) {
    if (changes.paused.newValue) pauseBridge();
    else connect(true);
    return;
  }
  if (changes.serverUrl || changes.token) connect(true);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "bridge:get-state") {
    getState().then(sendResponse);
    return true;
  }
  if (message?.type === "bridge:open-provider") {
    openProvider(message.provider).then(() => sendResponse({ ok: true })).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "bridge:reconnect") {
    connect(true);
    sendResponse({ ok: true });
    return;
  }
  if (message?.type === "bridge:toggle-pause") {
    chrome.storage.local.get(DEFAULT_SETTINGS).then(async (settings) => {
      await chrome.storage.local.set({ paused: !settings.paused });
      sendResponse({ ok: true, paused: !settings.paused });
    });
    return true;
  }
  if (message?.type === "bridge:site-message") {
    const item = message.message;
    const assignment = typeof item?.id === "string" ? requestTabs.get(item.id) : null;
    const provider = safeProviderForUrl(sender.tab?.url);
    if (!item || !assignment || sender.frameId !== 0 || sender.id !== chrome.runtime.id
      || assignment.tabId !== sender.tab?.id || assignment.url !== sender.tab?.url
      || assignment.provider !== provider || (assignment.documentToken && assignment.documentToken !== item.documentToken)
      || !socket || socket.readyState !== WebSocket.OPEN) {
      sendResponse({ ok: false, error: "Media or result came from an unassigned or changed AI tab." });
      return;
    }
    if (item.type?.startsWith("bridge:media:")) {
      const key = `${item.id}|${item.transferId}|${item.type}|${item.sequence ?? -1}`;
      if (mediaAcks.has(key) || typeof item.transferId !== "string") {
        sendResponse({ ok: false, error: "Duplicate or invalid media transfer." }); return;
      }
      const timer = setTimeout(() => {
        const ack = mediaAcks.get(key);
        if (ack) { mediaAcks.delete(key); ack.respond({ ok: false, error: "Media acknowledgement timed out; do not resend this prompt." }); }
      }, 15000);
      mediaAcks.set(key, { respond: sendResponse, timer });
      sendToServer({ ...item, provider, tabId: sender.tab.id, url: sender.tab.url });
      return true;
    }
    sendToServer({ ...item, provider, tabId: sender.tab.id, url: sender.tab.url });
    if (item.type === "bridge:complete" || item.type === "bridge:error") requestTabs.delete(item.id);
    sendResponse({ ok: true });
  }
});

connect();

async function connect(force = false) {
  clearTimeout(reconnectTimer);
  closingForPause = false;
  if (socket && !force && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  if (socket) {
    clearMediaAcks("Bridge connection restarted; verify the AI tab before retrying.");
    stopHeartbeat();
    socket.onclose = null;
    socket.close();
    socket = null;
  }
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  if (settings.paused) {
    socketState = "paused";
    lastError = "";
    updateBadge();
    return;
  }
  if (!settings.token.trim()) {
    socketState = "needs-token";
    lastError = "Paste the bridge token from the local server.";
    updateBadge();
    return;
  }
  const endpoint = toWebSocketUrl(settings.serverUrl, settings.token);
  socketState = "connecting";
  lastError = "";
  updateBadge();
  try {
    socket = new WebSocket(endpoint);
  } catch (error) {
    scheduleReconnect(error.message);
    return;
  }
  socket.onopen = async () => {
    socketState = "connected";
    lastError = "";
    try {
      const instance = await ensureProfileId();
      if (socket?.readyState !== WebSocket.OPEN) return;
      sendToServer({ type: "bridge:hello", version: chrome.runtime.getManifest().version,
        providers: Object.keys(PROVIDERS), profileInstanceId: instance });
      startHeartbeat();
      updateBadge();
      scheduleInventory();
    } catch (cause) { scheduleReconnect(cause instanceof Error ? cause.message : "Could not establish browser profile identity."); }
  };
  socket.onmessage = (event) => {
    try {
      handleServerMessage(JSON.parse(event.data));
    } catch {
      lastError = "The local bridge sent invalid data.";
    }
  };
  socket.onerror = () => {
    lastError = "Could not reach the local bridge.";
  };
  socket.onclose = () => {
    clearMediaAcks("AI-Bridge connection lost; do not automatically resend.");
    stopHeartbeat();
    socket = null;
    if (closingForPause) return;
    socketState = "disconnected";
    updateBadge();
    scheduleReconnect(lastError || "Local bridge disconnected.");
  };
}

function scheduleReconnect(error) {
  lastError = error;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(async () => {
    const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
    if (!settings.paused) connect(true);
  }, 3000);
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (socket?.readyState !== WebSocket.OPEN) return stopHeartbeat();
    sendToServer({ type: "bridge:ping", at: Date.now() });
    void reportInventory();
  }, 5000);
}

function stopHeartbeat() {
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function pauseBridge() {
  clearMediaAcks("AI-Bridge paused.");
  closingForPause = true;
  clearTimeout(reconnectTimer);
  stopHeartbeat();
  socketState = "paused";
  lastError = "";
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
  updateBadge();
}

async function handleServerMessage(message) {
  if (message?.type === "bridge:media:ack") {
    const key = `${message.id}|${message.transferId}|${message.stage}|${message.sequence ?? -1}`;
    const pending = mediaAcks.get(key);
    if (pending) { clearTimeout(pending.timer); mediaAcks.delete(key); pending.respond({ ok: message.ok === true, error: message.error }); }
    return;
  }
  if (message?.type !== "bridge:run" || typeof message.id !== "string") return;
  // A MacFlow-selected target is matched by immutable profile/tab/document identity.
  // Reordering a tab is fine; F5, navigation and a closed tab invalidate dispatch.
  if (message.target) {
    const target = message.target;
    if (target.profileInstanceId !== await ensureProfileId() || !Number.isSafeInteger(target.tabId)
      || typeof target.url !== "string" || typeof target.documentToken !== "string"
      || safeProviderForUrl(target.url) !== message.provider) {
      sendToServer({ type: "bridge:error", id: message.id, message: "Wrong Profile or AI provider; MacFlow must select the destination again." });
      return;
    }
    try {
      const tab = await chrome.tabs.get(target.tabId);
      if (!tab || tab.url !== target.url || safeProviderForUrl(tab.url) !== message.provider)
        throw new Error("Tab URL changed.");
      const probe = await chrome.tabs.sendMessage(target.tabId, { type: "bridge:probe" });
      if (!probe || probe.documentToken !== target.documentToken || probe.url !== target.url
        || probe.provider !== message.provider || !probe.ready || probe.busy)
        throw new Error("Tab document is no longer ready.");
      requestTabs.set(message.id, { tabId: target.tabId, url: target.url, provider: message.provider,
        documentToken: target.documentToken });
      const ack = await chrome.tabs.sendMessage(target.tabId, { type: "bridge:run", id: message.id,
        prompt: message.prompt, mediaKind: message.mediaKind ?? "none", documentToken: target.documentToken, expectedUrl: target.url });
      if (!ack?.ok) throw new Error("The selected AI tab refused the request.");
    } catch (error) {
      requestTabs.delete(message.id);
      sendToServer({ type: "bridge:error", id: message.id, message: `Pinned tab is not ready: ${error instanceof Error ? error.message : "unknown"}. Do not automatically retry.` });
    } finally { scheduleInventory(); }
    return;
  }
  const tab = await findTargetTab(message.provider);
  if (!tab?.id) {
    sendToServer({
      type: "bridge:error",
      id: message.id,
      message: message.provider
        ? `Open a logged-in ${PROVIDERS[message.provider]?.label ?? message.provider} tab, then retry.`
        : "Open a logged-in supported AI chat tab, then retry.",
    });
    return;
  }
  try {
    requestTabs.set(message.id, { tabId: tab.id, url: tab.url, provider: safeProviderForUrl(tab.url), documentToken: null });
    const reply = await chrome.tabs.sendMessage(tab.id, { type: "bridge:run", id: message.id,
      prompt: message.prompt, mediaKind: message.mediaKind ?? "none" });
    if (!reply?.ok) throw new Error("The target tab rejected the request.");
  } catch {
    requestTabs.delete(message.id);
    sendToServer({ type: "bridge:error", id: message.id, message: "The AI Bridge content script is not ready in the selected tab. Reload that tab and retry." });
  }
}

async function findTargetTab(requestedProvider) {
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  const provider = requestedProvider || (settings.defaultProvider === "auto" ? null : settings.defaultProvider);
  const patterns = provider ? PROVIDERS[provider]?.matches : Object.values(PROVIDERS).flatMap((item) => item.matches);
  if (!patterns?.length) return null;
  const tabs = await chrome.tabs.query({ url: patterns });
  return tabs.sort((left, right) => Number(Boolean(right.active)) - Number(Boolean(left.active)) || Number(Boolean(right.highlighted)) - Number(Boolean(left.highlighted)))[0] ?? null;
}

function sendToServer(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function toWebSocketUrl(serverUrl, token) {
  const url = new URL(serverUrl.trim());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/bridge";
  url.search = "";
  url.searchParams.set("token", token.trim());
  return url.toString();
}

async function openProvider(provider) {
  const item = PROVIDERS[provider];
  if (!item) throw new Error("Unknown provider.");
  const existing = await chrome.tabs.query({ url: item.matches });
  if (existing[0]?.id) {
    await chrome.tabs.update(existing[0].id, { active: true });
    await chrome.windows.update(existing[0].windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url: item.home, active: true });
}

function providerForUrl(url) {
  if (!url) return null;
  return Object.entries(PROVIDERS).find(([, item]) => item.matches.some((pattern) => url.startsWith(pattern.replace("*", ""))))?.[0] ?? null;
}

async function getState() {
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return { settings, socketState, lastError, providers: PROVIDERS };
}

function updateBadge() {
  const text = socketState === "connected" ? "ON" : socketState === "paused" ? "II" : socketState === "needs-token" ? "!" : "×";
  const color = socketState === "connected" ? "#16794a" : socketState === "paused" || socketState === "needs-token" ? "#b7791f" : "#a73737";
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}
