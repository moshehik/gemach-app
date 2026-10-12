import { NextResponse } from 'next/server';
import { checkAuth, getSessionEmployee } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { registerBarcode, releaseBarcode, getBarcodeState, BarcodeError } from '@/lib/schedule/barcodeScan';
import { autoMarkPrepForOrder } from '@/lib/schedule/autoPrepMark';
import { autoMarkAlterationsForItems, isAutoAlterationEnabled } from '@/lib/schedule/autoAlterationDone';
import { runAfterResponse } from '@/lib/schedule/afterResponse';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const NO_STORE = { 'Cache-Control': 'no-store' };
const STAGES = ['prep', 'pick', 'dout'];
const SOURCES = ['schedule_dialog', 'schedule_scan'];

// רישום ברקוד שמלה לפריט הזמנה מתוך הלו״ז (lib/schedule/barcodeScan.js; התכנון: docs/schedule-barcode-plan.md).
//   GET    ?orderId=&stageKey=prep|pick|dout   -> מצב ההזמנה לחלונית: { items:[{orderItemId, model, size, barcode, registered, taken, needsBarcode}], summary, gate, intent }
//   POST   { orderId, barcode, stageKey, intent?:'register'|'handover', dayKey?, itemId?, source? }
//            -> { status:'registered'|'taken'|'already'|'ambiguous', item, items, summary, handover? }
//            שגיאות: 400 invalid_format, 404 order_not_found / unknown_barcode / not_in_order, 409 order_closed / feature_off / stage_mismatch / mode_changed /
//            dress_unavailable / reserved_location / taken_elsewhere / prepped_elsewhere / race / invalid_choice (תמיד { error, code, ...extra })
//   DELETE ?orderId=&itemId=                   -> ביטול רישום של פריט שעוד לא נלקח
// שער: אותו דפוס כמו /api/schedule/marks (checkAuth + page:schedule + עובדת מחוברת).
async function gate() {
  if (!(await checkAuth())) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE }) };
  if (!(await canOpenPage('page:schedule'))) return { res: NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE }) };
  const user = await getSessionEmployee();
  if (!user || !user.id) return { res: NextResponse.json({ error: 'יש להתחבר כדי לסרוק ברקוד' }, { status: 401, headers: NO_STORE }) };
  return { user };
}

function fail(error, label) {
  if (error instanceof BarcodeError) {
    return NextResponse.json({ error: error.message, code: error.code, ...(error.extra || {}) }, { status: error.status, headers: NO_STORE });
  }
  console.error(`${label} error:`, error);
  return NextResponse.json({ error: 'שגיאה בשמירת הברקוד' }, { status: 500, headers: NO_STORE });
}

const toOrderId = (v) => {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && /^\d+$/.test(v.trim()) ? parseInt(v, 10) : NaN);
  return Number.isInteger(n) && n > 0 && n < 1e9 ? n : null;
};

export async function GET(request) {
  const g = await gate();
  if (g.res) return g.res;
  try {
    const { searchParams } = new URL(request.url);
    const orderId = toOrderId(searchParams.get('orderId'));
    const stageKey = String(searchParams.get('stageKey') || '');
    if (!orderId) return NextResponse.json({ error: 'מספר הזמנה לא תקין' }, { status: 400, headers: NO_STORE });
    if (!STAGES.includes(stageKey)) return NextResponse.json({ error: 'שלב לא תקין' }, { status: 400, headers: NO_STORE });
    return NextResponse.json(await getBarcodeState({ orderId, stageKey }), { headers: NO_STORE });
  } catch (error) {
    return fail(error, 'GET /api/schedule/barcodes');
  }
}

export async function POST(request) {
  const g = await gate();
  if (g.res) return g.res;
  try {
    let body = null;
    try { body = await request.json(); } catch { body = null; }
    const b = body && typeof body === 'object' ? body : {};
    const orderId = toOrderId(b.orderId);
    if (!orderId) return NextResponse.json({ error: 'מספר הזמנה לא תקין' }, { status: 400, headers: NO_STORE });
    const stageKey = String(b.stageKey || '');
    if (!STAGES.includes(stageKey)) return NextResponse.json({ error: 'שלב לא תקין' }, { status: 400, headers: NO_STORE });
    const intent = b.intent === 'register' || b.intent === 'handover' ? b.intent : null;
    const result = await registerBarcode({
      orderId,
      barcode: b.barcode,
      stageKey,
      dayKey: typeof b.dayKey === 'string' ? b.dayKey : null,
      itemId: typeof b.itemId === 'string' && b.itemId ? b.itemId.slice(0, 64) : null,
      intent,
      user: g.user,
      source: SOURCES.includes(b.source) ? b.source : 'schedule_dialog',
    });
    // לקיחה בפועל מהחלונית: "הושכר = ההכנה בוצעה" + תיקון משוער - אחרי התשובה, כמו rentals/confirm. נכשל בשקט.
    if (result.takenIds && result.takenIds.length) {
      const altOn = await isAutoAlterationEnabled();
      await runAfterResponse(
        [() => autoMarkPrepForOrder(orderId, { userId: g.user.id }), () => autoMarkAlterationsForItems(result.takenIds)],
        { actorId: g.user.id, ...(altOn ? {} : { afterFn: null }) },
      );
    }
    return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE });
  } catch (error) {
    return fail(error, 'POST /api/schedule/barcodes');
  }
}

export async function DELETE(request) {
  const g = await gate();
  if (g.res) return g.res;
  try {
    const { searchParams } = new URL(request.url);
    const orderId = toOrderId(searchParams.get('orderId'));
    const itemId = String(searchParams.get('itemId') || '').slice(0, 64);
    if (!orderId || !itemId) return NextResponse.json({ error: 'נתונים חסרים' }, { status: 400, headers: NO_STORE });
    return NextResponse.json({ ok: true, ...(await releaseBarcode({ orderId, itemId, user: g.user })) }, { headers: NO_STORE });
  } catch (error) {
    return fail(error, 'DELETE /api/schedule/barcodes');
  }
}
