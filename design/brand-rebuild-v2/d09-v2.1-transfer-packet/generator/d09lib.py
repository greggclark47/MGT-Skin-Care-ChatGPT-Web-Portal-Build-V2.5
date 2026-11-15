#!/usr/bin/env python3
"""D09 Card Grid v2.1 design library: soft prism mesh, faceted nav illustrations, compact icons, contrast guard.
Colour model: every mix(a, b, p) keeps share p of a. Mesh facets keep only 7-19 % of a prism hue (soft); illustrations keep 45-90 % (bold)."""
import math, random

PRISM = ['#19AFBE', '#6BBF3B', '#F0AE47', '#F08A3C', '#9040F8', '#1E88F8']   # logo ramp: cyan, lime, amber, orange, violet, blue
RING = PRISM + [PRISM[0]]
MESH_DARK = ['#19AFBE', '#1E88F8', '#9040F8', '#C844C8', '#F27A6B', '#9040F8']   # warm olive/amber turns to mud on navy; keep dark patterns cool with a coral accent
TONE4 = ['#F7CA9F', '#D08E5E', '#976141', '#512D19']
SEASON4 = ['#A67C6B', '#C49A7B', '#8B8265', '#6F7A6A', '#9C6B60', '#B59B7E']

def h2r(h):
    h = h.lstrip('#'); return [int(h[i:i + 2], 16) for i in (0, 2, 4)]
def r2h(r):
    return '#%02X%02X%02X' % tuple(max(0, min(255, round(x))) for x in r)
def mix(a, b, p):
    A, B = h2r(a), h2r(b); return r2h([A[i] * p + B[i] * (1 - p) for i in range(3)])
def lum(h):
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    v = [x / 255 for x in h2r(h)]; return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2])
def contrast(a, b):
    a, b = lum(a), lum(b); return (max(a, b) + .05) / (min(a, b) + .05)
def ramp(u, pal=PRISM):
    n = len(pal) - 1; x = max(0.0, min(.9999, u)) * n; i = int(x); f = x - i
    return mix(pal[i + 1], pal[i], f)

# ───────────── soft prism mesh ─────────────
GUARD = []   # (label, worst contrast) log filled by pz()

def mesh(w, h, ground, cell=80, seed=1, lo=.07, hi=.19, flow=(1.0, .45), pal=PRISM, jit=.30, shade=True, rich=False, ink=None):
    """Seeded jittered triangle lattice, colours follow the prism ramp along `flow`; returns inner SVG markup."""
    rnd = random.Random(seed); rh = cell * .866
    if pal is PRISM and lum(ground) < .25: pal = MESH_DARK
    nc = int(w / cell) + 3; nr = int(h / rh) + 3
    P = {}
    for r in range(-1, nr):
        for c in range(-1, nc):
            P[(r, c)] = ((c + (.5 if r % 2 else 0)) * cell + (rnd.random() - .5) * 2 * jit * cell, r * rh + (rnd.random() - .5) * 2 * jit * rh)
    fx, fy = flow; n = math.hypot(fx, fy); fx, fy = fx / n, fy / n
    pr = [x * fx + y * fy for x, y in ((0, 0), (w, 0), (0, h), (w, h))]; p0, p1 = min(pr), max(pr)
    out = []
    def tri(a, b, c, up):
        cx = (a[0] + b[0] + c[0]) / 3; cy = (a[1] + b[1] + c[1]) / 3
        u = ((cx * fx + cy * fy) - p0) / (p1 - p0) + (rnd.random() - .5) * .10
        col = ramp(u, pal); s = lo + (hi - lo) * rnd.random()
        if shade: s *= (1.2 if up else .86)
        fill = mix(col, ground, s)
        stroke = mix(ink, fill, .34) if ink else mix(col, ground, min(.6, s * 2.3))
        out.append(f'<polygon points="{a[0]:.0f},{a[1]:.0f} {b[0]:.0f},{b[1]:.0f} {c[0]:.0f},{c[1]:.0f}" fill="{fill}" stroke="{stroke}"/>')
    for r in range(-1, nr - 1):
        for c in range(-1, nc - 1):
            if r % 2 == 0:
                tri(P[(r, c)], P[(r, c + 1)], P[(r + 1, c)], False); tri(P[(r, c + 1)], P[(r + 1, c)], P[(r + 1, c + 1)], True)
            else:
                tri(P[(r, c)], P[(r + 1, c)], P[(r + 1, c + 1)], True); tri(P[(r, c)], P[(r, c + 1)], P[(r + 1, c + 1)], False)
    return ''.join(out)

