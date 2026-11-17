# Team 47 Studio — Web Portal & App Overlay Packet

**Version 1.8 · 2026-11-16 · Internal build handoff** · v1.1: O-2 decided · v1.2: utility row, route-driven active state, keyboard reach · v1.3: 71 screens, merged legal routes, Aura utility row, new commerce, scan, security and onboarding screens · v1.4: plans priced (Guided $14.99 / Studio $29.99, annual two months free), Studio checkout unblocked, Prism Weave behind the landing hero · v1.5: optional 14-day Guided trial door and separate renewal consent at checkout; demo reference is v4.2 · v1.6: Retail Partners merged into one section, W29 retired, A24 added, footer without Partners, Retail Partners as a footer support link between Privacy & Terms and Shipping & returns (no separate band), Retail Partners row on every app screen, logo +18%, icon system. v1.7: Starter retired (two plans), Studio quarterly option, renewal reminders with shared web and app switches, a gradient per header button; demo reference is v4.3. v1.8: intake W38, preview and trial W39, Your trial W40, app A25 and A26 (76 screens); the trial is the only way in; demo reference is v4.4. Backend detail is in `05-handoff/`.

> **Status: PRELIMINARY — pending full release.** Prepared for review ahead of any execution. Decisions, routes, wording and figures are subject to change before work begins; nothing here is final until the owner releases it.

Maps the D09 v4.4 demo (71 screens) onto an existing production build, screen by screen, with every mapped file verified to exist.

| | |
|---|---|
| **Target build** | `greggclark47/MGT-Skin-Care-ChatGPT-Web-Portal-Build-V2.5` @ `6b05956` (2026-09-18) — Next.js web, Expo mobile, Express API, live Stripe Checkout |
| **Source design** | D09 v4.4 demo — `demo/index-v4.4.html` (held privately) |
| **Classification** | The blueprint's own vocabulary: REUSE · REFACTOR · REPLACE · CREATE · DEFER |
| **Result** | 4 REUSE · 22 REFACTOR · 1 REPLACE · 33 CREATE · 11 DEFER (71 rows in `screen-map.csv`) |

**Files in this packet**

| File | What it is |
|---|---|
| `screen-map.csv` | All 69 demo screens → existing file → action → note. `file_exists` was checked against the repo, not assumed. |
| `flows.json` | Web flow (32 steps), app flow (23 steps), the setup journey and its resume rules, the password-reset path |
| `d09-overlay.css` | Drop-in stylesheet. Load after `globals.css`; rebinds the variables the existing components already use |
| `tokens.d09.ts` | Proposed replacement for `packages/shared/src/tokens.ts`, same export shape, plus dark mode and segment gradients |
| `brand-string-sweep.txt` | Every user-facing "MGT" in web and mobile source — 22 occurrences with file and line |

---

## 1. Decisions needed before the overlay starts

Ordered by how much work each one blocks. None is a design question; each needs an owner's call.

### O-1 · Which build is the base? `BLOCKS EVERYTHING`

There are two lineages, and they have diverged.

| | GitHub — ChatGPT V2.5 (mapped here) | Drive — Fable build `mgt-skincare-v2` |
|---|---|---|
| Last change | 2026-09-18 | Project record runs through SC-P13 |
| Web verticals | `/studio/[segment]` with makeup, style, clothing | Dedicated `/makeup`, `/hair`, `/style` flows |
| Hair-colour lift check | Absent | Built; fails closed; own route |
| Mobile | Skin Match screen only | Six-tab navigator, all six verticals, Coach |
| Stripe | Hosted Checkout, trial, idempotent webhooks | Config scaffolding, live switch not started |
| Project record says | — | "Live source of truth" |

This packet maps the GitHub build because it is the one I could read file by file today. The Drive build is further along on product logic; this one is further along on billing. **Recommendation:** the Drive build as the base, with this repo's `portal/billing.ts` and `portal/payments.ts` ported across, since they are the most complete Stripe integration in either lineage. If you choose the GitHub build instead, the 30 CREATE rows shrink considerably for web and grow for mobile.

### O-2 · Intake is swatch-first `DECIDED 2026-11-15`

The v3.5 brief asked for "image and scan intake." The demo's W33 leads with a photo. The project record locks **swatch-picking, not camera** for colour sampling (SC-P9 web, re-asserted SC-P10 mobile) on two grounds: it keeps samples from ever being an image, and phone white balance is a documented cause of wrong undertone reads.

