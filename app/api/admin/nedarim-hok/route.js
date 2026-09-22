import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth, getSessionEmployee } from '@/lib/auth';
import { getAllCachedSettings, getCachedSetting } from '@/lib/settingsCache';
import { decryptSecret, isEncryptedSecret } from '@/lib/secretCrypto';
import { chargeNedarimPlus } from '@/app/lib/nedarim';

// דף ניסוי ייעודי (/admin/nedarim-hok-test) ליצירת הוק (הוראת קבע) בנדרים פלוס:
// לא קשור ל-Customer.hokBank*/Order.hokDetails (הוראת קבע בנקאית, "38 בקשות" -
// מנגנון שונה לגמרי). כל קריאה - הצלחה או כישלון - נרשמת בטבלת NedarimHok, כדי
// שהרשומות שנוצרות בניסוי יהיו גלויות וניתנות למעקב. עדיין לא מחובר לתהליך
// ההזמנה/תשלום האמיתי - ר' תיעוד ב-CLAUDE.md "הוק בנדרים פלוס".

async function resolveMosadId(overrideMosadId) {
  if (overrideMosadId) return overrideMosadId;
  if (process.env.NEDARIM_MOSAD_ID) return process.env.NEDARIM_MOSAD_ID;
  const setting = (await getAllCachedSettings()).find(
    (s) => s.key === 'NEDARIM_MOSAD' || s.key === 'nedarim_plus_terminal'
  );
  return setting?.value || '';
}

async function resolveToken() {
  const tokenSetting = await getCachedSetting('nedarim_plus_token');
  if (tokenSetting?.value && isEncryptedSecret(tokenSetting.value)) {
    try {
      return decryptSecret(tokenSetting.value);
    } catch (e) {
      console.error('Failed to decrypt nedarim_plus_token:', e);
    }
  }
  return '';
}

export async function POST(request) {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data = await request.json();
    const {
      clientName, address, phone, zeout, email,
      cardNumber, tokef, cvv,
      amount, chargeDate, dayOfMonth, installments,
      mosadId: mosadIdOverride,
      orderId, customerId, notes,
    } = data;

    if (!cardNumber || !tokef) {
      return NextResponse.json({ success: false, error: 'חסרים פרטי כרטיס (מספר כרטיס/תוקף)' }, { status: 400 });
    }
    if (!chargeDate) {
      return NextResponse.json({ success: false, error: 'חסר תאריך חיוב עתידי (StartFrom)' }, { status: 400 });
    }

    const mosadId = await resolveMosadId(mosadIdOverride);
    if (!mosadId) {
      return NextResponse.json({ success: false, error: 'מספר מוסד (Mosad) לא מוגדר - ניתן להקליד ידנית בדף הניסוי או להגדיר nedarim_plus_terminal בהגדרות' }, { status: 400 });
    }
    const token = await resolveToken();

    const chargeDateObj = new Date(chargeDate);
    const resolvedDay = dayOfMonth || chargeDateObj.getDate();
    const finalAmount = amount != null && amount !== '' ? Number(amount) : 1;

    const employee = await getSessionEmployee();

    const result = await chargeNedarimPlus({
      mosadId,
      clientName: clientName || '',
      address: address || '',
      phone: phone || '',
      cardNumber,
      tokef,
      amount: finalAmount,
      installments: installments || 1,
      notes: notes || 'הוק לבדיקה - בקשת אי-החזרה',
      isKeva: true,
      day: resolvedDay,
      startFrom: chargeDateObj,
      zeout: zeout || '',
      cvv: cvv || '',
      email: email || '',
      token,
    });

    const saved = await prisma.nedarimHok.create({
      data: {
        orderId: orderId ? Number(orderId) : null,
        customerId: customerId || null,
        clientName: clientName || null,
        phone: phone || null,
        zeout: zeout || null,
        cardLast4: cardNumber ? String(cardNumber).slice(-4) : null,
        amount: finalAmount,
        chargeDate: chargeDateObj,
        dayOfMonth: resolvedDay,
        installments: installments || 1,
        mosadId,
        status: result.success ? 'success' : 'error',
        confirmation: result.confirmation || null,
        errorMessage: result.error || null,
        rawResponse: result.rawResponse || null,
        isTest: true,
        createdByEmployeeId: employee?.id || null,
        notes: notes || null,
      },
    });

    return NextResponse.json({ ...result, record: saved });
  } catch (error) {
    console.error('Nedarim Hok API error:', error);
    return NextResponse.json({ success: false, error: 'שגיאה כללית ביצירת ההוק' }, { status: 500 });
  }
}

export async function GET() {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const records = await prisma.nedarimHok.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({ records });
}
