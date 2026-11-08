/* Original, limited DOM companion for selected Muse/Gemini/ChatGPT tabs. No credential access. */
"use strict";
(() => {
  if (window.__toonflowChromeCompanion) return;
  window.__toonflowChromeCompanion = true;
  const jobs = new Map();
  const provider = (location.hostname === "muse.ai" || location.hostname.endsWith(".muse.ai")) ? "muse"
    : location.hostname === "gemini.google.com" ? "gemini"
    : ["chatgpt.com", "www.chatgpt.com", "chat.openai.com"].includes(location.hostname) ? "chatgpt" : null;
  if (!provider) return;
  function visible(element) {
    return !!element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
  }
  const find = selectors => selectors.map(selector => [...document.querySelectorAll(selector)].find(visible)).find(Boolean);
  const composerSelectors = provider === "chatgpt"
    ? ["#prompt-textarea", "div[contenteditable=true][data-testid=prompt-textarea]", "textarea[placeholder]"]
    : provider === "gemini"
      ? ["rich-textarea [contenteditable=true]", ".ql-editor[contenteditable=true]", "div[contenteditable=true][role=textbox]", "textarea[placeholder]"]
      : ["textarea", "div[contenteditable=true][role=textbox]", "div[contenteditable=true][data-placeholder]"];
  function composer() { return find(composerSelectors); }
  function availableModes() {
    const labels = [...document.querySelectorAll("button,[role=tab],[role=menuitem]")].filter(visible).map(element =>
      (element.getAttribute("aria-label") || element.textContent || "").trim().toLowerCase().slice(0, 120));
    const image = labels.some(value => /(?:create image|generate image|tạo ảnh|生成图片|image generation|画像生成|tạo hình ảnh)/i.test(value));
    const video = labels.some(value => /(?:create video|generate video|tạo video|生成视频|video generation)/i.test(value));
    if (provider === "muse") return [...(image ? ["image"] : []), ...(video ? ["video"] : [])];
    return ["text", ...(image ? ["image"] : [])];
  }
  function probe() {
    const element = composer();
    return element ? { ready: true, capabilities: availableModes() }
      : { ready: false, capabilities: [], error: "Không tìm thấy ô soạn thảo; vui lòng đăng nhập và mở cuộc trò chuyện trước" };
  }
  function userNodes() {
    const selectors = provider === "chatgpt"
      ? ['[data-message-author-role="user"]']
      : provider === "gemini"
        ? ["user-query", ".user-query-container", '[data-message-author-role="user"]']
        : ['[data-message-author-role="user"]', "user-query", ".hatch-chat-user-bubble", "[class*=chat-user-bubble]"];
    return [...new Set(selectors.flatMap(selector => [...document.querySelectorAll(selector)]))].filter(visible);
  }
  function assistantNodes() {
    const selectors = provider === "chatgpt"
      ? ['[data-message-author-role="assistant"]']
      : provider === "gemini" ? ["model-response", ".model-response"] : ["div[class*=hatch-chat-groupable-bubble]", ".assistant-message", "[data-role=assistant]", ".message--assistant"];
    return [...new Set(selectors.flatMap(selector => [...document.querySelectorAll(selector)]))].filter(visible);
  }
  function sendButton() {
    const selectors = provider === "chatgpt"
      ? ['button[data-testid="send-button"]', 'button[aria-label="Send prompt"]', 'button[aria-label="Send message"]']
      : provider === "gemini"
        ? ['button[aria-label="Send message"]', 'button[aria-label="Send"]', "button.send-button", "button[mattooltip*=Send]"]
        : ['button[data-testid="hatch-composer-send-button"]', 'button[aria-label="Send"]', 'button[aria-label="Generate"]', "button[type=submit]"];
    return find(selectors);
  }
  function modeButton(kind) {
    const pattern = kind === "image" ? /(?:create image|generate image|tạo ảnh|生成图片|image generation|画像生成|tạo hình ảnh)/i
      : /(?:create video|generate video|tạo video|生成视频|video generation)/i;
    return [...document.querySelectorAll("button,[role=tab],[role=menuitem]")].find(element =>
      visible(element) && pattern.test((element.getAttribute("aria-label") || element.textContent || "").trim()));
  }
  function replacePrompt(element, value) {
    element.focus();
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      return;
    }
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges(); selection.addRange(range);
    document.execCommand("insertText", false, value);
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  }
  async function uploadImages(images) {
    if (!images.length) return;
    const input = [...document.querySelectorAll('input[type=file]')].find(element =>
      !element.disabled && (!element.accept || element.accept.includes("image")));
    if (!input) throw Error("Trang AI không có đầu vào ảnh tham chiếu tương thích; chưa gửi prompt");
    const data = new DataTransfer();
    images.forEach((item, index) => {
      if (!/^image\/(png|jpeg|webp)$/.test(item.mimeType) || !/^[a-zA-Z0-9+/]+={0,2}$/.test(item.data)) throw Error("Ảnh tham chiếu không hợp lệ");
      const raw = atob(item.data);
      if (raw.length > 15 * 1024 * 1024) throw Error("Ảnh tham chiếu quá lớn");
      const bytes = Uint8Array.from(raw, character => character.charCodeAt(0));
      const ext = item.mimeType.split("/")[1].replace("jpeg", "jpg");
      data.items.add(new File([bytes], "toonflowReference" + (index + 1) + "." + ext, { type: item.mimeType }));
    });
    input.files = data.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    // Do not submit until an upload indicator/preview is visible in the composer.
    await new Promise(resolve => setTimeout(resolve, 1200));
    const preview = composer()?.closest("form") || composer()?.parentElement?.parentElement;
    if (!preview || !preview.querySelector("img,[data-testid*=attachment],[class*=attachment],[class*=preview]"))
      throw Error("Không xác nhận được ảnh đã tải lên; chưa gửi prompt");
  }
  function notify(id, state, result, error) {
    void chrome.runtime.sendMessage({ command: "job", id, provider, state, ...(result ? { result } : {}), ...(error ? { error } : {}) }).catch(() => {});
  }
  function stopButton() {
    return find(['button[data-testid="hatch-composer-stop-button"]', 'button[data-testid="stop-button"]',
      'button[aria-label="Stop generating"]', 'button[aria-label="Stop response"]']);
  }
  function busy() {
    return !!stopButton() || !!find(['[aria-busy=true]', '.result-streaming']);
  }
  async function readMedia(element, kind, signal) {
    const url = element.currentSrc || element.src;
    if (!url || !/^(https:|blob:|data:)/.test(url)) throw Error("Đường dẫn media không hợp lệ");
    const response = await fetch(url, { credentials: "omit", signal });
    if (!response.ok) throw Error("Không tải được media từ tab AI (HTTP " + response.status + ")");
    const mimeType = (response.headers.get("content-type") || (kind === "image" ? "image/png" : "video/mp4")).split(";")[0];
    if (!/^(image\/(png|jpeg|webp)|video\/(mp4|webm|quicktime))$/.test(mimeType) || !mimeType.startsWith(kind + "/")) throw Error("AI trả về media không đúng loại");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 20 || buffer.byteLength > 40 * 1024 * 1024) throw Error("File media trống hoặc vượt giới hạn Chrome Companion");
    const bytes = new Uint8Array(buffer);
    let encoded = "";
    for (let i = 0; i < bytes.length; i += 0x8000) encoded += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const width = kind === "image" ? element.naturalWidth : element.videoWidth;
    const height = kind === "image" ? element.naturalHeight : element.videoHeight;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1)
      throw Error("Media tải được nhưng chưa xác minh được kích thước thật");
    const duration = kind === "video" ? element.duration : undefined;
    if (kind === "video" && (!Number.isFinite(duration) || duration <= 0))
      throw Error("Video chưa có thời lượng thực; không sử dụng poster/thumbnail");
    return { kind, mimeType, data: btoa(encoded), width, height, ...(kind === "video" ? { duration } : {}) };
  }
  async function execute(request, controller) {
    if (!composer()) throw Error("Tab không có ô prompt, có thể chưa đăng nhập");
    const modes = availableModes();
    if (!modes.includes(request.kind)) throw Error("Chức năng chưa hiển thị hoặc chưa được xác nhận trên giao diện " + provider);
    const pathBefore = location.origin + location.pathname;
    const before = new Map(assistantNodes().map(element => [element, element.innerText || element.textContent || ""]));
    const usersBefore = new Set(userNodes());
    const alertsBefore = new Set(document.querySelectorAll("[role=alert]"));
    const normalizedPrompt = request.prompt.replace(/\s+/g, " ").trim();
    const matchingReceipt = () => userNodes().find(element =>
      !usersBefore.has(element) && (element.innerText || element.textContent || "").replace(/\s+/g, " ").includes(normalizedPrompt));
    let previousMedia;
    if (request.kind !== "text") {
      const button = modeButton(request.kind);
      if (!button) throw Error("Không xác định được chế độ tạo " + request.kind);
      button.click();
    }
    if (!composer()) throw Error("Không tìm thấy ô prompt sau khi chọn chế độ");
    await uploadImages(request.images || []);
    controller.signal.throwIfAborted();
    // ACT: ảnh preview vừa tải lên không thể trở thành kết quả tạo ảnh của chính yêu cầu.
    previousMedia = new Set([...document.querySelectorAll(request.kind === "video" ? "video" : "img")]);
    replacePrompt(composer(), request.prompt);
    const send = sendButton();
    if (!send || send.disabled) throw Error("Nút gửi chưa sẵn sàng; prompt chưa được gửi");
    notify(request.id, "submitting");
    send.click();
    notify(request.id, "running");
    let candidate = null, stableSince = 0;
    const deadline = Date.now() + (request.kind === "video" ? 14 : 9) * 60 * 1000;
    while (Date.now() < deadline) {
      controller.signal.throwIfAborted();
      if (location.origin + location.pathname !== pathBefore)
        throw Error("Cuộc trò chuyện đã thay đổi; không nhận kết quả từ chat khác");
      const limitAlert = [...document.querySelectorAll("[role=alert]")].find(element => !alertsBefore.has(element)
        && visible(element) && /(?:rate limit|usage limit|too many requests|quota exceeded|usage cap|giới hạn|hết lượt|配额|次数限制)/i
          .test(element.textContent || ""));
      if (limitAlert) throw Error("Tab AI thông báo giới hạn sử dụng; không tự gửi lại yêu cầu");
      const receipt = matchingReceipt();
      if (!receipt) { await new Promise(resolve => setTimeout(resolve, 750)); continue; }
      // ACT: nhận kết quả mới chỉ khi câu trả lời được tạo sau thông điệp yêu cầu của người dùng.
      const replies = assistantNodes().filter(element =>
        (!before.has(element) || before.get(element) !== (element.innerText || element.textContent || ""))
        && !!(receipt.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING));
      const responseText = (replies.at(-1)?.innerText || "").trim();
      if (/^(?:you(?:'|’)ve reached|you have reached|rate limit|too many requests|usage limit|hết lượt|đã đạt giới hạn|已达到|超出限制)/i.test(responseText))
        throw Error("AI báo giới hạn lượt hoặc quyền sử dụng; không tự gửi lại");
      if (request.kind === "text") {
        const current = replies.at(-1);
        const value = current?.innerText?.trim() || "";
        if (value && value === candidate && !busy()) {
          if (Date.now() - stableSince > 2200) return { kind: "text", text: value };
        } else { candidate = value; stableSince = Date.now(); }
      } else {
        const target = replies.at(-1);
        if (!target) { await new Promise(resolve => setTimeout(resolve, 750)); continue; }
        const items = [...target.querySelectorAll(request.kind === "video" ? "video" : "img")]
          .filter(element => !previousMedia.has(element) && visible(element) && (request.kind === "video" || element.naturalWidth >= 256));
        const item = items.at(-1);
        const url = item?.currentSrc || item?.src;
        if (url && url === candidate && !busy() && Date.now() - stableSince > 2600)
          return readMedia(item, request.kind, controller.signal);
        if (url !== candidate) { candidate = url || null; stableSince = Date.now(); }
      }
      await new Promise(resolve => setTimeout(resolve, 750));
    }
    throw Error("Không thấy kết quả mới hợp lệ trong tab; tác vụ có thể vẫn đang chạy");
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || !message || typeof message !== "object") return false;
    if (message.command === "probe") { respond(probe()); return false; }
    if (message.command === "cancel") {
      const controller = jobs.get(message.id);
      if (controller) {
        controller.abort();
        jobs.delete(message.id);
        // ACT: yêu cầu dừng tác vụ phía website khi nút Stop thuộc tab này đang hiện.
        stopButton()?.click();
      }
      respond({ ok: true, stopped: !!controller }); return false;
    }
    if (message.command !== "run" || message.provider !== provider || typeof message.id !== "string") return false;
    if (message.expectedUrl !== location.href) {
      respond({ accepted: false, error: "URL cuộc trò chuyện thay đổi; không gửi prompt sang cuộc trò chuyện khác" }); return false;
    }
    if (jobs.size) { respond({ accepted: false, error: "Tab đang xử lý tác vụ khác" }); return false; }
    if (!probe().capabilities.includes(message.kind)) { respond({ accepted: false, error: "Chức năng chưa sẵn sàng hoặc chưa hỗ trợ" }); return false; }
    const controller = new AbortController();
    jobs.set(message.id, controller);
    respond({ accepted: true });
    void execute(message, controller).then(result => notify(message.id, "completed", result), error => {
      notify(message.id, controller.signal.aborted ? "cancelled" : "failed", null, error.message || "Không nhận được kết quả");
    }).finally(() => { if (jobs.get(message.id) === controller) jobs.delete(message.id); });
    return false;
  });
})();
