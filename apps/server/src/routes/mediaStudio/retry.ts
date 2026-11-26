import { Router } from "express";
import { z } from "zod";
import { validateFields } from "@/lib/middleware";
import { success } from "@/lib/responseFormat";
import u from "@/utils";

export default Router().post("/", validateFields({
  directory: z.string().min(1).max(4096),
  previousTaskId: z.uuid(),
  taskId: z.uuid(),
}), async (req, res) => {
  u.mcpControl.assertAppRequest(req);
  const { directory, taskId, previousTaskId } = req.body;
  const cwd = await u.workspace.resolveWorkspace(req, directory);
  if (req.aborted || res.destroyed) return;
  await u.mediaTasks.retryStudio(cwd, previousTaskId, taskId, u.multiTenant.requestIdentity(req), providerId => {
    if (providerId === "aiChrome") u.aiChrome.authorize(req);
  });
  res.set("Cache-Control", "no-store").json(success({ taskId }));
});
