<template>
  <div v-if="failed" class="pageRecovery" role="alert">
    <h1>Trang này chưa mở được</h1>
    <p>Bạn có thể thử mở lại trang hoặc quay về Tổng quan.</p>
    <div class="recoveryActions">
      <el-button type="primary" @click="failed = false">Thử lại</el-button>
      <router-link to="/home">Về Tổng quan</router-link>
    </div>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { onErrorCaptured, ref } from "vue";

const failed = ref(false);
onErrorCaptured(error => {
  console.error("Trang MacFlow gặp lỗi", error);
  failed.value = true;
  return false;
});
</script>

<style scoped>
.pageRecovery { max-width: 38rem; margin: 3rem auto; padding: 1rem; }
.recoveryActions { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; }
</style>
