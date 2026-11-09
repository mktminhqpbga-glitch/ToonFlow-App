import { Router } from "express";
import { success } from "@/lib/responseFormat";

// Independent build disables upstream promotions at the route boundary.
export default Router().get("/", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(success({ banner: null, banners: [], bannerMode: "carousel", bannerInterval: 5, sidebar: [] }));
});
