<template>
  <el-dialog v-model="visible" title="Thư viện prompt tạo ảnh" width="min(1200px, calc(100vw - 24px))" alignCenter appendToBody class="promptLibraryDialog" destroyOnClose>
    <div class="promptLibraryLayout">
      <div class="promptLibraryToolbar">
        <el-select v-model="language" class="languageChoice" aria-label="Ngôn ngữ thư viện prompt">
          <el-option label="Tiếng Việt" value="vi" />
          <el-option label="Bản gốc" value="original" />
        </el-select>
        <el-input v-model="search" placeholder="Tìm tên, prompt, tác giả hoặc tag…" clearable aria-label="Tìm prompt" />
        <el-select v-model="sourceId" placeholder="Tất cả nguồn" clearable aria-label="Lọc nguồn">
          <el-option v-for="source in sources" :key="source.id" :label="`${source.name}${source.error ? ' (lỗi nguồn)' : ''}`" :value="source.id" />
          <el-option label="Kho cá nhân" value="personal" />
        </el-select>
        <el-select v-model="tag" placeholder="Tất cả tag" clearable filterable aria-label="Lọc tag">
          <el-option v-for="name in availableTags" :key="name" :value="name" :label="name" />
        </el-select>
        <el-button :loading="loading" @click="reload">Làm mới</el-button>
        <el-button @click="showSources = !showSources">{{ showSources ? 'Ẩn nguồn' : 'Quản lý nguồn' }}</el-button>
      </div>
      <p class="translationNote">Chế độ Tiếng Việt dịch tự động nội dung công khai và lưu cache. Nội dung bản gốc được giữ nguyên; prompt cá nhân không gửi đi dịch.</p>
      <div v-if="showSources" class="sourceManager">
        <strong>Các nguồn prompt JSON</strong>
        <div v-for="source in sources" :key="source.id" class="sourceLine">
          <el-switch :modelValue="source.enabled" :aria-label="'Bật nguồn '+source.name" @change="enabled => changeSource(source,Boolean(enabled))" />
          <span class="sourceLabel">{{ source.name }} <small v-if="source.error" class="errorText">{{ source.error }} · vẫn giữ dữ liệu cache cũ</small></span>
          <el-button size="small" :loading="refreshing === source.id" @click="refreshOne(source)">Cập nhật</el-button>
          <el-button v-if="!source.builtIn" size="small" type="danger" text @click="removeOne(source)">Xóa</el-button>
        </div>
        <div class="sourceAdd">
          <el-input v-model="newSourceName" aria-label="Tên nguồn mới" placeholder="Tên nguồn tùy chỉnh" />
          <el-input v-model="newSourceUrl" aria-label="URL JSON nguồn mới" placeholder="https://.../prompts.json" />
          <el-button :loading="adding" :disabled="!newSourceName.trim() || !newSourceUrl.trim()" @click="createSource">Thêm nguồn</el-button>
        </div>
      </div>
      <el-alert v-if="error" type="warning" :title="error" showIcon :closable="false"><el-button text size="small" @click="reload">Thử lại</el-button></el-alert>
      <div v-if="loading && !items.length" v-loading="loading" class="emptyState">Đang tải thư viện prompt thật từ các nguồn JSON…</div>
      <div v-else-if="!items.length" class="emptyState">Chưa có prompt phù hợp. Hãy thử bỏ bộ lọc hoặc làm mới nguồn.</div>
      <div v-else class="promptCards">
        <button v-for="item in items" :key="itemKey(item)" type="button" class="promptCard" @click="selected = item">
          <img v-if="item.coverUrl && !brokenImages.has(itemKey(item))" :src="item.coverUrl" :alt="item.title" loading="lazy" referrerpolicy="no-referrer" @error="brokenImages.add(itemKey(item))" />
          <span v-else class="brokenImage">Không có ảnh xem trước</span>
          <strong>{{ displayTitle(item) }}</strong>
          <small>{{ sourceLabel(item.sourceId) }} <span v-if="item.author">· {{ item.author }}</span></small>
          <span class="tags"><em v-for="name in item.tags.slice(0,3)" :key="name">{{ name }}</em></span>
        </button>
      </div>
      <div class="pagination"><small>{{ total.toLocaleString() }} mẫu · Trang {{ page }}</small><el-pagination v-model:currentPage="page" :pageSize="pageSize" :total="total" layout="prev, pager, next" background /></div>
    </div>
    <el-dialog v-model="detailVisible" :title="selected ? displayTitle(selected) : 'Chi tiết prompt'" width="min(800px, calc(100vw - 32px))" appendToBody alignCenter>
      <template v-if="selected">
        <div class="promptDetail">
          <div class="promptDetailMeta"><strong>{{ sourceLabel(selected.sourceId) }}</strong><span v-if="selected.author">Tác giả: {{ selected.author }}</span><span v-if="selected.imageModel">Model gợi ý: {{ selected.imageModel }} (không tự đổi model)</span><span v-if="selected.imageMode">Chế độ gợi ý: {{ selected.imageMode }}</span></div>
          <p v-if="displayDescription">{{ displayDescription }}</p>
          <el-alert v-if="translationError" type="warning" :title="translationError" :closable="false" showIcon />
          <span v-if="translatingDetail" role="status">Đang chuyển prompt sang tiếng Việt…</span>
          <el-input v-model="detailTitle" v-if="selected.personalId" aria-label="Tên prompt cá nhân" placeholder="Tiêu đề" />
          <el-input v-model="detailPrompt" type="textarea" :rows="8" aria-label="Nội dung prompt" />
          <template v-if="selected.personalId">
            <el-input v-model="detailDescription" type="textarea" :rows="2" aria-label="Mô tả prompt cá nhân" placeholder="Mô tả" />
            <el-input v-model="detailTags" aria-label="Tag prompt cá nhân" placeholder="Tag, phân cách bằng dấu phẩy" />
            <el-input v-model="detailCoverUrl" aria-label="URL ảnh bìa prompt cá nhân" placeholder="URL ảnh bìa HTTPS" />
            <el-input v-model="detailReferences" type="textarea" :rows="2" aria-label="Ảnh tham chiếu cá nhân" placeholder="Mỗi dòng một URL ảnh tham chiếu HTTPS" />
          </template>
          <div class="referenceGallery"><img v-for="url in selected.referenceImageUrls" :key="url" :src="url" alt="Ảnh tham chiếu từ nguồn prompt" loading="lazy" referrerpolicy="no-referrer" /></div>
          <div class="tags"><em v-for="name in selected.tags" :key="name">{{ name }}</em></div>
          <a v-if="selected.sourceUrl" :href="selected.sourceUrl" target="_blank" rel="noopener noreferrer">Xem nguồn gốc</a>
          <div class="detailActions">
            <el-button :disabled="translatingDetail" @click="copyPrompt">Sao chép prompt</el-button>
            <el-button @click="favoriteSelected">{{ favorited ? 'Bỏ yêu thích' : 'Yêu thích' }}</el-button>
            <el-button v-if="!selected.personalId" :disabled="translatingDetail" @click="clonePersonal">Lưu vào kho cá nhân</el-button>
            <el-button v-if="selected.personalId" @click="updatePersonal">Lưu chỉnh sửa</el-button>
            <el-button v-if="selected.personalId" type="danger" text @click="deletePersonal">Xóa bản cá nhân</el-button>
            <el-checkbox v-model="includeReferences" :disabled="!selected.referenceImageUrls.length">Thêm ảnh tham chiếu nếu node hỗ trợ</el-checkbox>
            <el-button type="primary" :disabled="translatingDetail" @click="useSelected">Dùng trên Canvas</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { loadPrompts, loadPromptSources, loadPromptTags, loadFavorites, saveFavorite, savePersonalPrompt, updatePersonalPrompt, deletePersonalPrompt, addSource, toggleSource, refreshSource, removeSource, itemKey, setPendingPrompt, translatePromptTitle, translatePromptItem, type PromptItem, type PromptSource } from "@/lib/promptLibrary";
