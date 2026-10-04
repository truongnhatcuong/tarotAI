import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { CARD_H, CARD_T, CARD_W, cameraFor, fanPoses, layoutMode, pilePose, slotPose, stackPose, type LayoutMode } from '../src/components/tarot3d/layout';
const manifest = JSON.parse(readFileSync(new URL('../src/data/image-manifest.json', import.meta.url), 'utf8')) as { images: Record<string, string> };
const modes: LayoutMode[] = ['wide', 'compact', 'narrow'];
test('3D card face has the exact aspect ratio of every Rider–Waite PNG (no stretching)', () => {
  const ratio = CARD_W / CARD_H;
  for (const [id, path] of Object.entries(manifest.images)) {
    const bytes = readFileSync(new URL(`../public${path}`, import.meta.url));
    const w = bytes.readUInt32BE(16), h = bytes.readUInt32BE(20);
    assert.ok(Math.abs(w / h - ratio) < 0.002, `${id}: ${w}x${h} vs card ${CARD_W}x${CARD_H.toFixed(3)}`);
  }
});
test('layout mode follows the canvas aspect ratio', () => {
  assert.equal(layoutMode(0.5), 'narrow'); assert.equal(layoutMode(1.23), 'compact'); assert.equal(layoutMode(1.9), 'wide');
});
test('every pose rests on the table, never inside it, for the full deck and any remaining count', () => {
  for (const mode of modes) for (const n of [78, 77, 40, 3, 1]) {
    const poses = fanPoses(n, mode); assert.equal(poses.length, n);
    for (const p of poses) assert.ok(p.y >= CARD_T / 2 - 1e-9, `${mode}/${n}: y=${p.y}`);
  }
  for (let i = 0; i < 78; i++) { assert.ok(stackPose(i).y >= CARD_T / 2); for (const m of modes) assert.ok(pilePose(i, m).y >= CARD_T / 2); }
});
test('fanned cards overlap in a strict height order so none z-fight (strip is always the card on top)', () => {
  for (const mode of modes) {
    const poses = fanPoses(78, mode);
    const perRow = Math.ceil(78 / 2);
    for (let i = 1; i < 78; i++) {
      if (mode !== 'wide' && i === perRow) continue; // second row starts a new, non-overlapping row
      assert.ok(poses[i].y > poses[i - 1].y, `${mode} #${i}`);
    }
  }
});
test('the whole fan, slots and labels project inside the viewport for wide, compact and phone canvases', () => {
  for (const [aspect, mode] of [[1.9, 'wide'], [1.23, 'compact'], [0.46, 'narrow']] as const) {
    const cam = new THREE.PerspectiveCamera(cameraFor(aspect, mode).fov, aspect, 0.5, 60);
    const { pos, look } = cameraFor(aspect, mode);
    cam.position.set(...pos); cam.lookAt(...look); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
    for (const p of fanPoses(78, mode)) for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const v = new THREE.Vector3(p.x + (dx * CARD_W) / 2, p.y, p.z + (dz * CARD_H) / 2).project(cam);
      assert.ok(Math.abs(v.x) <= 1 && v.y >= -1 && v.y <= 1, `${mode}: card corner outside viewport (${v.x.toFixed(2)}, ${v.y.toFixed(2)})`);
    }
    const nearestDeckZ = Math.min(...fanPoses(78, mode).map(p => p.z - CARD_H / 2));
    for (let i = 0; i < 3; i++) assert.ok(slotPose(i, 3, mode === 'narrow').z + CARD_H / 2 < nearestDeckZ, `${mode}: slot ${i} overlaps the deck`);
  }
});
test('slots are evenly spaced, distinct and do not overlap each other', () => {
  for (const narrow of [false, true]) {
    const s = [0, 1, 2].map(i => slotPose(i, 3, narrow));
    assert.ok(s[1].x - s[0].x > CARD_W && s[2].x - s[1].x > CARD_W);
    assert.ok(Math.abs(s[0].x + s[2].x) < 1e-9);
  }
});
