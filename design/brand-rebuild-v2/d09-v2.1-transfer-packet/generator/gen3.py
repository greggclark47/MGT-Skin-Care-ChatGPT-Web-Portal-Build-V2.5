#!/usr/bin/env python3
"""Team 47 Studio brand rebuild v2: 10 end-to-end designs on the established logo, light + dark.
Usage: python3 gen3.py <outdir> [canvas|export]
  canvas -> logo src is the Design-canvas asset url; export -> relative assets/ path (Drive, GitHub, local)."""
import sys, os, re, json
sys.path.insert(0, '/home/claude/team47studio')
import gen, gen2
from gen import doc, tabbar, season, tonebar, ico, cta_row, steps3, proof, quizcard, TONES, SEL, SEASON, SHORT, TOOLS, COMPLY

LOGO = {'canvas': {'light': '/_blob/3ec60be0ee266c930b71f40c00b41e42', 'dark': '/_blob/44842e3bda7819a0fe54cfb39d8df64f'},
        'export': {'light': 'assets/team47studio-logo-light-surface.png', 'dark': 'assets/team47studio-logo-dark-surface.png'}}
TARGET = 'canvas'
PRISM = ['#19AFBE', '#6BBF3B', '#F0AE47', '#F08A3C', '#9040F8', '#1E88F8']
STEPS = gen2.STEPS

def logo(t, h):
    return f'<img src="{LOGO[TARGET]["dark" if t["dark"] else "light"]}" alt="Team 47 Studio" style="height:{h}px;width:auto;display:block">'

# ───────────── palettes (from the logo: navy #200068, blue #1E88F8, prism violet / cyan / lime / amber) ─────────────
ACC2 = {'blue': ('#0F6FDB', '#5AA9FF'), 'cyan': ('#0B7A86', '#3ED0DE'), 'green': ('#3F7A1A', '#9BD95A'), 'amber': ('#9A5B00', '#F0AE47'), 'navy': ('#200068', '#C9BEFF')}
def light(a2, **o):
    return dict(dict(bg='#FFFFFF', bg2='#F4F6FB', surf='#FFFFFF', text='#15172D', sub='#4E5872', mute='#687189', line='#DFE4EE', acc='#6540D4', acc2=ACC2[a2][0], onacc='#FFFFFF', panel='#EEEAFE', dark=False), **o)
def dark(a2, **o):
    return dict(dict(bg='#0B0D1A', bg2='#101327', surf='#171B33', text='#F3F4FA', sub='#B9BFD3', mute='#8E96B0', line='#2A2F4D', acc='#9A80FF', acc2=ACC2[a2][1], onacc='#0B0D1A', panel='#1B1740', dark=True), **o)

SANS = "system-ui,sans-serif"
D = [
 dict(id='D01', name='Prism', idea='One profile refracts into six uses, like the logo.', tag='One profile. Six ways to use it.', primary='light', a2='blue',
      hero='beams', hs='num', tools='cards', cta='invert', lead='profile', pv='grid', sw='circle', tab='icon', dfont=f"'Outfit',{SANS}", bfont=f"'Inter',{SANS}",
      fonts='Outfit:wght@400;500;600;700&family=Inter:wght@400;500;600', dw=600, accmode='color', rad=18, brad=12, h1=88, h2=54, shadow='0 14px 36px -26px rgba(32,0,104,.45)'),
 dict(id='D02', name='Match First', idea='The first Skin Match question is the homepage.', tag='Answer one question to begin', primary='light', a2='cyan',
      hero='panel', hs='pill', tools='tiles', cta='panel', lead='routine', pv='grid', sw='circle', tab='icon', dfont=f"'Plus Jakarta Sans',{SANS}", bfont=f"'Plus Jakarta Sans',{SANS}",
      fonts='Plus+Jakarta+Sans:wght@400;500;600;800', dw=800, accmode='color', rad=24, brad=999, h1=78, h2=50, track='-0.035em', dlh='1.02', shadow='0 16px 40px -28px rgba(32,0,104,.5)',
      L=dict(bg='#F6F8FC', bg2='#ECEFF7'), Dk=dict()),
 dict(id='D03', name='Routine Daily', idea='Tonight’s routine leads; everything else supports the habit.', tag='Your routine, one step at a time', primary='light', a2='green',
      hero='routine', hs='num', tools='rows', cta='invert', lead='routine', pv='list', sw='circle', tab='icon', dfont=f"'Sora',{SANS}", bfont=f"'Inter',{SANS}",
      fonts='Sora:wght@400;600;700&family=Inter:wght@400;500;600', dw=600, accmode='color', rad=12, brad=10, h1=76, h2=48, track='-0.035em', dlh='1.03'),
 dict(id='D04', name='Coach First', idea='A conversation is the front door.', tag='Ask first. Your studio answers.', primary='dark', a2='blue',
      hero='chat', hs='center', tools='cards', cta='panel', lead='coach', pv='grid', sw='circle', tab='icon', dfont=f"'DM Sans',{SANS}", bfont=f"'DM Sans',{SANS}",
      fonts='DM+Sans:wght@400;500;700', dw=700, accmode='color', rad=22, brad=999, h1=82, h2=52, track='-0.035em', dlh='1'),
 dict(id='D05', name='Colour Season', idea='Your palette comes first and drives every vertical.', tag='Find your season', primary='light', a2='amber',
      hero='season', hs='center', tools='tiles', cta='invert', lead='season', pv='grid', sw='circle', tab='icon', dfont=f"'Outfit',{SANS}", bfont=f"'Outfit',{SANS}",
      fonts='Outfit:wght@300;400;500;600', dw=500, accmode='color', rad=28, brad=999, h1=84, h2=54, L=dict(bg='#FBFAFF', bg2='#F2EFFB')),
 dict(id='D06', name='Shelf', idea='The ready-made cart is the hero: see it, then earn it with a profile.', tag='Your routine, ready to shop', primary='light', a2='cyan',
      hero='shelf', hs='pill', tools='cards', cta='panel', lead='shop', pv='list', sw='circle', tab='icon', dfont=f"'Manrope',{SANS}", bfont=f"'Manrope',{SANS}",
      fonts='Manrope:wght@400;600;800', dw=800, accmode='color', rad=14, brad=10, h1=76, h2=48, track='-0.04em', dlh='1.02', L=dict(bg='#F3F4F7', bg2='#E9EBF1'), shadow='0 10px 28px -22px rgba(21,23,45,.5)'),
 dict(id='D07', name='Editorial', idea='A magazine: masthead, chapters, authority.', tag='The studio issue', primary='dark', a2='blue',
      hero='masthead', hs='kicker', tools='cells', cta='invert', lead='routine', pv='list', sw='square', tab='text', dfont="'Bodoni Moda','Didot',Georgia,serif", bfont=f"'Inter',{SANS}",
      fonts='Bodoni+Moda:ital,wght@0,500;0,700;1,400&family=Inter:wght@400;500;600;700', dw=700, accmode='italic', tt='uppercase', rad=0, brad=0, crad=0, h1=116, h2=72, dlh='.9', track='-0.035em',
      Dk=dict(bg='#000000', bg2='#0A0A0A', surf='#0E0E0E', line='#2A2A2A'), L=dict(bg2='#F4F4F2')),
 dict(id='D08', name='Dashboard', idea='Show the data: every recommendation lists what it used.', tag='Transparent by design', primary='light', a2='cyan',
      hero='rail', hs='pill', tools='cards', cta='panel', lead='profile', pv='grid', sw='square', tab='icon', dfont=f"'Inter Tight','Inter',{SANS}", bfont=f"'Inter',{SANS}", kfont="'IBM Plex Mono',ui-monospace,monospace",
      fonts='Inter+Tight:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500', dw=600, accmode='color', rad=8, brad=6, crad=6, h1=72, h2=46, dlh='1.02', track='-0.03em', shadow='0 1px 2px rgba(15,26,42,.07)'),
 dict(id='D09', name='Card Grid', idea='A grid of live tiles: the whole product at a glance.', tag='Everything in one view', primary='dark', a2='amber',
      hero='bento', hs='pill', tools='tiles', cta='panel', lead='season', pv='grid', sw='circle', tab='icon', dfont=f"'Bricolage Grotesque','DM Sans',{SANS}", bfont=f"'DM Sans',{SANS}",
      fonts='Bricolage+Grotesque:wght@600;800&family=DM+Sans:wght@400;500;700', dw=800, accmode='color', rad=26, brad=999, h1=64, h2=50, dlh='1', track='-0.035em'),
 dict(id='D10', name='Calm', idea='As little as possible: whitespace, one action, quiet type.', tag='Less, clearly', primary='light', a2='navy',
      hero='center', hs='center', tools='rows', cta='invert', lead='routine', pv='list', sw='circle', tab='text', dfont=f"'Figtree',{SANS}", bfont=f"'Figtree',{SANS}",
      fonts='Figtree:wght@400;500;600', dw=500, accmode='color', rad=6, brad=999, h1=92, h2=56, track='-0.035em', dlh='1', L=dict(bg='#FBFBF9', bg2='#F3F3EF', line='#E3E3DC')),
]

