# Team 47 Studio — Platform-Neutral Handoff Packet

**Version 1.0 · 2026-11-15 · Internal · For any AI platform or engineering team that will merge the v3.9 design onto the existing build and complete the backend**

> **Status: PRELIMINARY — pending full release.** Prepared for review ahead of any execution. Decisions, routes, wording and figures are subject to change before work begins; nothing here is final until the owner releases it.

Everything here is written to be acted on without the original conversation. The demo is a design reference; every payment, scan, passkey and retailer handoff in it is simulated. This packet says what is real, what is a stand-in, what must never change, and in what order to build.

**Evidence tags used throughout.** `[SRC n]` is a primary or official source listed in `RESEARCH-SOURCES.md`. `[SEC n]` is a secondary source (law-firm or trade commentary) that counsel must confirm. `[ASSUMED]` is a design decision made here with no source behind it. A claim with no tag is a property of the demo and can be checked by running it.

| | |
|---|---|
| **Reference build** | `demo/index-v3.9.html` — one self-contained file, fonts embedded, 71 screens, opens offline |
| **Reproducible source** | `demo/v39-src/` — the v3.8 base plus the patch layer (`patch39.py`, `v39/*.js`, `v39/v39.css`) |
| **Machine-readable spec** | `handoff.spec.json` — screens, routes, state keys, retailers, facets, endpoints, tables, tests |
| **Paste-ready prompt** | `PROMPT-CORE.md` |
| **Sources** | `RESEARCH-SOURCES.md` |
| **Verification** | `demo/verification/` — render, interaction, behaviour, contrast, keyboard, journey |
| **Public repo rule** | Only this packet, the spec, the prompt and the sources may go to GitHub. The demo, counsel packet and partnerships packet stay private. |

---

## 1. What v3.9 delivers, mapped to the request

| Request | Delivered in the demo | Real work remaining |
|---|---|---|
| Filters and graphics on every application page and intake | A shared filter engine (OR within a facet, AND across facets, applied-filter chips, per-facet counts, search, a hard sensitivity-ceiling toggle) on Shop, Makeup, Hair, Wardrobe, Learn, Replenishment, Retail Partners, Applications, Colour finder and the phone shop. Inline nature and industry SVG motifs (leaf, drop, sun, flask, strand, hanger, globe, UV gauge, pH ruler, lift ladder). The UV gauge follows the 1–11+ UV Index bands `[SRC 13]`. | Move catalogue and facets to the database; serve facet counts from the API (§6). |
| Photo capture with instructions at every photo step | A five-step graphic guide: bare skin, hair back, glasses off, neutral expression, even indirect light, 30–45 cm, head upright, flash off, same conditions each week. Used in intake, account setup and the scan. | None for the guide. Camera capture is the platform's own. |
| Optional face scan | W36, a four-step flow: written consent with typed signature, prepare, three angles, result (season, undertone, depth band, confidence, up to three cosmetic notes). Cosmetic only. | **Counsel gate (§7).** Image-attribute model and in-memory pipeline. |
| Face ID–style sign-in and payment approval | Passkey buttons on sign-in and create-account; an on-device approval sheet before any saved card is used; Apple Pay, Google Pay and Stripe Link at checkout. **The phone does the match. Team 47 receives a signed yes.** | WebAuthn server, Stripe Express Checkout, SetupIntent (§5.4, §5.5). |
| Skin and persona tracking | W35 weekly 0–10 check-ins (hydration, comfort, tone, texture), profile-as-stated. Scores only, never photos. | **Merge the existing tracking module here (§4).** |
| K-beauty-led global catalogue (context: Korea's cosmetics exports hit a record $11.4B in 2025, and it became the world's second-largest exporter, per its food and drug safety ministry `[SRC 12]`) | 24 invented products: KR 6, JP 5, US 4, Nordics 3, DE 2, APAC 2, EU 2. Skincare 15, makeup 5, haircare 4. | Real feed ingestion (§6). Real brands need real contracts; the demo names none. |
| Retailers by channel, own payment platform, consented data transfer, Stripe credentials with approval | Eight invented retailers in three modes (§5.6). Per-retailer consent sheet with fields default off. Saved card used only after on-device approval. | Consent ledger, handoff API, retailer-side receivers. |
| AI Coach, customer-care agent, partner onboarding, dedicated support | Coach with AI label, context chips, per-answer Used / Not used, human handoff. Care centre with roles and escalation triggers. Seven-step partner onboarding. | Model routing, escalation rules, ticketing, Stripe Connect (§5.7–5.9). |
| Footer | Plans & Billing, Company, Trust & AI, Support, Privacy & Terms, Shipping & returns, Partners. Trust & AI and AI disclosure are one page. Privacy and Terms are one link with two documents on tabs. | Old paths 301 to the new ones. |
| Utility row v2 | Same four labels and destinations, lighter pastel gradients distinct from the header pills, brighter in dark mode, active state is a deeper pastel with a 2px ink ring. Worst ink-on-stop contrast 5.03:1. | Ship `util.js` values as tokens. |

