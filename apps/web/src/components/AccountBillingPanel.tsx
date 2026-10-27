'use client';

import React,{useState} from 'react';
import Link from 'next/link';
import {hub,useHub} from '../lib/hub';
import {LoadState,Timestamp} from './HubFrames';

const statusLabels:Record<string,string>={trialing:'Trial active',active:'Active',past_due:'Payment overdue',unpaid:'Payment required',canceled:'Ended',incomplete:'Payment incomplete',incomplete_expired:'Signup expired',paused:'Paused'};

export function AccountBillingPanel({configured}:{configured:boolean}){
 const state=useHub('/billing?plan=premium&cycle=monthly');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const subscription=state.data?.subscription;
 async function manage(){
  if(busy)return;setBusy(true);setError('');
  try{const result=await hub('/billing/portal',{plan:'premium',audience:'consumer'});const destination=new URL(result.url);if(destination.protocol!=='https:')throw new Error('Billing returned an invalid destination.');window.location.assign(destination.href);}
  catch(failure){setError((failure as Error).message);setBusy(false);}
 }
 return <section className="panel account-settings-panel" id="payment-settings" aria-labelledby="account-billing-heading" aria-busy={busy||state.loading}>
  <span className="eyebrow">PAYMENT &amp; MEMBERSHIP</span><h2 id="account-billing-heading">Payment setup and management</h2>
  <p>Premium subscription payments use the secure billing service. MGT stores provider references and confirmed status—not full card numbers or security codes. Product purchases remain with external retailers.</p>
  <LoadState {...state} retry={state.reload}/>
  {!state.loading&&!state.error&&state.data&&<div className="account-billing-summary">
   <div><span>Current access</span><strong>{subscription?statusLabels[subscription.status]||subscription.status:'Free'}</strong><small>{subscription?.cycle==='annual'?'Annual Premium':subscription?.cycle==='monthly'?'Monthly Premium':'No recurring MGT charge'}</small></div>
   <div><span>Payment service</span><strong>{configured?'Configured':'Setup pending'}</strong><small>{configured?'Secure checkout and billing portal':'No payment can be started in this environment'}</small></div>
   <div><span>Renewal</span><strong>{subscription?.cancel_at_period_end?'Off':subscription?.active?'On':'Not applicable'}</strong><small>{subscription?.current_period_end?<><Timestamp value={new Date(subscription.current_period_end*1000).toISOString()}/></>:'No confirmed renewal date'}</small></div>
  </div>}
  {subscription&&['past_due','unpaid','incomplete'].includes(subscription.status)&&<p className="notice error">Payment attention is needed. Open secure billing to review the payment method or invoice.</p>}
  {!configured&&<p className="notice">Production billing remains closed until approved pricing, terms, provider keys and signed event processing are configured.</p>}
  {error&&<p className="notice error" role="alert">{error}</p>}
  <div className="actions"><Link className="button primary" href="/membership">{subscription?'Review plan and billing':'Review Premium setup'}</Link>{state.data?.can_manage&&configured&&<button className="button" type="button" disabled={busy} onClick={()=>void manage()}>{busy?'Opening secure billing…':'Manage payment methods & invoices'}</button>}<Link className="text-link" href="/orders">Retailer purchase help →</Link></div>
 </section>;
}
