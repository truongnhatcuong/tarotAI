import { test, expect } from '@playwright/test';
import type { Reading } from '../../src/types/tarot';
test('draw, reveal, zoom, AI error, reference history and profile persistence',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/reading',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Chưa kết nối dịch vụ AI.',code:'AI_NOT_CONFIGURED'})}));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Lắng nghe điều vũ trụ gợi mở.'})).toBeVisible();
  await page.getByLabel('Tên của bạn').fill('Ngọc An');await page.getByLabel('Ngày sinh').fill('1997-05-14');await page.getByLabel('Câu hỏi của bạn').fill('Tôi nên chú ý điều gì trong công việc sắp tới?');
  await page.getByRole('button',{name:'Xáo bài & bắt đầu'}).click();
  const scene=page.getByTestId('tarot-scene');
  for(const index of [1,2,3]){
    const card=page.getByRole('button',{name:`Chọn lá úp số ${index}`,exact:true});
    await expect(card).toBeEnabled({timeout:90000});await card.focus();await page.keyboard.press('Enter');
    await expect(scene).toHaveAttribute('data-picked',String(index));
    await expect(scene).toHaveAttribute('data-phase',index<3?'ready':'done',{timeout:90000});
  }
  // The 3D table already flipped every card; there is no separate reveal-all step.
  await expect(page.getByRole('button',{name:'Lật tất cả các lá'})).toHaveCount(0);
  const zoom=page.getByRole('button',{name:/Xem chi tiết/}).first();await expect(zoom).toBeVisible();
  await zoom.click();await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').locator('img')).toHaveAttribute('src',/\/tarot\/.+\.png$/);
  await page.getByRole('button',{name:'Đóng',exact:true}).click();
  await page.getByRole('button',{name:'Khám phá thông điệp',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Chưa kết nối dịch vụ AI.'})).toBeVisible();
  await page.getByRole('button',{name:'Đọc ý nghĩa chuẩn'}).click();await expect(page.getByText('Tra cứu từ dữ liệu chuẩn · Không phải kết quả AI.')).toBeVisible();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana:history:v1')!));expect(stored).toHaveLength(1);expect(new Set(stored[0].cards.map((c:{cardId:string})=>c.cardId)).size).toBe(3);
  await page.getByRole('button',{name:/Nhật ký/}).click();await expect(page.getByRole('heading',{name:'Nhìn lại những thông điệp.'})).toBeVisible();await page.getByRole('button',{name:'Xem lại'}).click();await expect(page.getByText('Tra cứu từ dữ liệu chuẩn · Không phải kết quả AI.')).toBeVisible();
  await page.reload();await expect(page.getByLabel('Tên của bạn')).toHaveValue('Ngọc An');await expect(page.getByLabel('Ngày sinh')).toHaveValue('1997-05-14');
  await page.getByRole('button',{name:'78 lá Tarot'}).click();await expect(page.getByText('78 lá bài',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Cốc',exact:true}).click();await expect(page.getByText('14 lá bài',{exact:true})).toBeVisible();
  await page.getByLabel('Tìm lá bài').fill('Át Cốc');await expect(page.getByText('1 lá bài',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Át Cốc Ace of Cups'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Đóng',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();expect(errors).toEqual([]);
});

test('AI cancel and retry preserve the exact saved cards and show successful analysis',async({page})=>{
  const reading:Reading={
    id:crypto.randomUUID(),createdAt:new Date().toISOString(),profile:{name:'An',birthDate:'1997-05-14'},
    question:'Tôi nên cân nhắc điều gì trong công việc?',topic:'career',spreadId:'three',source:null,analysis:null,
    cards:[{cardId:'the-fool',orientation:'upright',position:'Quá khứ'},{cardId:'eight-of-pentacles',orientation:'reversed',position:'Hiện tại'},{cardId:'the-star',orientation:'upright',position:'Tương lai'}],
  };
  await page.addInitScript(item=>localStorage.setItem('arcana:history:v1',JSON.stringify([item])),reading);
  let calls=0;
  await page.route('**/api/reading',async route=>{
    calls++;
    const body=route.request().postDataJSON();
    expect(body.cards.map((c:{cardId:string;orientation:string;position:string})=>({cardId:c.cardId,orientation:c.orientation,position:c.position}))).toEqual(reading.cards);
    expect(body.cards[1].card.reversedMeaning).toBeTruthy();
    if(calls===1)return;
    const analysis={
      overview:'Thông điệp diễn giải trong bài kiểm tra giao diện.',
      cards:reading.cards.map(card=>({...card,interpretation:'Ý nghĩa của lá được trình bày tại vị trí này.'})),
      connections:'Các chủ đề khởi đầu, rèn luyện và hy vọng gợi những hướng suy ngẫm.',
      love:null,career:'Cân nhắc kỹ năng cần rèn luyện và bước tiếp theo.',finance:null,
      message:'Hãy gắn hy vọng về công việc với một bước rèn luyện cụ thể.',
      advice:'Chọn một hành động nhỏ phù hợp hoàn cảnh thực tế.',
    };
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({analysis,source:'ai'})});
  });
  await page.goto('/');await page.getByRole('button',{name:/Nhật ký/}).click();await page.getByRole('button',{name:'Xem lại'}).click();
  await page.getByRole('button',{name:'Khám phá thông điệp',exact:true}).click();await expect(page.getByRole('heading',{name:'Đang kết nối các thông điệp…'})).toBeVisible();
  await page.getByRole('button',{name:'Dừng phân tích'}).click();await expect(page.getByRole('heading',{name:'Đang kết nối các thông điệp…'})).not.toBeVisible();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana:history:v1')!));expect(before[0].analysis).toBeNull();expect(before[0].cards).toEqual(reading.cards);
  await page.getByRole('button',{name:'Khám phá thông điệp',exact:true}).click();await expect(page.getByText('Thông điệp diễn giải trong bài kiểm tra giao diện.')).toBeVisible();
  await expect(page.getByText('Diễn giải AI dựa trên các lá đã rút.')).toBeVisible();
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana:history:v1')!));expect(after).toHaveLength(1);expect(after[0].id).toBe(reading.id);expect(after[0].cards).toEqual(reading.cards);expect(after[0].source).toBe('ai');expect(calls).toBe(2);
});

test('history deletion and forgetting profile require confirmation and persist',async({page})=>{
  const reading:Reading={
    id:crypto.randomUUID(),createdAt:new Date().toISOString(),profile:{name:'Ngọc An',birthDate:'1997-05-14'},
    question:'Tôi nên chú ý điều gì hôm nay?',topic:'general',spreadId:'single',analysis:null,source:null,
    cards:[{cardId:'the-magician',orientation:'upright',position:'Thông điệp'}],
  };
  await page.goto('/');
  await page.evaluate(item=>{localStorage.setItem('arcana:history:v1',JSON.stringify([item]));localStorage.setItem('arcana:profile:v1',JSON.stringify(item.profile));},reading);
  await page.reload();await expect(page.getByLabel('Tên của bạn')).toHaveValue('Ngọc An');
  await page.getByRole('button',{name:/Nhật ký/}).click();await page.getByRole('button',{name:'Xóa tất cả',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Quay lại',exact:true}).click();await expect(page.getByText('1 trải bài đã lưu')).toBeVisible();
  await page.getByRole('button',{name:'Xóa tất cả',exact:true}).click();await page.getByRole('button',{name:'Xóa dữ liệu',exact:true}).click();await expect(page.getByRole('heading',{name:'Một trang nhật ký mới'})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana:history:v1')!))).toEqual([]);
  await page.getByRole('button',{name:'Xóa dữ liệu của tôi',exact:true}).click();await page.getByRole('button',{name:'Xóa dữ liệu',exact:true}).click();
  await page.getByRole('button',{name:'Trải bài',exact:true}).click();await expect(page.getByLabel('Tên của bạn')).toHaveValue('');
  await page.reload();await expect(page.getByLabel('Tên của bạn')).toHaveValue('');await expect(page.getByLabel('Ngày sinh')).toHaveValue('');
});
test('all four spreads can complete and upright-only is respected',async({page})=>{
  test.setTimeout(180000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');await page.getByLabel('Tên của bạn').fill('An');await page.getByLabel('Ngày sinh').fill('2000-01-01');await page.getByLabel('Câu hỏi của bạn').fill('Tôi nên chú ý điều gì hôm nay?');
  await page.getByLabel('Bao gồm lá ngược').uncheck();
  for(const [label,count] of [['Thông điệp hôm nay',1],['Dòng chảy thời gian',3],['Chuyện tình yêu',3],['Con đường sự nghiệp',3]] as const){
    await page.getByRole('button',{name:new RegExp(label)}).click();await page.getByRole('button',{name:'Xáo bài & bắt đầu'}).click();
    for(let i=1;i<=count;i++){const button=page.getByRole('button',{name:`Chọn lá úp số ${i}`,exact:true});await expect(button).toBeEnabled({timeout:90000});await button.focus();await page.keyboard.press('Enter');await expect(page.getByTestId('tarot-scene')).toHaveAttribute('data-phase',i<count?'ready':'done',{timeout:90000});}
    await expect(page.getByRole('region',{name:'Các lá đã rút'}).getByRole('button',{name:/Xem chi tiết.*xuôi/})).toHaveCount(count);
    await page.getByRole('button',{name:'Bắt đầu một trải bài mới'}).click();await page.getByRole('button',{name:'Bắt đầu mới',exact:true}).click();
  }
  await page.getByRole('button',{name:/Nhật ký/}).click();await expect(page.getByText('4 trải bài đã lưu')).toBeVisible();
});