def worst_contrast(ground, hi, fgs, pal=None):
    pal = pal or (MESH_DARK if lum(ground) < .25 else PRISM)
    s = hi * 1.2   # lightest/strongest facet after shading
    return min(contrast(f, mix(c, ground, s)) for f in fgs for c in pal)

def svgmesh(w, h, ground, **kw):
    return f'<svg class="mesh" viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{mesh(w, h, ground, **kw)}</svg>'

def zone_t(t, ground, hi, target=4.6):
    """Copy of tokens with text colours nudged so they clear `target` on the strongest facet of this zone."""
    tz = dict(t); step = 3 if t['dark'] else -3
    for k in ('text', 'sub', 'mute', 'acc', 'acc2', 'kcol'):
        col = t[k]
        for _ in range(90):
            if worst_contrast(ground, hi, [col]) >= target: break
            v = [min(255, max(0, c + step)) for c in h2r(col)]; col = r2h(v)
        tz[k] = col
    return tz

def pz(t, w, h, inner, ground=None, style='', cell=80, seed=1, lo=.07, hi=.19, flow=(1.0, .45), label='', cls='', tag='div', href=None):
    """Patterned zone: relative container, soft mesh behind, content above. `inner` may be html or fn(tz) -> html;
    tz carries colours nudged to clear 4.5:1 on the strongest facet (contrast is asserted, not assumed)."""
    ground = ground or t['surf']
    tz = zone_t(t, ground, hi)
    wc = min(worst_contrast(ground, hi, [tz[k]]) for k in ('text', 'sub', 'mute', 'acc', 'acc2', 'kcol')); GUARD.append((label or f'{w}x{h}', round(wc, 2)))
    assert wc >= 4.5, (label, wc, ground)
    body = inner(tz) if callable(inner) else inner
    a = f' href="{href}"' if href else ''
    var = f'--zt:{tz["text"]};--zs:{tz["sub"]};--zm:{tz["mute"]};--za:{tz["acc"]};--zb:{tz["acc2"]};--zk:{tz["kcol"]};'
    return (f'<{tag}{a} class="pz {cls}" style="background:{ground};{var}{style}">{svgmesh(w, h, ground, cell=cell, seed=seed, lo=lo, hi=hi, flow=flow)}'
            f'<div class="pzc">{body}</div></{tag}>')

# ───────────── faceted illustrations (200 x 120 art space; shapes centred on x=92) ─────────────
def _tris_fan(pts, c):
    return [(c, pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))]

def _tris_rings(pts, c, k=.5):
    n = len(pts); q = [(c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k) for p in pts]; out = []
    for i in range(n):
        j = (i + 1) % n
        out += [(pts[i], pts[j], q[i]), (pts[j], q[j], q[i]), (c, q[i], q[j])]
    return out

