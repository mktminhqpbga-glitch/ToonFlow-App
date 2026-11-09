export type CharacterImage = { path: string; name: string; mimeType: string };
export type CharacterRecord = { id: string; name: string; description: string; images: CharacterImage[]; updatedAt: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const imageMime = /^image\/(png|jpeg|webp)$/;

export function parseCharacterRecords(value: unknown): CharacterRecord[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error("Thư viện nhân vật không hợp lệ");
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || !uuid.test(item.id)
      || typeof item.name !== "string" || !item.name.trim() || item.name.length > 120
      || typeof item.description !== "string" || item.description.length > 2000
      || typeof item.updatedAt !== "string" || !Number.isFinite(Date.parse(item.updatedAt))
      || !Array.isArray(item.images) || item.images.length > 9 || seen.has(item.id)) {
      throw new Error("Hồ sơ nhân vật không hợp lệ hoặc có ID bị trùng");
    }
    seen.add(item.id);
    for (const image of item.images) {
      if (!image || typeof image.path !== "string" || !image.path
        || !image.path.startsWith(`assets/${item.id}/`)
        || image.path.split("/").some((part: string) => !part || part === "." || part === "..")
        || typeof image.name !== "string" || !image.name || image.name.length > 255
        || typeof image.mimeType !== "string" || !imageMime.test(image.mimeType))
        throw new Error("Đường dẫn ảnh tham chiếu không hợp lệ");
    }
  }
  return value as CharacterRecord[];
}

export function upsertCharacter(records: readonly CharacterRecord[], next: CharacterRecord) {
  parseCharacterRecords([next]);
  const result = records.some(record => record.id === next.id)
    ? records.map(record => record.id === next.id ? next : record)
    : [...records, next];
  return parseCharacterRecords(result);
}

export function omitCharacter(records: readonly CharacterRecord[], id: string) {
  // Removes metadata only. The images remain in workspace and Canvas nodes.
  return records.filter(record => record.id !== id);
}
