/** Pure fail-closed eligibility check for a profile-scoped Chrome egress proof.
 * Only the authenticated Chrome extension may report such a proof. A matching
 * geolocation alone is never evidence that Chrome has a proxy configured.
 */
export type MuseEgressProof = {
  ok: boolean;
  proxyMode: "fixed_servers" | "pac_script" | "direct" | "system" | "auto_detect" | "unknown";
  countryCode?: string;
  checkedAt: number;
};
export function isVerifiedUsProxy(proof: MuseEgressProof | undefined, now = Date.now()) {
  return !!proof && proof.ok === true && proof.countryCode === "US"
    && ["fixed_servers", "pac_script"].includes(proof.proxyMode)
    && Number.isSafeInteger(proof.checkedAt)
    && proof.checkedAt <= now + 5000 && now - proof.checkedAt >= 0 && now - proof.checkedAt <= 20000;
}
