import { i18n } from './i18n'
import { originalStylePrompts } from './originalStylePrompts'

// Translate only the upstream default fields so user-defined styles and edits keep their wording.
const presets = new Map([
  ['3d', {
    name: '3D 漫剧', description: '游戏引擎级 3D 渲染，半写实角色，当前短剧主流的 3D 漫剧质感',
    viName: 'Hoạt hình 3D', viDescription: 'Đồ họa 3D kiểu điện ảnh, nhân vật bán hiện thực.',
  }],
  ['anime', {
    name: '日漫赛璐璐', description: '日式赛璐璐动画风格',
    viName: 'Hoạt hình Nhật Bản', viDescription: 'Nét viền rõ, màu rực và đổ bóng theo mảng kiểu cel shading.',
  }],
  ['ghibli', {
    name: '吉卜力手绘', description: '吉卜力手绘治愈风',
    viName: 'Vẽ tay kiểu Ghibli', viDescription: 'Nét vẽ tay mềm mại, màu ấm và không khí hoài niệm.',
  }],
  ['watercolor', {
    name: '水彩绘本', description: '水彩插画质感',
    viName: 'Truyện tranh màu nước', viDescription: 'Minh họa màu nước với lớp màu trong và vân giấy nhẹ.',
  }],
  ['comic', {
    name: '美式漫画', description: '美式漫画粗线条风格',
    viName: 'Truyện tranh Mỹ', viDescription: 'Nét mực đậm, màu mạnh và tương phản cao.',
  }],
  ['guofeng', {
    name: '国风 2.5D', description: '国风动画/仙侠剧质感，2.5D 半写实',
    viName: 'Cổ phong Trung Hoa 2.5D', viDescription: 'Tạo hình bán hiện thực theo phong cách cổ trang và tiên hiệp.',
  }],
  ['webtoon', {
    name: '韩系网漫', description: '韩国条漫/网漫精致上色风',
    viName: 'Truyện tranh mạng Hàn Quốc', viDescription: 'Tô màu kỹ thuật số tinh tế, đổ bóng mềm và ánh sáng dịu.',
  }],
  ['noir', {
    name: '黑白漫画', description: '黑白漫/ Noir 高对比墨水风',
    viName: 'Truyện tranh đen trắng', viDescription: 'Nét mực đen trắng và tương phản mạnh theo phong cách noir.',
  }],
])

export function stylePresetName(value?: string, name?: string) {
  const preset = value ? presets.get(value) : undefined
  if (i18n.global.locale.value === 'vi' && preset && (!name || name === preset.name)) return preset.viName
  return name || value || ''
}

export function stylePresetDescription(style?: { value: string; description?: string | null }) {
  const preset = style ? presets.get(style.value) : undefined
  if (i18n.global.locale.value === 'vi' && preset && style?.description === preset.description) return preset.viDescription
  return style?.description || ''
}

