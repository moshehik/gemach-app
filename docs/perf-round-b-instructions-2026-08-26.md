# הוראות סבב ב' — תיקוני ביצועים המשך (לפי audit-performance 26.08.2026)

> סבב א' סגר: `SystemSetting` cache (70k seq), `pg_trgm` 4x GIN על Customer, 5 אינדקסי מלאי partial, השארת `pg_stat_statements`. סבב ב' מטפל ב-9 ממצאים שנותרו — כולם `app/api/**/route.js` / `lib/**`.

## סדר ביצוע מומלץ (גבוה → נמוך)

### B1. לסיים מטמון SystemSetting — ~15 קריאות עדיין עוקפות cache [גבוה]
**למה:** הסתיים 60%, אבל `audit-performance` מצא עוד קריאות ישירות:
```
lib/pricingEngine.js:388  findMany IN SETTING_KEYS
app/api/orders/[id]/route.js:108  findMany IN RECALC_SETTING_KEYS
                                :313  findMany inventory_* 
app/api/orders/[id]/items/route.js:47  findMany (ללא where) — Seq Scan!
app/api/orders/[id]/items/[itemId]/route.js:84  findMany (ללא where)
app/api/deliveries/route.js:55  findMany with where category
app/api/inventory/preload/route.js:35  findMany IN 4 keys (כבר indexed אבל עדיין DB round-trip)
app/api/send-email/route.js:53  findMany
app/api/error-report/route.js:142  findMany
lib/inventory_test.js:246,477  (test only — נמוך)
```

**מה לעשות:**
```js
// בכל קובץ מעל:
import { getAllCachedSettings, getCachedSetting } from '@/lib/settingsCache';
// להחליף:
// prisma.systemSetting.findMany() → await getAllCachedSettings()
// prisma.systemSetting.findMany({where:{key:{in: [...]}}}) → (await getAllCachedSettings()).filter(s=>keys.includes(s.key))
// prisma.systemSetting.findUnique({where:{key}}) → await getCachedSetting(key)
```
דוגמה ל-`deliveries/route.js:55` (יש where על category — לסנן ב-JS אחרי cache):
```js
const all = await getAllCachedSettings();
const settingsRows = all.filter(s => s.category === 'deliveries');
```
**אימות:** `grep -r "systemSetting.find" app lib` → אמור להישאר רק `app/api/settings/route.js` (כותב) + `app/lib/prisma.js` (cache עצמו).

---

### B2. `app/api/orders/route.js:219` + `:252` — `findMany` ללא `take` על `Order` [גבוה]
**בעיה:** סינון `unpaid` / `smartRentals` טוען לזיכרון את כל ההזמנות התואמות `where` ללא pagination, מסנן `totalPaid < totalAmount` ב-JS. עם 27k הזמנות + `threeMonthsAgo` זה MBs + Seq Scan 78M.

**פתרון אופציה א' (מומלץ):** לחשב ב-SQL:
```sql
-- להוסיף עמודה מחושבת או לחשב ב-queryRaw:
SELECT "Order".orderId FROM "Order"
LEFT JOIN (SELECT "orderId", SUM(amount) as paid FROM "Payment" WHERE isDeleted=false GROUP BY "orderId") p ON p."orderId"="Order".orderId
WHERE "Order".isDeleted=false AND COALESCE("Order".totalAmount,0) > COALESCE(p.paid,0)
ORDER BY ...
LIMIT 50 OFFSET ...
```
או Prisma `groupBy` + `having`.

**אופציה ב' (מהיר):** להגביל חלון: כבר יש `threeMonthsAgo` אבל לא בשאילתת `unpaid` — להוסיף `eventDate gte threeMonthsAgo` גם ל-`isUnpaidQuery`, ולהוסיף `take: 500` hard limit.

**קובץ:** `app/api/orders/route.js:218-250`, בדוק גם `forRentals` smart sort.

---

### B3. `app/api/inventory/alerts/route.js:26` + `:72` — טעינת מלאי מלאה ללא `take`/`select` [גבוה]
**בעיה:**
- `:26` `dressItem.findMany({where:{isDeleted:false}, include:{dress:true}})` — טוען 13k פריטים עם כל העמודות.
- `:72` `orderItem.findMany({include:{order:true,dressItem:true}})` — טוען כל הזמנה עתידית עם כל שדות `Order` + `Customer` (אם מורחב).

**פתרון:**
```js
// כמו lib/inventory.js:89 BOOKING_SELECT
const allItems = await prisma.dressItem.findMany({
  where: { isDeleted:false, notInUse:false, inRepair:false },
  select: { dressModelId:true, sizeText:true, quantity:true, dress:{select:{name:true}} }
});
const futureBookings = await prisma.orderItem.findMany({
  where: { isDeleted:false, isReturned:false, order:{isDeleted:false, OR:[...]} },
  select: { sizeText:true, quantity:true, dressItem:{select:{sizeText:true}}, order:{select:{eventDate:true,fromDate:true,toDate:true,orderId:true,isAbroad:true}} }
});
```
ולהגביל `today → maxDate` שחושב לא נכון (כרגע `minDate=today` תמיד, `maxDate` גדל ללא הגבלה — חודשים). להוסיף `take` או חלון 60 יום כמו ב-`preload`.

---

