-- ריבוי סניפים (docs/branches-plan.md) - DDL תוספתי בלבד, אידמפוטנטי.
-- להריץ ידנית על כל אחד משני מסדי הייצור (הראשי ונווה יעקב) לפני שהקוד עולה; לא prisma db push.
ALTER TABLE "DressItem" ADD COLUMN IF NOT EXISTS "branch" TEXT;
CREATE INDEX IF NOT EXISTS "DressItem_branch_idx" ON "DressItem"("branch");
