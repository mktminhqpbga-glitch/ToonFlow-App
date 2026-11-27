import { Readable } from "node:stream";
import { z } from "zod";
import { publishGeneratedVideo } from "@/utils/assets/generatedVideos";
import { modelGateway } from "@/utils/multiTenant/gateway";
import { fail, videoAffFetch, videoAffSourceId } from "./config";

const productsPath = "/api/v1/products";
const outputSchema = z.object({
  product_id: z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/),
  title: z.string().nullish(),
  product_title: z.string().nullish(),
  built_at: z.string().max(80).nullish(),
});
type Output = z.infer<typeof outputSchema>;
let started = false;
let active: Promise<void> | undefined;
const completed = new Set<string>();
const retryAt = new Map<string, number>();

async function readOutputs() {
  const response = await videoAffFetch(productsPath + "/outputs", { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    fail("Chưa tải được danh sách video từ VideoAFF.", 502);
  }
  return z.array(z.unknown()).parse(await response.json()).flatMap(item => {
    const parsed = outputSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

function outputKey(source: string, output: Output) {
  return JSON.stringify([source, output.product_id, output.built_at || "initial"]);
}

function publishOutput(source: string, output: Output, restore = false) {
  const id = output.product_id;
  return publishGeneratedVideo("VideoAFF", outputKey(source, output), output.title || output.product_title || id, async () => {
    if (source !== videoAffSourceId()) fail("Kết nối VideoAFF đã thay đổi.", 409);
    const response = await videoAffFetch(`${productsPath}/${id}/video`, { signal: AbortSignal.timeout(180000) });
    if (!response.ok || !response.body) {
      await response.body?.cancel().catch(() => {});
      fail("Chưa tải được video từ VideoAFF.", 502);
    }
    const length = response.headers.get("content-length");
    return {
      stream: Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
      size: length !== null ? Number(length) : undefined,
      async verify() {
        if (source !== videoAffSourceId()) fail("Kết nối VideoAFF đã thay đổi.", 409);
        if (!output.built_at) return;
        const state = await videoAffFetch(`${productsPath}/${id}/output`, { signal: AbortSignal.timeout(10000) });
        if (!state.ok) {
          await state.body?.cancel().catch(() => {});
          fail("Chưa xác nhận được phiên bản video.", 502);
        }
        const data = z.object({ video: z.object({ built_at: z.string().nullish(), exists: z.boolean() }) }).parse(await state.json());
        if (!data.video.exists || data.video.built_at !== output.built_at) fail("VideoAFF vừa tạo phiên bản mới. Hãy thử lại.", 409);
      },
    };
  }, restore);
}

export async function saveVideoAffVideo(id: string) {
  const source = videoAffSourceId();
  if (!source) fail("VideoAFF chưa chạy.", 503);
  const output = (await readOutputs()).find(item => item.product_id === id);
  if (!output) fail("Chưa có video kết quả để lưu.", 404);
  const path = await publishOutput(source, output, true);
  completed.add(outputKey(source, output));
  return path;
}

export function syncVideoAffLibrary() {
  const source = videoAffSourceId();
  if (!source || active || modelGateway.enabled()) return;
  active = (async () => {
    const outputs = await readOutputs();
    const now = Date.now();
    for (const [key, time] of retryAt) if (time <= now) retryAt.delete(key);
    const pending = outputs.filter(output => {
      const key = outputKey(source, output);
      return !completed.has(key) && !retryAt.has(key);
    }).slice(0, 6);
    for (const output of pending) {
      try {
        await publishOutput(source, output);
        completed.add(outputKey(source, output));
      } catch { retryAt.set(outputKey(source, output), Date.now() + 60000); }
    }
    if (completed.size > 20000) completed.clear();
  })().catch(() => {}).finally(() => { active = undefined; });
}

export function startVideoAffLibrarySync() {
  if (started) return;
  started = true;
  setInterval(syncVideoAffLibrary, 12000).unref();
}
