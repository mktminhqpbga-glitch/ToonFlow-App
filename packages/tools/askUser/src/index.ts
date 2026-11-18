import { z } from "zod";
import type { ToolPlugin } from "@toonflow/tools-scaffold/runtime";

const optionsSchema = z.array(z.string().trim().min(1).max(300)).max(20)
  .refine(options => new Set(options).size === options.length, "Các lựa chọn không được trùng nhau");

const fieldSchema = z.object({
  field: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,63}$/)
    .refine(field => !["constructor", "prototype", "__proto__"].includes(field), "Tên trường không hợp lệ")
    .describe("Tên trường camelCase duy nhất, ví dụ duckRef; chỉ gồm chữ cái Latin và chữ số, không chứa dấu gạch dưới hoặc gạch ngang"),
  title: z.string().trim().min(1).max(200),
  type: z.enum(["input", "textarea", "radio", "checkbox", "select", "inputNumber", "switch"]),
  required: z.boolean().optional(),
  options: optionsSchema.optional().describe("Kiểu radio, checkbox hoặc select phải có danh sách lựa chọn không rỗng"),
  placeholder: z.string().trim().max(300).optional(),
}).refine(field => !["radio", "checkbox", "select"].includes(field.type) || !!field.options?.length,
  "Trường chọn bắt buộc có các lựa chọn");

const questionSchema = z.object({
  title: z.string().trim().min(1).max(100).describe("Tiêu đề thẻ hỏi, tóm tắt nội dung cần xác nhận"),
  question: z.string().trim().min(1).max(4000).describe("Bắt buộc: câu hỏi hoặc mô tả cả nhóm; vẫn phải cung cấp khi dùng fields"),
  options: optionsSchema.max(8).optional(),
  fields: z.array(fieldSchema).max(12)
    .refine(fields => new Set(fields.map(field => field.field)).size === fields.length, "Tên trường không được trùng").optional()
    .describe("Có thể đặt nhiều câu hỏi, mỗi mục một câu; khi fields không rỗng thì không được đặt options ở cấp cao nhất"),
}).refine(request => !request.fields?.length || request.options === undefined, "Biểu mẫu động không được có options ở cấp cao nhất cùng lúc");

const plugin: ToolPlugin = {
  validateConfig(config) {
    if (Object.keys(config).length) throw new Error("Công cụ hỏi người dùng không có tùy chọn cấu hình");
    return {};
  },
  createTools({ question }) {
    if (!question) return [];
    return [{
      name: "askUser",
      label: "Công cụ hỏi",
      description: "Gọi khi cần người dùng bổ sung thông tin hoặc chọn. Một câu hỏi trắc nghiệm dùng options, nhiều câu hỏi dùng fields. Kết quả có answer, trường hợp nhiều câu còn có values; nếu bỏ qua toàn bộ thì trả skipped: true.",
      promptSnippet: "Hỏi một hoặc nhiều câu hỏi; người dùng có thể trả lời hoặc bỏ qua. Bỏ qua không có nghĩa đã duyệt giai đoạn.",
      parameters: z.toJSONSchema(questionSchema, { io: "input", target: "draft-07" }),
      executionMode: "sequential",
      async execute(id, params, signal) {
        const result = await question.ask(id, questionSchema.parse(params), signal);
        return { content: [{ type: "text", text: JSON.stringify(result) }], details: result };
      },
    }];
  },
};

export default plugin;
