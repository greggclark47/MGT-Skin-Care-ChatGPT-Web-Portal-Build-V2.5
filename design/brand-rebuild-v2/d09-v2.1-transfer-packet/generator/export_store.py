import sys, glob, os, re, json
from playwright.sync_api import sync_playwright
from PIL import Image
src, out = sys.argv[1], sys.argv[2]; pat = sys.argv[3] if len(sys.argv) > 3 else '*'
os.makedirs(out, exist_ok=True)
FONTS = open('/home/claude/team47studio/v2/fonts.css').read()
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--allow-file-access-from-files'])
    for f in sorted(glob.glob(f'{src}/{pat}.dc.html')):
        n = os.path.basename(f)[:-8]; html = open(f).read()
        m = re.search(r'"\$preview":\{"width":(\d+),"height":(\d+)\}', html); W, H = int(m.group(1)), int(m.group(2))
        shot = '-S' in n and ('-GP-' in n or '-AS-' in n); dsf = 3 if shot else 1
        fluid = 'width:100%;min-height' in html
        pg = b.new_page(viewport={'width': W, 'height': 900 if fluid else H}, device_scale_factor=dsf)
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('file://' + os.path.abspath(f)); pg.add_style_tag(content=FONTS); pg.evaluate('document.fonts.ready'); pg.evaluate("Promise.all([...document.fonts].map(f=>f.load().catch(()=>0)))"); pg.wait_for_timeout(300)
        path = f'{out}/{n}.png'; pg.screenshot(path=path, full_page=fluid)
        im = Image.open(path); has_alpha = im.mode in ('RGBA', 'LA')
        im.convert('RGB').save(path)   # store assets must be 24-bit, no alpha
        res[n] = dict(size=Image.open(path).size, mode=Image.open(path).mode, errs=errs, dsf=dsf); pg.close()
    b.close()
json.dump(res, open(f'{out}/res.json', 'w'))
bad = {k: v for k, v in res.items() if v['errs']}
print(len(res), 'exported; errors:', len(bad))
for k, v in list(res.items())[:60]:
    if '-S1-' in k or '-F1-' in k or '-L1-' in k: print(k, v['size'], v['mode'])
