export default {
  id: "mac2ApiGemini",
  label: "mac2API · Gemini Web",
  icon: "",
  version: "1.0.0",
  readme: "Kết nối trong Cài đặt → Kết nối mac2API. Gửi tác vụ có lưu tiến độ từ Xưởng hoặc Canvas.",
  rules: [],
  models: [
    { id: "gemini-web/image", label: "Gemini Web Ảnh", type: "image", mode: ["text", "singleImage"] },
  ],
} satisfies ProviderDefinition;
