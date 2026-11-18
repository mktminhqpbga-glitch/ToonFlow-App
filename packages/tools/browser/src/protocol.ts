import { z } from "zod";

const webUrl = z.url().refine(value => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
}, "Chỉ hỗ trợ địa chỉ HTTP/HTTPS không chứa tài khoản hoặc mật khẩu").describe("Địa chỉ web HTTP/HTTPS dùng cho open, navigate hoặc newTab");
const sessionFields = { browserSessionId: z.uuid().optional().describe("ID phiên trình duyệt đã trả về trước đó trong cùng cuộc trò chuyện; bỏ trống để dùng lại phiên hiện tại") };
const ref = z.string().min(1).max(100).describe("Tham chiếu phần tử từ snapshot gần nhất; chụp lại snapshot sau khi trang thay đổi");
const offset = z.number().int().min(0).default(0).describe("Vị trí bắt đầu phân trang của snapshot, read hoặc tabs, mặc định 0; tiếp tục với nextOffset được trả về");
const tabId = z.string().min(1).max(100).describe("ID tab do tabs trả về; closeTab bỏ trống để đóng tab hiện tại");

export const browserConfigSchema = z.strictObject({
  executablePath: z.string().trim().max(4096).default(""),
});

export const browserActionSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("open"), ...sessionFields, url: webUrl.optional() }),
  z.strictObject({ action: z.literal("navigate"), ...sessionFields, url: webUrl }),
  z.strictObject({ action: z.literal("snapshot"), ...sessionFields, offset }),
  z.strictObject({ action: z.literal("read"), ...sessionFields, offset }),
  z.strictObject({ action: z.literal("click"), ...sessionFields, ref }),
  z.strictObject({ action: z.literal("hover"), ...sessionFields, ref }),
  z.strictObject({ action: z.literal("type"), ...sessionFields, ref, text: z.string().max(20000).describe("Văn bản đầy đủ cần điền bằng thao tác type") }),
  z.strictObject({ action: z.literal("pressKey"), ...sessionFields, key: z.string().min(1).max(50).describe("Tên phím theo Puppeteer, ví dụ Enter, Tab, Escape, Backspace") }),
  z.strictObject({ action: z.literal("scroll"), ...sessionFields, direction: z.enum(["up", "down", "left", "right"]).describe("Hướng cuộn cho scroll"), amount: z.number().int().min(1).max(10000).default(600).describe("Khoảng cách cuộn tính bằng pixel, mặc định 600") }),
  z.strictObject({ action: z.literal("screenshot"), ...sessionFields }),
  z.strictObject({ action: z.literal("tabs"), ...sessionFields, offset }),
  z.strictObject({ action: z.literal("newTab"), ...sessionFields, url: webUrl.optional() }),
  z.strictObject({ action: z.literal("selectTab"), ...sessionFields, tabId }),
  z.strictObject({ action: z.literal("closeTab"), ...sessionFields, tabId: tabId.optional() }),
  z.strictObject({ action: z.literal("close"), ...sessionFields }),
]);

export type BrowserAction = z.infer<typeof browserActionSchema>;
export type BrowserConfig = z.infer<typeof browserConfigSchema>;
const pointerFields = { x: z.number().min(0).max(100000), y: z.number().min(0).max(100000) };
const button = z.enum(["left", "right", "middle"]).default("left");
const clickCount = z.union([z.literal(1), z.literal(2)]).default(1);
const modifiers = z.array(z.enum(["Alt", "Control", "Meta", "Shift"])).max(4).optional();
export const browserInputSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("mouse"), event: z.enum(["move", "down", "up"]), x: z.number().min(-100000).max(100000), y: z.number().min(-100000).max(100000), button, clickCount, modifiers }),
  z.strictObject({ type: z.literal("click"), ...pointerFields, button, clickCount, modifiers }),
  z.strictObject({ type: z.literal("wheel"), ...pointerFields, deltaX: z.number().min(-10000).max(10000), deltaY: z.number().min(-10000).max(10000), modifiers }),
  z.strictObject({ type: z.literal("key"), key: z.string().min(1).max(50), event: z.enum(["down", "up", "press"]).default("press"), modifiers }),
  z.strictObject({ type: z.literal("text"), text: z.string().min(1).max(20000) }),
  z.strictObject({ type: z.literal("release") }),
  z.strictObject({ type: z.literal("navigate"), url: webUrl }),
  z.strictObject({ type: z.literal("back") }),
  z.strictObject({ type: z.literal("forward") }),
  z.strictObject({ type: z.literal("reload") }),
]);
export type BrowserInput = z.input<typeof browserInputSchema>;
export type BrowserSessionState = {
  browserSessionId: string;
  tabId: string;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  status: "running" | "closed";
};
export type BrowserStreamEvent =
  | { type: "state"; session: BrowserSessionState }
  | { type: "frame"; sessionId: string; tabId: string; data: string; mimeType: "image/jpeg"; width: number; height: number }
  | { type: "closed"; sessionId: string }
  | { type: "error"; message: string };
