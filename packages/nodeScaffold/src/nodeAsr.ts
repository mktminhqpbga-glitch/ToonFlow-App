import { onScopeDispose } from "vue";
import { isBrowserAudioAsrSupported, transcribeBrowserAudio, type BrowserAudioAsrOptions } from "@toonflow/asr";
import { useNodeFiles } from "./workspaceFiles";

export { createBrowserAsr, isBrowserAsrSupported, isBrowserAudioAsrSupported } from "@toonflow/asr";
export type { BrowserAsrState, BrowserAsrResult, BrowserAsrError, BrowserAsrOptions, BrowserAudioAsrOptions } from "@toonflow/asr";

export function useNodeAsr() {
  const files = useNodeFiles();
  const lifetime = new AbortController();
  onScopeDispose(() => lifetime.abort());

  return {
    async transcribe(path: string, options: BrowserAudioAsrOptions = {}) {
      const signal = options.signal ? AbortSignal.any([lifetime.signal, options.signal]) : lifetime.signal;
      signal.throwIfAborted();
      if (!isBrowserAudioAsrSupported()) throw new DOMException("Trình duyệt hiện tại chưa hỗ trợ chuyển âm thanh thành văn bản; hãy thử trình duyệt khác.", "NotSupportedError");
      const content = await files.getWorkspaceFiles().read(path);
      signal.throwIfAborted();
      if (!content.byteLength || content.byteLength > 100 * 1024 * 1024) throw new Error("Âm thanh không được để trống và không được vượt quá 100 MB");
      const url = URL.createObjectURL(new Blob([content]));
      try {
        return await transcribeBrowserAudio(url, { ...options, signal });
      } finally {
        URL.revokeObjectURL(url);
      }
    },
  };
}
