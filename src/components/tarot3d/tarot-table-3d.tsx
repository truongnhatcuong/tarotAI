'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Shuffle } from 'lucide-react';
import { getCard } from '@/data/tarot';
import type { DrawnCard, SpreadId } from '@/types/tarot';
import type { SceneControl, SceneState } from './scene';

const SceneCanvas = dynamic(() => import('./scene'), {
  ssr: false,
  loading: () => <div className="table3d-loading" role="status">Đang dựng bàn Tarot…</div>,
});

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

interface Props {
  deck: string[]; spreadId: SpreadId; positions: readonly string[]; allowReversed: boolean;
  onComplete: (draws: DrawnCard[]) => void; onZoom: (drawn: DrawnCard) => void; onShuffle: () => void;
}

export function TarotTable3D({ deck, spreadId, positions, allowReversed, onComplete, onZoom, onShuffle }: Props) {
  const [state, setState] = useState<SceneState>({ phase: 'intro', picked: 0 });
  const [narrow, setNarrow] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [dropped, setDropped] = useState(false);
  const [handModel, setHandModel] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const control = useRef<SceneControl | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const m1 = matchMedia('(prefers-reduced-motion: reduce)'), m2 = matchMedia('(pointer: coarse)');
    const measure = () => { const w = box.current?.clientWidth ?? window.innerWidth; setNarrow(w < 640 || w / Math.max(box.current?.clientHeight ?? 1, 1) < 0.9); setCoarse(m2.matches); setReduced(m1.matches); };
    measure();
    const ro = new ResizeObserver(measure); if (box.current) ro.observe(box.current);
    setMounted(true);
    // An authored hand model is optional: /public/models/hand.glb
    let alive = true;
    if (process.env.NEXT_PUBLIC_HAND_MODEL === '1') fetch('/models/hand.glb', { method: 'HEAD' }).then(r => { if (alive && r.ok && (r.headers.get('content-type') ?? '').includes('model')) setHandModel('/models/hand.glb'); }).catch(() => undefined);
    return () => { alive = false; ro.disconnect(); };
  }, []);

  const imageOf = useCallback((id: string) => getCard(id).image, []);
  const quality = coarse || narrow || dropped ? 'low' : 'high';
  const remainingLabel = useMemo(() => deck.map((_, i) => i), [deck]);
  const total = positions.length;
  const next = positions[state.picked];

  const status = (() => {
    switch (state.phase) {
      case 'intro': return 'Đang dựng bàn Tarot…';
      case 'shuffling': return 'Đang xáo bài…';
      case 'ready': return `Chọn lá thứ ${state.picked + 1}/${total}${next ? ` — ${next}` : ''}. ${coarse ? 'Chạm vào' : 'Rê tay và bấm vào'} một lá úp.`;
      case 'drawing': return `Bàn tay đang rút lá thứ ${state.picked}/${total}…`;
      case 'revealing': return `Đang lật lá thứ ${state.picked}/${total}…`;
      case 'done': return `Đã mở đủ ${total} lá. Chạm vào lá bài để xem chi tiết.`;
      case 'error': return state.message ?? 'Không thể hiển thị lá bài.';
    }
  })();

  return (
    <section className="table3d" data-testid="tarot-scene" data-phase={state.phase} data-picked={state.picked} aria-label="Bàn Tarot 3D">
      <div className="table3d-canvas" ref={box}>
        {mounted && (
          <SceneCanvas deck={deck} spreadId={spreadId} positions={positions} allowReversed={allowReversed} imageOf={imageOf}
            narrow={narrow} quality={quality} reducedMotion={reduced} handModel={handModel} controlRef={control}
            onState={setState} onComplete={onComplete} onZoom={onZoom} onQualityDrop={() => setDropped(true)} />
        )}
        <div className="table3d-hud" aria-hidden="true">
          {positions.map((p, i) => <span key={p} className={i < state.picked ? 'is-filled' : i === state.picked && state.phase === 'ready' ? 'is-next' : ''}>{i + 1}</span>)}
        </div>
      </div>
      <div className="table3d-bar">
        <p className={`table3d-status ${state.phase === 'error' ? 'is-error' : ''}`} role="status" aria-live="polite">{status}</p>
        {state.phase === 'ready' && state.picked === 0 && (
          <button type="button" className="text-button" onClick={onShuffle}><Shuffle size={14} />Xáo lại</button>
        )}
      </div>
      {/* Keyboard / screen-reader access to the same deck the hand draws from. */}
      <div className="sr-only" role="group" aria-label="Chọn lá bài úp">
        {remainingLabel.map(i => (
          <button key={i} type="button" aria-label={`Chọn lá úp số ${i + 1}`} disabled={state.phase !== 'ready'}
            onFocus={() => control.current?.focus(i)} onClick={() => control.current?.choose(i)} />
        ))}
      </div>
    </section>
  );
}
