'use client';

import React,{useMemo,useState} from 'react';
import Link from 'next/link';
import {hub,useHub} from '../lib/hub';
import {LoadState,Timestamp} from './HubFrames';

type PlanId='free'|'premium'|'studio';
type Cycle='monthly'|'annual';
type Price={amount:number;currency:string;interval:string};
type PaidPlan={id:'premium'|'studio';name:string;summary:string;features:string[];comparison:Record<string,string>;pricing_options:{monthly:Price|null;annual:Price|null;annual_savings:null|{amount:number;currency:string;percent:number;months_free:number|null}}};
type Baseline={id:'free';name:string;summary:string;features:string[];comparison:Record<string,string>};

const statusLabels:Record<string,string>={trialing:'Trial active',active:'Active',past_due:'Payment overdue',unpaid:'Payment required',canceled:'Ended',incomplete:'Payment incomplete',incomplete_expired:'Signup expired',paused:'Paused'};
const planNames:Record<PlanId,string>={free:'Free',premium:'Guided',studio:'Studio'};
const planRank:Record<PlanId,number>={free:0,premium:1,studio:2};
const formatPrice=(price:Price|null)=>price?new Intl.NumberFormat(undefined,{style:'currency',currency:price.currency}).format(price.amount/100)+(price.interval==='year'?' / year':' / month'):'Pricing pending';
const formatMoney=(amount:number,currency:string)=>new Intl.NumberFormat(undefined,{style:'currency',currency}).format(amount/100);

