import type { TarotCard, Suit, MeaningPair } from '@/types/tarot';
import { majorSeeds, minorSeeds } from './card-seeds';
import manifest from './image-manifest.json';

const ranks = ['', 'Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen', 'King'];
const ranksVi = ['', 'Át', 'Hai', 'Ba', 'Bốn', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín', 'Mười', 'Tiểu Đồng', 'Kỵ Sĩ', 'Hoàng Hậu', 'Vua'];
const suitsVi: Record<Suit, string> = { wands: 'Gậy', cups: 'Cốc', swords: 'Kiếm', pentacles: 'Tiền' };
const imageMap = manifest.images as Record<string, string>;
function image(id: string) {
  const path=imageMap[id];
  if(!path||!path.endsWith('.png'))throw new Error(`Missing Rider–Waite PNG artwork for ${id}`);
  return path;
}
function pair(context: string, reversed: string): MeaningPair {
  return { upright: context, reversed: `${reversed} Gợi ý trong lĩnh vực này: ${context}` };
}
export const TAROT_CARDS: TarotCard[] = [
  ...majorSeeds.map((s, number): TarotCard => ({
    id: s[0], name: s[1], nameVi: s[2], number, arcana: 'major', suit: null,
    keywords: s[3].split(','), uprightMeaning: s[4], reversedMeaning: s[5],
    love: pair(s[6], s[5]), career: pair(s[7], s[5]), finance: pair(s[8], s[5]), image: image(s[0]),
  })),
  ...(Object.entries(minorSeeds) as [Suit, typeof minorSeeds.wands][]).flatMap(([suit, seeds]) => seeds.map((s): TarotCard => {
    const id = `${ranks[s[0]].toLowerCase()}-of-${suit}`;
    return { id, name: `${ranks[s[0]]} of ${suit[0].toUpperCase()+suit.slice(1)}`, nameVi: `${ranksVi[s[0]]} ${suitsVi[suit]}`, arcana: 'minor', suit, number: s[0], keywords: s[1].split(','), uprightMeaning: s[2], reversedMeaning: s[3], love: pair(s[4], s[3]), career: pair(s[5], s[3]), finance: pair(s[6], s[3]), image: image(id) };
  })),
];
export const CARD_BY_ID = new Map(TAROT_CARDS.map(card => [card.id, card]));
export function getCard(id: string): TarotCard {
  const card = CARD_BY_ID.get(id);
  if (!card) throw new Error(`Unknown card ID: ${id}`);
  return card;
}
export const IMAGE_SOURCE = manifest.source;
