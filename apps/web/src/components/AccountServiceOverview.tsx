'use client';

import React from 'react';
import Link from 'next/link';
import type {AccountServiceOverview as Overview,AccountServiceState} from '@mgt/shared';
import {useHub} from '../lib/hub';
import {LoadState,Timestamp} from './HubFrames';

const stateLabels:Record<AccountServiceState,string>={ready:'Ready',setup:'Set up',attention:'Attention',unavailable:'Unavailable'};

export function AccountServiceOverview(){
 const state=useHub('/account/overview');
 const overview=state.data as Overview|null;
 return <section className="panel account-overview" id="service-overview" aria-labelledby="service-overview-heading" aria-busy={state.loading}>
  <div className="row"><div><span className="eyebrow">CONNECTED SERVICES</span><h2 id="service-overview-heading">Your account at a glance</h2></div>{overview&&<span className="pill">{overview.summary.ready} of {overview.summary.total} ready</span>}</div>
  <p>See what is connected, what needs setup and where attention is needed across your MGT experience.</p>
  <LoadState {...state} retry={state.reload}/>
  {overview&&<>
   {overview.customer_context.profile_ready&&<p className="muted">This checklist is synced to {overview.customer_context.preferred_name||'your'} account profile and remains private to your signed-in account.</p>}
   <div className="account-focus-progress"><div><span>Your selected path</span><strong>{overview.focus.percent}% ready</strong><small>{overview.focus.ready} of {overview.focus.total} selected or attention-needed services are ready</small></div><div className="account-progress-track" aria-label={`${overview.focus.percent}% of selected account setup ready`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={overview.focus.percent}><i style={{width:`${overview.focus.percent}%`}}/></div></div>
   <section className="account-next-steps" aria-labelledby="account-next-steps-heading"><div className="row"><h3 id="account-next-steps-heading">Recommended next steps</h3><span className="pill">{overview.next_steps.length}</span></div>{overview.next_steps.length?<ol>{overview.next_steps.map(step=><li key={step.id}><Link href={step.href}><span className={`account-step-priority priority-${step.priority}`}>{step.priority==='attention'?'Needs attention':'Set up'}</span><strong>{step.label}</strong><small>{step.detail}</small></Link></li>)}</ol>:<p className="notice success">Your selected account path has no open setup steps.</p>}</section>
   <div className="account-overview-summary" aria-label="Service readiness summary"><span><strong>{overview.summary.ready}</strong> ready</span><span><strong>{overview.summary.setup}</strong> to set up</span><span><strong>{overview.summary.attention}</strong> attention</span><span><strong>{overview.summary.unavailable}</strong> unavailable</span></div>
   <div className="account-overview-grid">{overview.services.map(service=><Link href={service.href} key={service.id} className={`account-service-card state-${service.state}${service.selected?' service-selected':''}`}><span className="account-service-state"><i aria-hidden="true"/>{stateLabels[service.state]}{service.selected&&<b>Selected path</b>}</span><strong>{service.label}</strong><small>{service.detail}</small>{service.count!==undefined&&<span className="account-service-count" aria-label={`${service.count} saved item${service.count===1?'':'s'}`}>{service.count}</span>}</Link>)}</div>
   <p className="muted account-overview-privacy">{overview.privacy_note} Updated <Timestamp value={overview.generated_at}/>.</p>
  </>}
 </section>;
}
