# ספריית רכיבי UI של v3

ייבוא יחיד: `import { V3Page, Card, Btn, ... } from '@/app/v3/ui/components'` (איקונים נשארים ב-`ui/index.js`).
כל הרכיבים עוטפים מחלקות `v3-*` מ-`components.css`; אין צבעים/גדלים קשיחים (R2). גלריה חיה (פיתוח בלבד): `/v3-gallery`.
מחלקות שהוספנו ל-`components.css` מסומנות `/* fix by ui-agent */` (danger, req, sr, sheet, th-btn, sticky, stepnav ועוד).

| רכיב | props עיקריים |
|---|---|
| `V3Page` | `page` (ברירת מחדל true = מיכל `v3-page`), `sprite` (טוען IconSpriteV3), `as`. מוסיף `data-v3`, `dir=rtl`, טוען tokens+components. |
| `Card` | `icon`, `title`, `tip` (ⓘ ליד הכותרת), `actions` (בקצה הכותרת), `variant` cust/info/quiet, `level` (h2 ברירת מחדל), `as`. |
| `Btn` | `variant` primary/secondary/quiet/danger/on-dark · `size` sm/md/lg · `icon`/`iconEnd` (שם איקון) · `loading` (מנוטרל + ספינר + aria-busy) · `block` · `round` · `href` (הופך ל-`<a>`). |
| `IconBtn` | `icon`, `label` (חובה, aria-label) + props של Btn. |
| `Chip` | `variant` info/done/gold/attn · `icon` · `onClick` (הופך לכפתור). |
| `Tag` / `Badge` | Tag: soft/done/attn · Badge: navy/gold/neutral, `large`. |
| `Field` | `label`, `hint`, `error` (role=alert), `required` (כוכבית + required), `tip`, `as` input/select/textarea; או `children` = קלט יחיד (מקבל id/aria-describedby/aria-invalid/`v3-input`). שאר ה-props עוברים לקלט. |
| `Row` / `Rows` | R15: `label`, `icon`, `missing` (+`missingText`), `tip`; ערך = children. |
| `Tabs` | `items[{key,label,icon,count}]`, `value`, `onChange`, `label`. role=tablist, ניווט חצים לפי כיוון הדף (RTL: שמאלה = הבא), Home/End. |
| `Seg` | `options[{value,label,icon}]`, `value`, `onChange`, `label` (aria-pressed). |
| `Switch` | `checked`, `onChange(bool)`, `label`, `disabled` (role=switch). |
| `Tip` | `<Tip>הסבר</Tip>` = כפתור ⓘ; `<Tip content="..."><עוגן/></Tip>` = עוגן מותאם (חייב לקבל ref). ריחוף עכבר / מיקוד / מגע (החלפה). Esc ולחיצה בחוץ סוגרים. מיקום: מתחת לעוגן, מתהפך למעלה, מוצמד לחלון. `role=tooltip` + `aria-describedby`. `label` = שם נגיש לכפתור. |
| `Dialog` | `open`, `onClose`, `variant` confirm/code/form/sheet, `mode` light/dark (form = תמיד בהיר; sheet כהה רק בלי קלט), `title`, `sub`, `icon` (+`badgeKind`), `actions` (confirm/code/sheet: טור; form: שורה), `closeOnScrim`, `nested` (z גבוה), `initialFocus` (selector). portal, aria-modal, לכידת פוקוס, Esc (העליונה בלבד), נעילת גלילה, החזרת פוקוס, גיליון תחתון במובייל. `data-autofocus` על אלמנט מקבל פוקוס ראשוני. |
| `CodeInput` | `length`, `value`, `onChange(str)`, `state` bad/good, `autoFocus`. הדבקה וקידום אוטומטי. |
| `Stepper` | `steps[{key,label,value,icon,locked,lockedReason}]`, `current` (אינדקס), `onStep(i)`, `showAnchor` ("שלב X מתוך N" + פס). צומת נעול = ⓘ עם הסיבה (לא alert). `aria-current="step"`. |
| `StepNav` | `onBack`, `onNext`, `backLabel`, `nextLabel`, `nextDisabled`, `nextTip`, `nextLoading`. המשך (ראשי) בתחילת שורה, חזרה בסוף; דביק במובייל. |
| `Timeline` | `events[{icon,title,sub,time}]` — יומן אנכי. |
| `Table` + `useSort` | `columns[{key,header,render,sortable,sortValue,num}]`, `rows`, `rowKey`, `sort`/`onSort` (מ-`useSort(rows,columns,initial)`), `sticky`, `renderExpanded(row)` (שורה מורחבת, R16), `caption`. aria-sort על הכותרת. |
| `Empty` | `icon`, `title`, `text`, `action`. |
| `Banner` | `kind` info/warning/success/alert, `title`, `text`, `action{label,onClick}`, `onClose`. (באנר בשורה; הבאנר הצף = notify.) |

## הערות שימוש
- שמות איקונים: ראו `ICONS-USAGE.md`. כפתורים ואיקוני שורה מונפשים אוטומטית (R12).
- מספרים ותאריכים בתוך `<bdi>` (R17).
- הבדיקה ב-`/v3-gallery` כוללת לוח "בדיקת RTL" (getBoundingClientRect) — להריץ מחדש אחרי טעינה מלאה.
- הגלריה מוגנת ב-login כמו שאר האתר; לבדיקה ללא כניסה אפשר להעתיק זמנית את הדף תחת `/customer-interface/...` (נתיב ציבורי) ולמחוק אחרי.
- רכיבים שלא נבנו כאן: Toast/NoticeBar (בבעלות notify), Popover/combobox, BusyOverlay.
