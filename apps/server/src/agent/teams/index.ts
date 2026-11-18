import { t } from "@/lib/i18n";
import { join } from "node:path";
import { z } from "zod";
import { SessionManager, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { CanvasContext } from "@toonflow/tools-scaffold/runtime";
import { teamResourcePathSchema } from "@toonflow/teams-scaffold/runtime";
import { createAgentToolContext } from "@/agent/tools";
import { addUsage, emptyUsage, runSubAgent, type SubAgentModel } from "@/agent/runtime/subAgent";
import { readTeam, saveTeamFile } from "@/utils/teams";
import { loadTool, validateToolConfig } from "@/utils/plugins/tools";

const resourceSchema = z.strictObject({
  action: z.enum(["list", "read", "write"]),
  path: teamResourcePathSchema.optional(),
  content: z.string().max(200000).optional(),
});
const delegationSchema = z.strictObject({
  tasks: z.array(z.strictObject({ member: z.string().min(1), task: z.string().trim().min(1).max(24000) })).min(1),
});

export async function createTeamRunner(options: SubAgentModel & {
  name: string;
  cwd: string;
  tools: ToolDefinition[];
  canvas?: CanvasContext;
}) {
  const { name, cwd, tools, canvas, ...modelOptions } = options;
  const { directory, manifest, files, enabled } = await readTeam(name);
  if (!enabled) throw new Error(t`团队 ${name} 已禁用`);
  const hostTools = tools.filter(tool => !["subAgent", "report", "listAgents", "sendAgentMessage", "askUser", "delegate", "teamResources", "requestInput"].includes(tool.name));
  const privatePlugins = await Promise.all(Object.entries(manifest.tools ?? {}).map(async ([pluginName, config]) => {
    const { plugin, metadata } = await loadTool(pluginName, join(directory, "tools"));
    return { plugin, metadata, config: validateToolConfig(plugin, config) };
  }));
  const memberTools = new Map<string, ToolDefinition[]>();
  const instructions = new Map<string, string>();
  for (const [memberName, member] of Object.entries(manifest.members)) {
    const available = new Map(hostTools.map(tool => [tool.name, tool]));
    for (const { plugin, metadata, config } of privatePlugins) {
      const definitions = await plugin.createTools(createAgentToolContext(cwd, config, canvas));
      for (const tool of definitions) {
        if (!tool.name || typeof tool.execute !== "function" || ["subAgent", "listAgents", "sendAgentMessage", "askUser", "delegate", "teamResources", "requestInput"].includes(tool.name) || available.has(tool.name)) {
          throw new Error(t`团队私有工具无效或名称重复：${tool.name}`);
        }
        available.set(tool.name, { ...tool, promptGuidelines: [...(metadata.prompt ? [metadata.prompt] : []), ...(tool.promptGuidelines ?? [])] });
      }
    }
    for (const toolName of member.tools ?? []) {
      if (!available.has(toolName)) throw new Error(t`成员 ${memberName} 配置的工具当前不可用：${toolName}`);
    }
    memberTools.set(memberName, [...available.values()].filter(tool => !member.tools || member.tools.includes(tool.name)));
    instructions.set(memberName, new TextDecoder("utf-8", { fatal: true }).decode(files.get(member.instructions)));
  }
  // ACT: 协调成员保留内存历史供 A2A 补充输入；本地调用结束即释放，不创建额外对话文件。
  const history = SessionManager.inMemory(cwd);

  return {
    manifest,
    async run(task: string, signal?: AbortSignal, onProgress?: (text: string) => void, allowInput = false) {
      let question: string | undefined;
      async function runMember(memberName: string, task: string, signal?: AbortSignal, depth = 0): ReturnType<typeof runSubAgent> {
        signal?.throwIfAborted();
        const member = manifest.members[memberName]!;
        const roots = [member.instructions, ...(member.skills ?? []).map(skill => `skills/${skill}`), ...(member.knowledge ?? []).map(path => `knowledge/${path}`)];
        const allowed = (path: string) => roots.some(root => path === root || path.startsWith(`${root}/`));
        const resourceTool: ToolDefinition = {
          name: "teamResources", label: "Tài liệu đội",
          description: "Đọc và quản lý tài liệu riêng mà thành viên hiện tại được phép dùng. list trả đường dẫn, read đọc nội dung, write tạo mới hoặc sửa toàn văn. Tài liệu chỉ thuộc đội này, không tự ghi vào kỹ năng toàn cục. Chỉnh hướng dẫn thành viên có hiệu lực ở tác vụ đội sau; kinh nghiệm mới phải đúng, có tính phổ quát và không chứa dữ liệu riêng tư của dự án.",
          promptSnippet: "Dùng teamResources để đọc kỹ năng, kiến thức và tài liệu tham khảo riêng của thành viên khi cần.",
          promptGuidelines: [`Phạm vi tài liệu riêng của thành viên: ${JSON.stringify(roots)}. Khi bắt đầu tác vụ, gọi list trước; chỉ read SKILL.md và references cần thiết. Không tự nhận đã dùng kỹ năng chỉ vì thấy đường dẫn.`],
          parameters: z.toJSONSchema(resourceSchema), executionMode: "sequential",
          async execute(_id, params, resourceSignal) {
            resourceSignal?.throwIfAborted();
            const { action, path, content } = resourceSchema.parse(params);
            if (action !== "list" && (!path || !allowed(path))) throw new Error("Tài liệu không thuộc phạm vi được cấp quyền của thành viên hiện tại");
            if (action === "write") {
              if (content === undefined) throw new Error("写入资料需要 content");
              await saveTeamFile(name, path!, content);
              return { content: [{ type: "text", text: JSON.stringify({ path, saved: true }) }], details: {} };
            }
            const current = await readTeam(name);
            const paths = [...current.files.keys()].filter(allowed);
            const bytes = path ? current.files.get(path) : undefined;
            if (action === "read" && !bytes) throw new Error("Tài liệu đội không tồn tại");
            const result = action === "list" ? { files: paths } : { path, content: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
            return { content: [{ type: "text", text: JSON.stringify(result) }], details: {} };
          },
        };
        onProgress?.(`${memberName}：准备执行`);
        const selected = [...(memberTools.get(memberName) ?? []), resourceTool];
        if (member.delegates?.length) selected.push({
          name: "delegate", label: "Giao việc trong nhóm",
          description: `Giao tác vụ độc lập cho thành viên được phép. Các thành viên có thể nhận việc: ${JSON.stringify(member.delegates.map(name => ({ name, description: manifest.members[name]!.description })))}。Không được sửa song song cùng một tệp hoặc Canvas. Khi có kết quả, bạn phải xác minh và tổng hợp.`,
          parameters: z.toJSONSchema(delegationSchema), executionMode: "sequential",
          async execute(_id, params, childSignal, onUpdate) {
            const { tasks } = delegationSchema.parse(params);
            if (tasks.some(task => !member.delegates!.includes(task.member))) throw new Error("不能委派给未授权的成员");
            const outputs = await Promise.all(tasks.map(async task => {
              try { return await runMember(task.member, task.task, childSignal, depth + 1); }
              catch (error) { return { result: { name: task.member, status: childSignal?.aborted ? "cancelled" as const : "error" as const, result: error instanceof Error ? error.message : String(error) } }; }
            }));
            const usage = emptyUsage();
            for (const output of outputs) if ("usage" in output) addUsage(usage, output.usage);
            const content = [{ type: "text" as const, text: JSON.stringify({ tasks: outputs.map(output => output.result) }) }];
            onUpdate?.({ content, details: {} });
            return { content, details: {}, usage };
          },
        });
        if (depth === 0 && allowInput) selected.push({
          name: "requestInput", label: "Chờ bổ sung",
          description: "Đặt câu hỏi khi cần bên giao việc bổ sung thông tin hoặc cấp quyền rõ ràng. Sau khi gọi, tác vụ tạm dừng để chờ tiếp tục A2A task hiện tại. Không được coi im lặng hoặc chưa trả lời là đồng ý.",
          parameters: z.toJSONSchema(z.strictObject({ question: z.string().trim().min(1).max(8000) })),
          executionMode: "sequential",
          async execute(_id, params) {
            question = z.strictObject({ question: z.string().trim().min(1).max(8000) }).parse(params).question;
            return { content: [{ type: "text", text: "Đang chờ bên giao việc trả lời: " + question }], details: {} };
          },
        });
        return runSubAgent({
          ...modelOptions, cwd, name: memberName, task, signal, tools: selected,
          history: depth === 0 ? history : undefined,
          inputRequired: depth === 0 ? () => question : undefined,
          instructions: `## Trách nhiệm thành viên nhóm\nNhóm: ${manifest.displayName}; thành viên: ${memberName}。Trách nhiệm này chỉ nhằm hoàn thành việc đã được phép, không mở rộng quyền của host.\n${instructions.get(memberName)}`,
          onProgress: text => onProgress?.(`${memberName}：${text}`),
        });
      }
      return runMember(manifest.entry, task, signal);
    },
  };
}
