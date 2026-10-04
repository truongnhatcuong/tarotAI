import { test, expect } from '@playwright/test';
import type { Reading } from '../../src/types/tarot';

for (const renderer of ['3D', '2D'] as const) {
  for (const spreadId of ['single', 'three'] as const) {
    test(`HTTP-compatible mobile ${spreadId} ${renderer}: opened cards expose the message and preserve history`, async ({page}, testInfo) => {
      test.skip(!testInfo.project.use.isMobile, 'Reproduce the missing browser API on the phone');
      test.setTimeout(120000);
      // Model the unavailable randomUUID on a non-localhost HTTP origin.
      // Localhost allows the Next development server's hydration/HMR to run.
      await page.addInitScript(()=>{
        Object.defineProperty(Crypto.prototype,'randomUUID',{value:undefined,configurable:true});
        localStorage.setItem('arcana:profile:v1',JSON.stringify({name:'An',birthDate:'1997-05-14'}));
      });
      let sent:Reading|null=null;
      await page.route('**/api/reading', async route => {
        sent=route.request().postDataJSON();
        await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Test service unavailable'})});
      });
      const errors:string[]=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.emulateMedia({reducedMotion:'reduce'});
      if(renderer==='2D') await page.addInitScript(()=>{
        const getContext=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,kind,...args){
          if(kind==='webgl'||kind==='webgl2')return null;
          return getContext.call(this,kind,...args);
        } as typeof getContext;
      });
      await page.goto('/');
      expect(await page.evaluate(()=>typeof crypto.randomUUID)).toBe('undefined');
      // Wait for profile restoration so the form is hydrated before interacting.
      await expect(page.getByLabel('Tên của bạn')).toHaveValue('An');
      await page.getByLabel('Tên của bạn').fill('An');
      await page.getByLabel('Ngày sinh').fill('1997-05-14');
      const question='Tôi nên chú ý điều gì trên hành trình sắp tới?';
      await page.getByLabel('Câu hỏi của bạn').fill(question);
      await page.getByRole('button',{name:spreadId==='single'?/Thông điệp hôm nay/:/Dòng chảy thời gian/}).click();
      await page.getByRole('button',{name:'Xáo bài & bắt đầu'}).click();
      await expect(page.getByRole('button',{name:'Bắt đầu một trải bài mới'})).toBeVisible();
      const count=spreadId==='single'?1:3;
      const scene=page.getByTestId('tarot-scene');
      for(let i=1;i<=count;i++){
        const button=page.getByRole('button',{name:`Chọn lá úp số ${renderer==='2D'?79-i:i}`,exact:true});
        await expect(button).toBeEnabled({timeout:90000});
        await button.tap();
        if(renderer==='3D')await expect(scene).toHaveAttribute('data-phase',i===count?'done':'ready',{timeout:90000});
      }
      if(renderer==='2D')await page.getByRole('button',{name:'Lật tất cả các lá'}).click();
      const gallery=page.getByRole('region',{name:'Các lá đã rút'});
      await expect(gallery).toBeVisible();
      await expect(gallery.getByRole('img')).toHaveCount(count);
      const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana:history:v1')!)[0] as Reading);
      expect(saved.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
      expect(saved.question).toBe(question);
      expect(saved.cards).toHaveLength(count);
      expect(new Set(saved.cards.map(card=>card.cardId)).size).toBe(count);
      await gallery.getByRole('button',{name:'Khám phá thông điệp',exact:true}).tap();
      await expect(page.getByRole('alert').filter({hasText:'Test service unavailable'})).toBeVisible();
      const submitted=sent as Reading|null;
      expect(submitted?.question).toBe(question);
      expect(submitted?.cards.map(({cardId,orientation,position})=>({cardId,orientation,position}))).toEqual(saved.cards);
      await page.reload();
      await page.getByRole('button',{name:/Nhật ký/}).click();
      await page.getByRole('button',{name:'Xem lại'}).click();
      await expect(gallery.getByRole('img')).toHaveCount(count);
      await expect(gallery.getByRole('button',{name:'Khám phá thông điệp',exact:true})).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}
