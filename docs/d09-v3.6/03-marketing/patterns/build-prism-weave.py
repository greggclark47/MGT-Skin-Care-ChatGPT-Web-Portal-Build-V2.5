#!/usr/bin/env python3
"""Prism Weave builder - Team 47 Studio, D09.

Reads ../tokens/d09-tokens-v3.6.json and the Aura palette, chooses which vertical
sits where on a hexagonal lattice, then writes the tile (SVG + CSS), the machine-readable
spec, raster tiles and two hero samples.

Usage:  python3 build-prism-weave.py [--fonts-from PATH_TO_DEMO_HTML] [--no-render]

--no-render  skips every Chromium step (CSS/SVG cross-check, PNG tiles, heroes).
--fonts-from the demo HTML that embeds Space Grotesk and DM Sans; only the hero samples need it.
Needs numpy. Rendering also needs playwright with Chromium.
"""
import base64, json, math, itertools, pathlib, re, sys

import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
TOK = json.load(open(HERE.parent / "tokens" / "d09-tokens-v3.6.json", encoding="utf8"))

# ---- geometry: a hexagonal lattice, six points per tile ---------------------------------
W, H = 1080, 624          # tile size in px
SPACING = 360             # distance between neighbouring orbs
RADIUS = 260              # gradient radius
OFFSET = 0.26             # hot-spot shift, as a fraction of RADIUS, toward the start of the vertical's angle
POINTS = [(180, 156), (540, 156), (900, 156), (360, 468), (720, 468), (0, 468)]   # draw order bottom -> top
STOPS_POS = [i / 8 for i in range(9)]          # nine stops per orb keep the falloff smooth (no visible rings)
RAMP_END = 0.80                                  # the vertical's three-stop ramp is spread over the first 80% of the radius
ALPHA = {"night": 0.88, "day": 0.95}             # peak opacity at the hot spot; falls to 0 along a smoothstep curve
GROUND = {"day": "#FFFFFF", "night": "#101327"}
BLEND = {"day": "multiply", "night": "screen"}   # overlaps deepen on Day and glow on Night; neither can go muddy
TEXT = {"day": {"text": "#15172D", "sub": "#4E5872"}, "night": {"text": "#F3F4FA", "sub": "#B9BFD3"}}
MIN_TEXT, MIN_SUB = 4.6, 4.65          # primary text 4.6 (packet rule 1); secondary text needs 4.5, solved to 4.65 for rendering headroom
AURA_REST = {   # utility-row resting stops, light mode (marketing packet 5.2)
    "wardrobe": ("Applications", ["#C9DCFF", "#D9CCFF", "#F0CCF2"]),
    "makeup": ("Shop", ["#FFD3D9", "#FFC8B0", "#FFE0A8"]),
    "hair": ("Learn", ["#BDF0E0", "#BFE7F5", "#C9D8FF"]),
    "color": ("Retail Partners", ["#FFE3A3", "#FFD0A0", "#F7B9C8"]),
}
AURA_ACT = {    # the same four families on the current-page state, light mode
    "wardrobe": ["#8FB5FF", "#B49DFF", "#E48FDD"],
    "makeup": ["#FF9CAB", "#FF9E78", "#FFC76B"],
    "hair": ["#6FD9B8", "#6FC6E8", "#8FA9FF"],
    "color": ["#FFC94D", "#FFA85C", "#F27A9A"],
}
CORE_FADE = 0.55        # Day orbs run from the Aura "current page" ramp at the hot spot to the resting ramp by 55% of the radius

# ---- colour helpers ----------------------------------------------------------------------
def hex2rgb(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def rgb2hex(c): return "#%02X%02X%02X" % tuple(int(round(max(0, min(255, v)))) for v in c)
def lin(v): v /= 255.0; return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
def unlin(v): return 255 * (12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055)

def to_oklab(c):
    r, g, b = (lin(x) for x in c)
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = (x ** (1 / 3) for x in (l, m, s))
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)

def from_oklab(L, a, b):
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return tuple(unlin(max(0.0, min(1.0, x))) for x in (r, g, bl))

