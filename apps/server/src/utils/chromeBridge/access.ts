import { getRuntimePlatform } from "@/lib/platform";
export function isLocalWebBridgeEnabled() {
  const platform = getRuntimePlatform();
  return !platform.desktop && !platform.mobile && platform.os === "darwin"
    && process.env.TOONFLOW_LOCAL_WEB_BRIDGE === "1"
    && process.env.TOONFLOW_SERVER_HOST === "127.0.0.1";
}
