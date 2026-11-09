import { Router } from "express";
import { z } from "zod";
import { validateFields } from "@/lib/middleware";
import { success } from "@/lib/responseFormat";
import u from "@/utils";
import * as batches from "@/utils/media/batches";

export default Router().post("/", validateFields({ directory: z.string().min(1).max(4096), id: z.uuid(), action: z.enum(["pause", "resume", "cancel"]) }), async (req, res) => {
  const cwd = await u.workspace.resolveWorkspace(req, req.body.directory);
  res.set("Cache-Control", "no-store").json(success(await batches.controlBatch(cwd, req.body.id, req.body.action, u.multiTenant.requestIdentity(req))));
});
