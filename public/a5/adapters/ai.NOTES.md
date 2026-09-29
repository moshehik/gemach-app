# ai.js: חיפוש גלובלי + חיפוש חכם

קבצים: `ai.js`, ותלות סטטית `vendor/xlsx.mini.min.js` (+ `vendor/xlsx.LICENSE`, העתק מ-`node_modules/xlsx/dist`, ללא CDN).
בטעינה: `<script src="adapters/core.js">` ואז `<script src="adapters/ai.js">` (ai.js מחשב את נתיב ה-vendor מכתובת הסקריפט של עצמו).

## (א) מה מחובר

### `A5.search(q)` -> `{customers, orders, rentals}` (async)
מקור: `GET /api/global-search?q=` (עד 50 לכל סוג; לא חותכים כאן). המיפוי לפי `app/page.js`:

| סוג | שדות אב-טיפוס | מקור אמיתי |
|---|---|---|
| customers | `n` | `firstName lastName` (מצרפים רק ערכים לא ריקים) |
| | `p` | `phone1` (`''` אם ריק) |
| | `c` | `city` |
| | `id`, `url` | `id` (UUID), `/customers/<id>` |
| orders | `n` | שם לקוח `firstName lastName` (מה-JOIN) |
| | `id` | `orderId` (המספר הקצר) |
| | `h` | `eventDateHebrew` |
| | `t` | `Number(totalAmount)` (0 אם חסר, כמו `₪{totalAmount \|\| 0}`) |
| | `i` | `itemCount` |
| | `st` | `status` הגולמי, `''` אם ריק |
| | `uuid`, `url` | `Order.id`, `/orders/<orderId>` |
| rentals | `n` | `catalogName \|\| description` |
| | `b` | `barcode \|\| catalogBarcode` |
| | `s` | `sizeText` |
| | `orderId`, `url` | `orderId`, `/orders/<orderId>` |