def _lum(h):
    h = h.lstrip('#'); v = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2])

def contrast(a, b):
    a, b = _lum(a), _lum(b)
    return (max(a, b) + .05) / (min(a, b) + .05)

def aa(pal, mode, target=4.6):
    """Nudge secondary text and accent colours until they clear 4.5:1 on every ground they sit on."""
    pal = dict(pal); step = -3 if mode == 'light' else 3
    for k in ('mute', 'sub', 'acc', 'acc2'):
        for _ in range(60):
            if all(contrast(pal[k], pal[g]) >= target for g in ('bg', 'bg2', 'surf', 'panel')): break
            h = pal[k].lstrip('#'); v = [min(255, max(0, int(h[i:i + 2], 16) + step)) for i in (0, 2, 4)]
            pal[k] = '#%02X%02X%02X' % tuple(v)
    return pal

def tokens(d, mode):
    base = {k: v for k, v in d.items() if k not in ('L', 'Dk', 'a2', 'primary', 'idea')}
    pal = light(d['a2'], **d.get('L', {})) if mode == 'light' else dark(d['a2'], **d.get('Dk', {}))
    pal = aa(pal, mode)
    t = gen.prep(dict(base, plans='cards', **pal))
    t['hdr'] = t['bg']; t['mode'] = mode
    return t

# ───────────── patched shared pieces ─────────────
gen.sbar = gen2.sbar = lambda t: '<div style="height:16px"></div>'   # no fake device status bar

TIERS = [('Free', '$0', 'A practical starting point: build a profile and explore core guidance.',
          ['Saved profile and core Skin Match', 'Starter routine and reviewed education', 'Core colour and retail discovery', 'Sponsor-supported, clearly labelled'], False, 'Get started free'),
         ('Guided', '$14.99', 'Ongoing personalised support across routines, progress, colour and wardrobe.',
          ['Full personalised routines, updated every two weeks', 'Progress history and image journal', 'Connected colour, wardrobe and reminders', 'Account-aware AI guidance', 'Ad-free'], True, 'Choose Guided'),
         ('Studio', '[PRICE]', 'The most complete Team 47 Studio experience.',
          ['Everything in Guided', 'Highest AI depth and cross-domain synthesis', 'Advanced exports and trusted guest access', 'Priority support and early features'], False, 'Choose Studio')]
COMPARE = [('Profile and Skin Match', 'Saved profile and core match', 'Full personalised match', 'Full match with deeper synthesis'),
           ('Routine guidance', 'Starter routine', 'Personalised, updated every two weeks', 'Advanced end-to-end coordination'),
           ('AI guidance depth', 'Basic guidance preview', 'Standard account-aware guidance', 'Highest available depth'),
           ('Progress and photo journal', 'Current profile and routine', 'Progress history and image journal', 'Advanced history, journal and exports'),
           ('Colour, wardrobe and retail', 'Core colour and retail discovery', 'Connected colour, wardrobe and retail', 'Complete care, colour, style and retail'),
           ('Membership experience', 'Sponsor-supported, clearly labelled', 'Ad-free', 'Most complete, with early features'),
           ('Support', 'Standard self-service', 'Enhanced customer support', 'Priority customer support')]

