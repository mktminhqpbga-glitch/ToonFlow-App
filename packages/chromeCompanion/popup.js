"use strict";
const status = document.getElementById("status");
async function request(command, code) {
  try {
    const value = await chrome.runtime.sendMessage({ command, ...(code ? { code } : {}) });
    status.textContent = value?.ok ? (value.connected ? "Đã ghép nối ToonFlow." : "Chưa ghép nối ToonFlow.") : value?.error || "Không kết nối được.";
  } catch (error) { status.textContent = error.message || "Không kết nối được."; }
}
document.getElementById("connect").addEventListener("click", () => {
  const field = document.getElementById("code");
  const code = field.value.trim();
  field.value = "";
  if (code) void request("popupConnect", code);
});
document.getElementById("disconnect").addEventListener("click", () => void request("popupDisconnect"));
void request("popupStatus");

const remoteStatus = document.getElementById("remoteStatus");
async function remoteRequest(command, code, name) {
  try {
    const response = await chrome.runtime.sendMessage({ command, code, name });
    remoteStatus.textContent = response?.ok ? (response.pending ? "Đang chờ chấp thuận ghép nối trong ToonFlow."
      : response.connected ? "Đã kết nối từ xa qua " + response.transport : response.error || "Kết nối từ xa đang ngoại tuyến.")
      : response?.error || "Lỗi kết nối từ xa";
  } catch (error) { remoteStatus.textContent = error.message || "Yêu cầu kết nối từ xa thất bại"; }
}
document.getElementById("remoteConnect").addEventListener("click", async () => {
  const code = document.getElementById("remoteCode").value.trim();
  const name = document.getElementById("remoteName").value.trim();
  let parsed;
  try {
    parsed = new URL(code);
    const relay = new URL(parsed.searchParams.get("relay"));
    if (relay.protocol !== "https:" || !["", "/"].includes(relay.pathname) || relay.username || relay.password
      || relay.search || relay.hash || relay.port) throw Error();
    // Optional host access is requested ONLY for the exact, user-chosen HTTPS Render origin.
    const granted = await chrome.permissions.request({ origins: [relay.origin + "/*"] });
    if (!granted) { remoteStatus.textContent = "Quyền truy cập Render Relay bị từ chối."; return; }
  } catch { remoteStatus.textContent = "Mã ghép nối Render không hợp lệ."; return; }
  document.getElementById("remoteCode").value = "";
  void remoteRequest("popupRemotePair", code, name);
});
document.getElementById("remoteDisconnect").addEventListener("click", () => void remoteRequest("popupRemoteDisconnect"));
void remoteRequest("popupRemoteStatus");
