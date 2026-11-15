#!/usr/bin/env python3
"""Stage the D09 v2.1 transfer packet (public tree for GitHub, full tree with the private workbook for Drive/hand-off)."""
import os, re, sys, json, glob, shutil, csv, zipfile
sys.path.insert(0, '/home/claude/team47studio'); sys.path.insert(0, '/home/claude/team47studio/v2')
from PIL import Image
import d09 as W, d09app as APP, d09store as ST, gen3, d09lib as Z

ROOT = '/home/claude/packet'; PUB = f'{ROOT}/public/D09-v2.1-transfer-packet'; FULL = f'{ROOT}/full/D09-v2.1-transfer-packet'
BOARDS_SRC = ['/tmp/d09out', '/tmp/d09app', '/tmp/d09store']
SHOTNAMES = ['01-profile-before-sign-up', '02-studio-home', '03-routine', '04-shade-match', '05-ai-coach', '06-style']
WEB = [('W1-Home', 'Homepage', '/ (assumed)'), ('W2-Result', 'Skin Match result, before sign-up', '/skin-match/result (assumed)'), ('W3-Portal', 'Signed-in portal home', '/app (assumed)'), ('W4-Membership', 'Membership: Free, Guided, Studio', '/membership (assumed)')]
APPS = [('A01-Welcome', 'Welcome'), ('A02-Match', 'Skin Match question'), ('A03-Result', 'Skin Match result'), ('A04-Home', 'Home'), ('A05-Routine', 'Routine'), ('A06-Shop', 'Shop My Routine'),
        ('A07-Makeup', 'Makeup shade match'), ('A08-Lift', 'Hair color lift check'), ('A09-Style', 'Style guidance'), ('A10-CoachPreview', 'AI Coach preview (Free)'), ('A11-CoachChat', 'AI Coach chat (Guided)'), ('A12-Profile', 'Profile')]
SUMMARY = {
 'W1-Home': 'Prism pill navigation (Skin, Color, Style, Coach, Membership); live-tile hero; five illustrated entry tiles; "Made to fit you, not an average" band that replaces the old stats line; skin, six-tool, coach and membership sections; closing call to action; footer with Terms and What to expect links.',
 'W2-Result': 'Skin Match result shown before sign-up: skin summary, color season tile, PM routine, a "What to expect" tile, and where the profile goes next.',
 'W3-Portal': 'Signed-in home: sidebar, tonight\'s routine, cart, AI Coach tile and six vertical tiles with status.',
 'W4-Membership': 'Free, Guided and Studio tiers and a comparison table. Studio price is a placeholder.',
 'A01-Welcome': 'First screen: logo on solid ground, patterned hero card, three-step strip, start button.', 'A02-Match': 'One Skin Match question (skin tone) with swatches; progress and edit-anytime note.',
 'A03-Result': 'Result summary with a patterned color-season card and what the result is based on.', 'A04-Home': 'Greeting, tonight\'s routine tile, six vertical tiles, shop and coach rows.',
 'A05-Routine': 'AM/PM routine with progress and a mark-done action.', 'A06-Shop': 'Ready-made cart from the routine; each item says why it was picked.',
 'A07-Makeup': 'Shade matches by product type; ranges outside the depth are left out and said so.', 'A08-Lift': 'Hair color lift check: safe direction first, stepwise plan, refusal state when a goal is not advisable.',
 'A09-Style': 'Preference chips (no particular emphasis first), palette as a nudge, never a rule.', 'A10-CoachPreview': 'Free coach preview with a patterned Guided upgrade card.',
 'A11-CoachChat': 'Guided coach chat; every answer lists what it was based on.', 'A12-Profile': 'Profile, plan, saved answers, privacy and AI disclosure.'}
