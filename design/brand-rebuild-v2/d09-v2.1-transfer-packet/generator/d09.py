#!/usr/bin/env python3
"""D09 Card Grid v2.1 — web portal + iOS + Android boards (dark + light) on the established logo.
Usage: python3 d09.py <outdir> [canvas|export]"""
import sys, os, re, json
sys.path.insert(0, '/home/claude/team47studio'); sys.path.insert(0, '/home/claude/team47studio/v2')
from string import Template
import gen, gen2, gen3, d09lib as Z
from gen import cta_row, season, ico, COMPLY, TONES, SEL, SEASON, TOOLS, SHORT, TABS, TABICON, ICON

D9 = dict([x for x in gen3.D if x['id'] == 'D09'][0], h1=88, h2=64, track='-0.04em')
PLAT = dict(name='ios', w=390, h=844)

CSS9 = Template("""body{margin:0}*{box-sizing:border-box}a{text-decoration:none;color:inherit}
.r{$root;background:$bg;color:$text;font-family:$bfont;position:relative;overflow:hidden}
.w{max-width:1280px;margin:0 auto;padding-left:40px;padding-right:40px}
.d{font-family:$dfont;font-weight:$dw;letter-spacing:$track;line-height:$dlh;margin:0}
.a{$acss}.a2{$a2css}
.k{font-family:$kfont;font-size:${ks}px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:$kcol}
.p{font-size:17px;line-height:1.7;color:$sub;margin:0}
.c{background:$surf;border:1px solid $line;border-radius:${rad}px}
.b{display:inline-block;font-size:16px;font-weight:700;padding:16px 32px;min-height:52px;background:$btnbg;color:$onacc;border-radius:999px;border:1px solid $btnbd;text-align:center}
.b2{display:inline-block;font-size:16px;font-weight:700;padding:16px 28px;min-height:52px;color:$text;border-radius:999px;border:1px solid $line2;text-align:center}
.chip{display:inline-block;font-size:13px;padding:7px 14px;border:1px solid $line;border-radius:999px;color:$sub}
.hr{height:1px;background:$line}""")
EXTRA_CSS = Z.MESH_CSS.replace('.pz{position:relative;overflow:hidden;', '.pz{position:relative;overflow:hidden;display:flex;flex-direction:column;').replace('.pzc{position:relative}', '.pzc{position:relative;flex:1;min-width:0}')

def mydoc(t, title, body, w, h, fluid):
    if not fluid and (w, h) == (390, 844): w, h = PLAT['w'], PLAT['h']
    root = f"width:100%;min-height:{h}px" if fluid else f"width:{w}px;height:{h}px"
    css = CSS9.substitute(t, root=root, ks=13 if fluid else 11) + EXTRA_CSS
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>
{css}
</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family={t['fonts']}&display=swap">
</helmet>
<div class="r">
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
  renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
