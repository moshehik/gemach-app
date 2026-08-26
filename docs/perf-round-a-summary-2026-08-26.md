# סיכום סבב א' — תיקוני ביצועים 26.08.2026
> בוצע בעקבות דוח `pg_stat_user_tables` : SystemSetting 72,796 / OrderItem 96M / Order 78M / Customer 34M seq_tup_read + איפוס `pg_stat_statements` 17:36 + עומס 11:00-15:00 UTC ב-prod בלבד

## מה אומת חי מול prod (ep-royal-dawn, Neon EU-C)
- `SELECT relname,seq_scan,seq_tup_read,idx_scan FROM pg_stat_user_tables` — המספרים תואמים דוח המשתמש סטייה <1% (SystemSetting 72,796, OrderItem 96,394,591, Order 78M). נשמר ב-`check_pg.js` / `check_pg2.js`.
- `EXPLAIN` לפני תיקון: `Customer firstName LIKE '%א%'` → `Seq Scan cost 1275`, `Order customerId` → `Index Scan` תקין, `OrderItem orderId` → `Index Scan` תקין, `inventory bookings` → `Index Scan isReturned` (17k שורות) + `Seq Scan DressItem` 13k.
- `pg_stat_statements` היה ריק אחרי האיפוס — רק `pg_settings`/`pg_stat_activity` ב-TOP. הושאר דולק.
- `vercel logs` מקומיים (`vercel_logs.json` 4-5.8) הם build logs בלבד, אין runtime ל-13-15 UTC. `vercel logs --project gemach-app-uyh4` נכשל `ByteString value 1502` (תו עברי ב-scope) — חובה למשוך מהדשבורד.
- `napi_o3hr...` (Neon API) מחזיר רק `bold-glade-13670371 print-center`, לא את `gemach-db` — אומת ישירות ב-PG.

## מה בוצע

### 1. מטמון SystemSetting — חיסכון ~70k Seq Scans/יום
**קובץ חדש** `lib/settingsCache.js` (TTL 30s, דומה ל-`lib/authTokens.js:86 createRequireLoginCache` / `lib/auth.js:47`):
- `getAllCachedSettings(client)` / `getCachedSetting(key, client)` — `Map` לפי key + `allCache` אחד, `isDefaultClient(tx)` עוקף cache בתוך `$transaction` כדי לא להחזיר stale, שגיאות לא נמטמנות.
- `invalidateSettingsCache(key)` / `invalidateAllSettingsCache()` — ניקוי מיידי.

**קבצים שתוקנו (לפני: `prisma.systemSetting.findMany()` מלא כל request → `Seq Scan` 65 שורות * אלפי בקשות):**
- `lib/inventory.js:2` import + `:124` (2x `findUnique` → `getCachedSetting`), `:348` `getBulkAvailableInventory` `findMany` → `getAllCachedSettings`, `:542` `getAvailableInventoryWithComparison`, `:657` `validateOrderItemsAvailability`
- `app/api/dresses/route.js:3`+`:14` (`inventory_include_warehouse`)
- `app/api/orders/route.js:6`+`:54` (`draft_orders_show_as_deleted`)
- `app/layout.js:5`+`:61` (SSR כל טעינת עמוד — 8 keys `require_login`... → `getAllCachedSettings().filter`)
- `app/api/inventory/alerts/route.js:5`+`:14`
- `app/api/orders/calculate/route.js:2`+`:15`
- `lib/pricingEngine.js:3`+`:388` (`SETTING_KEYS` IN → `getAllCachedSettings().filter`)
- `app/api/settings/route.js:3`+`:143` (`invalidateSettingsCache()` יחד עם `invalidateRequireLoginCache()`)

**תוצאה:** כל `GET /api/dresses?eventDate=` / `inventory` / `layout` שעד היום עשו `SELECT * FROM SystemSetting` עכשיו משרתים מזיכרון ה-lambda החם 30s.