The Terms already reconcile the two. §4.1 says matching "can be completed entirely by selecting from on-screen swatches"; §4.2 makes a photo upload and a guided scan strictly optional extras. **Decided 2026-11-15, applied in demo v3.7.** W33 now leads with a twelve-step swatch ladder running to `#33220F` and a self-reported undertone (Cool, Neutral, Warm, Olive, Not sure). Continue stays disabled until both are chosen. The photo is an optional card beneath, gated by a consent checkbox, with copy that follows §4.2 and §4.5. Build it to that shape.

The demo's photo copy now matches §4.5 — sent to an image-analysis service, released within thirty seconds, never stored. Production copy must say the same.

### O-3 · The entitlement can't represent the plans `BLOCKS W4, W12, W13, W31`

`apps/api/src/portal/payments.ts:43` writes `memberships.premium` as a boolean. Billing reads a single `STRIPE_PREMIUM_PRICE_ID`. The plans are now Guided ($14.99/mo or $149.90/yr) and Studio ($29.99/mo, $89.97/qtr optional `[ASSUMPTION]`, or $299.90/yr), preliminary; Starter was retired 2026-11-16. That needs a tier field, a cycle field (monthly, quarterly, annual) and one Stripe price per tier per cycle — five prices, not one.

The same boolean gates the Coach: `requirePremium` checks `user_profiles.is_premium` in the Drive lineage. Whichever base you pick, the gate has to read the tier.

### O-4 · Keep hosted Checkout; do not build the demo's card form `DECIDED BY LOCKED RULE`

The demo's W7 is a simulated card form so the flow could be reviewed. Production already uses hosted Stripe Checkout, which keeps card data off your servers entirely — the locked rule is "never store raw card data." The overlay restyles the screens either side of Checkout and leaves Checkout itself to Stripe.

Two changes are needed inside the existing billing code, both driven by the Terms rather than the design:

- **Separate renewal consent.** Terms §8.4 promises consent to auto-renewal *separately* from accepting the Terms. `billing.ts` collects only `consent_collection: { terms_of_service: 'required' }`. Counsel packet item C-5 asks what form the separate consent must take; build it once the answer is in.
- **Trial disclosure.** The code gives a 14-day trial; the plan screens don't mention it. Terms §8.3 requires its length be stated at signup.

### O-5 · Consumer auth doesn't exist yet `BLOCKS W9, W10, W32, journey step 1`

Only admin routes carry auth middleware. The setup journey begins with account creation, so consumer auth (Supabase Auth, per the baseline stack) is a prerequisite for the journey, sign-in and password reset.

### O-6 · The overlay supersedes two locked colour decisions `NEEDS EXPLICIT APPROVAL`

| Locked | Value | Where | D09 replaces with |
|---|---|---|---|
| C10 accent (2026-09-05) | `#7C3AED` violet | `packages/shared/src/tokens.ts` | `#6540D4` light, `#9A80FF` dark, plus six segment gradients |
| SC-P11 mobile tab tint | `#C4A882` gold on `#1A1A1A` | `AppNavigator.tsx` (Drive lineage) | Segment gradient on the active tab |

Your own rule is that architecture-level decisions get explicit approval. `d09-overlay.css` is reversible — delete one import and the old theme returns — so web can be trialled before approval. `tokens.d09.ts` changes the shared package that mobile reads natively, so it should not merge until O-6 is approved.

---

## 2. Overlay sequence

Each phase ships on its own and can be reverted on its own.

| Phase | What changes | Depends on | Reversible by |
|---|---|---|---|
| **A · Theme** | Add `d09-overlay.css` after `globals.css`. Fonts, colour, radius, buttons. No component edits. | Nothing | Removing one import |
| **B · Brand and copy** | Clear the 22 brand strings. Replace `company`, `trust`, `terms`, `privacy` section copy with v3.6 text. Footer statement and disclaimer. | Counsel S-2/S-4 for Terms and Privacy | Git revert |
| **C · Routes** | Add `/applications`, `/retail-partners`, `/plans-billing`, `/privacy-terms`, `/trust-and-ai`, `/partners/onboarding`, `/app/progress`, `/app/scan`, `/account/security`, `/reset-password`, `/setup/intake`. Redirect `/terms`, `/privacy` and `/ai-disclosure` to their merged pages. Keep existing paths and redirect old names to new; never break a live URL. | — | Git revert |
| **D · Journey and plans** | Three-tier entitlement, four Stripe prices, journey state, renewal consent, trial and cycle disclosure. | O-3, O-5, counsel C-5 | Feature flag |
| **E · Shared tokens** | Merge `tokens.d09.ts`. | O-6 | Git revert |
| **F · Mobile** | Port the six-tab navigator and vertical screens, restyled. | O-1, E | Separate release |

