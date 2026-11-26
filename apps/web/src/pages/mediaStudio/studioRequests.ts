export function describeStudioError(message?: string) {
  if (!message) return "Nhà cung cấp chưa gửi chi tiết lỗi.";
  if (/参考素材上传未确认|reference.*upload.*not.confirmed/i.test(message)) {
    return "Muse chưa xác nhận ảnh tham chiếu. Hãy kiểm tra ảnh trước khi thử lại.";
  }
  if (/ProxyError|账号代理请求失败/i.test(message)) return "Dịch vụ AI không kết nối được qua proxy. Hãy kiểm tra kết nối và xác thực proxy của tài khoản.";
  if (/请先在媒体模型设置|configure the provider API key/i.test(message)) return "Chưa cấu hình API Key của mô hình. Hãy mở Cài đặt mô hình hoặc chọn mô hình khác.";
  const details = /^\d{3}:\s*(\{.{1,2000}\})$/s.exec(message);
  if (details) {
    try {
      const parsed = JSON.parse(details[1]!) as { message?: string };
      if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
    } catch { /* Giữ nguyên nội dung nếu phần chi tiết không đọc được. */ }
  }
  if (/生成任务不存在/.test(message)) return "Máy chủ chưa tìm thấy tác vụ này.";
  if (/参数错误/.test(message)) return "Yêu cầu có thông số chưa hợp lệ. Hãy kiểm tra mẫu luồng, mô hình và tư liệu đã chọn.";
  return message;
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
  if (!result || typeof result.code !== "number") throw new StudioRequestError(`Máy chủ trả phản hồi không đọc được (HTTP ${response.status}).`, response.status);
  if (!response.ok || result.code !== 200) throw new StudioRequestError(describeStudioError(result.message), response.status, result.code);
  return result.data;
}
