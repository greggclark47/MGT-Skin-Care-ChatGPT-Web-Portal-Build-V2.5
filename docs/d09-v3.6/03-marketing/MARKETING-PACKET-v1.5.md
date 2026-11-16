# Team 47 Studio — Marketing Packet

**Version 1.5 · 2026-11-15 · For anyone producing Team 47 Studio material: web, social, email, partner decks** · v1.1: utility row colours (§5.2) · v1.2: utility row moves to the lighter Aura palette (§5.2) · v1.3: Prism Weave seamless pattern (§5.4, `patterns/`), accessibility figures refreshed (§9) · v1.4: plans and prices (§3.1), Prism Weave on the landing hero · v1.5: trial line in §3.1; build reference is v4.1

> **Status: PRELIMINARY — pending full release.** Prepared for review ahead of any execution. Decisions, routes, wording and figures are subject to change before work begins; nothing here is final until the owner releases it.

Everything here is taken from the D09 v4.1 build. Colour values come from `tokens/d09-tokens-v3.6.json`; nothing in this document was typed separately from it.

**In this folder**

| Path | Contents |
|---|---|
| `tokens/d09-tokens-v3.6.json` | The canonical token file — colour, type, segments, motion |
| `tokens/d09-tokens-v3.6.css` | The same, as CSS custom properties, generated from the JSON |
| `patterns/` | **Prism Weave**, the seamless gradient pattern: CSS, SVG, PNG tiles, two hero samples, the builder script and its spec (§5.4) |
| `social/` | Six "Your shade, matched." creatives, rendered at export size |
| `logo-dark-surface.png` · `logo-light-surface.png` | The established logo for each ground |

---

## 1. The brand in one line

> **A studio like no other.** Based on value, results focused on you in every aspect. Simply you.

That is the company statement, and it's the test for any piece of copy: does this say something true about what the person gets, and is it about them rather than about us?

**Naming.** The brand is **Team 47 Studio** — three words in running text. The logo wordmark sets "Team" and "Studio" around the 47 mark; both words must stay legible at every size. The parent company does not appear in marketing. It appears in exactly one place, the site footer's copyright line.

---

## 2. Voice

Warm, plain, specific. We sound like someone who knows a lot and is on your side.

| We do | We don't |
|---|---|
| Say what the person gets: *"built from your own profile"* | Say what the technology is: *"AI-powered"* as a headline |
| Name the method: *"one profile behind all of it"* | Promise an outcome: *"flawless skin"* |
| Offer: *"Begin free. Grow when it suits you."* | Pressure: *"Limited time"*, *"Don't miss out"* |
| Admit limits warmly: *"not this one, and here is why"* | Hide them in fine print |
| Use "you" and "your" | Talk about "users" or "consumers" |

**One idea per line.** If a sentence needs a comma to hold two claims, it's two sentences.

---

## 3. Copy bank — approved lines

All of these are live in the v3.6 build and have been checked against the claims rules in §4.

| Line | Use |
|---|---|
| **A studio like no other.** | Company statement headline; footer |
| **Based on value, results focused on you in every aspect. Simply you.** | Company statement body |
| **Your shade, matched.** | Campaign headline — a claim about fit, not an outcome |
| **Twelve tones. Six verticals. One profile behind all of it.** | Campaign subhead |
| **Care, color, and style. Connected.** | Home hero |
| **Made to fit you, not an average.** | Home section; brand line |
| **Begin free. Grow when it suits you.** | Membership |
| **Yours to share. Yours to take back.** | Privacy |
| **Find my match** · **Find your match at team47studio.com** | Primary call to action — web and assets |
| **Guidance for looking and feeling your best — cosmetic, not medical.** | Required line — see §4.3 |

**Retired — do not use:** *"Start free"* as a button or asset CTA (removed 2026-11-15). *"Cosmetic guidance, not diagnosis or medical treatment."* (superseded by the line above).

---

### 3.1 Plans and prices (preliminary)

