#!/usr/bin/env python3
"""Generates Team 47 Studio brand-variation artboards (.dc.html) from token sets.
Usage: python3 gen.py <outdir>   -> writes N01..N10 (Web, Home, Match, Coach) and Final-* boards."""
import sys, os
from string import Template

TONES = ['#FDDBB4','#F7CA9F','#F0B88A','#E2A273','#D08E5E','#C99A6B','#BE8A5C','#AC7650',
         '#976141','#7F4E31','#683D24','#512D19','#3D1F0E','#2A1509','#1C0E05']
SEL = 6
SEASON = ['#A67C6B','#C49A7B','#8B8265','#6F7A6A','#9C6B60','#B59B7E']
TOOLS = [('Skincare','Skin Match','Routines, ingredient guidance and product matching from your own profile.'),
         ('Makeup','Makeup Artist','Shade matching and palette discovery guided by your season.'),
         ('Haircare','Hair Artist','Wash and treatment routines matched to texture, scalp and goals.'),
         ('Hair colour','Colour Direction','Season-guided direction, with a lift safety check before anything is suggested.'),
         ('Style','Style Artist','Preference-led guidance with colour as a nudge, never a rule.'),
         ('Clothing','Wardrobe','Discovery guided by your palette and what you like to wear.')]
SHORT = ['Skincare','Makeup','Haircare','Hair colour','Style','Wardrobe']
TABS = ['Skin','Makeup','Hair','Style','Coach','Profile']
COMPLY = 'Cosmetic guidance, not diagnosis or medical treatment.'

ICON = [  # 20x20 stroke icons, one per vertical / tab
 '<circle cx="10" cy="7" r="3.8"/><path d="M2.5 18c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5"/>',
 '<rect x="2.5" y="7" width="15" height="10.5" rx="2"/><path d="M6.5 7V4.5a3.5 3.5 0 0 1 7 0V7"/>',
 '<path d="M2.5 15.5c1.5-4.6 3.8-7.6 7.5-7.6s6 3 7.5 7.6"/><path d="M9.2 3s-1.5 3 .8 4.6"/>',
 '<circle cx="10" cy="10" r="7.6"/><path d="M10 2.4v15.2"/><circle cx="10" cy="10" r="2.4"/>',
 '<rect x="2.5" y="2.5" width="15" height="15" rx="3"/><path d="M6.2 10h7.6M10 6.2v7.6"/>',
 '<path d="M4.5 7 10 3l5.5 4v10h-11V7Z"/><path d="M8 17v-4.6h4V17"/>']
TABICON = [ICON[0], ICON[1], ICON[2], ICON[4],
 '<path d="M3 4.5h14v9H9l-4 3v-3H3v-9Z"/>',
 '<circle cx="10" cy="7.5" r="3"/><path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6"/>']

def ico(i, col, size=20, src=ICON):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 20 20" fill="none" stroke="{col}" '
            f'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{src[i]}</svg>')

# ───────────────────────── tokens ─────────────────────────
BASE = dict(bw=1, tt='none', dlh='.95', dwi=400, shadow='none', cextra='', bextra='', crad=999,
            chipbg='transparent', h1=96, h2=58, track='-0.02em', steps=False, g='rings', dark=False)

V = [
 dict(id='N01', name='Atelier', tag='Quiet luxury, clearly explained', hero='center', hs='num', tools='rows', cta='invert', plans='cards',
      bg='#F6F1EA', bg2='#EFE8DD', surf='#FFFDF9', text='#1B1815', sub='#5E564C', mute='#8C8377', line='#DDD3C4',
      acc='#6D28D9', acc2='#9A6B3F', onacc='#FFFFFF', dfont="'Cormorant Garamond',Georgia,serif", bfont="'Inter',system-ui,sans-serif",
      fonts='Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600', dw=600, accmode='italic',
      rad=4, brad=2, h1=104, h2=62, pv='list', sw='circle', tab='text'),
 dict(id='N02', name='Noir Editorial', tag='Fashion-magazine authority', hero='masthead', hs='kicker', tools='cells', cta='invert', plans='split',
      bg='#000000', bg2='#0A0A0A', surf='#0D0D0D', text='#F7F5F0', sub='#A8A49C', mute='#6E6A62', line='#262626',
      acc='#7C3AED', acc2='#C4A882', onacc='#FFFFFF', dfont="'Bodoni Moda','Didot',Georgia,serif", bfont="'Inter',system-ui,sans-serif",
      fonts='Bodoni+Moda:ital,wght@0,500;0,700;1,400&family=Inter:wght@400;500;600;700', dw=700, accmode='italic', tt='uppercase',
      rad=0, brad=0, crad=0, h1=124, h2=76, dlh='.88', track='-0.035em', pv='list', sw='square', tab='text', dark=True),
 dict(id='N03', name='Clinical Clear', tag='Transparent, evidence-led guidance', hero='rail', hs='pill', tools='cards', cta='panel', plans='cards',
      bg='#FFFFFF', bg2='#F4F7FA', surf='#FFFFFF', text='#0F1A2A', sub='#4A5A6E', mute='#8696A8', line='#DCE4EC',
      acc='#5B3FD9', acc2='#0E8F8A', onacc='#FFFFFF', dfont="'Inter Tight','Inter',system-ui,sans-serif", bfont="'Inter',system-ui,sans-serif",
      kfont="'IBM Plex Mono',ui-monospace,monospace",
      fonts='Inter+Tight:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500', dw=600, accmode='color',
      rad=10, brad=8, crad=6, h1=76, h2=48, dlh='1.02', track='-0.03em', shadow='0 1px 2px rgba(15,26,42,.06)', pv='grid', sw='square', tab='icon'),
 dict(id='N04', name='Glow Pop', tag='Playful, social-native beauty', hero='panel', hs='pill', tools='tiles', cta='panel', plans='cards',
      bg='#FFF4EE', bg2='#FFE8DE', surf='#FFFFFF', text='#2A1533', sub='#6B5573', mute='#A592AB', line='#F3D3C6',
      acc='#7C3AED', acc2='#FF5C7A', onacc='#FFFFFF', dfont="'Bricolage Grotesque','DM Sans',system-ui,sans-serif", bfont="'DM Sans',system-ui,sans-serif",
      fonts='Bricolage+Grotesque:wght@600;800&family=DM+Sans:wght@400;500;700', dw=800, accmode='color',
      rad=28, brad=999, h1=84, h2=54, dlh='.98', track='-0.035em', shadow='0 14px 40px -22px rgba(124,58,237,.45)',
      panel='linear-gradient(135deg,#FFD9CC 0%,#F5D6FF 100%)', pv='grid', sw='circle', tab='icon'),
 dict(id='N05', name='Botanic', tag='Calm, earthy, ritual-first', hero='split', hs='num', tools='cards', cta='glow', plans='cards', g='leaf',
      bg='#F2EFE6', bg2='#E7E3D5', surf='#FBF9F3', text='#1F2A22', sub='#55604F', mute='#8A9483', line='#D5D2C2',
      acc='#2F5D46', acc2='#B5733C', onacc='#F7F4EA', dfont="'Fraunces',Georgia,serif", bfont="'Work Sans',system-ui,sans-serif",
      fonts='Fraunces:ital,wght@0,400;0,600;1,400&family=Work+Sans:wght@400;500;600', dw=600, accmode='italic',
      rad=18, brad=999, h1=88, h2=54, pv='list', sw='circle', tab='icon'),
 dict(id='N06', name='Prism AI', tag='AI-native, luminous tech', hero='split', hs='pill', tools='cards', cta='glow', plans='cards', g='prism',
      bg='#07070F', bg2='#0C0C18', surf='#12121F', text='#EDEBF5', sub='#A5A1BE', mute='#6B678A', line='#25253A',
      acc='#7C3AED', acc2='#22D3EE', onacc='#FFFFFF', dfont="'Space Grotesk','Inter',system-ui,sans-serif", bfont="'Inter',system-ui,sans-serif",
      fonts='Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600', dw=700, accmode='grad',
      rad=20, brad=999, h1=86, h2=52, dlh='1', track='-0.035em', shadow='0 0 0 1px rgba(124,58,237,.12), 0 24px 60px -34px rgba(124,58,237,.7)',
      bextra='box-shadow:0 12px 36px -12px rgba(124,58,237,.8);', pv='grid', sw='circle', tab='icon', dark=True),
 dict(id='N07', name='Soft Clay', tag='Warm, tactile, reassuring', hero='stacked', hs='center', tools='tiles', cta='panel', plans='cards', g='arcs',
      bg='#EFE6DD', bg2='#E6DACE', surf='#F8F2EA', text='#3A2C25', sub='#7A675C', mute='#A8968A', line='#DCCDBF',
      acc='#6B4FBB', acc2='#C4673E', onacc='#FFFFFF', dfont="'DM Serif Display',Georgia,serif", bfont="'Outfit',system-ui,sans-serif",
      fonts='DM+Serif+Display:ital@0;1&family=Outfit:wght@400;500;600', dw=400, accmode='italic',
      rad=32, brad=999, h1=100, h2=58, dlh='1', track='-0.01em', shadow='0 18px 40px -26px rgba(58,44,37,.45)', pv='grid', sw='circle', tab='icon'),
 dict(id='N08', name='Mono Brutal', tag='Bold, startup-direct, zero ornament', hero='masthead', hs='kicker', tools='cells', cta='invert', plans='split',
      bg='#F3F1EA', bg2='#FFFFFF', surf='#FFFFFF', text='#0B0B0B', sub='#3D3D3D', mute='#7A7A7A', line='#0B0B0B',
      acc='#7C3AED', acc2='#C8F03C', onacc='#FFFFFF', dfont="'Archivo','Inter',system-ui,sans-serif", bfont="'Archivo','Inter',system-ui,sans-serif",
      kfont="'Space Mono',ui-monospace,monospace",
      fonts='Archivo:wght@400;600;800;900&family=Space+Mono:wght@400;700', dw=900, accmode='mark', tt='uppercase', bw=2,
      rad=0, brad=0, crad=0, h1=118, h2=72, dlh='.9', track='-0.045em', shadow='6px 6px 0 #0B0B0B', pv='list', sw='square', tab='text'),
 dict(id='N09', name='Aurora', tag='Soft-gradient wellness companion', hero='center', hs='center', tools='cards', cta='glow', plans='cards', g='blobs',
      bg='#FBFAFF', bg2='#F3F0FF', surf='#FFFFFF', text='#1D1840', sub='#5A5580', mute='#9590B5', line='#E3DEF7',
      acc='#7C3AED', acc2='#F472B6', onacc='#FFFFFF', dfont="'Plus Jakarta Sans',system-ui,sans-serif", bfont="'Plus Jakarta Sans',system-ui,sans-serif",
      fonts='Plus+Jakarta+Sans:wght@400;500;600;800', dw=800, accmode='grad',
      rad=24, brad=14, h1=84, h2=52, dlh='1.02', track='-0.04em', shadow='0 20px 50px -30px rgba(124,58,237,.5)', pv='grid', sw='circle', tab='icon'),
 dict(id='N10', name='Maison Gold', tag='Heritage-house luxury', hero='stacked', hs='center', tools='rows', cta='glow', plans='split', g='arcs',
      bg='#14100C', bg2='#1B1611', surf='#1E1813', text='#F2EADC', sub='#B3A48E', mute='#7A6C58', line='#3A2F22',
      acc='#C4A882', acc2='#A77DF5', onacc='#14100C', dfont="'Playfair Display',Georgia,serif", bfont="'Jost',system-ui,sans-serif",
      fonts='Playfair+Display:ital,wght@0,400;0,600;1,400&family=Jost:wght@300;400;500', dw=400, accmode='italic',
      rad=2, brad=0, crad=0, h1=104, h2=62, pv='list', sw='circle', tab='text', dark=True),
]

