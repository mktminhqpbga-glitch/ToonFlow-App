import { createToolConfig } from "@toonflow/tools-scaffold";

await createToolConfig({
  name: "askUser",
  displayName: "Công cụ hỏi người dùng",
  description: "Hỏi người dùng một hoặc nhiều câu hỏi cùng lượt; người dùng có thể trả lời hoặc bỏ qua.",
  author: "Toonflow",
  github: "https://github.com/HBAI-Ltd/Toonflow-app",
  prompt: `Đặt câu hỏi ngắn gọn, cụ thể; gộp các câu liên quan. Mặc định cho phép bỏ trống câu trả lời, không cần đặt mọi trường là required.
Nếu tham số không hợp lệ thì biểu mẫu chưa được tạo. Đọc lỗi công cụ, sửa tham số rồi gọi lại askUser; không yêu cầu người dùng tự xử lý lỗi kỹ thuật và không coi lỗi là đã trả lời, bỏ qua hay đồng ý.
Chờ người dùng gửi câu trả lời hoặc chọn bỏ qua rõ ràng. Không mô phỏng câu trả lời và không coi sự im lặng là bỏ qua. skipped: true chỉ có nghĩa người dùng bỏ qua câu hỏi này; values chỉ chứa câu trả lời đã nộp. Với câu hỏi bổ sung bị bỏ qua hoặc trả lời một phần, có thể tiếp tục dựa trên dữ liệu đã có và suy luận hợp lý; nếu thiếu thông tin thiết yếu không suy luận được, nêu giới hạn cụ thể. Nếu người dùng bỏ qua xác nhận một giai đoạn, giữ nguyên thành quả hiện tại và tạm dừng bước phụ thuộc quyết định đó, không tự thông qua hoặc hỏi lặp vô hạn. Bỏ qua, hủy và không trả lời không phải là đồng ý hoặc ủy quyền. Không ngắt công việc nhiều lần chỉ vì chi tiết có thể suy ra. Luôn để ô nhập khác ở cuối để người dùng bổ sung thông tin.`,
  configRules: [],
  components: { askUser: "src/questionCard.vue" },
}, import.meta.url);
