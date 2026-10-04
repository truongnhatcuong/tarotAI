import { Moon, Sparkles } from 'lucide-react';
export function CardBack({className=''}:{className?:string}) {
  return <div className={`card-back ${className}`} aria-hidden="true"><div className="back-border"><span className="back-star top">✦</span><div className="back-orbit"><Moon size={32} strokeWidth={1}/><Sparkles className="orbit-star" size={15}/></div><span className="back-word">ARCANA</span><span className="back-star bottom">✦</span></div></div>;
}