DROP = [(92, 6), (106, 28), (120, 50), (130, 70), (130, 86), (122, 100), (108, 110), (92, 113), (76, 110), (62, 100), (54, 86), (54, 70), (64, 50), (78, 28)]
TEE = [(76, 12), (86, 24), (98, 24), (108, 12), (134, 22), (152, 42), (140, 56), (130, 48), (130, 106), (54, 106), (54, 48), (44, 56), (32, 42), (50, 22)]
BUBBLE = [(44, 14), (140, 14), (156, 30), (156, 64), (140, 80), (44, 80), (28, 64), (28, 30)]
TAIL = [((62, 80), (86, 80), (60, 104))]
TEE_TRIS = [((76, 12), (108, 12), (86, 24)), ((108, 12), (98, 24), (86, 24)), ((76, 12), (50, 22), (86, 24)), ((50, 22), (32, 42), (54, 48)), ((32, 42), (44, 56), (54, 48)), ((50, 22), (54, 48), (86, 24)),
            ((108, 12), (134, 22), (98, 24)), ((134, 22), (152, 42), (130, 48)), ((152, 42), (140, 56), (130, 48)), ((134, 22), (130, 48), (98, 24))] + \
           [((92, 66), a, b) for a, b in zip([(86, 24), (98, 24), (130, 48), (130, 106), (54, 106), (54, 48)], [(98, 24), (130, 48), (130, 106), (54, 106), (54, 48), (86, 24)])]
GEM = [((30, 50), (60, 26), (72, 50)), ((60, 26), (124, 26), (72, 50)), ((124, 26), (112, 50), (72, 50)), ((154, 50), (124, 26), (112, 50)),
       ((30, 50), (72, 50), (92, 108)), ((72, 50), (112, 50), (92, 108)), ((112, 50), (154, 50), (92, 108))]
SPARK = lambda cx, cy, r: [(cx, cy - r), (cx + r * .26, cy - r * .26), (cx + r, cy), (cx + r * .26, cy + r * .26), (cx, cy + r), (cx - r * .26, cy + r * .26), (cx - r, cy), (cx - r * .26, cy - r * .26)]

def wheel_tris(cx=92, cy=60, R=53, r=22, n=12):
    out = []
    for i in range(n):
        a0 = -math.pi / 2 + 2 * math.pi * i / n; a1 = -math.pi / 2 + 2 * math.pi * (i + 1) / n
        o0 = (cx + R * math.cos(a0), cy + R * math.sin(a0)); o1 = (cx + R * math.cos(a1), cy + R * math.sin(a1))
        i0 = (cx + r * math.cos(a0), cy + r * math.sin(a0)); i1 = (cx + r * math.cos(a1), cy + r * math.sin(a1))
        out += [(i, (o0, o1, i0)), (i, (o1, i1, i0))]
    return out

def _poly(pts, fill, stroke):
    return f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in pts)}" fill="{fill}" stroke="{stroke}"/>'

def shape_svg(kind, ground, ink, lo=None, hi=None, seed=4):
    dk = lum(ground) < .25; lo = lo if lo is not None else (.84 if dk else .62); hi = hi if hi is not None else 1.0 if dk else .98
    rnd = random.Random(seed); out = ''
    def put(tri, u):
        nonlocal out
        col = ramp(u + (rnd.random() - .5) * .08, PRISM); f = mix(col, ground, lo + (hi - lo) * rnd.random())
        out += _poly(tri, f, mix(ink, f, .36))
    cen = lambda tri: (sum(p[0] for p in tri) / 3, sum(p[1] for p in tri) / 3)
    if kind == 'skin':
        for tri in _tris_rings(DROP, (92, 80), .55): put(tri, (cen(tri)[1] - 6) / 110 * .8 + (cen(tri)[0] - 54) / 76 * .2)
    elif kind == 'style':
        for tri in TEE_TRIS: put(tri, (cen(tri)[0] - 30) / 124)
    elif kind == 'coach':
        for tri in _tris_rings(BUBBLE, (92, 47), .5) + TAIL: put(tri, (cen(tri)[0] - 26) / 134)
    elif kind == 'member':
        for tri in GEM: put(tri, (cen(tri)[0] - 30) / 124)
    elif kind == 'color':
        for i, tri in wheel_tris():
            col = ramp(i / 12.0, RING); f = mix(col, ground, lo + (hi - lo) * rnd.random()); out += _poly(tri, f, mix(ink, f, .36))
    return out

