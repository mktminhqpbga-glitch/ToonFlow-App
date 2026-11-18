import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import {
  DEFAULT_PROMPT_INSTRUCTION_SETTINGS,
  PROVIDER_DISPLAY_NAMES,
  buildPromptWithInstructions,
  ensurePromptInstructionsLayout,
} from "./prompt-instructions.mjs";
import { makeAssistantMessage } from "./tool-calls.mjs";
import { createMediaStore } from "./media-store.mjs";

const MAX_TEXT_BODY_BYTES = 1_000_000;
const MAX_BODY_BYTES = 5_500_000;
const MAX_INPUT_IMAGES = 2;
const MAX_INPUT_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_QUEUE_LENGTH = 10;
const REQUEST_TIMEOUT_MS = 240_000;
const PROVIDERS = ["auto", "grok", "gemini", "deepseek", "perplexity", "qwen", "chatgpt", "claude", "zai", "kimi", "muse"];
if (PROVIDERS.slice(1).some((provider) => !PROVIDER_DISPLAY_NAMES[provider])) {
  throw new Error("PROVIDER_DISPLAY_NAMES is missing a provider from PROVIDERS.");
}
const DEFAULT_BRIDGE_SETTINGS = Object.freeze({
  interceptTitleRequests: true,
  ...DEFAULT_PROMPT_INSTRUCTION_SETTINGS,
});

const args = parseArgs(process.argv.slice(2));
const port = readPort(args.port ?? process.env.BRIDGE_PORT ?? "4317");
const tokenConfig = resolveBridgeToken(args);
const settingsConfig = loadBridgeSettings(args);
const promptInstructionsDir = resolvePromptInstructionsDirectory(args, settingsConfig.path);
const bridgeToken = tokenConfig.token;
const apiKey = args.apiKey ?? process.env.BRIDGE_API_KEY ?? "";
const mediaStore = createMediaStore(process.env.BRIDGE_MEDIA_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".ai-bridge-media"));
const interceptTitleRequests = process.env.BRIDGE_INTERCEPT_TITLES === undefined
  ? settingsConfig.settings.interceptTitleRequests
  : process.env.BRIDGE_INTERCEPT_TITLES !== "0";
const injectPromptInstructionsEveryMessage = settingsConfig.settings.injectPromptInstructionsEveryMessage;
const prePromptName = settingsConfig.settings.prePrompt;
const postPromptName = settingsConfig.settings.postPrompt;
const disguiseModelNameAsAssistant = settingsConfig.settings.disguiseModelNameAsAssistant;

const clients = new Set();
const allowedProviderHosts = {
  muse: ["muse.ai", "www.muse.ai"], chatgpt: ["chatgpt.com"], gemini: ["gemini.google.com"],
  claude: ["claude.ai"], grok: ["grok.com"], deepseek: ["chat.deepseek.com"],
  perplexity: ["www.perplexity.ai"], qwen: ["chat.qwen.ai", "chat.qwenlm.ai"],
  kimi: ["www.kimi.com"], zai: ["chat.z.ai"],
};
const instancePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidTabUrl(provider, address) {
  try {
    const parsed = new URL(address);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
      && (allowedProviderHosts[provider] || []).includes(parsed.hostname);
  } catch { return false; }
}
function verifyTargetShape(target, provider) {
  return !!target && typeof target === "object" && !Array.isArray(target)
    && Object.keys(target).sort().join(",") === "documentToken,profileInstanceId,tabId,url"
    && typeof target.profileInstanceId === "string" && instancePattern.test(target.profileInstanceId)
    && Number.isSafeInteger(target.tabId) && target.tabId >= 0
    && typeof target.documentToken === "string" && instancePattern.test(target.documentToken)
    && typeof target.url === "string" && target.url.length <= 2000 && isValidTabUrl(provider, target.url);
}
function supportsMediaClient(client) {
  const version = String(client?.extensionVersion ?? "").split(".").map(Number);
  return version.length >= 2 && Number.isInteger(version[0]) && Number.isInteger(version[1])
    && (version[0] > 0 || version[0] === 0 && version[1] >= 5);
}
function supportsInputImagesClient(client) {
  const version = /^(\d+)\.(\d+)\.(\d+)$/.exec(client?.extensionVersion ?? "");
  return !!version && (Number(version[1]) > 0 || Number(version[2]) >= 6);
}
function findPinnedClient(target, provider) {
  const matches = [...clients].filter(client => !client.closed && client.profileInstanceId === target.profileInstanceId);
  if (matches.length !== 1) return null;
  const client = matches[0];
  if (Date.now() - (client.inventoryAt || 0) > 15000) return null;
  const tab = client.tabs?.find(item => item.tabId === target.tabId && item.provider === provider
    && item.documentToken === target.documentToken && item.url === target.url && item.ready && !item.busy);
  return tab ? client : null;
}
function inventoryStatus() {
  return {
    input_image_support: true,
    connected_extensions: [...clients].filter(client => !client.closed).length,
    extension_versions: [...clients].filter(client => !client.closed).map(client => client.extensionVersion ?? "unknown"),
    providers: PROVIDERS.slice(1).map(id => ({ id, label: PROVIDER_DISPLAY_NAMES[id] })),
    tabs: [...clients].filter(client => !client.closed && Date.now() - (client.inventoryAt || 0) <= 15000)
      .flatMap(client => (client.tabs ?? []).map(tab => ({ ...tab,
        input_image_support: supportsInputImagesClient(client) && tab.provider !== "muse" }))).slice(0, 100),
    active_request: activeJob?.id ?? null,
    queued_requests: queue.length,
  };
}
const jobs = new Map();
const queue = [];
let activeJob = null;

