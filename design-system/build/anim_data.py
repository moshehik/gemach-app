"""Animation + transition catalogue built from the pages' own CSS and from what was really observed running."""
import re, json, os, collections
import tinycss2
from mkcss import blocks, top_commas, CLS, load_page
SP = os.path.dirname(os.path.abspath(__file__))
TIME = re.compile(r'(-?[\d.]+)(ms|s)\b')

def secs(m): return float(m.group(1)) / (1000 if m.group(2) == 'ms' else 1)

def parse_anim(decl, names):
    # split a comma separated list of animations (top-level commas)
    out = []
    for part in top_commas(decl):
        name = next((n for n in names if re.search(r'(?<![\w-])' + re.escape(n) + r'(?![\w-])', part)), None)
        if not name: continue
        ts = [secs(m) for m in TIME.finditer(part)]
        ease = re.search(r'(cubic-bezier\([^)]*\)|steps\([^)]*\)|ease-in-out|ease-out|ease-in|linear|ease)', part)
        it = 'infinite' if 'infinite' in part else (re.search(r'(?<![\w.-])(\d+)(?![\w.%-])', TIME.sub('', re.sub(r'cubic-bezier\([^)]*\)|steps\([^)]*\)', '', part))) or [None, '1'])[1]
        out.append({'name': name, 'dur': ts[0] if ts else None, 'delay': ts[1] if len(ts) > 1 else 0, 'ease': ease.group(1) if ease else 'ease', 'iter': it,
                    'fill': next((f for f in ('both', 'forwards', 'backwards') if f in part), '')})
    return out

def walk(rules, ctx, fn):
    for r in rules:
        if r.type == 'qualified-rule': fn(r, ctx)
        elif r.type == 'at-rule' and r.lower_at_keyword in ('media', 'supports'):
            fn_ctx = ctx + '@' + r.lower_at_keyword + ' ' + tinycss2.serialize(r.prelude).strip()
            walk(tinycss2.parse_rule_list(r.content, skip_comments=True, skip_whitespace=True), fn_ctx, fn)

def collect(t):
    h, html, text = load_page(t)
    kf_css = open(os.path.join(SP, f'kf_{t}.css'), encoding='utf8').read()
    names = re.findall(r'@keyframes ([^{]+)\{', kf_css)
    uses = collections.defaultdict(list); trans = collections.Counter(); trans_sel = collections.defaultdict(list)
    def fn(r, ctx):
        sel = tinycss2.serialize(r.prelude).strip()
        decls = tinycss2.parse_declaration_list(r.content, skip_comments=True, skip_whitespace=True)
        for d in decls:
            if d.type != 'declaration': continue
            v = tinycss2.serialize(d.value).strip()
            if d.lower_name in ('animation', 'animation-name'):
                for a in parse_anim(v, names) if d.lower_name == 'animation' else [{'name': n, 'dur': None, 'delay': 0, 'ease': '', 'iter': '', 'fill': ''} for n in names if n in v]:
                    a.update({'sel': sel, 'ctx': ctx}); uses[a['name']].append(a)
            elif d.lower_name == '--ia-a':
                nm = v.strip()
                icons = [i for i in re.findall(r'\.ia-([A-Za-z0-9]+)', sel) if i not in ('h', 'in', 'dr', 'ov', 'bg')]
                for i in icons: uses[nm].append({'name': nm, 'dur': None, 'delay': 0, 'ease': '', 'iter': '1', 'fill': '', 'sel': '.ia-' + i, 'ctx': '', 'icon': i})
            elif d.lower_name == 'transition' and 'reduced-motion' not in ctx:
                for part in top_commas(v):
                    ts = [secs(m) for m in TIME.finditer(part)]
                    ease = re.search(r'(cubic-bezier\([^)]*\)|steps\([^)]*\)|ease-in-out|ease-out|ease-in|linear|ease)', part)
                    key = (round(ts[0] * 1000) if ts else 0, ease.group(1) if ease else ('var(--ease)' if 'var(--ease)' in part else 'ease'))
                    trans[key] += 1
    for name, css in blocks(html):
        walk(tinycss2.parse_stylesheet(css, skip_comments=True, skip_whitespace=True), '', fn)
    kfs = {}
    for m in re.finditer(r'@keyframes ([^{]+)\{(.*)\}\s*(?=@keyframes|$)', kf_css, re.S):
        pass
    for n in names:
        m = re.search(r'@keyframes ' + re.escape(n) + r'\{(.*?)\}\s*(?=@keyframes|\Z)', kf_css, re.S)
        kfs[n] = m.group(1).strip() if m else ''
    return h, uses, trans, kfs

