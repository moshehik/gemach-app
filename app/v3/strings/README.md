# app/v3/strings/ — מילון מחרוזות v3

`he.js` הוא מקור-ברירת-המחדל. `t(key, params)` (מחוץ ל-React) ו-`useStrings()` (hook, מכבד
override ארגוני דרך `LabelsContext` הקיים ב-`/api/settings/labels`) הם שתי הדרכים היחידות
לקרוא מחרוזת — **אין מחרוזת עברית כתובה ישירות בקוד עמוד/רכיב v3** (C-1.7, C-9.2, lint #12
עתידי `no-hebrew-literal`).

## מוסכמת מפתחות
`<אזור>.<רכיב/מסך>.<תפקיד>` — אזורים: `common, nav, order, customer, dress, rental, payment,
dialog, notice, error, tip`. פרמטרים: `{name}` בתוך המחרוזת, מועברים כ-`params`.

## מפתח חסר
ב-dev מחזיר `[missing:<key>]` (בולט, לא נופל בשקט) — ב-production מחזיר מחרוזת ריקה במקום
לקרוס. **מפתח שנקרא חייב שורה ב-`he.js`** — זו הבדיקה שגלריה/build אמורים לאכוף (`tools/v3-lint`
טרם נבנה לכלל הזה, ראו MASTER-PLAN Phase 1.6/4).

## override ארגוני
`useStrings()` קורא `getLabel(key, he[key])` מ-`LabelsContext` — אם מנהל שינה ניסוח לארגון
מסוים דרך `/admin/labels` (המנגנון הקיים), זה מה שמוצג; אחרת ברירת המחדל מ-`he.js`.