const server = http.createServer(async (request, response) => {
  try {
    if (!isLoopback(request.socket.remoteAddress)) {
      return sendOpenAiError(response, 403, "AI Bridge only accepts loopback connections.", "forbidden");
    }

    setCorsHeaders(response);
    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }

    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, {
        ok: true,
        connected_extensions: clients.size,
        active_request: activeJob?.id ?? null,
        queued_requests: queue.length,
      });
    }

    if (request.method === "GET" && url.pathname === "/api/bridge/status") {
      if (!isAuthorized(request)) return sendOpenAiError(response, 401, "Invalid API key.", "invalid_api_key");
      return sendJson(response, 200, inventoryStatus());
    }

    if (request.method === "GET" && url.pathname === "/v1/models") {
      if (!isAuthorized(request)) return sendOpenAiError(response, 401, "Invalid API key.", "invalid_api_key");
      return sendJson(response, 200, {
        object: "list",
        data: PROVIDERS.map((provider) => ({
          id: `bridge-${provider}`,
          object: "model",
          created: 0,
          owned_by: "ai-bridge",
        })),
      });
    }

    const mediaMatch = /^\/v1\/media\/([0-9a-f-]{36})$/.exec(url.pathname);
    if (request.method === "GET" && mediaMatch) {
      if (!apiKey || !isAuthorized(request)) return sendOpenAiError(response, 401, "Media retrieval requires a valid API key.", "invalid_api_key");
      const file = mediaStore.lookup(mediaMatch[1]);
      if (!file) return sendOpenAiError(response, 404, "Media not found or expired.", "not_found");
      response.writeHead(200, { "Content-Type": file.mime_type, "Content-Length": file.size,
        "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `attachment; filename="${path.basename(file.path)}"` });
      fs.createReadStream(file.path).pipe(response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
      if (!isAuthorized(request)) return sendOpenAiError(response, 401, "Invalid API key.", "invalid_api_key");
      const payload = await readJsonBody(request);
      return handleChatCompletion(request, response, payload);
    }

    return sendOpenAiError(response, 404, "Route not found.", "not_found");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    if (!response.headersSent) sendOpenAiError(response, error?.code === "body_too_large" ? 413 : 400, message, "invalid_request_error");
    else response.end();
  }
});

server.on("upgrade", (request, socket, head) => {
  try {
    if (!isLoopback(request.socket.remoteAddress)) return rejectUpgrade(socket, 403, "Loopback only");
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/bridge") return rejectUpgrade(socket, 404, "Not found");
    if (url.searchParams.get("token") !== bridgeToken) return rejectUpgrade(socket, 401, "Invalid bridge token");
    if (request.headers.upgrade?.toLowerCase() !== "websocket") return rejectUpgrade(socket, 400, "WebSocket required");

    const key = request.headers["sec-websocket-key"];
    if (typeof key !== "string") return rejectUpgrade(socket, 400, "Missing WebSocket key");
    const accept = crypto.createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
    socket.write([
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "",
      "",
    ].join("\r\n"));

    const client = createWebSocketClient(socket);
    clients.add(client);
    client.send({ type: "bridge:connected", providers: PROVIDERS.slice(1) });
    if (head.length) client.consume(head);
    log(`Chrome extension connected (${clients.size} active).`);
    client.onClose = () => {
      clients.delete(client);
      log(`Chrome extension disconnected (${clients.size} active).`);
      failJobsForClient(client, "The Chrome extension disconnected while the request was running.");
    };
    client.onMessage = (message) => handleExtensionMessage(client, message);
  } catch {
    socket.destroy();
  }
});

server.listen(port, "127.0.0.1", () => {
  log(`AI Bridge listening at http://127.0.0.1:${port}`);
  log(`Extension WebSocket: ws://127.0.0.1:${port}/bridge`);
  log(`Bridge token: ${bridgeToken}`);
  if (tokenConfig.path) log(`Bridge token file: ${tokenConfig.path}`);
  log(`Settings file: ${settingsConfig.path}`);
  log(`Prompt instructions: ${promptInstructionsDir}`);
  if (!apiKey) log("API key authentication is disabled (loopback-only mode).");
  else log("API key authentication is enabled.");
});