def plans3(t):
    cols = ''
    for name, price, summ, items, pop, btn in TIERS:
        li = ''.join(f'<div style="display:flex;gap:10px;font-size:13.5px;color:{t["sub"]};padding:9px 0;border-top:1px solid {t["line"]};line-height:1.45"><span style="color:{t["acc"]};font-weight:700">✓</span>{x}</div>' for x in items)
        tagp = f'<span class="k" style="background:{t["acc"]};color:{t["onacc"]};padding:5px 10px;border-radius:{t["crad"]}px">Balanced start</span>' if pop else ''
        b = f'<a href="#" class="{"b" if pop else "b2"}" style="display:block;margin-top:22px">{btn}</a>'
        cols += (f'<div class="c" style="flex:1;padding:28px;display:flex;flex-direction:column;{"border-color:"+t["acc"]+";" if pop else ""}"><div style="display:flex;justify-content:space-between;align-items:center;min-height:26px;margin-bottom:10px"><div class="k">{name}</div>{tagp}</div>'
                 f'<div class="d" style="font-size:50px;line-height:1;margin-bottom:10px;text-transform:none">{price}<span style="font-family:{t["bfont"]};font-size:14px;font-weight:400;color:{t["mute"]};letter-spacing:0"> / month</span></div>'
                 f'<div style="font-size:13px;color:{t["sub"]};line-height:1.5;min-height:60px;margin-bottom:8px">{summ}</div><div style="flex:1">{li}</div>{b}</div>')
    tog = (f'<div style="display:inline-flex;border:1px solid {t["line"]};border-radius:{t["brad"]}px;padding:3px;margin-bottom:22px"><span style="padding:8px 18px;font-size:13px;font-weight:600;background:{t["text"]};color:{t["bg"]};border-radius:{max(min(t["brad"],99)-3,0)}px">Monthly</span>'
           f'<span style="padding:8px 18px;font-size:13px;font-weight:600;color:{t["sub"]}">Annual</span></div>')
    return (f'<div style="text-align:{"center" if t["hs"]=="center" else "left"}">{tog}</div><div style="display:flex;gap:18px;align-items:stretch;text-align:left">{cols}</div>'
            f'<p style="font-size:12px;color:{t["mute"]};margin:18px 0 0;text-align:left">Plan changes normally begin after the current paid period. Pricing and any amount due are shown before you confirm.</p>')
gen.plans_body = gen2.plans_body = plans3

def header(t):
    nav = ''.join(f'<a href="#" style="font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:{t["sub"]}">{x}</a>' for x in ['Skin', 'Colour', 'Style', 'Coach', 'Membership'])
    bb = f'{t["bw"]+2}px solid {t["text"]}' if t['hero'] == 'masthead' else f'{t["bw"]}px solid {t["line"]}'
    return (f'<header style="position:sticky;top:0;z-index:50;background:{t["bg"]};border-bottom:{bb}"><div class="w" style="height:96px;display:flex;align-items:center;justify-content:space-between">'
            f'<a href="#" aria-label="Team 47 Studio home">{logo(t, 64)}</a><nav style="display:flex;gap:32px">{nav}</nav>'
            f'<div style="display:flex;gap:18px;align-items:center"><a href="#" style="font-size:13px;color:{t["sub"]}">Sign in</a><a href="#" class="b" style="padding:12px 20px;font-size:13px">Start free</a></div></div></header>')
def footer(t):
    return (f'<footer style="background:{t["bg"]}"><div class="w" style="padding-top:36px;padding-bottom:40px;display:flex;justify-content:space-between;align-items:center;gap:24px;font-size:11.5px;color:{t["mute"]}">'
            f'{logo(t, 46)}<span>{COMPLY} · Privacy · Terms · AI disclosure</span><span>© 2026 MGT Solutions, Inc. d/b/a Team47Studio</span></div></footer>')
gen.header = gen2.header = header; gen.footer = gen2.footer = footer

def cta_band(t):
    sub = 'Free to start. Your first result before you create an account.'
    if t['cta'] == 'invert':
        return (f'<section style="background:{t["text"]};color:{t["bg"]};padding:92px 64px;text-align:center"><h2 class="d" style="font-size:{int(t["h2"]*1.3)}px;margin-bottom:20px">Your studio starts here.</h2>'
                f'<p style="font-size:16px;opacity:.75;max-width:440px;margin:0 auto 32px;line-height:1.7">{sub}</p><a href="#" class="b" style="background:{t["bg"]};color:{t["text"]};border-color:{t["bg"]}">Start my Skin Match</a></section>')
    return (f'<section class="w" style="padding-top:20px;padding-bottom:80px"><div style="background:{t["acc"]};color:{t["onacc"]};border-radius:{int(t["rad"]*1.4)}px;padding:80px 60px;text-align:center">'
            f'<h2 class="d" style="font-size:{int(t["h2"]*1.3)}px;margin-bottom:20px">Your studio starts here.</h2><p style="font-size:16px;opacity:.85;max-width:440px;margin:0 auto 32px;line-height:1.7">{sub}</p>'
            f'<a href="#" class="b" style="background:{t["onacc"]};color:{t["acc"]};border-color:{t["onacc"]}">Start my Skin Match</a></div></section>')
gen.cta_band = cta_band

# ───────────── new hero concepts ─────────────
H1 = 'Care, <span class="a">colour,</span><br>and style.<br><span class="a2">Connected.</span>'
SUB = 'One studio for your skin, your palette and your wardrobe, built from your own profile and not a generic average.'
def lead_text(t, w='52%'):
    return f'<div style="flex:0 0 {w}">{gen.badge(t)}<h1 class="d" style="font-size:{t["h1"]}px;margin-bottom:26px">{H1}</h1><p class="p" style="font-size:17px;max-width:480px">{SUB}</p><div style="height:30px"></div>{cta_row(t)}</div>'

