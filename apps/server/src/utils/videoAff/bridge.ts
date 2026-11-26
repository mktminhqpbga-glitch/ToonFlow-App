import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import type { Message } from "@earendil-works/pi-ai";
import { mkdir, readFile, stat } from "@toonflow/file";
import { Router, type Response } from "express";
import { z } from "zod";
import u from "@/utils";
import { sendFile } from "@/utils/fileHttp";
import { dataUrlSchema, decodeImage, fail, modelFor, videoAffCallback, videoAffToken, videoAffWorkspace } from "./config";

const mediaDirectory = "assets/videoAffTasks";
const referenceDirectory = "assets/videoAffReferences";
const bridge = Router();
const promptSchema = z.string().trim().min(1).max(100000);
const textPart = z.object({ type: z.literal("text"), text: z.string().max(200000) });
const imagePart = z.object({ type: z.literal("image_url"), image_url: z.object({ url: dataUrlSchema }) });
const messageSchema = z.object({
  role: z.enum(["system", "developer", "user", "assistant"]),
  content: z.union([z.string().max(200000), z.array(z.discriminatedUnion("type", [textPart, imagePart])).max(48)]),
});
type MediaKind = "image" | "video" | "audio";
type Task = Awaited<ReturnType<typeof u.mediaTasks.status>>[number];

function deadline(res: Response, ms: number) {
  const disconnect = new AbortController();
  res.once("close", () => disconnect.abort());
  return AbortSignal.any([disconnect.signal, AbortSignal.timeout(ms)]);
}

bridge.use((req, _res, next) => {
  const token = videoAffToken();
  if (!token || req.get("origin")) fail("Cầu nối VideoAFF chỉ nhận yêu cầu từ máy chủ đã cấu hình.", 403);
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(req.get("authorization") ?? "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) fail("Mã kết nối VideoAFF không hợp lệ.", 401);
  next();
});

bridge.post("/chat/completions", async (req, res) => {
  const input = z.object({ model: z.enum(["macflow-writer", "macflow-review"]), messages: z.array(messageSchema).min(1).max(30),
    stream: z.literal(false).optional() }).parse(req.body);
  const selection = modelFor(input.model === "macflow-writer" ? "writer" : "review");
  const configured = await u.ai.getConfiguredModel(selection.providerId, selection.modelId);
  const messages: Message[] = [];
  const system: string[] = [];
  const timestamp = Date.now();
  let totalImageBytes = 0;
  for (const message of input.messages) {
    const parts = typeof message.content === "string" ? [{ type: "text" as const, text: message.content }] : message.content;
    const content = parts.map(part => {
      if (part.type === "text") return part;
      const { bytes, mimeType } = decodeImage(part.image_url.url);
      totalImageBytes += bytes.length;
      if (totalImageBytes > 32 * 1024 * 1024) fail("Ảnh gửi trong bước phân tích VideoAFF vượt 32 MiB.", 413);
      return { type: "image" as const, mimeType, data: bytes.toString("base64") };
    });
    if (message.role === "user") messages.push({ role: "user", content, timestamp });
    else {
      const text = content.flatMap(part => part.type === "text" ? [part.text] : []).join("\n");
      if (message.role === "assistant") {
        messages.push({ role: "assistant", content: [{ type: "text", text }], timestamp, api: configured.provider.protocol,
          provider: "toonflow", model: configured.model.id, stopReason: "stop",
          usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } });
      } else system.push(text);
    }
  }
  if (!messages.some(message => message.role === "user")) fail("Yêu cầu VideoAFF thiếu nội dung đầu vào.");
  const stream = u.ai.streamAi(configured, { systemPrompt: system.join("\n\n"), messages }, deadline(res, 160_000));
  for await (const _event of stream) { /* Consume events to obtain the assistant's final answer. */ }
  const answer = await stream.result();
  const content = answer.content.flatMap(part => part.type === "text" ? [part.text] : []).join("");
  if (!content || answer.stopReason === "error" || answer.stopReason === "aborted") {
    fail("Mô hình MacFlow chưa hoàn tất phân tích VideoAFF. Hãy kiểm tra cấu hình và thử lại.", 502);
  }
  res.json({ id: `chatcmpl-${randomUUID()}`, object: "chat.completion", created: Math.floor(timestamp / 1000), model: input.model,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: answer.stopReason === "length" ? "length" : "stop" }],
    usage: { prompt_tokens: answer.usage.input + answer.usage.cacheRead, completion_tokens: answer.usage.output,
      total_tokens: answer.usage.totalTokens } });
});

