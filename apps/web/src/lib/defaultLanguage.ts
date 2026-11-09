import { normalizeLocale } from "@toonflow/i18n";

// Bản độc lập mặc định tiếng Việt; bản phân phối khác có thể đặt "system" hoặc một locale hợp lệ.
export const defaultLanguage = normalizeLocale(import.meta.env.VITE_TOONFLOW_DEFAULT_LOCALE ?? "vi") ?? "system";

/** Keep explicit language choices, but do not let a legacy implicit "system" value
 * override the Vietnamese default in standalone distributions. No persisted data is rewritten. */
export function resolveUiLanguage(saved: unknown, explicitSelection: boolean): typeof defaultLanguage | "system" | import("@toonflow/i18n").Locale {
  const chosen = normalizeLocale(saved);
  if (chosen) return chosen;
  if (saved === "system" && explicitSelection) return "system";
  return defaultLanguage;
}
