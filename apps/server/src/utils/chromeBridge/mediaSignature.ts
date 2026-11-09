// Verify Chrome Companion binary results before accepting a declared MIME and writing workspace files.
// This complements the browser-side decode/metadata checks; it does not certify codec/duration.
export function verifyChromeMediaSignature(bytes: Uint8Array, mimeType: string) {
  if (bytes.length < 16) throw new Error("Chrome AI trả về tệp rỗng hoặc không có header media hợp lệ");
  const head = Buffer.from(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, 256));
  const ascii = head.toString("ascii");
  const png = head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const webp = ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
  const ftyp = ascii.slice(4, 8) === "ftyp";
  const quicktime = ftyp && ascii.slice(8, 12) === "qt  ";
  const mp4 = ftyp && !quicktime && !/^(avif|avis|M4A |M4B )$/.test(ascii.slice(8, 12));
  const webm = head.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])) && ascii.includes("webm");
  const valid: Record<string, boolean> = {
    "image/png": png, "image/jpeg": jpeg, "image/webp": webp,
    "video/mp4": mp4, "video/quicktime": quicktime, "video/webm": webm,
  };
  if (!valid[mimeType]) throw new Error("Chrome AI trả về media không khớp chữ ký tệp; không lưu thumbnail hoặc nội dung giả");
}