FINAL = dict(id='Final', name='Signature', tag='Your profile. Six ways to use it.', hero='panel', hs='num', tools='cells', cta='invert', plans='cards',
      bg='#F7F3EC', bg2='#EFE9DE', surf='#FFFFFF', text='#17141F', sub='#5B5566', mute='#8E889A', line='#E0D8CC',
      acc='#7C3AED', acc2='#A0733F', onacc='#FFFFFF', dfont="'Cormorant Garamond',Georgia,serif", bfont="'Inter',system-ui,sans-serif",
      kfont="'IBM Plex Mono',ui-monospace,monospace",
      fonts='Cormorant+Garamond:ital,wght@0,500;0,600;1,400&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500', dw=600, accmode='italic',
      rad=14, brad=10, crad=999, h1=92, h2=60, shadow='0 18px 44px -30px rgba(23,20,31,.35)',
      panel='linear-gradient(135deg,#EFE6FF 0%,#FBEFE4 100%)', pv='grid', sw='circle', tab='icon', steps=True)

def prep(v):
    t = dict(BASE); t.update(v)
    t.setdefault('kfont', t['bfont']); t.setdefault('panel', t['bg2'])
    t.setdefault('line2', t['line']); t.setdefault('btnbg', t['acc']); t.setdefault('btnbd', t['acc'])
    t.setdefault('kcol', t['acc'] if not t['dark'] or t['id'] == 'N10' else t['acc2'])
    t.setdefault('hdr', t['bg'] + 'EB'); t.setdefault('solid', t['bg2'] if t['dark'] else t['surf'])
    a, a2 = t['acc2'], t['acc']
    if t['id'] == 'N10': a, a2 = t['acc'], t['acc2']
    m = t['accmode']
    if m == 'italic':
        t['acss'] = f"font-style:italic;font-weight:{t['dwi']};color:{a}"; t['a2css'] = f"font-style:italic;font-weight:{t['dwi']};color:{a2}"
    elif m == 'color':
        t['acss'] = f"color:{a}"; t['a2css'] = f"color:{a2}"
    elif m == 'grad':
        g = f"background:linear-gradient(100deg,{t['acc']},{t['acc2']});-webkit-background-clip:text;background-clip:text;color:transparent"
        t['acss'] = g; t['a2css'] = g
    else:  # mark
        t['acss'] = f"background:{t['acc2']};color:{t['text']};padding:0 .12em"; t['a2css'] = f"background:{t['acc']};color:{t['onacc']};padding:0 .12em"
    return t

CSS = Template("""body{margin:0}*{box-sizing:border-box}a{text-decoration:none;color:inherit}
.r{$root;background:$bg;color:$text;font-family:$bfont;position:relative;overflow:hidden}
.w{max-width:1200px;margin:0 auto;padding-left:64px;padding-right:64px}
.d{font-family:$dfont;font-weight:$dw;letter-spacing:$track;line-height:$dlh;margin:0;text-transform:$tt}
.a{$acss}.a2{$a2css}
.k{font-family:$kfont;font-size:${ks}px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:$kcol}
.p{font-size:15.5px;line-height:1.75;color:$sub;margin:0}
.c{background:$surf;border:${bw}px solid $line;border-radius:${rad}px;box-shadow:$shadow;$cextra}
.b{display:inline-block;font-size:14px;font-weight:600;padding:16px 30px;background:$btnbg;color:$onacc;border-radius:${brad}px;border:${bw}px solid $btnbd;text-align:center;$bextra}
.b2{display:inline-block;font-size:14px;font-weight:600;padding:16px 26px;color:$text;border-radius:${brad}px;border:${bw}px solid $line2;text-align:center}
.chip{display:inline-block;font-size:12px;padding:6px 13px;border:1px solid $line;border-radius:${crad}px;color:$sub;background:$chipbg}
.hr{height:${bw}px;background:$line}""")

def doc(t, title, body, w, h, fluid):
    root = f"width:100%;min-height:{h}px" if fluid else f"width:{w}px;height:{h}px"
    css = CSS.substitute(t, root=root, ks=11 if fluid else 9.5)
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

# ───────────────────────── shared pieces ─────────────────────────
def tonebar(t, h=34, gap=4, n=15):
    r = min(t['rad'], 999) if t['rad'] < 12 else 999
    cells = ''
    for i, c in enumerate(TONES[:n]):
        ring = f"box-shadow:0 0 0 2px {t['bg']},0 0 0 4px {t['acc']};" if i == SEL else ''
        cells += f'<span style="flex:1;height:{h}px;border-radius:{r}px;background:{c};{ring}"></span>'
    return f'<div style="display:flex;gap:{gap}px">{cells}</div>'

def season(t, s=18):
    return '<div style="display:flex;gap:5px">' + ''.join(
        f'<span style="width:{s}px;height:{s}px;border-radius:{"50%" if t["rad"] else "0"};background:{c}"></span>' for c in SEASON) + '</div>'

