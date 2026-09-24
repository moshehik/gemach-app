# מלאי איקונים — כל האתר מחוץ ל-/admin ו-/management

> נוצר ב-2026-09-24 מענף `redesign/site-v3-2026-09-24`. ניתוח קריאה-בלבד. תומך בכלל R12 (כל איקון מונפש).
> היקף הסריקה: קבצי JS ב-`app/**` (ללא `admin`, `management`, `api`, `design-preview`) וב-`components/**` שמנוהלים ב-git — כ-149 קבצים.
> "קבצים" = מספר קבצים שמשתמשים באיקון; "מופעים" = סה"כ הפניות.

## 1. סיכום מקורות האיקונים

| מקור | היקף | הערה |
|---|---|---|
| ספרייט `app/components/IconSprite.js` (`<svg class="icon"><use href="#i-..."/>`) | 62 סמלים מוגדרים, ~1,020 שימושים ב-~70 קבצים | המקור הקנוני (העתק של `scratch/design-v2/assets/icons.svg`). סגנון: קו 1.75, `stroke: currentColor`, ללא מילוי. מחלקת `.icon` ב-`app/design-system.css:158` |
| `lucide-react` | 8 קבצים, 24 שמות (סעיף 4) | חבילה שנייה מחוץ לספרייט — עובי קו 2 |
| `<svg>` inline עם path משלו | 10 בלוקים ב-7 קבצים (סעיף 5) | חריגים מהספרייט |
| אמוג'י / תווי Unicode כאיקון | ~10 מקומות (סעיף 6) | להחלפה |
| ספריות אחרות (react-icons, heroicons, FontAwesome, MUI) | אין | — |
| אנימציה לאיקונים היום | **אין** — אין `@keyframes` ייעודי לאיקונים; `prefers-reduced-motion` קיים ב-`design-system.css` (5 מופעים) ולא ב-`globals.css` | R12 דורש ספריית אנימציות מרכזית (סעיף 3) |

## 2. טבלת איקוני הספרייט (לפי שכיחות)

שם v3 מוצע: קידומת `ic-` (מיגרציה: `i-x` → `ic-close`, ניתן לבצע ב-codemod).

