# חוזה עמוד: `/dashboard` (אזור ניהול - סיכומים ופילוחים)

מקור: `app/dashboard/page.js` (Server Component, `export const dynamic = 'force-dynamic'`), `app/dashboard/DashboardCharts.js` (עטיפה דינמית, `ssr:false`), `app/dashboard/DashboardChartsImpl.js` (recharts).
הערה: `app/dashboard/LogoSettings.js` קיים בתיקייה אך **לא מיובא בשום מקום** (grep) - קוד מת, לא חלק מהעמוד. אין לבנות אותו מחדש.

## (א) מטרה + גישה
- מטרה: לוח סיכומי הכנסות חברה-רחב: 4 KPI + 4 גרפים.
- גישה: **בתוך ה-page עצמו** (page.js:18): `checkPageAccess(HEAD_MANAGEMENT_ROLES)` = roleId `[0, 2]` (הנהלה ראשית + מתכנת; מנהל סניף roleId 1 חסום). אין layout ל-`/dashboard` (בכוונה, כי `/dashboard/dresses` פתוח לצוות). כשל -> `<NoAccessMessage />` (`app/components/NoAccessMessage.js`: h1 "אין הרשאת גישה", h2 "אין לך הרשאה לצפות בעמוד זה", כפתור Link `/` "חזרה לדף הבית").
- מפתח קטלוג הרשאות (`lib/permissionsMetadata.js:260`): `page:dashboard` - רק תיעודי; האכיפה בפועל ב-page.js (לא דרך `PageGate`).

## (ב) מבנה לפי סדר
1. `.page-head` > h1 "אזור ניהול - סיכומים ופילוחים" (page.js:123-127). אין כפתורי page-actions.
2. `h2.section-title` "מדדים מרכזיים" + `.kpi-grid` עם 4 `.kpi-card` (page.js:129-170).
3. `h2.section-title` "פילוח נתונים" + `<DashboardCharts>` = `.form-grid` (marginTop 1.5rem) עם 4 כרטיסי `.card` (גובה גרף קבוע 300px).

## (ג) שדות / קלט
אין שום שדה קלט, פילטר או בורר בעמוד. הכל תצוגה בלבד.

## (ד) כפתורים / פעולות
אין כפתורים. אינטראקציה יחידה: hover Tooltip של recharts (formatter `₪${value}`), Legend (בגרפי העמודות) - לא לחיץ מחוץ ל-recharts.

## (ה) קריאות רשת ונתונים
אין `fetch` מהלקוח, אין `pageCache`/`apiCache`. הכל שאילתות Prisma בשרת (`Promise.all`, page.js:27-61), `import prisma from '../lib/prisma'`:
| משתנה | שאילתה | שימוש |
|---|---|---|
| `totalCustomers` | `customer.count({where:{isDeleted:false}})` | KPI "לקוחות פעילים" |
| `totalEmployees` | `employee.count({where:{isActive:true}})` | KPI "עובדים פעילים" |
| `totalOrders` | `order.count()` (ללא סינון - כולל מבוטלות/מחוקות) | KPI "סה"כ הזמנות" |
| `revenueAggregation` | `payment.aggregate({where:{isDeleted:false}, _sum:{amount}})` (סכום נטו: זיכוי = amount שלילי) | KPI "סה"כ הכנסות": `totalRevenue = _sum.amount \|\| 0` |
| `paymentMethodsStats` | `payment.groupBy({by:['paymentMethod'], where:{isDeleted:false,isRefund:false}, _sum:{amount}, _count:{id}})` | גרף עוגה. `method = paymentMethod \|\| 'לא מוגדר'`, `amount = _sum.amount \|\| 0`, `count`, ממוין `amount` יורד |
| `recentPayments` | `payment.findMany({select:{paymentDate,amount}, where:{isDeleted:false, paymentDate:{gte: trendSince}}, orderBy:{paymentDate:'desc'}})`, `trendSince = now - 13 חודשים` (`setMonth(-13)`) | שלושת גרפי המגמה |

חישובי מגמה (page.js:71-119) - **אסור לשנות**:
- יומי: מפתח `paymentDate.toISOString().split('T')[0]` (UTC!), סכום `amount||0`, `sort()`, `slice(-30)` -> `{date, revenue}`.
- שבועי: `weekStart = new Date(d); setDate(getDate() - getDay())` (יום ראשון, TZ של השרת), מפתח ISO-date, `slice(-12)` -> `{week, revenue}`.
- חודשי: `${getFullYear()}-${MM}` (`getMonth()+1` padStart 2, TZ שרת), `slice(-12)` -> `{month, revenue}`.
- תשלום ללא `paymentDate` מדולג.
- החזרים כן נכללים בגרפי המגמה וב-KPI (נטו), אך **לא** בעוגה (`isRefund:false`).

