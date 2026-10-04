'use client';
import { ArrowRight, Check, Compass, Heart, Moon, Star } from 'lucide-react';
import { SPREADS } from '@/data/spreads';
import type { Profile, SpreadId, Topic } from '@/types/tarot';
export interface FormValues {profile:Profile; question:string; topic:Topic; spreadId:SpreadId; allowReversed:boolean}
const icons={star:Star,moon:Moon,heart:Heart,compass:Compass};
export function ProfileForm({value,onChange,onStart,locked,error,onReset}:{value:FormValues;onChange:(value:FormValues)=>void;onStart:()=>void;locked:boolean;error:string;onReset:()=>void}) {
  return <form className="intention-panel" onSubmit={e=>{e.preventDefault();onStart();}}>
    <div className="panel-heading"><span className="section-number">01</span><div><h2>Đặt ý nguyện</h2><p>Bắt đầu từ điều bạn đang quan tâm.</p></div></div>
    <fieldset disabled={locked}><div className="input-row"><label>Tên của bạn<input autoComplete="given-name" value={value.profile.name} maxLength={80} required placeholder="Bạn muốn được gọi là…" onChange={e=>onChange({...value,profile:{...value.profile,name:e.target.value}})}/></label><label>Ngày sinh<input type="date" autoComplete="bday" value={value.profile.birthDate} min="1900-01-01" max={new Date().toISOString().slice(0,10)} required onChange={e=>onChange({...value,profile:{...value.profile,birthDate:e.target.value}})}/></label></div>
    <label>Chủ đề<select value={value.topic} onChange={e=>onChange({...value,topic:e.target.value as Topic})}><option value="general">Khám phá tổng quan</option><option value="love">Tình yêu & các mối quan hệ</option><option value="career">Công việc & sự nghiệp</option><option value="finance">Tài chính & nguồn lực</option></select></label>
    <label className="question-label">Câu hỏi của bạn<textarea rows={3} required minLength={5} maxLength={1000} value={value.question} placeholder="Tôi đang cân nhắc đổi công việc trong 3 tháng tới. Tôi cần làm rõ điều gì trước khi quyết định?" onChange={e=>onChange({...value,question:e.target.value})}/><span className="input-help">Hãy nêu điều bạn muốn biết, hoàn cảnh và mốc thời gian nếu có. Thông điệp sẽ dựa trên câu hỏi này và các lá bạn mở.</span></label>
    <div className="field-label">Chọn cách trải bài</div><div className="spread-options">{SPREADS.map(spread=>{const Icon=icons[spread.icon];return <button type="button" key={spread.id} className={`spread-option ${value.spreadId===spread.id?'selected':''}`} aria-pressed={value.spreadId===spread.id} onClick={()=>onChange({...value,spreadId:spread.id,topic:spread.id==='love'?'love':spread.id==='career'?'career':value.topic})}><span className="spread-icon"><Icon size={18} strokeWidth={1.5}/></span><span><strong>{spread.name}</strong><small>{spread.label} · {spread.positions.join(' / ')}</small></span>{value.spreadId===spread.id&&<Check size={16}/>}</button>;})}</div>
    <label className="checkbox-label"><input type="checkbox" checked={value.allowReversed} onChange={e=>onChange({...value,allowReversed:e.target.checked})}/><span>Bao gồm lá ngược <small>Upright / Reversed</small></span></label></fieldset>
    {error&&<p className="error-message" role="alert">{error}</p>}
    {locked?<button type="button" className="secondary-button w-full" onClick={onReset}>Bắt đầu một trải bài mới</button>:<button type="submit" className="primary-button w-full">Xáo bài & bắt đầu<ArrowRight size={17}/></button>}
    <p className="privacy-note">Hồ sơ và lịch sử được lưu trên trình duyệt này. Khi chọn phân tích AI, thông tin cùng câu hỏi sẽ được gửi tới dịch vụ AI.</p>
  </form>;
}
