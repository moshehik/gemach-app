"""Pick a minimal set of REAL rendered component roots per page (largest-first greedy cover) and classify them."""
import json, re, os, collections
from bs4 import BeautifulSoup
SP = os.path.dirname(os.path.abspath(__file__))

SKIP_TAGS = {'svg', 'use', 'path', 'circle', 'rect', 'g', 'line', 'polyline', 'polygon', 'symbol', 'defs', 'script', 'style', 'meta', 'link', 'head', 'html', 'body', 'title', 'br', 'option', 'i'}
NOISE = re.compile(r'^(ia-.*|enter|fresh|pulse|leaving|shine-on|hero-enter|hero-trans|bump|new|nf-new|nf-pop|offscr)$')
BLOCK = {'app', 'layout', 'main', 'panel', 'rail', 'home-p', 'hfeed', 'hero', 'hero-compact', 'advq', 'hero-ghost'}   # page skeletons, not components
MAXLEN = 7000

def clean_classes(el):
    return sorted(c for c in (el.get('class') or []) if not NOISE.match(c))

def sig(el):
    cs = clean_classes(el)
    return el.name + ('.' + '.'.join(cs) if cs else '')

def descendants_sigs(el):
    s = set()
    for d in [el] + list(el.find_all(True)):
        if d.name in SKIP_TAGS: continue
        cs = clean_classes(d)
        if cs: s.add(sig(d))
    return s

# ordered: first match wins.   (regex on the space-joined class list of root + contained classes of root itself only)
CATS = [
 ('toast',  'טוסט', r'(^| )(charge|credit|info)( |$)' , lambda r: r.get('id') == 'toast'),
 ('tip',    'טולטיפים ורמזים', r'(^| )(tip|pinm|prc-sh|dpop)( |$)|^tt$|^rt$', lambda r: r.get('id') in ('tt', 'rt')),
 ('dialog', 'חלונות קופצים', r'(^| )(dlg|scrim|apprwin|mailwin|success|dbadge|big-ck)( |$)', None),
 ('banner', 'באנרים והתראות', r'(^| )(nb-[\w-]+|nb|nf-[\w-]+|nb-area|nb-w)( |$)', None),
 ('nav',    'ניווט ופריסה', r'(^| )(snav|sn-[\w-]+|site-foot|sf-[\w-]+|topbar|ttl|tools|demo|demo-tog-row|demo-tog|sbar)( |$)', None),
 ('timeline','ציר זמן, תהליך ועגלה', r'(^| )(stepper|tlx|tx|prc|prc-[\w-]+|proc|cart|cart-[\w-]+|rcard|cl|cl-[\w-]+|glance|gl|sec-h|redo|tl|tline|tn|net|chg|due|tr)( |$)', None),
 ('home',   'רכיבי דף הבית', r'(^| )(hero-in|hero-row|hero-t|hero|srch|jshell|advp|advs|advfb|advfocus|advplus|advextra|aiw|chat|bub|bub-acts|aixl|xlrow|res-one|cmode|cmode-b|calc|vbar|hdd|hdp|hdx|aibar|fu|pg-ttl|pg-sub)( |$)', None),
 ('history','היסטוריה ותוצאות', r'(^| )(hres|hres-bar|hgrp|hrow|irow|hdet|hv-r|hv-act|hf-[\w-]+|hfeed)( |$)', None),
 ('choice', 'לשוניות, מתגים ובוחרים', r'(^| )(tabs|tab|seg|pill|vsw|vopt|sizes|methods|opt|sw|cb|cb-[\w-]+|coll|tgl)( |$)', None),
 ('form',   'שדות וטפסים', r'(^| )(field|inp|inpw|scan|amtin|lbl|trow|ac|input|textarea|select|mfld|mto|mfile|mfiles|mfh|mh|mact|acodes|amgr|amsg|ahint|ashield|appr|mprev)( |$)', None),
 ('card',   'כרטיסים ופריטים', r'(^| )(card|itm|dhero|kv|f|addpanel|dfields|items-card|bal|pbar|creditile|leg|legs|dleg|dlegs|empty|cust|hist)( |$)', None),
 ('list',   'רשימות, טבלאות ושורות', r'(^| )(list|li|lrow|rlink|tbl|tbl-wrap|tblw|rtbl|pend|a)( |$)', None),
 ('chip',   "צ'יפים, תגיות וספירות", r'(^| )(chip|tag|stx|hamt|badge|tabmk|ico|dot|hf-bdg|mbadge|av|ck|tico|dtico|mft|mfk|mfx|mcnt|amck|gv|hv-btns|big|muted|faint|sm|row|spread|wrap)( |$)', None),
 ('button', 'כפתורים', r'.*', None),
]