---

## 2. Locked rules — do not change without the owner

These came from earlier decisions and counsel work. Each is a product rule, not a style. A merge that breaks one is wrong even if it looks better.

1. **Cosmetic, not medical.** No diagnosis, no treatment claim, no disease claim. The "cosmetic, not medical" line appears once, in the footer.
2. **Selfies are transient.** Images are processed and released immediately (the scan's published figure is thirty seconds). Results are stored; images are not.
3. **No biometric identifiers.** The scan returns coarse descriptors only. It is **not** a login or payment credential. Terms §4.4 says so.
4. **Colour results are stored, never samples.** Intake is swatch-first; the camera is optional.
5. **Stripe is the primary payment rail.** Never store raw card data. Webhooks are server-authoritative and idempotent.
6. **One entitlement system, three plans: Free, Guided, Studio.** Studio is blocked while its price is unset. The demo refuses to invent one.
7. **The Style vertical collects no body metrics.**
8. **Hair-lift refusals use amber, not red, give no shame and no escape hatch.** A refusal returns no products and says how long before it is worth re-checking.
9. **The AI Coach is Premium-gated, Tier 3.** Safety, eligibility, lift ceilings and pricing are deterministic code, never model output. No persona or dependency framing.
10. **The sensitivity ceiling is a hard limit.** A product above it is excluded, never down-ranked. The shop's "Fits my sensitivity ceiling" toggle can show what was excluded and why; it is on by default.
11. **No hard-numbered response-time promise anywhere** until a real queue exists. Every figure is `[SLA UNSET]`.
12. **The demo names no real company.** Invented brands and retailers are placeholders pending trademark clearance (§9).
13. **Brand rule.** MGT appears only in the closing line "© 2026 Team 47 Studio - MGT Solutions, Inc." Entity name pending C-9.
14. **Face data never leaves the device for sign-in or payment.** Team 47 must never receive, log or store the biometric check.

---

## 3. How the demo is built, so you can reproduce or replace it

`demo/index-v3.9.html` is the v3.8 file plus an appended patch layer. `demo/v39-src/patch39.py` reads `index-v3.8.html` and the files in `v39/`, replaces the old catalogue, swaps the utility-row block and footer, merges the legal pages, appends the layer before the final `buildRail();paint(true)` and writes the result.

| File | Contents |
|---|---|
| `data.js` | `ORIGIN`, `CEIL`, `RETAILERS` (8), `SHOPITEMS` (24), `WARDROBE` (12), `LEARN` (12) |
| `engine.js` | filter engine, facet sets (`FX`), SVG graphics (`gfx`), shared card pieces |
| `pages1.js` | shop, cart consent sheet, device-approval prompt, checkout (card / wallet / saved) |
| `pages2.js` | photo guide, intake, guided scan, security page, progress, wrappers |
| `pages3.js` | filtered Makeup, Hair, Wardrobe, Learn, Replenishment, Retail Partners, Applications, Colour finder, phone shop |
| `pages4.js` | AI Coach, care centre, partner onboarding, merged Trust & AI, Privacy & Terms wrapper |
| `chrome.js` | route aliases, registry updates, flow order |
| `util.js` and `v39.css` | utility row Aura palette; all new CSS |

**Pitfalls the patcher already handles** (carry them if you re-run it): a duplicate `const SHOPITEMS` is a fatal SyntaxError, so the old line is replaced; the route map `R` captures function references when defined, so `chrome.js` reassigns the `R` entries explicitly after the wrapped functions are defined; old `W25`/`W26` bodies are renamed `termsPage`/`privacyPage`; `go('W25')` and `go('W30')` are aliased so stray references still resolve.

**Replacing it rather than merging it.** The state model is a single object `S` persisted in `sessionStorage` under `t47v3`. v3.9 adds these keys: `f` (filters per page), `consent`, `handoffs`, `ledger`, `links` (saved Link cards), `passkeys`, `scan`, `scanConsent`, `trk`, `pref`, `pm`, `ptTab`, `pob`, `ticket`, `hand`, `careT`, `cc`, plus UI keys `hs`, `cf`, `ca`, `ul`. Each maps to a server resource in §5; none should remain client-only in production.

---

## 4. Merge procedure onto the existing build

The existing build is `greggclark47/MGT-Skin-Care-ChatGPT-Web-Portal-Build-V2.5` (Next.js web, Expo mobile, Express API, live Stripe Checkout), subject to decision O-1 (which build is the base). Follow `02-overlay/OVERLAY-PACKET-v1.3.md` for the screen-by-screen mapping (71 rows in `screen-map.csv`). In this order:

1. **Theme.** Drop `d09-overlay.css` and `tokens.d09.ts` in. No component edits. Reversible by removing one import.
2. **Routes and redirects.** Add `/privacy-terms` (tabs `#privacy`, `#terms`), `/trust-and-ai`, `/partners/onboarding`, `/app/progress`, `/app/scan`, `/account/security`. 301 these: `/terms` and `/privacy` to the matching tab, `/ai-disclosure` to `/trust-and-ai`. Never break a live URL. Resolve Terms §4.8's `/legal/privacy` against the site's `/privacy`.
3. **Chrome.** Footer in the new order. Utility row from `util.js` with `aria-current="page"` set from the route (`usePathname()`), never from guessed state. Shop stays lit on `/cart`; Retail Partners stays lit on `/partners/onboarding`.
4. **Catalogue and filters.** Create the tables in §5.1. Port `fMatch` semantics to the API (§6). Keep the UI behaviour: applied chips with ×, Clear all, per-facet counts computed against all other facets, `aria-live` result count.
5. **Commerce.** Cart grouped by retailer; consent sheet; Stripe modes (§5.6).
6. **Security.** WebAuthn registration and login; step-up approval for saved-card use (§5.4).
7. **Care.** Coach upgrades, escalation rules, ticketing (§5.8).
8. **Partners.** Onboarding with Stripe Connect hosted onboarding (§5.9).
9. **Scan.** Behind a feature flag, off until counsel signs (§7).
10. **Tracking merge.** See below.

### Tracking-module merge point

The demo's W35 and `trk()` are a stand-in with seeded values: four weekly 0–10 scores (hydration, comfort, tone, texture) and the profile as the person stated it. The existing build's tracking module should replace the stand-in without changing the screen contract:

| The screen expects | Map from the existing module |
|---|---|
| A weekly entry with four integer scores 0–10 and a date | Your existing check-in or log record; normalise to these four dimensions or add a mapping layer |
| A trend of the last N entries per dimension | A query over those entries |
| "Profile as stated": skin type, sensitivity ceiling, season | The profile record the Skin Match flow already writes |
| No photos | If the existing module stores photos, **do not surface them here**; keep them out of this surface until counsel approves |
| A single merge point note in the UI | Remove the "Merge point" note when merged |

If the existing module records anything photographic or facial, treat it under §7 before merging.

---

## 5. Backend specification

All of this is proposed. Nothing exists yet. Names are suggestions.

### 5.1 Data model (Postgres)

| Table | Key columns | Notes |
|---|---|---|
| `retailers` | id, name, type, region, mode, pay_methods[], accepts_link, ship, data_fields[], members_only, stripe_account_id, status | `mode` ∈ stripe, handoff, linkout |
| `products` | id, retailer_id, name, brand, price_cents, vertical, step, origin, category, inci jsonb, actives_level 0–3, free_from[], vegan, finish, undertone, depth_min, depth_max, hair_types[], scalp[], claims[], feed_id | `actives_level` drives the ceiling; ingredient percentages come from the feed |
| `feeds` | id, retailer_id, format, status, validation_report jsonb | |
| `consent_ledger` | id, user_id, kind, subject_id, fields jsonb, text_version, signed_name, signed_at, withdrawn_at | **Append-only.** Withdrawal writes a new row; never update or delete |
| `handoffs` | id, user_id, retailer_id, cart_snapshot jsonb, fields_shared[], consent_id, status | `fields_shared` is exactly what the customer ticked |
| `passkeys` | id, user_id, credential_id, public_key, sign_count, transports[], label, created_at, last_used_at | |
| `stripe_customers` | user_id, stripe_customer_id | Cards are never stored here, only Stripe IDs and display fields (brand, last4, expiry) |
| `scan_results` | id, user_id, season, undertone, depth_band, confidence, notes[], created_at, deleted_at | **No images.** See §7 on image hashes |
| `tracking_entries` | id, user_id, week, hydration, comfort, tone, texture | Scores only |
| `coach_turns` | id, session_id, role, text, used jsonb, not_used jsonb, product_ids[], feedback | `used` and `not_used` are what the screen shows under each answer |
| `care_tickets` | id, ref, user_id, topic, context jsonb, status, assigned_to, created_at | `context` = plan, topic, last three user messages. **Never** photos, scan results, card data or health information |
| `partner_applications` | id, company, region, sku_count, seller_type, stripe_account_id, verified, mode, agreement_signed_name, agreement_signed_at, feed_status, sandbox_order_id, go_live_requested_at, reviewer_id | |

### 5.2 API surface

| Area | Endpoints |
|---|---|
| Catalogue | `GET /api/catalog` with facet query params, `q`, `fit=ceiling` → items plus per-facet counts |
| Cart and handoff | `POST /api/handoffs/consent`, `POST /api/handoffs`, `POST /api/handoffs/:id/withdraw` |
| Payments | `POST /api/pay/session` (Team 47 checkout lines only), `POST /api/pay/setup-intent`, `POST /api/pay/saved-card/charge`, `POST /api/stripe/webhook` |
| Passkeys | `POST /api/auth/passkeys/register/options`, `…/register/verify`, `…/login/options`, `…/login/verify`, `DELETE /api/auth/passkeys/:id` |
| Scan | `POST /api/scan/consent`, `POST /api/scan/analyse`, `DELETE /api/scan/result` |
| Progress | `GET`/`POST /api/progress` |
| Coach and care | `POST /api/coach/turn`, `POST /api/care/handoff`, `GET /api/care/tickets/:ref` |
| Partners | `POST /api/partners/applications`, `POST /api/partners/:id/account-link`, `POST /api/partners/:id/agreement`, `POST /api/partners/:id/feed`, `POST /api/partners/:id/sandbox-order`, `POST /api/partners/:id/go-live` |
| Account | `GET /api/account/sharing` (what has been shared, per retailer), `GET /api/account/activity` |

### 5.3 Consent ledger

One row per consent decision, with the exact text version shown, the fields chosen, the typed name where a signature was taken, and a timestamp. Retailer sharing defaults to **no fields selected**. The Security page reads this ledger to show "what you have shared" with a Withdraw control per retailer. Withdrawal appends a row and triggers a deletion request to the retailer by whatever channel the data-sharing agreement defines.

### 5.4 Passkeys and device approval

Use WebAuthn for sign-in and create-account. The passkey private key and the Face ID or fingerprint match stay on the user's device; the server receives a signed assertion, not a biometric `[SRC 8]`. Register with `userVerification: "required"`.

For using a saved card, require a fresh WebAuthn assertion (`userVerification: "required"`, a server-issued challenge bound to the cart total and retailer) before calling the charge endpoint. `[ASSUMED]` This is a Team 47 control layered on top of Stripe, chosen so a stolen session cannot spend a stored card; Stripe does not require it. Strong customer authentication and 3-D Secure remain Stripe's job.

On Apple Pay the user must authenticate with Face ID, Touch ID or passcode before payment data is sent, and the merchant never receives the card number `[SRC 9]`; Google Pay and Link behave similarly but are not separately sourced here.

Do **not** build Team 47's own face match for sign-in or payment. That would make Team 47 a biometric-identifier collector, contradict Terms §4.4 and trigger the laws in §7.

### 5.5 Payments

- **One-click wallets.** Use Stripe's Express Checkout Element for Apple Pay, Google Pay and Link; Link needs the `card` payment method type alongside it `[SRC 5]`. Register the domain in test and live.
- **Saved cards.** Create a SetupIntent. `usage` defaults to `off_session`; saving for later use needs the customer's permission, recorded as a mandate with the recommended mandate text `[SRC 6]`. Mirror only display fields.
- **Webhooks.** Verify signatures, process idempotently by event ID, and treat the webhook as the source of truth for entitlement and order state, never the browser redirect.
- **Which lines are payable here.** Only `mode = stripe` items. `handoff` and `linkout` items are completed on the retailer's own platform; the demo's cart already separates them.

### 5.6 Retailer modes

| Mode | Who takes payment | What moves | Disclosure |
|---|---|---|---|
| `stripe` — "Checkout here" | Team 47 through Stripe; partner fulfils | Order details needed to fulfil | Standard order terms |
| `handoff` — "Retailer checkout" | The retailer's own platform (cards, Apple Pay, Google Pay, retailer wallet) | Only the fields the customer ticks, per retailer, per order. Default none. A saved Stripe Link card may be offered where the retailer accepts it, only after on-device approval | Consent text version recorded in the ledger |
| `linkout` — "Link-out" | The retailer (marketplace, warehouse club) | **Nothing about the customer** | "We earn a commission if you buy" next to the link `[SRC 4]` |

Amazon-style and warehouse-club channels are modelled as link-outs deliberately: they run their own programmes, they do not take customer data from a third party, and at least one major warehouse club's affiliate scheme is understood to pay only for membership sign-ups `[UNVERIFIED — check the current programme terms before relying on this]`. **Never share, in any mode:** photos, scan results, card details, health information.

### 5.7 Coach architecture

A request goes through, in order: (1) **deterministic triage**: keyword and pattern rules for reaction or safety, privacy and deletion requests, payment disputes, and an explicit ask for a person; any hit skips the model and routes to a human with a safe canned reply; (2) **context builder**: ceiling, season, routine, active shop filters, never images or scan data; (3) **model call**; (4) **post-filter**: any product not in the catalogue, or above the ceiling, is removed before display; (5) **render** with Used / Not used lines and Helpful / Not helpful. Twenty user turns per session; at the cap, offer a person. The first message states that it is an AI and that a person is available, which is the disclosure the EU AI Act's Article 50(1) requires of systems that talk to people, in force since 2 August 2026 `[SRC 11]`. California and other state chatbot-disclosure rules need counsel `[UNVERIFIED — re-verify]`.

The reaction reply is fixed, not generated: stop using the product, rinse gently, and for swelling, trouble breathing, a spreading rash or severe pain contact a medical professional or emergency services. The assistant never diagnoses.

### 5.8 Care and escalation

Five roles: care assistant (AI), order helper (AI, read-only), safety triage (rules, then a person), partner concierge (person with AI drafts), care specialist (person, signs replies). **Hard escalation triggers:** reaction or safety concern, privacy or deletion request, payment dispute, the customer asks for a person. **Soft:** two failed attempts on the same question, frustration in the customer's words. A person writes and sends every refund, exception and safety reply; the assistant may draft. A handoff creates a ticket with the context in §5.1 and shows the customer exactly what is included. No reply-time promise is made `[SLA UNSET]`; the safety route in particular cannot be advertised until something answers it.

### 5.9 Retail partner onboarding

Seven steps: Apply, Verify, Integration, Data agreement, Catalogue, Test order, Go live. Verification uses Stripe's hosted onboarding: create a connected account, create an Account Link with a `return_url` and a `refresh_url`, redirect, and handle `account.updated` webhooks. Many clients prefetch links, so the refresh URL must mint a new link `[SRC 7]`. Store the connected account ID and status, never documents or bank details. **Decision before building Team 47 checkout for partners:** merchant of record, liability for refunds and disputes, and who is the seller of record. `[ASSUMED]` Until that is decided, offer only `handoff` and `linkout` to partners.

---

## 6. Catalogue feed and filter semantics

**Required feed fields.** Full INCI list with percentages (needed to apply a sensitivity ceiling), depth values rather than shade names only (the shade-coverage gate), claims the platform can carry (no outcome claims), origin, price, SKU. A feed that lacks INCI percentages cannot enter a routine, though it may be listed.

**Filter semantics (port exactly).** Within one facet, values are OR. Across facets, AND. Search matches name, brand and ingredients. The sensitivity ceiling is a hard AND that can be switched off to show exclusions. Each facet's per-value count is computed against *all other* facets' selections (excluding itself) so a count never promises more than clicking delivers. Zero-count values stay visible, dashed, not hidden. Applied filters are shown as removable chips above the grid. These follow Baymard's product-list research: the average large site performs mediocre at best, 15% do not let shoppers combine values within one filter, and 28% do not show applied filters in an overview `[SRC 10]`.

**Facet sets in the demo:** Shop — vertical, category, origin, skin, concern, key ingredient, free-from, channel, price. Makeup — category, finish, undertone, origin, free-from. Hair — category, hair type, scalp, concern, origin. Wardrobe — category, fabric, palette, occasion, fit, origin. Learn — topic, level. Retail Partners — type, region, mode, link. Replenishment — status, origin, channel. Applications — group, vertical, use. Colour finder — role, family, use.

---

## 7. Counsel gates — do not ship until cleared

| Gate | Why | What the demo already does |
|---|---|---|
| **Guided face scan** | Illinois BIPA covers a "scan of hand or face geometry" `[SRC 2]`, with a private right of action and a written-release requirement. A written release can be an electronic signature (P.A. 103-769, effective 2 Aug 2024) `[SRC 3]`, and the 2024 amendment limits a plaintiff to one recovery `[SRC 3]`. Virtual try-on suits against beauty brands show the exposure, with mixed outcomes `[SEC 1]`. Texas (CUBI) and Washington (My Health My Data Act) have their own regimes `[UNVERIFIED — re-verify with counsel]`. The FTC's 2023 policy statement treats facial depictions as biometric information and warns against blanket claims about what the technology achieves `[SRC 1]` | Optional; typed e-signature; retention schedule stated; images released within thirty seconds; result deletable; never a credential; coarse descriptors only |
| **Image hashes** | The consent text says a hash of each image is retained. A hash of a face image may be treated as biometric-adjacent. `[ASSUMED]` Safer to retain no hash at all unless a specific need is documented | Hashes are described in the consent text. **Recommend removing them** before counsel review |
| **Privacy and Terms** | Draft, not reviewed. Terms v3.0.0 and the Privacy page are in `01-counsel/` | Merged page, two documents |
| **Chatbot disclosure wording** | EU Art. 50(1) is in force; the Art. 50(2) marking duty, which falls on providers of systems that generate synthetic content, applies to systems already on the market from 2 December 2026 `[SRC 11]`; whether it reaches Team 47 as a deployer of a third-party model is a counsel question. California bot and companion-chatbot rules `[UNVERIFIED — re-verify with counsel]` | AI label on first message |
| **Affiliate disclosure placement** | Disclosure near the link, in the same medium `[SRC 4]` | Shop notice plus a note on every link-out card |
| **Data-sharing agreement** | The demo shows a plain-language summary only | Marked `[NOT YET DRAFTED]` |

---

## 8. Acceptance tests

Run all of these against the merged build. IDs match `handoff.spec.json`.

| ID | Expectation |
|---|---|
| AT-01 | Every screen renders in light and dark with no console error (harness: 71 screens, 294 renders) |
| AT-02 | Every interactive element has a handler and a keyboard stop (3,417 elements, 0 dead) |
| AT-03 | Footer order is Plans & Billing, Company, Trust & AI, Support, Privacy & Terms, Shipping & returns, Partners; no separate AI disclosure, Privacy or Terms link |
| AT-04 | `/terms` and `/privacy` land on the matching tab of `/privacy-terms`; `/ai-disclosure` lands on `/trust-and-ai` |
| AT-05 | Selecting a filter changes the count and shows a chip; Clear all restores the original count |
| AT-06 | No product above the sensitivity ceiling is offered by the shop, the Coach or "Add my whole routine" while the ceiling toggle is on |
| AT-07 | The cart groups by retailer; consent fields default to none; link-out shows no data fields |
| AT-08 | A saved card cannot be used without a fresh on-device approval |
| AT-09 | Sign-in and payment never request, receive or log a face image or template |
| AT-10 | The scan is unreachable without a recorded consent; the result is deletable; no image persists after 30 seconds |
| AT-11 | A reaction message to the Coach returns the fixed safe reply and offers a person; no diagnosis |
| AT-12 | A handoff shows its exact contents and never includes photos, scan data, card data or health information |
| AT-13 | Partner onboarding blocks each step until its requirement is met |
| AT-14 | The four utility buttons keep their labels and routes in both modes; the current section carries `aria-current="page"` |
| AT-15 | Text contrast is at least 4.5:1 (3:1 for large text) in both modes on every screen. Demo result: a full sweep of 8,250 text runs found one failure (the M1 social-card caption, 3.11:1), now fixed and re-run clean; 3,820 runs on the 21 changed screens, 0 failures |
| AT-16 | The first journey still resumes without restarting: membership, plan, account, intake, checkout |

`demo/verification/v39test.py` covers AT-03 to AT-07, AT-11 to AT-14. `interact.py`, `harness.js`, `kbd.py`, `jrny.py` and `audit_new.py` / `audit_full.py` cover the rest.

---

## 9. Open items, consolidated

| ID | Item | Blocks |
|---|---|---|
| C-1 | Two paid tiers or three? | Terms approval |
| C-6 | App billing: store purchase via RevenueCat, or unresolved? | Android and Apple schedules |
| C-9 | Contracting entity: MGT Solutions, Inc or MGT Global Solutions, Inc? | Terms, footer |
| O-1 | Base build: Drive lineage or GitHub V2.5? | Everything past theme |
| O-6 | Approve D09 colours superseding the locked C10 violet `#7C3AED` and the mobile gold tab tint? | Shared tokens, mobile |
| N-1 | Merchant of record and Stripe Connect model for Team 47 checkout with partners | Partner checkout mode |
| N-2 | Image hashes: remove, or document the need | Scan |
| N-3 | Counsel: BIPA, Washington MHMDA, Texas CUBI, FTC 2023 statement | Scan |
| N-4 | Real brands and retailers replace invented names; **trademark clearance for every invented name** | Public launch |
| N-5 | Care infrastructure: build on the platform or buy a desk with an AI layer; a named owner; real response times | Any support promise |
| N-6 | Checkout lacks a separate auto-renewal consent (C-5) | Plans billing |
| N-7 | Consumer auth is not built; passkeys need an account system | Security page |
| N-8 | Header Color and Membership lit states still mix toward navy, unlike the utility row | Visual consistency |
