import re, json, os, hashlib, collections, html as htmllib
from bs4 import BeautifulSoup
import extract as X
SP = os.path.dirname(os.path.abspath(__file__))
def rd(p): return open(os.path.join(SP, p), encoding='utf8').read()
def esc(s): return htmllib.escape(s, quote=True)

NOUN = {'icon': 'אייקון', 'button': 'לחצן', 'choice': 'בורר', 'chip': 'תגית', 'form': 'שדה', 'banner': 'באנר', 'toast': 'טוסט', 'tip': 'טולטיפ', 'rich': 'רמז עשיר',
        'dialog': 'חלון', 'card': 'כרטיס', 'list': 'שורה', 'history': 'היסטוריה', 'timeline': 'שלב', 'nav': 'ניווט', 'home': 'בית', 'other': 'פריט', 'anim': 'הנפשה', 'color': 'צבע'}
TITLE = {'icon': 'אייקונים', 'button': 'כפתורים וקישורים', 'choice': 'לשוניות, מתגים ובוחרים', 'chip': "צ'יפים, תגיות וסימונים", 'form': 'שדות וטפסים', 'banner': 'באנרים והתראות',
         'toast': 'טוסט', 'tip': 'טולטיפים ורמזים', 'dialog': 'חלונות קופצים', 'card': 'כרטיסים ופריטים', 'list': 'רשימות, טבלאות ושורות', 'history': 'היסטוריה ותוצאות',
         'timeline': 'ציר זמן, תהליך ועגלה', 'nav': 'ניווט ופריסה', 'home': 'רכיבי דף הבית', 'other': 'שונות', 'anim': 'הנפשות', 'color': 'צבעים וטוקנים'}
LEAD = {
 'icon': 'הספרייה המלאה של האייקונים בשני הדפים. אייקון שלא מופיע באף מצב של אף דף מסומן "לא בשימוש". עומדים על אייקון כדי לראות את ההנפשה שלו.',
 'button': 'כל לחצן, קישור וכפתור אייקון שמוצגים בפועל. כל אחד מוצג בהקשר שבו הוא חי בדף, כדי שייראה בדיוק כמו שם.',
 'choice': 'לשוניות, מתגי מקטעים (כולל הגלולה עם המחוון), בוחרי מידה ואמצעי תשלום, מתג תצוגה, אזורים מתקפלים וסינון.',
 'chip': "צ'יפים, תגיות, ספירות, סימוני מצב, אריחי מבט מהיר וקופסאות אייקון.",
 'form': 'שדות קלט, חיפוש, סכום, שדות החלונות (מייל, אישור מנהל) וכל מה שמקבל טקסט.',
 'banner': 'באנר ההתראה הנפתח, התפריט שלו, ושורות ההתראות בפעמון ובתפריט הנייד.',
 'toast': 'ההודעה הקצרה שקופצת אחרי פעולה, בכל הווריאנטים שנתפסו.',
 'tip': 'הרמזים שצצים ברחיפה: הטולטיפ הכהה והזהוב (עם הטקסט האמיתי ועל איזה אלמנט הוא מופיע) והכרטיסים העשירים של ציר הזמן והעגלה.',
 'dialog': 'החלונות הקופצים: אישור, תשלום, הצלחה, מייל, אישור מנהל, ותפריטי המשנה. המתג למעלה מחליף בין כהה לבהיר.',
 'card': 'כרטיסים, שורות ערך, אזורי הוספה, כרטיס משלוח ופריטי הזמנה.',
 'list': 'רשימות, שורות תנועה וטבלאות.',
 'history': 'שורות ההיסטוריה, פירוט, סינון ותוצאות.',
 'timeline': 'ציר הזמן, תהליך ההזמנה, העגלה, אריחי הסיכום והתשלום.',
 'nav': 'הסרגל העליון ולוחות הפתיחה שלו, תפריט הנייד, כותרת העמוד, סרגל ההדגמה והפוטר.',
 'home': 'החיפוש הראשי, החיפוש המתקדם והחכם, השיחה והתוצאות של דף הבית.',
 'other': 'רכיבים שלא נכנסו לאף קטגוריה.',
 'anim': 'כל ההנפשות שהדפים מגדירים בפועל. לחיצה על תיבת התצוגה מפעילה שוב. בדוגמאות המקורבות ההנפשה מופעלת על אלמנט הדגמה, לא על הרכיב האמיתי.',
 'color': 'הטוקנים האמיתיים של שני הדפים (משתני CSS), נפתרים חי. לחיצה מעתיקה את שם המשתנה.'}
TOC_ICON = {'icon': 'dress', 'button': 'pencil', 'choice': 'sliders', 'chip': 'tag', 'form': 'note', 'banner': 'bell', 'toast': 'msg', 'tip': 'info', 'dialog': 'card', 'card': 'table',
            'list': 'list', 'history': 'clock', 'timeline': 'cart', 'nav': 'menu', 'home': 'home', 'other': 'box', 'anim': 'refresh', 'color': 'sparkle', 'report': 'shield'}
