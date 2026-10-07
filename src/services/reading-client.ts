import { getCard } from '@/data/tarot';
import { analysisSchema } from '@/lib/validation';
import { normalizeAnalysis } from '@/lib/vietnamese-text';
import type { Analysis, ReadingRequest } from '@/types/tarot';
export async function requestAnalysis(request: ReadingRequest, signal: AbortSignal): Promise<Analysis> {
  const response = await fetch('/api/reading', {
    method:'POST',headers:{'Content-Type':'application/json'},signal,
    body:JSON.stringify(request),
  });
  let result: {error?:string;analysis?:unknown};
  try { result = await response.json(); }
  catch { throw new Error('Dịch vụ chưa trả về dữ liệu hợp lệ. Các lá đã rút vẫn được giữ nguyên; hãy thử lại.'); }
  if (!response.ok) throw new Error(result.error ?? 'Không thể phân tích. Hãy thử lại.');
  const parsed = analysisSchema.safeParse(result.analysis);
  if (!parsed.success) throw new Error('Kết quả AI chưa hợp lệ. Các lá đã rút vẫn được giữ nguyên; hãy thử phân tích lại.');
  const analysis = parsed.data;
  if (!analysis.message) throw new Error('Kết quả AI chưa có thông điệp cho câu hỏi của bạn. Các lá đã mở vẫn được giữ nguyên; hãy thử lại.');
  if (!analysis.attention) throw new Error('Kết quả AI chưa nêu điều bạn cần chú ý. Các lá đã mở vẫn được giữ nguyên; hãy thử lại.');
  if (analysis.cards.length !== request.cards.length || analysis.cards.some((c,i)=>c.cardId!==request.cards[i].cardId || c.orientation!==request.cards[i].orientation || c.position!==request.cards[i].position)) throw new Error('Kết quả không khớp trải bài. Hãy thử lại.');
  return analysis;
}
export function referenceAnalysis(request: ReadingRequest): Analysis {
  const cards = request.cards.map(drawn => {
    const card = getCard(drawn.cardId);
    return {...drawn,interpretation:drawn.orientation==='upright' ? card.uprightMeaning : card.reversedMeaning};
  });
  const theme = (topic:'love'|'career'|'finance')=>request.cards.map(d=>`${getCard(d.cardId).nameVi}: ${getCard(d.cardId)[topic][d.orientation]}`).join('\n\n');
  return normalizeAnalysis({
    overview:'Đây là bản tra cứu ý nghĩa chuẩn, không phải phân tích AI theo câu hỏi cá nhân. Hãy dùng các biểu tượng như lời gợi mở để suy ngẫm về hoàn cảnh của bạn.',
    cards,
    connections: request.cards.length===1 ? 'Hãy đối chiếu ý nghĩa của lá với câu hỏi của bạn. Một lá bài gợi một góc nhìn, không quyết định kết quả.' : request.cards.map(d=>`${d.position}: ${getCard(d.cardId).keywords.join(', ')} (${d.orientation==='upright'?'xuôi':'ngược'})`).join(' → ') + '. Bạn có thể xem các chủ đề này bổ sung hoặc đối lập ra sao; bản tra cứu chưa phân tích mối liên hệ theo ngữ cảnh.',
    love:request.topic==='love'||request.spreadId==='love'?theme('love'):null,
    career:request.topic==='career'||request.spreadId==='career'?theme('career'):null,
    finance:request.topic==='finance'?theme('finance'):null,
    advice:'Chọn một điều trong ý nghĩa lá bài khiến bạn suy ngẫm. Ghi lại thông tin thực tế bạn đã biết, điều cần làm rõ và một bước nhỏ bạn có thể tự quyết định.',
  });
}
