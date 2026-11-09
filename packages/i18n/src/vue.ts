import { shallowRef } from "vue";
import * as core from "./index";
export { supportedLocales, normalizeLocale, detectLocale, msg } from "./index";
export type { Locale, MessageDescriptor } from "./index";

export const locale = shallowRef<core.Locale>(core.getLocale());
core.subscribeLocale(value => { locale.value = value; });
/**
 * Built-in media nodes are independently bundled. Their own i18n singleton must
 * follow the host document's chosen language, including changes after mounting.
 * Only UI locale is synchronized, never node data, provider IDs or user prompts.
 */
if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
  const syncDocumentLanguage = () => {
    const language = core.normalizeLocale(document.documentElement.lang);
    if (language && core.getLocale() !== language) core.setLocale(language);
  };
  syncDocumentLanguage();
  new MutationObserver(syncDocumentLanguage).observe(document.documentElement, {
    attributes: true, attributeFilter: ["lang"],
  });
}

export function setLocale(value: core.Locale) { core.setLocale(value); }
export function translate(message: string | core.MessageDescriptor, values?: Record<string, unknown>) {
  return core.translate(message, values, locale.value);
}
export function t(strings: TemplateStringsArray, ...values: unknown[]) {
  return translate(core.msg(strings, ...values));
}