INTERNAL = {
 'W1-Home': 'Terms and What to expect links are placeholders. "About a minute" under the main button is a time estimate to check against real completion data. Guided $14.99 is an assumption; Studio is a placeholder. Sample profile values are illustrative.',
 'W2-Result': 'Match confidence shows a qualitative label; define scale and validation before launch. Sample result copy says so on the board.',
 'W3-Portal': 'Sample user name is fictional. Plan tile names Guided; confirm entitlement logic.',
 'W4-Membership': 'Guided price [ASSUMPTION]; Studio [PRICE]. Billing mechanism for app channels unresolved (T&C Appendix C-4). Plan-change timing sentence needs T&C confirmation.',
 'A03-Result': 'Same match-confidence note as web result.', 'A06-Shop': 'Sample products and prices are illustrative. Confirm sponsor / affiliate labeling wording.',
 'A08-Lift': '"Recheck in 4 weeks" is carried over from v2.0; confirm the interval with a colorist and counsel. Refusal rules unchanged.',
 'A10-CoachPreview': 'Guided feature list paraphrased from the tier sheet; confirm.', 'A12-Profile': 'Image journal implies photo retention: privacy statement must say what is kept. Earlier "no photo stored" wording was removed everywhere.'}

def ensure(d): os.makedirs(d, exist_ok=True); return d
def clean(d): shutil.rmtree(d, ignore_errors=True); os.makedirs(d)

