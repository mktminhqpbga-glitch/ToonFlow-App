const rules = [
  {
    type: "input",
    field: "apiUrl" as const,
    title: "Base URL Muse2API",
    value: "http://127.0.0.1:18610/v1",
    props: { placeholder: "http://127.0.0.1:18610/v1" },
  },
  {
    type: "input",
    field: "apiKey" as const,
    title: "Muse2API API Key",
    value: "",
    props: { type: "password", showPassword: true, autocomplete: "off" },
  },
];

export default {
  id: "muse2Api" as const,
  label: "Muse2API (Python / Go)",
  icon: "",
  version: "1.0.0",
  apiUrl: "http://127.0.0.1:18610/v1",
  protocol: "openai-completions" as const,
  readme: "Danh sách mô hình văn bản được lấy trực tiếp từ GET /v1/models của Muse2API bằng API Key. Những mô hình ảnh/video không xuất hiện ở đây. Việc một model xuất hiện trong danh sách không bảo đảm dịch vụ sẽ xử lý thành công; chưa gửi tác vụ thử. Không hỗ trợ gọi công cụ hoặc Agent SDK.",
  rules,
  models: [],
};
