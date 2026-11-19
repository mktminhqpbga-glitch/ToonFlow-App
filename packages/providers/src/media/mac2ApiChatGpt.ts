export default {
  id: "mac2ApiChatGpt",
  label: "mac2API · ChatGPT Web",
  icon: "",
  version: "1.0.0",
  readme: "Kết nối trong Cài đặt → Kết nối mac2API. Gửi tác vụ có lưu tiến độ từ Xưởng hoặc Canvas.",
  rules: [],
  models: [
    { id: "chatgpt/image", label: "ChatGPT Web Ảnh", type: "image", mode: ["text", "singleImage"] },
  ],
} satisfies ProviderDefinition;
