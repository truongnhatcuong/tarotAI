'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Shuffle } from 'lucide-react';
import { getCard } from '@/data/tarot';
import type { DrawnCard, SpreadId } from '@/types/tarot';
import type { SceneControl, SceneState } from './scene';
import { CardBack } from '../card-back';
import styles from './touch-card-picker.module.css';

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
  const [smallScreen, setSmallScreen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [dropped, setDropped] = useState(false);
  const [handModel, setHandModel] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const control = useRef<SceneControl | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const scrollFrame = useRef<number | null>(null);
  const gesture = useRef<{x:number;y:number;moved:boolean}|null>(null);

  useEffect(() => {
    const m1 = matchMedia('(prefers-reduced-motion: reduce)'), m2 = matchMedia('(pointer: coarse)'), m3 = matchMedia('(max-width: 680px)');
    const measure = () => { const w = box.current?.clientWidth ?? window.innerWidth; setNarrow(w < 640 || w / Math.max(box.current?.clientHeight ?? 1, 1) < 0.9); setCoarse(m2.matches); setSmallScreen(m3.matches); setReduced(m1.matches); };
    measure();
    const ro = new ResizeObserver(measure); if (box.current) ro.observe(box.current);
    m1.addEventListener('change', measure); m2.addEventListener('change', measure); m3.addEventListener('change', measure);
    setMounted(true);
    // An authored hand model is optional: /public/models/hand.glb
    let alive = true;
    if (process.env.NEXT_PUBLIC_HAND_MODEL === '1') fetch('/models/hand.glb', { method: 'HEAD' }).then(r => { if (alive && r.ok && (r.headers.get('content-type') ?? '').includes('model')) setHandModel('/models/hand.glb'); }).catch(() => undefined);
    return () => { alive = false; ro.disconnect(); m1.removeEventListener('change', measure); m2.removeEventListener('change', measure); m3.removeEventListener('change', measure); if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current); };
  }, []);

  const imageOf = useCallback((id: string) => getCard(id).image, []);
  const quality = coarse || narrow || dropped ? 'low' : 'high';
  const remainingLabel = useMemo(() => deck.map((_, i) => i), [deck]);
  const total = positions.length;
  const next = positions[state.picked];
  const touchControls = coarse || smallScreen;
  const pickedIndices = state.pickedIndices ?? [];

  function focusCard(index: number) {
    if (state.phase !== 'ready' || pickedIndices.includes(index)) return;
    setActiveIndex(index);
    control.current?.focus(index);
  }

  function followScroll() {
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      const element = picker.current;
      if (!element || state.phase !== 'ready') return;
      const center = element.scrollLeft + element.clientWidth / 2;
      let closest = -1, distance = Infinity;
      for (const button of element.querySelectorAll<HTMLButtonElement>('button[data-deck-index]')) {
        if (button.disabled) continue;
        const delta = Math.abs(button.offsetLeft + button.offsetWidth / 2 - center);
        if (delta < distance) { distance = delta; closest = Number(button.dataset.deckIndex); }
      }
      if (closest >= 0) focusCard(closest);
    });
  }

  const status = (() => {
    switch (state.phase) {
      case 'intro': return 'Đang dựng bàn Tarot…';
      case 'shuffling': return 'Đang xáo bài…';
      case 'ready': return `Chọn lá thứ ${state.picked + 1}/${total}${next ? ` — ${next}` : ''}. ${touchControls ? 'Vuốt bộ bài bên dưới, rồi chạm lá bạn muốn rút.' : 'Rê tay và bấm vào một lá úp.'}`;
      case 'drawing': return `Bàn tay đang rút lá thứ ${state.picked}/${total}…`;
      case 'revealing': return `Đang lật lá thứ ${state.picked}/${total}…`;
      case 'done': return `Đã mở đủ ${total} lá. Chạm vào lá bài để xem chi tiết.`;
      case 'error': return state.message ?? 'Không thể hiển thị lá bài.';
    }
  })();

  return (
    <section className={`table3d ${touchControls ? 'table3d-touch' : ''}`} data-testid="tarot-scene" data-phase={state.phase} data-picked={state.picked} aria-label="Bàn Tarot 3D">
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
      {/* Touch and keyboard controls choose from the same locked deck as the scene. */}
      <div className={touchControls && state.phase !== 'done' ? styles.picker : 'sr-only'}>
      {touchControls && state.phase !== 'done' && <div className={styles.heading}><span>Vuốt để chọn · Chạm để rút</span><small>Còn {deck.length - state.picked} lá</small></div>}
      <div ref={picker} className={touchControls ? styles.cards : undefined} role="group" aria-label="Chọn lá bài úp" onScroll={followScroll}
        onPointerDown={event => { gesture.current = {x:event.clientX,y:event.clientY,moved:false}; }}
        onPointerMove={event => { const start = gesture.current; if (start && Math.hypot(event.clientX-start.x,event.clientY-start.y)>8) start.moved=true; }}>
        {remainingLabel.map(i => (
          <button key={i} type="button" data-deck-index={i} data-focused={activeIndex === i} className={touchControls ? `${styles.card} ${activeIndex === i ? styles.active : ''}` : undefined}
            aria-label={`Chọn lá úp số ${i + 1}`} disabled={state.phase !== 'ready' || pickedIndices.includes(i)}
            onFocus={() => focusCard(i)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') gesture.current = null; }}
            onClick={() => { const moved = gesture.current?.moved; gesture.current = null; if (moved) return; control.current?.choose(i); }}>
            {touchControls && <><CardBack/><span>{pickedIndices.includes(i) ? 'Đã rút' : `Lá úp ${i + 1}`}</span></>}
          </button>
        ))}
      </div>
      </div>
    </section>
  );
}
