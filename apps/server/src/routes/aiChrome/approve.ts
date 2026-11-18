import { Router } from "express";
import { z } from "zod";
import { validateFields } from "@/lib/middleware";
import { success } from "@/lib/responseFormat";
import u from "@/utils";

export default Router().post("/", validateFields({ id: z.uuid() }), (req, res) => {
  u.aiChrome.authorize(req);
  res.set("Cache-Control", "no-store").json(success(u.aiChrome.approve(req.body.id)));
});
