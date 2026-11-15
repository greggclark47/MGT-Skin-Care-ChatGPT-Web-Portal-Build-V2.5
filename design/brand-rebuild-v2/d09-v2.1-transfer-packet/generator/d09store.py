#!/usr/bin/env python3
"""D09 Card Grid v2.1 — Google Play + App Store boards: feature graphic, 6 screenshots x dark/light, listing boards.
Usage: python3 d09store.py <outdir> [canvas|export]"""
import sys, os, re, json
sys.path.insert(0, '/home/claude/team47studio'); sys.path.insert(0, '/home/claude/team47studio/v2')
import d09 as W, d09app as APP
import gen, gen3, d09lib as Z
from gen import COMPLY

SHOTS = [('A03-Result', ['Your profile,', 'before sign-up.'], 'See your result first. Every answer stays editable.'),
         ('A04-Home', ['Your whole studio', 'on one screen.'], 'Skin, makeup, hair, color, style and clothing.'),
         ('A05-Routine', ['Steps in', 'your order.'], 'Updated as you go. You approve every change.'),
         ('A07-Makeup', ['Shades matched', 'to your depth.'], 'Ranges that do not fit are left out, not forced.'),
         ('A11-CoachChat', ['Answers that say', 'what they used.'], 'Guided members get a coach that knows their profile.'),
         ('A09-Style', ['Wear what you like,', 'guided by color.'], 'Preferences, never rules.')]
STORE = {'apple': dict(w=402, h=874, plat='ios', s=.80, band=190, top=176, head=38, subsz=14, tag='AS', label='App Store'),
         'play': dict(w=360, h=640, plat='android', s=.70, band=140, top=124, head=30, subsz=12.5, tag='GP', label='Google Play')}
ASSET_URL = {}   # name -> served url for the canvas target (filled from assets_map.json when present)
def asset(name):
    return ASSET_URL.get(name) or f'./assets/{name}'

