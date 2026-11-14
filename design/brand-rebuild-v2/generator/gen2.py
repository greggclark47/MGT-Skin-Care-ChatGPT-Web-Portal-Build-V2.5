#!/usr/bin/env python3
"""Signature end-to-end boards (web portal + app flows) built on the Final token set from the workbook."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen
from gen import doc, sbar, tabbar, phead, season, tonebar, ico, header, footer, plans_body, TONES, SEL, SEASON, SHORT, TOOLS, COMPLY, ICON

t = gen.prep(dict(gen.FINAL, id='Sig'))
L, S, M, A, A2, BG2 = t['line'], t['sub'], t['mute'], t['acc'], t['acc2'], t['bg2']
AMB = dict(bg='#FFF6E3', bd='#E9B949', fg='#8A5A00')
row = lambda a, b, c='': f'<div style="display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid {L};font-size:13.5px"><span style="color:{S}">{a}</span><span style="font-weight:600;color:{c or t["text"]};text-align:right">{b}</span></div>'
chips = lambda xs: ''.join(f'<span class="chip">{x}</span>' for x in xs)
sw = lambda c, s=30, sel=False: f'<span style="display:inline-block;width:{s}px;height:{s}px;border-radius:50%;background:{c};flex-shrink:0;{"box-shadow:0 0 0 2px "+t["surf"]+",0 0 0 4px "+A+";" if sel else ""}"></span>'
STEPS = ['Oil cleanse', 'Gel cleanse', 'Vitamin C serum', 'Hydrating toner', 'Barrier moisturiser', 'Eye cream']

# ───────────── web portal ─────────────
def w_result():
    steps = ''.join(f'<div style="display:flex;gap:14px;align-items:baseline;padding:11px 0;border-top:1px solid {L}"><span class="d" style="font-size:22px;width:20px;color:{M}">{i+1}</span><span style="font-size:14px;font-weight:600;flex:1">{s}</span><span class="k" style="color:{M}">{"Prep" if i<2 else "Treat" if i<4 else "Seal"}</span></div>' for i, s in enumerate(STEPS))
    use = ''.join(f'<div style="padding:22px 20px;border-top:1px solid {L};{"border-left:1px solid "+L+";" if i else ""}"><div style="margin-bottom:12px">{ico(i, A, 22)}</div><div class="k" style="margin-bottom:6px">{a}</div><div style="font-size:13px;color:{S};line-height:1.55">{["Routine ready","Shades matched to depth 07","Start hair profile","Lift check included","Set your preferences","Palette applied"][i]}</div></div>' for i, (a, b, c) in enumerate(TOOLS))
    body = header(t) + f'''<div class="w" style="padding-top:26px"><div class="c" style="display:flex;align-items:center;justify-content:space-between;padding:14px 22px;background:{t['panel']}">
<div style="font-size:14px"><b>This is your result, before any sign-up.</b> <span style="color:{S}">Create a free account to keep it and use it across all six verticals.</span></div><a href="#" class="b" style="padding:11px 22px;font-size:13px">Save my profile</a></div></div>
<section class="w" style="padding-top:56px;padding-bottom:64px"><div class="k" style="margin-bottom:14px">Skin Match · Result · took 58 seconds</div>
<h1 class="d" style="font-size:76px;margin-bottom:40px">Your profile, <span class="a">ready.</span></h1>
<div style="display:flex;gap:24px;align-items:flex-start">
<div class="c" style="flex:1.1;padding:32px"><div style="display:flex;justify-content:space-between;margin-bottom:18px"><span class="k" style="color:{M}">Your skin</span><a href="#" class="k">Edit answers</a></div>
<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">{sw(TONES[SEL], 56)}<div><div class="d" style="font-size:34px;line-height:1.05">Combination, warm, medium.</div><div style="font-size:13px;color:{S};margin-top:4px">Depth 07 of 15 · low sensitivity</div></div></div>
<div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:20px">{chips(['Goal: even tone', 'Goal: hydration', 'Fragrance-free preferred'])}</div>
{row('Match confidence', '91%', A)}{row('Why this result', 'Type, tone, sensitivity and two goals')}{row('What we kept', 'Your answers and this result. No photo.')}
<p style="font-size:11.5px;color:{M};font-style:italic;margin:16px 0 0">{COMPLY}</p></div>
<div style="flex:1;display:flex;flex-direction:column;gap:24px"><div class="c" style="padding:28px"><div class="k" style="color:{M};margin-bottom:12px">Your colour season</div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><div class="d" style="font-size:34px"><span class="a">Soft Autumn</span></div>{season(t, 26)}</div>
<div style="font-size:13px;color:{S};line-height:1.6;border-top:1px solid {L};padding-top:12px">You sit close to Soft Summer. Neither answer is wrong; try both palettes and keep the one you prefer.</div></div>
<div class="c" style="padding:28px"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="k" style="color:{M}">Your PM routine · 6 steps</span><span class="k">AM · 5 steps</span></div>{steps}
<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid {L};padding-top:16px;margin-top:2px"><div><div style="font-size:12px;color:{M}">Shop My Routine · 6 items</div><div class="d" style="font-size:28px">$176</div></div><a href="#" class="b2" style="padding:12px 22px">Review the cart</a></div></div></div></div></section>
<section style="background:{BG2};border-top:1px solid {L}"><div class="w" style="padding-top:56px;padding-bottom:64px"><div class="k" style="margin-bottom:12px">One profile, six uses</div><h2 class="d" style="font-size:46px;margin-bottom:28px">Where this profile <span class="a2">goes next.</span></h2>
<div class="c" style="display:grid;grid-template-columns:repeat(6,1fr);overflow:hidden">{use}</div></div></section>''' + footer(t)
    return doc(t, 'Signature · Web · Skin Match result', body, 1280, 1500, True)

def w_portal():
    nav = ''.join(f'<div style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:{t["brad"]}px;font-size:14px;font-weight:{600 if i==0 else 500};color:{t["text"] if i==0 else S};{"background:"+t["surf"]+";box-shadow:"+t["shadow"]+";" if i==0 else ""}">{ic}{n}</div>'
                  for i, (n, ic) in enumerate([('Home', ico(5, A, 18)), ('Skin', ico(0, S, 18)), ('Makeup', ico(1, S, 18)), ('Hair', ico(2, S, 18)), ('Style', ico(4, S, 18)), ('Shop', ico(1, S, 18)), ('AI Coach', ico(4, S, 18, gen.TABICON)), ('Profile', ico(5, S, 18, gen.TABICON))]))
    seg = ''.join(f'<div style="flex:1;height:8px;border-radius:4px;background:{A if i<2 else BG2}"></div>' for i in range(6))
    steps = ''.join(f'<div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-top:1px solid {L};{"background:"+A+"10;margin:0 -28px;padding:12px 28px;" if i==2 else ""}"><span class="d" style="font-size:22px;width:20px;color:{A if i==2 else M}">{i+1}</span>'
                    f'<span style="flex:1;font-size:14px;font-weight:600;{"text-decoration:line-through;color:"+M+";" if i<2 else ""}">{s}</span>{"<span style=\'color:"+A2+";font-weight:700\'>✓</span>" if i<2 else ("<a href=\'#\' class=\'b\' style=\'padding:8px 16px;font-size:12.5px\'>Mark done</a>" if i==2 else "")}</div>' for i, s in enumerate(STEPS))
    status = [('Routine ready', A, 'Open'), ('3 shades matched', A, 'Open'), ('Not started', M, 'Start'), ('Lift check ready', A, 'Open'), ('Preferences set', A, 'Open'), ('Palette applied', A, 'Open')]
    cards = ''.join(f'<div class="c" style="padding:20px;box-shadow:none"><div style="display:flex;justify-content:space-between;margin-bottom:16px">{ico(i, A, 22)}<span class="k" style="color:{M}">{TOOLS[i][0]}</span></div><div class="d" style="font-size:23px;margin-bottom:6px">{TOOLS[i][1]}</div>'
                    f'<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;color:{c}">{s}</span><span style="font-size:12.5px;font-weight:600;color:{A}">{b} ›</span></div></div>' for i, (s, c, b) in enumerate(status))
    body = f'''<div style="display:flex;min-height:1060px"><aside style="flex:0 0 244px;background:{BG2};border-right:1px solid {L};padding:26px 18px"><div style="font-family:{t['dfont']};font-weight:600;font-size:18px;letter-spacing:.14em;padding:0 14px 26px">TEAM 47 <span style="color:{A}">STUDIO</span></div>
<div style="display:flex;flex-direction:column;gap:4px">{nav}</div><div class="c" style="margin-top:30px;padding:18px;box-shadow:none"><div class="k" style="margin-bottom:8px">Free plan</div><div style="font-size:13px;color:{S};line-height:1.55;margin-bottom:14px">AI Coach and live voice are part of Premium, $14.99 a month.</div><a href="#" class="b" style="display:block;padding:10px;font-size:13px">Upgrade</a></div></aside>
<main style="flex:1;padding:40px 48px 56px;min-width:0"><div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:30px"><div><div class="k" style="margin-bottom:10px">Saturday evening</div><h1 class="d" style="font-size:56px">Good evening, Alex<span class="a">.</span></h1></div>
<div class="c" style="display:flex;align-items:center;gap:14px;padding:12px 18px;box-shadow:none"><div><div class="k" style="color:{M};margin-bottom:4px">Your season</div><div style="font-size:14px;font-weight:600">Soft Autumn</div></div>{season(t, 20)}</div></div>
<div style="display:flex;gap:22px;align-items:flex-start;margin-bottom:22px"><div class="c" style="flex:1.35;padding:28px"><div style="display:flex;justify-content:space-between;margin-bottom:12px"><span class="k" style="color:{M}">Tonight · PM routine</span><span class="k">2 of 6 done</span></div><div style="display:flex;gap:5px;margin-bottom:14px">{seg}</div>{steps}
<div style="border-top:1px solid {L};padding-top:12px;font-size:12px;color:{M}">You approve every change to your routine.</div></div>
<div style="flex:1;display:flex;flex-direction:column;gap:22px"><div class="c" style="padding:26px"><div class="k" style="color:{M};margin-bottom:10px">Shop My Routine</div><div class="d" style="font-size:30px;margin-bottom:6px">Your PM cart is <span class="a">ready.</span></div>
<div style="font-size:13px;color:{S};line-height:1.6;margin-bottom:16px">Two items you don't own yet. Each one says why it was picked.</div><div style="display:flex;justify-content:space-between;align-items:center"><span class="d" style="font-size:30px">$74</span><a href="#" class="b" style="padding:12px 24px">Review cart</a></div></div>
<div class="c" style="padding:26px;background:{t['panel']}"><div class="k" style="margin-bottom:10px">AI Coach · Premium</div><div class="d" style="font-size:30px;margin-bottom:6px">Ask about tonight's routine.</div><div style="font-size:13px;color:{S};line-height:1.6;margin-bottom:16px">Voice or text. It already knows your profile, season and routine history.</div><a href="#" class="b2" style="padding:12px 22px;background:{t['surf']}">See Premium</a></div></div></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;margin:34px 0 16px"><h2 class="d" style="font-size:36px">Your <span class="a2">studio</span></h2><span style="font-size:13px;color:{S}">One profile feeds all six.</span></div>
<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px">{cards}</div>
<p style="font-size:11.5px;color:{M};margin:30px 0 0">{COMPLY} · © 2026 MGT Solutions, Inc. d/b/a Team47Studio</p></main></div>'''
    return doc(t, 'Signature · Web · Portal home', body, 1280, 1060, True)

def w_plans():
    faq = [('What is free?', 'Skin Match, your living profile, the 12-season colour analysis, the AM / PM routine tracker and all six verticals.'),
           ('What does Premium add?', 'Unlimited AI Coach by voice or text, live voice guidance and the Shop My Routine cart.'),
           ('What does the Coach know about me?', 'Your profile answers, your season and your routine history. Every answer lists what it was based on.'),
           ('What happens to my data?', 'Swatches only: no photo is stored. Your season result is saved; the swatches you tapped are not.'),
           ('Can I cancel?', 'Any time, from Profile. Your free profile and routine stay.')]
    rows = ''.join(f'<div style="display:flex;gap:40px;padding:22px 0;border-top:1px solid {L}"><div class="d" style="font-size:25px;flex:0 0 380px;line-height:1.1">{q}</div><div class="p" style="flex:1">{a}</div></div>' for q, a in faq)
    body = header(t) + f'''<section class="w" style="padding-top:72px;padding-bottom:72px;text-align:center"><div class="k" style="margin-bottom:16px">Plans</div><h1 class="d" style="font-size:84px;margin-bottom:18px">Start <span class="a">free.</span> Upgrade when ready.</h1>
<p class="p" style="max-width:520px;margin:0 auto 48px">Everything you need to build and keep a routine is free. Premium adds a coach that already knows you.</p><div style="width:960px;margin:0 auto">{plans_body(dict(t, hs='center'))}</div></section>
<section style="background:{BG2};border-top:1px solid {L}"><div class="w" style="padding-top:64px;padding-bottom:72px"><div class="k" style="margin-bottom:12px">Good to know</div><h2 class="d" style="font-size:46px;margin-bottom:26px">Plain answers.</h2><div style="border-bottom:1px solid {L}">{rows}</div></div></section>''' + footer(t)
    return doc(t, 'Signature · Web · Plans', body, 1280, 1700, True)

# ───────────── app ─────────────
P = lambda title, body: doc(t, f'Signature · App · {title}', body, 390, 844, False)
cta = lambda label, bottom=30, sub='': f'<div style="position:absolute;left:20px;right:20px;bottom:{bottom}px">{sub}<a href="#" class="b" style="display:block">{label}</a></div>'

def a_welcome():
    pts = ''.join(f'<div style="display:flex;gap:12px;align-items:center;padding:13px 0;border-top:1px solid {L}"><span class="k" style="width:22px">{i+1:02d}</span><span style="font-size:14.5px;font-weight:600;flex:1">{a}</span><span style="font-size:12px;color:{M}">{b}</span></div>'
                  for i, (a, b) in enumerate([('Answer a few questions', 'about a minute'), ('See your profile and season', 'before sign-up'), ('Get your routine', 'free to start')]))
    return P('Welcome', f'''{sbar(t)}<div style="margin:6px 16px 0;border-radius:24px;background:{t['panel']};padding:30px 24px 28px"><div style="font-family:{t['dfont']};font-weight:600;font-size:14px;letter-spacing:.16em;margin-bottom:54px">TEAM 47 <span style="color:{A}">STUDIO</span></div>
<div class="d" style="font-size:52px;margin-bottom:16px">Care, <span class="a">colour,</span><br>and style.<br><span class="a2">Connected.</span></div><p style="font-size:14px;color:{S};line-height:1.6;margin:0 0 20px">One studio for your skin, your palette and your wardrobe, built from your own profile.</p>
<div style="display:flex;gap:6px">{''.join(sw(c, 24, i==3) for i, c in enumerate(TONES[1:14:2]))}</div></div>
<div style="padding:18px 22px 0">{pts}<div style="border-top:1px solid {L};padding-top:12px;font-size:11px;color:{M};font-style:italic">{COMPLY} No camera needed.</div></div>
{cta('Start my Skin Match', 62)}<div style="position:absolute;left:0;right:0;bottom:26px;text-align:center;font-size:13px;font-weight:600;color:{A}">I already have an account</div>''')

def a_result():
    return P('Skin Match result', f'''{sbar(t)}{phead(t, 'Your profile', f'<span class="k">Edit</span>')}
<div style="padding:18px 20px 0"><div class="k" style="margin-bottom:8px">Result · took 58 seconds</div><div style="display:flex;gap:14px;align-items:center;margin-bottom:14px">{sw(TONES[SEL], 46)}<div class="d" style="font-size:31px;line-height:1.02">Combination, warm, <span class="a">medium.</span></div></div>
<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">{chips(['Depth 07 / 15', 'Low sensitivity', 'Even tone', 'Hydration'])}</div>
<div class="c" style="padding:16px;margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div><div class="k" style="color:{M};margin-bottom:5px">Colour season</div><div class="d" style="font-size:25px"><span class="a">Soft Autumn</span></div></div>{season(t, 20)}</div>
<div style="font-size:12px;color:{S};line-height:1.55;border-top:1px solid {L};padding-top:10px">Close to Soft Summer. Neither answer is wrong; try both and keep the one you prefer.</div></div>
{row('Match confidence', '91%', A)}{row('Based on', 'Type · tone · sensitivity · goals')}{row('What we kept', 'Answers and result. No photo.')}</div>
{cta('See my routine', 84, f'<div style="font-size:11.5px;color:{M};text-align:center;margin-bottom:10px">Shown before sign-up. Every answer stays editable.</div>')}
<div style="position:absolute;left:20px;right:20px;bottom:30px"><a href="#" class="b2" style="display:block;padding:13px">Save my profile · free account</a></div>''')

def a_makeup():
    items = [('Skin tint', '240 Warm', '#C08B5E', 'Closest match'), ('Soft matte foundation', '3W Honey', '#BB855A', 'Close match'), ('Serum foundation', 'W07', '#C59163', 'Close match')]
    rows = ''.join(f'<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid {L}">{sw(c, 38)}<div style="flex:1"><div class="k" style="color:{M};margin-bottom:4px">{a}</div><div style="font-size:14.5px;font-weight:600">Shade {b}</div></div>'
                   f'<span class="chip" style="color:{A};border-color:{A}">{m}</span></div>' for a, b, c, m in items)
    lips = ''.join(sw(c, 26) for c in ['#A0524A', '#B5654F', '#8C4A44', '#C27D62', '#93534F'])
    return P('Makeup · shade match', f'''{sbar(t)}{phead(t, 'Makeup', f'<span class="k" style="color:{M}">Depth 07 · warm</span>')}
<div style="padding:18px 20px 0"><div class="k" style="margin-bottom:8px">Foundation · matched to your profile</div><div class="d" style="font-size:34px;margin-bottom:8px">Shades that <span class="a">match.</span></div>
<p style="font-size:12.5px;color:{S};line-height:1.55;margin:0 0 12px">We reused your Skin Match tone, so you skipped four questions.</p>{rows}
<div class="c" style="padding:14px 16px;margin-top:6px;box-shadow:none;background:{BG2}"><div style="font-size:13px;font-weight:600;margin-bottom:4px">2 ranges not shown</div><div style="font-size:12px;color:{S};line-height:1.55">They don't reach your depth, so we left them out rather than show a near miss.</div></div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:14px;border-top:1px solid {L}"><div><div class="k" style="margin-bottom:5px">Lip and cheek</div><div style="font-size:12px;color:{S}">Ranked by Soft Autumn. Nothing is off-limits.</div></div><div style="display:flex;gap:4px">{lips}</div></div>
<div style="font-size:10.5px;color:{M};margin-top:12px">Sample shades for illustration.</div></div>{tabbar(t, 1)}''')

def a_lift():
    can = ''.join(f'<div style="display:flex;gap:11px;align-items:flex-start;padding:10px 0;border-top:1px solid {L}"><span style="color:{A};font-weight:700">✓</span><div><div style="font-size:14px;font-weight:600">{a}</div><div style="font-size:12px;color:{S};margin-top:2px">{b}</div></div></div>'
                  for a, b in [('Go richer or darker', 'Any Soft Autumn shade at your level or deeper.'), ('Add a gloss or toner', 'Warm chestnut and soft copper suit your season.'), ('Start a strengthening routine', 'Four weeks, two steps, then recheck.')])
    return P('Hair colour · lift check', f'''{sbar(t)}{phead(t, 'Hair colour', f'<span class="k" style="color:{M}">Lift check</span>')}
<div style="padding:16px 20px 0"><div class="k" style="margin-bottom:8px">Your result</div><div class="d" style="font-size:32px;margin-bottom:10px">Here's what works <span class="a">now.</span></div>{can}
<div style="background:{AMB['bg']};border:1px solid {AMB['bd']};border-radius:{t['rad']}px;padding:14px 16px;margin-top:12px"><div style="font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:{AMB['fg']};margin-bottom:6px;font-family:{t['kfont']}">Not yet · recheck in 4 weeks</div>
<div style="font-size:14px;font-weight:600;color:{AMB['fg']};margin-bottom:4px">Going three levels lighter at home</div><div style="font-size:12px;color:{AMB['fg']};line-height:1.55">Your hair needs the strengthening routine first. We'll remind you on 12 December and run the check again.</div></div>
<div class="c" style="padding:13px 16px;margin-top:10px;box-shadow:none"><div class="k" style="margin-bottom:5px">Want lighter sooner?</div><div style="font-size:12.5px;color:{S};line-height:1.5">A colourist can assess it in person. Take your profile summary with you.</div></div>
<div class="k" style="color:{M};margin:14px 0 2px">Shown for you · deposit-only colour</div>
<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid {L}">{sw('#6B4632', 32)}<div style="flex:1;font-size:14px;font-weight:600">Warm chestnut gloss</div><span class="d" style="font-size:20px">$24</span></div></div>{tabbar(t, 2)}''')

def a_style():
    opts = ['No particular emphasis', 'Defined waist', 'Longer line', 'Relaxed shoulder', 'Structured shoulder']
    ch = ''.join(f'<span class="chip" style="font-size:12.5px;padding:8px 14px;{"background:"+A+";color:"+t["onacc"]+";border-color:"+A+";font-weight:600" if i==0 else ""}">{o}</span>' for i, o in enumerate(opts))
    pieces = lambda cols: ''.join(f'<div style="flex:1;height:74px;border-radius:10px;background:{c}"></div>' for c in cols)
    return P('Style · guidance', f'''{sbar(t)}{phead(t, 'Style', f'<span class="k">Edit</span>')}
<div style="padding:18px 20px 0"><div class="k" style="margin-bottom:8px">Your preferences</div><div class="d" style="font-size:34px;margin-bottom:8px">Wear what <span class="a">you like.</span></div>
<p style="font-size:12.5px;color:{S};line-height:1.55;margin:0 0 14px">Tell us what you enjoy wearing. These are preferences, never rules.</p><div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:16px">{ch}</div>
<div class="c" style="padding:15px 16px;margin-bottom:16px;background:{t['panel']};box-shadow:none"><div style="font-size:14.5px;font-weight:600;margin-bottom:3px">Room to wear a lot</div><div style="font-size:12px;color:{S};line-height:1.55">With no particular emphasis, every cut is open to you. We'll sort by what you save.</div></div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px"><span class="k">In your palette</span><span style="font-size:11.5px;color:{S}">Soft Autumn · a nudge, not a rule</span></div><div style="display:flex;gap:8px;margin-bottom:16px">{pieces(['#A67C6B', '#8B8265', '#C49A7B', '#6F7A6A'])}</div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px"><span class="k" style="color:{M}">Outside your palette</span><span style="font-size:11.5px;color:{S}">Still yours if you like it</span></div><div style="display:flex;gap:8px">{pieces(['#2F4B7C', '#D94F70', '#1F1F24', '#F2F0EA'])}</div></div>{tabbar(t, 3)}''')

def a_chat():
    you = lambda x: f'<div style="align-self:flex-end;max-width:80%;background:{BG2};border-radius:16px 16px 4px 16px;padding:11px 14px;font-size:13.5px;line-height:1.5">{x}</div>'
    bot = lambda x, b: f'<div style="max-width:88%;background:{t["surf"]};border:1px solid {L};border-radius:16px 16px 16px 4px;padding:12px 14px;font-size:13.5px;line-height:1.55;color:{S}">{x}<div style="font-family:{t["kfont"]};font-size:9.5px;letter-spacing:.08em;color:{M};margin-top:8px;text-transform:uppercase">Based on: {b}</div></div>'
    sug = ''.join(f'<span class="chip" style="white-space:nowrap;background:{t["surf"]}">{x}</span>' for x in ['Layering order', 'Swap a step', 'Travel routine'])
    return P('AI Coach · chat', f'''{sbar(t)}{phead(t, 'AI Coach', f'<span class="k" style="border:1px solid {A};padding:4px 9px;border-radius:99px">Voice on</span>')}
<div style="padding:16px 20px 0;display:flex;flex-direction:column;gap:11px">{you('My new cleanser leaves my skin feeling tight. What should I look for?')}
{bot('That often points to a formula that is too stripping for a combination, low-sensitivity profile. Look for a gentle gel cleanser. Your hydrating toner afterwards will carry the rest.', 'skin type · sensitivity · PM step 2')}
{you('Should I move vitamin C to the morning?')}
{bot('You can. Mornings suit it well, and it frees your evening for the barrier steps. Want me to propose the change? You approve it before anything moves.', 'AM and PM routine · your goals')}
<div style="display:flex;gap:8px"><a href="#" class="b" style="padding:10px 16px;font-size:13px">Propose the change</a><a href="#" class="b2" style="padding:10px 16px;font-size:13px">Not now</a></div></div>
<div style="position:absolute;left:0;right:0;bottom:78px;padding:10px 16px 12px;background:{t['bg']};border-top:1px solid {L}"><div style="display:flex;gap:6px;margin-bottom:10px;overflow:hidden">{sug}</div>
<div style="display:flex;gap:9px;align-items:center"><div style="flex:1;background:{t['surf']};border:1px solid {L};border-radius:99px;padding:12px 16px;font-size:13.5px;color:{M}">Ask your coach…</div><div style="width:44px;height:44px;border-radius:50%;background:{A};display:flex;align-items:center;justify-content:center">{ico(4, t['onacc'], 20, gen.TABICON)}</div></div>
<div style="font-size:10px;color:{M};text-align:center;margin-top:8px">{COMPLY}</div></div>{tabbar(t, 4)}''')

def a_profile():
    item = lambda a, b, c='': f'<div style="display:flex;align-items:center;gap:12px;padding:13px 0;border-top:1px solid {L}"><div style="flex:1"><div style="font-size:14.5px;font-weight:600">{a}</div><div style="font-size:12px;color:{S};margin-top:2px">{b}</div></div>{c}<span style="color:{M}">›</span></div>'
    return P('Profile', f'''{sbar(t)}{phead(t, 'Profile', f'<span class="k" style="color:{M}">Settings</span>')}
<div style="padding:18px 20px 0"><div style="display:flex;align-items:center;gap:14px;margin-bottom:16px"><div style="width:56px;height:56px;border-radius:50%;background:{A};color:{t['onacc']};display:flex;align-items:center;justify-content:center;font-family:{t['dfont']};font-size:26px;font-weight:600">A</div>
<div style="flex:1"><div class="d" style="font-size:30px">Alex</div><div style="font-size:12.5px;color:{S}">Free plan · member since November</div></div></div>
<div class="c" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;margin-bottom:10px;background:{t['panel']};box-shadow:none"><div><div class="k" style="margin-bottom:4px">Premium · $14.99 / month</div><div style="font-size:12.5px;color:{S}">AI Coach, live voice, Shop My Routine</div></div><a href="#" class="b" style="padding:9px 16px;font-size:12.5px">Upgrade</a></div>
{item('Skin profile', 'Combination · warm · depth 07 · edit answers', sw(TONES[SEL], 22))}{item('Colour season', 'Soft Autumn · used by makeup, hair and style', season(t, 12))}{item('Routine reminders', 'AM 7:30 · PM 9:00')}{item('Plan and billing', 'Free · manage or upgrade')}
{item('Privacy and data', 'No photos stored. Results saved, swatches not.')}{item('AI disclosure', 'How guidance is produced and reviewed')}
<div style="border-top:1px solid {L};padding-top:12px;font-size:11px;color:{M};font-style:italic">{COMPLY}</div></div>{tabbar(t, 5)}''')

BOARDS = [  # (file, title, kind) in journey order
 ('Sig-W1-Result', 'E2E · Web 2 · Skin Match result (before sign-up)', w_result), ('Sig-W2-Portal', 'E2E · Web 3 · Portal home (signed in)', w_portal), ('Sig-W3-Plans', 'E2E · Web 4 · Plans', w_plans),
 ('Sig-A1-Welcome', 'E2E · App 1 · Welcome', a_welcome), ('Sig-A2-Result', 'E2E · App 3 · Skin Match result', a_result), ('Sig-A3-Makeup', 'E2E · App 7 · Makeup shade match', a_makeup),
 ('Sig-A4-Lift', 'E2E · App 8 · Hair colour lift check', a_lift), ('Sig-A5-Style', 'E2E · App 9 · Style guidance', a_style), ('Sig-A6-Chat', 'E2E · App 10 · AI Coach chat (Premium)', a_chat), ('Sig-A7-Profile', 'E2E · App 12 · Profile', a_profile)]

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'out'
    for fn, title, f in BOARDS:
        open(os.path.join(out, fn + '.dc.html'), 'w').write(f())
    print(len(BOARDS), 'boards')
