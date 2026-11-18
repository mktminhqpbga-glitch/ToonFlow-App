const element = id => document.getElementById(id);
let busy = false, state, reading = false;

async function request(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response || response.error) throw new Error(response?.error || "Extension chưa sẵn sàng.");
  return response;
}

function showError(message = "") {
  element("error").textContent = message;
  element("error").hidden = !message;
}

function updateButton() {
  const connected = !!state?.connected, paired = !!state?.paired;
  const code = element("code").value.trim();
  element("code").disabled = busy || connected;
  element("pairForm").hidden = connected;
  element("connect").disabled = busy || !!state?.connecting;
  element("connect").textContent = busy || state?.connecting ? "Đang kết nối…"
    : paired && !code ? "Kết nối lại" : "Kết nối";
  element("open").disabled = busy || !paired;
  if (!paired && !code) element("connect").disabled = true;
}

async function refresh() {
  if (reading) return;
  reading = true;
  try {
    state = await request({ type: "status" });
    element("status").textContent = state.connected
      ? "Đã kết nối với MacFlow."
      : state.status || (state.paired ? "Đã ghép nối, đang kết nối lại…" : "Chưa kết nối.");
    if (state.chromeTask) element("status").textContent += " Có tác vụ đang chờ kiểm tra trong MacFlow.";
    const tabs = Array.isArray(state.targets) ? state.targets : [];
    const count = tabs.length;
    element("detected").hidden = !state.connected;
    element("detected").textContent = count
      ? `Đã tự nhận diện ${count} tab AI. Chọn dịch vụ và tab trực tiếp trong node MacFlow.`
      : "Đã kết nối; đang tự tìm các tab Muse, ChatGPT và Gemini.";
    updateButton();
  } finally { reading = false; }
}

async function connect() {
  if (busy || state?.connecting) return;
  const code = element("code").value.trim();
  if (!code && !state?.paired) { showError("Hãy nhập mã ghép nối từ MacFlow."); return; }
  busy = true; showError(); updateButton();
  try {
    await request(code ? { type: "pair", code } : { type: "reconnect" });
    element("code").value = "";
    await refresh();
  } catch (error) {
    showError(error.message || "Không kết nối được MacFlow.");
  } finally { busy = false; updateButton(); }
}

element("pairForm").addEventListener("submit", event => {
  event.preventDefault();
  void connect();
});
element("code").addEventListener("input", () => { showError(); updateButton(); });
element("open").addEventListener("click", async () => {
  showError();
  try { await request({ type: "open" }); }
  catch (error) { showError(error.message || "Không mở được MacFlow."); }
});

const timer = setInterval(() => void refresh().catch(error => showError(error.message)), 5000);
window.addEventListener("pagehide", () => clearInterval(timer));
void refresh().catch(error => showError(error.message));
