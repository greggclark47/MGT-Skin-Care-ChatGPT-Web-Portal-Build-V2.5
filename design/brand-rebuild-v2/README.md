# Team 47 Studio — Brand Rebuild v2

Version 2.0 · 2026-11-14 · Design concepts, not production code.

Ten end-to-end interface designs for the Team 47 Studio web portal and app. Every design uses the established logo (prism "47" mark + "Team Studio" wordmark), works in light and dark mode, and shows the Free / Guided / Studio membership.

## What is here

| Path | Contents |
|---|---|
| `boards/` | 180 artboards as HTML (`D01`–`D10`, 18 each). Open any file in a browser. |
| `boards/assets/` | The two logo files the boards use (light surface, dark surface). |
| `tokens.json` | Design tokens per design and per mode: colours, typography, shape, layout choices. |
| `generator/` | Python that produced the boards (`gen3.py` plus the modules it builds on). |
| `lookbook/` | PDF lookbook: a cover page, then one page per design showing all 18 boards. |

This folder is self-contained. It touches no application code and was branched from `main`.
| `PROMPT.md` | The brief this work was executed against. |

## The ten designs

| ID | Name | Organizing idea | Primary mode |
|---|---|---|---|
| D01 | Prism | One profile refracts into six uses, like the logo. | Light |
| D02 | Match First | The first Skin Match question is the homepage. | Light |
| D03 | Routine Daily | Tonight's routine leads; everything else supports the habit. | Light |
| D04 | Coach First | A conversation is the front door. | Dark |
| D05 | Colour Season | Your palette comes first and drives every vertical. | Light |
| D06 | Shelf | The ready-made cart is the hero. | Light |
| D07 | Editorial | A magazine: masthead, chapters, authority. | Dark |
| D08 | Dashboard | Show the data: every recommendation lists what it used. | Light |
| D09 | Card Grid | A grid of live tiles: the whole product at a glance. | Dark |
| D10 | Calm | As little as possible: whitespace, one action, quiet type. | Light |

## Boards per design

Web: `W1-Home`, `W1-Home-alt` (other mode), `W2-Result`, `W3-Portal`, `W4-Membership`.
App: `A01-Welcome`, `A02-Match`, `A03-Result`, `A04-Home`, `A04-Home-alt` (other mode), `A05-Routine`, `A06-Shop`, `A07-Makeup`, `A08-Lift`, `A09-Style`, `A10-CoachPreview`, `A11-CoachChat`, `A12-Profile`.

## Logo rules applied

- Light-surface file on light grounds, dark-surface file on dark grounds.
- Solid ground only; never on a tint, gradient or image.
- 64 px tall in the web header, 50 px in the app header, 60 px on the app welcome screen.
- Never recoloured, stretched or cropped. Source: `apps/web/public/brand/team47studio-horizontal-{light,dark}-surface.png` on branch `codex/reconcile-main-2026-09-20`, trimmed of transparent padding and resized to 640 px wide.

## Checks run

- All 180 boards render with the specified typefaces with no script errors, no horizontal overflow and no overlapping fixed elements (headless Chrome, 1280 px web and 390 px app viewports).
- The correct logo file loads on every board that carries a logo.
- Colour tokens: 16 text and accent pairs per mode clear WCAG AA 4.5:1 in every design. The generator nudges secondary text and accent colours until they do (`aa()` in `gen3.py`). Fixed colours inside individual boards, such as the amber lift-check panel, are outside that check.
- Not done: user testing, screen-reader testing, real-device testing.

## Assumptions and open items

- [ASSUMPTION] Guided is shown at $14.99 a month, carried over from the earlier Premium decision, because the `premium` identifier was retained for Guided. Studio shows a `[PRICE]` placeholder. Confirm both.
- [ASSUMPTION] Tier features are paraphrased from `packages/shared/src/membership.ts` on branch `codex/reconcile-main-2026-09-20`; wording should be checked against that file before any of it ships.
- Earlier boards said "no photo is stored". Guided includes an image journal, so that claim was removed everywhere. Replace it with the product's actual retention statement.
- Product names, shades and prices on the boards are illustrative.
- Copy has not been run through the repository's copy-scan suites (corrective vocabulary, lift-refusal rules, body framing).
- Fonts load from Google Fonts; native apps need them bundled and licences confirmed.

## Regenerating

```
cd generator
python3 gen3.py ../out export     # boards with relative logo paths; copy boards/assets/ next to them
```

`gen3.py` imports `gen.py` and `gen2.py` from the same folder. Python 3.10+, no third-party packages.