def shell(t, title, w, h, css, body):
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
{body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
  renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
"""

def compose(store, t, idx, screen, head, sub):
    S = STORE[store]; p = APP.PLATS[S['plat']]
    html = APP.render_app(S['plat'], t['mode'], only=[screen])[screen]
    css = re.search(r'<style>\n(.*?)\n</style>', html, re.S).group(1)
    inner = re.search(r'<div class="r">\n(.*)\n</div>\n</x-dc>', html, re.S).group(1)
    s = S['s']; pw, ph = round(p['w'] * s) + 16, round(p['h'] * s) + 16; left = (S['w'] - pw) // 2
    disc = idx in (5, 6)
    def bandhtml(tz):
        d = f'<div style="font-size:10.5px;color:{tz["mute"]};margin-top:6px">{COMPLY}</div>' if disc else ''
        return (f'<div style="padding:{22 if store == "apple" else 16}px 20px 0;text-align:center"><div class="d" style="font-size:{S["head"]}px;line-height:1.03;color:{tz["text"]}">{head[0]}<br><span class="a">{head[1]}</span></div>'
                f'<div style="font-size:{S["subsz"]}px;color:{tz["sub"]};line-height:1.4;margin-top:8px">{sub}</div>{d}</div>')
    band = Z.pz(t, S['w'], S['band'], bandhtml, ground=t['panel'], cell=64, seed=100 + idx, lo=.1, hi=.22, flow=(1, .4), label=f'{store}-shot{idx}',
                style=f'position:absolute;left:0;top:0;width:{S["w"]}px;height:{S["band"]}px')
    bez = Z.mix(t['text'], t['bg'], .2)
    frame = (f'<div style="position:absolute;left:{left}px;top:{S["top"]}px;width:{pw}px;height:{ph}px;border-radius:40px;background:{bez};padding:8px"><div style="width:{pw - 16}px;height:{ph - 16}px;border-radius:32px;overflow:hidden;position:relative">'
             f'<div style="width:{p["w"]}px;height:{p["h"]}px;transform:scale({s});transform-origin:0 0"><div class="r">\n{inner}\n</div></div></div></div>')
    body = f'<div class="sr" style="position:relative;width:{S["w"]}px;height:{S["h"]}px;overflow:hidden;background:{t["bg"]};font-family:{t["bfont"]}">{band}{frame}</div>'
    return shell(t, f'D09 · {S["label"]} · Screenshot {idx} ({t["mode"]})', S['w'], S['h'], css + '\nbody{margin:0}', body)

def feature_inner(t):
    """1024x500 Google Play feature graphic: logo + headline on solid ground (left), prism art on mesh (right)."""
    tiles = ''.join(f'<div style="height:216px">{Z.art(k, t["panel"], t["text"])}</div>' for k in ('skin', 'color', 'style', 'coach'))
    right = Z.pz(t, 512, 500, lambda tz: f'<div style="padding:34px 30px;display:grid;grid-template-columns:1fr 1fr;gap:14px 10px;height:100%;align-content:center">{tiles}</div>', ground=t['panel'],
                 style='position:absolute;left:512px;top:0;width:512px;height:500px', cell=90, seed=121, lo=.1, hi=.24, flow=(1, .5), label='feature-art')
    left = (f'<div style="position:absolute;left:0;top:0;width:512px;height:500px;background:{t["bg"]};padding:54px 50px">{gen3.logo(t, 84)}'
            f'<div class="d" style="font-size:62px;margin-top:44px;line-height:1.0;color:{t["text"]}">Care, <span class="a">color,</span><br>and style.<br><span class="a2">Connected.</span></div></div>')
    return f'<div class="fg" style="position:relative;width:1024px;height:500px;overflow:hidden;background:{t["bg"]}">{left}{right}</div>'

def feature(t):
    css = W.CSS9.substitute(t, root='width:1024px;height:500px', ks=11) + W.EXTRA_CSS
    return shell(t, f'D09 · Google Play · Feature graphic ({t["mode"]})', 1024, 500, css, feature_inner(t).replace('class="fg"', 'class="r"'))

# ───────────── listing boards ─────────────
FULL_DESC = ("Team 47 Studio is one place for your skin, your color palette and your wardrobe, built from your own profile rather than a generic average.\n\n"
             "Start with Skin Match: answer a few taps and see your profile and color season before you create an account. Every answer stays editable.\n\n"
             "• Skin Match: a living profile from your type, tone, sensitivities and goals.\n"
             "• Makeup and hair: shade guidance matched to your depth, with ranges that do not fit left out rather than forced. A lift safety check comes before any hair color suggestion.\n"
             "• Style: preference-led guidance with color as a nudge, never a rule.\n"
             "• AI Coach: answers that say what they were based on. Free includes a preview; Guided and Studio add coaching that uses your profile and routine history.\n"
             "• Routines: steps in your order, updated as you go. You approve every change.\n\n"
             "Free to start. Guided and Studio are optional paid plans; pricing and any amount due are shown before you confirm.\n\n"
             "Cosmetic guidance, not diagnosis or medical treatment. Individual results vary. AI guidance is labeled as such. Terms: [URL]. What to expect: [URL]. Privacy: [URL].")
SHORT_DESC = 'Skin, color and style guidance built from your own profile.'
SUBTITLE = 'Skin, color and style'
PROMO = 'Start free. See your Skin Match result before you create an account. Guided and Studio add ongoing support.'
KEYWORDS = 'skin,color season,makeup shade,hair color,wardrobe,style guide,routine'
assert len(SHORT_DESC) <= 80 and len(SUBTITLE) <= 30 and len(PROMO) <= 170 and len(KEYWORDS.encode()) <= 100

PRIVACY = [('Account info (name, email)', 'Collected · account management', '[CONFIRM]'),
           ('Profile answers (skin type, tone, sensitivities, goals)', 'Collected · personalization · may count as health-related under store definitions', '[CONFIRM WITH COUNSEL]'),
           ('Photos (image journal, Guided and Studio)', 'Collected only if the journal is used · earlier “no photo stored” wording removed from every screen', '[CONFIRM]'),
           ('App activity (routine progress, coach messages)', 'Collected · personalization and support', '[CONFIRM]'),
           ('Purchases', 'Depends on the billing mechanism, which is unresolved (T&C Appendix C-4)', '[UNRESOLVED]'),
           ('Diagnostics and device identifiers', 'Depends on the analytics and crash tools chosen', '[CONFIRM]')]

def listing(store, t):
    S = STORE[store]; ios = store == 'apple'
    g = t['bg']; L, Sx, M = t['line'], t['sub'], t['mute']
    def kv(rows):
        return ''.join(f'<div style="display:grid;grid-template-columns:200px 1fr 170px;gap:18px;padding:14px 0;border-top:1px solid {L};font-size:14px;line-height:1.55"><span class="k" style="padding-top:2px">{a}</span><span style="color:{t["text"]};white-space:pre-line">{b}</span><span style="color:{M};font-size:12.5px">{c}</span></div>' for a, b, c in rows)
    if ios:
        rows = [('App name', 'Team 47 Studio', f'{len("Team 47 Studio")} chars · limit [CONFIRM: 30]'), ('Subtitle', SUBTITLE, f'{len(SUBTITLE)} chars · limit [CONFIRM: 30]'),
                ('Promotional text', PROMO, f'{len(PROMO)} chars · limit [CONFIRM: 170]'), ('Keywords', KEYWORDS, f'{len(KEYWORDS.encode())} bytes · limit [CONFIRM: 100]'),
                ('Description', FULL_DESC, f'{len(FULL_DESC)} chars · limit [CONFIRM: 4,000]'), ('Category', 'Lifestyle', '[CONFIRM]'), ('Support URL', '[URL]', 'Required'), ('Privacy policy URL', '[URL]', 'Required'),
                ('Pricing', 'Free, with optional paid plans', '[BILLING UNRESOLVED · T&C Appendix C-4]')]
        ttl, sub, kind = 'App Store listing', 'Draft copy and assets. Screenshot sizes: iPhone 6.3 in (1206 x 2622, required) and 6.9 in (1320 x 2868, optional).', 'ios'
        icon = f'<img src="{asset("ios-appicon-1024.png")}" width="168" height="168" alt="App icon 1024" style="border-radius:38px;display:block">'
        spec = ['App icon 1024 x 1024 (supplied asset, reused unchanged).', 'Screenshots 1206 x 2622 PNG, no alpha, 1 to 10 per size.', 'Six compositions per mode are on this page.']
    else:
        rows = [('App name', 'Team 47 Studio', f'{len("Team 47 Studio")} chars · limit [CONFIRM: 30]'), ('Short description', SHORT_DESC, f'{len(SHORT_DESC)} chars · limit 80 (verified)'),
                ('Full description', FULL_DESC, f'{len(FULL_DESC)} chars · limit [CONFIRM: 4,000]'), ('Category', 'Beauty', '[CONFIRM]'), ('Support URL / email', '[URL]', 'Required'), ('Privacy policy URL', '[URL]', 'Required'),
                ('Pricing', 'Free, with optional paid plans', '[BILLING UNRESOLVED · T&C Appendix C-4]')]
        ttl, sub, kind = 'Google Play listing', 'Draft copy and assets. Screenshots are 1080 x 1920 PNG (no alpha); feature graphic 1024 x 500.', 'play'
        icon = f'<img src="{asset("play-icon-512.png")}" width="168" height="168" alt="App icon 512" style="border-radius:38px;display:block">'
        spec = ['App icon 512 x 512 32-bit PNG with alpha, up to 1024 KB (supplied asset, reused unchanged).', 'Feature graphic 1024 x 500 JPEG or 24-bit PNG, no alpha (new, below).', 'Screenshots 2 to 8 per device type, six compositions per mode.']
    prv = ''.join(f'<div style="display:grid;grid-template-columns:320px 1fr 200px;gap:18px;padding:13px 0;border-top:1px solid {L};font-size:13.5px;line-height:1.5"><span style="font-weight:700">{a}</span><span style="color:{Sx}">{b}</span><span class="k" style="color:{t["acc2"]}">{c}</span></div>' for a, b, c in PRIVACY)
    feat = ''
    if not ios:
        feat = (f'<div style="margin-top:34px"><div class="k" style="margin-bottom:12px">Feature graphic · 1024 x 500</div><div style="width:1200px;height:586px;overflow:hidden;border:1px solid {L};border-radius:20px">'
                f'<div style="transform:scale(1.1719);transform-origin:0 0;width:1024px;height:500px">{feature_inner(t)}</div></div></div>')
    shots = ''.join(f'<div class="c" style="padding:14px 16px;font-size:13.5px"><div class="k" style="margin-bottom:6px">Screenshot {i + 1}</div><div style="font-weight:700;line-height:1.3">{h[0]} {h[1]}</div><div style="color:{Sx};margin-top:4px;line-height:1.45">{sb}</div></div>' for i, (sc, h, sb) in enumerate(SHOTS))
    body = (f'<header style="background:{g};border-bottom:1px solid {L}"><div class="w" style="height:100px;display:flex;align-items:center;justify-content:space-between">{gen3.logo(t, 64)}<span class="k">{S["label"]} · Listing</span></div></header>'
            f'<section class="w" style="padding-top:56px;padding-bottom:30px"><div class="k" style="margin-bottom:14px">D09 Card Grid v2.1</div><h1 class="d" style="font-size:72px;margin-bottom:16px">{ttl.split()[0]} <span class="a">{" ".join(ttl.split()[1:])}.</span></h1><p class="p" style="max-width:760px">{sub}</p>'
            f'<div style="display:flex;gap:28px;align-items:center;margin-top:34px"><div>{icon}</div><div style="font-size:14px;color:{Sx};line-height:1.8">' + '<br>'.join(spec) + f'</div></div>{feat}</section>'
            f'<section class="w" style="padding-top:20px;padding-bottom:20px"><div class="k" style="margin-bottom:12px">Listing text · publishable drafts</div><div style="border-bottom:1px solid {L}">{kv(rows)}</div>'
            f'<p style="font-size:12.5px;color:{M};margin:14px 0 0">Anything marked [CONFIRM] or [URL] is a placeholder. Store text limits not stated on the official asset pages are not asserted here.</p></section>'
            f'<section class="w" style="padding-top:30px;padding-bottom:20px"><div class="k" style="margin-bottom:14px">Screenshot set · six per mode</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">{shots}</div></section>'
            f'<section class="w" style="padding-top:34px;padding-bottom:70px"><div class="k" style="margin-bottom:6px">{"App Privacy" if ios else "Data safety"} · draft answers for the console form</div>'
            f'<p style="font-size:13px;color:{Sx};margin:0 0 12px;max-width:820px">These are prompts for discussion with counsel, not final answers and not legal advice. The person submitting the form answers it.</p><div style="border-bottom:1px solid {L}">{prv}</div></section>' + W.footer(t))
    css = W.CSS9.substitute(t, root='width:100%;min-height:1500px', ks=13) + W.EXTRA_CSS
    return shell(t, f'D09 · {S["label"]} · Listing ({t["mode"]})', 1280, 1500, css, f'<div class="r">{body}</div>')

def main(out, target='canvas'):
    gen3.TARGET = target; os.makedirs(out, exist_ok=True); n = 0
    mp = os.path.join(os.path.dirname(os.path.abspath(out)), 'assets_map.json')
    if target == 'canvas' and os.path.exists(mp): ASSET_URL.update(json.load(open(mp)))
    for mode in ('dark', 'light'):
        t = gen3.tokens(W.D9, mode); t['line2'] = Z.mix(t['text'], t['bg'], .5); gen3.use(t)
        for store in ('play', 'apple'):
            S = STORE[store]; APP.W.PLAT.update(APP.PLATS[S['plat']])
            for i, (sc, h, sb) in enumerate(SHOTS, 1):
                open(os.path.join(out, f'D09-{S["tag"]}-S{i}-{mode}.dc.html'), 'w').write(compose(store, t, i, sc, h, sb)); n += 1
            open(os.path.join(out, f'D09-{S["tag"]}-L1-Listing-{mode}.dc.html'), 'w').write(W.finish(listing(store, t), t)); n += 1
        open(os.path.join(out, f'D09-GP-F1-Feature-{mode}.dc.html'), 'w').write(feature(t)); n += 1
    print(n, 'store boards ->', out, target, '| zones:', len(Z.GUARD), 'min contrast', min(c for _, c in Z.GUARD))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'canvas')
