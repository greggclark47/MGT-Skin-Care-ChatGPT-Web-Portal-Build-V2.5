'use client';

import React from 'react';
import Link from 'next/link';
import { useHub } from '../lib/hub';
import { AppFrame, LoadState } from './HubFrames';

export function RetailPartnerProgram() {
  const state = useHub('/retail/commerce');
  const status = state.data?.commerce?.omni_retail;
  return <AppFrame title="Grow with Team 47 Studio">
    <section className="panel">
      <span className="eyebrow">OMNI-RETAIL PARTNER PROGRAM</span>
      <h2>Feature products with clear customer choice.</h2>
      <p className="lead">Team 47 Studio can introduce a merchant’s approved catalog to shoppers across the web portal and Android handoff, while the merchant remains the seller of record for checkout, payment, fulfillment, returns, and customer service.</p>
      <p className="notice">This program is not live until the merchant authorization, placement disclosure, catalog scope, reporting terms, privacy review, and support handoff are complete. Team 47 Studio does not process the merchant’s customer payment data.</p>
    </section>
    <LoadState {...state} retry={state.reload}/>
    <section className="columns" aria-label="Retail partner capabilities">
      <article className="panel"><span className="eyebrow">01 · EXTERNAL PURCHASE</span><h2>Direct merchant checkout</h2><p>Every buy path opens the merchant’s verified external storefront. The retailer remains responsible for stock, price, tax, shipping, returns, support, and the purchase itself.</p></article>
      <article className="panel"><span className="eyebrow">02 · PLACEMENT DISCLOSURE</span><h2>Clear feature labels</h2><p>Independent listings keep their order. A merchant can be marked Preferred partner or Sponsored placement only after recorded authorization, and that relationship is shown before a shopper leaves Team 47 Studio.</p></article>
      <article className="panel"><span className="eyebrow">03 · AGGREGATE LEARNING</span><h2>Routine-aware volume</h2><p>Approved merchants can provide bounded aggregate reports by routine category. Reports never include a shopper identity, cart, receipt, payment data, or retailer-site behavior, and never change a routine automatically.</p></article>
      <article className="panel"><span className="eyebrow">04 · OMNI-CHANNEL</span><h2>One referral boundary</h2><p>The same reviewed destination and disclosure rules apply to web and Android. The Android app opens the secure portal or merchant destination; it does not collect a native purchase history.</p></article>
    </section>
    <section className="panel" aria-labelledby="partner-steps">
      <span className="eyebrow">MERCHANT ONBOARDING</span><h2 id="partner-steps">Five steps before placement</h2>
      <ol>
        <li>Confirm product, brand, logo, and approved image usage in writing.</li>
        <li>Provide the verified store domain and agreed catalog or feed scope.</li>
        <li>Select Independent, Preferred partner, or Sponsored placement; Team 47 Studio will display the corresponding disclosure.</li>
        <li>Agree on aggregate reporting fields, cadence, privacy limits, and correction or removal process.</li>
        <li>Complete Team 47 Studio review, test the external link, and approve the customer-support handoff before publication.</li>
      </ol>
      <div className="actions"><Link className="button primary" href="/support?type=product_retailer#portal-request">Start a merchant conversation</Link><Link className="button" href="/shop">View current retailer directory</Link></div>
    </section>
    <section className="panel" aria-labelledby="partner-status">
      <span className="eyebrow">CURRENT CONNECTION</span><h2 id="partner-status">{status?.enabled ? 'Review-gated partner controls are available.' : 'Partner controls are awaiting approval.'}</h2>
      <p>{status?.message || 'The portal is checking the partner-commerce configuration.'}</p>
      {status?.activation_requirements && <ul>{status.activation_requirements.map((item: string) => <li key={item}>{item}</li>)}</ul>}
      <p className="muted">Current directory links remain independent unless the listing itself shows a preferred-partner or sponsored label.</p>
    </section>
  </AppFrame>;
}