def cta_row(t, center=False):
    j = 'justify-content:center;' if center else ''
    return (f'<div style="display:flex;gap:14px;align-items:center;{j}flex-wrap:wrap"><a href="#" class="b">Start my Skin Match</a>'
            f'<a href="#" class="b2">See how it works</a></div>'
            f'<div style="font-size:12.5px;color:{t["mute"]};margin-top:16px">About a minute · No account needed · Free to start</div>')

def steps3(t):
    sw = ''.join(f'<span style="width:22px;height:22px;border-radius:{"50%" if t["rad"] else "0"};background:{c};'
                 f'{"box-shadow:0 0 0 2px "+t["surf"]+",0 0 0 4px "+t["acc"]+";" if i==3 else ""}"></span>' for i, c in enumerate(TONES[1:13:2]))
    chips = ''.join(f'<span class="chip">{x}</span>' for x in ['Combination', 'Warm', 'Medium depth', 'Soft Autumn'])
    bd = f'border-left:{t["bw"]}px solid {t["line"]};'
    return f'''<div class="c" style="display:flex;text-align:left">
<div style="flex:1;padding:28px 30px"><div class="k" style="margin-bottom:10px">01 · Answer</div><div class="d" style="font-size:24px;line-height:1.1;margin-bottom:16px">A few taps. No camera.</div><div style="display:flex;gap:9px">{sw}</div></div>
<div style="flex:1;padding:28px 30px;{bd}"><div class="k" style="margin-bottom:10px">02 · See your profile</div><div class="d" style="font-size:24px;line-height:1.1;margin-bottom:16px">Yours before you sign up.</div><div style="display:flex;gap:6px;flex-wrap:wrap">{chips}</div></div>
<div style="flex:1;padding:28px 30px;{bd}"><div class="k" style="margin-bottom:10px">03 · Get your routine</div><div class="d" style="font-size:24px;line-height:1.1;margin-bottom:16px">Steps in order, one tap to shop.</div><div style="font-size:13px;color:{t["sub"]};line-height:1.7">AM · 5 steps &nbsp;·&nbsp; PM · 6 steps &nbsp;·&nbsp; Shop My Routine</div></div>
</div>'''

def proof(t):
    items = [('6', 'Verticals, one profile'), ('12', 'Colour seasons'), ('~60s', 'To a first result'), ('$0', 'To start')]
    cells = ''.join(f'<div style="flex:1;{"border-left:"+str(t["bw"])+"px solid "+t["line"]+";padding-left:28px;" if i else ""}">'
                    f'<div class="d" style="font-size:40px;line-height:1"><span class="a">{n}</span></div>'
                    f'<div style="font-size:12px;color:{t["mute"]};margin-top:8px;letter-spacing:.04em">{l}</div></div>' for i, (n, l) in enumerate(items))
    return (f'<div style="border-top:{t["bw"]}px solid {t["line"]};border-bottom:{t["bw"]}px solid {t["line"]}">'
            f'<div class="w" style="display:flex;padding-top:30px;padding-bottom:30px">{cells}</div></div>')

# ───────────────────────── graphics ─────────────────────────
def graphic(t):
    c1, c2, g = t['acc'], t['acc2'], t['g']
    head = '<svg width="100%" height="460" viewBox="0 0 440 460" fill="none" aria-hidden="true">'
    if g == 'prism':
        return head + f'''<defs><linearGradient id="pa" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{c2}" stop-opacity=".55"/><stop offset="1" stop-color="{c1}" stop-opacity=".08"/></linearGradient>
<radialGradient id="pb" cx=".5" cy=".5" r=".5"><stop stop-color="{c1}" stop-opacity=".45"/><stop offset="1" stop-color="{c1}" stop-opacity="0"/></radialGradient>
<linearGradient id="pc" x1="0" y1="0" x2="1" y2="0"><stop stop-color="{c2}" stop-opacity=".8"/><stop offset="1" stop-color="{c2}" stop-opacity="0"/></linearGradient></defs>
<circle cx="225" cy="225" r="200" fill="url(#pb)"/><path d="M225 70 345 280H105L225 70Z" fill="url(#pa)" stroke="{c2}" stroke-opacity=".5"/>
<path d="M225 140 295 258H155L225 140Z" stroke="{c1}" stroke-opacity=".7"/><path d="M12 196 105 280" stroke="url(#pc)" stroke-width="2.4" stroke-linecap="round"/>
<path d="M345 280 432 232M345 280 434 268M345 280 432 306M345 280 424 342" stroke="url(#pc)" stroke-width="2.2" stroke-linecap="round"/>
<path d="M70 380 104 392 90 424 60 410Z" fill="url(#pa)"/><path d="M366 96 394 106 384 132 358 122Z" fill="url(#pa)"/></svg>'''
    if g == 'leaf':
        leaves = ''
        for i, y in enumerate([110, 165, 220, 275, 330]):
            s = 1 if i % 2 else -1
            cx = 232 - (y - 60) * 0.085 + s * 52
            leaves += f'<ellipse cx="{cx:.0f}" cy="{y}" rx="60" ry="21" transform="rotate({-32*s} {cx:.0f} {y})" fill="{c1}" fill-opacity="{0.12+0.03*i:.2f}" stroke="{c1}" stroke-opacity=".55"/>'
        return head + f'<circle cx="235" cy="215" r="190" fill="{c2}" fill-opacity=".09"/><path d="M200 440C204 320 214 190 236 50" stroke="{c1}" stroke-width="1.6" stroke-linecap="round"/>{leaves}<circle cx="238" cy="46" r="7" fill="{c2}"/><circle cx="330" cy="120" r="4" fill="{c2}" fill-opacity=".6"/><circle cx="110" cy="320" r="5" fill="{c2}" fill-opacity=".5"/></svg>'
    if g == 'arcs':
        arcs = ''.join(f'<path d="M{225-r} 400A{r} {r} 0 0 1 {225+r} 400" stroke="{c1 if i%2 else c2}" stroke-opacity="{0.25+0.12*i:.2f}" stroke-width="1.3"/>' for i, r in enumerate([200, 160, 120, 80, 40]))
        return head + f'<circle cx="225" cy="400" r="200" fill="{c2}" fill-opacity=".07"/>{arcs}<circle cx="225" cy="400" r="14" fill="{c2}" fill-opacity=".7"/><path d="M20 400h410" stroke="{c1}" stroke-opacity=".4"/></svg>'
    rings = ''.join(f'<circle cx="225" cy="215" r="{r}" stroke="{c}" stroke-opacity="{o}"/>' for r, c, o in [(175, c1, .5), (132, c2, .5), (90, c2, .35), (48, c1, .45)])
    return head + f'<circle cx="225" cy="215" r="200" fill="{c1}" fill-opacity=".08"/>{rings}<circle cx="225" cy="40" r="5" fill="{c1}"/><circle cx="350" cy="338" r="4" fill="{c2}"/><circle cx="100" cy="338" r="3" fill="{c2}"/><path d="M225 40 350 338M225 40 100 338" stroke="{c2}" stroke-opacity=".3" stroke-width=".8"/></svg>'

def floats(t):
    return f'''<div class="c" style="position:absolute;top:18px;right:0;padding:15px 18px"><div class="k" style="color:{t['mute']};margin-bottom:7px">Your season</div><div class="d" style="font-size:21px;line-height:1.1;margin-bottom:10px;text-transform:none">Soft Autumn</div>{season(t)}</div>
<div class="c" style="position:absolute;bottom:26px;left:0;padding:15px 18px"><div class="k" style="color:{t['mute']};margin-bottom:8px">Tonight · PM</div><div style="display:flex;align-items:center;gap:11px"><svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true"><circle cx="19" cy="19" r="15.5" stroke="{t['line']}" stroke-width="3.4" fill="none"/><circle cx="19" cy="19" r="15.5" stroke="{t['acc']}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-dasharray="97.4" stroke-dashoffset="65" transform="rotate(-90 19 19)"/></svg><div><div style="font-size:13.5px;font-weight:600">2 of 6 done</div><div style="font-size:11.5px;color:{t['sub']};margin-top:1px">Serum is next</div></div></div></div>'''