def h_beams(t):
    ys = [22 + 54 * i for i in range(6)]
    lines = ''.join(f'<path d="M0 157 C60 157 60 {y} 120 {y}" stroke="{PRISM[i]}" stroke-width="2.5" fill="none" stroke-linecap="round"/>' for i, y in enumerate(ys))
    pills = ''.join(f'<div class="c" style="display:flex;align-items:center;gap:10px;height:44px;padding:0 16px;box-shadow:none;border-color:{PRISM[i]}">{ico(i, t["text"], 18)}<span style="font-size:13.5px;font-weight:600">{n}</span></div>' for i, n in enumerate([x[1] for x in TOOLS]))
    prof = (f'<div class="c" style="width:188px;padding:18px"><div class="k" style="color:{t["mute"]};margin-bottom:10px">Your profile</div><div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span style="width:34px;height:34px;border-radius:50%;background:{TONES[SEL]}"></span>'
            f'<div style="font-size:13px;font-weight:600;line-height:1.3">Combination<br>warm · 07</div></div><div class="k" style="color:{t["mute"]};margin-bottom:7px">Soft Autumn</div>{season(t, 16)}</div>')
    return f'''<section class="w" style="padding-top:88px;padding-bottom:72px;display:flex;gap:48px;align-items:center">{lead_text(t)}
<div style="flex:1;display:flex;align-items:center;justify-content:flex-end">{prof}<svg width="120" height="314" viewBox="0 0 120 314" aria-hidden="true">{lines}</svg><div style="display:flex;flex-direction:column;gap:10px">{pills}</div></div></section>{proof(t)}'''

def h_routine(t):
    seg = ''.join(f'<div style="flex:1;height:8px;border-radius:4px;background:{t["acc"] if i<2 else t["bg2"]}"></div>' for i in range(6))
    rows = ''.join(f'<div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-top:1px solid {t["line"]}"><span class="d" style="font-size:22px;width:20px;color:{t["acc"] if i==2 else t["mute"]}">{i+1}</span>'
                   f'<span style="flex:1;font-size:14.5px;font-weight:600;{"text-decoration:line-through;color:"+t["mute"]+";" if i<2 else ""}">{s}</span>'
                   f'{"<span style=\'color:"+t["acc2"]+";font-weight:700\'>✓</span>" if i<2 else ("<a href=\'#\' class=\'b\' style=\'padding:9px 16px;font-size:12.5px\'>Mark done</a>" if i==2 else "")}</div>' for i, s in enumerate(STEPS))
    return f'''<section class="w" style="padding-top:88px;padding-bottom:72px;display:flex;gap:56px;align-items:center">{lead_text(t)}
<div class="c" style="flex:1;padding:28px"><div style="display:flex;justify-content:space-between;margin-bottom:12px"><span class="k" style="color:{t['mute']}">Tonight · PM routine</span><span class="k">2 of 6 done</span></div><div style="display:flex;gap:5px;margin-bottom:12px">{seg}</div>{rows}
<div style="border-top:1px solid {t['line']};padding-top:12px;font-size:12px;color:{t['mute']}">A sample routine. Yours is built from your Skin Match.</div></div></section>{proof(t)}'''

def h_chat(t):
    sug = ''.join(f'<span class="chip" style="padding:9px 15px;font-size:13px">{x}</span>' for x in ['What order do I layer in?', 'Which colours suit me?', 'Build my evening routine'])
    return f'''<section class="w" style="padding-top:92px;padding-bottom:72px;text-align:center">{gen.badge(t)}<h1 class="d" style="font-size:{t['h1']}px;margin-bottom:24px">Care, <span class="a">colour,</span> and style.<br><span class="a2">Connected.</span></h1>
<p class="p" style="font-size:17px;max-width:560px;margin:0 auto 34px">{SUB}</p>
<div class="c" style="max-width:780px;margin:0 auto 26px;padding:22px;text-align:left"><div style="display:flex;gap:12px;align-items:center;margin-bottom:16px"><div style="flex:1;border:1px solid {t['line']};border-radius:{t['brad']}px;padding:16px 20px;font-size:15.5px;color:{t['mute']};background:{t['bg']}">Ask about your skin, colour or style…</div><a href="#" class="b" style="padding:16px 26px">Ask</a></div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">{sug}</div>
<div style="border-top:1px solid {t['line']};padding-top:16px;display:flex;gap:12px"><div style="width:32px;height:32px;border-radius:50%;background:{t['acc']};flex-shrink:0"></div><div style="font-size:14px;color:{t['sub']};line-height:1.6">A general answer comes first. Take the one-minute Skin Match and the coach answers from your own profile, and says what each answer was based on.</div></div></div>
{cta_row(t, True)}</section>{proof(t)}'''

SEASONS = [('Light Spring', ['#F7D9B5', '#F4B6A0', '#B9DDB0', '#8FC9E0']), ('True Spring', ['#F5C24C', '#F08A5D', '#7FC66B', '#3FB6C6']), ('Bright Spring', ['#FF6F61', '#FFC233', '#2EC4A6', '#3A86FF']),
           ('Light Summer', ['#F3CFE0', '#C8D9F0', '#BFE3DC', '#D9C7EC']), ('True Summer', ['#8FA8D6', '#C58DB0', '#7FB7B2', '#9C8FC8']), ('Soft Summer', ['#A9A3B8', '#8FA3A6', '#C4A2A8', '#7D8FA8']),
           ('Soft Autumn', SEASON[:4]), ('True Autumn', ['#C2671F', '#8A6A1E', '#6F7F3A', '#A8452D']), ('Deep Autumn', ['#6B2E1C', '#3F4F2C', '#8C4A1C', '#4A2B3A']),
           ('Deep Winter', ['#1F2A5C', '#5A1238', '#0F4C4A', '#2B2B2F']), ('True Winter', ['#1E4FD8', '#C4124F', '#0B8F8A', '#111111']), ('Bright Winter', ['#E6007E', '#0057FF', '#00B3A4', '#7A1FE0'])]
