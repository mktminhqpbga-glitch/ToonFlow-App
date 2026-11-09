import { getRuntimePlatform } from "@/lib/platform";
export function isLocalWebBridgeEnabled() {
  const platform = getRuntimePlatform();
  return !platform.desktop && !platform.mobile && platform.os === "darwin"
    && process.env.TOONFLOW_LOCAL_WEB_BRIDGE === "1"
    && process.env.TOONFLOW_SERVER_HOST === "127.0.0.1";
}

/** Mirror the loopback/Origin gates of the Chrome Bridge routes; no authentication shortcuts. */
export function authorizeBridgeRequest(input: {
  desktopAllowed: boolean; localWebAllowed: boolean; loopback: boolean;
  method: string; desktopHeader?: string; localClientHeader?: string;
  origin?: string; referer?: string; expectedOrigin: string;
}) {
  if (input.localWebAllowed && input.localClientHeader === "0") return false;
  return (input.desktopAllowed || input.localWebAllowed) && input.loopback
    && (input.method !== "POST" || input.desktopHeader === "1")
    && (input.origin === undefined || input.origin === input.expectedOrigin)
    && (input.referer === undefined || input.referer.startsWith(input.expectedOrigin + "/"))
    && (input.origin !== undefined || input.referer !== undefined);
}
