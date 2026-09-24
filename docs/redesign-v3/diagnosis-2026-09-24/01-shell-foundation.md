# אבחון 01 — מעטפת + תשתית (Shell + Foundation)

ענף: `redesign/site-v3-2026-09-24` @ worktree `wt-redesign-v3` (HEAD e861963). קריאה בלבד.

> **הערה: `scratch/design-v2` הוא מיושן (OBSOLETE) לפי המשתמש.** כל השוואה אליו במסמך זה היא **היסטורית בלבד**. מקור האמת = סקיצה B (`order-card-sketch-B.html`) + `docs/redesign-v3`.

## 0. מתודולוגיה ומגבלות
- **סטטי:** קריאת `app/v3/tokens.css` (400 שורות), `components.css` (1387), `icons.css` (97), `notify/*`, `app/components/v3-shell.css` (173), `AppShell.js`, `PopupProvider.js`, `globals.css` (2477), `design-system.css` (1291), `design-overrides.css` (250), `layout.js` + ספירות grep על `app/` ו-`components/`.
- **חי:** שרת ה-worktree (פורט 3100, `/v3-gallery`) נמדד ב-viewport 1024 ו-1440, ואז נפל (נשארו 3200/3410 שמשרתים את העץ הראשי). **360/768/1920 לא נמדדו חי** — נלקח מקוד ה-CSS. ספציפיות `[data-v3] button` אומתה בהזרקה מבודדת בדפדפן.
- ערכי הסקיצה נלקחו מקוד ה-CSS שלה (`.snav`, שורות 1234-1344).

---

## 1. תקציר מנהלים
1. הספרייה המשותפת (`app/v3`) קיימת ואיכותית, אך היא **שכבה מעל העיצוב הישן** ולא תשתית: ה-CSS הישן (globals 2477 + design-system 1291 + design-overrides 250 = 4018 שורות; 66+2+38 `!important`) נטען **לפני** v3 ונלחם בו. אין בידוד (`@layer` / `all: revert`).
2. **באגי יסוד מאומתים:**
   - **F1** `[data-v3] button {font:inherit; color:inherit}` (components.css:38, ספציפיות 0,1,1) דורס כל כלל מחלקה בודדת על `<button>` (`.v3-btn`, `.v3-user`, `.v3-topbar__tab` כשהוא button). נמדד: `.v3-user` = 16px במקום 14px; בדיקה מבודדת: button→16/400/צבע-אב, anchor→14/600/צבע-מחלקה. **כנראה הסיבה ל"הטיפוגרפיה לא מיושמת"** (משקלים/גדלים נופלים ל-16/400).
   - **F2** רקע הדף על `.v3-page` (מיכל 1240px) ולא על `html/body` → פסי רקע-גוף ישן משני הצדדים. בסקיצה: `html,body{background-color:#dcedfa!important}`.
   - **F3** `design-overrides.css:23-30` כופה `font-family: Assistant !important` על `body, button, input, select, textarea`; בסיס body מחוץ ל-scope נמדד **15px Assistant** (לא 16px Rubik, R14).
   - **F4** אין מצב כהה בתשתית: 0 כללי `data-theme` ב-tokens/components/v3-shell. נמדד: `data-theme="dark"`, body bg `rgb(27,23,20)` בעוד `.v3-page` נשאר תכלת → דף "חצי כהה". QUESTIONS Q3 ("עמודים בהירים בלבד") סותרת את הבקשה המקורית ("dark mode built into foundation") ומסומנת "אושר ברירת מחדל" בלי אישור משתמש.
   - **F5** `PopupProvider.js` (435 שורות: toast-stack למעלה-מרכז :215, confirm :245, three-way :265, prompt :288, auth :323) עדיין 100% ישן; `window.alert` מנותב אליו (:199); `v3Toast` לא מחובר ל-`showAlert`. ≈55 `alert(`, ≈57 `showConfirm`, 24 `showAuthPrompt` באתר עדיין ישנים.
   - **F6** חצים ב-RTL: `i-chevron-start`="<", `i-chevron-end`=">", `i-arrow-end`="→" מצוירים פיזית; **אין מירור RTL** (grep `scaleX(-1)`=0). אליאסים `back/next` (Icon.js:11) הפוכים; `arrow-end` משמש גם "חזרה" (employees/[id]:386, report:169, ModernDressCard:57) וגם "המשך" (Login:420, TopbarSearch:207); `Banner` action (Feedback.js:26) מצביע פנימה.
