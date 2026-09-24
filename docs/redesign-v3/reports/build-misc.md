# דוח בנייה — משפחת misc

ענף: `redesign/site-v3-pages-misc` (מבוסס על `redesign/site-v3-2026-09-24`). קוסמטי בלבד (R8).
קבצים: `app/page.js`, `app/messages/page.js`, `app/my-hours/page.js`, `app/punch-clock/page.js`, `app/profile/page.js`, `app/display-settings/page.js`, וחדש: `app/components/v3misc/useAskDialog.js` (עוזר משותף לשישה העמודים בלבד — Dialog של v3 שמחליף confirm/alert באותה זרימת await).

בדיקות: `eslint` נקי (אזהרת `<img>` קיימת בפרופיל). שרת פיתוח מקומי בענף: `/punch-clock` עלה ב-200, נבדק בדפדפן (שעון, רשימת עובדים נפתחת, RTL). העמודים שדורשים התחברות לא נבדקו חזותית (אין סוד agent-login) — נבדקו ב-lint בלבד.

## צ'קליסט חוזים

### home
- [x] כל ה-state/effects/סדר תופעות-לוואי (`?q=` → replaceState → שחזור sessionStorage/localStorage), `recentSearches` נשמר ב-localStorage (לא מוצג), fetchים, `navigateInApp`, `CopyChip`, ייצוא Excel, `extractOpenSettingKeys`, הסתרת `_action*` — ללא שינוי.
- [x] `isInitialState` שולט במעטפת, בקיצורי הדרך ובריווח; שורת השאלה הצפה נשארה `position:fixed` עם ריווח תחתון תואם.
- [x] מיפוי הרשאות קיצורי הדרך (`headManagement`, `messagingEnabled`) ללא שינוי.
- [x] חלונית פרטיות → `Dialog` (sheet, בהיר; אין בה קלט), סגירה בלחיצה על הרקע/Esc/"הבנתי".
- [ ] `SettingQuickPanel` ו-`CopyChip` לא שונו (משותפים) — REQ-1, REQ-2.

### messages
- [x] `PageGate` ב-layout לא נגע. `searchTerm` משותף, `error` יחיד מוצג רק בטאב compose, `setActiveTab('outgoing')` אחרי שליחה, מטמון SWR (delete מול fetchData) — ללא שינוי.
- [x] מחרוזות שנשלחות לשרת (`הודעת משמרת`, `הודעה להנהלה`, `הודעה חדשה`, `all`, קטגוריות) — ללא שינוי. ids: `messages-receiver`, `messages-content`, `messages-send-email`, `shift-note-content`, `management-note-content`, `messages-receive-alerts` נשמרו.
- [x] משמעות המצבים נשמרה במחלקות v3: לא-נקרא = Card info, הנהלה שלא טופלה = `v3-note--attn`, הודעה לכולם = Chip זהב. הרשאת `isManagerRole` ללא שינוי.
- [ ] צבעי תגי הספירה (אדום/כתום) → ניטרלי (REQ-4). `error` כ-toast לא נוסף (REQ-3).

### my-hours
- [x] hooks לפני ה-early-return; סינון לפי זמן מקומי; `years` כולל שנה נוכחית; סה"כ בפורמט `H:MM`; 4 עמודות; מצב טעינה/ריק/לא-מחובר. נוספו תוויות לבוחרי חודש/שנה (R18).

