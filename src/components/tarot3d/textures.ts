import * as THREE from 'three';
import { jitter } from './layout';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return { c, g: c.getContext('2d')! };
}
function finish(c: HTMLCanvasElement, srgb = true, repeat?: [number, number]) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 8;
  return t;
}

/** Dark violet felt: soft vignette plus fibre noise. Returns colour + bump maps. */
export function makeClothTextures() {
  const size = 1024;
  const { c, g } = canvas(size, size);
  const grad = g.createRadialGradient(size / 2, size / 2, 60, size / 2, size / 2, size * 0.75);
  grad.addColorStop(0, '#2a1d4a'); grad.addColorStop(1, '#150e29');
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (jitter(i * 0.37) - 0.5) * 22;
    img.data[i] += n; img.data[i + 1] += n * 0.8; img.data[i + 2] += n * 1.2;
  }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.08;
  for (let i = 0; i < 2600; i++) {
    g.strokeStyle = jitter(i) > 0.5 ? '#c9b6ff' : '#000';
    g.beginPath(); const x = jitter(i + 5) * size, y = jitter(i + 9) * size, a = jitter(i + 13) * Math.PI;
    g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); g.stroke();
  }
  const color = finish(c, true, [2.6, 2.8]);
  const bump = finish(c, false, [2.6, 2.8]);
  return { color, bump };
}

export function makeWoodTexture() {
  const { c, g } = canvas(512, 512);
  g.fillStyle = '#2b1a12'; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y++) {
    const w = Math.sin(y * 0.09) * 0.5 + Math.sin(y * 0.31 + 2) * 0.3;
    g.fillStyle = `rgba(${90 + w * 40},${52 + w * 22},${30 + w * 14},0.34)`;
    g.fillRect(0, y, 512, 1 + jitter(y) * 2);
  }
  return finish(c, true, [3, 1]);
}

/**
 * One shared card back. Point-symmetric on purpose: a reversed card is placed
 * rotated 180° before it is flipped, which must be indistinguishable face down.
 */
export function makeCardBackTexture() {
  const w = 600, h = 1054;
  const { c, g } = canvas(w, h);
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#2b1b57'); bg.addColorStop(1, '#171033');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#d6b36a'; g.lineWidth = 7; g.strokeRect(34, 34, w - 68, h - 68);
  g.lineWidth = 2; g.strokeRect(58, 58, w - 116, h - 116);
  g.save(); g.translate(w / 2, h / 2);
  // radiating rays + concentric rings
  g.strokeStyle = 'rgba(214,179,106,0.55)'; g.lineWidth = 2;
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 70, Math.sin(a) * 70); g.lineTo(Math.cos(a) * 210, Math.sin(a) * 210); g.stroke(); }
  for (const r of [70, 110, 210]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
  // crescent moon
  g.fillStyle = '#d6b36a'; g.beginPath(); g.arc(0, 0, 54, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#231650'; g.beginPath(); g.arc(20, -8, 50, 0, Math.PI * 2); g.fill();
  g.restore();
  // point-symmetric word + stars
  g.fillStyle = '#d6b36a'; g.textAlign = 'center'; g.font = '600 44px Georgia, serif';
  const word = (flip: boolean) => { g.save(); g.translate(w / 2, flip ? h - 120 : 120); if (flip) g.rotate(Math.PI); g.fillText('A R C A N A', 0, 0); g.restore(); };
  word(false); word(true);
  g.font = '34px Georgia, serif';
  for (const [x, y] of [[w / 2, 190], [w / 2, h - 190], [130, h / 2 - 260], [w - 130, h / 2 + 260]]) g.fillText('✦', x, y);
  return finish(c);
}

export function makeFlameTexture() {
  const { c, g } = canvas(64, 128);
  const grad = g.createRadialGradient(32, 82, 2, 32, 82, 56);
  grad.addColorStop(0, 'rgba(255,248,214,1)'); grad.addColorStop(0.3, 'rgba(255,190,90,0.85)'); grad.addColorStop(1, 'rgba(255,120,30,0)');
  g.fillStyle = grad; g.beginPath(); g.ellipse(32, 80, 24, 50, 0, 0, Math.PI * 2); g.fill();
  return finish(c);
}

/** A small pill label ("01 Quá khứ") drawn once to a canvas, used as a sprite above each spread slot. */
export function makeLabelTexture(num: string, text: string) {
  const { c, g } = canvas(512, 96);
  g.font = '600 40px system-ui, "Segoe UI", sans-serif';
  const wNum = g.measureText(num).width, wText = g.measureText(text).width;
  const total = wNum + 18 + wText, w = total + 56, x0 = (512 - w) / 2;
  g.fillStyle = 'rgba(16,14,24,0.78)'; g.beginPath(); g.roundRect(x0, 14, w, 68, 34); g.fill();
  g.strokeStyle = 'rgba(196,167,125,0.55)'; g.lineWidth = 2; g.stroke();
  g.textBaseline = 'middle';
  g.fillStyle = '#c4a77d'; g.fillText(num, x0 + 28, 49);
  g.fillStyle = '#eee5d8'; g.font = '500 40px system-ui, "Segoe UI", sans-serif'; g.fillText(text, x0 + 28 + wNum + 18, 49);
  return finish(c);
}
