#!/usr/bin/env python3
"""D09 Card Grid v2.1 — iOS + Android app boards (12 screens x dark/light x 2 platforms).
Usage: python3 d09app.py <outdir> [canvas|export]"""
import sys, os, re
sys.path.insert(0, '/home/claude/team47studio'); sys.path.insert(0, '/home/claude/team47studio/v2')
import d09 as W
import gen, gen2, gen3, d09lib as Z
from gen import season, ico, COMPLY, TONES, SEL, TOOLS, SHORT, TABS, TABICON

PLATS = {'ios': dict(name='ios', w=390, h=844, bar=80), 'android': dict(name='android', w=412, h=915, bar=80)}
tile = W.tile

def recolor(html, t, tz):
    """Swap text colours inside a patterned zone for the contrast-checked ones (colour: only, never background:)."""
    for k in ('text', 'sub', 'mute', 'acc', 'acc2', 'kcol'):
        if t.get(k) and t[k] != tz[k]:
            html = re.sub(r'(?<![\w-])color:' + re.escape(t[k]), 'color:' + tz[k], html)
    return html

def arrow(col, android):
    d = 'M20 12H5M11 6l-6 6 6 6' if android else 'M15 5l-7 7 7 7'
    return f'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="{col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{d}"/></svg>'

# ───────────── header strip + tab / navigation bar ─────────────
def phead9(t, title, right=''):
    p = W.PLAT; android = p['name'] == 'android'
    back = '‹' in right
    def inner(tz):
        r = '' if back else recolor(right, t, tz)
        lead = f'<span style="display:flex;width:44px;height:44px;align-items:center;justify-content:center;margin-left:-10px">{arrow(tz["text"], android)}</span>' if back else ''
        size = 24 if android else 21
        ttl = f'<span class="d" style="font-size:{size}px;font-weight:800;letter-spacing:-.02em;white-space:nowrap;color:{tz["text"]}">{title}</span>'
        if android or back:
            return f'<div style="height:64px;display:flex;align-items:center;gap:6px;padding:0 20px">{lead}{ttl}<span style="flex:1"></span><span style="display:flex;align-items:center;gap:10px;white-space:nowrap;flex:none">{r}</span></div>'
        return f'<div style="height:64px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 20px"><span></span>{ttl}<span style="display:flex;justify-content:flex-end;white-space:nowrap">{r}</span></div>'
    return Z.pz(t, p['w'], 64, inner, ground=t['bg'], style=f'border-bottom:1px solid {t["line"]}', cell=44, seed=7 + len(title), lo=.08, hi=.18, flow=(1, .3), label='phead-' + title)

def tabbar9(t, active):
    p = W.PLAT; android = p['name'] == 'android'; bar = p['bar']; cells = ''
    for i, n in enumerate(TABS):
        on = i == active
        if android:
            w_, h_ = 56, 30
            if on:
                ind = Z.pz(t, w_, h_, lambda tz, i=i: f'<span style="display:flex;align-items:center;justify-content:center;height:{h_}px">{ico(i, tz["text"], 20, TABICON)}</span>', ground=t['bg'],
                           style=f'width:{w_}px;height:{h_}px;border-radius:15px;border:1px solid {Z.mix(Z.PRISM[i % 6], t["bg"], .5)}', cell=22, seed=3 + i, lo=.1, hi=.22, label='tab-on')
            else:
                ind = f'<span style="display:flex;align-items:center;justify-content:center;height:{h_}px;width:{w_}px">{ico(i, t["mute"], 20, TABICON)}</span>'
            cells += f'<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding-top:12px">{ind}<span style="font-size:12px;font-weight:{800 if on else 600};color:{t["text"] if on else t["mute"]}">{n}</span></div>'
        else:
            if on:
                box = Z.pz(t, 58, 52, lambda tz, i=i, n=n: f'<span style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;height:52px">{ico(i, tz["text"], 22, TABICON)}<span style="font-size:10.5px;font-weight:800;color:{tz["text"]}">{n}</span></span>',
                           ground=t['bg'], style=f'width:58px;height:52px;border-radius:16px;border:1px solid {Z.mix(Z.PRISM[i % 6], t["bg"], .5)}', cell=26, seed=3 + i, lo=.1, hi=.22, label='tab-on')
            else:
                box = f'<span style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;width:58px;height:52px">{ico(i, t["mute"], 22, TABICON)}<span style="font-size:10.5px;font-weight:600;color:{t["mute"]}">{n}</span></span>'
            cells += f'<div style="flex:1;display:flex;justify-content:center;padding-top:8px">{box}</div>'
    return f'<div style="position:absolute;left:0;right:0;bottom:0;height:{bar}px;background:{t["bg"]};border-top:1px solid {t["line"]};display:flex">{cells}</div>'

