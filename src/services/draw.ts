import { TAROT_CARDS } from '@/data/tarot';
import { getSpread } from '@/data/spreads';
import type { DrawnCard, SpreadId } from '@/types/tarot';

// Rejection sampling avoids modulo bias. Crypto is available in modern browsers.
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max < 1 || max > 2 ** 32) throw new Error('Invalid random bound');
  const limit = Math.floor(2 ** 32 / max) * max;
  const buffer = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % max;
}
export function shuffledDeck(): string[] {
  const ids = TAROT_CARDS.map(card => card.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}
export function drawFromDeck(deck: readonly string[], index: number, spreadId: SpreadId, positionIndex: number, reversed: boolean): DrawnCard {
  const position = getSpread(spreadId).positions[positionIndex];
  if (!deck[index] || !position) throw new Error('Invalid card selection');
  return { cardId: deck[index], position, orientation: reversed && randomInt(2) === 1 ? 'reversed' : 'upright' };
}
