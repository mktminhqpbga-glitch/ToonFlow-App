import { z } from "zod";
import { chainMethods, queryMethods, runMethods } from "@toonflow/ffmpeg/remote";
import type { ToolPlugin } from "@toonflow/tools-scaffold/runtime";

const configSchema = z.strictObject({});
const probeSchema = z.strictObject({
  path: z.string().min(1).describe("Tệp media trong workspace, là đường dẫn tương đối hoặc tuyệt đối bên trong workspace"),
  options: z.array(z.string()).optional().describe("Các tùy chọn ffprobe gốc, truyền nguyên mảng tham số; kết quả được phân tích dạng JSON, không cần và không được thay đổi định dạng đầu ra."),
});
const processSchema = z.strictObject({
  options: z.strictObject({
    source: z.string().optional(),
    cwd: z.string().optional(),
    niceness: z.number().optional(),
    priority: z.number().optional(),
    stdoutLines: z.number().optional(),
    timeout: z.number().optional(),
  }).optional().describe("Các tùy chọn khởi tạo gốc của fluent; không đặt timeout cố định"),
  steps: z.array(z.strictObject({
    method: z.enum(chainMethods),
    args: z.array(z.json()),
    undefinedArgs: z.array(z.number().int().nonnegative()).optional().describe("Vị trí tham số cần truyền undefined; giữ nguyên các tham số khác"),
  })).default([]).describe("Thiết lập theo thứ tự fluent-ffmpeg; dùng tên phương thức và alias từ host, giữ nguyên tùy chọn, bộ lọc và danh sách tệp"),
  operation: z.strictObject({
    method: z.enum([...runMethods, ...queryMethods]),
    args: z.array(z.json()),
    undefinedArgs: z.array(z.number().int().nonnegative()).optional(),
  }).default({ method: "run", args: [] }).describe("Phương thức chạy cuối cùng, mặc định run; cũng có thể là save, screenshots, concat hoặc truy vấn encoder, định dạng, bộ lọc."),
});

const plugin: ToolPlugin = {
  validateConfig: config => configSchema.parse(config),
  createTools(context) {
    async function execute(request: z.infer<typeof processSchema>, signal?: AbortSignal) {
      let details: unknown;
      let error: Error | undefined;
      let filenames: unknown;
      // ACT: 宿主在 Worker 中执行 JSON 调用，不在工具层重写参数、输出位置或原生执行规则。
      await context.executeFfmpeg({
        directory: context.cwd,
        requestId: crypto.randomUUID(),
        options: request.options ?? {},
        calls: request.steps,
        operation: request.operation,
      }, event => {
        if (event.event === "error") {
          const failure = event.args[0] as { message?: string };
          error = Object.assign(new Error(failure.message ?? "Chạy FFmpeg thất bại"), failure);
        } else if (event.event === "result") details = event.args[0];
        else if (event.event === "filenames") filenames = event.args[0];
        else if (event.event === "end") details = { stdout: event.args[0], stderr: event.args[1], ...(filenames ? { filenames } : {}) };
      }, signal ?? new AbortController().signal);
      signal?.throwIfAborted();
      if (error) throw error;
      return { content: [{ type: "text" as const, text: JSON.stringify(details) }], details };
    }

    return [{
      name: "ffprobe",
      label: "Tra cứu thông tin media",
      description: "Dùng FFprobe trên máy để đọc định dạng, thời lượng, kích thước, FPS và luồng âm thanh của tệp media trong workspace; hỗ trợ tùy chọn truy vấn gốc.",
      parameters: z.toJSONSchema(probeSchema, { io: "input", target: "draft-07" }),
      execute(_id, params, signal) {
        const { path, options } = probeSchema.parse(params);
        return execute({ steps: [{ method: "input", args: [path] }], operation: { method: "ffprobe", args: [{ options: options ?? [], json: true }] } }, signal);
      },
    }, {
      name: "ffmpeg",
      label: "Xử lý media",
      description: "Xử lý media trong workspace bằng fluent-ffmpeg từ host. steps truyền nguyên phương thức và args theo chuỗi, hỗ trợ tên và alias được host cung cấp, inputOptions/outputOptions, bộ lọc phức tạp, nhiều đầu vào/đầu ra, chuỗi tệp và phân đoạn. operation mặc định run, cũng hỗ trợ save, screenshots, concat và tra khả năng. Không tự đổi tên đầu ra hoặc giới hạn thời gian chạy; thư mục đích phải tồn tại và việc ghi đè theo quy tắc gốc.",
      promptSnippet: "Dùng ffmpeg xử lý media cục bộ, dùng ffprobe tra thông tin media; chọn đường dẫn đầu ra theo yêu cầu của người dùng.",
      promptGuidelines: [
        'Ví dụ trích khung hình: {"steps":[{"method":"input","args":["assets/input.mp4"]},{"method":"seekInput","args":[1]},{"method":"frames","args":[1]},{"method":"output","args":["assets/frame.png"]}]}。',
        'Truyền inputOptions/outputOptions theo cú pháp fluent gốc, không tách thêm theo dấu cách. Với metadata chứa dấu cách, dùng args:["-metadata","title=a b"], không bọc thêm mảng. Trước tiên dùng operation={"method":"availableEncoders","args":[]} để tra khả năng thực tế, không tự đoán encoder của máy.',
        "Trừ khi người dùng yêu cầu ghi đè, hãy đặt tên tệp mới. Tất cả đường dẫn, tham số, bộ lọc và các tệp trong danh sách media phải nằm trong workspace hiện tại.",
      ],
      parameters: z.toJSONSchema(processSchema, { io: "input", target: "draft-07" }),
      executionMode: "sequential",
      execute(_id, params, signal) {
        return execute(processSchema.parse(params), signal);
      },
    }];
  },
};

export default plugin;
