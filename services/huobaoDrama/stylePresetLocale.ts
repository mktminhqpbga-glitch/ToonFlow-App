import { i18n } from './i18n'

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
