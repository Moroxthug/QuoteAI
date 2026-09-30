#!/usr/bin/env python3
"""Assemble a quoteAI Design Component artboard from a body file and a JS file.
usage: assemble.py NAME "Title" body.html logic.js HEIGHT [TAB]
  NAME    -> writes ../design/project/NAME.dc.html
  HEIGHT  -> artboard height in px (844 = phone viewport with inner scroll; taller = full-length board)
  TAB     -> Home|Quotes|Jobs|Clients to add the floating tab bar (phone viewport mode only)
Macros inside body.html:
  [[ICON expr SIZE]]   unboxed gradient icon; expr is a renderVals path to an object made with ic(name, tone)
  [[BACK href]]        back-arrow link button (44px)
  [[MORE]]             the ⋯ icon button (44px)
  [[CHEV]]             small chevron-right in faint colour
"""
import sys, os, re
from nav_parts import ICONS, FAB
here=os.path.dirname(os.path.abspath(__file__))
name,title,bodyf,jsf,height=sys.argv[1:6]; tab=sys.argv[6] if len(sys.argv)>6 else None
H=int(height)
kit=open(os.path.join(here,'kit.css')).read()+open(os.path.join(here,'status.css')).read()+open(os.path.join(here,'expand.css')).read()+open(os.path.join(here,'ground.css')).read()
glyphs=open(os.path.join(here,'glyphs.js')).read()
body=open(bodyf).read(); js=open(jsf).read()
def icon(m):
    e,sz=m.group(1),m.group(2)
    return ('<svg class="gi" width="%s" height="%s" viewBox="5.5 5.5 19 19" aria-hidden="true"><defs><linearGradient id="{{%s.gid}}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{{%s.c0}}"></stop><stop offset="1" stop-color="{{%s.c1}}"></stop></linearGradient></defs>'
            '<path d="{{%s.d3}}" fill="url(#{{%s.gid}})" fill-opacity="0.35"></path><path d="{{%s.d2}}" fill="url(#{{%s.gid}})" fill-opacity="0.6"></path><path d="{{%s.d1}}" fill="url(#{{%s.gid}})"></path></svg>')%(sz,sz,e,e,e,e,e,e,e,e,e)
body=re.sub(r'\[\[ICON ([\w.]+) (\d+)\]\]',icon,body)
body=re.sub(r'\[\[BACK ([^\]]+)\]\]',lambda m:'<a href="%s" class="ib press" aria-label="Back"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"></path></svg></a>'%m.group(1),body)
body=body.replace('[[MORE]]','<button class="ib press" aria-label="More actions"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5.5" cy="12" r="1.6"></circle><circle cx="12" cy="12" r="1.6"></circle><circle cx="18.5" cy="12" r="1.6"></circle></svg></button>')
body=body.replace('[[XCHEV]]','<span class="xc-chev" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg></span>')
body=body.replace('[[CHEV]]','<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--faint); flex-shrink: 0"><path d="m9 6 6 6-6 6"></path></svg>')
FR=os.environ.get('UI_LANG')=='fr'
targets={'Home':'SmartHome.dc.html','Quotes':'Quotes.dc.html','Jobs':'Jobs.dc.html','Clients':'Clients.dc.html'}
LBL={'Home':'Home','Quotes':'Quotes','Jobs':'Jobs','Clients':'Clients'}
if FR:
    targets={'Home':'SmartHomeFR.dc.html','Quotes':'QuotesFR.dc.html','Jobs':'JobsFR.dc.html','Clients':'ClientsFR.dc.html'}
    LBL={'Home':'Accueil','Quotes':'Soumissions','Jobs':'Travaux','Clients':'Clients'}
nav=''
if tab:
    items=''
    for t in ['Home','Quotes','Jobs','Clients']:
        on=t==tab
        ic=ICONS[t] if on else ICONS[t].replace('class="tic"','class="tic off"')
        items+=('<a href="%s"%s style="border-radius: 26px;%s display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 10.5px; font-weight: %s; color: %s">%s%s</a>\n'
                %(targets[t],' aria-current="page"' if on else '',' background: var(--sunk);' if on else '','600' if on else '500','var(--ink)' if on else 'var(--muted)',ic,LBL[t]))
    nav=('<nav aria-label="Main" style="position: absolute; left: 16px; right: 16px; bottom: 26px; display: flex; gap: 10px; align-items: center; z-index: 20">\n'
         '<div style="flex-grow: 1; height: 62px; border-radius: 31px; background: var(--glass); -webkit-backdrop-filter: blur(20px) saturate(1.6); backdrop-filter: blur(20px) saturate(1.6); box-shadow: 0 10px 30px -8px rgba(20,20,22,.22), 0 0 0 1px var(--ring); padding: 5px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); box-sizing: border-box">\n'
         +items+'</div>\n'+FAB+'\n</nav>\n')
if tab:
    root=('<div class="th" data-theme="{{theme}}" data-ground="{{ground}}" style="width: 390px; height: %dpx; position: relative; overflow: hidden">\n'
          '<div class="scroll-y" style="height: %dpx; box-sizing: border-box; padding-bottom: 120px">\n%s\n</div>\n%s</div>')%(H,H,body,nav)
else:
    root='<div class="th" data-theme="{{theme}}" data-ground="{{ground}}" style="width: 390px; height: %dpx; position: relative; overflow: hidden; box-sizing: border-box">\n%s\n</div>'%(H,body)
out='''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>quoteAI — %s</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&amp;family=Manrope:wght@500;600;700&amp;display=swap" rel="stylesheet">
<style>
%s</style>
</helmet>
%s
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"dark":{"editor":"boolean","default":false},"ground":{"editor":"enum","options":["stone","linen","mist","porcelain","lilac","oat","sage","sky","shell","paper","fog","lavender","dawn","dusk","veil","iris"],"default":"dusk"},%s"$preview":{"width":390,"height":%d}}'>
class Component extends DCLogic {
  g(k, d) { var v = this.state && this.state[k]; return v === undefined ? d : v; }
  ic(name, tone) {
%s
    var gl = GLYPHS[name] || GLYPHS.dot, g = TONES[tone] || TONES.slate;
    this._gid = (this._gid || 0) + 1;
    return { d1: gl[0], d2: gl[1], d3: gl[2], c0: g[0], c1: g[1], gid: 'g' + this._gid + name };
  }
  renderVals() {
    this._gid = 0;
    var v = this.renderVals0();
    var DARK_DEFAULT = false;
    v.theme = (this.props.dark !== undefined ? this.props.dark : DARK_DEFAULT) ? 'dark' : 'light';
    v.ground = this.props.ground || 'dusk';
    return v;
  }
  renderVals0() {
    var self = this;
    var ic = function (n, t) { return self.ic(n, t); };
    var set = function (o) { self.setState(o); };
%s
  }
}
</script>
</body>
</html>
'''%(title,kit,root,os.environ.get('DC_PROPS',''),H,glyphs,js)
p=os.path.join(here,'..','design','project',name+'.dc.html')
if FR: out=out.replace('<html lang="en">','<html lang="fr-CA">',1)
open(p,'w').write(out)
print('wrote',p)
