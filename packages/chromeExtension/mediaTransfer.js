export const chunkSize = 65536;
export const maxSize = 64 * 1024 * 1024;
export async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("");
}
export function frame(id, sequence, bytes) {
  const value = new Uint8Array(40 + bytes.length);
  value.set(new TextEncoder().encode(id), 0); new DataView(value.buffer).setUint32(36, sequence); value.set(bytes, 40);
  return value;
}
