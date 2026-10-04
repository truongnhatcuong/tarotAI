import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../../src/data/image-manifest.json', import.meta.url), 'utf8')) as { images: Record<string, string> };
interface Probe { grabs: { dist: number; moved: number; curl: number }[]; frames: number; carried: number; minCardY: number; minHandY: number; carryMin: number; carryMax: number; minCamArm: number }

async function startReading(page: Page) {
  await page.goto('/');
  await page.getByLabel('Tên của bạn').fill('An'); await page.getByLabel('Ngày sinh').fill('1997-05-14'); await page.getByLabel('Câu hỏi của bạn').fill('Tôi nên chú ý điều gì trong công việc?');
  await page.getByRole('button', { name: 'Xáo bài & bắt đầu' }).click();
}
async function pick(page: Page, number: number) {
  const card = page.getByRole('button', { name: `Chọn lá úp số ${number}`, exact: true });
  await expect(card).toBeEnabled({ timeout: 120000 });
  await card.focus(); await page.keyboard.press('Enter');
}

test('real WebGL table: shuffles 78 cards, hand grabs → carries → places → flips, AI only after completion', async ({ page }) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  let aiCalls = 0;
  await page.route('**/api/reading', route => { aiCalls++; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'x', code: 'AI_NOT_CONFIGURED' }) }); });
  const textureRequests: string[] = [];
  page.on('request', r => { const p = new URL(r.url()).pathname; if (/^\/tarot\/.+\.png$/.test(p)) textureRequests.push(p); });

  await startReading(page);
  const scene = page.getByTestId('tarot-scene');
  await expect(scene.locator('canvas')).toBeVisible({ timeout: 60000 });
  textureRequests.length = 0; // ignore artwork the page itself (hero) loaded; only the table's own loads count from here
  await expect(scene).toHaveAttribute('data-phase', /shuffling|ready/);
  await expect(page.getByRole('button', { name: /^Chọn lá úp số \d+$/ })).toHaveCount(78);
  await expect(page.getByRole('button', { name: 'Chọn lá úp số 7', exact: true })).toBeDisabled();
  expect(textureRequests, 'no artwork is fetched before a card is drawn').toEqual([]);

  const phases: string[] = [];
  const poll = setInterval(async () => {
    try { const p = await scene.getAttribute('data-phase', { timeout: 500 }); if (p && phases[phases.length - 1] !== p) phases.push(p); } catch { /* page closing */ }
  }, 40);
  for (const n of [7, 30, 60]) {
    await pick(page, n);
    await expect(scene).toHaveAttribute('data-phase', 'drawing');
    expect(aiCalls).toBe(0);
    await expect(scene).toHaveAttribute('data-phase', n === 60 ? 'done' : 'ready', { timeout: 120000 });
  }
  phases.push((await scene.getAttribute('data-phase')) ?? '');
  clearInterval(poll);
  expect(aiCalls, 'AI must not be called while animating').toBe(0);
  for (const p of ['shuffling', 'ready', 'drawing', 'revealing', 'done']) expect(phases, p).toContain(p);
  expect(phases.indexOf('drawing')).toBeLessThan(phases.indexOf('revealing'));

  // the three cards the hand drew are exactly the ones whose artwork the table loaded
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('arcana:history:v1')!)[0].cards as { cardId: string; position: string }[]);
  expect(stored.map(c => c.position)).toEqual(['Quá khứ', 'Hiện tại', 'Tương lai']);
  expect(new Set(stored.map(c => c.cardId)).size).toBe(3);
  expect([...new Set(textureRequests)].sort()).toEqual(stored.map(c => manifest.images[c.cardId]).sort());

  const probe = await page.evaluate(() => (window as unknown as { __tarotProbe: Probe }).__tarotProbe);
  expect(probe.grabs).toHaveLength(3);
  for (const g of probe.grabs) {
    expect(g.curl, 'fingers are closed on the card before it leaves the table').toBeGreaterThan(0.98);
    expect(g.moved, 'card does not move before the hand has grabbed it').toBeLessThan(0.002);
    expect(g.dist, 'fingertips are on the card edge at the grab').toBeLessThan(0.12);
  }
  expect(probe.carried, 'the card is carried for many frames').toBeGreaterThan(20);
  expect(probe.carryMax - probe.carryMin, 'card stays fixed relative to the hand while carried').toBeLessThan(0.45);
  expect(probe.minCardY, 'card never sinks into the table').toBeGreaterThan(-0.001);
  expect(probe.minHandY, 'hand never sinks into the table').toBeGreaterThan(-0.001);
  expect(probe.minCamArm, 'camera never clips the arm').toBeGreaterThan(1.8);

  // analysis is only offered now, and uses the same locked cards
  await page.getByRole('button', { name: 'Phân tích bằng AI' }).click();
  await expect.poll(() => aiCalls).toBe(1);
  expect(errors).toEqual([]);
});

test('canvas renders non-blank 3D pixels and the page has no horizontal scroll', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startReading(page);
  const scene = page.getByTestId('tarot-scene');
  await expect(scene).toHaveAttribute('data-phase', 'ready', { timeout: 120000 });
  const shot = await scene.locator('.table3d-canvas').screenshot();
  expect(shot.length).toBeGreaterThan(20000); // a flat or blank frame compresses far smaller
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  const box = await scene.locator('canvas').boundingBox();
  expect(box!.width).toBeGreaterThan(300); expect(box!.height).toBeGreaterThan(300);
});

test('"Xáo lại" before drawing rebuilds the deck without breaking the table', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startReading(page);
  const scene = page.getByTestId('tarot-scene');
  await expect(scene).toHaveAttribute('data-phase', 'ready', { timeout: 120000 });
  await page.getByRole('button', { name: 'Xáo lại' }).click();
  await expect(scene).toHaveAttribute('data-phase', 'ready', { timeout: 120000 });
  await expect(page.getByRole('button', { name: /^Chọn lá úp số \d+$/ })).toHaveCount(78);
  await pick(page, 12);
  await expect(scene).toHaveAttribute('data-picked', '1');
});
