"""Generate the developer handoff pack from the live design sources.
Outputs to /mnt/user-data/outputs/pocket-design/handoff/
  tokens/tokens.json, tokens.css, tokens.ts
  icons/*.svg, icons/icons.json, icons/tones.json, icons/tab-*.svg
  screens.json, navigation.json, SCREENS.md
"""
import json, os, re, subprocess
S = '/tmp/claude-0/-home-claude/623c0fab-b115-55d7-b946-c161fcbc5c10/scratchpad'
P = S + '/design/project/'
O = '/mnt/user-data/outputs/pocket-design/handoff/'
for d in ['', 'tokens', 'icons']: os.makedirs(O + d, exist_ok=True)

# ---------- tokens ----------
kit = open(S + '/kit/kit.css').read()
def vars_of(block):
    return dict(re.findall(r'--([\w-]+):([^;}]+)', block))
light = vars_of(re.search(r'^\.th\{([^}]*)\}', kit, re.M).group(1))
dark = vars_of(re.search(r'\.th\[data-theme="dark"\]\{([^}]*)\}', kit).group(1))
ground = open(S + '/kit/ground.css').read()
grounds = {}
for name, body in re.findall(r'\.th\[data-theme="light"\]\[data-ground="(\w+)"\]\{([^}]*)\}', ground):
    v = vars_of(body)
    img = re.search(r'background-image:([^;}]+)', body)
    g = {k: v[k] for k in v}
    if img: g['image'] = img.group(1)
    grounds[name] = g
grounds = {'stone': {k: light[k] for k in ['ground', 'sunk', 'soft', 'line', 'line2', 'av']}, **grounds}
home_fade = dict(re.findall(r'\[data-ground="(\w+)"\] \.home\{background-image:([^}]+)\}', ground))

ROLE = {
    'ground': 'Screen background', 'card': 'Cards, sheets, inputs', 'sunk': 'Wells: chips, search, secondary buttons, segmented track',
    'soft': 'Row hover / pressed', 'ink': 'Primary text and icons', 'inv': 'Primary button fill (inverts in dark)', 'on-inv': 'Text on primary button',
    't2': 'Secondary text (body copy inside cards)', 'muted': 'Meta text, labels', 'faint': 'Placeholders, hints (decorative only, below 4.5:1)',
    'line': 'Hairline dividers', 'line2': 'Stronger borders: inputs, grab handle', 'ring': '1px outline around cards',
    'acc': 'Brand violet: focus, links, accent buttons', 'acc-t': 'Violet text on ground', 'acc-soft': 'Violet tint background', 'acc-soft-t': 'Text on violet tint',
    'ok': 'Success text', 'ok-dot': 'Success dot', 'ok-soft': 'Success tint', 'warn': 'Warning text', 'warn-dot': 'Warning dot',
    'bad': 'Error / overdue text', 'bad-soft': 'Error tint', 'info': 'Info text', 'info-soft': 'Info tint', 'av': 'Avatar background',
    'glass': 'Floating tab bar / FAB glass', 'track-off': 'Switch track off', 'shadow': 'Float shadow colour', 'scrim': 'Sheet scrim'}
