import type { Request, Response } from "express";
import u from "@/utils";
import type { AuthenticatedOptions, Channel } from "@/utils/channel/types";
import { success } from "@/lib/responseFormat";

export default async function channelRequest(
  req: Request,
  res: Response,
  action: (channel: Channel, options: AuthenticatedOptions) => Promise<unknown>,
  authenticated = false,
) {
  res.set("Cache-Control", "no-store");
  // Legacy Toonflow commercial channel is opt-in; do not send user data upstream
  // just because a legacy panel/route is present in the independent fork.
  if (process.env.TOONFLOW_LEGACY_CHANNEL !== "1")
    throw Object.assign(new Error("Legacy Toonflow commercial services are disabled; enable explicitly to use your own account"), { status: 503 });
  u.mcpControl.assertAppRequest(req);
  const token = authenticated ? u.ai.getAccountToken() : "";
  if (authenticated && (!token || req.get("authorization") !== `Bearer ${token}`)) {
    throw Object.assign(new Error("账号已变更或未登录，请重新登录"), { status: 401 });
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  res.once("close", abort);
  req.once("aborted", abort);
  req.socket.once("close", abort);
  if (req.aborted || res.destroyed || req.socket.destroyed) abort();
  try {
    controller.signal.throwIfAborted();
    const result = await action(u.channel.getChannel(), { token, signal: controller.signal });
    if (authenticated && u.ai.getAccountToken() !== token) {
      throw Object.assign(new Error("账号已变更，请刷新后重试"), { status: 401 });
    }
    if (!controller.signal.aborted && !res.destroyed) res.json(success(result));
  } catch (error) {
    if (!controller.signal.aborted) throw error;
  } finally {
    res.off("close", abort);
    req.off("aborted", abort);
    req.socket.off("close", abort);
  }
}
