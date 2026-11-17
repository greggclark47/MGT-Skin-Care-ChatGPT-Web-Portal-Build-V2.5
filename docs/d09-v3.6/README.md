# Team 47 Studio — D09 v4.4 Export

**2026-11-16 · Six packets plus the reference demo** · v3.7: Company page, swatch-first intake · v3.8: utility row, keyboard reach · v3.9: filters and graphics on every application page, photo guide, optional scan, passkey sign-in and payment approval, global K-beauty catalogue, consented retailer handoff, upgraded Coach and care, partner onboarding, merged footer, Aura utility row · v4.0: plans priced (Guided $14.99 · Studio $29.99, annual two months free) with expanded per-plan grids and a full side-by-side, Studio checkout unblocked, Prism Weave behind the landing hero · v4.1: optional 14-day Guided trial door (O-7) with separate renewal consent · v4.2: Retail Partners merged into one section (Brands, Setup, Updates tabs, AI setup assistant, onboarding), Retail Partners as a footer support link (between Privacy & Terms and Shipping & returns) on every web screen, row at the foot of every app screen, Learn rebuilt, every icon distinct, logo +18% · v4.3: two plans (Guided and Studio), a new side-by-side with a Studio-adds panel and application-by-application value, optional quarterly billing for Studio, renewal reminders two days before every charge with one switch shared by web and app, a gradient per header button · v4.4: new customer intake (eight steps, no price), studio preview, a 14-day card-on-file trial on Guided or Studio as the only way in, Your trial page (web and app) with one-step cancel

> **Status: PRELIMINARY — pending full release.** Prepared for review ahead of any execution. Decisions, routes, wording and figures are subject to change before work begins; nothing here is final until the owner releases it.

| # | Packet | For | Status |
|---|---|---|---|
| 01 | [Counsel review](01-counsel/COUNSEL-REVIEW-PACKET-v1.4.md) — Terms v3.0.0 and Privacy, verbatim, with 12 issues and a sign-off table | Outside counsel | **Awaiting review** · three company decisions needed first: C-1, C-6, C-9 |
| 02 | [Overlay](02-overlay/OVERLAY-PACKET-v1.8.md) — all 71 screens mapped (70 after v4.2: W29 retired, A24 added) onto the V2.5 build, with drop-in theme and tokens | Build team | **Awaiting decisions** O-1 (which build is the base) and O-6 (superseding the locked accent colour) |
| 03 | [Marketing](03-marketing/MARKETING-PACKET-v1.8.md) — brand, voice, copy bank, claims rules, full gradient system, Prism Weave seamless pattern, six rendered social assets | Anyone producing material | **Ready to use**, subject to §10 before a paid campaign |
| 04 | [Partnerships](04-partnerships/PARTNERSHIPS-PACKET-v1.1.md) — program stages, rate model, outreach drafts, treatment gate | Owner | **Internal** · supersedes the three v1.0 partnership documents |
| 05 | [Handoff](05-handoff/HANDOFF-PACKET-v1.5.md) — platform-neutral merge plan, backend spec, acceptance tests; with [spec](05-handoff/handoff.spec.json), [prompt](05-handoff/PROMPT-CORE.md), [sources](05-handoff/RESEARCH-SOURCES.md) | Any AI platform or engineering team | **Ready to hand off** · scan is behind a counsel gate; seven new decisions listed in §9 |
| 06 | [Growth](06-growth/LIFECYCLE-MESSAGES-v1.1.md) — lifecycle messages for the agent (14 templates following the 14-day trial, agent instruction) and [month-1 ad creative briefs](06-growth/AD-CREATIVE-BRIEFS-M1-v1.1.md) with the performance-agent playbook, plus the [month-1 organic social calendar](06-growth/SOCIAL-CALENDAR-M1-v1.1.md) (20 videos, 4 carousels, daily Stories, captions final), and [months 2–3](06-growth/GROWTH-PLAN-M2-M3-v1.1.md) (gates, budget split, four scale-phase ad concepts, weeks 5–12 calendar) | Lifecycle and creative agents, whoever runs the ad accounts | **Draft v1.1** · blocked on O-7, O-8, N-4 |

**Reference demo:** `demo/index-v4.4.html` — self-contained, fonts embedded, opens offline. Every payment is simulated; only the test card `4242 4242 4242 4242` is accepted and nothing is transmitted. `demo/verification/` holds the render, interaction, contrast, keyboard and journey checks; each takes the HTML path as its first argument. `demo/v44-src/` rebuilds v4.4 from v4.3 (`python3 patch44.py`, reproduces byte-for-byte); `demo/v43-src/` rebuilds v4.3 from v4.2 (`python3 patch43.py`, reproduces byte-for-byte); `demo/v42-src/` rebuilds v4.2 from v4.1 (`python3 patch42.py`, reproduces byte-for-byte); `demo/v39-src/` rebuilds v3.9 from the v3.8 base (`python3 patch39.py`).

## Decisions waiting on the owner

| ID | Question | Blocks |
|---|---|---|
| C-1 | Two paid tiers or three? The Terms say three; the product has Guided and Studio. **Two plans since 2026-11-16, preliminary:** Guided $14.99/mo or $149.90/yr, Studio $29.99/mo, $89.97/qtr (optional) or $299.90/yr. With two plans, C-1 is a straight rename. | Terms approval |
| C-6 | App billing: store purchase via RevenueCat (architecture) or "unresolved" (Terms)? | Android and Apple schedules |
| C-9 | Exact contracting entity — MGT Solutions, Inc or MGT Global Solutions, Inc? | Terms, footer, provider block |
| O-1 | Base build: Drive Fable lineage or GitHub V2.5? | All overlay work past the theme |
| ~~O-2~~ | **Decided 2026-11-15** — swatch-first, optional consent-gated photo. Applied in v3.7. | — |
| O-6 | Approve D09 colours superseding locked C10 violet and the mobile gold tab tint? | Shared tokens, mobile |
| N-1 | Merchant of record and Stripe Connect model for Team 47 checkout with partners | Partner checkout mode |
| N-2 | Scan consent text says an image hash is kept. Remove it, or document the need? | Scan |
| N-3 | Counsel clearance for the optional face scan (BIPA, Washington, Texas, FTC 2023 statement) | Scan |
| N-4 | Trademark clearance for every invented brand and retailer name, or replace with real partners | Public launch |
| O-7 | Approve the 14-day card-on-file trial on Guided or Studio as the only way in (built in v4.4; cost addendum v2.3 and growth v1.1 depend on it) | Launch |
| N-9 | Set the Studio quarterly price (demo uses $89.97, three months at the monthly price, as a placeholder) | Studio quarterly launch |
| C-10 | Counsel: do the trial acknowledgment, the day-11 reminder (cannot be switched off) and the two-day renewal reminder (can be) meet the applicable state automatic-renewal laws for each cycle? | Trial and reminder launch |
| ~~N-10~~ | **Done 2026-11-16** — cost/ROI addendum v2.3 (Drive, cost-analysis folder, with `roi_model_v23.py`) and growth packet v1.1 rerun for the trial-only funnel. Base case: in-month positive M5, cumulative M7; month-6 target needs 6% click→trial or 40% trial→paid | — |
| N-5 | Care infrastructure and a named owner before any support time is promised | Support promises |

## Integrity

`MANIFEST.sha256` lists a SHA-256 for every file. `sha256sum -c MANIFEST.sha256` confirms nothing changed after export.

Demo data names no real company; every invented name still needs trademark clearance (N-4). No individual is named on any public surface. The parent entity appears only in the footer copyright line.
