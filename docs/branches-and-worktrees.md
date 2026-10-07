# ענפים, עצי עבודה ופריסה

המדיניות החיה של הריפו. התמונה של "מה קיים עכשיו" נכונה ל-2026-09-29 (אחרי ניקוי v3) — לבדוק מחדש עם `git branch -a`, `git worktree list` ו-`gh pr list` לפני שמסתמכים עליה.

## הכלל הבסיסי

- **`main` = ייצור של שני הגמחים.** כל push ל-`main` בונה את שני פרויקטי ה-Vercel: `gemach-app-uyh4` (הגמ"ח הראשי) ו-`gmach-neve-yaakov` (נווה יעקב).
- כל עבודה נעשית בענף משלה ובעץ עבודה משלה, ונכנסת ל-`main` רק דרך PR. סוכן (Claude או אחר) לא דוחף ל-`main` ולא ממזג בלי אישור מפורש של בעל המערכת.
- סוכן התיקון האוטומטי (`.claude/commands/fix-reports.md`) תמיד פותח ענף `fix-reports/…` ו-PR ולעולם לא דוחף ל-`main`; רק בעל המערכת ממזג.

## שמות ענפים (הקידומות שבשימוש בפועל)

| קידומת | שימוש | דוגמה |
|---|---|---|
| `feature/` | פיצ'ר חדש **PR #191**, מוערם על PR #190 (עובר אוטומטית ל-`main` אחרי המיזוג שלו); ביקורת Fable: 4 תיקונים (הרשאות ב-saved-searches/history, הוק פונטי עם `undefined`, הצהרת 7 אינדקסי trigram ב-schema, תקרות לסריקות ב-`/api/a5/adv*`); `next build` עבר (עץ `wt-a5-clean`) |
| `fix/` | תיקון באג ידני | `fix/new-order-redirect-hang-and-double-approval` |
| `docs/` | תיעוד בלבד | `docs/overhaul-2026-09-29` |
| `chore/` | ניקיון ותחזוקה **PR #190** פתוח ל-`main` (עץ `wt-cleanup-0929`); ביקורת קוד+build וביקורת תיעוד עברו (2 תיקוני קוד, 7 תיקוני תיעוד) |
| `security/` | תיקון אבטחה | `security/redact-visitlog-request-bodies` |
| `fix-reports/` | ענפי סוכן התיקון האוטומטי | `fix-reports/main-gemach-kiosk-2026-09-24` |
| `fix-reports/org2-` | תיקון של הסוכן לנווה יעקב בלבד | `fix-reports/org2-2026-09-22-kiosk-and-deliveries` |

- הקידומת `fix-reports/` מחייבת: מייל הסיכום התקופתי מוצא את ה-PR-ים של הסוכן לפיה (`AGENT_BRANCH_PREFIX` ב-`lib/agentDigest.js`).
- `fix-reports/org2-…`: הסקריפט `scripts/vercel-ignore-build.sh` מדלג על בניית ה-Preview שלהם בפרויקט של הגמ"ח הראשי, כדי לחסוך מהמכסה היומית.
- מקובל לסיים את שם הענף בתאריך (`-YYYY-MM-DD`). קידומות ישנות שהופיעו בעבר לשימוש חד-פעמי: `integrate/`, `merge/`, `triage/`, `perf/`, `redesign/` (האחרונה — רק לעיצוב v3 שבוטל ולעיצוב מסך ההרשאות).

## עצי עבודה (worktrees)

- **לא עובדים בצ'קאאוט הראשי** (`C:\Users\moshe\Desktop\גמח שמלות חדש\gemach-app`): הוא בדרך כלל על ענף של סשן אחר, עם שינויים שלא נשמרו, ושרת הפיתוח המשותף (פורט 3000) רץ ממנו.
- לכל משימה עץ עבודה משלה בנתיב `C:\wt\wt-<name>`, שנוצר מ-`origin/main`:

  ```bash
  git -C "C:/Users/moshe/Desktop/גמח שמלות חדש/gemach-app" worktree add -b <branch> "C:/wt/wt-<name>" origin/main
  ```
- **`node_modules`** — junction לתיקייה של הצ'קאאוט הראשי (לא מתקינים מחדש):

  ```bat
  mklink /J "C:\wt\wt-<name>\node_modules" "C:\Users\moshe\Desktop\גמח שמלות חדש\gemach-app\node_modules"
  ```
- **`.env` ו-`.env.local`** — מעתיקים מהצ'קאאוט הראשי (הם לא ב-git).
- **`.active-db`** — לכל עץ עבודה קובץ משלו (ב-git הוא שמור עם `prod`). שרת פיתוח שרץ מעץ העבודה קורא את הקובץ שבעץ, ולכן אפשר לבדוק מול TEST בעץ נפרד בלי להזיז את השרת המשותף. זכרו: `prod` = נתוני האמת של הגמ"ח הראשי.
- **סקריפטים מעץ עבודה:** סקריפט שטוען `@prisma/client` דרך ה-junction מקבל מ-Prisma את ה-`.env` של הצ'קאאוט הראשי — כשמכוונים למסד אחר, מייצאים `PROD_DATABASE_URL` במפורש.
- **עץ עבודה חלקי (sparse)** חוסך מקום: `git worktree add --no-checkout …` ואחריו `MSYS_NO_PATHCONV=1 git sparse-checkout set --no-cone /app /lib /components /scripts /package.json /app/version.json …` (בלי `MSYS_NO_PATHCONV=1`, Git Bash הופך `/docs` לנתיב של Windows ושובר את התבניות). הוק ה-pre-commit מקדם גרסה ודורש `package.json`, `app/version.json` ו-`scripts/update_build_time.js` בעץ. לעולם לא מריצים `sparse-checkout` בצ'קאאוט הראשי.
- **מקום בדיסק:** ב-2026-09-24 כ-30 עצי עבודה עם `node_modules` ו-`.next` מילאו את כונן C עד 0 בתים. לבדוק `df -h /c` לפני עבודה עם הרבה סוכנים במקביל, ולא למחוק עץ עבודה של סשן אחר בלי לשאול (ייתכן שיש בו עבודה שלא נשמרה). בסוף עבודה מוחקים רק את העץ שלכם: `git worktree remove <path>`.
- **`desktop.ini`:** הריפו יושב בשולחן העבודה שמסונכרן ל-Google Drive, ו-Drive שותל קובצי `desktop.ini` גם בתוך `.git` — מה ששובר את git ("ignoring broken ref", `fatal: bad object refs/desktop.ini`). הטיפול: `find .git -iname desktop.ini -delete`; לא להגדיר `attrib +S` רקורסיבית בתוך `.git`.

## הענפים המשמעותיים (2026-09-29, אחרי הניקוי)

| ענף | מה יש בו | מצב |
|---|---|---|
| `feature/a5-clean-2026-09-29` | שחזור נקי של העבודה שאינה עיצוב מ-`feature/a5-home-dashboard-real`: חיפוש עמיד לאיות עברי (`lib/hebrewPhonetic.js`, `lib/searchUtils.js`, המודלים `SearchHistory`/`SavedSearch`, `/api/saved-searches`, `/api/search-history`, התכנית ב-`docs/smart-quick-search-plan-2026-09-27.md`); מפתחות API `gmk_` לכניסה בלי סיסמה (`/admin/site-settings/api-keys`, `/api/auth/api-key-login`, `lib/apiKeys.js`, טבלת `ApiKey`); דף הבית A5 מחובר לנתוני אמת (`public/a5/index.html` + `/api/a5/*`, טריגרים `@`/`#`/`$` בשורת החיפוש); ותקרה של 50 לרשימת החיפושים השמורים | מוכן ל-PR (עץ `wt-a5-clean`), נדחף ל-origin |
| `chore/v3-cleanup-2026-09-29` | הסרת מסלול התצוגה `/design-preview` וקובצי הסקיצות; התקנת פלטת הרכיבים כ-`design-system/` (+ `/design-system/`, אריח ב-`/admin/site`); כולל את `docs/overhaul-2026-09-29` (מוזג פנימה) | לקראת PR ל-main (עץ `wt-cleanup-0929`; נכון ל-2026-09-29 מקומי בלבד — טרם נדחף ל-origin ואין עדיין PR) |
| `docs/overhaul-2026-09-29` | ארגון מחדש של התיעוד | מוזג לתוך `chore/v3-cleanup-2026-09-29` (PR #190); הענף עצמו מקומי בלבד ואפשר למחוק אחרי המיזוג |
| PR #188 — `security/redact-visitlog-request-bodies` | לא לשמור פרטי התחברות מגוף הבקשה ב-`PageVisitLog` | PR פתוח |
| PR #177 — `fix/new-order-redirect-hang-and-double-approval` | ספינר אינסופי אחרי שמירת הזמנה חדשה כשההפניה היא לאותו מסלול + אישור מנהל כפול | PR פתוח |

### לפני פריסה של `feature/a5-clean-2026-09-29`

הענף מוסיף טבלאות ועמודות (`SearchHistory`, `SavedSearch`, עמודות ה-phonetic `firstNamePhoneticKey`/`lastNamePhoneticKey` ב-`Customer` וב-`Employee`, אינדקסי trigram, הרחבת `pg_trgm`, וטבלת `ApiKey`). **נבדק ב-2026-09-29 (שאילתות קריאה בלבד על information_schema):** כל אלה **כבר קיימים בשני מסדי הייצור** — org1 (הגמ"ח הראשי) ו-org2 (נווה יעקב), כולל אינדקסים ומפתחות זרים — ולכן **אין צורך ב-DDL לפני הפריסה**. במסד ה-TEST הם נוצרו באותו יום. עמודות phonetic ריקות בייצור הן של שמות שאינם בעברית (ריק בכוונה). הענף גם סוגר פער שנמצא בבדיקה: המפתחות הפונטיים מחושבים עכשיו בכל כתיבה של לקוח/עובד (קודם רק סקריפט backfill מילא אותם). אחרי המיזוג יש להוסיף ל-CLAUDE.md את `SearchHistory`/`SavedSearch` לרשימת המודלים שמוחרגים מרישום ההיסטוריה (הענף מוסיף אותם ל-`app/lib/prisma.js`).

- **`/a5` נשאר דף preview** (לא מקושר מהניווט): גם אחרי התקרות, חיפושי כספים/קיבולת/התראות עולים 5-20 שניות לקליק בגלל `/api/inventory/capacity` התורשתי (סורק את כל ה-`OrderItem` ההיסטוריים של הדגם/מידה בלי גבול תחתון על התאריך). לתקן שם לפני שהופכים את `/a5` לדף הבית.
- **סחף סכימה ידוע (לא מהענף הזה):** `ErrorReport.isArchivedByUser` קיים בשני מסדי הייצור ולא ב-`prisma/schema.prisma` — `prisma db push` או "החלת ה-diff" ימחקו אותה; להוסיף לסכימה לפני כל פעולה כזו. במסד ה-TEST חסרים `NedarimHok` ו-`ErrorReportReply.sketchHtml/sketchStatus`, ויש בו 4 טבלאות `Print*` עודפות.

- **קונפליקט צפוי ב-`CLAUDE.md`:** הענף מוסיף בסוף `CLAUDE.md` סעיף מתוארך "API keys - login without username/password (2026-09-28)", ואילו `docs/overhaul-2026-09-29` מקצר את `CLAUDE.md`. בפתרון הקונפליקט לוקחים את `CLAUDE.md` החדש (העובדות הקבועות על מפתחות ה-API כבר נמצאות בו, בסעיף "API keys"), ומעבירים את הסעיף המתוארך ליומן `docs/journal-2026.md` לפי התאריך — עם הערה שטבלת `ApiKey` כבר נוצרה בשני מסדי הייצור (בסעיף עצמו כתוב שעדיין לא).

### ענפים ועצי עבודה נוספים שעדיין קיימים (לא חלק מהניקוי — לבדיקת בעל המערכת)

- `feature/print-agent` (עץ `wt-print-agent`) — 6 קומיטים שלא מוזגו, בלי PR.
- `feature/neve-batch-2026-09-25` (עץ `wt-neve-batch-2026-09-25`), `feature/order-card-redesign-neve-2026-09-24` (עץ `wt-order-card-redesign`) — עבודה לנווה יעקב שלא מוזגה, בלי PR.
- שבעה ענפי `fix-reports/main-gemach-*-2026-09-24` (עצי `wt-fr-*`) ו-`docs/fix-reports-2026-09-24` (עץ `wt-fr-docs`) — סבב התיקונים של 24.9 לגמ"ח הראשי, מקומיים, בלי PR.
- `feature/admin-api-keys` (עץ `…\גמח שמלות חדש\wt-api-keys`) ו-`feature/smart-quick-search` (עץ `…\wt-smart-quick-search`) — הוחלפו ב-`feature/a5-clean-2026-09-29`; שמורים גם בגיבוי (למטה).
- `feature/a5-home-dashboard-real` (עץ `wt-a5-real`) — הוחלף ב-`feature/a5-clean-2026-09-29` ויימחק; שמור בגיבוי.
- הצ'קאאוט הראשי עומד על `feature/order-redirect-after-save`, שכבר מוזג (כ-PR #176, מענף ה-`-rebased`).
- עוד עשרות ענפים מקומיים ישנים (`fix/…`, `docs/…`, `integrate/…`, `pr*-local`, `worktree-agent-*`…), רובם מוזגו או הוחלפו. לפני מחיקה בודקים את ה-**diff** מול `main` (`git diff --stat main...<branch>`), לא את מספר הקומיטים — ענף "מקדים" יכול להיות ישן ולהחזיר קוד אחורה.

## ענפי v3 ועצי העבודה שנמחקים (2026-09-29)

עיצוב v3 בוטל (הסבר: [design-a5-pages.md](design-a5-pages.md)). נמחקים — מקומית, ב-origin ועם עצי העבודה שלהם:

- `redesign/site-v3-2026-09-24`, `redesign/site-v3-darkmodals`, `redesign/site-v3-shellfix`, `redesign/site-v3-pages-modals`, `redesign/site-v3-reports-icons`
- `redesign/v3-home-edit`, `redesign/v3-proto-login`, `redesign/v3-proto-tables`, `redesign/v3-protos-curated`, `redesign/v3-admin-rollout-2026-09-27`
- `feature/a5-home-dashboard-real` — הוחלף ב-`feature/a5-clean-2026-09-29`
- ענפי סקיצות התצוגה של נווה יעקב שכבר מוזגו (PR-ים #178–#186): `feature/neve-design-sketches-2026-09-24`, `feature/neve-sketch-b-final2`, `feature/neve-sketch-b3-avail`, `feature/neve-sketch-b6`, `feature/neve-sim-final`, `feature/neve-final-7`, `feature/neve-final-8`, `feature/neve-final-9`, `feature/neve-final-10`. הקוד שלהם ב-`main` (`app/design-preview/`, `lib/design-preview/*.html`) מוסר בענף `chore/v3-cleanup-2026-09-29`.
- עצי העבודה: `wt-redesign-v3`, `wt-v3-darkmodals`, `wt-v3-modals`, `wt-v3-shellfix`, `wt-admin-v3`, `wt-a5-real`.

## הגיבוי: `_archive-v3-2026-09-29`

התיקייה `C:\Users\moshe\Desktop\גמח שמלות חדש\_archive-v3-2026-09-29\` (בתיקיית הפרויקט, ליד `gemach-app`, מחוץ לריפו):

- `v3-and-a5-branches.bundle` (כ-137MB) — ה-heads של כל הענפים שברשימה למעלה, וגם `feature/admin-api-keys` ו-`feature/smart-quick-search`. ה-bundle מכיל היסטוריה מלאה, כך שאפשר לשחזר ממנו גם לשכפול חדש.
- קובצי הסקיצות וה-HTML של v3 (`order-card-sketch-A.html`, `order-card-sketch-B.html`, `order-card-v3.html` ועוד), המוקאפים הישנים של `scratch/design-v2` (`design-v2-mocks-2026-08/`), וטלאי/קבצים של שינויים שלא נשמרו בעץ `wt-v3-modals`.

שחזור (לעיון בלבד — לא ממזגים את v3 חזרה):

```bash
B="C:/Users/moshe/Desktop/גמח שמלות חדש/_archive-v3-2026-09-29/v3-and-a5-branches.bundle"
git bundle verify "$B"          # "The bundle records a complete history."
git bundle list-heads "$B"      # רשימת הענפים שבגיבוי
# ענף אחד בשם חדש:
git fetch "$B" refs/remotes/origin/redesign/site-v3-2026-09-24:refs/heads/restored/site-v3-2026-09-24
# הכל, במרחב שמות נפרד:
git fetch "$B" "refs/*:refs/archive-v3/*"
```

## פריסה

- **מגבלת Vercel:** בחשבון Hobby מותרות 100 פריסות ביום לכל החשבון (כל הפרויקטים יחד, כולל פרויקטים שאינם של הגמ"ח), בחלון מתגלגל. כל push לענף עם PR בונה Preview בשני הפרויקטים, וכל מיזוג ל-`main` בונה שני Production. כשהמכסה נגמרת, סטטוס הקומיט הוא "Deployment rate limited — retry in 24 hours" — אין עקיפה בקוד, מחכים (או משדרגים תוכנית — החלטה של בעל המערכת).
- **דילוג על בנייה:** `vercel.json` → `ignoreCommand` → `scripts/vercel-ignore-build.sh`. מדלג על `fix-reports/org2-*` בפרויקט של הגמ"ח הראשי, ועל כל קומיט שלא נגע באף אחד מאלה: `app`, `components`, `lib`, `prisma`, `public`, `package-lock.json`, `next.config.mjs`, `middleware.js`, `jsconfig.json`, `vercel.json` (בלי `app/version.json`; `package.json` לבדו לא נחשב, כי ההוק מעדכן אותו בכל קומיט).
- **`[force-deploy]`** בהודעת הקומיט מכריח בנייה. קומיט "פריסה מחדש" שרק מקדם גרסה — בלי `[force-deploy]` — מדולג. זה בדיוק מה שקרה ל-`3b5b63c2` ("Redeploy: error-report file attachments", 2026-09-25): לפי סטטוסי הקומיט ב-GitHub שני הפרויקטים דיווחו "Canceled by Ignored Build Step", ושני הקומיטים שלפניו (PR #189) נחסמו במגבלה היומית. כלומר, לפי הסטטוסים, קובצי המצורפים בדיווחי שגיאות (PR #189) עוד לא נפרסו באף גמח (הפריסה המוצלחת האחרונה מ-git: `1060e1b1` בגמ"ח הראשי, `6f97640e` בנווה יעקב) — המיזוג הבא שנוגע בקוד יעלה אותם.
- **"מוזג" ≠ "באוויר":** בודקים `gh api repos/moshehik/gemach-app/commits/<sha>/status` לפני שמניחים שקוד נמצא באתר.
- **פריסה רק דרך git** (PR → `main`), לא `vercel --prod` מעץ עבודה — פריסת CLI מעץ משותף כבר העלתה פעם לייצור קוד שהיה באמצע עבודה.
- **Preview:** האם ל-Preview יש `DATABASE_URL` תקין מתועד בצורה סותרת (`fix-reports.md` אומר שה-Preview עובד מול מסד הייצור; רשומת 2026-09-22 ביומן מצאה Preview בלי `DATABASE_URL`; ביקורת המשאבים מ-20.9 מונה ל-Preview כתובות ישנות). לבדוק את משתני ה-Preview בפרויקט לפני שסומכים על Preview בשום דבר שנוגע במסד.
- **שינוי סכימה:** `prisma db push` כותב רק למסד אחד (זה שב-`DATABASE_URL`), ושני הגמחים הם מסדים נפרדים. לפני שהקוד נפרס:
  1. מפיקים SQL: `npx prisma migrate diff --from-url "<db url>" --to-schema-datamodel prisma/schema.prisma --script` (מול הסכימה של הקומיט שנפרס, לא עץ מלוכלך).
  2. מריצים אותו ידנית על מסד הייצור של הגמ"ח הראשי ועל של נווה יעקב (סקריפט שבודק host), ועל מסדי ה-TEST/גיבוי אם עובדים מולם.
  3. מריצים שוב את ה-diff על שניהם — צריך לצאת ריק. נווה יעקב כבר נשאר מאחור בעבר (שגיאות P2022 בדפים חיים).
- **שינוי הגדרות:** לפי גמח — הנוהל המלא ב-CLAUDE.md → Standing rules → Settings & the two orgs.
