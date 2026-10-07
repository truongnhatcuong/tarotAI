import type { Analysis } from '@/types/tarot';

export function normalizeVietnameseInput(value: string): string {
  return value.normalize('NFC')
    .replace(/[\u0000-\u0008\u000E-\u001F\u007F]/g, '')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

// Observed, unambiguous spelling errors; avoid broad substitutions that could
// rewrite a customer's facts or an interpretation's meaning.
const SPELLING_CORRECTIONS = [['cạn kệt','cạn kiệt'],['manh mốc','manh mối'],['lấn áp','lấn át']] as const;

/** Normalize typography and known typos without reinterpreting the content. */
export function normalizeVietnameseText(value: string): string {
  // Preserve links and email addresses: their punctuation is data, not prose.
  return normalizeVietnameseInput(value)
    .split(/(https?:\/\/[^\s]+|mailto:[^\s]+|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,})/giu)
    .map((part, index) => index % 2 ? part : normalizeProseFragment(part))
    .join('').trim();
}

function normalizeProseFragment(value: string): string {
  let text = value
    .replace(/\s+([,.;:!?…])/gu, '$1')
    .replace(/([,;:!?…])(?=\p{L})/gu, '$1 ')
    // Join ordinary sentences without altering decimals or TP.HCM.
    .replace(/(\p{Ll}{2,}\.)(?=\p{Lu})/gu, '$1 ')
    .replace(/([“(\[])\s+/g, '$1')
    .replace(/\s+([”)\]])/g, '$1');
  for (const [mistake, correction] of SPELLING_CORRECTIONS) {
    text = text.replace(new RegExp(`(?<!\\p{L})${mistake}(?!\\p{L})`, 'giu'), match =>
      match === match.toUpperCase() ? correction.toUpperCase() : match[0] === match[0].toUpperCase() ? correction[0].toUpperCase() + correction.slice(1) : correction,
    );
  }
  return text;
}

export function normalizeAnalysis(analysis: Analysis): Analysis {
  return {
    ...analysis,
    overview: normalizeVietnameseText(analysis.overview),
    cards: analysis.cards.map(card => ({ ...card, interpretation: normalizeVietnameseText(card.interpretation) })),
    connections: normalizeVietnameseText(analysis.connections),
    love: analysis.love === null ? null : normalizeVietnameseText(analysis.love),
    career: analysis.career === null ? null : normalizeVietnameseText(analysis.career),
    finance: analysis.finance === null ? null : normalizeVietnameseText(analysis.finance),
    advice: normalizeVietnameseText(analysis.advice),
    ...(analysis.message === undefined ? {} : { message: normalizeVietnameseText(analysis.message) }),
    ...(analysis.attention === undefined ? {} : { attention: normalizeVietnameseText(analysis.attention) }),
  };
}