ORDER = ['icon', 'button', 'choice', 'chip', 'form', 'banner', 'toast', 'tip', 'dialog', 'card', 'list', 'history', 'timeline', 'nav', 'home', 'other', 'anim', 'color']

# ---------------- numbering registry (stable across rebuilds) ----------------
REG_FILE = os.path.join(SP, 'numbers.json')
REG = json.load(open(REG_FILE, encoding='utf8')) if os.path.exists(REG_FILE) else {}
def num(cat, key):
    d = REG.setdefault(cat, {})
    if key not in d: d[key] = max(d.values(), default=0) + 1
    return d[key]

# ---------------- data ----------------
H = {}; ROOTS = {}; CSSIDS = {}
for t in 'AB':
    r, h = X.extract(t)
    ROOTS[t] = r; H[t] = h
    CSSIDS[t] = set(re.findall(r'#([A-Za-z][\w-]*)', rd(f'scoped_{t}.css')))
    CSSIDS[t] -= {'tt', 'rt'}

UTIL = {'muted', 'faint', 'sm', 'big', 'row', 'wrap', 'spread', 't', 'in', 'on', 'f', 'a', 'c', 'e', 'n', 'p', 'm', 'v', 'ln', 'x', 'o', 'z', 'q', 'r', 'g', 'num', 'sub', 'main', 'info'}
ATOM_OK = {'chip', 'tag', 'badge', 'tabmk', 'dot', 'stx', 'hamt', 'av', 'ck', 'cnt', 'tico', 'dtico', 'mft', 'mfk', 'mfx', 'amck', 'gv', 'hf-bdg', 'mbadge', 'hres-n', 'sn-badge', 'sn-av', 'sn-mark', 'sn-clock', 'nf-chip', 'nf-cnt', 'tb', 'pth', 'vknob', 'big-ck', 'dbadge', 'mico', 'ashield', 'hv-btns', 'prc-cur', 'ico', 'ic-b', 'thumb'}
INTERACTIVE = {'button', 'a', 'input', 'textarea', 'select', 'summary', 'label'}
def struct_key(html):
    h = re.sub(r' style="[^"]*"', '', html)
    h = re.sub(r'>[^<]+<', '><', h)
    return hashlib.md5(re.sub(r'\s+', ' ', h).encode('utf8')).hexdigest()[:8]

def tidy_root(el, t):
    """mark + make the root render standalone"""
    rid = el.get('id')
    if rid in ('tt', 'rt'):
        del el.attrs['id']
        el['class'] = (el.get('class') or []) + ['pl-' + rid]
        if 'style' in el.attrs: del el.attrs['style']
    el['data-pl-root'] = '1'
    return el

def to_atoms(t, root_structs):
    out = []
    for key, v0 in H[t]['sigs'].items():
      for var in (v0.get('variants') or [{'html': v0['html'], 'anc': v0.get('anc', [])}]):
        v = dict(v0, html=var['html'], anc=var.get('anc', []))
        html = v['html']
        if len(html) > 900 or len(html) >= 23990: continue
        soup = BeautifulSoup(html, 'html.parser')
        root = next((c for c in soup.children if getattr(c, 'name', None)), None)
        if root is None or root.name in X.SKIP_TAGS: continue
        cs = X.clean_classes(root)
        if not cs and root.name not in INTERACTIVE: continue
        if any(c in X.BLOCK for c in cs): continue
        if cs and all(c in UTIL for c in cs): continue
        if root.get('id') in ('tt', 'rt'): continue
        if not (root.name in INTERACTIVE or root.find('svg') or set(cs) & ATOM_OK): continue
        if set(cs) & {'sr-only', 'hf-sr'}: continue
        el = X.sanitize(BeautifulSoup(str(root), 'html.parser').find(True), CSSIDS[t])
        out.append({'page': t, 'sig': X.sig(root), 'cat': X.category(root), 'n': v['n'], 'html': str(el), 'anc': v.get('anc', []), 'kind': 'atom', 'where': v.get('where', ''), 'body': v.get('body', '')})
    return out

specs = collections.OrderedDict()
for t in 'AB':
    roots = [dict(x, kind='root', anc=[]) for x in ROOTS[t] if 'id="tt"' not in x['html'] and 'id="rt"' not in x['html']]
    rs = {struct_key(x['html']) for x in roots}
    for x in roots + to_atoms(t, rs):
        if x['cat'] in ('toast',) and x['kind'] == 'atom': x['cat'] = 'toast'
        k = (x['cat'], x['sig'], struct_key(x['html']))
        if k in specs:
            s = specs[k]; s['pages'].add(t); s['n'][t] = x['n']
            if t == 'B': s['html'] = x['html']; s['anc'] = x['anc']; s['kind'] = x['kind']
        else:
            specs[k] = {'cat': x['cat'], 'sig': x['sig'], 'html': x['html'], 'anc': x['anc'], 'kind': x['kind'], 'pages': {t}, 'n': {t: x['n']}, 'struct': k[2]}
# a root and an atom with the same sig+structure collapse to one (root wins) — already keyed by struct.

