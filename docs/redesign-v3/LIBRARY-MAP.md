# LIBRARY-MAP — ספרייה מרכזית אחת (`app/v3/`)

> תוכנית מבנה, מה קיים בענף `redesign/v3-master-plan` (נבדק ב-`app/v3/**`, commit 00d0e84) ומה נבנה. כפוף ל-`CONSTITUTION.md` (מצוטט כ-`C-x.y`).
> עקרון: **ספרייה אחת, כניסה אחת** — `import { … } from '@/app/v3'`. עמוד לא מייבא קובץ פנימי ולא כותב CSS/מלל/קונפיג משלו.

## 1. מבנה תיקיות מוצע
```
app/v3/
  index.js                 ← ייצוא ציבורי יחיד (ui + overlays + icons + strings + config + patterns)
  tokens/
    primitives.css         ← L0 רמפות
    semantic.css           ← L1 (~40) בהיר בלבד — העמודים בהירים בלבד (D-1)
    overlay.dark.css       ← --v3-ov-* : סט כהה+בהיר לשטחי חלונית צפה בלבד (confirm/code/PIN)
    scale.css              ← טיפוגרפיה, מרווח, רדיוס, elevation, z-index, motion, tap sizes, רוחבי מיכל
    breakpoints.js         ← SM/MD/LG/XL/2XL/3XL + custom-media
    contrast.js            ← בדיקת AA (פלטה כללית אחת קבועה navy/sky/gold — D-8; אין palettes/ ואין deriveDark)
    legacy-bridge.css      ← --primary* → L1 (זמני, נמחק בסוף)
    base.css               ← reset מבודד (@layer), html/body background, scrollbar, dvh, safe-area, focus-ring
    README.md
  ui/                      ← רכיבי בסיס דקים (קיימים + חדשים)
  overlays/                ← LayerManager, Dialog, Sheet, Drawer, Popover, Combobox, Tip, Toast, NoticeBar, Busy, legacyShim
  motion/                  ← presets.css, useReducedMotion, AnimatedNumber, useInView
  icons/                   ← Icon, sprite אחד, aliases.js (סמנטיים + כיוון), anim.css
  strings/                 ← he.js (מילון), keys.js, t()/useStrings, org overrides, README (כללי ניסוח)
  config/                  ← settingsRegistry, OrgConfigProvider, useOrgConfig, profiles/*.json (בדיקות)
  change/                  ← מנוע שינויים (Phase 5; נבנה רק אחרי שהמשתמש מאשר את §ז.6 — D-7)
  history/                 ← HistoryFeed + adapter (קיים)
  patterns/                ← 7 ארכיטיפים + slot-components
  gallery/                 ← *.gallery.js לכל רכיב + מחולל התיעוד
tools/v3-lint/             ← ESLint plugin, stylelint config, סקריפטים (media/tokens/gallery), baseline
app/v3-gallery/            ← route הגלריה החיה (קיים: page.js + Gallery.js)
```