W.patch(dict(tabbar=tabbar9, phead=phead9))

# ───────────── rebuilt screens ─────────────
def season_chip(t, w=150):
    return tile(t, w, 36, lambda tz: f'<span style="display:flex;align-items:center;gap:8px;padding:0 12px;height:36px"><span style="font-size:12.5px;font-weight:700;color:{tz["text"]}">Soft Autumn</span>{season(tz, 10)}</span>',
                i=2, seed=5, rad=999, lo=.1, hi=.2, cell=24, label='season-chip', style='display:inline-flex')

def app_head(t, right=''):
    return gen3.app_head(t, right)

def p_home9(t):
    p = W.PLAT; cw = p['w'] - 40; android = p['name'] == 'android'
    av = f'<div style="width:40px;height:40px;border-radius:50%;background:{t["acc"]};color:{t["onacc"]};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700">A</div>'
    def tonight(tz):
        trk = Z.mix(tz['text'], t['surf'], .22)
        seg = ''.join(f'<div style="flex:1;height:8px;border-radius:4px;background:{tz["acc"] if i < 2 else trk}"></div>' for i in range(6))
        return (f'<div style="padding:18px 18px 16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span class="k">Tonight · PM routine</span><span class="k">2 of 6</span></div>'
                f'<div style="display:flex;gap:4px;margin-bottom:16px">{seg}</div><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:12px;color:{tz["sub"]}">Next step</div>'
                f'<div class="d" style="font-size:23px;margin-top:2px;color:{tz["text"]}">Vitamin C serum</div></div><a href="#" class="b" style="padding:10px 20px;font-size:14px;min-height:44px">Continue</a></div></div>')
    tw = (cw - 20) // 3
    cells = ''
    for i in range(6):
        a, b, c = TOOLS[i]
        cells += tile(t, tw, 104, lambda tz, i=i, a=a: (f'<div style="padding:12px 12px 12px;display:flex;flex-direction:column;justify-content:space-between;height:104px"><span style="width:36px;height:36px;border-radius:50%;background:{t["surf"]};border:1px solid {tz["line"]};display:flex;align-items:center;justify-content:center">{ico(i, t["text"], 20)}</span>'
                      f'<span style="font-size:13px;font-weight:800;color:{tz["text"]};line-height:1.15">{a}</span></div>'),
                      i=i, seed=50 + i, rad=22, lo=.08, hi=.18, cell=40, flow=(1, .3 + .2 * i), label='home-v' + str(i), tag='a', href='#')
    def row(k, title, note, i):
        return (f'<div class="c" style="display:flex;align-items:center;gap:12px;padding:12px 16px;margin-top:10px;min-height:64px"><div style="flex:1"><div class="k" style="margin-bottom:4px">{k}</div>'
                f'<div style="font-size:14px;font-weight:700">{title}</div></div><span style="font-size:12px;color:{t["mute"]}">{note}</span><span style="color:{t["mute"]};font-size:18px">›</span></div>')
    body = (f'{gen.sbar(t)}{app_head(t, av)}<div style="padding:16px 20px 0"><div class="k" style="margin-bottom:4px">Good evening</div><div class="d" style="font-size:44px;margin-bottom:14px">Alex<span class="a">.</span></div>'
            + tile(t, cw, 134, tonight, i=4, seed=51, ground=t['panel'], rad=26, lo=.1, hi=.22, cell=56, flow=(1, .4), label='home-tonight')
            + f'<div style="display:flex;justify-content:space-between;align-items:center;margin:20px 0 10px"><span class="k" style="color:{t["mute"]}">Your studio</span>{season_chip(t)}</div>'
            + f'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">{cells}</div>'
            + row('Shop My Routine', 'Your PM cart is ready', '2 items', 1) + row('AI Coach · Guided', 'Ask about tonight’s routine', '', 4)
            + f'</div>{tabbar9(t, 0)}')
    return W.mydoc(t, f"D09 · App · Home ({t['mode']})", body, 390, 844, False)

