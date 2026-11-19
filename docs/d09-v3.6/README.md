# D09 v4.1 — Overlay, marketing and handoff packets

**2026-11-15** · The Team 47 Studio design system mapped onto this repository, with a platform-neutral handoff for the backend. The folder keeps its original name so existing links stay valid.

> **Status: PRELIMINARY — pending full release.** Prepared for review ahead of any execution. Decisions, routes, wording and figures are subject to change before work begins; nothing here is final until the owner releases it.

| Packet | Contents |
|---|---|
| [`02-overlay/`](02-overlay/OVERLAY-PACKET-v1.5.md) | All 71 design screens mapped to files in this repo (REUSE / REFACTOR / REPLACE / CREATE / DEFER), a drop-in theme stylesheet, proposed shared tokens, and the brand-string sweep |
| [`03-marketing/`](03-marketing/MARKETING-PACKET-v1.5.md) | Brand and voice, approved copy, claims rules, the full gradient system including the v3.9 utility-row palette and the Prism Weave seamless pattern, and six rendered social assets |
| [`05-handoff/`](05-handoff/HANDOFF-PACKET-v1.2.md) | Merge plan, backend specification, acceptance tests and counsel gates for any AI platform or engineering team, with a machine-readable spec, a paste-ready prompt, and the research sources behind each external claim |
| [`06-growth/`](06-growth/LIFECYCLE-MESSAGES-v1.0.md) | Lifecycle message templates and agent instruction; month-1 ad creative briefs and the performance-agent playbook (AD-CREATIVE-BRIEFS-M1-v1.0.md); month-1 organic social calendar (SOCIAL-CALENDAR-M1-v1.0.md); months 2–3 scale plan (GROWTH-PLAN-M2-M3-v1.0.md). Draft, blocked on owner decisions O-7 and O-8 |

**Start here:** Phase A of the overlay is a single stylesheet, `02-overlay/d09-overlay.css`, loaded after `apps/web/src/app/globals.css`. It rebinds the CSS variables the existing components already use, changes no component code, and reverts by removing one import.

**For another AI platform:** start with `05-handoff/PROMPT-CORE.md`, then give it the packet, `handoff.spec.json` and `RESEARCH-SOURCES.md`. The optional face scan is specified but must stay behind a feature flag until counsel clears it.

**Not in this folder.** The packets reference a counsel review and a partnerships packet (item numbers such as C-5 and C-9). Those, and the interactive reference demo, are held privately and are not published here.

`MANIFEST.sha256` covers every file in this folder: `sha256sum -c MANIFEST.sha256`.