def quizcard(t):
    r = '50%' if t['sw'] == 'circle' else '0'
    sw = ''.join(f'<span style="aspect-ratio:1;border-radius:{r};background:{c};{"box-shadow:0 0 0 3px "+t["surf"]+",0 0 0 5px "+t["acc"]+";" if i==SEL else ""}"></span>' for i, c in enumerate(TONES))
    return f'''<div class="c" style="padding:30px"><div style="display:flex;justify-content:space-between;margin-bottom:12px"><span class="k">Skin Match</span><span class="k" style="color:{t['mute']}">Step 2 of 4</span></div>
<div style="height:5px;background:{t['bg2']};border-radius:99px;margin-bottom:22px"><div style="width:50%;height:100%;background:{t['acc']};border-radius:99px"></div></div>
<div class="d" style="font-size:30px;line-height:1.05;margin-bottom:8px">What's your <span class="a">skin tone?</span></div>
<div style="font-size:13px;color:{t['sub']};margin-bottom:20px">Pick the closest swatch. Daylight works best.</div>
<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px">{sw}</div>
<div style="display:flex;justify-content:space-between;align-items:center"><a href="#" style="font-size:13px;color:{t['acc']};font-weight:600">Not sure? Help me choose</a><a href="#" class="b" style="padding:12px 24px">Continue</a></div></div>'''

# ───────────────────────── heroes ─────────────────────────
def badge(t):
    return f'<span class="chip" style="margin-bottom:28px;color:{t["kcol"]};border-color:{t["line"]}">{t["tag"]}</span>'

def hero(t):
    H, sub = t['h1'], '<p class="p" style="font-size:17px;max-width:480px">One studio for your skin, your palette and your wardrobe, built from your own profile and not a generic average.</p>'
    kind = t['hero']
    if kind == 'split':
        return f'''<section class="w" style="padding-top:96px;padding-bottom:72px;display:flex;gap:56px;align-items:center">
<div style="flex:0 0 56%">{badge(t)}<h1 class="d" style="font-size:{H}px;margin-bottom:30px">Care,<br><span class="a">colour,</span><br>and style.<br><span class="a2">Connected.</span></h1>{sub}<div style="height:32px"></div>{cta_row(t)}</div>
<div style="flex:1;position:relative;height:460px">{graphic(t)}{floats(t)}</div></section>{proof(t)}'''
    if kind == 'center':
        mesh = ''
        if t['g'] == 'blobs':
            mesh = (f'<div style="position:absolute;inset:0 0 auto 0;height:760px;pointer-events:none;background:radial-gradient(ellipse 38% 46% at 22% 30%,{t["acc"]}33 0%,transparent 70%),'
                    f'radial-gradient(ellipse 34% 44% at 78% 24%,{t["acc2"]}33 0%,transparent 70%),radial-gradient(ellipse 40% 40% at 52% 78%,#FBBF2433 0%,transparent 72%)"></div>')
        return f'''<section style="position:relative">{mesh}<div class="w" style="position:relative;padding-top:100px;padding-bottom:76px;text-align:center">
{badge(t)}<h1 class="d" style="font-size:{H}px;margin-bottom:28px">Care, <span class="a">colour,</span> and style.<br><span class="a2">Connected.</span></h1>
<div style="display:flex;justify-content:center;margin-bottom:34px">{sub.replace('max-width:480px','max-width:560px')}</div>{cta_row(t, True)}
<div style="margin-top:60px">{steps3(t)}</div></div></section>{proof(t)}'''
    if kind == 'masthead':
        feats = [('01 · Skin', 'Skin Match in about a minute', 'Your first result before you create an account.'), ('02 · Colour', '12-season palette', 'One analysis for makeup, hair and clothing.'),
                 ('03 · Routine', 'AM / PM tracker', 'You approve every change to your routine.'), ('04 · Coach', 'AI Coach on call', 'Voice or text, and it already knows your profile.')]
        cells = ''.join(f'<div style="padding:28px 24px 28px {0 if i==0 else 24}px;{"border-left:"+str(t["bw"])+"px solid "+t["line"]+";" if i else ""}"><div class="k" style="margin-bottom:12px">{a}</div>'
                        f'<div class="d" style="font-size:25px;line-height:1.05;margin-bottom:9px;letter-spacing:-0.01em">{b}</div><div style="font-size:12.5px;color:{t["sub"]};line-height:1.6">{c}</div></div>' for i, (a, b, c) in enumerate(feats))
        return f'''<div class="w"><div style="display:flex;justify-content:space-between;padding:11px 0;border-bottom:{t['bw']}px solid {t['line']}"><span class="k" style="color:{t['mute']}">MGT Solutions, Inc. d/b/a Team47Studio</span><span class="k" style="color:{t['mute']}">{t['tag']}</span><span class="k">Free to start</span></div></div>
<section class="w" style="padding-top:52px;position:relative"><div class="d" style="position:absolute;top:-6px;right:44px;font-size:300px;line-height:.8;opacity:.05;pointer-events:none">47</div>
<h1 class="d" style="font-size:{H}px;position:relative">Care, <span class="a">colour,</span><br>and style.</h1>
<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:40px;margin-top:16px;padding-bottom:34px;position:relative"><div class="d" style="font-size:{int(H*.72)}px"><span class="a2">Connected.</span></div>
<p class="p" style="max-width:380px;text-align:right">One studio for your skin, your palette and your wardrobe, built from your own profile and not a generic average.</p></div>
<div style="height:{t['bw']+2}px;background:{t['text']}"></div><div style="display:grid;grid-template-columns:repeat(4,1fr)">{cells}</div><div class="hr"></div>
<div style="padding:28px 0">{cta_row(t)}</div><div style="height:{t['bw']+2}px;background:{t['text']}"></div></section>'''
    if kind == 'panel':
        return f'''<section class="w" style="padding-top:36px;padding-bottom:56px"><div style="background:{t['panel']};border-radius:{int(t['rad']*1.4)}px;padding:68px 60px;display:flex;gap:56px;align-items:center">
<div style="flex:1">{badge(t)}<h1 class="d" style="font-size:{H}px;margin-bottom:26px">Care, <span class="a">colour,</span><br>and style.<br><span class="a2">Connected.</span></h1>{sub}<div style="height:30px"></div>{cta_row(t)}</div>
<div style="flex:0 0 400px">{quizcard(t)}</div></div></section>{'<div class="w" style="padding-bottom:56px">'+steps3(t)+'</div>' if t['steps'] else ''}{proof(t)}'''
    if kind == 'stacked':
        tiles = [('01', 'Answer', 'A few taps, no camera.'), ('02', 'See your profile', 'Yours before you sign up.'), ('03', 'Get your routine', 'Steps in order, one tap to shop.')]
        tl = ''.join(f'<div class="c" style="flex:1;padding:24px"><div class="k" style="margin-bottom:28px">{a}</div><div class="d" style="font-size:25px;line-height:1.08;margin-bottom:8px">{b}</div><div style="font-size:13px;color:{t["sub"]}">{c}</div></div>' for a, b, c in tiles)
        return f'''<section class="w" style="padding-top:92px;padding-bottom:72px;position:relative"><div style="position:absolute;top:10px;right:20px;width:440px;opacity:.9;pointer-events:none">{graphic(t)}</div>
<div style="position:relative">{badge(t)}<h1 class="d" style="font-size:{H}px;margin-bottom:44px">Care, <span class="a">colour,</span><br>and style. <span class="a2">Connected.</span></h1>
<div style="display:flex;gap:48px;align-items:flex-end"><div style="flex:0 0 38%">{sub}<div style="height:28px"></div>{cta_row(t)}</div><div style="flex:1;display:flex;gap:14px">{tl}</div></div></div></section>{proof(t)}'''
    # rail
    idx = ''.join(f'<div style="display:flex;gap:10px;padding:11px 0;border-top:1px solid {t["line"]};font-size:13px;color:{t["sub"] if i else t["text"]};font-weight:{600 if i==0 else 400}"><span class="k" style="color:{t["mute"] if i else t["acc"]}">{i+1:02d}</span>{n}</div>' for i, n in enumerate(SHORT))
    rows = ''.join(f'<div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid {t["line"]};font-size:13px"><span class="k" style="color:{t["mute"]}">{a}</span><span style="font-weight:600;color:{c or t["text"]}">{b}</span></div>'
                   for a, b, c in [('Skin type', 'Combination', ''), ('Undertone', 'Warm', ''), ('Depth', '07 / 15', ''), ('Sensitivity', 'Low', ''), ('Season', 'Soft Autumn', t['acc2']), ('Match confidence', '91%', t['acc'])])
    return f'''<section class="w" style="padding-top:72px;padding-bottom:64px;display:flex;gap:44px;align-items:flex-start">
<div style="flex:0 0 170px;padding-top:8px"><div class="k" style="color:{t['mute']};margin-bottom:12px">Index</div>{idx}</div>
<div style="flex:1">{badge(t)}<h1 class="d" style="font-size:{H}px;margin-bottom:26px">Care, <span class="a">colour,</span> and style. <span class="a2">Connected.</span></h1>{sub}<div style="height:30px"></div>{cta_row(t)}</div>
<div class="c" style="flex:0 0 330px;padding:24px"><div style="display:flex;justify-content:space-between;margin-bottom:14px"><span class="k">Profile · sample</span><span class="k" style="color:{t['acc2']}">Complete</span></div>{rows}<div style="margin-top:14px">{tonebar(t, 16, 2)}</div>
<div style="font-size:11.5px;color:{t['mute']};margin-top:14px;line-height:1.5">Why you see this: every recommendation lists the profile fields it used.</div></div></section>{proof(t)}'''

