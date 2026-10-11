# כרטיס דגם החדש (A5) - החלטות, מקורות נתונים, מלכודות

ענף `feature/a5-staff-models-2026-10-09`. מסך `model_card` (`/dashboard/dresses/[id]`). דוח הנאמנות: `model-card-fidelity.md`.

## קבצים
- `app/dashboard/dresses/[id]/page.js` - עטיפה דקה ל-`DressCardSwitch`; הדף הישן = `LegacyDressCardPage.js` (העתק **זהה בייט-לבייט** של `page.js` של main 51eae39f; `scripts/test_page_variant_switch.mjs` בודק hash מול git).
  `/dashboard/dresses/new` (האשף) ממשיך להיות מוגש מהקובץ הישן בשתי הגרסאות עד שייבנה מסך `model_new` (שלב 2).
- `app/components/dress-card/`: `DressCardA5.js` (מעטפת), `DressCardSwitch.js`, `useDressCard.js` (הבקר), `DcTopbar/DcScanBar/DcTabs/DcRail.js`, `DcParts.js`,
  `dcPrint.js` (נקודות חיבור לייצוא/הדפסה), `tabs/Dc{Details,Items,Rentals,History}Tab.js`, `dialogs/*`, `css/dress-card.css`.
- `lib/dressCardLogic.js` - לוגיקה טהורה (diff, תוכנית שמירה, היסטוריה, ברקוד...) + `scripts/test_dress_card_logic.mjs`.
- הרשימות בלשוניות (פריטים / השכרות / היסטוריה) = ערכת `app/components/a5-list` (סוכן K).
- שורש הכרטיס `.gm-ds.gm-oc.gm-dc`: **משתף עם כרטיס ההזמנה** את `order-card/css/oc-base.css` + `oc-rail.css` (נטרולי דליפה של ה-CSS הגלובלי, שורת סריקה, חלונות כהים,
  רייל) ואת `OcUi` (חלונות / טוסט), `OcIcon`, `useCardTooltips`, `useIconAnim`, `OcHebrewCalendar`. `dress-card.css` מכיל רק את הדבק של הדגימה (מחלקות `mc-*` -> `dc-*`).
  מלכודת: שינוי ב-oc-base.css משפיע גם על כרטיס הדגם.
- אייקונים `ban` / `hash` / `store` (ציור הדגימה, אין ב-sprite של הפלטה): מוטמעים ב-`useA5Sprite` של ערכת הרשימות (idempotent).

## התנהגות שמירה - שינוי מכוון מול הדף הישן (להחלטת בעלים)
בדף הישן שדות הדגם נשמרו בלחצן "שמור" ו**כל עריכת פריט נשמרה מיד** (PUT/POST/DELETE לכל פעולה; גם מחיקה, שחזור, העברת מיקום ועדכון קרטון).
בעיצוב המאושר כל השינויים (גם פריטים) הם שורות ב"שינויים בכרטיס" עם ביטול / החזר ביטול ונשמרים יחד בלחיצה על "שמור" - כך מומש.
הבקשות והגופים **זהים** לדף הישן (`buildSavePlan`, נבדק בבדיקות היחידה): `PUT /api/dresses/[id]` עם `MODEL_FIELDS` (או רק `exitDateFromRepo/entryDateToRepo/inactiveReason`
כשרק הפעילות / תאריך הכניסה השתנו - מותר לכל עובדת, כמו `ACTIVITY_TOGGLE_FIELDS` בשרת), `PUT /api/dresses/items/[id]` (מיקום בלבד / קרטון בלבד / עריכה מלאה
`{inRepair,notInUse,notInUseSince,notInUseReason}`), `DELETE`, `PUT {isDeleted:false}`, `POST /api/dresses/[id]/items`. הצעדים רצים ברצף; צעד שנכשל
נשאר בעגלה והמשתמשת רואה חלון "חלק מהשינויים לא נשמרו" עם הסיבה (למשל "הברקוד כבר קיים" / "הרשאה זו שמורה להנהלה ראשית").
"הצג בבדיקה" ו"פרימיום" נשלחים בבקשת הדגם המלאה (דורשת הנהלה ראשית בשרת - כמו בדף הישן).

## מקורות הנתונים (בלי שינוי סכמה / API)
- דגם + פריטים: `GET /api/dresses/[id]?includeDeleted=true` (מטמון `dress-detail` המשותף, SWR). פעיל = אין `exitDateFromRepo`.
- הגדרות: `getSettingsCached` - `useModelNames`, `useFileNamesForImages`, `hide_dress_images`, `item_locations` (ברירת מחדל חנות / רזרבה / מחסן), `premium_pricing_enabled`.
- קטגוריות: `/api/pricelists/categories` (רשימת שמות בלבד - לכן באפשרויות אין "מחיר בסיס"; קטגוריה קצרה כמו `B` מוצגת "קטגוריה B").
- השכרות: `GET /api/dresses/[id]/rentals` - נטען ברקע עם פתיחת הכרטיס (סמן הלשונית "השכרות" חייב אותו מההתחלה) ומשמש גם את "יומן הדגם" ואת חלון "פרטי פריט".
  "באיחור" = `stats.overdue` של השרת (נלקחה, לא הוחזרה, תאריך האירוע עבר). "החזרה צפויה" ביומן הדגם = `nextWorkingDay(אירוע)` (בלי ימי "ללא פעילות" של הארגון).