3. **כיסוי:** 25/67 `page.js` עטופים ב-`V3Page`; 42 לא (35 admin/management = שלב מאוחר לפי Q1; 4 הדפסות; `orders/new` דרך `NewOrderShell`). ב-JS: **629** `var(--old-token)` מול **257** `var(--v3-*)`; **1,374** `style={{}}` (670 עמודי-עבודה, 329 ב-`components/`, 711 admin/management); **422** `<svg className="icon">` ישן מול 367 `<Icon>`; 51 `modal-backdrop`/`className="modal"` ישנים ב-`components/`.

---

## 2. F0 — היסטורי: שני "מוקים" (design-v2 מיושן)
| | order-card-sketch-B (מחייב) | design-v2 (**היסטורי / מיושן**) |
|---|---|---|
| פלטה | navy `#0f2c52`/`#0a2242`, sky `#dcedfa`, gold `#c9a227`, rose `#fbbfa9` | יין `#7C2E4D`, קרם `#FAF7F2` |
| ניווט | `.snav` סרגל עליון 64px | sidebar 248px + topbar דק |
| גופן | Rubik 16px/1.5 | Segoe UI/Assistant 15px |
- design-v2 הוא "אריג" הישן (אותם טוקנים כמו `origin/main:app/design-system.css`), ללא navy כלל. הוא הוצא מהיקף; אין לאמת מולו.

---

## 3. סרגל עליון — סקיצה מול אמיתי
### 3.1 מדידות (1440, `/v3-gallery`, אורח)
| מדד | סקיצה `.snav` | אמיתי `.v3-topbar` | פער |
|---|---|---|---|
| גובה | 64 | 64 | זהה |
| padding-inline / gap | 24 / 12 | 24 / 12 | זהה |
| לשונית `<a>` | 15px/500, h40, pad 14 | 15/500, h40, pad 14 | זהה |
| לשונית `<button>` (הזמנות/מלאי/אנשים) | 15/500 | **16px/400** (F1) | לשוניות לא אחידות |
| `.sn-user` | 14/500 | **16px** (F1) | F1 |
| שעון משמרת | 13px | 13px | זהה (מוסתר ≤1040) |
| מותג | אייקון זהב 38 + טקסט 19/700 + תגית | אריח לבן 44 עם לוגו (`BrandLogo`) | שונה בכוונה |
| גופן כפתורים/שדות | Rubik | Assistant (F3) | F3 |
ערכי ה-CSS של הסרגל הועתקו נאמנה (components.css:1005-1092 ↔ סקיצה 1237-1344); ה"קטן/צפוף" נובע מ-F1/F3 ומרשימת הפקדים.

