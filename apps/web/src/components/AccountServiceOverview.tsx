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
   <div className="account-overview-summary" aria-label="Service readiness summary"><span><strong>{overview.summary.ready}</strong> ready</span><span><strong>{overview.summary.setup}</strong> to set up</span><span><strong>{overview.summary.attention}</strong> attention</span><span><strong>{overview.summary.unavailable}</strong> unavailable</span></div>
   <div className="account-overview-grid">{overview.services.map(service=><Link href={service.href} key={service.id} className={`account-service-card state-${service.state}`}><span className="account-service-state"><i aria-hidden="true"/>{stateLabels[service.state]}</span><strong>{service.label}</strong><small>{service.detail}</small>{service.count!==undefined&&<span className="account-service-count" aria-label={`${service.count} saved item${service.count===1?'':'s'}`}>{service.count}</span>}</Link>)}</div>
   <p className="muted account-overview-privacy">{overview.privacy_note} Updated <Timestamp value={overview.generated_at}/>.</p>
  </>}
 </section>;
}