tokens = {
    '$description': 'quoteAI Pocket design tokens. Source of truth: kit/kit.css, kit/status.css, kit/expand.css, kit/ground.css. Values in px unless noted.',
    'color': {'light': light, 'dark': dark, 'roles': ROLE},
    'ground': {'default': 'dusk', 'note': 'Light theme only. Each ground overrides the listed tokens; night mode ignores grounds. Fades are fixed to the screen, not the content.',
               'options': grounds, 'homeScrollerImage': home_fade},
    'font': {
        'text': {'family': 'Geist', 'weights': [400, 500, 600], 'fallback': '-apple-system, "SF Pro Text", "Segoe UI", sans-serif', 'letterSpacing': '-0.01em'},
        'numbers': {'family': 'Manrope', 'weights': [500, 600, 700], 'features': 'tnum (tabular figures) on standalone figures',
                    'rule': 'Every digit and the characters $ % + − ° render in Manrope, everywhere, including inside sentences, chips, buttons and inputs. Words stay Geist.'},
        'license': 'Both SIL Open Font License 1.1 (Google Fonts). Bundle the font files in the app.'},
    'type': {
        'scale': [10.5, 11.5, 12.5, 13.5, 14.5, 15, 16, 17, 19, 21, 24, 28, 30, 32],
        'weights': [400, 500, 600],
        'roles': {
            'pageTitle': {'size': 30, 'weight': 600, 'letterSpacing': '-0.045em', 'lineHeight': 1.1, 'use': 'Tab screen title (Quotes, Jobs, Clients)'},
            'detailTitle': {'size': [21, 24], 'weight': 600, 'letterSpacing': '-0.03em', 'use': 'Detail screen title'},
            'groupTitle': {'size': 17, 'weight': 600, 'letterSpacing': '-0.025em'},
            'sectionHeader': {'size': 15, 'weight': 600, 'letterSpacing': '-0.02em', 'use': 'Section header left; link on the right 13.5 muted'},
            'navTitle': {'size': 15, 'weight': 600, 'use': 'Centered title in the back header'},
            'body': {'size': 15, 'weight': 400, 'lineHeight': 1.45},
            'rowTitle': {'size': 14.5, 'weight': 500},
            'meta': {'size': 12.5, 'weight': 400, 'color': 'muted'},
            'caption': {'size': 11.5, 'weight': 400, 'color': 'muted'},
            'status': {'size': 11.5, 'weight': 600},
            'kpiValue': {'size': 19, 'weight': 600, 'letterSpacing': '-0.03em', 'font': 'numbers'},
            'heroFigure': {'size': [32, 44], 'weight': 600, 'letterSpacing': '-0.04em', 'font': 'numbers'}}},
    'radius': {'card': 22, 'sheet': 28, 'tile': 18, 'banner': 16, 'buttonLg': 17, 'button': 15, 'search': 14, 'buttonMd': 13, 'field': 13,
               'buttonSm': 11, 'segment': 11, 'segmentThumb': 9, 'chip': 999, 'avatar': 999, 'bar': 4},
    'size': {'buttonSm': 36, 'buttonMd': 44, 'button': 50, 'buttonLg': 54, 'fabBar': 56, 'chip': 34, 'search': 44, 'field': 46, 'segment': 36,
             'tab': 44, 'header': 52, 'iconButton': 44, 'avatar': 38, 'rowMin': 44, 'formRow': 62, 'minTouch': 44, 'tabBar': 62, 'progressBar': 4,
             'icon': {'list': 28, 'quickAction': 30, 'tabBar': 25, 'range': [22, 44]}, 'statusPill': 24},
    'space': {'gutter': 16, 'cardPadding': 16, 'rowPaddingY': 12, 'rowPaddingX': 16, 'sectionGap': [18, 24], 'chipGap': 6, 'tileGap': 8,
              'listItemGap': 12, 'tabGap': 22, 'fabBarInset': {'side': 16, 'bottom': 26}},
    'shadow': {'ring': '0 0 0 1px var(--ring)', 'float': '0 10px 30px -8px var(--shadow)', 'sheet': '0 -20px 60px -20px var(--shadow)',
               'thumb': '0 1px 3px rgba(0,0,0,.14)', 'tileSelected': '0 0 0 2px var(--ink), 0 12px 24px -16px var(--shadow)',
               'expandOpen': 'deep soft shadow on the open card, see motion.expandPop'},
    'motion': {
        'easing': {'out': 'cubic-bezier(.16,1,.3,1)', 'spring': 'cubic-bezier(.34,1.4,.64,1)', 'expand': 'cubic-bezier(.32,.72,0,1)', 'pop': 'cubic-bezier(.22,1,.36,1)', 'tick': 'cubic-bezier(.34,1.5,.64,1)'},
        'press': {'scale': 0.96, 'duration': 200, 'easing': 'out'},
        'rise': {'from': {'opacity': 0, 'translateY': 10}, 'duration': 800, 'easing': 'out', 'stagger': [40, 80], 'use': 'Sections entering a screen'},
        'segmentThumb': {'duration': 450, 'easing': 'out'},
        'switchKnob': {'duration': 400, 'easing': 'spring'},
        'expand': {'height': {'duration': 450, 'easing': 'expand'}, 'content': {'translateY': -6, 'fadeDelay': 120, 'duration': 450},
                   'chevron': 'rotates 180°, gets a sunk circle when open'},
        'expandPop': {'scale': [0.985, 1.022, 1], 'translateY': -2, 'duration': 620, 'easing': 'pop',
                      'rows': {'translateY': 10, 'scaleFrom': 0.97, 'stagger': 40}, 'listDetach': {'margin': -8, 'radius': 22, 'othersOpacity': 0.45}},
        'progressGrow': {'duration': 1200, 'delay': 200, 'easing': 'out'},
        'sheetUp': {'from': 'translateY(100%)', 'easing': 'out'},
        'assistantOrb': {'swirl': '18s linear rotate', 'halo': '3.2s ease-in-out breathing'},
        'reducedMotion': 'All animation and transitions off when the OS asks for reduced motion.'},
    'status': {
        'anatomy': 'Word + colour + shape. 24px pill, radius 999, 11.5/600 text, 14px shape icon on the left. Plain variant: no background, 18px tall.',
        'tones': {'ok': 'done, paid, signed, active', 'warn': 'waiting on time, due soon, partial', 'bad': 'overdue, failed, blocked',
                  'acc': 'viewed / needs your review', 'info': 'sent, scheduled, planning', 'mute': 'draft, archived, expired'},
        'shapes': {'draft': 'dashed ring: not started', 'q1': 'quarter pie: sent / first step', 'q2': 'half pie: viewed / in review', 'q3': 'three-quarter pie: partly paid / nearly done',
                   'check': 'filled check: done, paid, accepted', 'live': 'pulsing dot: happening now', 'clock': 'clock: waiting on a date', 'pause': 'pause: on hold',
                   'alert': 'exclamation: overdue, needs action', 'x': 'cross: declined, failed', 'off': 'slashed ring: expired, cancelled', 'dot': 'plain dot: neutral'}},
    'layout': {'phone': {'width': 390, 'height': 844}, 'tablet': {'width': 1366, 'height': 1024}, 'maxContentWidth': 358,
               'tabBar': 'Floating glass bar, 62 tall, radius 31, 16 from the sides, 26 from the bottom, 4 tabs (Home, Quotes, Jobs, Clients) + assistant orb on the right'},
}
json.dump(tokens, open(O + 'tokens/tokens.json', 'w'), indent=1, ensure_ascii=False)