def a_welcome9(t):
    p = W.PLAT; cw = p['w'] - 40
    dots = lambda tz: ''.join(f'<span style="width:26px;height:26px;border-radius:50%;background:{c}"></span>' for c in TONES[1:14:2])
    def hero(tz):
        return (f'<div style="padding:34px 26px 30px;display:flex;flex-direction:column;height:100%"><div class="d" style="font-size:50px;margin-bottom:18px;color:{tz["text"]}">Care, <span class="a">color,</span><br>and style.<br><span class="a2">Connected.</span></div>'
                f'<div style="flex:1;min-height:20px"></div><p style="font-size:15px;color:{tz["sub"]};line-height:1.6;margin:0 0 20px">One studio for your skin, your palette and your wardrobe, built from your own profile and not a generic average.</p><div style="display:flex;gap:7px">{dots(tz)}</div></div>')
    steps = [('1', 'Answer a few taps'), ('2', 'See your profile'), ('3', 'Get your routine')]
    sw_ = (cw - 20) // 3
    st = ''.join(f'<div class="c" style="width:{sw_}px;padding:12px 12px 12px;min-height:88px"><div class="d" style="font-size:26px;color:{t["acc"]}">{a}</div><div style="font-size:13px;font-weight:700;line-height:1.3;margin-top:6px">{b}</div></div>' for a, b in steps)
    body = (f'{gen.sbar(t)}<div style="padding:10px 22px 16px">{gen3.logo(t, 60)}</div><div style="padding:0 20px">'
            + tile(t, cw, 440, hero, i=5, seed=61, ground=t['panel'], rad=34, lo=.1, hi=.24, cell=84, flow=(1, .5), label='welcome-hero', style='height:440px')
            + f'<div style="display:flex;gap:10px;margin-top:14px">{st}</div>'
            + f'<p style="font-size:11px;color:{t["mute"]};font-style:italic;margin:16px 0 0;line-height:1.5">{COMPLY} Individual results vary.</p></div>'
            + f'<div style="position:absolute;left:20px;right:20px;bottom:76px"><a href="#" class="b" style="display:block">Start my Skin Match</a></div>'
            + f'<a href="#" style="position:absolute;left:0;right:0;bottom:16px;text-align:center;font-size:14px;font-weight:700;color:{t["acc"]};padding:12px 0;min-height:44px">I already have an account</a>')
    return W.mydoc(t, f"D09 · App · Welcome ({t['mode']})", body, 390, 844, False)

