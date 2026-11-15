# Team 47 Studio — Marketing Packet

**Version 1.2 · 2026-11-15 · For anyone producing Team 47 Studio material: web, social, email, partner decks** · v1.1: utility row colours (§5.2) · v1.2: utility row moves to the lighter Aura palette (§5.2); build reference is v3.9

> **Status: PRELIMINARY — pending full release.** Prepared for review ahead of any execution. Decisions, routes, wording and figures are subject to change before work begins; nothing here is final until the owner releases it.

Everything here is taken from the D09 v3.9 build. Colour values come from `tokens/d09-tokens-v3.6.json`; nothing in this document was typed separately from it.

**In this folder**

| Path | Contents |
|---|---|
| `tokens/d09-tokens-v3.6.json` | The canonical token file — colour, type, segments, motion |
| `tokens/d09-tokens-v3.6.css` | The same, as CSS custom properties, generated from the JSON |
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

---

## 9. Accessibility

Every text run in the build is checked against WCAG AA in both modes. The last full sweep measured 6,528 runs across 69 screens. The only open flag is an 11px line on the social-kit screen, which the automated method mis-reads; measured against rendered pixels it's 15.67:1.

---

## 10. Open before a paid campaign

- **Calibration gate** — colour-season thresholds measured against a diverse real sample. Until then, no accuracy claims (§4.2).
- **Timing claim** — "About a minute" needs a measured median or comes out.
- **Counsel** — the Privacy and Terms pages are under review. Campaigns can run before that closes, but they shouldn't link to legal pages that say DRAFT.
