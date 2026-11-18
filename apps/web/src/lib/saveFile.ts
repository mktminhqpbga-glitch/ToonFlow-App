import axios from "axios";
import { ElMessage } from "element-plus";
import { actualPlatform } from "./platform";

declare global {
  interface WindowEventMap {
    "toonflow:mobile-save": CustomEvent<{ requestId: string; saved: boolean; error?: string }>;
  }
}

export default async function saveFile(content: Blob | (() => Promise<Blob>), fileName: string): Promise<boolean> {
  if (actualPlatform.isMobile) {
    const blob = typeof content === "function" ? await content() : content;
    const { data } = await axios.post<{ url: string }>("/api/mobile/exports", blob, {
      params: { fileName }, headers: { "Content-Type": "application/octet-stream" },
    });
    if (typeof data?.url !== "string" || !/^\/api\/mobile\/exports\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.url)) {
      throw new Error("API xuất tệp trả về địa chỉ tệp không hợp lệ");
    }
    const requestId = crypto.randomUUID();
    const target = new URL("toonflow://save");
    target.search = new URLSearchParams({ requestId, url: new URL(data.url, window.location.origin).href, fileName }).toString();
    return new Promise<boolean>((resolve, reject) => {
      const handleSaved = (event: WindowEventMap["toonflow:mobile-save"]) => {
        const detail = event.detail;
        if (detail?.requestId !== requestId) return;
        window.removeEventListener("toonflow:mobile-save", handleSaved);
        if (detail.error) reject(new Error(detail.error));
        else if (typeof detail.saved !== "boolean") reject(new Error("Lưu tệp trả về kết quả không hợp lệ"));
        else resolve(detail.saved);
      };
      window.addEventListener("toonflow:mobile-save", handleSaved);
      window.location.href = target.href;
    });
  }
  if (actualPlatform.isDesktop) {
    const { data: selectData } = await axios.post<{ code: number; data: { token: string | null }; message?: string }>(
      "/api/desktop/selectSaveFile",
      { fileName },
      { headers: { "x-toonflow-desktop": "1" } },
    );
    if (selectData.code !== 200) throw new Error(selectData.message || "Không thể chọn vị trí lưu");
    const token = selectData.data?.token;
    if (!token) return false;
    const blob = typeof content === "function" ? await content() : content;
    const { data } = await axios.post<{ code: number; data: { saved: boolean }; message?: string }>("/api/desktop/saveFile", blob, {
      params: { token },
      headers: { "Content-Type": "application/octet-stream", "x-toonflow-desktop": "1" },
    });
    if (data.code !== 200 || typeof data.data?.saved !== "boolean") throw new Error(data.message || "Lưu tệp thất bại");
    return data.data.saved;
  }
  const blob = typeof content === "function" ? await content() : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

export function registerDownloads() {
  const pending = new WeakSet<HTMLAnchorElement>();
  function handleDownload(event: MouseEvent) {
    const link = event.composedPath().find(element => element instanceof HTMLAnchorElement && element.hasAttribute("download")) as HTMLAnchorElement | undefined;
    if (!link?.href || event.button !== 0) return;
    const url = new URL(link.href);
    if (url.origin !== window.location.origin || !["blob:", "http:", "https:"].includes(url.protocol)) return;
    event.preventDefault();
    if (pending.has(link) || link.getAttribute("aria-disabled") === "true") return;
    pending.add(link);
    link.dispatchEvent(new CustomEvent("downloadstate", { detail: true }));
    // ACT: 捕获同源下载以兼容已安装节点；Android 先暂存内容，再交给系统文件选择器。
    void saveFile(() => axios.get<Blob>(url.href, { responseType: "blob" }).then(({ data }) => data), link.download || "download").catch(error => {
      ElMessage.error(axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : "Lưu tệp thất bại");
    }).finally(() => {
      pending.delete(link);
      link.dispatchEvent(new CustomEvent("downloadstate", { detail: false }));
    });
  }
  if (actualPlatform.isDesktop || actualPlatform.isMobile) document.addEventListener("click", handleDownload, true);
  return () => document.removeEventListener("click", handleDownload, true);
}