def a_result9(t):
    p = W.PLAT; cw = p['w'] - 40
    L, S, M, A = t['line'], t['sub'], t['mute'], t['acc']
    row, chips, sw = gen2.row, gen2.chips, gen2.sw
    def seasn(tz):
        return (f'<div style="padding:16px 18px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div><div class="k" style="margin-bottom:5px">Color season</div><div class="d" style="font-size:27px"><span class="a">Soft Autumn</span></div></div>{season(tz, 20)}</div>'
                f'<div style="font-size:12.5px;color:{tz["sub"]};line-height:1.55">Close to Soft Summer. Neither answer is wrong; try both and keep the one you prefer.</div></div>')
    body = (f'{gen.sbar(t)}{phead9(t, "Your profile", "<span class=k>Edit</span>")}<div style="padding:18px 20px 0"><div class="k" style="margin-bottom:8px">Result</div>'
            f'<div style="display:flex;gap:14px;align-items:center;margin-bottom:14px">{sw(TONES[SEL], 46)}<div class="d" style="font-size:31px;line-height:1.02">Combination, warm, <span class="a">medium.</span></div></div>'
            f'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">{chips(["Depth 07 / 15", "Low sensitivity", "Even tone", "Hydration"])}</div>'
            + tile(t, cw, 128, seasn, i=2, seed=62, rad=24, lo=.09, hi=.2, cell=60, flow=(1, .5), label='result-season', style='margin-bottom:12px')
            + f'{row("Match confidence", "High", A)}{row("Based on", "Type · tone · sensitivity · goals")}{row("What we kept", "Your answers and this result")}</div>'
            f'<div style="position:absolute;left:20px;right:20px;bottom:30px"><div style="font-size:11.5px;color:{M};text-align:center;margin-bottom:10px">Shown before sign-up. Every answer stays editable.</div><a href="#" class="b" style="display:block;margin-bottom:10px">See my routine</a>'
            f'<a href="#" class="b2" style="display:block;padding:13px">Save my profile · free account</a></div>')
    return W.mydoc(t, f"D09 · App · Skin Match result ({t['mode']})", body, 390, 844, False)

def p_coach9(t):
    p = W.PLAT; cw = p['w'] - 40; r = 16
    pill = f'<span class="k" style="border:1px solid {t["kcol"]};padding:5px 10px;border-radius:999px">Free preview</span>'
    def card(tz):
        feats = ''.join(f'<div style="display:flex;justify-content:space-between;font-size:13px;color:{tz["sub"]};padding:9px 0;border-top:1px solid {tz["line"]}"><span>{x}</span><span style="color:{tz["acc"]};font-weight:700">✓</span></div>'
                        for x in ['Answers that use your profile and season', 'Routines updated every two weeks', 'Progress history and image journal'])
        return (f'<div style="padding:20px 20px 18px"><div class="k" style="margin-bottom:8px">Guided</div><div class="d" style="font-size:32px;margin-bottom:8px;color:{tz["text"]}">Make it <span class="a">yours.</span></div>'
                f'<p style="font-size:13px;color:{tz["sub"]};line-height:1.55;margin:0 0 10px">Guided answers from your own profile, season and routine history, and says what each answer was based on.</p>{feats}'
                f'<a href="#" class="b" style="display:block;margin-top:14px">See Guided and Studio</a></div>')
    body = (f'{gen.sbar(t)}{phead9(t, "AI Coach", pill)}<div style="padding:16px 20px 0;display:flex;flex-direction:column;gap:10px"><div style="align-self:flex-end;max-width:80%;background:{t["bg2"]};border-radius:{r}px;padding:11px 14px;font-size:13.5px;line-height:1.5">My new cleanser leaves my skin feeling tight. What should I look for?</div>'
            f'<div style="max-width:90%;background:{t["surf"]};border:1px solid {t["line"]};border-radius:{r}px;padding:12px 14px;font-size:13.5px;line-height:1.55;color:{t["sub"]}">Tightness after cleansing often points to a formula that is too stripping. A gentle gel cleanser is a common place to start.'
            f'<div style="font-family:{t["kfont"]};font-size:10px;letter-spacing:.08em;color:{t["mute"]};margin-top:8px;text-transform:uppercase">General guidance · not yet using your profile</div></div></div>'
            f'<div style="padding:18px 20px 0">' + tile(t, cw, 372, card, i=4, seed=63, ground=t['panel'], rad=26, lo=.1, hi=.22, cell=70, flow=(1, .4), label='coach-card') + f'</div>{tabbar9(t, 4)}')
    return W.mydoc(t, f"D09 · App · Coach preview ({t['mode']})", body, 390, 844, False)