def h_season(t):
    cards = ''
    for n, cols in SEASONS:
        on = n == 'Soft Autumn'
        sw = ''.join(f'<span style="flex:1;height:44px;background:{c}"></span>' for c in cols)
        cards += (f'<div class="c" style="padding:0;overflow:hidden;box-shadow:none;{"border:2px solid "+t["acc"]+";" if on else ""}"><div style="display:flex">{sw}</div>'
                  f'<div style="padding:10px 12px;display:flex;justify-content:space-between;align-items:center;font-size:12.5px;font-weight:600">{n}{"<span class=\'k\'>Yours</span>" if on else ""}</div></div>')
    return f'''<section class="w" style="padding-top:88px;padding-bottom:72px;text-align:center">{gen.badge(t)}<h1 class="d" style="font-size:{t['h1']}px;margin-bottom:24px">Care, <span class="a">colour,</span> and style.<br><span class="a2">Connected.</span></h1>
<p class="p" style="font-size:17px;max-width:560px;margin:0 auto 32px">{SUB}</p>{cta_row(t, True)}
<div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-top:52px;text-align:left">{cards}</div>
<div style="font-size:12.5px;color:{t['mute']};margin-top:16px">Twelve seasons. Yours guides makeup, hair colour and wardrobe: a nudge, never a rule.</div></section>{proof(t)}'''

def h_shelf(t):
    items = [('Cleanser', 'Gentle gel cleanser', '98%', '$28'), ('Serum', 'Vitamin C serum', '95%', '$46'), ('Moisturiser', 'Barrier cream', '91%', '$34')]
    rows = ''.join(f'<div style="display:flex;align-items:center;gap:14px;padding:14px 0;border-top:1px solid {t["line"]}"><div style="width:44px;height:56px;border-radius:{min(t["rad"],10)}px;background:{PRISM[i*2]}33;flex-shrink:0"></div>'
                   f'<div style="flex:1"><div style="display:flex;gap:8px;margin-bottom:4px"><span class="k" style="color:{t["mute"]}">{a}</span><span class="k">{m} match</span></div><div style="font-size:15px;font-weight:600">{b}</div>'
                   f'<div style="font-size:11.5px;color:{t["mute"]};margin-top:2px">Why: fits your skin type and PM step {i+1}</div></div><span class="d" style="font-size:24px">{p}</span></div>' for i, (a, b, m, p) in enumerate(items))
    return f'''<section class="w" style="padding-top:88px;padding-bottom:72px;display:flex;gap:56px;align-items:center">{lead_text(t)}
<div class="c" style="flex:1;padding:28px"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="k">Shop My Routine</span><span class="k" style="color:{t['mute']}">Sample cart</span></div>{rows}
<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid {t['line']};padding-top:16px"><div><div style="font-size:12px;color:{t['mute']}">3 items · remove anything you own</div><div class="d" style="font-size:32px">$108</div></div><a href="#" class="b2">See how it is built</a></div></div></section>{proof(t)}'''

def h_bento(t):
    tile = lambda col, body, span='': f'<div style="background:{col};border-radius:{t["rad"]}px;padding:24px;{span}">{body}</div>'
    tint = lambda i: PRISM[i] + ('30' if t['dark'] else '26')
    sw = ''.join(f'<span style="width:26px;height:26px;border-radius:50%;background:{c};{"box-shadow:0 0 0 2px "+t["bg"]+",0 0 0 4px "+t["acc"]+";" if i==2 else ""}"></span>' for i, c in enumerate(TONES[2:13:2]))
    a = (f'<div style="display:flex;flex-direction:column;height:100%">{gen.badge(t)}<h1 class="d" style="font-size:{t["h1"]}px;margin-bottom:18px">{H1}</h1>'
         f'<p class="p" style="max-width:440px;margin-bottom:auto">{SUB}</p><div style="margin-top:22px">{cta_row(t)}</div></div>')
    b = f'<div class="k" style="margin-bottom:12px">Skin Match · about a minute</div><div class="d" style="font-size:26px;margin-bottom:16px">What’s your skin tone?</div><div style="display:flex;gap:9px">{sw}</div>'
    c = f'<div class="k" style="margin-bottom:12px">Your season</div><div class="d" style="font-size:26px;margin-bottom:14px">Soft Autumn</div>{season(t, 22)}'
    d_ = f'<div class="k" style="margin-bottom:12px">Tonight · PM</div><div class="d" style="font-size:44px;line-height:1">2<span style="font-size:22px;color:{t["sub"]}"> / 6</span></div><div style="font-size:13px;color:{t["sub"]};margin-top:8px">Next: Vitamin C serum</div>'
    e = f'<div class="k" style="margin-bottom:12px">AI Coach</div><div style="font-size:15px;font-weight:600;line-height:1.45">“Should I move vitamin C to the morning?”</div><div style="font-size:12px;color:{t["sub"]};margin-top:10px">Answers list what they used.</div>'
    f_ = f'<div class="k" style="margin-bottom:12px">Membership</div><div class="d" style="font-size:26px;margin-bottom:8px">Free · Guided · Studio</div><div style="font-size:13px;color:{t["sub"]}">Start free. Upgrade when ready.</div>'
    return f'''<section class="w" style="padding-top:32px;padding-bottom:60px"><div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:minmax(196px,auto);gap:16px">
{tile(t['surf'], a, f'grid-column:span 2;grid-row:span 3;border:1px solid {t["line"]};padding:36px;')}{tile(tint(0), b, 'grid-column:span 2;')}{tile(tint(2), c)}{tile(tint(4), d_)}{tile(tint(5), e)}{tile(tint(1), f_)}</div></section>{proof(t)}'''

NEW = dict(beams=h_beams, routine=h_routine, chat=h_chat, season=h_season, shelf=h_shelf, bento=h_bento)
_hero = gen.hero
gen.hero = lambda t: NEW[t['hero']](t) if t['hero'] in NEW else _hero(t)

# ───────────── app screens rebuilt for this round ─────────────
def app_head(t, right=''):
    return f'<div style="padding:4px 20px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid {t["line"]}">{logo(t, 50)}{right}</div>'

