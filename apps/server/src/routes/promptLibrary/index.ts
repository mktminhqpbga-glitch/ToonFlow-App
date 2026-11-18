import { Router } from "express";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { assertAppRequest } from "@/utils/mcp/control";
import conf from "@/utils/conf";
import { loadSources, saveSources, loadCatalog, cachedItems, refreshSource, personalItems, savePersonal, favorites, saveFavorites, promptKey, normalizePrompt, validateSourceUrl, type PromptItem, type PromptSource } from "@/utils/promptLibrary";
import { translateTitle, translatePublicItem } from "@/utils/promptLibrary/translate";
const router = Router();
router.use((req,_res,next) => { try {
  assertAppRequest(req);
  if (conf.get("settings", {}).multiTenantEnabled === true) throw Object.assign(new Error("Thư viện prompt chỉ dùng cục bộ."), { status: 403 });
  next();
} catch(e) { next(e); } });
const body = z.object({ title: z.string().min(1).max(300), prompt: z.string().min(1).max(200000), description: z.string().max(8000).optional(), coverUrl: z.string().max(3000).optional(), referenceImageUrls: z.array(z.string().max(3000)).max(16).optional(), tags: z.array(z.string().max(150)).max(30).optional(), author: z.string().max(250).optional(), sourceUrl: z.string().max(3000).optional(), imageModel: z.string().max(160).optional(), imageMode: z.string().max(160).optional(), originalKey: z.string().max(700).optional() });
const translationId = z.object({ sourceId: z.string().min(1).max(150), id: z.string().min(1).max(250) });
async function findPublicPrompt(sourceId: string, id: string) {
  if (sourceId === "personal") throw Object.assign(new Error("Không tự động gửi bản lưu cá nhân đến dịch vụ dịch công khai."), { status: 403 });
  const sources = await loadSources();
  const source = sources.find(source => source.id === sourceId && source.enabled);
  if (!source) throw Object.assign(new Error("Nguồn prompt không khả dụng."), { status: 404 });
  const item = (await cachedItems(source)).find(item => item.id === id);
  if (!item) throw Object.assign(new Error("Không tìm thấy prompt nguồn."), { status: 404 });
  return item;
}
router.post("/translate/title", async (req,res) => {
  const target = translationId.parse(req.body);
  const item = await findPublicPrompt(target.sourceId, target.id);
  const title = await translateTitle(item);
  res.set("Cache-Control", "private, no-store").json(success({ title }));
});
router.post("/translate/item", async (req,res) => {
  const target = translationId.parse(req.body);
  const item = await findPublicPrompt(target.sourceId, target.id);
  const fields = await translatePublicItem(item);
  res.set("Cache-Control", "private, no-store").json(success(fields));
});
router.get("/sources", async (_req,res) => { const sources = await loadCatalog(); res.json(success(sources)); });
router.post("/sources", async (req,res) => {
  const v = z.object({ name: z.string().min(1).max(140), url: z.url().max(2000), homepage: z.url().optional() }).parse(req.body);
  const url = await validateSourceUrl(v.url);
  const sources = await loadSources();
  if (sources.some(s => s.url === url)) throw Object.assign(new Error("Nguồn JSON này đã tồn tại."), { status: 409 });
  const source: PromptSource = { id: crypto.randomUUID(), name: v.name.trim(), url, homepage: v.homepage || url, builtIn: false, enabled: true };
  await saveSources([...sources, source]); await refreshSource(source, true);
  res.json(success(source));
});
router.patch("/sources/:id", async (req,res) => {
  const v = z.object({ enabled: z.boolean().optional(), name: z.string().min(1).max(140).optional(), url: z.url().max(2000).optional() }).parse(req.body);
  const sources = await loadSources(); const source = sources.find(s => s.id === req.params.id);
  if (!source) throw Object.assign(new Error("Không tìm thấy nguồn."), { status: 404 });
  if (v.name && !source.builtIn) source.name = v.name;
  if (v.url && !source.builtIn) source.url = await validateSourceUrl(v.url);
  if (v.enabled !== undefined) source.enabled = v.enabled;
  await saveSources(sources); res.json(success(source));
});
router.post("/sources/:id/refresh", async (req,res) => {
  const sources = await loadSources(); const source = sources.find(s => s.id === req.params.id);
  if (!source) throw Object.assign(new Error("Không tìm thấy nguồn."), { status: 404 });
  await refreshSource(source, true); res.json(success(source));
});
router.delete("/sources/:id", async (req,res) => {
  const sources = await loadSources(); const source = sources.find(s => s.id === req.params.id);
  if (!source || source.builtIn) throw Object.assign(new Error("Chỉ có thể xóa nguồn tùy chỉnh."), { status: 400 });
  await saveSources(sources.filter(s => s.id !== source.id)); res.json(success(true));
});
router.get("/tags", async (_req,res) => {
  const sources=await loadCatalog();
  const cached=await Promise.all(sources.filter(s=>s.enabled).map(cachedItems));
  const all=[...cached.flat(),...await personalItems()];
  const counts=new Map<string,number>();
  for(const item of all) for(const tag of item.tags) counts.set(tag,(counts.get(tag)||0)+1);
  res.json(success([...counts.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0])).map(([tag,count])=>({tag,count}))));
});
router.get("/items", async (req,res) => {
  const q = z.object({ search: z.string().max(200).optional(), sourceId: z.string().max(150).optional(), tag: z.string().max(150).optional(), page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).default(24), personal: z.enum(["all","yes","no"]).default("all") }).parse(req.query);
  const sources = await loadCatalog();
  const datasets = await Promise.all(sources.filter(s=>s.enabled).map(cachedItems));
  let items = [...datasets.flat(), ...(q.personal === "no" ? [] : await personalItems())];
  if (q.personal === "yes") items = items.filter(i => !!i.personalId);
  if (q.sourceId) items = items.filter(i => i.sourceId === q.sourceId);
  if (q.tag) items = items.filter(i => i.tags.some(tag => tag.toLocaleLowerCase() === q.tag!.toLocaleLowerCase()));
  if (q.search) { const needle = q.search.toLocaleLowerCase(); items = items.filter(i => [i.title, i.prompt, i.description, i.tags.join(" "), i.author].some(s=>s.toLocaleLowerCase().includes(needle))); }
  const total = items.length; const start = (q.page-1)*q.limit;
  res.json(success({ items: items.slice(start,start+q.limit), total, page: q.page, limit: q.limit }));
});
router.get("/favorites", async (_req,res) => res.json(success(await favorites())));
router.post("/favorites", async (req,res) => {
  const v = z.object({ sourceId: z.string().max(150), id: z.string().max(250), favorite: z.boolean() }).parse(req.body);
  const set = new Set(await favorites()); const key = promptKey(v);
  v.favorite ? set.add(key) : set.delete(key);
  await saveFavorites([...set]); res.json(success([...set]));
});
router.get("/personal", async (_req,res) => res.json(success(await personalItems())));
router.post("/personal", async (req,res) => {
  const v = body.parse(req.body); const personalId = crypto.randomUUID();
  const item = normalizePrompt("personal", { ...v, id:personalId }, 0)!;
  item.personalId = personalId; item.originalKey = v.originalKey || "";
  const all = await personalItems(); await savePersonal([...all,item]); res.json(success(item));
});
router.put("/personal/:id", async (req,res) => {
  const v = body.parse(req.body); const all=await personalItems(); const at=all.findIndex(p=>p.personalId===req.params.id);
  if(at<0) throw Object.assign(new Error("Không tìm thấy bản lưu cá nhân."), { status:404 });
  const old=all[at]!; const updated=normalizePrompt("personal",{...v,id:old.id},0)!;
  all[at]={...updated,personalId:old.personalId,originalKey:old.originalKey}; await savePersonal(all); res.json(success(all[at]));
});
router.delete("/personal/:id", async (req,res) => {
  const all=await personalItems(); await savePersonal(all.filter(p=>p.personalId!==req.params.id)); res.json(success(true));
});
export default router;
