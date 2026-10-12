# הגדרות הקפצת פרטי בנק בזיכוי — 12.10.2026

סטטוס: **קוד בענף מקומי `feature/credit-bank-prompt-settings` (קומיט `4d008646`, worktree `C:\wt\wt-bank-prompt-settings`), לא נדחף ולא פרוס. שורות ההגדרות ב-DB לא נוצרו.**

## ההגדרות (SystemSetting, בוליאניות, קטגוריה "תשלומים")
| מפתח | ברירת מחדל (בקוד כשהשורה חסרה) | משמעות |
|---|---|---|
| `credit_bank_prompt_auto` | **דולק** (= ההתנהגות הקיימת) | אחרי שמירה/יציאה מהזמנה עם זיכוי אוטומטי בלי פרטי בנק נפתח חלון "פרטי בנק". כבוי = לא נפתח לבד (אפשר ידנית מלשונית התשלומים). |
| `credit_bank_details_required` | **כבוי** (= אופציונלי) | דולק = החלון האוטומטי לא נסגר ב-Esc/רקע, אין "אמלא מאוחר יותר", והיציאה מההזמנה חסומה בכל ניסיון עד שנשמרו בנק וסניף. פתיחה ידנית נשארת רגילה. |

## איפה ממומש
- כרטיס חדש (A5, נווה יעקב): `orderCardLogic.js` (parseSettings), `orderCardFlows.js` (שמירה + יציאה), `usePaymentActions.js` (`openBank` — `forced`/`dismissable`), `OcBankDialog.js`.
- כרטיס ישן קפוא (גמ"ח ראשי): `LegacyOrderPage.js` (**ה-SHA ב-`scripts/order-card-tests/static.test.mjs` עודכן**), `ModernPaymentsManager.js` (prop `bankRequired`).
- ניהול: `lib/settingsMetadata.js`, `lib/settingsSimLayout.js`.
- בדיקות מקור: `scripts/order-card-tests/credit-bank-prompt.static.test.mjs` (4 עוברות; `PROJ=<root> node --test ...`).

## העלאה
1. לדחוף + PR. (מומלץ למזג אחרי `fix/delivery-lost-on-add-dress` — עד אז החלונית קופצת גם על זיכויים שגויים בנווה יעקב; ר' `docs/delivery-total-and-credit-fix-2026-10-12.md`.)
2. אחרי הפריסה, כדי שההגדרות יופיעו במסך הניהול, להריץ **באישור הבעלים**: `node scripts/seed_credit_bank_prompt_settings.js --org=1|2 [--write]` (dry-run כברירת מחדל; לא דורס ערכים קיימים; בדיקת host מובנית). הערכים ההתחלתיים משאירים את ההתנהגות כמו היום.
3. הפעלת "חובה" לגמ"ח מסוים = שינוי הגדרה ב-DB של אותו גמ"ח בלבד (לא תיקון קוד).

## לא נבדק
אין `node_modules` ב-worktree והדיסק כמעט מלא — נבדק תחביר JSX ובדיקות מקור בלבד; לא נראה בדפדפן. לפני הפעלת "חובה": לאמת בכרטיס אמיתי שהחלון לא נסגר ושהיציאה חסומה ואז משתחררת אחרי שמירה.
