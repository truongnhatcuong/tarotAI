'use client';
import { Clock3, ArrowUpRight, Trash2, BookOpen } from 'lucide-react';
import { getSpread } from '@/data/spreads';
import type { Reading } from '@/types/tarot';
import { RiderWaiteArtwork } from './rider-waite-artwork';
export function History({history,onOpen,onDelete,onClear,onNew}:{history:Reading[];onOpen:(reading:Reading)=>void;onDelete:(id:string)=>void;onClear:()=>void;onNew:()=>void}) {
  return <section className="history-section"><div className="page-heading"><span className="eyebrow">NHẬT KÝ CỦA BẠN</span><h1>Nhìn lại những thông điệp.</h1><p>Lưu tối đa 30 trải bài gần nhất trên trình duyệt này.</p></div>
    {!!history.length&&<div className="history-toolbar"><span>{history.length} trải bài đã lưu</span><button type="button" className="text-button" onClick={onClear}><Trash2 size={15}/>Xóa tất cả</button></div>}
    <div className="history-list">{history.map(reading=><article key={reading.id} className="history-item"><div className="history-mini-cards">{reading.cards.map(card=><RiderWaiteArtwork key={card.cardId} cardId={card.cardId} orientation={card.orientation} loading="lazy"/>)}</div><div className="history-info"><span><Clock3 size={13}/>{new Date(reading.createdAt).toLocaleString('vi-VN',{dateStyle:'medium',timeStyle:'short'})} · {getSpread(reading.spreadId).name}</span><h2>{reading.question}</h2><p>{reading.profile.name} · {reading.source==='ai'?'Đã phân tích AI':reading.source==='reference'?'Bản tra cứu':'Chưa diễn giải'}</p></div><div className="history-item-actions"><button type="button" className="secondary-button" onClick={()=>onOpen(reading)}>Xem lại<ArrowUpRight size={15}/></button><button className="icon-button" type="button" aria-label={`Xóa trải bài: ${reading.question}`} onClick={()=>onDelete(reading.id)}><Trash2 size={16}/></button></div></article>)}</div>
    {!history.length&&<div className="empty-state"><BookOpen size={38} strokeWidth={1}/><h2>Một trang nhật ký mới</h2><p>Trải bài của bạn sẽ xuất hiện tại đây sau khi rút đủ các lá.</p><button type="button" className="primary-button" onClick={onNew}>Tạo trải bài đầu tiên<ArrowUpRight size={16}/></button></div>}
  </section>;
}
