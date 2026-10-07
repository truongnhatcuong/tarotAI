import { getCard } from '@/data/tarot';
import type { Reading } from '@/types/tarot';
import { normalizeAnalysis } from './vietnamese-text';

export function vietnameseVoices(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const score = (voice: SpeechSynthesisVoice) => (/google/i.test(voice.name) ? 20 : 0) + (voice.default ? 5 : 0) + (voice.localService ? 1 : 0);
  return voices.filter(voice => /^vi(?:[-_]|$)/i.test(voice.lang)).sort((a, b) => score(b) - score(a));
}

export function readingSpeechText(reading: Reading): string {
  if (!reading.analysis) return '';
  const analysis = normalizeAnalysis(reading.analysis);
  const sections = [analysis.overview, 'Phân tích từng lá.'];
  for (const card of analysis.cards) {
    sections.push(`${getCard(card.cardId).nameVi}, ${card.orientation === 'upright' ? 'lá xuôi' : 'lá ngược'}, vị trí ${card.position}.`, card.interpretation);
  }
  sections.push(reading.cards.length === 1 ? 'Liên hệ với câu hỏi.' : 'Liên kết giữa các lá.', analysis.connections);
  if (analysis.love) sections.push('Tình yêu.', analysis.love);
  if (analysis.career) sections.push('Công việc.', analysis.career);
  if (analysis.finance) sections.push('Tài chính.', analysis.finance);
  if (analysis.attention?.trim()) sections.push('Điều bạn cần chú ý.', analysis.attention);
  if (analysis.message?.trim()) sections.push('Thông điệp dành cho bạn.', analysis.message);
  sections.push('Lời khuyên dành cho bạn.', analysis.advice);
  return sections.map(section => section.trim()).filter(Boolean).join('\n\n');
}

/** Small utterances prevent long readings from exceeding voice-engine limits. */
export function speechChunks(text: string, maxLength = 220): string[] {
  if (!Number.isInteger(maxLength) || maxLength < 2) throw new Error('Invalid speech chunk size');
  let remaining = text.replace(/\s+/g, ' ').trim();
  const chunks: string[] = [];
  while (remaining.length > maxLength) {
    let end = remaining.lastIndexOf(' ', maxLength);
    if (end < 1) {
      end = maxLength;
      // Preserve surrogate pairs when an unusually long word contains emoji.
      if (/[\uD800-\uDBFF]/.test(remaining[end - 1])) end--;
    }
    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
