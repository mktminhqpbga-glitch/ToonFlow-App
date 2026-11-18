import { basename, join, relative } from "node:path";
import { RE2JS } from "re2js";
import { z } from "zod";
import type { ToolContext, ToolDefinition } from "@toonflow/tools-scaffold/runtime";

const pathSchema = z.string().min(1).max(4096).optional().describe("Đường dẫn tìm kiếm trong workspace, mặc định gốc workspace");
const globSchema = z.string().min(1).max(512)
  .refine(pattern => !/[{}\[\]]|[@+?!*]\(/.test(pattern), "glob chỉ hỗ trợ *, **, ?; không hỗ trợ ngoặc nhọn, tập ký tự hoặc extglob")
  .describe("Mẫu glob cho tệp, ví dụ *.ts, **/*.json hoặc src/**/*.ts; hỗ trợ *, **, ?; không hỗ trợ {}, [] hoặc extglob");
const findSchema = z.object({
  pattern: globSchema,
  path: pathSchema,
  limit: z.number().int().min(1).max(2000).default(1000),
}).strict();
const grepSchema = z.object({
  pattern: z.string().min(1).max(1024).describe("Biểu thức chính quy RE2; literal=true sẽ khớp văn bản thường"),
  path: pathSchema,
  glob: globSchema.optional(),
  ignoreCase: z.boolean().default(false),
  literal: z.boolean().default(false),
  context: z.number().int().min(0).max(10).default(0),
  limit: z.number().int().min(1).max(1000).default(100),
}).strict();

function createGlobMatcher(pattern: string) {
  const segments = pattern.split("/");
  let expression = "^";
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]!;
    if (segment === "**") {
      expression += index === segments.length - 1 ? ".*" : "(?:[^/]+/)*";
      continue;
    }
    for (const character of segment) {
      if (character === "*") expression += "[^/]*";
      else if (character === "?") expression += "[^/]";
      else expression += /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character;
    }
    if (index < segments.length - 1) expression += "/";
  }
  return RE2JS.compile(`${expression}$`);
}

