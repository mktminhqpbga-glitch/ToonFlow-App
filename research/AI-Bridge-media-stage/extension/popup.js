const serverUrl = document.querySelector("#serverUrl");
const token = document.querySelector("#token");
const defaultProvider = document.querySelector("#defaultProvider");
const status = document.querySelector("#status");
const dot = document.querySelector("#dot");
const error = document.querySelector("#error");
const providers = document.querySelector("#providers");
const pause = document.querySelector("#pause");
const scan = document.querySelector("#scan");
const scanStatus = document.querySelector("#scanStatus");

document.querySelector("#save").addEventListener("click", save);
document.querySelector("#reconnect").addEventListener("click", async () => {
  error.hidden = true;
  await chrome.runtime.sendMessage({ type: "bridge:reconnect" });
  await loadState();
});
scan.addEventListener("click", async () => {
  scan.disabled = true;
  scanStatus.textContent = "Đang tự nhận diện các tab AI đã mở…";
  try {
    const result = await chrome.runtime.sendMessage({ type: "bridge:rescan-tabs" });
    if (!result?.ok) throw new Error(result?.error || "Không quét được tab AI.");
    await loadState();
  } catch (cause) {
    scanStatus.textContent = cause?.message || "Không quét được tab AI.";
  } finally { scan.disabled = false; }
});
pause.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "bridge:toggle-pause" });
  setTimeout(loadState, 75);
});

load();
// The extension service worker connects asynchronously. A one-off snapshot
// stays at "Connecting…" forever even after a successful connection.
setInterval(() => { void loadState(); }, 1500);

async function load() {
  const state = await chrome.runtime.sendMessage({ type: "bridge:get-state" });
  serverUrl.value = state.settings.serverUrl;
  token.value = state.settings.token;
  for (const [id, provider] of Object.entries(state.providers)) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = provider.label;
    defaultProvider.append(option);
    const button = document.createElement("button");
    button.textContent = provider.label;
    button.addEventListener("click", () => chrome.runtime.sendMessage({ type: "bridge:open-provider", provider: id }));
    providers.append(button);
  }
  const auto = document.createElement("option");
  auto.value = "auto";
  auto.textContent = "Auto (active supported tab)";
  defaultProvider.prepend(auto);
  defaultProvider.value = state.settings.defaultProvider;
  renderState(state);
}

async function loadState() {
  try {
    renderState(await chrome.runtime.sendMessage({ type: "bridge:get-state" }));
  } catch (cause) {
    status.textContent = "Không đọc được trạng thái extension";
    dot.className = "dot pending";
    error.textContent = String(cause?.message || cause);
    error.hidden = false;
  }
}

async function save() {
  error.hidden = true;
  try {
    const url = new URL(serverUrl.value.trim());
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Use an http:// or https:// local server URL.");
    // Save & connect is an explicit request to resume; don't leave the
    // extension paused behind a misleading "Connecting…" message.
    await chrome.storage.local.set({ serverUrl: url.toString().replace(/\/$/, ""), token: token.value.trim(), defaultProvider: defaultProvider.value, paused: false });
    await chrome.runtime.sendMessage({ type: "bridge:reconnect" });
    status.textContent = "Connecting…";
    dot.className = "dot pending";
    setTimeout(loadState, 350);
  } catch (cause) {
    error.textContent = cause.message;
    error.hidden = false;
  }
}

function renderState(state) {
  const connected = state.socketState === "connected";
  const paused = state.socketState === "paused" || state.settings.paused;
  status.textContent = connected ? "Connected to local bridge (always on)" : paused ? "Bridge paused — press Continue" : state.socketState === "needs-token" ? "Bridge token required" : state.socketState === "connecting" ? "Connecting…" : "Local bridge disconnected";
  pause.textContent = paused ? "Continue" : "Pause";
  scan.disabled = !connected || paused;
  const summary = state.recognitionStatus;
  if (summary?.state === "scanning") scanStatus.textContent = "Đang tự nhận diện các tab AI đã mở…";
  else if (summary?.state === "complete") scanStatus.textContent = `Đã nhận diện ${summary.recognized}/${summary.scanned} tab AI (tự nạp adapter: ${summary.injected}, không thể nhận diện: ${summary.failed}).`;
  else if (summary?.state === "error") scanStatus.textContent = "Có lỗi khi quét tab AI. Hãy kiểm tra trạng thái kết nối.";
  else if (!connected) scanStatus.textContent = "Sẽ tự nhận diện các tab AI đang mở ngay sau khi kết nối thành công.";
  dot.className = `dot ${connected ? "connected" : paused || state.socketState === "connecting" || state.socketState === "needs-token" ? "pending" : ""}`;
  if (state.lastError) {
    error.textContent = state.lastError;
    error.hidden = false;
  } else {
    error.hidden = true;
  }
}
