# שיטת אימות התאמה (ביקורת עצמאית, קריאה בלבד)

מטרה: להוכיח שהעמוד החדש (ענף `origin/redesign/site-v3-pages-<family>`) **זהה בהתנהגות ובנתונים** לגרסה הישנה (`origin/main`), ושכל אפשרות קיימת. אתה **לא** הבונה — אל תשכנע את עצמך; חפש פערים.

## גישה לקוד (מתוך `C:\Users\moshe\Desktop\wt-redesign-v3`, לא לשנות קבצי קוד, לא לעשות checkout/commit)
- `git fetch origin` (אם צריך), ואז:
  - הישן: `git show origin/main:<path>`
  - החדש: `git show origin/redesign/site-v3-pages-<family>:<path>`
  - רשימת קבצים ששונו: `git diff --name-status origin/main...origin/redesign/site-v3-pages-<family> -- app components lib`
  - diff מלא: `git diff origin/main...origin/redesign/site-v3-pages-<family> -- <path>`
- ניתן לייצא שני העותקים ל-scratchpad שלך ולהריץ סקריפטי node להשוואה. אל תריץ שרת פיתוח.
- החוזה: `docs/redesign-v3/contracts/<page>.md` (בעץ העבודה הראשי).

## בדיקות חובה (הכל אוטומטי ככל האפשר — כתוב סקריפט חילוץ, אל תסתמך על קריאה בעין בלבד)
1. **קריאות רשת:** חלץ מכל קובץ ישן/חדש כל `fetch(`/`apiFetch`/`axios`/helper: URL (כולל סדר פרמטרי query — מפתח מטמון!), method, מפתחות ה-body/`JSON.stringify` (רשימת מפתחות מלאה), headers, תנאי הפעלה, טיפול בתשובה. דו"ח diff: חסר/נוסף/שונה.
2. **State ו-effects:** רשימת `useState/useRef/useMemo/useCallback/useEffect` (שמות + מערכי תלות). כל שינוי — לדווח. אובדן/שינוי תלות = חוסם.
3. **מטפלים:** כל handler (`handle*`, `on*`, `save*`, `submit*`): גוף זהה? (השווה אחרי נרמול רווחים). הבדלים מלבד JSX/מלל = חוסם.
4. **שדות וכפתורים:** לכל שדה/כפתור/תפריט/לשונית/מתג בחוזה — היכן הוא בקוד החדש (קובץ:שורה). חסר = חוסם. כפתור שאין לו onClick זהה = חוסם. שדה שפסק להיות מקושר ל-state המקורי (value/onChange) = חוסם.
5. **חלוניות ואישורים:** כל `customConfirm/customPrompt/alert/window.confirm/Dialog` — נשמר זרם ההמתנה (await, ערך חוזר, ענפי ביטול)? האם ערך ההחזרה משמש כמו קודם?
6. **הרשאות/הגדרות/מצבים:** `hasPermission`, `PageGate`, `SystemSetting` keys, org-specific, מצבי loading/empty/error/read-only, נעילות — כולן קיימות?
7. **אחסון ומזהים:** localStorage/sessionStorage keys, `data-*`, `id`, `name`, `ref`, `aria-*` שמשמשים קוד אחר או `document.querySelector` — קיימים?
8. **מלל שהוא נתון:** מחרוזות שנשמרות/נשלחות/מושוות בקוד (סטטוסים, כותרות הודעות, ערכי select) — לא שונו?
9. **RTL/נגישות/עיצוב (בדיקת קוד בלבד):** `left/right/margin-left` קשיחים, צבעים/גדלים קשיחים, אייקונים שאינם דרך `<Icon>`, `alert()` שנותרו, `<bdi>` לספרות — דווח כהערות (לא חוסמים).
10. **קומפילציה סטטית:** imports מוגדרים, JSX תקין, `'use client'`, אין שימוש במשתנה שהוסר. אפשר `node --check` על קובץ שאינו JSX; ל-JSX השתמש ב-`@babel/parser` מ-`node_modules` (`C:\Users\moshe\Desktop\wt-redesign-v3\node_modules`) או `npx eslint <file>` בעץ העבודה הראשי (קריאה בלבד).

## פלט
כתוב `docs/redesign-v3/reports/verify-<family>.md` (בעץ העבודה הראשי; קובץ חדש, עברית + מזהים באנגלית):
- **פסק דין:** ✅ תואם 100% / ⚠️ תואם עם הערות / ❌ פערים חוסמים.
- **טבלת חוזה:** כל פריט בחוזה → קיים? (קובץ:שורה) → זהה? 
- **פערים חוסמים** (מה, איפה בישן/חדש, מדוע משנה נתונים/התנהגות, תיקון מוצע ספציפי).
- **הערות לא חוסמות**, ו**מה לא הצלחת לבדוק סטטית** (דורש דפדפן).
- הדבק את פלט סקריפטי ההשוואה (מקוצר) כראיה.
אל תתקן את הענף. אל תכתוב לענפים. סיכום סופי ≤6 שורות.
