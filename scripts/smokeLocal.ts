// Read-only local smoke checks. Start ToonFlow Server + Web first on macOS Ventura.
// No workspace creation, AI task submission, secret logging, or provider charges.
const host = "127.0.0.1";
const serverPort = Number(process.env.TOONFLOW_SERVER_PORT || 3000);
const webPort = Number(process.env.TOONFLOW_WEB_PORT || 5173);
if (![serverPort, webPort].every(port => Number.isInteger(port) && port > 0 && port < 65536)) {
  throw new Error("TOONFLOW_SERVER_PORT / TOONFLOW_WEB_PORT không hợp lệ");
}
const server = `http://${host}:${serverPort}`;
const web = `http://${host}:${webPort}`;

async function check(url: string, options: RequestInit, validate: (response: Response) => Promise<boolean>, label: string) {
  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
    if (!response.ok || !(await validate(response))) throw new Error(`HTTP ${response.status} hoặc dữ liệu không hợp lệ`);
    console.log(`PASS ${label}`);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error(`FAIL ${label}: ${message}`);
    process.exitCode = 1;
  }
}

await check(web, {}, async response => /<html(?:\\s|>)/i.test(await response.text()), "Web HTML reachable");
await check(`${server}/api/workspaces/list`, {}, async response => {
  const payload: unknown = await response.json();
  return typeof payload === "object" && payload !== null && "code" in payload && payload.code === 200
    && "data" in payload && typeof payload.data === "object" && payload.data !== null;
}, "Workspace list read-only API");
await check(`${server}/api/desktop/chromeBridge/diagnostics`, {
  headers: { Origin: server },
}, async response => {
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null || !("data" in payload)) return false;
  const data = payload.data;
  return typeof data === "object" && data !== null && "stages" in data && Array.isArray(data.stages)
    && "providers" in data && Array.isArray(data.providers);
}, "Chrome Bridge diagnostics (local loopback/Origin)");
