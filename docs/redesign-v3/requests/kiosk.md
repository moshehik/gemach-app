# בקשות מ-Builder הקיוסק (`/customer-interface`)

פורמט לפי ARCHITECTURE §2. כולן בבעלות ספריית `app/v3` / `globals.css` (לא נגעתי בהן).

## REQ-1 · כל v3 · טיפוגרפיה · בינוני
מה: `globals.css` מכריח `font-family` של `h1-h6` ב-`!important` (Frank Ruhl Libre, גופן הכותרות של העיצוב הישן). לכן כל `v3-card__title` (h2), `v3-dialog__title` (h2), `v3-h1` מוצגים בסריף ולא ב-Rubik.
איפה: `app/globals.css` (כלל `h1..h6 !important`) מול `app/v3/tokens.css` `--v3-font`.
איך לתקן: ב-`components.css` להוסיף `[data-v3] :is(h1,h2,h3,h4,h5,h6), .v3-dialog :is(h1,h2,h3), .v3-tip :is(h1,h2,h3){font-family:var(--v3-font) !important}` (חלוניות/טולטיפים ב-portal לא בתוך `.v3k`, ולכן שם אני לא יכול לתקן). בינתיים דרסתי רק בתוך `.v3k` ב-`kiosk.css`.
סטטוס: פתוח

## REQ-2 · אייקונים · קוסמטי
מה: חסרים `filter` (סינון) ו-`table` (תצוגת טבלה) בספרייט. הקיוסק השתמש עד היום ב-`ka-i-filter` / `ka-i-table` מקומיים (אסור אחרי המעבר).
איפה: `IconSpriteV3.js`. כרגע: סינון = `category`, טבלה = `database`.
איך לתקן: להוסיף `i-filter` (משפך) ו-`i-table` (טבלה) ולהחליף בקיוסק.
סטטוס: פתוח

## REQ-3 · Btn · מגע · קוסמטי
מה: `IconBtn` עם `size="lg"` נשאר ברוחב 44 (`--icon` קובע width) וגובה 52 - לא ריבועי. בקיוסק אני כופה ריבוע 48/52 ב-`kiosk.css`.
איך לתקן: `.v3-btn--icon.v3-btn--lg { width: var(--v3-control-h-lg) }`. כמו כן טוקן מגע `--v3-touch: 48px` לשימוש כללי (pill, תא בלוח, צ'יפ כפתור - היום `v3-chip--btn` הוא 32px, קטן למגע).
סטטוס: פתוח

## REQ-4 · Dialog · התנהגות · בינוני
מה: חלונית נעילה (שחרור מסך) צריכה להיות בלתי-ניתנת לסגירה ב-Esc/לחיצה על הרקע (חוזה KIOSK: רק "ביטול" סוגר). עקפתי עם `onClose={() => {}}` + `closeOnScrim={false}`.
איך לתקן: prop `dismissible={false}` שמבטל Esc ורקע ומסמן זאת בבירור.
סטטוס: פתוח (הפתרון הנוכחי עובד)

## REQ-5 · Table · globals · בינוני
מה: `th` גלובלי הוא `position: sticky !important` + צל + border ב-`!important` (מנוע sticky-headers), ולכן `v3-table` בתוך עטיפה גוללת מקבל כותרת דביקה עם צל ישן. בקיוסק ביטלתי מקומית ב-`kiosk.css` עם `!important`.
איך לתקן: `.v3-table th { position: static !important; box-shadow: none !important; ... }` בספרייה (או opt-out בסלקטור של המנוע).
סטטוס: פתוח

## REQ-6 · מידות פריסה של הקיוסק · קוסמטי
מה: ב-`kiosk.css` יש מידות פריסה שנבנו מכפולות של טוקני-מרווח, כי אין טוקן מתאים: רוחב פאנל סינון (`--v3-sp-9 * 5` = 320), עמודת חודש בלוח (`* 5.75`), קוטר עיגול דגם (`sp-8 * 1/1.5/2`), רוחב פופאובר זום (`* 5`), רוחב טופס (`* 10`).
איך לתקן: אם רוצים עקביות - טוקני `--v3-w-panel`, `--v3-avatar-{sm,md,lg}`.
סטטוס: פתוח (לא חוסם)

## REQ-7 · Tip · קוסמטי
מה: `Tip` מרנדר את גוף הטולטיפ (מוסתר) ב-portal תמיד, גם כשסגור - טקסט ההסבר נכנס ל-DOM של כל עמוד ולכלי שקוראים את הדף (get_page_text / AI). מציע `open && createPortal`.
סטטוס: פתוח
