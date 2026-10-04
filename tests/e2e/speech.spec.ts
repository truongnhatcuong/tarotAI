import { test, expect, type Page } from '@playwright/test';
import type { Reading } from '../../src/types/tarot';

const reading:Reading={
  id:crypto.randomUUID(),createdAt:new Date().toISOString(),profile:{name:'An',birthDate:'1997-05-14'},
  question:'Tôi nên chú ý điều gì trong công việc?',topic:'career',spreadId:'single',source:'ai',
  cards:[{cardId:'eight-of-pentacles',orientation:'reversed',position:'Thông điệp'}],
  analysis:{
    overview:'Cần điều chỉnh cách rèn luyện để tiến bộ trong công việc.',
    cards:[{cardId:'eight-of-pentacles',orientation:'reversed',position:'Thông điệp',interpretation:'Cách làm hiện tại đang cần được rà soát để tránh lặp lại sai sót.'}],
    connections:'Lá này gợi ý chú ý chất lượng thay vì chỉ tăng khối lượng công việc.',
    love:null,career:'Hãy xác định kỹ năng cần cải thiện trước khi nhận thêm trách nhiệm.',finance:null,
    attention:'Làm rõ điều kiện thực hiện bước tiếp theo.',
    message:'Hãy dành thời gian điều chỉnh cách rèn luyện của mình.',
    advice:'Chọn một kỹ năng cụ thể và đặt lịch thực hành trong tuần này.',
  },
};
const voices=[
  {name:'Google US English',lang:'en-US',voiceURI:'english',default:true,localService:false},
  {name:'Giọng Việt của thiết bị',lang:'vi-VN',voiceURI:'device-vi',default:false,localService:true},
  {name:'Google Tiếng Việt',lang:'vi-VN',voiceURI:'google-vi',default:false,localService:false},
];

