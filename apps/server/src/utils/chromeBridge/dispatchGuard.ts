import type { BridgeProvider, BridgeState } from "./runtime";

type Job = { provider: BridgeProvider; tabId: number; state?: BridgeState };
type Selection = { tab: { id: number }; capabilities: readonly string[] };

export function assertTabDispatchAvailable(
  provider: BridgeProvider, tabId: number, requestId: string,
  activeJobs: ReadonlyMap<string, Job>,
  recentJobs: readonly Job[],
) {
  if (activeJobs.has(requestId) || recentJobs.some(job => "id" in job && job.id === requestId))
    throw new Error("Task ID đã được sử dụng. Không gửi trùng yêu cầu AI.");
  if ([...activeJobs.values()].some(job => job.tabId === tabId))
    throw new Error("Tab Chrome này đang chạy tác vụ khác. Không gửi chồng prompt.");
  if (recentJobs.some(job => job.tabId === tabId && job.state === "unknown"))
    throw new Error("Tab có tác vụ UNKNOWN. Kiểm tra kết quả trên Chrome và chủ động chọn lại tab trước khi tạo việc mới.");
}

export function bridgeDiagnosis(status: {
  enabled?: boolean; connected?: boolean; mode?: string;
  remote?: { url?: string; configured?: boolean; transport?: string; selectedDeviceId?: string;
    devices?: { id: string; online: boolean }[] };
  selected?: Partial<Record<BridgeProvider, Selection>>;
  jobs?: { provider: BridgeProvider; tabId: number; state: string }[];
}) {
  const remote = status.mode === "remote";
  const settings = status.remote;
  const relayConfigured = remote ? !!settings?.configured && !!settings?.url : true;
  const relayConnected = remote ? relayConfigured && ["wss", "https"].includes(settings?.transport ?? "") : !!status.enabled;
  const deviceConnected = remote ? !!settings?.devices?.some(device => device.id === settings?.selectedDeviceId && device.online) : !!status.connected;
  const extensionConnected = !!status.connected && relayConnected && deviceConnected;
  const stages = [
    { id: "relay", ready: relayConfigured && relayConnected, message: !remote ? "Kết nối cục bộ" : !relayConfigured ? "Chưa cấu hình URL hoặc khóa Relay" : relayConnected ? "Relay đã có kênh kết nối" : "Relay chưa kết nối WSS/HTTPS" },
    { id: "device", ready: deviceConnected, message: deviceConnected ? "Thiết bị đã online" : "Chưa chọn thiết bị Chrome online" },
    { id: "extension", ready: extensionConnected, message: extensionConnected ? "Chrome Companion đã kết nối" : "Extension chưa xác nhận kết nối" },
  ];
  const providers = (["muse", "gemini", "chatgpt"] as const).map(provider => {
    const choice = status.selected?.[provider];
    const running = status.jobs?.some(job => job.provider === provider && ["submitting", "running"].includes(job.state)) ?? false;
    const unknown = status.jobs?.some(job => job.provider === provider && job.state === "unknown") ?? false;
    return { provider, tabId: choice?.tab.id ?? null, connected: extensionConnected && !!choice,
      capabilities: extensionConnected ? [...choice?.capabilities ?? []] : [],
      state: unknown ? "unknown" : running ? "running" : extensionConnected && choice ? "ready" : "offline",
      reason: !extensionConnected ? "Kiểm tra Relay, thiết bị và Extension" : !choice ? "Chưa chọn và xác minh tab" : unknown ? "Kết quả tác vụ cũ chưa rõ; không tự retry" : running ? "Tab đang xử lý" : "Tab đã được probe xác nhận",
    };
  });
  return { stages, providers, pendingJobs: status.jobs?.filter(job => ["submitting", "running"].includes(job.state)).length ?? 0 };
}
