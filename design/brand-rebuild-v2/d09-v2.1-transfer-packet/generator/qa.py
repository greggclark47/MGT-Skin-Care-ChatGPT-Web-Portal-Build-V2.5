import sys, glob, os, re, json
from playwright.sync_api import sync_playwright
dirs = sys.argv[1:]
FONTS = open('/home/claude/team47studio/v2/fonts.css').read()
JS = r"""() => {
 const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(',').map(x=>parseFloat(x));return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}};
 const lin=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};
 const Lm=c=>0.2126*lin(c.r)+0.7152*lin(c.g)+0.0722*lin(c.b);
 const bl=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
 const bgOf=el=>{let layers=[],e=el;while(e&&e.nodeType===1){const c=parse(getComputedStyle(e).backgroundColor);if(c&&c.a>0){layers.push(c);if(c.a>=1)break}e=e.parentElement}
   let base={r:255,g:255,b:255,a:1};for(let i=layers.length-1;i>=0;i--)base=bl(layers[i],base);return base};
 const out=[];const seen=new Set();
 document.querySelectorAll('body *').forEach(el=>{
   if(el.closest('svg')||el.closest('helmet')||['STYLE','SCRIPT','LINK'].includes(el.tagName))return;
   const has=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>0);if(!has)return;
   const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none')return;
   let fg=parse(cs.color);if(!fg)return;const bg=bgOf(el);if(fg.a<1)fg=bl(fg,bg);
   const l1=Lm(fg),l2=Lm(bg);const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
   const size=parseFloat(cs.fontSize),w=parseInt(cs.fontWeight);const large=size>=24||(size>=18.66&&w>=700);
   const need=large?3:4.5;
   if(ratio<need){const t=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ').slice(0,40);const k=t+'|'+ratio.toFixed(2);if(!seen.has(k)){seen.add(k);out.push({t,ratio:+ratio.toFixed(2),need,size})}}
 });
 const r=document.querySelector('.r')||document.body;
 return {fails:out, text:document.body.innerText, logos:[...document.images].filter(i=>/logo/.test(i.src)).map(i=>i.src.split('/').pop())}}"""
BAD = [r'\bPremium\b', r'live voice', r'7 days free', r'HIPAA', r'~60s', r'took 58', r'No photo', r'\bcolour', r'Colour', r'personalis', r'moisturis', r'\blabelled', r'centre\b', r'\bfavour', r'recognis', r'optimis', r'customis', r'organis', r'\bwhilst']
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--allow-file-access-from-files'])
    for d in dirs:
        for f in sorted(glob.glob(f'{d}/D09-*.dc.html')):
            n = os.path.basename(f)[:-8]
            if re.search(r'-(GP|AS)-S\d', n): continue
            html = open(f).read(); m = re.search(r'"\$preview":\{"width":(\d+),"height":(\d+)\}', html); W, H = int(m.group(1)), int(m.group(2))
            pg = b.new_page(viewport={'width': W, 'height': 900 if 'min-height' in html else H})
            pg.goto('file://' + os.path.abspath(f)); pg.add_style_tag(content=FONTS); pg.evaluate("Promise.all([...document.fonts].map(f=>f.load().catch(()=>0)))"); pg.wait_for_timeout(150)
            r = pg.evaluate(JS); pg.close()
            mode = 'dark' if n.endswith('dark') else 'light'
            wrong = [l for l in r['logos'] if (mode + '-surface') not in l]
            bad = [x for x in BAD if re.search(x, r['text'])]
            res[n] = dict(fails=r['fails'], wrong_logo=wrong, bad=bad, logos=len(r['logos']))
    b.close()
nf = {k: v for k, v in res.items() if v['fails'] or v['wrong_logo'] or v['bad']}
print(len(res), 'boards checked;', len(nf), 'with findings')
for k, v in nf.items(): print(k, json.dumps({x: v[x] for x in ('fails', 'wrong_logo', 'bad') if v[x]})[:600])
json.dump(res, open('/tmp/qa.json', 'w'))