### B4. קריאות בתוך `$transaction` — מחזיקות טרנזקציה מול Neon [בינוני]
**ממצאים:**
- `lib/creditRefundSync.js:15` `tx.order.findUnique({include:{payments,obligations}})` + `tx.refund.findMany` בתוך TX
- `lib/pricingEngine.js:439` `tx.paymentObligation.findMany` בתוך TX (ההערה טוענת "כתיבות בלבד" אבל יש קריאה)
- `app/api/orders/[id]/items/route.js:94` `refreshInventoryBookings(tx, ...)` + `app/api/orders/[id]/route.js:571` דומה

**פתרון (דפוס שכבר תוקן ב-`lib/inventory.js`):**
```js
// לפני הטרנזקציה:
const existing = await prisma.paymentObligation.findMany({where:{orderId}});
// בתוך הטרנזקציה רק כתיבות:
await prisma.$transaction(async tx => {
  await tx.paymentObligation.deleteMany(...);
  await tx.paymentObligation.createMany(...);
}, {timeout:30000});
```
ל-`creditRefundSync`: לשלוף `order`+`openRefunds` לפני TX, ב-TX רק `updateMany where isExecuted:false` (כמו ב-`refunds/[id]/route.js:48`).

---

### B5. N+1 סדרתי ב-`validateOrderItemsAvailability` [בינוני]
**קובץ:** `lib/inventory.js:672` `for (const modelId of modelsToCheck) { await getAvailableInventory(modelId, ...) }` — הזמנה עם 5 דגמים = 15 סבבים (dressItem+model+orderItem).

**פתרון:**
```js
// במקום for סדרתי:
const availabilities = await Promise.all(modelsToCheck.map(m => getAvailableInventory(m, ...)));
// או להשתמש ב-getBulkAvailableInventory שכבר עושה זאת בשאילתה אחת:
const bulk = await getBulkAvailableInventory(eventDate, modelsToCheck);
```

---

### B6. `include` רחב מדי [נמוך]
- `app/api/inventory/capacity/route.js:67` `include:{order:{include:{customer:true}}}`, `preload:146` — גורר כל עמודות `Order`+`Customer`.
- **פתרון:** להחליף ל-`select` מצומצם כמו ב-`lib/inventory.js:94` `BOOKING_SELECT`.

---

## משימות תשתית לסבב ב'

### B7. bagrut-materials (fancy-hill-59651059)
```sql
-- categories 11,648 seq / 4.4M, materials 2,809 seq
CREATE INDEX IF NOT EXISTS ON categories(parent_id);
CREATE INDEX IF NOT EXISTS ON categories(slug);
CREATE INDEX IF NOT EXISTS ON materials(category_id);
-- אימות:
EXPLAIN (ANALYZE,BUFFERS) SELECT * FROM categories WHERE parent_id=$1;
EXPLAIN (ANALYZE,BUFFERS) SELECT * FROM materials WHERE category_id=$1;
```

### B8. Vercel logs 13:00-15:00 UTC
- דשבורד `prj_ZZT2jYlvQZbQtN2evU5cfL3dOZzQ` > Logs > Runtime > 2026-08-26 13:00-15:00 UTC (CLI נכשל `ByteString 1502`).
- לשמור JSON ולחפש `status:5xx`, `duration>3s`, קריאות חוזרות ל-`/api/dresses`, `/api/orders`, `/api/customers`.

### B9. pg_stat_statements — 30 דקות peak הבא
```sql
SELECT query,calls,total_exec_time,mean_exec_time,rows
FROM pg_stat_statements WHERE query NOT LIKE '%pg_stat%' ORDER BY total_exec_time DESC LIMIT 10;
SELECT relname,seq_scan,seq_tup_read,idx_scan,n_live_tup
FROM pg_stat_user_tables ORDER BY seq_tup_read DESC LIMIT 15;
-- אם seq_scan על SystemSetting עדיין >1k/יום — cache לא הוטמע בכל מקום
-- אם Customer seq_scan עדיין >500/יום עם פטרן קצר — לשקול B-tree על phone1 exact + הגבלת מינימום 3 תווים בחיפוש לקוח
```

### B10. VACUUM + ניטור
```sql
VACUUM ANALYZE "OrderItem"; -- n_dead_tup 12608 (autovacuum 2026-08-03)
VACUUM ANALYZE "Customer";   -- 2682
VACUUM ANALYZE "DressItem";  -- 2038
```

---

## איך לאמת סבב ב' (לפני סגירה)
1. `grep -R "systemSetting.findMany\|systemSetting.findUnique" app lib --exclude-dir=node_modules` → רק `settings/route.js` + `prisma.js` + `settingsCache.js`
2. `npx prisma validate` (אחרי הוספת `@@index([fromDate])` etc.)
3. `ANALYZE` + `EXPLAIN` לכל אינדקס חדש — וודא `Bitmap Index Scan` על Customer ארוך, `Index Scan` על Order fromDate/toDate
4. הרץ `node scripts/insert_audit_report.js` אחרי `/audit-system` עם `performance,inventory,orders` — וודא סטטוס ✅

## קבצים שנגעו בסבב א' (ל-reference)
`lib/settingsCache.js` (חדש), `lib/inventory.js`, `lib/pricingEngine.js`, `app/layout.js`, `app/api/dresses/route.js`, `app/api/orders/route.js`, `app/api/settings/route.js`, `app/api/inventory/alerts/route.js`, `app/api/orders/calculate/route.js`, `prisma/schema.prisma` — כולם עם הערות `2026-08-26 perf`.

## זמן מוערך
B1 (cache שארית) 1h, B2+B3 (pagination/select) 2h, B4+B5 (TX) 1.5h, B7-B10 (DB/לוגים) 0.5h — סה"כ ~5h.
