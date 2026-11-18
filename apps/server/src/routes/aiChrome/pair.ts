import { Router } from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
import { z } from "zod";
import { validateFields } from "@/lib/middleware";

export default Router().post("/", validateFields({ mode: z.enum(["normal", "vm"]).optional() }), async (req, res) => {
  u.aiChrome.authorize(req);
  res.set("Cache-Control", "no-store").json(success(await u.aiChrome.createPairing(req, req.body?.mode ?? "normal")));
});
