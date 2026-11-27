export function describeStudioError(message?: string, status?: number) {
  const text = typeof message === "string" ? message.trim() : "";
  if (/hạn mức|quota|insufficient.{0,20}(credits|balance)|额度|余额/i.test(text)) return "Đã hết hạn mức. Hãy kiểm tra tài khoản rồi thử lại.";
  if (status === 429 || /rate limit|too many|hàng chờ đầy|频率/i.test(text)) return "Dịch vụ đang giới hạn lượt dùng. Hãy chờ một chút hoặc kiểm tra hạn mức tài khoản.";
  if (/参考素材上传未确认|reference.*upload.*not.confirmed/i.test(text)) return "Ảnh tham chiếu chưa được nhận. Hãy kiểm tra ảnh rồi thử lại.";
  if (/ProxyError|账号代理请求失败/i.test(text)) return "Dịch vụ tạo nội dung mất kết nối. Hãy kiểm tra tài khoản dùng để kết nối rồi thử lại.";
  if (status === 401 || status === 403 || /api.?key|ùyền truy cập|unauthorized|认证失败|未登录/i.test(text)) {
    return "Kết nối chưa được xác thực. Hãy kiểm tra khóa kết nối trong Cài đặt rồi thử lại.";
  }
  if (status === 413) return "Tệp quá lớn. Hãy chọn tệp nhỏ hơn rồi thử lại.";
  if (status === 415) return "Định dạng tệp chưa được hỗ trợ. Hãy chọn tệp khác.";
  if (status === 404 || /生成任务不存在|ENOENT/.test(text)) return "Chưa tìm thấy kết quả đã lưu. Hãy kiểm tra lại sau.";
  if (status === 408 || /timed? ?out|quá thời gian|timeout|network.?error|failed to fetch/i.test(text)) return "Kết nối phản hồi chậm. Hãy kiểm tra mạng rồi thử lại.";
  if (/参数错误|Invalid input|invalid argument|invalid request/i.test(text)) {
    return "Nội dung hoặc định dạng chưa phù hợp. Hãy kiểm tra ý tưởng và tư liệu rồi thử lại.";
  }
  const nested = /^([0-9]{3}):\s*(\{.{1,2000}\})$/s.exec(text);
  if (nested) {
    try {
      const parsed = JSON.parse(nested[2]!) as { message?: unknown };
      return describeStudioError(typeof parsed?.message === "string" ? parsed.message.slice(0, 1000) : undefined, Number(nested[1]));
    } catch { return "Dịch vụ chưa hoàn thành yêu cầu. Hãy thử lại sau."; }
  }
  // Giữ hướng dẫn tiếng Việt do ứng dụng tạo. Phản hồi thô có thể chứa chi tiết của nhà cung cấp.
  if (text.length <= 1000 && /[àáảãạăâđêôơưÀÁẢÃẠĂÂĐÊÔƠƯếềễệấầậờởợướừựịỉỷỹí]/i.test(text)
    && !/[{}<>]|https?:\/\/|\bHTTP\s*\d|\bBearer\b|[\p{Script=Han}]/u.test(text)) return text;
  if (status === 400 || status === 422) return "Nội dung hoặc định dạng chưa phù hợp. Hãy kiểm tra ý tưởng và tư liệu rồi thử lại.";
  if (status && status >= 500) return "Dịch vụ chưa hoàn thành yêu cầu. Hãy thử lại sau.";
  return "Chưa hoàn thành được thao tác. Hãy kiểm tra kết nối rồi thử lại.";
}

export class StudioRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code?: number) { super(message); }
}

export async function requestStudio<T>(url: string, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  headers.set("x-toonflow-workspace", "1");
  if (options?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000), ...options, headers });
  const result = await response.json().catch(() => null) as { code: number; message: string; data: T } | null;
  if (!result || typeof result.code !== "number") throw new StudioRequestError(describeStudioError(undefined, response.status), response.status);
  if (!response.ok || result.code !== 200) {
    const status = response.ok ? result.code : response.status;
    throw new StudioRequestError(describeStudioError(result.message, status), status, result.code);
  }
  return result.data;
}