"""

def logo(t, h): return gen3.logo(t, h)
def tile(t, w, h, build, i=0, seed=1, ground=None, style='', lo=.08, hi=.19, flow=(1.0, .45), label='', cell=None, rad=None, **kw):
    g = ground or t['surf']
    return Z.pz(t, w, h, build, ground=g, style=f'border-radius:{rad or t["rad"]}px;border:1px solid {Z.mix(Z.PRISM[i % 6], g, .5)};{style}', cell=cell or max(48, min(100, int(min(w, h) / 3))), seed=seed, lo=lo, hi=hi, flow=flow, label=label, **kw)

# ───────────── web: header, hero, nav tiles, fit band ─────────────
def header(t):
    g = t['bg']; pills = ''
    for i, (k, n, _) in enumerate(Z.NAV):
        pills += tile(t, 176, 56, lambda tz, k=k, n=n: f'<span style="display:flex;align-items:center;gap:8px;padding:7px 20px 7px 10px">{Z.icon(k, g, t["text"], 34)}<span class="d" style="font-size:17px;font-weight:800;letter-spacing:-.01em;color:{tz["text"]}">{n}</span></span>',
                      i=i, seed=i + 2, ground=g, rad=999, lo=.09, hi=.2, cell=30, label='nav-' + k, tag='a', href='#', style='display:flex')
    return (f'<header style="position:sticky;top:0;z-index:50;background:{g};border-bottom:1px solid {t["line"]}"><div class="w" style="height:100px;display:flex;align-items:center;justify-content:space-between;gap:24px">'
            f'<a href="#" aria-label="Team 47 Studio home" style="flex:none">{logo(t, 64)}</a><nav style="display:flex;gap:8px">{pills}</nav>'
            f'<div style="display:flex;gap:12px;align-items:center;flex:none"><a href="#" style="font-size:15px;font-weight:600;color:{t["sub"]};padding:12px 2px">Sign in</a><a href="#" class="b" style="padding:12px 22px;min-height:48px">Start free</a></div></div></header>')

TERMS = 'Terms'
def footer(t):
    lk = lambda x: f'<a href="#" style="color:{t["sub"]};text-decoration:underline;text-underline-offset:3px">{x}</a>'
    return (f'<footer style="background:{t["bg"]};border-top:1px solid {t["line"]}"><div class="w" style="padding-top:40px;padding-bottom:44px;display:flex;justify-content:space-between;align-items:center;gap:28px;font-size:12.5px;color:{t["mute"]}">'
            f'{logo(t, 46)}<span style="flex:1;text-align:center;line-height:1.9">{COMPLY}<br>{lk("Privacy")} · {lk("Terms")} · {lk("What to expect")} · {lk("AI disclosure")} · {lk("Support")}</span><span>© 2026 MGT Solutions, Inc d/b/a Team47Studio</span></div></footer>')

def hero(t):
    g = t['panel']; bg = t['bg']
    def left(tz):
        return (f'<div style="padding:54px 54px 50px;display:flex;flex-direction:column;height:100%"><span class="chip" style="align-self:flex-start;margin-bottom:26px;font-weight:600;background:{bg}">Everything in one view</span>'
                f'<h1 class="d" style="font-size:{t["h1"]}px;margin-bottom:24px">Care, <span class="a">color,</span><br>and style.<br><span class="a2">Connected.</span></h1>'
                f'<p class="p" style="font-size:19px;max-width:520px">One studio for your skin, your palette and your wardrobe, built from your own profile and not a generic average.</p>'
                f'<div style="flex:1;min-height:30px"></div>{cta_row(tz)}</div>')
    sw = ''.join(f'<span style="flex:1;max-width:46px;aspect-ratio:1;border-radius:50%;background:{c}"></span>' for c in TONES[1:13:2])
    def quiz(tz):
        ring = lambda i: f'box-shadow:0 0 0 2px {t["surf"]},0 0 0 4px {tz["acc"]};' if i == 2 else ''
        sws = ''.join(f'<span style="width:44px;height:44px;border-radius:50%;background:{c};{ring(i)}"></span>' for i, c in enumerate(TONES[1:13:2]))
        return (f'<div style="padding:26px 28px"><div style="display:flex;justify-content:space-between;margin-bottom:14px"><span class="k">Skin Match · about a minute</span><span class="k" style="color:{tz["mute"]}">Step 2 of 4</span></div>'
                f'<div class="d" style="font-size:32px;margin-bottom:18px;color:{tz["text"]}">What’s your skin tone?</div><div style="display:flex;gap:12px">{sws}</div></div>')
    def seas(tz):
        return (f'<div style="padding:24px 26px"><div class="k" style="margin-bottom:12px">Your season</div><div class="d" style="font-size:30px;margin-bottom:18px;color:{tz["text"]}">Soft Autumn</div>{season(tz, 24)}</div>')
    def tonight(tz):
        return (f'<div style="padding:24px 26px"><div class="k" style="margin-bottom:12px">Tonight · PM</div><div style="display:flex;align-items:center;gap:14px"><svg width="56" height="56" viewBox="0 0 38 38" aria-hidden="true"><circle cx="19" cy="19" r="15.5" stroke="{Z.mix(tz["text"], t["surf"], .2)}" stroke-width="3.4" fill="none"/>'
                f'<circle cx="19" cy="19" r="15.5" stroke="{tz["acc"]}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-dasharray="97.4" stroke-dashoffset="65" transform="rotate(-90 19 19)"/></svg>'
                f'<div><div class="d" style="font-size:30px;line-height:1;color:{tz["text"]}">2<span style="font-size:18px;color:{tz["sub"]}"> / 6</span></div><div style="font-size:13px;color:{tz["sub"]};margin-top:6px">Next: Vitamin C serum</div></div></div></div>')
    def coach(tz):
        return (f'<div style="padding:24px 28px"><div class="k" style="margin-bottom:12px">AI Coach</div><div class="d" style="font-size:24px;line-height:1.2;color:{tz["text"]};letter-spacing:-.02em">“Should I move vitamin C to the morning?”</div>'
                f'<div style="font-size:13.5px;color:{tz["sub"]};margin-top:10px">Answers list what they used.</div></div>')
    L = tile(t, 704, 640, left, i=5, seed=11, ground=g, rad=40, lo=.09, hi=.21, cell=104, flow=(1, .55), label='hero', style='flex:0 0 704px')
    R = (f'<div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:16px;min-width:0">'
         f'{tile(t, 480, 190, quiz, i=0, seed=12, style="grid-column:span 2", rad=30, label="hq")}{tile(t, 232, 190, seas, i=2, seed=13, rad=30, label="hs")}{tile(t, 232, 190, tonight, i=4, seed=14, rad=30, label="ht")}'
         f'{tile(t, 480, 150, coach, i=1, seed=15, style="grid-column:span 2", rad=30, label="hc")}</div>')
    return f'<section class="w" style="padding-top:28px;padding-bottom:28px"><div style="display:flex;gap:16px;align-items:stretch">{L}{R}</div></section>'

def navtiles(t):
    out = ''
    for i, (k, n, dsc) in enumerate(Z.NAV):
        out += tile(t, 232, 296, lambda tz, k=k, n=n, dsc=dsc: (f'<div style="height:152px;padding:16px 10px 0">{Z.art(k, t["surf"], t["text"])}</div><div style="padding:8px 22px 26px">'
                    f'<div class="d" style="font-size:31px;color:{tz["text"]}">{n}</div><div style="font-size:14.5px;color:{tz["sub"]};line-height:1.45;margin-top:8px;min-height:42px">{dsc}</div></div>'),
                    i=i, seed=20 + i, rad=30, lo=.1, hi=.22, cell=72, flow=(1, .6), label='navtile-' + k, tag='a', href='#', style='flex:1')
    return (f'<section class="w" style="padding-top:20px;padding-bottom:64px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:18px"><span class="k">Explore the studio</span>'
            f'<span style="font-size:14px;color:{t["sub"]}">Pick a place to start.</span></div><div style="display:flex;gap:16px">{out}</div></section>')

FIT = [('Fits your skin', 'Matched to your type, tone and sensitivities.'), ('Fits your color', 'One palette across makeup, hair and wardrobe.'),
       ('Fits your routine', 'Steps in your order, updated as you go.'), ('Fits your questions', 'Answers that say what they used.')]
def fitband(t):
    def ui(i, tz):
        if i == 0:
            return ''.join(f'<span class="chip" style="background:{t["bg"]}">{x}</span> ' for x in ['Combination', 'Warm', 'Depth 07'])
        if i == 1:
            return f'<div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:14px;font-weight:700;color:{tz["text"]}">Soft Autumn</span>{season(tz, 20)}</div>'
        if i == 2:
            seg = ''.join(f'<div style="flex:1;height:8px;border-radius:4px;background:{tz["acc"] if j < 2 else tz["line"]}"></div>' for j in range(6))
            return f'<div style="display:flex;gap:4px;margin-bottom:8px">{seg}</div><div style="font-size:13px;color:{tz["sub"]}">Tonight · 2 of 6 done</div>'
        return (f'<div style="background:{t["bg"]};border:1px solid {tz["line"]};border-radius:14px;padding:11px 14px;font-size:13px;line-height:1.45;color:{tz["sub"]}">A gentle gel cleanser is a common place to start.'
                f'<div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin-top:6px;color:{tz["mute"]}">Based on: skin type · PM routine</div></div>')
    cards = ''
    for i, (a, b) in enumerate(FIT):
        cards += tile(t, 282, 262, lambda tz, i=i, a=a, b=b: (f'<div style="padding:26px 26px 24px;display:flex;flex-direction:column;height:100%"><div class="k" style="margin-bottom:12px">{a}</div>'
                      f'<div class="d" style="font-size:26px;line-height:1.1;letter-spacing:-.025em;color:{tz["text"]};margin-bottom:20px;min-height:86px">{b}</div><div style="margin-top:auto">{ui(i, tz)}</div></div>'),
                      i=i + 1, seed=30 + i, rad=28, lo=.07, hi=.17, cell=70, flow=(.5, 1), label='fit' + str(i))
    lk = lambda x: f'<a href="#" style="color:{t["sub"]};text-decoration:underline;text-underline-offset:3px">{x}</a>'
    return (f'<section style="background:{t["bg2"]};border-top:1px solid {t["line"]};border-bottom:1px solid {t["line"]}"><div class="w" style="padding-top:84px;padding-bottom:72px">'
            f'<div style="display:flex;gap:64px;align-items:flex-end;margin-bottom:44px"><div style="flex:1"><span class="chip" style="font-weight:600;background:{t["bg"]}">Built around you</span>'
            f'<h2 class="d" style="font-size:{t["h2"]}px;margin-top:22px">Made to fit you,<br><span class="a">not an average.</span></h2></div>'
            f'<p class="p" style="flex:0 0 410px;font-size:18px">Guidance for how your skin, color and style look and feel, built from your own profile and explained as you go.</p></div>'
            f'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">{cards}</div>'
            f'<p style="font-size:12.5px;color:{t["mute"]};margin:24px 0 0">Individual results vary. {COMPLY} {lk("Terms")} · {lk("What to expect")}</p></div></section>')

# ───────────── web sections ─────────────
def tools_body9(t):
    cells = ''
    for i, (a, b, c) in enumerate(TOOLS):
        cells += tile(t, 384, 240, lambda tz, i=i, a=a, b=b, c=c: (f'<div style="padding:28px 28px 30px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:30px"><span class="k">{a}</span>'
                      f'<span style="width:48px;height:48px;border-radius:50%;background:{t["surf"]};border:1px solid {tz["line"]};display:flex;align-items:center;justify-content:center">{ico(i, t["text"], 24)}</span></div>'
                      f'<div class="d" style="font-size:32px;line-height:1.05;margin-bottom:10px;color:{tz["text"]}">{b}</div><div style="font-size:14.5px;color:{tz["sub"]};line-height:1.6">{c}</div></div>'),
                      i=i, seed=40 + i, rad=28, lo=.07, hi=.17, cell=76, flow=(1, .3 + .25 * i), label='tool' + str(i))
    return (f'<p class="p" style="max-width:560px;margin:0 0 38px">Each vertical reads the same profile, so a decision in one shows up correctly in the others.</p>'
            f'<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;text-align:left">{cells}</div>')

def cta9(t):
    sub = 'Free to start. Your first result before you create an account.'
    inner = lambda tz: (f'<div style="padding:96px 60px;text-align:center"><h2 class="d" style="font-size:{int(t["h2"]*1.25)}px;margin-bottom:20px;color:{tz["text"]}">Your studio <span class="a">starts here.</span></h2>'
                        f'<p style="font-size:18px;color:{tz["sub"]};max-width:480px;margin:0 auto 34px;line-height:1.7">{sub}</p><a href="#" class="b">Start my Skin Match</a>'
                        f'<div style="font-size:13px;color:{tz["sub"]};margin-top:18px">About a minute · No account needed · Free to start</div></div>')
    return (f'<section class="w" style="padding-top:24px;padding-bottom:80px">' + tile(t, 1200, 380, inner, i=4, seed=60, ground=t['panel'], rad=44, lo=.1, hi=.26, cell=110, flow=(1, .4), label='cta') + '</section>')

def landing(t):
    A = lambda x: f'<span class="a">{x}</span>'; A2 = lambda x: f'<span class="a2">{x}</span>'
    body = (header(t) + hero(t) + navtiles(t) + fitband(t)
            + gen.sec(t, 1, 'Skincare', f'{A("Know")} your skin. Build what it needs.', gen.skin_body(t))
            + gen.sec(t, 2, 'The studio', f'Six tools. {A2("One studio.")}', tools_body9(t), True)
            + gen.sec(t, 3, 'AI Coach', f'{A("Ask")} your AI Coach.', gen.coach_body(t))
            + gen.sec(t, 4, 'Membership', f'Start {A("free.")} Upgrade when ready.', gen3.plans3(t), True)
            + cta9(t) + footer(t))
    return mydoc(t, f"D09 Card Grid · Web ({t['mode']})", body, 1280, 3000, True)

# ───────────── post-processing ─────────────
SPELL = [('Colourist', 'Colorist'), ('colourist', 'colorist'), ('Colour', 'Color'), ('colour', 'color'), ('COLOUR', 'COLOR'), ('Moisturiser', 'Moisturizer'), ('moisturiser', 'moisturizer'), ('ersonalised', 'ersonalized'),
         ('avourite', 'avorite'), ('centre', 'center'), ('ustomis', 'ustomiz'), ('rganis', 'rganiz'), ('ecognis', 'ecogniz'), ('ummaris', 'ummariz'), ('uthoris', 'uthoriz'), ('atalogue', 'atalog'), ('ehaviour', 'ehavior'),
         ('rogramme', 'rogram'), ('icence', 'icense'), ('whilst', 'while'), ('ulphate', 'ulfate'), ('nalyse', 'nalyze'), ('ptimis', 'ptimiz'), ('labelled', 'labeled'), ('Labelled', 'Labeled'), ('abelling', 'abeling')]
def finish(html, t):
    html = gen3.finish(html, t)
    for a, b in SPELL: html = html.replace(a, b)
    html = re.sub(r'background:linear-gradient\(to right,(#[0-9A-Fa-f]{6}),#[0-9A-Fa-f]{6}\)', r'background:\1', html)
    html = html.replace('font-size:50px;line-height:1;margin-bottom:10px;text-transform:none', 'font-size:64px;line-height:1;margin-bottom:12px;text-transform:none')
    html = html.replace('margin-bottom:32px;max-width:1000px', 'margin-bottom:34px;max-width:1200px')
    html = html.replace('MGT Solutions, Inc. d/b/a Team47Studio', 'MGT Solutions, Inc d/b/a Team47Studio')
    assert '~60s' not in html and 'Verticals, one profile' not in html and 'To a first result' not in html and 'To start<' not in html, 'stats line still present'
    return html

# ───────────── web: result + portal rebuilt as card grids ─────────────
def w_result9(t):
    L, S, M, A, A2, BG2 = t['line'], t['sub'], t['mute'], t['acc'], t['acc2'], t['bg2']
    row, chips, sw, STEPS = gen2.row, gen2.chips, gen2.sw, gen2.STEPS
    steps = ''.join(f'<div style="display:flex;gap:14px;align-items:baseline;padding:11px 0;border-top:1px solid {L}"><span class="d" style="font-size:22px;width:20px;color:{M}">{i+1}</span><span style="font-size:14px;font-weight:600;flex:1">{x}</span><span class="k" style="color:{M}">{"Prep" if i<2 else "Treat" if i<4 else "Seal"}</span></div>' for i, x in enumerate(STEPS))
    use = ''.join(f'<div style="padding:22px 20px;border-top:1px solid {L};{"border-left:1px solid "+L+";" if i else ""}"><div style="margin-bottom:12px">{ico(i, A, 22)}</div><div class="k" style="margin-bottom:6px">{a}</div><div style="font-size:13px;color:{S};line-height:1.55">{["Routine ready","Shades matched to depth 07","Start hair profile","Lift check included","Set your preferences","Palette applied"][i]}</div></div>' for i, (a, b, c) in enumerate(TOOLS))
    def season_tile(tz):
        return (f'<div style="padding:26px 28px"><div class="k" style="margin-bottom:12px">Your color season</div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><div class="d" style="font-size:38px;color:{tz["text"]}"><span class="a">Soft Autumn</span></div>{season(tz, 26)}</div>'
                f'<div style="font-size:13.5px;color:{tz["sub"]};line-height:1.6">You sit close to Soft Summer. Neither answer is wrong; try both palettes and keep the one you prefer.</div></div>')
    def expect_tile(tz):
        lk = lambda x: f'<a href="#" style="color:{tz["text"]};text-decoration:underline;text-underline-offset:3px;font-weight:600">{x}</a>'
        return (f'<div style="padding:30px 32px"><div class="k" style="margin-bottom:12px">What to expect</div><div class="d" style="font-size:30px;line-height:1.1;margin-bottom:12px;color:{tz["text"]}">Guidance, not a guarantee.</div>'
                f'<div style="font-size:14px;color:{tz["sub"]};line-height:1.65;margin-bottom:14px">This is a sample result built from sample answers. Real results come from your own answers, and individual results vary.</div>'
                f'<div style="font-size:13.5px;color:{tz["sub"]}">{lk("Terms")} · {lk("What to expect")}</div></div>')
    banner = (f'<div class="c" style="display:flex;align-items:center;justify-content:space-between;padding:14px 22px;background:{t["panel"]}"><div style="font-size:14px"><b>This is your result, before any sign-up.</b> <span style="color:{S}">Create a free account to keep it and use it across all six verticals.</span></div>'
              f'<a href="#" class="b" style="padding:11px 22px;font-size:13px;min-height:44px">Save my profile</a></div>')
    left = (f'<div style="flex:1.1;display:flex;flex-direction:column;gap:24px"><div class="c" style="padding:32px"><div style="display:flex;justify-content:space-between;margin-bottom:18px"><span class="k" style="color:{M}">Your skin</span><a href="#" class="k">Edit answers</a></div>'
            f'<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">{sw(TONES[SEL], 56)}<div><div class="d" style="font-size:34px;line-height:1.05">Combination, warm, medium.</div><div style="font-size:13px;color:{S};margin-top:4px">Depth 07 of 15 · low sensitivity</div></div></div>'
            f'<div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:20px">{chips(["Goal: even tone", "Goal: hydration", "Fragrance-free preferred"])}</div>'
            f'{row("Match confidence", "Sample", A)}{row("Why this result", "Type, tone, sensitivity and two goals")}{row("What we kept", "Your answers and this result.")}'
            f'<p style="font-size:11.5px;color:{M};font-style:italic;margin:16px 0 0">{COMPLY}</p></div>'
            + tile(t, 640, 230, expect_tile, i=3, seed=71, rad=28, lo=.08, hi=.18, cell=84, flow=(1, .4), label='expect', style='flex:1') + '</div>')
    right = (f'<div style="flex:1;display:flex;flex-direction:column;gap:24px">' + tile(t, 560, 210, season_tile, i=2, seed=72, rad=28, lo=.08, hi=.19, cell=80, flow=(1, .5), label='season')
             + f'<div class="c" style="padding:28px"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="k" style="color:{M}">Your PM routine · 6 steps</span><span class="k">AM · 5 steps</span></div>{steps}'
             f'<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid {L};padding-top:16px;margin-top:2px"><div><div style="font-size:12px;color:{M}">Shop My Routine · 6 items</div><div class="d" style="font-size:28px">$176</div></div><a href="#" class="b2" style="padding:12px 22px">Review the cart</a></div></div></div>')
    body = (header(t) + f'<div class="w" style="padding-top:26px">{banner}</div>'
            f'<section class="w" style="padding-top:56px;padding-bottom:64px"><div class="k" style="margin-bottom:14px">Skin Match · Sample result</div><h1 class="d" style="font-size:76px;margin-bottom:40px">Your profile, <span class="a">ready.</span></h1>'
            f'<div style="display:flex;gap:24px;align-items:stretch">{left}{right}</div></section>'
            f'<section style="background:{BG2};border-top:1px solid {L}"><div class="w" style="padding-top:56px;padding-bottom:64px"><div class="k" style="margin-bottom:12px">One profile, six uses</div><h2 class="d" style="font-size:46px;margin-bottom:28px">Where this profile <span class="a2">goes next.</span></h2>'
            f'<div class="c" style="display:grid;grid-template-columns:repeat(6,1fr);overflow:hidden">{use}</div></div></section>' + footer(t))
    return mydoc(t, 'D09 · Web · Skin Match result', body, 1280, 1500, True)

def w_portal9(t):
    L, S, M, A, A2, BG2 = t['line'], t['sub'], t['mute'], t['acc'], t['acc2'], t['bg2']
    STEPS = gen2.STEPS
    nav = ''.join(f'<div style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:14px;font-size:14px;font-weight:{600 if i==0 else 500};color:{t["text"] if i==0 else S};{"background:"+t["surf"]+";border:1px solid "+L+";" if i==0 else ""}">{ic}{n}</div>'
                  for i, (n, ic) in enumerate([('Home', ico(5, A, 18)), ('Skin', ico(0, S, 18)), ('Makeup', ico(1, S, 18)), ('Hair', ico(2, S, 18)), ('Style', ico(4, S, 18)), ('Shop', ico(1, S, 18)), ('AI Coach', ico(4, S, 18, TABICON)), ('Profile', ico(5, S, 18, TABICON))]))
    seg = ''.join(f'<div style="flex:1;height:8px;border-radius:4px;background:{A if i<2 else L}"></div>' for i in range(6))
    srows = ''.join(f'<div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-top:1px solid {L};{"background:"+A+"1A;margin:0 -28px;padding:12px 28px;" if i==2 else ""}"><span class="d" style="font-size:22px;width:20px;color:{A if i==2 else M}">{i+1}</span>'
                    f'<span style="flex:1;font-size:14px;font-weight:600;{"text-decoration:line-through;color:"+M+";" if i<2 else ""}">{x}</span>{"<span style=\'color:"+A2+";font-weight:700\'>✓</span>" if i<2 else ("<a href=\'#\' class=\'b\' style=\'padding:8px 16px;font-size:12.5px;min-height:44px\'>Mark done</a>" if i==2 else "")}</div>' for i, x in enumerate(STEPS))
    status = [('Routine ready', 'Open'), ('3 shades matched', 'Open'), ('Not started', 'Start'), ('Lift check ready', 'Open'), ('Preferences set', 'Open'), ('Palette applied', 'Open')]
    def studio(i):
        a, b, c = TOOLS[i]; s, act = status[i]
        return tile(t, 300, 150, lambda tz: (f'<div style="padding:20px 22px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><span class="k">{a}</span>'
                    f'<span style="width:40px;height:40px;border-radius:50%;background:{t["surf"]};border:1px solid {tz["line"]};display:flex;align-items:center;justify-content:center">{ico(i, t["text"], 20)}</span></div>'
                    f'<div class="d" style="font-size:26px;margin-bottom:8px;color:{tz["text"]}">{b}</div><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;color:{tz["sub"]}">{s}</span><span style="font-size:13px;font-weight:700;color:{tz["acc"]}">{act} ›</span></div></div>'),
                    i=i, seed=80 + i, rad=26, lo=.07, hi=.17, cell=64, flow=(1, .3 + .2 * i), label='studio' + str(i), tag='a', href='#')
    cards = ''.join(studio(i) for i in range(6))
    def coach(tz):
        return (f'<div style="padding:26px"><div class="k" style="margin-bottom:10px">AI Coach · Guided</div><div class="d" style="font-size:30px;margin-bottom:8px;color:{tz["text"]}">Ask about tonight’s routine.</div>'
                f'<div style="font-size:13.5px;color:{tz["sub"]};line-height:1.6;margin-bottom:16px">It already knows your profile, season and routine history.</div><a href="#" class="b2" style="padding:12px 22px;background:{t["surf"]}">See Guided</a></div>')
    def free(tz):
        return (f'<div style="padding:18px"><div class="k" style="margin-bottom:8px">Free</div><div style="font-size:13px;color:{tz["sub"]};line-height:1.55;margin-bottom:14px">Guided adds full personalized routines, progress history and account-aware coaching.</div><a href="#" class="b" style="display:block;padding:10px;font-size:13px;min-height:44px">Upgrade</a></div>')
    chip = (f'<div class="c" style="display:flex;align-items:center;gap:14px;padding:12px 18px"><div><div class="k" style="color:{M};margin-bottom:4px">Your season</div><div style="font-size:14px;font-weight:600">Soft Autumn</div></div>{season(t, 20)}</div>')
    body = f"""<div style="display:flex;min-height:1060px"><aside style="flex:0 0 244px;background:{BG2};border-right:1px solid {L};padding:26px 18px"><div style="font-family:{t['dfont']};font-weight:600;font-size:18px;letter-spacing:.14em;padding:0 14px 26px">TEAM 47 <span style="color:{A}">STUDIO</span></div>
