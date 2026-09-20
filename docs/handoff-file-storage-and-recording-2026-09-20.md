# סיכום מסירה: הסרטת מסך (מאקרו + דרייב), דיווחי שגיאות ונתיבי שמירת קבצים (20.9.2026)

מסמך זה נועד לאפשר לשרשור חדש להמשיך בלי הקשר קודם. פרטים טכניים מקוצרים מופיעים גם ב-[CLAUDE.md](../CLAUDE.md)
תחת "Screen recording = action macro + Drive video; error-report redesign; where files live".

## מה קרה ולמה המסמך הזה מתוקן

חנות ה-Vercel Blob נמחקה. תחילה נבנתה שכבת אחסון `StoredFile`, ורק בעת המיזוג התברר שב-`main` כבר קיים ההסדר
המקביל: **#96 "Remove Vercel Blob entirely, replace with DB-backed attachment storage" (18.9.2026)**, טבלת `Attachment`
שמוגשת ב-`/api/attachment/<id>`. שכבת `StoredFile` בוטלה ולא נכנסה ל-`main`. מה שנכנס הוא רק החלקים שעדיין חסרו שם:

1. **הסרטת מסך של עוזר ה-AI** היא עכשיו **מקליט פעולות (מאקרו)** + וידאו שעולה **ישר לדרייב** (לא ל-Neon) ומשם ל-Gemini.
   למשתמשים זה נקרא "הסרטת מסך" (הם לא מכירים את המילה "מאקרו"). ב-`main` ההקלטות עברו קודם דרך `/api/upload` אל טבלת
   `Attachment`, כלומר אל Neon ועם תקרת 4.5MB לבקשה בשרת.
2. **מסך דיווחי השגיאות** עוצב מחדש (גלריית צרופות, הצגת צעדים, כפתור "הקלט את הפעולות שלי").

## טבלת נתיבי השמירה (מצב סופי)

