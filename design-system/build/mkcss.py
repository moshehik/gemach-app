"""Builds a per-page scoped, dead-code-free CSS from the two saved pages.
   dead class  = defined in CSS but never rendered in any crawled state AND never referenced in the page's HTML/JS text.
   A rule part that mentions a dead class can never match anything, so dropping it is lossless for rendering."""
import re, json, os, sys, collections
import tinycss2
SP = os.path.dirname(os.path.abspath(__file__))

def rd(p): return open(os.path.join(SP, p), encoding='utf8').read()

def blocks(page_html):
    out = []
    for m in re.finditer(r'<style([^>]*)>(.*?)</style>', page_html, re.S):
        idm = re.search(r'id="([^"]+)"', m.group(1))
        out.append((idm.group(1) if idm else f's{len(out)}', m.group(2)))
    return out

def top_commas(s):
    parts, depth, cur, q = [], 0, '', None
    for ch in s:
        if q:
            cur += ch
            if ch == q: q = None
            continue
        if ch in '"\'': q = ch; cur += ch; continue
        if ch in '([': depth += 1
        elif ch in ')]': depth -= 1
        if ch == ',' and depth == 0: parts.append(cur.strip()); cur = ''
        else: cur += ch
    if cur.strip(): parts.append(cur.strip())
    return parts

CLS = re.compile(r'\.(-?[A-Za-z_][\w-]*)')

def load_page(t):
    h = json.load(open(os.path.join(SP, 'crawl', f'{t}_harvest.json'), encoding='utf8'))
    html = rd(f'page{t}.html')
    scripts = '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', html, re.S))
    body = re.sub(r'<style.*?</style>', '', html, flags=re.S)
    return h, html, scripts + '\n' + body

def make(t):
    h, html, text = load_page(t)
    dom = set(h['classes'])
    def referenced(c):
        if re.search(r'(?<![\w-])' + re.escape(c) + r'(?![\w-])', text): return True
        if '-' in c:                                   # built dynamically, e.g. 'st-'+kind or `ia-${id}`
            pre = c.rsplit('-', 1)[0] + '-'
            if re.search(r'''['"`]''' + re.escape(pre) + r'''(['"`]|\$\{)''', text): return True
        return False
    livecache = {}
    def live(c):
        if c not in livecache: livecache[c] = (c in dom) or referenced(c)
        return livecache[c]

    scope = f'.pg-{t.lower()}'
    stats = collections.Counter(); dead_classes = collections.Counter(); kept_kf = set(); css_out = []; kf_all = {}; props = []
    js_names = set(re.findall(r'[A-Za-z][\w-]*', text))

    def rewrite_part(p):
        p = p.strip()
        if re.match(r'^(html|:root)\b', p) or p.startswith('*'): return None if not p.startswith('*') else scope + ' ' + p
        if re.match(r'^body\b', p):
            rest = p[4:]
            return scope + rest if (rest.startswith('.') or rest.startswith('[') or rest.startswith(':')) else (scope + rest if rest.strip() == '' else scope + ' ' + rest.strip())
        return scope + ' ' + p

    root_out = []
    def do_rules(rules, wrap):
        for r in rules:
            if r.type == 'qualified-rule':
                sel = tinycss2.serialize(r.prelude).strip()
                decl = tinycss2.serialize(r.content).strip()
                stats['rules'] += 1
                if not decl: continue
                if sel.strip() == ':root' and 'color-scheme' not in decl and 'safe-area' not in decl:
                    root_out.append(wrap[0] + ':root{' + decl + '}' + wrap[1]); stats['root'] += 1
                    continue
                keep = []
                for part in top_commas(sel):
                    cs = CLS.findall(part)
                    bad = [c for c in cs if not live(c)]
                    if bad:
                        for c in bad: dead_classes[c] += 1
                        continue
                    np_ = rewrite_part(part)
                    if np_: keep.append(np_)
                if not keep:
                    stats['dropped'] += 1
                    continue
                stats['kept'] += 1
                rule = ','.join(keep) + '{' + decl + '}'
                css_out.append(wrap[0] + rule + wrap[1])
            elif r.type == 'at-rule':
                kw = r.lower_at_keyword
                if kw in ('media', 'supports', 'container', 'layer'):
                    pre = tinycss2.serialize(r.prelude).strip()
                    inner = tinycss2.parse_rule_list(r.content, skip_comments=True, skip_whitespace=True)
                    do_rules(inner, (wrap[0] + f'@{kw} {pre}{{', '}' + wrap[1]))
                elif kw.endswith('keyframes'):
                    name = tinycss2.serialize(r.prelude).strip()
                    kf_all[name] = f'@keyframes {name}{{' + tinycss2.serialize(r.content) + '}'
                elif kw == 'property':
                    props.append('@property ' + tinycss2.serialize(r.prelude).strip() + '{' + tinycss2.serialize(r.content) + '}')
                # font-face / import / charset ignored on purpose

    per_sheet = {}
    for name, css in blocks(html):
        before = (stats['rules'], stats['kept'], stats['dropped'])
        rules = tinycss2.parse_stylesheet(css, skip_comments=True, skip_whitespace=True)
        do_rules(rules, ('', ''))
        per_sheet[name] = [stats['rules'] - before[0], stats['kept'] - before[1], stats['dropped'] - before[2]]
    body_css = '\n'.join(css_out)
    body_css = re.sub(r"url\((?:\"|')?data:[^)]{2500,}\)", 'none', body_css)   # drop the hero photo etc.
    # keyframes: keep when a kept rule (or the page JS) names them
    for name, txt in kf_all.items():
        if re.search(r'(?<![\w-])' + re.escape(name) + r'(?![\w-])', body_css) or name in js_names:
            kept_kf.add(name)
    kf = '\n'.join(kf_all[n] for n in kf_all if n in kept_kf)
    return {'css': body_css, 'kf': kf, 'props': '\n'.join(props), 'stats': dict(stats), 'dead': dead_classes, 'sheets': per_sheet,
            'roots': '\n'.join(root_out), 'kf_dropped': sorted(set(kf_all) - kept_kf), 'kf_kept': sorted(kept_kf)}

if __name__ == '__main__':
    res = {}
    for t in 'AB':
        r = make(t)
        open(os.path.join(SP, f'scoped_{t}.css'), 'w', encoding='utf8').write(r['props'] + '\n' + r['css'])
        open(os.path.join(SP, f'kf_{t}.css'), 'w', encoding='utf8').write(r['kf'])
        open(os.path.join(SP, f'roots_{t}.css'), 'w', encoding='utf8').write(r['roots'])
        res[t] = {'stats': r['stats'], 'sheets': r['sheets'], 'dead_top': r['dead'].most_common(400), 'kf_dropped': r['kf_dropped'], 'kf_kept': r['kf_kept']}
        print(t, r['stats'], 'css KB', len(r['css']) // 1024, 'kf kept', len(r['kf_kept']), 'dropped', len(r['kf_dropped']))
    json.dump(res, open(os.path.join(SP, 'crawl', 'prune_report.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
