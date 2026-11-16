# Team 47 Studio — D09 v4.2 Export

**2026-11-16 · Six packets plus the reference demo** · v3.7: Company page, swatch-first intake · v3.8: utility row, keyboard reach · v3.9: filters and graphics on every application page, photo guide, optional scan, passkey sign-in and payment approval, global K-beauty catalogue, consented retailer handoff, upgraded Coach and care, partner onboarding, merged footer, Aura utility row · v4.0: plans priced (Starter $0 · Guided $14.99 · Studio $29.99, annual two months free) with expanded per-plan grids and a full side-by-side, Studio checkout unblocked, Prism Weave behind the landing hero · v4.1: optional 14-day Guided trial door (O-7) with separate renewal consent · v4.2: Retail Partners merged into one section (Brands, Setup, Updates tabs, AI setup assistant, onboarding), Retail Partners as a footer support link (between Privacy & Terms and Shipping & returns) on every web screen, row at the foot of every app screen, Learn rebuilt, every icon distinct, logo +18%

> **Status: PRELIMINARY — pending full release.** Prepared for review ahead of any execution. Decisions, routes, wording and figures are subject to change before work begins; nothing here is final until the owner releases it.

| # | Packet | For | Status |
|---|---|---|---|
| 01 | [Counsel review](01-counsel/COUNSEL-REVIEW-PACKET-v1.2.md) — Terms v3.0.0 and Privacy, verbatim, with 12 issues and a sign-off table | Outside counsel | **Awaiting review** · three company decisions needed first: C-1, C-6, C-9 |
| 02 | [Overlay](02-overlay/OVERLAY-PACKET-v1.6.md) — all 71 screens mapped (70 after v4.2: W29 retired, A24 added) onto the V2.5 build, with drop-in theme and tokens | Build team | **Awaiting decisions** O-1 (which build is the base) and O-6 (superseding the locked accent colour) |
| 03 | [Marketing](03-marketing/MARKETING-PACKET-v1.6.md) — brand, voice, copy bank, claims rules, full gradient system, Prism Weave seamless pattern, six rendered social assets | Anyone producing material | **Ready to use**, subject to §10 before a paid campaign |
| 04 | [Partnerships](04-partnerships/PARTNERSHIPS-PACKET-v1.1.md) — program stages, rate model, outreach drafts, treatment gate | Owner | **Internal** · supersedes the three v1.0 partnership documents |
| 05 | [Handoff](05-handoff/HANDOFF-PACKET-v1.3.md) — platform-neutral merge plan, backend spec, acceptance tests; with [spec](05-handoff/handoff.spec.json), [prompt](05-handoff/PROMPT-CORE.md), [sources](05-handoff/RESEARCH-SOURCES.md) | Any AI platform or engineering team | **Ready to hand off** · scan is behind a counsel gate; seven new decisions listed in §9 |
| 06 | [Growth](06-growth/LIFECYCLE-MESSAGES-v1.0.md) — lifecycle messages for the agent (13 templates, agent instruction) and [month-1 ad creative briefs](06-growth/AD-CREATIVE-BRIEFS-M1-v1.0.md) with the performance-agent playbook, plus the [month-1 organic social calendar](06-growth/SOCIAL-CALENDAR-M1-v1.0.md) (20 videos, 4 carousels, daily Stories, captions final), and [months 2–3](06-growth/GROWTH-PLAN-M2-M3-v1.0.md) (gates, budget split, four scale-phase ad concepts, weeks 5–12 calendar) | Lifecycle and creative agents, whoever runs the ad accounts | **Draft** · blocked on O-7, O-8, N-4 |

**Reference demo:** `demo/index-v4.2.html` — self-contained, fonts embedded, opens offline. Every payment is simulated; only the test card `4242 4242 4242 4242` is accepted and nothing is transmitted. `demo/verification/` holds the render, interaction, contrast, keyboard and journey checks; each takes the HTML path as its first argument. `demo/v42-src/` rebuilds v4.2 from v4.1 (`python3 patch42.py`, reproduces byte-for-byte); `demo/v39-src/` rebuilds v3.9 from the v3.8 base (`python3 patch39.py`).

## Decisions waiting on the owner

| ID | Question | Blocks |
|---|---|---|
| C-1 | Two paid tiers or three? The Terms say three; the product has Guided and Studio. **Prices set 2026-11-15, preliminary:** Starter $0, Guided $14.99/mo or $149.90/yr, Studio $29.99/mo or $299.90/yr. | Terms approval |
| C-6 | App billing: store purchase via RevenueCat (architecture) or "unresolved" (Terms)? | Android and Apple schedules |
| C-9 | Exact contracting entity — MGT Solutions, Inc or MGT Global Solutions, Inc? | Terms, footer, provider block |
| O-1 | Base build: Drive Fable lineage or GitHub V2.5? | All overlay work past the theme |
| ~~O-2~~ | **Decided 2026-11-15** — swatch-first, optional consent-gated photo. Applied in v3.7. | — |
| O-6 | Approve D09 colours superseding locked C10 violet and the mobile gold tab tint? | Shared tokens, mobile |
| N-1 | Merchant of record and Stripe Connect model for Team 47 checkout with partners | Partner checkout mode |
| N-2 | Scan consent text says an image hash is kept. Remove it, or document the need? | Scan |
| N-3 | Counsel clearance for the optional face scan (BIPA, Washington, Texas, FTC 2023 statement) | Scan |
| N-4 | Trademark clearance for every invented brand and retailer name, or replace with real partners | Public launch |
| O-7 | Add the optional 14-day card-on-file Guided trial beside Starter (designed in v4.1; the ROI plan depends on it) | Trial launch |
| N-5 | Care infrastructure and a named owner before any support time is promised | Support promises |

## Integrity

`MANIFEST.sha256` lists a SHA-256 for every file. `sha256sum -c MANIFEST.sha256` confirms nothing changed after export.

Demo data names no real company; every invented name still needs trademark clearance (N-4). No individual is named on any public surface. The parent entity appears only in the footer copyright line.
