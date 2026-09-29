#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check_collisions.py — proves that design-system/components.css + tokens.css cannot touch an existing page.

Prints a Markdown report:
  * every selector part of components.css starts with the scope root (.gm-ds)      -> 0 unscoped selectors
  * keyframe names of components.css vs. @keyframes of app/*.css and app/**/*.js    -> empty intersection
  * :root custom properties of tokens.css vs. custom properties the app declares    -> empty intersection
  * class names / ids the palette uses that the legacy CSS also uses (informational: they are the
    reason the scope root exists; inside .gm-ds the palette wins by specificity, outside it nothing applies)
  * the app's source contains no element carrying the scope classes (gm-ds / gm-home)
Run:  python design-system/build/check_collisions.py   (from anywhere; exit code 1 on a real collision)
"""
import glob, os, re, sys
import tinycss2

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__)); DS = os.path.dirname(HERE); REPO = os.path.dirname(DS)
ROOT = '.gm-ds'

def rd(p): return open(p, encoding='utf-8', errors='replace').read()

def selectors(css):
    parts, kf = [], set()
    def walk(rules):
        for r in rules:
            if r.type == 'qualified-rule':
                sel = tinycss2.serialize(r.prelude).strip()
                parts.extend(p.strip() for p in re.split(r',(?![^()]*\))', sel))
            elif r.type == 'at-rule':
                if r.lower_at_keyword in ('media', 'supports', 'container', 'layer') and r.content is not None:
                    walk(tinycss2.parse_rule_list(r.content, skip_comments=True, skip_whitespace=True))
                elif r.lower_at_keyword.endswith('keyframes'):
                    kf.add(tinycss2.serialize(r.prelude).strip())
    walk(tinycss2.parse_stylesheet(css, skip_comments=True, skip_whitespace=True))
    return parts, kf

comp = rd(os.path.join(DS, 'components.css')); tok = rd(os.path.join(DS, 'tokens.css'))
app_css = {f: rd(f) for f in glob.glob(os.path.join(REPO, 'app', '*.css'))}
app_js = ''.join(rd(f) for f in glob.glob(os.path.join(REPO, 'app', '**', '*.js'), recursive=True) + glob.glob(os.path.join(REPO, 'components', '**', '*.js'), recursive=True))

parts, kf = selectors(comp)
unscoped = [p for p in parts if not p.startswith(ROOT)]
app_parts, app_kf = [], set()
for f, css in app_css.items():
    p, k = selectors(css); app_parts += p; app_kf |= k
app_kf |= set(re.findall(r'@keyframes\s+([A-Za-z0-9_-]+)', app_js))
cls = lambda ps: set(c for p in ps for c in re.findall(r'\.(-?[A-Za-z_][\w-]*)', p))
ids = lambda ps: set(c for p in ps for c in re.findall(r'#([A-Za-z_][\w-]*)', p))
pal_cls = cls(parts) - {'gm-ds', 'gm-home'}; app_cls = cls(app_parts)
pal_ids = ids(parts); app_ids = ids(app_parts)
tok_props = set(re.findall(r'^\s*(--[\w-]+)\s*:', tok, re.M))
app_props = set(re.findall(r'(--[\w-]+)\s*:', ''.join(app_css.values()))) | set(re.findall(r"['\"](--[\w-]+)['\"]", app_js))
comp_root_props = set(re.findall(r'(--gm-[\w-]+)\s*:', comp))
scope_in_app = re.findall(r'gm-ds|gm-home', app_js)

print('# דו"ח התנגשויות — design-system/components.css + tokens.css מול ה-CSS הישן (app/*.css)\n')
print(f'- כללי CSS (חלקי בורר) ב-components.css: **{len(parts)}** · מתחילים ב-`{ROOT}`: **{len(parts) - len(unscoped)}** · לא מוגדרי היקף: **{len(unscoped)}**' + (f' ← {unscoped[:5]}' if unscoped else ' ✔'))
print(f'- keyframes ב-components.css: **{len(kf)}** (כולם עם קידומת gm-: {all(k.startswith("gm-") for k in kf)}) · keyframes באפליקציה: **{len(app_kf)}** ({", ".join(sorted(app_kf))}) · חיתוך: **{sorted(kf & app_kf) or "∅ ✔"}**')
print(f'- משתני :root ב-tokens.css: **{len(tok_props)}** (כולם --gm-*: {all(p.startswith("--gm-") for p in tok_props)}) · משתנים שהאפליקציה מגדירה/קוראת: **{len(app_props)}** · חיתוך: **{sorted(tok_props & app_props) or "∅ ✔"}**')
print(f'- משתנים --gm-* שמוגדרים בתוך כללי components.css (מקומיים): {sorted(comp_root_props - tok_props) or "∅"}')
print(f'- שמות מחלקה שהפלטה משתמשת בהם: **{len(pal_cls)}** · מחלקות ב-CSS הישן: **{len(app_cls)}** · משותפות (ולכן צריך את שורש ההיקף): **{len(pal_cls & app_cls)}** — {", ".join(sorted(pal_cls & app_cls))}')
print(f'- ids בבוררי הפלטה: {len(pal_ids)} · ids ב-CSS הישן: {len(app_ids)} · משותפים: {sorted(pal_ids & app_ids) or "∅ ✔"}')
print(f'- מופעים של המחלקות gm-ds / gm-home בקוד האפליקציה (app/, components/): **{len(scope_in_app)}** {"✔ (אף דף קיים לא נושא את השורש)" if not scope_in_app else "← יש לבדוק"}')
print('\nמסקנה: ' + ('כל כלל ב-components.css דורש אב עם המחלקה gm-ds, ואף דף קיים לא מכיל אותה; שמות ה-keyframes והטוקנים מקודמים ואינם חופפים לשום שם באפליקציה — לכן אין שום דרך שהקבצים ישנו דף קיים.'
      if not unscoped and not (kf & app_kf) and not (tok_props & app_props) and not scope_in_app else 'נמצאה התנגשות — לתקן לפני ייבוא.'))
sys.exit(0 if not unscoped and not (kf & app_kf) and not (tok_props & app_props) and not scope_in_app else 1)
