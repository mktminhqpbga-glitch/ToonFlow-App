import { createApp, h, nextTick, ref, type App } from "vue";
import { ElButton, ElResult } from "element-plus";
import { isRtlLocale } from "@toonflow/i18n";
import "@/assets/main.scss";
import "element-plus/es/components/message-box/style/css";
import "element-plus/es/components/button/style/css";
import "element-plus/es/components/result/style/css";
import "element-plus/theme-chalk/dark/css-vars.css";

import { initializeMultiTenant } from "@/bootstrap/multiTenant";
import { createCreationApp } from "@/bootstrap/creation";
import { actualPlatform } from "@/lib/platform";
import { getMissingBrowserFeatures } from "@/lib/browserCapabilities";
import { publicWeb } from "@/stores/multiTenant";
import { detectLocale, locale, setLocale, translate } from "@toonflow/i18n/vue";

// Khi chưa tải cài đặt của người dùng, hiển thị tiếng Việt mặc định.
// Nếu người dùng đã chọn "Hệ thống" hoặc một ngôn ngữ khác, cấu hình sau đó sẽ ghi đè.
setLocale("vi");
document.documentElement.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.lang = locale.value;
document.documentElement.dir = isRtlLocale(locale.value) ? "rtl" : "ltr";
let app: App<Element> | undefined;
const requiresWebView2Update = actualPlatform.isDesktop && actualPlatform.isWindows
  && [Map.groupBy, URL.canParse, Promise.withResolvers].some(method => typeof method !== "function");
const requiresMobileWebViewUpdate = actualPlatform.isMobile && getMissingBrowserFeatures().length > 0;
let isMounted = false;

async function notifyDesktopReady(failed = false) {
  if (!actualPlatform.isDesktop || publicWeb.value) return;
  const response = await fetch("/api/desktop/ready", {
    method: "POST",
    headers: { "x-toonflow-desktop": "1", "Content-Type": "application/json", "Accept-Language": locale.value },
    body: JSON.stringify({ failed }),
  });
  if (!response.ok) throw new Error((await response.json()).message || `Không thể thông báo trạng thái sẵn sàng cho desktop (HTTP ${response.status})`);
}

// ACT: 已安装客户端的自动更新不经过 NSIS；启动时阻止缺少所需 API 的旧 WebView2 进入业务页面。
async function initialize() {
  if (requiresWebView2Update) throw new Error("Phiên bản Microsoft Edge WebView2 Runtime quá cũ. Hãy chạy trình cài đặt mới nhất của Microsoft với quyền quản trị; nếu vẫn báo đã cài, hãy sửa WebView2 hoặc liên hệ quản trị viên. Sau khi cập nhật, thoát hẳn Toonflow rồi mở lại.");
  if (requiresMobileWebViewUpdate) throw new Error("Trình duyệt hệ thống trên thiết bị di động còn thiếu tính năng Toonflow cần dùng. Hãy cập nhật Toonflow và trình duyệt hệ thống; một số thiết bị cần nâng cấp hệ điều hành. Sau khi cập nhật, thoát hẳn rồi mở lại Toonflow.");
  const { session, app: tenantApp } = await initializeMultiTenant();
  app = tenantApp ?? await createCreationApp(session);
  app.mount("#app");
  isMounted = true;
  if (!actualPlatform.isDesktop || session.publicWeb) return;
  await nextTick();
  // ACT: 隐藏的 WebView 不依赖 requestAnimationFrame；等待首页挂载和页面资源就绪。
  if (document.readyState !== "complete") {
    await new Promise<void>((resolve) => window.addEventListener("load", () => resolve(), { once: true }));
  }
  await notifyDesktopReady();
}

void initialize().catch(async (error) => {
  console.error("Khởi tạo trang thất bại: ", error);
  if (isMounted) app?.unmount();
  const disconnecting = ref(false);
  const recoveryError = ref("");
  async function disconnectRemote() {
    if (disconnecting.value) return;
    disconnecting.value = true;
    recoveryError.value = "";
    try {
      const response = await fetch("/api/connection/disconnect", { method: "POST", headers: { "x-toonflow-workspace": "1" } });
      if (!response.ok) throw new Error((await response.json()).message || "Không thể chuyển lại sang chế độ trên máy; hãy thử lại");
      if ((await response.json()).restart === "mobile") window.location.href = "toonflow://restart";
    } catch (cause) {
      recoveryError.value = cause instanceof Error ? cause.message : "Không thể chuyển lại sang chế độ trên máy; hãy thử lại";
      disconnecting.value = false;
    }
  }
  createApp({
    render: () => h(ElResult, {
      icon: "error",
      title: requiresWebView2Update ? translate("需要更新 WebView2") : requiresMobileWebViewUpdate ? "Cần cập nhật trình duyệt hệ thống" : translate("启动失败"),
      subTitle: error instanceof Error ? error.message : translate("无法加载应用，请重试。"),
    }, {
      extra: () => [h(ElButton, {
        type: "primary",
        disabled: disconnecting.value,
        onClick: () => requiresWebView2Update
          ? window.open("https://developer.microsoft.com/microsoft-edge/webview2/#download", "_blank")
          : window.location.reload(),
      }, () => requiresWebView2Update ? translate("前往微软官网更新") : translate("重试")),
      actualPlatform.isRemoteConnection ? h(ElButton, { loading: disconnecting.value, onClick: disconnectRemote }, () => translate("断开并独立运行")) : null,
      recoveryError.value ? h("p", { role: "alert" }, recoveryError.value) : null],
    }),
  }).mount("#app");
  await nextTick();
  // ACT: 错误页也要结束启动动画，但不能消费尚未注册监听的安装请求。
  await notifyDesktopReady(true).catch((error) => console.error("Không thể hiển thị trang lỗi khởi động: ", error));
});
