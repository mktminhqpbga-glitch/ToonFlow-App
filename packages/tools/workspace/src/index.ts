import { z } from "zod";
import type { ToolDefinition, ToolPlugin } from "@toonflow/tools-scaffold/runtime";
import { createSearchTools } from "./search";

const configSchema = z.object({ readOnly: z.boolean().default(false) }).strict();
const downloadImageSchema = z.object({ url: z.string().trim().min(1).max(8192).describe("URL ảnh HTTP(S) công khai có thể tải trực tiếp") }).strict();

const plugin: ToolPlugin = {
  validateConfig: config => configSchema.parse(config),
  createTools({ cwd, config, files, resolvePath, sdk }) {
    const { readOnly } = configSchema.parse(config);
    const tools: ToolDefinition[] = [
      sdk.defineTool(sdk.createReadToolDefinition(cwd, { operations: {
        readFile: path => files.readFile(path, true),
        access: path => files.access(path, true),
        detectImageMimeType: path => files.detectImageMimeType(path, true),
      } })),
      sdk.defineTool(sdk.createLsToolDefinition(cwd, { operations: {
        exists: async path => {
          try { await files.access(path, true); return true; }
          catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
        },
        stat: path => files.stat(path, true),
        readdir: path => files.readdir(path, true),
      } })),
      ...createSearchTools({ cwd, files, resolvePath }),
    ];
    if (!readOnly) {
      tools.splice(1, 0,
        sdk.defineTool(sdk.createWriteToolDefinition(cwd, { operations: {
          writeFile: files.writeFile,
          mkdir: path => files.mkdir(path, true),
        } })),
        sdk.defineTool(sdk.createEditToolDefinition(cwd, { operations: { readFile: files.readFile, access: files.access, writeFile: files.writeFile } })),
      );
      tools.push({
        name: "downloadImage",
        label: "Ảnh đã tải",
        description: "Tải ảnh HTTP(S) công khai vào workspace hiện tại và trả đường dẫn tương đối cùng MIME. Hỗ trợ PNG, JPEG, WebP, GIF, AVIF, BMP, tối đa 20 MB/ảnh; không hỗ trợ ảnh cần đăng nhập, SVG, địa chỉ cục bộ hoặc mạng nội bộ. Host tự chọn đường dẫn đầu ra.",
        promptSnippet: "Tải ảnh từ URL vào workspace và trả đường dẫn tương đối để xem trước hoặc dùng làm tham chiếu.",
        promptGuidelines: ["Khi lưu ảnh trên web, dùng downloadImage thay vì web_fetch, write hoặc FFmpeg. Khi thành công, dùng đường dẫn tương đối được trả về để hiển thị Markdown, ví dụ ![Ảnh](<assets/chatImages/ten-anh.jpg>)."],
        parameters: z.toJSONSchema(downloadImageSchema, { io: "input", target: "draft-07" }),
        executionMode: "sequential",
        async execute(toolCallId, params, signal) {
          signal?.throwIfAborted();
          const { url } = downloadImageSchema.parse(params);
          const result = await files.importImage(url);
          signal?.throwIfAborted();
          return {
            content: [{ type: "text", text: `Đã lưu ảnh vào workspace: ${result.path}\nLoại MIME: ${result.mimeType}\n![Ảnh đã tải](<${result.path}>)` }],
            details: result,
          };
        },
      });
    }
    return tools.map(tool => ({
      ...tool,
      promptGuidelines: [
        ...(tool.promptGuidelines ?? []),
        ...(readOnly ? ["Công cụ tệp hiện chỉ cho đọc, liệt kê và tìm kiếm, không thể ghi hoặc sửa; công cụ khác theo khả năng riêng."] : []),
      ],
    }));
  },
};

export default plugin;