- היסטוריה: `/api/audit` (DressModel + DressItem), נטען בכניסה ללשונית "פריטים" או "היסטוריה". ה-AuditLog של עדכון שומר **את מה שנשלח** (בדף הישן: כל שדות הדגם בכל שמירה) ובלי "לפני" -
  `buildDressHistoryRows` מנהל מצב מצטבר לכל ישות ויוצר שורה רק לשדה ששונה, עם "לפני" מהרישום הקודם; ישות בלי רישום יצירה - רישום ראשון = שורה מסכמת "עודכנו פרטי הדגם/הפריט".
- כתובת הדף לרשימה: `/dashboard/dresses`. הדפסת כרטיס: `/dashboard/dresses/[id]/print` (קיים).

## ייצוא / הדפסה (נקודות חיבור לשלב ההדפסה)
`dcPrint.js`: `registerDressDoc(which, kind, handler)` - `which` = card | items | rentals | labels, `kind` = print | download. כרגע: כרטיס דגם = דף ההדפסה הקיים בלשונית חדשה (גם "הורדה" - נפתח עם הודעה
"שמירה כ-PDF"); רשימת פריטים ומיקומים / השכרות = `runListExport` של ערכת הרשימות (HTML להדפסה / PDF מהשרת); Excel (לחצן הכותרת ושלישיית הרשימה) = `.xlsx` אמיתי (`lib/xlsxExport`) באותן עמודות של ה-CSV הישן;
מדבקות ברקוד (הדפסה / PDF) - מוצג "המסמך הזה עדיין לא זמין". שלב ההדפסה מחליף handlers בלי לגעת בכותרת.

## סטיות שמחכות להחלטת הבעלים
1. (נסגר 11.10.2026) חיפוש חכם (AI) ושאלות סטטיסטיקה ברשימות הכרטיס - חוברו בפועל לפי החלטת הבעלים (`useDcListAi.js`). היומן מסונן לפי ברקודי הפריטים שה-AI החזיר (אין AI על רישומי יומן). ההקשר 'rentals' בלשונית ההשכרות (ולא 'dresses') כדי שהגבלת העמודות הכספיות של ה-endpoint תחול.
2. נוסח הטולטיפ של "הצג בבדיקה" - הוחלף בנוסח המדויק מהדף הישן (הדגימה תיארה התנהגות שאינה קיימת).
3. לחצן "בחירה מלוח" בחלונות התאריך (יכולת בחירת כל תאריך; ר' דוח הנאמנות).
4. אפשרות "ללא קטגוריה" ברשימת הקטגוריות (ניקוי קטגוריה).
5. שורת "שמלת פרימיום" (רק כשההגדרה דולקת) ובאנר / כפתור שחזור לדגם מחוק.

## מלכודות שנמצאו
- בקשות כפולות בטעינה (`/api/dresses/<id>?includeDeleted=true`, `/api/pricelists/categories`) - strict-mode ב-dev; כעת עוברות דרך `fetchJson` של `app/lib/pageCache.js` (איחוד GET זהים שבאוויר): בקשת רשת אחת.
- Next dev: דף שכל סוכן עורך בו קבצים נטען מחדש בכל שינוי - בבדיקה בדפדפן לבנות תרחיש קצר בקריאה אחת.
- `design-overrides.css` צובע `input:not(...)` (צבע טקסט חום, רדיוס 10px) - תוקן ב-`dress-card.css` בהיקף הכרטיס וחלונותיו.
- הדגימה: `.mc-itm-dlg .field+.field{margin-top:16px}` הוריד את התא השני והשלישי בשורת 3 השדות הנעולים - תוקן.
- מידות בנתוני אמת הן מחרוזות (`"08"`, `"34"`): מיון לפי הערך המספרי, ברקוד נבנה עם `pad2`. מידה לא מספרית ממוינת אחרי המספרים.
- פריט חדש שעוד לא נשמר מקבל מזהה זמני שלילי (`-1`, `-2`...) - מזהי אמת הם מחרוזות (לכן שאילתת היומן מסננת לפי `typeof id === 'string'`).
- דוח בדיקות קיים שנכשל בגלל הרשומות החדשות ברישום (`lib/uiVariantScreens.js`: employees_list / models_list / model_card / model_new): `scripts/test_page_variant_switch.mjs`
  ו-`scripts/test_ui_variant.mjs` משווים רשימות מסכים קבועות - נדרש עדכון בבעלות סוכן K (הרישום).

## לא נבדק
- העלאת קובץ תמונה בפועל (`/api/upload`; הקובץ נערך בענף במקביל), שחזור דגם מחוק מול שרת, חלון "חלק מהשינויים לא נשמרו" (כישלון חלקי אמיתי), דגם עם מעל 50 פריטים בסריקה (מעבר עמוד אוטומטי - ממומש, לא נבדק בדפדפן), רשימות בנייד, הדפסת מדבקות.
