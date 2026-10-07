import { test, expect } from '@playwright/test';
import { TAROT_EVALUATION_CASES } from '../fixtures/tarot-evaluation-cases';
import type { Analysis, Reading } from '../../src/types/tarot';

const request=TAROT_EVALUATION_CASES[0].request;
const analysis:Analysis={
  overview:'Chưa thuận để nhận thêm dự án khi tải hiện tại chưa giảm. Việc chưa có người hỗ trợ khiến rủi ro giảm chất lượng đáng chú ý.',
  cards:request.cards.map((card,index)=>({...card,interpretation:[
    'Mười Gậy ở Quá khứ liên hệ với gánh nặng làm thêm giờ bạn đã kể. Trách nhiệm dồn lên một người chưa tạo nền tảng để nhận thêm việc.',
    'Tám Tiền ngược ở Hiện tại gợi cách làm thiếu tập trung hoặc máy móc. Điều này liên quan trực tiếp đến chất lượng đang giảm dù bạn dành nhiều giờ làm việc.',
    'Tòa Tháp ở Tương lai cảnh báo nền tảng làm việc có thể bị thách thức nếu tiếp tục tăng tải. Đây là xu hướng có điều kiện, không khẳng định bạn sẽ mất việc.',
  ][index]})),
  connections:'Gánh nặng từ Quá khứ đang đi cùng vấn đề chất lượng ở Hiện tại. Tòa Tháp giữ cảnh báo nếu nền tảng này tiếp tục bị ép, không xóa khó khăn của hai lá trước.',
  love:null,career:'Nhận thêm khi chưa giảm việc hoặc có hỗ trợ có thể làm chất lượng tiếp tục suy giảm.',finance:null,
  attention:'Làm rõ phần việc được giảm và người hỗ trợ trước khi cam kết. Lời hứa chung về nguồn lực chưa thay thế được phân công cụ thể.',
  message:'Bạn chưa có nền tảng thuận để nhận thêm dự án theo trải bài này. Cần giải quyết tải hiện tại trước khi đánh giá lại đề nghị.',
  advice:'Trao đổi với sếp về khối lượng và sai sót hiện tại. Chỉ cân nhắc cam kết sau khi có phạm vi công việc và người hỗ trợ rõ ràng.',
};
function messy(value:string){return ` \t${value.replaceAll('. ', ' .\n\n\n').replaceAll(', ', ' ,\u00a0 ')} \n `.normalize('NFD');}
const dirty:Analysis={...analysis,
  overview:messy(analysis.overview),cards:analysis.cards.map(card=>({...card,interpretation:messy(card.interpretation)})),
  connections:messy(analysis.connections),career:messy(analysis.career!),attention:messy(analysis.attention!),message:messy(analysis.message!),advice:messy(analysis.advice),
};
function reading(saved:boolean):Reading{return {...request,id:crypto.randomUUID(),createdAt:new Date().toISOString(),source:saved?'ai':null,analysis:saved?dirty:null};}

for(const saved of [false,true]){
  test(`${saved?'saved history':'new response'}: readable Vietnamese retains the warning, card positions and final conclusion`,async({page},testInfo)=>{
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.addInitScript(value=>localStorage.setItem('arcana:history:v1',JSON.stringify([value])),reading(saved));
    let calls=0;
    await page.route('**/api/reading',route=>{
      calls++;
      const body=route.request().postDataJSON();
      expect(body.question).toBe(request.question);
      expect(body.cards).toEqual(request.cards);
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({analysis:dirty,source:'ai'})});
    });
    await page.goto('/');
    await page.getByRole('button',{name:/Nhật ký/}).click();
    await page.getByRole('button',{name:'Xem lại'}).click();
    if(!saved)await page.getByRole('region',{name:'Các lá đã rút'}).getByRole('button',{name:'Khám phá thông điệp',exact:true}).click();
    const panel=page.getByRole('region',{name:'Diễn giải trải bài'});
    for(const paragraph of [analysis.overview,...analysis.cards.map(card=>card.interpretation),analysis.connections,analysis.career,analysis.attention,analysis.message,analysis.advice])await expect(panel.getByText(paragraph!,{exact:true})).toBeVisible();
    const prose=await panel.locator('.analysis-content p').evaluateAll(elements=>elements.map(element=>({text:element.textContent!,whiteSpace:getComputedStyle(element).whiteSpace})));
    expect(prose.every(item=>item.text===item.text.normalize('NFC')&&!/[\r\n\t]|\s{2,}|\s+[,.!?]/u.test(item.text))).toBeTruthy();
    expect(prose.every(item=>item.whiteSpace==='normal')).toBeTruthy();
    expect(prose[0].text).toBe(analysis.overview);
    expect(calls).toBe(saved?0:1);
    if(!saved){
      const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana:history:v1')!)[0]);
      expect(stored.analysis).toEqual(analysis);
      expect(stored.cards).toEqual(request.cards);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await panel.screenshot({path:testInfo.outputPath('analysis-quality.png')});
    await page.getByRole('region',{name:'Các lá đã rút'}).getByRole('button',{name:/Xem chi tiết/}).nth(1).click();
    await expect(page.getByRole('dialog').getByText(analysis.cards[1].interpretation,{exact:true})).toBeVisible();
  });
}