def p_home(t):
    L_, S_, M_, A_ = t['line'], t['sub'], t['mute'], t['acc']
    av = f'<div style="width:36px;height:36px;border-radius:{"50%" if t["rad"] else "0"};background:{A_};color:{t["onacc"]};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600">A</div>'
    seg = ''.join(f'<div style="flex:1;height:8px;border-radius:{min(t["rad"],4)}px;background:{A_ if i<2 else t["bg2"]}"></div>' for i in range(6))
    k = t['lead']
    if k == 'coach':
        lead = (f'<div class="c" style="padding:16px;margin-bottom:18px"><div class="k" style="margin-bottom:10px">AI Coach · preview</div><div style="border:1px solid {L_};border-radius:{t["brad"]}px;padding:13px 16px;font-size:14px;color:{M_};margin-bottom:10px;background:{t["bg"]}">Ask about tonight’s routine…</div>'
                f'<div style="display:flex;gap:6px;flex-wrap:wrap"><span class="chip">Layering order</span><span class="chip">Swap a step</span></div></div>')
    elif k == 'season':
        sw = ''.join(f'<span style="flex:1;height:38px;background:{c}"></span>' for c in SEASON)
        lead = (f'<div class="c" style="padding:0;overflow:hidden;margin-bottom:18px"><div style="display:flex">{sw}</div><div style="padding:14px 16px"><div class="k" style="margin-bottom:6px">Your season</div>'
                f'<div class="d" style="font-size:26px;margin-bottom:4px">Soft Autumn</div><div style="font-size:12px;color:{S_}">Guides makeup, hair colour and wardrobe.</div></div></div>')
    elif k == 'shop':
        lead = (f'<div class="c" style="padding:16px;margin-bottom:18px"><div class="k" style="margin-bottom:8px">Shop My Routine</div><div class="d" style="font-size:24px;margin-bottom:10px">Your PM cart is ready.</div>'
                f'<div style="display:flex;justify-content:space-between;align-items:center"><div><span class="d" style="font-size:26px">$74</span><span style="font-size:12px;color:{M_}"> · 2 items</span></div><a href="#" class="b" style="padding:11px 18px;font-size:13px">Review cart</a></div></div>')
    elif k == 'profile':
        r = lambda a, b, c='': f'<div style="display:flex;justify-content:space-between;font-size:13px;padding:8px 0;border-top:1px solid {L_}"><span class="k" style="color:{M_}">{a}</span><span style="font-weight:600;color:{c or t["text"]}">{b}</span></div>'
        lead = (f'<div class="c" style="padding:14px 16px;margin-bottom:18px"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><span class="k">Your profile</span><span class="k" style="color:{M_}">91% confidence</span></div>'
                f'{r("Skin", "Combination · warm · 07")}{r("Season", "Soft Autumn", t["acc2"])}{r("Tonight", "2 of 6 steps done")}</div>')
    else:
        lead = (f'<div class="c" style="padding:16px;margin-bottom:18px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span class="k" style="color:{M_}">Tonight · PM routine</span><span class="k">2 of 6</span></div>'
                f'<div style="display:flex;gap:4px;margin-bottom:12px">{seg}</div><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:11.5px;color:{M_}">Next step</div><div style="font-size:14px;font-weight:600;margin-top:2px">Vitamin C serum</div></div><a href="#" class="b" style="padding:11px 18px;font-size:13px">Continue</a></div></div>')
    if t['pv'] == 'grid':
        cells = ''.join(f'<div class="c" style="padding:13px 12px;box-shadow:none;{"border-color:"+A_+";" if i==0 else ""}">{ico(i, A_ if i==0 else S_, 18)}<div style="font-size:12.5px;font-weight:600;margin-top:9px">{n}</div></div>' for i, n in enumerate(SHORT))
        vert = f'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px">{cells}</div>'
    else:
        vert = ''.join(f'<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid {L_}"><span class="k" style="width:18px;color:{A_ if i==0 else M_}">{i+1:02d}</span>'
                       f'<span class="d" style="font-size:19px;line-height:1;flex:1;text-transform:none;letter-spacing:-0.01em">{x[1]}</span><span style="color:{M_}">›</span></div>' for i, x in enumerate(TOOLS))
    def xrow(a, b, c):
        return (f'<div class="c" style="display:flex;align-items:center;gap:12px;padding:12px 14px;margin-top:10px;box-shadow:none"><div style="flex:1"><div class="k" style="margin-bottom:4px">{a}</div>'
                f'<div style="font-size:13.5px;font-weight:600">{b}</div></div><span style="font-size:11.5px;color:{M_}">{c}</span><span style="color:{M_}">›</span></div>')
    extras = []
    if k not in ('routine',): extras.append(xrow('Tonight · PM routine', 'Next: Vitamin C serum', '2 of 6'))
    if k != 'shop': extras.append(xrow('Shop My Routine', 'Your PM cart is ready', '2 items'))
    extra = ''.join(extras[:(2 if t['pv'] == 'grid' else 1)])
    return doc(t, f"{t['id']} · App · Home ({t['mode']})", f'''{gen.sbar(t)}{app_head(t, av)}
<div style="padding:18px 20px 0"><div class="k" style="margin-bottom:6px">Good evening</div><div class="d" style="font-size:36px;margin-bottom:16px">Alex<span class="a">.</span></div>{lead}
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span class="k" style="color:{M_}">Your studio</span><span style="font-size:11.5px;color:{S_}">One profile feeds all six</span></div>{vert}{extra}</div>{tabbar(t, 0)}''', 390, 844, False)