| איקון (id) | משמעות | קבצים | מופעים | שם v3 מוצע | מיקרו-אנימציה מוצעת |
|---|---|---|---|---|---|
| i-x | סגירה / ביטול / הסרה | 45 | 92 | ic-close | `spin90` בריחוף; בלחיצה `pop` |
| i-check | אישור / הצלחה / נבחר | 40 | 64 | ic-check | `draw` — ציור הסימון (stroke-dashoffset) |
| i-alert-circle | שגיאה / תשומת לב | 30 | 44 | ic-alert | `shake` קצר; בשגיאה `pulse` אדום |
| i-check-circle | הצלחה / הושלם | 27 | 38 | ic-success | `draw` לסימון + `pop` לעיגול |
| i-alert-tri | אזהרה | 27 | 42 | ic-warning | `wiggle` עדין |
| i-refresh | רענון / החלפה / נסה שוב | 26 | 37 | ic-refresh | `spin` 360° בלחיצה; רציף בזמן טעינה |
| i-search | חיפוש | 24 | 49 | ic-search | `tilt` של העדשה בפוקוס השדה |
| i-chevron-start | חץ הקודם / חזרה | 23 | 34 | ic-chevron-back | `nudge` בכיוון החץ בריחוף |
| i-calendar | תאריך / לוח | 20 | 34 | ic-calendar | `flip` — דף יורד |
| i-plus | הוספה | 20 | 28 | ic-add | `spin90` + `pop` |
| i-chevron-end | חץ הבא / קדימה | 19 | 20 | ic-chevron-next | `nudge` |
| i-clock | שעה / משך / המתנה | 18 | 23 | ic-clock | `tick` — מחוגים מסתובבים (רציף בזמן המתנה) |
| i-user | לקוחה / משתמש / עובד | 18 | 22 | ic-user | `pop` |
| i-link | קישור | 18 | 23 | ic-link | `link-snap` — שתי חוליות מתחברות |
| i-trash | מחיקה | 18 | 26 | ic-delete | `lid-lift` — מכסה נפתח + `shake` |
| i-mail | דוא"ל / שליחה | 17 | 25 | ic-mail | `fly` — מעטפה קופצת |
| i-bag | הזמנה / שקית | 16 | 23 | ic-order | `bounce` |
| i-tag | תווית / מחיר / קטגוריה | 16 | 22 | ic-tag | `swing` — נדנוד על החוט |
| i-info | מידע | 15 | 20 | ic-info | `pulse` |
| i-history | היסטוריה / שינויים | 15 | 17 | ic-history | `rewind` — סיבוב נגדי 45° |
| i-list | רשימה / פריטים | 14 | 21 | ic-list | `stagger` — שורות נכנסות בזו אחר זו |
| i-file | קובץ / מסמך | 14 | 15 | ic-file | `pop` |
| i-box | פריט / מלאי / חבילה | 14 | 24 | ic-box | `bounce` |
| i-x-circle | כישלון / שגיאה סופית | 14 | 15 | ic-error | `shake` |
| i-activity | פעילות / סטטוס | 13 | 24 | ic-activity | `draw` — קו הדופק רץ |
| i-arrow-end | מעבר / "הבא" / פעולה ראשית | 13 | 14 | ic-arrow | `nudge` |
| i-edit | עריכה | 13 | 21 | ic-edit | `write` — נטייה קלה |
| i-printer | הדפסה | 12 | 18 | ic-print | `feed` — דף יוצא |
| i-lock | נעילה / הרשאה | 12 | 28 | ic-lock | `latch` — הבריח נסגר |
| i-phone | טלפון | 11 | 15 | ic-phone | `ring` — רטט |
| i-chevron-down | פתיחה / קיפול | 11 | 13 | ic-chevron-down | `flip180` בפתיחה |
| i-star | מועדף / חשוב | 10 | 30 | ic-star | `pop` + `spin` קצר, מילוי בבחירה |
| i-card | תשלום באשראי | 10 | 12 | ic-card | `swipe` |
| i-coin | מטבע / סכום | 9 | 15 | ic-coin | `flip-coin` (סיבוב Y) |
| i-pin | נעיצה / מיקום | 8 | 8 | ic-pin | `drop` |
| i-scissors | תיקון / התאמה (שמלות) | 8 | 14 | ic-alteration | `snip` — להבים נסגרות |
| i-wallet | ארנק / זיכוי | 8 | 8 | ic-wallet | `open` |
| i-download | הורדה / ייצוא | 8 | 11 | ic-download | `drop-arrow` |
| i-message | הודעה | 7 | 9 | ic-message | `pop` — בועה מתנפחת |
| i-shield | הגנה / הרשאות | 7 | 11 | ic-shield | `pulse` |
| i-sort | מיון | 7 | 7 | ic-sort | `swap` |
| i-grid | תצוגת כרטיסים / דשבורד | 6 | 10 | ic-grid | `stagger` |
| i-settings | הגדרות | 6 | 6 | ic-settings | `spin` איטי בריחוף |
| i-upload | העלאה | 6 | 6 | ic-upload | `rise-arrow` |
| i-home | דף הבית | 6 | 7 | ic-home | `bounce` |
| i-truck | משלוח / איסוף / החזרה | 5 | 6 | ic-delivery | `drive` — נוסע קדימה ונעצר |
| i-users | לקוחות / אנשים | 5 | 6 | ic-users | `pop` מדורג |
| i-eye | הצגה / צפייה | 5 | 6 | ic-view | `blink` |
| i-id | תעודה / מזהה | 5 | 5 | ic-id | `flip` |
| i-expand | הרחבה / מסך מלא | 4 | 5 | ic-expand | `expand` — חיצים מתרחקים |
| i-copy | העתקה | 4 | 4 | ic-copy | `stack`, אחר כך `draw` ✓ |
| i-user-check | אימות / נוכחות | 4 | 4 | ic-user-verified | `draw` לסימון |
| i-logout | יציאה | 4 | 5 | ic-logout | `nudge` החוצה |
| i-receipt | קבלה | 4 | 6 | ic-receipt | `feed` |
| i-camera | צילום | 3 | 3 | ic-camera | `flash` |
| i-folder | תיקייה | 3 | 5 | ic-folder | `open` |
| i-more | עוד פעולות | 2 | 2 | ic-more | `bounce` מדורג של הנקודות |
| i-mic | הקלטה | 2 | 2 | ic-mic | `pulse` בזמן הקלטה |
| i-thumbtack | הצמדה (סרגל צד) | 2 | 2 | ic-pin-fixed | `drop` |
| i-menu | תפריט | 2 | 2 | ic-menu | `morph` המבורגר→X |
| i-archive | ארכיון | 2 | 2 | ic-archive | `drop-in` |
| i-bell | התראות | 2 | 2 | ic-bell | `ring`; נקודה `pulse` להתראה חדשה |
| i-database | מסד נתונים | 2 | 2 | ic-database | `pulse` |
| i-external-link | פתיחה בחלון חדש | 2 | 2 | ic-external | `nudge` באלכסון |
| i-image | תמונה | 2 | 2 | ic-image | `pop` |
| i-category | קטגוריה | 2 | 2 | ic-category | `stagger` |
| i-play | הפעלה | 1 | 1 | ic-play | `pop` |
| i-unlock | שחרור נעילה | 1 | 1 | ic-unlock | `latch` הפוך |