async function openSpeech(page:Page,mode:'normal'|'late'|'unsupported'|'english'='normal',savedReading:Reading=reading){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(({reading,voices,mode})=>{
    localStorage.setItem('arcana:history:v1',JSON.stringify([reading]));
    if(mode==='unsupported'){
      Object.defineProperty(window,'speechSynthesis',{value:undefined,configurable:true});
      Object.defineProperty(window,'SpeechSynthesisUtterance',{value:undefined,configurable:true});
      return;
    }
    class Utterance {
      text:string;voice:typeof voices[number]|null=null;lang='';rate=1;pitch=1;
      onend:(()=>void)|null=null;onerror:((event:{error:string})=>void)|null=null;
      constructor(text:string){this.text=text;}
    }
    const spoken:Utterance[]=[];
    const synth=new EventTarget() as EventTarget & {getVoices:()=>typeof voices;speak:(utterance:Utterance)=>void;cancel:()=>void};
    let available=mode==='late'?[]:mode==='english'?[voices[0]]:voices;
    let canceled=0;
    synth.getVoices=()=>available;
    synth.speak=utterance=>spoken.push(utterance);
    synth.cancel=()=>{canceled++;for(const utterance of spoken)utterance.onerror?.({error:'canceled'});};
    Object.defineProperty(window,'speechSynthesis',{value:synth,configurable:true});
    Object.defineProperty(window,'SpeechSynthesisUtterance',{value:Utterance,configurable:true});
    Object.assign(window,{__speech:{
      spoken,
      get canceled(){return canceled;},
      loadVoices:()=>{available=voices;synth.dispatchEvent(new Event('voiceschanged'));},
      finish:(index=spoken.length-1)=>spoken[index]?.onend?.(),
      fail:()=>spoken.at(-1)?.onerror?.({error:'network'}),
    }});
  },{reading:savedReading,voices,mode});
  await page.goto('/');
  await page.getByRole('button',{name:/Nhật ký/}).click();
  await page.getByRole('button',{name:'Xem lại'}).click();
  return page.getByRole('group',{name:'Nghe lời giải Tarot'});
}
type Probe={spoken:{text:string;lang:string;rate:number;voice:{voiceURI:string}}[];canceled:number;loadVoices:()=>void;finish:(index?:number)=>void;fail:()=>void};
async function probe(page:Page){return page.evaluate(()=>{
  const value=(window as unknown as {__speech:Probe}).__speech;
  return {spoken:value.spoken.map(item=>({text:item.text,lang:item.lang,rate:item.rate,voiceURI:item.voice.voiceURI})),canceled:value.canceled};
});}
test('one button reads the entire AI analysis through the final advice; stop and replay work without AI requests',async({page},testInfo)=>{
  let aiCalls=0;
  await page.route('**/api/reading',route=>{aiCalls++;return route.abort();});
  const player=await openSpeech(page);
  await expect(player.getByRole('combobox')).toHaveCount(0);
  await expect(player.getByRole('button')).toHaveCount(1);
  expect((await probe(page)).spoken).toHaveLength(0);
  await player.getByRole('button',{name:'Nghe thông điệp',exact:true}).click();
  const value=await probe(page);
  expect(value.spoken.length).toBeGreaterThan(1);
  expect(value.spoken.every(item=>item.lang==='vi-VN'&&item.rate===1&&item.voiceURI==='google-vi')).toBeTruthy();
  const text=value.spoken.map(item=>item.text).join(' ');
  for(const paragraph of [reading.analysis!.overview,reading.analysis!.cards[0].interpretation,reading.analysis!.connections,reading.analysis!.career,reading.analysis!.attention,reading.analysis!.message,reading.analysis!.advice])expect(text).toContain(paragraph);
  expect(text).toContain('Tám Tiền, lá ngược, vị trí Thông điệp.');
  expect(text.startsWith(reading.analysis!.overview)).toBeTruthy();
  for(let index=0;index<value.spoken.length-1;index++){
    await page.evaluate(index=>(window as unknown as {__speech:Probe}).__speech.finish(index),index);
    await expect(player.getByRole('button',{name:'Dừng đọc',exact:true})).toBeVisible();
  }
  expect(value.spoken.map(item=>item.text).join(' ').endsWith(reading.analysis!.advice)).toBeTruthy();
  await expect(player.getByRole('button',{name:'Dừng đọc',exact:true})).toHaveAttribute('aria-pressed','true');
  await player.screenshot({path:testInfo.outputPath('speech-player.png')});
  await player.getByRole('button',{name:'Dừng đọc',exact:true}).click();
  expect((await probe(page)).canceled).toBe(1);
  await expect(player.getByRole('button',{name:'Nghe thông điệp',exact:true})).toBeEnabled();
  await player.getByRole('button',{name:'Nghe thông điệp',exact:true}).click();
  await page.evaluate(()=>(window as unknown as {__speech:Probe}).__speech.finish());
  await expect(player.getByRole('button',{name:'Nghe thông điệp',exact:true})).toBeVisible();
  expect(aiCalls).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
test('long messages queue continuously and navigating away cancels the whole queue',async({page})=>{
  const longReading={...reading,analysis:{...reading.analysis!,message:('Hãy dành thời gian cân nhắc. Chọn bước tiếp theo phù hợp với mình. ').repeat(15)}};
  const player=await openSpeech(page,'normal',longReading);
  await player.getByRole('button',{name:'Nghe thông điệp',exact:true}).click();
  const value=await probe(page);
  expect(value.spoken.length).toBeGreaterThan(1);
  const text=value.spoken.map(item=>item.text).join(' ');
  expect(text).toContain(longReading.analysis.message.trim());
  expect(text.startsWith(reading.analysis!.overview)).toBeTruthy();
  expect(text.endsWith(reading.analysis!.advice)).toBeTruthy();
  await page.getByRole('button',{name:/Nhật ký/}).click();
  expect((await probe(page)).canceled).toBe(1);
});
test('voices loaded asynchronously become available and audio errors allow retry',async({page})=>{
  const player=await openSpeech(page,'late');
  await player.getByRole('button',{name:'Nghe thông điệp',exact:true}).click();
  await expect(player.getByRole('status')).toContainText('Giọng tiếng Việt chưa sẵn sàng');
  expect((await probe(page)).spoken).toHaveLength(0);
  await page.evaluate(()=>(window as unknown as {__speech:Probe}).__speech.loadVoices());
  await player.getByRole('button',{name:'Nghe thông điệp',exact:true}).click();
  await page.evaluate(()=>(window as unknown as {__speech:Probe}).__speech.fail());
  await expect(player.getByRole('status')).toContainText('Giọng đọc này cần kết nối mạng');
  await expect(player.getByRole('button',{name:'Nghe thông điệp',exact:true})).toBeEnabled();
  await player.getByRole('button',{name:'Nghe thông điệp',exact:true}).click();
  await expect(player.getByRole('button',{name:'Dừng đọc',exact:true})).toBeVisible();
});
for(const mode of ['unsupported','english'] as const){
  test(`${mode}: explain unavailable Vietnamese speech without interrupting the displayed reading`,async({page})=>{
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    const player=await openSpeech(page,mode);
    await expect(player.getByRole('button',{name:'Nghe thông điệp',exact:true})).toBeDisabled();
    await expect(player.getByRole('status')).toContainText(mode==='unsupported'?'chưa hỗ trợ đọc bằng giọng nói':'chưa có giọng tiếng Việt');
    await expect(page.getByText(reading.analysis!.message!,{exact:true})).toBeVisible();
    expect(errors).toEqual([]);
  });
}
