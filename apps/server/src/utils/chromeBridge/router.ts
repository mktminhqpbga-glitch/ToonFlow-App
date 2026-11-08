import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { getRuntimePlatform } from "@/lib/platform";
import u from "@/utils";
import { readReference } from "@/utils/media/generation";
import { chromeBridge, type BridgeProvider } from "./runtime";
import { success, errorFromCause } from "@/lib/responseFormat";

const providerSchema = z.enum(["muse", "gemini", "chatgpt"]);
const referenceSchema = z.discriminatedUnion("dataType", [
  z.object({ dataType: z.literal("STRING"), value: z.string().max(100000) }),
  z.object({ dataType: z.literal("IMAGE"), value: z.object({ url: z.string().min(1).max(2048), mimeType: z.string().regex(/^image\/(png|jpeg|webp)$/) }) }),
]);
const router = Router();
function authorized(req: Request, res: Response, next: NextFunction) {
  const platform = getRuntimePlatform();
  const origin = "http://" + req.get("host");
  const supplied = req.get("origin");
  const referer = req.get("referer");
  if (!platform.desktop || platform.os !== "darwin" || req.hostname !== "127.0.0.1"
    || !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "")
    || supplied !== undefined && supplied !== origin || referer !== undefined && !referer.startsWith(origin + "/")
    || !supplied && !referer) { res.sendStatus(403); return; }
  res.set("Cache-Control", "no-store");
  next();
}
router.use(authorized);
function handler(action: (req: Request, res: Response) => Promise<unknown> | unknown) {
  return async (req: Request, res: Response) => {
    try { const data = await action(req, res); if (!res.destroyed) res.json(success(data)); }
    catch (cause) { const value = errorFromCause(cause); res.status(value.code).json(value); }
  };
}
router.get("/status", handler(() => chromeBridge.status()));
router.get("/tabs", handler(() => chromeBridge.tabs()));
router.post("/select", handler(req => {
  const input = z.object({ provider: providerSchema, tabId: z.number().int().nonnegative() }).parse(req.body);
  return chromeBridge.select(input.provider, input.tabId);
}));
router.post("/refresh", handler(req => chromeBridge.refresh(providerSchema.parse(req.body?.provider))));
router.post("/disconnect", handler(req => chromeBridge.unselect(providerSchema.parse(req.body?.provider))));
router.post("/text", handler(async (req, res) => {
  const input = z.object({
    provider: z.enum(["gemini", "chatgpt"]),
    prompt: z.string().trim().min(1).max(100000),
    directory: z.string().max(4096).optional(),
    references: z.array(referenceSchema).max(8).default([]),
  }).parse(req.body);
  const localImages: { data: string; mimeType: string }[] = [];
  const texts: string[] = [];
  if (input.references.some(item => item.dataType === "IMAGE") && !input.directory) throw new Error("Thiếu thư mục cho ảnh tham chiếu");
  const workspace = input.directory ? await u.workspace.resolveWorkspace(req, input.directory) : "";
  for (const reference of input.references) {
    if (reference.dataType === "STRING") texts.push(reference.value);
    else {
      const image = await readReference(workspace, { path: reference.value.url, mimeType: reference.value.mimeType }, "image");
      localImages.push({ data: image.data, mimeType: image.mimeType });
    }
  }
  const fullPrompt = [input.prompt, ...texts.map((value, i) => "Tham chiếu văn bản " + (i + 1) + ":\n" + value)].join("\n\n");
  const controller = new AbortController();
  req.once("aborted", () => controller.abort());
  res.once("close", () => { if (!res.writableEnded) controller.abort(); });
  const result = await chromeBridge.run(input.provider as BridgeProvider, "text", fullPrompt, localImages, {}, controller.signal);
  if (result.kind !== "text" || !result.text?.trim()) throw new Error("AI không trả về văn bản hợp lệ");
  return { text: result.text };
}));
export default router;
