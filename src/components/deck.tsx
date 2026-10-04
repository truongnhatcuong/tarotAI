'use client';
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';
import { CardBack } from './card-back';
export function Deck({deck,used,needed,onPick,onShuffle}:{deck:string[];used:string[];needed:number;onPick:(index:number)=>void;onShuffle:()=>void}) {
  const root=useRef<HTMLDivElement>(null);
  const scroller=useRef<HTMLDivElement>(null);
  const context=useRef<gsap.Context|null>(null);
  const lock=useRef(false);
  const [busy,setBusy]=useState(true);
  useEffect(()=>{
    lock.current=true;setBusy(true);
    context.current=gsap.context(()=>{
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const cards=gsap.utils.toArray<HTMLElement>('.deck-card');
      gsap.fromTo(cards,{x:i=>reduced?0:Math.sin(i*1.7)*65,y:i=>reduced?0:-(i%5)*9,rotationY:reduced?0:35,opacity:0.5},{x:0,y:0,rotationY:0,opacity:1,duration:reduced?0:0.7,stagger:reduced?0:0.008,ease:'power2.out',onComplete:()=>{lock.current=false;setBusy(false);}});
    },root);
    return ()=>{context.current?.revert();context.current=null;};
  },[deck]);
  function pick(index:number,element:HTMLButtonElement) {
    if(lock.current||used.includes(deck[index])||needed===0)return;
    lock.current=true;setBusy(true);
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    context.current?.add(()=>{
      gsap.to(element,{y:reduced?0:-70,z:reduced?0:100,rotationY:reduced?0:35,opacity:0,duration:reduced?0:0.4,ease:'power2.in',onComplete:()=>{onPick(index);lock.current=false;setBusy(false);}});
    });
  }
  return <div className="deck-section" ref={root}><div className="deck-toolbar"><span>{busy?'Đang xáo / rút bài…':`Còn ${78-used.length} lá · Chọn thêm ${needed} lá`}</span><button type="button" className="text-button" onClick={onShuffle} disabled={busy||used.length>0}><Shuffle size={14}/>Xáo lại</button></div>
    <div className="deck-scroll" ref={scroller}><div className="deck-fan">{deck.map((id,index)=><button key={`${index}-${id}`} type="button" className={`deck-card ${used.includes(id)?'is-used':''}`} style={{'--tilt':`${Math.sin(index/6)*5}deg`} as React.CSSProperties} aria-label={`Chọn lá úp số ${index+1}`} disabled={busy||used.includes(id)||needed===0} onClick={e=>pick(index,e.currentTarget)}><CardBack/></button>)}</div></div>
    <div className="deck-navigation"><button type="button" className="icon-button" aria-label="Xem các lá bên trái" onClick={()=>scroller.current?.scrollBy({left:-260,behavior:'smooth'})}><ChevronLeft size={17}/></button><span>Vuốt hoặc cuộn ngang để khám phá đủ 78 lá</span><button type="button" className="icon-button" aria-label="Xem các lá bên phải" onClick={()=>scroller.current?.scrollBy({left:260,behavior:'smooth'})}><ChevronRight size={17}/></button></div>
  </div>;
}
