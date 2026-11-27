// The top-level categories of TikTok Shop VN (name and id as in the links of its home page)
const CATEGORIES = [
  ["womenswear-underwear", 601152],
  ["phones-electronics", 601739],
  ["fashion-accessories", 605248],
  ["menswear-underwear", 824328],
  ["home-supplies", 600001],
  ["beauty-personal-care", 601450],
  ["shoes", 601352],
  ["sports-outdoor", 603014],
  ["luggage-bags", 824584],
  ["toys-hobbies", 604206],
  ["automotive-motorcycle", 605196],
  ["kids-fashion", 802184],
  ["kitchenware", 600024],
  ["computers-office-equipment", 601755],
  ["baby-maternity", 602284],
  ["tools-hardware", 604579],
  ["textiles-soft-furnishings", 600154],
  ["pet-supplies", 602118],
  ["home-improvement", 604968],
  ["food-beverages", 700437],
  ["muslim-fashion", 601303],
  ["books-magazines-audio", 801928],
  ["household-appliances", 600942],
  ["health", 700645],
  ["furniture", 604453],
  ["jewelry-accessories-derivatives", 953224],
  ["collectibles", 951432],
  ["pre-owned", 856720],
];
const enabled = document.getElementById("enabled");
const status = document.getElementById("status");
const walkerBox = document.getElementById("walker");
const pinBox = document.getElementById("pin-walker");

const sendToTab = (tabId, message) =>
  chrome.tabs.sendMessage(tabId, message, () => {
    if (chrome.runtime.lastError) status.textContent = "Mở trang TikTok hoặc Pinterest rồi tải lại thẻ (F5).";
  });

// TikTok and Pinterest run independently; each shows its progress in its own section.
const paint = ({ box, bar, stop }, w, mine, describe) => {
  const total = mine ? w.queue.length : 0;
  box.textContent = mine ? describe(w) : "";
  bar.hidden = !total;
  bar.firstElementChild.style.width = total ? `${Math.round(((w.done + w.failed) / total) * 100)}%` : "0%";
  stop.hidden = !(mine && w.running);
};
const state = (w) => (w.running ? (w.paused ? "Đang chờ bạn xác minh" : "Đang chạy") : "Đã dừng");
const tiktokText = (w) =>
  `${state(w)}: ${w.done + w.failed}/${w.queue.length} ${w.kind === "category" ? "danh mục" : "sản phẩm"} | ${Object.keys(w.active || {}).length} thẻ · Thành công ${w.done} · Lỗi ${w.failed}\n${w.note}`;
const pinterestText = (w) =>
  `${state(w)}: từ khóa ${w.done + w.failed}/${w.queue.length} · Thành công ${w.done} · Lỗi ${w.failed}${w.detail ? `\nĐang thu thập ${w.detail}` : `\n${w.note}`}`;