**Routes worth one decision now:** the demo uses `/app/*` for signed-in screens as a convenience. The existing build uses top-level paths (`/my-skin`, `/coach`). Keep the existing paths. And Terms §4.8 links Privacy at `/legal/privacy` while the site uses `/privacy` — one has to change, and the redirect should exist either way.

---

## 3. What carries over unchanged

These are the parts of the demo the overlay must preserve exactly, because each one is a product rule rather than a style.

- **Header buttons each carry their own gradient (v4.3).** Skin amber, Color violet, Style blue, Coach pale to dark green, Membership dark to pale pink. At rest the pale half of the ramp with a dark ink of the same hue (worst pair 7.01:1); on the current page the deep half with white text (worst 4.92:1) and `aria-current="page"`. Values are in `d09-overlay.css` and marketing §5.2.
- **Renewal reminders and notification switches (v4.3).** The account page gains a Billing and reminders card (next charge, amount, reminder date, cycle switch) and a Notifications card with the same six switches as the app screen A23; both read one `notification_prefs` record. A subtle banner sits under the header on every web screen, and a card sits on app Home, from two days before a charge.
- **The journey starts with the intake (v4.4).** Answers, then the studio preview and the trial paywall, then the account, then the card on file at $0. Every entry point (header, home, membership cards, plans page, app welcome) goes to `/start`. A member whose trial is used goes straight to paid checkout.
- **The journey resumes; it never restarts.** Each step is skipped if already satisfied. There is no free tier. Guided checks out monthly or annual; Studio monthly, quarterly (optional) or annual, chosen on the membership screen; the checkout summary reads the plan and cycle, never a constant. The optional Guided trial is the only card-gated entry and needs the separate renewal consent ticked before the pay button fires.
- **Every interactive element resolves.** The v3.4 audit found 18 dead controls; v4.2 has 3,733 and none are dead. The audit script (`interact.py`) is in the demo repo and should run in CI against the real build.
- **Contrast is measured, not assumed.** The full v4.2 sweep covers 8,480 text runs in both modes with 0 real failures (2 inactive disabled buttons exempt); the v3.9 sweep found one failure on a marketing card caption, since fixed. Gradient buttons use the darkened stops in the token file — each clears 4.91:1 against white or better.
- **"You are here" comes from the route.** The utility row (Applications, Shop, Learn, Retail Partners, now in the lighter Aura palette) fills the button for the current section and sets `aria-current="page"` from the URL, never from guessed state. Shop stays filled on `/cart`. In Next.js this is `usePathname()` compared against each button's route list.
- **The header Style button opens the Style studio** (`/app/wardrobe`), the page that highlights Style. Until v3.8 it opened the Applications hub, so clicking Style landed somewhere Style wasn't lit, and the hub would have lit two buttons once Applications had its own.
- **Every control is keyboard-reachable, with a visible focus ring.** The demo retrofits tab stops onto click-only links and cards. In the real build, use `<Link href>` and `<button>` and don't add `onClick` to a `div` — then nothing needs retrofitting. Focus ring: 2px `--acc2`, offset 2px.
- **The disclaimer says "cosmetic, not medical" once**, in the footer, followed by the explanation and the copyright line.
- **The footer copyright is the only place the parent entity appears**, pending counsel's answer on the exact entity name (C-9).
- **The footer reads Plans & Billing, Company, Trust & AI, Support, Privacy & Terms, Retail Partners, Shipping & returns.** Retail Partners sits in the support-link row at the very bottom of every web screen (except checkout) and is not a separate band. Partners is no longer a footer item. The Retail Partners row sits at the foot of every app screen. Trust & AI absorbs the former AI disclosure page; Privacy and Terms are one route with two documents on tabs.
- **Photos, face data and card data never travel to a retailer, and the scan is never a credential.** See `05-handoff/HANDOFF-PACKET-v1.0.md` §2 and §7.

---

## 4. Effort `[ESTIMATE]`

| Phase | Hours | Note |
|---|---|---|
| A | 4–6 | Mostly checking existing components under the new variables |
| B | 6–10 | Copy is written; most of the time is the brand sweep and section pages |
| C | 6–8 | Routes plus redirects |
| D | 24–40 | The real work — entitlement migration, prices, consent, journey state |
| E | 2–4 | Plus regression on mobile |
| F | 40–80 | Wide range because it depends entirely on O-1 |

These are build-side estimates with no external dependencies counted. Counsel, Stripe dashboard setup and store accounts are additional and are not hours I can estimate.
