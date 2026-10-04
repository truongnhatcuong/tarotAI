import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Procedural first-person right hand + forearm (no external model needed).
 * Local frame: fingers point to -z, palm faces -y, thumb on -x. The hand's
 * "pinch point" (midpoint of thumb and index tips) is what the scene aligns to
 * a card edge, so contact is measured from the real finger positions.
 *
 * To use an authored model instead, drop /public/models/hand.glb (origin at the
 * pinch point, fingers toward -z). It is then rendered as a static pose.
 */
export interface HandRig {
  root: THREE.Group;
  update(curl: number, spread: number): void;
  pinch(out: THREE.Vector3): THREE.Vector3;
  lowest(): number;
  /** Points the forearm at a fixed shoulder position so the arm always leaves through the bottom of the frame. */
  aim(shoulder: THREE.Vector3): void;
}
export const TIP_R = 0.1;
export const OPEN = { index: [-0.1, -0.16, -0.1], middle: [-0.12, -0.2, -0.12], ring: [-0.16, -0.26, -0.16], pinky: [-0.22, -0.3, -0.2], thumb: [0.62, -0.05, -0.08, -0.05] };
export const PINCH = { index: [-0.79, -0.95, -0.45], middle: [-1.15, -1.45, -0.8], ring: [-1.25, -1.5, -0.85], pinky: [-1.3, -1.5, -0.9], thumb: [0, -0.44, -0.48, -0.15] };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function buildHand(): HandRig {
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const skin = new THREE.MeshStandardMaterial({ color: '#d8a584', roughness: 0.56, metalness: 0 });
  const nail = new THREE.MeshStandardMaterial({ color: '#e9c2ad', roughness: 0.35 });
  const cloth = new THREE.MeshStandardMaterial({ color: '#2a1850', roughness: 0.85 });
  const trim = new THREE.MeshStandardMaterial({ color: '#c9a24d', roughness: 0.38, metalness: 0.75 });
  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };

  const palm = mk(new RoundedBoxGeometry(0.98, 0.27, 0.86, 4, 0.13), skin); palm.position.set(0, 0, -0.1); root.add(palm);
  const bodies: THREE.Mesh[] = [palm];
  const heel = mk(new THREE.SphereGeometry(0.5, 22, 16), skin); heel.scale.set(0.97, 0.52, 0.8); heel.position.set(0, -0.02, 0.38); root.add(heel); bodies.push(heel);
  // The arm is its own group, re-aimed every frame at the shoulder (see aim()). It is long on purpose:
  // its far end stays behind the camera / below the frame and is never seen.
  const WRIST_Z = 0.55;
  const arm = new THREE.Group(); arm.position.set(0, 0, WRIST_Z); root.add(arm);
  const wristBall = mk(new THREE.SphereGeometry(0.3, 16, 12), skin); arm.add(wristBall);
  const forearm = mk(new THREE.CylinderGeometry(0.42, 0.29, 9, 24), skin); forearm.rotation.x = Math.PI / 2; forearm.scale.set(1, 1, 0.8); forearm.position.set(0, 0, 4.5); arm.add(forearm);
  const sleeve = mk(new THREE.CylinderGeometry(0.66, 0.5, 7.3, 28), cloth); sleeve.rotation.x = Math.PI / 2; sleeve.scale.set(1, 1, 0.84); sleeve.position.set(0, 0, 5.35); arm.add(sleeve);
  const ring = mk(new THREE.TorusGeometry(0.51, 0.04, 10, 36), trim); ring.position.set(0, 0, 1.7); ring.scale.set(1, 0.84, 1); arm.add(ring);

  const tips: THREE.Object3D[] = [];
  const makeFinger = (x: number, lens: number[], r: number, parent: THREE.Object3D, z: number, y = 0) => {
    const joints: THREE.Group[] = [];
    let cur: THREE.Object3D = parent;
    lens.forEach((L, i) => {
      const g = new THREE.Group(); g.position.set(i === 0 ? x : 0, i === 0 ? y : 0, i === 0 ? z : -lens[i - 1]); g.rotation.order = 'YXZ'; cur.add(g); joints.push(g);
      const rr = r * (1 - i * 0.07);
      const seg = mk(new THREE.CapsuleGeometry(rr, Math.max(L - rr, 0.05), 6, 12), skin); seg.rotation.x = Math.PI / 2; seg.position.z = -L / 2; g.add(seg);
      if (i === lens.length - 1) {
        const n = mk(new THREE.SphereGeometry(rr * 0.78, 10, 8), nail); n.scale.set(1, 0.35, 1.25); n.position.set(0, rr * 0.78, -L + rr * 0.55); g.add(n);
        const tip = new THREE.Object3D(); tip.position.set(0, -rr * 0.15, -L + rr * 0.1); g.add(tip); tips.push(tip);
      }
      cur = g;
    });
    return joints;
  };
  const index = makeFinger(-0.33, [0.5, 0.32, 0.27], 0.105, root, -0.56);
  const middle = makeFinger(-0.11, [0.55, 0.35, 0.28], 0.108, root, -0.58);
  const ring2 = makeFinger(0.11, [0.5, 0.33, 0.26], 0.1, root, -0.56);
  const pinky = makeFinger(0.31, [0.4, 0.26, 0.2], 0.09, root, -0.5);
  const thumb = makeFinger(-0.5, [0.55, 0.4, 0.32], 0.115, root, 0.18, -0.04);
  const indexTip = tips[0], thumbTip = tips[4];

  const apply = (joints: THREE.Group[], a: number[], b: number[], t: number, yawA = 0, yawB = 0) => {
    joints.forEach((j, i) => { j.rotation.x = lerp(a[i], b[i], t); });
    joints[0].rotation.y = lerp(yawA, yawB, t);
  };
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), dir = new THREE.Vector3(), qw = new THREE.Quaternion(), qr = new THREE.Quaternion();
  const Z = new THREE.Vector3(0, 0, 1);
  const box = new THREE.Box3();
  return {
    aim(shoulder) {
      root.updateMatrixWorld(true);
      arm.getWorldPosition(va);
      dir.copy(shoulder).sub(va).normalize();
      qw.setFromUnitVectors(Z, dir);
      root.getWorldQuaternion(qr);
      arm.quaternion.copy(qr.invert()).multiply(qw);
    },
    root,
    update(curl, spread) {
      const t = THREE.MathUtils.clamp(curl, 0, 1);
      apply(index, OPEN.index, PINCH.index, t, 0.05 + spread * 0.08, 0.03);
      apply(middle, OPEN.middle, PINCH.middle, t, 0.01 + spread * 0.03, 0);
      apply(ring2, OPEN.ring, PINCH.ring, t, -0.03 - spread * 0.05, -0.04);
      apply(pinky, OPEN.pinky, PINCH.pinky, t, -0.1 - spread * 0.1, -0.1);
      // thumb: [yaw, mcp, ip, tip]; also rolls toward the index as it closes
      thumb[0].rotation.y = lerp(OPEN.thumb[0] + spread * 0.12, PINCH.thumb[0], t);
      thumb[0].rotation.x = lerp(OPEN.thumb[1], PINCH.thumb[1], t);
      thumb[1].rotation.x = lerp(OPEN.thumb[2], PINCH.thumb[2], t);
      thumb[2].rotation.x = lerp(OPEN.thumb[3], PINCH.thumb[3], t);
    },
    pinch(out) {
      indexTip.getWorldPosition(va); thumbTip.getWorldPosition(vb);
      return out.copy(va).add(vb).multiplyScalar(0.5);
    },
    lowest() {
      let y = Infinity;
      for (const t of tips) { t.getWorldPosition(va); y = Math.min(y, va.y - TIP_R * 0.8); }
      for (const b of bodies) { box.setFromObject(b); y = Math.min(y, box.min.y); }
      // the forearm: wrist and the cuff, minus their (flattened) radii
      arm.localToWorld(va.set(0, 0, 0)); y = Math.min(y, va.y - 0.3);
      arm.localToWorld(va.set(0, 0, 1.7)); y = Math.min(y, va.y - 0.45);
      return y;
    },
  };
}

export function buildStaticRig(object: THREE.Object3D): HandRig {
  const root = new THREE.Group(); root.rotation.order = 'YXZ'; root.add(object);
  object.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const v = new THREE.Vector3();
  return { root, update() {}, aim() {}, pinch: out => root.getWorldPosition(out), lowest: () => root.getWorldPosition(v).y - 0.12 };
}