### punch-clock
- [x] נגיש בלי התחברות (אין PageGate/session). זיהוי שגיאה `includes('שגיאה')` נשמר, וגם הצבעים בפועל (הודעת "בחרו עובד" וכו' — לא-שגיאה). כל ההודעות שמכילות `שגיאה: ` נשארו כפי שהשרת שולח.
- [x] סדר: ולידציה → (יציאה) settings → orders → אישור → setIsLoading → POST. `onMouseDown`+`preventDefault`, blur 200ms, איפוס `employeeId` בהקלדה, `autoComplete="new-password"`, `data-element-name` ×4, ids נשמרו.
- [x] `window.customConfirm` → `Dialog` (confirm, כהה) באותו `await`.

### profile
- [x] גוף ה-PUT = כל אובייקט `profile`; `name` attributes ללא שינוי; ids + `data-element-name` נשמרו; `showProfileImage` כמו קודם; שני ה-show של הסיסמה ואיפוס בביטול; `invalidate(['/api/me'])`; `autoComplete="new-password"`.
- [x] `window.alert` ×7 → `Dialog` באותו `await` (לפני `setSaving(false)` כמו קודם).
- [x] קישור label↔`profile-avatarInput` (input מוסתר) נשמר.

### display-settings
- [x] כל הלוגיקה (`commit`/`updatePref`/`activateCustom`, תופעות DOM סינכרוניות, debounce 500ms, `readLocalPrefs` כמקור merge) ללא נגיעה; רק ה-JSX והסגנון. `data-theme-mode`, `data-density-mode`, `data-text-scale-mode`, `#custom-palette-*`, `#display-settings-more-fonts` נשמרו. צבעי הפלטות/PreviewStrip נשארו inline כנתונים.

## שכתובי מלל בולטים
- דף הבית: "ברוכים הבאים למערכת ניהול הגמ"ח" (ברירת מחדל בלבד; ההגדרה גוברת) → "ברוכים הבאים לגמ"ח"; "קישורים מהירים" → "קיצורי דרך"; "צ'אט חכם מבוסס AI:" → "שיחה עם ה-AI"; "הצג עוד/פחות" → "עוד/פחות"; מדיניות פרטיות — טקסט חדש (הוסרו "טקסט זמני" והערת הפיתוח).
- הודעות: "מרכז הודעות" → "הודעות"; "אשר קריאה" → "קראתי"; "בטל טופל" → "החזרה לטיפול"; "שגיאה בשליחת הודעה" → "ההודעה לא נשלחה. נסו שוב.".
- שעון: "אנא בחר עובד והזן סיסמא" → "בחרו עובד מהרשימה והזינו סיסמה."; הוסר ✅ מהודעות ההצלחה (האיקון בבאנר).
- פרופיל/שעות: "שעות העבודה שלי" → "השעות שלי"; "שינוי סיסמא" → "החלפת סיסמה".
- ההסברים נעו ל-`Tip` (כותרות העמודים, חיפוש חכם, סיסמה/שעון, תאריך הצטרפות, מייל בהודעה).

## חריגות והחלטות
1. `useAskDialog` — קובץ חדש בתחום שלי; מפעיל `Dialog` דרך Promise (כמו `customConfirm`). התראות "הצלחה" בפרופיל נשארו חלונית חוסמת (אותה זרימה) — אפשר להחליף ב-`v3Toast` כשה-bridge יחובר.
2. פרופיל: תיבת "קבלת התראות" הפכה ל-`Switch`; ה-handler מעדכן `receiveEmailAlerts` ישירות (שקול ל-`handleChange` עם `checked`), באותו מפתח בגוף ה-PUT.
3. `autoComplete` הוכפל בשעון הנוכחות (שגיאת lint קיימת) — הוסר הכפל, אותו ערך.
4. התראות NOTIFICATIONS-DESIGN §4: אין בקבצי הסקופ שלי נקודות ניווט אחרי כתיבה, ולכן לא נוספה `enqueueNotice`.
5. תיקון-לא-נעשה: ב-punch-clock ההודעה "שגיאת תקשורת" (עם ת') לא מכילה את המחרוזת "שגיאה" ולכן מוצגת ירוק (התנהגות קיימת, בניגוד לחוזה שכתב שהיא אדומה). לא שיניתי (R8) — מומלץ לשקול.

## בקשות פתוחות
ראו `docs/redesign-v3/requests/misc.md` (REQ-1..8) — בעיקר SettingQuickPanel, CopyChip, וצבעי תגי ספירה בטאבים. REQ-6: עמודי v3 לא מושפעים מפלטות המשתמש עד שיוגדר מיפוי `--v3-*` ל-`--primary`.

## ספקות
- מצב הדיאלוג ב-`useAskDialog` הוא כהה תמיד; אם רוצים לפי `data-theme` — להוסיף פרמטר.
- לא נבדקו חזותית העמודים המוגנים (home/messages/profile/my-hours/display-settings) — מומלצת בדיקת RTL בסקירה.
