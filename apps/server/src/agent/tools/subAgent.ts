import { z } from "zod";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { CanvasContext } from "@toonflow/tools-scaffold/runtime";
import { teamNameSchema } from "@toonflow/teams-scaffold/runtime";
import { addUsage, emptyUsage, type SubAgentModel, type SubAgentResult } from "@/agent/runtime/subAgent";
import { createTeamRunner } from "@/agent/teams";
import { runRemoteTeam } from "@/agent/teams/remote";
import { listTeams, getRemoteTeam } from "@/utils/teams";

const parameters = z.strictObject({
  tasks: z.array(z.strictObject({
    name: z.string().trim().min(1).max(80).describe("Tên tác vụ hiện tại"),
    task: z.string().trim().min(1).max(24000).describe("Tác vụ đầy đủ, ngữ cảnh cần thiết, đường dẫn tương đối, quyền đã cấp và kết quả mong muốn; không kế thừa lịch sử cuộc trò chuyện chính"),
    team: teamNameSchema.optional().describe("Tên đội đã cài hoặc kết nối A2A từ xa; bỏ trống sẽ tạo Agent con tạm"),
    taskId: z.string().min(1).max(512).optional().describe("Trả nguyên giá trị khi tiếp tục tác vụ A2A từ xa đang chờ bổ sung"),
    contextId: z.string().min(1).max(512).optional().describe("Trả nguyên giá trị khi tiếp tục phiên A2A từ xa"),
  })).min(1),
});

export async function createSubAgentTool({ cwd, tools, canvas, runTask, ...modelOptions }: SubAgentModel & {
  cwd: string; tools: ToolDefinition[]; canvas?: CanvasContext;
  runTask: (name: string, task: string, signal?: AbortSignal, onProgress?: (text: string) => void) => Promise<{ result: SubAgentResult; usage: ReturnType<typeof emptyUsage> }>;
}): Promise<ToolDefinition> {
  if (tools.some(tool => tool.name === "subAgent")) throw new Error("Tên công cụ subAgent đã được dùng bởi công cụ tác vụ con tích hợp");
  const teams = (await listTeams()).filter(team => team.enabled && !team.loadError);
  const subAgentTool: ToolDefinition = {
    name: "subAgent", label: "Tác vụ con và đội",
    description: `Thực hiện các tác vụ giao phó song song. Bỏ team để tạo Agent con có thể tiếp tục hội thoại, kế thừa công cụ của host gồm hỏi người dùng, giao tiếp, report và trao đổi đội qua listAgents/sendAgentMessage; file trả về dùng để liên lạc sau. Chọn team để dùng đội đã cài hoặc A2A bên ngoài. Công cụ host: ${[...tools.map(tool => tool.name), "subAgent"].join("、")}. Danh sách đội: ${JSON.stringify(teams.map(({ name, description, kind }) => ({ name, description, kind })))}. Chia việc cho đội cục bộ theo danh sách. Không đặt giới hạn cố định về số tác vụ, mức song song, lượt chạy hoặc tổng thời gian; người dùng có thể dừng.`,
    promptSnippet: "Dùng subAgent khi cần giao việc độc lập hoặc chọn team đã cài để gọi đội chuyên dụng.",
    promptGuidelines: [
      "Tự làm tác vụ đơn giản; khi giao việc, cung cấp ngữ cảnh và quyền người dùng đã cấp. Công việc song song không được sửa cùng tệp hoặc Canvas; Agent con phối hợp qua listAgents/sendAgentMessage rồi mới thực hiện phần phụ thuộc.",
      "Giao việc không mở rộng quyền hoặc cho phép tiêu hao tài nguyên AI. Đội từ xa chỉ nhận văn bản task cần thiết đã được cho phép chia sẻ, không thể dùng công cụ cục bộ hay tệp không được gửi.",
      "Kiểm chứng kết quả và status. inputRequired nghĩa là chờ bổ sung; phải hỏi người dùng rồi tiếp tục đội từ xa với taskId/contextId gốc. Lỗi, hủy hoặc chạm giới hạn không phải hoàn tất; không tự chạy lại tác vụ có thể đã gây tác động.",
    ],
    parameters: z.toJSONSchema(parameters, { io: "input", target: "draft-07" }),
    executionMode: "sequential",
    async execute(_id, params, signal, onUpdate) {
      signal?.throwIfAborted();
      const { tasks } = parameters.parse(params);
      const results: SubAgentResult[] = tasks.map(task => ({ name: task.name, status: "running", result: "Chuẩn bị chạy" }));
      const usage = emptyUsage();
      const content = () => [{ type: "text" as const, text: JSON.stringify({ tasks: results }) }];
      const update = () => { if (!signal?.aborted) onUpdate?.({ content: content(), details: {} }); };
      update();
      await Promise.all(tasks.map(async (task, index) => {
        const onProgress = (text: string) => { results[index]!.result = text; update(); };
        try {
          const remote = task.team && getRemoteTeam(task.team);
          if ((task.taskId || task.contextId) && !remote) throw new Error("Chỉ đội A2A từ xa mới hỗ trợ taskId/contextId");
          const output = remote
            ? await runRemoteTeam({ ...task, name: task.team!, signal, onProgress })
            : task.team
              ? await (await createTeamRunner({ ...modelOptions, cwd, tools: inheritedTools, canvas, name: task.team })).run(task.task, signal, onProgress)
              : await runTask(task.name, task.task, signal, onProgress);
          results[index] = { ...output.result, name: task.name };
          addUsage(usage, output.usage);
        } catch (error) {
          results[index] = { name: task.name, status: signal?.aborted ? "cancelled" : "error", result: error instanceof Error ? error.message : String(error) };
        }
        update();
      }));
      return { content: content(), details: {}, usage };
    },
  };
  const inheritedTools = [...tools, subAgentTool];
  return subAgentTool;
}