def lum(c): return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
def ratio(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

# ---- the ramps ---------------------------------------------------------------------------
SEG = {s["segment"]: s for s in TOK["segments"]}
SWAP = TOK["dark_ground_rule"]["swap"]
ORDER = ["skin", "makeup", "hair", "color", "style", "wardrobe"]

def night_stops(seg):
    """Raw ramp with the dark-ground swap (packet 5.1 rule 3): amber/orange -> coral, lime -> teal."""
    return [SWAP.get(h, h) for h in SEG[seg]["stops"]]

def _targets(table):
    labs = [to_oklab(hex2rgb(h)) for st in table for h in (st[1] if isinstance(st, tuple) else st)]
    return sum(c[0] for c in labs) / len(labs), sum(math.hypot(c[1], c[2]) for c in labs) / len(labs)

L_TARGET, C_TARGET = _targets(AURA_REST.values())
LA_TARGET, CA_TARGET = _targets(AURA_ACT.values())

def pastel(h, L_t, C_t):
    L0, a, b = to_oklab(hex2rgb(h))
    C0, hue = math.hypot(a, b), math.atan2(b, a)
    t = max(0.0, (L_t - L0) / (1 - L0))
    C = min(max(C0 * (1 - t), 0.040), C_t * 1.3)
    return rgb2hex(from_oklab(L_t, C * math.cos(hue), C * math.sin(hue)))

def day_stops(seg, kind="rest"):
    """Day twin of a vertical. Where the vertical has an Aura family (utility row) use it as is; for the two that
    do not (skin, style) apply the same tint, at the Aura family's own lightness and chroma, to the raw ramp."""
    if kind == "act":
        if seg in AURA_ACT: return list(AURA_ACT[seg])
        return [pastel(h, LA_TARGET, CA_TARGET) for h in SEG[seg]["stops"]]
    if seg in AURA_REST: return list(AURA_REST[seg][1])
    return [pastel(h, L_TARGET, C_TARGET) for h in SEG[seg]["stops"]]

def body(stops):
    labs = [to_oklab(hex2rgb(h)) for h in stops]
    return tuple(sum(x[i] for x in labs) / len(labs) for i in range(3))

# ---- which vertical goes where -----------------------------------------------------------
def wrapped(p, q):
    best = 1e9
    for dx in (-W, 0, W):
        for dy in (-H, 0, H):
            best = min(best, math.hypot(p[0] - q[0] + dx, p[1] - q[1] + dy))
    return best

EDGE_MULT = {}
for _i in range(6):
    for _j in range(_i + 1, 6):
        _n = sum(1 for dx in (-W, 0, W) for dy in (-H, 0, H)
                 if math.hypot(POINTS[_i][0] - POINTS[_j][0] + dx, POINTS[_i][1] - POINTS[_j][1] + dy) <= SPACING * 1.01)
        if _n:
            EDGE_MULT[(_i, _j)] = _n
EDGES = sorted(EDGE_MULT)                         # touching pairs; the rest never meet
NEVER_TOUCH = [(i, j) for i in range(6) for j in range(i + 1, 6) if (i, j) not in EDGE_MULT]

def apart(assign, stops_fn, i, j):
    """How far apart two verticals look: OKLab distance between their body colours relative to their chroma,
    so pastel and saturated sets are judged alike. 1.0 is roughly a 60 degree hue gap."""
    A, B = body(stops_fn(assign[i])), body(stops_fn(assign[j]))
    return math.dist(A, B) / max(0.02, (math.hypot(A[1], A[2]) + math.hypot(B[1], B[2])) / 2)

def choose_assignment():
    """Verticals that look alike go on pairs of lattice points that never touch; everything that touches must differ.
    Maximise the worst touching pair (Night and Day), then the multiplicity-weighted mean as the tie-break."""
    best, best_key = None, None
    for perm in itertools.permutations(ORDER):
        worst = min(min(apart(perm, night_stops, i, j), apart(perm, day_stops, i, j)) for i, j in EDGES)
        mean = sum(EDGE_MULT[e] * (apart(perm, night_stops, *e) + apart(perm, day_stops, *e)) for e in EDGES) / (2 * sum(EDGE_MULT.values()))
        key = (round(worst, 4), round(mean, 4))
        if best_key is None or key > best_key:
            best, best_key = perm, key
    return best, best_key

# ---- layers ------------------------------------------------------------------------------
def mix_hex(a, b, f):
    A, B = to_oklab(hex2rgb(a)), to_oklab(hex2rgb(b))
    return rgb2hex(from_oklab(*[A[i] + (B[i] - A[i]) * f for i in range(3)]))

def smoothstep(t): t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)

