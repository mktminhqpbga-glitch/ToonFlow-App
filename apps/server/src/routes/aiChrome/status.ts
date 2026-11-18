import { Router } from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";

export default Router().get("/", (req, res) => {
  u.aiChrome.authorize(req);
  res.set("Cache-Control", "no-store").json(success({ ...u.aiChrome.status(), socketUrl: `ws://127.0.0.1:${req.socket.localPort}/api/aiChrome/socket` }));
});