def dots_svg(kind, ground, ink, x=166):
    ys = (30, 60, 90); out = ''
    if kind in ('coach', 'member'): ys = (56, 76, 96); x = 172
    if kind == 'skin': cols = TONE4[:3] if False else ['#F0B88A', '#B07848', '#683D24']
    elif kind == 'color': cols = SEASON4[:3]
    elif kind == 'style': cols = [PRISM[0], PRISM[2], PRISM[4]]
    elif kind == 'coach': cols = [PRISM[1], PRISM[5], PRISM[3]]
    else: cols = [PRISM[0], PRISM[2], PRISM[4]]
    for i, (y, c) in enumerate(zip(ys, cols)):
        if kind == 'member':
            r = 7 + i * 2.5; out += _poly([(x, y - r), (x + r, y), (x, y + r), (x - r, y)], mix(c, ground, .8), mix(ink, c, .4))
        else:
            out += f'<circle cx="{x}" cy="{y}" r="9" fill="{c}" stroke="{mix(ink, c, .4)}"/>'
    return out

def extras(kind, ground, ink):
    if kind == 'coach':
        sp = _poly(SPARK(152, 20, 16), PRISM[2], mix(ink, PRISM[2], .4))
        dots = ''.join(f'<circle cx="{x}" cy="47" r="5" fill="{mix("#FFFFFF", ground, .92) if lum(ground) < .3 else "#FFFFFF"}"/>' for x in (72, 92, 112))
        return dots + sp
    if kind == 'member':
        return _poly(SPARK(158, 18, 13), PRISM[2], mix(ink, PRISM[2], .4)) + _poly(SPARK(22, 30, 8), PRISM[0], mix(ink, PRISM[0], .4))
    return ''

def art(kind, ground, ink, h=None):
    """Bold tile illustration, viewBox 200x120."""
    return (f'<svg class="art" viewBox="0 0 200 120" width="100%" height="{h or "100%"}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style="display:block">'
            f'<g stroke-width="1" stroke-linejoin="round" style="vector-effect:non-scaling-stroke">{shape_svg(kind, ground, ink)}{extras(kind, ground, ink) if kind != "coach" else extras(kind, ground, ink)}</g>'
            f'<g stroke-width="1">{dots_svg(kind, ground, ink)}</g></svg>')

def icon(kind, ground, ink, size=32):
    """Compact bbox icon for nav pills (shape only)."""
    return (f'<svg class="art" viewBox="26 0 132 124" width="{size}" height="{round(size * 124 / 132)}" aria-hidden="true" style="display:block;flex:none">'
            f'<g stroke-width="1" stroke-linejoin="round" style="vector-effect:non-scaling-stroke">{shape_svg(kind, ground, ink)}{extras(kind, ground, ink) if kind in ("coach",) else ""}</g></svg>')

NAV = [('skin', 'Skin', 'Match your skin and build a routine around it.'),
       ('color', 'Color', 'Find your palette across makeup, hair and wardrobe.'),
       ('style', 'Style', 'Wear what you like, guided by your color.'),
       ('coach', 'Coach', 'Ask anything. Answers say what they used.'),
       ('member', 'Membership', 'Start free. Add Guided or Studio when ready.')]

MESH_CSS = ('.mesh{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}.mesh polygon{stroke-width:1;stroke-linejoin:round;vector-effect:non-scaling-stroke}'
            '.pz{position:relative;overflow:hidden;color:var(--zt)}.pzc{position:relative}.pz .p,.pz .chip{color:var(--zs)}.pz .k{color:var(--zk)}.pz .a{color:var(--zb)}.pz .a2{color:var(--za)}.art polygon,.art circle{stroke-width:1;stroke-linejoin:round;vector-effect:non-scaling-stroke}')