const vietnamesePrompts = new Map([
  ['3d', 'Khung hình hoạt hình 3D chất lượng cao, dựng kiểu điện ảnh bằng công cụ đồ họa trò chơi hiện đại. Nhân vật cách điệu bán hiện thực với nét mặt tinh tế, hình thể rõ và da tán xạ ánh sáng nhẹ. Vật liệu phản xạ chân thực, vân sắc nét, ánh sáng thể tích và viền sáng mềm. Chiều sâu trường ảnh rõ, màu phim được tinh chỉnh, bối cảnh chi tiết và lấy nét rõ. Giữ tạo hình nhân vật nhất quán giữa các cảnh. Tránh ánh sáng phẳng, da bóng như nhựa, hình khối thô, mờ, nét viền hoạt hình Nhật Bản và đổ bóng 2D theo mảng.'],
  ['anime', 'Hoạt hình truyền hình Nhật Bản, đổ bóng theo mảng có biên rõ, nét viền đen đều và bảng màu rực. Nhân vật mắt to biểu cảm với tỷ lệ nhất quán. Phông nền vẽ tay nhiều chi tiết, ánh sáng chính kịch tính và điểm nhấn tram. Chất lượng như áp phích, giữ tạo hình nhân vật qua các cảnh. Tránh đồ họa 3D, tán màu mềm kiểu hội họa, vân màu nước, ảnh hiện thực và viền dày kiểu truyện tranh phương Tây.'],
  ['ghibli', 'Hoạt hình vẽ tay kiểu Studio Ghibli, đường nét thủ công tự nhiên, nét cọ mềm và nền màu nước ấm, phong phú. Ánh sáng ban ngày dịu với sắc ấm hoài niệm, bảng màu đất trầm và không khí ấm cúng như truyện cổ tích. Hạt phim nhẹ, nền chất lượng phim chiếu rạp, tạo hình nhất quán. Tránh bóng đổ theo mảng cứng, vẻ dựng 3D, màu neon quá rực, mép kỹ thuật số sắc và hiệu ứng ảnh chụp.'],
  ['watercolor', 'Minh họa truyện thiếu nhi bằng màu nước mỏng trong, vân giấy nhám hiện rõ. Nét cọ tay tự do, màu loang nhẹ, không khí thoáng và bảng màu phấn hài hòa. Giữ mép phóng khoáng và tạo hình nhân vật nhất quán. Tránh viền đen đậm, vẻ phun màu kỹ thuật số, tương phản gắt, dựng 3D và ảnh hiện thực.'],
  ['comic', 'Truyện tranh phương Tây kiểu tiểu thuyết đồ họa, viền mực đen chắc, đổ bóng chấm tram và chuyển tông tram. Màu rực, tương phản cao và đèn chiếu kịch tính. Bố cục điện ảnh năng động, chi tiết mực sắc và cảm giác bản in phẳng. Giữ tạo hình nhân vật nhất quán. Tránh pha màu mềm, loang màu nước, ảnh hiện thực, dựng 3D và đổ bóng theo mảng kiểu hoạt hình Nhật Bản.'],
  ['guofeng', 'Minh họa cổ phong Trung Hoa 2.5D, tạo hình bán hiện thực kiểu hoạt hình Trung Quốc. Nét thanh thoát, yếu tố thẩm mỹ truyền thống, nền nhiều lớp gợi tranh thủy mặc, lụa và vải tinh tế. Ánh sáng dịu qua màn sương nhẹ, bảng màu đá quý trầm như áp phích phim tiên hiệp. Giữ tạo hình qua các cảnh. Tránh bóng phẳng, mực truyện tranh phương Tây, ảnh hiện thực, bề mặt nhựa 3D và đồ dùng hay phục trang hiện đại nếu mô tả không yêu cầu.'],
  ['webtoon', 'Truyện tranh mạng Hàn Quốc, tô màu kỹ thuật số sạch với bóng chuyển mềm. Nhân vật dáng thanh, mắt to biểu cảm và điểm sáng rõ, da sáng dịu, ánh sáng mơ màng lãng mạn. Bảng màu từ phấn đến rực, vải và thời trang nhiều chi tiết, tạo hình nhân vật nhất quán giữa các cảnh. Tránh viền mực đen dày, chấm tram, vẻ dựng 3D, vân giấy màu nước và tỷ lệ đầu to mình nhỏ.'],
  ['noir', 'Truyện tranh đen trắng, nét mực đơn sắc tương phản mạnh, bóng gạch nét và đan nét. Mảng đen đậm phối với khoảng trắng kịch tính và tram chuyển xám. Nét mực biểu cảm, ánh sáng điện ảnh u tối và chất lượng trang truyện chuyên nghiệp. Giữ tạo hình nhất quán, chỉ dùng đen trắng và sắc xám. Tránh nhòe, viền mềm kiểu hội họa, ảnh hiện thực và dựng 3D.'],
])

export function stylePresetPrompt(style?: { value: string; prompt?: string | null }) {
  if (i18n.global.locale.value === 'vi' && style?.prompt && style.prompt === originalStylePrompts.get(style.value)) {
    return vietnamesePrompts.get(style.value) ?? style.prompt
  }
  return style?.prompt ?? ''
}
