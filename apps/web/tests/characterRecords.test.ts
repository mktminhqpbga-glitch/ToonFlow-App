import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, writeAtomic } from "@toonflow/file";
import { omitCharacter, parseCharacterRecords, upsertCharacter, type CharacterRecord } from "../src/pages/workspace/panels/canvas/characterRecords";

const id = "9ce3ecb1-c3f4-42f1-b58b-3528a5ebfbb4";
const base = (): CharacterRecord => ({
  id, name: "Nhân vật A", description: "Áo xanh",
  updatedAt: "2026-11-09T00:00:00.000Z",
  images: [{ path: `assets/${id}/front.png`, name: "front.png", mimeType: "image/png" }],
});

describe("HD-04 character persistence with actual disk snapshot", () => {
  test("write, read, update and reload preserve character ID and one fixed reference set", async () => {
    const root = mkdtempSync(join(tmpdir(), "toonflow-characters-"));
    try {
      const path = join(root, "index.json");
      await writeAtomic(path, JSON.stringify([base()]));
      let records = parseCharacterRecords(JSON.parse(await readFile(path, "utf8")));
      expect(records[0]?.id).toBe(id);
      records = upsertCharacter(records, { ...records[0]!, name: "Nhân vật đã sửa", description: "Áo đỏ" });
      expect(records).toHaveLength(1);
      expect(records[0]?.images).toEqual(base().images);
      await writeAtomic(path, JSON.stringify(records));
      const reopened = parseCharacterRecords(JSON.parse(await readFile(path, "utf8")));
      expect(reopened[0]?.name).toBe("Nhân vật đã sửa");
      expect(reopened[0]?.id).toBe(id);
      expect(reopened[0]?.images).toHaveLength(1);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  test("deleting character metadata must not destroy underlying asset", async () => {
    const root = mkdtempSync(join(tmpdir(), "toonflow-char-safe-"));
    try {
      const assetDirectory = join(root, "assets", id);
      mkdirSync(assetDirectory, { recursive: true });
      const asset = join(assetDirectory, "front.png");
      writeFileSync(asset, "test-only-image-placeholder");
      expect(omitCharacter([base()], id)).toEqual([]);
      expect(existsSync(asset)).toBe(true);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  test("invalid or duplicate records reject rather than overwrite existing metadata", () => {
    expect(() => parseCharacterRecords([base(), base()])).toThrow();
    expect(() => parseCharacterRecords([{ ...base(), id: "not-a-uuid" }])).toThrow();
    expect(() => parseCharacterRecords([{ ...base(), images: [{ ...base().images[0]!, path: `assets/${id}/../private.png` }] }])).toThrow();
    expect(() => parseCharacterRecords([{ ...base(), images: [{ ...base().images[0]!, mimeType: "text/html" }] }])).toThrow();
    expect(() => parseCharacterRecords([{ ...base(), images: Array(10).fill(base().images[0]) }])).toThrow();
  });
});
