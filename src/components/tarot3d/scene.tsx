'use client';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, PerformanceMonitor, Sparkles } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { drawFromDeck } from '@/services/draw';
import type { DrawnCard, SpreadId } from '@/types/tarot';
import { CARD_H, CARD_T, CARD_W, STACK_Z, cameraFor, fanPoses, layoutMode, pilePose, restHandTarget, slotPose, stackPose, type Pose } from './layout';
import { makeCardBackTexture, makeClothTextures, makeFlameTexture, makeLabelTexture, makeWoodTexture } from './textures';
import { makeCardGeometry } from './card-geometry';
import { ModelHand, ProceduralHand, type HandRig } from './hand';

export type Phase = 'intro' | 'shuffling' | 'ready' | 'drawing' | 'revealing' | 'done' | 'error';
export interface SceneState { phase: Phase; picked: number; message?: string }
export interface SceneControl { choose(deckIndex: number): void; focus(deckIndex: number): void }
export interface SceneProps {
  deck: string[]; spreadId: SpreadId; positions: readonly string[]; allowReversed: boolean; imageOf: (id: string) => string;
  narrow: boolean; quality: 'high' | 'low'; reducedMotion: boolean; handModel: string | null;
  onState: (s: SceneState) => void; onComplete: (draws: DrawnCard[]) => void; onZoom: (drawn: DrawnCard) => void;
  controlRef: React.MutableRefObject<SceneControl | null>; onQualityDrop: () => void;
}

const SHOULDER = new THREE.Vector3(2.8, 1.6, 10.5); // where the player's right arm attaches, behind the camera
const INSET = 0.1; // how far inside the near edge the fingertips pinch the card
const TABLE_EPS = 0.002;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface HandState { tx: number; ty: number; tz: number; yaw: number; pitch: number; roll: number; curl: number; spread: number }
interface Carry { card: THREE.Group; blend: number; tilt: number; roll: number; snapPos: THREE.Vector3; snapQuat: THREE.Quaternion }

const CORNERS: THREE.Vector3[] = [];
for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) CORNERS.push(new THREE.Vector3(sx * CARD_W / 2, sy * CARD_H / 2, sz * CARD_T / 2));
const tmpV = new THREE.Vector3();
/** Guarantees a card never sinks into the table, whatever pose it is in. */
function liftAboveTable(card: THREE.Object3D) {
  card.updateMatrixWorld(true);
  let min = Infinity;
  for (const c of CORNERS) min = Math.min(min, tmpV.copy(c).applyMatrix4(card.matrixWorld).y);
  if (min < TABLE_EPS) { card.position.y += TABLE_EPS - min; card.updateMatrixWorld(true); }
}

interface Probe { grabs: { dist: number; moved: number; curl: number }[]; frames: number; carried: number; minCardY: number; minHandY: number; carryMin: number; carryMax: number; minCamArm: number }
function probe(): Probe {
  const w = window as unknown as { __tarotProbe?: Probe };
  return (w.__tarotProbe ??= { grabs: [], frames: 0, carried: 0, minCardY: Infinity, minHandY: Infinity, carryMin: Infinity, carryMax: 0, minCamArm: Infinity });
}

