import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { autoModelName, isPlaceholderModelName } from '@/lib/modelDisplay';
import { getModelDisplayOpts } from '@/lib/modelDisplayServer';
import { requireDressItemManager } from '@/lib/dressItemAccess';
import { validateItemInput } from '@/lib/dressInputValidation';

// הטרנזקציה קצרה, אבל כל כתיבה מוסיפה שורת היסטוריה (app/lib/prisma.js) וה-DB (Neon) יכול להיות איטי בהתעוררות - ברירת המחדל 5 שניות נפלה
const TX_OPTS = { timeout: 20000, maxWait: 10000 };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Create a new DressItem for a specific DressModel
// ניהול פריטי דגם (הוספה): feature:dress_items_manage - הנהלה ראשית / מתכנת תמיד, אחרים לפי הרשאה (lib/dressItemAccess.js)
export async function POST(request, { params }) {
  const denied = await requireDressItemManager();
  if (denied) return denied;
  try {
    const resolvedParams = await params;
    const dressModelId = resolvedParams.id;
    if (!dressModelId) {
      return NextResponse.json({ error: 'קוד דגם חסר' }, { status: 400 });
    }

    if (!UUID_RE.test(String(dressModelId))) return NextResponse.json({ error: 'הדגם לא נמצא' }, { status: 404 });
    const model = await prisma.dressModel.findUnique({ where: { id: dressModelId }, select: { id: true, barcodePrefix: true, isDeleted: true } });
    if (!model || model.isDeleted) return NextResponse.json({ error: 'הדגם לא נמצא' }, { status: 404 });

    const body = await request.json().catch(() => null);
    // ולידציה בשרת (lib/dressInputValidation.js): מידה / סידורי / כמות / ברקוד מתאים לקוד הדגם + מידה + סידורי
    const v = validateItemInput(body, model);
    if (v.error) return NextResponse.json({ error: v.error, ...(v.field ? { field: v.field } : {}) }, { status: 400 });
    const d = v.data;

    const itemOpts = await getModelDisplayOpts();
    const itemDressName = itemOpts.useModelNames === false
      ? (autoModelName(model.barcodePrefix) ?? d.dressName)
      : (d.dressName && isPlaceholderModelName(d.dressName) ? autoModelName(model.barcodePrefix) : d.dressName);

    // כפילות ברקוד נבדקת מול פריטים פעילים בלבד (פריט מחוק רכות לא חוסם שימוש חוזר בברקוד), תחת נעילת advisory לפי הברקוד נגד מרוץ
    const newItem = await prisma.$transaction(async (tx) => {
      if (d.dressBarcode) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dress-item-barcode:${d.dressBarcode}`}))`;
        const existing = await tx.dressItem.findFirst({ where: { dressBarcode: d.dressBarcode, isDeleted: false }, select: { id: true } });
        if (existing) return null;
      }
      return tx.dressItem.create({
        data: {
          dressModelId,
          sizeText: d.sizeText,
          serialNumber: d.serialNumber,
          dressBarcode: d.dressBarcode,
          location: d.location,
          locationNum: d.locationNum,
          cartonNumber: d.cartonNumber,
          quantity: d.quantity,
          inRepair: d.inRepair,
          notInUse: d.notInUse,
          notInUseSince: d.notInUseSince,
          entryDateToRepo: d.entryDateToRepo,
          // legacy compatibility: הקידומת תמיד מהדגם האב (לא מהגוף - פריט לא יכול לשאת קידומת שונה מהדגם שלו)
          // שדה ישן (שם הדגם בזמן יצירת הפריט): לעולם לא "ללא שם - N"; בגמ"ח בלי שמות דגמים (useModelNames=false) = מספר הדגם (lib/modelDisplay.js)
          dressName: itemDressName,
          barcodePrefix: model.barcodePrefix,
        },
      });
    }, TX_OPTS);
    if (!newItem) return NextResponse.json({ error: `הברקוד ${d.dressBarcode} כבר קיים במערכת.` }, { status: 400 });

    return NextResponse.json(newItem);
  } catch (error) {
    console.error('Error creating dress item:', error);
    return NextResponse.json({ error: 'שגיאה ביצירת פריט' }, { status: 500 });
  }
}
