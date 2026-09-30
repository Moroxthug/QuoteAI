"""Build and check one French board without touching manifest.json or other boards.
usage: python3 kit/frbuild.py NAME [H]
  reads the English manifest entry for NAME, builds design/project/NAMEFR.dc.html from
  screens/NAMEFR.body.html + screens/NAMEFR.js (UI_LANG=fr), then renders it and reports:
  - content height vs board height (grow H if content is cut off)
  - text that overflows its box (likely too long in French)
  - leftover English words (rough heuristic)
  screenshot: prev/frchk_NAMEFR.png"""
import json, os, subprocess, sys, re, asyncio, shutil
K = os.path.dirname(os.path.abspath(__file__)); S = K + '/..'
name = sys.argv[1]; fr = name + 'FR'
man = json.load(open(K + '/manifest.json')); v = man[name]
H = int(sys.argv[2]) if len(sys.argv) > 2 else v['H']
subprocess.run(['python3', K + '/assemble.py', fr, v['title'] + ' (FR)', S + '/screens/%s.body.html' % fr, S + '/screens/%s.js' % fr, str(H)] + ([v['tab']] if v['tab'] else []),
               check=True, env=dict(os.environ, DC_PROPS=v['props'], UI_LANG='fr'), stdout=subprocess.DEVNULL)
p = S + '/design/project/%s.dc.html' % fr; s = open(p).read()
if '@@LOGO@@' in s: s = s.replace('@@LOGO@@', open(K + '/logo_welcome.svg').read().rstrip('\n'))
if 'width' in v:
    s = s.replace('style="width: 390px; height: %dpx' % H, 'style="width: %dpx; height: %dpx' % (v['width'], H), 1).replace('"$preview":{"width":390', '"$preview":{"width":%d' % v['width'], 1)
open(p, 'w').write(s)
subprocess.run([sys.executable, K + '/numlock.py', p], check=True, stdout=subprocess.DEVNULL)
shutil.copy(p, S + '/prev/frchk_%s.dc.html' % fr)
W = v.get('width', 390)
JS = r"""() => {
 const th = document.querySelector('.th'); const out = {H: th.getBoundingClientRect().height, content: 0, over: [], english: []};
 let maxB = 0; for (const el of th.querySelectorAll('*')) { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
   if (cs.display==='none'||cs.visibility==='hidden'||r.width===0) continue;
   if (cs.position!=='fixed' && cs.position!=='absolute') maxB = Math.max(maxB, r.bottom - th.getBoundingClientRect().top);
   let own=''; for (const c of el.childNodes) if (c.nodeType===3) own+=c.textContent; own=own.trim();
   if (own && el.scrollWidth > el.clientWidth + 1 && (cs.overflow==='hidden'||cs.textOverflow==='ellipsis'||cs.whiteSpace==='nowrap')) out.over.push(own.slice(0,50));
   if (own && /\b(the|and|with|your|you|for|from|this|Add|Save|Edit|Send|Open|Done|Cancel|Settings|Today|Yesterday|Back|Next|Close|View|Paid|Due|Overdue|Sent|Draft)\b/.test(own)) out.english.push(own.slice(0,60)); }
 out.content = Math.round(maxB); return out; }"""
async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        b = await pw.chromium.launch(); pg = await b.new_page(viewport={'width': W, 'height': 844})
        await pg.goto('http://127.0.0.1:8765/frchk_%s.dc.html' % fr); await pg.wait_for_timeout(1300)
        r = await pg.evaluate(JS)
        await pg.screenshot(path=S + '/prev/frchk_%s.png' % fr, full_page=True); await b.close()
    print('board H', H, '| content bottom', r['content'], '(grow H)' if r['content'] > H + 2 else 'ok')
    print('overflowing text:', r['over'][:15] or 'none')
    print('possible English left:', r['english'][:20] or 'none')
os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
asyncio.run(main())
