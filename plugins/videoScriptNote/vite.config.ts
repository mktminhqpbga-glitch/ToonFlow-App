import { createNodeConfig } from "@toonflow/nodes-scaffold";

export default createNodeConfig({
  name: "videoScriptNote",
  displayName: "Video → Kịch bản",
  author: "MacFlow",
  github: "",
}, import.meta.url, { outDir: "build", syncToData: false });
