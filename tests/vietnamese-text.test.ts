import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVietnameseInput, normalizeVietnameseText, normalizeAnalysis } from '../src/lib/vietnamese-text';
import { analysisSchema, requestSchema } from '../src/lib/validation';
import { verifyAnalysis } from '../src/services/ai';
import { referenceAnalysis, requestAnalysis } from '../src/services/reading-client';
import type { ReadingRequest } from '../src/types/tarot';

const request: ReadingRequest = {
  profile: {name:'Ngọc An',birthDate:'1997-05-14'}, question:'Tôi có nên nhận thêm việc khi đang quá tải?',
  topic:'career',spreadId:'single',cards:[{cardId:'ten-of-wands',orientation:'upright',position:'Thông điệp'}],
};
const messy = '  Chưa\u00a0 thuận ,\t vì đang quá tải .\n\n\nHãy giảm việc !Cần làm rõ nguồn lực .  '.normalize('NFD');
const clean = 'Chưa thuận, vì đang quá tải. Hãy giảm việc! Cần làm rõ nguồn lực.';
const dirtyAnalysis={...referenceAnalysis(request),overview:messy,attention:messy,message:messy,advice:messy,cards:request.cards.map(card=>({...card,interpretation:messy}))};

test('Vietnamese prose has stable accents, whitespace and punctuation without changing facts',()=>{
  assert.equal(normalizeVietnameseText(messy),clean);
  assert.equal(normalizeVietnameseText('Cần kiểm tra lại.Hãy đối chiếu số liệu.'),'Cần kiểm tra lại. Hãy đối chiếu số liệu.');
  const facts='Ngày 06/10/2026, lúc 09:30 tại TP.HCM; 2,5 triệu, 3.000.000 đồng, https://example.com/a.b.';
  assert.equal(normalizeVietnameseText(facts),facts);
  const links='Xem https://example.com/Doc.Page?foo=Bar&v=2,5 hoặc mailto:An.Ngoc@example.com và An.Ngoc@example.com.';
  assert.equal(normalizeVietnameseText(links),links);
  assert.equal(normalizeVietnameseText('“  Chưa rõ  ” (  cần kiểm tra  ).'),'“Chưa rõ” (cần kiểm tra).');
  assert.equal(normalizeVietnameseText('\uFEFFKhông\u200B chắc.\u0000'),'Không chắc.');
  assert.equal(normalizeVietnameseText(clean),clean);
  assert.equal(normalizeVietnameseText('Cạn kệt nguồn lực; tìm manh mốc; tránh lấn áp.'),'Cạn kiệt nguồn lực; tìm manh mối; tránh lấn át.');
  assert.equal(normalizeVietnameseText('CẠN KỆT'),'CẠN KIỆT');
  assert.equal(normalizeVietnameseInput('  Tái hợp?\nHay kết thúc? '),'Tái hợp? Hay kết thúc?');
});
test('response validation cleans every prose field while preserving card identities and negative meaning',()=>{
  const result=verifyAnalysis(dirtyAnalysis,request);
  for(const field of ['overview','attention','message','advice'] as const)assert.equal(result[field],clean);
  assert.equal(result.cards[0].interpretation,clean);
  assert.deepEqual(result.cards.map(({interpretation,...card})=>card),request.cards);
  assert.deepEqual(normalizeAnalysis(dirtyAnalysis),result);
  assert.equal(analysisSchema.safeParse({...dirtyAnalysis,message:' \u200B\n '}).success,false);
  assert.equal(analysisSchema.safeParse({...dirtyAnalysis,overview:5}).success,false);
});
test('client response and customer inputs use the same cleanup without changing the question',async()=>{
  const originalFetch=globalThis.fetch;
  try {
    globalThis.fetch=async()=>Response.json({analysis:dirtyAnalysis});
    const result=await requestAnalysis(request,new AbortController().signal);
    assert.equal(result.overview,clean);
    assert.equal(result.message,clean);
    const input=requestSchema.parse({...request,profile:{...request.profile,name:'  Ngọc\t An '},question:'  Tôi có nên\nnhận thêm việc khi đang quá tải?  '});
    assert.deepEqual(input,request);
  } finally {globalThis.fetch=originalFetch;}
});
