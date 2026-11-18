import { z } from "zod";
import type { ToolPlugin } from "@toonflow/tools-scaffold/runtime";

const configSchema = z.object({
  allowRead: z.boolean().default(true),
  allowCreate: z.boolean().default(true),
  allowUpdate: z.boolean().default(true),
}).strict();

const plugin: ToolPlugin = {
  validateConfig: config => configSchema.parse(config),
  createTools({ config, skills }) {
    if (!skills) return [];
    const { allowRead, allowCreate, allowUpdate } = configSchema.parse(config);
    const actions: ["list", ...("read" | "create" | "update")[]] = ["list"];
    if (allowRead) actions.push("read");
    if (allowCreate) actions.push("create");
    if (allowUpdate) actions.push("update");
    const requestSchema = z.object({
      action: z.enum(actions),
      name: z.string().trim().min(1).max(128).optional().describe("Tên kỹ năng, bắt buộc cho read/create/update; kỹ năng mới dùng camelCase"),
      scope: z.enum(["workspace", "global"]).optional().describe("workspace là kỹ năng trong workspace, global là kỹ năng toàn cục. Tạo mới mặc định workspace; các thao tác khác chọn theo ưu tiên tên trùng."),
      path: z.string().min(1).max(4096).optional().describe("Đường dẫn tương đối từ thư mục kỹ năng, mặc định SKILL.md; có thể đọc tệp references, bỏ mốc chương."),
      content: z.string().max(200000).optional().describe("Bắt buộc cho create/update: toàn bộ nội dung tệp; SKILL.md phải có YAML frontmatter gồm name và description."),
    }).strict();
    return [{
      name: "skillOperator",
      label: "Công cụ quản lý kỹ năng",
      description: `Quản lý kỹ năng tại một nơi. Các thao tác đang được phép: ${actions.join("、")}. list trả danh mục kỹ năng hiện tại; scope có thể xem bản toàn cục bị bản workspace cùng tên che khuất. read đọc nội dung, create tạo mới không ghi đè, update thay toàn bộ tệp. Mọi thao tác trừ list cần name, thao tác ghi cần content. Tạo SKILL.md trước khi thêm kỹ năng.`,
      promptSnippet: "Tra cứu danh mục và đọc/quản lý kỹ năng cùng tài liệu đi kèm khi cần.",
      promptGuidelines: allowRead ? [
        "Khi nhận nhiệm vụ, trước tiên dùng skillOperator(action=list) xem tên và mô tả kỹ năng. Nếu nhiệm vụ phù hợp, dùng action=read đọc SKILL.md rồi mới thực hiện. Kỹ năng có disableModelInvocation=true chỉ dùng khi người dùng chỉ định. Không ép dùng kỹ năng cho chat thông thường hoặc khi không có mục phù hợp.",
        "Chỉ đọc references cần cho giai đoạn hiện tại. Giải quyết liên kết tương đối từ thư mục tài liệu, chuyển thành path từ gốc kỹ năng và bỏ phần mốc chương. Khi tham chiếu sang kỹ năng khác, gọi list xác nhận name và scope, không giả định toàn cục và workspace cùng cấp.",
        "Có thể dùng lại kỹ năng đã đọc đầy đủ và còn phù hợp trong ngữ cảnh hiện tại. Nêu ngắn kỹ năng dùng, tuân thủ giai đoạn và yêu cầu người dùng; danh mục hoặc tóm tắt cuộc trò chuyện cũ không thay cho nội dung. Nếu không đọc được tệp, nói rõ, không tự nhận đã đọc.",
      ] : ["Đã tắt quyền đọc nội dung kỹ năng. list chỉ có danh mục, không có nghĩa đã đọc hoặc sử dụng kỹ năng."],
      parameters: z.toJSONSchema(requestSchema, { io: "input", target: "draft-07" }),
      executionMode: "sequential",
      async execute(_id, params, signal) {
        const { action, name, scope, path, content } = requestSchema.parse(params);
        signal?.throwIfAborted();
        let result;
        if (action === "list") {
          result = { skills: skills.list(scope) };
        } else {
          if (!name) throw new Error("Hãy cung cấp tên kỹ năng trong trường name.");
          const location = { name, scope, path };
          if (action === "read") result = await skills.read(location, signal);
          else {
            if (content === undefined) throw new Error("Hãy cung cấp toàn bộ nội dung tệp trong trường content.");
            result = await skills[action]({ ...location, content }, signal);
          }
        }
        return { content: [{ type: "text", text: JSON.stringify(result) }], details: result };
      },
    }];
  },
};

export default plugin;