function handleChatCompletion(request, response, payload) {
  if (!payload || !Array.isArray(payload.messages) || payload.messages.length === 0) {
    return sendOpenAiError(response, 400, "'messages' must be a non-empty array.", "invalid_request_error", "messages");
  }
  if (payload.stream !== undefined && typeof payload.stream !== "boolean") {
    return sendOpenAiError(response, 400, "'stream' must be a boolean.", "invalid_request_error", "stream");
  }
  const mediaKind = payload.media_kind ?? "none";
  if (!["none", "auto", "image", "video"].includes(mediaKind)) {
    return sendOpenAiError(response, 400, "media_kind must be none, auto, image or video.", "invalid_request_error", "media_kind");
  }
  if (mediaKind !== "none" && !apiKey) {
    return sendOpenAiError(response, 403, "A configured API key is required for media capture.", "media_auth_required");
  }
  let inputImages;
  try {
    // OpenAI multimodal content is not plain prompt text. Translate only
    // verified inline data URLs to real file attachments; never silently send
    // image_url as text, fetch arbitrary remote URLs, or omit failed uploads.
    const embedded = extractMessageImages(payload.messages);
    if (Buffer.byteLength(JSON.stringify(embedded.messages), "utf8") > MAX_TEXT_BODY_BYTES)
      throw new Error("Text messages exceed the 1 MB limit excluding attached images.");
    if (embedded.images.length && Object.hasOwn(payload, "input_images"))
      throw new Error("Use either input_images or message image_url parts, not both.");
    if (embedded.images.length || Object.hasOwn(payload, "input_images")) {
      if (mediaKind !== "image" && mediaKind !== "video") {
        return sendOpenAiError(response, 400, "input_images requires media_kind image or video.", "invalid_request_error", "media_kind");
      }
      inputImages = validateInputImages(embedded.images.length ? embedded.images : payload.input_images);
    }
    payload = { ...payload, messages: embedded.messages };
  } catch (error) {
    return sendOpenAiError(response, 400, error.message, "invalid_request_error", "input_images");
  }
  const provider = providerForModel(payload.model);
  if (inputImages && provider === "muse") {
    return sendOpenAiError(response, 409, "Muse input-image upload has not been verified; no prompt was submitted.",
      "input_images_provider_unsupported", "input_images");
  }
  const pinned = payload.target !== undefined;
  if (inputImages && !pinned) {
    return sendOpenAiError(response, 400, "input_images requires a pinned AI tab target.", "invalid_target", "target");
  }
  if (pinned && (!provider || !verifyTargetShape(payload.target, provider))) {
    return sendOpenAiError(response, 400, "Invalid pinned AI tab target or provider.", "invalid_target");
  }
  if (pinned && !findPinnedClient(payload.target, provider)) {
    return sendOpenAiError(response, 409, "The selected Profile/tab/document is not ready. Refresh MacFlow and choose the exact tab again.", "stale_target");
  }
  if (mediaKind !== "none" && pinned && !supportsMediaClient(findPinnedClient(payload.target, provider))) {
    return sendOpenAiError(response, 409, "Chrome has not reloaded the AI-Bridge extension version supporting media; no prompt was submitted.", "media_extension_outdated");
  }
  if (inputImages && !supportsInputImagesClient(findPinnedClient(payload.target, provider))) {
    return sendOpenAiError(response, 409, "Input images require AI-Bridge Chrome extension version 0.6.0 or later; no prompt was submitted.", "input_images_extension_outdated");
  }
  if (interceptTitleRequests && isConversationTitleRequest(payload.messages)) {
    return sendConversationTitle(response, payload);
  }
  if (clients.size === 0) {
    return sendOpenAiError(response, 503, "No Chrome extension is connected. Start the local server, then configure and enable the extension.", "bridge_unavailable");
  }
  if (queue.length >= MAX_QUEUE_LENGTH) {
    return sendOpenAiError(response, 429, "AI Bridge queue is full. Try again shortly.", "rate_limit_error");
  }

  const tools = Array.isArray(payload.tools) ? payload.tools : [];
  const prompt = buildPromptWithInstructions(
    formatPrompt(payload.messages, tools),
    payload.messages,
    provider,
    {
      everyMessage: injectPromptInstructionsEveryMessage,
      prePromptName,
      postPromptName,
      rootDirectory: promptInstructionsDir,
      disguiseModelNameAsAssistant,
    },
  );
  const job = {
    id: `bridge-${crypto.randomUUID()}`,
    model: typeof payload.model === "string" && payload.model ? payload.model : "bridge-auto",
    provider,
    target: pinned ? { ...payload.target } : null,
    prompt,
    tools,
    hasTools: tools.length > 0,
    stream: payload.stream === true,
    streamedContent: false,
    response,
    text: "",
    timer: null,
    client: null,
    done: false,
    mediaKind,
    inputImages,
    media: [],
    upload: null,
  };
  jobs.set(job.id, job);
  queue.push(job);
  if (job.stream) startStreamingResponse(job);
  dispatchNext();
}

function isConversationTitleRequest(messages) {
  const lastUserMessage = [...messages].reverse().find((message) => message?.role === "user");
  if (!lastUserMessage) return false;
  const text = contentToText(lastUserMessage.content).toLowerCase().replace(/\s+/g, " ");
  const asksForTitle = /\b(?:title|name|summari[sz]e|label)\b/.test(text);
  const namesConversation = /\b(?:conversation|chat|discussion|thread|messages)\b/.test(text);
  const requestVerb = /\b(?:generate|create|write|provide|return|suggest|give|make|name|summari[sz]e)\b/.test(text);
  const titleOnly = /\b(?:title only|only the title|just the title|no explanation)\b/.test(text);
  return asksForTitle && requestVerb && (namesConversation || titleOnly);
}

