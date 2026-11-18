// Narrow ChatGPT / Gemini DOM adapter. Never sends outside a pinned MacFlow task.
// Unknown UI, upload confirmation or output shape always fails closed.
(() => {
  const host = location.hostname.toLowerCase();
  const provider = ["chatgpt.com", "chat.openai.com"].includes(host) ? "chatgpt"
    : host === "gemini.google.com" ? "gemini" : null;
  if (!provider || globalThis.macflowSiteBridgeInstalled) return;
  globalThis.macflowSiteBridgeInstalled = true;
  const documentToken = crypto.randomUUID();
  const maxBytes = 64 * 1024 * 1024;
  const selectors = provider === "chatgpt" ? {
    input: '[data-testid="composer-text-input"][contenteditable="true"],#prompt-textarea[contenteditable="true"],textarea[data-testid="composer-text-input"]',
    user: '[data-message-author-role="user"]',
    assistant: '[data-message-author-role="assistant"]',
  } : {
    input: 'rich-textarea [contenteditable="true"][role="textbox"],rich-textarea [contenteditable="true"],[aria-label="Enter a prompt here"][contenteditable="true"]',
    user: 'user-query', assistant: 'model-response',
  };
  let staging, active;
  function failure(code, message) { throw Object.assign(new Error(message), { code }); }
  const visible = el => !!el?.isConnected && !!el.getClientRects().length
    && getComputedStyle(el).visibility !== "hidden" && !el.closest('[hidden],[aria-hidden="true"]');
  const compact = s => String(s || "").replace(/\s+/g, " ").trim();
  const text = el => el?.innerText || el?.textContent || "";
  function unique(elements) {
    const result = elements.filter(visible);
    return result.length === 1 ? result[0] : null;
  }
  function composer() {
    return unique([...document.querySelectorAll(selectors.input)]
      .filter(el => !el.matches(':disabled,[aria-disabled="true"]')));
  }
  const value = el => el?.matches("input,textarea") ? el.value : text(el);
  function label(el) {
    return [el.getAttribute("aria-label"), el.getAttribute("data-testid"), el.getAttribute("title"),
      el.getAttribute("mattooltip"), el.getAttribute("data-tooltip"), text(el)]
      .filter(Boolean).join(" ");
  }
  function buttons(root, includeDisabled = false) {
    return [...(root || document).querySelectorAll('button,[role="button"],input[type="submit"]')]
      .filter(el => visible(el) && (includeDisabled || !el.disabled && el.getAttribute("aria-disabled") !== "true"));
  }
  function sendButton(input) {
    if (!input) return null;
    let root = input.closest("form") || input;
    for (let i = 0; root && i < 7; i++, root = root.parentElement) {
      const found = buttons(root, true).filter(el => {
        const s = label(el);
        if (/stop|cancel|attach|upload|microphone|voice|dừng|đính kèm|tải lên|停止/i.test(s)) return false;
        return /send|submit|gửi|发送/i.test(s);
      });
      if (found.length === 1) return found[0];
      if (found.length > 1) return null;
    }
    return null;
  }
  function rootFor(input) {
    if (!input) return null;
    const button = sendButton(input);
    if (!button) return null;
    let root = input;
    for (let i = 0; root && i < 8; i++, root = root.parentElement)
      if (root.contains(button)) return root;
    return null;
  }
  function turns(selector) {
    const all = [...document.querySelectorAll(selector)].filter(visible);
    return all.filter(el => !all.some(other => el !== other && other.contains(el)));
  }
  const users = () => turns(selectors.user);
  const assistants = () => turns(selectors.assistant);
  function turnText(el) {
    const copy = el.cloneNode(true);
    for (const control of copy.querySelectorAll('button,input,textarea,svg,style,script,[aria-hidden="true"]')) control.remove();
    return compact(copy.textContent);
  }
  const same = (saved, nodes) => saved.length === nodes.length
    && saved.every((s, i) => s === turnText(nodes[i]));
  const pending = root => !!root && [...root.querySelectorAll(
    '[role="progressbar"],[aria-busy="true"],[data-upload-state="uploading"],[data-status="uploading"]')].some(visible);
  const cards = root => {
    if (!root) return [];
    const matched = [...root.querySelectorAll(
      '[data-testid*="attachment" i],[data-testid*="upload" i],[data-upload-state],[data-status="uploading"]')]
      .filter(el => visible(el) && !el.matches("button,input,label") && (el.querySelector("img") || /\.[a-z0-9]{2,6}\b/i.test(text(el))));
    return matched.filter(el => !matched.some(child => el !== child && el.contains(child)));
  };
  function exactPreviews(root, files) {
    const shown = cards(root);
    return shown.length === files.length && files.every((file, index) =>
      text(shown[index]).includes(file.name) || shown[index].getAttribute("title") === file.name);
  }
  function pageBusy() {
    const root = rootFor(composer());
    return !!root && buttons(root).some(el => /stop|cancel response|dừng tạo|停止生成/i.test(label(el)))
      || buttons(document).some(el => /stop[-_ ]?(generating|response|button)|cancel response|dừng tạo|停止生成/i.test(label(el)));
  }
  function busy() { return !!active || !!staging || pageBusy(); }
  function probe() {
    const input = composer(), root = rootFor(input);
    const occupied = busy();
    const draftFiles = !!root && (cards(root).length > 0
      || [...root.querySelectorAll('input[type="file"]')].some(el => el.files?.length > 0));
    const reason = !input ? "SITE_COMPOSER_NOT_FOUND" : !sendButton(input) ? "SITE_SEND_NOT_FOUND"
      : compact(value(input)) ? "SITE_DRAFT_TEXT" : draftFiles ? "SITE_DRAFT_FILES"
      : pending(root) ? "SITE_UPLOAD_PENDING" : occupied ? "SITE_BUSY" : "";
    return {
      provider, documentToken, url: location.href, capable: !!input && !!root,
      ready: !reason, busy: occupied, notReadyReason: reason,
      // Only text is reported until generated-media DOM and binary capture are verified.
      outputKinds: ["text"],
    };
  }
  function guard(job) {
    job.controller?.signal.throwIfAborted();
    if (job.documentToken !== documentToken || location.href !== job.expectedUrl
      && !(job.clicked && job.awaitingReceipt && new URL(location.href).origin === new URL(job.expectedUrl).origin))
      failure("SITE_NAVIGATED", "Trang AI hoặc hội thoại đã đổi; không tự gửi lại.");
    if (!job.clicked && job.userSnapshot && !same(job.userSnapshot, users()))
      failure("SITE_CONVERSATION_CHANGED", "Hội thoại thay đổi trước khi gửi prompt.");
  }
  function clearStage() { if (staging?.timer) clearTimeout(staging.timer); staging = undefined; }
  async function delay(ms, signal) {
    await new Promise((resolve, reject) => {
      signal?.throwIfAborted();
      const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, ms);
      const abort = () => { clearTimeout(timer); reject(new Error("Đã dừng theo dõi.")); };
      signal?.addEventListener("abort", abort, { once: true });
    });
  }
  const hash = async bytes => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map(v => v.toString(16).padStart(2, "0")).join("");
  function encode(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(s);
  }
  async function notify(job, msg) {
    const reply = await chrome.runtime.sendMessage({ ...msg, requestId: job.requestId, documentToken });
    if (!reply?.ok) failure(reply?.code || "SITE_DELIVERY_FAILED", reply?.error || "MacFlow không xác nhận.");
    return reply;
  }
  async function receiveReference(msg) {
    if (msg.type === "prepareReferences") {
      if (active || staging || !probe().ready || !Number.isInteger(msg.count) || msg.count < 0 || msg.count > 8)
        failure("SITE_NOT_READY", "Tab đang bận hoặc có bản nháp; chưa nhập prompt.");
      staging = { requestId: msg.requestId, documentToken, expectedUrl: msg.expectedUrl,
        userSnapshot: users().map(turnText), files: [], incoming: null, count: msg.count, total: 0,
        timer: setTimeout(clearStage, 120000) };
      return;
    }
    if (!staging || staging.requestId !== msg.requestId) failure("SITE_NOT_PREPARED", "Không có gói tham chiếu.");
    guard(staging);
    if (msg.type === "referenceStart") {
      if (staging.incoming || msg.index !== staging.files.length || msg.index >= staging.count
        || !Number.isInteger(msg.size) || msg.size < 1 || staging.total + msg.size > maxBytes
        || !/^(image|video|audio)\/[a-z0-9.+-]+$/.test(msg.mimeType)
        || typeof msg.name !== "string" || !/^[a-zA-Z0-9._-]{1,160}$/.test(msg.name)
        || !/^[a-f0-9]{64}$/.test(msg.sha256)) failure("SITE_BAD_REFERENCE", "Metadata tham chiếu không hợp lệ.");
      staging.total += msg.size;
      staging.incoming = { ...msg, chunks: [], length: 0, sequence: 0 };
    } else if (msg.type === "referenceChunk") {
      const file = staging.incoming;
      if (!file || msg.sequence !== file.sequence || typeof msg.data !== "string" || msg.data.length > 90000)
        failure("SITE_BAD_REFERENCE", "Khối tham chiếu sai thứ tự.");
      const bytes = Uint8Array.from(atob(msg.data), c => c.charCodeAt(0));
      if (!bytes.length || bytes.length > 65536 || file.length + bytes.length > file.size)
        failure("SITE_BAD_REFERENCE", "Dung lượng tham chiếu không khớp.");
      file.chunks.push(bytes); file.length += bytes.length; file.sequence++;
    } else if (msg.type === "referenceEnd") {
      const file = staging.incoming;
      if (!file || file.length !== file.size) failure("SITE_BAD_REFERENCE", "Chưa nhận đủ tham chiếu.");
      const bytes = new Uint8Array(file.size);
      let offset = 0;
      for (const part of file.chunks) { bytes.set(part, offset); offset += part.length; }
      if (await hash(bytes) !== file.sha256) failure("SITE_BAD_REFERENCE", "Checksum tham chiếu không khớp.");
      staging.files.push(new File([bytes], file.name, { type: file.mimeType }));
      staging.incoming = null;
    }
  }
  function accepts(input, file) {
    return !input.accept || input.accept.split(",").some(raw => {
      const part = raw.trim().toLowerCase();
      return part === "*/*" || part === file.type
        || part.endsWith("/*") && file.type.startsWith(part.slice(0, -1))
        || part.startsWith(".") && file.name.toLowerCase().endsWith(part);
    });
  }
  async function attach(job) {
    if (!job.files.length) return;
    let input = composer(), root = rootFor(input);
    if (!root || cards(root).length || pending(root)) failure("SITE_DRAFT_FILES", "Có tệp cũ hoặc upload chưa hoàn tất.");
    for (const [index, file] of job.files.entries()) {
      guard(job);
      const all = [...document.querySelectorAll('input[type="file"]')].filter(el => !el.disabled && accepts(el, file));
      const local = all.filter(el => root.contains(el));
      const control = local.length === 1 ? local[0] : !local.length && all.length === 1 ? all[0] : null;
      if (!control) failure("SITE_UPLOAD_UNVERIFIED", "Không xác định được duy nhất ô upload; chưa gửi.");
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files")?.set;
      if (!setter) failure("SITE_UPLOAD_UNVERIFIED", "Không thể gắn tệp tham chiếu.");
      const transfer = new DataTransfer(); transfer.items.add(file); setter.call(control, transfer.files);
      (job.uploadControls ||= new Set()).add(control);
      const picked = control.files?.[0];
      if (!picked || control.files.length !== 1 || picked.name !== file.name
        || picked.size !== file.size || picked.type !== file.type)
        failure("SITE_UPLOAD_UNVERIFIED", "Trang AI không giữ đúng tệp tham chiếu đã chọn; chưa bấm Gửi.");
      control.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      control.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      let since = 0, confirmed = false;
      const until = Date.now() + 60000;
      while (Date.now() < until) {
        guard(job);
        input = composer(); root = rootFor(input) || root;
        // Never treat an unrelated thumbnail as proof: the filename MUST be visible.
        const matching = exactPreviews(root, job.files.slice(0, index + 1));
        if (root?.querySelector('[data-upload-state="error"],[data-status="failed"]'))
          failure("SITE_UPLOAD_FAILED", "Trang AI báo upload thất bại.");
        if (matching && !pending(root)) {
          if (!since) since = Date.now();
          if (Date.now() - since >= 1500) { confirmed = true; break; }
        } else since = 0;
        await delay(300, job.controller.signal);
      }
      if (!confirmed) failure("SITE_UPLOAD_UNVERIFIED", "Không xác nhận được tệp tham chiếu thứ " + (index + 1) + "; chưa gửi.");
    }
  }
  function insertPrompt(input, prompt) {
    input.focus();
    if (input.matches("input,textarea")) {
      const proto = input.matches("textarea") ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (!setter) failure("SITE_COMPOSER_UNSUPPORTED", "Không thể nhập prompt.");
      setter.call(input, prompt);
      input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: prompt }));
      input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    } else if (input.isContentEditable) {
      const selection = getSelection(), range = document.createRange();
      range.selectNodeContents(input); selection.removeAllRanges(); selection.addRange(range);
      if (!document.execCommand("insertText", false, prompt))
        failure("SITE_COMPOSER_UNSUPPORTED", "Trang AI không nhận phương thức nhập văn bản.");
    } else failure("SITE_COMPOSER_UNSUPPORTED", "Ô nhập chưa được hỗ trợ.");
  }
  async function transfer(job, result) {
    guard(job);
    const bytes = new TextEncoder().encode(result);
    if (!bytes.length || bytes.length > job.response.maxBytes || bytes.length > 1024 * 1024)
      failure("SITE_RESULT_TOO_LARGE", "Đầu ra trống hoặc vượt giới hạn.");
    job.transferring = true;
    await notify(job, { type: "museResultStart", size: bytes.length, mimeType: "text/plain", sha256: await hash(bytes) });
    let sequence = 0;
    for (let offset = 0; offset < bytes.length; offset += 65536) {
      guard(job);
      await notify(job, { type: "museResultChunk", sequence: sequence++, data: encode(bytes.subarray(offset, offset + 65536)) });
    }
    await notify(job, { type: "museResultEnd" });
    return { ok: true, transferred: true };
  }
  async function generate(job) {
    guard(job);
    if (job.kind !== "text") failure("SITE_UNSUPPORTED_KIND", "Adapter chỉ hỗ trợ kết quả văn bản.");
    let input = composer(), root = rootFor(input);
    if (!input || !root || compact(value(input)) || pageBusy())
      failure("SITE_NOT_READY", "Tab đang bận hoặc có bản nháp; chưa gửi.");
    insertPrompt(input, job.prompt);
    await delay(300, job.controller.signal);
    if (compact(value(composer())) !== compact(job.prompt))
      failure("SITE_COMPOSER_UNSUPPORTED", "Ô nhập không giữ đúng prompt; chưa gửi.");
    await attach(job);
    job.referenceNames = job.files.map(file => file.name);
    job.files = [];
    guard(job);
    await notify(job, { type: "museStage", stage: "referencesAttached" });
    const deadline = Date.now() + 15000;
    let button;
    while (Date.now() < deadline) {
      guard(job); input = composer(); root = rootFor(input); button = sendButton(input);
      if (button && !button.disabled && button.getAttribute("aria-disabled") !== "true"
        && compact(value(input)) === compact(job.prompt) && !pending(root)
        && (!job.referenceNames.length || exactPreviews(root, job.referenceNames.map(name => ({ name })))))
        break;
      await delay(250, job.controller.signal);
    }
    if (!button?.isConnected || button.disabled || button.getAttribute("aria-disabled") === "true"
      || !root || compact(value(input)) !== compact(job.prompt) || pending(root)
      || job.referenceNames.length && !exactPreviews(root, job.referenceNames.map(name => ({ name }))))
      failure("SITE_SEND_UNAVAILABLE", "Không xác minh được nút Gửi hoặc prompt.");
    guard(job); job.awaitingReceipt = true; job.clicked = true; button.click(); // exactly one click; NEVER resend
    const begin = "[REQUEST_BEGIN:" + job.requestId + "]";
    const end = "[REQUEST_END:" + job.requestId + "]";
    let receipt;
    for (let retry = 0; retry < 40; retry++) {
      guard(job);
      const turns = users();
      if (!same(job.userSnapshot, turns.slice(0, job.userSnapshot.length))
        || turns.length > job.userSnapshot.length + 1)
        failure("SITE_CONVERSATION_CHANGED", "Có lượt gửi khác trong hội thoại; không tự gửi lại.");
      const fresh = turns.slice(job.userSnapshot.length);
      if (fresh.length === 1 && text(fresh[0]).includes(begin) && text(fresh[0]).includes(end)) {
        receipt = fresh[0]; break;
      }
      await delay(500, job.controller.signal);
    }
    if (!receipt) failure("SITE_SUBMISSION_UNKNOWN", "Chưa xác minh được tin nhắn gửi; không tự gửi lại.");
    if (location.href !== job.expectedUrl) {
      const fromUrl = job.expectedUrl;
      job.expectedUrl = location.href;
      await notify(job, { type: "museNavigation", fromUrl, url: job.expectedUrl });
    }
    job.awaitingReceipt = false;
    if (root.isConnected && !cards(root).length) {
      for (const control of job.uploadControls || []) if (control.isConnected) control.value = "";
    }
    await notify(job, { type: "museStage", stage: "submitted" });
    await notify(job, { type: "museStage", stage: "waitingResult" });
    const responseBegin = "[RESPONSE_BEGIN:" + job.requestId + "]";
    const responseEnd = "[RESPONSE_END:" + job.requestId + "]";
    const until = Date.now() + 15 * 60 * 1000;
    let previous = "", since = 0;
    while (Date.now() < until) {
      guard(job);
      const turns = users();
      if (!same(job.userSnapshot, turns.slice(0, job.userSnapshot.length))
        || turns.length !== job.userSnapshot.length + 1 || !text(turns.at(-1)).includes(begin))
        failure("SITE_CONVERSATION_CHANGED", "Hội thoại thay đổi khi chờ kết quả.");
      const roots = assistants().filter(el => !!(receipt.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
      const response = roots.map(text).join("\n");
      const start = response.indexOf(responseBegin), finish = start < 0 ? -1 : response.indexOf(responseEnd, start + responseBegin.length);
      const result = finish > start + responseBegin.length ? response.slice(start + responseBegin.length, finish).trim() : "";
      const alerts = [...document.querySelectorAll('[role="alert"]')].filter(visible).map(text).join("\n");
      if (/quota|rate limit|too many requests|generation failed|hết lượt|额度不足|失败/i.test(alerts))
        failure("SITE_GENERATION_FAILED", "Trang AI báo lỗi hoặc hết hạn mức; không tự gửi lại.");
      if (result && !pageBusy()) {
        if (result === previous && Date.now() - since >= 3000) return transfer(job, result);
        if (result !== previous) { previous = result; since = Date.now(); }
      } else { previous = ""; since = 0; }
      await delay(1200, job.controller.signal);
    }
    failure("SITE_RESULT_TIMEOUT", "Không xác minh được phản hồi với RESPONSE marker; không gửi lại.");
  }
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (msg.type === "probe") { reply(probe()); return false; }
    if (msg.documentToken !== documentToken || msg.expectedUrl !== location.href
      || !/^[a-f0-9-]{36}$/i.test(msg.requestId)) {
      reply({ ok: false, code: "SITE_TARGET_CHANGED", notSubmitted: true, error: "Tab hoặc document đã thay đổi." }); return false;
    }
    if (msg.type === "cancel") {
      if (staging?.requestId === msg.requestId) clearStage();
      if (active?.requestId === msg.requestId) active.controller.abort();
      reply({ ok: true }); return false;
    }
    const errorReply = (error, notSubmitted = false) => reply({
      ok: false, code: error?.code || "SITE_ERROR", error: String(error?.message || error).slice(0, 1000),
      ...(notSubmitted ? { notSubmitted: true } : {}),
    });
    if (["prepareReferences", "referenceStart", "referenceChunk", "referenceEnd"].includes(msg.type)) {
      receiveReference(msg).then(() => reply({ ok: true }), error => {
        if (staging?.requestId === msg.requestId) clearStage();
        errorReply(error, true);
      }); return true;
    }
    if (msg.type !== "generate") return false;
    if (active || !staging || staging.requestId !== msg.requestId || staging.incoming
      || staging.files.length !== staging.count || msg.kind !== "text"
      || typeof msg.prompt !== "string" || !msg.prompt.trim() || msg.prompt.length > 104000
      || msg.response?.kind !== "text" || !msg.response.mimeTypes?.includes("text/plain")
      || msg.response.maxBytes !== 1024 * 1024) {
      reply({ ok: false, code: "SITE_NOT_READY", notSubmitted: true, error: "Gói chưa sẵn sàng hoặc loại đầu ra chưa hỗ trợ." });
      return false;
    }
    const job = active = { ...msg, documentToken, files: staging.files, userSnapshot: staging.userSnapshot,
      controller: new AbortController(), clicked: false, transferring: false };
    clearStage();
    generate(job).then(reply, error => errorReply(error, !job.clicked)).finally(() => {
      if (active === job) active = undefined;
    });
    return true;
  });
})();
