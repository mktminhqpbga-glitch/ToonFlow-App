import { z } from "@toonflow/nodes-scaffold/nodeTools";
import type { SceneScriptBridge } from "@toonflow/nodes-scaffold/runtime";
import { batchLimit, contextLimit, imageLimit, photoSchema, promptLimit } from "./videoFlow";

const transferSchema = z.object({
  prompts: z.string().min(1).max(promptLimit),
  product: z.string().max(contextLimit),
  products: z.array(photoSchema).max(imageLimit),
});

export function sceneScriptTransferKey(directory: string, ownerId: string) {
  return "macflow.sceneScriptTransfer.v1:" + JSON.stringify([ownerId, directory]);
}

export function saveSceneScriptTransfer(key: string, input: Parameters<SceneScriptBridge["openVideoFlow"]>[0]) {
  if (!input.scenes.length || input.scenes.length > batchLimit || input.scenes.some(scene => !scene.trim())) {
    throw new Error(`Chọn từ 1 đến ${batchLimit} cảnh và điền đủ prompt trước khi chuyển.`);
  }
  const prompts = input.scenes.map(scene => `[${scene.trim().replace(/[\\[\]]/g, "\\$&")}]`).join("\n");
  const result = transferSchema.safeParse({ prompts, product: input.product, products: input.photos });
  if (!result.success) throw new Error("Kịch bản quá dài hoặc hồ sơ sản phẩm không hợp lệ. Hãy rút gọn prompt hoặc chọn lại hồ sơ.");
  if (sessionStorage.getItem(key)) return false;
  sessionStorage.setItem(key, JSON.stringify(result.data));
  return true;
}

export function readSceneScriptTransfer(key: string) {
  const text = sessionStorage.getItem(key);
  if (!text) return undefined;
  const result = transferSchema.safeParse(JSON.parse(text));
  if (!result.success) throw new Error("Bản kịch bản chuyển sang không đúng định dạng.");
  return result.data;
}