Owner-set 2026-11-15, pending full release. Use these figures exactly; never round, never "from". Starter is "free to keep", never "free trial" (no card is collected). Annual is always stated with its effective monthly figure.

| | Starter | Guided | Studio |
|---|---|---|---|
| Monthly | $0 | $14.99 | $29.99 |
| Annual (two months free) | $0 | $149.90 ($12.49 a month) | $299.90 ($24.99 a month) |
| Best for | Exploring: first match, first routine | Building a routine you keep | The whole studio, at full depth |
| The outcome | A profile, a season and a starter routine today | Routines that keep up with you, and visible progress | Everything coordinated, with a record you own |
| Profile and matching | Core match; colour season from swatches | Full personalized match; optional scan 2/mo `[ASSUMPTION]` | Cross-domain synthesis; optional scan 6/mo `[ASSUMPTION]` |
| Routines and progress | Starter routine with reasons; current only | Refreshed every two weeks; history and photo journal; replenishment | Advanced coordination; history, journal and exports |
| AI Coach | 3 answers a month `[ASSUMPTION]` | 60 answers a month `[ASSUMPTION]` | Unlimited within fair use, highest depth |
| Voice | Narrated routines | Live narration allowance | Realtime conversation, session-capped |
| Colour, style and shop | Core discovery, six verticals; browse wardrobe | Colour carried into makeup, hair, wardrobe; Shop My Routine cart | As Guided, plus priority agent runs and guest access |
| Membership | Sponsor-supported, labelled; standard support | Ad-free; enhanced support | Ad-free; priority support and early features |
| Billing and changes | Never billed; no card, no clock | Upgrade immediate with proration; downgrade at period end (Terms 8.6) | Same terms as Guided |

Safety checks (shade range, ingredients, hair lift) and "shows its work" are on for every plan. Allowances marked `[ASSUMPTION]` are to be set from routing logs before release; the entitlement system reads them, the copy does not invent them.

Approved plan lines: "Begin free. Grow when it suits you." · "Starter is free to keep — no card, no clock." · "Two months free on annual." · "Guided, $14.99 a month." · "Studio, $29.99 a month." · "14 days of Guided, $0 today." (trial ads must state the price after the trial and that it renews; never "free" without "14 days")

---

## 4. Claims rules

These aren't style preferences. A cosmetic product described as changing the structure or function of skin can be regulated as a drug on the strength of the marketing claim alone, so the line between *fit* and *outcome* is the line that matters.

### 4.1 What we can say

- **Fit** — *"Your shade, matched."* It describes the match, not a change to anyone's skin.
- **Method** — *"Built from your profile, not an average."*
- **Coverage** — *"Twelve tones."* — the swatch ladder runs to genuinely deep tones, and that's a fact we can show.

### 4.2 What we never say

- Anything that describes a change to the body: *clears*, *repairs*, *reduces wrinkles*, *heals*, *treats*, *anti-acne*.
- Before-and-after skin imagery, real or illustrated. It implies an outcome the product doesn't measure.
- **"Accurate," "precise," or "scientifically matched."** The colour-season thresholds have not yet been calibrated against real measured complexions — that is a funded pre-launch gate. Until it clears, we describe the method, not its accuracy.
- **"About a minute"** or any timing claim without a source. The home page currently carries this with a `[SOURCE NEEDED]` marker; it does not go into marketing until it's measured.
- Treatment products or in-person treatment services. That track is gated — see the partnerships packet §4.
- Any real brand name in demo or mock material. Invented names only.

### 4.3 The required line

Every landing page carries it once, in the footer:

> **Guidance for looking and feeling your best — cosmetic, not medical.**
> Built from your own profile and shown with the reasoning behind it, so progress is something you can see. Guidance describes how skin, color and style look and feel. Results differ from person to person, and no particular outcome is promised.
> © 2026 Team 47 Studio — MGT Solutions, Inc.

Every exported asset carries the short form at the foot of the image:

> Guidance for looking and feeling your best — cosmetic, not medical. Results differ from person to person.