const connection = globalThis.videoAffConnection;
const collectorOrigin = "http://127.0.0.1:8000";
async function studioLink() {
  if (connection) return (product) => `${connection.origin}/#/videoAff?product=${encodeURIComponent(product)}`;
  const options = () => ({ signal: AbortSignal.timeout(1200), redirect: "error" });
  try {
    const response = await fetch(collectorOrigin + "/api/v1/macflow-host", options());
    if (response.ok) {
      const { origin } = await response.json();
      if (typeof origin === "string") {
        const url = new URL(origin);
        if (url.origin === origin && ["http:", "https:"].includes(url.protocol)
          && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
          return (product) => `${origin}/#/videoAff?product=${encodeURIComponent(product)}`;
        }
      }
    }
  } catch { /* Fall back to the standalone dashboard. */ }
  const local = await fetch(collectorOrigin + "/dashboard/", options()).then(async (response) => {
    return response.ok && response.headers.get("content-type")?.includes("text/html")
      && (await response.text()).includes("<title>VideoAFF</title>");
  }).catch(() => false);
  return (product) => `${local ? collectorOrigin : "http://localhost:8080"}/dashboard/studio/${encodeURIComponent(product)}`;
}
const studioUrlFor = studioLink();
let currentCapture;
const showCapture = (capture) => {
  const note = document.getElementById("send-note");
  const link = document.getElementById("open-studio");
  currentCapture = capture;
  link.hidden = true;
  if (!capture) return;
  if (capture.stored === "detail") {
    note.textContent = "Đã gửi và lưu sản phẩm.";
    void studioUrlFor.then((studioUrl) => {
      if (currentCapture !== capture) return;
      link.href = studioUrl(capture.productId);
      link.hidden = false;
    });
  } else if (capture.stored === "ignored") {
    note.textContent = capture.source === "shopee" && capture.reason
      ? capture.reason
      : "Chưa thấy dữ liệu sản phẩm. Mở trang sản phẩm, chờ tải xong rồi bấm gửi lại.";
  } else {
    note.textContent = `VideoAFF chưa nhận được sản phẩm: ${capture.reason || "chưa rõ nguyên nhân"}`;
  }
};

const refresh = () =>
  chrome.storage.local.get({ enabled: false, sent: 0, error: "", walker: null, pinWalker: null, autoNote: "", lastCapture: null }, (s) => {
    showCapture(s.lastCapture);
    const w = s.walker;
    const pin = s.pinWalker;
    document.getElementById("auto-note").textContent = s.autoNote;
    enabled.checked = Boolean(s.enabled);
    status.textContent = s.error ? `Lỗi gửi dữ liệu: ${s.error}` : `Đã gửi ${s.sent} gói dữ liệu`;
    paint({ box: walkerBox, bar: document.getElementById("walker-bar"), stop: document.getElementById("stop") }, w, Boolean(w), tiktokText);
    paint({ box: pinBox, bar: document.getElementById("pin-bar"), stop: document.getElementById("pin-stop") }, pin, Boolean(pin), pinterestText);
    const lanes = { "crawl-all": w, pins: pin };
    for (const [id, lane] of Object.entries(lanes)) {
      const button = document.getElementById(id);
      const busy = Boolean(lane?.running);
      button.disabled = busy;
      button.title = busy ? "Đang thu thập dữ liệu. Bạn có thể chờ hoặc bấm Dừng." : "";
    }
  });

