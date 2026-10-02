# אינדקס התיעוד

כל מסמכי הריפו, מקובצים לפי תפקיד, עם שורת תיאור וסטטוס. מקרא הסטטוס: **עדכני** (current — מקור אמת היום), **פרוטוקול** (protocol — איך עושים משהו, חוזר על עצמו), **תכנית** (plan), **היסטורי** (historical — תיעוד של מה שקרה בתאריך מסוים; עובדות בו יכולות להיות מיושנות — הכללים שעדיין בתוקף רוכזו ב-[CLAUDE.md](../CLAUDE.md) → Standing rules). קבצים שמסומנים "אחרי מיזוג" עוד לא קיימים ב-`main`.

## להתחיל כאן

| קובץ | מה יש בו | סטטוס |
|---|---|---|
| [CLAUDE.md](../CLAUDE.md) | המדריך הטכני: שני הגמחים, פקודות, ארכיטקטורה, מערכות, עיצוב, ענפים, כללים קבועים | עדכני |
| [AGENTS.md](../AGENTS.md) | כללי Next 16, כלל תצוגת המזהים, חמשת הכללים החשובים לסוכנים (נטען גם מתוך CLAUDE.md) | עדכני |
| [README.md](../README.md) | מה המערכת, שני הגמחים, התחלה מהירה, PROD/TEST ו-`.active-db` (עברית + תקציר באנגלית) | עדכני |
| [docs/README.md](README.md) | האינדקס הזה | עדכני |
| [CHANGELOG.md](../CHANGELOG.md) | יומן שינויים לפי תאריך, בשפה של בעל המערכת | עדכני (נכתב לפי תאריך) |

## עיצוב

| קובץ | מה יש בו | סטטוס |
|---|---|---|
| [docs/design-a5-pages.md](design-a5-pages.md) | דפי העיצוב A5 (סימולציות), הקישורים והמזהים, כיוון אשף ההזמנה שנבחר, פלטת הרכיבים, למה v3 בוטל | עדכני |
| `design-system/README.md` | כללי מערכת העיצוב (פלטת הרכיבים הממוספרת) — אחרי מיזוג `chore/v3-cleanup-2026-09-29` | עדכני (אחרי מיזוג) |
| `design-system/COMPONENTS.md` | הקטלוג הממוספר ("לחצן 12", "אייקון 23"…) — אחרי מיזוג `chore/v3-cleanup-2026-09-29` | עדכני (אחרי מיזוג) |
| `design-system/build/README.md` | צינור הבנייה של הפלטה (סריקת הדפים החיים → CSS → קטלוג → התקנה) ומרשם המספרים `numbers.json` — אחרי מיזוג `chore/v3-cleanup-2026-09-29` | פרוטוקול (אחרי מיזוג) |

## תפעול, מדיניות ופרוטוקולים

| קובץ | מה יש בו | סטטוס |
|---|---|---|
| [docs/branches-and-worktrees.md](branches-and-worktrees.md) | מדיניות ענפים, עצי עבודה ופריסה; הענפים הפעילים; ענפי v3 שנמחקו והגיבוי שלהם | עדכני |
| [BACKUPS.md](../BACKUPS.md) | שלוש שכבות הגיבוי, שחזור, מכסת התעבורה של Neon, משימות Windows | עדכני |
| [EMAILS.md](../EMAILS.md) | כל 16 המיילים של המערכת, הספרייה האחידה, מסך בדיקת המיילים | עדכני |
| [KIOSK.md](../KIOSK.md) | עמדת הלקוח: נעילה בתוך האתר ומצב קיוסק של Windows | עדכני |
| [docs/fix-protocol-error-reports.md](fix-protocol-error-reports.md) | פרוטוקול תיקון דיווחי שגיאות + סבבי התיקון (סעיפים ממוספרים, חלקם היסטוריים) | פרוטוקול |
| [docs/agent-pending-approval-queue.md](agent-pending-approval-queue.md) | תור ה-PR-ים שהסוכן פתח גם לגמח שלא ביקש, לאישור מרוכז | פרוטוקול |
| [docs/full-wipe-reimport-protocol.md](full-wipe-reimport-protocol.md) | מחיקה מלאה והעלאה מחדש מ-Access לגמח אחד, כולל המלכודות | פרוטוקול |
| [.claude/commands/fix-reports.md](../.claude/commands/fix-reports.md) | ההוראות של סוכן התיקון האוטומטי (`/fix-reports`) | פרוטוקול |
| [.claude/commands/audit-system.md](../.claude/commands/audit-system.md) + `.claude/agents/audit-*.md` | מערכת 11 סוכני הביקורת (`/audit-system`) | פרוטוקול |
| [scripts/ai-reliability/README.md](../scripts/ai-reliability/README.md) | רתמת בדיקה לקריאה בלבד לסוכני ה-AI | פרוטוקול |

