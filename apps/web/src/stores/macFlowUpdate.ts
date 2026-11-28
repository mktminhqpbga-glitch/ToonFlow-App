import { shallowRef } from "vue";
import { ElNotification } from "element-plus";
import http from "@/lib/http";
import { updatePath, type UpdateAction, type UpdateSnapshot } from "../../../../scripts/macFlowUpdateProtocol";

export const macFlowUpdate = shallowRef<UpdateSnapshot | null>(null);
export const macFlowUpdatePending = shallowRef(false);
export const macFlowUpdateError = shallowRef("");

export function registerMacFlowUpdate() {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) return () => {};
  const controller = new AbortController();
  let activity = 0;
  let notified = "";
  let refreshing = false;
  const markActive = (event: Event) => { if (event.isTrusted && !document.hidden) activity = Date.now(); };
  const activities = ["pointerdown", "keydown", "input"];
  for (const name of activities) window.addEventListener(name, markActive, { capture: true, passive: true });
  async function refresh() {
    if (refreshing || controller.signal.aborted) return;
    refreshing = true;
    try {
      const active = Date.now() - activity < 15_000;
      const state = await http<UpdateSnapshot | null>({
        method: "GET", url: updatePath, signal: controller.signal, timeout: 4000,
        headers: active ? { "x-macflow-active": "1" } : undefined,
      });
      if (!state) return;
      if (macFlowUpdate.value && state.current !== macFlowUpdate.value.current) {
        window.location.reload();
        return;
      }
      macFlowUpdate.value = state;
      if (state.latest && state.latest !== state.current && state.latest !== notified) {
        notified = state.latest;
        ElNotification.info({
          title: "Có bản MacFlow mới",
          message: state.automatic ? "MacFlow sẽ tự cài khi công việc đang chạy hoàn tất." : "Mở Cài đặt → Giới thiệu để cài bản mới.",
        });
      }
    } catch {
      // The listener briefly disappears while the launcher switches versions.
    } finally {
      refreshing = false;
    }
  }
  void refresh();
  const timer = window.setInterval(() => void refresh(), 5000);
  return () => {
    controller.abort();
    window.clearInterval(timer);
    for (const name of activities) window.removeEventListener(name, markActive, true);
  };
}

export async function changeMacFlowUpdate(action: UpdateAction) {
  if (macFlowUpdatePending.value) return;
  macFlowUpdatePending.value = true;
  macFlowUpdateError.value = "";
  try {
    await http({ method: "POST", url: updatePath, data: action });
  } catch (cause) {
    macFlowUpdateError.value = cause instanceof Error ? cause.message : "Không thực hiện được thao tác cập nhật.";
  } finally {
    macFlowUpdatePending.value = false;
  }
}