async function storeReference(workspace: string, source: string) {
  const { bytes, mimeType, extension } = decodeImage(source);
  await mkdir((await u.workspaceFile.resolveWorkspacePath(workspace, referenceDirectory, true)).path, { recursive: true });
  const path = `${referenceDirectory}/${randomUUID()}.${extension}`;
  const target = await u.workspaceFile.resolveWorkspacePath(workspace, path);
  await u.workspaceFile.writeWorkspaceFile(target.path, bytes, true);
  return { path, mimeType };
}

function outputFile(task: Task | undefined, type: MediaKind) {
  return task?.result?.data?.find(file => file.mediaType === type && file.path.startsWith(`${mediaDirectory}/`));
}

async function checkTask(workspace: string, id: string) {
  const [task] = await u.mediaTasks.status(workspace, [id], true);
  return task;
}

function taskFailure(task: Task | undefined) {
  return !task || task.state === "failed" || task.state === "cancelled" || (task.state === "interrupted" && !task.resumable);
}

async function waitForOutput(workspace: string, id: string, type: MediaKind, signal: AbortSignal) {
  try {
    while (true) {
      signal.throwIfAborted();
      const task = await checkTask(workspace, id);
      const file = outputFile(task, type);
      if (file) return file;
      if (taskFailure(task) || task?.state === "succeeded") fail("Mô hình MacFlow chưa trả được tệp. Hãy kiểm tra lịch sử tác vụ.", 502);
      await setTimeout(1200, undefined, { signal });
    }
  } catch (cause) {
    if (signal.aborted) fail("Đã hết thời gian chờ VideoAFF. Hãy kiểm tra tác vụ trong MacFlow trước khi tạo lại.", 504);
    throw cause;
  }
}

bridge.post("/images/edits", async (req, res) => {
  const input = z.object({ model: z.literal("macflow-image"), prompt: promptSchema, image: z.array(dataUrlSchema).max(12) }).parse(req.body);
  const selection = modelFor("image");
  const entry = (await u.mediaGeneration.listMediaModels()).find(model => model.type === "image"
    && model.providerId === selection.providerId && model.modelId === selection.modelId);
  if (!entry) fail("Mô hình ảnh đã chọn không còn khả dụng.", 503);
  const workspace = await videoAffWorkspace(req);
  const images = [];
  for (const source of input.image) images.push(await storeReference(workspace, source));
  const signal = deadline(res, 210_000);
  const taskId = randomUUID();
  const params = u.mediaSchemas.imageGenerationSchema.parse({ ...selection, prompt: input.prompt, images,
    ratio: entry.imageRatios?.includes("9:16") ? "9:16" : undefined, outputDirectory: mediaDirectory });
  await u.mediaTasks.start(workspace, taskId, "image", params, {}, null, true);
  const file = await waitForOutput(workspace, taskId, "image", signal);
  const { path } = await u.workspaceFile.resolveWorkspacePath(workspace, file.path);
  if ((await stat(path)).size > 24 * 1024 * 1024) fail("Ảnh trả về vượt dung lượng VideoAFF có thể nhận.", 413);
  const bytes = await readFile(path, { signal });
  res.json({ data: [{ b64_json: bytes.toString("base64") }] });
});

function videoTicket(id: string) {
  return `${id}.${createHmac("sha256", videoAffToken()!).update(`videoAff/video/${id}`).digest("base64url")}`;
}
function videoTaskId(ticket: string) {
  const id = z.uuid().safeParse(ticket.split(".")[0]);
  if (!id.success) fail("Mã tác vụ VideoAFF không hợp lệ.", 404);
  const expected = Buffer.from(videoTicket(id.data));
  const actual = Buffer.from(ticket);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) fail("Mã tác vụ VideoAFF không hợp lệ.", 404);
  return id.data;
}

