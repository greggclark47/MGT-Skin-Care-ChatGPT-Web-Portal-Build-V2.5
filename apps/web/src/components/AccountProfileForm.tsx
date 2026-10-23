'use client';

import React,{useEffect,useMemo,useState} from 'react';
import {hub,useHub} from '../lib/hub';
import {LoadState,Timestamp} from './HubFrames';
import type {AccountProfileInput,AccountServiceInterest} from '@mgt/shared';

type FormState=AccountProfileInput;

const interests:{id:AccountServiceInterest;label:string;detail:string}[]=[
 {id:'skin_match',label:'Skin Match',detail:'Skin profile and product compatibility'},
 {id:'routine_care',label:'Routine care',detail:'AM/PM planning and check-ins'},
 {id:'anti_aging',label:'Anti-aging discovery',detail:'Education, progress and provider discovery'},
 {id:'beauty_style',label:'Beauty and style',detail:'Makeup, hair, color and clothing tools'},
 {id:'retailer_discovery',label:'Retail discovery',detail:'Saved retailers and external purchase handoffs'},
 {id:'premium_guidance',label:'Premium guidance',detail:'Membership-based guidance when available'},
];
const detectedTimezone=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}catch{return'UTC';}};
const emptyProfile=():FormState=>({preferred_name:'',locale:'en-US',timezone:detectedTimezone(),measurement_system:'us',service_interests:['skin_match','routine_care'],communication_preferences:{routine_reminders:false,service_announcements:false},accessibility:{reduced_motion:false,high_contrast:false},default_image_storage:'device'});

export function AccountProfileForm({testDriveEnabled}:{testDriveEnabled:boolean}){
 const state=useHub('/account/profile');
 const [form,setForm]=useState<FormState>(emptyProfile),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{if(state.data){const saved=state.data.profile as FormState|null;setForm(saved?{...saved}:emptyProfile());}},[state.data]);
 const valid=useMemo(()=>form.preferred_name.trim().length>0&&form.preferred_name.trim().length<=80&&form.timezone.trim().length>0&&form.service_interests.length>0,[form]);
 function toggleInterest(id:AccountServiceInterest){setForm(current=>({...current,service_interests:current.service_interests.includes(id)?current.service_interests.filter(item=>item!==id):[...current.service_interests,id]}));}
 async function save(event:React.FormEvent){
  event.preventDefault();if(busy||!valid)return;setBusy(true);setError('');setMessage('');
  try{const result=await hub('/account/profile',{...form,preferred_name:form.preferred_name.trim(),timezone:form.timezone.trim(),expected_revision:state.data?.revision??null});state.setData(result);setMessage('Your account profile is saved and ready for connected services.');}
  catch(failure){setError((failure as Error).message);}finally{setBusy(false);}
 }
 return <section className="panel account-settings-panel" id="profile-settings" aria-labelledby="account-profile-heading" aria-busy={busy||state.loading}>
  <span className="eyebrow">PROFILE &amp; PREFERENCES</span><h2 id="account-profile-heading">Your connected profile</h2>
  <p>These preferences help the portal and Android experience stay consistent. Medical history, billing addresses and card details are intentionally not collected here.</p>
  <LoadState {...state} retry={state.reload}/>
  {!state.loading&&!state.error&&<form className="account-profile-form" onSubmit={save} aria-describedby={error?'account-profile-error':undefined}>
   <div className="form-grid account-form-grid">
    <label className="field">Preferred name<input required maxLength={80} autoComplete="name" value={form.preferred_name} onChange={event=>setForm({...form,preferred_name:event.target.value})}/></label>
    <label className="field">Language and region<select value={form.locale} onChange={event=>setForm({...form,locale:event.target.value as FormState['locale']})}><option value="en-US">English (United States)</option><option value="es-US">Español (Estados Unidos)</option></select></label>
    <label className="field">Time zone<input required maxLength={64} list="mgt-timezones" value={form.timezone} onChange={event=>setForm({...form,timezone:event.target.value})}/><datalist id="mgt-timezones"><option value="America/New_York"/><option value="America/Chicago"/><option value="America/Denver"/><option value="America/Los_Angeles"/><option value="America/Puerto_Rico"/><option value="UTC"/></datalist></label>
    <label className="field">Measurements<select value={form.measurement_system} onChange={event=>setForm({...form,measurement_system:event.target.value as FormState['measurement_system']})}><option value="us">US customary</option><option value="metric">Metric</option></select></label>
   </div>
   <fieldset className="account-choice-group"><legend>Services you use</legend><p className="muted">Choose at least one. This controls organization and recommendations, not entitlement or payment.</p><div className="account-interest-grid">{interests.map(item=><label key={item.id} className="account-check-card"><input type="checkbox" checked={form.service_interests.includes(item.id)} onChange={()=>toggleInterest(item.id)}/><span><strong>{item.label}</strong><small>{item.detail}</small></span></label>)}</div></fieldset>
   <div className="columns account-preference-columns">
    <fieldset className="account-choice-group"><legend>Communication</legend><label className="account-check-row"><input type="checkbox" checked={form.communication_preferences.routine_reminders} onChange={event=>setForm({...form,communication_preferences:{...form.communication_preferences,routine_reminders:event.target.checked}})}/><span>Routine and replenishment reminders</span></label><label className="account-check-row"><input type="checkbox" checked={form.communication_preferences.service_announcements} onChange={event=>setForm({...form,communication_preferences:{...form.communication_preferences,service_announcements:event.target.checked}})}/><span>In-portal service announcements</span></label><small>Preferences are recorded now; delivery requires a configured channel and does not enroll you in marketing. Required security, billing and account notices are unaffected.</small></fieldset>
    <fieldset className="account-choice-group"><legend>Display accessibility</legend><label className="account-check-row"><input type="checkbox" checked={form.accessibility.reduced_motion} onChange={event=>setForm({...form,accessibility:{...form.accessibility,reduced_motion:event.target.checked}})}/><span>Reduce interface motion</span></label><label className="account-check-row"><input type="checkbox" checked={form.accessibility.high_contrast} onChange={event=>setForm({...form,accessibility:{...form.accessibility,high_contrast:event.target.checked}})}/><span>Prefer higher contrast</span></label><small>Saved for shared account experiences. Device and browser accessibility settings continue to take priority.</small></fieldset>
   </div>
   <label className="field account-storage-field">Default image storage<select value={form.default_image_storage} onChange={event=>setForm({...form,default_image_storage:event.target.value as FormState['default_image_storage']})}><option value="device">This device</option><option value="test-drive" disabled={!testDriveEnabled}>Google Drive private test folder{testDriveEnabled?'':' · unavailable'}</option></select><span className="muted">This preference never uploads an image by itself. You still choose every file and destination.</span></label>
   {state.data?.profile?.updated_at&&<p className="muted">Last saved <Timestamp value={state.data.profile.updated_at}/></p>}
   {message&&<p className="notice success" role="status">{message}</p>}{error&&<p id="account-profile-error" className="notice error" role="alert">{error}</p>}
   <button className="button primary" type="submit" disabled={busy||!valid}>{busy?'Saving profile…':'Save account profile'}</button>
  </form>}
 </section>;
}
