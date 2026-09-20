#!/usr/bin/env node
/**
 * scripts/normalize_legacy_rental_flags.js
 * ============================================================================
 * נורמליזציית סטטוס "נלקח" לנתוני אקסס ישנים (אושר ע"י הבעלים, 2026-09-20).
 *
 * הבעיה: באקסס הישן לפעמים לא נלחץ "אשר השכרה", אז OrderItem.isTaken נשאר false
 * למרות שנרשמו ברקוד ותאריך לקיחה (או שהפריט כבר הוחזר). התוצאה: ההזמנה נשארת
 * ב"הזמנות" במקום ב"השכרות".
 *
 * הכלל - פריט השכרה ייחשב נלקח (isTaken=true) אם isTaken=false וגם אחד מאלה:
 *   R1: takenDate לא null וגם barcode לא ריק/לא null.
 *   R2: רשומה החזרה - isReturned=true או returnDate לא null.
 *
 * מה שהכלל לעולם לא עושה:
 *   - לא נוגע בפריטים מחוקים (OrderItem.isDeleted) או בפריטים של הזמנות מחוקות
 *     (Order.isDeleted).
 *   - לא ממציא תאריכים: takenDate/returnDate לא נכתבים (הבאג ההיסטורי
 *     run_full_rental_date_backfill.js פבריק תאריכים וגרם נזק - לא חוזרים עליו).
 *   - לא משנה DressItem.location, cartStatus או isReturned.
 *   - משנה שדה אחד בלבד: isTaken false -> true (+ updatedAt).
 *
 * אידמפוטנטי: ה-UPDATE מכיל שוב את תנאי הזיהוי ב-WHERE, ולכן הרצה חוזרת (או
 * מקבילית) לא משנה כלום פעם שנייה. כתיבה דרך raw SQL עוקפת את תוסף יומן-הביקורת
 * האוטומטי (ר' CLAUDE.md "Automatic audit logging"), לכן נכתבת שורת AuditLog ידנית
 * לכל פריט ששונה - באותה הצהרת SQL/טרנזקציה, כך שאין פריט ששונה בלי יומן.
 *
 * USAGE (CLI):
 *   node scripts/normalize_legacy_rental_flags.js --org=1                 # dry-run (ברירת מחדל)
 *   node scripts/normalize_legacy_rental_flags.js --org=2                 # dry-run, נווה יעקב
 *   node scripts/normalize_legacy_rental_flags.js --org=2 --write --expect-host=ep-xxxx
 *
 *   --write חובה יחד עם --expect-host=<תחילית ה-host של ה-DB המיועד>. הסקריפט מדפיס
 *   את ה-host (בלי סיסמה) ומסרב לכתוב אם הוא לא מתחיל בתחילית שהתקבלה, או אם
 *   ארגון 2 הצביע בטעות על אותו host של ארגון 1 (ולהפך). ר' CLAUDE.md
 *   "Bulk-settings scripts must target-check their DB host".
 *
 * שימוש מקוד (כלי הייבוא import_from_access.js / scratch/import_new_gemach.js):
 *   const { normalizeLegacyRentalFlags } = require('./normalize_legacy_rental_flags');
 *   await normalizeLegacyRentalFlags(prisma, { write: WRITE });
 *   הכלי המייבא כבר מחובר ל-DB היעד שלו, ולכן אין שם בדיקת host נוספת.
 *
 * טעינת env/בחירת DB (ל-CLI): scripts/lib/db-env.js (--org=1|2).
 * לא מדפיס connection string או סיסמה בשום מצב.
 */

'use strict';

const NOTE = 'נורמליזציה של נתוני אקסס ישנים - כלל R1/R2';

// תנאי הזיהוי (משמש גם ב-SELECT וגם ב-WHERE של ה-UPDATE - חייב להישאר זהה).
// oi = OrderItem, o = Order.
const R1_SQL = `(oi."takenDate" IS NOT NULL AND oi."barcode" IS NOT NULL AND btrim(oi."barcode") <> '')`;
const R2_SQL = `(oi."isReturned" = true OR oi."returnDate" IS NOT NULL)`;
const CANDIDATE_SQL = `(oi."isTaken" = false AND (${R1_SQL} OR ${R2_SQL}))`;
const NOT_DELETED_SQL = `(oi."isDeleted" = false AND o."isDeleted" = false)`;

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ write?: boolean, log?: (line: string) => void, quiet?: boolean }} [opts]
 * @returns {Promise<{ write: boolean, r1Only: number, r2Only: number, both: number,
 *   total: number, skippedDeleted: number, changed: number, rows: object[] }>}
 */