| סוג קובץ | איפה נשמר | כתובת הגשה | קוד |
|---|---|---|---|
| תמונות דגמים (ווב + ממוזערת) | Neon, טבלת `Attachment` (#96); ה-URL ב-`DressModel.imageUrl` | `/api/attachment/<id>` | `lib/dressImageStorage.js`, `app/api/upload/route.js` |
| צילומי מסך בדיווחי שגיאה ובתשובות | Neon, `Attachment`; רשימת ה-URL ב-`ErrorReport.attachmentUrls` | `/api/attachment/<id>` | `lib/attachmentUpload.js` |
| הסרטת מסך (וידאו) של עוזר ה-AI | Google Drive, תיקייה `gemach-ai-recordings-<שם הפרויקט>`, קבצים `rec-*.webm` (לא ב-Neon) | אין קישור צפייה; השרת מוריד ומעביר ל-Gemini | `lib/driveBridgeServer.js`, `app/api/ai/recording/init/route.js`, `lib/uploadScreenRecording.js` |
| רשימת פעולות (מאקרו) | לא נשמרת: נשלחת ל-Gemini כטקסט; בדיווח שגיאה נכתבת בתוך `ErrorReport.userText` | — | `app/components/useActionRecorder.js`, `lib/actionRecorderCore.js` |
| לוגו האתר | Neon, `SystemSetting` `BRAND_LOGO`, base64 | `/api/logo` | `app/api/upload-logo/route.js` |
| תמונת פרופיל עובד | Neon, `Employee.profileImage`, base64 | מהשדה | `app/profile/page.js` |
| גיבוי ענני | Drive דרך GitHub Actions וגשר הארכיון | — | `scripts/cloud_backup.js` |
| גיבוי מקומי ישן | `backups/*.sql.gz` במחשב הזה | — | `scripts/backup_prod_db.js` |
| קובץ Access למיגרציה | `../uploads/AAA_uploaded.accdb` במחשב הזה | — | `app/api/admin/database/upload/route.js` |
| CSV דיווחי שגיאה | `C:\Users\moshe\Desktop\מערכת AI\AI_Errors.csv`, רק כשהשרת רץ על המחשב הזה | — | `app/api/error-report/route.js` |

## איך זה עובד

**הסרטת מסך (`AIFloatingWidget.js`).** בלחיצה על "הסרטת מסך" נפתחות במקביל: הקלטת וידאו (`getDisplayMedia`), מקליט פעולות
(לחיצות, הקלדות, בחירות, Enter/Tab/Esc, ניווט), ופתיחת העלאה לדרייב (`/api/ai/recording/init`, כי הפנייה לגשר איטית וכך
ההמתנה מתרחשת בזמן ההסרטה). בסיום הדפדפן שולח את הוידאו ב-PUT יחיד ישר ל-Google (ה-Origin נשלח בפתיחה, לכן ה-CORS עובד).
`/api/ai` מקבל `recordingFileId` + `recordingSteps`, מוריד את הוידאו מהדרייב (אימות: `appProperties.gemachAiRecording`
שווה לשם תיקיית האתר, והשם מתחיל ב-`rec-`), מעלה ל-Gemini, ושולח את הרשימה כטקסט לצד הוידאו. אם הדרייב לא מוגדר או
שההורדה/ההעלאה נכשלה, השאלה ממשיכה עם רשימת הפעולות בלבד. **ערכי סיסמה, כרטיס אשראי, CVV ותעודת זהות מוסתרים כבר בדפדפן**
(`isSensitiveField` ב-`lib/actionRecorderCore.js`, לפי סוג השדה, שם, מזהה, תווית ו-placeholder).

**דיווחי שגיאות (`ErrorReportButton.js`).**
- גלריית צרופות עם כותרת וספירה; צרוף שנשבר מוצג כ"הקובץ אינו זמין יותר" ולא כאייקון שבור.
- כפתור "הקלט את הפעולות שלי": בלי וידאו ובלי הרשאת שיתוף מסך. החלון נסגר, מופיע סרגל צף "רושם את הפעולות שלך · N צעדים
  · סיום", והצעדים מצטרפים לטקסט הדיווח כבלוק `[הפעולות שבוצעו לפני התקלה: …]`.
- בשרשור הבלוק מוצג כרשימה מקופלת וממוספרת, ובשורת הרשימה הוא לא מופיע (`splitReportSteps`).

## מה נעשה ב-Vercel (באישור המשתמש)

הוגדרו בשני הפרויקטים (`gemach-app-uyh4`, `gmach-neve-yaakov`), לסביבות production ו-preview:
`DRIVE_BRIDGE_URL` (מקורו `MAILER_URL` ב-`.env` של print-center) ו-`DRIVE_BRIDGE_SECRET` (מסומן `sensitive`).
הם נכנסים לתוקף בפריסה הראשונה שאחרי ההגדרה. הערכים לא נכתבו לשום קובץ בפרויקט.

## בדיקות שטח (מול מסד TEST בלבד, דרך שרת פיתוח ייעודי)

| בדיקה | תוצאה |
|---|---|
| וידאו webm אמיתי → דרייב (CORS + PUT) | עובד, הדפדפן קרא את התשובה |
| דרייב → Gemini | עובד; Gemini תיאר נכון את הפעולות |
| זמן `/api/ai` עם וידאו | ירד מ-59–70 שניות ל-~27 (מטמון root/token ו-`appProperties`); ה-init רץ ברקע בזמן ההסרטה |
| ווידג'ט מקצה לקצה (שיתוף מסך מדומה) | נרשמו 8 צעדים כולל ניווט; **הסיסמה ושדה האשראי הוסתרו**; הוידאו הועלה; Gemini ענה |
| דיווח שגיאה בדיקה | גלריה, צרוף שבור, בלוק צעדים מקופל, ותצוגה מקדימה ברשימה — כולם תקינים |
| סרגל "הקלט את הפעולות שלי" | מופיע, סופר, לא נרשם כצעד בעצמו, ואחרי "סיום" הצעדים מוצגים לפני שליחה |

הבדיקות הראשונות רצו על גרסה שכללה את שכבת `StoredFile` שבוטלה; החלקים הנבדקים כאן (מקליט, דרייב, Gemini, ממשק דיווחים)
אינם תלויים בה. **לא נבדק:** שליחת דיווח שגיאה אמיתי (מפעילה מייל למתכנתים והפעלת הסוכן האוטומטי), ובדיקה בפרודקשן.

## מה נשאר

- להפעיל את `ai_screen_recording_enabled` בכל גמ"ח (כבויה כברירת מחדל; לא שיניתי הגדרות בפרודקשן).
- לבדוק בפרודקשן הסרטה אחת בכל גמ"ח.
- **הקלטות בדרייב לא נמחקות אוטומטית** (מכסת 15GB בחשבון). כדאי להוסיף ניקוי לקבצים ישנים.
- זמן `/api/ai` עם וידאו (~27 שניות) קרוב לתקרת `maxDuration = 60`; אם יהיו timeouts, לשקול לנתח רק את רשימת הפעולות.
- קיימת בעיה נפרדת שלא טופלה: `backup_owner_email` של org1 לא מוגדר, כך שקובצי הגיבוי לא משותפים לאיש.

## איך לחזור על בדיקות השטח

שרת פיתוח מול TEST בלבד, בלי לגעת ב-`.active-db` המשותף: `scratch/dev-test-server.js` (מפנה את ה-"prod client" של התהליך
ל-`TEST_DATABASE_URL`, וטוען את גשר הדרייב מ-`.env` של print-center). מופעל דרך `preview_start` עם ההגדרה
`gemach-fieldtest-testdb` (פורט 3040) ב-`.claude/launch.json` שבתיקיית האב `גמח שמלות חדש`. ההתחברות: עוגיית
`auth_token` עם מזהה עובד מ-TEST. Git Bash הופך ארגומנטים שמתחילים ב-`/` לנתיבי Windows, לכן להעביר `/api/...`
כארגומנט דורש `MSYS_NO_PATHCONV=1`.
