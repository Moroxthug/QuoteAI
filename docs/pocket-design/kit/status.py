# Builds the status-pill CSS (icon family + pills) -> kit/status.css
import urllib.parse
R='<circle cx="12" cy="12" r="9.2" fill="none" stroke="#000" stroke-width="3"/>'
def disc(knock):
    return ('<mask id="m"><rect width="24" height="24" fill="#fff"/>%s</mask><circle cx="12" cy="12" r="11" mask="url(#m)"/>'%knock)
K='fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"'
I={
 'draft': '<circle cx="12" cy="12" r="9.2" fill="none" stroke="#000" stroke-width="3" stroke-dasharray="3.6 3.6"/>',
 'q1':  R+'<path d="M12 12V6.2A5.8 5.8 0 0 1 17.8 12Z"/>',
 'q2':  R+'<path d="M12 6.2A5.8 5.8 0 0 1 12 17.8Z"/>',
 'q3':  R+'<path d="M12 12V6.2A5.8 5.8 0 1 1 6.2 12Z"/>',
 'check': disc('<path d="M7.4 12.4l3.1 3.1 6.1-6.4" %s/>'%K),
 'alert': disc('<path d="M12 6.8v6.4" %s/><circle cx="12" cy="17" r="1.7" fill="#000"/>'%K),
 'x':     disc('<path d="M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8" %s/>'%K),
 'clock': R+'<path d="M12 7.4V12l3 2" fill="none" stroke="#000" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
 'pause': R+'<rect x="8.6" y="8" width="2.4" height="8" rx="1"/><rect x="13" y="8" width="2.4" height="8" rx="1"/>',
 'off':   R+'<path d="M6.3 17.7L17.7 6.3" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>',
 'dot':   '<circle cx="12" cy="12" r="5.5"/>',
}
def url(svg):
    s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">%s</svg>'%svg
    return 'url("data:image/svg+xml,%s")'%urllib.parse.quote(s,safe='')
css=['/* status: word + colour + shape. Shape = where it is in the flow */',
 '.st{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px 0 7px;border-radius:999px;font-size:11.5px;font-weight:600;white-space:nowrap;position:relative;letter-spacing:-0.005em}',
 '.st::before{content:"";flex-shrink:0;width:12px;height:12px;background:currentColor;-webkit-mask:var(--si) center/contain no-repeat;mask:var(--si) center/contain no-repeat}',
 '.st-ok{background:var(--ok-soft);color:var(--ok);--si:%s}'%url(I['check']),
 '.st-warn{background:rgba(214,149,36,.14);color:var(--warn);--si:%s}'%url(I['clock']),
 '.st-bad{background:var(--bad-soft);color:var(--bad);--si:%s}'%url(I['alert']),
 '.st-acc{background:var(--acc-soft);color:var(--acc-soft-t);--si:%s}'%url(I['q2']),
 '.st-info{background:var(--info-soft);color:var(--info);--si:%s}'%url(I['q1']),
 '.st-mute{background:var(--sunk);color:var(--muted);--si:%s}'%url(I['draft']),
 '.st-plain{background:transparent;padding:0;height:18px}',
]
for k in I: css.append('.st.si-%s{--si:%s}'%(k,url(I[k])))
css+=['.st.si-live::before{-webkit-mask:none;mask:none;width:7px;height:7px;margin:0 2.5px;border-radius:50%;animation:stlive 2.2s cubic-bezier(.16,1,.3,1) infinite}',
 '@keyframes stlive{0%{box-shadow:0 0 0 0 currentColor}70%,100%{box-shadow:0 0 0 5px transparent}}',
 '.tag{display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:8px;font-size:11.5px;font-weight:600;background:var(--sunk);color:var(--t2);white-space:nowrap}',
 '.tag-acc{background:var(--acc-soft);color:var(--acc-soft-t)}']
open(__file__.replace('status.py','status.css'),'w').write('\n'.join(css)+'\n')
# preview sheet
rows=''.join('<div style="display:flex;align-items:center;gap:10px;margin:6px"><span class="st %s si-%s">%s</span></div>'%(c,k,k) for k,c in [('draft','st-mute'),('q1','st-info'),('q2','st-acc'),('q3','st-warn'),('check','st-ok'),('live','st-ok'),('clock','st-warn'),('pause','st-warn'),('alert','st-bad'),('x','st-bad'),('off','st-mute'),('dot','st-info')])
open('/tmp/st.html','w').write('<html><body style="font-family:sans-serif;padding:20px"><div class="th"><style>%s\n%s</style>%s</div></body></html>'%(open(__file__.replace('status.py','kit.css')).read().split('\n')[0]+'\n'+open(__file__.replace('status.py','kit.css')).read().split('\n')[1],'\n'.join(css),rows))
