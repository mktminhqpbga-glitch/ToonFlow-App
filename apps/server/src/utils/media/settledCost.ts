import { modelGateway } from "@/utils/multiTenant/gateway";

export async function readSettledMediaCost(task: { chargeId?: string; chargeStatus?: string; ownerUserId?: string }) {
  if (!task.chargeId || !task.ownerUserId || task.chargeStatus !== "settled") return;
  const receipt = await modelGateway.getCharge(task.chargeId, task.ownerUserId).catch(() => undefined);
  if (receipt?.status === "settled") return { amount: receipt.amount, currency: receipt.currency };
}
