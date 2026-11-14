'use client';

import React, { useState } from 'react';
import { hub, useHub } from '../lib/hub';

type Placement = 'free_plan_membership' | 'free_plan_shop';

export function FreePlanSponsor({ placement = 'free_plan_membership' }: { placement?: Placement }) {
  const state = useHub('/sponsored-content?placement=' + placement);
  const [notice, setNotice] = useState('');
  const campaign = state.data?.placement;

  async function openMerchant() {
    if (!campaign) return;
    try {
      await hub('/sponsored-content/outbound', { campaign_id: campaign.id });
      setNotice('Opening the merchant’s external store. Team 47 Studio does not receive your cart, purchase, payment, or merchant-site activity.');
    } catch {
      setNotice('The external merchant link is not available right now. No customer information was shared.');
    }
  }

  if (state.loading || state.error || !state.data?.plan_eligible || !state.data?.sponsored_content?.enabled || !campaign) return <section className="notice" aria-label="Free plan sustainability"><strong>Free-plan sustainability</strong><p>Optional sponsored placements are off until merchant authorization, disclosure, and privacy review are complete. Your profile, photos, skin information, payment data, and individual activity are never used for sponsor selection.</p></section>;

  return <aside className="panel" aria-labelledby="free-plan-sponsor-heading">
    <div className="row"><span className="pill">Sponsored</span><span className="muted">Free-plan support</span></div>
    <h2 id="free-plan-sponsor-heading">{campaign.headline}</h2>
    <p>{campaign.body}</p>
    <a className="button" href={campaign.destination_url} target="_blank" rel="noreferrer" referrerPolicy="no-referrer" onClick={() => void openMerchant()}>{campaign.cta} ↗</a>
    <p className="muted">{campaign.disclosure}</p>
    <p className="muted">Selection uses approved campaign state and placement inventory only. It never uses your account profile, Skin Match, photos, health information, payment data, or individual activity.</p>
    {notice && <p className="notice" role="status">{notice}</p>}
  </aside>;
}
