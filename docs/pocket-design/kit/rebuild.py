import json,os,subprocess,sys
S=os.path.dirname(os.path.abspath(__file__))+'/..'
man=json.load(open(S+'/kit/manifest.json'))
only=sys.argv[1:]
logo=open(S+'/kit/logo_welcome.svg').read().rstrip('\n')
n_done=0
written=[]
for n,v in man.items():
    if only and n not in only: continue
    src=v.get('src',n)
    subprocess.run(['python3',S+'/kit/assemble.py',n,v['title'],S+'/screens/%s.body.html'%src,S+'/screens/%s.js'%src,str(v['H'])]+([v['tab']] if v['tab'] else []),
                   check=True,env=dict(os.environ,DC_PROPS=v['props'],UI_LANG=v.get('lang','en')),stdout=subprocess.DEVNULL)
    p=S+'/design/project/%s.dc.html'%n; s=open(p).read()
    if '@@LOGO@@' in s: s=s.replace('@@LOGO@@',logo)
    if 'width' in v:
        s=s.replace('style="width: 390px; height: %dpx'%v['H'],'style="width: %dpx; height: %dpx'%(v['width'],v['H']),1).replace('"$preview":{"width":390','"$preview":{"width":%d'%v['width'],1)
    open(p,'w').write(s); n_done+=1; written.append(p)
print('rebuilt',n_done)
# number lock on everything we just wrote (idempotent)
import subprocess, glob as _g
subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)),'numlock.py')] + written, check=True) if written else None
# French boards link to French boards
frs=[os.path.basename(w)[:-8] for w in written if os.path.basename(w)[:-8].endswith('FR')]
if frs: subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)),'frlinks.py')]+frs, check=True)