css = ['/* quoteAI Pocket tokens (generated from kit/*.css). Light is the default; add data-theme="dark" for night, data-ground="…" for a light ground. */',
       ':root, [data-theme="light"] {'] + ['  --%s: %s;' % kv for kv in light.items()] + ['}', '[data-theme="dark"] {'] + ['  --%s: %s;' % kv for kv in dark.items()] + ['}']
for name, g in grounds.items():
    body = ' '.join('--%s: %s;' % (k, v) for k, v in g.items() if k != 'image')
    if 'image' in g: body += ' background-image: %s;' % g['image']
    css.append('[data-theme="light"][data-ground="%s"] { %s }' % (name, body))
css += [':root {', '  --font-text: Geist, -apple-system, "SF Pro Text", "Segoe UI", sans-serif;', '  --font-num: Manrope, -apple-system, sans-serif;',
        '  --ease-out: cubic-bezier(.16,1,.3,1); --ease-spring: cubic-bezier(.34,1.4,.64,1); --ease-expand: cubic-bezier(.32,.72,0,1); --ease-pop: cubic-bezier(.22,1,.36,1);',
        '  --r-card: 22px; --r-sheet: 28px; --r-tile: 18px; --r-btn: 15px; --r-btn-sm: 11px; --r-btn-md: 13px; --r-btn-lg: 17px; --r-field: 13px; --r-chip: 999px;', '}']
