'use client';
import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { buildHand, buildStaticRig, type HandRig } from './hand-rig';

export type { HandRig };

export function ProceduralHand({ onRig }: { onRig: (rig: HandRig) => void }) {
  const rig = useMemo(buildHand, []);
  useEffect(() => { onRig(rig); }, [rig, onRig]);
  return <primitive object={rig.root} />;
}

export function ModelHand({ url, onRig }: { url: string; onRig: (rig: HandRig) => void }) {
  const gltf = useGLTF(url);
  const rig = useMemo(() => buildStaticRig(gltf.scene.clone(true)), [gltf]);
  useEffect(() => { onRig(rig); }, [rig, onRig]);
  return <primitive object={rig.root} />;
}
