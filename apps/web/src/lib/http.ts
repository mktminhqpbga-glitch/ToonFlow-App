import axios from "axios";
import type { AxiosRequestConfig } from "axios";

type HttpRequestConfig = Pick<AxiosRequestConfig, "data" | "headers" | "params" | "signal" | "timeout"> & {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
};
type HttpResponse<T> = { code: number; data: T; message?: string };

export default async function http<T>(config: HttpRequestConfig): Promise<T> {
  if (!/^\/api\/[a-zA-Z0-9]+(?:\/[a-zA-Z0-9]+)*$/.test(config.url)) throw new Error("Yêu cầu phải dùng đường dẫn API cục bộ");
  try {
    const { data } = await axios.request<HttpResponse<T>>({
      timeout: 25000,
      ...config,
      headers: { ...config.headers, "x-toonflow-workspace": "1" },
    });
    if (!data || typeof data.code !== "number") throw new Error("Định dạng phản hồi API không hợp lệ");
    if (data.code !== 200) throw Object.assign(new Error(data.message || "Yêu cầu thất bại"), { status: data.code });
    return data.data;
  } catch (error) {
    if (axios.isCancel(error) || !axios.isAxiosError<{ message?: unknown }>(error)) throw error;
    const message = error.response?.data?.message;
    throw Object.assign(new Error(typeof message === "string" && message ? message : error.code === "ECONNABORTED"
      ? "Yêu cầu quá thời gian chờ, vui lòng thử lại" : "Yêu cầu thất bại; hãy kiểm tra kết nối mạng"), { status: error.response?.status });
  }
}