## מקור אמת לנושא מסוים

| קובץ | מה יש בו | סטטוס |
|---|---|---|
| [docs/refund-swap-policy-2026-09-22.md](refund-swap-policy-2026-09-22.md) | כללי החלפה/ביטול/זיכוי לשני הגמחים, כל הגדרה וערכה בכל גמח | עדכני |
| [docs/permissions-settings-mapping-2026-09-22.md](permissions-settings-mapping-2026-09-22.md) | מיפוי ההגדרות להרשאות, ושורות `DepartmentPermission` שנכתבו לשני מסדי הייצור (לא למחוק בלי לקרוא) | עדכני |
| [docs/gas-mailer-live.gs](gas-mailer-live.gs) | העתק של סקריפט המייל החי ב-Apps Script ("מערכת מייל פתוח") | עדכני |
| `docs/smart-quick-search-plan-2026-09-27.md` | תכנית החיפוש העמיד לאיות עברי וטריגרי `@`/`#`/`$` — אחרי מיזוג `feature/a5-clean-2026-09-29` | תכנית (אחרי מיזוג) |
| `docs/menu-a5-build-plan.md` | התפריט החדש (A5): טבלת מיפוי של כל פריט בעיצוב המאושר למה שקיים בקוד, הדגל `ui_variant_shell`, המודולים הטהורים `lib/menu/*`, הנחיות לבניית הממשק, שאלות פתוחות — ענף `feature/menu-a5-2026-10-01` | תכנית (אחרי מיזוג) |
| `docs/api-key-table.sql` | ה-SQL של טבלת `ApiKey` — אחרי מיזוג `feature/a5-clean-2026-09-29` | עדכני (אחרי מיזוג) |

## היסטוריה

