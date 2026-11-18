import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import type { Server } from "node:http";
import museBridge from "../src/routes/aiChrome/muse2apiBridge";
import { clientMessage } from "../src/utils/aiChrome/protocol";

const secret = "offline-test-bridge-secret-only-" + "x".repeat(32);
const old = process.env.MACFLOW_MUSE2API_BRIDGE_TOKEN;
let server: Server;
let url: string;
beforeAll(async () => {
  process.env.MACFLOW_MUSE2API_BRIDGE_TOKEN = secret;
  const app = express();
  app.use(express.json());
  app.use("/api/aiChrome/muse2api/bridge", museBridge);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("No test port");
  url = `http://127.0.0.1:${addr.port}/api/aiChrome/muse2api/bridge`;
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  if (old === undefined) delete process.env.MACFLOW_MUSE2API_BRIDGE_TOKEN;
  else process.env.MACFLOW_MUSE2API_BRIDGE_TOKEN = old;
});

describe("Muse2API Python → extension bridge: offline fail-closed", () => {
  test("tabStatus only accepts 5 unique managed IDs, backed by live targets", () => {
    const target = { provider: "muse", tabId: 22, documentToken: "123e4567-e89b-42d3-a456-426614174001",
      url: "https://muse.ai/thread/new", outputKinds: ["text", "image", "video"],
      ready: true, blocked: false, busy: false };
    const report = { type: "tabStatus", targets: [target], managedMuseTabIds: [22] };
    expect(clientMessage.safeParse(report).success).toBe(true);
    expect(clientMessage.safeParse({ ...report, managedMuseTabIds: [22, 22] }).success).toBe(false);
    expect(clientMessage.safeParse({ ...report, managedMuseTabIds: [1, 2, 3, 4, 5, 6] }).success).toBe(false);
    expect(clientMessage.safeParse({ type: "museTabsManaged",
      requestId: "123e4567-e89b-42d3-a456-426614174001", tabIds: [1, 2, 3, 4, 5] }).success).toBe(true);
  });
  test("proxy/IP verification protocol rejects missing fields, non-US and malformed response", () => {
    const checkedAt = Date.now();
    const response = { type: "museNetworkVerified", requestId: "123e4567-e89b-42d3-a456-426614174001",
      ok: true, proxyMode: "fixed_servers", countryCode: "US", checkedAt, ipHint: "203.0.x.x" };
    expect(clientMessage.safeParse(response).success).toBe(true);
    expect(clientMessage.safeParse({ ...response, checkedAt: undefined }).success).toBe(false);
    expect(clientMessage.safeParse({ ...response, proxyMode: "freeform" }).success).toBe(false);
    expect(clientMessage.safeParse({ ...response, countryCode: "USA" }).success).toBe(false);
    expect(clientMessage.safeParse({ ...response, checkedAt: -1 }).success).toBe(false);
  });
  test("absent secret and cross-origin requests cannot read bridge state", async () => {
    const unauth = await fetch(`${url}/status`);
    expect(unauth.status).toBe(403);
    const origin = await fetch(`${url}/status`, {
      headers: { "X-MacFlow-Muse-Bridge-Token": secret, Origin: "https://example.com" },
    });
    expect(origin.status).toBe(403);
  });
  test("localhost secret can inspect status but cannot create tabs without Profile22 confirmation", async () => {
    const headers = { "X-MacFlow-Muse-Bridge-Token": secret, "Content-Type": "application/json" };
    const status = await fetch(`${url}/status`, { headers });
    expect(status.status).toBe(200);
    const state = await status.json() as { connected: boolean; ready: boolean; tabs: number };
    expect(state).toMatchObject({ connected: false, ready: false, tabs: 0 });
    const ensure = await fetch(`${url}/ensure`, { method: "POST", headers, body: "{}" });
    expect(ensure.status).toBe(400);
    const selectedWithoutNetwork = await fetch(`${url}/ensure`, { method: "POST", headers,
      body: JSON.stringify({ confirmExistingProfile22: true }) });
    expect(selectedWithoutNetwork.status).toBe(503);
    expect((await selectedWithoutNetwork.json() as { error: string }).error).toMatch(/Extension chưa kết nối/);
  });
  test("disconnected extension rejects media before any task is sent; results are not invented", async () => {
    const headers = { "X-MacFlow-Muse-Bridge-Token": secret, "Content-Type": "application/json" };
    const run = await fetch(`${url}/run`, { method: "POST", headers, body: JSON.stringify({
      id: "123e4567-e89b-42d3-a456-426614174022", kind: "image", prompt: "Offline packaging only", files: [],
    }) });
    expect(run.status).toBe(503);
    const result = await fetch(`${url}/result/123e4567-e89b-42d3-a456-426614174022`, { headers });
    expect(result.status).toBe(404);
  });
});
