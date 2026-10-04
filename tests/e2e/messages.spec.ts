import { test, expect } from '@playwright/test';
import { SPREADS } from '../../src/data/spreads';
import type { Analysis, Reading } from '../../src/types/tarot';

const cardIds = ['the-fool', 'eight-of-pentacles', 'the-star'];
function readingFor(spread: typeof SPREADS[number]): Reading {
  return {
    id: crypto.randomUUID(), createdAt: new Date().toISOString(),
    profile: { name: 'An', birthDate: '1997-05-14' }, question: 'Tôi nên chú ý điều gì trên hành trình mới?',
    topic: spread.id === 'love' ? 'love' : spread.id === 'career' ? 'career' : 'general',
    spreadId: spread.id, source: null, analysis: null,
    cards: spread.positions.map((position, i) => ({ cardId: cardIds[i], position, orientation: i === 1 ? 'reversed' : 'upright' })),
  };
}
function analysisFor(reading: Reading): Analysis {
  return {
    overview: 'Tổng quan thử nghiệm theo câu hỏi của bạn.',
    cards: reading.cards.map(card => ({ ...card, interpretation: `Thông điệp thử nghiệm cho ${card.position}.` })),
    connections: 'Các biểu tượng gợi một góc nhìn để bạn cân nhắc.',
    love: reading.topic === 'love' ? 'Suy ngẫm về sự kết nối trong hoàn cảnh hiện tại.' : null,
    career: reading.topic === 'career' ? 'Cân nhắc một bước nhỏ trong công việc.' : null,
    finance: null, message: 'Khởi đầu mới cần đi cùng việc rèn luyện và giữ hy vọng. Hãy chọn một bước phù hợp với hành trình bạn đang hỏi.', advice: 'Ghi lại một hành động nhỏ bạn có thể tự quyết định.',
  };
}

for (const spread of SPREADS) {
  test(`${spread.id}: zoomed card opens AI for the entire spread, then reuses the saved result`, async ({ page }) => {
    const reading = readingFor(spread);
    const analysis = analysisFor(reading);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(value => localStorage.setItem('arcana:history:v1', JSON.stringify([value])), reading);
    let calls = 0;
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    await page.route('**/api/reading', async route => {
      calls++;
      const body = route.request().postDataJSON();
      expect(body.spreadId).toBe(reading.spreadId);
      expect(body.question).toBe(reading.question);
      expect(body.topic).toBe(reading.topic);
      expect(body.cards.map(({cardId, orientation, position}: Reading['cards'][number]) => ({cardId, orientation, position}))).toEqual(reading.cards);
      await pending;
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({analysis,source:'ai'})});
    });
    await page.goto('/');
    await page.getByRole('button', {name:/Nhật ký/}).click();
    await page.getByRole('button', {name:'Xem lại'}).click();
    const gallery = page.getByRole('region', {name:'Các lá đã rút'});
    await expect(gallery.getByRole('img')).toHaveCount(reading.cards.length);
    const index = reading.cards.length > 1 ? 1 : 0;
    const thumbnail = gallery.getByRole('img').nth(index);
    const thumbnailWidth = (await thumbnail.boundingBox())!.width;
    expect(thumbnailWidth).toBeGreaterThanOrEqual(170);
    expect(calls).toBe(0);
    await expect(page.getByRole('button', {name:'Diễn giải trải bài',exact:true})).toHaveCount(0);
    await gallery.getByRole('button', {name:/Xem chi tiết/}).nth(index).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const enlarged = dialog.getByRole('img');
    await enlarged.evaluate((image: HTMLImageElement) => image.decode());
    expect((await enlarged.boundingBox())!.width).toBeGreaterThan(thumbnailWidth);
    if (index === 1) await expect(enlarged).toHaveClass('reversed');
    await dialog.getByRole('button', {name:'Khám phá thông điệp'}).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => calls).toBe(1);
    await expect(page.getByRole('heading', {name:'Đang kết nối các thông điệp…'})).toBeVisible();
    await expect(gallery.getByRole('button', {name:'Đang đọc thông điệp…'})).toBeDisabled();
    const summary = page.getByRole('region', {name:'Diễn giải trải bài'});
    await expect(summary).toBeInViewport();
    finish();
    await expect(summary.getByRole('heading', {name:`Phân tích tổng ${reading.cards.length} lá`})).toBeVisible();
    for (const card of analysis.cards) await expect(summary.getByText(card.interpretation, {exact:true})).toBeVisible();
    await expect(summary.getByRole('heading', {name:'Thông điệp dành cho bạn'})).toBeVisible();
    await expect(summary.getByText(analysis.message!, {exact:true})).toBeVisible();
    await expect(summary.getByRole('button', {name:'Diễn giải lại',exact:true})).toBeVisible();
    await expect(summary.getByRole('heading', {name:reading.cards.length === 1 ? 'Liên hệ với câu hỏi' : 'Liên kết giữa các lá'})).toBeVisible();
    await gallery.getByRole('button', {name:'Khám phá thông điệp'}).click();
    expect(calls).toBe(1);
    await gallery.getByRole('button', {name:/Xem chi tiết/}).nth(index).click();
    await expect(dialog.getByRole('heading', {name:'Thông điệp AI cho lá này'})).toBeVisible();
    await dialog.getByRole('button', {name:'Khám phá thông điệp'}).click();
    expect(calls).toBe(1);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('arcana:history:v1')!)[0]);
    expect(stored.cards).toEqual(reading.cards);
    expect(stored.source).toBe('ai');
    expect(stored.analysis).toEqual(analysis);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
}