| קובץ | מה יש בו | סטטוס |
|---|---|---|
| [docs/journal-2026.md](journal-2026.md) | כל הרשומות המתוארכות שהיו ב-CLAUDE.md (אוגוסט–ספטמבר 2026), לפי סדר כרונולוגי, מילה במילה | היסטורי |
| [docs/stock-check-logic-spec.md](stock-check-logic-spec.md) | דף "בדיקת מלאי" (`/stock-check`): החוזה של `GET /api/stock-check` ו-`/options`, כללי המידות (±2, "וגם", נרמול כתיב), הרשאה, הבדיקות | פעיל |
| [docs/future-work.md](future-work.md) | תזכורות לעבודה עתידית ותלויות בין עבודות (למשל מה ישתנה בבדיקות הלו"ז כש-כלל ימי העבודה גרסה 2 ימוזג) — לקרוא לפני עבודה בתחומים שמופיעים בו | עדכני |
| [docs/perf-round-a-summary-2026-08-26.md](perf-round-a-summary-2026-08-26.md) | סבב ביצועים א': מטמון הגדרות, אינדקסים ב-DB | היסטורי |
| [docs/perf-round-b-instructions-2026-08-26.md](perf-round-b-instructions-2026-08-26.md) | הוראות סבב ביצועים ב' (מצב הביצוע לא מתועד — לבדוק מול הקוד) | תכנית |
| [docs/neve-yaakov-full-reimport-2026-09-15.md](neve-yaakov-full-reimport-2026-09-15.md) | הריצה של מחיקה והעלאה מחדש בנווה יעקב וה-cutover | היסטורי |
| [docs/deliveries-feature-plan-2026-09-16.md](deliveries-feature-plan-2026-09-16.md) | תכנית פיצ'ר המשלוחים; כל הסעיפים מומשו ב-2026-09-16 | היסטורי |
| [docs/neon-quota-error-report-poll-2026-09-17.md](neon-quota-error-report-poll-2026-09-17.md) | חריגת מכסת Neon, נפילת הגמ"ח הראשי ב-18.9, ונוהל מיזוג ה-delta מהפרויקט הישן (סבב שישי) | היסטורי (הנוהל עדיין פתוח) |
| [docs/ai-agents-reliability-2026-09-20.md](ai-agents-reliability-2026-09-20.md) | אמינות סוכני ה-AI: ממצאים, תיקונים, אימות | היסטורי |
| [docs/email-fixes-2026-09-20/README.md](email-fixes-2026-09-20/README.md) | תלונת המייל של נווה יעקב (17–18.9) — סיכום וטבלת אימות | היסטורי |
| [docs/email-fixes-2026-09-20/01-barcode-mismatch.md](email-fixes-2026-09-20/01-barcode-mismatch.md) | השכרה בברקוד שלא תואם לפריט שהוזמן | היסטורי |
| [docs/email-fixes-2026-09-20/02-edit-unlock-and-print-page-numbers.md](email-fixes-2026-09-20/02-edit-unlock-and-print-page-numbers.md) | פתיחת עריכת פריט + "עמוד X מתוך Y" בהדפסה | היסטורי |
| [docs/email-fixes-2026-09-20/03-deliveries-by-event-date.md](email-fixes-2026-09-20/03-deliveries-by-event-date.md) | משלוחים לפי תאריך האירוע + תוספות לדף "לשקית" | היסטורי |
| [docs/handoff-file-storage-and-recording-2026-09-20.md](handoff-file-storage-and-recording-2026-09-20.md) | הקלטת מסך (מאקרו + דרייב), דיווחי שגיאות, איפה נשמרים קבצים | היסטורי |
| [docs/permissions-security-audit-2026-09-20.md](permissions-security-audit-2026-09-20.md) | בדיקה חיה של מערכת ההרשאות וחורי האבטחה שנסגרו | היסטורי (כולל פריטים פתוחים) |
| [docs/vercel-resource-audit-2026-09-20.md](vercel-resource-audit-2026-09-20.md) | ביקורת משאבי Vercel/Neon, התיקונים, וטבלת המצביעים ל-DB (נכונה ל-20.9) | היסטורי |
| [docs/feedback-batch-2026-09-22.md](feedback-batch-2026-09-22.md) | 13 סעיפי משוב — משלוחים הם של נווה יעקב בלבד | היסטורי |
| [docs/permissions-wiring-audit-2026-09-22.md](permissions-wiring-audit-2026-09-22.md) | האם כל פריט הרשאה באמת מחובר | היסטורי |
| [docs/GAS_DRIVE_SETUP_HE.md](GAS_DRIVE_SETUP_HE.md) | שליחת קבצים לדרייב דרך GAS — תכנית שמעולם לא נפרסה | היסטורי |
| [docs/gas-mail-drive.gs](gas-mail-drive.gs) | גרסת סקריפט מייל+דרייב שמעולם לא נפרסה (החי: `gas-mailer-live.gs`) | היסטורי |
| `final_diffs.md`, `final_diffs_v3.md`, `final_diffs_v4.md` (בשורש) | טבלאות השוואת שדות בין Access למערכת מיולי 2026 (ה-"v3" בשם הוא גרסת הטבלה, לא עיצוב v3) | היסטורי |

## כפילויות

נבדק ב-2026-09-29 (`git ls-files -s docs` והשוואת ה-hash של כל קובץ): אין ב-git קבצים כפולים זהים תחת `docs/` או בקובצי ה-`.md`. עותקי "(1)" שמופיעים בצ'קאאוט הראשי הם כפילויות של Google Drive שאינן ב-git — לא חלק מהריפו.
