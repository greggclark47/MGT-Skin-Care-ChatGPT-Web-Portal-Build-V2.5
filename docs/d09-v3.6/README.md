# D09 v3.6 — Overlay and marketing packets

**2026-11-15** · The Team 47 Studio design system mapped onto this repository.

| Packet | Contents |
|---|---|
| [`02-overlay/`](02-overlay/OVERLAY-PACKET-v1.2.md) | All 69 design screens mapped to files in this repo (REUSE / REFACTOR / REPLACE / CREATE / DEFER), a drop-in theme stylesheet, proposed shared tokens, and the brand-string sweep |
| [`03-marketing/`](03-marketing/MARKETING-PACKET-v1.1.md) | Brand and voice, approved copy, claims rules, the full gradient system, and six rendered social assets |

**Start here:** Phase A of the overlay is a single stylesheet, `02-overlay/d09-overlay.css`, loaded after `apps/web/src/app/globals.css`. It rebinds the CSS variables the existing components already use, changes no component code, and reverts by removing one import.

**Not in this folder.** The packets reference a counsel review and a partnerships packet (item numbers such as C-5 and C-9). Those, and the interactive reference demo, are held privately and are not published here.

`MANIFEST.sha256` covers every file in this folder: `sha256sum -c MANIFEST.sha256`.
