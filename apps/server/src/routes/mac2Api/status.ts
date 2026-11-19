import { Router } from "express";
import { success } from "@/lib/responseFormat";
import u from "@/utils";
import { discoverMac2Api, getConnection, settingsStatus } from "@/utils/mac2Api/connection";

export default Router().get("/", async (req, res) => {
  u.mcpControl.assertAppRequest(req);
  u.multiTenant.requireDirectModelAccess();
  const connection = getConnection();
  const discovery = connection ? await discoverMac2Api(connection, req.query.refresh === "1") : undefined;
  res.set("Cache-Control", "no-store").json(success({ ...settingsStatus(), discovery }));
});
