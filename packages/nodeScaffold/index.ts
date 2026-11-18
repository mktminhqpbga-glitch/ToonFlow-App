import { copyFile, mkdir, readFile, rename, rm } from "@toonflow/file";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import type { Rule } from "@form-create/element-ui";
import { z } from "zod";
import postcssConfig from "../../postcss.config.ts";
import { i18nPlugin } from "@toonflow/i18n/vite";

const tiptapGlobals = {
  "@tiptap/core": "toonflowTiptapHost.core",
  "@tiptap/vue-3": "toonflowTiptapHost.vue3",
  "@tiptap/starter-kit": "toonflowTiptapHost.starterKit",
  "@tiptap/markdown": "toonflowTiptapHost.markdown",
  "@tiptap/extension-find-and-replace": "toonflowTiptapHost.findAndReplace",
  "@tiptap/extension-highlight": "toonflowTiptapHost.highlight",
  "@tiptap/extension-image": "toonflowTiptapHost.image",
  "@tiptap/extension-list": "toonflowTiptapHost.list",
  "@tiptap/extension-subscript": "toonflowTiptapHost.subscript",
  "@tiptap/extension-superscript": "toonflowTiptapHost.superscript",
  "@tiptap/extension-table": "toonflowTiptapHost.table",
  "@tiptap/extension-text-align": "toonflowTiptapHost.textAlign",
  "@tiptap/pm/model": "toonflowTiptapHost.model",
  "@tiptap/pm/state": "toonflowTiptapHost.state",
  "@tiptap/pm/view": "toonflowTiptapHost.view",
  "marked": "toonflowTiptapHost.marked",
  "dompurify": "toonflowTiptapHost.dompurify",
};

export interface NodeConfig {
  name: string;
  displayName: string;
  author: string;
  github: string;
  configRules?: Rule[];
  serverTool?: string;
}

export function createNodeConfig(config: NodeConfig, configUrl: string, options: { outDir?: string; syncToData?: boolean } = {}) {
  const { name: nodeName } = config;
  const metadata = {
    displayName: config.displayName.trim(),
    author: config.author.trim(),
    github: config.github.trim(),
    configRules: z.array(z.record(z.string(), z.json())).max(100).parse(config.configRules ?? []),
  };
  if (!metadata.displayName) throw new Error("Tên hiển thị plugin không được trống");
  if (metadata.github) {
    const githubUrl = new URL(metadata.github);
    if (githubUrl.origin !== "https://github.com" || githubUrl.username || githubUrl.password) throw new Error("URL GitHub phải thuộc https://github.com");
  }
  const root = fileURLToPath(new URL(".", configUrl));
  if (!/^[a-z][a-zA-Z0-9]*$/.test(nodeName)) throw new Error(`Tên node phải theo camelCase bắt đầu bằng chữ thường: ${nodeName}`);
  const fileName = `${nodeName}.umd.js`;
  const outDir = options.outDir ? resolve(root, options.outDir) : fileURLToPath(new URL("../../build/nodes", import.meta.url));
  const dataDir = fileURLToPath(new URL("../../data/nodes", import.meta.url));
  let syncToData = options.syncToData ?? process.env.NODE_ENV === "dev";

  return defineConfig({
    root,
    css: { postcss: postcssConfig },
    plugins: [
      i18nPlugin({ pluginUi: true }),
      vue(),
      {
        name: "syncNodeFile",
        enforce: "post",
        configResolved(resolvedConfig) {
          if (options.syncToData === undefined) syncToData ||= Boolean(resolvedConfig.build.watch) || resolvedConfig.mode === "development";
        },
        async generateBundle(_options, bundle) {
          const chunk = bundle[fileName];
          if (!chunk || chunk.type !== "chunk") throw new Error(`Không tạo được tệp node: ${fileName}`);
          if (Object.keys(bundle).length !== 1) throw new Error(`Node phải build thành một script, không chứa tài nguyên chưa nội tuyến: ${nodeName}`);
          const packagePath = resolve(root, "package.json");
          this.addWatchFile(packagePath);
          const packageInfo = JSON.parse(await readFile(packagePath, "utf8"));
          const version = typeof packageInfo.version === "string" ? packageInfo.version.trim() : "";
          if (!version) throw new Error(`package.json node thiếu version hợp lệ: ${nodeName}`);
          const readmePath = resolve(root, "readme.md");
          this.addWatchFile(readmePath);
          const readme = await readFile(readmePath, "utf8").catch((error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") return "";
            throw error;
          });
          let serverTool: string | undefined;
          if (config.serverTool !== undefined) {
            const toolPath = resolve(root, config.serverTool);
            this.addWatchFile(toolPath);
            serverTool = await readFile(toolPath, "utf8");
            const toolHeader = serverTool.match(/^\/\*! toonflowTool:([^\r\n]*) \*\/(?:\r?\n|$)/)?.[1];
            if (!toolHeader || JSON.parse(toolHeader).name !== nodeName || Buffer.byteLength(serverTool, "utf8") > 20 * 1024 * 1024) {
              throw new Error(`Dịch vụ đi kèm node phải là công cụ đã build cùng tên, tối đa 20 MB: ${nodeName}`);
            }
          }
          // 压缩后再写入，防止元数据注释被移除。
          chunk.code = `/*! toonflowNode:${JSON.stringify({ ...metadata, version, readme, ...(serverTool ? { serverTool } : {}) }).replaceAll("/", "\\u002f")} */\n${chunk.code}`;
          if (Buffer.byteLength(chunk.code, "utf8") > 20 * 1024 * 1024) throw new Error(`Node và dịch vụ đi kèm không được vượt tổng 20 MB: ${nodeName}`);
        },
        async writeBundle() {
          if (!syncToData) return;
          await mkdir(dataDir, { recursive: true });
          const targetPath = resolve(dataDir, fileName);
          const tempPath = `${targetPath}.${crypto.randomUUID()}.tmp`;
          try {
            await copyFile(resolve(outDir, fileName), tempPath);
            await rename(tempPath, targetPath);
          } finally {
            await rm(tempPath, { force: true });
          }
        },
      },
    ],
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      outDir,
      // ACT: 单包构建不清公共产物目录，由根 build:nodes 在批量构建前统一清理。
      emptyOutDir: false,
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      cssCodeSplit: true,
      lib: {
        entry: resolve(root, "src/index.vue"),
        name: `toonflowNodes.${nodeName}`,
        formats: ["umd"],
        fileName: () => fileName,
      },
      rolldownOptions: {
        external: ["vue", "@vue/runtime-core", "@vue/runtime-dom", "@vue-flow/core", "element-plus", "three", "@toonflow/model-icons", "@earendil-works/pi-agent-core", "@earendil-works/pi-ai", "@toonflow/i18n/vue", ...Object.keys(tiptapGlobals)],
        output: {
          exports: "default",
          globals: {
            ...tiptapGlobals,
            vue: "toonflowNodeHost.vue",
            "@vue/runtime-core": "toonflowNodeHost.vue",
            "@vue/runtime-dom": "toonflowNodeHost.vue",
            "@vue-flow/core": "toonflowNodeHost.vueFlow",
            "element-plus": "toonflowNodeHost.elementPlus",
            three: "toonflowNodeHost.three",
            "@toonflow/model-icons": "toonflowNodeHost.modelIcons",
            "@earendil-works/pi-agent-core": "toonflowNodeHost.ai",
            "@earendil-works/pi-ai": "toonflowNodeHost.ai",
            "@toonflow/i18n/vue": "toonflowNodeHost.i18n",
          },
        },
      },
    },
  });
}
