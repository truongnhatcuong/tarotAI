import type { SpreadId } from '@/types/tarot';
export const SPREADS = [
  { id: 'single', name: 'Thông điệp hôm nay', label: '1 lá', description: 'Một góc nhìn cho điều bạn đang nghĩ.', positions: ['Thông điệp'], icon: 'star' },
  { id: 'three', name: 'Dòng chảy thời gian', label: '3 lá', description: 'Nhìn lại, thấu hiểu và mở ra hướng đi.', positions: ['Quá khứ', 'Hiện tại', 'Tương lai'], icon: 'moon' },
  { id: 'love', name: 'Chuyện tình yêu', label: '3 lá', description: 'Lắng nghe bản thân và sự kết nối.', positions: ['Bạn', 'Sự kết nối', 'Hướng phát triển'], icon: 'heart' },
  { id: 'career', name: 'Con đường sự nghiệp', label: '3 lá', description: 'Khám phá tiềm năng và bước tiếp theo.', positions: ['Hiện trạng', 'Thử thách', 'Hướng hành động'], icon: 'compass' },
] as const;
export function getSpread(id: SpreadId) { return SPREADS.find(s => s.id === id)!; }
