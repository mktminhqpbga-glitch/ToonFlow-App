// ACT: MacFlow only runs in the browser; native URL flags are ignored.
const parameters = new URLSearchParams(window.location.search);
const desktop = false;
const mobile = false;
const remoteConnection = false;
const platformSimulationValues = ["actual", "browser"] as const;

// ACT: 模拟只用于前端分支；宿主握手、原生调用与连接边界始终读取真实平台。
export const actualPlatform = {
  isDesktop: desktop,
  isMobile: mobile,
  isRemoteConnection: remoteConnection,
  isLocalDesktop: desktop && !remoteConnection,
  isLocalMobile: mobile && !remoteConnection,
  isWindows: /Windows/i.test(navigator.userAgent),
  isMac: navigator.platform.includes("Mac"),
} as const;

export const platformSimulation = platformSimulationValues.find(value => value === parameters.get("simulatePlatform")) ?? "actual";
export const isMobile = actualPlatform.isMobile;
export const isDesktop = actualPlatform.isDesktop;
export const isRemoteConnection = actualPlatform.isRemoteConnection;
export const isLocalDesktop = isDesktop && !isRemoteConnection;
export const isLocalMobile = isMobile && !isRemoteConnection;
export const isWindows = actualPlatform.isWindows;
export const isMac = actualPlatform.isMac;

export function setPlatformSimulation(value: string) {
  if (!platformSimulationValues.some(option => option === value)) throw new Error("Nền tảng mô phỏng không được hỗ trợ");
  if (value === platformSimulation) return;
  const url = new URL(window.location.href);
  if (value === "actual") url.searchParams.delete("simulatePlatform");
  else url.searchParams.set("simulatePlatform", value);
  window.location.replace(url.href);
}