function sendConversationTitle(response, payload) {
  const model = typeof payload.model === "string" && payload.model ? payload.model : "bridge-auto";
  const title = makeConversationTitle(payload.messages);
  const id = `title-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  if (payload.stream) {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    response.flushHeaders?.();
    const titleJob = { id, model };
    writeSse(response, makeStreamChunk(titleJob, { role: "assistant", content: "" }, null));
    writeSse(response, makeStreamChunk(titleJob, { content: title }, null));
    writeSse(response, makeStreamChunk(titleJob, {}, "stop"));
    writeSse(response, "[DONE]");
    response.end();
    return;
  }
  sendJson(response, 200, {
    id: `chatcmpl-${id}`,
    object: "chat.completion",
    created,
    model,
    choices: [{ index: 0, message: { role: "assistant", content: title }, finish_reason: "stop" }],
  });
}

function makeConversationTitle(messages) {
  const lastTitleRequest = [...messages].reverse().find((message) => message?.role === "user");
  const sourceMessage = [...messages].reverse().find((message) => message?.role === "user" && message !== lastTitleRequest && !isConversationTitleRequest([message]));
  const source = contentToText(sourceMessage?.content ?? "");
  const words = source
    .replace(/```[\s\S]*?```/g, " ")
    .match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu)
    ?.filter((word) => !TITLE_STOP_WORDS.has(word.toLowerCase()))
    .slice(0, 7) ?? [];
  if (words.length === 0) return "New conversation";
  const title = words.join(" ");
  return `${title[0].toUpperCase()}${title.slice(1)}`.slice(0, 72);
}

const TITLE_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "for", "from", "how", "i", "in", "is", "it", "my", "of", "on", "or", "please", "the", "this", "that", "to", "we", "with", "you", "your",
]);

function dispatchNext() {
  if (activeJob || queue.length === 0) return;
  const job = queue.shift();
  const client = job.target ? findPinnedClient(job.target, job.provider) : selectClient(job.provider);
  if (!client) {
    finishJobWithError(job, "No suitable Chrome extension is connected.");
    dispatchNext();
    return;
  }
  if (job.mediaKind !== "none" && !supportsMediaClient(client)) {
    finishJobWithError(job, "Chrome extension needs reloading before it can receive images or video; prompt was not submitted.");
    dispatchNext();
    return;
  }
  if (job.inputImages && !supportsInputImagesClient(client)) {
    finishJobWithError(job, "Chrome extension version 0.6.0 or later is required to upload input images; prompt was not submitted.");
    dispatchNext();
    return;
  }

  activeJob = job;
  job.client = client;
  job.timer = setTimeout(() => finishJobWithError(job, "The web chat did not finish before the 4 minute bridge timeout."), REQUEST_TIMEOUT_MS);
  client.send({
    type: "bridge:run",
    id: job.id,
    provider: job.provider,
    prompt: job.prompt,
    mediaKind: job.mediaKind,
    ...(job.inputImages ? { inputImages: job.inputImages } : {}),
    ...(job.target ? { target: job.target } : {}),
  });
  job.inputImages = null;
}

function validateInputImages(images) {
  if (!Array.isArray(images) || images.length < 1 || images.length > MAX_INPUT_IMAGES) {
    throw new Error(`input_images must contain 1 to ${MAX_INPUT_IMAGES} images.`);
  }
  let totalBytes = 0;
  return images.map((image, index) => {
    const prefix = `input_images[${index}]`;
    if (!image || typeof image !== "object" || Array.isArray(image)
      || Object.keys(image).some(key => !["mime_type", "data", "name"].includes(key))) {
      throw new Error(`${prefix} must contain only mime_type, data and optional name.`);
    }
    const mimeType = image.mime_type;
    if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
      throw new Error(`${prefix}.mime_type must be image/png, image/jpeg or image/webp.`);
    }
    if (typeof image.name !== "undefined"
      && (typeof image.name !== "string" || !image.name || image.name.length > 128 || /[\\/\x00-\x1f\x7f]/.test(image.name))) {
      throw new Error(`${prefix}.name must be a safe filename with at most 128 characters.`);
    }
    const data = image.data;
    if (typeof data !== "string" || !data || data.length % 4 !== 0
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length > Math.ceil(MAX_INPUT_IMAGE_BYTES / 3) * 4) {
      throw new Error(`${prefix}.data must be canonical base64 within the image size limit.`);
    }
    const bytes = Buffer.from(data, "base64");
    if (!bytes.length || bytes.length > MAX_INPUT_IMAGE_BYTES || bytes.toString("base64") !== data) {
      throw new Error(`${prefix}.data contains invalid base64 or exceeds the image size limit.`);
    }
    totalBytes += bytes.length;
    if (totalBytes > MAX_INPUT_IMAGE_BYTES) {
      throw new Error(`input_images exceeds the ${MAX_INPUT_IMAGE_BYTES} byte combined size limit.`);
    }
    const png = bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
      && bytes.readUInt32BE(8) === 13 && bytes.toString("ascii", 12, 16) === "IHDR"
      && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0
      && bytes.subarray(-8, -4).equals(Buffer.from("IEND"));
    const jpeg = bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8
      && bytes[2] === 0xff && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
    const webp = bytes.length >= 20 && bytes.toString("ascii", 0, 4) === "RIFF"
      && bytes.readUInt32LE(4) === bytes.length - 8 && bytes.toString("ascii", 8, 12) === "WEBP"
      && ["VP8 ", "VP8L", "VP8X"].includes(bytes.toString("ascii", 12, 16));
    if (!(mimeType === "image/png" && png || mimeType === "image/jpeg" && jpeg || mimeType === "image/webp" && webp)) {
      throw new Error(`${prefix}.data does not match its declared image file signature.`);
    }
    return { mime_type: mimeType, data, ...(image.name === undefined ? {} : { name: image.name }) };
  });
}

function handleExtensionMessage(client, message) {
  if (!message || typeof message !== "object" || typeof message.type !== "string") return;
  if (message.type === "bridge:hello") {
    client.providers = Array.isArray(message.providers) ? message.providers.filter((name) => PROVIDERS.includes(name)) : [];
    client.extensionVersion = typeof message.version === "string" ? message.version : "unknown";
    const profile = message.profileInstanceId;
    client.profileInstanceId = typeof profile === "string" && instancePattern.test(profile) ? profile : null;
    client.tabs = [];
    client.inventoryAt = 0;
    return;
  }
  if (message.type === "bridge:tabs") {
    if (!client.profileInstanceId || message.profileInstanceId !== client.profileInstanceId
      || !Array.isArray(message.tabs) || message.tabs.length > 40
      || [...clients].some(other => other !== client && !other.closed && other.profileInstanceId === client.profileInstanceId)) {
      client.tabs = []; client.inventoryAt = 0; return;
    }
    const seen = new Set();
    const valid = [];
    for (const item of message.tabs) {
      if (!item || item.profileInstanceId !== client.profileInstanceId || !Number.isSafeInteger(item.tabId) || item.tabId < 0
        || !PROVIDERS.includes(item.provider) || !isValidTabUrl(item.provider, item.url)
        || !instancePattern.test(item.documentToken ?? "") || seen.has(item.tabId)
        || typeof item.ready !== "boolean" || typeof item.busy !== "boolean"
        || typeof item.title !== "string" || item.title.length > 160) {
        client.tabs = []; client.inventoryAt = 0; return;
      }
      seen.add(item.tabId);
      valid.push({ profileInstanceId: client.profileInstanceId, tabId: item.tabId, provider: item.provider,
        title: item.title, url: item.url, documentToken: item.documentToken,
        ready: item.ready, busy: item.busy });
    }
    client.tabs = valid;
    client.inventoryAt = Date.now();
    return;
  }
  if (message.type === "bridge:status") return;
  if (message.type === "bridge:ping") {
    client.send({ type: "bridge:pong", at: Date.now() });
    return;
  }
  if (typeof message.id !== "string") return;
  const job = jobs.get(message.id);
  if (!job || job.client !== client || job.done) return;
  if (job.target && (message.tabId !== job.target.tabId || message.documentToken !== job.target.documentToken
    || message.url !== job.target.url || message.provider !== job.provider)) return;

  if (["bridge:media:start", "bridge:media:chunk", "bridge:media:end"].includes(message.type)) {
    let ok = true;
    let error = "";
    try {
      if (message.type === "bridge:media:start") mediaStore.begin(job, message);
      else if (message.type === "bridge:media:chunk") mediaStore.append(job, message);
      else mediaStore.end(job, message);
    } catch (cause) {
      ok = false;
      error = String(cause?.message || cause).slice(0, 400);
      mediaStore.abort(job, true);
    }
    client.send({ type: "bridge:media:ack", id: job.id, transferId: message.transferId,
      sequence: message.sequence ?? -1, stage: message.type, ok, error });
    if (!ok) finishJobWithError(job, `Media transfer rejected: ${error}`);
    return;
  }
  if (message.type === "bridge:chunk") {
    const text = typeof message.text === "string" ? message.text : "";
    if (!text) return;
    job.text += text;
    // When tools are present, buffer until complete so we can lift JSON into tool_calls
    // instead of streaming it as ordinary assistant content the IDE will ignore.
    if (job.stream && !job.hasTools) writeChunk(job, text);
    return;
  }
  if (message.type === "bridge:complete") {
    if (job.upload) return finishJobWithError(job, "Media transfer was not completed.");
    if ((job.mediaKind === "image" && !job.media.some(file => file.kind === "image"))
      || (job.mediaKind === "video" && !job.media.some(file => file.kind === "video")))
      return finishJobWithError(job, "The requested image/video was not verified. Check the AI tab before sending another prompt.");
    if (typeof message.text === "string" && message.text) {
      if (!job.text || message.text.length >= job.text.length) job.text = message.text;
    }
    finishJob(job);
    return;
  }
  if (message.type === "bridge:error") {
    finishJobWithError(job, typeof message.message === "string" ? message.message : "The web chat page reported an unknown error.");
  }
}

function finishJob(job) {
  if (job.done) return;
  job.done = true;
  clearTimeout(job.timer);
  jobs.delete(job.id);
  if (activeJob === job) activeJob = null;

  if (job.stream) {
    finishStreamingJob(job);
  } else {
    const message = makeAssistantMessage(job.text, job.tools);
    if (job.media.length) message.media = mediaDescriptions(job);
    sendJson(job.response, 200, {
      id: `chatcmpl-${crypto.randomUUID()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: job.model,
      choices: [{ index: 0, message, finish_reason: message.tool_calls ? "tool_calls" : "stop" }],
      ...(job.media.length ? { media: mediaDescriptions(job) } : {}),
    });
  }
  dispatchNext();
}