# ───────────────────────── sections ─────────────────────────
ROMAN = ['I', 'II', 'III', 'IV']
CHAP = ['one', 'two', 'three', 'four']

def sec(t, n, kick, title, body, alt=False):
    hs, bg = t['hs'], (f"background:{t['bg2']};" if alt else '')
    H = t['h2']
    if hs == 'num':
        inner = (f'<div style="display:flex"><div style="width:116px;flex-shrink:0;padding-top:10px"><div class="k">{n:02d}</div><div style="width:28px;height:{t["bw"]}px;background:{t["acc"]};margin-top:12px"></div></div>'
                 f'<div style="flex:1;min-width:0"><div class="k" style="color:{t["mute"]};margin-bottom:14px">{kick}</div><h2 class="d" style="font-size:{H}px;margin-bottom:30px">{title}</h2>{body}</div></div>')
    elif hs == 'center':
        inner = (f'<div style="text-align:center;margin-bottom:48px"><div class="k" style="letter-spacing:.34em;margin-bottom:18px">{ROMAN[n-1]} · {kick}</div>'
                 f'<h2 class="d" style="font-size:{H}px">{title}</h2></div>{body}')
    elif hs == 'kicker':
        inner = (f'<div style="position:relative"><div class="d" style="position:absolute;top:-30px;right:-10px;font-size:220px;opacity:.05;pointer-events:none">{ROMAN[n-1]}</div>'
                 f'<div class="k" style="margin-bottom:24px;position:relative">Chapter {CHAP[n-1]} · {kick}</div><h2 class="d" style="font-size:{H}px;margin-bottom:38px;position:relative">{title}</h2>{body}</div>')
    else:  # pill
        inner = (f'<span class="chip" style="color:{t["kcol"]};margin-bottom:18px"><b>{n:02d}</b>&nbsp; {kick}</span>'
                 f'<h2 class="d" style="font-size:{H}px;margin-bottom:32px;max-width:1000px">{title}</h2>{body}')
    top = f'border-top:{t["bw"]+2 if hs=="kicker" else t["bw"]}px solid {t["text"] if hs=="kicker" else t["line"]};'
    return f'<section style="{bg}{top}"><div class="w" style="padding-top:84px;padding-bottom:84px">{inner}</div></section>'

def skin_body(t):
    chips = ''.join(f'<span class="chip">{x}</span>' for x in ['Combination', 'Warm undertone', 'Medium depth', 'Low sensitivity'])
    rows = ''.join(f'<div style="display:flex;justify-content:space-between;font-size:13.5px;padding:11px 0;border-top:1px solid {t["line"]}"><span style="color:{t["sub"]}">{a}</span><span style="font-weight:600;color:{c or t["text"]}">{b}</span></div>'
                   for a, b, c in [('AM routine', '5 steps', ''), ('PM routine', '6 steps', ''), ('Colour season', 'Soft Autumn', t['acc2'] if t['id'] != 'N10' else t['acc']), ('Products matched', '24 items', '')])
    return f'''<div style="display:flex;gap:56px;align-items:flex-start;text-align:left"><div style="flex:1"><p class="p" style="margin-bottom:30px">Skin Match builds a living profile from your type, tone, sensitivities and goals, then matches routines and products that fit it. Your first result arrives before you create an account, and every answer stays editable.</p>
<div class="k" style="color:{t['mute']};margin-bottom:12px">Tone range · 15 depths, light to deep</div>{tonebar(t)}
<p style="font-size:11.5px;color:{t['mute']};font-style:italic;margin:22px 0 0">{COMPLY} Swatches only: no photo is stored.</p></div>
<div class="c" style="flex:1;padding:30px"><div style="display:flex;justify-content:space-between;margin-bottom:18px"><span class="k" style="color:{t['mute']}">Sample profile</span><span class="k">Complete</span></div>
<div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:18px">{chips}</div>{rows}
<div style="margin-top:14px;font-size:12px;color:{t['sub']};display:flex;justify-content:space-between"><span>Match confidence</span><span style="font-weight:600;color:{t['text']}">91%</span></div>
<div style="height:6px;background:{t['bg2']};border-radius:99px;margin-top:8px"><div style="width:91%;height:100%;border-radius:99px;background:linear-gradient(to right,{t['acc']},{t['acc2']})"></div></div></div></div>'''

def tools_body(t):
    k, bw, ln = t['tools'], t['bw'], t['line']
    intro = f'<p class="p" style="max-width:520px;margin:0 {"auto" if t["hs"]=="center" else "0"} 38px">Each vertical reads the same profile, so a decision in one shows up correctly in the others.</p>'
    if k == 'cards':
        cells = ''.join(f'<div class="c" style="padding:26px"><div style="margin-bottom:18px">{ico(i, t["acc"] if i%2==0 else t["acc2"], 24)}</div><div class="k" style="margin-bottom:8px">{a}</div>'
                        f'<div class="d" style="font-size:24px;line-height:1.1;margin-bottom:9px">{b}</div><div style="font-size:13px;color:{t["sub"]};line-height:1.65">{c}</div></div>' for i, (a, b, c) in enumerate(TOOLS))
        grid = f'<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;text-align:left">{cells}</div>'
    elif k == 'tiles':
        tints = [t['acc'] + '22', t['acc2'] + '22', '#FBBF2426', t['acc2'] + '16', t['acc'] + '16', '#34D39922']
        cells = ''.join(f'<div style="background:{tints[i]};border-radius:{t["rad"]}px;padding:30px;min-height:190px"><div style="display:flex;justify-content:space-between;margin-bottom:26px"><span class="k">{a}</span>{ico(i, t["text"], 22)}</div>'
                        f'<div class="d" style="font-size:27px;line-height:1.05;margin-bottom:9px">{b}</div><div style="font-size:13px;color:{t["sub"]};line-height:1.6">{c}</div></div>' for i, (a, b, c) in enumerate(TOOLS))
        grid = f'<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;text-align:left">{cells}</div>'
    elif k == 'cells':
        cells = ''.join(f'<div style="padding:30px 28px;border-top:{bw}px solid {ln};{"border-left:"+str(bw)+"px solid "+ln+";" if i%3 else ""}"><div class="k" style="margin-bottom:12px">{i+1:02d} · {a}</div>'
                        f'<div class="d" style="font-size:30px;line-height:1;margin-bottom:10px;letter-spacing:-0.015em">{b}</div><div style="font-size:13px;color:{t["sub"]};line-height:1.65">{c}</div></div>' for i, (a, b, c) in enumerate(TOOLS))
        grid = f'<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-bottom:{bw}px solid {ln};text-align:left">{cells}</div>'
    else:  # rows
        cells = ''.join(f'<div style="display:flex;align-items:baseline;gap:22px;padding:20px 0;border-top:{bw}px solid {ln}"><span class="k" style="width:34px">{i+1:02d}</span>'
                        f'<span class="d" style="font-size:30px;line-height:1;flex:0 0 280px">{b}</span><span style="font-size:14px;color:{t["sub"]};flex:1;line-height:1.6">{c}</span><span class="k" style="color:{t["mute"]}">{a}</span></div>' for i, (a, b, c) in enumerate(TOOLS))
        grid = f'<div style="border-bottom:{bw}px solid {ln};text-align:left">{cells}</div>'
    return intro + grid

