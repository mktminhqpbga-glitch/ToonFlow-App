import type { CustomProviderModel } from "@/stores/settings";

// Muse2API /v1/models hiện trả chung model văn bản và media nhưng không trả trường loại.
// Chỉ cho phép các ID văn bản đã đối chiếu với catalog Muse2API, không tự gán model media thành chat.
const names: Record<string, string> = {
  "muse-chat": "Muse Chat",
  "gpt-4o": "GPT-4o",
  "gpt-4o-mini": "GPT-4o mini",
  "gpt-4.1": "GPT-4.1",
  "gpt-5": "GPT-5",
  "claude-sonnet-4": "Claude Sonnet 4",
  "deepseek-chat": "DeepSeek Chat",
};

export function museTextModels(items: CustomProviderModel[]): CustomProviderModel[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (!item || typeof item.id !== "string" || !Object.hasOwn(names, item.id) || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  })
    .map(item => ({ ...item, label: names[item.id]!, reasoningEfforts: false }));
}
