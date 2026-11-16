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

/** Utility row (Applications, Shop, Learn, Retail Partners), v3.9 'Aura'. Light pastel gradients, dark family ink.
 *  Worst ink-on-stop contrast across all states and modes: 5.03:1. Labels and routes are unchanged. */
export const utilityAura = {
  apps: { label: "Applications", route: "/applications",
    light: {"rest": ["#C9DCFF", "#D9CCFF", "#F0CCF2"], "act": ["#8FB5FF", "#B49DFF", "#E48FDD"], "ink": "#1F1459", "bd": "#9DB1F2", "sh": "#6540D4"},
    dark: {"rest": ["#A9C7FF", "#C2B1FF", "#E5AEEB"], "act": ["#7FA8FF", "#A28BFF", "#D777D0"], "ink": "#140C3A", "bd": "#C6D2FF", "sh": "#9A80FF"} },
  shop: { label: "Shop", route: "/shop",
    light: {"rest": ["#FFD3D9", "#FFC8B0", "#FFE0A8"], "act": ["#FF9CAB", "#FF9E78", "#FFC76B"], "ink": "#601522", "bd": "#F2A9B2", "sh": "#C8442F"},
    dark: {"rest": ["#FFB3BD", "#FFB08F", "#FFD487"], "act": ["#FF8DA0", "#FF8F66", "#FFBE55"], "ink": "#3A0A13", "bd": "#FFC9CF", "sh": "#F27A6B"} },
  learn: { label: "Learn", route: "/learn",
    light: {"rest": ["#BDF0E0", "#BFE7F5", "#C9D8FF"], "act": ["#6FD9B8", "#6FC6E8", "#8FA9FF"], "ink": "#06363D", "bd": "#8FD3C3", "sh": "#0B6F79"},
    dark: {"rest": ["#8FE3CB", "#8FD6EE", "#A6BEFF"], "act": ["#5ED3AE", "#5EBBE3", "#7F9CFF"], "ink": "#042329", "bd": "#B5F0E0", "sh": "#19AFBE"} },
  partners: { label: "Retail Partners", route: "/retail-partners",
    light: {"rest": ["#FFE3A3", "#FFD0A0", "#F7B9C8"], "act": ["#FFC94D", "#FFA85C", "#F27A9A"], "ink": "#4A2800", "bd": "#EDBE72", "sh": "#B8620A"},
    dark: {"rest": ["#FFD36E", "#FFB877", "#F59BB5"], "act": ["#FFC23A", "#FF9E4D", "#EE6D92"], "ink": "#2E1700", "bd": "#FFE2A0", "sh": "#F0AE47"} },
} as const;

/** Prism Weave, v1.3 marketing packet 5.4. Seamless hexagonal-lattice gradient pattern mixing the six vertical ramps.
 *  Generated from 03-marketing/patterns/prism-weave.json; do not edit by hand. Status: PRELIMINARY - pending full release.
 *  'full' is decoration or under a scrim; 'quiet' is the multiplier at which text may sit directly on the pattern
 *  (primary text >= 4.6:1, secondary >= 4.65:1 at the worst pixel of the tile). */
export const prismWeave = {
  "tile": {
    "width": 1080,
    "height": 624,
    "radius": 260,
    "hotSpotOffset": 0.26,
    "stopPositions": [
      0.0,
      0.125,
      0.25,
      0.375,
      0.5,
      0.625,
      0.75,
      0.875,
      1.0
    ],
    "rampSpread": 0.8
  },
  "ground": {
    "day": "#FFFFFF",
    "night": "#101327"
  },
  "peakOpacity": {
    "night": 0.88,
    "day": 0.95
  },
  "blend": {
    "day": "multiply",
    "night": "screen"
  },
  "assignment": [
    {
      "point": [
        180,
        156
      ],
      "vertical": "skin",
      "angle": 135,
      "night": [
        "#19AFBE",
        "#1E88F8",
        "#200068"
      ],
      "day": [
        "#BEE4E9",
        "#C3DEFF",
        "#D7D9F6"
      ],
      "dayCore": [
        "#7CC9D3",
        "#8ABEFF",
        "#B5B8D6"
      ]
    },
    {
      "point": [
        540,
        156
      ],
      "vertical": "makeup",
      "angle": 108,
      "night": [
        "#C844C8",
        "#F27A6B",
        "#F27A6B"
      ],
      "day": [
        "#FFD3D9",
        "#FFC8B0",
        "#FFE0A8"
      ],
      "dayCore": [
        "#FF9CAB",
        "#FF9E78",
        "#FFC76B"
      ]
    },
    {
      "point": [
        900,
        156
      ],
      "vertical": "style",
      "angle": 146,
      "night": [
        "#9040F8",
        "#C844C8",
        "#200068"
      ],
      "day": [
        "#E0D3FF",
        "#F3CEF1",
        "#D7D9F6"
      ],
      "dayCore": [
        "#C4A9FF",
        "#E59EE3",
        "#B5B8D6"
      ]
    },
    {
      "point": [
        360,
        468
      ],
      "vertical": "wardrobe",
      "angle": 120,
      "night": [
        "#1E88F8",
        "#9040F8",
        "#C844C8"
      ],
      "day": [
        "#C9DCFF",
        "#D9CCFF",
        "#F0CCF2"
      ],
      "dayCore": [
        "#8FB5FF",
        "#B49DFF",
        "#E48FDD"
      ]
    },
    {
      "point": [
        720,
        468
      ],
      "vertical": "hair",
      "angle": 162,
      "night": [
        "#19AFBE",
        "#19AFBE",
        "#1E88F8"
      ],
      "day": [
        "#BDF0E0",
        "#BFE7F5",
        "#C9D8FF"
      ],
      "dayCore": [
        "#6FD9B8",
        "#6FC6E8",
        "#8FA9FF"
      ]
    },
    {
      "point": [
        0,
        468
      ],
      "vertical": "color",
      "angle": 94,
      "night": [
        "#F27A6B",
        "#F27A6B",
        "#C844C8"
      ],
      "day": [
        "#FFE3A3",
        "#FFD0A0",
        "#F7B9C8"
      ],
      "dayCore": [
        "#FFC94D",
        "#FFA85C",
        "#F27A9A"
      ]
    }
  ],
  "neverTouch": [
    [
      "skin",
      "hair"
    ],
    [
      "makeup",
      "color"
    ],
    [
      "style",
      "wardrobe"
    ]
  ],
  "strength": {
    "night": {
      "full": {
        "x": 1.0,
        "primaryContrast": 2.78,
        "secondaryContrast": 1.67
      },
      "quiet": {
        "x": 0.44,
        "primaryContrast": 7.88,
        "secondaryContrast": 4.72
      }
    },
    "day": {
      "full": {
        "x": 1.0,
        "primaryContrast": 8.92,
        "secondaryContrast": 3.59
      },
      "quiet": {
        "x": 0.64,
        "primaryContrast": 11.56,
        "secondaryContrast": 4.65
      }
    }
  }
} as const;
