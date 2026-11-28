<template>
  <main class="huobaoLaunch">
    <router-link to="/home">Quay lại MacFlow</router-link>
    <h1>Phim ngắn</h1>
    <p v-if="loading" role="status">Đang mở Huobao Drama…</p>
    <template v-else>
      <el-alert :title="issue" type="warning" :closable="false" showIcon />
      <div class="launchActions">
        <el-button type="primary" plain @click="openHuobao">Thử lại</el-button>
        <a :href="setupUrl" target="_blank" rel="noopener noreferrer">Hướng dẫn chạy Huobao</a>
      </div>
      <router-link to="/shortDrama/storyboard">Mở bảng phân cảnh MacFlow đã lưu</router-link>
    </template>
  </main>
</template>

<script setup lang="ts">
import axios from "axios";
import { onMounted, onScopeDispose, ref } from "vue";

const setupUrl = "https://github.com/mktminhqpbga-glitch/ToonFlow-App/blob/feat/macflow-media-studios/docs/huobaoDrama.md";
const scope = new AbortController();
const loading = ref(true);
const issue = ref("");

async function openHuobao() {
  loading.value = true;
  issue.value = "";
  try {
    const { data } = await axios.get<{ data: { publicUrl: string; online: boolean } }>("/api/huobao/status", {
      headers: { "x-toonflow-workspace": "1" }, timeout: 8000, signal: scope.signal,
    });
    if (!data.data?.online) {
      issue.value = "Huobao chưa chạy. Mở Huobao rồi bấm Thử lại.";
      return;
    }
    window.location.replace(data.data.publicUrl);
  } catch {
    if (!scope.signal.aborted) issue.value = "Chưa mở được Huobao từ MacFlow. Hãy kiểm tra kết nối rồi thử lại.";
  } finally {
    if (issue.value) loading.value = false;
  }
}

onMounted(openHuobao);
onScopeDispose(() => scope.abort());
</script>

<style scoped>
.huobaoLaunch { display: grid; align-content: start; justify-items: start; gap: 14px; max-width: 720px; margin: auto; padding: clamp(20px, 5vw, 52px); }
.huobaoLaunch h1, .huobaoLaunch p { margin: 0; }
.launchActions { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; }
</style>