async function normalizeLegacyRentalFlags(prisma, opts = {}) {
  const write = !!opts.write;
  const log = opts.log || ((line) => console.log(line));

  // 1. שליפת המועמדים (כולל מחוקים, כדי לדווח כמה דולגו). קריאה מחוץ לטרנזקציה.
  const candidates = await prisma.$queryRawUnsafe(`
    SELECT oi."id", oi."orderId", oi."barcode", oi."takenDate", oi."returnDate",
           oi."isReturned", oi."isDeleted" AS "itemDeleted", o."isDeleted" AS "orderDeleted",
           ${R1_SQL} AS "r1", ${R2_SQL} AS "r2"
    FROM "OrderItem" oi
    JOIN "Order" o ON o."orderId" = oi."orderId"
    WHERE ${CANDIDATE_SQL}
    ORDER BY oi."orderId", oi."id"
  `);

  const eligible = [];
  let skippedDeleted = 0;
  const skippedRows = [];
  for (const c of candidates) {
    if (c.itemDeleted || c.orderDeleted) {
      skippedDeleted++;
      skippedRows.push(c);
    } else {
      eligible.push(c);
    }
  }
  const r1Only = eligible.filter((c) => c.r1 && !c.r2).length;
  const r2Only = eligible.filter((c) => !c.r1 && c.r2).length;
  const both = eligible.filter((c) => c.r1 && c.r2).length;

  const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '-');
  const ruleOf = (c) => (c.r1 && c.r2 ? 'R1+R2' : c.r1 ? 'R1' : 'R2');
  const toRow = (c) => ({
    orderId: c.orderId,
    itemId: c.id,
    rule: ruleOf(c),
    barcode: c.barcode || '-',
    takenDate: fmt(c.takenDate),
    returnDate: fmt(c.returnDate),
    isReturned: c.isReturned,
  });

  log(`normalize_legacy_rental_flags - mode: ${write ? '*** WRITE ***' : 'DRY RUN (no writes)'}`);
  log(`  R1 only (takenDate+barcode): ${r1Only}`);
  log(`  R2 only (returned):          ${r2Only}`);
  log(`  R1+R2:                       ${both}`);
  log(`  total to mark isTaken=true:  ${eligible.length}`);
  log(`  skipped (deleted item/order): ${skippedDeleted}` +
    (skippedRows.length ? `  [orders: ${[...new Set(skippedRows.map((r) => r.orderId))].join(', ')}]` : ''));
  if (eligible.length && !opts.quiet) {
    console.table(eligible.map(toRow));
  }

  let changed = 0;
  if (write && eligible.length) {
    // 2. כתיבה: הצהרה אחת בתוך טרנזקציה אחת. ה-UPDATE חוזר על תנאי הזיהוי (אידמפוטנטי;
    // שורה ששונתה בינתיים ע"י מישהו אחר פשוט לא תיבחר), וה-INSERT ליומן ניזון ישירות
    // מ-RETURNING של אותו UPDATE - שורת יומן רק לפריט שבאמת שונה.
    const ids = eligible.map((c) => c.id);
    const auditRows = await prisma.$transaction([
      prisma.$queryRawUnsafe(
        `
        WITH upd AS (
          UPDATE "OrderItem" oi
          SET "isTaken" = true, "updatedAt" = NOW()
          FROM "Order" o
          WHERE o."orderId" = oi."orderId"
            AND oi."id" = ANY($1::text[])
            AND ${CANDIDATE_SQL}
            AND ${NOT_DELETED_SQL}
          RETURNING oi."id", ${R1_SQL} AS "r1", ${R2_SQL} AS "r2"
        ), aud AS (
          INSERT INTO "AuditLog" ("id", "entityType", "entityId", "action", "changesJson", "employeeId", "updatedAt")
          SELECT gen_random_uuid()::text, 'OrderItem', upd."id", 'UPDATE',
                 jsonb_build_object(
                   'isTaken', jsonb_build_object('from', false, 'to', true),
                   '_note', $2::text,
                   '_rule', CASE WHEN upd."r1" AND upd."r2" THEN 'R1+R2' WHEN upd."r1" THEN 'R1' ELSE 'R2' END
                 )::text,
                 NULL, NOW()
          FROM upd
          RETURNING "entityId"
        )
        SELECT "entityId" FROM aud
        `,
        ids,
        NOTE
      ),
    ], { timeout: 60000 });
    changed = auditRows[0].length;
    log(`  CHANGED (isTaken false -> true, with AuditLog): ${changed}` +
      (changed !== eligible.length ? `  (expected ${eligible.length} - the rest changed under us, safe to re-run)` : ''));
  } else if (write) {
    log('  CHANGED: 0 (nothing to do)');
  } else if (eligible.length) {
    log(`  DRY RUN: would change ${eligible.length} item(s). Re-run with --write to apply.`);
  }

  return { write, r1Only, r2Only, both, total: eligible.length, skippedDeleted, changed, rows: eligible.map(toRow) };
}

module.exports = { normalizeLegacyRentalFlags };

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function hostOf(url) {
  const m = /@([^/?#]+)/.exec(url);
  return m ? m[1] : null;
}

async function cli() {
  const { PrismaClient } = require('@prisma/client');
  const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const write = rest.includes('--write');
  const expectArg = rest.find((a) => a.startsWith('--expect-host='));
  const expectHost = expectArg ? expectArg.split('=').slice(1).join('=') : null;

  const url = resolveDbUrl(org);
  const host = hostOf(url);
  if (!host) throw new Error('Could not parse a host out of the resolved database URL.');
  console.log(`Target: org ${org}, DB host: ${host}`);

  if (write) {
    if (!expectHost) {
      throw new Error('SAFETY ABORT: --write requires --expect-host=<host prefix of the intended DB> (printed above in a dry run).');
    }
    if (!host.startsWith(expectHost)) {
      throw new Error(`SAFETY ABORT: expected host starting with "${expectHost}", but org ${org} resolves to a different host.`);
    }
    // הגנה נגד זיהום צולב בין הגמחים: שני הארגונים חייבים להצביע על hosts שונים.
    const otherOrg = org === 1 ? 2 : 1;
    let otherHost = null;
    try { otherHost = hostOf(resolveDbUrl(otherOrg)); } catch { /* the other org is not configured here - fine */ }
    if (otherHost && otherHost === host) {
      throw new Error(`SAFETY ABORT: org ${org} and org ${otherOrg} resolve to the SAME database host - refusing to write.`);
    }
  }

  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    await normalizeLegacyRentalFlags(prisma, { write });
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  cli().catch((e) => {
    console.error('FATAL:', e.message);
    process.exit(1);
  });
}
