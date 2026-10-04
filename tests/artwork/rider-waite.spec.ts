import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Reading } from '../../src/types/tarot';

const manifest=JSON.parse(readFileSync(new URL('../../src/data/image-manifest.json',import.meta.url),'utf8')) as {images:Record<string,string>};
const examples = [
  {id:'the-fool',name:'The Fool',nameVi:'Kẻ Khờ'},
  {id:'the-magician',name:'The Magician',nameVi:'Nhà Ảo Thuật'},
  {id:'ace-of-cups',name:'Ace of Cups',nameVi:'Át Cốc'},
  {id:'death',name:'Death',nameVi:'Chuyển Hóa'},
  {id:'the-world',name:'The World',nameVi:'Thế Giới'},
];

test('all 78 original PNGs are served successfully and browser decodes the five requested artworks', async ({page, request}) => {
  expect(Object.keys(manifest.images)).toHaveLength(78);
  for (const [id,image] of Object.entries(manifest.images)) {
    expect(image).toMatch(/^\/tarot\/.+\.png$/);
    const response = await request.get(image);
    expect(response.status(), id).toBe(200);
    expect(response.headers()['content-type'], id).toContain('image/png');
    const bytes = await response.body();
    expect([...bytes.subarray(0,8)], id).toEqual([137,80,78,71,13,10,26,10]);
  }

  await page.goto('/');
  await page.getByRole('button', {name:'78 lá Tarot'}).click();
  for (const card of examples) {
    const tile = page.getByRole('button', {name:`${card.nameVi} ${card.name}`, exact:true});
    await tile.scrollIntoViewIfNeeded();
    const artwork = tile.locator('img');
    await expect(artwork).toHaveAttribute('src', manifest.images[card.id]);
    await expect.poll(() => artwork.evaluate((image:HTMLImageElement) => image.complete && image.naturalWidth > 100 && image.naturalHeight > 100)).toBe(true);
    await expect(artwork).toHaveCSS('object-fit', 'contain');
    await tile.click();
    const detail = page.getByRole('dialog').locator('img');
    await expect(detail).toHaveAttribute('src', manifest.images[card.id]);
    await expect.poll(() => detail.evaluate((image:HTMLImageElement) => image.complete && image.naturalWidth > 100)).toBe(true);
    await page.getByRole('button', {name:'Đóng', exact:true}).click();
  }
});

test('known front images appear after the 3D flip ends; reversed keeps the same source', async ({page}) => {
  const reading:Reading = {
    id:crypto.randomUUID(), createdAt:new Date().toISOString(),
    profile:{name:'An',birthDate:'1997-05-14'}, question:'Tôi nên chú ý điều gì trên hành trình mới?',
    spreadId:'three',topic:'general',analysis:null,source:null,
    cards:[
      {cardId:'the-fool',orientation:'upright',position:'Quá khứ'},
      {cardId:'the-magician',orientation:'reversed',position:'Hiện tại'},
      {cardId:'ace-of-cups',orientation:'upright',position:'Tương lai'},
    ],
  };
  await page.addInitScript(value => localStorage.setItem('arcana:history:v1', JSON.stringify([value])), reading);
  await page.goto('/');
  await page.getByRole('button', {name:/Nhật ký/}).click();
  await page.getByRole('button', {name:'Xem lại'}).click();
  const fronts = page.locator('.card-side-front');
  // This assertion runs during the 800 ms flip. Merely revealing a card must
  // not immediately attach the artwork to its front before GSAP completes.
  await expect(fronts.locator('img')).toHaveCount(0);
  await expect(fronts.locator('img')).toHaveCount(3);
  for (let i=0; i<reading.cards.length; i++) {
    const drawn = reading.cards[i];
    await expect(fronts.nth(i).locator('img')).toHaveAttribute('src', manifest.images[drawn.cardId]);
    await expect(fronts.nth(i).locator('img')).toHaveCSS('object-fit','contain');
  }
  await expect(fronts.nth(1).locator('img')).toHaveClass('reversed');
  await expect(fronts.locator('svg')).toHaveCount(0);
});
