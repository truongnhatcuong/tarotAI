'use client';
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ZoomIn } from 'lucide-react';
import { getCard } from '@/data/tarot';
import type { DrawnCard } from '@/types/tarot';
import { CardBack } from './card-back';
export function TarotCardView({drawn,revealed,onReveal,onZoom,index}:{drawn:DrawnCard;revealed:boolean;onReveal:()=>void;onZoom:()=>void;index:number}) {
  const ref=useRef<HTMLDivElement>(null);
  const flipRef=useRef<HTMLDivElement>(null);
  const [flipComplete,setFlipComplete]=useState(false);
  const [imageReady,setImageReady]=useState(false);
  const [imageError,setImageError]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const card=getCard(drawn.cardId);
  useEffect(()=>{
    let active=true;
    const preload=new Image();
    preload.onload=()=>{if(active){setImageReady(true);setImageError(false);}};
    preload.onerror=()=>{if(active){setImageReady(false);setImageError(true);}};
    preload.src=card.image;
    return ()=>{active=false;preload.onload=null;preload.onerror=null;};
  },[card.image,attempt]);
  useEffect(()=>{
    const context=gsap.context(()=>{
      if(!revealed){gsap.set(flipRef.current,{rotationY:0});setFlipComplete(false);return;}
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      gsap.to(flipRef.current,{rotationY:180,duration:reduced?0:0.8,ease:'power3.inOut',onComplete:()=>setFlipComplete(true)});
    },ref);
    return ()=>context.revert();
  },[revealed]);
  useEffect(()=>{
    const context=gsap.context(()=>{
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      gsap.fromTo('.card-entry',{y:reduced?0:55,opacity:0,rotationZ:reduced?0:-7},{y:0,opacity:1,rotationZ:0,duration:reduced?0:0.65,ease:'power3.out'});
    },ref);
    return ()=>context.revert();
  },[]);
  return <div ref={ref} className="drawn-card"><span className="position-label"><span>0{index+1}</span>{drawn.position}</span>
    <div className="card-entry"><button type="button" className={`flip-button ${flipComplete?'is-revealed':''}`} disabled={revealed&&!flipComplete} onClick={revealed?onZoom:onReveal} aria-label={revealed?`Phóng to ${card.nameVi}, ${drawn.orientation==='upright'?'xuôi':'ngược'}`:`Lật lá ${index+1}: ${drawn.position}`}>
      <div className="flip-inner" ref={flipRef}><div className="card-side card-side-back"><CardBack/></div><div className="card-side card-side-front">
        {flipComplete&&imageReady&&<img src={card.image} alt={card.name} className={drawn.orientation==='reversed'?'reversed':''} width={420} height={700} onError={()=>{setImageReady(false);setImageError(true);}}/>}
        {flipComplete&&!imageReady&&<span className="artwork-status" role="status">{imageError?'Không tải được ảnh Rider–Waite. Bạn vẫn có thể xem ý nghĩa của lá.':'Đang tải artwork Rider–Waite…'}</span>}
      </div></div>
      {flipComplete&&imageReady&&<span className="zoom-hint"><ZoomIn size={16}/></span>}
    </button></div>
    <div className="card-caption">{revealed?<><h3>{card.nameVi}</h3><span>{card.name} · {drawn.orientation==='upright'?'Xuôi ↑':'Ngược ↓'}</span></>:<><h3>Thông điệp đang chờ</h3><span>Chạm để lật lá bài</span></>}</div>
    {flipComplete&&imageError&&<button type="button" className="text-button retry-artwork" onClick={()=>{setImageError(false);setAttempt(previous=>previous+1);}} aria-label={`Thử tải lại ảnh ${card.nameVi}`}>Thử tải lại ảnh</button>}
  </div>;
}
