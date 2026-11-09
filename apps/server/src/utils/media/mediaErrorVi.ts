import { getLocale, translateMessage } from "@/lib/i18n";

// Keep protocol IDs and original non-Vietnamese errors unchanged.
// Translate only fixed, user-visible media failures, never user prompts or provider output.
export const viMediaErrorTranslations: Record<string, string> = {
  "多租户媒体生成必须通过持久任务提交": "Tác vụ media nhiều người dùng phải được gửi qua hàng đợi bền vững",
  "多租户模型路由尚未开启": "Định tuyến model nhiều người dùng chưa được bật",
  "参考媒体须为不超过 100 MB 的文件": "Tệp tham chiếu phải có dung lượng tối đa 100 MB",
  "参考媒体为空或超过 100 MB": "Tệp tham chiếu rỗng hoặc vượt quá 100 MB",
  "生成结果必须使用 HTTP 或 HTTPS 地址": "Đầu ra media phải sử dụng địa chỉ HTTP hoặc HTTPS",
  "生成文件不能超过 100 MB": "Tệp media tạo ra không được vượt quá 100 MB",
  "生成结果为空": "AI không trả về tệp media",
  "供应商返回的媒体类型不正确": "Nhà cung cấp trả về loại media không khớp",
  "生成结果的 base64 内容无效或超过 100 MB": "Nội dung base64 của kết quả không hợp lệ hoặc vượt quá 100 MB",
  "供应商返回了无效的媒体结果": "Nhà cung cấp trả về kết quả media không hợp lệ",
  "生成文件为空或超过 100 MB": "Tệp media tạo ra rỗng hoặc vượt quá 100 MB",
  "生成结果不是支持的图片、视频或音频格式": "Định dạng ảnh, video hoặc âm thanh đầu ra không được hỗ trợ",
  "参考媒体需要工作目录": "Ảnh hoặc video tham chiếu cần một workspace hợp lệ",
  "所选媒体模型不存在或类型不匹配，请重新选择": "Model đã chọn không tồn tại hoặc không đúng loại media; hãy chọn lại",
  "读取参考媒体信息超时，请稍后重试": "Hết thời gian đọc thông tin media tham chiếu; hãy thử lại",
  "请输入生成提示词": "Hãy nhập prompt để tạo media",
  "任务结果文件记录与原生成请求不匹配": "Bản ghi tệp kết quả không khớp yêu cầu ban đầu",
  "任务结果文件已被修改，不能覆盖": "Tệp kết quả đã bị thay đổi; không thể ghi đè",
  "该任务没有可恢复的供应商凭据，不能重新提交生成": "Tác vụ không có thông tin khôi phục nhà cung cấp; không được gửi tạo lại",
  "请先在媒体模型设置中配置供应商 API Key": "Hãy cấu hình API key của nhà cung cấp trong Cài đặt model media",
  "供应商未返回生成结果": "Nhà cung cấp chưa trả về kết quả tạo media",
  "恢复任务的结果数量发生变化": "Số lượng kết quả đã thay đổi khi khôi phục tác vụ",
};

export function mediaErrorText(message: string, language = getLocale()) {
  if (language === "vi") return viMediaErrorTranslations[message] ?? translateMessage(message);
  return translateMessage(message);
}
