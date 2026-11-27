<template>
  <div class="workspaceMenu">
    <el-card shadow="never" :bodyStyle="{ padding: '2px 4px' }">
      <div class="menuContent">
        <el-popover placement="bottom-start" trigger="click" :width="205">
          <template #reference>
            <el-button class="toolButton" text title="Điều hướng MacFlow" aria-label="Điều hướng MacFlow" aria-haspopup="dialog">
              <icon-menu-2 :size="18" aria-hidden="true" />
            </el-button>
          </template>
          <creativeNavigation />
        </el-popover>
        <el-button class="toolButton" text aria-label="Xưởng tạo ảnh" title="Xưởng tạo ảnh" @click="router.push('/image')">
          <icon-photo :size="18" aria-hidden="true" />
        </el-button>
        <el-button class="toolButton" text aria-label="Xưởng tạo video" title="Xưởng tạo video" @click="router.push('/video')">
          <icon-video :size="18" aria-hidden="true" />
        </el-button>
        <el-button class="toolButton" text aria-label="退出项目" title="退出项目" @click="exitVisible = true">
          <icon-logout :size="18" aria-hidden="true" />
        </el-button>
        <el-button class="toolButton" text :aria-label="hasDesktopUpdate ? '设置，有新版本可用' : '设置'" title="设置" @click="emit('openSettings')">
          <el-badge isDot :hidden="!hasDesktopUpdate">
            <icon-settings :size="18" aria-hidden="true" />
          </el-badge>
        </el-button>
      </div>
    </el-card>
    <el-dialog v-model="exitVisible" title="退出项目" width="360px" alignCenter appendToBody>
      <span>是否退出当前项目并返回首页？</span>
      <template #footer>
        <el-button @click="exitVisible = false">取消</el-button>
        <el-button type="primary" :loading="leaving" @click="exitProject">退出项目</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import creativeNavigation from "@/components/creativeNavigation.vue";
import { useRouter } from "vue-router";
import { hasDesktopUpdate } from "@/stores/desktopUpdate";

const emit = defineEmits<{ openSettings: [] }>();
const router = useRouter();
const exitVisible = ref(false);
const leaving = ref(false);

async function exitProject() {
  if (leaving.value) return;
  leaving.value = true;
  try {
    await router.push("/home");
  } finally {
    leaving.value = false;
  }
}
</script>

<style scoped lang="scss">
.workspaceMenu {
  .menuContent {
    display: flex;
    align-items: center;
    gap: 2px;

    .toolButton {
      width: 28px;
      height: 28px;
      margin: 0;
      padding: 0;
    }
  }
}
</style>
