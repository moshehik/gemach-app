import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { resolveNedarimMosadId } from '@/app/lib/nedarimSettings';
import {
  getKevaList,
  getKevaListFull,
  getKevaDetails,
  updateKeva,
  chargeKevaSingle,
  deleteKeva,
  disableKeva,
  enableKeva,
  getTransactionHistory,
} from '@/app/lib/nedarimManage';

// שרת יחיד לכל פעולות ה"ניהול" מול נדרים פלוס (Manage3.aspx, מפתח API npk_...) -
// רשימת הוק, חיפוש (מבוסס על אותה רשימה/פרטי הוראה), עריכת הוק, גביית תשלום בודד,
// היסטוריית תשלומים. שונה לגמרי מ-/api/admin/nedarim-hok, שרק יוצר הוק חדש דרך
// ה-API הישן (DebitKeva.aspx). כל הפעולות דורשות הרשאת הנהלה ראשית, כמו שאר /admin.

const ACTIONS = {
  list: (p) => getKevaList(p),
  listFull: (p) => getKevaListFull(p),
  details: (p) => getKevaDetails(p),
  update: (p) => updateKeva(p),
  chargeSingle: (p) => chargeKevaSingle(p),
  delete: (p) => deleteKeva(p),
  disable: (p) => disableKeva(p),
  enable: (p) => enableKeva(p),
  history: (p) => getTransactionHistory(p),
};

export async function POST(request) {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data = await request.json();
    const { action, mosadId: mosadIdOverride, ...params } = data;

    const handler = ACTIONS[action];
    if (!handler) {
      return NextResponse.json({ error: `פעולה לא מוכרת: ${action}` }, { status: 400 });
    }

    const mosadId = await resolveNedarimMosadId(mosadIdOverride);
    if (!mosadId) {
      return NextResponse.json({ error: 'מספר מוסד (Mosad) לא מוגדר' }, { status: 400 });
    }

    const result = await handler({ mosadId, ...params });
    return NextResponse.json({ success: true, raw: result.raw, data: result.json });
  } catch (error) {
    console.error('Nedarim Manage API error:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'שגיאה כללית' }, { status: 500 });
  }
}
