import { Router } from "express";
import { success } from "@/lib/responseFormat";
import u from "@/utils";

export default Router().post("/", (req, res) => {
  u.aiChrome.authorize(req);
  res.set("Cache-Control", "no-store").json(success(u.aiChrome.disconnect()));
});
