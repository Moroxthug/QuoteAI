"""Point links on French boards at the French version of the target when one exists.
usage: python3 frlinks.py [NAMEFR ...]  (default: every *FR board)"""
import os,re,sys
D=os.path.dirname(os.path.abspath(__file__))+'/../design/project/'
have={f[:-8] for f in os.listdir(D) if f.endswith('.dc.html')}
names=sys.argv[1:] or sorted(n for n in have if n.endswith('FR'))
def sub(m):
    q,n=m.group(1),m.group(2)
    return '%s%sFR.dc.html'%(q,n) if n+'FR' in have and not n.endswith('FR') and not n.endswith('Dark') else m.group(0)
for n in names:
    p=D+n+'.dc.html'; s=open(p).read()
    t=re.sub(r'''(["'/ ])(\w+)\.dc\.html''',sub,s)
    if t!=s: open(p,'w').write(t)
print('fr links',len(names))