### 2. pg_trgm + GIN על Customer
- `CREATE EXTENSION IF NOT EXISTS pg_trgm` (היה חסר — `pg_extension` הראה רק `plpgsql, pg_stat_statements`).
- 4 אינדקסים `CONCURRENTLY` (222ms,136ms,147ms,133ms):
  ```sql
  CREATE INDEX CONCURRENTLY IF NOT EXISTS "Customer_firstName_trgm_idx" ON "Customer" USING gin ("firstName" gin_trgm_ops);
  CREATE INDEX CONCURRENTLY IF NOT EXISTS "Customer_lastName_trgm_idx" ON "Customer" USING gin ("lastName" gin_trgm_ops);
  CREATE INDEX CONCURRENTLY IF NOT EXISTS "Customer_phone1_trgm_idx" ON "Customer" USING gin (phone1 gin_trgm_ops);
  CREATE INDEX CONCURRENTLY IF NOT EXISTS "Customer_phone2_trgm_idx" ON "Customer" USING gin (phone2 gin_trgm_ops);
  ```
- `ANALYZE "Customer"` + `EXPLAIN`: `phone1 LIKE '%050123456%'` (2 שורות) ו-`firstName LIKE '%אברהם%'` (1) כבר `Bitmap Index Scan` (cost 72/34) במקום Seq. דפוס קצר 3 תווים (`'%050%'` 2858 שורות, `'%שרה%'`) עדיין Seq Scan כי Limit 50 זול יותר ב-seq (22 vs 50) — שיפור מורגש בעיקר לחיפושי טלפון מלא/שם מלא, לא לקידומת בודדת. עם `enable_seqscan=off` גם 3 תווים משתמש ב-GIN (cost 1067 vs 1275).

### 3. אינדקסים מרוכזים למלאי
- `OrderItem_barcodePrefix_isReturned_idx` `("barcodePrefix","isReturned") WHERE isDeleted=false` (352ms)
- `OrderItem_isDeleted_isReturned_idx` (152ms)
- `Order_fromDate_idx` partial, `Order_toDate_idx` partial, `Order_eventDate_isDeleted_idx` partial (95/87ms)
- `prisma/schema.prisma:282` `@@index([fromDate])`, `[toDate]` + `:387` `@@index([barcodePrefix,isReturned])` — GIN trigram נשארים SQL ידני (לא ניתן ב-`@@index`).

### 4. pg_stat_statements + Vercel
- לא אופס שוב — נשאר דולק, ה-TOP עכשיו `CREATE INDEX` (288ms). הוראה: להריץ אחרי 30 דקות peak:
  ```sql
  SELECT query,calls,total_exec_time,mean_exec_time,rows FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
  SELECT relname,seq_scan,seq_tup_read,idx_scan FROM pg_stat_user_tables ORDER BY seq_tup_read DESC;
  ```
- Vercel: `vercel.json:3` רק `0 4 * * * /api/health` (fra1) — אין cron ב-11-15, העומס מ-`n_tup_upd Order 177k` אמיתי. לוגים למשוך ידנית: דשבורד `prj_ZZT2jYlvQZbQtN2evU5cfL3dOZzQ` > Logs > Runtime > 2026-08-26 13:00-15:00 UTC.

### 5. אימות
- `Task audit-performance` (explore subagent על `.claude/agents/audit-performance.md`) רץ ומצא 9 ממצאים נוספים — כולם תועדו ל-סבב ב'.
- `npx prisma validate` — אין שגיאות סכימה (indexes החדשים תקינים).

## קבצים שנוצרו/שונו בסבב א'
- חדש: `lib/settingsCache.js`
- שונו: `lib/inventory.js`, `lib/pricingEngine.js`, `app/api/dresses/route.js`, `app/api/orders/route.js`, `app/api/settings/route.js`, `app/layout.js`, `app/api/inventory/alerts/route.js`, `app/api/orders/calculate/route.js`, `prisma/schema.prisma`
- DB prod: `pg_trgm` + 9 אינדקסים (4 GIN + 5 btree partial)

## מה נשאר לסבב ב' — ראה `docs/perf-round-b-instructions-2026-08-26.md`