---

## 5. The gradient system

Each of the six verticals owns a three-stop ramp at its own angle. Every stop is drawn from the logo's prism or from the dark-ground palette; no new hue was introduced.

| Segment | Angle | Ramp | Button ramp (white label) | Lowest stop vs white |
|---|---|---|---|---|
| Skin | 135° | `#19AFBE` → `#1E88F8` → `#200068` | `#1B709F` → `#1E6DDB` → `#200068` | 4.92:1 |
| Makeup | 108° | `#C844C8` → `#F27A6B` → `#F0AE47` | `#A636B5` → `#A64E6A` → `#8A5957` | 5.36:1 |
| Hair | 162° | `#6BBF3B` → `#19AFBE` → `#1E88F8` | `#507A4B` → `#1B709F` → `#1E6DDB` | 4.92:1 |
| Color | 94° | `#F0AE47` → `#F08A3C` → `#C844C8` | `#8A5957` → `#A5584C` → `#A636B5` | 5.12:1 |
| Style | 146° | `#9040F8` → `#C844C8` → `#200068` | `#9040F8` → `#A636B5` → `#200068` | 4.91:1 |
| Wardrobe | 120° | `#1E88F8` → `#9040F8` → `#C844C8` | `#1E6DDB` → `#9040F8` → `#A636B5` | 4.91:1 |

**Source palettes.** Prism (from the logo): `#19AFBE` `#6BBF3B` `#F0AE47` `#F08A3C` `#9040F8` `#1E88F8`. Dark-ground: `#19AFBE` `#1E88F8` `#9040F8` `#C844C8` `#F27A6B`. Logo navy: `#200068`.

### 5.1 Four rules that keep it legible

1. **White text on a gradient uses the button ramp, never the raw ramp.** Each stop is mixed 20% toward logo navy, repeatedly, until it clears 4.6:1 against white. The raw ramps are for fills, borders and display type only.
2. **Body-size text never sits in a raw ramp colour.** It uses the mode's ink — for example amber `#F0AE47` becomes `#8A5B00` on light grounds. The full ink tables are in the token file under `small_text_ink`.
3. **On dark grounds, warm stops swap to coral.** Amber and orange go to `#F27A6B`, lime to `#19AFBE`. Warm olive and amber turn to mud on navy; the swap applies whenever the ground's luminance is below 0.25.
4. **Exported assets are always drawn on the dark ground** (`#101327`) with a scrim beneath the type, whatever theme the viewer is in. A feed post is the same picture in either mode, so it's built where white type is guaranteed to clear.

### 5.2 Navigation colours

**Header**

| Button | Segment ramp | Opens |
|---|---|---|
| Skin | Skin | Skin Match |
| Color | Color | Colour & season |
| Style | Wardrobe | Style studio |
| Coach | Style | AI Coach |
| Membership | Makeup | Membership |

**Utility row** — the second row, on every web screen. Labels, order and destinations are unchanged. From v3.9 each button is a lighter pastel, in a different family from the saturated header pills above it, so the two rows read as two levels of navigation.

| Button | Light mode, resting | Light mode, current page | Label ink (light / dark) |
|---|---|---|---|
| Applications | `#C9DCFF` → `#D9CCFF` → `#F0CCF2` | `#8FB5FF` → `#B49DFF` → `#E48FDD` | `#1F1459` / `#140C3A` |
| Shop | `#FFD3D9` → `#FFC8B0` → `#FFE0A8` | `#FF9CAB` → `#FF9E78` → `#FFC76B` | `#601522` / `#3A0A13` |
| Learn | `#BDF0E0` → `#BFE7F5` → `#C9D8FF` | `#6FD9B8` → `#6FC6E8` → `#8FA9FF` | `#06363D` / `#042329` |
| Retail Partners | `#FFE3A3` → `#FFD0A0` → `#F7B9C8` | `#FFC94D` → `#FFA85C` → `#F27A9A` | `#4A2800` / `#2E1700` |

