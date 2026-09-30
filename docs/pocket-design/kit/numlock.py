"""Number lock: every digit in the app renders in Manrope, whatever element it sits in.
Adds a tiny Manrope digits-only face (3 KB, embedded) under the family name Geist,
declared after the Google Fonts link so it wins for 0-9 $ % + − °. Idempotent.
usage: python3 numlock.py file.dc.html [...]"""
import sys, os, base64, re
here = os.path.dirname(os.path.abspath(__file__))
b64 = base64.b64encode(open(os.path.join(here, 'mdigits.woff2'), 'rb').read()).decode()
RANGE = 'U+0030-0039,U+0024,U+0025,U+002B,U+2212,U+00B0'
TAG = ('<style data-numlock>@font-face{font-family:Geist;src:url(data:font/woff2;base64,%s) format("woff2");'
       'font-weight:200 800;font-style:normal;font-display:block;unicode-range:%s}</style>') % (b64, RANGE)
for f in sys.argv[1:]:
    s = open(f).read()
    s = re.sub(r'<style data-numlock>.*?</style>\n?', '', s, flags=re.S)
    m = re.search(r'<link href="https://fonts\.googleapis\.com/css2[^>]*>\n', s)
    if not m: print('no font link:', f); continue
    s = s[:m.end()] + TAG + '\n' + s[m.end():]
    open(f, 'w').write(s)