function finishStreamingJob(job) {
  if (job.media.length) writeSse(job.response, makeStreamChunk(job, { media: mediaDescriptions(job) }, null));
  if (job.hasTools) {
    const message = makeAssistantMessage(job.text, job.tools);
    if (message.tool_calls) {
      const call = message.tool_calls[0];
      writeSse(job.response, makeStreamChunk(job, {
        tool_calls: [{
          index: 0,
          id: call.id,
          type: "function",
          function: { name: call.function.name, arguments: call.function.arguments },
        }],
      }, null));
      writeSse(job.response, makeStreamChunk(job, {}, "tool_calls"));
      writeSse(job.response, "[DONE]");
      job.response.end();
      return;
    }
  }

  if (!job.streamedContent && job.text) writeChunk(job, job.text);
  writeSse(job.response, makeStreamChunk(job, {}, "stop"));
  writeSse(job.response, "[DONE]");
  job.response.end();
}

function finishJobWithError(job, message) {
  if (job.done) return;
  mediaStore.abort(job, true);
  job.done = true;
  clearTimeout(job.timer);
  jobs.delete(job.id);
  const queuedIndex = queue.indexOf(job);
  if (queuedIndex !== -1) queue.splice(queuedIndex, 1);
  if (activeJob === job) activeJob = null;

  if (job.stream) {
    writeSse(job.response, { error: { message, type: "bridge_error", code: "bridge_error" } });
    writeSse(job.response, "[DONE]");
    job.response.end();
  } else {
    sendOpenAiError(job.response, 502, message, "bridge_error");
  }
  dispatchNext();
}

