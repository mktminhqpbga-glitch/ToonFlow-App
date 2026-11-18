import { z } from "zod";
import { chromeKinds, chromeMimeTypes, providerForChromeModel, type ChromeKind } from "./protocol";
import { digest, maxFileSize, validateFile, type ReferenceFile } from "./files";
import { buildChromePrompt, getChromeMarkers } from "./prompt";

export type ChromeRequestInput = {
  id: string;
  kind: ChromeKind;
  modelId: string;
  tabId?: number;
  prompt: string;
  specification?: Record<string, unknown>;
  files: ReferenceFile[];
};
type ChromeAttachment = {
  index: number;
  id: string;
  label: string;
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
};
export type ChromeRequestPayload = {
  version: 1;
  type: "chromeRequest";
  providerId: "aiChrome";
  modelId: string;
  requestId: string;
  kind: ChromeKind;
  originalPrompt: string;
  specification: Record<string, unknown>;
  prompt: string;
  markers: ReturnType<typeof getChromeMarkers>;
  attachments: ChromeAttachment[];
  totalReferenceBytes: number;
  response: { kind: ChromeKind; markersRequired: boolean; mimeTypes: string[]; maxBytes: number };
};

const requestFields = z.strictObject({ id: z.uuid().refine(value => value === value.toLowerCase(), "ID tác vụ Chrome cần là UUID viết thường."), kind: z.enum(chromeKinds), prompt: z.string().min(1).max(104000).refine(value => !!value.trim(), "Prompt Chrome không được trống.") });
const specificationFields = z.record(z.string(), z.json());
const referenceFields = z.strictObject({ label: z.string().min(1).max(256).regex(/^[^\u0000-\u001f\u007f]+$/), mimeType: z.enum(chromeMimeTypes).refine(value => value !== "text/plain", "Tham chiếu văn bản cần nằm trong prompt.") });

// ACT: Packaging has no tab, socket or disk side effects. Only payload is JSON; files stay binary.
export function buildChromeRequest(input: ChromeRequestInput): { payload: ChromeRequestPayload; files: ReferenceFile[] } {
  const { id, kind, prompt: originalPrompt } = requestFields.parse({ id: input.id, kind: input.kind, prompt: input.prompt });
  if (!providerForChromeModel(input.modelId)) throw new Error("Model AI Chrome không hợp lệ; hãy chọn lại dịch vụ.");
  if (input.tabId !== undefined && (!Number.isSafeInteger(input.tabId) || input.tabId < 0)) throw new Error("ID tab Chrome không hợp lệ.");
  const values = Object.fromEntries(Object.entries(input.specification ?? {}).filter(([, value]) => value !== undefined));
  const specification: Record<string, unknown> = JSON.parse(JSON.stringify(specificationFields.parse(values)));
  if (!Array.isArray(input.files) || input.files.length > 8 || input.files.some(file => !file || !(file.bytes instanceof Uint8Array) || !file.bytes.byteLength)
    || input.files.reduce((size, file) => size + file.bytes.byteLength, 0) > maxFileSize) throw new Error("Tối đa 8 tệp tham chiếu không rỗng, tổng không quá 64 MB.");
  const files = input.files.map(file => {
    const fields = referenceFields.parse({ label: file.label, mimeType: file.mimeType });
    const bytes = Uint8Array.from(file.bytes);
    validateFile(bytes, fields.mimeType, fields.mimeType.split("/")[0] as ChromeKind);
    return { ...fields, bytes };
  });
  const attachments = files.map((file, index): ChromeAttachment => {
    const extension = ({ "image/jpeg": "jpg", "audio/mpeg": "mp3" } as Record<string, string>)[file.mimeType] ?? file.mimeType.split("/")[1];
    return { index, id: `${id}:${index + 1}`, label: file.label, name: `macflow-${id}-${index + 1}.${extension}`, mimeType: file.mimeType, size: file.bytes.byteLength, sha256: digest(file.bytes) };
  });
  const prompt = buildChromePrompt({ id, kind, prompt: originalPrompt, specification, references: attachments });
  if (prompt.length > 104000) throw new Error("Prompt Chrome sau tổng hợp vượt giới hạn 104.000 ký tự; chưa gửi yêu cầu.");
  return {
    payload: {
      version: 1, type: "chromeRequest", providerId: "aiChrome", modelId: input.modelId === "museImage" ? "museChrome" : input.modelId, requestId: id, kind,
      originalPrompt, specification, prompt, markers: getChromeMarkers(id), attachments,
      totalReferenceBytes: attachments.reduce((size, file) => size + file.size, 0),
      response: { kind, markersRequired: kind === "text", mimeTypes: chromeMimeTypes.filter(mime => kind === "text" ? mime === "text/plain" : mime.startsWith(`${kind}/`)), maxBytes: kind === "text" ? 1024 * 1024 : maxFileSize },
    },
    files,
  };
}
