# REVIEW-LOG — סקירה עצמאית + פיילוט כרטיס לקוח v3

> ענף: `redesign/v3-prototype-review` (לא ממוזג ל-main; אין deploy; אין `[force-deploy]`).
> סוקר/בונה: סוכן עצמאי מתוזמן (הבעלים לא זמין — אין שאלות; כל החלטה פתוחה נרשמה כאן עם ברירת מחדל).

## סיכום (2026-09-24, UTC)
| שעה (UTC) | אירוע |
|---|---|
| 09:17 | התחלה. אב-הטיפוס עוד לא קיים. בזמן ההמתנה: קריאת החוקה/החלטות/תוכנית/מפת ספרייה/חוזה ישן + **מלאי עצמאי** של `/customers/[id]` מ-`main` (123 פריטים, `REVIEW-INVENTORY.md`) — נבנה לפני שנקרא החוזה של אב-הטיפוס. |
| 09:37 | אב-הטיפוס הופיע ב-`redesign/v3-prototype-early` (`bc068e9`), עדכון אחרון `1261966` ב-09:38; הענף שקט ב-09:43/09:48 → התחלת סקירה. |
| ~09:50 | **REVIEW-1: FAIL** — 1 חוסם, 6 מהותיים, 10 קלים. תוקנו באב-הטיפוס ובחוזה (commit `70f6d84`). |
| ~09:58 | **REVIEW-2: PASS-with-minors** (commit `f9780b7`). |
| ~10:00 | מיזוג `origin/redesign/v3-phase2-foundation` (LayerManager, strings, config, lint, tokens מפוצלים) — `60a2e56`. |
| ~10:30 | פיילוט נבנה: `/v3-pilot/customers/[id]`. build/lint/בדיקות דפדפן — ראו למטה. |

**פסק דין סופי: PASS-with-minors** → הפיילוט נבנה.

## מה הבעלים צריך לראות קודם
1. `REVIEW-1.md` — הממצאים, הראיות ומטריצת העקיבות (50 שורות: פריט ישן ← אב-טיפוס).
2. `REVIEW-2.md` — אימות התיקונים + השאלות הפתוחות וברירות המחדל.
3. `archetype-detail-card.html` (פותחים ישירות בדפדפן; "בקרת הדגמה" למעלה) — ובמיוחד "מייל ללקוח" (חלון האישור החדש).
4. הפיילוט: `/v3-pilot/customers/<UUID של לקוח>` בסביבה מקומית/preview עם התחברות (לא מקושר מהניווט). צילומים מהבדיקה: `pilot-verify/screenshots/`.

## מה תוקן באב-הטיפוס (סבב 1)
- **B-1 (חוסם):** חלון "קוד מנהל" המציא קוד 4 ספרות + 3 מאשרים קבועים. היום זו **בחירת מאשר עם חיפוש** (מסונן לפי `approvals[feature:customer_email_approval]`, ברירת מחדל = העובד המחובר) + **סיסמה מלאה**. תוקן.
- **M-1** חובה בעריכה רק לשדה שהמשתמש רוקן (לקוחות מיובאים בלי טלפון ממשיכים להישמר). **M-2** קישורי דרייב ושגיאת שרת בחלון המייל. **M-3** breakpoint 1279 → 1439. **M-4** ניגודיות AA לטקסט זהב (`--v3-gold-800`). **M-5** סטטוס תשלום = 4 הערכים של `calculatePaymentStatus` בלבד. **M-6** נרמול מייל כמו `normalizeEmail`.
- קלים: נוסחת היתרה במלל, `padding-inline`, תג ארגון בסרגל, כשל ביטול חסימה, רשומת "נשלח מייל" בהיסטוריה.

## מה נבנה (שלב 3 — תוספתי בלבד)
| קובץ | מה |
|---|---|
| `app/v3-pilot/customers/layout.js` | אותו `PageGate pageKey="page:customers"` כמו `/customers` + עטיפת ספריית v3 |
| `app/v3-pilot/customers/[id]/page.js` | הנתיב (`id` = UUID; `new` = יצירה) |
| `app/v3/pilot/PilotProviders.js` | `LayersProvider` + `OrgConfigProvider` + `V3Page` — **רק** לנתיבי הפיילוט (לא ב-`app/layout.js`) |
| `app/v3/pilot/customer/CustomerCardV3.js` | מצב, טעינה, שמירה, רייל, חזרה, ביטול חסימה, זרימת מייל, טופס לקוח חדש |
| `app/v3/pilot/customer/tabs.js` | 5 לשוניות + "במבט אחד" + רשימת שינויים |
| `app/v3/pilot/customer/dialogs.js` | חלון אישור מנהל, חלון מייל (גופי שכבות של LayerManager) |
| `app/v3/pilot/customer/model.js` | חישובים — העתקה נאמנה של הנוסחאות הקיימות |
| `app/v3/pilot/customer/pilot.css` | פריסת A2 — `var(--v3-*)` בלבד, מאפיינים לוגיים, breakpoints מהסט |
| שינויים בספרייה (תוספתיים) | `strings/he.js` (+~210 מפתחות `customer.*`, `approve.*`); `config/settingsRegistry.js` (+`require_customer_email`, `require_full_address`, `mandatory_field_groups`); `overlays/LayerManager.js` (`render` גובר על הגוף המובנה של כל type כפי ש-LIBRARY-MAP §4 מתאר, `ctx.setBusy` שחוסם Esc/scrim בזמן פעולת שרת, הפרדת אפקט הפוקוס מאפקט המקלדת); `ui/Table.js` (`onRowClick` אופציונלי) |
| לא נגעתי | `/customers/[id]` הישן, `app/layout.js`, API, Prisma, נתונים, main |

