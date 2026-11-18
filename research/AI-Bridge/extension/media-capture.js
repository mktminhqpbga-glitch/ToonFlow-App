// Runs in the tab's isolated content-script world. It never scrapes unrelated tabs
// or sends media URLs to the local server: only validated bytes are transferred.
(() => {
  const MAX_IMAGE = 16 * 1024 * 1024;
  const MAX_VIDEO = 64 * 1024 * 1024;
  const CHUNK = 48 * 1024;
  const HEADERS = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
  };
  const RESPONSE_CONTAINERS = {
    chatgpt: ["[data-message-author-role='assistant']"],
    gemini: ["model-response"],
    grok: ["[data-testid='conversation-turn']", ".message-content"],
    claude: ["[data-test-render-count]"],
    deepseek: [".ds-markdown", "[class*='message-content']"],
    perplexity: ["[class*='answer']", "[class*='prose']"],
    qwen: ["[class*='message-content']", ".markdown-body"],
    zai: ["[class*='message-content']", "[class*='markdown']"],
    kimi: ["[class*='message-content']", ".markdown-body"],
  };

  function visible(el) {
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && el.getClientRects().length > 0;
  }
  function responseRoots(provider) {
    for (const selector of RESPONSE_CONTAINERS[provider] ?? []) {
      const nodes = [...document.querySelectorAll(selector)].filter(visible);
      if (nodes.length) return nodes;
    }
    return [];
  }
  function mediaSource(node) {
    if (node.matches("img")) return node.currentSrc || node.src;
    if (node.matches("video")) return node.currentSrc || node.querySelector("source[src]")?.src || node.src;
    if (node.matches("a[download], [data-download-url]")) return node.getAttribute("data-download-url") || node.href;
    return "";
  }
  function candidate(node, root) {
    const kind = node.matches("video") ? "video" : node.matches("img") ? "image" : null;
    const src = mediaSource(node);
    if (!src || !root.contains(node)) return null;
    if (kind === "image" && ((node.naturalWidth || 0) < 96 || (node.naturalHeight || 0) < 96)) return null;
    if (kind === "video" && node.readyState < 1) return null;
    if (!kind && !/\.(png|jpe?g|webp|mp4|webm)(?:[?#]|$)/i.test(src)) return null;
    const detectedKind = kind || (/\.(mp4|webm)(?:[?#]|$)/i.test(src) ? "video" : "image");
    // Opaque object/blob URLs are allowed; other schemes and unknown remote
    // origins are not. Avoid fetching resources outside the chat service.
    let url;
    try { url = new URL(src, location.href); } catch { return null; }
    if (url.protocol !== "blob:" && url.protocol !== "https:" && url.protocol !== "data:") return null;
    if (url.protocol === "https:" && url.origin !== location.origin) return null;
    if (url.protocol === "blob:" && !url.href.startsWith(`blob:${location.origin}/`)) return null;
    if (url.protocol === "data:" && !/^data:(image\/(?:png|jpeg|webp)|video\/(?:mp4|webm));base64,/i.test(url.href)) return null;
    return { kind: detectedKind, url: url.href, root };
  }
  function scan(provider, baseline, kind) {
    const roots = responseRoots(provider);
    // The final response container is normally appended after a new prompt.
    // Never scan the whole page, which includes avatars, gallery, earlier media.
    const fresh = [];
    const root = roots.at(-1);
    if (!root) return [];
    for (const node of root.querySelectorAll("img,video,a[download],[data-download-url]")) {
      const item = candidate(node, root);
      if (item && !baseline.has(item.url) && (kind === "auto" || kind === item.kind)) fresh.push(item);
    }
    return fresh.slice(-4);
  }
  function snapshot(provider) {
    const urls = new Set();
    for (const root of responseRoots(provider)) {
      for (const node of root.querySelectorAll("img,video,a[download],[data-download-url]")) {
        const source = mediaSource(node);
        if (source) { try { urls.add(new URL(source, location.href).href); } catch {} }
      }
    }
    return urls;
  }
  function signature(bytes, mime) {
    if (bytes.length < 12) return false;
    const ascii = (start, end) => String.fromCharCode(...bytes.subarray(start, end));
    if (mime === "image/png") return bytes.subarray(0, 8).join(",") === "137,80,78,71,13,10,26,10";
    if (mime === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (mime === "image/webp") return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
    if (mime === "video/mp4") return ascii(4, 8) === "ftyp";
    if (mime === "video/webm") return bytes.subarray(0, 4).join(",") === "26,69,223,163";
    return false;
  }
  function mimeOf(bytes, kind) {
    return Object.keys(HEADERS).find((mime) => mime.startsWith(kind + "/") && signature(bytes, mime)) || null;
  }
  async function download(item) {
    const response = await fetch(item.url, { credentials: "include", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Media fetch failed (${response.status})`);
    const limit = item.kind === "image" ? MAX_IMAGE : MAX_VIDEO;
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > limit) throw new Error("Media exceeds the permitted size.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Media body is not readable.");
    const parts = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) throw new Error("Media exceeds the permitted size.");
        parts.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    const mimeType = mimeOf(bytes, item.kind);
    if (!mimeType) throw new Error("Output is not a valid supported image/video file. Poster images are never accepted as videos.");
    if (item.kind === "image") {
      const bmp = await createImageBitmap(new Blob([bytes], { type: mimeType })).catch(() => null);
      if (!bmp || bmp.width < 1 || bmp.height < 1) throw new Error("Image output cannot be decoded.");
      bmp.close();
    } else {
      // Match the Muse2API fail-closed behavior: an image poster, HTML error
      // response or broken MP4/WebM cannot masquerade as a generated video.
      const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      const video = document.createElement("video");
      video.preload = "metadata";
      try {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Video metadata could not be decoded.")), 10000);
          video.onloadedmetadata = () => {
            clearTimeout(timer);
            if (video.videoWidth > 0 && video.videoHeight > 0 &&
                Number.isFinite(video.duration) && video.duration > 0) resolve();
            else reject(new Error("Video contains no verifiable playable frames."));
          };
          video.onerror = () => { clearTimeout(timer); reject(new Error("Invalid video container.")); };
          video.src = url;
        });
      } finally {
        video.removeAttribute("src");
        video.load();
        URL.revokeObjectURL(url);
      }
    }
    return { bytes, mimeType, kind: item.kind };
  }
  function base64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x4000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x4000));
    return btoa(binary);
  }
  async function relay(message) {
    const response = await chrome.runtime.sendMessage({ type: "bridge:site-message", message });
    if (response?.ok !== true) throw new Error(response?.error || "Media relay rejected the message.");
  }
  async function transfer(id, item) {
    const { bytes, mimeType, kind } = await download(item);
    const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const transferId = crypto.randomUUID();
    await relay({ type: "bridge:media:start", id, transferId, kind, mimeType, size: bytes.length, sha256 });
    for (let offset = 0, sequence = 0; offset < bytes.length; offset += CHUNK, sequence++) {
      await relay({ type: "bridge:media:chunk", id, transferId, sequence, data: base64(bytes.subarray(offset, offset + CHUNK)) });
    }
    await relay({ type: "bridge:media:end", id, transferId });
    return { kind, mimeType, size: bytes.length };
  }
  globalThis.AI_BRIDGE_MEDIA = { snapshot, scan, transfer };
})();
