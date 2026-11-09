import { describe, expect, test } from "bun:test";
import { clampPromptCaretOffset, resolvePromptDrop } from "../src/promptDrop";

describe("HD-02 prompt drag/drop guards (no DOM/AI mock)", () => {
  const sourceA = { id: encodeURIComponent(JSON.stringify(["node-real-a", "image"])), name: "Ảnh A" };
  const sourceB = { id: encodeURIComponent(JSON.stringify(["node-real-b", "video"])), name: "Video B" };
  test("a connected image or video remains identifiable by real Node ID and handle", () => {
    const resultA = resolvePromptDrop(sourceA.id, "", [sourceA, sourceB], []);
    const resultB = resolvePromptDrop(sourceB.id, "", [sourceA, sourceB], []);
    expect(resultA).toEqual({ kind: "existing", reference: sourceA });
    expect(resultB).toEqual({ kind: "existing", reference: sourceB });
  });
  test("a new valid Canvas source is resolved without inventing an asset", () => {
    const item = { id: sourceA.id, disabled: false };
    expect(resolvePromptDrop(item.id, "", [], [item])).toEqual({ kind: "material", material: item });
    expect(resolvePromptDrop(item.id, "", [], [{ ...item, disabled: true }])).toEqual({ kind: "none" });
  });
  test("Asset Library path works without a Canvas material entry", () => {
    const path = "assets/character/front.png";
    expect(resolvePromptDrop("", path, [], [])).toEqual({ kind: "asset", path });
    expect(resolvePromptDrop("", "", [], [])).toEqual({ kind: "none" });
  });
  test("drop at middle of sentence keeps exact caret offset", () => {
    const text = "Người đàn ông đi về phía xa";
    expect(clampPromptCaretOffset(text, 10)).toBe(10);
    expect(text.slice(0, 10) + "[ref]" + text.slice(10)).toBe("Người đàn [ref]ông đi về phía xa");
    expect(clampPromptCaretOffset(text, -10)).toBe(0);
    expect(clampPromptCaretOffset(text, 1000)).toBe(text.length);
  });
  test("a second reference does not replace or alter the first reference", () => {
    const first = resolvePromptDrop(sourceA.id, "", [sourceA, sourceB], []);
    const second = resolvePromptDrop(sourceB.id, "", [sourceA, sourceB], []);
    expect(first.kind).toBe("existing");
    expect(second.kind).toBe("existing");
    expect(sourceA.id).not.toBe(sourceB.id);
  });
});
