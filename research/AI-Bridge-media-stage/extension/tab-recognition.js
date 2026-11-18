// An existing AI tab does not receive new manifest content scripts when the
// extension is reloaded. Inject the extension-owned scripts instead of
// reloading a live conversation (which could lose drafts or active tasks).
const DOCUMENT_TOKEN_PATTERN = /^[a-f0-9-]{36}$/i;

export async function recognizeAiTabs({ chrome, patterns, providerForUrl, isAssigned = () => false, stillCurrent = () => true }) {
  const result = { scanned: 0, recognized: 0, injected: 0, skipped: 0, failed: 0 };
  const tabs = (await chrome.tabs.query({ url: patterns })).slice(0, 80);
  for (const tab of tabs) {
    if (!stillCurrent()) break;
    const provider = typeof tab.url === "string" ? providerForUrl(tab.url) : null;
    if (!provider || !Number.isSafeInteger(tab.id) || tab.id < 0 || tab.discarded || tab.status === "loading") continue;
    result.scanned++;
    if (isAssigned(tab.id)) { result.skipped++; continue; }

    const validProbe = async () => {
      try {
        const probe = await chrome.tabs.sendMessage(tab.id, { type: "bridge:probe" });
        return probe && probe.url === tab.url && probe.provider === provider
          && typeof probe.documentToken === "string" && DOCUMENT_TOKEN_PATTERN.test(probe.documentToken);
      } catch { return false; }
    };

    if (await validProbe()) { result.recognized++; continue; }
    // Only inject into the exact site/document that was enumerated. A tab
    // switched to a different URL after enumeration must not be modified.
    try {
      const fresh = await chrome.tabs.get(tab.id);
      if (!fresh || fresh.url !== tab.url || fresh.discarded || fresh.status === "loading"
        || isAssigned(tab.id) || !stillCurrent()) { result.skipped++; continue; }
      if (!chrome.scripting?.executeScript) { result.failed++; continue; }
      const adapter = provider === "muse" ? "muse-content.js" : "content.js";
      await chrome.scripting.executeScript({ target: { tabId: tab.id },
        files: ["media-capture.js", adapter], world: "ISOLATED" });
      if (await validProbe()) { result.recognized++; result.injected++; }
      else result.failed++;
    } catch { result.failed++; }
  }
  return result;
}
