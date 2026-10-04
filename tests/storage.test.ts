import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProfile, saveProfile, loadHistory, saveHistory, forgetProfile, HISTORY_LIMIT } from '../src/services/storage';
import { referenceAnalysis } from '../src/services/reading-client';
import type { Reading } from '../src/types/tarot';

function reading(): Reading {
  return {
    id:crypto.randomUUID(),createdAt:new Date().toISOString(),
    profile:{name:'An',birthDate:'1997-05-14'},
    question:'Tôi nên chú ý điều gì trong công việc?',topic:'career',spreadId:'single',
    cards:[{cardId:'the-magician',orientation:'reversed',position:'Thông điệp'}],
    analysis:null,source:null,
  };
}
function withStorage(run:(items:Map<string,string>)=>void) {
  const items=new Map<string,string>();
  const storage:Storage={
    get length(){return items.size;}, clear(){items.clear();},
    getItem(key){return items.get(key)??null;},setItem(key,value){items.set(key,value);},
    removeItem(key){items.delete(key);},key(index){return [...items.keys()][index]??null;},
  };
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
  try{run(items);}finally{
    if(original)Object.defineProperty(globalThis,'localStorage',original);
    else Reflect.deleteProperty(globalThis,'localStorage');
  }
}

test('profile restores exact values and can be forgotten',()=>withStorage(()=>{
  const profile={name:'Ngọc An',birthDate:'1997-05-14'};
  assert.equal(loadProfile(),null);saveProfile(profile);assert.deepEqual(loadProfile(),profile);
  forgetProfile();assert.equal(loadProfile(),null);
}));
test('history retains IDs, orientations and analysis while limiting to 30',()=>withStorage(()=>{
  const entries=Array.from({length:HISTORY_LIMIT+5},reading);
  entries[0].analysis=referenceAnalysis(entries[0]);entries[0].source='reference';
  saveHistory(entries);const loaded=loadHistory();assert.equal(loaded.length,HISTORY_LIMIT);
  assert.deepEqual(loaded,entries.slice(0,HISTORY_LIMIT));
}));
test('AI history restores both older readings and new readings with a message',()=>withStorage(()=>{
  const older=reading();older.analysis=referenceAnalysis(older);older.source='ai';
  const current=reading();current.analysis={...referenceAnalysis(current),attention:'Làm rõ nguồn lực còn thiếu trước khi triển khai.',message:'Kiểm tra nguồn lực và khả năng thực hiện trước khi bắt đầu.'};current.source='ai';
  saveHistory([current,older]);
  assert.deepEqual(loadHistory(),[current,older]);
}));
test('invalid JSON and corrupt profile are ignored without crashing',()=>withStorage(items=>{
  items.set('arcana:profile:v1','{');items.set('arcana:history:v1','{');
  assert.equal(loadProfile(),null);assert.deepEqual(loadHistory(),[]);
  items.set('arcana:profile:v1',JSON.stringify({name:'An',birthDate:'1997-02-30'}));
  assert.equal(loadProfile(),null);
}));
test('history rejects swapped identities, wrong source and duplicate draws',()=>withStorage(items=>{
  const good=reading();good.analysis=referenceAnalysis(good);good.source='reference';
  const wrongCard=structuredClone(good);wrongCard.analysis!.cards[0].cardId='the-fool';
  const wrongDirection=structuredClone(good);wrongDirection.analysis!.cards[0].orientation='upright';
  const wrongSource={...good,source:null};
  const duplicates={...good,spreadId:'three',cards:[...good.cards,...good.cards,...good.cards]};
  items.set('arcana:history:v1',JSON.stringify([wrongCard,wrongDirection,wrongSource,duplicates,good]));
  assert.deepEqual(loadHistory(),[good]);
}));
test('denied storage reads degrade gracefully; write failures are surfaced',()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('Access denied');}});
  try{
    assert.equal(loadProfile(),null);assert.deepEqual(loadHistory(),[]);
    assert.throws(()=>saveProfile(reading().profile),/Access denied/);
    assert.throws(()=>saveHistory([reading()]),/Access denied/);
  }finally{
    if(original)Object.defineProperty(globalThis,'localStorage',original);
    else Reflect.deleteProperty(globalThis,'localStorage');
  }
});