**באג:** `i-unlock` בשימוש (`components/orders/modern/ModernItemsManager.js:979`) אך **לא מוגדר** בספרייט — האיקון לא מצויר. יש להוסיף אותו.
`i-name` מופיע בהערות בלבד (לא באג).

## 3. אנימציות — הצעה מרכזית (R12)

- קובץ אחד `app/v3/icon-motion.css` (או בתוך `tokens.css`) עם `@keyframes` לכל שם בטבלה + `.icon[data-anim="draw"]` וכד'. הפעלה בריחוף/פוקוס/מצב (`aria-busy`, `.is-active`), לא רצף מתמיד — למעט `spin`/`tick`/`pulse` בזמן טעינה/המתנה.
- `@media (prefers-reduced-motion: reduce)` מכבה הכול (מצב סופי סטטי).
- `draw` דורש `pathLength="1"` בסמלים. אנימציות כיוון (`nudge`, `chevron-*`) חייבות להתהפך ב-RTL (`[dir=rtl]` / `inset-inline`, R17).
- מומלץ רכיב `<Icon name="ic-..." anim="..."/>` שעוטף `<use>`; החלפת ~1,020 שימושים תיעשה ב-codemod, לא ידנית.
- איקוני הדפסה (`app/print/**`) — סטטיים בכוונה.

## 4. `lucide-react` (מחוץ לספרייט — להעביר לספרייט)

