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