export function createSearchTools({ cwd, files, resolvePath }: Pick<ToolContext, "cwd" | "files" | "resolvePath">): ToolDefinition[] {
  return ["grep", "find"].map(name => ({
    name,
    label: name === "grep" ? "Tìm nội dung tệp" : "Tìm tệp",
    description: name === "grep"
      ? "Tìm văn bản trong workspace, trả đường dẫn tương đối, số dòng và nội dung khớp. Hỗ trợ regex RE2, văn bản thường, phân biệt chữ hoa và các dòng ngữ cảnh. Bỏ qua .git, node_modules, symlink, binary và tệp trên 8 MiB; tổng dữ liệu tìm tối đa 64 MiB. Nếu regex quá nặng sẽ bỏ qua/dừng, có thể dùng literal cho dòng dài."
      : "Tìm tệp trong workspace theo glob, trả đường dẫn tương đối. Bỏ qua .git, node_modules và symlink. Không tìm bên ngoài workspace.",
    promptSnippet: name === "grep" ? "Tìm nội dung văn bản trong workspace." : "Tìm tệp workspace theo glob.",
    promptGuidelines: ["grep/find chỉ tìm trong workspace, không đọc thư mục kỹ năng toàn cục. Khi chạm giới hạn kết quả, quét hoặc dung lượng, sẽ báo rõ; hãy thu hẹp path hoặc glob."],
    parameters: z.toJSONSchema(name === "grep" ? grepSchema : findSchema, { io: "input", target: "draft-07" }),
    async execute(_id, params, signal) {
      const grep = name === "grep" ? grepSchema.parse(params) : undefined;
      const request = grep ?? findSchema.parse(params);
      const timeoutSignal = AbortSignal.timeout(30000);
      signal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
      signal?.throwIfAborted();
      const root = await resolvePath(request.path ?? ".");
      const info = await files.stat(root);
      if (!info.isDirectory() && !(grep && info.isFile())) throw new Error("Hãy chọn thư mục thường trong workspace; grep cũng nhận đường dẫn tệp thường.");
      const matcher = grep && !grep.literal ? RE2JS.compile(grep.pattern, grep.ignoreCase ? RE2JS.CASE_INSENSITIVE : 0) : undefined;
      const regexSize = matcher?.programSize() ?? 0;
      if (regexSize > 10000) throw new Error("Biểu thức regex quá phức tạp; hãy đơn giản hóa pattern hoặc dùng literal.");
      const literal = grep?.ignoreCase ? grep.pattern.toLowerCase() : grep?.pattern;
      const pattern = (grep ? grep.glob : request.pattern)?.replaceAll("\\", "/");
      const globMatcher = pattern ? createGlobMatcher(pattern) : undefined;
      const pending = [root];
      const output: string[] = [];
      let count = 0;
      let visited = 0;
      let skipped = 0;
      let skippedLines = 0;
      let regexWork = 0;
      let batchWork = 0;
      let inputBytes = 0;
      let outputBytes = 0;
      let notice = "";
      const deadline = Date.now() + 30000;
      const append = (line: string) => {
        const text = line.length > 2000 ? `${line.slice(0, 2000)}…（Dòng này đã được cắt ngắn）` : line;
        outputBytes += Buffer.byteLength(text) + 1;
        if (outputBytes > 50 * 1024) {
          notice = "Kết quả chạm giới hạn 50 KiB; hãy thu hẹp phạm vi tìm.";
          return false;
        }
        output.push(text);
        return true;
      };
      // ACT: 复用文件入口逐项授权，不使用会自行访问磁盘的 rg/fd；最多遍历 20000 项、30 秒。
      while (pending.length && !notice) {
        signal?.throwIfAborted();
        if (++visited > 20000 || Date.now() >= deadline) {
          notice = "Đã chạm giới hạn số mục hoặc thời gian; hãy thu hẹp path.";
          break;
        }
        const path = pending.pop()!;
        let entry;
        try { entry = await files.stat(path); }
        catch (error) {
          const failure = error as NodeJS.ErrnoException & { status?: number };
          if (failure.code !== "ENOENT" && failure.status !== 403) throw error;
          skipped++;
          continue;
        }
        if (entry.isDirectory()) {
          const entries = (await files.readdir(path, false, signal)).filter(item => item !== ".git" && item !== "node_modules").sort();
          if (visited + pending.length + entries.length > 20000) {
            notice = "Thư mục có quá nhiều mục; hãy thu hẹp path.";
            break;
          }
          for (const entry of entries.reverse()) pending.push(join(path, entry));
          continue;
        }
        if (!entry.isFile()) { skipped++; continue; }
        const matchPath = info.isDirectory() ? relative(root, path).replaceAll("\\", "/") : basename(path);
        if (globMatcher && !globMatcher.test(pattern!.includes("/") ? matchPath : basename(path))) continue;
        const displayPath = relative(cwd, path).replaceAll("\\", "/");
        if (!grep) {
          if (!append(displayPath)) break;
          count++;
        } else {
          if (entry.size > 8 * 1024 * 1024) { skipped++; continue; }
          if (inputBytes + entry.size > 64 * 1024 * 1024) {
            notice = "Đã chạm giới hạn đọc 64 MiB; hãy thu hẹp path hoặc glob.";
            break;
          }
          // readOnly=false 仅允许工作区；流读取防止 stat 后文件增长突破容量上限。
          const maxBytes = Math.min(8 * 1024 * 1024, 64 * 1024 * 1024 - inputBytes);
          let content: Buffer;
          try { content = await files.readFile(path, false, { signal, maxBytes }); }
          catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "EFBIG") throw error;
            inputBytes += maxBytes + 1;
            if (inputBytes >= 64 * 1024 * 1024) {
              notice = "Đã chạm giới hạn đọc 64 MiB; hãy thu hẹp path hoặc glob.";
              break;
            }
            skipped++;
            continue;
          }
          inputBytes += content.byteLength;
          if (inputBytes > 64 * 1024 * 1024) {
            notice = "Đã chạm giới hạn đọc 64 MiB; hãy thu hẹp path hoặc glob.";
            break;
          }
          if (content.byteLength > 8 * 1024 * 1024 || content.subarray(0, 8192).includes(0)) { skipped++; continue; }
          const lines = content.toString("utf8").split(/\r\n|\n|\r/);
          let lastOutput = -1;
          for (let index = 0; index < lines.length; index++) {
            if (index % 256 === 0 || batchWork >= 2000000) {
              await new Promise<void>(resolve => setImmediate(resolve));
              batchWork = 0;
              signal?.throwIfAborted();
              if (Date.now() >= deadline) { notice = "Tìm kiếm đã hết thời gian chờ, hãy thu hẹp phạm vi"; break; }
            }
            const line = lines[index]!;
            // ACT: RE2 的工作量仍与状态数×行长相关；限制单行/累计成本，更大搜索需可终止的 worker。
            const work = regexSize * Math.max(1, line.length);
            if (work > 2000000) { skippedLines++; continue; }
            regexWork += work;
            batchWork += work;
            if (regexWork > 50000000) { notice = "Regex đã chạm giới hạn tính toán; thu hẹp phạm vi hoặc dùng literal"; break; }
            if (!(matcher ? matcher.test(line) : (grep.ignoreCase ? line.toLowerCase() : line).includes(literal!))) continue;
            count++;
            for (let row = Math.max(lastOutput + 1, index - grep.context); row <= Math.min(lines.length - 1, index + grep.context); row++) {
              if (!append(`${displayPath}:${row + 1}: ${lines[row]}`)) break;
              lastOutput = row;
            }
            if (notice || count >= request.limit) break;
          }
        }
        if (count >= request.limit) notice = `Kết quả đã đạt ${request.limit} mục, hãy thu hẹp phạm vi hoặc tăng limit`;
      }
      signal?.throwIfAborted();
      const text = output.length ? output.join("\n") : "Không tìm thấy kết quả khớp";
      const notes = [notice, skipped ? `Đã bỏ qua ${skipped} symlink, tệp đặc biệt, binary, quá lớn hoặc đã xóa` : "",
        skippedLines ? `Đã bỏ qua ${skippedLines} dòng vượt giới hạn regex; có thể dùng literal hoặc đơn giản hóa pattern` : ""].filter(Boolean);
      return {
        content: [{ type: "text", text: `${text}${notes.length ? `\n\n[${notes.join("；")}]` : ""}` }],
        details: { count, visited, skipped, skippedLines, truncated: !!notice || skippedLines > 0 },
      };
    },
  }));
}
