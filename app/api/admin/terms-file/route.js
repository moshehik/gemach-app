import { NextResponse } from 'next/server';
import prisma, { getActingEmployeeId } from '../../../lib/prisma';
import { checkAuth } from '@/lib/auth';
import { invalidateSettingsCache } from '@/lib/settingsCache';
import { loadConsentContext } from '@/lib/consentDocsLoad';
import {
  currentTermsFile, parseTermsHistory, sniffTermsType, hashBytes, safeTermsFileName, TERMS_ALLOWED_TYPES, TERMS_MAX_BYTES,
} from '@/lib/consentDocsServer';

// /api/admin/terms-file - ניהול קובץ התקנון (הנהלה ראשית / מתכנת). הקובץ נשמר בטבלת Attachment (כמו שאר הקבצים באתר) והמפתחות terms_file_*
// ב-SystemSetting מצביעים על הגרסה שבתוקף; הגרסאות הקודמות נשארות ב-DB (terms_file_history) כראיה למה שלקוחות אישרו בעבר - לא נמחקות.
//   GET            -> { current, history, limits }
//   GET ?file=<id> -> הקובץ עצמו לצפייה (רק מזהה שמופיע בהיסטוריה / בתוקף)
//   POST (multipart: file, name?) -> העלאה; הופך לגרסה שבתוקף
//   DELETE         -> מבטל את הקובץ שבתוקף (הלקוחות רואים "התקנון אינו זמין"); ההיסטוריה נשמרת
// מותר: PDF (מומלץ), PNG, JPEG - הסוג נקבע לפי תוכן הקובץ ולא לפי מה שהדפדפן טען. Word / SVG / HTML לא מותרים (אי אפשר להציג בדפדפן / פעיל).
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const deny = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

async function setKeys(pairs) {
  for (const [key, value] of Object.entries(pairs)) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value, name: key, category: 'לקוחות', type: 'text' },
    });
  }
  invalidateSettingsCache();
}

async function writeAudit(action, changes) {
  try {
    const employeeId = await getActingEmployeeId();
    // eslint-disable-next-line no-restricted-syntax -- upsert של SystemSetting אינו עובר בתוסף היומן, ולכן אין שורה אוטומטית
    await prisma.auditLog.create({ data: { entityType: 'SystemSetting', entityId: 'terms_file', action, changesJson: JSON.stringify(changes), employeeId: employeeId || null } });
  } catch (e) { console.error('terms-file audit row failed', e); }
}

function view(map) {
  const cur = currentTermsFile(map);
  const history = parseTermsHistory(map.get('terms_file_history')).slice().reverse();
  return {
    current: cur ? { id: cur.id, name: cur.name, type: cur.type, sha256: cur.sha256, uploadedAt: cur.uploadedAt } : null,
    history: history.map((h) => ({ id: h.id, name: h.name, type: h.type, sha256: h.sha256, uploadedAt: h.uploadedAt, active: !!cur && cur.id === h.id })),
    limits: { maxBytes: TERMS_MAX_BYTES, types: Object.keys(TERMS_ALLOWED_TYPES) },
  };
}

export async function GET(request) {
  if (!(await checkAuth('הנהלה ראשית'))) return deny();
  try {
    const { map } = await loadConsentContext();
    const fileId = new URL(request.url).searchParams.get('file');
    if (fileId) {
      const known = parseTermsHistory(map.get('terms_file_history')).find((h) => h.id === fileId);
      if (!known) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
      const row = await prisma.attachment.findUnique({ where: { id: known.id }, select: { data: true, contentType: true } });
      if (!row || !TERMS_ALLOWED_TYPES[row.contentType]) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
      return new Response(Buffer.from(row.data), { headers: {
        'Content-Type': row.contentType, 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(known.name)}`,
        'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; object-src 'self'", ...NO_STORE,
      } });
    }
    return NextResponse.json(view(map), { headers: NO_STORE });
  } catch (error) {
    console.error('terms-file GET failed:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request) {
  if (!(await checkAuth('הנהלה ראשית'))) return deny();
  try {
    let form;
    try { form = await request.formData(); } catch { return NextResponse.json({ error: 'הבקשה לא תקינה' }, { status: 400, headers: NO_STORE }); }
    const file = form.get('file');
    if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') return NextResponse.json({ error: 'לא נבחר קובץ' }, { status: 400, headers: NO_STORE });
    if (file.size > TERMS_MAX_BYTES) return NextResponse.json({ error: `הקובץ גדול מדי (עד ${Math.round(TERMS_MAX_BYTES / 1024 / 1024)}MB)` }, { status: 413, headers: NO_STORE });
    const buf = Buffer.from(await file.arrayBuffer());
    const type = sniffTermsType(buf);
    if (!type) return NextResponse.json({ error: 'סוג הקובץ אינו נתמך. יש להעלות PDF (מומלץ), או תמונה PNG / JPG. קובץ Word יש לשמור כ-PDF.' }, { status: 415, headers: NO_STORE });

    const sha256 = hashBytes(buf);
    const { map } = await loadConsentContext();
    const cur = currentTermsFile(map);
    if (cur && cur.sha256 === sha256) return NextResponse.json({ ...view(map), unchanged: true }, { headers: NO_STORE });

    const nameInput = typeof form.get('name') === 'string' ? form.get('name') : '';
    const name = safeTermsFileName(nameInput || file.name, type);
    const att = await prisma.attachment.create({ data: { data: buf, contentType: type }, select: { id: true } });
    const uploadedAt = new Date().toISOString();
    const history = parseTermsHistory(map.get('terms_file_history'));
    // אם אותו תוכן כבר היה בהיסטוריה (חזרה לגרסה ישנה), לא מכפילים שורה
    if (!history.some((h) => h.sha256 === sha256 && h.id === att.id)) history.push({ id: att.id, name, type, sha256, uploadedAt });
    await setKeys({
      terms_file_id: att.id, terms_file_name: name, terms_file_type: type, terms_file_sha256: sha256,
      terms_file_uploaded_at: uploadedAt, terms_file_history: JSON.stringify(history.slice(-50)),
    });
    await writeAudit('TERMS_FILE_UPLOADED', { terms_file_sha256: { from: cur ? cur.sha256 : null, to: sha256 }, name, type, bytes: buf.length });
    const fresh = await loadConsentContext();
    return NextResponse.json(view(fresh.map), { headers: NO_STORE });
  } catch (error) {
    console.error('terms-file POST failed:', error);
    return NextResponse.json({ error: 'ההעלאה נכשלה' }, { status: 500, headers: NO_STORE });
  }
}

export async function DELETE() {
  if (!(await checkAuth('הנהלה ראשית'))) return deny();
  try {
    const { map } = await loadConsentContext();
    const cur = currentTermsFile(map);
    if (!cur) return NextResponse.json(view(map), { headers: NO_STORE });
    await setKeys({ terms_file_id: '', terms_file_name: '', terms_file_type: '', terms_file_sha256: '', terms_file_uploaded_at: '' });
    await writeAudit('TERMS_FILE_CLEARED', { terms_file_sha256: { from: cur.sha256, to: null } });
    const fresh = await loadConsentContext();
    return NextResponse.json(view(fresh.map), { headers: NO_STORE });
  } catch (error) {
    console.error('terms-file DELETE failed:', error);
    return NextResponse.json({ error: 'הפעולה נכשלה' }, { status: 500, headers: NO_STORE });
  }
}
