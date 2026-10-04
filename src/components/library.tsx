'use client';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { TAROT_CARDS } from '@/data/tarot';
import { CardDetail } from './card-detail';
import { RiderWaiteArtwork } from './rider-waite-artwork';
const normalize=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
export function Library() {
  const [query,setQuery]=useState('');const [filter,setFilter]=useState('all');const [selected,setSelected]=useState<string|null>(null);
  const cards=TAROT_CARDS.filter(card=>(filter==='all'||filter===card.arcana||filter===card.suit)&&normalize(`${card.name} ${card.nameVi} ${card.keywords.join(' ')}`).includes(normalize(query)));
  return <section className="library-section"><div className="page-heading"><span className="eyebrow">THƯ VIỆN BIỂU TƯỢNG</span><h1>78 lá, những góc nhìn mới.</h1><p>Khám phá nghĩa xuôi, nghĩa ngược và thông điệp của từng lá.</p></div>
    <div className="library-tools"><label className="search-field"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm tên hoặc từ khóa…" aria-label="Tìm lá bài"/></label><div className="filter-tabs">{[['all','Tất cả'],['major','Ẩn chính'],['wands','Gậy'],['cups','Cốc'],['swords','Kiếm'],['pentacles','Tiền']].map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}</button>)}</div></div>
    <p className="result-count">{cards.length} lá bài</p><div className="library-grid">{cards.map(card=><button type="button" key={card.id} className="library-card" onClick={()=>setSelected(card.id)} aria-label={`${card.nameVi} ${card.name}`}><RiderWaiteArtwork cardId={card.id} loading="lazy"/><strong>{card.nameVi}</strong><span>{card.name}</span></button>)}</div>{!cards.length&&<div className="empty-state"><Search size={30}/><h2>Chưa tìm thấy lá bài</h2><p>Thử tên hoặc từ khóa khác.</p></div>}
    {selected&&<CardDetail id={selected} onClose={()=>setSelected(null)}/>}
  </section>;
}
