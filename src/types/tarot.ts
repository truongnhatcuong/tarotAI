export type Suit = 'wands' | 'cups' | 'swords' | 'pentacles';
export type Orientation = 'upright' | 'reversed';
export type SpreadId = 'single' | 'three' | 'love' | 'career';
export type Topic = 'general' | 'love' | 'career' | 'finance';
export type MeaningPair = { upright: string; reversed: string };
export interface TarotCard {
  id: string; name: string; nameVi: string;
  arcana: 'major' | 'minor'; suit: Suit | null; number: number;
  keywords: string[]; uprightMeaning: string; reversedMeaning: string;
  love: MeaningPair; career: MeaningPair; finance: MeaningPair; image: string;
}
export interface Profile { name: string; birthDate: string }
export interface DrawnCard { cardId: string; orientation: Orientation; position: string }
export interface ReadingRequest { profile: Profile; question: string; topic: Topic; spreadId: SpreadId; cards: DrawnCard[] }
export interface CardInterpretation { cardId: string; orientation: Orientation; position: string; interpretation: string }
export interface Analysis {
  overview: string; cards: CardInterpretation[]; connections: string;
  love: string | null; career: string | null; finance: string | null; advice: string;
  message?: string;
}
export interface Reading extends ReadingRequest {
  id: string; createdAt: string; analysis: Analysis | null; source: 'ai' | 'reference' | null;
}
