import { NextResponse } from 'next/server';
import prisma, { auditAs } from '@/app/lib/prisma';
import { requireItemTransferAccess } from '@/lib/dressItemAccess';
import { loadBranchContext } from '@/lib/branchesServer';
import { activeBranches } from '@/lib/branches';
import { normalizeBarcode, patchToData, planRelocation, RELOCATE_MODES } from '@/lib/dressRelocate';

export const dynamic = 'force-dynamic';

// הקלדה מהירה להעברת פריטים (docs/branches-plan.md, שלב ב): בקשה אחת = ברקוד אחד, כדי שהחלונית תציג תוצאה לכל סריקה וברקוד לא מוכר
// לא יעצור את הרצף (כשל לוגי חוזר כ-200 עם ok:false; רק כשל תשתית / הרשאה הוא קוד שגיאה).
//   { mode: 'branch'|'to_warehouse'|'from_warehouse'|'to_reserve'|'to_carton', barcode, branch?, carton? }
//   ביטול: { mode: 'restore', itemId, restore: { location, cartonNumber, branch } }  (המצב שחזר בתשובה הקודמת, "before")
// הרשאה: הרשאת המלאי הקיימת page:dresses_catalog ("כל מי שיש לה הרשאות מלאי", החלטת הבעלים 12.10.2026; lib/dressItemAccess.js). פועל רק כש-multi_branch_enabled='true'.
// היסטוריה: תוסף ה-audit של Prisma (auditAs) - אין כתיבת AuditLog ידנית.
const ITEM_SELECT = {
  id: true, dressBarcode: true, sizeText: true, location: true, cartonNumber: true, branch: true, isDeleted: true,
  dress: { select: { name: true, barcodePrefix: true } },
};

export async function POST(request) {
  const denied = await requireItemTransferAccess();
  if (denied) return denied;
  try {
    const ctx = await loadBranchContext();
    if (!ctx.enabled) return NextResponse.json({ error: 'ריבוי סניפים כבוי' }, { status: 409 });
    const body = await request.json();
    const mode = body.mode;
    if (!RELOCATE_MODES.includes(mode)) return NextResponse.json({ error: 'פעולה לא מוכרת' }, { status: 400 });

    const branchNames = activeBranches(ctx.cfg).map((b) => b.name);
    if ((mode === 'branch' || mode === 'from_warehouse') && !branchNames.includes(String(body.branch || '').trim())) {
      return NextResponse.json({ error: 'הסניף שנבחר לא קיים או לא פעיל' }, { status: 400 });
    }

    let item = null;
    const barcode = normalizeBarcode(body.barcode);
    if (mode === 'restore') {
      if (!body.itemId) return NextResponse.json({ error: 'חסר פריט לביטול' }, { status: 400 });
      item = await prisma.dressItem.findUnique({ where: { id: String(body.itemId) }, select: ITEM_SELECT });
    } else {
      if (!barcode) return NextResponse.json({ ok: false, code: 'no_barcode', error: 'לא הוקלד ברקוד', barcode: '' });
      // פעיל קודם למחוק (אותו ברקוד יכול להופיע בפריט שנמחק)
      const rows = await prisma.dressItem.findMany({ where: { dressBarcode: barcode }, select: ITEM_SELECT, take: 4 });
      item = rows.find((r) => !r.isDeleted) || rows[0] || null;
    }

    const plan = planRelocation(mode, { branch: body.branch, carton: body.carton, restore: body.restore }, item);
    const label = item ? { itemId: item.id, barcode: item.dressBarcode || barcode, model: item.dress?.name || (item.dress?.barcodePrefix ? `דגם ${item.dress.barcodePrefix}` : ''), size: item.sizeText || '' } : { barcode };
    if (!plan.ok) return NextResponse.json({ ok: false, code: plan.code, error: plan.error, ...label });
    if (plan.noop) return NextResponse.json({ ok: true, noop: true, mode, before: plan.before, after: plan.after, warnings: plan.warnings, ...label });

    await prisma.dressItem.update(auditAs('RELOCATE_ITEM', { where: { id: item.id }, data: patchToData(plan.patch) }, plan.patch));
    return NextResponse.json({ ok: true, noop: false, mode, before: plan.before, after: plan.after, warnings: plan.warnings, ...label });
  } catch (error) {
    console.error('Error relocating dress item:', error);
    return NextResponse.json({ error: 'שגיאה בעדכון הפריט' }, { status: 500 });
  }
}
