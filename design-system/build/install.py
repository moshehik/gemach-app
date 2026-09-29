#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
install.py — builds the repo's design system (design-system/ + public/design-system/) from the three
saved source pages. Nothing here is written by hand: every CSS rule, icon, number and catalogue row is
derived from the palette page, which itself was crawled from the two live pages (see build/README.md).

Inputs (local copies saved by the Artifact tool, `action: read` — they are NOT kept in the repo):
  --palette  פלטת רכיבים   https://claude.ai/artifact/H6toH2q9ZvL8rrFwZx3SBj
  --home     דף הבית A5     https://claude.ai/artifact/GscpxuJVsbVxxc9VgcEtDB
  --order    כרטיס הזמנה    https://claude.ai/artifact/5sG47Yyn1HsjyS6GR6ygqh

Outputs (all overwritten):
  design-system/tokens.css        the 71 palette tokens as --gm-* custom properties on :root (+ a scoped bridge)
  design-system/components.css    every component rule of the palette, scoped under .gm-ds (see README "scoping")
  design-system/sprite.svg        the full icon library (every <symbol> of the order-card page)
  design-system/icons.json        serial number <-> icon id <-> Hebrew label <-> usage
  design-system/COMPONENTS.md     the numbered catalogue (generated from the page + numbers.json/anims.json)
  public/design-system/index.html the palette page itself (self-contained, served at /design-system/)
  public/design-system/sprite.svg copy of the sprite for <use href="/design-system/sprite.svg#i-x">
  public/design-system/home-bg.jpg the home page background photo (the one asset mkcss.py had to drop)
  build/numbers.json, build/serial_map.json   registry, extended with icons the palette build missed

Run from anywhere:
  python design-system/build/install.py --palette P.html --home A.html --order B.html
