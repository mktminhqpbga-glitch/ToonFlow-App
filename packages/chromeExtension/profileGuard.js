const geoSources = ["https://ipapi.co/json/", "https://ipwho.is/"];
const proxyModes = ["fixed_servers", "pac_script", "direct", "system", "auto_detect"];
const responseLimit = 8192;
const localBypasses = new Set(["<local>", "localhost", "127.0.0.1", "::1", "[::1]"]);

function validProxyHost(host) {
  return typeof host === "string" && host.length > 0 && host.length <= 253
    && host.split(".").every(label => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label));
}
function validProxy(server) {
  return !!server && ["http", "https", "socks5"].includes(server.scheme ?? "http") && validProxyHost(server.host)
    && Number.isInteger(server.port) && server.port >= 1 && server.port <= 65535;
}
function validProxyConfig(setting) {
  if (setting?.mode === "fixed_servers") {
    const rules = setting.rules;
    if (!rules || !Array.isArray(rules.bypassList ?? [])
      || (rules.bypassList ?? []).some(value => typeof value !== "string" || !localBypasses.has(value.trim().toLowerCase()))
      || rules.singleProxy && rules.proxyForHttps || rules.fallbackProxy) return false;
    return validProxy(rules.singleProxy ?? rules.proxyForHttps);
  }
  if (setting?.mode !== "pac_script" || setting.pacScript?.mandatory !== true
    || setting.pacScript.url || typeof setting.pacScript.data !== "string") return false;
  // Only a mandatory inline PAC returning one static proxy for HTTPS destinations is accepted.
  // Dynamic PAC, remote PAC, DIRECT and fallback rules cannot establish this guarantee.
  const match = /^\s*function\s+FindProxyForURL\s*\(\s*url\s*,\s*host\s*\)\s*\{\s*return\s+(["'])(PROXY|HTTPS|SOCKS5) ([a-zA-Z0-9.-]+):([0-9]{1,5})\1\s*;\s*\}\s*$/.exec(setting.pacScript.data);
  return !!match && validProxy({ scheme: ({ PROXY: "http", HTTPS: "https", SOCKS5: "socks5" })[match[2]], host: match[3], port: Number(match[4]) });
}
function proxySettings() {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (value, error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (error) reject(new Error("Không đọc được cài đặt proxy Chrome."));
      else resolve(value);
    };
    const timer = setTimeout(() => finish(null, true), 5000);
    try {
      chrome.proxy.settings.get({ incognito: false }, setting => {
        finish(setting, !!chrome.runtime.lastError || !setting);
      });
    } catch { finish(null, true); }
  });
}
function publicIp(value) {
  if (typeof value !== "string" || value.length > 45) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(value)) {
    const parts = value.split(".");
    if (parts.some(part => part.length > 1 && part.startsWith("0") || Number(part) > 255)) return null;
    const [a, b, c] = parts.map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224
      || a === 100 && b >= 64 && b <= 127
      || a === 169 && b === 254
      || a === 172 && b >= 16 && b <= 31
      || a === 192 && (b === 168 || b === 0 && c === 0 || b === 0 && c === 2 || b === 88 && c === 99)
      || a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)
      || a === 203 && b === 0 && c === 113) return null;
    return value;
  }
  if (!value.includes(":") || !/^[a-fA-F0-9:]+$/.test(value)) return null;
  try {
    const normalized = new URL(`https://[${value}]/`).hostname.slice(1, -1);
    const first = parseInt(normalized.split(":")[0], 16);
    if (first < 0x2000 || first >= 0x4000 || normalized.startsWith("2001:db8:")) return null;
    return normalized;
  } catch { return null; }
}
async function geoLookup(url) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Geo timeout"));
    }, 8000);
  });
  try {
    return await Promise.race([timeout, (async () => {
      const response = await fetch(url, {
        method: "GET", credentials: "omit", redirect: "error", cache: "no-store",
        referrerPolicy: "no-referrer", headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok || response.status !== 200 || response.redirected || response.url !== url
        || !/^application\/json(?:\s*;|\s*$)/i.test(response.headers?.get("content-type") || "")
        || !response.body?.getReader) throw new Error("Invalid geo response");
      const reader = response.body.getReader();
      const chunks = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!(value instanceof Uint8Array) || !value.length || (size += value.length) > responseLimit)
            throw new Error("Geo response too large");
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const details = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      if (!details || typeof details !== "object" || Array.isArray(details)
        || details.error || details.success === false || details.country_code !== "US") throw new Error("Geo country invalid");
      const ip = publicIp(details.ip);
      if (!ip) throw new Error("Geo IP invalid");
      return ip;
    })()]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

export async function verifyMuseNetwork() {
  let proxyMode = "unknown";
  try {
    const setting = (await proxySettings()).value;
    if (proxyModes.includes(setting?.mode)) proxyMode = setting.mode;
    if (!validProxyConfig(setting)) throw new Error("Chrome chưa có proxy cho HTTPS hợp lệ hoặc PAC chỉ định một proxy.");
    // Both browser requests must independently agree on the SAME public US egress IP.
    const results = await Promise.allSettled(geoSources.map(geoLookup));
    if (results.some(result => result.status !== "fulfilled"))
      throw new Error("Không xác minh được IP Mỹ từ cả hai dịch vụ HTTPS.");
    if (results[0].value !== results[1].value)
      throw new Error("Hai dịch vụ xác minh trả về IP công khai khác nhau.");
    const ip = results[0].value;
    const ipHint = ip.includes(":") ? `IPv6 ****:${ip.split(":").at(-1).slice(-4)}`
      : `IPv4 ***.***.***.${ip.split(".").at(-1)}`;
    return { ok: true, proxyMode, countryCode: "US", ipHint, checkedAt: Date.now() };
  } catch (error) {
    return { ok: false, proxyMode, checkedAt: Date.now(),
      error: (error?.message && [
        "Chrome chưa có proxy cho HTTPS hợp lệ hoặc PAC chỉ định một proxy.",
        "Không xác minh được IP Mỹ từ cả hai dịch vụ HTTPS.",
        "Hai dịch vụ xác minh trả về IP công khai khác nhau.",
      ].includes(error.message) ? error.message : "Không thể xác minh proxy hoặc IP Mỹ của Chrome.").slice(0, 400) };
  }
}