def coach_body(t):
    return f'''<div style="display:flex;gap:56px;align-items:center;text-align:left"><div style="flex:1"><p class="p" style="margin-bottom:26px">Premium members get unlimited voice or text access to a coach that already knows their profile, season and routine history. No re-explaining, and every answer says what it is based on.</p>
<span class="chip" style="color:{t['kcol']};font-weight:600;padding:9px 16px">✦ &nbsp;Premium · $14.99 / month</span></div>
<div class="c" style="flex:1;padding:26px;display:flex;flex-direction:column;gap:14px">
<div style="align-self:flex-end;max-width:80%;background:{t['bg2']};border-radius:{min(t['rad'],16)}px;padding:13px 17px;font-size:13.5px;line-height:1.55">My new cleanser leaves my skin feeling tight. What should I look for?</div>
<div style="display:flex;gap:10px"><div style="width:30px;height:30px;flex-shrink:0;border-radius:{'50%' if t['rad'] else '0'};background:{t['acc']};color:{t['onacc']};display:flex;align-items:center;justify-content:center;font-size:12px">✦</div>
<div style="border:{t['bw']}px solid {t['line']};border-radius:{min(t['rad'],16)}px;padding:13px 17px;font-size:13.5px;line-height:1.65;color:{t['sub']}">For a combination, low-sensitivity profile, tightness after cleansing often points to a formula that is too stripping. Look for a gentle gel cleanser; your hydrating step afterwards will carry the rest.<div style="font-size:11.5px;color:{t['mute']};margin-top:8px">Based on: skin type · sensitivity · PM routine</div></div></div>
<div style="display:flex;gap:10px;align-items:center;border-top:1px solid {t['line']};padding-top:14px"><div style="flex:1;border:1px solid {t['line']};border-radius:{t['brad']}px;padding:11px 16px;font-size:13px;color:{t['mute']}">Ask your coach…</div><a href="#" class="b" style="padding:11px 20px;font-size:13px">Send</a></div></div></div>'''

def plans_body(t):
    free = ['Skin Match and living profile', '12-season colour analysis', 'AM / PM routine tracker', 'All six verticals']
    prem = ['Everything in Free', 'AI Coach, unlimited', 'Live voice guidance', 'Shop My Routine cart']
    def col(name, price, items, primary):
        li = ''.join(f'<div style="display:flex;gap:10px;font-size:13.5px;color:{t["sub"]};padding:9px 0;border-top:1px solid {t["line"]}"><span style="color:{t["acc"]};font-weight:700">{"✦" if primary and i else "✓"}</span>{x}</div>' for i, x in enumerate(items))
        if not primary: li += f'<div style="display:flex;gap:10px;font-size:13.5px;color:{t["mute"]};padding:9px 0;border-top:1px solid {t["line"]}"><span>—</span>AI Coach</div>'
        btn = f'<a href="#" class="b" style="display:block;margin-top:24px">Upgrade to Premium</a>' if primary else f'<a href="#" class="b2" style="display:block;margin-top:24px">Get started free</a>'
        tagp = f'<span class="k" style="background:{t["acc"]};color:{t["onacc"]};padding:5px 10px;border-radius:{t["crad"]}px">Popular</span>' if primary else ''
        return (f'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div class="k">{name}</div>{tagp}</div>'
                f'<div class="d" style="font-size:60px;line-height:1;margin-bottom:22px;text-transform:none">{price}<span style="font-family:{t["bfont"]};font-size:14px;font-weight:400;color:{t["mute"]};letter-spacing:0"> / month</span></div>{li}{btn}')
    if t['plans'] == 'split':
        return (f'<div style="display:grid;grid-template-columns:1fr 1fr;text-align:left;max-width:960px;{"margin:0 auto" if t["hs"]=="center" else ""}"><div style="padding:34px 36px 34px 0;border-top:{t["bw"]+2}px solid {t["line"]}">{col("Free", "$0", free, False)}</div>'
                f'<div style="padding:34px 0 34px 36px;border-top:{t["bw"]+2}px solid {t["acc"]};border-left:{t["bw"]}px solid {t["line"]}">{col("Premium", "$14.99", prem, True)}</div></div>')
    return (f'<div style="display:flex;gap:20px;text-align:left;max-width:960px;{"margin:0 auto" if t["hs"]=="center" else ""}"><div class="c" style="flex:1;padding:34px">{col("Free", "$0", free, False)}</div>'
            f'<div class="c" style="flex:1;padding:34px;border-color:{t["acc"]}">{col("Premium", "$14.99", prem, True)}</div></div>')

def cta_band(t):
    head = f'<h2 class="d" style="font-size:{int(t["h2"]*1.35)}px;margin-bottom:22px">Your studio <span class="a">starts here.</span></h2>'
    sub = 'Free to start. No card. Your first result before you create an account.'
    if t['cta'] == 'invert':
        return (f'<section style="background:{t["text"]};color:{t["bg"]};padding:96px 64px;text-align:center">{head}<p style="font-size:16px;opacity:.72;max-width:440px;margin:0 auto 34px;line-height:1.7">{sub}</p>'
                f'<a href="#" class="b">Start my Skin Match</a></section>')
    if t['cta'] == 'panel':
        return (f'<section class="w" style="padding-top:20px;padding-bottom:84px"><div style="background:{t["acc"]};color:{t["onacc"]};border-radius:{int(t["rad"]*1.4)}px;padding:84px 60px;text-align:center">'
                f'<h2 class="d" style="font-size:{int(t["h2"]*1.3)}px;margin-bottom:20px">Your studio starts here.</h2><p style="font-size:16px;opacity:.85;max-width:440px;margin:0 auto 32px;line-height:1.7">{sub}</p>'
                f'<a href="#" class="b" style="background:{t["onacc"]};color:{t["acc"]};border-color:{t["onacc"]}">Start my Skin Match</a></div></section>')
    return (f'<section style="position:relative;padding:100px 64px;text-align:center;border-top:{t["bw"]}px solid {t["line"]};overflow:hidden"><div style="position:absolute;inset:0;pointer-events:none;'
            f'background:radial-gradient(ellipse 55% 100% at 50% 100%,{t["acc"]}38 0%,transparent 70%),radial-gradient(ellipse 36% 70% at 80% 10%,{t["acc2"]}26 0%,transparent 70%)"></div>'
            f'<div style="position:relative">{head}<p class="p" style="max-width:440px;margin:0 auto 34px">{sub}</p><a href="#" class="b">Start my Skin Match</a></div></section>')

def header(t):
    nav = ''.join(f'<a href="#" style="font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:{t["sub"]}">{x}</a>' for x in ['Skin', 'Colour', 'Style', 'Coach', 'Plans'])
    bb = f'{t["bw"]+2}px solid {t["text"]}' if t['hero'] == 'masthead' else f'{t["bw"]}px solid {t["line"]}'
    return (f'<header style="position:sticky;top:0;z-index:50;background:{t["hdr"]};backdrop-filter:blur(16px);border-bottom:{bb}"><div class="w" style="height:72px;display:flex;align-items:center;justify-content:space-between">'
            f'<div style="font-family:{t["dfont"]};font-weight:{max(t["dw"],600)};font-size:19px;letter-spacing:.14em">TEAM 47 <span style="color:{t["acc"]}">STUDIO</span></div><nav style="display:flex;gap:34px">{nav}</nav>'
            f'<div style="display:flex;gap:18px;align-items:center"><a href="#" style="font-size:13px;color:{t["sub"]}">Sign in</a><a href="#" class="b" style="padding:11px 20px;font-size:13px">Start free</a></div></div></header>')

def footer(t):
    return (f'<footer class="w" style="padding-top:44px;padding-bottom:44px;display:flex;justify-content:space-between;align-items:center;gap:24px;font-size:11.5px;color:{t["mute"]}">'
            f'<span style="font-family:{t["dfont"]};font-weight:600;letter-spacing:.14em;font-size:14px">TEAM 47 STUDIO</span><span>{COMPLY} · Privacy · Terms · AI disclosure</span>'
            f'<span>© 2026 MGT Solutions, Inc. d/b/a Team47Studio</span></footer>')