def a_welcome(t):
    pts = ''.join(f'<div style="display:flex;gap:12px;align-items:center;padding:13px 0;border-top:1px solid {t["line"]}"><span class="k" style="width:22px">{i+1:02d}</span><span style="font-size:14.5px;font-weight:600;flex:1">{a}</span><span style="font-size:12px;color:{t["mute"]}">{b}</span></div>'
                  for i, (a, b) in enumerate([('Answer a few questions', 'about a minute'), ('See your profile and season', 'before sign-up'), ('Get your routine', 'free to start')]))
    dots = ''.join(f'<span style="width:24px;height:24px;border-radius:50%;background:{c}"></span>' for c in TONES[1:14:2])
    return doc(t, f"{t['id']} · App · Welcome", f'''{gen.sbar(t)}<div style="padding:14px 22px 18px">{logo(t, 60)}</div>
<div style="margin:0 16px;border-radius:{min(t['rad'],24)}px;background:{t['panel']};padding:26px 24px"><div class="d" style="font-size:44px;margin-bottom:14px">Care, <span class="a">colour,</span><br>and style.<br><span class="a2">Connected.</span></div>
<p style="font-size:14px;color:{t['sub']};line-height:1.6;margin:0 0 18px">One studio for your skin, your palette and your wardrobe, built from your own profile.</p><div style="display:flex;gap:6px">{dots}</div></div>
<div style="padding:16px 22px 0">{pts}<div style="border-top:1px solid {t['line']};padding-top:12px;font-size:11px;color:{t['mute']};font-style:italic">{COMPLY}</div></div>
<div style="position:absolute;left:20px;right:20px;bottom:66px"><a href="#" class="b" style="display:block">Start my Skin Match</a></div>
<a href="#" style="position:absolute;left:0;right:0;bottom:18px;text-align:center;font-size:13.5px;font-weight:600;color:{t['acc']};padding:12px 0">I already have an account</a>''', 390, 844, False)

def p_coach(t):
    r = min(t['rad'], 16)
    pill = f'<span class="k" style="border:1px solid {t["kcol"]};padding:5px 10px;border-radius:{t["crad"]}px">Free preview</span>'
    feats = ''.join(f'<div style="display:flex;justify-content:space-between;font-size:13px;color:{t["sub"]};padding:10px 0;border-top:1px solid {t["line"]}"><span>{x}</span><span style="color:{t["acc"]};font-weight:700">✓</span></div>'
                    for x in ['Answers that use your profile and season', 'Routines updated every two weeks', 'Progress history and image journal'])
    return doc(t, f"{t['id']} · App · Coach preview", f'''{gen.sbar(t)}{gen.phead(t, 'AI Coach', pill)}
<div style="padding:16px 20px 0;display:flex;flex-direction:column;gap:10px"><div style="align-self:flex-end;max-width:80%;background:{t['bg2']};border-radius:{r}px;padding:11px 14px;font-size:13.5px;line-height:1.5">My new cleanser leaves my skin feeling tight. What should I look for?</div>
<div style="max-width:90%;background:{t['surf']};border:1px solid {t['line']};border-radius:{r}px;padding:12px 14px;font-size:13.5px;line-height:1.55;color:{t['sub']}">Tightness after cleansing often points to a formula that is too stripping. A gentle gel cleanser is a common place to start.
<div style="font-family:{t['kfont']};font-size:9.5px;letter-spacing:.08em;color:{t['mute']};margin-top:8px;text-transform:uppercase">General guidance · not yet using your profile</div></div></div>
<div style="padding:20px 20px 0"><div class="c" style="padding:18px"><div class="k" style="margin-bottom:8px">Guided</div><div class="d" style="font-size:30px;margin-bottom:8px">Make it <span class="a">yours.</span></div>
<p style="font-size:13px;color:{t['sub']};line-height:1.55;margin:0 0 10px">Guided answers from your own profile, season and routine history, and says what each answer was based on.</p>{feats}
<a href="#" class="b" style="display:block;margin-top:14px">See Guided and Studio</a></div></div>{tabbar(t, 4)}''', 390, 844, False)

def w_plans(t):
    hd = ''.join(f'<div style="flex:1;padding:14px 16px" class="k">{n}</div>' for n in ['', 'Free', 'Guided', 'Studio'])
    rows = ''.join(f'<div style="display:flex;border-top:1px solid {t["line"]}">' + ''.join(f'<div style="flex:1;padding:16px;font-size:13.5px;line-height:1.5;color:{t["text"] if j==0 else t["sub"]};font-weight:{600 if j==0 else 400}">{c}</div>' for j, c in enumerate(r)) + '</div>' for r in COMPARE)
    body = header(t) + f'''<section class="w" style="padding-top:68px;padding-bottom:64px"><div style="text-align:center"><div class="k" style="margin-bottom:14px">Membership</div><h1 class="d" style="font-size:{int(t['h2']*1.35)}px;margin-bottom:16px">Start <span class="a">free.</span> Upgrade when ready.</h1>
<p class="p" style="max-width:560px;margin:0 auto 40px">Free is a real starting point. Guided adds ongoing personal support. Studio is the most complete experience.</p></div>{plans3(dict(t, hs='center'))}</section>
<section style="background:{t['bg2']};border-top:1px solid {t['line']}"><div class="w" style="padding-top:60px;padding-bottom:68px"><div class="k" style="margin-bottom:12px">Compare</div><h2 class="d" style="font-size:{int(t['h2']*.8)}px;margin-bottom:24px">What each tier includes.</h2>
<div class="c" style="overflow:hidden"><div style="display:flex;background:{t['bg2']}">{hd}</div>{rows}</div></div></section>''' + footer(t)
    return doc(t, f"{t['id']} · Web · Membership", body, 1280, 1700, True)

