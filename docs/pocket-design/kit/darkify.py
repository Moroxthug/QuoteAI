import re,os,sys
D=os.path.dirname(os.path.abspath(__file__))+'/../design/project/'
have={f[:-8] for f in os.listdir(D) if f.endswith('.dc.html')}
def dark(n):
    s=open(D+n+'.dc.html').read()
    s=re.sub(r'<title>(.*?)</title>',lambda m:'<title>%s (night)</title>'%m.group(1),s,1)
    s=s.replace('"dark":{"editor":"boolean","default":false}','"dark":{"editor":"boolean","default":true}')
    s=s.replace('var DARK_DEFAULT = false;','var DARK_DEFAULT = true;')
    s=re.sub(r'href="(\w+)\.dc\.html"',lambda m:'href="%sDark.dc.html"'%m.group(1) if m.group(1)+'Dark' in have else m.group(0),s)
    s=re.sub(r"'(\w+)\.dc\.html'",lambda m:"'%sDark.dc.html'"%m.group(1) if m.group(1)+'Dark' in have else m.group(0),s)
    return s
if __name__=='__main__':
    names=sys.argv[1:] or sorted(n[:-4] for n in have if n.endswith('Dark'))
    for n in names:
        open(D+n+'Dark.dc.html','w').write(dark(n))
    print('dark',len(names))