def landing(t):
    A = lambda x: f'<span class="a">{x}</span>'
    A2 = lambda x: f'<span class="a2">{x}</span>'
    body = (header(t) + hero(t)
            + sec(t, 1, 'Skincare', f'{A("Know")} your skin. Build what it needs.', skin_body(t))
            + sec(t, 2, 'The studio', f'Six tools. {A2("One studio.")}', tools_body(t), True)
            + sec(t, 3, 'AI Coach', f'{A("Ask")} your AI Coach.', coach_body(t))
            + sec(t, 4, 'Plans', f'Start {A("free.")} Upgrade when ready.', plans_body(t), True)
            + cta_band(t) + footer(t))
    return doc(t, f"{t['id']} {t['name']} · Web", body, 1280, 3000, True)

# ───────────────────────── phone screens ─────────────────────────
def sbar(t):
    return (f'<div style="height:44px;padding:0 22px;display:flex;align-items:center;justify-content:space-between"><span style="font-size:12px;font-weight:600">9:41</span>'
            f'<div style="width:23px;height:11px;border:1.3px solid {t["sub"]};border-radius:3px;padding:1.5px"><div style="width:15px;height:100%;background:{t["text"]};border-radius:1px"></div></div></div>')

def tabbar(t, active):
    cells = ''
    for i, n in enumerate(TABS):
        on = i == active
        col = t['acc'] if on else t['mute']
        if t['tab'] == 'icon':
            cells += f'<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding-top:9px">{ico(i, col, 20, TABICON)}<span style="font-size:9.5px;font-weight:600;color:{col}">{n}</span></div>'
        else:
            cells += (f'<div style="flex:1;text-align:center;padding-top:12px;border-top:2px solid {t["text"] if on else "transparent"};margin-top:-1px">'
                      f'<span class="k" style="letter-spacing:.1em;color:{t["text"] if on else t["mute"]}">{n}</span></div>')
    return f'<div style="position:absolute;left:0;right:0;bottom:0;height:78px;background:{t["solid"]};border-top:{t["bw"]}px solid {t["line"]};display:flex">{cells}</div>'

def phead(t, title, right=''):
    bb = f'{t["bw"]+1}px solid {t["text"]}' if t['tab'] == 'text' else f'1px solid {t["line"]}'
    return (f'<div style="padding:4px 20px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:{bb}">'
            f'<div style="font-family:{t["dfont"]};font-weight:{max(t["dw"],600)};font-size:15px;letter-spacing:.14em;text-transform:uppercase">{title}</div>{right}</div>')

def p_home(t):
    av = f'<div style="width:30px;height:30px;border-radius:{"50%" if t["rad"] else "0"};background:{t["acc"]};color:{t["onacc"]};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600">A</div>'
    if t['pv'] == 'grid':
        cells = ''.join(f'<div class="c" style="padding:13px 12px;box-shadow:none;{"border-color:"+t["acc"]+";" if i==0 else ""}">{ico(i, t["acc"] if i==0 else t["sub"], 18)}<div style="font-size:12.5px;font-weight:600;margin-top:9px">{n}</div></div>' for i, n in enumerate(SHORT))
        vert = f'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px">{cells}</div>'
    else:
        vert = ''.join(f'<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid {t["line"]}"><span class="k" style="width:18px;color:{t["acc"] if i==0 else t["mute"]}">{i+1:02d}</span>'
                       f'<span class="d" style="font-size:20px;line-height:1;flex:1;text-transform:none;letter-spacing:-0.01em">{n}</span><span style="color:{t["mute"]};font-size:14px">›</span></div>' for i, n in enumerate(TOOLS and [x[1] for x in TOOLS]))
    def xrow(k, title, note):
        return (f'<div class="c" style="display:flex;align-items:center;gap:12px;padding:12px 14px;margin-top:10px;box-shadow:none"><div style="flex:1"><div class="k" style="margin-bottom:4px">{k}</div>'
                f'<div style="font-size:13.5px;font-weight:600">{title}</div></div><span style="font-size:11.5px;color:{t["mute"]}">{note}</span><span style="color:{t["mute"]}">›</span></div>')
    extra = '<div style="height:6px"></div>' + xrow('Shop My Routine', 'Your PM cart is ready', '2 items')
    if t['pv'] == 'grid': extra += xrow('AI Coach · Premium', 'Ask about tonight\'s routine', '')
    seg = ''.join(f'<div style="flex:1;height:8px;border-radius:{min(t["rad"],4)}px;background:{t["acc"] if i<2 else t["bg2"]}"></div>' for i in range(6))
    return doc(t, f"{t['id']} · Home", f'''{sbar(t)}{phead(t, 'Team 47 Studio', av)}
<div style="padding:20px 20px 0"><div class="k" style="margin-bottom:8px">Good evening</div><div class="d" style="font-size:40px;margin-bottom:18px">Alex<span class="a">.</span></div>
<div class="c" style="padding:16px;margin-bottom:20px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span class="k" style="color:{t['mute']}">Tonight · PM routine</span><span class="k">2 of 6</span></div>
<div style="display:flex;gap:4px;margin-bottom:12px">{seg}</div><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:11.5px;color:{t['mute']}">Next step</div><div style="font-size:14px;font-weight:600;margin-top:2px">Vitamin C serum</div></div><a href="#" class="b" style="padding:9px 16px;font-size:12.5px">Continue</a></div></div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span class="k" style="color:{t['mute']}">Your studio</span><div style="display:flex;align-items:center;gap:7px"><span style="font-size:11.5px;color:{t['sub']}">Soft Autumn</span>{season(t, 10)}</div></div>{vert}{extra}</div>{tabbar(t, 0)}''', 390, 844, False)

def p_match(t):
    sq = t['sw'] == 'square'
    sw = ''.join(f'<div style="aspect-ratio:1;border-radius:{"0" if sq else "50%"};background:{c};'
                 f'{("outline:3px solid "+t["acc"]+";outline-offset:-3px;") if (i==SEL and sq) else ("box-shadow:0 0 0 3px "+t["bg"]+",0 0 0 5px "+t["acc"]+";" if i==SEL else "")}"></div>' for i, c in enumerate(TONES))
    grid = (f'<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0;margin:0 0 16px;border-top:{t["bw"]}px solid {t["line"]};border-bottom:{t["bw"]}px solid {t["line"]}">{sw}</div>' if sq
            else f'<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:13px;padding:0 20px;margin-bottom:18px">{sw}</div>')
    seg = ''.join(f'<div style="flex:1;height:5px;border-radius:99px;background:{t["acc"] if i<2 else t["bg2"]}"></div>' for i in range(4))
    back = f'<span style="font-size:18px;color:{t["sub"]}">‹</span>'
    return doc(t, f"{t['id']} · Skin Match", f'''{sbar(t)}{phead(t, 'Skin Match', back)}
<div style="padding:16px 20px 0"><div style="display:flex;justify-content:space-between;margin-bottom:9px"><span class="k">Step 2 of 4 · Tone</span><span class="k" style="color:{t['mute']}">~40s left</span></div><div style="display:flex;gap:4px;margin-bottom:24px">{seg}</div>
<div class="d" style="font-size:38px;margin-bottom:10px">What's your <span class="a">skin tone?</span></div><p style="font-size:13px;color:{t['sub']};line-height:1.6;margin:0 0 20px">Pick the swatch that reads closest. Natural daylight works best.</p></div>
{grid}<div style="padding:0 20px"><div class="c" style="display:flex;align-items:center;gap:12px;padding:12px 14px;box-shadow:none"><div style="width:30px;height:30px;border-radius:{'0' if sq else '50%'};background:{TONES[SEL]}"></div>
<div style="flex:1"><div style="font-size:13.5px;font-weight:600">Medium depth, warm</div><div style="font-size:11.5px;color:{t['mute']};margin-top:1px">Feeds makeup, hair colour and wardrobe</div></div><span style="color:{t['acc']};font-weight:700">✓</span></div>
<a href="#" style="display:block;text-align:center;font-size:13px;font-weight:600;color:{t['acc']};margin-top:14px">Not sure? Help me choose</a></div>
<div style="position:absolute;left:20px;right:20px;bottom:30px"><p style="font-size:10.5px;color:{t['mute']};text-align:center;margin:0 0 10px;font-style:italic">{COMPLY} No photo is stored.</p><a href="#" class="b" style="display:block">Continue</a></div>''', 390, 844, False)