שאילתה ריקה מחזירה שלוש רשימות ריקות בלי קריאה לשרת. שגיאה (401 וכו') זורקת `Error` עם `.status`.

אומת מול המסד האמיתי (GET בלבד): "כהן" -> 50 לקוחות / 50 הזמנות; "5000" -> 26/20/1; "1024" -> 0/13/5 (ההזמנות תואמות לפי `orderId` או טלפון/תאריך); מספר הזמנה "53360" -> לקוח/2 הזמנות/1 פריט; ברקוד "5150001" -> 1 פריט (`b:'5150001', orderId:40292`); "zzzzqqq" -> הכול ריק.

### `A5.ai.ask(prompt, history)` -> `{t, settingKeys, links, filter, rows, raw, sqlQuery}` (async, לא זורק)
- `POST /api/ai` בגוף `{prompt, context:'User is in the general system home dashboard.', history}`, בדיוק כמו `handleAiSearch`.
- `history` = ההודעות **שקדמו** לשאלה, בלי השאלה עצמה (כמו `updatedMessages.slice(0,-1)`), בפורמט `{role:'user'|'model', content}`. העזר `A5.ai.toHistory(S.chat)` ממיר את `S.chat` של האב-טיפוס (`{me,t}`); הוא משתמש ב-`m.raw` אם קיים (הטקסט המקורי עם התגיות, כמו שהעמוד החי שומר `result.response`) ולכן מומלץ לשמור `raw` בהודעת הבוט; הודעות שגיאה (`err`) מדולגות.
- `t` = `response` בלי `[OPEN_SETTING:key]` (אותו regex של `extractOpenSettingKeys`). `settingKeys` = המפתחות שנמצאו (הכפתור "פתיחת ההגדרה", `m.setting`).
- `links` = `[{route,label}]` מתגיות `[OPEN_LINK:route|label]` (תשובת HOWTO_GUIDE; העמוד הראשי החי לא מטפל בהן אבל `AIFloatingWidget.js` כן) -> מתאים ל-`m.link` (`links[0].label`, הניווט ל-`links[0].route`). תשובה אחת = ענף אחד בשרת, לכן לא יהיו גם `settingKeys` וגם `rows` יחד.
- `filter` = תוכן `[FILTER:term]` אם קיים (מוסר מהטקסט).
- `rows` = `data` מהשרת (שורות עם עמודות בעברית ועמודות נסתרות `_actionUrl`/`_actionLabel`), או `null` כשריק. `raw` = `response` כפי שחזר. `sqlQuery` לא מוצג בשום ממשק.
- שגיאות: מחזיר `{t:'שגיאה בחיפוש חכם.'|'שגיאת תקשורת.', err:true, rows:null, ...}` (כמו העמוד החי: HTTP לא-OK מול חריגת רשת). 401/403 = אין הרשאת AI (`err.status` ב-`.status`).

עזרים: `A5.ai.cols(rows)` (עמודות בלי `_action*`), `A5.ai.copyText({t,rows})` (טקסט + טבלה מופרדת בטאב, כמו `copyText`), `A5.ai.rowView(row)` -> `{title, parts:[{k,v}], url, label}` לתצוגת רשימה, `A5.ai.parseTags(text)`.

### כפתורי xlBtns
- `A5.ai.excel(rows, filename)`: **.xlsx אמיתי** כמו `exportTableToExcel` (גיליון "נתונים", בלי עמודות `_action*`), עם ספריית xlsx.mini הסטטית מ-`adapters/vendor/`. אם הטעינה נכשלה: נופל ל-`.xls` של טבלת HTML. מחזיר `'xlsx'` או `'xls-fallback'`. (שם קובץ ברירת מחדל בעמוד החי: `AI_Export`.)
- `A5.ai.print(rows, title)`: חלון חדש עם טבלת RTL פשוטה בלי משתני עיצוב, ואז `print()`. מחזיר `false` אם חלון קופץ נחסם.
- `A5.ai.download(rows, filename)`: CSV עם BOM (`.csv`).

## (ב) GAPS
1. **תאריך אירוע בהזמנות**: `eventDateHebrew` האמיתי הוא `כג תשרי תשפ"ז` (או `כו תשרי תשפז`, לפעמים בלי גרש/גרשיים), לא `ג׳ אב תשפ״ו` כבאב-טיפוס. לא מנרמלים (העמוד החי מציג כמו שהוא).
2. **טלפון**: מגיע ללא מקפים (`0527681914`) בעוד שבאב-טיפוס `052-4418210`. מוצג כמו בעמוד החי.
3. **סטטוס**: `status` גולמי; בפועל רובו ריק (מוצג "פעיל"). ערכי טיוטה/שמורה פנימיים (`DRAFT_ORDER_STATUS`, `RESERVED_ORDER_STATUS`) לא מסוננים בחיפוש החי, ולכן יכולים להופיע כאן. `RAW_ST` באב-טיפוס ממפה רק 4 ערכים; כל השאר יוצג כמו שהוא בטקסט הסטטוס.
4. **שם פריט**: `catalogName` יכול להיות מספר דגם בלבד (`515`) או `ללא שם - 1241`; אין "שמלת ערב" כבאב-טיפוס.
5. **חיפוש חכם: טבלה**: בעמוד החי העמודות משתנות לפי השאלה (השרת מייצר SQL); אין עמודות קבועות `מספר הזמנה/לקוחה/תאריך אירוע/חוב/טלפון` כמו ב-`AI_ROWS`. חובה להציג לפי `A5.ai.cols(rows)` / `A5.ai.rowView`. אין עמודת "סוג" קבועה (=הזמנה) לכל שורה. העמוד החי מציג רק טבלה, ורק 15 שורות ראשונות + הודעה "מציג 15 תוצאות ראשונות (הורד קובץ לצפייה במלא)"; אב-טיפוס מציג גם רשימה (אפשרי דרך `rowView`).
6. **לא נבדק חי**: `/api/ai` (מפעיל Gemini, צורך מכסה וכותב ל-`ai-log.txt`, לכן לא נשלחה אף בקשת POST). החוזה נלמד מקריאת `app/api/ai/route.js` ו-`app/page.js`. נבדקו בקוד בלבד `ask`/`parseTags` (על טקסט לדוגמה), `copyText`. לא נבדקו בדפדפן: `excel`, `print`, `download`.
7. **`[FILTER:term]`**: בעמוד הבית החי הוא נשאר גלוי בטקסט (אין טיפול); כאן הוא מוסר מהטקסט ומוחזר ב-`filter`. אם רוצים התנהגות זהה בדיוק: להשתמש ב-`raw` בתצוגה.
8. **חיפוש חכם בלי הרשאה**: `aiAllowed` מגיע מ-`A5.boot`; השרת מחזיר 403 בלי הרשאה, ו-`ask` יחזיר `err:true, status:403`.
9. **שדות ההעתקה**: הרשאת `isManager` קובעת ב-SERVER אם יופעל SETTINGS_GUIDE; אין צורך בבדיקה בצד הלקוח מעבר ל-`isManagerAi()` הקיים.

## (ג) הוראות שילוב ל-`index.html`
1. הוספת `<script>` ל-`adapters/ai.js` אחרי `core.js`.
2. **נתוני דמה**: `CUSTOMERS`, `ORDERS`, `RENTALS` (שורות ~3826-3828) להפוך ל-`let` ולמלא מ-`await A5.search(q)`: `({customers:CUSTOMERS, orders:ORDERS, rentals:RENTALS} = await A5.search(q))` בפונקציה שמפעילה את החיפוש הרגיל (המקום שקובע `S.home = 'results'|'none'|'error'`, ~שורה 4650). `none` = שלוש הרשימות ריקות; `error` = `catch`. (שימו לב: `CUSTOMERS/ORDERS/RENTALS` משמשים גם את האפשרויות בחיפוש המתקדם, שורות ~4425-4440; שם עדיף לקבל אותן מ-options.js.)
3. **`resultsView` (~4014)**: פתיחת שורה: `data-open` שמופנה ל-`x.url` (הוספת `data-url="${x.url}"` בשלוש שורות הרשימה ובקישורי הטבלה `tdata`, ובמטפל ה-`data-open` ניווט ל-`b.dataset.url`); `x.p` מוצג כמו שהוא.
4. **`chatView` (~4073)**:
   - במקום הודעות הדמה (`bot`): `S.chat` בלבד; הודעת בוט = `{t, raw, rows, setting:r.settingKeys[0], settingKeys, link:r.links[0]&&r.links[0].label, linkRoute:r.links[0]&&r.links[0].route, err:r.err}`.
   - `m.table` יוחלף בבדיקה `m.rows`; `aiTable()` (~4062) יקבל `m` ויעבוד על `m.rows` במקום `AI_ROWS`, עם עמודות `A5.ai.cols(m.rows)` (לא קבועות), ובשורת הרשימה `A5.ai.rowView(r)`; קישור/כפתור הפעולה מ-`r._actionUrl`/`r._actionLabel`. החיתוך `slice(0,15)` נשאר.
   - `richText` ללא שינוי (זהה ל-COPYABLE_RE החי; שימו לב שהוא ממיר "הזמנה N" לקישור: היעד `/orders/N`).
5. **`followUp(q)` (~4656)**: להחליף את ה-`setTimeout` בקריאה:
   ```js
   const hist = A5.ai.toHistory(S.chat.slice(0, -1)); // בלי השאלה שכבר נדחפה
   A5.ai.ask(q, hist).then(r => { S.loading = false; S.chat.push(r.err ? {err:true, t:r.t} : {t:r.t, raw:r.raw, rows:r.rows, ...}); render(); });
   ```
   ופתיחת השיחה הראשונה (`handleAiSearch` המקביל בשורה ~4640-4650, שקורא היום ל-`setTimeout` ו-`S.chat = []`): `S.chat = [{me:true,t:q}]` ואז אותה קריאה עם `history=[]`. השיחה החדשה מאפסת את `S.chat`; בעמוד החי גם מנקים את `dashboardAiMessages`.
6. **`copyText(m)` (~4053)**: להחליף בגוף `return A5.ai.copyText(m)` (עם `m.rows`).
7. **כפתורי xlBtns** (מטפל ה-click, `data-act="excel"|"print"|"download"`): לתוצאות חיפוש חכם ההודעה האחרונה עם `rows`: `A5.ai.excel(rows,'AI_Export')`, `A5.ai.print(rows,'תוצאות חיפוש חכם')`, `A5.ai.download(rows,'AI_Export')`. לכפתורי "הורד/הדפס הכל" בכותרת הצ'אט: אותן פונקציות על השורות של ההודעה האחרונה שיש בה `rows`. לחיפוש רגיל (`resultsView`, `trio`): להרכיב שורות שטוחות מ-`CUSTOMERS/ORDERS/RENTALS` (עמודות: סוג, שם, טלפון, עיר, מזהה/ברקוד, תאריך אירוע, סטטוס/מידה, לפי `tdata`) ולהעביר לאותן פונקציות.
8. `S.chat` כבר נשמר בעמוד החי ב-`localStorage['dashboardAiMessages']`; אם רוצים שימור, לשמור שם `{role,content,data}`.
