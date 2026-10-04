// lib/prismaMissingTable.js - זיהוי "הטבלה לא קיימת במסד הזה" (SavedSearch / SearchHistory עדיין לא נוצרו בכל מסד).
// מודול טהור (נבדק ב-scripts/test_saved_searches_api.mjs). בלי DDL: מי שקורא רק מתנהג יפה (רשימה ריקה / "לא זמין") במקום 500.
//   P2021 = הטבלה לא קיימת, P2022 = העמודה לא קיימת (Prisma); 42P01 / 42703 = קודי Postgres (undefined_table / undefined_column).
export function isMissingTableError(e) {
  if (!e || typeof e !== 'object') return false;
  const code = e.code;
  if (code === 'P2021' || code === 'P2022') return true;
  const pg = e.meta && typeof e.meta === 'object' ? (e.meta.code || (e.meta.driverAdapterError && e.meta.driverAdapterError.cause && e.meta.driverAdapterError.cause.originalCode)) : null;
  if (pg === '42P01' || pg === '42703') return true;
  const msg = typeof e.message === 'string' ? e.message : '';
  return /relation "[^"]+" does not exist/i.test(msg) || /The (table|column) `[^`]+` does not exist/i.test(msg);
}
