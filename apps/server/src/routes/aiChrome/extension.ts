import { Router } from "express";
import { resolve } from "node:path";
import { readFile } from "@toonflow/file";
import { zipSync } from "fflate";
import u from "@/utils";

export default Router().get("/", async (req, res) => {
  u.aiChrome.authorize(req);
  const root: string | undefined = req.app.locals.aiChromeExtensionRoot;
  if (!root) throw Object.assign(new Error("Chưa có gói extension trên server này."), { status: 503 });
  const names = ["manifest.json", "background.js", "pairing.js", "relayConnection.js", "popup.html", "popup.js", "popup.css", "mediaTransfer.js", "mediaDownload.js", "requestReceiver.js", "museTransport.js", "museBridge.js", "siteBridge.js", "profileGuard.js"];
  const entries = await Promise.all(names.map(async name => [name, new Uint8Array(await readFile(resolve(root, name)))] as const));
  const files = Object.fromEntries(entries);
  const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"]!));
  const hosts = (process.env.MACFLOW_CHROME_MEDIA_HOSTS ?? "").split(",").map(value => value.trim()).filter(Boolean);
  for (const host of hosts) {
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(host) || host.endsWith(".local")) throw new Error("MACFLOW_CHROME_MEDIA_HOSTS chỉ nhận tên miền CDN, phân cách bằng dấu phẩy.");
    manifest.host_permissions.push(`https://${host.toLowerCase()}/*`);
  }
  const relay = u.aiChrome.relaySettings();
  if (relay) {
    const url = new URL(relay.url);
    manifest.host_permissions = [...new Set([...manifest.host_permissions, `${url.protocol === "wss:" ? "https:" : "http:"}//${url.hostname}/*`])];
  }
  manifest.host_permissions = [...new Set(manifest.host_permissions)];
  files["manifest.json"] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  res.set({ "Cache-Control": "no-store", "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="macflowChrome.zip"' });
  res.send(Buffer.from(zipSync(files)));
});