def p_coach(t):
    r = min(t['rad'], 16)
    pill = f'<span class="k" style="border:1px solid {t["kcol"]};padding:4px 9px;border-radius:{t["crad"]}px">Premium</span>'
    feats = ''.join(f'<div style="display:flex;justify-content:space-between;font-size:13px;color:{t["sub"]};padding:10px 0;border-top:1px solid {t["line"]}"><span>{x}</span><span style="color:{t["acc"]}">✦</span></div>'
                    for x in ['Unlimited coaching, voice and text', 'Knows your profile and season', 'Shop My Routine cart'])
    return doc(t, f"{t['id']} · AI Coach", f'''{sbar(t)}{phead(t, 'AI Coach', pill)}
<div style="position:relative;padding:16px 20px 0"><div style="filter:blur(3px);display:flex;flex-direction:column;gap:10px">
<div style="align-self:flex-end;max-width:78%;background:{t['bg2']};border-radius:{r}px;padding:11px 14px;font-size:12.5px;line-height:1.5">My new cleanser leaves my skin feeling tight. What should I look for?</div>
<div style="max-width:86%;border:1px solid {t['line']};border-radius:{r}px;padding:11px 14px;font-size:12.5px;line-height:1.55;color:{t['sub']}">For a combination, low-sensitivity profile, tightness often points to a formula that is too stripping. Look for a gentle gel cleanser…</div>
<div style="align-self:flex-end;max-width:78%;background:{t['bg2']};border-radius:{r}px;padding:11px 14px;font-size:12.5px">Which toner suits Soft Autumn?</div></div>
<div style="position:absolute;inset:0;background:linear-gradient(to bottom,{t['bg']}00 0%,{t['bg']}CC 60%,{t['bg']} 100%)"></div></div>
<div style="padding:10px 20px 0"><div class="k" style="margin-bottom:10px">Unlock</div><div class="d" style="font-size:36px;margin-bottom:10px">Your coach, <span class="a">on call.</span></div>
<p style="font-size:13px;color:{t['sub']};line-height:1.6;margin:0 0 16px">Unlimited guidance from a coach that already knows your profile, season and routine history.</p>
<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:14px"><span class="d" style="font-size:46px;line-height:1;text-transform:none">$14.99</span><span style="font-size:12.5px;color:{t['mute']}">/ month · cancel any time</span></div>{feats}</div>
<div style="position:absolute;left:20px;right:20px;bottom:92px"><a href="#" class="b" style="display:block">Upgrade to Premium</a></div>{tabbar(t, 4)}''', 390, 844, False)

def p_routine(t):
    steps = [('Oil cleanse', 'Done · 8:14 PM', 2), ('Gel cleanse', 'Done · 8:17 PM', 2), ('Vitamin C serum', 'Now · 2–3 drops, avoid the eye area', 1),
             ('Hydrating toner', 'After the serum settles', 0), ('Barrier moisturiser', 'Seal in hydration', 0), ('Eye cream', 'Tap gently, inner corner out', 0)]
    rows = ''
    for i, (n, s, st) in enumerate(steps):
        numc = t['acc'] if st == 1 else t['mute']
        right = (f'<span style="color:{t["acc2"]};font-weight:700">✓</span>' if st == 2 else (f'<a href="#" class="b" style="padding:8px 14px;font-size:12px">Mark done</a>' if st == 1 else ''))
        hl = f'background:{t["acc"]}12;border-left:3px solid {t["acc"]};padding-left:12px;margin-left:-15px;' if st == 1 else ''
        rows += (f'<div style="display:flex;align-items:center;gap:13px;padding:13px 0;border-top:1px solid {t["line"]};{hl}"><span class="d" style="font-size:26px;width:22px;color:{numc};line-height:1">{i+1}</span>'
                 f'<div style="flex:1"><div style="font-size:14.5px;font-weight:600;{"text-decoration:line-through;color:"+t["mute"]+";" if st==2 else ""}">{n}</div><div style="font-size:11.5px;color:{t["acc"] if st==1 else t["mute"]};margin-top:2px">{s}</div></div>{right}</div>')
    tog = (f'<div style="display:flex;border:1px solid {t["line"]};border-radius:{t["brad"]}px;padding:3px;margin-bottom:18px"><div style="flex:1;text-align:center;padding:9px;font-size:13px;font-weight:600;color:{t["mute"]}">AM</div>'
           f'<div style="flex:1;text-align:center;padding:9px;font-size:13px;font-weight:600;background:{t["text"]};color:{t["bg"]};border-radius:{max(t["brad"]-3,0)}px">PM</div></div>')
    return doc(t, f"{t['id']} · Routine", f'''{sbar(t)}{phead(t, 'My Routine', f'<span class="k" style="color:{t["mute"]}">Edit</span>')}
<div style="padding:18px 20px 0">{tog}<div class="k" style="margin-bottom:8px">Evening · 2 of 6 done</div><div class="d" style="font-size:34px;margin-bottom:16px">Tonight's <span class="a">ritual.</span></div>{rows}
<div style="border-top:1px solid {t['line']};padding-top:12px;font-size:11.5px;color:{t['mute']}">You approve every change to your routine.</div></div>{tabbar(t, 0)}''', 390, 844, False)

def p_shop(t):
    items = [('Cleanser', 'Gentle gel cleanser', '98%', '$28', True), ('Serum', 'Vitamin C serum', '95%', '$46', True), ('Moisturiser', 'Barrier cream', '91%', '$34', False), ('Eye care', 'Peptide eye cream', '82%', '$42', False)]
    rows = ''.join(f'<div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-top:1px solid {t["line"]}"><div style="flex:1"><div style="display:flex;gap:8px;margin-bottom:5px"><span class="k" style="color:{t["mute"]}">{a}</span><span class="k">{m} match</span></div>'
                   f'<div style="font-size:15px;font-weight:600">{b}</div><div style="font-size:11px;color:{t["mute"]};margin-top:3px">Why: matches your skin type and PM step {i+1}</div></div><span class="d" style="font-size:24px;line-height:1">{p}</span>'
                   f'<div style="width:30px;height:30px;border-radius:{min(t["brad"],8)}px;display:flex;align-items:center;justify-content:center;font-weight:700;{"background:"+t["acc"]+";color:"+t["onacc"] if inc else "border:1px solid "+t["line"]+";color:"+t["mute"]}">{"✓" if inc else "+"}</div></div>'
                   for i, (a, b, m, p, inc) in enumerate(items))
    cart = f'<span class="k" style="border:1px solid {t["line"]};padding:5px 9px;border-radius:{t["crad"]}px;color:{t["sub"]}">Cart · 2</span>'
    return doc(t, f"{t['id']} · Shop", f'''{sbar(t)}{phead(t, 'Shop', cart)}
<div style="padding:18px 20px 0"><div class="k" style="margin-bottom:8px">Matched to your PM routine</div><div class="d" style="font-size:34px;margin-bottom:8px">Shop my <span class="a">routine.</span></div>
<p style="font-size:12.5px;color:{t['sub']};line-height:1.6;margin:0 0 14px">Your routine as a ready-made cart. Remove anything you already own.</p>{rows}
<div style="border-top:1px solid {t['line']};padding-top:10px;font-size:11px;color:{t['mute']}">Sample products for illustration. Retailer links open externally.</div></div>
<div style="position:absolute;left:0;right:0;bottom:78px;padding:12px 20px;background:{t['bg']};border-top:1px solid {t['line']};display:flex;align-items:center;justify-content:space-between">
<div><div style="font-size:11px;color:{t['mute']}">Subtotal · 2 items</div><div class="d" style="font-size:28px;line-height:1.1">$74</div></div><a href="#" class="b" style="padding:13px 26px">Checkout</a></div>{tabbar(t, 0)}''', 390, 844, False)

def main(out):
    os.makedirs(out, exist_ok=True)
    made = []
    for v in V + [FINAL]:
        t = prep(v)
        files = {'Web': landing(t), 'Home': p_home(t), 'Match': p_match(t), 'Coach': p_coach(t)}
        if v is FINAL:
            files.update({'Routine': p_routine(t), 'Shop': p_shop(t)})
        for k, html in files.items():
            fn = f"{t['id']}-{k}.dc.html"
            open(os.path.join(out, fn), 'w').write(html); made.append(fn)
    print(len(made), 'files')

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'out')
