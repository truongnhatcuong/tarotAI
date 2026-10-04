import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { TAROT_CARDS } from '../src/data/tarot';
import { SPREADS } from '../src/data/spreads';
import { shuffledDeck, drawFromDeck, randomInt } from '../src/services/draw';
import { requestSchema, validBirthDate } from '../src/lib/validation';
import { referenceAnalysis } from '../src/services/reading-client';
import type { ReadingRequest } from '../src/types/tarot';
import { RIDER_WAITE_FILENAMES } from '../src/data/rider-waite-images';

export const request:ReadingRequest={profile:{name:'An',birthDate:'1997-05-14'},question:'Tôi nên phát triển công việc như thế nào?',topic:'career',spreadId:'three',cards:[{cardId:'the-fool',orientation:'upright',position:'Quá khứ'},{cardId:'eight-of-pentacles',orientation:'reversed',position:'Hiện tại'},{cardId:'the-star',orientation:'upright',position:'Tương lai'}]};

test('78 unique canonical cards; complete major/minor suits and fields',()=>{
  assert.equal(TAROT_CARDS.length,78);assert.equal(new Set(TAROT_CARDS.map(c=>c.id)).size,78);
  assert.equal(TAROT_CARDS.filter(c=>c.arcana==='major').length,22);
  for(const suit of ['wands','cups','swords','pentacles'])assert.equal(TAROT_CARDS.filter(c=>c.suit===suit).length,14);
  for(const card of TAROT_CARDS){assert.ok(card.name&&card.nameVi&&card.uprightMeaning&&card.reversedMeaning&&card.image);assert.ok(card.keywords.length>=3);for(const topic of ['love','career','finance'] as const)assert.ok(card[topic].upright&&card[topic].reversed);}
  assert.equal(new Set(TAROT_CARDS.map(c=>c.uprightMeaning)).size,78);
});
test('every image is a unique actual PNG path with no synthetic front',async()=>{
  assert.equal(new Set(TAROT_CARDS.map(c=>c.image)).size,78);
  for(const card of TAROT_CARDS){assert.ok(card.image.endsWith('.png'));assert.ok(!/\.svg|placeholder|data:/i.test(card.image));if(card.image.startsWith('/'))await access('public'+card.image);else assert.ok(card.image.startsWith('https://cdn.jsdelivr.net/npm/@cometpisces/tarot-kit-images@0.2.0/images/'));}
});
test('specific requested card IDs map to their correct documented PNG filenames',()=>{
  const expected={'the-fool':'00-TheFool.png','the-magician':'01-TheMagician.png','ace-of-cups':'Cups01.png','death':'13-Death.png','the-world':'21-TheWorld.png'};
  for(const [id,filename] of Object.entries(expected)){assert.equal(RIDER_WAITE_FILENAMES[id],filename);assert.ok(TAROT_CARDS.find(c=>c.id===id)!.image.endsWith('/'+filename));}
});
test('shuffle includes all 78 exactly once and each spread draws distinct cards',()=>{
  for(let n=0;n<100;n++){
    const deck=shuffledDeck();assert.equal(deck.length,78);assert.equal(new Set(deck).size,78);
    for(const spread of SPREADS){const cards=spread.positions.map((_,i)=>drawFromDeck(deck,i,spread.id,i,true));assert.equal(new Set(cards.map(c=>c.cardId)).size,cards.length);assert.deepEqual(cards.map(c=>c.position),[...spread.positions]);assert.ok(cards.every(c=>c.orientation==='upright'||c.orientation==='reversed'));}
  }
});
test('upright-only setting is enforced and selected deck identity preserved',()=>{
  const deck=shuffledDeck();const original=[...deck];
  for(let i=0;i<78;i++){const c=drawFromDeck(deck,i,'single',0,false);assert.equal(c.cardId,deck[i]);assert.equal(c.orientation,'upright');}
  assert.deepEqual(deck,original);assert.throws(()=>randomInt(0));assert.throws(()=>drawFromDeck(deck,78,'single',0,true));
});
test('calendar date validation rejects normalized invalid dates and future dates',()=>{
  assert.ok(validBirthDate('2000-02-29'));assert.equal(validBirthDate('2001-02-29'),false);assert.equal(validBirthDate('1999-02-30'),false);assert.equal(validBirthDate('2999-01-01'),false);assert.equal(validBirthDate('1899-01-01'),false);
});
test('API input rejects duplicate cards, wrong positions and counts',()=>{
  assert.ok(requestSchema.safeParse(request).success);
  assert.equal(requestSchema.safeParse({...request,cards:[request.cards[0],{...request.cards[1],cardId:request.cards[0].cardId},request.cards[2]]}).success,false);
  assert.equal(requestSchema.safeParse({...request,cards:request.cards.slice(0,1)}).success,false);
  assert.equal(requestSchema.safeParse({...request,cards:request.cards.map(c=>({...c,position:'fake'}))}).success,false);
});
test('reference reading uses exact IDs and reversed canonical meaning',()=>{
  const result=referenceAnalysis(request);assert.deepEqual(result.cards.map(c=>c.cardId),request.cards.map(c=>c.cardId));
  assert.equal(result.cards[1].interpretation,TAROT_CARDS.find(c=>c.id==='eight-of-pentacles')!.reversedMeaning);assert.ok(result.career);assert.equal(result.love,null);assert.equal(result.finance,null);
});
