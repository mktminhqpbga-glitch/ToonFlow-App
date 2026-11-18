import { maxSize, chunkSize } from "./mediaTransfer.js";

export function clearDownload(job) {
  const file = job.download; job.download = undefined;
  if (!file) return;
  clearTimeout(file.timer); file.controller.abort();
  void file.reader?.cancel().catch(() => {});
}
function encode(bytes) { let text = ""; for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(text); }
function problem(code, message) { throw Object.assign(new Error(message), { code }); }
export async function downloadMessage(job, message) {
  if (job.cancelled || !job.running || job.stage !== "waitingResult") problem("MUSE_DOWNLOAD_FAILED", "Tác vụ không ở chặng tải kết quả.");
  if (message.type === "museDownloadCancel") { if (job.download?.id === message.transferId) clearDownload(job); return {}; }
  if (message.type === "museDownloadStart") {
    if (job.download) problem("MUSE_DOWNLOAD_FAILED", "Đang tải một tệp kết quả khác.");
    const url = new URL(message.url);
    if (url.protocol !== "https:" || url.username || url.password || url.hash || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || /^[\d.]+$/.test(url.hostname)) problem("MUSE_DOWNLOAD_FAILED", "URL kết quả không phải HTTPS công khai.");
    if (!await chrome.permissions.contains({ origins: [`https://${url.hostname}/*`] })) problem("MUSE_DOWNLOAD_PERMISSION", "Extension chưa có quyền CDN này. Cấu hình MACFLOW_CHROME_MEDIA_HOSTS trên MacFlow rồi tải lại ZIP extension.");
    if (job.cancelled) throw new Error("Tác vụ đã dừng.");
    const file = { id: crypto.randomUUID(), controller: new AbortController(), sequence: 0, received: 0, pending: new Uint8Array(), offset: 0, busy: false };
    job.download = file;
    file.timer = setTimeout(() => clearDownload(job), 120000);
    try {
      const response = await fetch(url.href, { credentials: "include", redirect: "error", signal: file.controller.signal });
      if (job.cancelled || job.download !== file) throw new Error("Tác vụ đã dừng.");
      if (!response.ok || Number(response.headers.get("content-length")) > maxSize) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}, hoặc tệp vượt 64 MB.`); }
      file.reader = response.body?.getReader();
      if (!file.reader) throw new Error("Tệp trả về trống.");
      return { transferId: file.id, mimeType: response.headers.get("content-type") || "" };
    } catch (cause) { clearDownload(job); problem("MUSE_DOWNLOAD_FAILED", `Không tải được tệp qua extension: ${cause.message || cause}`); }
  }
  const file = job.download;
  if (!file || file.id !== message.transferId || file.busy || file.sequence !== message.sequence) problem("MUSE_DOWNLOAD_FAILED", "Khối tải không khớp tệp hoặc thứ tự.");
  file.busy = true;
  try {
    if (file.offset >= file.pending.length) {
      let { done, value } = await file.reader.read();
      while (!done && !value.length) ({ done, value } = await file.reader.read());
      if (job.cancelled || job.download !== file) throw new Error("Tác vụ đã dừng.");
      if (done) { clearDownload(job); return { done: true, sequence: file.sequence, size: file.received }; }
      file.received += value.length;
      if (file.received > maxSize) problem("MUSE_RESULT_TOO_LARGE", "Tệp trả về vượt 64 MB.");
      file.pending = value; file.offset = 0;
    }
    const bytes = file.pending.subarray(file.offset, file.offset + chunkSize); file.offset += bytes.length;
    return { done: false, sequence: file.sequence++, data: encode(bytes) };
  } catch (cause) { clearDownload(job); throw cause; }
  finally { file.busy = false; }
}
