import { z } from "zod";

export const mac2ApiProviders = {
  mac2ApiMuse: { upstream: "muse", models: { "muse/image": "image", "muse/video": "video" } },
  mac2ApiChatGpt: { upstream: "chatgpt", models: { "chatgpt/image": "image" } },
  mac2ApiGemini: { upstream: "gemini-web", models: { "gemini-web/image": "image" } },
} as const;
export type Mac2ApiProvider = keyof typeof mac2ApiProviders;
export function isMac2ApiProvider(id: string): id is Mac2ApiProvider { return Object.hasOwn(mac2ApiProviders, id); }

const mediaKind = z.enum(["image", "video"]);
export type Mac2ApiKind = z.infer<typeof mediaKind>;
export const imageMimeTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const maxLegacyReferenceBytes = 10 * 1024 * 1024;
export const capabilitySchema = z.object({
  contractVersion: z.literal(1),
  serverVersion: z.string().max(80),
  providers: z.array(z.object({
    id: z.enum(["muse", "chatgpt", "gemini-web"]),
    configured: z.boolean(), connected: z.boolean(), ready: z.boolean(), busy: z.boolean(),
    reason: z.string().max(80).optional(),
  })).max(30),
  models: z.array(z.object({
    id: z.string().max(200), provider: z.string().max(80), type: z.enum(["text", "image", "video"]),
    ready: z.boolean(), modes: z.array(z.string().max(80)).max(20).optional(),
    maxReferences: z.number().int().min(0).max(64).optional(),
    allowedMimeTypes: z.array(z.string().max(80)).max(30).optional(),
    maxReferenceBytes: z.number().int().positive().max(100 * 1024 * 1024).optional(),
  })).max(200),
  limits: z.object({ perClientPending: z.number().int().positive(), perKindPending: z.number().int().positive() }),
  features: z.object({ idempotency: z.boolean(), lookupByRequestKey: z.boolean(), cancel: z.boolean() }),
});
export type Mac2ApiCapabilities = z.infer<typeof capabilitySchema>;
export type Mac2ApiModelCapability = Mac2ApiCapabilities["models"][number];

export const remoteId = z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/);
export const receiptSchema = z.object({
  id: remoteId.optional(), task_id: remoteId.optional(),
  status: z.string().max(40), kind: mediaKind.optional(), progress: z.number().optional(),
}).refine(value => (value.id || value.task_id) && (!value.id || !value.task_id || value.id === value.task_id));

export const checkpointSchema = z.object({
  transport: z.literal("mac2Api"), providerId: z.enum(["mac2ApiMuse", "mac2ApiChatGpt", "mac2ApiGemini"]),
  kind: mediaKind, baseUrl: z.string(), localTaskId: z.uuid(), idempotencyKey: z.uuid(),
  requestHash: z.string().regex(/^[0-9a-f]{64}$/), credentialHash: z.string().regex(/^[0-9a-f]{64}$/),
  stage: z.enum(["prepared", "accepted"]), upstreamTaskId: remoteId.optional(),
}).refine(value => value.stage === "prepared" ? !value.upstreamTaskId : !!value.upstreamTaskId);
export type Mac2ApiCheckpoint = z.infer<typeof checkpointSchema>;
