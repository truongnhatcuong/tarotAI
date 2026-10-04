import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReadingId } from '../src/lib/reading-id';
import { readingSchema } from '../src/lib/validation';

const uuidV4=/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
test('reading IDs work with the native browser API',()=>{
  assert.match(createReadingId(),uuidV4);
});
test('without randomUUID, IDs remain unique and compatible with saved history',()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'crypto')!;
  const crypto=globalThis.crypto;
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues:crypto.getRandomValues.bind(crypto)}});
  try {
    const ids=Array.from({length:1000},()=>createReadingId());
    assert.equal(new Set(ids).size,ids.length);
    for(const id of ids)assert.match(id,uuidV4);
    const reading={
      id:ids[0],createdAt:new Date().toISOString(),
      profile:{name:'An',birthDate:'1997-05-14'},question:'Xem hành trình sắp tới',
      topic:'general',spreadId:'single',cards:[{cardId:'five-of-cups',orientation:'reversed',position:'Thông điệp'}],
      analysis:null,source:null,
    };
    assert.equal(readingSchema.safeParse(reading).success,true);
  } finally {Object.defineProperty(globalThis,'crypto',original);}
});