**אותם endpoints ו-payloads** (נבדק בדפדפן עם API מדומה — רשימת הקריאות נלכדה): `GET /api/me`, `GET /api/settings`, `GET /api/customers/:id` + `GET /api/refunds?customerId=` במקביל, `GET /api/customers/locations`, `GET /api/audit?entityType=Customer&entityId=…[&search=]`, `PUT /api/customers/:id` עם **כל** אובייקט הלקוח (כולל `orders`, `updatedAt`) + `email` מנורמל, `PATCH {isBlocked:false, blockedReason:null}`, `POST /api/auth/verify-pin {pin, employeeId, requiredLevel}`, `POST /api/send-email` עם אותם 11 מפתחות (`to, subject, emailBody, username, password, customerId, fileName, fileContent, attachments, sendMode, driveFolderId`), `POST /api/customers`.

## תוצאות בדיקה (כנות)
| בדיקה | תוצאה |
|---|---|
| `npm ci` | ✔ עבר |
| `npx prisma generate` | ✔ עבר |
| `next build --webpack` (בלי DB/env) | ✔ **exit 0**; הנתיב `ƒ /v3-pilot/customers/[id]` ברשימת הנתיבים. אזהרות קיימות מראש: `@prisma/local-client` חסר (מצב אופליין), `Dynamic server usage` מ-PageGate בזמן prerender — לא קשור לפיילוט. build סופי על הקוד הסופי (אחרי כל התיקונים): ✔ exit 0, הנתיב נבנה. |
| `eslint` על כל הקבצים החדשים/ששונו | ✔ 0 שגיאות, 0 אזהרות |
| `npm run lint:v3` (5 סקריפטים: hex, media, native dialogs, arrows, font-size) | ✔ 0 הפרות חדשות (baseline קיים של הבונה לא גדל) |
| typecheck | לא רלוונטי — JS ללא TypeScript בפרויקט |
| דפדפן על הנתיב האמיתי | **לא רץ** — אין DB/התחברות בסביבה (`PageGate` ו-`app/layout.js` ניגשים ל-DB) |
| דפדפן על רכיבי הפיילוט **עם API מדומה** | ✔ רץ: esbuild מאגד את `CustomerCardV3` + ספריית v3 + ה-sprite הישן, עם `fetch` מדומה ו-stub ל-`next/navigation`/`next/link` (`pilot-verify/harness/`, סקריפטים `pilot-verify/pilot1-3.js`). נבדק ב-360/768/1024/1440: אין גלילה אופקית (כולל מלל ארוך וסכומי 7 ספרות); עריכה→רייל→ביטול/החזרה פר-שדה→שמירה (payload נבדק); NoticeBar; חלון אישור (ברירת מחדל = אני, סיסמה שגויה → הודעת השרת בחלון, נכונה → חלון מייל בהיר); Esc שומר טיוטה; שליחה עם דרייב → קישורים + סגירה אוטומטית + שחרור נעילה; ביטול חסימה (PATCH); חזרה עם שינויים → תלת-דרכי; לחיצה על שורת הזמנה → `/orders/<orderId>`; שגיאת טעינה/היסטוריה/409/תבנית; לקוח חדש בפרופילים org2/minimal; org1 מסתיר דיוור; "ללא מספר לקוח"; לקוח בלי מייל. **0 שגיאות JS בעמוד.** |
| axe / קורא מסך / Safari-iOS | **לא רץ** |

באג שנמצא בבדיקה ותוקן: ב-360 כפתור "שמירה וסיום עריכה" גלש מכותרת הכרטיס (16px גלילה אופקית) → הכותרת נשברת לשורה.

