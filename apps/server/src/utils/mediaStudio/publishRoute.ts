import { Router } from "express";
import { z } from "zod";
import { validateFields } from "@/lib/middleware";
import { success } from "@/lib/responseFormat";
import { requireDirectModelAccess } from "@/utils/multiTenant/gateway";
import { publishWorkspaceVideo } from "@/utils/assets/generatedVideos";
import u from "@/utils";

export default Router().post("/", validateFields({
  directory: z.string().min(1).max(4096),
  path: z.string().min(1).max(2048).refine(path => path.startsWith("assets/generated/")
    && !path.includes("\\") && path.split("/").every(part => part && part !== "." && part !== "..")),
}), async (req, res) => {
  u.mcpControl.assertAppRequest(req);
  requireDirectModelAccess();
  const directory = await u.workspace.resolveWorkspace(req, req.body.directory);
  const path = await publishWorkspaceVideo(directory, req.body.path, true);
  res.set("Cache-Control", "no-store").json(success({ path }));
});