Dark mode uses brighter, slightly more saturated versions of the same four families so they stay luminous on the navy ground: Applications `#A9C7FF → #C2B1FF → #E5AEEB` resting and `#7FA8FF → #A28BFF → #D777D0` current; Shop `#FFB3BD → #FFB08F → #FFD487` and `#FF8DA0 → #FF8F66 → #FFBE55`; Learn `#8FE3CB → #8FD6EE → #A6BEFF` and `#5ED3AE → #5EBBE3 → #7F9CFF`; Retail Partners `#FFD36E → #FFB877 → #F59BB5` and `#FFC23A → #FF9E4D → #EE6D92`. The full values, with borders and glow, are in `handoff.spec.json` under `demo.utility_row`.

The label is always a deep ink drawn from the same family, never white, because white does not clear 4.5:1 on a pastel. The worst ink-on-stop pair across all four buttons in both modes and both states is 5.03:1. Hover slides the gradient. The button for the section you are on takes the deeper pastel and a 2px ink ring, set from the page's address and announced to screen readers as the current page. Reduced-motion settings turn the slide off. Adjacent buttons never share a family, in either row.

**Why the pastels do not follow §5.1 rule 1.** Rule 1 darkens a ramp until white text clears on it. The utility row goes the other way: light fills with dark ink. The two rows therefore need different rules, and the lighter row is what keeps it visibly secondary to the header.

### 5.3 Surfaces

| Token | Dark | Light |
|---|---|---|
| Background | `#0B0D1A` | `#FFFFFF` |
| Raised | `#101327` | `#F4F6FB` |
| Surface | `#171B33` | `#FFFFFF` |
| Panel | `#1B1740` | `#EEEAFE` |
| Text | `#F3F4FA` | `#15172D` |
| Secondary text | `#B9BFD3` | `#4E5872` |
| Line | `#2A2F4D` | `#DFE4EE` |
| Accent | `#9A80FF` | `#6540D4` |
| Second accent | `#F0AE47` | `#9A5B00` |

Cards 26px radius, buttons fully rounded, 1px borders, no drop shadows.

### 5.4 Pattern: Prism Weave

One seamless background that mixes all six vertical ramps, for hero bands, email headers, deck backgrounds, empty states and print. It is built only from colours already in this packet: the raw ramps and the §5.1 dark-ground swap for Night, and the §5.2 Aura families for Day.

**Construction.** A hexagonal lattice of six soft orbs on a 1080 × 624 tile, 360px apart, with alternate rows offset by half a spacing. Each orb belongs to one vertical and runs that vertical's own three-stop ramp, with its hot spot shifted toward the start of the vertical's angle, so the tile keeps the same directional feel as the segment ramps. The falloff uses nine eased stops, so there are no visible rings. Orbs that cross a tile edge are drawn again on the far side, which makes the tile repeat exactly. Checked two ways: in the reference render the step across the tile edge equals the next step inward (0.42 against 0.42 on Night, 0.20 against 0.20 on Day, horizontally); in the exported 8-bit PNGs the edge-to-edge step averages 0.94 to 1.00 of 255 against 0.80 to 0.85 for ordinary neighbouring pixels, which is under one colour level either way.

**Which vertical sits where.** Look-alike verticals are kept apart. Skin and Hair (both teal to blue), Makeup and Color (both warm) and Style and Wardrobe (both violet) sit on lattice points that never touch. Every pair that does touch looks different in both modes (12 touching pairs checked; the weakest pair is separated by roughly a 55° hue gap, measured in OKLab relative to chroma). Placement: Skin, Makeup, Style across the top row; Wardrobe, Hair, Color across the lower row.

**Two twins, one structure.**

