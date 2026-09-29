# גמ"ח שמלות — מערכת הניהול (gemach-app)

מערכת ניהול מלאה לגמ"ח השאלת שמלות ערב וכלה: לקוחות, הזמנות והשכרות, מלאי (דגמים ופריטים פיזיים עם ברקוד), תשלומים וזיכויים, מחירונים, עובדים ושעון נוכחות, הודעות פנימיות, דוחות, עוזר AI ועמדת לקוח. הממשק והנתונים בעברית, מימין לשמאל. בנויה ב-Next.js (App Router) עם Prisma ו-Postgres (Neon), ומחליפה מערכת Microsoft Access ישנה — שממנה עדיין מייבאים נתונים (`scripts/import_from_access.js`).

## שני גמחים, קוד אחד

| | הגמ"ח הראשי (org1) | נווה יעקב (org2) |
|---|---|---|
| אתר | `gemach-app-uyh4-beryl.vercel.app` | `gmach-neve-yaakov.vercel.app` |
| פרויקט Vercel | `gemach-app-uyh4` | `gmach-neve-yaakov` |
| מסד נתונים | פרויקט Neon נפרד (`gemach-main-prod`) | פרויקט Neon נפרד (`gemach-dresses-2`) |

- אותו ענף `main` נפרס לשני פרויקטי ה-Vercel — תיקון קוד מגיע לשני הגמחים יחד. אין שני עותקים של הקוד.
- ההבדלים בין הגמחים הם רק בנתונים ובהגדרות המערכת (`SystemSetting`) שבכל מסד נתונים. הגדרה שביקש גמח אחד נוצרת בשני המסדים, אבל הערך המבוקש נכנס רק אצל מי שביקש (הכלל המלא: `CLAUDE.md` → Standing rules).

## התחלה מהירה

1. Node בגרסה 22.17 ומעלה (או 24 ומעלה).
2. `npm install`. בעץ עבודה נוסף (worktree) מחברים במקום זה junction ל-`node_modules` של הצ'קאאוט הראשי — ר' [docs/branches-and-worktrees.md](docs/branches-and-worktrees.md).
3. קובצי סביבה — `.env` ו-`.env.local` — אינם ב-git; מעתיקים אותם מהצ'קאאוט הראשי. המשתנים המרכזיים: `PROD_DATABASE_URL` / `DATABASE_URL` (מסד הייצור של הגמ"ח הראשי), `TEST_DATABASE_URL` (מסד הבדיקה), `AUTH_SECRET` (חתימת עוגיית ההתחברות), `GEMINI_API_KEYS` (עוזר ה-AI). לפי הצורך: `DRIVE_BRIDGE_URL`/`DRIVE_BRIDGE_SECRET` (הקלטות מסך לדרייב), `GH_DISPATCH_TOKEN`/`GH_DISPATCH_REPO`, `AGENT_LOGIN_SECRET`, `SETTINGS_ENCRYPTION_KEY`, ולמצב אופליין `IS_OFFLINE_MODE` + `SQLITE_URL`.
4. `npm run dev` ← http://localhost:3000. ב-Next 16 אפשר להריץ רק שרת פיתוח אחד לכל תיקייה.

שאר הפקודות (`build`, `lint`, גיבוי ידני, ניקוי לוגים, מצב אופליין): `CLAUDE.md` → Commands. אין חבילת בדיקות אוטומטית.

### ייצור מול בדיקה — הקובץ `.active-db`

- `app/lib/prisma.js` מחזיק שני חיבורים: PROD = `PROD_DATABASE_URL` (ואם הוא חסר — `DATABASE_URL`), ו-TEST = `TEST_DATABASE_URL` (רק אם הוגדר).
- **בפיתוח מקומי בלבד** (`npm run dev`) הקובץ `.active-db` שבתיקיית ההרצה קובע לאיזה מהם השרת מחובר: `prod` או `test`. הוא נקרא פעם אחת בעליית השרת, וההחלפה נעשית מהפס של מצב הפיתוח בראש המסך (`DevEnvBanner` ← `POST /api/dev/switch-env`), שכותב את הקובץ ומחליף את החיבור מיד.
- **אזהרה:** הקובץ שמור ב-git עם הערך `prod`, כלומר שרת פיתוח מקומי עובד כברירת מחדל מול **נתוני האמת** של הגמ"ח הראשי. ההחלפה חלה על כל התהליך — כל מי שעובד מול אותו שרת פיתוח עובר איתך. לכל עץ עבודה יש `.active-db` משלו.
- **באתר החי** אין `.active-db`. במקומו יש "מצב גיבוי" (ההגדרה `web_backup_mode`, בהגדרות ← מסד נתונים, להנהלה ראשית) שמעביר את כל האתר ל-`TEST_DATABASE_URL` — שם הוא פרויקט הגיבוי הנפרד של אותו גמח.
- נווה יעקב לא נגיש דרך `.active-db` בכלל: זה מסד נפרד, שסקריפטים מגיעים אליו דרך `DATABASE_URL_ORG2` / `PROD_DATABASE_URL_ORG2`, דרך `scratch/new_gemach_db.env`, או בכלי סוכן התיקון עם `--org=2`.

## מבנה הריפו

