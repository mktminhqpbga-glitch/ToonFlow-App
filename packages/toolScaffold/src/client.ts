import * as vueRuntime from "vue";
import * as i18n from "@toonflow/i18n/vue";
import * as elementPlusRuntime from "element-plus";
import axios from "axios";
import formCreate from "@form-create/element-ui";
import type { Component } from "vue";

export { createBrowserAsr, isBrowserAsrSupported, isBrowserAudioAsrSupported, transcribeBrowserAudio } from "@toonflow/asr";
export type { BrowserAsrState, BrowserAsrResult, BrowserAsrError, BrowserAsrOptions, BrowserAudioAsrOptions } from "@toonflow/asr";

type ToolRenderer = { name: string; tools: string[]; url: string };
const toolWindow = window as typeof window & {
  toonflowToolHost?: { vue: typeof vueRuntime; elementPlus: typeof elementPlusRuntime; axios: typeof axios; formCreate: typeof formCreate; i18n: typeof i18n };
  toonflowToolViews?: Record<string, Record<string, Component>>;
};
toolWindow.toonflowToolHost = { vue: vueRuntime, elementPlus: elementPlusRuntime, axios, formCreate, i18n };
const componentLoads = new Map<string, { pending: Promise<Record<string, Component>>; components: Map<string, Component> }>();
let rendererRequest: Promise<ToolRenderer[]> | undefined;

export function getCachedToolComponent(toolName: string): Component | undefined {
  // ACT: 仅同步复用组件定义；调用方仍异步复核启用状态与版本，不保留组件实例。
  for (const load of componentLoads.values()) {
    const component = load.components.get(toolName);
    if (component) return component;
  }
}

export async function loadToolComponent(toolName: string): Promise<Component | undefined> {
  // ACT: 只合并并发查询；新卡片重新查询安装状态，组件按内容版本复用。
  rendererRequest ??= axios.get<{ code: number; data: ToolRenderer[]; message?: string }>("/api/tools/renderers")
    .then(({ data }) => {
      if (data.code !== 200 || !Array.isArray(data.data)) throw new Error(data.message || "Danh sách giao diện công cụ không hợp lệ");
      const urls = new Set(data.data.map(renderer => renderer?.url));
      for (const url of componentLoads.keys()) {
        if (!urls.has(url)) componentLoads.delete(url);
      }
      return data.data;
    }).finally(() => { rendererRequest = undefined; });
  const matches = (await rendererRequest).filter(item => Array.isArray(item?.tools) && item.tools.includes(toolName));
  if (matches.length > 1) {
    for (const renderer of matches) componentLoads.delete(renderer.url);
    throw new Error(`Tên giao diện công cụ bị trùng: ${toolName}`);
  }
  const renderer = matches[0];
  if (!renderer) return;
  if (!/^[a-z][a-zA-Z0-9]*$/.test(renderer.name) ||
    !new RegExp(`^/api/tools/client\\?name=${renderer.name}&version=[a-f0-9]{64}$`).test(renderer.url)) {
    throw new Error("Địa chỉ giao diện công cụ không hợp lệ");
  }
  let load = componentLoads.get(renderer.url);
  if (!load) {
    const pending = new Promise<Record<string, Component>>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = renderer.url;
      script.onload = () => {
        script.remove();
        const components = toolWindow.toonflowToolViews?.[renderer.name];
        if (!components || typeof components !== "object") reject(new Error(`Gói công cụ không export giao diện: ${renderer.name}`));
        else resolve(components);
      };
      script.onerror = () => { script.remove(); reject(new Error("Không tải được script giao diện công cụ")); };
      document.head.append(script);
    }).catch(error => {
      if (componentLoads.get(renderer.url)?.pending === pending) componentLoads.delete(renderer.url);
      throw error;
    });
    load = { pending, components: new Map() };
    componentLoads.set(renderer.url, load);
  }
  const components = await load.pending;
  const component = Object.hasOwn(components, toolName) ? components[toolName] : undefined;
  if (!component || (typeof component !== "object" && typeof component !== "function")) {
    throw new Error(`Gói công cụ không export ${toolName} component`);
  }
  load.components.set(toolName, vueRuntime.markRaw(component));
  return component;
}
