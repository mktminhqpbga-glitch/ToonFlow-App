import { IconBook, IconCompass, IconFolder, IconHome, IconLayoutDashboard, IconMovie, IconPhoto, IconShoppingBag, IconVideo } from "@tabler/icons-vue";

export const homeSections = [
  { id: "home", label: "Trang chủ", icon: IconHome },
  { id: "projects", label: "Dự án", icon: IconFolder },
  { id: "prompts", label: "Xem mục Thư viện prompt", icon: IconBook },
  { id: "explore", label: "Xem mục Khám phá", icon: IconCompass },
];

export const creationLinks = [
  { path: "/workspace", label: "Canvas", icon: IconLayoutDashboard },
  { path: "/image", label: "Xưởng tạo ảnh", icon: IconPhoto },
  { path: "/video", label: "Xưởng tạo video", icon: IconVideo },
  { path: "/shortDrama", label: "Phim ngắn", icon: IconMovie },
  { path: "/videoAff", label: "VideoAFF", icon: IconShoppingBag, localOnly: true },
];
