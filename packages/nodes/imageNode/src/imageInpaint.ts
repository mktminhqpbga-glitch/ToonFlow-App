import { useNode, useVueFlow } from "@vue-flow/core";
import { uploadNodeFile, useNodeAi, useNodeFiles, type NodeImageRequest, type NodeImageResult } from "@toonflow/nodes-scaffold/runtime";
import { showNodeError } from "@toonflow/node-shared/showNodeError";
import { createMediaPreview } from "@toonflow/node-shared/mediaPreview";
import { resolveNodePrompt } from "@toonflow/node-shared/nodePrompts";

export type ImageInpaint = { source: string; original: string; guide: string; mask: string; images: NonNullable<NodeImageRequest["images"]> };
export type InpaintDraftInput = { prompt: string; images?: NodeImageRequest["images"] };

const inpaintInstruction = "Vẽ lại một vùng trên ảnh gốc đầu tiên do node cha cung cấp. Ảnh thứ hai là bản đánh dấu của cùng ảnh gốc, trong đó vùng tô đỏ chỉ phần cần chỉnh sửa. Màu đỏ chỉ là ký hiệu vùng chọn, tuyệt đối không vẽ dấu đỏ vào kết quả. Chỉ sửa vùng được đánh dấu, giữ nguyên bố cục, tỷ lệ kích thước và mọi nội dung bên ngoài vùng đó, trả về ảnh hoàn chỉnh.";

export function buildInpaintPrompt(prompt: string) {
  return prompt.startsWith(inpaintInstruction) ? prompt : `${inpaintInstruction}\n\nYêu cầu vẽ lại:\n${prompt}`;
}

export async function resolveInpaintPrompt(prompt: string, signal?: AbortSignal) {
  return resolveNodePrompt("image.inpaint", buildInpaintPrompt(prompt), signal);
}

export function buildInpaintRequest<T extends Pick<NodeImageRequest, "prompt" | "images">>(input: T, inpaint: ImageInpaint): T {
  return {
    ...input,
    images: [{ path: inpaint.original, mimeType: "image/png" }, { path: inpaint.guide, mimeType: "image/png" }, ...inpaint.images, ...(input.images ?? [])],
    prompt: buildInpaintPrompt(input.prompt),
  };
}

export function useImageInpaint(generate?: (input: NodeImageRequest, signal: AbortSignal, recoveryData: { input: NodeImageRequest; inpaint: ImageInpaint }) => Promise<NodeImageResult[]>) {
  const { id, node } = useNode();
  const { findNode } = useVueFlow();
  const files = useNodeFiles();
  const ai = useNodeAi();

  return async function generateInpaint(input: NodeImageRequest, inpaint: ImageInpaint, signal: AbortSignal, recovered?: NodeImageResult[]): Promise<NodeImageResult[]> {
    signal.throwIfAborted();
    if (!inpaint || ![inpaint.original, inpaint.guide, inpaint.mask].every(path => typeof path === "string" && path.trim())
      || !Array.isArray(inpaint.images) || inpaint.images.some(image => !image || typeof image.path !== "string" || !image.path.trim() || typeof image.mimeType !== "string" || !image.mimeType.startsWith("image/"))) {
      throw new Error("Tư liệu vẽ lại một vùng không hợp lệ, hãy tạo lại node vẽ lại");
    }
    const workspace = files.getWorkspaceFiles();
    const temporaryId = recovered?.[0]?.path.match(/^assets\/([^/]+)\/[^/]+$/)?.[1] ?? crypto.randomUUID();
    const canvas = document.createElement("canvas");
    const urls: string[] = [];
    let outputPath = "";
    let committed = false;
    let requested = false;

    async function readImage(path: string, mimeType = "image/png") {
      const content = await workspace.read(path);
      signal.throwIfAborted();
      const image = new Image();
      const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
      urls.push(url);
      image.src = url;
      try {
        await image.decode();
      } catch {
        const blob = await createMediaPreview(url, "image", signal);
        signal.throwIfAborted();
        const previewUrl = URL.createObjectURL(blob);
        urls.push(previewUrl);
        image.src = previewUrl;
        await image.decode();
      }
      signal.throwIfAborted();
      return image;
    }

    try {
      const original = await readImage(inpaint.original);
      const mask = await readImage(inpaint.mask);
      const guide = await readImage(inpaint.guide);
      if (!original.naturalWidth || !original.naturalHeight || [mask, guide].some(image => image.naturalWidth !== original.naturalWidth || image.naturalHeight !== original.naturalHeight)) {
        throw new Error("Ảnh gốc, ảnh hướng dẫn và mặt nạ vẽ lại không cùng kích thước, hãy tạo lại node vẽ lại");
      }
      canvas.width = original.naturalWidth;
      canvas.height = original.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Không tạo được Canvas để vẽ");
      context.drawImage(mask, 0, 0);
      if (!context.getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value)) throw new Error("Mặt nạ vẽ lại đang rỗng, hãy tô vùng cần sửa");
      const { directory } = await workspace.list();
      signal.throwIfAborted();
      requested = true;
      // ACT: 供应商尚未统一支持原生 mask；使用涂色参考引导，再按本地蒙版合成，严格保留区域外像素。
      const request = buildInpaintRequest({
        ...input,
        directory,
        outputDirectory: generate ? `assets/${id}/generation` : `assets/${temporaryId}`,
      }, inpaint);
      // Chỉ đọc cài đặt khi chuẩn bị một tác vụ mới; khôi phục tác vụ cũ giữ nguyên prompt đã lưu.
      if (!recovered) request.prompt = await resolveNodePrompt("image.inpaint", request.prompt, signal);
      const [result] = recovered ?? await (generate ? generate(request, signal, { input, inpaint }) : ai.generateImage(request, signal));
      signal.throwIfAborted();
      if (!result) throw new Error("Nhà cung cấp không trả về ảnh");
      const generated = await readImage(result.path, result.mimeType);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(generated, 0, 0, canvas.width, canvas.height);
      context.globalCompositeOperation = "destination-in";
      context.drawImage(mask, 0, 0);
      context.globalCompositeOperation = "destination-over";
      context.drawImage(original, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Mã hóa ảnh thất bại")), "image/png"));
      signal.throwIfAborted();
      outputPath = await uploadNodeFile(workspace, id, new File([blob], "image.png", { type: "image/png" }));
      signal.throwIfAborted();
      if (findNode(id) !== node) throw new Error("Node vẽ lại đã bị xóa");
      // ACT: 可恢复任务原图保留在节点的 generation 子目录，关闭后仍可合成，并随节点素材统一清理。
      if (!generate) await workspace.remove(`assets/${temporaryId}`, true).catch(error => {
        if (error?.response?.data?.data?.code !== "ENOENT") showNodeError(error, "Không xóa được tệp vẽ lại tạm");
      });
      requested = false;
      signal.throwIfAborted();
      committed = true;
      return [{ path: outputPath, mimeType: "image/png", mediaType: "image" }];
    } finally {
      urls.forEach(url => URL.revokeObjectURL(url));
      canvas.width = canvas.height = 0;
      if (outputPath && !committed) await workspace.remove(outputPath).catch(error => showNodeError(error, "Không xóa được tệp vẽ lại tạm"));
      if (requested && !generate) await workspace.remove(`assets/${temporaryId}`, true).catch(error => {
        if (error?.response?.data?.data?.code !== "ENOENT") showNodeError(error, "Không xóa được tệp vẽ lại tạm");
      });
    }
  };
}
