// Pure layout math for the 3D table. World units: 1 unit ≈ 7.4 cm (a tarot
// card is ~7 cm wide). The player sits at +z looking toward -z; y is up.
export const CARD_W = 0.95;
export const CARD_H = CARD_W * 527 / 300; // matches the 300x527 Rider–Waite PNGs
export const CARD_T = 0.014;
export const CARD_RADIUS = 0.06;
export const STACK_Z = 2.3;

export interface Pose { x: number; y: number; z: number; yaw: number; roll: number }

// Deterministic jitter so the layout looks hand-made yet is reproducible.
export function jitter(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function stackPose(i: number): Pose {
  return { x: (jitter(i) - 0.5) * 0.06, y: CARD_T / 2 + i * (CARD_T + 0.0007), z: STACK_Z + (jitter(i + 99) - 0.5) * 0.06, yaw: (jitter(i + 7) - 0.5) * 0.12, roll: 0 };
}

/** Poses for `count` face-down cards still in the fan, in deck order. */
export type LayoutMode = 'wide' | 'compact' | 'narrow';
export function layoutMode(aspect: number): LayoutMode { return aspect < 0.9 ? 'narrow' : aspect < 1.6 ? 'compact' : 'wide'; }
export function fanPoses(count: number, mode: LayoutMode): Pose[] {
  const poses: Pose[] = [];
  const step = 0.0028; // cards overlap, so each one sits a hair higher than the last
  if (mode === 'wide') {
    const total = Math.min(1.3, Math.max(count - 1, 1) * 0.0172);
    const R = 9.5;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      const phi = t * total;
      poses.push({
        x: R * Math.sin(phi) + (jitter(i + 3) - 0.5) * 0.02,
        y: CARD_T / 2 + i * step,
        z: 2.1 + R * (1 - Math.cos(phi)) + (jitter(i + 41) - 0.5) * 0.03,
        yaw: -phi + (jitter(i + 17) - 0.5) * 0.02, roll: 0,
      });
    }
    return poses;
  }
  // Phones: two rows so every card keeps a tappable strip.
  const perRow = Math.ceil(count / 2);
  const width = Math.min(mode === 'compact' ? 7.4 : 5.7, Math.max(perRow - 1, 1) * 0.19);
  for (let i = 0; i < count; i++) {
    const row = i < perRow ? 0 : 1;
    const j = row === 0 ? i : i - perRow;
    const inRow = row === 0 ? Math.min(perRow, count) : count - perRow;
    const t = inRow <= 1 ? 0 : j / (inRow - 1) - 0.5;
    const phi = t * 0.5;
    poses.push({
      x: t * width + (jitter(i + 3) - 0.5) * 0.02,
      y: CARD_T / 2 + j * step,
      z: (row === 0 ? 0.55 : 2.55) + 1.4 * (1 - Math.cos(phi * 2)),
      yaw: -phi + (jitter(i + 17) - 0.5) * 0.02, roll: 0,
    });
  }
  return poses;
}

export function slotPose(slot: number, total: number, narrow: boolean): Pose {
  const spacing = narrow ? 1.2 : 1.55;
  return { x: (slot - (total - 1) / 2) * spacing, y: CARD_T / 2 + 0.002, z: narrow ? -1.7 : -1.45, yaw: 0, roll: 0 };
}

export function pilePose(i: number, mode: LayoutMode): Pose {
  return { x: mode === 'narrow' ? 2.5 : mode === 'compact' ? 3.9 : 4.6, y: CARD_T / 2 + i * (CARD_T + 0.0007), z: mode === 'narrow' ? -3.4 : -2.6, yaw: -0.35 + (jitter(i) - 0.5) * 0.1, roll: 0 };
}

export function restHandTarget(mode: LayoutMode): { x: number; y: number; z: number } {
  return mode === 'narrow' ? { x: 1.9, y: 0.7, z: 4.3 } : mode === 'compact' ? { x: 2.7, y: 0.75, z: 4.7 } : { x: 3.6, y: 0.8, z: 4.2 };
}

/** World-space corners of everything that must stay on screen: the whole fan, the slots and their labels. */
function framedPoints(mode: LayoutMode, slots = 3): [number, number, number][] {
  const pts: [number, number, number][] = [];
  const add = (p: Pose, h = 0) => {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const lx = (sx * CARD_W) / 2, lz = (sy * CARD_H) / 2;
      pts.push([p.x + lx * Math.cos(p.yaw) + lz * Math.sin(p.yaw), p.y + h, p.z - lx * Math.sin(p.yaw) + lz * Math.cos(p.yaw)]);
    }
  };
  for (const p of fanPoses(78, mode)) add(p);
  for (let i = 0; i < slots; i++) { const s = slotPose(i, slots, mode === 'narrow'); add(s); add({ ...s, z: s.z - 0.45 }, 0.45); }
  return pts;
}
export function cameraFor(aspect: number, mode: LayoutMode): { pos: [number, number, number]; look: [number, number, number]; fov: number } {
  const narrow = mode === 'narrow';
  const fov = narrow ? 42 : 36;
  const look: [number, number, number] = [0, 0, narrow ? 0.9 : 0.8];
  const dir = [0, 0.8, 0.6];
  const tanV = Math.tan((fov * Math.PI) / 360), tanH = tanV * aspect;
  const pts = framedPoints(mode);
  const fits = (d: number) => {
    const eye = [look[0] + dir[0] * d, look[1] + dir[1] * d, look[2] + dir[2] * d];
    const f = [look[0] - eye[0], look[1] - eye[1], look[2] - eye[2]]; const fl = Math.hypot(f[0], f[1], f[2]); f[0] /= fl; f[1] /= fl; f[2] /= fl;
    const r = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0]; // forward × up(0,1,0)
    const rl = Math.hypot(r[0], r[1], r[2]); r[0] /= rl; r[1] /= rl; r[2] /= rl;
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    return pts.every(p => {
      const v = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
      const z = v[0] * f[0] + v[1] * f[1] + v[2] * f[2];
      const x = (v[0] * r[0] + v[1] * r[1] + v[2] * r[2]) / (z * tanH), y = (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) / (z * tanV);
      return Math.abs(x) <= 0.95 && y >= -0.97 && y <= 0.93;
    });
  };
  let d = narrow ? 11 : 8.5;
  while (d < 48 && !fits(d)) d += 0.25;
  return { pos: [look[0], look[1] + dir[1] * d, look[2] + dir[2] * d], look, fov };
}
