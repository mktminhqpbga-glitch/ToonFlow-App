export const macFlowRepository = "https://github.com/mktminhqpbga-glitch/ToonFlow-App";
export const macFlowBranch = "feat/macflow-media-studios";
export const updateChannel = "macFlowUpdate";
export const updatePath = "/api/macFlowUpdate";

export type UpdateSnapshot = {
  current: string;
  latest?: string;
  automatic: boolean;
  phase: "idle" | "checking" | "available" | "building" | "waiting" | "restarting" | "error";
  message?: string;
};

export type UpdateAction = { type: "check" | "install" } | { type: "automatic"; enabled: boolean };
export type UpdateFromServer = UpdateAction | { type: "ready" } | { type: "drain"; id: string; ready: boolean };
export type UpdateFromLauncher = { type: "snapshot"; snapshot: UpdateSnapshot } | { type: "drain"; id: string; automatic: boolean };
