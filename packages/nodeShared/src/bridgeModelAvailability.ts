/** Discovered tabs are not proof that a website can generate an image/video. */
export type BridgeCapabilityTab = {
  provider: string;
  ready: boolean;
  busy: boolean;
  outputKinds?: readonly string[];
};

export function bridgeTabCanRun(tab: BridgeCapabilityTab, kind: string) {
  if (!tab.ready || tab.busy) return false;
  // A ready browser chat is usable for text even with an older extension.
  // Image/video/audio require explicit adapter-reported capabilities.
  return kind === "text" || Array.isArray(tab.outputKinds) && tab.outputKinds.includes(kind);
}

export function bridgeTabDiscoveries(tabs: readonly BridgeCapabilityTab[], kind: string) {
  const map = new Map<string, { provider: string; count: number; ready: number; capable: number }>();
  for (const tab of tabs) {
    const row = map.get(tab.provider) ?? { provider: tab.provider, count: 0, ready: 0, capable: 0 };
    row.count++;
    if (tab.ready && !tab.busy) row.ready++;
    if (bridgeTabCanRun(tab, kind)) row.capable++;
    map.set(tab.provider, row);
  }
  return [...map.values()];
}