## 2. קיים בענף מול חסר
| אזור | קיים (`app/v3/**`) | חסר / לשינוי |
|---|---|---|
| **tokens** | `tokens.css` (400 שורות): 93 hex + שקיפויות בשם, סולמות type/sp/r/sh/motion/z; בלוק `[data-v3-mode="dark"]` לחלונית בלבד; מוגדר גם על `:root` (דליפה) | פיצול ל-L0/L1/L2; dark רק לשטחי חלונית צפה (`--v3-ov-*`); L1 של העמודים בהיר בלבד; סולם z חדש (§ב.5); breakpoints.js; `base.css` (רקע על html/body, scrollbar, dvh); פלטה כללית אחת (מערכת הפלטות האישית הקיימת נזנחת בעמודי v3; הקוד לא נמחק עכשיו — D-8); הסרת `--v3-white/black` קשיחים; `@layer` לבידוד מה-CSS הישן (בעיה F1: `[data-v3] button{font:inherit}` דורס מחלקות) |
| **components.css** | 1387 שורות, מחלקות `v3-*`; ~10 `@media` עם 420/640/1020/767 | להפריד ל-`ui.css` + `overlays.css`; התאמה לסט breakpoints; מחיקת `.v3-toast` הישן (כפל עם NoticeBar) |
| **ui/** | `Btn Card Chip Tag Badge Field Row Tabs Seg Switch Tip Dialog CodeInput Stepper StepNav Timeline Table useSort Empty Banner V3Page IconBtn` | `Popover`, `Combobox`/`Select`, `DatePicker` (עוטף `HebrewDatePicker`), `Skeleton`, `Pagination`, `FilterBar`, `Range`, `Avatar`, `Money`/`Num` (`<bdi>`), `Tabs.mark`, `Table` כרטיסי-phone, שימוש בפועל ב-`Table/useSort/renderExpanded` (היום אף עמוד לא משתמש) |
| **overlays** | `ui/Dialog.js` (94 שורות; מחסנית מקומית, נעילת גלילה, פוקוס; **`mode` כפרמטר**), `ui/Tip.js`, `notify/*` (`NoticeItem`, store, `V3MessagesToast` שלא מוזן) | **LayerManager** (חדש; מחסנית אחת גלובלית), `Dialog` נגזר-ערכה, `Sheet/Drawer/Popover/Combobox/Busy`, איחוד `notify` → `NoticeBar`+`Toast`, `legacyShim`; הסרת 6 ה-ask-hooks הכפולים |
| **icons** | `ui/Icon.js` (aliases + `ICON_ANIM`), `IconSpriteV3.js` (12 סמלים), `icons.css`; sprite ישן ב-`app/components/IconSprite.js` (62); **תוקן ב-00d0e84:** `next`→שמאלה, `back`→ימינה | sprite מאוחד; `aliases.js` סמנטי + טבלת כיוון; החלפת `lucide-react`/אמוג'י; סמלים `undo/redo/cart` חסרים |
| **motion** | קטעים ב-`components.css`/`icons.css`; `--v3-dur-*`, `--v3-ease*` | `presets.css` מרוכז, `useReducedMotion`, `AnimatedNumber`, חיווט `prefers-reduced-motion` אחיד; מחיקת כניסות opacity |
| **strings** | אין (מלל מפוזר בעמודים). קיים לפרויקט: `LabelsContext` (`getLabel(key, default)`, `/api/settings/labels`) | `strings/he.js` + `t()` + override לפי ארגון מעל `LabelsContext`; מיגרציה הדרגתית |
| **config** | אין שכבה. עמודים קוראים `/api/settings` ו-`settings.find(s=>s.key===…)` ישירות | `settingsRegistry`, `OrgConfigProvider`, `useOrgConfig`, פרופילי בדיקה |
| **history** | `history/HistoryFeed.js` (277), `adapter.js` (721), `history.css` — **בשימוש רק ב-`HistoryViewer`** | חיבור לטאב היסטוריה בכרטיסי פרט (Phase 3) |
| **change** | אין (`getChangeRows` טקסטואלי בכרטיס הזמנה) | Phase 5 בלבד |
| **patterns** | אין (כל עמוד בונה פריסה משלו) | 7 ארכיטיפים (Phase 2 סטטי → Phase 3–4 רכיבים) |
| **gallery** | `app/v3-gallery/{page,Gallery}.js` ידני, לוח בדיקת RTL | הפיכה למחולל אוטומטי (§8) |
| **lint** | `eslint.config.mjs` בלבד (next); אין stylelint | `tools/v3-lint/` (CONSTITUTION §ח.1) |

## 3. מוסכמות שמות
- **CSS**: קידומת `v3-`; BEM קל `v3-block__el--mod`; מצבים `is-*`/`[data-state]`; tokens `--v3-<קבוצה>-<שם>`; משתנה דינמי בעמוד רק `--v3-x`.
- **JS**: רכיבים PascalCase, קובץ אחד לרכיב (`Btn.js`); hooks `useXxx`; עזרים camelCase; אין default-export מעורב — ייצוא בשם דרך `index.js`.
- **מפתחות מחרוזת**: `<אזור>.<רכיב/מסך>.<תפקיד>` באנגלית קטנה (`order.save.success.title`, `common.action.cancel`); הערך בעברית; פרמטרים `{name}`; ריבוי `_one/_other`. אזורים: `common`, `nav`, `order`, `customer`, `dress`, `rental`, `payment`, `dialog`, `notice`, `error`, `tip`.
- **מפתחות config**: כשם `SystemSetting.key` הקיים בדיוק (לא ממציאים שמות).
- **גלריה**: `<Component>.gallery.js` ליד הרכיב; `export const meta = {name, archetype?, states:[…]}`.
- **קבצי דוח/חוזה עמוד**: `contracts/<page>.md`, ספק: `contracts/<page>.contract.json`; כרטיס קבלה `reports/scorecard-<page>.md`.

## 4. LayerManager — API מוצע (פרטי §ד בחוקה)
```js
// app/v3/overlays/LayerManager.js  (מורכב ב-layout.js פעם אחת)
const { open, close, confirm, prompt, code, notify, busy } = useLayers();
open({ type: 'form'|'confirm'|'code'|'sheet'|'drawer'|'bottom'|'busy',
       size: 'S'|'M'|'L'|'full', title, sub, icon, actions, dismiss: { esc, scrim },
       render: (ctx) => <Body {...ctx} />  // ctx: { close(result), setBusy(b), setDirty(b) }
     }) → Promise<result>
// עוזרים: confirm({title, sub, danger, confirmLabel}) → boolean | 'alt' (3-דרכי)
//          code({approvers, purpose}) → {employeeId, ok}   (מחליף customAuthPrompt; PIN מאומת ב-/api/auth/verify-pin כמו היום)
// גם ללא React:  import { layers } from '@/app/v3/overlays'  (singleton) — לשימוש ה-shim ואירועים
```
- מחסנית וניהול z/`inert`/scroll-lock/פוקוס — בתוך ה-manager בלבד; `Dialog` הצהרתי נשאר כעטיפה שרושמת שכבה.
- `mode` נגזר מ-`type` + ערכת הנושא (C-4.5); form = light.
- `Toast`/`NoticeBar`/`Tip`/`Popover` = שכבות לא-מודאליות באותו root (`#v3-layer-root`) עם z מהסולם.

## 5. שכבת config וארגונים (C-9.x)
```
app/v3/config/
  settingsRegistry.js   ← { key: { type:'flag|num|text|list|json', default, meaning, affects:['A2.rail','wizard.delivery'] } } — מקור אחד
  OrgConfigProvider.js  ← טוען /api/settings (משותף ל-apiCache/pageCache הקיימים), מנרמל לפי registry, מחיל default לשורה חסרה/ריקה
  useOrgConfig.js       ← flag(k) num(k) text(k) list(k) json(k), ready, isKnown(k)
  profiles/org1.json    ← ערכי הגדרות לא-סודיים לבדיקות (נבנה מ-SELECT קריאה-בלבד, ללא סודות)
  profiles/org2.json
  profiles/minimal.json ← הכול חסר;  profiles/extreme.json ← הכול דלוק + מחרוזות ארוכות
```
- **הכלל:** אף רכיב לא קורא `/api/settings` ולא מחפש מפתח לפי מחרוזת; רק `useOrgConfig` ומפתחות רשומים (lint #12).
- **מלל לפי ארגון:** `strings/` משלב שלוש שכבות לפי עדיפות: override ארגוני מ-`LabelsContext` (`/api/settings/labels`) ← מילון v3 (`he.js`) ← מפתח חסר = שגיאת build/גלריה.
- **`settingsRegistry` נבנה מתוך** רשימת ההבדלים ב-CONSTITUTION §ט.3 ומחיפוש מלא של `settings.find`/`getSetting` בקוד; כל מפתח חדש = רשומה + שורה במטריצה + seed עם host-check.
- **לא בשכבה זו:** סודות (`NEDARIM_API_PASSWORD`, מסוף/טוקן) — נשארים בשרת/env; ה-UI מקבל רק "ספק זמין: כן/לא".
- הגלריה טוענת רכיבים תחת `<OrgConfigProvider profile="org2">` עם מתג פרופיל (§8).

## 6. מנוע שינויים (Phase 5, מותנה באישור המדיניות המוצעת ב-CONSTITUTION §ז.6 — D-7 PROPOSED-AWAITING-REVIEW)
```
app/v3/change/
  changeSchema.js   ← הגדרת "סוג שינוי": kind, entity, label(t-key), reversibility: R0|R1|R2|R3, dependsOn, summarize(before,after)
  useChangeSet.js   ← { changes, record, undo(id), redo(id), discardAll, commit, dirty }
  ChangeRail.js     ← רשימה ברייל: שורה, אייקון, טקסט, סכום השפעה, undo/redo פר-שורה, "בטל הכול"
  adapters/orderCard.js ← מחבר ל-onOrderChange/onItemsChange/... הקיימים (בלי לשנות payload)
```
תלות קשיחה: **לא משנים** מבנה שמירה; ה-adapter עוטף. שילוב עם `orderDrafts` (localStorage) — מיזוג, לא כפל.

## 7. Shim תאימות לקריאות ישנות (`overlays/legacyShim.js`)
מטרה: עמוד לא-מומר שקורא לחלוניות הישנות מקבל **את החלונית החדשה** בלי לשנות את הקריאה. מחליף את ה-UI של `app/components/PopupProvider.js` (חתימות **זהות**):
| קריאה ישנה | מנותב אל | הערה |
|---|---|---|
| `window.customConfirm(msg)` → `Promise<boolean>` | `layers.confirm` | JSX בהודעה נתמך |
| `window.customThreeWayConfirm(...)` | `layers.confirm({alt})` | 3 כפתורים |
| `window.customPrompt(msg, def)` → `Promise<string\|null>` | `layers.open({type:'form'})` | **light בלבד** (קלט) |
| `window.customAuthPrompt(...)` → אישור מנהל+PIN | `layers.code` | אימות ב-`/api/auth/verify-pin` ללא שינוי |
| `window.alert(msg)` (מוחלף היום ב-PopupProvider) | `v3Toast` (הודעה שמאל-תחתון) | `alert()` הישן חוסם; הדריסה (כבר קיימת היום ב-PopupProvider) היא fire-and-forget: הקוד שאחריה רץ מיד |
| `showAlert/showConfirm/…` מ-`usePopup()` | אותם עוזרים | ה-Provider הישן נשאר מעטפת דקה |
**אזהרה מפורשת — מגבלה שאין מנוס ממנה:** `window.confirm()` ו-`window.prompt()` המקוריים של הדפדפן **סינכרוניים** (מחזירים ערך מיד וחוסמים את ה-thread); חלונית חדשה היא אסינכרונית. **לכן אי אפשר** "להחליף אותם ב-shim" בלי לשנות את הקוד הקורא (`if (confirm(..)) …` → `if (await layers.confirm(..)) …`, והפונקציה עוטפת הופכת `async`). דריסת `window.confirm = customConfirm` (הצעה #7 ב-IDEAS-LOG) שוברת כל קורא שמסתמך על ערך מיידי (מחזירה Promise שהוא תמיד truthy → **אישור אוטומטי!**) — **אסור**. הפתרון: (1) רשימה סגורה של קריאות native (7 `confirm` ב-admin, נפילות `customConfirm || window.confirm`, `RentalReturnModal:469/511`, `window.prompt` ב-`ModernItemsManager:692`, `alert()` ב-`LoginScreen:116`), (2) המרה ידנית לכל אחת ל-`await`, (3) כלל lint #2 שחוסם חדשות, (4) גם `window.alert` הוא סינכרוני-חוסם: ניתן לדרוס אותו רק כ-fire-and-forget (כפי שנעשה היום ב-PopupProvider) — הקוד שאחריו ירוץ לפני שהמשתמש קרא; זה שינוי התנהגות מתועד, ולכן קריאות שתלויות בעצירה (למשל `alert` ואז `router.push`/`location.href`) חייבות המרה ל-Toast/Confirm מפורשים.
כלל: ה-shim הוא גשר זמני; מחיקתו = סוף Phase 5, כשאין `customConfirm`/`usePopup` בקוד.

## 8. גלריה חיה כתיעוד
- `/v3-gallery` נשאר route (מוגן login; פיתוח/preview בלבד). **הגלריה נוצרת מהרכיבים**, לא נכתבת ידנית: כל `*.gallery.js` מייצא `meta` + מצבים; `gallery/build.mjs` סורק ומרכיב דפים אוטומטית (אינדקס לפי קבוצה: tokens / ui / overlays / motion / icons / strings / patterns).
- לכל רכיב: props מתוך JSDoc (`react-docgen`), כל המצבים (default/hover/focus/disabled/loading/error/empty/long/many/few/RTL/reduced-motion; dark — רק לרכיבי חלונית confirm/code/PIN), snippet לשימוש, כלל חוקה רלוונטי, קישור ל-lint.
- **סרגלי בקרה בגלריה:** מתג light/dark לחלוניות confirm/code/PIN בלבד, פרופיל org (`org1/org2/minimal/extreme`), רוחב (360/768/1024/1440/1920), `prefers-reduced-motion`, ולוח בדיקת RTL (`getBoundingClientRect` + גליפי חצים).
- דף tokens נוצר מ-`tokens/**` (דגימות צבע כולל ניגודיות AA), דף icons מה-sprite (כולל אנימציה והכיוון), דף strings מ-`he.js` (חיפוש + מי משתמש).
- הגלריה = מקור צילומי הקבלה (S6) ומטרת הבדיקות (#16, #17, #18). רכיב בלי `gallery` = לא קיים (lint #16).
- כלל: תיעוד .md מפנה לגלריה ולא משכפל טבלאות ערכים (טבלאות מפתח נוצרות אוטומטית) — כדי שלא יתיישן (R1).

## 9. סדר בנייה (מתחבר ל-`MASTER-PLAN.md`)
Phase 1 (עם הפיילוט): `tokens/` + `base.css` + `overlay.dark.css` (כהה לחלוניות בלבד) + `overlays/{LayerManager,Dialog,Tip,NoticeBar,Toast}` + `icons/` + `strings/` בסיס + `config/` בסיס + lint 1–10. Phase 2: `patterns/` סטטי. Phase 3–4: השלמת `ui/`+`overlays/` לפי צורך העמודים. Phase 5: shim + `change/`.
