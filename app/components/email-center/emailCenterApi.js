// fetch קטן ל-API של מרכז המיילים: מחזיר { ok, status, data } ולא זורק (שגיאות רשת = ok:false עם הודעה בעברית).
export async function api(path, { method = 'GET', body, form, signal } = {}) {
  try {
    const res = await fetch(path, {
      method,
      cache: 'no-store',
      signal,
      ...(form ? { body: form } : body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    return { ok: res.ok, status: res.status, data: data || {}, error: res.ok ? '' : (data && data.error) || `שגיאה (${res.status})` };
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, aborted: true, status: 0, data: {}, error: '' };
    return { ok: false, status: 0, data: {}, error: 'אין תקשורת עם השרת' };
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
