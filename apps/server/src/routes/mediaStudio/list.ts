import { Router } from "express";
import { z } from "zod";
import { validateFields } from "@/lib/middleware";
import { success } from "@/lib/responseFormat";
import u from "@/utils";
import { listStudioHistory } from "@/utils/mediaStudio/history";
import { publishWorkspaceVideo } from "@/utils/assets/generatedVideos";
import { modelGateway } from "@/utils/multiTenant/gateway";

const syncing = new Set<string>();

export default Router().get("/", validateFields({
  directory: z.string().min(1).max(4096),
  mediaType: z.enum(["image", "video"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10000).optional(),
  queueOnly: z.literal("1").optional(),
  includeActive: z.literal("1").optional(),
}, "query"), async (req, res) => {
  u.mcpControl.assertAppRequest(req);
  const directory = await u.workspace.resolveWorkspace(req, req.query.directory as string);
  const mediaType = req.query.mediaType as "image" | "video" | undefined;
  const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
  const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
  const owner = u.multiTenant.requestIdentity(req);
  const queue = mediaType ? await u.mediaTasks.getStudioQueueStatus(directory, mediaType, owner) : undefined;
  const history = req.query.queueOnly ? { entries: [], hasMore: false } : await listStudioHistory(directory, owner, { mediaType, limit, offset });
  if (mediaType === "video" && !owner && !modelGateway.enabled() && !syncing.has(directory)) {
    const paths = history.entries.flatMap(entry => entry.studioQueue && entry.state === "succeeded" ? entry.result?.data?.map(file => file.path) ?? [] : []);
    if (paths.length) {
      syncing.add(directory);
      void (async () => {
        for (const path of paths) await publishWorkspaceVideo(directory, path).catch(() => {});
      })().finally(() => syncing.delete(directory));
    }
  }
  const active = mediaType && req.query.includeActive ? u.mediaTasks.getStudioActiveTasks(directory, mediaType, owner) : [];
  const listed = new Set(history.entries.map(entry => entry.taskId));
  const entries = [...history.entries, ...active.filter(entry => !listed.has(entry.taskId))];
  res.set("Cache-Control", "no-store").json(success({ entries, hasMore: history.hasMore, queue }));
});
