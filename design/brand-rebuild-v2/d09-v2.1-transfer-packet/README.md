# Team 47 Studio — D09 Card Grid v2.1 transfer packet

Version 2.1 · 2026-11-14 · Design concepts, not production code. Supersedes the D09 boards in `../boards/` (v2.0). The other nine v2.0 designs are unchanged.

One design, four surfaces: web portal, iOS, Android, and the two store listings (Google Play, App Store). Every screen is drawn in dark and light mode on the established logo.

## What changed from v2.0

- Web header: five prism pill links (Skin, Color, Style, Coach, Membership), each with a faceted icon, bolder type and a thin outline.
- Homepage hero rebuilt as a live-tile grid; five illustrated entry tiles below it.
- The stats line (6 / 12 / ~60s / $0) is removed. In its place: "Made to fit you, not an average." with four feature tiles.
- Soft mixed-color prism pattern with thin outlines on tiles, headers and call-to-action panels in both modes. The logo always sits on solid ground.
- Result and portal pages rebuilt on the same card grid. A "What to expect" tile and footer link point to the terms.
- US spelling throughout. Timing claims removed from result screens.
- New: iOS and Android screen sets, Google Play and App Store assets.

## Contents

| Path | Contents |
|---|---|
| `boards/` | 86 artboards as HTML. `D09-W*` web (8), `D09-IOS-*` (24), `D09-AND-*` (24), `D09-GP-*` Google Play (16), `D09-AS-*` App Store (14). Open in a browser. |
| `boards/assets/` | Logo files (light surface, dark surface) and the supplied app icons, unchanged. |
| `store/google-play/` | Icon 512 (supplied), feature graphic 1024 x 500 (dark, light), 6 screenshots per mode at 1080 x 1920. |
| `store/app-store/` | Icon 1024 (supplied), 6 screenshots per mode at 1206 x 2622. |
| `previews/` | Contact sheets per surface and mode. |
| `tokens/` | Color, type and shape tokens for both modes (JSON and CSS variables). |
| `index/design-index.csv` | Every board and store image with platform, mode and size. |
| `generator/` | Python that produced everything. Paths inside are those of the build machine. |

## Screens

Web: `W1-Home`, `W2-Result`, `W3-Portal`, `W4-Membership`.
App (iOS 390 x 844, Android 412 x 915): `A01-Welcome`, `A02-Match`, `A03-Result`, `A04-Home`, `A05-Routine`, `A06-Shop`, `A07-Makeup`, `A08-Lift`, `A09-Style`, `A10-CoachPreview`, `A11-CoachChat`, `A12-Profile`.
Store: `S1`–`S6` screenshots, `L1-Listing`, `F1-Feature` (Google Play only).

Platform differences: iOS uses a centered title and a tab bar with a patterned active tile. Android uses a left-aligned top app bar with a back arrow and a Material 3 navigation bar with pill indicators.

## Store specifications used

Confirmed on the official pages on 2026-11-14:

- Google Play ([Add preview assets](https://support.google.com/googleplay/android-developer/answer/9866151)): icon 512 x 512 32-bit PNG with alpha, up to 1024 KB; feature graphic 1024 x 500 JPEG or 24-bit PNG without alpha; screenshots JPEG or 24-bit PNG without alpha, 320 to 3840 px, longest side at most twice the shortest, up to 8 per device type; short description 80 characters.
- App Store ([Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)): 1206 x 2622 is an accepted required iPhone size; JPEG or PNG; no alpha; up to 10 per size.

Not confirmed, marked `[CONFIRM]` on the listing boards: app name and description limits, Apple subtitle, promotional text and keyword limits, store categories.

## Checks run

- 86 boards render with no script errors. Web and app boards: no horizontal overflow, no overlap between fixed and flowing elements (headless Chrome).
- Text contrast: every text element on the 62 non-composite boards clears WCAG AA (4.5:1, or 3:1 for large text) against its ground. Each of the patterned zones is checked against its strongest facet; lowest ratio 4.6:1.
- The dark-surface logo loads on every dark board and the light-surface logo on every light board.
- Visible text scanned for British spellings and retired wording (Premium, live voice, timing claims): none found.
- Store images are exactly 1080 x 1920, 1206 x 2622 and 1024 x 500, RGB, no alpha.
- Not done: user testing, screen-reader testing, real-device testing, tablet layouts.

## Assumptions and open items

- `[ASSUMPTION]` Guided is shown at $14.99 a month. Studio shows `[PRICE]`.
- Billing for the app channels is unresolved; listings say only "Free, with optional paid plans".
- Terms, What to expect, Privacy and Support links are placeholders (`[URL]`).
- Six bottom destinations exceed the usual five on iOS and the three-to-five guidance in Material 3. Keep six, or move Profile to the header avatar.
- "About a minute" and "recheck in 4 weeks" are carried over from v2.0 and need a source before launch.
- Data safety and App Privacy rows on the listing boards are prompts for counsel, not answers.
- Product names, shades, prices and the sample user are illustrative.

## Logo rules applied

Light-surface file on light grounds, dark-surface file on dark grounds; solid ground only, never on the pattern; never recolored, stretched or cropped. App icons are the supplied files, reused unchanged.

Provider of record on public footers: MGT Solutions, Inc d/b/a Team47Studio.