- `app/` — עמודים (App Router) וראוטי API (`app/api/**/route.js`); `app/lib/` — קוד שתלוי ב-Next (חיבור Prisma, נדרים פלוס); `app/print/` — תצוגות הדפסה; `app/admin/` — מסכי ניהול.
- `components/` — רכיבים משותפים (בעיקר כרטיס ההזמנה, `components/orders/modern/`).
- `lib/` — הלוגיקה העסקית: תמחור, מלאי, סטטוס הזמנה, תאריכים עבריים, הרשאות, מיילים, AI.
- `prisma/` — `schema.prisma` (Postgres) ו-`schema.local.prisma` (מצב אופליין).
- `scripts/` — כלים קבועים: ייבוא מ-Access, גיבויים, כלי סוכן התיקון, הפעלת עמדת הלקוח במצב קיוסק.
- `public/` — קבצים סטטיים. `docs/` — תיעוד. `.claude/` — פקודות וסוכנים של Claude Code (`/fix-reports`, `/audit-system`). `.github/workflows/` — סוכן התיקון האוטומטי והגיבוי לדרייב.
- `scratch/` — עבודה זמנית (ברובה מחוץ ל-git). עשרות קובצי הסקריפטים שבשורש (`check_*.js`, `fix_*.js`, `test_*.js` ועוד) הם היסטוריה של הסבת הנתונים — לא חלק מהאפליקציה.

## איפה התיעוד

- [CLAUDE.md](CLAUDE.md) — המדריך הטכני: ארכיטקטורה, מערכות, כללים קבועים. לקרוא לפני כל שינוי.
- [AGENTS.md](AGENTS.md) — כללים קצרים לכל סוכן AI.
- [docs/README.md](docs/README.md) — אינדקס של כל המסמכים, עם סטטוס לכל אחד.
- [docs/journal-2026.md](docs/journal-2026.md) — יומן התקלות והפיצ'רים לפי תאריך.
- [docs/branches-and-worktrees.md](docs/branches-and-worktrees.md) — ענפים, עצי עבודה ופריסה.
- [docs/design-a5-pages.md](docs/design-a5-pages.md) — דפי העיצוב (A5) והרכזת שלהם.
- [CHANGELOG.md](CHANGELOG.md), [BACKUPS.md](BACKUPS.md) (גיבויים ושחזור), [EMAILS.md](EMAILS.md) (מיילים), [KIOSK.md](KIOSK.md) (עמדת לקוח).

## מערכת העיצוב

- **פלטת הרכיבים הממוספרת ("פלטת רכיבים") היא מערכת העיצוב הקבועה של האתר.** לכל רכיב מספר סידורי קבוע ("לחצן 12", "אייקון 23", "באנר 3"), ובו משתמשים כשמבקשים שינוי. אחרי מיזוג הענף `chore/v3-cleanup-2026-09-29` היא בתיקייה `design-system/` (הכללים ב-`design-system/README.md`) ומוצגת באתר בכתובת `/design-system/`.
- העמודים של היום עדיין מעוצבים בשכבה הישנה ("אריג": `app/design-system.css` + `app/design-overrides.css`).
- דפי העיצוב של A5 — סימולציות עם נתוני דוגמה — מרוכזים ברכזת `<<HUB_URL>>`; פירוט ב-[docs/design-a5-pages.md](docs/design-a5-pages.md).
- תכנית העיצוב v3 בוטלה ב-2026-09-29 ואין להחזיר אותה.

## פריסה

- כל push ל-`main` נפרס אוטומטית לשני הגמחים. עובדים בענף ובעץ עבודה נפרד, ומוזגים ב-PR — רק באישור הבעלים.
- ל-Vercel יש מגבלה של 100 פריסות ביום לכל החשבון. קומיט שלא נוגע בקבצי האפליקציה (למשל תיעוד בלבד) מדולג; `[force-deploy]` בהודעת הקומיט מכריח בנייה.
- שינוי סכימה: מריצים את ה-SQL ידנית על שני מסדי הייצור לפני הפריסה (`prisma db push` כותב רק למסד אחד).

---

## English summary

`gemach-app` is the management system of a dress-lending gemach (a free-loan society): customers, orders and rentals, dress inventory, payments and refunds, price lists, staff and shifts, internal messaging, reports, an AI assistant and a customer kiosk — in Hebrew, right-to-left. Next.js 16 (App Router), React 19 and Prisma 5 on Neon Postgres, deployed on Vercel.

- **Two organisations, one codebase:** `main` deploys to two Vercel projects — the main gemach (`gemach-app-uyh4-beryl.vercel.app`) and Neve Yaakov (`gmach-neve-yaakov.vercel.app`) — each with its own Neon database. Code is shared; business rules live in each database's `SystemSetting` rows.
- **Quick start:** Node 22.17+ → `npm install` → copy `.env`/`.env.local` from the main checkout (they are not in git) → `npm run dev`. In local dev, `.active-db` chooses `PROD_DATABASE_URL` (`prod`, the committed default — real production data) or `TEST_DATABASE_URL` (`test`); it is read once at startup and flipped from the dev banner (`POST /api/dev/switch-env`). The live sites switch databases through the `web_backup_mode` setting instead.
- **Docs:** start with [CLAUDE.md](CLAUDE.md) (architecture and standing rules), then [docs/README.md](docs/README.md). The design system is the numbered component palette (`design-system/`, after merge of `chore/v3-cleanup-2026-09-29`); the design reference pages are listed in [docs/design-a5-pages.md](docs/design-a5-pages.md).