open(O + 'tokens/tokens.css', 'w').write('\n'.join(css) + '\n')

def ts(o, ind=1):
    sp = '  ' * ind
    if isinstance(o, dict):
        return '{\n' + ',\n'.join('%s%s: %s' % (sp, json.dumps(k) if not re.match(r'^[A-Za-z_]\w*$', k) else k, ts(v, ind + 1)) for k, v in o.items()) + '\n' + '  ' * (ind - 1) + '}'
    return json.dumps(o, ensure_ascii=False)
open(O + 'tokens/tokens.ts', 'w').write('// quoteAI Pocket design tokens (generated). Use with React Native / Expo or any TS front end.\n'
    '// Colours are strings usable in RN styles; rgba() values included as-is.\n\nexport const tokens = ' + ts({k: v for k, v in tokens.items() if not k.startswith('$')}) + ' as const;\n\nexport type ThemeName = "light" | "dark";\nexport type GroundName = keyof typeof tokens.ground.options;\n')

# ---------- icons ----------
js = open(S + '/kit/glyphs.js').read()
node = r"""
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const self = {}; (function () { eval(src); }).call(self);
process.stdout.write(JSON.stringify({glyphs: self._GLY, tones: self._TON}));
"""
open('/tmp/gl.js', 'w').write(node)
data = json.loads(subprocess.run(['node', '/tmp/gl.js', S + '/kit/glyphs.js'], capture_output=True, text=True, check=True).stdout)
glyphs, tones = data['glyphs'], data['tones']
json.dump({'viewBox': '5.5 5.5 19 19', 'layers': 'd1 opacity 1, d2 opacity 0.6, d3 opacity 0.35, all filled with the tone gradient (top-left c0 to bottom-right c1)',
           'glyphs': {k: {'d1': v[0], 'd2': v[1], 'd3': v[2]} for k, v in glyphs.items()}}, open(O + 'icons/icons.json', 'w'), indent=1)
json.dump({k: {'c0': v[0], 'c1': v[1]} for k, v in tones.items()}, open(O + 'icons/tones.json', 'w'), indent=1)
for k, v in glyphs.items():
    c0, c1 = tones['violet']
    open(O + 'icons/%s.svg' % k, 'w').write(
        '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="5.5 5.5 19 19"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient></defs>'
        '<path d="%s" fill="url(#g)" fill-opacity="0.35"/><path d="%s" fill="url(#g)" fill-opacity="0.6"/><path d="%s" fill="url(#g)"/></svg>\n' % (c0, c1, v[2], v[1], v[0]))
import sys; sys.path.insert(0, S + '/kit')
from nav_parts import ICONS
for k, v in ICONS.items():
    open(O + 'icons/tab-%s.svg' % k.lower(), 'w').write(v.replace('<svg class="tic"', '<svg xmlns="http://www.w3.org/2000/svg"', 1) + '\n')

# ---------- screens ----------
canvas = json.load(open(P + 'canvas.json'))
pages = {p['id']: p['name'] for p in canvas['pages']}
boards = canvas['boards']
man = json.load(open(S + '/kit/manifest.json'))
files = sorted(f[:-8] for f in os.listdir(P) if f.endswith('.dc.html'))
base = [f for f in files if not f.endswith('Dark') and not f.endswith('FR') and not f.endswith('XL')]
SECTION_ORDER = ['home', 'sales', 'jobs', 'money', 'outside', 'getting-in', 'account', 'settings-pages', 'assistant', 'workspace', 'system']
def route(n):
    return '/' + re.sub(r'(?<!^)(?=[A-Z])', '-', n).lower()
def props(n):
    s = open(P + n + '.dc.html').read()
    m = re.search(r"data-props='(\{.*?\})'>", s)
    try: pr = json.loads(m.group(1))
    except Exception: return {}, (390, 844)
    prev = pr.pop('$preview', {})
    for k in ['dark', 'ground']: pr.pop(k, None)
    return {k: v.get('options', v.get('editor')) for k, v in pr.items()}, (prev.get('width', 390), prev.get('height', 844))
