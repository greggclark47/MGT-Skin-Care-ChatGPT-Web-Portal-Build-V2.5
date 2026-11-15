import sys, glob, os, json, re
from playwright.sync_api import sync_playwright
src=sys.argv[1]; out=sys.argv[2]; pat=sys.argv[3] if len(sys.argv)>3 else '*'; os.makedirs(out,exist_ok=True)
FONTS=open('/home/claude/team47studio/v2/fonts.css').read()
res={}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--allow-file-access-from-files'])
    for f in sorted(glob.glob(f'{src}/{pat}.dc.html')):
        n=os.path.basename(f)[:-8]; html=open(f).read()
        m=re.search(r'"\$preview":\{"width":(\d+),"height":(\d+)\}',html); W,H=int(m.group(1)),int(m.group(2))
        fluid='width:100%;min-height' in html
        pg=b.new_page(viewport={'width':W,'height':900 if fluid else H})
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('file://'+os.path.abspath(f)); pg.add_style_tag(content=FONTS); pg.evaluate('document.fonts.ready'); pg.evaluate("Promise.all([...document.fonts].map(f=>f.load().catch(()=>0)))"); pg.wait_for_timeout(250)
        r=pg.evaluate("""()=>{const r=document.querySelector('.r');const rr=r.getBoundingClientRect();let bad=0;r.querySelectorAll('*').forEach(e=>{if(e.closest('svg')&&e.tagName.toLowerCase()!=='svg')return;const b=e.getBoundingClientRect();if(b.width>0&&b.right>rr.right+1)bad++});
          let m=0;[...r.children].forEach(k=>{if(getComputedStyle(k).position!=='absolute')m=Math.max(m,k.getBoundingClientRect().bottom)});
          const abs=[...r.children].filter(k=>getComputedStyle(k).position==='absolute').map(k=>k.getBoundingClientRect().top);
          const imgs=[...document.images].map(i=>[i.naturalWidth,Math.round(i.getBoundingClientRect().height)]);
          const logos=[...document.images].filter(i=>/logo/.test(i.src)).length;
          return {h:r.scrollHeight,ov:bad,flow:Math.round(m),absTop:abs.length?Math.round(Math.min(...abs)):null,imgs,logos}}""")
        pg.screenshot(path=f'{out}/{n}.png',full_page=fluid); r['errs']=errs; r['w']=W; r['ph']=H; r['fluid']=fluid; res[n]=r; pg.close()
    b.close()
json.dump(res,open(f'{out}/res.json','w'))
def bad(k,v):
    if v['errs'] or v['ov'] or any(i[0]==0 for i in v['imgs']): return True
    if re.search(r'-(W\d|A01|A04)',k) and v['logos']==0 and 'Result' not in k and 'Portal' not in k: return True
    if not v['fluid'] and v['absTop'] is not None and v['flow']>v['absTop']+2: return True
    return False
b_=[(k,v) for k,v in res.items() if bad(k,v)]
print(len(res),'rendered; problems:',len(b_))
for k,v in b_: print(k,{x:v[x] for x in ('ov','flow','absTop','logos','errs')})
