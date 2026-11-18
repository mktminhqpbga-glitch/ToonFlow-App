import { isMac } from "./platform";
import { t } from "@toonflow/i18n/vue";

const primaryModifier = isMac ? "Meta" : "Ctrl";
const modifiers = ["Ctrl", "Alt", "Shift", "Meta"];

export const defaultCanvasShortcuts = {
  group: `${primaryModifier}+KeyG / Alt+KeyG`,
  mergeGroup: isMac ? "Alt+Meta+KeyG" : "Ctrl+Alt+KeyG",
  ungroup: isMac ? "Shift+Meta+KeyG / Alt+Shift+KeyG" : "Ctrl+Shift+KeyG / Alt+Shift+KeyG",
  addNode: "Tab",
  copyOnDrag: "Alt",
  duplicateOnDrag: isMac ? "Alt+Meta" : "Ctrl+Alt",
  pan: "Space",
  zoom: "Ctrl",
  selection: "None",
  multiSelection: "",
  moveTool: "KeyV",
  handTool: "KeyH",
  arrange: "Alt+Shift+KeyF",
  search: `${primaryModifier}+KeyF`,
  delete: "Backspace",
  copy: `${primaryModifier}+KeyC`,
  paste: `${primaryModifier}+KeyV`,
  undo: `${primaryModifier}+KeyZ`,
  redo: isMac ? "Shift+Meta+KeyZ" : "Ctrl+Shift+KeyZ",
  zoomIn: isMac ? "Meta+Equal / Shift+Meta+Equal" : "Ctrl+Equal / Ctrl+Shift+Equal",
  zoomOut: `${primaryModifier}+Minus`,
  fitView: `${primaryModifier}+Digit0`,
};
export type CanvasShortcutAction = keyof typeof defaultCanvasShortcuts;
export type CanvasShortcuts = Record<CanvasShortcutAction, string>;

export const canvasShortcutFields: {
  id: CanvasShortcutAction;
  label: string;
  hold?: boolean;
  allowNone?: boolean;
  gesture?: "drag" | "wheel" | "click";
}[] = [
  { id: "group", label: "Nhóm" },
  { id: "mergeGroup", label: "Gộp nhóm" },
  { id: "ungroup", label: "Bỏ nhóm" },
  { id: "addNode", label: "Tạo node mới" },
  { id: "copyOnDrag", label: "Sao chép node", hold: true, gesture: "drag" },
  { id: "duplicateOnDrag", label: "Tạo bản sao", hold: true, gesture: "drag" },
  { id: "zoomIn", label: "Phóng to" },
  { id: "zoomOut", label: "Thu nhỏ" },
  { id: "fitView", label: "Vừa khung Canvas" },
  { id: "zoom", label: "Cuộn để thu phóng", hold: true, gesture: "wheel", allowNone: true },
  { id: "pan", label: "Kéo Canvas", hold: true, allowNone: true },
  { id: "selection", label: "Khoanh chọn node", hold: true, allowNone: true },
  { id: "multiSelection", label: "Thêm vào lựa chọn", hold: true, gesture: "click" },
  { id: "moveTool", label: "Di chuyển" },
  { id: "handTool", label: "Công cụ bàn tay" },
  { id: "arrange", label: "Sắp xếp Canvas" },
  { id: "undo", label: "Hoàn tác" },
  { id: "redo", label: "Làm lại" },
  { id: "search", label: "Tìm node Canvas" },
  { id: "delete", label: "Xóa" },
  { id: "copy", label: "Sao chép vào bảng nhớ tạm" },
  { id: "paste", label: "Dán" },
];

const keyLabels: Record<string, string> = {
  None: "Không cần phím",
  Ctrl: "Ctrl", Alt: "Alt", Shift: "Shift", Meta: isMac ? "⌘" : "Win",
  Space: "Space", Escape: "Esc", Enter: "Enter", Tab: "Tab", Backspace: "⌫", Delete: "Delete",
  ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓",
  Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown", Insert: "Insert",
  Minus: "−", Equal: "+", BracketLeft: "[", BracketRight: "]", Backslash: "\\",
  Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backquote: "`",
  CapsLock: "CapsLock", NumLock: "NumLock", ScrollLock: "ScrollLock", Pause: "Pause", PrintScreen: "PrintScreen",
  NumpadAdd: "Bàn phím số +", NumpadSubtract: "Bàn phím số -", NumpadMultiply: "Bàn phím số *", NumpadDivide: "Bàn phím số /",
  NumpadDecimal: "Bàn phím số .", NumpadEnter: "Bàn phím số Enter", NumpadEqual: "Bàn phím số =",
};

export function normalizeShortcut(value: string): string | undefined {
  if (!value.trim()) return "";
  const bindings = value.split("/").map(normalizeBinding);
  if (bindings.some(binding => binding === undefined)) return;
  return [...new Set(bindings)].join(" / ");
}

function normalizeBinding(value: string): string | undefined {
  if (value.trim() === "None") return "None";
  const parts = value.split("+").map(part => part.trim());
  if (parts.includes("None")) return;
  if (new Set(parts).size !== parts.length) return;
  const keys = parts.filter(part => !modifiers.includes(part));
  if (keys.length > 1 || keys.some(key => !Object.hasOwn(keyLabels, key) && !/^(?:Key[A-Z]|Digit\d|Numpad\d|F(?:[1-9]|1\d|2[0-4]))$/.test(key))) return;
  return [...modifiers.filter(modifier => parts.includes(modifier)), ...keys].join("+");
}

export function getShortcutBindings(binding: string) {
  return binding.split("/").map(value => value.trim()).filter(Boolean);
}

export function isModifierShortcut(binding: string) {
  return !!binding && binding.split("+").every(part => modifiers.includes(part));
}

export function isShortcutAllowed(field: typeof canvasShortcutFields[number], binding: string) {
  return getShortcutBindings(binding).every(value => value === "None" ? field.allowNone === true : field.gesture === "drag" || field.gesture === "click"
    ? isModifierShortcut(value) : field.hold || !isModifierShortcut(value));
}

export function shortcutFromEvent(event: KeyboardEvent) {
  const modifier = ["Control", "Alt", "Shift", "Meta"].includes(event.key);
  return [event.ctrlKey && "Ctrl", event.altKey && "Alt", event.shiftKey && "Shift", event.metaKey && "Meta", !modifier && event.code]
    .filter(Boolean).join("+");
}

export function shortcutMatches(event: KeyboardEvent, binding: string) {
  return !!binding && event.type !== "keyup" && getShortcutBindings(binding).includes(shortcutFromEvent(event));
}

export function shortcutPressed(event: Pick<KeyboardEvent, "ctrlKey" | "altKey" | "shiftKey" | "metaKey">, binding: string, pressedCodes: ReadonlySet<string>) {
  return getShortcutBindings(binding).some(value => {
    if (value === "None") return true;
    const parts = value.split("+");
    if (event.ctrlKey !== parts.includes("Ctrl") || event.altKey !== parts.includes("Alt")
      || event.shiftKey !== parts.includes("Shift") || event.metaKey !== parts.includes("Meta")) return false;
    const key = parts.find(part => !modifiers.includes(part));
    return !key || pressedCodes.has(key);
  });
}

export function shortcutLabel(binding: string) {
  return getShortcutBindings(binding).map(value => value.split("+")
    .map(part => keyLabels[part] ?? (part.startsWith("Numpad") ? t`小键盘 ${part.slice(6)}` : part.replace(/^(?:Key|Digit)/, ""))).join(" + ")).join(" / ");
}
