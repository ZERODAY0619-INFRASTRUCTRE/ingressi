"use client";
import {useEffect,useRef,useState} from 'react';
import {bindStatusPage,statusMarkup,type StatusDetails} from '@/src/lib/status-pages';
function diagnosticId(){const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,v=>v.toString(16).padStart(2,'0')).join('');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');}
export function StatusPage({code,details={},digest,reset,maintenance=false}: {code:string;title?:string;message?:string;action?:boolean;reset?:()=>void;details?:StatusDetails;digest?:string;maintenance?:boolean}) {
  const ref=useRef<HTMLDivElement>(null);
  const [client,setClient]=useState<StatusDetails>({});
  useEffect(()=>{if(!details.requestId)setClient({requestId:diagnosticId(),timestamp:new Date().toISOString(),host:location.host,path:location.pathname,timeLabel:'Page display time (UTC)',idLabel:'Page diagnostic ID'});},[details.requestId]);
  const markup=statusMarkup(code,{...client,...details,digest},maintenance);
  useEffect(()=>bindStatusPage(ref.current?.querySelector('.status-page')??null,reset),[markup,reset]);
  return <div ref={ref} dangerouslySetInnerHTML={{__html:markup}}/>;
}