# ───────────── copy and brand post-processing ─────────────
REPL = [
 ('Premium members get unlimited voice or text access to a coach that already knows their profile, season and routine history. No re-explaining, and every answer says what it is based on.',
  'Guided members get a coach that already knows their profile, season and routine history. No re-explaining, and every answer says what it is based on. Free includes a preview.'),
 ('✦ &nbsp;Premium · $14.99 / month', 'Included with Guided and Studio'), ('AI Coach · Premium', 'AI Coach · Guided'),
 ('AI Coach and live voice are part of Premium, $14.99 a month.', 'Guided adds full personalised routines, progress history and account-aware coaching.'),
 ('>See Premium<', '>See Guided<'), ('Voice or text. It already knows', 'It already knows'), ('>Voice on<', '>Guided<'),
 ('Voice or text, and it already knows your profile.', 'It already knows your profile.'),
 ('Premium · $14.99 / month', 'Guided'), ('AI Coach, live voice, Shop My Routine', 'Biweekly routine updates, progress history, coaching'),
 (' Swatches only: no photo is stored.', ' Swatches only for this step.'), (' No photo is stored.', ''), ('Your answers and this result. No photo.', 'Your answers and this result.'),
 ('Answers and result. No photo.', 'Your answers and this result'), ('No photos stored. Results saved, swatches not.', 'What is saved, and your controls'), (' No camera needed.', ''),
 ('A few taps. No camera.', 'A few taps. Swatches, not selfies.'), ('A few taps, no camera.', 'A few taps, swatches only.'),
 ('>Free plan<', '>Free<'), ('Free plan · member since November', 'Free · member since November'), ('Free · manage or upgrade', 'Free · compare Guided and Studio'),
]
WM = re.compile(r'<(div|span) style="([^"]*)">TEAM 47 (?:<span[^>]*>)?STUDIO(?:</span>)?</\1>')
def finish(html, t):
    for a, b in REPL: html = html.replace(a, b)
    def wm(m):
        st = m.group(2); keep = ';'.join(re.findall(r'(?:padding|margin-bottom):[^;"]*', st))
        return f'<{m.group(1)} style="{keep}">{logo(t, 46)}</{m.group(1)}>'
    html = WM.sub(wm, html)
    html = re.sub(r'(<aside style="flex:0 0 244px;background:)#[0-9A-Fa-f]{6}', r'\g<1>' + t['bg'], html)
    assert 'TEAM 47' not in html and 'Premium' not in html and 'photo is stored' not in html, [x for x in ('TEAM 47', 'Premium', 'photo is stored') if x in html]
    return html

def use(t):
    for k, v in dict(t=t, L=t['line'], S=t['sub'], M=t['mute'], A=t['acc'], A2=t['acc2'], BG2=t['bg2']).items(): setattr(gen2, k, v)
    gen2.AMB = dict(bg='#2A2109', bd='#8A6A1E', fg='#F2C766') if t['dark'] else dict(bg='#FFF6E3', bd='#E9B949', fg='#8A5A00')

BOARDS = [('W1-Home', 'Web 1 · Homepage', 'web'), ('W1-Home-alt', 'Web 1 · Homepage ({alt} mode)', 'web'), ('W2-Result', 'Web 2 · Skin Match result', 'web'), ('W3-Portal', 'Web 3 · Portal home', 'web'), ('W4-Membership', 'Web 4 · Membership', 'web'),
          ('A01-Welcome', 'App 1 · Welcome', 'app'), ('A02-Match', 'App 2 · Skin Match', 'app'), ('A03-Result', 'App 3 · Result', 'app'), ('A04-Home', 'App 4 · Home', 'app'), ('A04-Home-alt', 'App 4 · Home ({alt} mode)', 'app'),
          ('A05-Routine', 'App 5 · Routine', 'app'), ('A06-Shop', 'App 6 · Shop My Routine', 'app'), ('A07-Makeup', 'App 7 · Makeup shade match', 'app'), ('A08-Lift', 'App 8 · Hair colour lift check', 'app'),
          ('A09-Style', 'App 9 · Style guidance', 'app'), ('A10-CoachPreview', 'App 10 · Coach preview (Free)', 'app'), ('A11-CoachChat', 'App 11 · Coach chat (Guided)', 'app'), ('A12-Profile', 'App 12 · Profile', 'app')]

def render(d):
    p, alt = d['primary'], ('dark' if d['primary'] == 'light' else 'light')
    tp, ta = tokens(d, p), tokens(d, alt)
    out = {}
    use(tp)
    out['W1-Home'] = gen.landing(tp); out['W2-Result'] = gen2.w_result(); out['W3-Portal'] = gen2.w_portal(); out['W4-Membership'] = w_plans(tp)
    out['A01-Welcome'] = a_welcome(tp); out['A02-Match'] = gen.p_match(tp); out['A03-Result'] = gen2.a_result(); out['A04-Home'] = p_home(tp)
    out['A05-Routine'] = gen.p_routine(tp); out['A06-Shop'] = gen.p_shop(tp); out['A07-Makeup'] = gen2.a_makeup(); out['A08-Lift'] = gen2.a_lift(); out['A09-Style'] = gen2.a_style()
    out['A10-CoachPreview'] = p_coach(tp); out['A11-CoachChat'] = gen2.a_chat(); out['A12-Profile'] = gen2.a_profile()
    res = {k: finish(v, tp) for k, v in out.items()}
    use(ta)
    res['W1-Home-alt'] = finish(gen.landing(ta), ta); res['A04-Home-alt'] = finish(p_home(ta), ta)
    return res, tp, ta

def main(out, target):
    global TARGET
    TARGET = target; os.makedirs(out, exist_ok=True)
    n = 0; toks = {}
    for d in D:
        res, tp, ta = render(d)
        for k, html in res.items():
            open(os.path.join(out, f"{d['id']}-{k}.dc.html"), 'w').write(html); n += 1
        keys = ['bg', 'bg2', 'surf', 'text', 'sub', 'mute', 'line', 'acc', 'acc2', 'onacc', 'panel']
        toks[d['id']] = dict(name=d['name'], idea=d['idea'], primary_mode=d['primary'], typography=dict(display=d['dfont'], body=d['bfont'], label=d.get('kfont', d['bfont']), google_fonts=d['fonts'], display_weight=d['dw']),
                             shape=dict(card_radius=d['rad'], button_radius=d['brad']), layout=dict(hero=d['hero'], sections=d['hs'], verticals=d['tools'], app_home_lead=d['lead'], app_tab_bar=d['tab']),
                             light={k: tokens(d, 'light')[k] for k in keys}, dark={k: tokens(d, 'dark')[k] for k in keys})
    json.dump(toks, open(os.path.join(out, 'tokens.json'), 'w'), indent=2)
    print(n, 'boards ->', out, target)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'canvas')
