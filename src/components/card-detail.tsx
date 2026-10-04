'use client';
import { Dialog } from './dialog';
import { getCard } from '@/data/tarot';
import type { Orientation } from '@/types/tarot';
import { RiderWaiteArtwork } from './rider-waite-artwork';
export function CardDetail({id,orientation='upright',onClose}:{id:string;orientation?:Orientation;onClose:()=>void}) {
  const card=getCard(id);
  return <Dialog title={card.nameVi} onClose={onClose}><div className="card-detail-grid">
    <RiderWaiteArtwork cardId={id} orientation={orientation} className="detail-image" retryable/>
    <div className="card-details"><span className="eyebrow">{card.arcana==='major'?'Ẩn chính':'Ẩn phụ'} · {card.name}</span><div className="keyword-list">{card.keywords.map(k=><span key={k}>{k}</span>)}</div>
      <h3>Nghĩa xuôi · Upright</h3><p>{card.uprightMeaning}</p><h3>Nghĩa ngược · Reversed</h3><p>{card.reversedMeaning}</p>
      {(['love','career','finance'] as const).map((topic,i)=><div key={topic}><h3>{['Tình yêu','Công việc','Tài chính'][i]} · {orientation==='upright'?'Xuôi':'Ngược'}</h3><p>{card[topic][orientation]}</p></div>)}
    </div></div></Dialog>;
}
