import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enUS from "@/i18n/locales/en-US";
import zhCN from "@/i18n/locales/zh-CN";
import viVN from "@/i18n/locales/vi-VN";

export type AppLocale = "vi-VN" | "zh-CN" | "en-US";

const LOCALE_STORAGE_KEY = "infinite-canvas:locale";
const VI_MIGRATION_KEY = "infinite-canvas:vi-locale-ready";

// First load after this release switches existing installations to Vietnamese.
// Subsequent explicit language choices are remembered across reloads.
function initialLocale(): AppLocale {
    if (!localStorage.getItem(VI_MIGRATION_KEY)) {
        localStorage.setItem(VI_MIGRATION_KEY, "1");
        localStorage.setItem(LOCALE_STORAGE_KEY, "vi-VN");
        return "vi-VN";
    }
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored === "zh-CN" || stored === "en-US" || stored === "vi-VN" ? stored : "vi-VN";
}

i18n.use(initReactI18next).init({
    resources: {
        "zh-CN": { translation: zhCN },
        "en-US": { translation: enUS },
        "vi-VN": { translation: viVN },
    },
    lng: initialLocale(),
    fallbackLng: "en-US",
    supportedLngs: ["vi-VN", "zh-CN", "en-US"],
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
});

export function changeAppLocale(locale: AppLocale) {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    return i18n.changeLanguage(locale);
}

export default i18n;
