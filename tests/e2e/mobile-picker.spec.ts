import { test, expect } from '@playwright/test';

for (const width of [390, 320]) {
  test(`touch picker at ${width}px: swipe previews without drawing, tap locks the exact card`, async ({page}, testInfo) => {
    test.skip(!testInfo.project.use.isMobile, 'Touch-specific controls');
    test.setTimeout(120000);
    await page.setViewportSize({width,height:844});
    await page.emulateMedia({reducedMotion:'reduce'});
    let aiCalls=0;
    await page.route('**/api/reading',route=>{aiCalls++;return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Test message service"}'});});
    await page.goto('/');
    await page.getByLabel('Tên của bạn').fill('An');
    await page.getByLabel('Ngày sinh').fill('1997-05-14');
    await page.getByLabel('Câu hỏi của bạn').fill('Tôi nên chú ý điều gì trong công việc?');
    await page.getByRole('button',{name:'Xáo bài & bắt đầu'}).click();
    const scene=page.getByTestId('tarot-scene');
    await expect(scene).toHaveAttribute('data-phase','ready',{timeout:90000});
    const picker=scene.getByRole('group',{name:'Chọn lá bài úp'});
    await picker.scrollIntoViewIfNeeded();
    await expect(picker).toBeVisible();
    const first=picker.getByRole('button',{name:'Chọn lá úp số 1',exact:true});
    const bounds=(await first.boundingBox())!;
    expect(bounds.width).toBeGreaterThanOrEqual(100);
    expect(bounds.height).toBeGreaterThanOrEqual(200);

    const box=(await picker.boundingBox())!;
    const cdp=await page.context().newCDPSession(page);
    const startX=box.x+box.width*.8, y=box.y+box.height/2;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:startX,y}]});
    for(let step=1;step<=10;step++){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:startX-step*15,y}]});
      await page.waitForTimeout(20);
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(()=>picker.evaluate(element=>element.scrollLeft)).toBeGreaterThan(100);
    const focused=picker.locator('button[data-focused="true"]');
    await expect.poll(async()=>Number(await focused.getAttribute('data-deck-index'))).toBeGreaterThan(0);
    await expect(scene).toHaveAttribute('data-picked','0');
    await expect(scene).toHaveAttribute('data-phase','ready');
    expect(aiCalls).toBe(0);
    await scene.screenshot({path:testInfo.outputPath('touch-picker.png')});

    const selected=Number(await focused.getAttribute('data-deck-index'));
    await focused.tap();
    await expect(scene).toHaveAttribute('data-picked','1');
    await expect(scene).toHaveAttribute('data-phase','ready',{timeout:90000});
    await expect(picker.locator(`button[data-deck-index="${selected}"]`)).toBeDisabled();
    for(const index of [selected+1,selected+2]){
      await picker.locator(`button[data-deck-index="${index}"]`).tap();
      await expect(scene).toHaveAttribute('data-phase',index===selected+2?'done':'ready',{timeout:90000});
    }
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana:history:v1')!)[0]);
    expect(saved.cards).toHaveLength(3);
    expect(new Set(saved.cards.map((card:{cardId:string})=>card.cardId)).size).toBe(3);
    expect(saved.cards.map((card:{position:string})=>card.position)).toEqual(['Quá khứ','Hiện tại','Tương lai']);
    expect(aiCalls).toBe(0);
    await page.getByRole('region',{name:'Các lá đã rút'}).getByRole('button',{name:'Khám phá thông điệp'}).click();
    await expect.poll(()=>aiCalls).toBe(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  });
}