export function AccountBillingPanel({configured}:{configured:boolean}){
 const state=useHub('/billing?plan=premium&cycle=monthly');
 const catalog=useHub('/billing/plans?cycle=monthly');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[targetPlan,setTargetPlan]=useState<PlanId>('premium'),[targetCycle,setTargetCycle]=useState<Cycle>('monthly'),[confirmed,setConfirmed]=useState(false);
 const subscription=state.data?.subscription,pending=state.data?.pending_change;
 const baseline=catalog.data?.baseline as Baseline|undefined;
 const paidPlans=(catalog.data?.plans||[]) as PaidPlan[];
 const currentPlan=(subscription?.plan_id||'free') as PlanId;
 const unchanged=!!subscription&&targetPlan===currentPlan&&targetCycle===subscription.cycle&&!subscription.cancel_at_period_end;
 const immediateAnnual=!!subscription&&targetPlan!=='free'&&targetCycle==='annual'&&planRank[targetPlan]>=planRank[currentPlan]&&(subscription.cycle!=='annual'||planRank[targetPlan]>planRank[currentPlan]);
 const effectiveCopy=targetPlan==='free'?'Free access begins after the current paid period. You keep paid access until then.':subscription?.status==='trialing'?'The selection is saved during the trial; paid billing starts when the unchanged trial ends.':immediateAnnual?'This annual prepaid upgrade can begin now. Secure billing applies unused paid time as credit and invoices the remaining annual balance.':'This change begins after the current paid billing period. No mid-cycle plan change is applied.';
 const startHref='/membership?plan='+(targetPlan==='free'?'premium':targetPlan)+'&cycle='+targetCycle;
 const rows=useMemo(()=>catalog.data?.comparison_rows||[],[catalog.data]);

 async function manage(){
  if(busy)return;setBusy(true);setError('');setNotice('');
  try{const result=await hub('/billing/portal',{plan:currentPlan==='studio'?'studio':'premium',audience:'consumer'});const destination=new URL(result.url);if(destination.protocol!=='https:')throw new Error('Billing returned an invalid destination.');window.location.assign(destination.href);}
  catch(failure){setError((failure as Error).message);setBusy(false);}
 }
 async function changePlan(){
  if(busy||!subscription)return;setBusy(true);setError('');setNotice('');
  try{const result=await hub('/billing/change-plan',{plan:targetPlan,cycle:targetPlan==='free'?undefined:targetCycle,audience:'consumer',confirm_change:confirmed});setNotice(result.message||'Your membership change was submitted for confirmation.');setConfirmed(false);state.reload();}
  catch(failure){setError((failure as Error).message);}
  finally{setBusy(false);}
 }
 function choosePlan(plan:PlanId){setTargetPlan(plan);setConfirmed(false);setNotice('');setError('');}

 return <section className="panel account-settings-panel" id="payment-settings" aria-labelledby="account-billing-heading" aria-busy={busy||state.loading||catalog.loading}>
  <span className="eyebrow">PAYMENT &amp; MEMBERSHIP</span><h2 id="account-billing-heading">Your plan, comparison, and billing</h2>
  <p>Compare all three Team 47 Studio tiers and request a plan change without leaving Account. Team 47 Studio stores confirmed provider references and status—not full card numbers or security codes.</p>
  <LoadState {...state} retry={state.reload}/><LoadState {...catalog} retry={catalog.reload}/>
  {!state.loading&&!state.error&&state.data&&<div className="account-billing-summary">
   <div><span>Current plan</span><strong>{planNames[currentPlan]}</strong><small>{subscription?statusLabels[subscription.status]||subscription.status:'No recurring Team 47 Studio charge'}</small></div>
   <div><span>Billing cycle</span><strong>{subscription?.cycle==='annual'?'Annual':subscription?.cycle==='monthly'?'Monthly':'None'}</strong><small>{configured?'Secure hosted payment service':'Production enrollment is not yet open'}</small></div>
   <div><span>Renewal</span><strong>{subscription?.cancel_at_period_end?'Off':subscription?.active?'On':'Not applicable'}</strong><small>{subscription?.current_period_end?<Timestamp value={new Date(subscription.current_period_end*1000).toISOString()}/>:'No confirmed renewal date'}</small></div>
  </div>}

  {catalog.data&&baseline&&<>
   <div className="account-plan-cards" aria-label="Membership tiers">
    <article className={currentPlan==='free'?'current-plan':''}><span className="pill">No recurring charge</span><h3>{baseline.name}</h3><strong>$0</strong><p>{baseline.summary}</p><ul>{baseline.features.map(feature=><li key={feature}>{feature}</li>)}</ul>{currentPlan==='free'&&<small>Current plan</small>}</article>
    {paidPlans.map(plan=><article key={plan.id} className={currentPlan===plan.id?'current-plan':''}><span className="pill">{plan.id==='studio'?'Most complete':'Best ongoing value'}</span><h3>{plan.name}</h3><strong>{formatPrice(plan.pricing_options.monthly)}</strong><small>{formatPrice(plan.pricing_options.annual)}{plan.pricing_options.annual_savings?' · save '+formatMoney(plan.pricing_options.annual_savings.amount,plan.pricing_options.annual_savings.currency):''}</small><p>{plan.summary}</p><ul>{plan.features.map(feature=><li key={feature}>{feature}</li>)}</ul>{currentPlan===plan.id&&<small>Current plan</small>}</article>)}
   </div>
   <div className="table-wrap account-plan-comparison" role="region" aria-labelledby="account-plan-comparison-heading" tabIndex={0}><table><caption id="account-plan-comparison-heading">Full Free, Guided, and Studio comparison</caption><thead><tr><th scope="col">Capability</th><th scope="col">Free</th>{paidPlans.map(plan=><th scope="col" key={plan.id}>{plan.name}</th>)}</tr></thead><tbody>{rows.map((row:{id:string;label:string})=><tr key={row.id}><th scope="row">{row.label}</th><td>{baseline.comparison[row.id]}</td>{paidPlans.map(plan=><td key={plan.id}>{plan.comparison[row.id]}</td>)}</tr>)}</tbody></table></div>
  </>}

  {pending&&<p className="notice success" role="status"><strong>Plan change pending.</strong> {planNames[pending.target_plan_id as PlanId]}{pending.target_cycle?' · '+pending.target_cycle:''} is {pending.mode==='immediate_annual_upgrade'?'awaiting signed payment confirmation':'scheduled'} for <Timestamp value={new Date(pending.effective_at*1000).toISOString()}/>.</p>}
  {subscription&&['past_due','unpaid','incomplete'].includes(subscription.status)&&<p className="notice error">Payment attention is needed. Open secure billing to review the payment method or invoice.</p>}
  {!configured&&<p className="notice">Production billing remains closed until approved pricing, terms, provider keys and signed event processing are configured.</p>}
  {error&&<p className="notice error" role="alert">{error}</p>}{notice&&<p className="notice success" role="status">{notice}</p>}

  {subscription&&['active','trialing'].includes(subscription.status)?<fieldset className="account-plan-change" disabled={busy||!configured}><legend>Request a plan change</legend>
   <div className="account-plan-choice" role="group" aria-label="Target plan">{(['free','premium','studio'] as PlanId[]).map(plan=><button className={targetPlan===plan?'button primary':'button'} type="button" aria-pressed={targetPlan===plan} key={plan} onClick={()=>choosePlan(plan)}>{planNames[plan]}</button>)}</div>
   {targetPlan!=='free'&&<div className="account-plan-choice" role="group" aria-label="Target billing cycle">{(['monthly','annual'] as Cycle[]).map(cycle=><button className={targetCycle===cycle?'button primary':'button'} type="button" aria-pressed={targetCycle===cycle} key={cycle} onClick={()=>{setTargetCycle(cycle);setConfirmed(false);setNotice('');setError('');}}>{cycle==='annual'?'Annual prepaid · 2 months free':'Monthly'}</button>)}</div>}
   <p className="notice"><strong>{immediateAnnual?'Immediate annual upgrade':'Effective at renewal'}.</strong> {effectiveCopy}</p>
   <label className="account-check-row"><input type="checkbox" checked={confirmed} disabled={unchanged||busy||!configured} onChange={event=>setConfirmed(event.target.checked)}/><span>I confirm this plan choice and understand when billing and access change.</span></label>
   <div className="actions"><button className="button primary" type="button" disabled={!confirmed||unchanged||busy||!configured} onClick={()=>void changePlan()}>{busy?'Submitting change…':unchanged?'Current plan selected':targetPlan==='free'?'Move to Free at renewal':immediateAnnual?'Upgrade to annual now':'Schedule change for renewal'}</button><Link className="text-link" href="/terms">Subscription terms →</Link></div>
  </fieldset>:<div className="actions"><Link className="button primary" href={startHref}>Choose a paid plan</Link><Link className="text-link" href="/membership">Review plans and trial details →</Link></div>}

  <div className="actions">{state.data?.can_manage&&configured&&<button className="button" type="button" disabled={busy} onClick={()=>void manage()}>{busy?'Opening secure billing…':'Payment method, invoices, or cancel'}</button>}{subscription&&<Link className="text-link" href="/subscription">Cancel or resume subscription →</Link>}<Link className="text-link" href="/orders">Retailer purchase help →</Link></div>
 </section>;
}
