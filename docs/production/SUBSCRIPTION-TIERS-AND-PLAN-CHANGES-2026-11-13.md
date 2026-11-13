# Team 47 Studio subscription tiers and plan changes

Date: 2026-11-13

## Implemented customer tiers

| Tier | Billing | Positioning | Key access |
| --- | --- | --- | --- |
| Free | No recurring charge | Practical starting point | Saved profile, core Skin Match, starter routine, reviewed education, and clearly labeled sponsor-supported experience |
| Guided | Monthly or annual prepaid | Ongoing personalized guidance | Full personalized routines, biweekly updates, progress and image-journal history, connected color and wardrobe guidance, enhanced exports, and enhanced support |
| Studio | Monthly or annual prepaid | Most complete experience | Everything in Guided plus the highest available AI depth, deeper cross-domain synthesis, advanced exports, trusted guest access, priority support, and early features |

The Account payment section now contains the three tier cards, monthly and annual price display, annual savings, the complete capability comparison, current subscription status, renewal date, pending plan-change status, and a single accessible plan-change workflow.

## Change timing and credit rules

| Customer request | Effective time | Billing behavior |
| --- | --- | --- |
| Start Guided or Studio | After secure checkout and signed provider confirmation | The selected monthly or annual price starts the subscription |
| Change the selected plan during a trial | At the unchanged trial end | No trial proration; the selected paid price begins when the trial ends |
| Move between monthly paid plans | End of the current paid billing period | A Stripe Subscription Schedule preserves current access and changes the price at renewal with no mid-cycle proration |
| Downgrade a paid tier or move from annual to monthly | End of the current paid billing period | Current paid access remains in place through renewal |
| Move to Free | End of the current paid billing period | The subscription is marked to cancel at period end; Free begins after paid access ends |
| Upgrade to an equal or higher annual prepaid plan | Immediately, after signed payment reconciliation | Stripe credits unused paid time, starts the new annual billing anchor, and invoices the remaining annual balance |

Every plan-change request requires an explicit customer confirmation in Account. Provider references and request state are stored; full card numbers and security codes are never stored by Team 47 Studio. Signed Stripe events remain authoritative for final access state.

## Production safety controls

- Direct price switching in the generic Stripe customer portal is disabled so it cannot bypass Team 47 Studio's timing and credit policy.
- The Stripe portal remains available for payment-method changes, invoice history, customer details, and period-end cancellation.
- Production and API runtime preflight now require all four paid Stripe prices before subscriptions can be enabled: Guided monthly, Guided annual, Studio monthly, and Studio annual.
- Each annual price must equal ten monthly payments, providing two months free compared with twelve monthly payments.
- Subscription ownership, current price, lifecycle state, and billing period are revalidated immediately before every change.
- Idempotency keys protect provider mutations from duplicate submission.
- Production subscriptions remain disabled until the live Stripe catalog, signed webhook, legal approval, and controlled payment rehearsal are complete.

## Required activation inputs

1. Create or confirm the live Guided and Studio products and their monthly and annual recurring prices in Stripe.
2. Store the four approved price IDs and live Stripe secret through Google Secret Manager/runtime configuration; do not place secrets in the repository.
3. Register the production signed subscription webhook and store its signing secret securely.
4. Confirm the approved subscription terms and set the explicit production approval control.
5. Run a controlled live or approved test-mode rehearsal covering checkout, renewal-time upgrade, renewal-time downgrade, immediate annual upgrade credit, failed payment, signed webhook reconciliation, cancellation, and move to Free.
6. Enable subscriptions only after the preflight and rehearsal evidence pass.

This release implements and validates the application workflow. It does not activate production charges or change live Stripe credentials.
