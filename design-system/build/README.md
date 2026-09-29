# build/ — כלי הבנייה של פלטת הרכיבים ומרשם המספרים

הקבצים כאן הם העותק הקנוני של הכלים שבנו את הפלטה (2026-09-28) ואת תיקיית `design-system/` (2026-09-29). הכל נגזר מה-DOM החי של שני הדפים — לא מקריאת CSS ולא מניחוש סימון (הגרסה הראשונה שנבנתה כך נדחתה).

## הצינור

| שלב | כלי | קלט | פלט |
|---|---|---|---|
| 1 | `crawl.mjs A` / `crawl.mjs B` | `pageA.html` (דף הבית A5), `pageB.html` (כרטיס הזמנה) — עותקים מקומיים של שני הארטיפקטים | `crawl/A_harvest.json`, `crawl/B_harvest.json` (כל DOM שנצפה, עד 8 וריאנטים לרכיב עם שרשרת אבות), `crawl/*_tips.json` (הטולטיפים האמיתיים), `crawl/*_rules.json`, `crawl/*_summary.json`, צילומי מסך |
| 2 | `mkcss.py` | הדפים + ה-harvest | `scoped_A.css` / `scoped_B.css` (CSS נקי לכל דף תחת `.pg-a` / `.pg-b`, כללים מתים הוסרו), `kf_A.css` / `kf_B.css` (keyframes בשימוש), `roots_*.css` (הטוקנים), `crawl/prune_report.json` |
| 3 | `extract.py` | ה-harvest + ה-CSS | בחירת שורשי רכיבים אמיתיים (כיסוי חמדני, הגדול קודם) וסיווג לקטגוריות |
| 4 | `anim_data.py` | הדפים + `kf_*.css` | `crawl/anims.json` — קטלוג ההנפשות והמעברים (מה שרץ בפועל + מה שה-CSS מגדיר) |
| 5 | `build2.py` | הכל + `pl2.css` / `pl2.js` (שכבת התיעוד של הדף) + `B_syms.txt` + `numbers.json` | `palette2.html` (דף הפלטה, הועלה כארטיפקט H6toH2q9ZvL8rrFwZx3SBj), `serial_map.json`, `numbers.json` מעודכן |
| 6 | `install.py` | דף הפלטה + שני דפי המקור | `design-system/tokens.css`, `components.css`, `sprite.svg`, `icons.json`, `COMPONENTS.md`, `public/design-system/index.html`, `sprite.svg`, `home-bg.jpg`; מוסיף למרשם אייקונים חסרים |
| בדיקה | `check_collisions.py` | `design-system/` + `app/*.css` | דו"ח Markdown: היקף מלא, קידומות, אפס חיתוך עם ה-legacy |

```bash
# עותקים מקומיים של שני הדפים (Artifact read שומר אותם; להעתיק לכאן בשמות pageA.html / pageB.html)
node crawl.mjs A && node crawl.mjs B        # Edge headless דרך CDP, Node 24 (WebSocket מובנה), ~5 דקות לדף
python mkcss.py && python extract.py && python anim_data.py && python build2.py
# palette2.html -> לפרסם כארטיפקט (או להשתמש בו ישירות) ואז:
python install.py --palette palette2.html --home pageA.html --order pageB.html
python check_collisions.py
```

דרישות: Node 24+, Microsoft Edge (`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`, ניתן לשנות ב-`crawl.mjs`), Python 3.12 עם `tinycss2` ו-`beautifulsoup4`.

## מה נמצא כאן ומה לא

- **במרשם (לא למחוק, לא לערוך ידנית):** `numbers.json` — מפתח יציב ← מספר סידורי לכל קטגוריה. `build2.py` ו-`install.py` רק מוסיפים מספרים חדשים. `serial_map.json` — המפה ההפוכה (מספר → בורר/דף/טקסט), נוצרת בכל בנייה.
- **נתוני הסריקה שנשמרו:** `anims.json` (= `crawl/anims.json` של הסריקה מ-2026-09-28), `kf_A.css` / `kf_B.css`, `B_syms.txt` (67 הסמלים כפי ש-`build2.py` קרא אותם; `install.py` לא משתמש בו אלא קוצר את כל 71 הסמלים ישירות מהדף).
- **לא בריפו:** `pageA.html` / `pageB.html` (1MB כל אחד — קוראים מחדש מהארטיפקטים: דף הבית `GscpxuJVsbVxxc9VgcEtDB`, כרטיס הזמנה `5sG47Yyn1HsjyS6GR6ygqh`), תיקיית `crawl/` עם ה-harvest (מתחדשת בסריקה), `scoped_*.css`, `roots_*.css`, `palette2.html`. בלי סריקה חדשה אפשר עדיין להריץ את `install.py` על דף הפלטה הקיים.

## עובדות שכדאי לדעת לפני שינוי

- לכרטיס ההזמנה 52 בלוקי `<style>` (כולל `seg-pill`, `hres`, `proc-bar`, `oc-spacing`, `btn-unify` …), לדף הבית 5. בלוק המעטפת המשותף (`v3-shell-css`) זהה בשניהם; ההבדלים בין העורות באים מהבלוקים שאחריו. לכן `components.css` שומר את שני העורות.
- הרכיב האמיתי של פריט הוא `article.hrow.irow` (לא `.itm`), המתג המחוון הוא `.seg.pill` עם `.pth` ו-`--i`/`--n`, הטולטיפים הם `data-tip` (`#tt`) ו-`data-rich` (`#rt`) עם תוכן שנוצר ב-JS.
- `build2.py` הגדיר `tidy_root()` (סימון שורש הרכיב ב-`data-pl-root`) אבל לא קרא לה, ולכן לחצן "העתק HTML" בדף הפלטה המקורי לא העתיק דבר; `install.py` מסמן את השורשים ב-`index.html`.
- ה-regex של הסמלים ב-`build2.py` (`i-([\w]+)`) לא תופס מזהים עם מקף (`i-sn-bug`); `install.py` משתמש ב-`i-[\w-]+` על כל המסמך.
- `mkcss.py` מחליף `url(data:…)` ארוך מ-2,500 תווים ב-`none` — כך נעלמה תמונת הרקע של דף הבית; `install.py` משחזר אותה כקובץ `public/design-system/home-bg.jpg`.
- הדפים המקוריים נשמרים בתוך מעטפת של claude.ai (בלוק `<style>` משלה); שלושת הכללים שלה (`body{font:14px -apple-system…}`, `img{max-width:100%}`, `[hidden]`) מסוננים ב-`install.py` כי אינם חלק מעיצוב האתר.
