import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUserPrompt } from '../src/lib/ai-prompt';
import { TAROT_CARDS, getCard } from '../src/data/tarot';
import { REVERSED_TOPICS } from '../src/data/reversed-topics';
import { normalizeVietnameseText } from '../src/lib/vietnamese-text';
import { TAROT_EVALUATION_CASES } from './fixtures/tarot-evaluation-cases';

test('all 78 cards have independent reversed topic data with no appended upright advice',()=>{
  assert.deepEqual(Object.keys(REVERSED_TOPICS).sort(),TAROT_CARDS.map(card=>card.id).sort());
  for(const card of TAROT_CARDS){
    for(const topic of ['love','career','finance'] as const){
      const meaning=card[topic].reversed;
      assert.ok(meaning.length>20);
      assert.notEqual(meaning,card[topic].upright);
      assert.ok(!meaning.includes('Gợi ý trong lĩnh vực này:'));
      assert.equal(meaning,normalizeVietnameseText(meaning));
    }
  }
  assert.match(getCard('eight-of-pentacles').career.reversed,/máy móc.*chất lượng giảm/);
  assert.match(getCard('the-lovers').love.reversed,/Bất đồng.*cam kết/);
  assert.match(getCard('the-devil').finance.reversed,/giảm nợ.*chưa bảo đảm/);
});
for(const fixture of TAROT_EVALUATION_CASES){
  test(`${fixture.id}: prompt preserves the question and supplies only the actual orientation`,()=>{
    const prompt=JSON.parse(buildUserPrompt(fixture.request));
    assert.deepEqual(prompt.USER_CONTEXT,{profile:fixture.request.profile,question:fixture.request.question,topic:fixture.request.topic});
    assert.deepEqual(prompt.DRAWN_CARDS,fixture.request.cards);
    for(const [index,drawn] of fixture.request.cards.entries()){
      const data=prompt.STANDARD_CARD_DATA[index];
      const card=getCard(drawn.cardId);
      assert.equal(data.meaningForOrientation,drawn.orientation==='upright'?card.uprightMeaning:card.reversedMeaning);
      for(const topic of ['love','career','finance'] as const)assert.equal(data.topicMeaningsForOrientation[topic],card[topic][drawn.orientation]);
      assert.equal(data.card.uprightMeaning,undefined);
      assert.equal(data.card.reversedMeaning,undefined);
      assert.equal(data.card.keywords,undefined);
    }
  });
}