test('message button retries AI errors with the original cards', async ({ page }) => {
  const reading = readingFor(SPREADS[1]);
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.addInitScript(value => localStorage.setItem('arcana:history:v1', JSON.stringify([value])), reading);
  let calls = 0;
  await page.route('**/api/reading', route => {
    calls++;
    expect(route.request().postDataJSON().cards.map(({cardId,orientation,position}: Reading['cards'][number])=>({cardId,orientation,position}))).toEqual(reading.cards);
    return route.fulfill({status:calls===1?503:200,contentType:'application/json',body:JSON.stringify(calls===1?{error:'Dịch vụ AI đang bận.'}:{analysis:analysisFor(reading),source:'ai'})});
  });
  await page.goto('/');
  await page.getByRole('button', {name:/Nhật ký/}).click();
  await page.getByRole('button', {name:'Xem lại'}).click();
  const message = page.getByRole('button', {name:'Khám phá thông điệp',exact:true});
  await message.click();
  await expect(page.getByRole('alert').filter({hasText:'Dịch vụ AI đang bận.'})).toBeVisible();
  await expect(page.getByRole('region', {name:'Các lá đã rút'}).getByRole('img')).toHaveCount(3);
  await message.click();
  await expect(page.getByText('Diễn giải AI dựa trên các lá đã rút.')).toBeVisible();
  expect(calls).toBe(2);
});

test('drawing and flipping a full spread exposes enlarged cards before any AI request', async ({ page }) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  // Exercise the 2D fallback independently of GPU availability.
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, kind, ...args) {
      if (kind === 'webgl' || kind === 'webgl2') return null;
      return getContext.call(this, kind, ...args);
    } as typeof getContext;
  });
  let calls = 0;
  await page.route('**/api/reading',route=>{calls++;return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Test AI"}'});});
  await page.goto('/');
  await page.getByLabel('Tên của bạn').fill('An');
  await page.getByLabel('Ngày sinh').fill('1997-05-14');
  await page.getByLabel('Câu hỏi của bạn').fill('Tôi nên chú ý điều gì hôm nay?');
  await page.getByRole('button', {name:'Xáo bài & bắt đầu'}).click();
  for (const index of [1,2,3]) await page.getByRole('button', {name:`Chọn lá úp số ${index}`,exact:true}).click();
  await expect(page.getByRole('button', {name:'Khám phá thông điệp'})).toHaveCount(0);
  await page.getByRole('button', {name:'Lật tất cả các lá'}).click();
  const gallery = page.getByRole('region', {name:'Các lá đã rút'});
  await expect(gallery.getByRole('img')).toHaveCount(3);
  expect(calls).toBe(0);
  await gallery.getByRole('button', {name:'Khám phá thông điệp'}).click();
  await expect.poll(()=>calls).toBe(1);
});