function mediaDescriptions(job) {
  return job.media.map(file => ({ ...file, url: `http://127.0.0.1:${port}/v1/media/${file.id}` }));
}

function failJobsForClient(client, message) {
  for (const job of [...jobs.values()]) {
    if (job.client === client) finishJobWithError(job, message);
  }
}

function startStreamingResponse(job) {
  job.response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  job.response.flushHeaders?.();
  // Avoid committing to content:"" when tools may produce tool_calls instead.
  writeSse(job.response, makeStreamChunk(job, job.hasTools ? { role: "assistant" } : { role: "assistant", content: "" }, null));
}

function writeChunk(job, text) {
  job.streamedContent = true;
  writeSse(job.response, makeStreamChunk(job, { content: text }, null));
}

function makeStreamChunk(job, delta, finishReason) {
  return {
    id: `chatcmpl-${job.id}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: job.model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
}

function formatPrompt(messages, tools) {
  const transcript = messages.map((message) => {
    const role = typeof message.role === "string" ? message.role.toUpperCase() : "USER";
    return `${role}:\n${contentToText(message.content)}`;
  }).join("\n\n");
  if (!Array.isArray(tools) || tools.length === 0) return transcript;
  return `${transcript}\n\nAVAILABLE TOOLS (OpenAI schema):\n${JSON.stringify(tools)}\n\nIf a tool is required, reply only with a JSON object shaped like {"name":"tool_name","arguments":{...}}. Otherwise answer normally.`;
}

function contentToText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return content == null ? "" : String(content);
  return content.map((part) => {
    if (typeof part === "string") return part;
    if (part?.type === "text" && typeof part.text === "string") return part.text;
    if (part?.type === "input_text" && typeof part.text === "string") return part.text;
    // Unsupported multimodal content is rejected by extractMessageImages
    // before this formatter runs; it must never be transmitted as a caption.
    throw new Error(`Unsupported content part: ${part?.type ?? "unknown"}`);
  }).join("\n");
}

function extractMessageImages(messages) {
  const images = [];
  const result = messages.map(message => {
    if (!Array.isArray(message?.content)) return message;
    const parts = message.content.flatMap(part => {
      if (typeof part === "string" || (part && ["text", "input_text"].includes(part.type) && typeof part.text === "string")) return [part];
      if (part?.type !== "image_url" && part?.type !== "input_image")
        throw new Error(`Unsupported content part: ${part?.type ?? "unknown"}`);
      if (message.role !== "user") throw new Error("Image attachments must belong to a user message.");
      const value = part.type === "image_url" ? part.image_url?.url : part.image_url || part.image;
      if (typeof value !== "string") throw new Error("An image content part must contain a data URL.");
      const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
      if (!match) throw new Error("Only inline PNG/JPEG/WebP data URLs are supported for image_url. Remote image URLs are not uploaded.");
      images.push({ mime_type: match[1], data: match[2] });
      return [];
    });
    return { ...message, content: parts };
  });
  if (images.length > MAX_INPUT_IMAGES) throw new Error(`Only ${MAX_INPUT_IMAGES} images are allowed.`);
  return { images, messages: result };
}

function providerForModel(model) {
  const value = typeof model === "string" ? model.toLowerCase().trim() : "";
  if (!value || value === "auto" || value === "bridge-auto") return null;
  const found = PROVIDERS.slice(1).find((provider) => (
    value === provider
    || value === `bridge-${provider}`
    || value.includes(`bridge-${provider}`)
    || value === `bridge_${provider}`
    || value.startsWith(`${provider}-`)
    || value.startsWith(`${provider}_`)
  ));
  return found ?? null;
}

function selectClient(provider) {
  const available = [...clients].filter((client) => !client.closed);
  if (!provider) return available.at(-1) ?? null;
  return available.find((client) => client.providers.length === 0 || client.providers.includes(provider)) ?? null;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let exceeded = false;
    request.on("data", (chunk) => {
      if (exceeded) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        exceeded = true;
        const error = new Error(`Request body exceeds ${MAX_BODY_BYTES} bytes.`);
        error.code = "body_too_large";
        reject(error);
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (exceeded) return;
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        const embeddedImage = Array.isArray(payload?.messages) && payload.messages.some(message =>
          Array.isArray(message?.content) && message.content.some(part =>
            (part?.type === "image_url" && typeof part.image_url?.url === "string" && part.image_url.url.startsWith("data:image/"))
            || (part?.type === "input_image" && typeof part.image_url === "string" && part.image_url.startsWith("data:image/"))));
        if (size > MAX_TEXT_BODY_BYTES && (!payload || !Object.hasOwn(payload, "input_images") && !embeddedImage)) {
          const error = new Error(`Request body exceeds ${MAX_TEXT_BODY_BYTES} bytes without input_images.`);
          error.code = "body_too_large";
          reject(error);
          return;
        }
        resolve(payload);
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function createWebSocketClient(socket) {
  const client = {
    socket,
    providers: [],
    profileInstanceId: null,
    inventoryAt: 0,
    tabs: [],
    buffer: Buffer.alloc(0),
    closed: false,
    onClose: null,
    onMessage: null,
    send(value) {
      if (client.closed || socket.destroyed) return;
      sendWebSocketFrame(socket, JSON.stringify(value));
    },
    consume(chunk) {
      client.buffer = Buffer.concat([client.buffer, chunk]);
      while (client.buffer.length >= 2) {
        const first = client.buffer[0];
        const second = client.buffer[1];
        const opcode = first & 0x0f;
        const masked = (second & 0x80) === 0x80;
        let payloadLength = second & 0x7f;
        let offset = 2;
        if (payloadLength === 126) {
          if (client.buffer.length < 4) return;
          payloadLength = client.buffer.readUInt16BE(2);
          offset = 4;
        } else if (payloadLength === 127) {
          if (client.buffer.length < 10) return;
          const length = client.buffer.readBigUInt64BE(2);
          if (length > BigInt(MAX_BODY_BYTES)) return closeWebSocket(client, 1009, "Message too large");
          payloadLength = Number(length);
          offset = 10;
        }
        const frameLength = offset + (masked ? 4 : 0) + payloadLength;
        if (client.buffer.length < frameLength) return;
        let payload = client.buffer.subarray(offset + (masked ? 4 : 0), frameLength);
        if (masked) {
          const mask = client.buffer.subarray(offset, offset + 4);
          payload = Buffer.from(payload);
          for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
        }
        client.buffer = client.buffer.subarray(frameLength);
        if (opcode === 0x8) return socket.end();
        if (opcode === 0x9) {
          sendWebSocketFrame(socket, payload, 0xA);
          continue;
        }
        if (opcode !== 0x1) continue;
        try {
          client.onMessage?.(JSON.parse(payload.toString("utf8")));
        } catch {
          closeWebSocket(client, 1007, "Invalid JSON");
          return;
        }
      }
    },
  };
  socket.on("data", client.consume);
  socket.on("error", () => socket.destroy());
  socket.on("close", () => {
    if (client.closed) return;
    client.closed = true;
    client.onClose?.();
  });
  return client;
}

function sendWebSocketFrame(socket, payload, opcode = 0x1) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  let header;
  if (body.length < 126) {
    header = Buffer.from([0x80 | opcode, body.length]);
  } else if (body.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(body.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(body.length), 2);
  }
  socket.write(Buffer.concat([header, body]));
}

function closeWebSocket(client, code, reason) {
  if (client.closed) return;
  const body = Buffer.alloc(2 + Buffer.byteLength(reason));
  body.writeUInt16BE(code, 0);
  body.write(reason, 2);
  sendWebSocketFrame(client.socket, body, 0x8);
  client.socket.end();
}

function rejectUpgrade(socket, status, message) {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

function isAuthorized(request) {
  if (!apiKey) return true;
  return request.headers.authorization === `Bearer ${apiKey}`;
}

function isLoopback(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendOpenAiError(response, status, message, code, param = null) {
  sendJson(response, status, { error: { message, type: code, param, code } });
}

function writeSse(response, payload) {
  response.write(`data: ${typeof payload === "string" ? payload : JSON.stringify(payload)}\n\n`);
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const [key, inline] = value.slice(2).split("=", 2);
    result[key] = inline ?? values[index + 1];
    if (inline === undefined) index += 1;
  }
  return result;
}

function readPort(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) throw new Error("BRIDGE_PORT must be a valid TCP port.");
  return parsed;
}

function resolveBridgeToken(options) {
  const supplied = options.token ?? process.env.BRIDGE_TOKEN;
  if (supplied) return { token: supplied, path: null };

  const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
  const tokenPath = path.resolve(options.tokenFile ?? options["token-file"] ?? process.env.BRIDGE_TOKEN_FILE ?? path.join(serverDirectory, ".ai-bridge-token"));
  const existing = readTokenFile(tokenPath);
  if (existing) return { token: existing, path: tokenPath };

  const generated = crypto.randomBytes(24).toString("base64url");
  try {
    fs.writeFileSync(tokenPath, `${generated}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    return { token: generated, path: tokenPath };
  } catch (error) {
    if (error?.code !== "EEXIST") throw new Error(`Could not create bridge token file at ${tokenPath}: ${error.message}`);
    const tokenCreatedElsewhere = readTokenFile(tokenPath);
    if (tokenCreatedElsewhere) return { token: tokenCreatedElsewhere, path: tokenPath };
    throw new Error(`Bridge token file at ${tokenPath} is empty.`);
  }
}