def links(n):
    s = open(P + n + '.dc.html').read()
    out = set(re.findall(r'''["'/ ](\w+)\.dc\.html''', s)) - {n}
    return sorted(x for x in out if x in files and not x.endswith('Dark'))
def title(n):
    m = re.search(r'<title>(?:quoteAI — )?(.*?)</title>', open(P + n + '.dc.html').read())
    return m.group(1) if m else n
def bilingual(n):
    src = man.get(n, {}).get('src', n)
    p = S + '/screens/%s.js' % src
    return os.path.exists(p) and "this.g('lang'" in open(p).read()
screens = []
for n in base:
    b = boards.get(n + '.dc.html', {})
    st, (w, h) = props(n)
    screens.append({'id': n, 'title': title(n), 'section': pages.get(b.get('page'), b.get('page')), 'sectionId': b.get('page'), 'route': route(n),
                    'board': n + '.dc.html', 'night': n + 'Dark.dc.html' if n + 'Dark' in files else None,
                    'french': n + 'FR.dc.html' if n + 'FR' in files else ('built-in EN/FR switch' if bilingual(n) else None),
                    'largeText': n + 'XL.dc.html' if n + 'XL' in files else None,
                    'frame': {'w': w, 'h': h}, 'tabBar': man.get(n, {}).get('tab') or ('Home' if n == 'SmartHome' else None),
                    'states': st, 'linksTo': links(n)})
screens.sort(key=lambda s: (SECTION_ORDER.index(s['sectionId']) if s['sectionId'] in SECTION_ORDER else 99, s['id']))
json.dump({'count': len(screens), 'screens': screens}, open(O + 'screens.json', 'w'), indent=1, ensure_ascii=False)
edges = [{'from': s['id'], 'to': t} for s in screens for t in s['linksTo'] if not t.endswith('FR')]
json.dump({'edges': edges}, open(O + 'navigation.json', 'w'), indent=1)

md = ['# Screen inventory', '', '%d screens. Each has a night version; French is a separate board unless marked "built-in switch". '
      'Frame is the board size in the design (tall boards show the whole scroll). States are the Tweaks the board exposes: build each one. '
      'Links are what each screen navigates to. Full data: `screens.json`, `navigation.json`.' % len(screens), '']
cur = None
for s in screens:
    if s['section'] != cur:
        cur = s['section']; md += ['', '## ' + str(cur), '', '| Screen | Route | Frame | States | French | Goes to |', '|---|---|---|---|---|---|']
    stt = '; '.join('%s: %s' % (k, ', '.join(map(str, v)) if isinstance(v, list) else v) for k, v in s['states'].items()) or '—'
    fr = 'board' if s['french'] and s['french'].endswith('.dc.html') else ('built-in switch' if s['french'] else '—')
    go = ', '.join(t for t in s['linksTo'] if not t.endswith('FR'))[:160] or '—'
    md.append('| %s `%s` | `%s` | %d×%d%s | %s | %s | %s |' % (s['title'], s['id'], s['route'], s['frame']['w'], s['frame']['h'], ' + tab bar' if s['tabBar'] else '', stt, fr, go))
open(O + 'SCREENS.md', 'w').write('\n'.join(md) + '\n')
print('screens', len(screens), 'edges', len(edges), 'icons', len(glyphs), 'tones', len(tones), 'grounds', len(grounds))
# brand marks
from nav_parts import FAB
m = re.search(r'<svg class="swirl".*?</svg>', FAB, re.S)
open(O + 'icons/assistant-orb.svg', 'w').write(m.group(0).replace('<svg class="swirl"', '<svg xmlns="http://www.w3.org/2000/svg"', 1).replace(' aria-hidden="true" style="position: relative"', '') + '\n')
logo = open(S + '/kit/logo_welcome.svg').read()
if 'xmlns=' not in logo: logo = logo.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"', 1)
open(O + 'icons/logo.svg', 'w').write(logo)
