// Local AI-Bridge Muse text adapter. Unlike the original generic text adapter,
// never sends over an existing draft and never treats a historical reply as new.
(() => {
  if (!new Set(["muse.ai", "www.muse.ai"]).has(location.hostname)) return;

  const USER_SELECTOR = [
    '[data-message-author-role="user"]',
    '[data-testid*="user-message" i]',
    'user-query',
    '[class*="chat-user-bubble"]',
    '.hatch-user-bubble-bg',
  ].join(",");
  const ASSISTANT_SELECTOR = [
    '[data-message-author-role="assistant"]',
    '[data-testid="assistant-message"]',
    '[class*="assistant-message"]',
    '[class*="assistant-bubble"]',
    '.hatch-agent-bubble-bg',
    '[class*="hatch-chat-groupable-bubble"]',
  ].join(",");
  const STOP_SELECTOR = [
    'button[data-testid="hatch-composer-stop-button"]',
    'button[aria-label*="Stop" i]',
    'button[aria-label*="停止"]',
    'button[aria-label*="Dừng" i]',
  ].join(",");
  const DOCUMENT_TOKEN = crypto.randomUUID();
  let runningRequest = null;

  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const textOf = (element) => element?.innerText || element?.textContent || "";
  const visible = (element) => !!element?.getClientRects().length
    && getComputedStyle(element).display !== "none"
    && getComputedStyle(element).visibility !== "hidden";
  const report = (message) => chrome.runtime.sendMessage({ type: "bridge:site-message", message: { ...message, documentToken: DOCUMENT_TOKEN } }).catch(() => {});
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function composer() {
    const inputs = [...document.querySelectorAll("textarea")]
      .filter((input) => visible(input) && !input.disabled && !input.readOnly && !input.closest('[hidden],[aria-hidden="true"]'));
    const preferred = inputs.filter((input) => /message|tin nhắn|消息/i.test(
      `${input.getAttribute("placeholder") || ""} ${input.getAttribute("aria-label") || ""}`));
    // An ambiguous composer is worse than sending to the wrong text box.
    return preferred.length === 1 ? preferred[0] : inputs.length === 1 ? inputs[0] : null;
  }

  function composerRoot(input) {
    const form = input.closest("form");
    if (form && !form.querySelector(USER_SELECTOR)) return form;
    let root = input.parentElement;
    let chosen = input;
    for (let depth = 0; root && root !== document.body && root.tagName !== "MAIN" && depth < 8; depth++, root = root.parentElement) {
      if (root.querySelector(USER_SELECTOR) || [...root.querySelectorAll("textarea")].some((other) => other !== input && visible(other))) break;
      chosen = root;
      if (root.matches('[data-testid="hatch-composer"],[data-testid="hatch-chat-composer"]')) break;
    }
    return chosen;
  }

  function turns(selector) {
    const nodes = [...document.querySelectorAll(selector)]
      .filter((element) => visible(element) && !element.closest('[data-testid="hatch-composer-placeholder-overlay"]'));
    // Nested message bubbles should count as one turn, not multiple turns.
    return nodes.filter((element) => !nodes.some((child) => child !== element && element.contains(child)));
  }

  function busy() {
    return [...document.querySelectorAll(STOP_SELECTOR)].some(visible);
  }

  function arrowUp(button) {
    return [...button.querySelectorAll("svg")].some((svg) => {
      const paths = [...svg.querySelectorAll("path")].map((path) => path.getAttribute("d") || "").join(" ").replace(/[\s,]+/g, "").toLowerCase();
      const shaft = [...svg.querySelectorAll("line")].some((line) => line.getAttribute("x1") === line.getAttribute("x2")
        && Number(line.getAttribute("y1")) > Number(line.getAttribute("y2")));
      const head = [...svg.querySelectorAll("polyline")].some((line) => /5\s*12[\s,]+12\s*5[\s,]+19\s*12/i.test(line.getAttribute("points") || ""));
      return (/m12(?:19v-?14|5v14)/.test(paths) && /m5(?:12(?:l)?7-7(?:l)?7(?:7|-?7))/.test(paths)) || shaft && head;
    });
  }

  function findSendButton(input) {
    for (let root = composerRoot(input), depth = 0;
      root && root !== document.body && root.tagName !== "MAIN" && depth < 5;
      root = root.parentElement, depth++) {
      const ranked = [...root.querySelectorAll('button,[role="button"],input[type="submit"]')]
        .filter((button) => visible(button) && !button.disabled && button.getAttribute("aria-disabled") !== "true")
        .map((button) => {
          const label = [button.getAttribute("aria-label"), button.getAttribute("data-testid"), button.getAttribute("title"), textOf(button)]
            .filter(Boolean).join(" ");
          if (/stop|cancel|upload|attach|delete|remove|dừng|hủy|tải lên|đính kèm|xóa|xoá/i.test(label)) return { button, score: 0 };
          const icons = [...button.querySelectorAll("svg,[data-icon]")]
            .map((icon) => [icon.getAttribute("class"), icon.getAttribute("data-icon"), icon.getAttribute("data-lucide")].join(" ")).join(" ");
          const score = button.matches('[data-testid="hatch-composer-send-button"]') || /send|submit prompt|gửi|发送/i.test(label) ? 4
            : /arrow[-_ ]?up|paper[-_ ]?plane|send/i.test(icons) || arrowUp(button) ? 3
              : button.matches('button[type="submit"],input[type="submit"]') && !!button.closest("form") ? 1 : 0;
          return { button, score };
        })
        .filter(({ score }) => score > 0).sort((a, b) => b.score - a.score);
      if (ranked.length) return ranked.length === 1 || ranked[0].score > ranked[1].score ? ranked[0].button : null;
    }
    return null;
  }

  function assistantText(element) {
    const copy = element.cloneNode(true);
    for (const control of copy.querySelectorAll('button,[role="button"],svg,script,style,textarea,[aria-hidden="true"]')) control.remove();
    return String(copy.innerText || copy.textContent || "").replace(/\u00a0/g, " ").trim();
  }

  function ensureSameHistory(before, current) {
    if (current.length < before.length || before.some((text, index) => text !== normalize(textOf(current[index])))) {
      throw new Error("Muse changed the existing conversation while sending; verify the tab before retrying.");
    }
  }

  async function runRequest({ id, prompt, mediaKind = "none", inputImages }) {
    if (inputImages !== undefined) {
      if (!globalThis.AI_BRIDGE_IMAGE_INPUT || globalThis.AI_BRIDGE_IMAGE_INPUT.version !== "0.6.0")
        throw new Error("Muse tab chưa hỗ trợ ảnh AI Bridge v0.6.0.");
      globalThis.AI_BRIDGE_IMAGE_INPUT.checkImages(inputImages);
      throw new Error("Muse chưa có bộ xác minh ảnh đính kèm; không gửi prompt.");
    }
    if (!["none", "auto", "image", "video"].includes(mediaKind)) throw new Error("Unsupported media mode for Muse.");
    if (mediaKind !== "none" && !globalThis.AI_BRIDGE_MEDIA) throw new Error("Reload the Muse tab to activate media capture.");
    const input = composer();
    if (!input) throw new Error("Muse composer is unavailable or ambiguous. Open a logged-in Muse chat tab.");
    if (normalize(input.value)) throw new Error("Muse already contains a draft. Clear it yourself before sending; the bridge will not overwrite it.");
    if (busy()) throw new Error("Muse is generating a response. The bridge will not send another prompt to this tab.");
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 100_000) throw new Error("Invalid Muse text prompt.");

    const startUrl = location.href;
    const beforeUser = turns(USER_SELECTOR).map((node) => normalize(textOf(node)));
    const beforeAssistant = new Set(turns(ASSISTANT_SELECTOR));
    const baseline = mediaKind === "none" ? null : globalThis.AI_BRIDGE_MEDIA.snapshot("muse");
    let mediaFingerprint = "";
    let mediaStableSince = 0;
    const resolved = prompt.replaceAll("{{modelName}}", "Muse");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (!setter) throw new Error("Muse textarea does not support safe text input.");
    input.focus();
    setter.call(input, resolved);
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    await delay(100);
    if (composer() !== input || normalize(input.value) !== normalize(resolved) || busy() || location.href !== startUrl) {
      throw new Error("Muse changed the composer before submission; no prompt was sent.");
    }
    ensureSameHistory(beforeUser, turns(USER_SELECTOR));
    const button = findSendButton(input);
    if (!button?.isConnected) throw new Error("Could not identify a unique Muse Send button; no prompt was sent.");

    // One click maximum, with no Enter fallback. If receipt cannot be proven,
    // report an error instead of resending or claiming a stale answer.
    button.click();
    let confirmedUser = null;
    let lastText = "";
    let lastChange = Date.now();
    const started = Date.now();
    while (Date.now() - started < 230_000) {
      await delay(400);
      if (new URL(location.href).origin !== new URL(startUrl).origin) {
        throw new Error("Muse navigated to another website after submission; verify the task manually.");
      }
      const users = turns(USER_SELECTOR);
      ensureSameHistory(beforeUser, users);
      const newUsers = users.slice(beforeUser.length);
      if (newUsers.length > 1) throw new Error("Another Muse user turn appeared; response ownership is ambiguous.");
      if (newUsers.length === 1) {
        if (normalize(textOf(newUsers[0])) !== normalize(resolved)) {
          throw new Error("Muse displayed a different user prompt; the bridge cannot claim its response.");
        }
        confirmedUser = newUsers[0];
      }
      if (!confirmedUser) continue;
      const freshAssistant = turns(ASSISTANT_SELECTOR).filter((node) => !beforeAssistant.has(node)
        && !node.contains(confirmedUser)
        && !!(confirmedUser.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING));
      if (freshAssistant.length > 1) throw new Error("Multiple new Muse replies appeared; response ownership is ambiguous.");
      const current = freshAssistant[0] ? assistantText(freshAssistant[0]) : "";
      if (current !== lastText) { lastText = current; lastChange = Date.now(); }
      const media = mediaKind !== "none" && freshAssistant[0]
        ? globalThis.AI_BRIDGE_MEDIA.scan("muse", baseline, mediaKind, freshAssistant[0]) : [];
      const fingerprint = media.map(item => item.url).join("|");
      if (fingerprint !== mediaFingerprint) {
        mediaFingerprint = fingerprint;
        mediaStableSince = fingerprint ? Date.now() : 0;
      }
      if (media.length && mediaStableSince && Date.now() - mediaStableSince > 1600 && !busy()) {
        for (const item of media) await globalThis.AI_BRIDGE_MEDIA.transfer(id, item, DOCUMENT_TOKEN);
        if (current) await report({ type: "bridge:chunk", id, text: current });
        await report({ type: "bridge:complete", id, text: current });
        return;
      }
      if (mediaKind === "image" || mediaKind === "video") continue;
      const quiet = Date.now() - lastChange;
      if (current && !busy() && quiet >= (mediaKind === "auto" ? 6000 : 4000)) {
        await report({ type: "bridge:chunk", id, text: current });
        await report({ type: "bridge:complete", id, text: current });
        return;
      }
    }
    throw new Error("Muse did not produce a provably new text reply before timeout. Inspect the tab; do not automatically retry.");
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "bridge:probe") {
      const input = composer();
      const currentlyBusy = !!runningRequest || busy();
      sendResponse({ documentToken: DOCUMENT_TOKEN, provider: "muse", url: location.href,
        ready: !!input && !currentlyBusy && !String(input.value || "").trim(), busy: currentlyBusy,
        imageInputVersion: globalThis.AI_BRIDGE_IMAGE_INPUT?.version || null });
      return;
    }
    if (message?.type !== "bridge:run") return;
    if ((message.documentToken && message.documentToken !== DOCUMENT_TOKEN)
      || (message.expectedUrl && message.expectedUrl !== location.href)) {
      report({ type: "bridge:error", id: message.id, message: "Phiên Muse đã đổi; chọn lại tab trong MacFlow." });
      sendResponse({ ok: false });
      return;
    }
    if (runningRequest) {
      report({ type: "bridge:error", id: message.id, message: "This Muse tab is already handling a request." });
      sendResponse({ ok: false });
      return;
    }
    if (typeof message.id !== "string") { sendResponse({ ok: false }); return; }
    runningRequest = message.id;
    runRequest(message)
      .catch((error) => report({ type: "bridge:error", id: message.id, message: error.message }))
      .finally(() => { runningRequest = null; });
    sendResponse({ ok: true });
  });

  report({ type: "bridge:status", status: "ready", provider: "muse", url: location.href });
})();