| קובץ | איקונים | מקביל בספרייט | הערה |
|---|---|---|---|
| `app/components/AISearchBar.js` | Search, Sparkles, X, BarChart3, Loader2 | i-search, חסר, i-x, חסר, חסר | חסרים: sparkles (AI), chart, loader |
| `app/components/StatisticsModal.js` | X, BarChart3, Send, MessageSquare | i-x, חסר, חסר, i-message | חסרים: chart, send |
| `app/components/DevEnvBanner.js` | Database, Link, Copy, Check, Server, FlaskConical, ChevronDown | i-database, i-link, i-copy, i-check, חסר, חסר, i-chevron-down | חסרים: server, flask. באנר מפתחים — ייתכן שיישאר מחוץ ל-v3 |
| `app/components/OfflineIndicator.js` | WifiOff | חסר | חסר: wifi-off |
| `app/components/ThemeToggle.js` | Sun, Moon | חסר | חסרים: sun, moon (אנימציית `rotate`/`swap`) |
| `app/print/order/page.js` | Shirt, Scissors, Ruler, Check | i-scissors, i-check | חסרים: shirt/dress, ruler (הדפסה — סטטי) |
| `components/ClipboardDebugger.js` | RefreshCw | i-refresh | כלי דיבוג |
| `components/orders/ActiveEmployeesModal.js` | X, Users, User, Clock, AlertCircle | i-x, i-users, i-user, i-clock, i-alert-circle | כפילות מלאה עם הספרייט |

סה"כ 24 שמות; כ-13 כפילות ישירה עם הספרייט וכ-10 סמלים חסרים. בעקבות ההעברה אפשר להסיר את `lucide-react` (`^1.23.0`) מ-`package.json`.

## 5. `<svg>` inline מחוץ לספרייט (10 בלוקים)

| קובץ | מה | תחליף בספרייט |
|---|---|---|
| `app/components/LoginScreen.js` | X קטן (`M3 3L9 9M9 3L3 9`) | i-x |
| `components/CapacitySearchModal.js` | אותו X קטן | i-x |
| `components/CustomerSelector.js` | X (`M1 1L11 11M11 1L1 11`) | i-x |
| `components/orders/OrderModelSelector.js` | X (`M18 6L6 18`) | i-x |
| `app/customer-interface/page.js` | מטוס נייר "שלח" (`M4 12l16-8-6 16-3-6z`) | חסר — להוסיף `ic-send` (אנימציית `fly`) |
| `components/ClipboardDebugger.js` | 4 בלוקים: העתקה, גלובוס, עיגול, קו | i-copy; השאר כלי דיבוג |

ארבע גרסאות X בגדלי viewBox שונים (12/14/24) — כולן להחליף ב-`ic-close`.

## 6. אמוג'י / תווי Unicode כאיקון — להחלפה

| מיקום | תו | שימוש | החלפה מוצעת |
|---|---|---|---|
| `app/punch-clock/page.js:82` | ✅ (2) | הודעת הצלחת כניסה/יציאה | `ic-success` + `draw` |
| `app/print/alterations/page.js:682` | ✔ | סימון "בוצע" בהדפסה | `ic-check` (סטטי) |
| `components/ClipboardDebugger.js:308,352,402` | 🔍 📦 ✕ | כותרות וסגירה בכלי דיבוג | `ic-search`, `ic-box`, `ic-close` |
| `app/components/ErrorReportButton.js:970,1225` | × כטקסט | כפתור סגירה/הסרה | `ic-close` |
| `app/components/AIFloatingWidget.js:695` | × כטקסט | הסרת תמונה ממתינה | `ic-close` |
| `app/orders/[id]/page.js:734`, `app/orders/new/page.js:806,1321` | 💡 בתוך מחרוזת | רמז בהודעת שגיאת קיבולת (טקסט ב-alert) | `ic-idea` (חסר) — דורש מעבר מ-alert טקסטואלי לרכיב חלון |
| `app/components/ErrorReportButton.js:15` | 🤖 | כותרת קבועה בדיווח (נתון שנשלח לשרת) | **לא להחליף** — שינוי ישבור זיהוי/סינון |
| `PermissionRowWizard.js`, `SettingQuickPanel.js`, `display-settings/page.js`, `DesignPrefsSync.js` ועוד (9 קבצים, ~19 מופעים) | → | חיצי טקסט "ישן → חדש" | `ic-arrow`; ב-RTL חייב להתהפך |
| `HebrewDateRangePicker.js`, `HistoryViewer.js`, `modern/ChangesChips.js` ועוד (5 קבצים, 6 מופעים) | ← | חיצי טקסט | כנ"ל |
| `LoginScreen.js`, `app/page.js`, `customer-interface/page.js` | • | תבליט / הסתרת סיסמה | להשאיר — טקסט, לא איקון |

