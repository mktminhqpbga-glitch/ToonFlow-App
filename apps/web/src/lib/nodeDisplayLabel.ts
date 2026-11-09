import { translate } from "@toonflow/i18n/vue";

const builtinDefaults: Record<string, string> = {
  "remote-textNode": "文本", "remote-imageNode": "图片", "remote-videoNode": "视频", "remote-audioNode": "音频",
  "remote-audioGenerationNode": "音频生成", "remote-imageGenerationNode": "图片生成", "remote-videoGenerationNode": "视频生成",
  "remote-director3dNode": "3D导演台", "remote-frameAnalysisNode": "逐帧拉片",
};
// Chỉ dịch nhãn mặc định đã biết ở lớp hiển thị; giữ alias, nhãn riêng, Node ID và dữ liệu đã lưu.
export function nodeDisplayLabel(item: { label: string; type?: string; alias?: string }) {
  return !item.alias && item.type && builtinDefaults[item.type] === item.label ? translate(item.label) : item.label;
}
