import http from "@/lib/http";
import { unzipSync } from "fflate";

export type ChromeTarget = {
  tabId: number;
  provider: string;
  title?: string;
  url: string;
  documentToken: string;
  outputKinds: ("text" | "image" | "video" | "audio")[];
  ready: boolean;
  blocked: boolean;
  busy: boolean;
  taskId?: string;
};

export type ChromeMuseProfile = {
  selectedProfile?: "Profile 22";
  confirmed: boolean;
  verified: boolean;
  proxyMode?: string;
  countryCode?: string;
  checkedAt?: number;
  reason?: string;
};

export type ChromeStatus = {
  connected: boolean;
  socketUrl: string;
  device: { id: string; name: string; extensionId: string; pairedAt: number; mode: "normal" | "vm" } | null;
  pairingMode: "normal" | "vm" | null;
  relay: { configured: boolean; connected: boolean; error: string };
  pending: { id: string; name: string; extensionId: string } | null;
  pairingExpiresAt: number | null;
  lastSeenAt: number | null;
  target: { tabId: number; url: string; documentToken: string; outputKinds: ("text" | "image" | "video" | "audio")[]; ready: boolean; blocked: boolean } | null;
  targets?: ChromeTarget[];
  selected?: { tabId: number; provider: string } | null;
  museProfile?: ChromeMuseProfile;
  jobs: {
    paused: boolean;
    waiting: number;
    current: { id: string; tabId: number; provider: string; stage: string; updatedAt: number } | null;
    queued?: { id: string; tabId: number; provider: string; kind: "text" | "image" | "video" | "audio"; stage: string }[];
    recent: { id: string; tabId: number; provider: string; kind: "text" | "image" | "video" | "audio"; stage: string; updatedAt: number; sentAt: number | null; receivedAt: number | null; failedAtStage?: string; error?: string }[];
  };
};
export async function readChromeStatus(signal?: AbortSignal): Promise<ChromeStatus> {
  // Đọc dưới dạng text để phản hồi rỗng của proxy/backend không gây lỗi JSON khó hiểu.
  const response = await fetch("/api/aiChrome/status", {
    headers: { "x-toonflow-workspace": "1" }, cache: "no-store", signal,
  });
  const body = await response.text();
  if (!body.trim()) throw new Error("MacFlow chưa trả trạng thái Chrome. Kiểm tra backend rồi bấm Làm mới trạng thái.");
  let payload: { code?: number; data?: ChromeStatus; message?: string };
  try { payload = JSON.parse(body); }
  catch { throw new Error("Phản hồi trạng thái Chrome không phải JSON hợp lệ. Hãy kiểm tra backend MacFlow."); }
  if (!response.ok || payload.code !== 200 || !payload.data) throw new Error(payload.message || `Không đọc được trạng thái Chrome (HTTP ${response.status}).`);
  return payload.data;
}
export const pairChrome = (mode: "normal" | "vm" = "normal") => http<{ code: string; expiresAt: number; mode: "normal" | "vm" }>({ method: "POST", url: "/api/aiChrome/pair", data: { mode } });
export const approveChrome = (id: string) => http({ method: "POST", url: "/api/aiChrome/approve", data: { id } });
export const disconnectChrome = () => http({ method: "POST", url: "/api/aiChrome/disconnect" });
export const resumeChromeQueue = () => http({ method: "POST", url: "/api/aiChrome/resume" });
export const saveChromeMuseProfile = (input: { profileDirectory: "Profile 22"; confirmedExtensionInProfile: true }) =>
  http<ChromeMuseProfile>({ method: "POST", url: "/api/aiChrome/profile", data: input });

export async function downloadChromeExtension() {
  // Tải và kiểm tra xong mới cho trình duyệt lưu tệp. Mở Save File Picker trước
  // khi fetch có thể để lại ZIP 0 byte nếu request thất bại.
  const response = await fetch("/api/aiChrome/extension", { headers: { "x-toonflow-workspace": "1" }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(typeof error?.message === "string" && error.message
      ? error.message : `Không tải được extension (HTTP ${response.status}).`);
  }
  const blob = await response.blob();
  if (blob.size < 1024) throw new Error("Máy chủ trả về gói extension trống hoặc không đầy đủ. Chưa lưu tệp.");
  try {
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const manifestBytes = files["manifest.json"];
    if (!manifestBytes || !files["background.js"] || !files["popup.html"] || !files["museBridge.js"] || !files["siteBridge.js"] || !files["profileGuard.js"]) throw new Error("Thiếu tệp extension");
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
    if (manifest.manifest_version !== 3 || manifest.name !== "MacFlow AI chrome") throw new Error("Sai manifest");
  } catch {
    throw new Error("Tệp extension tải về không phải ZIP hợp lệ hoặc thiếu thành phần. Chưa lưu tệp.");
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "macflowChrome.zip";
  document.body.append(link);
  try { link.click(); }
  finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