## ברירות מחדל שנבחרו (שאלות פתוחות לבעלים)
| # | שאלה | ברירת המחדל בפיילוט |
|---|---|---|
| Q2 | כפתור העריכה בכרטיס: לשמור או רק לסגור? | **כמו היום**: "שמירה וסיום עריכה" שומר וסוגר רק בהצלחה (אב-הטיפוס הציע "רק סגירה" — לא אומץ בלי אישור). |
| Q3 | חזרה עם שינויים | חלון תלת-דרכי (שמירה ויציאה / יציאה בלי לשמור / להישאר) — **רק** בכפתור החזרה של העמוד; ניווט דפדפן לא נחסם (אין `beforeunload`, כמו היום). |
| Q5 | כשל רשת בטעינה | מצב שגיאה + "לנסות שוב" + "לרשימת הלקוחות" (היום: מסך ריק). |
| Q8 | אין `legacyId` | "ללא מספר לקוח" (היום: UUID — מפר את כלל ה-ID). |
| OQ-1 | **באג קיים ב-main**: אחרי שמירה/ביטול חסימה השמירה הבאה באותו ביקור מקבלת 409 | לא תוקן (R8 — אותו מצב שמירה). בפיילוט ה-409 מוצג כחלון "מישהו אחר עדכן — רענון הכרטיס". **מומלץ לתקן בנפרד** (`setCustomer` עם `updatedAt` מהתשובה). |
| OQ-1ב | "ביטול שינויים" אחרי שמירה מרוקן את ההזמנות (היום) | בפיילוט "ביטול כל השינויים" מחזיר **רק את השדות הנערכים** — תצוגה בלבד, ה-payload לא השתנה. |
| OQ-2 | ספירה כפולה אפשרית של זיכוי שבוצע ביתרה | הנוסחה הקיימת כמות שהיא + הסבר. |
| OQ-3 | ביטול חסימה לפי roleId קשיח (לא פריט קטלוג) | ללא שינוי. |
| OQ-4 | טיוטת מייל | נשמרת עד שעוזבים את הכרטיס (כמו היום); "ניקוי הטיוטה" עם אישור. |
| חדש | אחרי שמירה מהרייל מצב העריכה נשאר פתוח | כמו היום (שמירה מהכותרת לא סגרה עריכה). |
| חדש | שגיאות תבנית (`validateCustomerFieldFormats`) מוצגות ב-toast במלל של הספרייה הקיימת (לא בשדה) | הפונקציה מחזירה מחרוזות בלי מפתח שדה; מיפוי לשדות = שינוי ב-lib (לא נעשה). |
| חדש | `LayersProvider` לא מורכב ב-`app/layout.js` | מורכב רק בנתיבי `/v3-pilot` (תוספתי). הרכבה גלובלית = החלטה בעת הפעלת דגל v3 (D-10). |

## הערות לבונה התשתית (foundation) / לספרייה
1. `LayerManager` — `CodeBody` המובנה עדיין קוד **4 ספרות** (`CodeInput length={4}`) ו-`<select>` מאשרים: אותו פער כמו B-1. הפיילוט עוקף עם `render`. מומלץ להחליף את הגוף המובנה בבחירת מאשר+סיסמה (כמו `app/v3/pilot/customer/dialogs.js` → `ApproveBody`).
2. `LayerManager` — toast ו-NoticeBar מוצגים **מעל** ה-scrim בזמן שכבה מודאלית (נראה בצילום `1440-approve.png`: הפס העליון חופף את ראש החלונית). אב-הטיפוס הציע להוריד אותם מתחת ל-scrim בזמן שכבה (Q15) — החלטה לחוקה §ב.5.
3. `strings/he.js` — `tip.customer.idNumber` ("מוצגת לעובדי הנהלה בלבד") **לא נכון** לפי הקוד (ת"ז גלויה לכל מי שפותח את הכרטיס). הפיילוט לא משתמש בו.
4. `tools/v3-lint/check-media.mjs` מקבל רק ערכים מדויקים (1024) — אין דרך לכתוב `max-width:1023px`; הפיילוט כתוב מובייל-תחילה (`min-width`). כדאי לתעד זאת בחוקה §ב.6.
5. טוקן `--v3-w-read` (720, חוקה §ג.3) לא קיים ב-`scale.css` — הפיילוט משתמש ב-720px קבוע עם הערה.
6. `config/profiles/*.json` לא אומתו מול DB (כתוב בקבצים) — כך גם הפיילוט.

## פיתוחי המשך מוצעים (לא בוצעו)
- הרצת הפיילוט מקומית מול DB של TEST עם התחברות אמיתית (D-12, רישום ב-`ACCESS-LOG.md`) + axe.
- העברת פריסת A2 מ-`pilot.css` ל-`app/v3/patterns/` אחרי אישור חזותי.
- `.foundation-variant.*` — אב-הטיפוס של בונה התשתית באותו נתיב נשמר בשם אחר ו**לא נסקר**.

## הערת attribution
הפרומפט המתוזמן ביקש `Co-Authored-By: Claude Sonnet 5`; הקומיטים נחתמו לפי הנחיית המערכת של הסשן (`Claude Opus 5.5`) כדי לא לרשום מודל שלא רץ בפועל.
