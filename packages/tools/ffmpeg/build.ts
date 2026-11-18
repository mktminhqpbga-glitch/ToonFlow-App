import { createToolConfig } from "@toonflow/tools-scaffold";

await createToolConfig({
  name: "ffmpeg",
  displayName: "Xử lý media bằng FFmpeg",
  description: "Dùng FFmpeg trên máy xử lý video, âm thanh, ảnh trong workspace; dùng FFprobe để đọc thông tin media.",
  author: "Toonflow",
  github: "https://github.com/HBAI-Ltd/Toonflow-app",
  prompt: `Khi cần, dùng ffprobe xem thông số media thật trước khi xử lý; dùng steps trong ffmpeg để gọi chuỗi hàm fluent, chọn operation để chạy hoặc tra khả năng.
Tùy chọn, bộ lọc và danh sách tệp của FFmpeg giữ cú pháp gốc; công cụ không tự đổi đường dẫn đầu ra hoặc đặt timeout xử lý cố định. Chọn đích theo yêu cầu; dùng tên tệp mới trừ khi người dùng cho phép ghi đè.
Trước khi ghép media thời lượng cố định, dùng ffprobe xác nhận stream thật và xác định thời lượng T giây dương hữu hạn của từng đoạn và đầu ra dựa trên yêu cầu và timeline sau cắt/đổi tốc độ; không tự đoán. Với mỗi đầu ra đặt duration(T) hoặc outputOptions -t T; đây là thời lượng media, không phải timeout. Ảnh/âm thanh lặp và nguồn im lặng đều cần điều kiện kết thúc rõ.
Để bù im lặng đến thời lượng cố định, dùng apad=whole_dur=T, atrim=duration=T, asetpts=PTS-STARTPTS, thay T bằng số giây thật của đoạn; whole_dur bù âm thanh ngắn, atrim cắt âm thanh dài. Trước concat, mọi đoạn video/audio phải có thời lượng hữu hạn, đồng bộ và reset timestamp. Không để apad vô hạn chặn đoạn sau và không chỉ phụ thuộc -shortest để dừng.
Mọi đường dẫn tệp trong tham số, filter và danh sách media phải nằm trong workspace. Chỉ giao kết quả khi xử lý thành công, không coi khai báo đường dẫn là đã tạo tệp. Nếu FFmpeg chưa sẵn sàng, hướng dẫn cấu hình trong Chợ tiện ích.`,
  configRules: [],
}, import.meta.url);
