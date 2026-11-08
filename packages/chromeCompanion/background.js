/* Original implementation for ToonFlow, not copied from the GPL workflow repository. */
"use strict";
let socket = null;
let state = "disconnected";
const active = new Map();
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
  if (socket?.readyState !== WebSocket.OPEN) throw Error("Chưa ghép nối ToonFlow");
  socket.send(JSON.stringify(data));
}
async function connect(code) {
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
function snapshot(tab) { return { id: tab.id, title: tab.title || "", url: tab.url, provider: providerFor(tab.url) }; }
async function getTab(id, provider) {
  if (!Number.isInteger(id) || id < 0) throw Error("ID tab không hợp lệ");
  const tab = await chrome.tabs.get(id);
  if (providerFor(tab.url) !== provider) throw Error("Tab đã chuyển khỏi dịch vụ được chọn");
  return tab;
}
async function dispatch(operation, payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw Error("Gói dữ liệu không hợp lệ");
  if (operation === "tabs") {
    return (await chrome.tabs.query({})).filter(tab => providerFor(tab.url)).map(snapshot);
  }
  if (!["probe", "run", "cancel"].includes(operation)) throw Error("Lệnh Chrome không được phép");
  const id = operation === "cancel" ? active.get(payload.id) : undefined;
  const tabId = operation === "cancel" ? id?.tabId : payload.tabId;
  const provider = operation === "cancel" ? id?.provider : payload.provider;
  if (!provider || !serviceHosts[provider]) throw Error("Dịch vụ AI không hợp lệ");
  await getTab(tabId, provider);
  if (operation === "probe") return chrome.tabs.sendMessage(tabId, { command: "probe", provider });
  if (operation === "cancel") {
    if (id) active.delete(payload.id);
    return chrome.tabs.sendMessage(tabId, { command: "cancel", id: payload.id });
  }
  if (!/^[0-9a-f-]{36}$/i.test(payload.id || "") || typeof payload.prompt !== "string" || payload.prompt.length > 100000
    || !["text", "image", "video"].includes(payload.kind) || !Array.isArray(payload.images) || payload.images.length > 4)
    throw Error("Nội dung yêu cầu không hợp lệ");
  if ([...active.values()].some(item => item.tabId === tabId)) throw Error("Tab đang chạy tác vụ khác");
  active.set(payload.id, { tabId, provider });
  try {
    const reply = await chrome.tabs.sendMessage(tabId, {
      command: "run", id: payload.id, kind: payload.kind, provider, prompt: payload.prompt,
      images: payload.images, options: payload.options || {},
    });
    if (!reply?.accepted) { active.delete(payload.id); throw Error(reply?.error || "Tab không nhận được yêu cầu"); }
    return { accepted: true };
  } catch (error) { active.delete(payload.id); throw error; }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !message || typeof message !== "object") return false;
  if (["popupStatus", "popupConnect", "popupDisconnect"].includes(message.command)) {
    // Only the extension's own popup can pair; no AI webpage can request a pairing.
    if (sender.tab || !sender.url?.startsWith(chrome.runtime.getURL("popup.html"))) return false;
    const action = message.command === "popupStatus" ? async () => ({ connected: state === "connected", state })
      : message.command === "popupConnect" ? () => connect(message.code) : async () => disconnect();
    void action().then(value => respond({ ok: true, ...value }), error => respond({ ok: false, error: error.message }));
    return true;
  }
  if (message.command === "job" && sender.tab && providerFor(sender.tab.url) === message.provider
    && typeof message.id === "string") {
    const record = active.get(message.id);
    if (!record || record.tabId !== sender.tab.id || record.provider !== message.provider) return false;
    if (["completed", "failed", "cancelled"].includes(message.state)) active.delete(message.id);
    try { send({ type: "job", id: message.id, tabId: sender.tab.id, provider: message.provider, state: message.state,
      result: message.result, error: message.error }); } catch {}
    respond({ ok: true });
  }
  return false;
});
chrome.tabs.onRemoved.addListener(tabId => {
  for (const [id, item] of active) {
    if (item.tabId !== tabId) continue;
    active.delete(id);
    try { send({ type: "job", id, tabId, provider: item.provider, state: "failed", error: "Tab đã đóng; tác vụ bên website có thể chưa dừng" }); } catch {}
  }
});
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status !== "loading" && !change.url) return;
  for (const [id, item] of active) {
    if (item.tabId !== tabId) continue;
    active.delete(id);
    try { send({ type: "job", id, tabId, provider: item.provider, state: "failed", error: "Tab tải lại hoặc chuyển trang; hãy kiểm tra kết quả trên website, không gửi lại tự động" }); } catch {}
  }
});
