import { Router } from "express";
import { z } from "zod";
import { validateFields } from "@/lib/middleware";
import { success } from "@/lib/responseFormat";
import u from "@/utils";
import * as batches from "@/utils/media/batches";

export default Router().post("/", validateFields({ directory: z.string().min(1).max(4096), kind: z.enum(["image", "video"]), requests: z.array(z.unknown()).min(1).max(100) }), async (req, res) => {
  const cwd = await u.workspace.resolveWorkspace(req, req.body.directory);
  const batch = await batches.createBatch(cwd, req.body.kind, req.body.requests, u.multiTenant.requestIdentity(req));
  res.set("Cache-Control", "no-store").json(success(batch));
});
