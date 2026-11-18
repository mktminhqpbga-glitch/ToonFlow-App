import { shallowRef } from "vue";
import * as core from "./index";
export { supportedLocales, normalizeLocale, detectLocale, msg } from "./index";
export type { Locale, MessageDescriptor } from "./index";

export const locale = shallowRef<core.Locale>(core.getLocale());
core.subscribeLocale(value => { locale.value = value; });
export function setLocale(value: core.Locale) { core.setLocale(value); }
export function translate(message: string | core.MessageDescriptor, values?: Record<string, unknown>) {
  return core.translate(message, values, locale.value);
}
export function t(strings: TemplateStringsArray, ...values: unknown[]) {
  return translate(core.msg(strings, ...values));
}

/** Dịch nhãn form động; field, value và các điều kiện chọn giữ nguyên. */
export function translateFormRules<T>(rules: readonly T[]): T[] {
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
  return rules.map(rule => {
    if (!record(rule)) return rule;
    const next: Record<string, unknown> = { ...rule };
    for (const key of ["title", "label", "info", "help"]) {
      if (typeof next[key] === "string") next[key] = translate(next[key]);
    }
    if (record(next.props)) {
      const props = { ...next.props };
      for (const key of ["placeholder", "title", "activeText", "inactiveText", "emptyText", "noDataText"]) {
        if (typeof props[key] === "string") props[key] = translate(props[key]);
      }
      next.props = props;
    }
    if (Array.isArray(next.options)) next.options = next.options.map(option => record(option) && typeof option.label === "string"
      ? { ...option, label: translate(option.label) } : option);
    if (Array.isArray(next.validate)) next.validate = next.validate.map(validation => record(validation) && typeof validation.message === "string"
      ? { ...validation, message: translate(validation.message) } : validation);
    if (Array.isArray(next.children)) next.children = next.children.map(child => typeof child === "string" ? translate(child) : translateFormRules([child])[0]);
    if (Array.isArray(next.control)) next.control = next.control.map(control => record(control) && Array.isArray(control.rule)
      ? { ...control, rule: translateFormRules(control.rule) } : control);
    return next as T;
  });
}