function loadBridgeSettings(options) {
  const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
  const settingsPath = path.resolve(options.settingsFile ?? options["settings-file"] ?? process.env.BRIDGE_SETTINGS_FILE ?? path.join(serverDirectory, "ai-bridge.settings.json"));
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("the root value must be a JSON object");
    return {
      path: settingsPath,
      settings: {
        interceptTitleRequests: typeof parsed.interceptTitleRequests === "boolean"
          ? parsed.interceptTitleRequests
          : DEFAULT_BRIDGE_SETTINGS.interceptTitleRequests,
        injectPromptInstructionsEveryMessage: typeof parsed.injectPromptInstructionsEveryMessage === "boolean"
          ? parsed.injectPromptInstructionsEveryMessage
          : DEFAULT_BRIDGE_SETTINGS.injectPromptInstructionsEveryMessage,
        prePrompt: readOptionalSettingsString(parsed.prePrompt, DEFAULT_BRIDGE_SETTINGS.prePrompt, "prePrompt"),
        postPrompt: readOptionalSettingsString(parsed.postPrompt, DEFAULT_BRIDGE_SETTINGS.postPrompt, "postPrompt"),
        disguiseModelNameAsAssistant: typeof parsed.disguiseModelNameAsAssistant === "boolean"
          ? parsed.disguiseModelNameAsAssistant
          : DEFAULT_BRIDGE_SETTINGS.disguiseModelNameAsAssistant,
      },
    };
  } catch (error) {
    if (error?.code !== "ENOENT") throw new Error(`Could not load settings file at ${settingsPath}: ${error.message}`);
    const contents = `${JSON.stringify({
      interceptTitleRequests: DEFAULT_BRIDGE_SETTINGS.interceptTitleRequests,
      injectPromptInstructionsEveryMessage: DEFAULT_BRIDGE_SETTINGS.injectPromptInstructionsEveryMessage,
      prePrompt: DEFAULT_BRIDGE_SETTINGS.prePrompt,
      postPrompt: DEFAULT_BRIDGE_SETTINGS.postPrompt,
      "// disguiseModelNameAsAssistant": "Turning on may increase responsiveness of a model to the prompt",
      disguiseModelNameAsAssistant: DEFAULT_BRIDGE_SETTINGS.disguiseModelNameAsAssistant,
    }, null, 2)}\n`;
    try {
      fs.writeFileSync(settingsPath, contents, { encoding: "utf8", flag: "wx" });
    } catch (writeError) {
      if (writeError?.code !== "EEXIST") throw new Error(`Could not create settings file at ${settingsPath}: ${writeError.message}`);
    }
    return loadBridgeSettings({ "settings-file": settingsPath });
  }
}

function resolvePromptInstructionsDirectory(options, settingsPath) {
  const configured = options.promptInstructionsDir
    ?? options["prompt-instructions-dir"]
    ?? process.env.BRIDGE_PROMPT_INSTRUCTIONS_DIR
    ?? path.join(path.dirname(settingsPath), "prompt-instructions");
  return ensurePromptInstructionsLayout(path.resolve(configured));
}

function readOptionalSettingsString(value, fallback, key) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") throw new Error(`'${key}' must be a string`);
  return value.trim();
}

function readTokenFile(tokenPath) {
  try {
    const token = fs.readFileSync(tokenPath, "utf8").trim();
    return token || null;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error(`Could not read bridge token file at ${tokenPath}: ${error.message}`);
  }
}

function log(message) {
  console.log(`[ai-bridge] ${message}`);
}