def ramp_at(cols, pos):
    """Colour of a three-stop ramp at a position along the radius, mixed in OKLab."""
    u = min(pos / RAMP_END, 1.0) * 2
    a, b, f = (cols[0], cols[1], u) if u <= 1 else (cols[1], cols[2], u - 1)
    A, B = to_oklab(hex2rgb(a)), to_oklab(hex2rgb(b))
    return rgb2hex(from_oklab(*[A[i] + (B[i] - A[i]) * f for i in range(3)]))


def orb_layers(assign, mode):
    """Returns draw-order list of dicts: cx, cy (hot spot, including wrapped copies), colours."""
    layers = []
    alphas = ALPHA[mode]
    for k, (px, py) in enumerate(POINTS):
        seg = assign[k]
        theta = math.radians(SEG[seg]["angle"])
        ox, oy = -math.sin(theta) * OFFSET * RADIUS, math.cos(theta) * OFFSET * RADIUS
        cols = night_stops(seg) if mode == "night" else day_stops(seg)
        if mode == "day":
            act = day_stops(seg, "act")
            stops = [(pos, mix_hex(ramp_at(act, pos), ramp_at(cols, pos), smoothstep(pos / CORE_FADE)), alphas * (1 - smoothstep(pos))) for pos in STOPS_POS]
        else:
            stops = [(pos, ramp_at(cols, pos), alphas * (1 - smoothstep(pos))) for pos in STOPS_POS]
        for dx in (-W, 0, W):
            for dy in (-H, 0, H):
                cx, cy = px + ox + dx, py + oy + dy
                nx, ny = min(max(cx, 0), W), min(max(cy, 0), H)
                if math.hypot(cx - nx, cy - ny) < RADIUS:      # reaches into the tile
                    layers.append({"orb": k, "seg": seg, "cx": cx, "cy": cy, "stops": stops})
    return layers

def rgba(h, a): r, g, b = hex2rgb(h); return "rgba(%d,%d,%d,%s)" % (r, g, b, ("%.3f" % a).rstrip("0").rstrip("."))

def css_layers(layers, strength=1.0):
    out = []
    for L in reversed(layers):    # CSS paints the first layer on top
        stops = ", ".join("%s %.1f%%" % (rgba(c, a * strength), p * 100) for p, c, a in L["stops"])
        out.append("radial-gradient(circle %dpx at %.1fpx %.1fpx, %s)" % (RADIUS, L["cx"], L["cy"], stops))
    return ",\n    ".join(out)

def svg_tile(layers, mode, strength=1.0):
    defs, body_ = [], []
    for n, L in enumerate(layers):
        st = "".join('<stop offset="%g" stop-color="%s" stop-opacity="%.3f"/>' % (p, c, a * strength) for p, c, a in L["stops"])
        defs.append('<radialGradient id="o%d" gradientUnits="userSpaceOnUse" cx="%.1f" cy="%.1f" r="%d">%s</radialGradient>' % (n, L["cx"], L["cy"], RADIUS, st))
        body_.append('<circle cx="%.1f" cy="%.1f" r="%d" fill="url(#o%d)" style="mix-blend-mode:%s"/>' % (L["cx"], L["cy"], RADIUS, n, BLEND[mode]))
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">'
            '<title>Prism Weave - %s tile, repeats seamlessly</title><defs>%s</defs>'
            '<rect width="%d" height="%d" fill="%s"/>%s</svg>\n') % (W, H, W, H, mode, "".join(defs), W, H, GROUND[mode], "".join(body_))