const visible=defineModel<boolean>({default:false});
const props=defineProps<{ initialItem?: PromptItem; useMode?: "canvas" | "home" }>();
const emit=defineEmits<{ use: [item:PromptItem, references:boolean] }>();
const sources=ref<PromptSource[]>([]), items=ref<PromptItem[]>([]), favorites=ref<string[]>([]), tags=ref<{tag:string;count:number}[]>([]);
const search=ref(""), sourceId=ref(""), tag=ref(""), total=ref(0), page=ref(1), pageSize=24;
const loading=ref(false), error=ref(""), showSources=ref(false), adding=ref(false), refreshing=ref(""), newSourceName=ref(""), newSourceUrl=ref("");
const selected=ref<PromptItem>(), detailPrompt=ref(""), detailTitle=ref(""), detailDescription=ref(""), detailTags=ref(""), detailCoverUrl=ref(""), detailReferences=ref(""), includeReferences=ref(false), brokenImages=ref(new Set<string>());
const language=ref<"vi"|"original">("vi");
const translatedTitles=ref<Record<string,string>>({});
const translationError=ref("");
const translatingDetail=ref(false);
const translatedDescription=ref("");
let detailTranslationSerial=0;
let titleTranslationSerial=0;
function displayTitle(item:PromptItem){return language.value==="vi" ? translatedTitles.value[itemKey(item)] || item.title : item.title;}
const displayDescription=computed(()=>language.value==="vi" && !selected.value?.personalId ? translatedDescription.value || selected.value?.description || "" : selected.value?.personalId ? detailDescription.value : selected.value?.description || "");
async function translateVisibleTitles() {
  const run=++titleTranslationSerial;
  if(language.value!=="vi")return;
  const publicItems=items.value.filter(item=>item.sourceId!=="personal" && !translatedTitles.value[itemKey(item)]);
  let next=0;
  await Promise.all(Array.from({length:Math.min(3,publicItems.length)},async()=>{
    while(next<publicItems.length && run===titleTranslationSerial){
      const item=publicItems[next++]!;
      try {const result=await translatePromptTitle(item);if(run===titleTranslationSerial)translatedTitles.value[itemKey(item)]=result.title;}
      catch { /* Keep the actual source title when translation is unavailable. */ }
    }
  }));
}
async function translateSelected() {
  const run=++detailTranslationSerial;
  const item=selected.value;
  translationError.value="";translatedDescription.value="";
  if(!item || item.personalId || language.value!=="vi")return;
  translatingDetail.value=true;
  try{
    const result=await translatePromptItem(item);
    if(run!==detailTranslationSerial || selected.value!==item || language.value!=="vi")return;
    translatedTitles.value[itemKey(item)]=result.title;
    translatedDescription.value=result.description;
    detailPrompt.value=result.prompt;
  }catch(error){if(run===detailTranslationSerial)translationError.value=`Không dịch được mẫu này, đang hiển thị bản gốc: ${error instanceof Error?error.message:String(error)}`;}
  finally{if(run===detailTranslationSerial)translatingDetail.value=false;}
}
const detailVisible=computed({get:()=>!!selected.value,set:value=>{if(!value) selected.value=undefined;}});
const favorited=computed(()=>!!selected.value && favorites.value.includes(itemKey(selected.value)));
const availableTags=computed(()=>tags.value.map(x=>x.tag));
let serial=0;
function sourceLabel(id:string) { return id==="personal"?"Kho cá nhân":sources.value.find(s=>s.id===id)?.name||id; }
async function reload() {
  const request=++serial;loading.value=true;error.value="";
  try {
    const [s, p, f, allTags]=await Promise.all([loadPromptSources(), loadPrompts({search:search.value,sourceId:sourceId.value,tag:tag.value,page:page.value,limit:pageSize}),loadFavorites(),loadPromptTags()]);
    if(request!==serial)return;
    sources.value=s;items.value=p.items;total.value=p.total;favorites.value=f;tags.value=allTags;
    void translateVisibleTitles();
    const errors=s.filter(s=>s.error).map(s=>s.name).join(", ");
    if(errors)error.value=`Một số nguồn gặp lỗi: ${errors}. Dữ liệu đã lưu vẫn được hiển thị.`;
  }catch(e){if(request===serial)error.value=e instanceof Error?e.message:"Không tải được thư viện prompt.";}
  finally{if(request===serial)loading.value=false;}
}
watch([search,sourceId,tag],()=>{page.value=1;void reload();});watch(page,()=>void reload());
watch(visible,v=>{if(v){void reload();if(props.initialItem)selected.value=props.initialItem;} });
watch(()=>props.initialItem,item=>{if(item && visible.value)selected.value=item;},{immediate:true});
watch(selected,item=>{++detailTranslationSerial;translatingDetail.value=false;detailPrompt.value=item?.prompt||"";detailTitle.value=item?.title||"";detailDescription.value=item?.description||"";detailTags.value=item?.tags.join(", ")||"";detailCoverUrl.value=item?.coverUrl||"";detailReferences.value=item?.referenceImageUrls.join("\n")||"";includeReferences.value=false;void translateSelected();});
watch(language,()=>{
  if(language.value==="vi"){
    void translateVisibleTitles();
  }else ++titleTranslationSerial;
  if(selected.value){detailPrompt.value=selected.value.prompt;void translateSelected();}
});
onMounted(()=>{if(visible.value)void reload();});
async function changeSource(s:PromptSource,enabled:boolean){try{await toggleSource(s.id,enabled);await reload();}catch(e){ElMessage.error(String(e));}}
async function refreshOne(s:PromptSource){refreshing.value=s.id;try{await refreshSource(s.id);await reload();}catch(e){ElMessage.error(String(e));}finally{refreshing.value="";}}
async function createSource(){adding.value=true;try{await addSource({name:newSourceName.value.trim(),url:newSourceUrl.value.trim()});newSourceName.value="";newSourceUrl.value="";await reload();}catch(e){ElMessage.error(String(e));}finally{adding.value=false;}}
async function removeOne(s:PromptSource){try{await ElMessageBox.confirm(`Xóa nguồn tùy chỉnh ${s.name}?`,`Xóa nguồn`);await removeSource(s.id);await reload();}catch(e){if(e instanceof Error)ElMessage.error(e.message);}}
async function copyPrompt(){try{await navigator.clipboard.writeText(detailPrompt.value);ElMessage.success("Đã sao chép prompt");}catch{ElMessage.error("Không sao chép được prompt");}}
async function favoriteSelected(){if(!selected.value)return;try{favorites.value=await saveFavorite(selected.value,!favorited.value);}catch(e){ElMessage.error(String(e));}}
async function clonePersonal(){if(!selected.value || translatingDetail.value)return;try{selected.value=await savePersonalPrompt({...selected.value,title:displayTitle(selected.value),description:displayDescription.value,prompt:detailPrompt.value});ElMessage.success("Đã lưu bản sao cá nhân độc lập với nguồn.");await reload();}catch(e){ElMessage.error(String(e));}}
async function updatePersonal(){if(!selected.value?.personalId)return;try{selected.value=await updatePersonalPrompt({...selected.value,title:detailTitle.value,prompt:detailPrompt.value,description:detailDescription.value,tags:detailTags.value.split(",").map(tag=>tag.trim()).filter(Boolean),coverUrl:detailCoverUrl.value.trim(),referenceImageUrls:detailReferences.value.split("\n").map(url=>url.trim()).filter(Boolean)});ElMessage.success("Đã lưu chỉnh sửa");await reload();}catch(e){ElMessage.error(String(e));}}
async function deletePersonal(){if(!selected.value?.personalId)return;try{await ElMessageBox.confirm("Xóa bản prompt cá nhân này?","Xác nhận");await deletePersonalPrompt(selected.value.personalId);selected.value=undefined;await reload();}catch(e){if(e instanceof Error)ElMessage.error(e.message);}}
function useSelected(){if(!selected.value || translatingDetail.value)return;const item={...selected.value,title:displayTitle(selected.value),description:displayDescription.value,prompt:detailPrompt.value};setPendingPrompt(item,includeReferences.value);emit("use",item,includeReferences.value);window.dispatchEvent(new CustomEvent("macflow:prompt-template-use",{detail:{item,includeReferences:includeReferences.value}}));selected.value=undefined;visible.value=false;}
</script>
<style scoped>
.promptLibraryLayout{display:grid;gap:14px;min-height:250px;max-height:75dvh;overflow:auto;padding:3px}.promptLibraryToolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px}.promptLibraryToolbar .el-input{min-width:190px;flex:2}.promptLibraryToolbar .el-select{min-width:140px;flex:1}.promptLibraryToolbar .languageChoice{max-width:150px}.promptCards{display:grid;grid-template-columns:repeat(auto-fill,minmax(174px,1fr));gap:12px}.promptCard{min-width:0;border:1px solid var(--el-border-color);background:var(--el-bg-color);color:var(--el-text-color-primary);border-radius:12px;cursor:pointer;text-align:left;padding:9px;display:grid;align-content:start;gap:7px}.promptCard:hover,.promptCard:focus-visible{outline:2px solid var(--el-color-primary)}.promptCard img,.brokenImage{width:100%;height:135px;object-fit:cover;border-radius:8px;background:var(--el-fill-color-light)}.brokenImage{display:grid;place-items:center;color:var(--el-text-color-secondary);font-size:12px}.promptCard strong{overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;font-size:13px}.promptCard small{color:var(--el-text-color-secondary)}.tags{display:flex;gap:5px;flex-wrap:wrap}.tags em{font-style:normal;font-size:10px;background:var(--el-fill-color-light);border-radius:5px;padding:3px 5px}.pagination,.sourceLine,.sourceAdd,.detailActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.pagination{justify-content:space-between}.emptyState{min-height:150px;display:grid;place-items:center;color:var(--el-text-color-secondary)}.sourceManager{border:1px solid var(--el-border-color);padding:12px;border-radius:9px;display:grid;gap:8px}.sourceLine .sourceLabel{flex:1;min-width:150px}.sourceLabel small{display:block}.errorText{color:var(--el-color-warning)}.sourceAdd .el-input{flex:1;min-width:180px}.promptDetail{display:grid;gap:14px}.promptDetailMeta{display:flex;gap:12px;flex-wrap:wrap;color:var(--el-text-color-secondary);font-size:12px}.referenceGallery{display:flex;gap:10px;overflow-x:auto}.referenceGallery img{max-width:180px;max-height:170px;object-fit:contain;background:var(--el-fill-color-light);border-radius:8px}.detailActions{justify-content:flex-end}@media(max-width:650px){.promptLibraryToolbar>.el-input,.promptLibraryToolbar>.el-select{flex:1 1 100%}.promptCards{grid-template-columns:repeat(2,minmax(0,1fr))}.promptCard img,.brokenImage{height:110px}}
</style>
