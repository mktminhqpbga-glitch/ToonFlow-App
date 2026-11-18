import { createRequire, isBuiltin } from "node:module";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFile, readFileSync, realpath, realpathSync, statSync } from "@toonflow/file";
import { build, type Plugin } from "vite";
import { createNodeConfig } from "@toonflow/nodes-scaffold";
import { createToolConfig } from "@toonflow/tools-scaffold";
import { babelParse, parse, registerTS } from "vue/compiler-sfc";
import { pluginManifestSchema } from "./runtime";

const sdkDirectory = dirname(fileURLToPath(import.meta.url));
registerTS(() => createRequire(import.meta.url)("typescript"));
const request = JSON.parse(await new Response(Bun.stdin.stream()).text());
const manifest = pluginManifestSchema.parse(request.manifest);
const root = await realpath(request.root);
const outDir = resolve(request.outDir);
const sdkModules = await realpath(join(sdkDirectory, "node_modules"));
const configUrl = pathToFileURL(join(root, "build.ts")).href;

function isWithin(directory: string, path: string) {
  const offset = relative(directory, path);
  return offset !== ".." && !offset.startsWith(`..${sep}`) && !isAbsolute(offset);
}

async function allowedPath(path: string) {
  const actual = await realpath(path.split("?")[0]!);
  if (!isWithin(root, actual) && !isWithin(sdkModules, actual)) throw new Error(`Plugin chỉ được tham chiếu mã nguồn dự án hoặc SDK tích hợp: ${path}`);
  return actual;
}

function typeFile(path: string) {
  // Vue 查找类型时会向上探测目录；出界和不存在的类型文件都作为未找到处理。
  if (!isWithin(root, path) && !isWithin(sdkModules, path)) return;
  if (!statSync(path, { throwIfNoEntry: false })?.isFile()) return;
  const actual = realpathSync(path);
  if (isWithin(root, actual) || isWithin(sdkModules, actual)) return actual;
}

function validateStyle(source: string) {
  // ACT: 工作区只提供无外部引用的普通 CSS。拒绝转义以免 CSS 标识符有多种等价写法。
  if (source.includes("\\") || /sourceMappingURL/i.test(source)
    || /@import\b|(?:url|image-set)\s*\(/i.test(source.replace(/\/\*[\s\S]*?\*\//g, ""))) {
    throw new Error("CSS plugin không được tham chiếu tệp hoặc dùng escape; hãy import tài nguyên trong script rồi liên kết với template");
  }
}

function validateProjectModule(id: string, source: string) {
  const [file, query] = id.split("?");
  const path = file!.toLowerCase();
  const params = new URLSearchParams(query);
  if (/\.(?:s[ac]ss|less|styl(?:us)?|sss|module\.css)(?:[?&#]|$)/i.test(id) || params.has("module")) throw new Error("Dự án plugin chỉ hỗ trợ CSS thông thường");
  if (path.endsWith(".css") || params.get("type") === "style") return validateStyle(source);
  if (path.endsWith(".vue") && !query) {
    const { descriptor, errors } = parse(source, { filename: path });
    if (errors.length) throw errors[0];
    if (descriptor.customBlocks.length || descriptor.template?.src || descriptor.template?.lang
      || descriptor.script?.src || descriptor.scriptSetup?.src) throw new Error("Component Vue plugin chỉ hỗ trợ template, script và style nội tuyến");
    for (const style of descriptor.styles) {
      if (style.src || style.module || (style.lang && style.lang !== "css")) throw new Error("Style của component plugin chỉ hỗ trợ CSS thường nội tuyến");
      validateStyle(style.content);
    }
  }
  if (/\bimport\s*[./]/.test(source)) throw new Error("Frontend plugin phải dùng import tĩnh để nhập tài nguyên; không hỗ trợ import.meta hoặc chú thích giữa import và tên module");
}

const fixedBuild: Plugin = {
  name: "pluginDevelopment",
  enforce: "pre",
  config() {
    return {
      root,
      envDir: root,
      publicDir: false,
      cacheDir: join(root, "cache"),
      logLevel: "warn",
      build: { emptyOutDir: false },
    };
  },
  configResolved(config) {
    const api = config.plugins.find(plugin => plugin.name === "vite:vue")?.api;
    if (!api) throw new Error("Thiếu bộ build plugin Vue");
    api.options = { ...api.options, script: { ...api.options.script, fs: {
      fileExists: (path: string) => Boolean(typeFile(path)),
      readFile(path: string) { const file = typeFile(path); return file ? readFileSync(file, "utf8") : undefined; },
      realpath(path: string) { const file = typeFile(path); if (!file) throw new Error("Tệp kiểu dữ liệu không nằm trong dự án plugin hoặc SDK"); return file; },
    } } };
  },
  async resolveId(source, importer, options) {
    if (source.startsWith("\0") || source.startsWith("virtual:")) return;
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
    if (!resolved) throw new Error(`Không phân giải được phụ thuộc plugin: ${source}; hãy dùng SDK tích hợp hoặc đường dẫn tương đối trong dự án`);
    if (!resolved.external && !resolved.id.startsWith("\0")) await allowedPath(resolved.id);
    return resolved;
  },
  async load(id) {
    if (isAbsolute(id)) await allowedPath(id);
  },
  transform(source, id) {
    if (isWithin(root, id.split("?")[0]!)) validateProjectModule(id, source);
  },
};

try {
  if (manifest.type === "node") {
    const config = createNodeConfig(manifest, configUrl, { outDir, syncToData: false });
    await build({ ...config, configFile: false, plugins: [fixedBuild, ...(config.plugins ?? [])], mode: "production" });
  } else {
    const { type: _type, components, ...metadata } = manifest;
    await createToolConfig({ ...metadata, components }, configUrl, {
      outDir,
      syncToData: false,
      tsconfig: join(root, "tsconfig.json"),
      clientPlugins: [fixedBuild],
      buildPlugins: [{
        name: "pluginDevelopment",
        setup(builder) {
          builder.onLoad({ filter: /\.[cm]?[jt]sx?$/i }, async ({ path }) => {
            if (!isWithin(root, path)) return;
            const source = await readFile(path, "utf8");
            // Bun.build 没有禁用宏的 API 选项；在交给 Bun 解析前禁止项目声明构建时导入属性。
            const ast = babelParse(source, { sourceType: "unambiguous", plugins: path.endsWith("x") ? ["jsx", "typescript", "deprecatedImportAssert"] : ["typescript", "deprecatedImportAssert"] });
            for (const node of ast.program.body) {
              if (("attributes" in node && node.attributes?.length) || ("source" in node && node.source?.value.startsWith("macro:"))) {
                throw new Error("Mã công cụ không hỗ trợ import attributes lúc build hoặc Bun macro");
              }
            }
          });
          builder.onResolve({ filter: /.*/ }, async args => {
            if (isBuiltin(args.path)) return { path: args.path, external: true };
            if (args.path === "toonflow:tool-zod") return { path: args.path, external: true };
            const path = Bun.resolveSync(args.path, args.resolveDir || (args.importer ? dirname(args.importer) : root));
            return { path: await allowedPath(path) };
          });
        },
      }],
    });
  }
} catch (error) {
  console.error(error instanceof AggregateError ? [error.message, ...error.errors].join("\n") : error);
  process.exitCode = 1;
}