<div style="display:flex;flex-direction:column;gap:4px">{nav}</div><div style="margin-top:30px">{tile(t, 208, 200, free, i=5, seed=90, rad=22, lo=.08, hi=.18, cell=60, flow=(1, .5), label='free')}</div></aside>
<main style="flex:1;padding:40px 48px 56px;min-width:0"><div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:30px"><div><div class="k" style="margin-bottom:10px">Saturday evening</div><h1 class="d" style="font-size:56px">Good evening, Alex<span class="a">.</span></h1></div>{chip}</div>
<div style="display:flex;gap:22px;align-items:stretch;margin-bottom:22px"><div class="c" style="flex:1.35;padding:28px"><div style="display:flex;justify-content:space-between;margin-bottom:12px"><span class="k" style="color:{M}">Tonight · PM routine</span><span class="k">2 of 6 done</span></div><div style="display:flex;gap:5px;margin-bottom:14px">{seg}</div>{srows}
<div style="border-top:1px solid {L};padding-top:12px;font-size:12px;color:{M}">You approve every change to your routine.</div></div>
<div style="flex:1;display:flex;flex-direction:column;gap:22px"><div class="c" style="padding:26px"><div class="k" style="color:{M};margin-bottom:10px">Shop My Routine</div><div class="d" style="font-size:30px;margin-bottom:6px">Your PM cart is <span class="a">ready.</span></div>
<div style="font-size:13px;color:{S};line-height:1.6;margin-bottom:16px">Two items you don’t own yet. Each one says why it was picked.</div><div style="display:flex;justify-content:space-between;align-items:center"><span class="d" style="font-size:30px">$74</span><a href="#" class="b" style="padding:12px 24px">Review cart</a></div></div>
{tile(t, 400, 230, coach, i=4, seed=91, ground=t['panel'], rad=28, lo=.09, hi=.2, cell=84, flow=(1, .4), label='coach', style='flex:1')}</div></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;margin:34px 0 16px"><h2 class="d" style="font-size:36px">Your <span class="a2">studio</span></h2><span style="font-size:13px;color:{S}">One profile feeds all six.</span></div>
<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px">{cards}</div>
<p style="font-size:11.5px;color:{M};margin:30px 0 0">{COMPLY} · © 2026 MGT Solutions, Inc d/b/a Team47Studio</p></main></div>"""
    return mydoc(t, 'D09 · Web · Portal home', body, 1280, 1060, True)

# ───────────── wiring ─────────────
def patch(mods_names):
    for name, fn in mods_names.items():
        for m in (gen, gen2, gen3):
            if hasattr(m, name): setattr(m, name, fn)
patch(dict(doc=mydoc, header=header, footer=footer, proof=lambda t: ''))
gen.CSS = CSS9
gen3.use  # noqa

def render_web(mode):
    t = gen3.tokens(D9, mode); t['line2'] = Z.mix(t['text'], t['bg'], .5); gen3.use(t)
    out = {'W1-Home': landing(t), 'W2-Result': w_result9(t), 'W3-Portal': w_portal9(t), 'W4-Membership': gen3.w_plans(t)}
    return {k: finish(v, t) for k, v in out.items()}

def main(out, target='canvas'):
    gen3.TARGET = target; os.makedirs(out, exist_ok=True); n = 0
    for mode in ('dark', 'light'):
        for k, html in render_web(mode).items():
            open(os.path.join(out, f'D09-{k}-{mode}.dc.html'), 'w').write(html); n += 1
    print(n, 'boards ->', out, target, '| zones:', len(Z.GUARD), 'min contrast', min(c for _, c in Z.GUARD))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'canvas')