def trigger(sel, a, ctx):
    if a.get('icon'): return 'רחיפה על אייקון'
    if 'infinite' == a['iter']: return 'לולאה'
    if re.search(r':hover|:focus|:active', sel): return 'רחיפה / מיקוד'
    if re.search(r'\.(enter|fresh|in|pop|shine-on|bump|pulse|leaving|out|open|on)\b', sel): return 'כניסה / שינוי מצב'
    if re.search(r'\[data-ico|\.ia-', sel): return 'רחיפה / מיקוד'
    return 'טעינה / הופעה'

def build():
    res = {}
    for t in 'AB':
        h, uses, trans, kfs = collect(t)
        obs = {k: sorted(v['els'].keys())[:6] for k, v in h['anims'].items()}
        res[t] = {'uses': uses, 'trans': trans, 'kfs': kfs, 'obs': obs}
    names = sorted(set(res['A']['kfs']) | set(res['B']['kfs']))
    entries = []
    for n in names:
        pages, sels, trig, dur, ease, it, delay, fill = set(), [], collections.Counter(), collections.Counter(), collections.Counter(), collections.Counter(), collections.Counter(), collections.Counter()
        obs = {}
        for t in 'AB':
            if n in res[t]['kfs'] or n in res[t]['uses']: pages.add(t)
            for a in res[t]['uses'].get(n, []):
                s = a['sel']
                if not any(x[1] == s for x in sels): sels.append((t, s))
                trig[trigger(s, a, a['ctx'])] += 1
                if a['dur'] is not None: dur[a['dur']] += 1
                if a['ease']: ease[a['ease']] += 1
                if a['iter']: it[a['iter']] += 1
                if a['delay']: delay[a['delay']] += 1
                if a['fill']: fill[a['fill']] += 1
            if n in res[t]['obs']: obs[t] = res[t]['obs'][n]
        kf = res['A']['kfs'].get(n) or res['B']['kfs'].get(n) or ''
        entries.append({'name': n, 'pages': sorted(pages), 'sels': sels[:6], 'nsel': len(sels), 'icons': sorted({a2['icon'] for t2 in 'AB' for a2 in res[t2]['uses'].get(n, []) if a2.get('icon')}), 'trig': trig.most_common(3), 'dur': dur.most_common(1)[0][0] if dur else None,
                        'ease': ease.most_common(1)[0][0] if ease else 'ease', 'iter': it.most_common(1)[0][0] if it else '1', 'delay': delay.most_common(1)[0][0] if delay else 0,
                        'fill': fill.most_common(1)[0][0] if fill else '', 'kf': kf, 'observed': obs})
    tr = collections.Counter()
    for t in 'AB':
        for k, v in res[t]['trans'].items(): tr[k] = max(tr[k], v)
    return entries, tr

if __name__ == '__main__':
    e, tr = build()
    json.dump({'anims': e, 'trans': [[k[0], k[1], v] for k, v in tr.most_common()]}, open(os.path.join(SP, 'crawl', 'anims.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print(len(e), 'animations;', len(tr), 'transition combos')
    for a in e[:200]:
        print(f"{a['name']:16} {','.join(a['pages']):3} dur={a['dur']} {a['ease'][:26]:26} it={a['iter']} {a['trig'][0][0] if a['trig'] else '-':18} n={a['nsel']} {a['sels'][0][1][:60] if a['sels'] else ''}")
    print(tr.most_common(12))
