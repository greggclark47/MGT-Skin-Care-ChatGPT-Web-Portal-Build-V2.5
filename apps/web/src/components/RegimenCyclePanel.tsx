'use client';

import React,{useEffect,useState} from 'react';
import {useHub} from '../lib/hub';

type Focus='steady_routine'|'introduce_one_change'|'review_progress';
type CheckIn='comfortable'|'no_change'|'needs_review';
type Summary={cycle:{id:string;focus:Focus;starts_at:string;ends_at:string};check_ins:number;days_remaining:number;rotation_state:'in_progress'|'ready_for_review';deterministic_guidance:{next_step:string;note:string};ai_boundary:{note:string}};
type CycleData={current:Summary|null;items:Summary[];sync_scope:string;retention:string};

async function request<T>(path:string,csrf:string,body?:unknown,method: 'GET'|'POST'|'DELETE'=body===undefined?'GET':'POST'):Promise<T>{
 const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:body===undefined?undefined:{'content-type':'application/json','x-csrf-token':csrf},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error?.message||'Your regimen cycle is temporarily unavailable.');return data as T;
}

const focusLabels:Record<Focus,string>={steady_routine:'Keep my routine steady',introduce_one_change:'Introduce one change',review_progress:'Review my progress'};
const checkInLabels:Record<CheckIn,string>={comfortable:'Comfortable',no_change:'No change',needs_review:'Needs review'};

export function RegimenCyclePanel(){
 const session=useHub('/session');const [data,setData]=useState<CycleData|null>(null),[csrf,setCsrf]=useState(''),[focus,setFocus]=useState<Focus>('steady_routine'),[checkIn,setCheckIn]=useState<CheckIn>('comfortable'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const signedIn=!!session.data?.account;
 async function refresh(){if(!signedIn)return;const current=await request<{data:CycleData}>('/api/v1/regimen-cycles','');setData(current.data);}
 useEffect(()=>{if(!session.data)return;setCsrf(session.data.csrf||'');void refresh().catch(error=>setMessage((error as Error).message));},[session.data]);
 async function start(){setBusy(true);setMessage('');try{await request('/api/v1/regimen-cycles',csrf,{consent:'regimen_cycle_tracking',focus,consent_version:'regimen-cycle-1'});await refresh();setMessage('Your two-week cycle is ready. Your routine stays unchanged until you choose a reviewed update.');}catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}
 async function saveCheckIn(){if(!data?.current)return;setBusy(true);setMessage('');try{await request(`/api/v1/regimen-cycles/${encodeURIComponent(data.current.cycle.id)}/check-ins`,csrf,{status:checkIn,completed_at:new Date().toISOString()});await refresh();setMessage('Your check-in is saved. It does not change your routine automatically.');}catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}
 async function exportCycles(){setBusy(true);setMessage('');try{const response=await fetch('/api/v1/regimen-cycles/export',{credentials:'same-origin',cache:'no-store'});if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error?.error?.message||'Your export is temporarily unavailable.');}const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='mgt-skin-care-regimen-cycles.json';link.click();URL.revokeObjectURL(url);setMessage('Your portable cycle record was downloaded.');}catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}
 async function removeCycles(){if(!window.confirm('Remove all of your regimen cycles and check-ins? This cannot be undone.'))return;setBusy(true);setMessage('');try{await request('/api/v1/regimen-cycles',csrf,{confirm:true},'DELETE');await refresh();setMessage('Your regimen cycles and check-ins were removed.');}catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}
 return <section className="panel regimen-cycle" id="regimen-cycle" aria-labelledby="regimen-cycle-heading" aria-busy={busy}>
  <div className="section-heading"><div><span className="eyebrow">CONNECTED TWO-WEEK CYCLE</span><h2 id="regimen-cycle-heading">Make room to notice what works.</h2></div><span className="pill">Optional · account-synced</span></div>
  <p>A cycle keeps one routine focus visible for 14 days across your signed-in portal and Android account link. Check-ins are personal adherence notes, not health measurements or treatment results.</p>
  {!signedIn?<p className="notice">Sign in from My Account to keep a private regimen cycle in sync across your devices.</p>:data?.current?<div className="regimen-cycle-current"><div><span className="eyebrow">CURRENT CYCLE</span><h3>{focusLabels[data.current.cycle.focus]}</h3><p>{data.current.days_remaining} day{data.current.days_remaining===1?'':'s'} remaining · {data.current.check_ins} check-in{data.current.check_ins===1?'':'s'}</p></div><span className={`pill ${data.current.rotation_state==='ready_for_review'?'warning':''}`}>{data.current.rotation_state==='ready_for_review'?'Review ready':'In progress'}</span></div>:<div className="regimen-cycle-start"><label className="field">What should this cycle support?<select value={focus} onChange={event=>setFocus(event.target.value as Focus)} disabled={busy}>{Object.entries(focusLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><button className="button primary" type="button" disabled={busy||!csrf} onClick={()=>void start()}>{busy?'Starting…':'Start my two-week cycle'}</button></div>}
  {data?.current&&<><p className="regimen-cycle-guidance"><strong>Next step:</strong> {data.current.deterministic_guidance.note}</p><div className="regimen-cycle-checkin"><label className="field">This routine felt<select value={checkIn} onChange={event=>setCheckIn(event.target.value as CheckIn)} disabled={busy}>{Object.entries(checkInLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><button className="button" type="button" disabled={busy||!csrf} onClick={()=>void saveCheckIn()}>{busy?'Saving…':'Save check-in'}</button></div><p className="muted">{data.current.ai_boundary.note}</p></>}
  {signedIn&&<div className="actions"><button className="button" type="button" disabled={busy} onClick={()=>void exportCycles()}>Download my cycle record</button><button className="button" type="button" disabled={busy||!csrf} onClick={()=>void removeCycles()}>Remove my cycle data</button></div>}
  {message&&<p className="notice" role="status">{message}</p>}
 </section>;
}
