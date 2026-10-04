import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CARD_H, CARD_RADIUS, CARD_T, CARD_W } from './layout';

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function normaliseUv(g: THREE.BufferGeometry) {
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / CARD_W + 0.5, p.getY(i) / CARD_H + 0.5);
}

/**
 * One merged geometry with three material groups: [0] edge body, [1] front
 * (+z), [2] back (-z). UVs span the full face, so artwork is never stretched.
 */
export function makeCardGeometry() {
  const shape = roundedRect(CARD_W, CARD_H, CARD_RADIUS);
  const body = new THREE.ExtrudeGeometry(shape, { depth: CARD_T, bevelEnabled: false, curveSegments: 5 });
  body.translate(0, 0, -CARD_T / 2);
  const front = new THREE.ShapeGeometry(shape, 5); normaliseUv(front); front.translate(0, 0, CARD_T / 2 + 0.0006);
  const back = new THREE.ShapeGeometry(shape, 5); normaliseUv(back); back.rotateY(Math.PI); back.translate(0, 0, -CARD_T / 2 - 0.0006);
  const parts = [body, front, back].map(g => g.index ? g.toNonIndexed() : g);
  const merged = mergeGeometries(parts, true)!;
  merged.computeBoundingSphere();
  return merged;
}