| | Night | Day |
|---|---|---|
| Ground | `#101327` | `#FFFFFF` |
| Colour | Raw ramps with the §5.1 rule 3 swap (amber and orange to coral, lime to teal) | Wardrobe, Makeup, Hair, Color use the Applications, Shop, Learn, Retail Partners Aura ramps. Skin and Style use their own ramps tinted to the same lightness and chroma |
| Orb core | Raw ramp at peak | Aura current-page ramp at the hot spot, easing to the resting ramp by 55% of the radius |
| Overlap | Screen (overlaps glow) | Multiply (overlaps deepen) |
| Peak opacity | 0.88 | 0.95 |

**Two strengths.**

| Strength | Use | Night | Day |
|---|---|---|---|
| **Full** | Decoration only, or with a scrim under the type (§5.1 rule 4) | Opacity ×1.0. Not for type without a scrim (worst primary-text contrast 2.78:1) | Opacity ×1.0. Primary text clears (8.92:1) but secondary text does not (3.59:1), so copy still uses Quiet |
| **Quiet** | Anywhere text sits directly on the pattern | Opacity ×0.44. Primary text ≥ 7.88:1, secondary ≥ 4.72:1 | Opacity ×0.64. Primary text ≥ 11.56:1, secondary ≥ 4.65:1 |

Quiet strength is solved, not eyeballed: the opacity multiplier is the highest value at which the mode's primary text (`#F3F4FA` or `#15172D`) holds 4.6:1 and its secondary text (`#B9BFD3` or `#4E5872`) holds 4.65:1 at the worst pixel anywhere on the tile, so text can be placed without checking where it lands. The 4.65 target is 0.15 above AA to leave room for rendering differences.

**Rules of use.**

1. Type on the pattern follows the ordinary rules. White-on-gradient buttons use the button ramp (§5.1 rule 1), body text uses the mode's ink (rule 2), and headline emphasis words use the gradient with the mode's stops. The sample heroes use the lighter stops `#5FD8E4 → #8AC4FF → #B49BFF → #EE9CEE` on Night so the headline holds contrast, and the small-text inks `#0B6F79 → #0F5FBF → #6A2BD0 → #9A2E9A` on Day.
2. Exported assets (§8) use Night, drawn on `#101327`, with a scrim under the type and the required line (§4.3) on a solid foot band, whatever theme the viewer is in.
3. The pattern is never the carrier of a claim and never sits behind the required line without the foot band or Quiet strength.
4. No before-and-after imagery, no faces and no product shots inside the pattern. It is colour only.
5. Scale only in whole multiples of the tile (1×, 2×) for raster use. CSS and SVG scale freely.

**Measured on the sample heroes** (1920 × 1080, worst pixel inside each text box, pattern plus scrim rendered without the text):

| Element | Night | Day (Quiet) | Needs |
|---|---|---|---|
| Headline, large type with gradient emphasis, worst gradient stop | 5.98:1 | 3.83:1 | 3:1 |
| Sub-line | 8.28:1 | 5.34:1 | 4.5:1 |
| URL | 8.03:1 | 4.86:1 | 4.5:1 |
| Required line | 6.12:1 | 6.25:1 | 4.5:1 |

**Fidelity check.** The tile is computed twice. A numpy reference (premultiplied interpolation, as CSS gradients do) produces every contrast figure above. Chromium then renders the CSS and the SVG, and both are compared against the reference pixel by pixel: mean difference 0.5 to 0.6 of 255 per channel, worst single pixel 4. The figures in this section are therefore measured on what a browser actually draws.

**Using it on the web.**

```css
@import "patterns/prism-weave.css";
.hero        { /* Quiet where text sits on it */ }
.hero-bg     { /* decorative */ }
```

```html
<section class="t47-weave t47-weave--quiet">…</section>   <!-- text on the pattern -->
<div class="t47-weave" aria-hidden="true"></div>           <!-- decoration -->
```

The CSS follows the demo's `[data-mode="dark"]` hook and falls back to `prefers-color-scheme` when no mode is set. `prism-weave.css` exposes `--t47-weave`, `--t47-weave-quiet`, `--t47-weave-size`, `--t47-weave-ground` and `--t47-weave-blend`. Tokens for the lattice, assignment and strengths are in `prismWeave` in `02-overlay/tokens.d09.ts`.