function World(props: SceneProps) {
  const { deck, spreadId, positions, quality, reducedMotion } = props;
  const propsRef = useRef(props); propsRef.current = props;
  const { gl, camera, size } = useThree();
  const speed = reducedMotion ? 0.12 : 1;
  // Layout is chosen once from the first measured aspect so a resize never reshuffles a reading in progress.
  const modeRef = useRef(layoutMode(size.width / Math.max(size.height, 1)));
  const mode = modeRef.current;
  const narrow = mode === 'narrow';

  const geometry = useMemo(makeCardGeometry, []);
  const backTex = useMemo(() => { const t = makeCardBackTexture(); t.anisotropy = 8; return t; }, []);
  const cloth = useMemo(makeClothTextures, []);
  const wood = useMemo(makeWoodTexture, []);
  const flame = useMemo(makeFlameTexture, []);
  const mats = useMemo(() => ({
    edge: new THREE.MeshStandardMaterial({ color: '#e7ddc4', roughness: 0.7 }),
    blank: new THREE.MeshStandardMaterial({ color: '#cfc5ad', roughness: 0.7 }),
    back: new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.52, metalness: 0.05 }),
  }), [backTex]);

  const cardMaterials = useMemo(() => deck.map(() => [mats.edge, mats.blank, mats.back] as THREE.Material[]), [deck, mats]);
  const outer = useRef<(THREE.Group | null)[]>([]);
  const inner = useRef<(THREE.Group | null)[]>([]);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const rigRef = useRef<HandRig | null>(null);
  const hand = useRef<HandState>({ tx: 0, ty: 1, tz: 4, yaw: -0.15, pitch: -0.5, roll: 0, curl: 0.3, spread: 0.3 });
  const carry = useRef<Carry | null>(null);
  const active = useRef<THREE.Group | null>(null);
  const phase = useRef<Phase>('intro');
  const remaining = useRef<number[]>(deck.map((_, i) => i));
  const picked = useRef<{ deckIndex: number; drawn: DrawnCard }[]>([]);
  const hover = useRef(-1);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useRef(0);
  const focusState = useRef({ k: 0, x: 0, z: 0, zoom: 0 });
  const camLook = useRef(new THREE.Vector3());
  const pinchWorld = useRef(new THREE.Vector3());
  const slotMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const candleLight = useRef<THREE.PointLight>(null);
  const flameSprite = useRef<THREE.Sprite>(null);
  const texCache = useRef(new Map<string, Promise<THREE.Texture>>());
  const [handReady, setHandReady] = useState(false);
  const onRig = useCallback((rig: HandRig) => { rigRef.current = rig; setHandReady(true); }, []);

  const slotTexture = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 448;
    const g = c.getContext('2d')!;
    g.strokeStyle = '#e8c878'; g.lineWidth = 5; g.setLineDash([16, 12]);
    g.beginPath(); g.roundRect(8, 8, 240, 432, 22); g.stroke();
    g.fillStyle = 'rgba(232,200,120,0.07)'; g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);

  const labelTextures = useMemo(() => positions.map((p, i) => makeLabelTexture(`0${i + 1}`, p)), [positions]);

  const emit = useCallback((p: Phase, message?: string) => {
    phase.current = p;
    propsRef.current.onState({ phase: p, picked: picked.current.length, message });
  }, []);

  // ---- helpers -------------------------------------------------------------
  const tw = useCallback((target: object, vars: gsap.TweenVars) => new Promise<void>(resolve => {
    gsap.to(target, { ...vars, duration: ((vars.duration as number | undefined) ?? 0.5) * speed, overwrite: 'auto', onComplete: () => resolve() });
  }), [speed]);
  // Resolves after the next rendered frame, i.e. once the hand rig has actually been posed with the latest state.
  const frameWaiters = useRef<(() => void)[]>([]);
  const nextFrame = useCallback(() => new Promise<void>(resolve => { frameWaiters.current.push(resolve); }), []);
  const wait = useCallback((s: number) => new Promise<void>(r => setTimeout(r, s * 1000 * speed)), [speed]);

  const setPose = useCallback((card: THREE.Object3D, p: Pose, faceDown = true) => {
    card.rotation.order = 'YXZ';
    card.position.set(p.x, p.y, p.z);
    card.rotation.set(faceDown ? Math.PI / 2 : -Math.PI / 2, p.yaw, p.roll);
  }, []);

  const loadFront = useCallback((id: string) => {
    let promise = texCache.current.get(id);
    if (!promise) {
      promise = new THREE.TextureLoader().loadAsync(propsRef.current.imageOf(id)).then(t => {
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy()); return t;
      });
      texCache.current.set(id, promise);
      promise.catch(() => texCache.current.delete(id));
    }
    return promise;
  }, [gl]);

  const nearEdge = useCallback((card: THREE.Object3D) => {
    // The face-down card's long axis lies along its local Y; the end nearer the player is the grab edge.
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(card.quaternion); axis.y = 0; axis.normalize();
    if (axis.z < 0) axis.negate();
    const p = card.position.clone().addScaledVector(axis, CARD_H / 2 - INSET);
    return { x: p.x, z: p.z, yaw: Math.atan2(axis.x, axis.z) };
  }, []);

  const respace = useCallback(() => {
    const poses = fanPoses(remaining.current.length, mode);
    remaining.current.forEach((di, k) => {
      const c = outer.current[di]; if (!c) return;
      const p = poses[k];
      gsap.to(c.position, { x: p.x, y: p.y, z: p.z, duration: 0.8 * speed, ease: 'power2.inOut', overwrite: 'auto' });
      gsap.to(c.rotation, { y: p.yaw, duration: 0.8 * speed, ease: 'power2.inOut', overwrite: 'auto' });
    });
  }, [mode, speed]);

  const goRest = useCallback((duration = 0.9) => {
    const r = restHandTarget(mode);
    return tw(hand.current, { tx: r.x, ty: r.y, tz: r.z, yaw: -0.2, pitch: -0.45, roll: 0, curl: 0.3, spread: 0.3, duration, ease: 'power2.inOut' });
  }, [mode, tw]);

  // ---- choreography ----------------------------------------------------------
  const shuffleIntro = useCallback(async (token: number) => {
    const live = () => run.current === token;
    emit('shuffling');
    const n = deck.length;
    deck.forEach((_, i) => { const c = outer.current[i]; if (c) setPose(c, stackPose(i)); });
    if (!reducedMotion) {
      await wait(0.5); if (!live()) return;
      for (let round = 0; round < 2; round++) {
        const L: number[] = [], R: number[] = [];
        for (let k = 0; k < n; k++) (k % 2 === 0 ? L : R).push(k);
        // cut into two piles
        const cut = gsap.timeline();
        for (let k = 0; k < n; k++) {
          const c = outer.current[k]!; const left = k % 2 === 0; const h = (k >> 1) * (CARD_T + 0.0007);
          cut.to(c.position, { x: left ? -1.3 : 1.3, y: CARD_T / 2 + h, z: STACK_Z + (Math.sin(k) * 0.04), duration: 0.32, ease: 'power2.out' }, k * 0.006);
          cut.to(c.rotation, { y: (left ? 1 : -1) * 0.08, duration: 0.32 }, k * 0.006);
        }
        await new Promise<void>(r => cut.eventCallback('onComplete', () => r())); if (!live()) return;
        // riffle the piles back together, alternating
        const order: number[] = []; const l = [...L].reverse(), r2 = [...R].reverse();
        while (l.length || r2.length) { if (l.length) order.push(l.shift()!); if (r2.length) order.push(r2.shift()!); }
        const riffle = gsap.timeline();
        order.forEach((k, m) => {
          const c = outer.current[k]!; const t0 = m * 0.013;
          riffle.to(c.position, { keyframes: [{ y: 0.55, duration: 0.14, ease: 'power1.out' }, { y: CARD_T / 2 + m * (CARD_T + 0.0007), duration: 0.14, ease: 'power1.in' }] }, t0);
          riffle.to(c.position, { x: (Math.sin(m) * 0.03), z: STACK_Z + Math.cos(m) * 0.03, duration: 0.28, ease: 'power1.inOut' }, t0);
          riffle.to(c.rotation, { y: Math.sin(m * 1.9) * 0.06, duration: 0.28 }, t0);
        });
        await new Promise<void>(res => riffle.eventCallback('onComplete', () => res())); if (!live()) return;
        await wait(0.12);
      }
    }
    // spread into the fan
    const poses = fanPoses(n, mode);
    const spread = gsap.timeline();
    deck.forEach((_, i) => {
      const c = outer.current[i]!; const p = poses[i];
      spread.to(c.position, { x: p.x, y: p.y, z: p.z, duration: 0.8 * speed, ease: 'power3.out' }, i * 0.009 * speed);
      spread.to(c.rotation, { x: Math.PI / 2, y: p.yaw, z: 0, duration: 0.8 * speed, ease: 'power3.out' }, i * 0.009 * speed);
    });
    await new Promise<void>(r => spread.eventCallback('onComplete', () => r())); if (!live()) return;
    await goRest(0.6); if (!live()) return;
    emit('ready');
  }, [deck, emit, goRest, mode, reducedMotion, setPose, speed, wait]);

  const flipCard = useCallback(async (token: number, card: THREE.Group, slot: Pose, drawn: DrawnCard) => {
    const live = () => run.current === token;
    const rev = drawn.orientation === 'reversed';
    const fl = { u: 0 };
    // hand taps the edge of the card, then draws away as it flips
    const edge = nearEdge(card);
    await tw(hand.current, { tx: edge.x, ty: 0.45, tz: edge.z + 0.25, yaw: 0, pitch: -0.5, curl: 0.2, spread: 0.5, duration: 0.55, ease: 'power2.inOut' });
    if (!live()) return;
    await tw(hand.current, { ty: 0.1, tz: edge.z + 0.02, curl: 0.45, duration: 0.2, ease: 'power2.in' });
    if (!live()) return;
    void tw(hand.current, { ty: 1.3, tz: edge.z + 1.2, curl: 0.2, duration: 0.8, ease: 'power2.inOut' });
    const fx = focusState.current; fx.x = slot.x; fx.z = slot.z; void tw(fx, { k: 1, duration: 0.9, ease: 'power2.inOut' });
    await tw(fl, {
      u: 1, duration: 1.05, ease: 'power2.inOut', onUpdate: () => {
        const e = fl.u; const rx = lerp(Math.PI / 2, -Math.PI / 2, e);
        card.rotation.set(rx, 0, (rev ? Math.PI : 0) + Math.sin(Math.PI * e) * 0.05);
        card.position.set(slot.x, slot.y + Math.sin(Math.PI * e) * 0.32, slot.z + Math.sin(Math.PI * e) * 0.1);
        liftAboveTable(card);
      },
    });
    card.rotation.set(-Math.PI / 2, 0, rev ? Math.PI : 0); card.position.set(slot.x, slot.y, slot.z); liftAboveTable(card);
    if (!live()) return;
    await goRest(0.9);
  }, [goRest, nearEdge, tw]);

  const choose = useCallback(async (deckIndex: number) => {
    const p = propsRef.current;
    if (phase.current !== 'ready' || !remaining.current.includes(deckIndex)) return;
    const token = run.current;
    const live = () => run.current === token;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hover.current = -1;
    const slotIndex = picked.current.length, total = positions.length;
    // The identity AND orientation are locked here, before any animation moves.
    const drawn = drawFromDeck(deck, deckIndex, spreadId, slotIndex, p.allowReversed);
    picked.current.push({ deckIndex, drawn });
    emit('drawing');
    const texture = loadFront(drawn.cardId); texture.catch(() => undefined);
    const card = outer.current[deckIndex]!;
    active.current = card;
    const restPos = card.position.clone();
    const slot = slotPose(slotIndex, total, narrow);
    const roll = drawn.orientation === 'reversed' ? Math.PI : 0;
    remaining.current = remaining.current.filter(i => i !== deckIndex);

    // approach → reach → grab
    const edge = nearEdge(card);
    await tw(hand.current, { tx: edge.x, ty: 1.05, tz: edge.z, yaw: edge.yaw, pitch: -0.5, roll: 0, curl: 0.1, spread: 0.6, duration: 0.8, ease: 'power2.inOut' });
    if (!live()) return;
    await tw(hand.current, { ty: 0.09, curl: 0.2, spread: 0.2, duration: 0.45, ease: 'power2.inOut' });
    if (!live()) return;
    await tw(hand.current, { curl: 1, duration: 0.3, ease: 'power2.in' });
    await nextFrame(); // the fingers must be *drawn* closed on the card before it can leave the table
    if (!live()) return;

    // The card only leaves the table now that the fingers are closed on it.
    const c: Carry = { card, blend: 0, tilt: 0, roll, snapPos: card.position.clone(), snapQuat: card.quaternion.clone() };
    carry.current = c;
    if (process.env.NODE_ENV !== 'production') {
      // contact evidence: where the fingertips were relative to the card edge at the instant it left the table
      const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(card.quaternion); ax.y = 0; ax.normalize(); if (ax.z < 0) ax.negate();
      const anchor = card.position.clone().addScaledVector(ax, CARD_H / 2 - INSET);
      probe().grabs.push({ dist: pinchWorld.current.distanceTo(anchor), moved: card.position.distanceTo(restPos), curl: hand.current.curl});
    }
    respace();
    // lift
    await Promise.all([
      tw(c, { blend: 1, duration: 0.3, ease: 'power1.out' }),
      tw(c, { tilt: 0.32, duration: 0.6, ease: 'power2.out' }),
      tw(hand.current, { ty: 1.0, pitch: -0.68, duration: 0.6, ease: 'power2.out' }),
    ]);
    if (!live()) return;
    // move over the slot (arc), turning the hand to square the card with the slot
    const half = CARD_H / 2 - INSET;
    await Promise.all([
      tw(hand.current, { tx: slot.x, tz: slot.z + half, yaw: 0, duration: 1.0, ease: 'sine.inOut' }),
      tw(hand.current, { ty: 1.45, duration: 0.5, ease: 'power1.out' }).then(() => tw(hand.current, { ty: 1.2, duration: 0.5, ease: 'power1.in' })),
      tw(c, { tilt: 0.18, duration: 1.0, ease: 'sine.inOut' }),
    ]);
    if (!live()) return;
    // place
    await Promise.all([
      tw(hand.current, { ty: slot.y + 0.05, pitch: -0.5, duration: 0.55, ease: 'power2.inOut' }),
      tw(c, { tilt: 0, duration: 0.55, ease: 'power2.inOut' }),
    ]);
    if (!live()) return;
    // release
    carry.current = null;
    card.rotation.set(Math.PI / 2, 0, roll);
    await Promise.all([
      tw(hand.current, { curl: 0.25, duration: 0.3, ease: 'power1.out' }),
      tw(card.position, { x: slot.x, y: slot.y, z: slot.z, duration: 0.14, ease: 'power1.in' }),
    ]);
    if (!live()) return;
    void tw(hand.current, { ty: 1.3, tz: slot.z + 1.9, curl: 0.3, duration: 0.55, ease: 'power2.out' });
    // brief rest, face down, so the placement is felt before the reveal
    await wait(0.45); if (!live()) return;
    emit('revealing');
    let tex: THREE.Texture;
    try { tex = await texture; } catch {
      emit('error', 'Không tải được ảnh Rider–Waite. Lá bài vẫn được giữ nguyên, hãy tải lại trang để thử lại.'); return;
    }
    if (!live()) return;
    const mesh = meshes.current[deckIndex]!;
    cardMaterials[deckIndex][1] = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0 });
    void mesh;
    await flipCard(token, card, slot, drawn);
    if (!live()) return;
    void tw(focusState.current, { k: 0, duration: 1.0, ease: 'power2.inOut' });
    await wait(0.7); if (!live()) return;

    if (picked.current.length === total) {
      // Whatever is left of the deck is cleared from the table.
      const rest = remaining.current;
      const tl = gsap.timeline();
      rest.forEach((di, k) => {
        const cc = outer.current[di]!; const pp = pilePose(k, mode);
        tl.to(cc.position, { x: pp.x, y: pp.y, z: pp.z, duration: 0.9 * speed, ease: 'power2.inOut' }, k * 0.006 * speed);
        tl.to(cc.rotation, { y: pp.yaw, duration: 0.9 * speed, ease: 'power2.inOut' }, k * 0.006 * speed);
      });
      await new Promise<void>(r => tl.eventCallback('onComplete', () => r())); if (!live()) return;
      emit('done');
      void tw(focusState.current, { zoom: 1, duration: 1.6, ease: 'power2.inOut' });
      p.onComplete(picked.current.map(x => x.drawn));
    } else {
      emit('ready');
    }
  }, [cardMaterials, deck, emit, flipCard, loadFront, narrow, nearEdge, nextFrame, positions.length, respace, spreadId, speed, tw, wait]);

  const hoverCard = useCallback((di: number) => {
    if (phase.current !== 'ready') return;
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
    if (di < 0) { hover.current = -1; hoverTimer.current = setTimeout(() => { if (phase.current === 'ready') void goRest(0.8); }, 700); return; }
    if (hover.current === di) return;
    hover.current = di;
    const card = outer.current[di]; if (!card) return;
    const e = nearEdge(card);
    gsap.to(hand.current, { tx: e.x, ty: 0.8, tz: e.z + 0.15, yaw: e.yaw, pitch: -0.5, curl: 0.12, spread: 0.55, duration: 0.5 * speed, ease: 'power2.out', overwrite: 'auto' });
  }, [goRest, nearEdge, speed]);

  const onCardClick = useCallback((di: number) => {
    if (phase.current === 'ready') { void choose(di); return; }
    if (phase.current === 'done') { const hit = picked.current.find(x => x.deckIndex === di); if (hit) propsRef.current.onZoom(hit.drawn); }
  }, [choose]);

  useEffect(() => {
    props.controlRef.current = {
      choose: di => { hoverCard(di); void choose(di); },
      focus: di => hoverCard(di),
    };
    return () => { props.controlRef.current = null; };
  }, [choose, hoverCard, props.controlRef]);

  // Start / restart the intro. The token makes React strict-mode double mounts harmless.
  useEffect(() => {
    if (!handReady) return;
    const token = ++run.current;
    picked.current = []; remaining.current = deck.map((_, i) => i); carry.current = null; hover.current = -1;
    const r = restHandTarget(mode);
    Object.assign(hand.current, { tx: r.x, ty: r.y, tz: r.z, yaw: -0.2, pitch: -0.45, roll: 0, curl: 0.3, spread: 0.3 });
    void shuffleIntro(token);
    const cards = outer.current;
    return () => {
      run.current++;
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      for (const c of cards) if (c) { gsap.killTweensOf(c.position); gsap.killTweensOf(c.rotation); }
      gsap.killTweensOf(hand.current); gsap.killTweensOf(focusState.current);
    };
  }, [deck, handReady, narrow, shuffleIntro]);

  // ---- per-frame -----------------------------------------------------------
  const slots = useMemo(() => positions.map((_, i) => slotPose(i, positions.length, narrow)), [positions, narrow]);
  const camBase = useMemo(() => cameraFor(size.width / Math.max(size.height, 1), mode), [size.width, size.height, mode]);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const eul = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => { gl.toneMappingExposure = 1.55; }, [gl]);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const slow = Number(new URLSearchParams(location.search).get('tarotSlow'));
    if (slow > 0) gsap.globalTimeline.timeScale(slow);
    (window as unknown as { __tarotGsap?: typeof gsap }).__tarotGsap = gsap; // dev-only hook for step-by-step inspection
  }, []);
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = camBase.fov; cam.near = 0.5; cam.far = 60; cam.updateProjectionMatrix();
    cam.position.set(...camBase.pos); camLook.current.set(...camBase.look); cam.lookAt(camLook.current);
  }, [camera, camBase]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const damp = (rate: number) => 1 - Math.exp(-dt * rate);
    // camera: first-person view with a small parallax and a gentle focus pull
    const fx = focusState.current;
    desired.set(camBase.pos[0] + state.pointer.x * 0.35, camBase.pos[1] + state.pointer.y * 0.2, camBase.pos[2]);
    lookTarget.set(camBase.look[0], camBase.look[1], camBase.look[2]);
    if (fx.k > 0) { tmp.set(fx.x, 0, fx.z); lookTarget.lerp(tmp, fx.k * 0.5); desired.lerp(tmp.set(fx.x, 2.6, fx.z + 3.2), fx.k * 0.22); }
    if (fx.zoom > 0) { // once the spread is complete, ease in toward the revealed cards
      lookTarget.lerp(tmp.set(0, 0, slots[0]?.z ?? -1.4), fx.zoom * 0.9);
      desired.lerp(tmp.set(0, camBase.pos[1] * 0.58, (slots[0]?.z ?? -1.4) + camBase.pos[1] * 0.5), fx.zoom * 0.75);
    }
    (camera as THREE.PerspectiveCamera).position.lerp(desired, damp(3));
    camLook.current.lerp(lookTarget, damp(4)); camera.lookAt(camLook.current);

    // candle
    const flick = 1 + Math.sin(t * 17) * 0.06 + Math.sin(t * 7.3 + 1) * 0.08 + Math.sin(t * 31) * 0.03;
    if (candleLight.current) candleLight.current.intensity = 30 * flick;
    if (flameSprite.current) flameSprite.current.scale.set(0.34 * (2 - flick), 0.7 * flick, 1);

    // hover lift on exposed cards
    const lifting = phase.current === 'ready' ? hover.current : -1;
    for (let i = 0; i < inner.current.length; i++) {
      const g = inner.current[i]; if (!g) continue;
      const doneHit = phase.current === 'done' && picked.current.some(x => x.deckIndex === i);
      const target = i === lifting ? 0.22 : doneHit && hover.current === i ? 0.1 : 0;
      if (Math.abs(g.position.y - target) > 0.0005) g.position.y += (target - g.position.y) * damp(14);
    }

    // hand pose → world, aligned so the real pinch point sits on the target
    const rig = rigRef.current;
    if (rig) {
      const h = hand.current;
      const breath = Math.sin(t * 1.4) * 0.012;
      rig.root.rotation.set(h.pitch + breath, h.yaw, h.roll);
      rig.update(h.curl + Math.sin(t * 1.1) * 0.015, h.spread);
      rig.root.position.set(0, 0, 0); rig.root.updateMatrixWorld(true);
      rig.pinch(tmp);
      rig.root.position.set(h.tx - tmp.x, h.ty + breath - tmp.y, h.tz - tmp.z); rig.root.updateMatrixWorld(true);
      rig.aim(SHOULDER);
      const low = rig.lowest();
      if (low < 0.012) { rig.root.position.y += 0.012 - low; rig.root.updateMatrixWorld(true); }
      rig.pinch(pinchWorld.current);
    }

    // a carried card follows the measured fingertips, never the other way round
    const c = carry.current;
    if (c) {
      const h = hand.current;
      const half = CARD_H / 2 - INSET;
      fwd.set(-Math.sin(h.yaw), 0, -Math.cos(h.yaw));
      const pos = tmp.copy(pinchWorld.current).addScaledVector(fwd, half * Math.cos(c.tilt));
      pos.y -= half * Math.sin(c.tilt);
      eul.set(Math.PI / 2 - c.tilt, h.yaw, c.roll);
      q.setFromEuler(eul);
      if (c.blend < 1) { pos.lerpVectors(c.snapPos, pos, c.blend); q.slerpQuaternions(c.snapQuat, q, c.blend); }
      c.card.position.copy(pos); c.card.quaternion.copy(q);
      liftAboveTable(c.card);
    }

    if (process.env.NODE_ENV !== 'production' && active.current) {
      const p = probe(); p.frames++;
      active.current.updateMatrixWorld(true);
      let min = Infinity; for (const k of CORNERS) min = Math.min(min, tmpV.copy(k).applyMatrix4(active.current.matrixWorld).y);
      p.minCardY = Math.min(p.minCardY, min);
      if (rig) {
        p.minHandY = Math.min(p.minHandY, rig.lowest());
        // closest approach of the camera to the forearm axis (wrist → shoulder)
        const seg = SHOULDER.clone().sub(pinchWorld.current), t = THREE.MathUtils.clamp(camera.position.clone().sub(pinchWorld.current).dot(seg) / seg.lengthSq(), 0, 1);
        p.minCamArm = Math.min(p.minCamArm, camera.position.distanceTo(pinchWorld.current.clone().addScaledVector(seg, t)));
      }
      if (carry.current && carry.current.blend >= 1) { const d = active.current.position.distanceTo(pinchWorld.current); p.carryMin = Math.min(p.carryMin, d); p.carryMax = Math.max(p.carryMax, d); p.carried++; }
    }

    // glow on the slot that is waiting for its card
    slotMats.current.forEach((m, i) => {
      if (!m) return;
      const waiting = i === picked.current.length && phase.current !== 'done';
      const target = waiting ? 0.55 + Math.sin(t * 2.2) * 0.2 : i < picked.current.length ? 0 : 0.2;
      m.opacity += (target - m.opacity) * damp(6);
    });
    if (frameWaiters.current.length) { const waiting = frameWaiters.current; frameWaiters.current = []; waiting.forEach(resolve => resolve()); }
  });

  const high = quality === 'high';
  const candleX = narrow ? -3.0 : mode === 'compact' ? -4.1 : -5.1, candleZ = narrow ? -3.0 : -1.8;

  return (
    <>
      <color attach="background" args={['#07050d']} />
      <fog attach="fog" args={['#0a0714', 18, 40]} />
      <ambientLight color="#5a49a0" intensity={1.25} />
      <hemisphereLight args={['#8a74e0', '#2a1a48', 0.9]} />
      <spotLight position={[1.5, 9, 4.5]} angle={0.62} penumbra={0.85} intensity={high ? 620 : 520} decay={2} color="#ffdcae"
        castShadow={high} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.025} />
      <pointLight position={[-6, 3.5, -3]} color="#7a4dff" intensity={130} distance={16} decay={2} />
      <pointLight ref={candleLight} position={[candleX, 1.2, candleZ]} color="#ffb35a" intensity={30} distance={11} decay={2} />

      {/* table */}
      <mesh position={[0, -0.26, 0.3]} receiveShadow><boxGeometry args={[22, 0.5, 24]} /><meshStandardMaterial map={wood} roughness={0.7} color="#a07a5e" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0008, 0.3]} receiveShadow>
        <planeGeometry args={[20, 22]} />
        <meshStandardMaterial map={cloth.color} bumpMap={cloth.bump} bumpScale={0.6} roughness={0.95} />
      </mesh>
      {high && <ContactShadows position={[0, 0.004, 0.3]} opacity={0.5} scale={18} blur={2.4} far={1.8} resolution={512} frames={Infinity} color="#05030c" />}

      {/* candle */}
      <group position={[candleX, 0, candleZ]}>
        <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[0.16, 0.18, 1, 20]} /><meshStandardMaterial color="#e9dcc0" roughness={0.6} emissive="#3a2208" emissiveIntensity={0.4} /></mesh>
        <mesh position={[0, 1.02, 0]}><cylinderGeometry args={[0.012, 0.012, 0.12, 6]} /><meshBasicMaterial color="#1a1208" /></mesh>
        <sprite ref={flameSprite} position={[0, 1.32, 0]}><spriteMaterial map={flame} transparent depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      </group>

      {/* spread slots */}
      {slots.map((s, i) => (
        <group key={i} position={[s.x, 0.004, s.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[CARD_W + 0.14, CARD_H + 0.14]} />
            <meshBasicMaterial ref={m => { slotMats.current[i] = m; }} map={slotTexture} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          <sprite position={[0, 0.34, -(CARD_H / 2) - 0.3]} scale={narrow ? [2.0, 0.375, 1] : [1.9, 0.356, 1]}>
            <spriteMaterial map={labelTextures[i]} transparent depthWrite={false} />
          </sprite>
        </group>
      ))}

      {/* 78 cards */}
      {deck.map((id, i) => (
        <group key={`${i}-${id}`} ref={g => { outer.current[i] = g; }} rotation-order="YXZ" position={[0, -5, STACK_Z]}>
          <group ref={g => { inner.current[i] = g; }}>
            <mesh ref={m => { meshes.current[i] = m; }} geometry={geometry} material={cardMaterials[i]} castShadow={high} receiveShadow
              onPointerOver={e => { e.stopPropagation(); if (phase.current === 'ready') { gl.domElement.style.cursor = 'pointer'; hoverCard(i); } else if (phase.current === 'done' && picked.current.some(x => x.deckIndex === i)) { gl.domElement.style.cursor = 'zoom-in'; hover.current = i; } }}
              onPointerOut={() => { gl.domElement.style.cursor = ''; if (phase.current === 'ready') hoverCard(-1); else if (hover.current === i) hover.current = -1; }}
              onClick={e => { e.stopPropagation(); onCardClick(i); }} />
          </group>
        </group>
      ))}

      {/* hand */}
      <Suspense fallback={null}>
        {props.handModel ? <ModelHand url={props.handModel} onRig={onRig} /> : <ProceduralHand onRig={onRig} />}
      </Suspense>

      <Sparkles count={high ? 46 : 12} scale={[11, 4, 7]} position={[0, 2, 0.5]} size={2.4} speed={0.18} opacity={0.35} color="#ffe2a8" />
      {high && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.32} luminanceThreshold={0.82} luminanceSmoothing={0.3} mipmapBlur />
          <Vignette offset={0.28} darkness={0.7} />
        </EffectComposer>
      )}
    </>
  );
}

export default function TarotSceneCanvas(props: SceneProps) {
  const high = props.quality === 'high';
  return (
    <Canvas shadows={high ? 'percentage' : false} dpr={high ? [1, 1.75] : [1, 1.25]} gl={{ antialias: high, powerPreference: 'high-performance' }}
      camera={{ position: [0, 9, 8], fov: 36, near: 0.5, far: 60 }} style={{ touchAction: 'pan-y' }}>
      <PerformanceMonitor onDecline={props.onQualityDrop} flipflops={2} />
      <World {...props} />
    </Canvas>
  );
}
