# בקשות — משפחת ops (תפירות · לוח שנה · משלוחים)

## REQ-1 · לוח שנה · איקונים · בינוני
מה: כפתורי-איקון בתוך תא יום וכרטיס הזמנה (הרחבה / הדפסה / פרטים) נבנו כ-`v3-btn--icon v3-btn--sm` (44px) כי אסור <44px. בלוח צפוף זה מנפח כרטיסים ותאים.
איך לתקן (הצעה): וריאנט `v3-btn--dense` (32px, רק בתוך רשת לוח/טבלה) או `IconBtn dense`.
סטטוס: פתוח

## REQ-2 · רכיבים משותפים בסגנון ישן · בינוני
מה: נשארו כמות שהם (מחוץ לתחום): `HebrewDatePicker`, `HebrewDateRangePicker`, `ExportButtons`, `PrintWizardModal`, `StatisticsModal`, `RentalReturnModal`. בתוך העמודים הם נראים ישנים לצד ה-kit.
איפה: components/HebrewDatePicker.js, HebrewDateRangePicker.js, ExportButtons.js, app/components/PrintWizardModal.js, StatisticsModal.js, components/orders/RentalReturnModal.js
סטטוס: פתוח

## REQ-3 · kit · Table · בינוני
מה: `Table` לא מאפשר מחלקה/רקע לשורה לפי סטטוס (תפירות: ממתין/בוצע). נבנתה טבלה ידנית עם `ops-row--*`.
איך לתקן: prop `rowClassName(row)` או `rowTone`.
סטטוס: פתוח

## REQ-3b · kit · SearchBar + חלונית אישור · בינוני
מה: `components/ops-v3/OpsKit.js` מכיל (1) `SearchBar` — חיפוש עם כוכב AI + סטטיסטיקה; (2) `useOpsDialogs` — תחליף `customConfirm`/`alert` ב-Dialog עם אותו זרם await. אלה דפוסים חוצי-עמודים (orders, customers, ...) ← כדאי להעביר ל-`app/v3/ui`, ולחבר את `customConfirm`/`alert` הגלובליים ל-DialogProvider.
סטטוס: פתוח

## REQ-4 · kit · Dialog · קוסמטי
מה: `Dialog variant=form` בלי כפתור X. במשלוחים (חלונית הדפסה) ה-X המקורי (מנוטרל בזמן שליחה) הוחלף בכפתור "ביטול" + Esc + לחיצה ברקע (חסומים בזמן שליחה).
איך לתקן: prop `closeButton` (X בפינה, עם `disabled`).
סטטוס: פתוח

## REQ-5 · tokens · מידות לוח שנה · קוסמטי
מה: גובה מינימלי לתא (130px) וגובה מרבי לרשימת הכרטיסים (150px) הוגדרו כ-`calc(var(--v3-sp-9)*2)` (=128) ו-`+ sp-5` (=152) — קירוב. אם צריך מדויק: token `--v3-cal-cell-h`.
סטטוס: פתוח

## REQ-6 · notify · חיבור · בינוני
מה: `alterations/page.js` קורא ל-`enqueueNotice` (persistToBell:false) אחרי סימון "בוצע" — אבל `V3NotifyProvider` עדיין לא מחובר ב-layout, כך שההתראה לא תוצג עד החיבור.
סטטוס: פתוח (תלוי בחיבור ה-provider)
