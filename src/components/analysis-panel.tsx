'use client';
import { Sparkles, BookOpen, RotateCcw, LoaderCircle } from 'lucide-react';
import type { Reading } from '@/types/tarot';
import { getCard } from '@/data/tarot';
import { ReadingSpeechPlayer } from './reading-speech-player';
export function AnalysisPanel({reading,loading,error,onAnalyze,onReference,onCancel}:{reading:Reading;loading:boolean;error:string;onAnalyze:()=>void;onReference:()=>void;onCancel:()=>void}) {
  const analysis=reading.analysis;
  return <section id="reading-analysis" className="analysis-panel" aria-busy={loading} aria-label="Diễn giải trải bài"><div className="analysis-heading"><div className="panel-heading"><span className="section-number">03</span><div><h2>Phân tích tổng {reading.cards.length} lá</h2><p>{analysis?(reading.source==='ai'?'Diễn giải AI dựa trên các lá đã rút.':'Tra cứu từ dữ liệu chuẩn · Không phải kết quả AI.'):'Kết nối các biểu tượng với câu hỏi của bạn.'}</p></div></div>{analysis&&<span className="source-badge"><Sparkles size={13}/>{reading.source==='ai'?'AI':'Tra cứu'}</span>}</div>
    {loading?<div className="analysis-loading" role="status"><div className="loading-orbit"><Sparkles size={27}/></div><h3>Đang kết nối các thông điệp…</h3><p>Đang tìm hiểu câu hỏi của bạn và liên hệ với ý nghĩa, chiều, vị trí của các lá đã mở.</p><button className="text-button" onClick={onCancel} type="button">Dừng phân tích</button></div>:<>
      {error&&<p className="error-message" role="alert">{error}</p>}
      {reading.source==='ai'&&analysis&&<ReadingSpeechPlayer key={reading.id} reading={reading}/>}
      {analysis?<div className="analysis-content"><div className="overview"><span className="eyebrow">{reading.source==='ai'?'LỜI GIẢI CHO CÂU HỎI CỦA BẠN':'TỔNG QUAN'}</span><p>{analysis.overview}</p></div>
        <h3>{reading.source==='ai'?'Phân tích từng lá':'Ý nghĩa từng lá'}</h3><div className="interpretations">{analysis.cards.map((entry,i)=><article key={entry.cardId}><span className="interpretation-number">0{i+1}</span><div><h4>{getCard(entry.cardId).nameVi}<span>{entry.position} · {entry.orientation==='upright'?'Xuôi':'Ngược'}</span></h4><p>{entry.interpretation}</p></div></article>)}</div>
        <div className="analysis-block"><h3>{reading.cards.length === 1 ? 'Liên hệ với câu hỏi' : 'Liên kết giữa các lá'}</h3><p>{analysis.connections}</p></div>
        {(['love','career','finance'] as const).map((topic,i)=>analysis[topic]&&<div className="analysis-block" key={topic}><h3>{['Tình yêu','Công việc','Tài chính'][i]}</h3><p>{analysis[topic]}</p></div>)}
        {reading.source==='ai'&&analysis.attention&&<div className="analysis-block"><h3>Điều bạn cần chú ý</h3><p>{analysis.attention}</p></div>}
        {reading.source==='ai'&&analysis.message&&<div className="analysis-block"><h3>Thông điệp dành cho bạn</h3><p>{analysis.message}</p></div>}
        <div className="advice"><Sparkles size={20}/><div><h3>Lời khuyên dành cho bạn</h3><p>{analysis.advice}</p></div></div>
      </div>:<p className="analysis-intro">Lời giải sẽ bám sát câu hỏi “{reading.question}”, phân tích từng lá bạn đã mở và kết nối thành thông điệp cùng gợi ý hành động dành cho bạn.</p>}
      <div className="analysis-actions">{(analysis||error)&&<button className="primary-button" type="button" onClick={onAnalyze}>{analysis?<RotateCcw size={16}/>:<Sparkles size={16}/>} {analysis?(reading.source==='ai'?'Diễn giải lại':'Diễn giải bằng AI'):'Thử phân tích lại'}</button>}{reading.source!=='reference'&&<button type="button" className="secondary-button" onClick={onReference}><BookOpen size={16}/>Đọc ý nghĩa chuẩn</button>}</div>
    </>}
    <p className="reading-disclaimer"><LoaderCircle size={13}/>Tarot là công cụ suy ngẫm, không bảo đảm tương lai và không có tỷ lệ dự đoán đúng đáng tin cậy.</p>
  </section>;
}