אמוג'י אמיתיים בממשק: 5 מקומות בלבד — האתר כמעט נקי.

## 7. כפילויות וחוסר עקביות

1. **pin vs thumbtack** (`i-pin` 8 קבצים, `i-thumbtack` 2): שני איקוני נעיצה. `AppShell` משתמש ב-thumbtack לסרגל צד (עם `fill` כשמוצמד, `design-system.css:230`). לאחד ל-`ic-pin` ולהוסיף `ic-map-pin` נפרד אם צריך מיקום.
2. **חמישה איקוני סטטוס** (alert-circle, alert-tri, info, check-circle, x-circle): נבדלים רק בצורה, ומתחלפים ללא עקביות (`i-alert-circle` 44 מופעים, `i-alert-tri` 42). להגדיר סט מתועד: `ic-info`, `ic-success`, `ic-warning` (משולש), `ic-alert` (עיגול, שגיאה קלה), `ic-error` (x-circle, כישלון).
3. **i-x מול i-x-circle**: `ic-close` בלי עיגול לסגירה; `ic-error` לסטטוס.
4. **i-chevron-* מול i-arrow-end**: arrow-end משמש גם ככפתור "המשך" וגם כחץ טקסט. `ic-arrow` לפעולה, `ic-chevron-*` לניווט/פתיחה.
5. **i-grid / i-category / i-list**: grid ו-category דומים; category בשני מקומות בלבד — לבחון איחוד.
6. **משפחת i-user / users / user-check / id**: להוסיף `ic-customer` אם רוצים להבדיל בין לקוחה לעובד.
7. **i-refresh** משמש לרענון, להחלפה ולנסה-שוב (26 קבצים) — לפצל `ic-swap` להחלפת שמלה.
8. **איקון סגירה בכ-7 וריאנטים**: ספרייט, 4 inline, טקסט `×`/`✕`, ו-lucide `X` (3 קבצים). הכול ל-`ic-close`.
9. **lucide-react** משכפל כ-13 איקונים קיימים בעובי קו שונה (2 מול 1.75).
10. **גדלים ידניים**: `style={{ width: '11px', height: '11px' }}` על `.icon` (למשל `ModernItemsManager.js:979`); להגדיר `.icon-xs/.icon-sm/.icon-md/.icon-lg` בטוקנים.
11. **גודל לפי הקשר ב-CSS**: `design-system.css` מגדיר גודל בנפרד לכל הקשר (`.nav-link .icon` 17px, `.crumb .icon` 13px וכו') — מקשה על אנימציה אחידה; מעבר ל-`--icon-size` אחד.

## 8. סמלים חסרים להוספה

`ic-send`, `ic-sparkles`, `ic-chart`, `ic-loader`, `ic-wifi-off`, `ic-sun`, `ic-moon`, `ic-shirt`, `ic-ruler`, `ic-server`, `ic-flask`, `ic-idea`, `ic-swap`, `ic-map-pin` (אופציונלי), והגדרת `ic-unlock` (כיום שבור).

## 9. שיטת הספירה

סקריפט Node חד-פעמי (לא נשמר ב-repo) סרק את `git ls-files app components` ללא `admin|management|api|design-preview`: זיהה `href="#i-*"`, יבוא `lucide-react`, בלוקי `<svg>` עם path שאינו `<use>`, ותווי אמוג'י/סימנים. הספירה כוללת גם מחרוזות `'i-...'` מחוץ ל-JSX; סטייה של ±2 אפשרית. ההמלצות על אנימציות הן הצעה — לא נבדקו בדפדפן.
