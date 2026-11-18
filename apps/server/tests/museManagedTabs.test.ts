import { describe, expect, test } from "bun:test";

const documentToken = "123e4567-e89b-42d3-a456-426614174031";
const requestId = "123e4567-e89b-42d3-a456-426614174032";

describe("Extension manages exactly five Muse tabs (Chrome mock; no browser launched)", () => {
  test("creates once, persists own IDs, reports before ACK, then reuses/repairs", async () => {
    const tabs = new Map<number, { id: number; url: string; title: string; windowId: number; index: number }>();
    const local: Record<string, unknown> = {};
    const sent: Array<Record<string, unknown>> = [];
    let seq = 20, creates = 0;
    const url = "https://muse.ai/thread/new";
    const chromeMock = {
      runtime: { id: "test-extension", onMessage: { addListener: (_listener: unknown) => {} } },
      storage: { local: {
        get: async (keys: string | string[]) => Object.fromEntries(
          (Array.isArray(keys) ? keys : [keys]).map(key => [key, local[key]])),
        set: async (values: Record<string, unknown>) => { Object.assign(local, values); },
        remove: async (keys: string | string[]) => { for (const key of Array.isArray(keys) ? keys : [keys]) delete local[key]; },
      } },
      tabs: {
        create: async (value: { url: string; active: boolean }) => {
          expect(value).toEqual({ url, active: false });
          const id = ++seq;
          const tab = { id, url, title: "Muse", windowId: 1, index: id };
          tabs.set(id, tab); creates++;
          return tab;
        },
        get: async (id: number) => {
          const tab = tabs.get(id);
          if (!tab) throw new Error(`No tab with id: ${id}`);
          return tab;
        },
        query: async () => [...tabs.values()],
        sendMessage: async (id: number) => {
          if (!tabs.has(id)) throw new Error("Tab does not exist");
          return { documentToken, url, capable: true, ready: true, busy: false,
            outputKinds: ["text", "image", "video", "audio"] };
        },
      },
      scripting: { executeScript: async () => {} },
    };
    const previous = (globalThis as any).chrome;
    (globalThis as any).chrome = chromeMock;
    try {
      const transport = await import("../../../packages/chromeExtension/museTransport.js");
      const connection = { readyState: WebSocket.OPEN, send: (raw: string) => { sent.push(JSON.parse(raw)); } };
      transport.bindMuseConnection(connection);
      async function manage(id: string) {
        transport.handleMuseMessage({ type: "manageMuseTabs", requestId: id, count: 5 }, connection);
        for (let tick = 0; tick < 200; tick++) {
          if (sent.some(item => item.type === "museTabsManaged" && item.requestId === id)) break;
          await Bun.sleep(5);
        }
        const ack = sent.find(item => item.type === "museTabsManaged" && item.requestId === id);
        expect(ack).toBeDefined();
        expect(ack?.error).toBeUndefined();
        expect(ack?.tabIds).toHaveLength(5);
        const ackIndex = sent.indexOf(ack!);
        expect(sent.slice(0, ackIndex).some(item =>
          item.type === "tabStatus" && Array.isArray(item.managedMuseTabIds)
          && item.managedMuseTabIds.length === 5)).toBe(true);
        return ack;
      }
      const first = await manage(requestId);
      expect(creates).toBe(5);
      expect(local.managedMuseTabIds).toEqual(first?.tabIds);
      const second = await manage("123e4567-e89b-42d3-a456-426614174033");
      expect(second?.tabIds).toEqual(first?.tabIds);
      expect(creates).toBe(5); // A new task never creates a new tab.
      const removed = (first?.tabIds as number[])[0]!;
      tabs.delete(removed);
      const repaired = await manage("123e4567-e89b-42d3-a456-426614174034");
      expect(creates).toBe(6);
      expect(repaired?.tabIds).toHaveLength(5);
      expect((repaired?.tabIds as number[])).not.toContain(removed);
    } finally {
      (globalThis as any).chrome = previous;
    }
  });
});
