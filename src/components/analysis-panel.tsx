'use client';
import { Sparkles, BookOpen, RotateCcw, LoaderCircle } from 'lucide-react';
import type { Reading } from '@/types/tarot';
import { getCard } from '@/data/tarot';
export function AnalysisPanel({reading,loading,error,onAnalyze,onReference,onCancel}:{reading:Reading;loading:boolean;error:string;onAnalyze:()=>void;onReference:()=>void;onCancel:()=>void}) {
  const analysis=reading.analysis;
  return <section className="analysis-panel" aria-busy={loading} aria-label="Diễn giải trải bài"><div className="analysis-heading"><div className="panel-heading"><span className="section-number">03</span><div><h2>Lắng nghe thông điệp</h2><p>{analysis?(reading.source==='ai'?'Diễn giải AI dựa trên các lá đã rút.':'Tra cứu từ dữ liệu chuẩn · Không phải kết quả AI.'):'Kết nối các biểu tượng với câu hỏi của bạn.'}</p></div></div>{analysis&&<span className="source-badge"><Sparkles size={13}/>{reading.source==='ai'?'AI':'Tra cứu'}</span>}</div>
    {loading?<div className="analysis-loading" role="status"><div className="loading-orbit"><Sparkles size={27}/></div><h3>Đang kết nối các thông điệp…</h3><p>AI đang đọc ý nghĩa, chiều và vị trí của từng lá.</p><button className="text-button" onClick={onCancel} type="button">Dừng phân tích</button></div>:<>
      {error&&<p className="error-message" role="alert">{error}</p>}
      {analysis?<div className="analysis-content"><div className="overview"><span className="eyebrow">TỔNG QUAN</span><p>{analysis.overview}</p></div>
        <h3>Ý nghĩa từng lá</h3><div className="interpretations">{analysis.cards.map((entry,i)=><article key={entry.cardId}><span className="interpretation-number">0{i+1}</span><div><h4>{getCard(entry.cardId).nameVi}<span>{entry.position} · {entry.orientation==='upright'?'Xuôi':'Ngược'}</span></h4><p>{entry.interpretation}</p></div></article>)}</div>
        <div className="analysis-block"><h3>Liên kết giữa các lá</h3><p>{analysis.connections}</p></div>
        {(['love','career','finance'] as const).map((topic,i)=>analysis[topic]&&<div className="analysis-block" key={topic}><h3>{['Tình yêu','Công việc','Tài chính'][i]}</h3><p>{analysis[topic]}</p></div>)}
        <div className="advice"><Sparkles size={20}/><div><h3>Lời khuyên dành cho bạn</h3><p>{analysis.advice}</p></div></div>
      </div>:<p className="analysis-intro">Bạn đã chọn các lá của mình. AI sẽ đọc đúng trải bài này, tìm điểm kết nối và đưa ra những gợi ý để bạn tự cân nhắc.</p>}
      <div className="analysis-actions"><button className="primary-button" type="button" onClick={onAnalyze}>{analysis?<RotateCcw size={16}/>:<Sparkles size={16}/>} {analysis?'Phân tích AI lại':'Phân tích bằng AI'}</button>{reading.source!=='reference'&&<button type="button" className="secondary-button" onClick={onReference}><BookOpen size={16}/>Đọc ý nghĩa chuẩn</button>}</div>
    </>}
    <p className="reading-disclaimer"><LoaderCircle size={13}/>Tarot là công cụ suy ngẫm, không bảo đảm tương lai và không có tỷ lệ dự đoán đúng đáng tin cậy.</p>
  </section>;
}