# ---- which ancestors does a specimen really need? (descendant selectors in the page CSS + dark surfaces) ----
def _pairs():
    css = rd('scoped_A.css') + ' ' + rd('scoped_B.css')
    pairs, dark = set(), set()
    for m in re.finditer(r'([^{}@]+)\{([^{}]*)\}', css):
        sel, decl = m.group(1), m.group(2)
        for part in sel.split(','):
            p = re.sub(r':(is|not|where|has)\([^()]*\)', '', part)
            comps = [c for c in re.split(r'\s*[>+~]\s*|\s+', p.strip()) if c]
            cl = [set(X.CLS.findall(c)) if hasattr(X, 'CLS') else set(re.findall(r'\.([\w-]+)', c)) for c in comps]
            for i in range(len(cl)):
                for j in range(i + 1, len(cl)):
                    for a in cl[i]:
                        for b in cl[j]: pairs.add((a, b))
            if len(comps) == 2 and comps[0].startswith('.pg-'):
                cs_ = set(re.findall(r'\.([\w-]+)', comps[1]))
                if len(cs_) >= 1 and re.search(r'background(-color)?:[^;]*(navy|#0a22|#0f2c|#0d2a|#12305a|#173c)', decl) and '.card' not in comps[1]:
                    dark |= cs_
    return pairs, dark
PAIRS, DARK = _pairs()

def wrap_anc(html, anc, keep, atom_html=''):
    atom_cls = set(re.findall(r'class="([^"]*)"', atom_html))
    ac = set(c for x in atom_cls for c in x.split())
    kept = []
    for a in anc:                                    # nearest ancestor first
        if any(c in X.BLOCK for c in a['c']): continue
        cs = set(a['c'])
        rel = any((c, b) in PAIRS for c in cs for b in (ac | {k for kk in kept for k in kk['c']})) or bool(cs & DARK)
        if rel: kept.append(a)
    for a in kept:
        cls = ' '.join(a['c'])
        idp = f' id="{a["id"]}"' if a.get('id') and a['id'] in keep else ''
        t = a['t'] if a['t'] in ('div', 'span', 'nav', 'header', 'footer', 'section', 'article', 'aside', 'main', 'form', 'label', 'details', 'ul', 'ol', 'li', 'p') else 'div'
        html = f'<{t} class="{cls}"{idp}>{html}</{t}>'
    return html

def skin_of(pages): return 'pg-b' if 'B' in pages else 'pg-a'
def pg_badge(pages):
    p = ''.join(sorted(pages))
    return ('<span class="pl-pg ab">בית · הזמנה</span>' if p == 'AB' else '<span class="pl-pg a">דף הבית</span>' if p == 'A' else '<span class="pl-pg b">כרטיס הזמנה</span>')

def label_text(html):
    s = BeautifulSoup(html, 'html.parser')
    t = re.sub(r'\s+', ' ', s.get_text(' ', strip=True))
    return t[:34]

SERIAL = []
def spec_html(sp):
    cat = sp['cat']; n = num(cat, f"{sp['sig']}|{sp['struct']}")
    SERIAL.append((cat, n, sp['sig'], ''.join(sorted(sp['pages'])), label_text(sp['html'])))
    noun = NOUN[cat]; skin = skin_of(sp['pages'])
    keep = CSSIDS['B' if 'B' in sp['pages'] else 'A']
    body = wrap_anc(sp['html'], sp['anc'], keep, sp['html']) if sp['kind'] == 'atom' else sp['html']
    L = len(sp['html'])
    size = 'full' if L > 3800 else 'wide' if L > 1400 else ''
    txt = label_text(sp['html'])
    key = f"|{noun} {n}|{cat} {TITLE[cat]} {sp['sig']} {txt} {''.join(sorted(sp['pages']))}".lower()
    cnt = ' · '.join(f"{'בית' if p == 'A' else 'הזמנה'} ×{sp['n'][p]}" for p in sorted(sp['n']))
    return (n, f'<article class="pl-s {size}" id="{cat}-{n}" data-cat="{cat}" data-key="{esc(key)}"><header><span class="pl-n">{noun} <b>{n}</b></span>{pg_badge(sp["pages"])}<span class="pl-cnt">{cnt}</span></header>'
            f'<div class="pl-stage"><div class="pl-skin {skin} dlg-dark"><div class="app">{body}</div></div></div>'
            f'<footer><span class="pl-code" title="{esc(sp["sig"])}">{esc("." + sp["sig"].split(".", 1)[1]) if "." in sp["sig"] else esc(sp["sig"])}</span>'
            f'{"<span class=pl-txt>" + esc(txt) + "</span>" if txt else ""}<button type="button" class="pl-cp">העתק HTML</button></footer></article>')

