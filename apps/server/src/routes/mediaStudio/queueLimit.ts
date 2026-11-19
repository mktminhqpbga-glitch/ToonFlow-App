import { Router } from "express";
import { z } from "zod";
import { validateFields } from "@/lib/middleware";
import { success } from "@/lib/responseFormat";
import u from "@/utils";

export default Router().put("/", validateFields({
  mediaType: z.enum(["image", "video"]),
  limit: z.number().int().min(1).max(10),
}), (req, res) => {
  u.mcpControl.assertAppRequest(req);
  const { mediaType, limit } = req.body;
  u.mediaTasks.setStudioQueueLimit(mediaType, limit, u.multiTenant.requestIdentity(req));
  res.set("Cache-Control", "no-store").json(success({ limit }));
});
