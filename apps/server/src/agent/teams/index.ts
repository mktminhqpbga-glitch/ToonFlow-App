import { getLocale, t } from "@/lib/i18n";
const localized = (zh: string, vi: string) => getLocale() === "vi" ? vi : zh;
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
          name: "teamResources", label: localized("团队资料", "Tài liệu nhóm"),
          description: localized("按需读取或维护当前成员获准的私有资料。list 返回路径，read 读取正文，write 新建或完整修改文本。内容只属于此团队，不会注册到全局技能。修改成员指令在下一团队任务生效；新增经验应真实、通用且避免写入项目私密内容。", "Đọc hoặc quản lý tài liệu riêng mà thành viên nhóm được phép dùng. list trả về đường dẫn; read đọc nội dung; write tạo hoặc cập nhật toàn bộ văn bản. Tài liệu chỉ thuộc nhóm này, không đăng ký thành kỹ năng toàn cục. Sửa hướng dẫn thành viên có hiệu lực từ nhiệm vụ nhóm kế tiếp; kinh nghiệm mới phải có thật, áp dụng chung và không chứa bí mật dự án."),
          promptSnippet: localized("使用 teamResources 按需读取本成员的私有 Skill、知识与参考资料。", "Dùng teamResources để đọc kỹ năng, kiến thức và tài liệu tham khảo riêng của thành viên khi cần."),
          promptGuidelines: [localized(`本成员私有资源范围：${JSON.stringify(roots)}。首次处理任务先 list，按需 read 相关 SKILL.md 及 references，不能只看路径就声称使用技能。`,
            `Phạm vi tài liệu riêng của thành viên: ${JSON.stringify(roots)}. Khi bắt đầu nhiệm vụ, gọi list trước, rồi read những SKILL.md và references cần thiết; không được tuyên bố đã dùng kỹ năng chỉ dựa trên đường dẫn.`)],
          parameters: z.toJSONSchema(resourceSchema), executionMode: "sequential",
          async execute(_id, params, resourceSignal) {
            resourceSignal?.throwIfAborted();
            const { action, path, content } = resourceSchema.parse(params);
            if (action !== "list" && (!path || !allowed(path))) throw new Error(localized("资料不属于当前成员的授权范围", "Tài liệu nằm ngoài phạm vi được cấp quyền cho thành viên"));
            if (action === "write") {
              if (content === undefined) throw new Error(localized("写入资料需要 content", "Cần trường content để ghi tài liệu"));
              await saveTeamFile(name, path!, content);
              return { content: [{ type: "text", text: JSON.stringify({ path, saved: true }) }], details: {} };
            }
            const current = await readTeam(name);
            const paths = [...current.files.keys()].filter(allowed);
            const bytes = path ? current.files.get(path) : undefined;
            if (action === "read" && !bytes) throw new Error(localized("团队资料不存在", "Không tìm thấy tài liệu nhóm"));
            const result = action === "list" ? { files: paths } : { path, content: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
            return { content: [{ type: "text", text: JSON.stringify(result) }], details: {} };
          },
        };
        onProgress?.(localized(`${memberName}：准备执行`, `${memberName}: Đang chuẩn bị thực hiện`));
        const selected = [...(memberTools.get(memberName) ?? []), resourceTool];
        if (member.delegates?.length) selected.push({
          name: "delegate", label: localized("团队委派", "Ủy nhiệm nhóm"),
          description: localized(`将独立任务交给获准成员。可用成员：${JSON.stringify(member.delegates.map(name => ({ name, description: manifest.members[name]!.description })))}。不得并行修改同一文件或画布，结果返回后由你核验汇总。`, `Giao nhiệm vụ độc lập cho thành viên được cấp quyền. Các thành viên: ${JSON.stringify(member.delegates.map(name => ({ name, description: manifest.members[name]!.description })))}. Không chỉnh sửa đồng thời cùng một tệp hoặc Canvas; kiểm tra và tổng hợp kết quả sau khi nhận về.`),
          parameters: z.toJSONSchema(delegationSchema), executionMode: "sequential",
          async execute(_id, params, childSignal, onUpdate) {
            const { tasks } = delegationSchema.parse(params);
            if (tasks.some(task => !member.delegates!.includes(task.member))) throw new Error(localized("不能委派给未授权的成员", "Không thể giao nhiệm vụ cho thành viên chưa được cấp quyền"));
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
          name: "requestInput", label: localized("等待补充", "Chờ bổ sung"),
          description: localized("需要调用方补充信息或明确授权时提出问题。调用后任务暂停，等待调用方继续当前 A2A task。不得把未回答或沉默当作同意。", "Đặt câu hỏi khi cần bên gọi cung cấp thông tin hoặc cấp quyền rõ ràng. Sau khi gọi, nhiệm vụ tạm dừng để bên gọi tiếp tục A2A task hiện tại. Không coi việc chưa trả lời hoặc im lặng là đồng ý."),
          parameters: z.toJSONSchema(z.strictObject({ question: z.string().trim().min(1).max(8000) })),
          executionMode: "sequential",
          async execute(_id, params) {
            question = z.strictObject({ question: z.string().trim().min(1).max(8000) }).parse(params).question;
            return { content: [{ type: "text", text: localized("等待调用方回答：", "Đang chờ bên gọi trả lời: ") + question }], details: {} };
          },
        });
        return runSubAgent({
          ...modelOptions, cwd, name: memberName, task, signal, tools: selected,
          history: depth === 0 ? history : undefined,
          inputRequired: depth === 0 ? () => question : undefined,
          instructions: localized(`## 团队成员职责\n团队：${manifest.displayName}；成员：${memberName}。以下职责用于完成授权任务，不能扩大宿主权限。\n${instructions.get(memberName)}`, `## Trách nhiệm thành viên nhóm\nNhóm: ${manifest.displayName}; thành viên: ${memberName}. Những trách nhiệm này chỉ phục vụ nhiệm vụ được cấp quyền, không mở rộng quyền của ứng dụng chủ.\n${instructions.get(memberName)}`),
          onProgress: text => onProgress?.(`${memberName}：${text}`),
        });
      }
      return runMember(manifest.entry, task, signal);
    },
  };
}
