/** Shared prompt catalog contract for home, assets and Canvas. */
export type PromptItem = {
  sourceId: string; id: string; title: string; prompt: string; description: string; coverUrl: string;
  referenceImageUrls: string[]; tags: string[]; author: string; sourceUrl: string;
  imageModel: string; imageMode: string; createdAt: string; personalId?: string; originalKey?: string;
};
export type PromptSource = { id: string; name: string; url: string; homepage: string; enabled: boolean; builtIn: boolean; error?: string; count?: number; updatedAt?: string };
export type PromptPage = { items: PromptItem[]; total: number; page: number; limit: number };
export const itemKey = (p: Pick<PromptItem,"sourceId" | "id">) => JSON.stringify([p.sourceId,p.id]);
export async function promptRequest<T>(path: string, method = "GET", data?: object): Promise<T> {
  const response = await fetch(`/api/promptLibrary/${path}`, { method, cache: "no-store",
    headers: { "Content-Type": "application/json", "x-toonflow-workspace": "1" },
    ...(data ? {body: JSON.stringify(data)} : {}) });
  const payload = await response.json() as { data?: T; code?: number; message?: string };
  if (!response.ok || payload.code !== 200 || payload.data === undefined)
    throw new Error(payload.message || `Không thể tải thư viện prompt (HTTP ${response.status}).`);
  return payload.data;
}
export const loadPromptSources = () => promptRequest<PromptSource[]>("sources");
export type VietnamesePromptFields = { title: string; description: string; prompt: string };
export const translatePromptTitle = (item: PromptItem) => promptRequest<{title:string}>("translate/title", "POST", {sourceId:item.sourceId,id:item.id});
export const translatePromptItem = (item: PromptItem) => promptRequest<VietnamesePromptFields>("translate/item", "POST", {sourceId:item.sourceId,id:item.id});
export const loadPromptTags = () => promptRequest<{tag:string;count:number}[]>("tags");
export const loadPrompts = (options: { search?: string; sourceId?: string; tag?: string; page?: number; limit?: number; personal?: string } = {}) => {
  const query = new URLSearchParams(Object.entries(options).filter(([,v])=>v!==undefined && v!=="").map(([k,v])=>[k,String(v)]));
  return promptRequest<PromptPage>(`items?${query}`);
};
export const loadFavorites = () => promptRequest<string[]>("favorites");
export const saveFavorite = (p: PromptItem, favorite: boolean) => promptRequest<string[]>("favorites","POST",{sourceId:p.sourceId,id:p.id,favorite});
export const savePersonalPrompt = (p: PromptItem) => promptRequest<PromptItem>("personal", "POST", {
  title:p.title, prompt:p.prompt, description:p.description, coverUrl:p.coverUrl,
  referenceImageUrls:p.referenceImageUrls, tags:p.tags, author:p.author, sourceUrl:p.sourceUrl,
  imageModel:p.imageModel, imageMode:p.imageMode, originalKey:p.originalKey || itemKey(p),
});
export const updatePersonalPrompt = (p: PromptItem) => promptRequest<PromptItem>(`personal/${p.personalId}`, "PUT", p);
export const deletePersonalPrompt = (id: string) => promptRequest<boolean>(`personal/${id}`,"DELETE");
export const addSource = (data: { name:string; url:string }) => promptRequest<PromptSource>("sources","POST",data);
export const toggleSource = (id: string, enabled: boolean) => promptRequest<PromptSource>(`sources/${id}`,"PATCH",{enabled});
export const refreshSource = (id: string) => promptRequest<PromptSource>(`sources/${id}/refresh`,"POST");
export const removeSource = (id: string) => promptRequest<boolean>(`sources/${id}`,"DELETE");

const pendingName = "macflow:pending-image-prompt";
export function setPendingPrompt(item: PromptItem, includeReferences = false) {
  sessionStorage.setItem(pendingName, JSON.stringify({ item, includeReferences }));
  window.dispatchEvent(new CustomEvent("macflow:pending-image-prompt"));
}
export function getPendingPrompt(): { item: PromptItem; includeReferences: boolean } | undefined {
  try { const raw=sessionStorage.getItem(pendingName); return raw ? JSON.parse(raw) as { item: PromptItem; includeReferences: boolean } : undefined; }
  catch { return undefined; }
}
export function clearPendingPrompt() { sessionStorage.removeItem(pendingName); }
