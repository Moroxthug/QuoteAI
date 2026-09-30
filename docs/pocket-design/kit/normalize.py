"""Phase-1 normaliser: canonical statuses, button sizes, type scale. Idempotent."""
import re,sys,os
# word pattern -> (tone, icon)
STAT=[
 (r'Draft|To apply', 'mute','draft'),
 (r'Sent|Link sent|Issued|Planning|Scheduled', 'info','q1'),
 (r'Viewed|Opened|Review setup|In review', 'acc','q2'),
 (r'Partly paid|Part paid', 'warn','q3'),
 (r'Active|Link active|On site|In progress|Clocked in', 'ok','live'),
 (r'Completed|Done|Closed', 'mute','check'),
 (r'Paid|Accepted|Signed|Matched|Passed|Approved|Verified|Confirmed|Ready|Won', 'ok','check'),
 (r'Expires [A-Za-z0-9 ]+|Awaiting|To confirm|Not booked|Waiting|Overtime[^\'"]*|Question|Due [^\'"]+|Pending', 'warn','clock'),
 (r'On hold|Held|Paused', 'warn','pause'),
 (r'Overdue|\d+ days? (late|overdue)|Off site at clock-in|Blocked|Late|Blocker', 'bad','alert'),
 (r'Declined|Voided|Failed|Cancelled|Lost|Rejected', 'bad','x'),
 (r'Expired|Ignored|No link|Not connected|Archived', 'mute','off'),
 (r'Saturday|Material|Recorded as a cost|Logged by the worker|Open|New', None,'dot'),
]
def classify(word, tone):
    for pat,t,icn in STAT:
        if re.fullmatch(pat, word): return (t or tone), icn
    return tone, None
def fix_js(s):
    def rep(m):
        q1,word,sep,q2,tone,rest=m.group(1),m.group(2),m.group(3),m.group(4),m.group(5),m.group(6)
        t,icn=classify(word,tone)
        if icn is None:
            return m.group(0)
        rest=re.sub(r'\s*si-\w+','',rest)
        return '%s%s%s%s%sst-%s%s%s%s'%(q1,word,q1,sep,q2,t,(' si-'+icn) if icn else '',rest,q2)
    return re.sub(r"(['\"])([A-Z][^'\"\n]{0,40}?)\1(\s*,\s*)(['\"])st-(\w+)((?:\s+si-\w+)*)\4",rep,s)
def fix_body(s):
    def rep(m):
        tone,rest,attrs,word=m.group(1),m.group(2),m.group(3),m.group(4)
        t,icn=classify(word.strip(),tone)
        if icn is None:
            return m.group(0)
        rest=re.sub(r'\s*si-\w+','',rest)
        return 'class="st st-%s%s%s"%s>%s<'%(t,(' si-'+icn) if icn else '',rest,attrs,word)
    return re.sub(r'class="st st-(\w+)((?:\s+[\w-]+)*)"([^>]*)>([^<{]+)<',rep,s)
SIZE={'10px':'10.5px','11px':'11.5px','12px':'12.5px','13px':'13.5px','14px':'14.5px','18px':'19px','20px':'21px','22px':'24px','26px':'28px'}
def fix_sizes(s):
    s=re.sub(r'font-size:(\s?)(\d+px)\b',lambda m:'font-size:%s%s'%(m.group(1),SIZE.get(m.group(2),m.group(2))),s)
    s=re.sub(r'font-weight:(\s?)700\b',r'font-weight:\g<1>600',s)
    return s
def fix_btns(s):
    def rep(m):
        tag=m.group(0)
        cm=re.search(r'class="([^"]*)"',tag)
        if not cm or not re.search(r'\bbtn\b',cm.group(1)): return tag
        sm=re.search(r'style="([^"]*)"',tag)
        if not sm: return tag
        st=sm.group(1); hm=re.search(r'(?<![-\w])height:\s*(\d+)px',st)
        if not hm: return tag
        h=int(hm.group(1)); cls=cm.group(1)
        size='btn-sm' if h<=40 else 'btn-md' if h<=47 else '' if h<=52 else 'btn-lg'
        st2=re.sub(r'(?<![-\w])(height|border-radius|font-size):\s*[^;"]+;?\s*','',st).strip()
        cls2=re.sub(r'\s*btn-(sm|md|lg)\b','',cls)
        if size: cls2=cls2.replace('btn','btn '+size,1) if 'btn ' in cls2 or cls2.endswith('btn') else cls2+' '+size
        tag=tag.replace(cm.group(0),'class="%s"'%cls2,1)
        tag=tag.replace(sm.group(0),('style="%s"'%st2) if st2 else '',1)
        return tag
    return re.sub(r'<(button|a)\b[^>]*>',rep,s)
if __name__=='__main__':
    for p in sys.argv[1:]:
        s=o=open(p).read()
        if p.endswith('.js'): s=fix_js(s)
        else: s=fix_body(fix_btns(s))
        s=fix_sizes(s)
        if s!=o: open(p,'w').write(s)