# cap the number of structural variants shown per component (shortest + longest + a middle one)
_g = collections.defaultdict(list)
for k_, sp_ in specs.items(): _g[(sp_['cat'], sp_['sig'])].append((len(sp_['html']), k_))
_drop = set()
for gk, lst in _g.items():
    cap = 3 if any(specs[k]['kind'] == 'root' for _, k in lst) else 2
    lst.sort()
    if len(lst) > cap:
        idxs = sorted({0, len(lst) - 1, len(lst) // 2})[:cap]
        keep_ = {lst[i][1] for i in idxs}
        _drop |= {k for _, k in lst if k not in keep_}
for k_ in _drop: del specs[k_]
# drop empty shells (no text, no svg, no field)
for k_ in [k for k, v in specs.items() if not re.search(r'<svg|<input|<textarea|<select|>[^<\s]', v['html'])]: del specs[k_]
by_cat = collections.defaultdict(list)
for sp in specs.values(): by_cat[sp['cat']].append(sp)

# ---------------- icons ----------------
sym_txt = rd('B_syms.txt')
sym_ids = re.findall(r'<symbol id="i-([\w]+)"', sym_txt)
seen = set(); sym_ids = [i for i in sym_ids if not (i in seen or seen.add(i))]
LBL = {'user': 'לקוחה', 'users': 'לקוחות', 'userck': 'לקוחה מאושרת', 'mail': 'מייל', 'phone': 'טלפון', 'msg': 'הודעה', 'bell': 'התראות', 'send': 'שליחה', 'note': 'הערה', 'file': 'קובץ', 'list': 'רשימה',
       'print': 'הדפסה', 'copy': 'העתקה', 'clip': 'קובץ מצורף', 'table': 'טבלה', 'rows': 'שורות', 'sig': 'חתימה', 'card': 'כרטיס אשראי', 'wallet': 'ארנק ויתרה', 'cash': 'מזומן', 'bank': 'העברה בנקאית',
       'cheque': 'שיק', 'tag': 'תג מחיר', 'gift': 'זיכוי ומתנה', 'dress': 'שמלה', 'bag': 'תיק', 'box': 'הזמנה וחבילה', 'cart': 'עגלת שינויים', 'scissors': 'תיקון', 'truck': 'משלוח', 'pin': 'מיקום',
       'flag': 'דגל', 'scan': 'סריקת ברקוד', 'pencil': 'עריכה', 'trash': 'מחיקה', 'check': 'אישור', 'x': 'סגירה', 'plus': 'הוספה', 'minus': 'הסרה', 'undo': 'ביטול פעולה', 'redo': 'שחזור', 'bk': 'חזרה לאחור',
       'swap': 'החלפה', 'refresh': 'רענון', 'eraser': 'ניקוי', 'search': 'חיפוש', 'searchspark': 'חיפוש חכם', 'sliders': 'סינון והגדרות', 'ext': 'פתיחה בחלון חדש', 'logout': 'יציאה', 'chev': 'חץ למטה',
       'back': 'חזרה', 'arrl': 'חץ שמאלה', 'arrr': 'חץ ימינה', 'arrlr': 'שני כיוונים', 'menu': 'תפריט', 'home': 'בית', 'cal': 'יומן ותאריך', 'clock': 'שעה', 'info': 'מידע', 'alert': 'אזהרה', 'lock': 'נעילה',
       'shield': 'אישור והגנה', 'eye': 'תצוגה', 'gear': 'הגדרות', 'sun': 'תצוגה ומצב', 'sparkle': 'רעיון'}
def icon_usage(i):
    u = {}
    for t in 'AB':
        n = H[t]['classes'].get('ia-' + i, 0)
        if not n: n = sum(v['n'] for v in H[t]['sigs'].values() if f'#i-{i}"' in v['html'])
        u[t] = n
    return u
icon_html_used, icon_html_unused = [], []
for i in sorted(sym_ids):
    n = num('icon', i); u = icon_usage(i); used = u['A'] or u['B']
    pages = ('בית' if u['A'] else '') + (' · ' if u['A'] and u['B'] else '') + ('הזמנה' if u['B'] else '')
    key = f"|{NOUN['icon']} {n}|אייקון {i} {LBL.get(i, i)} {'לא בשימוש' if not used else pages}".lower()
    h = (f'<button type="button" class="pl-icon{"" if used else " unused"}" data-id="{i}" data-key="{esc(key)}" id="icon-{n}" aria-label="{LBL.get(i, i)}, העתקת קוד">'
         f'<span class="pl-n" style="height:24px;padding:0 10px;font-size:13px">{NOUN["icon"]} <b>{n}</b></span>'
         f'<span class="g"><svg class="ic ia-{i} ia-h"><use href="#i-{i}"/></svg></span><b>{LBL.get(i, i)}</b><code>i-{i}</code>'
         f'<span class="u">{pages if used else "לא בשימוש"}</span></button>')
    (icon_html_used if used else icon_html_unused).append((n, h))
icon_sec = (f'<div class="pl-ctl"><label for="isz">גודל <input id="isz" type="range" min="16" max="40" value="28" step="2"><output id="iszo">28</output></label>'
            f'<label for="isw">עובי קו <input id="isw" type="range" min="1" max="3" value="1.8" step="0.2"><output id="iswo">1.8</output></label>'
            f'<span class="pl-txt">לחיצה על אייקון מעתיקה את קוד ה-SVG</span></div>'
            f'<div><div class="pl-igrid" id="iconGrid">{"".join(h for _, h in sorted(icon_html_used))}</div></div>'
            + (f'<details class="pl-box"><summary>אייקונים שלא בשימוש באף דף ({len(icon_html_unused)})</summary><div class="pl-igrid" style="margin-top:12px">{"".join(h for _, h in sorted(icon_html_unused))}</div></details>' if icon_html_unused else ''))

# ---------------- tooltips ----------------
tips = {t: json.load(open(os.path.join(SP, 'crawl', f'{t}_tips.json'), encoding='utf8')) for t in 'AB'}
tt_map = collections.OrderedDict(); rt_map = collections.OrderedDict()
for t in 'AB':
    for text, v in tips[t]['tt'].items():
        e = tt_map.setdefault(text, {'pages': set(), 'targets': [], 'gold': 'gold' in v['html'].split('class="')[1].split('"')[0] if 'class="' in v['html'] else False})
        e['pages'].add(t)
        if v['sig'] not in e['targets']: e['targets'].append(v['sig'])
    for spec, v in tips[t]['rt'].items():
        soup = BeautifulSoup(v['html'], 'html.parser'); r = soup.find(True)
        for a in ('style', 'id', 'data-side'):
            if a in r.attrs: del r.attrs[a]
        r['class'] = ['pl-rt', 'on']
        for i_ in r.find_all('i', class_='ra'): i_.decompose()
        X.sanitize(r, set())
        body = str(r)
        k = struct_key(body)
        e = rt_map.setdefault(k, {'pages': set(), 'targets': [], 'specs': [], 'html': body})
        e['pages'].add(t)
        if v['sig'] not in e['targets']: e['targets'].append(v['sig'])
        if spec not in e['specs']: e['specs'].append(spec)
tip_cards = []
for text, e in tt_map.items():
    n = num('tip', 'tt|' + text); skin = skin_of(e['pages'])
    key = f"|{NOUN['tip']} {n}|טולטיפ {text} {' '.join(e['targets'])}".lower()
    tip_cards.append((n, f'<div class="pl-tipc pl-s" id="tip-{n}" data-key="{esc(key)}"><header><span class="pl-n">{NOUN["tip"]} <b>{n}</b></span>{pg_badge(e["pages"])}</header>'
        f'<div class="pl-stage tight" style="min-height:70px"><div class="pl-skin {skin}" style="width:auto;flex:0 1 auto"><div class="app"><div class="pl-tt on{" gold" if e["gold"] else ""}">{esc(text)}</div></div></div></div>'
        f'<footer style="padding:0"><span class="pl-code">{esc(e["targets"][0])}</span></footer></div>'))
rich_cards = []
for k, e in rt_map.items():
    n = num('rich', 'rt|' + k); skin = skin_of(e['pages'])
    key = f"|{NOUN['rich']} {n}|רמז עשיר {' '.join(e['specs'])} {' '.join(e['targets'])}".lower()
    rich_cards.append((n, f'<div class="pl-tipc pl-s" id="rich-{n}" data-key="{esc(key)}"><header><span class="pl-n">{NOUN["rich"]} <b>{n}</b></span>{pg_badge(e["pages"])}</header>'
        f'<div class="pl-stage tight" style="min-height:70px"><div class="pl-skin {skin}" style="flex:0 1 auto"><div class="app">{e["html"]}</div></div></div>'
        f'<footer style="padding:0"><span class="pl-code">data-rich="{esc(e["specs"][0])}"</span><span class="pl-txt">{esc(e["targets"][0])}</span></footer></div>'))
tip_extra = ''
if tip_cards: tip_extra += '<h3 class="pl-h3" style="margin:8px 0 0;font-size:20px">טולטיפים (data-tip)</h3><div class="pl-tips">' + ''.join(h for _, h in sorted(tip_cards)) + '</div>'
if rich_cards: tip_extra += '<h3 class="pl-h3" style="margin:16px 0 0;font-size:20px">רמזים עשירים (data-rich)</h3><div class="pl-tips">' + ''.join(h for _, h in sorted(rich_cards)) + '</div>'

# ---------------- animations ----------------
AN = json.load(open(os.path.join(SP, 'crawl', 'anims.json'), encoding='utf8'))
def anim_card(a):
    n = num('anim', a['name']); nm = a['name']
    dur = a['dur'] if a['dur'] is not None else (0.45 if a.get('icons') else 0.6)
    ease = a['ease'] or 'ease'; it = a['iter'] or '1'
    anim = f"{nm} {dur}s {ease} {'infinite' if it == 'infinite' else (it if it and it.isdigit() else '1')} both".replace(' both', ' both')
    if a.get('icons'):
        ic = a['icons'][0]
        demo = f'<span class="blob sq" data-anim="{esc(anim)}"><svg class="ic"><use href="#i-{ic}"/></svg></span>'
    elif re.search(r'draw|Draw', nm):
        demo = '<span class="blob sq"><svg class="ic" style="stroke-dasharray:70;stroke-dashoffset:0" data-anim="' + esc(anim) + '"><use href="#i-check"/></svg></span>'
    elif re.search(r'bar|Bar|Shine|shine|ub', nm):
        demo = f'<span class="bar" data-anim="{esc(anim)}"></span>'
    elif re.search(r'row|Row|In\b|in$|out|Out|fade|slide', nm):
        demo = f'<span class="row" data-anim="{esc(anim)}"></span>'
    else:
        demo = f'<span class="blob" data-anim="{esc(anim)}"><svg class="ic"><use href="#i-check"/></svg></span>'
    trig = ' · '.join(x[0] for x in a['trig']) or 'לפי הקשר'
    where = ', '.join(f"{'בית' if p == 'A' else 'הזמנה'}" for p in a['pages'])
    sels = ''.join(f"<div>{esc(s[1][:90])}</div>" for s in a['sels'][:3])
    ico = (f"<dt>אייקונים</dt><dd>{', '.join(a['icons'])}</dd>" if a.get('icons') else '')
    observed = 'נצפתה רצה בפועל' if a['observed'] else ''
    key = f"|{NOUN['anim']} {n}|הנפשה {nm} {trig} {' '.join(a.get('icons', []))}".lower()
    kf = esc(f"@keyframes {nm} {{\n" + re.sub(r'\}\s*(?=[\d.%a-z-]+\s*\{)', '}\n', a['kf'].replace('{', ' {\n  ').replace(';', ';\n  ')) + "\n}") if a['kf'] else ''
    return (n, f'<article class="pl-an pl-s" id="anim-{n}" data-key="{esc(key)}"><header><span class="pl-n">{NOUN["anim"]} <b>{n}</b></span><span class="pl-pg {"ab" if len(a["pages"]) == 2 else a["pages"][0].lower()}">{where}</span><span class="pl-cnt">{observed}</span></header>'
            f'<div class="stg" tabindex="0" role="button" aria-label="הפעלה מחדש: {esc(nm)}">{demo}</div>'
            f'<span class="pl-code">{esc(nm)}</span>'
            f'<dl><dt>משך</dt><dd>{dur}s · {esc(ease[:30])} · {it}</dd><dt>הפעלה</dt><dd style="font-family:inherit;direction:rtl">{esc(trig)}</dd>{ico}</dl>'
            f'<details><summary>איפה ומה הקוד</summary><div class="pl-txt" style="white-space:normal;direction:ltr;text-align:left;font-family:var(--pl-code)">{sels}</div>{"<pre>" + kf + "</pre>" if kf else ""}</details></article>')
anims = [anim_card(a) for a in AN['anims']]
tr_rows = ''.join(f'<div class="pl-tr"><b>{d}ms</b><i style="width:{max(6, d // 6)}px"></i><span class="pl-code">{esc(e[:34])}</span><span style="margin-inline-start:auto;color:#4d6787">×{c}</span></div>' for d, e, c in AN['trans'][:24])
anim_sec = ('<div class="pl-sgrid" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,270px),1fr))">' + ''.join(h for _, h in sorted(anims)) + '</div>'
            f'<h3 class="pl-h3" style="margin:16px 0 0;font-size:20px">מעברים (transitions)</h3><p class="pl-lead">כל שינוי רקע, צבע או צל בדפים מונפש. אלה זמני המעבר שבשימוש ומספר הכללים שמשתמשים בכל אחד.</p><div class="pl-trs">{tr_rows}</div>')

# ---------------- colours & tokens ----------------
roots_css = rd('roots_B.css')
decls = re.findall(r'(--[\w-]+)\s*:\s*([^;}]+)', roots_css)
seen = {};
for k, v in decls: seen[k] = v.strip()
NONCOLOR = {'--r', '--r-sm', '--sh', '--sh-lg', '--ease', '--spring', '--snav-h', '--bg-dur', '--card-bw', '--s1', '--s2', '--s3', '--s4'}
sw_html, tok_html = [], []
for k, v in seen.items():
    n = num('color', k)
    if k in NONCOLOR:
        tok_html.append((n, f'<div class="pl-tr pl-s" id="color-{n}" data-key="{esc(f"|{NOUN["color"]} {n}|{k} {v}".lower())}"><span class="pl-n">{NOUN["color"]} <b>{n}</b></span><span class="pl-code">{k}</span><span style="margin-inline-start:auto;font-family:var(--pl-code);font-size:12px;direction:ltr">{esc(v[:44])}</span></div>'))
    else:
        key = f"|{NOUN['color']} {n}|{k} {v}".lower()
        sw_html.append((n, f'<button type="button" class="pl-sw" id="color-{n}" data-copy="var({k})" data-key="{esc(key)}" aria-label="{k}, העתקה"><span class="c"><i style="background:var({k})"></i></span><span class="m"><span class="pl-n" style="height:22px;font-size:12px;padding:0 8px;align-self:flex-start">{NOUN["color"]} <b>{n}</b></span><code>{k}</code><small></small></span></button>'))
color_sec = ('<div class="pl-swgrid">' + ''.join(h for _, h in sorted(sw_html)) + '</div><h3 class="pl-h3" style="margin:16px 0 0;font-size:20px">רדיוסים, צללים, רווחים ותזמון</h3><div class="pl-trs">' + ''.join(h for _, h in sorted(tok_html)) + '</div>')

# ---------------- clean-up report ----------------
PR = json.load(open(os.path.join(SP, 'crawl', 'prune_report.json'), encoding='utf8'))
dead_both = json.load(open(os.path.join(SP, 'crawl', 'dead.json'), encoding='utf8'))['deadBoth']
def dead_chips(t, n=160): return ''.join(f'<span class="pl-code">.{esc(c)}</span>' for c, _ in PR[t]['dead_top'][:n])
redef = collections.Counter()
for row in json.load(open(os.path.join(SP, 'crawl', 'B_rules.json'), encoding='utf8')):
    if row.get('sel') and row['sheet'] in ('v3-shell-css',):
        redef[re.sub(r'\s+', ' ', row['sel'])] += 1
redef_rows = ''.join(f'<div><span class="pl-code">{esc(s[:44])}</span><b>{c}</b></div>' for s, c in redef.most_common(40) if c >= 4)
unused_icons = ' '.join(f'<span class="pl-code">i-{i}</span>' for _, h in [] )
sa, sb = PR['A']['stats'], PR['B']['stats']
report_sec = (
 '<div class="pl-rep">'
 f'<div class="pl-repc"><b>{sa["dropped"]}</b><span>כללי CSS שהוסרו מדף הבית. הם מוגדרים אבל מכוונים למחלקה שלא קיימת בשום מצב ובשום שורת קוד.</span></div>'
 f'<div class="pl-repc"><b>{sb["dropped"]}</b><span>כללי CSS שהוסרו מכרטיס ההזמנה, מאותה סיבה.</span></div>'
 f'<div class="pl-repc"><b>{len(PR["A"]["kf_dropped"]) + len(PR["B"]["kf_dropped"])}</b><span>הנפשות (keyframes) שאף כלל לא משתמש בהן.</span></div>'
 f'<div class="pl-repc"><b>{len(icon_html_unused)}</b><span>אייקונים בספרייה שלא מופיעים באף מצב של אף דף.</span></div>'
 '</div>'
 f'<div class="pl-box"><h3>מחלקות מתות בשני הדפים ({len(dead_both)})</h3><p class="pl-lead" style="font-size:15px">מוגדרות ב-CSS של שני הדפים ולא קיימות בשום מקום. אלה שרידים של עיצובים ישנים.</p><div class="pl-chips">{"".join(f"<span class=pl-code>.{esc(c)}</span>" for c in dead_both)}</div></div>'
 f'<div class="pl-box"><h3>שרידים שנשארו בקוד בגלל שכבות</h3><p class="pl-lead" style="font-size:15px">כללים ישנים שעדיין חלים על רכיבים חיים, אבל נדרסים כמעט לגמרי על ידי כללים מאוחרים יותר. המספר הוא כמה פעמים אותו בורר נכתב מחדש ב-CSS המשותף. הפלטה מציגה רק את התוצאה הסופית.</p><div class="pl-red">{redef_rows}</div></div>'
 f'<details class="pl-box"><summary>מחלקות מתות בדף הבית בלבד</summary><div class="pl-chips" style="margin-top:10px">{dead_chips("A")}</div></details>'
 f'<details class="pl-box"><summary>מחלקות מתות בכרטיס ההזמנה בלבד</summary><div class="pl-chips" style="margin-top:10px">{dead_chips("B")}</div></details>')

# ---------------- assemble sections ----------------
def section(cat, inner, count, extra=''):
    return (f'<section class="pl-sec" id="sec-{cat}" aria-labelledby="h-{cat}"><header><span class="pl-kick"><i></i>{TITLE[cat]} · {count}</span>'
            f'<h2 class="pl-h" id="h-{cat}">{TITLE[cat]}</h2><p class="pl-lead">{LEAD[cat]}</p></header>{inner}{extra}</section>')
secs, toc = [], []
for cat in ORDER:
    if cat == 'icon': inner, cnt = icon_sec, len(sym_ids)
    elif cat == 'anim': inner, cnt = anim_sec, len(anims)
    elif cat == 'color': inner, cnt = color_sec, len(sw_html) + len(tok_html)
    else:
        lst = sorted((spec_html(sp) for sp in by_cat.get(cat, [])), key=lambda x: x[0])
        if cat == 'tip': cnt = len(lst) + len(tip_cards) + len(rich_cards)
        else: cnt = len(lst)
        if not lst and not (cat == 'tip' and (tip_cards or rich_cards)): continue
        inner = ('<div class="pl-sgrid">' + ''.join(h for _, h in lst) + '</div>') if lst else ''
        if cat == 'tip': inner += tip_extra
    secs.append(section(cat, inner, cnt)); toc.append((cat, TITLE[cat], cnt))
secs.append(f'<section class="pl-sec" id="sec-report" aria-labelledby="h-report"><header><span class="pl-kick"><i></i>ניקיון</span><h2 class="pl-h" id="h-report">מה הוסר ומה נשאר בקוד</h2><p class="pl-lead">כדי שהפלטה תציג רק מה שקיים היום, בדקתי את שני הדפים החיים בכל מצב שאפשר להגיע אליו, ובמקביל בדקתי איזה CSS לא מתאים לשום דבר קיים.</p></header>{report_sec}</section>')
toc.append(('report', 'ניקיון וגרסאות ישנות', ''))
toc_html = '<nav class="pl-toc" aria-label="תוכן העניינים"><h2>מקטעים</h2>' + ''.join(
    f'<a href="#sec-{c}"><svg class="ic"><use href="#i-{TOC_ICON[c]}"/></svg>{t}<small>{n}</small></a>' for c, t, n in toc) + '</nav>'

total_specs = sum(n for _, _, n in toc if isinstance(n, int))
hero = f'''<div class="pl-top"><section class="pl-hero" aria-labelledby="pl-title">
  <div class="pl-hero-row"><span class="pl-mark"><svg><use href="#i-dress"/></svg></span>
  <div class="pl-hero-txt"><h1 id="pl-title">פלטת רכיבים <em>גמ״ח שמלות</em></h1>
  <p>כל הרכיבים שהדפים באמת מציגים: דף הבית וסיכומים, וכרטיס ההזמנה. הכול נלקח מסימון ה-HTML שרץ בדפים החיים, ומוצג בעור של הדף שלו. לכל פריט מספר סידורי, כדי שאפשר יהיה להגיד "שנה את לחצן 12".</p></div></div>
  <div class="pl-stats"><span class="pl-stat"><b>{total_specs}</b> פריטים ממוספרים</span><span class="pl-stat"><b>{len(sym_ids)}</b> אייקונים</span><span class="pl-stat"><b>{len(anims)}</b> הנפשות</span><span class="pl-stat"><b>{len(seen)}</b> טוקנים</span></div>
  <div class="pl-how"><span>איך מפנים: <b>לחצן 12</b>, <b>אייקון 23</b>, <b>באנר 3</b>, <b>הנפשה 7</b>, <b>טולטיפ 5</b>, <b>חלון 2</b>. המספר נשאר קבוע גם כשמוסיפים פריטים חדשים.</span></div>
  <div class="pl-find"><label for="plq"><span class="pl-sr">חיפוש</span><input id="plq" type="search" placeholder="חיפוש לפי מספר, שם או מחלקה, למשל: לחצן 12" autocomplete="off"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></label><span class="pl-res" id="plres" role="status"></span>
  <button type="button" class="pl-tglbtn" id="plDark" aria-pressed="true"><svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>חלונות: כהה</button></div>
</section></div>'''

scoped_a, scoped_b = rd('scoped_A.css'), rd('scoped_B.css')
kf = rd('kf_A.css') + '\n' + rd('kf_B.css')
kfd = {}
for m in re.finditer(r'@keyframes ([^{]+)\{', kf): pass
# de-duplicate keyframes by name
kf_blocks = re.findall(r'@keyframes [^{]+\{(?:[^{}]|\{[^{}]*\})*\}', kf)
for b in kf_blocks: kfd[re.match(r'@keyframes ([^{]+)\{', b).group(1).strip()] = b
kf_css = '\n'.join(kfd.values())
roots = rd('roots_B.css')
def alias(s): return re.sub(r'#rt(?![\w-])', '.pl-rt', re.sub(r'#tt(?![\w-])', '.pl-tt', s))
css_all = alias(roots) + '\n' + rd('roots_A.css').replace('', '') + '\n' + kf_css + '\n' + alias(scoped_a) + '\n' + alias(scoped_b) + '\n' + rd('pl2.css')

sprite = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' + sym_txt.replace('\n', '') + '</defs></svg>'
page = (f'<title>פלטת רכיבים</title>\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        f'<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap" rel="stylesheet">\n<style>\n{css_all}\n</style>\n{sprite}\n'
        f'<div id="plroot" dir="rtl" lang="he">{hero}<div class="pl-wrap">{toc_html}<main class="pl-main">{"".join(secs)}</main></div></div>\n<script>\n{rd("pl2.js")}\n</script>\n')
open(os.path.join(SP, 'palette2.html'), 'w', encoding='utf8').write(page)
SER = {'spec': SERIAL, 'icons': [(i, num('icon', i)) for i in sorted(sym_ids)], 'tips': [(n, t) for t, n in [(t, num('tip', 'tt|' + t)) for t in tt_map]],
       'anims': [(a['name'], num('anim', a['name'])) for a in AN['anims']], 'colors': [(k, num('color', k)) for k in seen], 'pages': {}}
json.dump(SER, open(os.path.join(SP, 'serial_map.json'), 'w', encoding='utf8'), ensure_ascii=False)
json.dump(REG, open(REG_FILE, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
print('bytes', len(page), 'specs', {c: len(v) for c, v in by_cat.items()}, 'icons', len(sym_ids), 'anims', len(anims), 'tips', len(tip_cards), 'rich', len(rich_cards), 'colors', len(sw_html), 'tokens', len(tok_html))
