import { z } from "zod";

export interface PluginDevelopmentHost {
  resolveWorkspacePath(directory: string, path: string, allowMissing?: boolean): Promise<{ path: string }>;
  lockWorkspaceFiles(paths: string[]): () => void;
  installNode(fileName: string, source: string): Promise<{ name: string }>;
  installTool(fileName: string, source: string): Promise<{ name: string }>;
  parsePluginVersion(value: unknown): string | undefined;
}

export type PluginDevelopmentHandler = (directory: string, input: unknown, host: PluginDevelopmentHost, signal?: AbortSignal) => Promise<unknown>;

const pathSchema = z.string().min(1).max(1024).refine(path => !/^(?:[\\/]|[a-z][a-z\d+.-]*:)/i.test(path)
  && !path.split(/[\\/]/).some(part => part === ".." || /[<>:"|?*\x00-\x1f]/.test(part)), "Đường dẫn dự án phải nằm trong workspace hiện tại.");

export const pluginDevelopmentSchema = z.strictObject({
  action: z.enum(["guide", "build", "install", "upload"]),
  type: z.enum(["node", "tool"]).optional().describe("Bắt buộc với guide: loại SDK"),
  path: pathSchema.optional().describe("Bắt buộc với build, install, upload: thư mục dự án tương đối từ workspace, ví dụ plugins/myNode"),
}).refine(input => input.action === "guide" ? !!input.type && !input.path : !!input.path && !input.type,
  "guide chỉ cần type; các thao tác khác chỉ cần thư mục dự án trong path.");

export const pluginManifestSchema = z.strictObject({
  type: z.enum(["node", "tool"]),
  name: z.string().max(96).regex(/^[a-z][a-zA-Z0-9]*$/),
  displayName: z.string().trim().min(1).max(100),
  author: z.string().max(100).default(""),
  github: z.string().max(4096).default(""),
  description: z.string().max(2000).default(""),
  prompt: z.string().max(20000).default(""),
  configRules: z.array(z.record(z.string(), z.json())).max(100).default([]),
  components: z.record(z.string().regex(/^[a-z][a-zA-Z0-9]*$/), pathSchema.refine(path => path.startsWith("src/") && path.endsWith(".vue"))).optional(),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export type PluginUploadDraft = Pick<PluginManifest, "type" | "name" | "displayName" | "description"> & {
  version: string;
  fileName: string;
  source: string;
};