def category(root):
    cs = clean_classes(root)
    joined = ' '.join(cs)
    rid = root.get('id') or ''
    if rid == 'toast': return 'toast'
    if rid in ('tt', 'rt'): return 'tip'
    for key, label, rx, extra in CATS:
        if extra and not extra(root): continue
        if key == 'button':
            if root.name in ('button', 'a', 'label', 'summary'): return 'button'
            continue
        if re.search(rx, joined): return key
    if root.name in ('button', 'a'): return 'button'
    return 'other'

def load(t):
    h = json.load(open(os.path.join(SP, 'crawl', f'{t}_harvest.json'), encoding='utf8'))
    css_ids = set(re.findall(r'#([A-Za-z][\w-]*)', open(os.path.join(SP, f'scoped_{t}.css'), encoding='utf8').read()))
    return h, css_ids

def sanitize(el, keep_ids):
    for d in [el] + list(el.find_all(True)):
        for a in ('data-act', 'autofocus', 'onclick', 'name', 'data-lpignore', 'data-1p-ignore', 'data-form-type', 'data-live', 'data-to', 'formaction'):
            if a in d.attrs: del d.attrs[a]
        if d.get('id') and d['id'] not in keep_ids: del d.attrs['id']
        if d.name == 'a': d['href'] = '#'
        if d.name in ('input', 'textarea') and d.get('autocomplete'): d['autocomplete'] = 'off'
        cl = d.get('class')
        if cl: d['class'] = [c for c in cl if c not in ('enter', 'fresh', 'ia-in', 'ia-dr', 'leaving', 'out', 'hero-enter', 'hero-trans', 'offscr', 'nf-new')]
        if 'hidden' in d.attrs and d.name not in ('svg',): del d.attrs['hidden']
    return el

def extract(t):
    h, keep_ids = load(t)
    cands = []
    for key, v0 in h['sigs'].items():
      for var in (v0.get('variants') or [{'html': v0['html'], 'anc': v0.get('anc', [])}]):
        v = dict(v0, html=var['html'], anc=var.get('anc', []))
        html = v['html']
        if len(html) >= 23990: continue                       # truncated capture
        soup = BeautifulSoup(html, 'html.parser')
        root = next((c for c in soup.children if getattr(c, 'name', None)), None)
        if root is None or root.name in SKIP_TAGS: continue
        cs = clean_classes(root)
        if not cs and root.get('id') not in ('toast', 'tt', 'rt', 'dlg', 'dlg2', 'stepper'): continue
        if any(c in BLOCK for c in cs): continue
        if len(html) > MAXLEN: continue
        cands.append((root, v, len(html), sig(root)))
    cands.sort(key=lambda x: -x[2])
    covered, picked = set(), []
    for root, v, L, s in cands:
        ds = descendants_sigs(root)
        new = ds - covered
        if not new: continue
        # skip candidates that are mere text wrappers (no classes inside except themselves)
        covered |= ds
        picked.append((root, v, s, sorted(ds)))
    out = []
    seen = set()
    for root, v, s, ds in picked:
        cat = category(root)
        el = sanitize(BeautifulSoup(str(root), 'html.parser').find(True), keep_ids)
        html = str(el)
        h_ = hash(re.sub(r'\s+', ' ', html))
        if h_ in seen: continue
        seen.add(h_)
        out.append({'page': t, 'sig': s, 'cat': cat, 'n': v['n'], 'where': v.get('where', ''), 'covers': ds, 'html': html, 'len': len(html)})
    return out, h

if __name__ == '__main__':
    allc = {}
    for t in 'AB':
        cat, h = extract(t)
        allc[t] = cat
        c = collections.Counter(x['cat'] for x in cat)
        print(t, len(cat), dict(c))
    json.dump(allc, open(os.path.join(SP, 'crawl', 'catalog_raw.json'), 'w', encoding='utf8'), ensure_ascii=False)
    for t in 'AB':
        print('====', t)
        for x in allc[t]:
            print(f"{x['cat']:9} {x['len']:5} n={x['n']:3} {x['sig'][:90]}")
