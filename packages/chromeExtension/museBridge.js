(() => {
  if (globalThis.macflowMuseInstalled) return;
  globalThis.macflowMuseInstalled = true;
  const documentToken = crypto.randomUUID(), maxSize = 64 * 1024 * 1024;
  const userSelector = '[data-message-author-role="user"],user-query,[class*="chat-user-bubble"],[data-testid*="user-message" i]';
  const assistantSelector = '[data-message-author-role="assistant"],[class*="assistant-message"],[class*="assistant-bubble"],[class*="hatch-chat-groupable-bubble"]';
  const attachmentSelector = '[data-testid^="hatch-chat-attachment-presentation-"],[data-testid*="attachment-preview" i],[data-testid*="upload-preview" i],[class*="attachment-card" i],[class*="attachmentCard"],[class*="attachment-preview" i],[class*="upload-item" i]';
  let active, staging;
  const visible = el => !!el?.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
  function composer() {
    const candidates = [...document.querySelectorAll("textarea")].filter(el => visible(el) && !el.disabled && !el.readOnly && !el.closest('[hidden],[aria-hidden="true"]'));
    const preferred = candidates.filter(el => /message|tin nhắn|消息/i.test(`${el.getAttribute("placeholder") || ""} ${el.getAttribute("aria-label") || ""}`));
    return preferred.length === 1 ? preferred[0] : candidates.length === 1 ? candidates[0] : undefined;
  }
  const stopButton = () => {
    const input = composer(), root = input && rootFor(input);
    return root && [...root.querySelectorAll('button[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="停止"]')].find(visible);
  };
  function users() {
    const input = composer(), scope = input && rootFor(input);
    const candidates = [...document.querySelectorAll(userSelector)].filter(el =>
      !el.matches('button,input,textarea,[role="button"]') && !el.closest('[data-testid="hatch-composer-placeholder-overlay"]')
      && !scope?.contains(el) && !el.contains(input)
      && (visible(el) || getComputedStyle(el).display === "contents" && [...el.children].some(visible)));
    return candidates.filter(el => !candidates.some(parent => parent !== el && parent.contains(el)));
  }
  const textOf = el => el.innerText || el.textContent || "";
  const normalized = text => String(text || "").replace(/\s+/g, " ").trim();
  function turnText(el) {
    const copy = el.cloneNode(true);
    for (const control of copy.querySelectorAll('button,[role="button"],svg,input,textarea,script,style,[aria-hidden="true"]')) control.remove();
    return normalized(copy.textContent);
  }
  function sameTurns(snapshot, elements) {
    return snapshot.length === elements.length && snapshot.every((text, index) => text === turnText(elements[index]));
  }
  function isReceipt(el, job) {
    return [el.innerText, el.textContent].some(text => text?.includes("[REQUEST_BEGIN:" + job.requestId + "]")
      && text.includes("[REQUEST_END:" + job.requestId + "]") && normalized(text).includes(normalized(job.prompt)));
  }
  function hasReceiptMarkers(el, job) {
    const text = textOf(el);
    return text.includes("[REQUEST_BEGIN:" + job.requestId + "]")
      && text.includes("[REQUEST_END:" + job.requestId + "]");
  }
  function fail(code, message) { throw Object.assign(new Error(message), { code }); }
  function delay(ms, signal) {
    return new Promise((resolve, reject) => {
      signal.throwIfAborted();
      const cancel = () => { clearTimeout(timer); signal.removeEventListener("abort", cancel); reject(new Error("Đã dừng theo dõi tác vụ.")); };
      const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, ms);
      signal.addEventListener("abort", cancel, { once: true });
    });
  }
  function rootFor(input) {
    const history = '[data-message-author-role],user-query,[class*="chat-user-bubble"],[class*="hatch-chat-groupable-bubble"],[class*="assistant-message"],[class*="assistant-bubble"]';
    const hasHistory = root => [...root.querySelectorAll(history)].some(el => !el.closest('[data-testid="hatch-composer-placeholder-overlay"]'));
    const form = input.closest("form");
    if (form && !hasHistory(form)) return form;
    let root = input.parentElement, result = input;
    for (let depth = 0; root && root !== document.body && root.tagName !== "MAIN" && depth < 8; depth++, root = root.parentElement) {
      if (hasHistory(root) || [...root.querySelectorAll("textarea")].some(el => el !== input && visible(el))) break;
      result = root;
      if (root.matches('[data-testid="hatch-composer"],[data-testid="hatch-chat-composer"]')) break;
    }
    return result;
  }
  const attachmentCards = root => {
    const cards = [...root.querySelectorAll(attachmentSelector)].filter(visible).filter(el => !el.matches('button,input,label,[role="button"]') || el.querySelector('img,video,audio'));
    return cards.filter(el => !cards.some(child => child !== el && el.contains(child)));
  };
  const pendingUploads = root => !!root && [...root.querySelectorAll('[role="progressbar"],[aria-busy="true"],[data-upload-state="uploading"],[data-status="uploading"]')].some(visible);
  function probe() {
    const input = composer(), root = input && rootFor(input);
    const hasDraft = root && (attachmentCards(root).length || [...root.querySelectorAll('input[type="file"]')].some(el => el.files?.length));
    const notReadyReason = !input ? "MUSE_COMPOSER_NOT_FOUND" : input.value.trim() ? "MUSE_DRAFT_TEXT" : hasDraft ? "MUSE_DRAFT_FILES"
      : pendingUploads(root) ? "MUSE_UPLOAD_PENDING" : stopButton() ? "MUSE_GENERATING" : active ? "MUSE_TASK_ACTIVE" : staging ? "MUSE_PREPARING" : "";
    // These are media workflows implemented by this Muse bridge, not a claim
    // about the account's credits or whether a specific prompt will succeed.
    // Actual outputs still require a correctly matched, decodable media file.
    return {
      documentToken, url: location.href, capable: !!input,
      outputKinds: input ? ["text", "image", "video", "audio"] : ["text"],
      ready: !notReadyReason, busy: !!stopButton() || !!active || !!staging, notReadyReason,
    };
  }
  function clearStaging() { if (staging) clearTimeout(staging.timer); staging = undefined; }
  function guard(job) {
    job.controller?.signal.throwIfAborted();
    if (job.documentToken !== documentToken) fail("MUSE_NAVIGATED", "Document Muse đã thay đổi.");
    if (location.href !== job.expectedUrl && !(job.awaitingReceipt && new URL(location.href).origin === new URL(job.expectedUrl).origin)) fail("MUSE_NAVIGATED", "Tab hoặc cuộc hội thoại Muse đã thay đổi; không tự gửi lại.");
    if (!job.clicked && job.userSnapshot && !sameTurns(job.userSnapshot, users())) fail("MUSE_CONVERSATION_CHANGED", "Nội dung hoặc số lượt gửi trên Muse đã thay đổi trong lúc chuẩn bị; chưa gửi prompt.");
    if (job.receipt) {
      // Muse can reformat/virtualize earlier chat turns while rendering media.
      // The submitted turn was already verified against the FULL prompt before
      // setting job.receipt. Afterwards pin it by its unique request markers
      // and reject any additional user turn, rather than comparing unrelated
      // history text that may be re-rendered by the site.
      const messages = users(), matches = messages.filter(el => hasReceiptMarkers(el, job));
      if (matches.length !== 1 || messages.at(-1) !== matches[0])
        fail("MUSE_CONVERSATION_CHANGED", "Không còn duy nhất lượt gửi đúng mã yêu cầu, hoặc đã có tin nhắn người dùng khác; không tự gán kết quả.");
      job.receipt = matches[0];
    }
  }
  async function notify(job, value) {
    const result = await chrome.runtime.sendMessage({ ...value, requestId: job.requestId, documentToken });
    if (!result?.ok) fail(result?.code || "CHROME_DELIVERY_FAILED", result?.error || "Extension không xác nhận dữ liệu.");
    return result;
  }
  const stage = (job, value) => notify(job, { type: "museStage", stage: value });
  async function hash(bytes) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
  function encode(bytes) { let value = ""; for (let i = 0; i < bytes.length; i += 8192) value += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(value); }
  function websiteError(job, roots = [], allowRefusal = false) {
    const alerts = [...document.querySelectorAll('[role="alert"],[data-testid*="toast" i],[data-testid*="error" i]')].filter(visible).map(textOf).filter(text => !job?.clicked || !job?.priorAlerts?.has(text));
    const messages = alerts.join("\n");
    if (/out of credits|insufficient (?:credits|balance)|not enough credits|quota (?:exceeded|exhausted)|hết (?:lượt|tín dụng)|额度不足|积分不足/i.test(messages)) fail("MUSE_QUOTA", "Muse đã hết quota hoặc số dư; chưa có kết quả.");
    if (/upload (?:failed|error)|failed to upload|tải (?:tệp|lên).{0,30}(?:lỗi|thất bại)|上传失败/i.test(messages)) fail("MUSE_UPLOAD_FAILED", "Muse báo lỗi tải tệp tham chiếu.");
    if (/session expired|please (?:sign|log) in|phiên.{0,20}hết hạn|登录已过期/i.test(messages) || !composer() && [...document.querySelectorAll('input[type="password"]')].some(visible)) fail("MUSE_LOGIN_REQUIRED", "Phiên Muse đã hết hạn hoặc cần đăng nhập lại.");
    if (/generation failed|failed to generate|something went wrong|tạo.{0,20}thất bại|生成失败/i.test(messages)) fail("MUSE_GENERATION_FAILED", "Muse báo tạo nội dung thất bại; không tự gửi lại.");
    if (allowRefusal && job?.kind !== "text" && !stopButton()) {
      const reply = roots.map(textOf).join("\n").replace(/\[RESPONSE_(?:BEGIN|END):[^\]]+\]/g, "").trim();
      const refusal = /^(?:(?:sorry|I'm sorry|I am sorry|xin lỗi|rất tiếc)[,!.\s]*(?:but\s+)?)?(?:(?:I|we) (?:cannot|can't|am unable to|are unable to|am not able to) (?:create|generate|produce|fulfill)|(?:tôi|mình).{0,30}không (?:thể|tạo được).{0,60}(?:ảnh|video|âm thanh|nội dung|cảnh|yêu cầu)|无法生成)/i.test(reply.slice(0, 400));
      if (refusal) {
        if (job.refusalText !== reply) { job.refusalText = reply; job.refusalSince = Date.now(); }
        else if (Date.now() - job.refusalSince >= 5000) fail("MUSE_REFUSED", "Muse từ chối hoặc không thể tạo nội dung yêu cầu; không tự đổi prompt hoặc gửi lại.");
      } else { job.refusalText = ""; job.refusalSince = 0; }
    }
  }
  async function waitReady(job) {
    const until = Date.now() + 15000;
    while (Date.now() < until) {
      guard(job); websiteError(job);
      const hydrated = document.querySelector("[data-hatch-shell-hydration-state]");
      const input = composer();
      if (input && (!hydrated || hydrated.getAttribute("data-hatch-shell-hydration-state") === "hydrated")) return input;
      await delay(250, job.controller.signal);
    }
    fail("MUSE_NOT_READY", "Muse chưa tải xong ô nhập. Mở trang chat và chờ giao diện sẵn sàng.");
  }
  function assertPreparedPrompt(job) {
    // Loading each reference can trigger a React re-render of the composer.
    // Do not continue loading (or submit) if any reference disturbed the
    // prompt already placed into this particular Muse tab.
    const current = composer();
    if (!current || normalized(current.value) !== normalized(job.prompt))
      fail("MUSE_COMPOSER_CHANGED", "Muse đã thay đổi prompt trong khi đính kèm ảnh; chưa gửi yêu cầu.");
    return current;
  }
  async function receiveReference(message) {
    if (message.type === "prepareReferences") {
      if (active || staging || !probe().ready || !Number.isInteger(message.count) || message.count < 0 || message.count > 8) fail("MUSE_DRAFT_NOT_EMPTY", "Tab chưa sẵn sàng hoặc còn prompt/tệp cũ trong ô nhập.");
      staging = { ...message, files: [], total: 0, incoming: null, userSnapshot: users().map(turnText), timer: setTimeout(clearStaging, 120000) }; return;
    }
    if (!staging || staging.requestId !== message.requestId) throw new Error("Không có tác vụ tham chiếu tương ứng.");
    guard(staging);
    if (message.type === "referenceStart") {
      if (staging.incoming || message.index !== staging.files.length || message.index >= staging.count || !Number.isInteger(message.size) || message.size <= 0 || staging.total + message.size > maxSize || !/^(image|video|audio)\/[a-z0-9.+-]+$/.test(message.mimeType) || typeof message.name !== "string" || message.name.length > 160 || !/^[a-f0-9]{64}$/.test(message.sha256)) throw new Error("Metadata tham chiếu không hợp lệ.");
      staging.incoming = { ...message, chunks: [], length: 0, sequence: 0 }; staging.total += message.size;
    } else if (message.type === "referenceChunk") {
      const file = staging.incoming;
      if (!file || message.sequence !== file.sequence || typeof message.data !== "string" || message.data.length > 90000) throw new Error("Khối tham chiếu không hợp lệ.");
      const bytes = Uint8Array.from(atob(message.data), ch => ch.charCodeAt(0));
      if (!bytes.length || bytes.length > 65536 || file.length + bytes.length > file.size) throw new Error("Dung lượng tham chiếu không khớp.");
      file.chunks.push(bytes); file.length += bytes.length; file.sequence++;
    } else {
      const file = staging.incoming;
      if (!file || file.length !== file.size) throw new Error("Chưa nhận đủ tệp tham chiếu.");
      const bytes = new Uint8Array(file.size); let offset = 0;
      for (const chunk of file.chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      if (await hash(bytes) !== file.sha256) throw new Error("Checksum tham chiếu không khớp.");
      staging.files.push(new File([bytes], file.name, { type: file.mimeType })); staging.incoming = null;
    }
  }
  async function attach(job, input) {
    let root = rootFor(input);
    if (!root) fail("MUSE_UPLOAD_CONTROL", "Không xác định được vùng nhập Muse.");
    if (attachmentCards(root).length || [...root.querySelectorAll('input[type="file"]')].some(el => el.files?.length)) fail("MUSE_DRAFT_NOT_EMPTY", "Còn tệp cũ trong ô nhập Muse; hãy bỏ chúng trước khi tạo yêu cầu mới.");
    if (!job.files.length) return;
    const accepts = (el, file) => !el.accept || el.accept.split(",").some(part => { part = part.trim().toLowerCase(); return part === "*/*" || part === file.type || part.endsWith("/*") && file.type.startsWith(part.slice(0, -1)) || part.startsWith(".") && file.name.toLowerCase().endsWith(part); });
    const findInput = file => {
      const local = [...root.querySelectorAll('input[type="file"]')].filter(el => !el.disabled && accepts(el, file));
      // Ambiguous upload controls may point at different Muse features.
      // Never guess one: a wrong control can result in media from an unrelated
      // composer (or a prompt sent without its reference).
      if (local.length > 1) return undefined;
      if (local.length === 1) return local[0];
      const others = [...document.querySelectorAll('input[type="file"]')].filter(el => !root.contains(el) && !el.disabled && accepts(el, file));
      return others.length === 1 ? others[0] : undefined;
    };
    async function upload(file) {
      guard(job); websiteError(job);
      let control = findInput(file);
      if (!control) {
        const button = [...root.querySelectorAll('button,[role="button"],label')].find(el => visible(el) && /attach|upload|image|photo|file|add|đính kèm|tải lên|thêm|上传/i.test(`${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""} ${textOf(el)}`));
        if (button) { button.click(); await delay(350, job.controller.signal); control = findInput(file); }
      }
      if (!control) fail("MUSE_UPLOAD_CONTROL", "Không tìm thấy ô chọn ảnh/tệp trên Muse; chưa bấm Gửi.");
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files")?.set;
      if (!setter) fail("MUSE_UPLOAD_CONTROL", "Trình duyệt không cho đặt tệp vào ô upload.");
      const data = new DataTransfer(); data.items.add(file); setter.call(control, data.files);
      (job.uploadControls ??= new Set()).add(control);
      const picked = control.files?.[0];
      if (!picked || control.files.length !== 1 || picked.name !== file.name
        || picked.size !== file.size || picked.type !== file.type)
        fail("MUSE_UPLOAD_UNVERIFIED", "Muse không xác nhận đúng tệp tham chiếu đã chọn; chưa nhấn Gửi.");
      // The site may legitimately reset the file input synchronously on change.
      // Verify the native FileList BEFORE letting its handler consume the file.
      control.dispatchEvent(new Event("input", { bubbles: true, composed: true })); control.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }
    // Luôn tải tuần tự theo thứ tự tham chiếu, kể cả khi Muse cho phép chọn nhiều tệp.
    for (const [index, file] of job.files.entries()) {
      assertPreparedPrompt(job);
      await upload(file);
      const deadline = Date.now() + 60000; let stableSince = 0;
      while (true) {
        guard(job); websiteError(job);
        assertPreparedPrompt(job);
        if (Date.now() >= deadline) fail("MUSE_UPLOAD_TIMEOUT", `Ảnh/tệp tham chiếu ${index + 1} chưa tải xong; chưa bấm Gửi.`);
        const currentInput = composer();
        if (currentInput) root = rootFor(currentInput) || root;
        const cards = attachmentCards(root);
        const ready = cards.length === index + 1 && !pendingUploads(root)
          && !root.querySelector('[data-upload-state="error"],[data-status="failed"]')
          && cards.every(card => [...card.querySelectorAll("img")].every(img => img.complete && img.naturalWidth > 0));
        if (ready) {
          if (!stableSince) stableSince = Date.now();
          if (Date.now() - stableSince >= 1500) break;
        } else stableSince = 0;
        await delay(250, job.controller.signal);
      }
      // Next reference is staged only when exactly one new preview is stable
      // and the prompt is still intact. A partial upload never triggers Send.
      assertPreparedPrompt(job);
    }
  }
  function mediaUrl(el) { return el.currentSrc || el.src || el.querySelector?.("source[src]")?.src || el.getAttribute?.("data-video-src") || el.getAttribute?.("data-download-url") || el.href || ""; }
  function responseRoots(job) {
    const roots = [...document.querySelectorAll(assistantSelector)].filter(root =>
      (visible(root) || getComputedStyle(root).display === "contents" && [...root.children].some(visible))
      && !root.contains(job.receipt) && !root.closest(userSelector)
      && (job.receipt.compareDocumentPosition(root) & Node.DOCUMENT_POSITION_FOLLOWING));
    return roots.filter(root => !roots.some(parent => parent !== root && parent.contains(root)));
  }
  function resultCandidates(job, roots, baseline) {
    const candidates = [];
    const selector = `${job.kind === "image" ? "img" : job.kind},${job.kind === "image" ? "img" : job.kind + " source[src]"},a[href],[data-video-src],[data-download-url]`;
    const begin = "[RESPONSE_BEGIN:" + job.requestId + "]", end = "[RESPONSE_END:" + job.requestId + "]";
    const begins = roots.filter(root => textOf(root).includes(begin));
    const ends = roots.filter(root => textOf(root).includes(end));
    // Media on Muse can be rendered in its own card between two separate
    // assistant text bubbles. Only collect media between this request's
    // RESPONSE markers; never scrape arbitrary images elsewhere in the chat.
    if (begins.length !== 1 || ends.length !== 1) return []; // incomplete or ambiguous response, never guess
    const first = begins[0], last = ends[0];
    if (first !== last && !(first.compareDocumentPosition(last) & Node.DOCUMENT_POSITION_FOLLOWING)) return [];
    const elements = first === last ? [...first.querySelectorAll(selector)]
      : [...document.querySelectorAll(selector)].filter(el =>
        !!(first.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
        && !!(el.compareDocumentPosition(last) & Node.DOCUMENT_POSITION_FOLLOWING));
    for (const el of elements) {
      if (el.closest(userSelector)) continue;
      const url = mediaUrl(el); if (!url || baseline.has(url)) continue;
      if (el.tagName === "IMG" && (!visible(el) || !el.complete || el.naturalWidth < 128 || el.naturalHeight < 128)) continue;
      if (["VIDEO", "AUDIO"].includes(el.tagName) && el.readyState < 1) continue;
      if (el.tagName === "A" || el.hasAttribute("data-video-src") || el.hasAttribute("data-download-url")) {
        const hint = `${el.getAttribute("type") || ""} ${el.getAttribute("download") || ""} ${url}`;
        const format = job.kind === "image" ? /image\/|\.(?:png|jpe?g|webp)(?:[?#\s]|$)/i : job.kind === "video" ? /video\/|\.(?:mp4|webm)(?:[?#\s]|$)/i : /audio\/|\.(?:mp3|wav|ogg|flac|m4a|webm)(?:[?#\s]|$)/i;
        if (!format.test(hint) && !el.hasAttribute("data-download-url")) continue;
      }
      candidates.push({ el, url });
    }
    return [...new Map(candidates.map(value => [value.url, value])).values()];
  }
  async function downloadedBlob(candidate, job) {
    guard(job);
    const url = new URL(candidate.url, location.href);
    if (!["https:", "blob:", "data:"].includes(url.protocol)) fail("MUSE_DOWNLOAD_FAILED", "Địa chỉ tệp kết quả không hợp lệ.");
    let chunks = [], mime = "";
    try {
      const response = await fetch(url.href, { credentials: "include", signal: AbortSignal.any([job.controller.signal, AbortSignal.timeout(60000)]) });
      if (!response.ok || Number(response.headers.get("content-length")) > maxSize) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}, hoặc vượt 64 MB.`); }
      const reader = response.body?.getReader(); if (!reader) throw new Error("Kết quả Muse không có dữ liệu.");
      let size = 0;
      try { while (true) { guard(job); const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > maxSize) fail("MUSE_RESULT_TOO_LARGE", "Kết quả Muse vượt 64 MB."); chunks.push(value); } }
      finally { await reader.cancel().catch(() => {}); }
      mime = response.headers.get("content-type") || "";
    } catch (cause) {
      guard(job);
      if (cause.code === "MUSE_RESULT_TOO_LARGE") throw cause;
      if (url.protocol !== "https:") fail("MUSE_DOWNLOAD_FAILED", "Không đọc được blob/luồng media Muse. Cần URL tệp tải được.");
      chunks = [];
      const download = await notify(job, { type: "museDownloadStart", url: url.href });
      try {
        mime = download.mimeType; let sequence = 0, size = 0;
        while (true) {
          guard(job);
          const chunk = await notify(job, { type: "museDownloadChunk", transferId: download.transferId, sequence });
          if (chunk.sequence !== sequence) fail("MUSE_DOWNLOAD_FAILED", "Thứ tự khối tải không khớp.");
          if (chunk.done) { if (chunk.size !== size) fail("MUSE_DOWNLOAD_FAILED", "Tổng byte tải không khớp."); break; }
          if (typeof chunk.data !== "string" || chunk.data.length > 90000) fail("MUSE_DOWNLOAD_FAILED", "Khối tải không hợp lệ.");
          const bytes = Uint8Array.from(atob(chunk.data), ch => ch.charCodeAt(0));
          size += bytes.length;
          if (!bytes.length || bytes.length > 65536 || size > maxSize) fail("MUSE_RESULT_TOO_LARGE", "Khối tải trống hoặc vượt dung lượng.");
          chunks.push(bytes); sequence++;
        }
      } finally { await chrome.runtime.sendMessage({ type: "museDownloadCancel", transferId: download.transferId, requestId: job.requestId, documentToken }).catch(() => {}); }
    }
    if (!chunks.reduce((size, part) => size + part.length, 0)) fail("MUSE_DOWNLOAD_FAILED", "Tệp kết quả Muse trống.");
    mime = mime.split(";")[0].trim().toLowerCase();
    mime = ({ "image/jpg": "image/jpeg", "audio/mp3": "audio/mpeg", "audio/x-wav": "audio/wav" })[mime] || mime;
    const head = new Uint8Array(await new Blob(chunks).slice(0, 16).arrayBuffer());
    const ascii = String.fromCharCode(...head);
    if (head[0] === 137 && ascii.slice(1, 4) === "PNG") mime = "image/png";
    else if (head[0] === 255 && head[1] === 216 && head[2] === 255) mime = "image/jpeg";
    else if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") mime = "image/webp";
    else if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE") mime = "audio/wav";
    else if (ascii.startsWith("fLaC")) mime = "audio/flac";
    else if (ascii.startsWith("OggS")) mime = "audio/ogg";
    else if (ascii.startsWith("ID3") || head[0] === 255 && (head[1] & 224) === 224 && (head[1] & 6) !== 0) mime = "audio/mpeg";
    else if (ascii.slice(4, 8) === "ftyp" && (!mime || mime === "application/octet-stream")) mime = job.kind === "audio" ? "audio/mp4" : "video/mp4";
    else if (head[0] === 26 && head[1] === 69 && head[2] === 223 && head[3] === 163 && (!mime || mime === "application/octet-stream")) mime = job.kind === "audio" ? "audio/webm" : "video/webm";
    if (!mime.startsWith(`${job.kind}/`)) fail("MUSE_MEDIA_TYPE_MISMATCH", "Tệp thực tế không đúng loại yêu cầu; không dùng poster thay video.");
    if (!job.response.mimeTypes.includes(mime)) fail("MUSE_MEDIA_UNSUPPORTED", `Định dạng ${mime} chưa được hỗ trợ; không tự chuyển đổi tệp.`);
    const blob = new Blob(chunks, { type: mime });
    await inspectBlob(blob, job);
    return blob;
  }
  async function inspectBlob(blob, job) {
    if (job.kind === "image") { const bitmap = await createImageBitmap(blob).catch(() => null); if (!bitmap) fail("MUSE_MEDIA_INVALID", "Tệp ảnh Muse không giải mã được."); bitmap.close(); return; }
    const el = document.createElement(job.kind), url = URL.createObjectURL(blob);
    try {
      await new Promise((resolve, reject) => {
        let timer;
        const cleanup = () => { clearTimeout(timer); job.controller.signal.removeEventListener("abort", abort); el.onloadedmetadata = null; el.onerror = null; };
        const abort = () => { cleanup(); reject(new Error("Đã dừng đọc media.")); };
        timer = setTimeout(() => { cleanup(); reject(new Error("Không đọc được metadata tệp media Muse.")); }, 10000);
        el.onloadedmetadata = () => { cleanup(); if (Number.isNaN(el.duration) || el.duration <= 0 || job.kind === "video" && (!el.videoWidth || !el.videoHeight)) reject(new Error("Tệp media không có nội dung phát được.")); else resolve(); };
        el.onerror = () => { cleanup(); reject(new Error("Trình duyệt không giải mã được tệp Muse trả về.")); };
        job.controller.signal.addEventListener("abort", abort, { once: true }); el.preload = "metadata"; el.src = url;
      });
    } finally { el.removeAttribute("src"); el.load(); URL.revokeObjectURL(url); }
  }
  async function transfer(job, blob) {
    guard(job);
    if (!blob.size || blob.size > job.response.maxBytes) fail("MUSE_RESULT_TOO_LARGE", "Kết quả trống hoặc vượt dung lượng cho phép.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    job.transferring = true;
    await notify(job, { type: "museResultStart", size: bytes.length, mimeType: blob.type, sha256: await hash(bytes) });
    let sequence = 0;
    for (let offset = 0; offset < bytes.length; offset += 65536) { guard(job); await notify(job, { type: "museResultChunk", sequence: sequence++, data: encode(bytes.subarray(offset, offset + 65536)) }); }
    await notify(job, { type: "museResultEnd" });
    return { ok: true, transferred: true };
  }
  function upwardArrow(el) {
    return [...el.querySelectorAll("svg")].some(svg => {
      const paths = [...svg.querySelectorAll("path")].map(path => path.getAttribute("d") || "").join(" ").replace(/[\s,]+/g, "").toLowerCase();
      const lines = [...svg.querySelectorAll("line")];
      const shaft = lines.some(line => line.getAttribute("x1") === line.getAttribute("x2")
        && Number(line.getAttribute("y1")) > Number(line.getAttribute("y2")));
      const tip = [...svg.querySelectorAll("polyline")].some(line => /5\s*12[\s,]+12\s*5[\s,]+19\s*12/i.test(line.getAttribute("points") || ""));
      // Muse sometimes renders only an SVG arrow, with no aria-label/testid.
      // Match the arrow shaft AND its upward head; never guess other icon buttons.
      return (/m12(?:19v-?14|5v14)/.test(paths) && /m5(?:12(?:l)?7-7(?:l)?7(?:7|-?7))/.test(paths))
        || shaft && tip;
    });
  }
  function sendButton(root) {
    if (!root) return;
    // The arrow may be a sibling of the textarea wrapper, outside rootFor's
    // eight-level boundary. Search only adjacent composer ancestors, not the page.
    for (let scope = root, depth = 0; scope && scope !== document.body && scope.tagName !== "MAIN" && depth < 5; scope = scope.parentElement, depth++) {
      const ranked = [...scope.querySelectorAll('button,[role="button"],input[type="submit"]')]
        .filter(el => visible(el) && !el.matches(':disabled') && el.getAttribute("aria-disabled") !== "true")
        .map(el => {
          const label = [el.getAttribute("aria-label"), el.getAttribute("data-testid"), el.getAttribute("title"), textOf(el),
            ...(el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean).map(id => document.getElementById(id)?.textContent)].filter(Boolean).join(" ");
          if (/stop|cancel|upload|attach|delete|remove|dừng|hủy|tải lên|đính kèm|xóa|xoá/i.test(label)) return { el, score: 0 };
          const icon = [...el.querySelectorAll("svg,[data-icon]")].map(item => [item.getAttribute("class"), item.getAttribute("data-icon"), item.getAttribute("data-lucide")].join(" ")).join(" ");
          const score = el.matches('[data-testid="hatch-composer-send-button"]') || /send|submit prompt|gửi|发送/i.test(label) ? 4
            : /arrow[-_ ]?up|paper[-_ ]?plane|send/i.test(icon) || upwardArrow(el) ? 3
            : el.matches('input[type="submit"],button[type="submit"]') && !!el.closest("form") ? 1 : 0;
          return { el, score };
        }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
      if (ranked.length) return ranked[0].score !== ranked[1]?.score ? ranked[0].el : undefined;
    }
  }
  async function generate(job) {
    guard(job); let input = await waitReady(job);
    if (input.value.trim() || stopButton()) fail("MUSE_DRAFT_NOT_EMPTY", "Để trống ô nhập Muse và chờ tác vụ khác hoàn tất.");
    job.referenceCount = job.files.length;
    // Bước 1: đưa yêu cầu vào ô nhập Muse. Bước 2: thêm từng ảnh và chờ ảnh tải xong.
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (!setter) fail("MUSE_COMPOSER_UNSUPPORTED", "Ô nhập Muse không hỗ trợ cách nhập hiện tại.");
    input.focus(); setter.call(input, job.prompt); input.dispatchEvent(new Event("input", { bubbles: true, composed: true })); input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    await delay(100, job.controller.signal);
    assertPreparedPrompt(job);
    await attach(job, input); job.files = []; await stage(job, "referencesAttached");
    input = await waitReady(job);
    const baseline = new Set([...document.querySelectorAll('img,video,audio,a[href],[data-video-src],[data-download-url]')].map(mediaUrl));
    // Bước 3: chỉ nhấn Gửi một lần sau khi số ảnh và ô nhập đều khớp.
    let root, send;
    for (let i = 0; i < 150; i++) {
      guard(job); websiteError(job);
      const currentInput = composer();
      if (currentInput) {
        assertPreparedPrompt(job);
        input = currentInput; root = rootFor(input); send = sendButton(root);
        if (send && !pendingUploads(root)) break;
      }
      await delay(100, job.controller.signal);
    }
    if (!send?.isConnected) fail("MUSE_SEND_NOT_FOUND", "Không tìm thấy duy nhất nút Gửi có thể nhấn (kể cả nút mũi tên lên). Prompt chưa được gửi.");
    if (composer() !== input || normalized(input.value) !== normalized(job.prompt)) fail("MUSE_COMPOSER_CHANGED", "Ô nhập Muse thay đổi trước khi gửi. Chưa gửi prompt.");
    if (stopButton() || pendingUploads(root) || attachmentCards(root).length !== job.referenceCount) fail("MUSE_SEND_UNAVAILABLE", "Muse vẫn đang tạo nội dung, tải tệp hoặc số tham chiếu đã thay đổi. Chưa gửi prompt.");
    guard(job); job.awaitingReceipt = true; job.clicked = true; send.click();
    for (let i = 0; i < 30; i++) {
      const messages = users(), newUsers = messages.slice(job.userSnapshot.length);
      if (!sameTurns(job.userSnapshot, messages.slice(0, job.userSnapshot.length)) || newUsers.length > 1) fail("MUSE_CONVERSATION_CHANGED", "Có lượt gửi khác hoặc lịch sử hội thoại thay đổi lúc gửi; không tự gửi lại.");
      const receipt = newUsers.find(el => isReceipt(el, job));
      if (receipt) {
        job.receipt = receipt;
        if (location.href !== job.expectedUrl) {
          if (new URL(location.href).origin !== new URL(job.expectedUrl).origin) fail("MUSE_NAVIGATED", "Muse đã chuyển sang trang khác.");
          const fromUrl = job.expectedUrl; job.expectedUrl = location.href;
          await notify(job, { type: "museNavigation", fromUrl, url: job.expectedUrl });
        }
        break;
      }
      guard(job); websiteError(job); await delay(500, job.controller.signal);
    }
    job.awaitingReceipt = false;
    if (!job.receipt) fail("MUSE_SUBMISSION_UNKNOWN", "Không xác định được tin nhắn có đủ ID đầu/cuối sau khi bấm gửi. Kiểm tra tab; không gửi lại.");
    if (root.isConnected && !attachmentCards(root).length) for (const control of job.uploadControls ?? []) if (control.isConnected) control.value = "";
    guard(job); await stage(job, "submitted"); await stage(job, "waitingResult");
    const deadline = Date.now() + 15 * 60 * 1000; let previous = "", stable = 0;
    while (Date.now() < deadline) {
      guard(job); const roots = responseRoots(job);
      const candidates = job.kind === "text" ? [] : resultCandidates(job, roots, baseline);
      websiteError(job, roots, !candidates.length);
      if (job.kind === "text") {
        const begin = `[RESPONSE_BEGIN:${job.requestId}]`, end = `[RESPONSE_END:${job.requestId}]`;
        const reply = roots.map(textOf).join("\n"), start = reply.indexOf(begin), finish = reply.indexOf(end, start + begin.length);
        const text = start >= 0 && finish >= start + begin.length ? reply.slice(start + begin.length, finish).trim() : "";
        if (text && !stopButton()) { stable = text === previous ? stable + 1 : 0; previous = text; if (stable >= 1) return transfer(job, new Blob([text], { type: "text/plain" })); }
        else { previous = ""; stable = 0; }
      } else {
        const signature = candidates.map(value => value.url).join("\n");
        if (signature && !stopButton()) {
          stable = signature === previous ? stable + 1 : 0; previous = signature;
          if (stable >= 1) {
            let error;
            for (const candidate of candidates.slice().reverse()) {
              try { return await transfer(job, await downloadedBlob(candidate, job)); }
              catch (cause) { guard(job); if (job.transferring) throw cause; error = cause; }
            }
            throw error || new Error("Không tải được kết quả Muse.");
          }
        } else { previous = ""; stable = 0; }
      }
      await delay(5000, job.controller.signal);
    }
    fail("MUSE_RESULT_TIMEOUT", "Hết thời gian chờ: Muse chưa trả tệp phù hợp hoặc thiếu dấu RESPONSE. Không tự gửi lại.");
  }
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (message.type === "probe") { reply(probe()); return false; }
    if (message.documentToken !== documentToken || message.expectedUrl !== location.href || !/^[a-f0-9-]{36}$/.test(message.requestId)) { reply({ ok: false, error: "Trang Muse hoặc ID tác vụ đã thay đổi." }); return false; }
    if (message.type === "cancel") {
      if (staging?.requestId === message.requestId) clearStaging();
      if (active?.requestId === message.requestId) { if (active.receipt?.isConnected && users().at(-1) === active.receipt) stopButton()?.click(); active.controller.abort(); }
      reply({ ok: true }); return false;
    }
    const failure = (error, notSubmitted = false) => reply({ ok: false, code: error.code || "MUSE_ERROR", error: String(error.message || error).slice(0, 1000), ...(notSubmitted ? { notSubmitted: true } : {}) });
    if (["prepareReferences", "referenceStart", "referenceChunk", "referenceEnd"].includes(message.type)) {
      receiveReference(message).then(() => reply({ ok: true }), error => { if (staging?.requestId === message.requestId) clearStaging(); failure(error, true); }); return true;
    }
    if (message.type !== "generate") return false;
    if (active || !staging || staging.requestId !== message.requestId || staging.incoming || staging.files.length !== staging.count || !["text", "image", "video", "audio"].includes(message.kind) || typeof message.prompt !== "string" || message.prompt.length > 104000
      || message.response?.kind !== message.kind || !Array.isArray(message.response?.mimeTypes) || !Number.isInteger(message.response?.maxBytes) || message.response.maxBytes <= 0 || message.response.maxBytes > (message.kind === "text" ? 1024 * 1024 : maxSize)) { reply({ ok: false, error: "Yêu cầu hoặc tham chiếu chưa sẵn sàng." }); return false; }
    const job = active = { ...message, files: staging.files, userSnapshot: staging.userSnapshot, priorAlerts: new Set([...document.querySelectorAll('[role="alert"],[data-testid*="toast" i],[data-testid*="error" i]')].filter(visible).map(textOf)), controller: new AbortController(), receipt: null };
    clearStaging(); generate(job).then(reply, error => failure(error, !job.clicked)).finally(() => { if (active === job) active = undefined; }); return true;
  });
})();
