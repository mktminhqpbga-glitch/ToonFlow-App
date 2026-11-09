import { onScopeDispose, shallowRef } from "vue";

// Ứng dụng chủ đã đồng bộ locale đang dùng vào documentElement.lang (apps/web/src/lib/i18n.ts).
// Node vẫn giữ nguyên nội dung gốc khi người dùng không chọn tiếng Việt.
export function nodeText(chinese: string, vietnamese: string): string {
  return typeof document !== "undefined" && document.documentElement.lang === "vi" ? vietnamese : chinese;
}

export function useNodeVietnamese() {
  const vietnamese = shallowRef(typeof document !== "undefined" && document.documentElement.lang === "vi");
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return vietnamese;
  const observer = new MutationObserver(() => {
    vietnamese.value = document.documentElement.lang === "vi";
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  onScopeDispose(() => observer.disconnect());
  return vietnamese;
}