## (ו) מודלים/פופאפים/טוסטים
אין. (הגרף נטען עם skeleton `ChartsSkeleton`, ר' ז.)

## (ז) מצבים מיוחדים
- טעינה: `DashboardCharts` = `next/dynamic(() => import('./DashboardChartsImpl'), {ssr:false, loading: ChartsSkeleton})`; הסקלטון = 4 כרטיסים באותן כותרות עם `.loading-inline` + `.spinner` "טוען גרף..." בגובה 300px (למניעת layout-jank). recharts (~400KB) לא בחבילה הבסיסית.
- ריק: אין טיפול מפורש. ערכים 0 -> KPI מציג `₪0`; מערך ריק -> recharts מצייר צירים ריקים/עוגה ריקה, ללא הודעת "אין נתונים".
- שגיאה: אין try/catch - חריגת Prisma = דף שגיאה של Next.
- אין offline/read-only/setting-driven. אין תלות ב-SystemSetting ואין הבדל בין org1/org2 בקוד (ההבדל רק בנתוני ה-DB).
- הערה עסקית (הערה בקוד): `Order.totalAmount/paymentMethod/paymentDate` ריקים בהזמנות חיות - **לכן ההכנסות מטבלת `Payment` בלבד**.

## (ח) URL params / storage
אין query params, אין localStorage/sessionStorage.

## (ט) הדפסה / ייצוא / AI
אין.

## פירוט KPI (סדר, אייקון, צבע)
| # | label | ערך | אייקון sprite | tint / צבע |
|---|---|---|---|---|
| 1 | סה"כ הכנסות | `₪{totalRevenue.toLocaleString()}` | `#i-coin` | `--success-tint`/`--success` |
| 2 | לקוחות פעילים | `totalCustomers.toLocaleString()` | `#i-users` | `--info-tint`/`--info` |
| 3 | סה"כ הזמנות | `totalOrders.toLocaleString()` | `#i-bag` | `--primary-tint`/`--primary` |
| 4 | עובדים פעילים | `{totalEmployees}` (בלי toLocaleString) | `#i-user-check` | `--warning-tint`/`--warning` |

## פירוט גרפים (DashboardChartsImpl.js)
`COLORS = ['var(--primary-solid)','var(--success)','var(--info)','var(--accent)','var(--danger)']` (מחזורי, לפי index).
1. כותרת "התפלגות הכנסות לפי אמצעי תשלום", אייקון `#i-wallet`: `PieChart`/`Pie` `dataKey="amount"` `nameKey="method"` `cx/cy 50%` `outerRadius=100` `labelLine=false`, label `${method} (${(percent*100).toFixed(0)}%)`, `Cell` צבע לפי index, `Tooltip formatter ₪${value}`. אין Legend.
2. "הכנסות לפי תאריך תשלום (תקופה אחרונה)" `#i-activity`: `BarChart` data=`revenueTrend`, `XAxis dataKey="date"`, `YAxis`, `Tooltip`, `Legend`, `Bar dataKey="revenue" name="הכנסות (₪)" fill=--primary-solid radius [4,4,0,0]`, margin `{top5,right30,left20,bottom5}`.
3. "הכנסות שבועיות (תקופה אחרונה)": כנ"ל, `XAxis dataKey="week"`, fill `--info`.
4. "הכנסות חודשיות (תקופה אחרונה)": כנ"ל, `XAxis dataKey="month"`, fill `--success`.
מבנה כרטיס: `.card` > `.card-head` > `.card-title-row` (svg.icon + h3) ; `.card-pad` > div גובה 300px > `ResponsiveContainer 100%x100%`.

## (י) מלל (עברית)
אזור ניהול - סיכומים ופילוחים · מדדים מרכזיים · סה"כ הכנסות · לקוחות פעילים · סה"כ הזמנות · עובדים פעילים · פילוח נתונים · התפלגות הכנסות לפי אמצעי תשלום · הכנסות לפי תאריך תשלום (תקופה אחרונה) · הכנסות שבועיות (תקופה אחרונה) · הכנסות חודשיות (תקופה אחרונה) · הכנסות (₪) · טוען גרף... · לא מוגדר · אין הרשאת גישה · אין לך הרשאה לצפות בעמוד זה · העמוד המבוקש מוגבל להרשאות מסוימות בלבד. אם לדעתך זו טעות, פנה/י למנהל המערכת. · חזרה לדף הבית.

## (יא) Risk notes
1. חשבון נטו (זיכויים שליליים) ב-KPI ובגרפי מגמה vs. אי-הכללת `isRefund` בעוגה - עיצוב מחדש אסור "לתקן" את זה (R8).
2. מפתחות תאריך: יומי/שבועי לפי UTC/TZ שרת (לא `getIsraelDayRange`) - שינוי יזיז סכומים בין ימים. לא לגעת.
3. הגרפים חייבים להישאר client-only דינמיים (recharts); עמוד מעוצב מחדש חייב לשמר `dynamic ssr:false` + skeleton בגובה זהה. צבעי `var(--...)` עוברים ל-tokens של v3 - יש למפות (אחרת גרף ללא צבע).
4. ה-page הוא Server Component; עיצוב מחדש חייב להשאיר את שאילתות ה-Prisma ואת הגארד בשרת (לא להפוך ל-'use client').
5. `Legend` בגרפי עמודות ו-`Tooltip formatter` מחרוזת `₪${value}` בלי פורמט אלפים - שינוי פורמט = שינוי התנהגות גלוי.
6. KPI 4 ללא `toLocaleString`, KPI 1-3 עם - חוסר עקביות קיים.
7. `LogoSettings.js` יתום - לא לכלול, לא למחוק בלי אישור.
8. RTL: recharts XAxis/YAxis לא הופכים ב-RTL אוטומטית (התנהגות נוכחית: כיוון LTR פנימי). יש לאמת חזותית, לא לשנות נתונים.
