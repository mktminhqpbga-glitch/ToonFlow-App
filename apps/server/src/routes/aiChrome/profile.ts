import { Router } from "express";
import { z } from "zod";
import { validateFields } from "@/lib/middleware";
import { success } from "@/lib/responseFormat";
import u from "@/utils";

/** Explicit, user-confirmed local Chrome profile selection + live US proxy check.
 * Extension cannot independently know the Chrome 'Profile 22' folder name.
 * Only a real connected local extension may be selected; no Chrome is launched.
 */
export default Router().post("/", validateFields({
  profileDirectory: z.literal("Profile 22"),
  confirmedExtensionInProfile: z.literal(true),
}), async (req, res) => {
  u.aiChrome.authorize(req);
  res.set("Cache-Control", "no-store");
  res.json(success(await u.aiChrome.selectMuseProfile(req.body)));
});
