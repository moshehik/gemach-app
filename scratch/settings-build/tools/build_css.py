# Builds app/components/settings-sim/settings-sim.css from the design's page-specific rules (extracted from
# הגדרות-סימולציה.html) + local additions. Scope: every selector prefixed with .gm-ds.gm-st, tokens --x -> --gm-x,
# keyframes -> palette names (gm-popin, gm-draw) or local gm-st-*.
import re, io, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
tokens = set(re.findall(r'--gm-([a-zA-Z0-9-]+)\s*:', io.open(os.path.join(ROOT, 'design-system/tokens.css'), encoding='utf-8').read()))
tokens |= set(re.findall(r'--gm-([a-zA-Z0-9-]+)\s*:', io.open(os.path.join(ROOT, 'design-system/components.css'), encoding='utf-8').read()))
KF = {'popin': 'gm-popin', 'draw': 'gm-draw', 'frameSpin': 'gm-frameSpin', 'tpIn': 'gm-st-tpIn', 'pulse': 'gm-pulse'}

def tok(body):
    body = re.sub(r'var\(--([a-zA-Z0-9-]+)', lambda m: 'var(--gm-' + m.group(1) if m.group(1) in tokens else m.group(0), body)
    for k, v in KF.items():
        body = re.sub(r'(animation[^;:]*:[^;]*?)\b' + k + r'\b', lambda m: m.group(1) + v, body)
    return body

def scope_sel(sel):
    out = []
    for s in re.split(r',(?![^(]*\))', sel):
        s = s.strip()
        if not s:
            continue
        if s.startswith(':is(') or s.startswith(':where('):
            out.append('.gm-ds.gm-st ' + s)
        elif s.startswith('.st-view') or s.startswith('.app') or s.startswith('.rail') or s.startswith('.layout') or s.startswith('.tpop') or s.startswith('.tp-') or s.startswith('.st-') or s.startswith('.sizes') or s.startswith('.dhero') or s.startswith('.adm-') or s.startswith('.hf-') or s.startswith('.hres-n') or s.startswith('.topbar') or s.startswith('.ttl') or s.startswith('.pg-ttl') or s.startswith('.back') or s.startswith('.card') or s.startswith('.no-prop'):
            out.append('.gm-ds.gm-st ' + s)
        else:
            out.append('.gm-ds.gm-st ' + s)
    return ','.join(out)

SKIP = re.compile(r'\.st-view \.adm-rows\{|^\.st-view \.adm-rows$|\.dhero|\.no-prop|:is\(\.card,\.itm|\.card,\.itm|\.card,\.stepper|\.rtbl td \.inp|\.st-view \.tblw|\.st-view \.tools|\.st-prev|\.st-tgls|\.st-list-extra|\.rail\.open|\.rail:not\(\.open\)|\.rail\.open|rows \.rtbl|\.adm-tile|\.adm-tt|\.adm-mtools|\.adm-mbtns|\.adm-table|\.adm-trl|\.adm-h \.adm-n|\.adm-rows \.li \.go|\.adm-bar \.vsw|#tt|#toast|^\.sn-badge|^\.btn|^\.ibtn|\.ttl h1::after')

def split_rules(text):
    """[(media|None, selector, body)] — brace matching, rules may span lines."""
    out = []; i = 0; n = len(text)
    def block(start):
        d = 1; k = start
        while d and k < n:
            if text[k] == '{': d += 1
            elif text[k] == '}': d -= 1
            k += 1
        return k
    while i < n:
        j = text.find('{', i)
        if j < 0: break
        head = text[i:j].strip()
        k = block(j + 1)
        inner = text[j + 1:k - 1]
        if head.startswith('@media'):
            for (_, sel, body) in split_rules(inner):
                out.append((head, sel, body))
        else:
            out.append((None, head, inner))
        i = k
    return out

def props(body):
    return {d.split(':', 1)[0].strip() for d in body.split(';') if ':' in d}

def drop_dead_media(items):
    # an @media rule followed (later in source) by an unconditional rule for the same selector that sets the same
    # properties never applies in the design either — drop it (keeps the CSS guard's "no @media before base" rule).
    keep = []
    for i, (media, sel, body) in enumerate(items):
        if media:
            later = set()
            for (m2, s2, b2) in items[i + 1:]:
                if not m2 and s2 == sel:
                    later |= props(b2)
            if props(body) and props(body) <= later:
                continue
        keep.append((media, sel, body))
    return keep

def rules_from(path, pick):
    out = []
    items = [(m, ' '.join(s.split()), ' '.join(b.split())) for (m, s, b) in split_rules(io.open(path, encoding='utf-8').read())]
    for media, sel, body in drop_dead_media(items):
        sel = ' '.join(sel.split())
        body = ' '.join(body.split())
        if not pick(sel) or SKIP.search(sel):
            continue
        r = scope_sel(sel) + '{' + tok(body) + '}'
        out.append((media + '{' + r + '}') if media else r)
    return out

st = rules_from(os.path.join(HERE, 'demo_st_rules.css'), lambda s: True)
misc = rules_from(os.path.join(HERE, 'demo_misc_rules.css'), lambda s: re.search(r'\.(adm-h|adm-hi|adm-bar)\b', s) is not None)
local = io.open(os.path.join(HERE, 'local.css'), encoding='utf-8').read()
head = io.open(os.path.join(HERE, 'head.css'), encoding='utf-8').read()
css = head + '\n/* ===== מהעיצוב: כותרת, סרגל חיפוש, כותרות סעיפים (בלוק העמוד של הגדרות-סימולציה.html) ===== */\n' + '\n'.join(misc) + \
      '\n\n/* ===== מהעיצוב: פריסת ההגדרות (.layout/.rail/.st-*), סטפר, בוחר שעה ===== */\n' + '\n'.join(st) + \
      '\n\n' + local
io.open(os.path.join(ROOT, 'app/components/settings-sim/settings-sim.css'), 'w', encoding='utf-8', newline='\n').write(css)
print('rules', len(misc), len(st))