### 3.2 רשימת פקדים
| פקד | סקיצה | אמיתי |
|---|---|---|
| מותג, לשוניות, חיפוש, פעמון, שעון, משתמש | ✔ (5 סוגים) | ✔ |
| קיצורים מוצמדים (pins) | ✘ | ✔ עד 240px |
| אחורה / קדימה / ריענון | ✘ | ✔ ×3 |
| מתג ערכת נושא | ✘ | ✔ נפרד |
| היסטוריית הודעות, דיווח שגיאות | ✘ | ✔ (`.icon-btn` ישן) |
7 פקדים עודפים (חלקם מחויבים ע"י חוזה shell/R7), ללא קיבוץ. `MessageHistoryButton`/`ErrorReportButton` (115 inline styles) עדיין מודלים ישנים (SHELL.md §7). הסרגל navy בשני מצבי ה-theme (SHELL.md §6: dark לא נבדק).

### 3.3 רקע שלא מכסה את החלון (F2)
`components.css:28` `[data-v3]{background:var(--v3-bg)}` על שורש `V3Page` (`.v3-page{max-width:1240px}`); `html` שקוף (נמדד), `body` = `--bg-color` ישן + `background-image` גרדיאנטים (globals.css:133-137); `.content` padding 22/24 (design-system.css:322), ב-≥1700 `max-width:1680` (:1245). תוצאה: ב-1440 ~100px, ב-1920 ~340px רקע ישן בצדדים; דפים קצרים — פס תחתון. **תיקון:** `--v3-bg` על `html, body`.

---

## 4. tokens / פלטה / dark
- tokens.css: 93 hex + שקיפויות בשם, סולם ריווח 4→64, רדיוסים, צללים, z-index, תנועה — מלא. בעיות: (א) `--v3-*` גם על `:root` (דליפה מחוץ ל-scope); (ב) שני משטחי טוקנים במקביל: 629 ישנים מול 257 חדשים ב-JS + 182 `var(--primary*)` ב-CSS הישן, בלי גשר `--primary-solid → --v3-navy` ⇒ קוד ישן בתוך עמוד v3 מציג יין/קרם; (ג) פלטות אישיות (`Employee.themeColor`, `data-palette`) משנות רק טוקנים ישנים; ה-hook שהובטח ב-Q2 לא נבנה; `data-font` (20+ גופני משתמש) לא משפיע על `--v3-font`.
- **dark:** רק `[data-v3-mode="dark"]` לחלונית (tokens.css:343) + `Dialog mode`; 7 שימושי `mode=` מפורשים; `Dialog` לא קורא `data-theme`. המשתנים הסמנטיים (`--v3-bg/surface/ink…`) קבועים ואין להם ערכת dark. מעבר דורש ~35 משתנים סמנטיים + החלפת `--v3-white`/`--v3-black` הקשיחים (107 שימושים).

---

## 5. פלטת כחולים (dark blue)
### 5.1 האתר הישן (origin/main)
ברירת מחדל "אריג": יין `#7C2E4D`, קרם `#FAF7F2`, זהב-חום `#96661F`. **אין navy בעיצוב הישן.** כחולים בלבד: `--info:#3E6E8C`/`#E3EEF3`, פלטת ocean `#1F5C66`, slate `#3E5266`/`#9FB4C7`, `--cat-rented-text:#1565c0`, `--btn-light-blue-bg:#eff6ff`.
### 5.2 סקיצה B (ספירת `var()`)
| token | hex | ספירה | תפקיד |
|---|---|---|---|
| `--navy-900` | #0a2242 | 30 | טקסט ראשי (`--ink`), גרדיאנט סרגל/רייל, tooltip, טוסט |
| `--navy` | #0f2c52 | 206 | מסגרות (47 borders), רקעי סרגל/רייל (76 bg), טקסט (164), "בוצע", seg/tab פעילים |
| `--navy-700` | #173c6b | 27 | מצב "תקין", גרדיאנטים |
| `--navy-500` | #2b5a94 | 30 | אייקונים, קישורים משניים |
| `--brand`→navy | #0f2c52 | 38 | step פעיל, seg.on |
| sky-50/100/200/300/400 | #f3f9fe…#7fb8e6 | 35/64/66/63/11 | רקעים, שדות, קווים; עמוד `#dcedfa` |
| gold / gbtn | #c9a227 | 54 / 53 | כפתור ראשי, פוקוס, "עכשיו" |
בסקיצה הכפתורים הסופיים זהב/אפרסק עם טקסט שחור (שורות 785-825); navy = מסגרת, טקסט, סרגל, רייל, "בוצע", אייקון-בתוך-אפרסק, hover.
(design-v2, היסטורי: אפס navy.)
### 5.3 v3 בפועל (שימושי `var()` ב-`app/`+`components/`, ללא הגדרות)
| token | hex | שימושים | הערות |
|---|---|---|---|
| `--v3-navy` | #0f2c52 | 168 (137 components.css, 16 shell/notify, 22 JS עמודים) | |
| `--v3-navy-900` | #0a2242 | 16 | `--v3-ink` |
| `--v3-navy-700` | #173c6b | **2** | כמעט לא בשימוש (בסקיצה 27) |
| `--v3-navy-500` | #2b5a94 | 29 | אייקונים |
| ink / ink-2 / ink-3 | #0a2242/#2f4a6b/#4d6787 | 11/16/47 | |
| sky-50/100/200/300/400 | | 15/40/26/29/7 | |
| gold / 300 / b / d | | 53/31/9/5 | |
| rose 100/200/300/500/700 | | 11/8/6/3/8 | |
| plum | #a83d6c | 20 | |
| peri-100 | #d9dfff | **0** | מיועד לציר-הזמן |
| white | #fff | **107** | קשיח — חוסם dark |
ספריית v3, navy כ: color 97 / background 31 / border 22 (סקיצה 164/76/47).
**מה המשתמש רואה:** בתוך `.v3-page` — טקסט navy-900, מסגרות navy, סרגל navy. מחוץ לו (רקע-גוף, `.content`, דפים לא מומרים, `PopupProvider`, מודלים ישנים) — יין/קרם/חום; וגם בתוך v3: 50 שימושי `var(--primary|-solid|-tint|--accent)` (יין) ב-JS של עמודי-עבודה.
**פער וכיוון:** navy צריך לשמש: טקסט, מסגרות 1px, סרגל, רייל/סיכום, ראש חלונית כהה, טוסט, tooltip, מצב פעיל/בוצע, hover של כפתורי רקע-בהיר. חסרים: רקע `html/body`, גשר `--primary*→--v3-navy*` לקוד ישן, `navy-700` כמצב פעיל משני, וכל הנתיבים הלא-מומרים.

---

## 6. טיפוגרפיה
### 6.1 סקיצה
`'Rubik','Heebo',system-ui,sans-serif` מ-Google Fonts (400/500/600/700); body 16px/1.5, antialiased. גדלים (הופעות): 14×69, 16×29, 15×28, 13×19, 17×11, 12×11, 20×10, 18×7, 24×4, 19×4, 28×3, 22×3, 11×3, 34×2. משקלים: 600×69, 700×41, 500×40, 400×1 (הדגשה = 600/700).
### 6.2 v3 tokens (tokens.css:170-191)
`--v3-font: Rubik, Heebo…`; סולם 12/13/14/15/16/17/18/20/24/28/36/30/34; משקלים 400/500/600/700; lh 1.6/1.3/1.45. תואם (lh גוף 1.6 מול 1.5).
### 6.3 מרונדר בפועל
| רכיב | סקיצה | אמיתי | סיבה |
|---|---|---|---|
| `<button class="v3-btn…">` | 600, 16 (lg 17/600) | **400 / 16, צבע-אב** | F1 |
| `<a class="v3-btn">` | 600 | 600 | אין כלל `a` → כפתורי-קישור ≠ כפתורי-button |
| input/select/textarea/button | Rubik | Assistant | design-overrides:23-30 (F3) |
| טקסט מחוץ ל-`[data-v3]` | 16 Rubik | 15 Assistant (נמדד) | design-system:141, globals:132 |
| h1-h6 בתוך v3 | Rubik 600 | Rubik (תוקן components.css:1376-1381) | — |
| h1-h6 מחוץ | — | Frank Ruhl (serif) `!important` | design-overrides:33 |
### 6.4 טעינת גופן
Rubik רק ב-`@import url(fonts.googleapis…)` בשורה 1 של tokens.css (חוסם-רינדור, בלי preconnect/`next/font`/קובץ מקומי) + 3 `@import`ים נוספים (Assistant/Frank Ruhl/Heebo, globals.css:6) = 4 בקשות חיצוניות; אופליין → Heebo/system-ui ולא Rubik. subset עברי מוגש ע"י Google (לא נבדק חי).
### 6.5 תיקון
(1) `:where([data-v3]) button…{font:inherit}` או `font-family:inherit` בלבד; (2) לבטל כפיית design-overrides בתוך `[data-v3]`/`.v3-dialog`; (3) `html{font:400 16px/1.6 var(--v3-font)}`; (4) `next/font/google` Rubik `subsets:['hebrew','latin']`; (5) רכיב `<Text variant=h1|h2|label|value|caption|num>` (כיום רק מחלקות).

---

## 7. ספריית UI — האם משותפת באמת?
- `app/v3/ui/*` (V3Page, Card, Btn, IconBtn, Chip, Tag, Badge, Field, Row(s), Tabs, Seg, Switch, Tip, Dialog, CodeInput, Stepper, StepNav, Timeline, Table+useSort, Empty, Banner). UI-KIT.md מדויק.
- שימוש: 37 קבצים מייבאים; `<Btn>` 26, `<Card>` 18, `<Dialog>` 16, `<Table>` **4**, `<Stepper|StepNav>` **4**, `V3Page` 25/67.
- **חסר:** Toast/NoticeBar (בנפרד ב-`v3/notify`), Popover/Combobox, BusyOverlay, Text, פרימיטיבי Layout (Stack/Cluster/Grid רק כ-CSS).
- **שכפול חי — 4 kits:** `components/lists/listKit.js` (`useListDialogs`), `components/orders/modern/orderCardDialogs.js` (`useV3Dialogs`), `app/components/v3misc/useAskDialog.js`, `components/ops-v3/OpsKit.js` (`TipBtn`). `alert`→`v3Alert` מוגדר מחדש ב-orders/page, refunds, rentals, orders/[id] בסמנטיקה שונה.
- **הפרות R2:** 252 hex ב-JS של עמודי-עבודה (print/order 65, print/alterations 41, ClipboardDebugger 38, employees/page 36, display-settings 14; הדפסות פטורות לפי Q5; employees/page ו-display-settings = הפרה); 76 `style={{…hex/rgba…}}`; 3 נתיבי ייבוא שונים ל-`enqueueNotice`. components.css עצמו כמעט נקי (8 hex = `#000` במסכות).
- inline הכבדים: ErrorReportButton 115, AIFloatingWidget 60, LoginScreen 51, StatisticsModal 27, SettingQuickPanel 20, PopupProvider 19, PrintWizardModal 14.

---

## 8. איקונים ואנימציה (R12)
קיים: `<Icon name anim loop enter>`, ≈75 שמות→אנימציה, 30 כללי `data-anim`, כיבוד `prefers-reduced-motion`, `--v3-dir`. פערים: (1) אנימציה רק ב-hover/focus של הורה (`button/a/.v3-btn/[data-v3-anim-host]`) — איקוני כותרת-כרטיס/Row/Chip/Empty לא זזים; (2) 422 `<svg className="icon">` ישנים (ErrorReportButton 42, RentalReturnModal 25, AIFloatingWidget 21, ModernRentalsManager 19, HebrewDatePicker 13…); (3) 5 קבצים עם `lucide-react` (AISearchBar, DevEnvBanner, StatisticsModal, print/order, ClipboardDebugger); (4) ספרייט מפוצל (`IconSprite` + `IconSpriteV3` 12 סמלים); (5) אין מירור RTL (F6).

---

## 9. הודעות / טוסט (NOTIFICATIONS-DESIGN)
| דרישה | סטטוס |
|---|---|
| R20 שורת התראה + פס זהב יורד ~15ש' + הערה בפעמון | קיים, מחובר (layout.js:640) |
| קריאות בפועל | ~11 קבצים (alterations, customers/[id], dresses(+[id]), pricelist, employees/[id]+report, orders/new:1371, orders/[id]:970/1290…) |
| חסר | ניתוב `PopupProvider.showAlert`/`window.alert`; `ShiftMessageWatcher` (עדיין `showConfirm`); `LoginScreen:110-118`; ~55 `alert(`, 14 `confirm(` |
| R21 הודעות למטה-שמאל | `V3MessagesToast` מורכב אך ריק; הטוסט הישן למעלה-מרכז חי |
| רכיב Toast ב-UI-KIT | לא קיים |
| ערוצים | 4 מקבילים: `v3Toast`, `alert()`, `useListDialogs.notify`, `enqueueNotice` |

## 10. חלוניות (DIALOG-INVENTORY)
`Dialog` (confirm/code/form/sheet, light/dark, focus-trap, sheet במובייל) תקין ב-16 קבצים. **לא הוחלף:** `PopupProvider` (5 חלוניות — ליבת כל אישור/קוד, בדיוק R19) + `RentalReturnModal` (1108 שורות), `StatisticsModal`, `PrintWizardModal`, `OverdueOrdersModal`, `SettingQuickPanel`, `MessageHistoryButton`, `ErrorReportButton`, `AIFloatingWidget`, `PermissionRowWizard`, `CapacitySearchModal`, `FullEmailListModal`, `SendEmailModal`. `mode="dark"` מפורש ב-2 מקומות; אין מתג כהה/בהיר לפי ערכת נושא.

---

## 11. רספונסיביות
### 11.1 מדידות
| viewport | חי? | תצפית |
|---|---|---|
| 1024 | ✔ | topbar 64, padding-inline 16, לשוניות 14px/pad 10, שעון+שם מוסתרים, אין גלילה אופקית |
| 1440 | ✔ | לשוניות 15px/pad 14, container 1240 → פסי רקע ישן ~100px (F2) |
| 360/768/1920+ | ✘ | מהקוד: ≤767 מגירה (58px); 641–767 = "מובייל" בסרגל אך "דסקטופ" ברכיבי דף (640) — פס מת 127px |
### 11.2 breakpoints — 3 סטים לא-מתואמים
shell: **767, 900, 1040, 1180**, 380, min 768 · רכיבי דף: **640**(×8), **1020**, 420, min 641, max-height 640 · ישן: 768, 640, 900, 901, 980, **min 1700**. אין tokens/מסמך; 10 ערכים שונים.
### 11.3 גודל / מיכל / safe-area / overflow / מגע
- אפס `clamp()` בקבצי v3; h1 28→23 בלבד; `data-text-scale` הישן לא משפיע על `--v3-fs-*`.
- `--v3-container:1240px` קבוע, gutter 24/16, אין tier אולטרה-ווייד (הישן 1680 ב-≥1700 → ב-1920 ~220px רקע ישן בכל צד, ב-2560 ~660px).
- safe-area: 7 `env(safe-area-inset-bottom)` אך `layout.js` בלי `viewport` עם `viewportFit:'cover'` ⇒ 0 בנוץ'/home-bar; טוסט `bottom:88px` קשיח (components.css:971).
- גובה נמוך/landscape: כלל `max-height:640px` יחיד (:914, דיאלוגים); אין `orientation`; סרגל 58 + stepnav sticky + טוסט 88 = >45% גובה בטלפון landscape; `dvh` ב-6 מקומות (חיובי). מטרות מגע 44px (חיובי); אין `pointer:coarse`.
- קיוסק/מגע: לא בתשתית (`kiosk.css` נפרד, 361 שורות).
- overflow: `.v3-page` ללא `overflow-x:clip`; `min-width:0` על `.v3-main` (חיובי); פאנלי סרגל ב-≤767 `position:fixed; inset-inline:8px` (חיובי).
### 11.4 כללים שהתשתית חייבת להגדיר
1. סט breakpoints יחיד (הצעה 480/768/1024/1440/1920) + custom-media/קבועים; כל 10 הנוכחיים ממופים אליו.
2. טיפוגרפיה נוזלית: `--v3-fs-h1: clamp(1.4rem, 1.1rem + 1.2vw, 1.75rem)` וכו'; גוף 16 קבוע; text-scale → `html{font-size:calc(100% * var(--v3-text-scale))}`.
3. מיכל נוזלי: `--v3-container: min(100% - 2*var(--v3-gutter), 1240px)`, tier רחב 1680; gutter `clamp(16px,2.5vw,32px)`.
4. פרימיטיבים כרכיבים: `<Stack>`, `<Cluster>`, `<Grid minItem>`, `<Split rail>`, `<Sticky bottomBar>`.
5. `export const viewport = {width:'device-width', initialScale:1, viewportFit:'cover'}` + `--v3-safe-b` לכל אלמנט צף/דביק.
6. `@media (pointer:coarse)` → 48px; `(max-height:480px)` / landscape-קצר → סרגל 48, בלי sticky כפול.
7. רקע ב-`html,body` (F2).

---

## 12. הפרות RULES.md ברמת התשתית
| כלל | הפרה | ראיה |
|---|---|---|
| R2 | שני מערכי טוקנים; 1,374 inline; 4 kits | §7 |
| R7/R24 | 7 פקדים עודפים בסרגל, לא מקובצים | §3.2 |
| R10 | PopupProvider עדיין עם כיתובים ישנים ("אישור פעולה", "שינויים לא נשמרו") | PopupProvider:26-33 |
| R11 | 73 `title=` על כפתורים מול 93 `<Tip>` | §7 |
| R12 | hover בלבד; 422 ישנים; lucide ×5 | §8 |
| R14 | body 15px מחוץ ל-scope; F1; Assistant בכפתורים | §6 |
| R17 | אין מירור חצים; אליאסים הפוכים | F6 |
| R19 | PopupProvider לא הוחלף; Dialog לא עוקב theme | §10 |
| R20/R21 | חלקי; הטוסט הישן חי | §9 |
| R6 | 25/67 עמודים עם V3Page | §1 |
| ARCHITECTURE "כלל ברזל" | F1/F2/F3 הם באג-רוחבי שלא תוקן בספרייה | §1 |
| R1 | README/SCREEN-MAP עדיין ⬜/`[ ]` בכל השלבים | — |

## 13. סיבת שורש
1. "שני עולמות במקביל": v3 מעל CSS ישן שנשאר טעון, בלי בידוד — כל כלל ישן `!important`/בספציפיות גבוהה מנצח.
2. `V3Page` כ-scope ולא כ-app-shell: רקע/גופן/בסיס על שורש עמוד, לא על `html/body/.main/.content`.
3. בעלות לפי-משפחה בלי שער ספרייה: 4 kits; `PopupProvider` "מחוץ לתחום" של כולם.
4. Q2/Q3 "אושר ברירת מחדל" בלי אישור משתמש — dark ופלטות אישיות נדחו בניגוד לבקשה.
5. `font:inherit` בספציפיות גבוהה; VERIFY-METHOD בדק גיאומטריית RTL ולא computed typography מול הסקיצה.

## 14. סדר תיקוני-יסוד מוצע
**שלב 0 — החלטות:** 0.1 לאשר סקיצה B כמחייבת (design-v2 מיושן); 0.2 אם dark mode ופלטות אישיות חוזרים להיקף (Q2/Q3).
**שלב 1 — בידוד + בסיס (פותח הכל):**
- 1.1 `[data-v3] button{font:inherit;color:inherit}` → `:where()` / `font-family:inherit` (מתקן F1).
- 1.2 רקע+גופן+בסיס על `html, body` (F2, F3-בסיס); הסרת `background-image` ישן.
- 1.3 בידוד CSS ישן: `@layer legacy, v3;` והסרת `!important` של design-overrides:23-34 בתוך `[data-v3]` (זהירות: `!important` הופך סדר layers).
- 1.4 `viewport` export + סט breakpoints יחיד + טוקנים נוזליים (§11.4).
**שלב 2 — tokens + dark (תלוי ב-1):**
- 2.1 החלפת `--v3-white/black` (107) בטוקנים סמנטיים; בלוק dark לכל ~35 משתנים; `Dialog` עוקב `data-theme` (form תמיד בהיר).
- 2.2 גשר `--primary*/--accent*/--bg/--surface/--text*/--border` ישנים → `--v3-*` בתוך `[data-v3]`.
- 2.3 פלטות אישיות: לכתוב `--v3-brand/--v3-accent` מ-`customPalette`, או להכריע קבוע.
**שלב 3 — ספרייה חסרה (תלוי ב-1-2):**
- 3.1 `Toast/NoticeBar`+`useNotify` יחיד ב-`ui/components.js`; ניתוב `PopupProvider.showAlert`/`window.alert` ל-`v3Toast`.
- 3.2 החלפת `PopupProvider` (5 חלוניות) ב-`Dialog` באותה API (`showConfirm/showPrompt/showAuthPrompt`); כהה/בהיר לפי ערכת נושא.
- 3.3 איחוד 4 ה-kits ל-`useDialogs()`/`TipBtn` יחידים.
- 3.4 `Text`, `Stack/Cluster/Grid/Split`, `Popover/Combobox`, `BusyOverlay`.
- 3.5 מירור RTL: `[dir=rtl] .v3-ic--dir{transform:scaleX(-1)}` + שמות סמנטיים `forward/back`; תיקון אליאסים, Banner action, `arrow-end` ב-Login/TopbarSearch.
- 3.6 אנימציית איקונים גם ב-mount/Row/Card head; codemod ל-422 `<svg className=icon>`; הסרת lucide ×5; איחוד ספרייטים.
**שלב 4 — סרגל (תלוי ב-1.1-1.2):**
- 4.1 קיבוץ פקדים ל-5 כבסקיצה (אחורה/קדימה/ריענון נסתרים במסכים צרים; ערכת-נושא + היסטוריית הודעות + דיווח שגיאות → תפריט משתמש/"עוד").
- 4.2 `ErrorReportButton`/`MessageHistoryButton` → `Dialog form`; fallback מותג gold-mark+שם כשאין לוגו.
**שלב 5 — אימות:**
- 5.1 סקריפט computed-style שמשווה ~25 סלקטורים מול הסקיצה (גודל/משקל/גופן/צבע) ב-360/768/1024/1440/1920.
- 5.2 עדכון README/SCREEN-MAP/QUESTIONS (R1).
**תלויות:** 1.1 → הכל; 1.2 → dark (2.1) + רספונסיב; 2.x → 3.2; 3.1 → 3.2; 3.5 → 4.x.

## 15. נספח — קבצים/שורות
- `app/v3/components.css:38` (F1) · `:28` (F2) · `:40` `.v3-page` · `:1005-1092` סרגל · `:1376-1381` תיקון h1-h6 · `:971` טוסט bottom:88px
- `app/design-overrides.css:23-34` (F3) · `app/globals.css:112-150,133,143` · `app/design-system.css:141-142,322,1245`
- `app/v3/tokens.css:170` (`--v3-font`), `:294` (`--v3-container`), `:343` (dark חלוניות בלבד)
- `app/v3/ui/Icon.js:11,19` · `app/components/IconSprite.js:27-28,69` · `app/v3/ui/Feedback.js:26`
- `app/components/PopupProvider.js:199,215,245,265,288,323` · `app/layout.js:1-9` (סדר CSS), `:639-656` (providers)
- `app/components/AppShell.js:220-400`, `app/components/v3-shell.css`
- מסמכים: `docs/redesign-v3/{RULES,ARCHITECTURE,SHELL,UI-KIT,DESIGN-LANGUAGE,DIALOG-INVENTORY,NOTIFICATIONS-DESIGN,QUESTIONS}.md`; סקיצה: `order-card-sketch-B.html` (`.snav` :1234-1344)