# ---- numpy oracle (premultiplied interpolation, same as CSS) -----------------------------
_YY, _XX = np.mgrid[0:H, 0:W]
_XX, _YY = _XX + 0.5, _YY + 0.5

def layer_premult(L):
    """Straight colour (0-255) and alpha of one layer at strength 1, interpolating premultiplied like CSS gradients do."""
    t = np.clip(np.hypot(_XX - L["cx"], _YY - L["cy"]) / RADIUS, 0, 1)
    pm = np.zeros((H, W, 3)); al = np.zeros((H, W))
    st = L["stops"]
    for (p0, c0, a0), (p1, c1, a1) in zip(st, st[1:]):
        m = (t >= p0) & (t <= p1)
        u = ((t - p0) / (p1 - p0))[m]
        al[m] = a0 + (a1 - a0) * u
        for k in range(3):
            pm[..., k][m] = hex2rgb(c0)[k] * a0 * (1 - u) + hex2rgb(c1)[k] * a1 * u
    cs = np.where(al[..., None] > 1e-9, pm / np.maximum(al, 1e-9)[..., None], 0.0)
    return cs, al

def oracle(layers, mode, strength=1.0, cache=None):
    cache = cache if cache is not None else [layer_premult(L) for L in layers]
    img = np.ones((H, W, 3)) * np.array(hex2rgb(GROUND[mode]), float)
    for cs, al in cache:
        a = (al * strength)[..., None]
        cb, c = img / 255.0, cs / 255.0
        blended = (cb + c - cb * c) if BLEND[mode] == "screen" else (cb * c)
        img = ((1 - a) * cb + a * blended) * 255.0
    return img, cache

