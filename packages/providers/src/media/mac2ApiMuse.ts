export default {
  id: "mac2ApiMuse",
  label: "mac2API · Muse",
  icon: "",
  version: "1.0.0",
  readme: "Kết nối trong Cài đặt → Kết nối mac2API. Gửi tác vụ có lưu tiến độ từ Xưởng hoặc Canvas.",
  rules: [],
  models: [
    { id: "muse/image", label: "Muse Ảnh", type: "image", mode: ["text", "singleImage", "multiReference"] },
    { id: "muse/video", label: "Muse Video", type: "video", mode: ["text", "singleImage", ["imageReference:4"]] },
  ],
} satisfies ProviderDefinition;
