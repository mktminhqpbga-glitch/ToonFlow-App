import type { Component } from "vue";
import type { Rule } from "@form-create/element-ui";

export type ExtResource =
  | { kind: "file"; directory: string; path: string; label: string }
  | { kind: "canvasNode"; directory: string; path: string; nodeId: string; label: string };

export interface ExtFiles {
  list(path?: string, signal?: AbortSignal): Promise<{ directory: string; entries: { name: string; path: string; type: "file" | "directory" }[] }>;
  read(path: string): Promise<ArrayBuffer>;
  readText(path: string, maxBytes?: number, signal?: AbortSignal): Promise<string>;
  readJson<T = unknown>(path: string, signal?: AbortSignal): Promise<T>;
  write(path: string, content: string | Blob | ArrayBuffer, exclusive?: boolean, signal?: AbortSignal): Promise<void>;
  writeJson(path: string, data: unknown, exclusive?: boolean): Promise<void>;
  acquireUrl(path: string, mimeType?: string): { url: Promise<string>; release(): void };
  rename(path: string, target: string): Promise<void>;
  copy(path: string, target: string): Promise<void>;
  reveal(path: string): Promise<void>;
  remove(path: string, recursive?: boolean): Promise<void>;
  mkdir(path: string): Promise<void>;
}

export interface ExtContext {
  resource: ExtResource;
  files: ExtFiles;
  text: string;
  loading: boolean;
  error: string;
  dirty: boolean;
  active: boolean;
  config: Record<string, unknown>;
  saveConfig: (config: Record<string, unknown>) => Promise<void>;
  updateText: (text: string) => void;
  flushSave: () => Promise<void>;
  writeClipboardText: (text: string) => Promise<void>;
  openFile: (path: string) => Promise<void>;
  location?: { line: number; column: number; query: string; revision: number };
  mountNode?: (element: HTMLElement) => Promise<() => void>;
}

export interface ExtDefinition {
  id: string;
  displayName: string;
  icon?: string;
  configRules?: Rule[];
  extensions: string[];
  resourceKind: ExtResource["kind"];
  text?: boolean;
  load: () => Promise<{ default: Component }>;
}

export function defineExt(definition: ExtDefinition): ExtDefinition {
  if (typeof definition.id !== "string" || definition.id.length > 96 || !/^ext-[a-z][a-zA-Z0-9]*$/.test(definition.id)) throw new Error(`ID tiện ích phải bắt đầu bằng ext- theo tên camelCase, tối đa 96 ký tự: ${definition.id}`);
  if (typeof definition.displayName !== "string" || !definition.displayName.trim()) throw new Error("Tên hiển thị tiện ích không được rỗng");
  if (definition.icon !== undefined) {
    const icon = definition.icon;
    if (typeof icon !== "string" || (icon && !/^data:image\/(?:svg\+xml|png|jpeg|webp|gif|avif)(?:;[^,]*)?,/i.test(icon)
      && !(URL.canParse(icon) && ["http:", "https:"].includes(new URL(icon).protocol)))) throw new Error("Biểu tượng tiện ích phải là URL HTTP/HTTPS hoặc Data URL ảnh");
  }
  if (definition.configRules !== undefined && (!Array.isArray(definition.configRules) || definition.configRules.length > 100)) throw new Error("Quy tắc cấu hình tiện ích phải là mảng form rules tối đa 100 mục");
  if (definition.resourceKind !== "file" && definition.resourceKind !== "canvasNode") throw new Error("Loại tài nguyên tiện ích không hợp lệ");
  if (definition.text !== undefined && typeof definition.text !== "boolean") throw new Error("Cờ văn bản của tiện ích phải là boolean");
  if (!Array.isArray(definition.extensions) || definition.extensions.some(extension => typeof extension !== "string" || !/^[a-z0-9]+$/.test(extension))) throw new Error("Đuôi tệp phải là chữ thường hoặc số, không có dấu chấm");
  if (definition.resourceKind === "file" && !definition.extensions.length) throw new Error("Tiện ích tệp cần ít nhất một đuôi tệp");
  if (new Set(definition.extensions).size !== definition.extensions.length) throw new Error("Đuôi tệp không được trùng");
  if (typeof definition.load !== "function") throw new Error("Tiện ích phải cung cấp hàm tải component");
  return definition;
}
