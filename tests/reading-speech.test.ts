import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readingSpeechText, speechChunks, vietnameseVoices } from '../src/lib/reading-speech';
import { referenceAnalysis } from '../src/services/reading-client';
import type { Reading } from '../src/types/tarot';

const reading:Reading={
  id:crypto.randomUUID(),createdAt:new Date().toISOString(),source:'ai',
  profile:{name:'An',birthDate:'1997-05-14'},question:'Tôi cần chú ý gì trong công việc?',topic:'career',spreadId:'single',
  cards:[{cardId:'eight-of-pentacles',orientation:'reversed',position:'Thông điệp'}],analysis:null,
};
reading.analysis={...referenceAnalysis(reading),message:'Hãy điều chỉnh cách rèn luyện trước khi nhận thêm việc.',attention:'Làm rõ kỹ năng cần bổ sung.'};
function voice(name:string,lang:string,extra:Partial<SpeechSynthesisVoice>={}):SpeechSynthesisVoice{
  return {name,lang,voiceURI:name,default:false,localService:true,...extra};
}

test('only Vietnamese voices are selected, preferring Google over other installed voices',()=>{
  const englishGoogle=voice('Google US English','en-US',{default:true});
  const local=voice('Vietnamese device voice','vi-VN',{default:true});
  const google=voice('Google Tiếng Việt','vi-VN',{localService:false});
  const alternate=voice('Other Vietnamese','vi_VN');
  const voices=[englishGoogle,local,alternate,google];
  assert.deepEqual(vietnameseVoices(voices),[google,local,alternate]);
  assert.deepEqual(voices,[englishGoogle,local,alternate,google]);
  assert.deepEqual(vietnameseVoices([englishGoogle]),[]);
});
test('narration includes every visible section in order with the exact card orientation and position',()=>{
  const text=readingSpeechText(reading);
  const analysis=reading.analysis!;
  let previous=-1;
  for(const section of [analysis.overview,'Tám Tiền, lá ngược, vị trí Thông điệp.',...analysis.cards.map(card=>card.interpretation),analysis.connections,analysis.love,analysis.career,analysis.finance,analysis.attention,analysis.message,analysis.advice].filter(Boolean)){
    const index=text.indexOf(section!);
    assert.ok(index>previous,`Missing or misplaced section: ${section}`);
    previous=index;
  }
  assert.ok(!text.includes(reading.profile.birthDate));
});
test('older history still reads its entire analysis without missing-field placeholders',()=>{
  const older={...reading,analysis:referenceAnalysis(reading)};
  const text=readingSpeechText(older);
  assert.ok(text.includes(older.analysis.overview));
  assert.ok(text.endsWith(older.analysis.advice));
  assert.ok(!text.includes('undefined'));
  assert.ok(!text.includes('null'));
  assert.ok(!text.includes('Thông điệp dành cho bạn.'));
  assert.equal(readingSpeechText({...older,analysis:{...older.analysis,message:'  '}}),text);
  assert.equal(readingSpeechText({...reading,analysis:null}),'');
});
test('long accented readings are chunked without losing content or splitting emoji',()=>{
  const text=('Cơ hội mới cần đi cùng việc cân nhắc nguồn lực và cảm xúc của bạn. 🌙\n\n').repeat(100);
  const chunks=speechChunks(text);
  assert.ok(chunks.length>1);
  assert.ok(chunks.every(chunk=>chunk.length<=220));
  assert.equal(chunks.join(' '),text.replace(/\s+/g,' ').trim());
  assert.deepEqual(speechChunks('   '),[]);
  assert.throws(()=>speechChunks(text,0));
  const long=speechChunks('🌙'.repeat(300),221);
  assert.equal(long.join(''),'🌙'.repeat(300));
  assert.ok(long.every(chunk=>chunk.length<=221));
});
