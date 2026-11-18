const rules = [
  {
    type: "input",
    field: "apiUrl" as const,
    title: "Địa chỉ Gemini Web To API",
    value: "http://127.0.0.1:4981/openai/v1",
    props: { placeholder: "http://127.0.0.1:4981/openai/v1" },
  },
  {
    type: "input",
    field: "apiKey" as const,
    title: "Khóa kết nối nội bộ (không phải Google API Key)",
    value: "local-gemini-web-to-api",
    props: { type: "password", showPassword: true, autocomplete: "off" },
  },
];

export default {
  id: "geminiWebToApi" as const,
  label: "Gemini Web To API (cục bộ)",
  icon: "",
  version: "1.0.0",
  apiUrl: "http://127.0.0.1:4981/openai/v1",
  protocol: "openai-completions" as const,
  readme: "Kết nối tới dịch vụ Gemini Web To API chạy trên máy qua phiên đăng nhập Gemini Web. Không dùng Google API Key chính thức. Trường khóa là giá trị tương thích OpenAI SDK, không bảo vệ máy chủ; chỉ chạy dịch vụ trên 127.0.0.1. Danh sách model lấy từ dịch vụ thực tế; ảnh và video phải dùng nhà cung cấp media riêng. Gemini Web là giao thức không chính thức và có thể bị giới hạn.",
  rules,
  models: [],
} satisfies ProviderDefinition<typeof rules>;
