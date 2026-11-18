<template>
  <el-tour v-model="open" :targetAreaClickable="false" :contentStyle="{ maxWidth: 'calc(100vw - 32px)' }" @close="complete">
    <el-tour-step
      v-for="(step, index) in steps"
      :key="step.target"
      :target="() => root?.querySelector<HTMLElement>(step.target) ?? null"
      :title="step.title"
      :description="step.description"
      :prevButtonProps="{ children: 'Trước' }"
      :nextButtonProps="{ children: index === steps.length - 1 ? 'Bắt đầu sử dụng' : 'Tiếp' }" />
    <template #indicators="{ current, total }">{{ current + 1 }} / {{ total }}</template>
  </el-tour>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElTour, ElTourStep } from "element-plus";

defineProps<{ root?: HTMLElement }>();
const storageKey = "toonflow.director3dTour";
const open = ref(localStorage.getItem(storageKey) !== "true");
const steps = [
  {
    target: ".chatFooter",
    title: "Tạo cảnh và phương án",
    description: "Mô tả mô hình cảnh, hành động nhân vật và yêu cầu góc máy, rồi nhấn “Tạo phương án”. Có thể dùng @ để tham chiếu văn bản, ảnh và video đã kết nối trên Canvas.",
  },
  {
    target: ".planContent",
    title: "Xem và chuyển phương án",
    description: "Các phương án đã tạo xuất hiện ở đây. Chọn một phương án để xem hoạt ảnh từ đầu và xem lại prompt đã dùng; bạn cũng có thể nhập yêu cầu mới để tạo phương án khác. Các phương án dùng chung cảnh và mô hình cơ sở.",
  },
  {
    target: ".viewport",
    title: "Lấy khung hình góc nhìn thứ nhất",
    description: "Nhấp vào cảnh 3D rồi di chuột để điều chỉnh hướng nhìn. Dùng WASD để di chuyển, phím cách để lên, Shift để xuống, con lăn để điều chỉnh tiêu cự; nhấp chuột trái hoặc Esc để thoát chế độ lấy khung hình.",
  },
  {
    target: ".stagePanel .referenceList",
    title: "Ghi khung hình chính",
    description: "Trong chế độ lấy khung hình, nhấp chuột phải hoặc chọn “Thêm khung hình chính” để ghi góc máy hiện tại. Bạn có thể kéo đổi thứ tự, nhấp xem lại hoặc xóa các khung hình. Khi tạo phương án mới, AI sẽ dựa vào các khung hình này và thứ tự của chúng để thiết kế chuyển động camera. Nhấn xuất để tạo ảnh từ khung hình.",
  },
  {
    target: ".playbackBar",
    title: "Phát và cài đặt hình ảnh",
    description: "Dùng nút phát và thanh tiến trình để kiểm tra hoạt ảnh. Tại đây có thể chỉnh tỷ lệ khung hình, lưới, bầu trời và ánh sáng để bản xem thử sát với ý tưởng hơn.",
  },
  {
    target: '[aria-label="Xuất node video"]',
    title: "Xuất ra Canvas",
    description: "Chọn phương án rồi nhấn nút này để xuất node video. Nút xuất trên ảnh thu nhỏ của khung hình chính sẽ tạo node ảnh. Khi xuất video, hãy giữ cửa sổ hiển thị; hoàn tất thì trở về Canvas để xem kết quả.",
  },
];

function complete() {
  localStorage.setItem(storageKey, "true");
}
</script>
