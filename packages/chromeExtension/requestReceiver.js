import { digest, maxSize } from "./mediaTransfer.js";

export const protocolVersion = 7;
export const kinds = ["text", "image", "video", "audio"];
export const modelProviders = Object.freeze({
  museChrome: "muse", chatgptChrome: "chatgpt", geminiChrome: "gemini",
  claudeChrome: "claude", grokChrome: "grok", perplexityChrome: "perplexity",
});
export const mimeTypes = ["text/plain", "image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm", "audio/mpeg", "audio/wav", "audio/ogg", "audio/flac", "audio/mp4", "audio/webm"];
export const isUuid = value => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const isHash = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);

// Derive capabilities only from the adapter's live probe, not popup toggles
// or saved per-tab settings. Unrecognized kinds fail closed. Legacy Muse
// content scripts that cannot report their media support remain text-only.
export function probedOutputKinds(provider, probe) {
  // Only Muse has a verified-in-source binary media adapter. ChatGPT/Gemini
  // currently have TEXT transport and must not gain media from a DOM claim.
  if (provider !== "muse" || probe?.capable !== true) return ["text"];
  const offered = Array.isArray(probe?.outputKinds) ? probe.outputKinds : ["text"];
  const unique = [...new Set(offered)];
  return unique.length && unique.length <= kinds.length && unique.every(kind => kinds.includes(kind))
    ? unique : ["text"];
}

export async function receiveRequest(payload, requestId, requestHash, targetProvider) {
  if (!isRecord(payload) || payload.version !== 1 || payload.type !== "chromeRequest" || payload.providerId !== "aiChrome"
    || !Object.hasOwn(modelProviders, payload.modelId) || modelProviders[payload.modelId] !== targetProvider
    || !isUuid(requestId) || payload.requestId !== requestId || !isHash(requestHash) || !kinds.includes(payload.kind)) throw new Error("Phiên bản hoặc ID gói Chrome không hợp lệ.");
  if (typeof payload.prompt !== "string" || !payload.prompt.trim() || payload.prompt.length > 104000
    || typeof payload.originalPrompt !== "string" || !payload.originalPrompt.trim() || payload.originalPrompt.length > 104000 || !isRecord(payload.specification)) throw new Error("Prompt hoặc đặc tả trong gói Chrome không hợp lệ.");
  const markers = { requestBegin: `[REQUEST_BEGIN:${requestId}]`, requestEnd: `[REQUEST_END:${requestId}]`, responseBegin: `[RESPONSE_BEGIN:${requestId}]`, responseEnd: `[RESPONSE_END:${requestId}]` };
  if (!isRecord(payload.markers) || Object.entries(markers).some(([key, value]) => payload.markers[key] !== value || !payload.prompt.includes(value))
    || !payload.prompt.startsWith(markers.requestBegin)) throw new Error("Dấu nhận diện prompt không khớp ID tác vụ.");
  if (!Array.isArray(payload.attachments) || payload.attachments.length > 8) throw new Error("Danh sách tham chiếu trong gói Chrome không hợp lệ.");
  let total = 0;
  for (const [index, file] of payload.attachments.entries()) {
    if (!isRecord(file) || file.index !== index || file.id !== `${requestId}:${index + 1}` || typeof file.label !== "string" || !file.label.length || file.label.length > 256 || /[\u0000-\u001f\u007f]/.test(file.label)
      || typeof file.name !== "string" || !/^[a-zA-Z0-9._-]{1,160}$/.test(file.name) || !mimeTypes.includes(file.mimeType) || file.mimeType === "text/plain"
      || !Number.isInteger(file.size) || file.size <= 0 || file.size > maxSize || !isHash(file.sha256)) throw new Error("Metadata tệp tham chiếu không hợp lệ.");
    total += file.size;
  }
  if (new Set(payload.attachments.map(file => file.name)).size !== payload.attachments.length) throw new Error("Tên tệp trong manifest bị trùng.");
  if (total > maxSize || !Number.isInteger(payload.totalReferenceBytes) || payload.totalReferenceBytes !== total) throw new Error("Tổng dung lượng tham chiếu không khớp manifest hoặc vượt 64 MB.");
  const response = payload.response;
  if (!isRecord(response) || response.kind !== payload.kind || response.markersRequired !== (payload.kind === "text")
    || response.maxBytes !== (payload.kind === "text" ? 1024 * 1024 : maxSize) || !Array.isArray(response.mimeTypes) || !response.mimeTypes.length
    || response.mimeTypes.length > mimeTypes.length || new Set(response.mimeTypes).size !== response.mimeTypes.length
    || response.mimeTypes.some(mime => !mimeTypes.includes(mime) || !(payload.kind === "text" ? mime === "text/plain" : mime.startsWith(`${payload.kind}/`)))) throw new Error("Đặc tả đầu ra không khớp yêu cầu Chrome.");
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  if (encoded.length > 2 * 1024 * 1024 || await digest(encoded) !== requestHash) throw new Error("Checksum gói yêu cầu không khớp hoặc metadata vượt 2 MB.");
  return payload;
}

export function matchReference(message, payload, index, usedTransfers) {
  const file = payload.attachments[index];
  if (!file || message.index !== index || message.attachmentId !== file.id || message.name !== file.name || message.label !== file.label
    || message.size !== file.size || message.mimeType !== file.mimeType || message.sha256 !== file.sha256
    || !isUuid(message.transferId) || usedTransfers.has(message.transferId)) throw new Error("Tệp đầu vào không khớp manifest hoặc mã truyền đã dùng.");
  return file;
}