"""
import argparse, base64, collections, json, os, re, sys
import tinycss2
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
DS = os.path.dirname(HERE)                       # design-system/
REPO = os.path.dirname(DS)                       # repo root
PUB = os.path.join(REPO, 'public', 'design-system')
VERSION = '2026-09-29'
ROOT = '.gm-ds'                                  # scope root class
HOME = '.gm-home'                                # home-page skin modifier
KF = 'gm-'                                       # keyframe prefix
TOK = 'gm-'                                      # token prefix  (--gm-navy ...)
PALETTE_URL = 'https://claude.ai/artifact/H6toH2q9ZvL8rrFwZx3SBj'
HOME_URL = 'https://claude.ai/artifact/GscpxuJVsbVxxc9VgcEtDB'
ORDER_URL = 'https://claude.ai/artifact/5sG47Yyn1HsjyS6GR6ygqh'
CATALOGUE_URL = 'https://github.com/moshehik/gemach-app/blob/main/design-system/COMPONENTS.md'

NOUN = {'icon': 'אייקון', 'button': 'לחצן', 'choice': 'בורר', 'chip': 'תגית', 'form': 'שדה', 'banner': 'באנר', 'toast': 'טוסט', 'tip': 'טולטיפ', 'rich': 'רמז עשיר',
        'dialog': 'חלון', 'card': 'כרטיס', 'list': 'שורה', 'history': 'היסטוריה', 'timeline': 'שלב', 'nav': 'ניווט', 'home': 'בית', 'other': 'פריט', 'anim': 'הנפשה', 'color': 'צבע'}
TITLE = {'icon': 'אייקונים', 'button': 'כפתורים וקישורים', 'choice': 'לשוניות, מתגים ובוחרים', 'chip': "צ'יפים, תגיות וסימונים", 'form': 'שדות וטפסים', 'banner': 'באנרים והתראות',
         'toast': 'טוסט', 'tip': 'טולטיפים ורמזים', 'dialog': 'חלונות קופצים', 'card': 'כרטיסים ופריטים', 'list': 'רשימות, טבלאות ושורות', 'history': 'היסטוריה ותוצאות',
         'timeline': 'ציר זמן, תהליך ועגלה', 'nav': 'ניווט ופריסה', 'home': 'רכיבי דף הבית', 'other': 'שונות', 'anim': 'הנפשות', 'color': 'צבעים וטוקנים'}
ORDER = ['icon', 'button', 'choice', 'chip', 'form', 'banner', 'toast', 'tip', 'dialog', 'card', 'list', 'history', 'timeline', 'nav', 'home', 'other', 'anim', 'color']
# Hebrew labels of the icons (same table as build2.py, plus the four nav icons the palette build missed)
LBL = {'user': 'לקוחה', 'users': 'לקוחות', 'userck': 'לקוחה מאושרת', 'mail': 'מייל', 'phone': 'טלפון', 'msg': 'הודעה', 'bell': 'התראות', 'send': 'שליחה', 'note': 'הערה', 'file': 'קובץ', 'list': 'רשימה',
       'print': 'הדפסה', 'copy': 'העתקה', 'clip': 'קובץ מצורף', 'table': 'טבלה', 'rows': 'שורות', 'sig': 'חתימה', 'card': 'כרטיס אשראי', 'wallet': 'ארנק ויתרה', 'cash': 'מזומן', 'bank': 'העברה בנקאית',
       'cheque': 'שיק', 'tag': 'תג מחיר', 'gift': 'זיכוי ומתנה', 'dress': 'שמלה', 'bag': 'תיק', 'box': 'הזמנה וחבילה', 'cart': 'עגלת שינויים', 'scissors': 'תיקון', 'truck': 'משלוח', 'pin': 'מיקום',
       'flag': 'דגל', 'scan': 'סריקת ברקוד', 'pencil': 'עריכה', 'trash': 'מחיקה', 'check': 'אישור', 'x': 'סגירה', 'plus': 'הוספה', 'minus': 'הסרה', 'undo': 'ביטול פעולה', 'redo': 'שחזור', 'bk': 'חזרה לאחור',
       'swap': 'החלפה', 'refresh': 'רענון', 'eraser': 'ניקוי', 'search': 'חיפוש', 'searchspark': 'חיפוש חכם', 'sliders': 'סינון והגדרות', 'ext': 'פתיחה בחלון חדש', 'logout': 'יציאה', 'chev': 'חץ למטה',
       'back': 'חזרה', 'arrl': 'חץ שמאלה', 'arrr': 'חץ ימינה', 'arrlr': 'שני כיוונים', 'menu': 'תפריט', 'home': 'בית', 'cal': 'יומן ותאריך', 'clock': 'שעה', 'info': 'מידע', 'alert': 'אזהרה', 'lock': 'נעילה',
       'shield': 'אישור והגנה', 'eye': 'תצוגה', 'gear': 'הגדרות', 'sun': 'תצוגה ומצב', 'sparkle': 'רעיון',
       'sn-bug': 'דיווח תקלה (תפריט)', 'sn-chart': 'סטטיסטיקה (תפריט)', 'sn-history': 'היסטוריה (תפריט)', 'sn-inv': 'מלאי (תפריט)'}
# rules that come from the artifact viewer's own <style> (the wrapper claude.ai puts around a page), not from the site
WRAPPER_DECL = 'margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413'


def rd(p): return open(p, encoding='utf-8').read()
def wr(p, s, mode='w'):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, mode, encoding=None if 'b' in mode else 'utf-8', newline=None if 'b' in mode else '\n') as f: f.write(s)
def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')

def inner_doc(html):
    """the page as published, without the claude.ai viewer wrapper around it"""
    s = html.find('<title>'); e = html.rfind('</body>')
    return html[s:e if e > s else len(html)]      # build2.py's own palette2.html has no wrapper at all

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

# ---------------------------------------------------------------- CSS of the palette page
def parse_palette_css(inner):
    m = re.search(r'<style>\n(.*?)\n</style>', inner, re.S)
    css = m.group(1)
    cut = css.find('/* ====')                       # pl2.css = the palette's own documentation chrome starts here
    comp, chrome = css[:cut], css[cut:]
    roots, kf, props, A, B, other = [], collections.OrderedDict(), [], [], [], []
    def walk(rules, ctx):
        for r in rules:
            if r.type == 'qualified-rule':
                sel = tinycss2.serialize(r.prelude).strip(); decl = tinycss2.serialize(r.content).strip()
                if sel == ':root': roots.append((ctx, decl)); continue
                parts = top_commas(sel)
                if all(p.startswith('.pg-a') for p in parts): A.append((ctx, sel, decl))
                elif all(p.startswith('.pg-b') for p in parts): B.append((ctx, sel, decl))
                else: other.append((ctx, sel, decl))
            elif r.type == 'at-rule':
                kw = r.lower_at_keyword
                if kw in ('media', 'supports', 'container'):
                    walk(tinycss2.parse_rule_list(r.content, skip_comments=True, skip_whitespace=True), ctx + ((kw, tinycss2.serialize(r.prelude).strip()),))
                elif kw.endswith('keyframes'):
                    kf.setdefault(tinycss2.serialize(r.prelude).strip(), tinycss2.serialize(r.content).strip())
                elif kw == 'property':
                    p = '@property ' + tinycss2.serialize(r.prelude).strip() + '{' + tinycss2.serialize(r.content).strip() + '}'
                    if p not in props: props.append(p)
    walk(tinycss2.parse_stylesheet(comp, skip_comments=True, skip_whitespace=True), ())
    assert not other, f'unexpected unscoped rules in palette css: {other[:3]}'
    return dict(css=css, comp=comp, chrome=chrome, roots=roots, kf=kf, props=props, A=A, B=B)

def token_table(roots):
    """name -> value, first-seen order, later definitions win (the palette repeats the :root blocks of both pages)"""
    tok = collections.OrderedDict(); media = collections.OrderedDict()
    for ctx, decl in roots:
        for name, val in re.findall(r'(--[\w-]+)\s*:\s*([^;]+)', decl):
            if ctx: media.setdefault(ctx, collections.OrderedDict())[name] = val.strip()
            else: tok[name] = val.strip()
    return tok, media

def token_renamer(names):
    rx = re.compile(r'(?<![\w-])--(' + '|'.join(re.escape(n[2:]) for n in sorted(names, key=len, reverse=True)) + r')(?![\w-])')
    return lambda s: rx.sub(lambda m: '--' + TOK + m.group(1), s)

def kf_renamer(kfnames):
    rx = re.compile(r'(?<![\w-])(' + '|'.join(re.escape(n) for n in sorted(kfnames, key=len, reverse=True)) + r')(?![\w-])')
    def in_decl(decl):
        # keyframe names live only in animation / animation-name and in the two custom properties the pages use for icon hovers
        return re.sub(r'((?:^|;)\s*(?:animation(?:-name)?|--ia-a|--dk)\s*:\s*)([^;]*)', lambda m: m.group(1) + rx.sub(lambda k: KF + k.group(1), m.group(2)), decl)
    return in_decl

def scope_sel(sel, skin, root):
    out = []
    for p in top_commas(sel):
        assert p.startswith('.pg-' + skin), p
        out.append(root + p[len('.pg-' + skin):])
    return ','.join(out)

def is_wrapper_rule(sel, decl, skin):
    rest = sel[len('.pg-' + skin):]
    return (decl.startswith(WRAPPER_DECL) or (rest == ' img' and decl == 'max-width:100%') or rest == ' [hidden]:not([hidden=until-found i])')

def emit(rules):
    """rules: list of (ctx tuple, selector, decl) -> css text, consecutive rules with the same at-rule context share one wrapper"""
    out, cur, buf = [], None, []
    def flush():
        if not buf: return
        body = '\n'.join(buf)
        if cur:
            body = ''.join(f'@{k} {p}{{' for k, p in cur) + '\n' + body + '\n' + '}' * len(cur)
        out.append(body)
    for ctx, sel, decl in rules:
        if ctx != cur: flush(); cur = ctx; buf = []
        buf.append(f'{sel}{{{decl}}}')
    flush()
    return '\n'.join(out)

# ---------------------------------------------------------------- outputs
def build_tokens(tok, media, numbers):
    ren = token_renamer(tok.keys())
    num = numbers['color']
    lines = [f'/* design-system/tokens.css — הטוקנים של פלטת הרכיבים (גרסה {VERSION}). נוצר אוטומטית ע"י build/install.py — לא לערוך ידנית.',
             f'   המקור: הבלוקים :root של שני הדפים החיים (דף הבית A5, כרטיס הזמנה) כפי שהפלטה מציגה אותם ({PALETTE_URL}).',
             '   כל שם קיבל את הקידומת --gm- כדי שלא יתנגש באף משתנה של שכבת ה-CSS הישנה (design-v2/אריג: --primary, --surface, --bg, --card-* ...).',
             '   המספר בהערה הוא המספר הסידורי בפלטה ("צבע 29" = --gm-bg). הקובץ נטען גלובלית מ-app/globals.css ואינו משנה שום דף קיים: הוא רק מגדיר משתנים. */',
             ':root{']
    for name, val in tok.items():
        n = num.get(name)
        lines.append(f'  --{TOK}{name[2:]}:{ren(val)};' + (f' /* צבע {n} */' if n else ''))
    lines.append('}')
    for ctx, d in media.items():
        lines.append(''.join(f'@{k} {p}{{' for k, p in ctx) + ':root{' + ''.join(f'--{TOK}{k[2:]}:{ren(v)};' for k, v in d.items()) + '}' + '}' * len(ctx))
    lines += ['', '/* טוקנים נגזרים (תיעוד בלבד; components.css לא תלוי בהם): הגופן של שני הדפים ומשכי המעבר הנפוצים ביותר לפי קטלוג ההנפשות. */',
              ':root{', f"  --{TOK}font:'Rubik','Heebo',system-ui,sans-serif;", f'  --{TOK}t-quick:150ms; /* 118 כללי transition */', f'  --{TOK}t-base:180ms; /* 44 */', f'  --{TOK}t-soft:220ms; /* 16 */', '}', '',
              f'/* גשר תאימות, בהיקף {ROOT} בלבד: ה-HTML שמעתיקים מהפלטה ("העתק HTML") מכיל לפעמים style="color:var(--ink)" בשמות המקוריים.',
              f'   בתוך שורש {ROOT} השמות המקוריים מצביעים על הטוקנים המקודמים; מחוץ לו הם לא קיימים, ולכן שום דף ישן לא מושפע. */',
              ROOT + '{' + ''.join(f'{name}:var(--{TOK}{name[2:]});' for name in tok) + '}', '']
    return '\n'.join(lines)

def build_components(P, tok, home_html):
    ren = token_renamer(tok.keys())
    rkf = kf_renamer(P['kf'].keys())
    def fix(decl): return re.sub(r'(?<![\w-])--a(?![\w-])', f'--{TOK}a', rkf(ren(decl)))
    A = [(c, s, d) for c, s, d in P['A'] if not is_wrapper_rule(s, d, 'a')]
    B = [(c, s, d) for c, s, d in P['B'] if not is_wrapper_rule(s, d, 'b')]
    for skin, src, kept in (('a', P['A'], A), ('b', P['B'], B)):
        for c, s, d in src:
            if is_wrapper_rule(s, d, skin): print(f'dropped artifact-viewer rule ({skin}): {s} {{{d[:60]}}}')
    a_keys = {(c, s.replace('.pg-a', '.pg-x'), d) for c, s, d in A}
    a_cls = set(re.findall(r'\.(-?[A-Za-z_][\w-]*)', ' '.join(s for _, s, _ in A))) - {'pg-a'}
    # mkcss.py replaced the 485KB data-URI photo of body.home-bg::before with `none` (both pages carry the rule, only the
    # home page uses it); restore it as a file (public/design-system/home-bg.jpg) and re-add the `html body.home-bg` rule
    # that mkcss dropped (html-level rules cannot be scoped; the html colour behind it was #f6d9cb).
    m = re.search(r'body\.home-bg::before\{[^}]*?url\((?:"|\')?(data:image/jpeg;base64,[^)"\']+)', home_html)
    photo = base64.b64decode(m.group(1).split(',', 1)[1])
    def home_bg(c, s, d, skin, root, out):
        if s == f'.pg-{skin}.home-bg::before':
            out.append((c, root + '.home-bg', 'background:transparent!important'))
            return d.replace(' none ', ' url(/design-system/home-bg.jpg) ')
        return d
    base, guarded = [], 0
    for c, s, d in B:
        root = ROOT
        if '!important' in d and (c, s.replace('.pg-b', '.pg-x'), d) not in a_keys and set(re.findall(r'\.(-?[A-Za-z_][\w-]*)', s)) - {'pg-b'} <= a_cls:
            root = ROOT + f':not({HOME})'; guarded += 1        # a B-only !important that would otherwise beat the home skin's cascade
        d = home_bg(c, s, d, 'b', ROOT, base)
        base.append((c, scope_sel(s, 'b', root), fix(d)))
    over = []
    for c, s, d in A:
        d = home_bg(c, s, d, 'a', ROOT + HOME, over)
        over.append((c, scope_sel(s, 'a', ROOT + HOME), fix(d)))
    kf = '\n'.join(f'@keyframes {KF}{n}{{{fix(body)}}}' for n, body in P['kf'].items())
    props = '\n'.join(fix(p) for p in P['props'])
    head = f'''/* design-system/components.css — כל רכיבי פלטת הרכיבים, גרסה {VERSION}. נוצר אוטומטית ע"י build/install.py — לא לערוך ידנית.
   המקור: ה-CSS של שני הדפים החיים כפי שנוקה ונסרק לפלטה ({PALETTE_URL}); כללים "מתים" כבר הוסרו שם.

   מנגנון ההיקף (אין דליפה לשום דף קיים):
   1. כל בורר מתחיל ב-{ROOT} (שורש). דף ישן לא מכיל את המחלקה, ולכן אף כלל כאן לא חל עליו. הספציפיות של כל כלל היא לפחות (0,2,0).
   2. שני עורות, בדיוק כמו בפלטה: {ROOT} לבדו = העור של כרטיס ההזמנה (הבסיס, {len(base)} כללים);
      {ROOT}{HOME} = העור של דף הבית, שכבה מעל הבסיס ({len(over)} כללים, ספציפיות גבוהה ב-1 ולכן הקסקדה של דף הבית מנצחת).
      {guarded} כללי !important של כרטיס ההזמנה שהיו דורסים את עור הבית הוגבלו ל-{ROOT}:not({HOME}).
   3. כל שמות ה-keyframes קיבלו קידומת {KF} (fade → {KF}fade), כל הטוקנים קיבלו קידומת --{TOK} (--navy → --{TOK}navy), והמאפיין הרשום @property --a נקרא עכשיו --{TOK}a.
   4. אין @layer בכוונה: בתוך @layer כל כלל לא-משוכב של ה-CSS הישן היה מנצח את הפלטה בדפים חדשים (.btn, .card, .chip ...).
      ההיקף בשורש כבר מבטיח אפס שינוי בדפים קיימים; ראו README.md "התנגשויות".
   הגופן Rubik של הדפים נטען כאן (ולא ב-tokens.css) כדי ששום דף ישן לא יטען אותו. */
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap');
'''
    css = head + props + '\n' + kf + f'\n\n/* ===================== עור הבסיס: כרטיס הזמנה ({ROOT}) ===================== */\n' + emit(base) + \
        f'\n\n/* ===================== עור דף הבית ({ROOT}{HOME}) — הקסקדה המלאה של דף הבית מעל הבסיס ===================== */\n' + emit(over) + '\n'
    return css, photo, dict(base=len(base), over=len(over), guarded=guarded, kf=len(P['kf']))

def harvest_sprite(order_html, home_html):
    rx = re.compile(r'<symbol id="(i-[\w-]+)"[^>]*>.*?</symbol>', re.S)
    syms = collections.OrderedDict()
    for m in rx.finditer(order_html):
        # one symbol in the source reads id="i-sliders"viewBox=... (no space); browsers accept it, XML parsers do not
        s = re.sub(r'^(<symbol[^>]*>)', lambda t: re.sub(r'"(?=[A-Za-z][\w:-]*=)', '" ', t.group(1)), m.group(0))
        syms.setdefault(m.group(1), s)
    home_ids = set(m.group(1) for m in rx.finditer(home_html))
    assert set(syms) == home_ids, ('sprite differs between the two pages', set(syms) ^ home_ids)
    return syms

def sprite_svg(syms):
    body = '\n'.join(re.sub(r'\s+', ' ', s) for s in syms.values())
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true">\n'
            f'<!-- design-system/sprite.svg — ספריית האייקונים של הפלטה, {len(syms)} סמלים, גרסה {VERSION}. נוצר אוטומטית ע"י build/install.py מכרטיס ההזמנה.\n'
            f'     בתוך האפליקציה: <svg class="ic"><use href="/design-system/sprite.svg#i-mail"/></svg> (הפניה חיצונית - כך אין התנגשות עם ה-ids של app/components/IconSprite.js). -->\n'
            f'<defs>\n{body}\n</defs>\n</svg>\n')

def icon_usage(i, home_html, order_html):
    return {'home': home_html.count(f'#i-{i}"'), 'order': order_html.count(f'#i-{i}"')}

def build_index(inner, syms, numbers, home_html, order_html):
    """the palette page as a standalone document, with the missed icons added and a version line on top"""
    # 1. sprite: replace the page's 67-symbol sprite with the full library
    s = inner.find('<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'); e = inner.find('</defs></svg>', s) + len('</defs></svg>')
    assert s > 0 and e > s
    old_ids = re.findall(r'<symbol id="(i-[\w-]+)"', inner[s:e])
    inner = inner[:s] + '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' + ''.join(re.sub(r'\s+', ' ', v) for v in syms.values()) + '</defs></svg>' + inner[e:]
    # 2. icon tiles for the symbols the palette build missed (numbers continue the registry)
    new = [i for i in syms if i not in old_ids]
    used_tiles, unused_tiles = [], []
    for full in new:
        i = full[2:]; n = numbers['icon'][i]; u = icon_usage(i, home_html, order_html); used = u['home'] or u['order']
        pages = ('בית' if u['home'] else '') + (' · ' if u['home'] and u['order'] else '') + ('הזמנה' if u['order'] else '')
        key = f"|אייקון {n}|אייקון {i} {LBL.get(i, i)} {'לא בשימוש' if not used else pages}".lower()
        h = (f'<button type="button" class="pl-icon{"" if used else " unused"}" data-id="{i}" data-key="{esc(key)}" id="icon-{n}" aria-label="{LBL.get(i, i)}, העתקת קוד">'
             f'<span class="pl-n" style="height:24px;padding:0 10px;font-size:13px">אייקון <b>{n}</b></span>'
             f'<span class="g"><svg class="ic ia-{i} ia-h"><use href="#i-{i}"/></svg></span><b>{LBL.get(i, i)}</b><code>i-{i}</code>'
             f'<span class="u">{pages if used else "לא בשימוש"}</span></button>')
        (used_tiles if used else unused_tiles).append(h)
    def once(old, new_):
        nonlocal inner
        assert inner.count(old) == 1, old
        inner = inner.replace(old, new_)
    total = len(syms); old_total = len(old_ids)
    if used_tiles:
        g = inner.find('<div class="pl-igrid" id="iconGrid">'); ge = inner.find('</div>', g)
        inner = inner[:ge] + ''.join(used_tiles) + inner[ge:]
    if unused_tiles:
        m = re.search(r'אייקונים שלא בשימוש באף דף \((\d+)\)</summary><div class="pl-igrid" style="margin-top:12px">', inner)
        cnt = int(m.group(1)); ge = inner.find('</div>', m.end())
        inner = inner[:ge] + ''.join(unused_tiles) + inner[ge:]
        once(f'אייקונים שלא בשימוש באף דף ({cnt})', f'אייקונים שלא בשימוש באף דף ({cnt + len(unused_tiles)})')
    once(f'<b>{old_total}</b> אייקונים', f'<b>{total}</b> אייקונים')
    once(f'אייקונים<small>{old_total}', f'אייקונים<small>{total}')
    once(f'אייקונים · {old_total}', f'אייקונים · {total}')
    # 3. mark every specimen root: build2.py defined tidy_root() but never applied it, so the page's "העתק HTML" button
    #    (pl2.js looks for [data-pl-root]) found nothing to copy; the catalogue below reads the same marker.
    inner, n_roots = re.subn(r'(<div class="pl-stage"><div class="pl-skin [^"]*"><div class="app">)(<[a-z][a-z0-9-]*)', r'\1\2 data-pl-root="1"', inner)
    assert n_roots == inner.count('<article class="pl-s'), (n_roots, inner.count('<article class="pl-s'))
    # 4. version line
    meta = (f'<div class="gm-meta" role="note">מערכת העיצוב של האתר · גרסה {VERSION} · המקור: <code>design-system/</code> בריפו · '
            f'<a href="{CATALOGUE_URL}">הקטלוג הממוספר (COMPONENTS.md)</a> · <a href="/admin/site">מסך ניהול ראשי</a></div>')
    once('<div id="plroot" dir="rtl" lang="he">', '<div id="plroot" dir="rtl" lang="he">' + meta)
    head, body = inner.split('<style>\n', 1)
    style, body = body.split('\n</style>\n', 1)
    page = ('<!doctype html>\n<html lang="he">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            f'<!-- generated by design-system/build/install.py from {PALETTE_URL} (version {VERSION}); do not edit by hand -->\n'
            + head.strip() + '\n<style>\n' + style + '\n'
            '.gm-meta{max-width:1320px;margin:16px auto -8px;padding:10px 24px;font-size:14px;color:#2f4a6b;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}'
            '.gm-meta code{font-family:var(--pl-code);font-size:12.5px;background:#eef0f2;border:1px solid #d3d7dc;border-radius:6px;padding:1px 6px;direction:ltr;unicode-bidi:isolate}'
            '.gm-meta a{color:#0f2c52;font-weight:600}@media (max-width:980px){.gm-meta{padding-inline:16px}}\n'
            '</style>\n</head>\n<body>\n' + body.strip() + '\n</body>\n</html>\n')
    return page, new

# ---------------------------------------------------------------- catalogue
def compact(el):
    for d in [el] + list(el.find_all(True)):
        for a in ('data-pl-root',):
            if a in d.attrs: del d.attrs[a]
    h = re.sub(r'>\s+<', '><', str(el)); h = re.sub(r'\s+', ' ', h).strip()
    return h

def trim_html(h, lim=420):
    if len(h) <= lim: return h
    cut = h.rfind('>', 0, lim)
    return h[:cut + 1] + ' … (המשך ב-index.html, "העתק HTML")'

def build_catalogue(index_html, numbers, serial, anims, tok, icons, stats):
    soup = BeautifulSoup(index_html, 'html.parser')
    tt_num = {k[3:]: v for k, v in numbers['tip'].items() if k.startswith('tt|')}
    rich_num = {}
    for card in soup.select('.pl-tipc[id^=rich-]'):
        code = card.select_one('footer .pl-code').get_text()
        m = re.match(r'data-rich="(.*)"', code)
        if m: rich_num[m.group(1)] = int(card['id'].split('-')[1])
    anim_num = numbers['anim']
    kf_ren = lambda n: KF + n
    # animation matcher: selector classes/ids/attrs all present in the specimen
    def sel_parts(sel):
        p = re.sub(r'::?[\w-]+(\([^()]*\))?', '', sel)     # drop pseudo classes/elements (keeps :is() args' classes via the regexes below)
        return set(re.findall(r'\.(-?[A-Za-z_][\w-]*)', sel)) - {'pg-a', 'pg-b'}, set(re.findall(r'#([A-Za-z_][\w-]*)', sel)), re.findall(r'\[data-ico=([\w-]+)\]', sel)
    GENERIC = {'ic', 'ia-h', 'ia-in', 'app'}
    def anims_for(html, classes, ids):
        found = []
        for a in anims['anims']:
            hit = False
            for _, sel in a['sels']:
                cs, ss, attrs = sel_parts(sel)
                cs2 = cs - GENERIC
                if not cs2 and not ss and not attrs: continue
                if cs2 <= classes and ss <= ids and all(f'data-ico="{x}"' in html for x in attrs): hit = True; break
            if not hit and a.get('icons') and any('ia-' + i in classes for i in a['icons']): hit = True
            if hit: found.append(a['name'])
        return found
    # specs grouped by category
    specs = collections.defaultdict(list)
    for art in soup.select('article.pl-s[data-cat]'):
        cat = art['data-cat']; n = int(art['id'].split('-')[1])
        root = art.select_one('.pl-stage .app [data-pl-root]')
        assert root is not None, art['id']
        pages = art.select_one('.pl-pg').get_text(strip=True); cnt = art.select_one('.pl-cnt').get_text(strip=True)
        sig = art.select_one('footer .pl-code')['title']; txt = art.select_one('footer .pl-txt')
        html = compact(root) if root else ''
        classes = set(); ids = set()
        for d in ([root] + list(root.find_all(True))) if root else []:
            classes |= set(d.get('class') or []); ids.add(d.get('id') or '')
        tips = sorted({t for t in re.findall(r'data-tip="([^"]*)"', html)})
        richs = sorted({t for t in re.findall(r'data-rich="([^"]*)"', html)})
        specs[cat].append(dict(n=n, sig=sig, pages=pages, cnt=cnt, txt=txt.get_text(strip=True) if txt else '', html=html,
                               tips=[(t, tt_num.get(t)) for t in tips], richs=[(r, rich_num.get(r)) for r in richs], anims=anims_for(html, classes, ids)))
    out = [f'# קטלוג הרכיבים הממוספר — פלטת רכיבים גמ״ח שמלות · גרסה {VERSION}', '',
           f'נוצר אוטומטית ע"י `build/install.py` מדף הפלטה ({PALETTE_URL}) ומקובצי הרישום `build/numbers.json` / `build/serial_map.json` / `build/anims.json`. **המספרים הם המספרים של הפלטה ולעולם לא משתנים** (ראו README, "כלל יציבות המספור").',
           '', 'איך קוראים שורה: `לחצן 12` · הבורר האמיתי (tag.classes) · באיזה דף נתפס (דף הבית / כרטיס הזמנה / שניהם) וכמה פעמים · טקסט לדוגמה · שלד ה-HTML (מקוצר) · טולטיפים והנפשות שהרכיב משתמש בהם.',
           f'העור: רכיב שנתפס בדף הבית בלבד מעוצב תחת `{ROOT[1:]} {HOME[1:]}`; רכיב של כרטיס ההזמנה (או של שניהם) מעוצב תחת `{ROOT[1:]}` (ראו README).',
           '', '## תוכן', '']
    counts = {}
    for cat in ORDER:
        if cat == 'icon': counts[cat] = len(icons)
        elif cat == 'anim': counts[cat] = len(anims['anims'])
        elif cat == 'color': counts[cat] = len(tok)
        elif cat == 'tip': counts[cat] = len(specs.get('tip', [])) + len(tt_num) + len(rich_num)
        else: counts[cat] = len(specs.get(cat, []))
        if counts[cat]: out.append(f'- [{TITLE[cat]}](#{cat}) — {NOUN[cat]} · {counts[cat]}')
    out.append('')
    for cat in ORDER:
        if not counts[cat]: continue
        out += [f'<a id="{cat}"></a>', f'## {TITLE[cat]} ({NOUN[cat]} N)', '']
        if cat == 'icon':
            out += ['הספרייה המלאה של ה-sprite (`sprite.svg`, `public/design-system/sprite.svg`). בתוך האפליקציה: `<svg class="ic"><use href="/design-system/sprite.svg#i-mail"/></svg>`; בדף סטטי עם ה-sprite המוטמע: `<use href="#i-mail"/>`. הנפשת הריחוף: המחלקות `ia-<id> ia-h` על ה-svg.', '',
                    '| מס׳ | id | שם | בשימוש | הנפשת ריחוף |', '|---|---|---|---|---|']
            icon_anim = {}
            for a in anims['anims']:
                for i in a.get('icons', []): icon_anim.setdefault(i, []).append(f'הנפשה {anim_num[a["name"]]} `{a["name"]}`')
            for ic in icons:
                u = ic['usage']; where = ' · '.join(p for p, k in (('בית', 'home'), ('הזמנה', 'order')) if u[k]) or 'לא בשימוש'
                out.append(f'| אייקון {ic["n"]} | `i-{ic["id"]}` | {ic["label"]} | {where} | {", ".join(icon_anim.get(ic["id"], [])) or "—"} |')
            out.append('')
            continue
        if cat == 'anim':
            out += ['שם ה-keyframes ב-`components.css` הוא השם המקורי עם הקידומת `gm-` (הנפשה 47 `fade` → `@keyframes gm-fade`). המשך/עקומה/חזרות כפי שנצפו; "רחיפה על אייקון" = מופעל דרך `--ia-a` על `svg.ic.ia-<icon>.ia-h`.', '',
                    '| מס׳ | שם | דפים | משך · עקומה · חזרות | הפעלה | בוררים (עד 3) | אייקונים |', '|---|---|---|---|---|---|---|']
            for a in sorted(anims['anims'], key=lambda a: anim_num[a['name']]):
                dur = a['dur'] if a['dur'] is not None else '-'; trig = ' · '.join(t[0] for t in a['trig']) or 'לפי הקשר'
                pages = ' + '.join('בית' if p == 'A' else 'הזמנה' for p in a['pages'])
                sels = '<br>'.join('`' + s[1][:80].replace('|', '\\|') + '`' for s in a['sels'][:3])
                out.append(f'| הנפשה {anim_num[a["name"]]} | `{a["name"]}` | {pages} | {dur}s · {a["ease"][:28]} · {a["iter"] or "1"} | {trig} | {sels} | {", ".join(a.get("icons", [])) or "—"} |')
            out.append('')
            continue
        if cat == 'color':
            out += ['הטוקנים האמיתיים של שני הדפים (משתני `:root`). ב-`tokens.css` כל שם מקבל את הקידומת `--gm-` וזמין בכל דף של האתר; בתוך שורש `gm-ds` השם המקורי עובד גם כן (גשר תאימות).', '',
                    '| מס׳ | שם מקורי | שם באתר | ערך |', '|---|---|---|---|']
            for name, val in tok.items():
                out.append(f'| צבע {numbers["color"][name]} | `{name}` | `--{TOK}{name[2:]}` | `{val.replace("|", "\\|")}` |')
            out.append('')
            continue
        for sp in sorted(specs.get(cat, []), key=lambda s: s['n']):
            noun = NOUN[cat]
            sibl = [x['n'] for x in specs[cat] if x['sig'] == sp['sig'] and x['n'] != sp['n']]
            skin = f'`{ROOT[1:]} {HOME[1:]}` (עור דף הבית)' if sp['pages'] == 'דף הבית' else f'`{ROOT[1:]}` (עור הבסיס)'
            out.append(f'### {noun} {sp["n"]} · `{sp["sig"]}`')
            out.append(f'- **איפה:** {sp["pages"]} ({sp["cnt"]}) · **עור:** {skin}' + (f' · **טקסט לדוגמה:** {sp["txt"]}' if sp['txt'] else ''))
            if sibl: out.append(f'- **וריאנטים (אותו בורר):** ' + ', '.join(f'{noun} {x}' for x in sorted(sibl)))
            if sp['tips']: out.append('- **טולטיפים:** ' + ', '.join((f'טולטיפ {n} "{t}"' if n else f'"{t}" (לא ממוספר)') for t, n in sp['tips']))
            if sp['richs']: out.append('- **רמזים עשירים:** ' + ', '.join((f'רמז עשיר {n} `{r}`' if n else f'`{r}`') for r, n in sp['richs']))
            if sp['anims']: out.append('- **הנפשות:** ' + ', '.join(f'הנפשה {anim_num[a]} `{a}`' for a in sp['anims'] if a in anim_num))
            out.append('- **שלד HTML:**')
            out.append('  ```html'); out.append('  ' + trim_html(sp['html'])); out.append('  ```'); out.append('')
        if cat == 'tip':
            out += ['### טולטיפים (data-tip) — הטקסט האמיתי ועל איזה אלמנט', '', '| מס׳ | טקסט | אלמנט |', '|---|---|---|']
            for card in soup.select('.pl-tipc[id^=tip-]'):
                n = int(card['id'].split('-')[1]); text = card.select_one('.pl-tt').get_text(strip=True); target = card.select_one('footer .pl-code').get_text(strip=True)
                out.append(f'| טולטיפ {n} | {text} | `{target}` |')
            out += ['', '### רמזים עשירים (data-rich) — כרטיסי ציר הזמן והעגלה', '', '| מס׳ | data-rich | אלמנט |', '|---|---|---|']
            for card in soup.select('.pl-tipc[id^=rich-]'):
                n = int(card['id'].split('-')[1]); code = card.select_one('footer .pl-code').get_text(strip=True); target = card.select_one('footer .pl-txt').get_text(strip=True)
                out.append(f'| רמז עשיר {n} | `{code}` | `{target}` |')
            out.append('')
    out += ['## סיכום המספור', '', f'- כללי CSS ב-components.css: {stats["base"]} בעור הבסיס + {stats["over"]} בעור דף הבית · keyframes: {stats["kf"]} · אייקונים: {len(icons)} · טוקנים: {len(tok)}',
            '- הפריטים הממוספרים בקטלוג הזה זהים אחד לאחד לפריטי דף הפלטה (`public/design-system/index.html`).', '']
    return '\n'.join(out)

# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--palette', required=True); ap.add_argument('--home', required=True); ap.add_argument('--order', required=True)
    a = ap.parse_args()
    palette, home_html, order_html = inner_doc(rd(a.palette)), rd(a.home), rd(a.order)
    numbers = json.load(open(os.path.join(HERE, 'numbers.json'), encoding='utf-8'))
    serial = json.load(open(os.path.join(HERE, 'serial_map.json'), encoding='utf-8'))
    anims = json.load(open(os.path.join(HERE, 'anims.json'), encoding='utf-8'))
    P = parse_palette_css(palette)
    tok, media = token_table(P['roots'])
    assert set(tok) == set(numbers['color']), set(tok) ^ set(numbers['color'])

    # icons: every <symbol> of the order page; ids missing from the registry get the next numbers (never renumber)
    syms = harvest_sprite(order_html, home_html)
    for full in syms:
        i = full[2:]
        if i not in numbers['icon']:
            numbers['icon'][i] = max(numbers['icon'].values()) + 1
            print('new icon number:', i, numbers['icon'][i])
    serial['icons'] = sorted([[i, numbers['icon'][i]] for i in (f[2:] for f in syms)], key=lambda x: x[0])
    icons = [dict(n=numbers['icon'][f[2:]], id=f[2:], label=LBL.get(f[2:], f[2:]), usage=icon_usage(f[2:], home_html, order_html)) for f in syms]
    icons.sort(key=lambda x: x['n'])

    tokens_css = build_tokens(tok, media, numbers)
    components_css, photo, stats = build_components(P, tok, home_html)
    index_html, new_icons = build_index(palette, syms, numbers, home_html, order_html)
    sprite = sprite_svg(syms)
    catalogue = build_catalogue(index_html, numbers, serial, anims, tok, icons, stats)

    wr(os.path.join(DS, 'tokens.css'), tokens_css)
    wr(os.path.join(DS, 'components.css'), components_css)
    wr(os.path.join(DS, 'sprite.svg'), sprite)
    wr(os.path.join(DS, 'icons.json'), json.dumps(dict(version=VERSION, source=ORDER_URL, icons=icons), ensure_ascii=False, indent=1))
    wr(os.path.join(DS, 'COMPONENTS.md'), catalogue)
    wr(os.path.join(PUB, 'index.html'), index_html)
    wr(os.path.join(PUB, 'sprite.svg'), sprite)
    if photo: wr(os.path.join(PUB, 'home-bg.jpg'), photo, 'wb')
    json.dump(numbers, open(os.path.join(HERE, 'numbers.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    json.dump(serial, open(os.path.join(HERE, 'serial_map.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print('tokens', len(tok), '| components rules', stats, '| sprite', len(syms), 'symbols (new:', new_icons, ') | index.html', len(index_html), 'bytes | COMPONENTS.md', len(catalogue), 'bytes | photo', len(photo) if photo else 0)

if __name__ == '__main__':
    main()
