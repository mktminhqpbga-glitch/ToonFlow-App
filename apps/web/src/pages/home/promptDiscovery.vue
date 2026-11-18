<template>
  <section class="homePromptDiscovery" aria-label="Khám phá prompt tạo ảnh">
    <header class="homePromptHeader">
      <div><h2>Khám phá prompt</h2><p>Thử các mẫu tạo ảnh từ cộng đồng, có ghi rõ tác giả và nguồn.</p></div>
      <el-button type="primary" plain @click="openAll">Xem tất cả</el-button>
    </header>
    <el-alert v-if="error" type="warning" :title="error" :closable="false" showIcon><el-button size="small" text @click="load">Thử lại</el-button></el-alert>
    <div v-if="loading" v-loading="loading" class="promptDiscoverEmpty">Đang tải mẫu từ thư viện thật…</div>
    <div v-else-if="!items.length" class="promptDiscoverEmpty">Chưa tải được mẫu. Bạn có thể mở thư viện để cập nhật nguồn.</div>
    <div v-else class="promptDiscoverCards">
      <button v-for="item in items" :key="itemKey(item)" type="button" class="promptDiscoverCard" @click="openDetail(item)">
        <img v-if="item.coverUrl && !broken.has(itemKey(item))" :src="item.coverUrl" :alt="item.title" loading="lazy" referrerpolicy="no-referrer" @error="broken.add(itemKey(item))" />
        <div v-else class="promptDiscoverMissing">Chưa có ảnh minh họa</div>
        <strong>{{ translatedTitles[itemKey(item)] || item.title }}</strong>
        <small>{{ item.author || item.sourceId }}</small>
      </button>
    </div>
    <PromptLibraryDialog v-model="libraryVisible" :initialItem="detailItem" useMode="home" @use="choosePrompt" />
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { loadPrompts, translatePromptTitle, itemKey, type PromptItem } from "@/lib/promptLibrary";
import PromptLibraryDialog from "@/components/promptLibrary/PromptLibraryDialog.vue";
const items=ref<PromptItem[]>([]),loading=ref(false),error=ref(""),libraryVisible=ref(false);
const detailItem=ref<PromptItem>(),broken=ref(new Set<string>());
const translatedTitles=ref<Record<string,string>>({});
async function translateCards(list: PromptItem[]){
  let next=0;
  await Promise.all(Array.from({length:Math.min(3,list.length)},async()=>{
    while(next<list.length){
      const item=list[next++]!;
      if(item.personalId || translatedTitles.value[itemKey(item)])continue;
      try { translatedTitles.value[itemKey(item)]=(await translatePromptTitle(item)).title; }
      catch { /* Source-language title is the fallback, not fabricated content. */ }
    }
  }));
}
async function load(){loading.value=true;error.value="";try{items.value=(await loadPrompts({limit:8})).items;void translateCards(items.value);}catch(e){error.value=e instanceof Error?e.message:"Không tải được prompt";}finally{loading.value=false;}}
function openDetail(item: PromptItem){detailItem.value=item;libraryVisible.value=true;}
function openAll(){detailItem.value=undefined;libraryVisible.value=true;}
function choosePrompt(){ElMessage.success("Đã chọn prompt. Hãy mở hoặc tạo một dự án Canvas để áp dụng mẫu.");}
onMounted(()=>void load());
</script>
<style scoped>
.homePromptDiscovery{display:grid;gap:17px;margin:28px 0 45px}.homePromptHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.homePromptHeader h2{font-size:19px;margin:0 0 6px}.homePromptHeader p{font-size:12px;color:var(--el-text-color-secondary);margin:0}.promptDiscoverCards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.promptDiscoverCard{display:grid;gap:8px;min-width:0;padding:10px;text-align:left;border:1px solid var(--el-border-color);border-radius:12px;background:var(--el-bg-color);color:var(--el-text-color-primary);cursor:pointer}.promptDiscoverCard img,.promptDiscoverMissing{width:100%;height:155px;border-radius:8px;object-fit:cover;background:var(--el-fill-color-light)}.promptDiscoverMissing{display:grid;place-items:center;color:var(--el-text-color-secondary);font-size:12px}.promptDiscoverCard strong{font-size:13px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.promptDiscoverCard small{color:var(--el-text-color-secondary)}.promptDiscoverCard:hover,.promptDiscoverCard:focus-visible{outline:2px solid var(--el-color-primary)}.promptDiscoverEmpty{min-height:120px;display:grid;place-items:center;color:var(--el-text-color-secondary)}@media(max-width:800px){.promptDiscoverCards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:390px){.promptDiscoverCard img,.promptDiscoverMissing{height:110px}}
</style>
