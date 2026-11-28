import type { SceneScriptProduct } from "@toonflow/nodes-scaffold/runtime";

export type SceneScriptState = {
  manifest: string;
  subject: string;
  product?: SceneScriptProduct;
  included: number[];
  scenes: Record<number, { notes: string; dialogue: string; prompt: string }>;
};
