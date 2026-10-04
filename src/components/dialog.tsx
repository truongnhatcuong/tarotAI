'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Dialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const element=ref.current!;
    const previous=document.activeElement as HTMLElement|null;
    element.showModal();
    const old=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return ()=>{element.close();document.body.style.overflow=old;previous?.focus();};
  },[]);
  return <dialog ref={ref} className="detail-dialog" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}} aria-labelledby="dialog-title">
    <div className="dialog-content"><div className="dialog-heading"><h2 id="dialog-title">{title}</h2><button type="button" className="icon-button" aria-label="Đóng" onClick={onClose}><X size={20}/></button></div>{children}</div>
  </dialog>;
}