bridge.post("/videos", async (req, res) => {
  const input = z.object({ model: z.literal("macflow-video"), prompt: promptSchema, image: dataUrlSchema,
    seconds: z.number().int().min(1).max(60), size: z.literal("9:16") }).parse(req.body);
  const selection = modelFor("video");
  const entry = (await u.mediaGeneration.listMediaModels()).find(model => model.type === "video"
    && model.providerId === selection.providerId && model.modelId === selection.modelId);
  if (!entry) fail("Mô hình video đã chọn không còn khả dụng.", 503);
  const mode = (["startFrameOptional", "endFrameOptional", "singleImage"] as const)
    .find(candidate => Array.isArray(entry.mode) && entry.mode.includes(candidate));
  if (!mode) fail("VideoAFF cần mô hình video nhận một ảnh mở đầu.");
  const resolutions = entry.durationResolutionMap?.filter(option => option.duration.includes(input.seconds)).flatMap(option => option.resolution) ?? [];
  if (entry.durationResolutionMap?.length && !resolutions.length) fail(`VideoAFF cần mô hình video hỗ trợ clip ${input.seconds} giây.`);
  const resolution = ["4K", "2K", "1080p", "720p", "540p", "480p"].find(value => resolutions.includes(value)) ?? resolutions[0];
  videoAffCallback();
  const workspace = await videoAffWorkspace(req);
  const firstFrame = await storeReference(workspace, input.image);
  const taskId = randomUUID();
  const params = u.mediaSchemas.videoGenerationSchema.parse({ ...selection, prompt: input.prompt, firstFrame,
    ratio: entry.imageRatios?.includes("9:16") || !entry.imageRatios?.length ? input.size : undefined,
    resolution, duration: input.seconds, mode, outputDirectory: mediaDirectory });
  await u.mediaTasks.start(workspace, taskId, "video", params, {}, null, true);
  res.json({ id: videoTicket(taskId), model: input.model, status: "queued" });
});

bridge.get("/videos/:ticket", async (req, res) => {
  const id = videoTaskId(req.params.ticket);
  const task = await checkTask(await videoAffWorkspace(req), id);
  if (outputFile(task, "video")) {
    return res.json({ id: req.params.ticket, status: "completed", video_url: `${videoAffCallback()}/videos/${req.params.ticket}/content` });
  }
  if (taskFailure(task) || task?.state === "succeeded") {
    return res.json({ id: req.params.ticket, status: "failed", error: { message: "VideoAFF chưa nhận được clip. Kiểm tra lịch sử MacFlow rồi thử lại cảnh này." } });
  }
  res.json({ id: req.params.ticket, status: task?.state === "queued" ? "queued" : "in_progress" });
});

bridge.get("/videos/:ticket/content", async (req, res, next) => {
  const workspace = await videoAffWorkspace(req);
  const file = outputFile(await checkTask(workspace, videoTaskId(req.params.ticket)), "video");
  if (!file) fail("Clip VideoAFF chưa sẵn sàng.", 404);
  const { path } = await u.workspaceFile.resolveWorkspacePath(workspace, file.path);
  res.type(file.mimeType);
  await sendFile(res, path, {}, next);
});

bridge.post("/audio/speech", async (req, res, next) => {
  const input = z.object({ model: z.literal("macflow-audio"), input: promptSchema,
    voice: z.string().trim().min(1).max(256), response_format: z.literal("mp3") }).parse(req.body);
  const selection = modelFor("audio");
  const workspace = await videoAffWorkspace(req);
  const id = randomUUID();
  const signal = deadline(res, 105_000);
  const params = u.mediaSchemas.audioGenerationSchema.parse({ ...selection, prompt: input.input,
    voice: input.voice === "auto" ? undefined : input.voice, format: "mp3", language: "vi", outputDirectory: mediaDirectory });
  await u.mediaTasks.start(workspace, id, "audio", params, {}, null);
  const file = await waitForOutput(workspace, id, "audio", signal);
  if (file.mimeType !== "audio/mpeg") fail("VideoAFF cần mô hình giọng đọc xuất được MP3.", 502);
  const { path } = await u.workspaceFile.resolveWorkspacePath(workspace, file.path);
  res.type(file.mimeType);
  await sendFile(res, path, {}, next);
});
export default bridge;