def a_profile9(t):
    p = W.PLAT; cw = p['w'] - 40
    L, S, M = t['line'], t['sub'], t['mute']; sw = gen2.sw
    item = lambda a, b, c='': f'<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid {L};min-height:56px"><div style="flex:1"><div style="font-size:14.5px;font-weight:700">{a}</div><div style="font-size:12px;color:{S};margin-top:2px">{b}</div></div>{c}<span style="color:{M};font-size:18px">›</span></div>'
    def plan(tz):
        return (f'<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;gap:12px"><div><div class="k" style="margin-bottom:4px">Guided</div><div style="font-size:13px;color:{tz["sub"]};line-height:1.45">Routine updates, progress history and coaching</div></div>'
                f'<a href="#" class="b" style="padding:10px 18px;font-size:14px;min-height:44px">Upgrade</a></div>')
    body = (f'{gen.sbar(t)}{phead9(t, "Profile", f"<span class=k style=color:{M}>Settings</span>")}<div style="padding:16px 20px 0"><div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">'
            f'<div style="width:56px;height:56px;border-radius:50%;background:{t["acc"]};color:{t["onacc"]};display:flex;align-items:center;justify-content:center;font-family:{t["dfont"]};font-size:26px;font-weight:800">A</div>'
            f'<div style="flex:1"><div class="d" style="font-size:32px">Alex</div><div style="font-size:12.5px;color:{S}">Free · member since November</div></div></div>'
            + tile(t, cw, 84, plan, i=4, seed=64, ground=t['panel'], rad=22, lo=.1, hi=.22, cell=50, flow=(1, .4), label='profile-plan', style='margin-bottom:6px')
            + f'{item("Skin profile", "Combination · warm · depth 07 · edit answers", sw(TONES[SEL], 22))}{item("Color season", "Soft Autumn · used by makeup, hair and style", season(t, 12))}{item("Routine reminders", "AM 7:30 · PM 9:00")}'
            f'{item("Plan and billing", "Free · compare Guided and Studio")}{item("Privacy and data", "What is saved, and your controls")}{item("AI disclosure", "How guidance is produced and reviewed")}'
            f'<div style="border-top:1px solid {L};padding-top:12px;font-size:11px;color:{M};font-style:italic">{COMPLY} <a href="#" style="text-decoration:underline">Terms</a> · <a href="#" style="text-decoration:underline">What to expect</a></div></div>{tabbar9(t, 5)}')
    return W.mydoc(t, f"D09 · App · Profile ({t['mode']})", body, 390, 844, False)

SCREENS = [('A01-Welcome', a_welcome9), ('A02-Match', lambda t: gen.p_match(t)), ('A03-Result', a_result9), ('A04-Home', p_home9), ('A05-Routine', lambda t: gen.p_routine(t)),
           ('A06-Shop', lambda t: gen.p_shop(t)), ('A07-Makeup', lambda t: gen2.a_makeup()), ('A08-Lift', lambda t: gen2.a_lift()), ('A09-Style', lambda t: gen2.a_style()),
           ('A10-CoachPreview', p_coach9), ('A11-CoachChat', lambda t: gen2.a_chat()), ('A12-Profile', a_profile9)]
TAG = {'ios': 'IOS', 'android': 'AND'}
APP_FIX = [('~40s left', 'Edit anytime')]

def render_app(plat, mode, only=None):
    W.PLAT.update(PLATS[plat])
    t = gen3.tokens(W.D9, mode); t['line2'] = Z.mix(t['text'], t['bg'], .5); gen3.use(t)
    out = {}
    for name, fn in SCREENS:
        if only and name not in only: continue
        html = fn(t)
        for a, b in APP_FIX: html = html.replace(a, b)
        out[name] = W.finish(html, t)
    return out

def main(out, target='canvas', plats=('ios', 'android')):
    gen3.TARGET = target; os.makedirs(out, exist_ok=True); n = 0
    for plat in plats:
        for mode in ('dark', 'light'):
            for name, html in render_app(plat, mode).items():
                open(os.path.join(out, f'D09-{TAG[plat]}-{name}-{mode}.dc.html'), 'w').write(html); n += 1
    print(n, 'app boards ->', out, target, '| zones:', len(Z.GUARD), 'min contrast', min(c for _, c in Z.GUARD))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'canvas')