const version = document.getElementById("version");
if (version) version.textContent = `v${chrome.runtime.getManifest().version}`;
enabled.addEventListener("change", () => chrome.storage.local.set({ enabled: enabled.checked }));
const sendOne = document.getElementById("send-one");
sendOne.addEventListener("click", async () => {
  const note = document.getElementById("send-note");
  sendOne.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ? new URL(tab.url) : null;
    const shopee = ["https://shopee.vn", "https://www.shopee.vn"].includes(url?.origin);
    const tiktok = ["https://shop.tiktok.com", "https://www.tiktok.com"].includes(url?.origin) && url.pathname.includes("/pdp/");
    if (tab?.id === undefined || (!shopee && !tiktok)) {
      note.textContent = "Hãy mở trang chi tiết sản phẩm trên TikTok Shop hoặc Shopee Việt Nam.";
      return;
    }
    note.textContent = "Đang gửi…";
    document.getElementById("open-studio").hidden = true;
    await chrome.storage.local.set({ lastCapture: null });
    if (tiktok) {
      sendToTab(tab.id, { type: "capture-now" });
      return;
    }
    const [capture] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["shopee.js"] });
    if (!capture?.result) {
      note.textContent = "Chưa đọc được tên và ảnh. Hãy mở trang chi tiết sản phẩm Shopee và đợi ảnh tải xong rồi thử lại.";
      return;
    }
    await chrome.runtime.sendMessage({ type: "ingest-shopee", payload: capture.result });
  } catch {
    note.textContent = "Chưa gửi được sản phẩm. Hãy tải lại trang sản phẩm và thử lại.";
  } finally {
    sendOne.disabled = false;
  }
});
document.getElementById("capture").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) sendToTab(tabs[0].id, { type: "capture-now" });
  });
});
document.getElementById("crawl-all").addEventListener("click", () => {
  const concurrency = Number(document.getElementById("auto-tabs").value) || 5;
  const urls = [
    "https://shop.tiktok.com/vn", // the "Bán chạy nhất" list of the home page
    ...CATEGORIES.map(([slug, id]) => `https://shop.tiktok.com/vn/c/${slug}/${id}`),
  ];
  const meta = Object.fromEntries(urls.map((url) => [url, { category: true }]));
  chrome.storage.local.set({ autoNote: `Đang thu thập ${urls.length} trang danh mục với ${concurrency} thẻ cùng lúc, sau đó sẽ mở trang sản phẩm.` });
  chrome.runtime.sendMessage({ type: "walker-start", kind: "category", urls, meta, concurrency, followUp: { concurrency } });
});
document.getElementById("stop").addEventListener("click", () => chrome.runtime.sendMessage({ type: "walker-stop", lane: "tiktok" }));
document.getElementById("pin-stop").addEventListener("click", () => chrome.runtime.sendMessage({ type: "walker-stop", lane: "pinterest" }));
const API = connection?.products || collectorOrigin + "/api/v1/products";
async function collectRequest(url, options) {
  const response = await fetch(url, connection
    ? { ...options, credentials: "omit", redirect: "error", headers: { "x-video-aff-collector": connection.token } }
    : options);
  if (!response.ok) throw new Error("VideoAFF chưa xử lý được yêu cầu (" + response.status + ").");
  return response;
}
document.getElementById("pins").addEventListener("click", async () => {
  chrome.storage.local.set({ autoNote: "" });
  const searches = Number(document.getElementById("pin-searches").value) || 200;
  const maxImages = Number(document.getElementById("pin-images").value) || 0;
  const concurrency = Number(document.getElementById("pin-tabs").value) || 3;
  try {
    const items = await (await collectRequest(`${API}/reference-queue?limit=${searches}`)).json();
    if (!items.length) {
      pinBox.textContent = "Không còn từ khóa đã duyệt nào cần thu thập.";
      return;
    }
    const meta = Object.fromEntries(items.map((item) => [item.url, { product_type: item.product_type, query: item.query, max_images: maxImages }]));
    chrome.runtime.sendMessage({ type: "walker-start", kind: "pinterest", urls: items.map((item) => item.url), meta, concurrency });
  } catch (error) {
    pinBox.textContent = `Không kết nối được với VideoAFF: ${error}`;
  }
});
async function exportProducts(format) {
  const box = document.getElementById("media-status");
  box.textContent = "Đang tải…";
  try {
    const response = await collectRequest(`${API}/export?format=${format}`);
    const url = URL.createObjectURL(await response.blob());
    const download = document.createElement("a");
    download.href = url;
    download.download = "products." + format;
    download.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    box.textContent = "";
  } catch (error) {
    box.textContent = String(error);
  }
}
document.getElementById("xlsx").addEventListener("click", () => void exportProducts("xlsx"));
document.getElementById("json").addEventListener("click", () => void exportProducts("json"));
document.getElementById("media").addEventListener("click", async () => {
  const box = document.getElementById("media-status");
  box.textContent = "Đang tải…";
  try {
    const r = await (await collectRequest(`${API}/media/download`, { method: "POST" })).json();
    box.textContent = `Đã tải ${r.downloaded} · Trùng ${r.duplicates} · Đã có ${r.skipped} · Lỗi ${r.failed}`;
  } catch (error) {
    box.textContent = `Lỗi: ${error}`;
  }
});
chrome.storage.onChanged.addListener(refresh);
refresh();
