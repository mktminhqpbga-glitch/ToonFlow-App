import type { Plugin } from "vite";
import { transformSource } from "./transform.ts";

export function i18nPlugin({ pluginUi = false }: { pluginUi?: boolean } = {}): Plugin {
  return {
    name: "toonflowI18n",
    enforce: "pre",
    transform(source, id) {
      const path = id.replaceAll("\\", "/");
      const hostUi = /\/(?:apps\/web\/src|packages\/providerWeb)\//.test(path);
      const extensionUi = pluginUi && /\/packages\/(?:nodes|nodeShared|nodeScaffold|tools|toolScaffold|ext|extScaffold)\//.test(path);
      if (!hostUi && !extensionUi) return;
      return transformSource(source, path);
    },
  };
}
