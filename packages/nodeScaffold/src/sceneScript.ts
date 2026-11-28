type ProductPhoto = { name: string; path: string; mimeType: string; bytes: number };

export type SceneScriptProduct = { name: string; description: string; photos: ProductPhoto[] };

export type SceneScriptBridge = {
  batchLimit: number;
  pickProduct(signal: AbortSignal): Promise<SceneScriptProduct | undefined>;
  openVideoFlow(input: { scenes: string[]; product: string; photos: ProductPhoto[] }, signal: AbortSignal): Promise<void>;
};
