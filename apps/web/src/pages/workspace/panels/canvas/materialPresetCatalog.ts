export type Kind = "image" | "video";
export type Preset = { id: string; title: string; description: string; kind: Kind; prompt: string };
export const presets: Preset[] = [
  { id: "storyboard", title: "Storyboard", description: "Bố cục bảng phân cảnh", kind: "image", prompt: "Tạo một bảng storyboard gồm 6 khung hình theo trình tự thời gian, kể rõ hành động nhân vật và chuyển động camera. Mỗi khung có chú thích cảnh. Giữ nhân vật, ánh sáng và phong cách nhất quán." },
  { id: "sequence", title: "Phân cảnh liên tục", description: "Diễn tiến hình ảnh", kind: "image", prompt: "Tạo một dải 4 khung hình thể hiện một hành động liên tục, giữ nguyên nhân vật và bối cảnh, thay đổi thời điểm của cùng một hành động. Phong cách điện ảnh, ánh sáng nhất quán." },
  { id: "nineAngles", title: "Chín góc máy", description: "Contact sheet 3 × 3", kind: "image", prompt: "Tạo contact sheet 3×3 với 9 góc máy khác nhau của cùng một nhân vật và cùng bối cảnh: toàn cảnh, trung cảnh, cận cảnh, góc thấp, góc cao, sau lưng, nghiêng trái, nghiêng phải, ngang mắt. Giữ ngoại hình không đổi." },
  { id: "threeViews", title: "Ba góc nhìn nhân vật", description: "Chính diện · nghiêng · sau lưng", kind: "image", prompt: "Tạo một bảng 3 ảnh của cùng nhân vật ở ba góc nhìn: chính diện, nghiêng 90 độ và sau lưng. Giữ đặc điểm nhận dạng, trang phục, tỷ lệ cơ thể và màu sắc nhất quán." },
  { id: "character", title: "Thiết lập nhân vật", description: "Ảnh tham chiếu nhân vật", kind: "image", prompt: "Tạo ảnh thiết lập toàn thân nhân vật trên nền đơn giản, mô tả rõ trang phục, đường nét và cấu trúc cơ thể, thêm hình trước, nghiêng và sau. Giữ danh tính và tạo hình thống nhất." },
  { id: "environment", title: "Thiết lập bối cảnh", description: "Khóa bố cục không gian", kind: "image", prompt: "Tạo ảnh thiết lập bối cảnh điện ảnh, thể hiện bố cục, vật thể chính, nguồn sáng, màu sắc và chiều sâu không gian. Không thay đổi các đặc điểm kiến trúc giữa các góc nhìn." },
  { id: "product", title: "Thiết lập sản phẩm", description: "Ảnh sản phẩm nhất quán", kind: "image", prompt: "Tạo bảng ảnh giới thiệu cùng một sản phẩm ở góc chính diện, ba phần tư và chi tiết. Giữ nguyên chất liệu, màu sắc, logo và kích thước tương đối của sản phẩm." },
  { id: "lighting", title: "Ánh sáng điện ảnh", description: "Thiết lập nguồn sáng", kind: "image", prompt: "Tạo ảnh điện ảnh với key light có chủ đích, fill light tinh tế, rim light tách nền, bóng đổ tự nhiên, độ sâu lớp cảnh rõ rệt và màu sắc nhất quán." },
  { id: "videoScene", title: "Video phân cảnh", description: "Một cảnh phim có mô tả máy quay", kind: "video", prompt: "Tạo một cảnh phim điện ảnh với hành động rõ ràng, bối cảnh nhất quán, camera chuyển động mượt và ánh sáng ổn định. Không tự thêm cảnh ngoài yêu cầu." },
];
export function findPresetNodeType(nodes: readonly { type: string }[], kind: Kind) {
  const expected = kind === "image" ? "remote-imageGenerationNode" : "remote-videoGenerationNode";
  return nodes.find(node => node.type === expected)?.type;
}