def lum_img(img):
    f = np.where(img / 255 <= 0.04045, img / 255 / 12.92, ((img / 255 + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f[..., 0] + 0.7152 * f[..., 1] + 0.0722 * f[..., 2]

def min_ratio(img, text_hex):
    lt = lum(hex2rgb(text_hex)); lp = lum_img(img)
    r = (np.maximum(lp, lt) + 0.05) / (np.minimum(lp, lt) + 0.05)
    return float(r.min())

def solve_quiet(layers, mode, cache):
    lo, hi = 0.02, 1.0
    def ok(s):
        img, _ = oracle(layers, mode, s, cache)
        return min_ratio(img, TEXT[mode]["text"]) >= MIN_TEXT and min_ratio(img, TEXT[mode]["sub"]) >= MIN_SUB
    if ok(hi): return 1.0
    for _ in range(14):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if ok(mid) else (lo, mid)
    return math.floor(lo * 100) / 100

# ---- main --------------------------------------------------------------------------------
def main():
    render = "--no-render" not in sys.argv
    fonts_from = None
    if "--fonts-from" in sys.argv:
        fonts_from = pathlib.Path(sys.argv[sys.argv.index("--fonts-from") + 1])

    assign, score = choose_assignment()
    print("assignment:", assign, "worst touching pair %.3f, weighted mean %.3f" % score)

    spec = {
        "name": "Prism Weave", "version": "1.0", "status": "PRELIMINARY - pending full release",
        "tile": {"width": W, "height": H, "lattice": "hexagonal, 6 orbs, 360px apart, rows offset by half a spacing",
                 "radius": RADIUS, "hot_spot_offset": OFFSET, "stop_positions": STOPS_POS, "ramp_spread": RAMP_END,
                 "alpha_profile": "peak x (1 - smoothstep(position))"},
        "ground": GROUND, "alpha": ALPHA, "blend": BLEND,
        "assignment": [], "touching_pairs": [], "modes": {},
    }
    for k, seg in enumerate(assign):
        spec["assignment"].append({"point": POINTS[k], "vertical": seg, "angle": SEG[seg]["angle"],
                                   "night": night_stops(seg), "day": day_stops(seg), "day_core": day_stops(seg, "act"),
                                   "day_source": (AURA_REST[seg][0] + " family, resting and current-page ramps") if seg in AURA_REST else "raw ramp tinted to the Aura lightness and chroma, resting and current-page"})
    spec["touching_pairs"] = [[assign[i], assign[j], EDGE_MULT[(i, j)]] for i, j in EDGES]
    spec["selection"] = {"rule": "look-alike verticals sit on lattice points that never touch; every touching pair must look different (OKLab distance between body colours relative to chroma, Night and Day together; 1.0 is about a 60 degree hue gap); maximise the worst touching pair, then the weighted mean",
                         "worst_touching_pair": score[0], "weighted_mean": score[1], "touching_pairs_checked": len(EDGES),
                         "never_touch": [[assign[i], assign[j]] for i, j in NEVER_TOUCH]}

    css_blocks, files = {}, {}
    for mode in ("night", "day"):
        layers = orb_layers(assign, mode)
        img, cache = oracle(layers, mode)
        q = solve_quiet(layers, mode, cache)
        qimg, _ = oracle(layers, mode, q, cache)
        # periodic: pixel just inside the right edge vs. the left edge should differ by about one pixel of gradient
        seam = float(np.abs(img[:, -1] - img[:, 0]).mean()), float(np.abs(img[:, 1] - img[:, 0]).mean())
        seam_v = float(np.abs(img[-1] - img[0]).mean()), float(np.abs(img[1] - img[0]).mean())
        spec["modes"][mode] = {
            "layers": len(layers),
            "full": {"strength": 1.0, "min_contrast_text": round(min_ratio(img, TEXT[mode]["text"]), 2),
                     "min_contrast_secondary": round(min_ratio(img, TEXT[mode]["sub"]), 2)},
            "quiet": {"strength": q, "min_contrast_text": round(min_ratio(qimg, TEXT[mode]["text"]), 2),
                      "min_contrast_secondary": round(min_ratio(qimg, TEXT[mode]["sub"]), 2)},
            "text_colours": TEXT[mode],
            "seam_mean_abs_diff_wrap_vs_neighbour_px": {"horizontal": [round(seam[0], 2), round(seam[1], 2)], "vertical": [round(seam_v[0], 2), round(seam_v[1], 2)]},
        }
        css_blocks[mode] = (css_layers(layers, 1.0), css_layers(layers, q))
        files[mode] = (layers, q)
        (HERE / ("prism-weave-%s.svg" % mode)).write_text(svg_tile(layers, mode), encoding="utf8")
        print(mode, "layers", len(layers), "full", spec["modes"][mode]["full"], "quiet", spec["modes"][mode]["quiet"])

    css = ("/* Prism Weave - Team 47 Studio, D09. PRELIMINARY - pending full release.\n"
           "   One 1080 x 624 tile; repeats seamlessly. Generated by build-prism-weave.py - edit the script, not this file.\n"
           "   Hook: [data-mode=\"dark\"] (the build's switch); falls back to the system setting when the attribute is absent. */\n"
           ":root {\n  --t47-weave-size: %dpx %dpx;\n  --t47-weave-ground: %s;\n  --t47-weave-blend: multiply;\n  --t47-weave:\n    %s;\n  --t47-weave-quiet:\n    %s;\n}\n"
           "[data-mode=\"dark\"] {\n  --t47-weave-ground: %s;\n  --t47-weave-blend: screen;\n  --t47-weave:\n    %s;\n  --t47-weave-quiet:\n    %s;\n}\n"
           "@media (prefers-color-scheme: dark) {\n  :root:not([data-mode]) {\n    --t47-weave-ground: %s;\n    --t47-weave-blend: screen;\n    --t47-weave:\n      %s;\n    --t47-weave-quiet:\n      %s;\n  }\n}\n"
           ".t47-weave        { background-color: var(--t47-weave-ground); background-image: var(--t47-weave); background-blend-mode: var(--t47-weave-blend); background-size: var(--t47-weave-size); background-repeat: repeat; }\n"
           ".t47-weave--quiet { background-image: var(--t47-weave-quiet); }\n"
           "/* Full strength is for areas with no text, or with a scrim under the type (packet 5.1 rule 4).\n"
           "   Quiet strength keeps primary and secondary text above 4.6:1 and 4.5:1 anywhere on the tile. */\n") % (
        W, H, GROUND["day"], css_blocks["day"][0], css_blocks["day"][1],
        GROUND["night"], css_blocks["night"][0].replace("\n    ", "\n    "), css_blocks["night"][1],
        GROUND["night"], css_blocks["night"][0].replace("\n    ", "\n      "), css_blocks["night"][1].replace("\n    ", "\n      "))
    (HERE / "prism-weave.css").write_text(css, encoding="utf8")

    if render:
        render_all(spec, assign, files, css, fonts_from)

    (HERE / "prism-weave.json").write_text(json.dumps(spec, indent=1, ensure_ascii=False) + "\n", encoding="utf8")
    print("wrote spec")

# ---- Chromium: cross-check, raster tiles, hero samples -----------------------------------
HERO = """<!doctype html><html data-mode="%(mode)s"><head><meta charset="utf-8"><style>
%(fonts)s
%(css)s
*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;overflow:hidden;font-family:'DM Sans',sans-serif;color:%(text)s;position:relative}
.bg{position:absolute;inset:0}
.scrim{position:absolute;left:96px;top:176px;width:1180px;height:700px;border-radius:26px;background:%(scrim)s;border:1px solid %(line)s}
.foot{position:absolute;left:0;right:0;bottom:0;height:132px;background:%(foot)s}
.copy{position:absolute;left:150px;top:230px;width:1080px}
.logo{height:88px;display:block;margin-bottom:52px}
h1{font:700 98px/1.06 'Space Grotesk',sans-serif;letter-spacing:-0.022em}
h1 .g{background:linear-gradient(100deg,%(g)s);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{font:500 38px/1.3 'DM Sans',sans-serif;margin-top:30px;color:%(sub)s}
.row{display:flex;align-items:center;gap:30px;margin-top:52px}
.btn{font:700 32px/1 'DM Sans',sans-serif;color:#fff;padding:26px 46px;border-radius:999px;background:linear-gradient(135deg,#1B709F,#1E6DDB,#200068)}
.url{font:500 28px 'DM Sans',sans-serif;color:%(sub)s}
.req{position:absolute;left:96px;right:96px;bottom:44px;font:400 24px/1.35 'DM Sans',sans-serif;color:%(sub)s}
.notext .copy,.notext .req{visibility:hidden}
</style></head><body class="%(cls)s"><div class="bg t47-weave %(bgq)s"></div><div class="scrim"></div><div class="foot"></div>
<div class="copy"><img class="logo" src="%(logo)s">
<h1>Care, color, and style.<br><span class="g">Connected.</span></h1>
<div class="sub">Made to fit you, not an average.</div>
<div class="row"><span class="btn">Find my match</span><span class="url">team47studio.com</span></div></div>
<div class="req">Guidance for looking and feeling your best &mdash; cosmetic, not medical. Results differ from person to person.</div>
</body></html>"""

def render_all(spec, assign, files, css, fonts_from):
    from playwright.sync_api import sync_playwright
    fonts = ""
    if fonts_from and fonts_from.exists():
        fonts = "\n".join(re.findall(r"@font-face\s*\{[^}]*\}", fonts_from.read_text(encoding="utf8")))
    with sync_playwright() as p:
        br = p.chromium.launch(); pg = br.new_page(viewport={"width": W, "height": H})
        for mode in ("night", "day"):
            layers, q = files[mode]
            img, _ = oracle(layers, mode)
            # CSS render of the tile
            pg.set_viewport_size({"width": W, "height": H})
            pg.set_content('<html data-mode="%s"><style>%s html,body{margin:0}.t{width:%dpx;height:%dpx}</style><body><div class="t t47-weave"></div></body></html>' % ("dark" if mode == "night" else "light", css, W, H))
            pg.wait_for_timeout(250)
            out = HERE / ("prism-weave-%s-tile-%dx%d.png" % (mode, W, H))
            pg.screenshot(path=str(out))
            from PIL import Image
            css_px = np.asarray(Image.open(out).convert("RGB"), float)
            d = np.abs(css_px - img)
            # SVG render of the tile
            pg.set_content('<html><style>html,body{margin:0}</style><body>%s</body></html>' % (HERE / ("prism-weave-%s.svg" % mode)).read_text(encoding="utf8"))
            pg.wait_for_timeout(250)
            tmp = HERE / ("_svg_%s.png" % mode); pg.screenshot(path=str(tmp))
            svg_px = np.asarray(Image.open(tmp).convert("RGB"), float); tmp.unlink()
            ds = np.abs(svg_px - img)
            spec["modes"][mode]["cross_check"] = {
                "css_vs_oracle_mean_abs_8bit": round(float(d.mean()), 2), "css_vs_oracle_max": int(d.max()),
                "svg_vs_oracle_mean_abs_8bit": round(float(ds.mean()), 2), "svg_vs_oracle_max": int(ds.max())}
            print(mode, "css-vs-oracle mean %.2f max %d | svg-vs-oracle mean %.2f max %d" % (d.mean(), d.max(), ds.mean(), ds.max()))
            if fonts:
                hero(pg, spec, mode, css, fonts)
        br.close()

def hero(pg, spec, mode, css, fonts):
    from PIL import Image
    night = mode == "night"
    logo = HERE.parent / ("logo-dark-surface.png" if night else "logo-light-surface.png")
    cfg = {"mode": "dark" if night else "light", "cls": "", "bgq": "" if night else "t47-weave--quiet", "fonts": fonts, "css": css, "logo": "data:image/png;base64," + base64.b64encode(logo.read_bytes()).decode(),
           "text": TEXT[mode]["text"], "sub": TEXT[mode]["sub"],
           "scrim": "rgba(16,19,39,.80)" if night else "rgba(255,255,255,.00)",
           "line": "rgba(42,47,77,.9)" if night else "transparent",
           "foot": "linear-gradient(to bottom, rgba(16,19,39,0), rgba(16,19,39,.88) 55%)" if night else "linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,.80) 55%)",
           "g": "#5FD8E4,#8AC4FF,#B49BFF,#EE9CEE" if night else "#0B6F79,#0F5FBF,#6A2BD0,#9A2E9A"}
    pg.set_viewport_size({"width": 1920, "height": 1080})
    pg.set_content(HERO % {**cfg, "cls": "notext"}); pg.wait_for_timeout(500)
    boxes = pg.evaluate("""()=>{const q=s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]};
      return {h1:q('h1'),sub:q('.sub'),url:q('.url'),req:q('.req')}}""")
    pg.screenshot(path="/tmp/_hero_notext.png")
    bg = np.asarray(Image.open("/tmp/_hero_notext.png").convert("RGB"), float)
    g = cfg["g"].split(",")
    spec.setdefault("hero_contrast", {})[mode] = {}
    for key, colours in (("h1", g), ("sub", [cfg["sub"]]), ("url", [cfg["sub"]]), ("req", [cfg["sub"]])):
        x0, y0, x1, y1 = [int(round(v)) for v in boxes[key]]
        region = bg[max(0, y0):y1, max(0, x0):x1]
        worst = min(min_ratio(region, c) for c in colours)
        spec["hero_contrast"][mode][key] = round(worst, 2)
    spec["hero_contrast"][mode]["note"] = "worst pixel inside each text box, rendered pattern + scrim without text; headline uses the worst gradient stop"
    pg.set_content(HERO % cfg); pg.wait_for_timeout(500)
    pg.screenshot(path=str(HERE / ("prism-weave-hero-%s-1920x1080.png" % mode)))
    print(mode, "hero", spec["hero_contrast"][mode])

if __name__ == "__main__":
    main()
