import re,sys
NB=' '; NN=' '
MON=r'(?:janv\.|févr\.|mars|avr\.|mai|juin|juil\.|août|sept\.|oct\.|nov\.|déc\.)'
def fix(t):
    for _ in range(2): t=re.sub(r'(\d)[  ](\d{3})(?!\d)',r'\1'+NN+r'\2',t)
    t=re.sub(r'(\d) \$',r'\1'+NB+'$',t)
    t=re.sub(r'(\d) %',r'\1'+NB+'%',t)
    t=re.sub(r'(\d) h (\d)',r'\1'+NB+'h'+NB+r'\2',t)
    t=re.sub(r'(\d) h\b',r'\1'+NB+'h',t)
    t=re.sub(r'(\d) (j|jours?|pi²|gal|po|points|'+MON+r')(?=[\s.,·)\'<’]|$)',r'\1'+NB+r'\2',t)
    t=re.sub(r'(\w) \?',r'\1'+NN+'?',t)
    t=re.sub(r'(\w) :',r'\1'+NB+':',t)
    return t
for p in sys.argv[1:]:
    s=open(p).read()
    if p.endswith('.js'):
        s=re.sub(r"'(?:[^'\\\n]|\\.)*'",lambda m:fix(m.group(0)),s)
    else:
        head,sep,rest=s.partition('</style>')
        if not sep: head,sep,rest='','',s
        rest=re.sub(r'>([^<]+)<',lambda m:'>'+(m.group(1) if '{{' in m.group(1) and not re.search(r'\d',m.group(1).replace('{{','').replace('}}','')) else fix(m.group(1)))+'<',rest)
        rest=re.sub(r'(aria-label|placeholder)="([^"]*)"',lambda m:m.group(1)+'="'+fix(m.group(2))+'"',rest)
        s=head+sep+rest
    open(p,'w').write(s)
    print(p, s.count(NB), s.count(NN))
