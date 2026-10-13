// קריאות ל-/api/admin/mailbox (הטוקן של Hostinger נשאר בשרת). כל כשל מוחזר כ-Error עם ההודעה שהשרת שלח.
export const API = '/api/admin/mailbox';

export async function api(path, init) {
  const res = await fetch(path, { cache: 'no-store', ...init });
  let data = null;
  try { data = await res.json(); } catch { /* לא JSON */ }
  if (!res.ok) throw new Error((data && data.error) || `שגיאה (${res.status})`);
  return data;
}

export const post = (body) => api(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const attachmentUrl = (folder, uid, att) => `${API}?action=attachment&folder=${encodeURIComponent(folder)}&uid=${uid}&id=${encodeURIComponent(att.id)}&name=${encodeURIComponent(att.filename || 'attachment')}`;
