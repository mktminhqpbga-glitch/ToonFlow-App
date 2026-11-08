import { normalizeLocale } from "@toonflow/i18n";

// Bản độc lập mặc định tiếng Việt; bản phân phối khác có thể đặt "system" hoặc một locale hợp lệ.
export const defaultLanguage = normalizeLocale(import.meta.env.VITE_TOONFLOW_DEFAULT_LOCALE ?? "vi") ?? "system";
