'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, BookOpen, Check, Clock3, Moon, ShieldCheck, Sparkles, Sun } from 'lucide-react';
import { getSpread } from '@/data/spreads';
import { profileSchema, requestSchema } from '@/lib/validation';
import { drawFromDeck, shuffledDeck } from '@/services/draw';
import { loadHistory, loadProfile, saveProfile, saveHistory, forgetProfile } from '@/services/storage';
import { requestAnalysis, referenceAnalysis } from '@/services/reading-client';
import type { DrawnCard, Reading } from '@/types/tarot';
import { ProfileForm, type FormValues } from './profile-form';
import { CardBack } from './card-back';
import { Deck } from './deck';
import { TarotCardView } from './tarot-card';
import { CardDetail } from './card-detail';
import { AnalysisPanel } from './analysis-panel';
import { Library } from './library';
import { History } from './history';
import { Dialog } from './dialog';
import { RiderWaiteArtwork } from './rider-waite-artwork';
import { TarotTable3D, hasWebGL } from './tarot3d/tarot-table-3d';
import { ReadingCards } from './reading-cards';
import { DonationPanel } from './donation-panel';

type Tab='reading'|'library'|'history';
const initialForm:FormValues={profile:{name:'',birthDate:''},question:'',topic:'general',spreadId:'three',allowReversed:true};
export function TarotExperience() {
  const [tab,setTab]=useState<Tab>('reading');const [form,setForm]=useState(initialForm);
  const [deck,setDeck]=useState<string[]|null>(null);const [draws,setDraws]=useState<DrawnCard[]>([]);const [revealed,setRevealed]=useState<string[]>([]);
  const [flipped,setFlipped]=useState<string[]>([]);
  const [reading,setReading]=useState<Reading|null>(null);const [history,setHistory]=useState<Reading[]>([]);
  const [formError,setFormError]=useState('');const [aiError,setAiError]=useState('');const [storageError,setStorageError]=useState('');
  const [loading,setLoading]=useState(false);const [zoom,setZoom]=useState<DrawnCard|null>(null);
  const [confirm,setConfirm]=useState<'reset'|'clear'|'privacy'|null>(null);const [help,setHelp]=useState(false);const [webgl,setWebgl]=useState(false);
  const controller=useRef<AbortController|null>(null);const historyRef=useRef<Reading[]>([]);const readingRef=useRef<Reading|null>(null);
  useEffect(()=>{
    setWebgl(hasWebGL());const profile=loadProfile();if(profile)setForm(v=>({...v,profile}));
    const saved=loadHistory();setHistory(saved);historyRef.current=saved;
    return ()=>controller.current?.abort();
  },[]);
  const spread=getSpread(form.spreadId);
  const complete=reading!==null;
  const allRevealed=complete&&revealed.length===reading.cards.length&&flipped.length===reading.cards.length;
  useEffect(()=>{
    if(!allRevealed||!window.matchMedia('(max-width: 680px)').matches)return;
    const frame=requestAnimationFrame(()=>document.getElementById('reading-cards')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}));
    return ()=>cancelAnimationFrame(frame);
  },[allRevealed,reading?.id]);
  function persist(next:Reading) {
    const updated=[next,...historyRef.current.filter(item=>item.id!==next.id)].slice(0,30);
    setHistory(updated);historyRef.current=updated;
    try {saveHistory(updated);} catch {setStorageError('Trình duyệt không cho phép lưu hoặc bộ nhớ đã đầy. Trải bài hiện tại vẫn có thể xem trong phiên này.');}
  }
  function updateReading(next:Reading) {readingRef.current=next;setReading(next);persist(next);}
  function start() {
    const profile=profileSchema.safeParse(form.profile);
    if(!profile.success){setFormError(profile.error.issues[0].message);return;}
    if(form.question.trim().length<5){setFormError('Hãy viết câu hỏi ít nhất 5 ký tự.');return;}
    setFormError('');setAiError('');setDraws([]);setRevealed([]);setFlipped([]);setReading(null);readingRef.current=null;
    setForm(v=>({...v,profile:profile.data,question:v.question.trim()}));
    try{saveProfile(profile.data);}catch{setStorageError('Hồ sơ chưa được lưu vì trình duyệt không cho phép lưu trữ.');}
    setDeck(shuffledDeck());
    setTimeout(()=>document.getElementById('reading-table')?.scrollIntoView({behavior:'smooth',block:'center'}),80);
  }
  function pick(index:number) {
    if(!deck||draws.length>=spread.positions.length||draws.some(c=>c.cardId===deck[index]))return;
    const drawn=drawFromDeck(deck,index,form.spreadId,draws.length,form.allowReversed);
    const next=[...draws,drawn];setDraws(next);
    if(next.length===spread.positions.length){
      const request=requestSchema.parse({profile:form.profile,question:form.question,topic:form.topic,spreadId:form.spreadId,cards:next});
      updateReading({...request,id:crypto.randomUUID(),createdAt:new Date().toISOString(),analysis:null,source:null});
    }
  }
  // The 3D table draws, flips and locks the cards itself; analysis is offered only after it reports completion.
  function finish3D(next:DrawnCard[]) {
    const request=requestSchema.parse({profile:form.profile,question:form.question,topic:form.topic,spreadId:form.spreadId,cards:next});
    setDraws(next);setRevealed(next.map(c=>c.cardId));setFlipped(next.map(c=>c.cardId));
    updateReading({...request,id:crypto.randomUUID(),createdAt:new Date().toISOString(),analysis:null,source:null});
  }
  function reset() {
    controller.current?.abort();setLoading(false);setDeck(null);setDraws([]);setRevealed([]);setFlipped([]);setReading(null);readingRef.current=null;setAiError('');setFormError('');setConfirm(null);
  }
  async function analyze() {
    const target=readingRef.current;if(!target||loading||controller.current)return;
    const abort=new AbortController();controller.current=abort;setLoading(true);setAiError('');
    try {
      const analysis=await requestAnalysis(target,abort.signal);
      if(!abort.signal.aborted&&readingRef.current?.id===target.id)updateReading({...target,analysis,source:'ai'});
    }catch(error){if(!abort.signal.aborted)setAiError(error instanceof Error?error.message:'Không kết nối được AI. Vui lòng thử lại.');}
    finally{if(controller.current===abort){controller.current=null;setLoading(false);}}
  }
  function viewMessage() {
    const target=readingRef.current;if(!target)return;
    setZoom(null);
    requestAnimationFrame(()=>document.getElementById('reading-analysis')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}));
    if(target.source!=='ai'||!target.analysis)void analyze();
  }
  function openHistory(item:Reading) {
    controller.current?.abort();setLoading(false);setAiError('');setForm({...initialForm,profile:item.profile,question:item.question,spreadId:item.spreadId,topic:item.topic});
    setDeck(null);setDraws(item.cards);setReading(item);readingRef.current=item;setRevealed(item.cards.map(c=>c.cardId));setFlipped(item.cards.map(c=>c.cardId));setTab('reading');
    setTimeout(()=>document.getElementById('reading-cards')?.scrollIntoView({behavior:'smooth'}),80);
  }
  function removeHistory(id:string) {
    const next=historyRef.current.filter(item=>item.id!==id);historyRef.current=next;setHistory(next);
    try{saveHistory(next);}catch{setStorageError('Chưa thể cập nhật lịch sử đã lưu.');}
  }
  function confirmAction() {
    if(confirm==='reset'){reset();return;}
    if(confirm==='clear'){
      try{saveHistory([]);historyRef.current=[];setHistory([]);}catch{setStorageError('Không thể xóa lịch sử khỏi trình duyệt.');}
    }
    if(confirm==='privacy'){
      try{forgetProfile();saveHistory([]);historyRef.current=[];setHistory([]);reset();setForm(initialForm);setStorageError('');}catch{setStorageError('Không thể xóa dữ liệu khỏi trình duyệt.');}
    }
    setConfirm(null);
  }
  return <div className="site-shell"><a className="skip-link" href="#main-content">Đến nội dung chính</a><div className="ambient-glow" aria-hidden="true"/>
    <header className="site-header"><button type="button" className="brand" onClick={()=>setTab('reading')} aria-label="Arcana, trang trải bài"><span className="brand-mark"><Sun size={27} strokeWidth={1.2}/></span><span>arcana<small>TAROT & SELF-DISCOVERY</small></span></button><nav aria-label="Điều hướng chính">{([{id:'reading',label:'Trải bài',Icon:Sparkles},{id:'library',label:'78 lá Tarot',Icon:BookOpen},{id:'history',label:'Nhật ký',Icon:Clock3}] as const).map(({id,label,Icon})=><button type="button" key={id} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}><Icon size={15}/>{label}{id==='history'&&history.length>0&&<span className="nav-count">{history.length}</span>}</button>)}</nav><div className="header-actions"><button type="button" className="header-help" onClick={()=>setHelp(true)}>Một chút về Tarot<ArrowUpRight size={14}/></button><DonationPanel/></div></header>
    <main id="main-content" className="main-container">
    {tab==='reading'?<><section className="hero"><div className="hero-copy"><span className="eyebrow"><span className="tiny-star">✦</span>MỘT KHOẢNG LẶNG DÀNH CHO BẠN</span><h1>Lắng nghe điều<br/><em>vũ trụ gợi mở.</em></h1><p>Mỗi lá bài là một góc nhìn. Mỗi câu hỏi là một khởi đầu.<br className="desktop-break"/>Khám phá những thông điệp để hiểu mình hơn.</p><a href="#experience" className="hero-link">Bắt đầu hành trình<ArrowDown size={15}/></a><div className="hero-meta"><span><Sparkles size={14}/>78 lá bài chuẩn</span><span><Moon size={14}/>Không gian của riêng bạn</span></div></div>
      <div className="hero-art" aria-hidden="true"><div className="celestial-orbit orbit-one"/><div className="celestial-orbit orbit-two"/><span className="art-sparkle sparkle-one">✧</span><span className="art-sparkle sparkle-two">✦</span><span className="art-caption">AS ABOVE, SO BELOW</span><div className="hero-card hero-card-left"><RiderWaiteArtwork cardId="the-moon"/></div><div className="hero-card hero-card-right"><RiderWaiteArtwork cardId="the-sun"/></div><div className="hero-card hero-card-center"><RiderWaiteArtwork cardId="the-star"/></div><div className="art-bottom-star">✧</div></div>
    </section><section id="experience" className="experience-section"><div className="experience-heading"><div><span className="eyebrow">YOUR MOMENT OF CLARITY</span><h2>Một câu hỏi. Một góc nhìn mới.</h2></div><div className="progress-steps" aria-label="Tiến trình"><span className={!deck&&!reading?'active':'done'}><i>{deck||reading?<Check size={12}/>:'1'}</i>Đặt ý nguyện</span><b/><span className={deck&&!allRevealed?'active':allRevealed?'done':''}><i>{allRevealed?<Check size={12}/>:'2'}</i>Rút bài</span><b/><span className={allRevealed?'active':''}><i>3</i>Diễn giải</span></div></div>
      {storageError&&<p className="asset-notice" role="status">{storageError}</p>}
      <div className="experience-grid"><ProfileForm value={form} onChange={setForm} onStart={start} locked={!!deck||!!reading} error={formError} onReset={()=>setConfirm('reset')}/>
        <div className="reading-column"><section id="reading-table" className="reading-table"><div className="table-heading"><div><span className="eyebrow">{deck||reading?'TRẢI BÀI CỦA BẠN':'LẮNG LẠI MỘT CHÚT'}</span><h2>{deck||reading?spread.name:'Những thông điệp đang chờ bạn'}</h2></div><span className="table-symbol">✧</span></div>
        {!deck&&!reading?<div className="table-welcome"><div className="welcome-orbit"><div className="welcome-card welcome-card-one"><CardBack/></div><div className="welcome-card welcome-card-two"><CardBack/></div><div className="welcome-card welcome-card-three"><CardBack/></div></div><h3>Hít thở sâu. Nghĩ về câu hỏi của bạn.</h3><p>Đặt ý nguyện ở bên trái, rồi tự tay chọn những lá bài<br className="desktop-break"/>thu hút bạn từ bộ 78 lá đã xáo.</p><span className="welcome-pill"><ShieldCheck size={14}/>Bạn luôn là người quyết định hành trình của mình</span></div>:<>
          {webgl&&deck?<><TarotTable3D deck={deck} spreadId={form.spreadId} positions={spread.positions} allowReversed={form.allowReversed} onComplete={finish3D} onZoom={setZoom} onShuffle={()=>setDeck(shuffledDeck())}/>
          </>:!allRevealed?<>
          <p className="table-instruction" role="status" aria-live="polite">{allRevealed?'Chạm vào lá bài để phóng to và khám phá ý nghĩa.':complete?'Chạm từng lá hoặc lật tất cả để mở thông điệp.':`Chọn ${spread.positions.length-draws.length} lá từ bộ bài úp bên dưới.`}</p>
          <div className={`drawn-cards ${spread.positions.length===1?'single-card':''}`}>{spread.positions.map((position,index)=>draws[index]?<TarotCardView key={draws[index].cardId} drawn={draws[index]} index={index} revealed={revealed.includes(draws[index].cardId)} onReveal={()=>setRevealed(previous=>[...new Set([...previous,draws[index].cardId])])} onZoom={()=>setZoom(draws[index])} onRevealComplete={()=>setFlipped(previous=>[...new Set([...previous,draws[index].cardId])])}/>:<div className="empty-card-slot" key={position}><span className="position-label"><span>0{index+1}</span>{position}</span><div className="slot-outline"><Sparkles size={22} strokeWidth={1}/><span>Chọn lá {index+1}</span></div></div>)}</div>
          {complete&&!allRevealed&&<button type="button" className="secondary-button reveal-all" onClick={()=>setRevealed(draws.map(d=>d.cardId))}><Sparkles size={16}/>Lật tất cả các lá</button>}
          {deck&&!complete&&<Deck deck={deck} used={draws.map(d=>d.cardId)} needed={spread.positions.length-draws.length} onPick={pick} onShuffle={()=>setDeck(shuffledDeck())}/>}</>:null}
          {reading&&allRevealed&&<ReadingCards reading={reading} loading={loading} onZoom={setZoom} onMessage={viewMessage}/>}
          {reading&&<div className="reading-question"><span>CÂU HỎI CỦA {reading.profile.name.toUpperCase()}</span><p>“{reading.question}”</p></div>}
        </>}
        <div className="table-footer"><span><span className="status-dot"/>Rút ngẫu nhiên · Không trùng lá</span><span>{form.allowReversed?'Xuôi & Ngược':'Chỉ lá xuôi'}</span></div>
        </section>{reading&&allRevealed&&<AnalysisPanel reading={reading} loading={loading} error={aiError} onAnalyze={()=>void analyze()} onCancel={()=>{controller.current?.abort();controller.current=null;setLoading(false);}} onReference={()=>{if(readingRef.current)updateReading({...readingRef.current,analysis:referenceAnalysis(readingRef.current),source:'reference'});setAiError('');}}/>}
        </div></div>
      <div className="experience-notes"><span>✧ Không có câu trả lời duy nhất. Chỉ có những góc nhìn để khám phá.</span><p>Tarot hỗ trợ suy ngẫm, không bảo đảm dự đoán tương lai hoặc thay thế quyết định của bạn.</p></div>
    </section></>:tab==='library'?<Library/>:<History history={history} onOpen={openHistory} onDelete={removeHistory} onClear={()=>setConfirm('clear')} onNew={()=>{reset();setTab('reading');}}/>}
    </main><footer className="site-footer"><span className="footer-brand">✦ arcana</span><p>Một chút tĩnh lặng. Một chút thấu hiểu.</p><button type="button" className="text-button" onClick={()=>setConfirm('privacy')}>Xóa dữ liệu của tôi</button></footer>
    {zoom&&<CardDetail id={zoom.cardId} orientation={zoom.orientation} onClose={()=>setZoom(null)} onViewMessage={allRevealed&&reading?.cards.some(card=>card.cardId===zoom.cardId)?viewMessage:undefined} interpretation={reading?.source==='ai'?reading.analysis?.cards.find(card=>card.cardId===zoom.cardId)?.interpretation:undefined}/>}
    {confirm&&<Dialog title={confirm==='reset'?'Bắt đầu trải bài mới?':confirm==='clear'?'Xóa toàn bộ nhật ký?':'Xóa dữ liệu trên trình duyệt?'} onClose={()=>setConfirm(null)}><p className="dialog-description">{confirm==='reset'?'Trải bài đã rút đủ lá được giữ trong nhật ký. Các lá đang chọn dở sẽ được bỏ để bắt đầu lại.':confirm==='clear'?'Toàn bộ lịch sử đã lưu sẽ được xóa khỏi trình duyệt này.':'Tên, ngày sinh và lịch sử trải bài sẽ được xóa khỏi trình duyệt này.'}</p><div className="dialog-actions"><button type="button" className="secondary-button" onClick={()=>setConfirm(null)}>Quay lại</button><button type="button" className="primary-button" onClick={confirmAction}>{confirm==='reset'?'Bắt đầu mới':'Xóa dữ liệu'}</button></div></Dialog>}
    {help&&<Dialog title="Tarot, một lời gợi mở" onClose={()=>setHelp(false)}><div className="help-content"><p>Tarot sử dụng 78 biểu tượng: 22 lá Ẩn chính và 56 lá Ẩn phụ thuộc bốn bộ Gậy, Cốc, Kiếm, Tiền. Mỗi lá có ý nghĩa xuôi và ngược; lá ngược không mặc định là điều xấu.</p><h3>Cách trải bài</h3><p>Nhập tên, ngày sinh và một câu hỏi mở. Chọn kiểu trải bài, xáo bộ 78 lá, tự chọn các lá úp rồi chạm để lật. Chọn “Khám phá thông điệp” để đọc diễn giải từng lá và thông điệp tổng của trải bài, hoặc đọc ý nghĩa chuẩn để tham khảo.</p><h3>Giữ quyền tự quyết</h3><p>Tarot không có xác suất dự đoán đúng có thể kiểm chứng một cách đáng tin cậy. Website không tạo tỷ lệ chính xác giả. Kết quả là góc nhìn để suy ngẫm, không phải lời bảo đảm.</p><h3>Dữ liệu của bạn</h3><p>Hồ sơ và tối đa 30 trải bài được lưu trên thiết bị này. Khi chọn phân tích AI, hồ sơ, câu hỏi và trải bài được gửi qua server tới dịch vụ AI. Ngày sinh không được dùng để suy diễn định mệnh. Bạn có thể xóa dữ liệu qua nút ở cuối trang.</p></div></Dialog>}
  </div>;
}
