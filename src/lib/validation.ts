import { z } from 'zod';
import { CARD_BY_ID } from '@/data/tarot';
import { getSpread } from '@/data/spreads';
export function validBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value && value >= '1900-01-01' && value <= new Date().toISOString().slice(0,10);
}
export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Hãy nhập tên của bạn.').max(80, 'Tên tối đa 80 ký tự.'),
  birthDate: z.string().refine(validBirthDate, 'Ngày sinh không hợp lệ.'),
});
export const drawnSchema = z.object({
  cardId: z.string().refine(id => CARD_BY_ID.has(id), 'Lá bài không tồn tại.'),
  orientation: z.enum(['upright','reversed']), position: z.string().max(50),
});
export const requestSchema = z.object({
  profile: profileSchema, question: z.string().trim().min(5,'Câu hỏi cần ít nhất 5 ký tự.').max(1000,'Câu hỏi tối đa 1000 ký tự.'),
  topic: z.enum(['general','love','career','finance']), spreadId: z.enum(['single','three','love','career']),
  cards: z.array(drawnSchema).min(1).max(3),
}).superRefine((request, ctx) => {
  const spread = getSpread(request.spreadId);
  if (request.cards.length !== spread.positions.length) ctx.addIssue({ code: 'custom', message: 'Số lá không đúng với kiểu trải bài.', path: ['cards'] });
  if (new Set(request.cards.map(c => c.cardId)).size !== request.cards.length) ctx.addIssue({ code: 'custom', message: 'Không được trùng lá trong cùng lượt.', path: ['cards'] });
  request.cards.forEach((card, i) => {
    if (card.position !== spread.positions[i]) ctx.addIssue({ code: 'custom', message: 'Vị trí lá bài không hợp lệ.', path: ['cards', i] });
  });
});
const paragraph = z.string().trim().min(1).max(12000);
export const analysisSchema = z.object({
  overview: paragraph,
  cards: z.array(drawnSchema.extend({ interpretation: paragraph })).min(1).max(3),
  connections: paragraph, love: paragraph.nullable(), career: paragraph.nullable(), finance: paragraph.nullable(), advice: paragraph,
  // Older saved readings lack these sections. New AI responses require both.
  message: paragraph.optional(),
  attention: paragraph.optional(),
});
export const readingSchema = requestSchema.safeExtend({
  id: z.string().uuid(), createdAt: z.string().datetime(), analysis: analysisSchema.nullable(), source: z.enum(['ai','reference']).nullable(),
}).superRefine((reading, ctx) => {
  if ((reading.analysis === null) !== (reading.source === null)) {
    ctx.addIssue({ code:'custom', message:'Nguồn diễn giải không khớp dữ liệu lịch sử.', path:['source'] });
  }
  if (reading.analysis && (reading.analysis.cards.length !== reading.cards.length || reading.analysis.cards.some((card, i) => {
    const drawn = reading.cards[i];
    return !drawn || card.cardId !== drawn.cardId || card.orientation !== drawn.orientation || card.position !== drawn.position;
  }))) {
    ctx.addIssue({ code:'custom', message:'Diễn giải không khớp trải bài đã lưu.', path:['analysis'] });
  }
});
