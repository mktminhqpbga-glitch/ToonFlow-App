const rules = [
  {
    type: "input",
    field: "apiKey" as const,
    title: "Gemini API Key",
    value: "",
    props: { type: "password", showPassword: true, autocomplete: "off" },
  },
];

export default {
  id: "gemini" as const,
  label: "Google Gemini API",
  icon: "",
  version: "1.0.0",
  apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  protocol: "openai-completions" as const,
  readme: "Kết nối Gemini API chính thức bằng khóa API từ Google AI Studio. MacFlow lấy danh sách mô hình qua API của Google và sử dụng mô hình văn bản trong Agent hoặc Canvas. Đây là kết nối API riêng, không sử dụng phiên đăng nhập Gemini trong Chrome.",
  rules,
  models: [],
} satisfies ProviderDefinition<typeof rules>;