def stage_public():
    clean(os.path.dirname(PUB)); ensure(PUB)
    b = ensure(f'{PUB}/boards'); ensure(f'{b}/assets')
    for d in BOARDS_SRC:
        for f in glob.glob(f'{d}/D09-*.dc.html'): shutil.copy(f, b)
    for a in ('team47studio-logo-light-surface.png', 'team47studio-logo-dark-surface.png', 'play-icon-512.png', 'ios-appicon-1024.png', 'mark-256-transparent.png'):
        shutil.copy(f'/home/claude/team47studio/v2/assets/{a}', f'{b}/assets/{a}')
    # store exports (lossless re-save to shrink)
    gp = ensure(f'{PUB}/store/google-play'); asr = ensure(f'{PUB}/store/app-store')
    for m in ('dark', 'light'):
        ensure(f'{gp}/screenshots/{m}'); ensure(f'{asr}/screenshots/{m}')
        for i, nm in enumerate(SHOTNAMES, 1):
            for tag, dst in (('GP', gp), ('AS', asr)):
                im = Image.open(f'/tmp/d09storeshots/D09-{tag}-S{i}-{m}.png').convert('RGB'); im.save(f'{dst}/screenshots/{m}/{nm}.png', optimize=True)
        ensure(f'{gp}/feature-graphic'); Image.open(f'/tmp/d09storeshots/D09-GP-F1-Feature-{m}.png').convert('RGB').save(f'{gp}/feature-graphic/feature-graphic-{m}-1024x500.png', optimize=True)
    ensure(f'{gp}/icon'); shutil.copy('/home/claude/team47studio/v2/assets/play-icon-512.png', f'{gp}/icon/play-icon-512.png')
    shutil.copy('/home/claude/team47studio/v2/assets/play-feature-1024x500.png', f'{gp}/feature-graphic/supplied-previous-feature-graphic-1024x500.png')
    ensure(f'{asr}/icon'); shutil.copy('/home/claude/team47studio/v2/assets/ios-appicon-1024.png', f'{asr}/icon/ios-appicon-1024.png')
    # previews
    pv = ensure(f'{PUB}/previews')
    for m in ('dark', 'light'):
        ims = [Image.open(f'/tmp/d09shots/D09-{k}-{m}.png').convert('RGB') for k, _, _ in WEB]
        sc = .25; tw = [int(i.size[0] * sc) for i in ims]; th = [int(i.size[1] * sc) for i in ims]
        sh = Image.new('RGB', (sum(tw) + 10 * 5, max(th) + 20), (120, 120, 120)); x = 10
        for i, im in enumerate(ims): sh.paste(im.resize((tw[i], th[i])), (x, 10)); x += tw[i] + 10
        sh.save(f'{pv}/web-{m}.jpg', quality=88)
        for plat, tag in (('ios', 'IOS'), ('android', 'AND')):
            ims = [Image.open(f'/tmp/d09appshots/D09-{tag}-{k}-{m}.png').convert('RGB') for k, _ in APPS]
            w, h = ims[0].size; sc = .42; tw_, th_ = int(w * sc), int(h * sc)
            sh = Image.new('RGB', (tw_ * 6 + 10 * 7, th_ * 2 + 30), (120, 120, 120))
            for i, im in enumerate(ims): sh.paste(im.resize((tw_, th_)), (10 + (i % 6) * (tw_ + 10), 10 + (i // 6) * (th_ + 10)))
            sh.save(f'{pv}/{plat}-{m}.jpg', quality=88)
    # tokens
    tk = ensure(f'{PUB}/tokens'); toks = {m: {k: v for k, v in gen3.tokens(W.D9, m).items() if isinstance(v, (str, int, float, bool))} for m in ('dark', 'light')}
    json.dump(dict(design='D09 Card Grid v2.1', fonts=['Bricolage Grotesque (display, 800)', 'DM Sans (body)'], modes=toks), open(f'{tk}/d09-tokens.json', 'w'), indent=1)
    css = ''
    for m in ('light', 'dark'):
        sel = ':root' if m == 'light' else '[data-mode="dark"]'
        css += sel + '{' + ''.join(f'--{k}:{v};' for k, v in toks[m].items() if isinstance(v, str) and re.fullmatch(r'#[0-9A-Fa-f]{6}', v)) + '}\n'
    open(f'{tk}/d09-tokens.css', 'w').write(css)
    # generator
    gdir = ensure(f'{PUB}/generator')
    for f in ('d09.py', 'd09lib.py', 'd09app.py', 'd09store.py', 'render4.py', 'export_store.py', 'qa.py', 'build_packet.py', 'gen3.py', 'fonts.css'): shutil.copy(f'/home/claude/team47studio/v2/{f}', gdir)
    for f in ('gen.py', 'gen2.py'): shutil.copy(f'/home/claude/team47studio/{f}', gdir)
    # public-safe index
    ensure(f'{PUB}/index'); rows = [['board_file', 'platform', 'screen', 'mode', 'width', 'height', 'summary']]
    res_web = json.load(open('/tmp/d09shots/res.json'))
    for m in ('dark', 'light'):
        for k, nm, _ in WEB: rows.append([f'boards/D09-{k}-{m}.dc.html', 'web', nm, m, 1280, res_web[f'D09-{k}-{m}']['h'], SUMMARY[k]])
        for plat, tag, (w, h) in (('ios', 'IOS', (390, 844)), ('android', 'AND', (412, 915))):
            for k, nm in APPS: rows.append([f'boards/D09-{tag}-{k}-{m}.dc.html', plat, nm, m, w, h, SUMMARY[k]])
        for store, tag, (w, h) in (('google-play', 'GP', (1080, 1920)), ('app-store', 'AS', (1206, 2622))):
            for i, (sc, hd, sb) in enumerate(ST.SHOTS, 1): rows.append([f'store/{store}/screenshots/{m}/{SHOTNAMES[i-1]}.png', store, f'Screenshot {i}: {hd[0]} {hd[1]}', m, w, h, sb])
        rows.append([f'store/google-play/feature-graphic/feature-graphic-{m}-1024x500.png', 'google-play', 'Feature graphic', m, 1024, 500, 'Logo and headline on solid ground; prism art on pattern.'])
    csv.writer(open(f'{PUB}/index/design-index.csv', 'w', newline='')).writerows(rows)
    return rows

def texts():
    """Visible on-screen copy per screen (dark boards), for the workbook."""
    from playwright.sync_api import sync_playwright
    out = {}; FONTS = open('/home/claude/team47studio/v2/fonts.css').read()
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--allow-file-access-from-files'])
        targets = [(k, f'/tmp/d09out/D09-{k}-dark.dc.html', 1280) for k, _, _ in WEB] + [(k, f'/tmp/d09app/D09-IOS-{k}-dark.dc.html', 390) for k, _ in APPS]
        for k, f, w in targets:
            pg = b.new_page(viewport={'width': w, 'height': 900}); pg.goto('file://' + f); pg.wait_for_timeout(120)
            t = pg.evaluate('document.body.innerText'); pg.close()
            out[k] = ' · '.join(x.strip() for x in t.split('\n') if x.strip())
        b.close()
    return out

if __name__ == '__main__':
    rows = stage_public(); print('public staged', len(rows) - 1, 'index rows')
    json.dump(texts(), open(f'{ROOT}/texts.json', 'w'), indent=1); print('texts saved')
