import { NextResponse } from 'next/server';
import { getAllCachedSettings, getCachedSetting } from '@/lib/settingsCache';
import { chargeNedarimPlus } from '../../lib/nedarim';
import prisma from '../../lib/prisma'; // Optional: if you need to fetch mosadId from settings
import { checkAuth } from '../../../lib/auth';
import { decryptSecret, isEncryptedSecret } from '../../../lib/secretCrypto';


export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const data = await request.json();

    const enabledSetting = await getCachedSetting('nedarim_plus_enabled');
    if (enabledSetting && enabledSetting.value === 'false') {
      return NextResponse.json({ success: false, error: 'סליקת אשראי בנדרים פלוס מושבתת בהגדרות המערכת.' }, { status: 400 });
    }

    // Attempt to fetch mosadId from settings or env
    // For now, we will use a fallback or require it from frontend/env
    let mosadId = process.env.NEDARIM_MOSAD_ID;

    if (!mosadId) {
      // Check database settings
      const setting = (await getAllCachedSettings()).find(s => s.key === 'nedarimMosadId' || s.key === 'NEDARIM_MOSAD' || s.key === 'nedarim_plus_terminal') || null;
      if (setting && setting.value) {
        mosadId = setting.value;
      } else {
        // Just a fallback to ensure we don't crash, user will need to configure it
        mosadId = data.mosadId || '';
      }
    }

    // 2 - קישור נדרים פלוס לרינת לב: אם הלקוח/ההערה מציינים "רינת לב" ויש URL ייעודי - עקיפה ל-endpoint הייעודי
    // (שלד בטוח: אם אין URL מוגדר - fallback למוסד הכללי, ללא שבירה)
    let rinatLevOverride = null;
    try {
      const rinatSetting = await getCachedSetting('nedarim_rinat_lev_url');
      const haystack = `${data.clientName || ''} ${data.notes || ''} ${data.email || ''}`;
      if (rinatSetting?.value && /רינת.?לב/.test(haystack)) {
        rinatLevOverride = rinatSetting.value;
      }
    } catch {}

    if (!mosadId) {
       return NextResponse.json({ success: false, error: 'מספר מוסד (MosadId) לא מוגדר במערכת. אנא עדכן את ההגדרות.' }, { status: 400 });
    }

    // Optional API token (nedarim_plus_token) - some Mosad accounts require it
    // alongside the Mosad ID; stored encrypted, see lib/secretCrypto.js.
    let token = '';
    const tokenSetting = await getCachedSetting('nedarim_plus_token');
    if (tokenSetting?.value && isEncryptedSecret(tokenSetting.value)) {
      try {
        token = decryptSecret(tokenSetting.value);
      } catch (e) {
        console.error('Failed to decrypt nedarim_plus_token:', e);
      }
    }

    const {
      clientName,
      address,
      phone,
      cardNumber,
      tokef,
      amount,
      installments,
      notes,
      zeout,
      cvv,
      email
    } = data;

    const result = await chargeNedarimPlus({
      mosadId,
      clientName,
      address,
      phone,
      cardNumber,
      tokef,
      amount,
      installments,
      notes,
      zeout,
      cvv,
      email,
      token,
      // 2 - endpoint ייעודי לרינת לב אם זוהה (chargeNedarimPlus יתעלם אם לא תומך - fallback רגיל)
      ...(rinatLevOverride ? { customEndpoint: rinatLevOverride } : {}),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Nedarim API Error:', error);
    return NextResponse.json({ success: false, error: 'שגיאה כללית בחיוב האשראי' }, { status: 500 });
  }
}