// Stateless selection rules for real Canvas/Asset-Library drag data.
// No text or reference ID is fabricated by this module.
export function resolvePromptDrop<T extends { id: string }, M extends { id: string; disabled?: boolean }>(
  materialId: string, assetPath: string,
  references: readonly T[], materials: readonly M[],
): { kind: "existing"; reference: T } | { kind: "material"; material: M } | { kind: "asset"; path: string } | { kind: "none" } {
  const existing = references.find(item => item.id === materialId);
  if (existing) return { kind: "existing", reference: existing };
  const material = materials.find(item => item.id === materialId && !item.disabled);
  if (material) return { kind: "material", material };
  if (assetPath) return { kind: "asset", path: assetPath };
  return { kind: "none" };
}

export function clampPromptCaretOffset(text: string, offset: number) {
  return Math.min(text.length, Math.max(0, Number.isFinite(offset) ? Math.floor(offset) : text.length));
}
