# D09 v3.9 — Overlay, marketing and handoff packets

**2026-11-15** · The Team 47 Studio design system mapped onto this repository, with a platform-neutral handoff for the backend. The folder keeps its original name so existing links stay valid.

| Packet | Contents |
|---|---|
| [`02-overlay/`](02-overlay/OVERLAY-PACKET-v1.3.md) | All 71 design screens mapped to files in this repo (REUSE / REFACTOR / REPLACE / CREATE / DEFER), a drop-in theme stylesheet, proposed shared tokens, and the brand-string sweep |
| [`03-marketing/`](03-marketing/MARKETING-PACKET-v1.2.md) | Brand and voice, approved copy, claims rules, the full gradient system including the v3.9 utility-row palette, and six rendered social assets |
| [`05-handoff/`](05-handoff/HANDOFF-PACKET-v1.0.md) | Merge plan, backend specification, acceptance tests and counsel gates for any AI platform or engineering team, with a machine-readable spec, a paste-ready prompt, and the research sources behind each external claim |

**Start here:** Phase A of the overlay is a single stylesheet, `02-overlay/d09-overlay.css`, loaded after `apps/web/src/app/globals.css`. It rebinds the CSS variables the existing components already use, changes no component code, and reverts by removing one import.

**For another AI platform:** start with `05-handoff/PROMPT-CORE.md`, then give it the packet, `handoff.spec.json` and `RESEARCH-SOURCES.md`. The optional face scan is specified but must stay behind a feature flag until counsel clears it.

**Not in this folder.** The packets reference a counsel review and a partnerships packet (item numbers such as C-5 and C-9). Those, and the interactive reference demo, are held privately and are not published here.

`MANIFEST.sha256` covers every file in this folder: `sha256sum -c MANIFEST.sha256`.
