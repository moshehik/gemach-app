# A5 — חוזה המתאמים (adapters)

`public/a5/index.html` הוא אב-טיפוס A5 שאושר (עמוד הבית + סיכום כספי). **העיצוב, המלל, המבנה וההתנהגות — קדושים, אסור לשנות אפילו פסיק.**
המשימה היחידה: להחליף את נתוני הדמה בנתוני האמת של האתר. כל אזור נתונים = קובץ מתאם אחד ב-`public/a5/adapters/`.

## כללי ברזל
1. **לא נוגעים ב-`index.html`** (המשלב אני). מתאם = קובץ JS בלבד (וכן route חדש ב-`app/api/a5/...` אם חסר API קריאה).
2. **קריאה בלבד מול מסד הנתונים האמיתי.** שרת הפיתוח (http://localhost:3100) מחובר למסד של נווה יעקב. אסור לשלוח POST/PUT/PATCH/DELETE אליו, ואסור לכתוב לשום טבלה. נתיבי כתיבה (שמירת הגדרה, סימון התראה כנקראה וכד') — כותבים את הקוד לפי קוד השרת הקיים ובודקים בקריאה של הקוד בלבד.
3. אותנטיקציה לבדיקות: `curl -s -H "Cookie: $(cat <COOKIE_FILE>)" http://localhost:3100/api/...`
4. אין להמציא שדות: כל ערך שמוצג חייב לבוא ממה שהאתר הרגיל באמת מחשב/מציג. אם משהו באב-טיפוס אין לו מקור אמיתי — לא ממציאים; מסמנים ב-`GAPS` (ראו למטה) והמתאם מחזיר `null`/מערך ריק.
5. עברית תקנית; בלי המילה "טוגל". קוד בסגנון הקיים (הערות בעברית מותרות, קצרות).
6. כל מתאם: `(function(){ const A5 = (window.A5 = window.A5 || {}); ... })();` — בלי תלות בספריות; ES2020 בדפדפן. משתמשים ב-`A5.api(path, opts)` (מוגדר ב-`core.js`): `fetch` same-origin עם עוגיות; זורק `Error` עם `.status` בכל תשובה שאינה 2xx.
7. בסוף כל מתאם: קובץ `<name>.NOTES.md` קצר: (א) מה מחובר ולאיזה API/שדה אמיתי, (ב) פערים (`GAPS`): מה באב-טיפוס אין לו מקור אמיתי או שהכלל באתר שונה, (ג) הוראות שילוב מדויקות לי: איזה קוד ב-`index.html` (שם פונקציה/קבוע, מספר שורה) מוחלף במה.

## ממשק גלובלי
```
A5.api(path, {method, body})            // core.js — JSON
A5.boot  = {authenticated, employee, isHead, isManager, aiAllowed, settings, navGroups}   // /api/a5/boot
A5.search(q)      -> {customers, orders, rentals}   // מפורמט כמו CUSTOMERS/ORDERS/RENTALS ב-index.html
A5.ai.*           // adapters/ai.js
A5.dash.load()    // adapters/dash.js
A5.adv.focus[key](ADV) -> {cols, rows, links, al?, capstats?}   // adapters/adv-*.js
A5.adv.options(key, focus, typed) -> Promise<string[]>            // adapters/options.js
A5.settings.*     // adapters/options.js
A5.shell.*        // adapters/shell.js
```

## פורמט תוצאות החיפוש המתקדם (זהה ל-`ADV_VIEW` ב-index.html)
`{ cols:[...], rows:[[cell,...],...], links:[url,...], al:[אינדקסי שורות עם התראה], capstats:{stock,busy,res} }`
- `cell` = מחרוזת, או `[טקסט, מחלקת-צ'יפ]` (`st-soon` בקרוב/מחר, `st-today` היום, `st-good` תקין/הושלם, `st-bad` בעיה/איחור/לא הוחזר, `st-mid` חלקי/כיוון, `amtd` חוב, `amtc` זיכוי). ריק = `''` (מוצג כמקף).
- העמודה הראשונה = שם. `links[i]` = כתובת אמיתית לפתיחת הרשומה (`/orders/<orderId>`, `/customers/<id>` וכו').
- עמודת "תאריך אירוע" מכילה תאריך **עברי** בפורמט `ט״ו תשרי` (כמו `eventDateHebrew` באתר, בלי שנה) — הלוח החודשי מפרש אותו.
- מגבלה: עד 200 שורות; אם יש יותר — מחזירים 200 הראשונות ו-`truncated:true`.

## מפתחות ADV (מצב טופס החיפוש המתקדם)
כל השדות של `ADV0()` ב-index.html. תאריכים (`from,to,rdate,sfrom,sto,adate,cdate`) הם ISO `YYYY-MM-DD` (לועזי, המרה מעברי נעשית בממשק); רשימות: `st,flags,ost` (מערכי מפתחות כפי שמופיעים בקבועים OST/RST/RTN/DST/AST/ADV_FLAGS/...).