**Open on the pattern.** Both modes were checked by measurement and by eye on the two sample heroes only. Production use on photographic or video backgrounds, and print colour (CMYK) conversion, have not been tested.

---

## 6. Type

| Role | Face | Weight | Setting |
|---|---|---|---|
| Display and headings | **Space Grotesk** | 700 | Tracking −0.022em, line height 1.06 |
| Body and interface | **DM Sans** | 400 / 500 / 700 | Normal tracking |

Both are open-source under the SIL Open Font License, free for commercial use. The v3.6 demo embeds them directly so they render on any network.

**Space Grotesk has no true italic.** Browsers fake one by slanting the upright, which looks weak at display sizes. For emphasis in a headline, use a gradient on the words rather than italic — as *"Connected."* does on the home page.

---

## 7. Motion

| | Enter | Leave |
|---|---|---|
| Transform | Scale 0.945 and back 140px | Scale 1.045 and forward 90px |
| Blur | 16px to 0 | 0 to 10px |
| Duration | 620ms | 340ms |
| Easing | `cubic-bezier(.16,.86,.3,1)` | same |

Screens arrive from behind and settle forward; elements stagger 42ms apart. All of it switches off under the system's reduced-motion setting — that's required, not optional.

---

## 8. Social formats

All six are rendered from the build's own creative, with the logo on its dark-surface lockup.

| File | Size | Placement |
|---|---|---|
| `T47-your-shade-post-1080x1350.png` | 1080 × 1350 | Instagram and Facebook feed |
| `T47-your-shade-story-1080x1920.png` | 1080 × 1920 | Stories, Reels, TikTok |
| `T47-your-shade-sq-1080x1080.png` | 1080 × 1080 | Instagram, LinkedIn |
| `T47-your-shade-wide-1200x628.png` | 1200 × 628 | LinkedIn, X, link previews |
| `T47-your-shade-mail-1200x400.png` | 1200 × 400 | Campaign email header |
| `T47-your-shade-thumb-1280x720.png` | 1280 × 720 | YouTube cover, site hero |

Placement sizes are the platforms' commonly used dimensions as of this packet; check each platform's current spec before a paid run.

**Pattern assets** (`patterns/`, §5.4)

| File | Size | Use |
|---|---|---|
| `prism-weave.css` | 1080 × 624 tile, repeating | Web backgrounds. Follows `[data-mode="dark"]` |
| `prism-weave-night.svg` · `prism-weave-day.svg` | 1080 × 624 tile | Vector use, decks, print workflows |
| `prism-weave-night-tile-1080x624.png` · `prism-weave-day-tile-1080x624.png` | 1080 × 624 | Raster tile at 1×; repeat in whole multiples |
| `prism-weave-hero-night-1920x1080.png` · `prism-weave-hero-day-1920x1080.png` | 1920 × 1080 | Sample hero compositions that show the type rules in place |
| `prism-weave.json` | | Lattice, assignment, stops, strengths and every measured figure |
| `build-prism-weave.py` | | Regenerates all of the above from `tokens/d09-tokens-v3.6.json` (`--fonts-from <demo html>` also renders the heroes) |

---

## 9. Accessibility

Every text run in the build is checked against WCAG AA in both modes. The v3.9 sweep measured 8,250 runs across 71 screens and found one failure, a social-card caption at 3.11:1; it now sits on a dark scrim. The v4.0 sweep (8,446 runs, plans and pricing screens included) is clean. The Prism Weave figures in §5.4 are measured separately, on rendered pixels.

---

## 10. Open before a paid campaign

- **Calibration gate** — colour-season thresholds measured against a diverse real sample. Until then, no accuracy claims (§4.2).
- **Timing claim** — "About a minute" needs a measured median or comes out.
- **Counsel** — the Privacy and Terms pages are under review. Campaigns can run before that closes, but they shouldn't link to legal pages that say DRAFT.
