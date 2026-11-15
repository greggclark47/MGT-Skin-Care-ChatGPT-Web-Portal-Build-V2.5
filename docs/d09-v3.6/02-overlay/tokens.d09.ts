// D09 v3.6 — proposed replacement for packages/shared/src/tokens.ts (same export shape).
// Supersedes locked decision C10 (accent #7C3AED) ONLY IF approved — see overlay packet O-6.
export const color = {
  accent: '#6540D4', accentHover: '#5531BF', accentSubtle: '#EEEAFE', accentBorder: '#D9D0FB',
  text: '#15172D', textMuted: '#4E5872', textFaint: '#8E96B0', bg: '#FFFFFF', bgSubtle: '#F4F6FB', border: '#DFE4EE',
  // semantic roles unchanged from the existing file — caution stays amber, not red
  success: '#059669', caution: '#D97706', cautionSubtle: '#FFFBEB', danger: '#DC2626',
} as const;

export const colorDark = {
  "bg": "#0B0D1A",
  "bg2": "#101327",
  "surf": "#171B33",
  "panel": "#1B1740",
  "text": "#F3F4FA",
  "sub": "#B9BFD3",
  "mute": "#8E96B0",
  "line": "#2A2F4D",
  "acc": "#9A80FF",
  "acc2": "#F0AE47"
} as const;

export const segment = {
  "skin": {
    "angle": 135,
    "stops": [
      "#19AFBE",
      "#1E88F8",
      "#200068"
    ],
    "buttonStops": [
      "#1B709F",
      "#1E6DDB",
      "#200068"
    ]
  },
  "makeup": {
    "angle": 108,
    "stops": [
      "#C844C8",
      "#F27A6B",
      "#F0AE47"
    ],
    "buttonStops": [
      "#A636B5",
      "#A64E6A",
      "#8A5957"
    ]
  },
  "hair": {
    "angle": 162,
    "stops": [
      "#6BBF3B",
      "#19AFBE",
      "#1E88F8"
    ],
    "buttonStops": [
      "#507A4B",
      "#1B709F",
      "#1E6DDB"
    ]
  },
  "color": {
    "angle": 94,
    "stops": [
      "#F0AE47",
      "#F08A3C",
      "#C844C8"
    ],
    "buttonStops": [
      "#8A5957",
      "#A5584C",
      "#A636B5"
    ]
  },
  "style": {
    "angle": 146,
    "stops": [
      "#9040F8",
      "#C844C8",
      "#200068"
    ],
    "buttonStops": [
      "#9040F8",
      "#A636B5",
      "#200068"
    ]
  },
  "wardrobe": {
    "angle": 120,
    "stops": [
      "#1E88F8",
      "#9040F8",
      "#C844C8"
    ],
    "buttonStops": [
      "#1E6DDB",
      "#9040F8",
      "#A636B5"
    ]
  }
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 6, md: 10, lg: 16, card: 26, pill: 999 } as const;
export const font = {
  display: "'Space Grotesk', 'DM Sans', sans-serif",
  family: "'DM Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  size: { xs: 12, sm: 14, md: 16, lg: 20, xl: 28, xxl: 36 },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
} as const;

export const TAP_TARGET_MIN = 44;
