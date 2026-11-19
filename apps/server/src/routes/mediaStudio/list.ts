import { Router } from "express";
import { z } from "zod";
import { validateFields } from "@/lib/middleware";
import { success } from "@/lib/responseFormat";
import u from "@/utils";
import { listStudioHistory } from "@/utils/mediaStudio/history";

export default Router().get("/", validateFields({
  directory: z.string().min(1).max(4096),
  mediaType: z.enum(["image", "video"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10000).optional(),
}, "query"), async (req, res) => {
  u.mcpControl.assertAppRequest(req);
  const directory = await u.workspace.resolveWorkspace(req, req.query.directory as string);
  const mediaType = req.query.mediaType as "image" | "video" | undefined;
  const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
  const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
  res.set("Cache-Control", "no-store").json(success(await listStudioHistory(
    directory, u.multiTenant.requestIdentity(req), { mediaType, limit, offset },
  )));
});
