import { Router, type Request, type RequestHandler } from "express";
import { updateChannel, type UpdateAction, type UpdateFromServer, type UpdateFromLauncher, type UpdateSnapshot } from "../../../../scripts/macFlowUpdateProtocol";
import { success, error } from "@/lib/responseFormat";
import { isEnabled } from "@/utils/multiTenant/mode";
import { hasPendingMediaWork } from "@/utils/media/tasks";
import { hasActiveAgentRuns } from "@/agent/runtime/sessions";
import { hasActiveSingleAgentRuns } from "@/utils/singleAgent";
import { getProgress } from "@/utils/ffmpeg";
import { localVideoAffStatus } from "@/utils/videoAff/local";

const managed = typeof process.send === "function" && !!process.env.MACFLOW_INSTALL_ROOT;
const loopback = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
let snapshot: UpdateSnapshot | null = null;
let lastActivity = 0;
let requests = 0;
let restartingUntil = 0;

function send(message: UpdateFromServer) {
  process.send?.({ channel: updateChannel, ...message });
}

if (managed) {
  process.on("message", (message: UpdateFromLauncher & { channel?: string }) => {
    if (message?.channel !== updateChannel) return;
    if (message.type === "snapshot") {
      snapshot = message.snapshot;
      return;
    }
    if (message.type !== "drain") return;
    const ready = !isEnabled() && requests === 0 && !hasPendingMediaWork() && !hasActiveAgentRuns()
      && !hasActiveSingleAgentRuns() && localVideoAffStatus().phase !== "starting"
      && !["downloading", "installing"].includes(getProgress().phase)
      && (!message.automatic || Date.now() - lastActivity >= 90_000);
    if (ready) restartingUntil = Date.now() + 8000;
    send({ type: "drain", id: message.id, ready });
  });
  process.on("disconnect", () => process.exit());
}

export function notifyUpdateLauncherReady() {
  if (managed) send({ type: "ready" });
}

export const trackUpdateWork: RequestHandler = (req, res, next) => {
  if (!managed || !/^\/(api|mcp|a2a)\//i.test(req.path) || /^\/api\/macFlowUpdate(?:\/|$)/i.test(req.path)
    || ["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (Date.now() < restartingUntil) {
    res.status(503).json(error("MacFlow đang khởi động lại để cập nhật. Hãy thử lại sau một lát.", null, 503));
    return;
  }
  requests++;
  const finish = () => {
    res.off("finish", finish);
    res.off("close", finish);
    requests--;
  };
  res.once("finish", finish);
  res.once("close", finish);
  next();
};

function localRequest(req: Request) {
  return managed && !isEnabled() && !req.res?.locals.multiTenantWeb && !req.headers["x-forwarded-for"]
    && !req.headers.forwarded && loopback.has(req.socket.remoteAddress || "") && localHosts.has(req.hostname);
}

const router = Router();
router.get("/", (req, res) => {
  res.header("Cache-Control", "no-store");
  if (!localRequest(req)) return res.json(success(null));
  if (req.headers["sec-fetch-site"] === "same-origin" && req.headers["x-macflow-active"] === "1") lastActivity = Date.now();
  return res.json(success(snapshot));
});
router.post("/", (req, res) => {
  if (!localRequest(req) || !snapshot || req.headers.origin !== `http://${req.headers.host}`
    || req.headers["sec-fetch-site"] !== "same-origin") return res.status(403).json(error("Chỉ cập nhật từ MacFlow trên máy đang chạy.", null, 403));
  if (Date.now() < restartingUntil || snapshot.phase === "restarting")
    return res.status(409).json(error("MacFlow đang khởi động lại. Hãy chờ cập nhật hoàn tất.", null, 409));
  const action = req.body as Partial<UpdateAction> | null;
  if (action?.type === "automatic" && typeof action.enabled === "boolean") {
    send({ type: "automatic", enabled: action.enabled });
  } else if (action?.type === "check" || action?.type === "install") {
    send({ type: action.type });
  } else return res.status(400).json(error("Thao tác cập nhật không hợp lệ.", null, 400));
  return res.json(success(snapshot));
});

export default router;
