import { Router } from "express";
import { z } from "zod";
import { validateFields } from "@/lib/middleware";
import { success } from "@/lib/responseFormat";
import u from "@/utils";
import { moneyPrinterProvider, moneyPrinterSchema } from "@/utils/mediaStudio/moneyPrinterTurbo";
import { requireDirectModelAccess } from "@/utils/multiTenant/gateway";

export default Router().post("/", validateFields({
  taskId: z.uuid(), directory: z.string().min(1).max(4096),
  script: z.string().trim().min(1).max(12000), video: moneyPrinterSchema,
}), async (req, res) => {
  u.mcpControl.assertAppRequest(req);
  requireDirectModelAccess();
  const { directory, taskId, script, video } = req.body;
  const cwd = await u.workspace.resolveWorkspace(req, directory);
  if (req.aborted || res.destroyed) return;
  await u.mediaTasks.start(cwd, taskId, "video", {
    providerId: moneyPrinterProvider, modelId: "localRenderer", prompt: script, other: moneyPrinterSchema.parse(video),
  }, {}, u.multiTenant.requestIdentity(req), true);
  res.set("Cache-Control", "no-store").json(success({ taskId }));
});
