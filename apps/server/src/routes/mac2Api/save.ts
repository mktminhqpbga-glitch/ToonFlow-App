import { Router } from "express";
import { z } from "zod";
import { validateFields } from "@/lib/middleware";
import { success } from "@/lib/responseFormat";
import u from "@/utils";
import { saveConnection } from "@/utils/mac2Api/connection";

export default Router().put("/", validateFields({
  baseUrl: z.string().trim().min(1).max(2048), apiKey: z.string().trim().max(520).optional(),
}), (req, res) => {
  u.mcpControl.assertAppRequest(req);
  u.multiTenant.requireDirectModelAccess();
  res.set("Cache-Control", "no-store").json(success(saveConnection(req.body.baseUrl, req.body.apiKey)));
});
