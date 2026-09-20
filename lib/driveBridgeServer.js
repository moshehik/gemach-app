// גשר Google Drive לצד השרת של האפליקציה (Vercel) — הקלטות מסך של עוזר ה-AI עולות
// ישר לדרייב (ולא למסד Neon), ומשם השרת מוריד אותן ומעביר ל-Gemini.
//
// אותו גשר Apps Script משותף ("ArchiveBridge.js" בפרויקט apps-script-send) שכבר משמש את
// גיבויי הדרייב (scripts/lib/driveBridge.js — גרסת CommonJS ל-GitHub Actions; זו גרסת ESM
// לשרת). דורש DRIVE_BRIDGE_URL + DRIVE_BRIDGE_SECRET ב-env של פרויקט ה-Vercel.
//
// אבטחה: טוקן ה-OAuth של הגשר נשאר בזיכרון השרת בלבד. ללקוח (הדפדפן) נשלח רק
// "session URI" של העלאה resumable לקובץ יחיד — הוא לא נותן גישה לשום דבר אחר בדרייב.

const BRIDGE_TIMEOUT_MS = 55000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cfg() {
  return {
    url: (process.env.DRIVE_BRIDGE_URL || '').trim(),
    secret: (process.env.DRIVE_BRIDGE_SECRET || '').trim(),
  };
}

export function isDriveBridgeConfigured() {
  const { url, secret } = cfg();
  return Boolean(url && secret);
}

// שם תיקיית ה-root בדרייב — נפרד לכל אתר (שני הגמ"חים משתמשים באותו גשר), נגזר מהדומיין
// של פרויקט ה-Vercel כדי שהקלטות של שני הארגונים לא יתערבבו.
export function recordingsRootName() {
  const host = (process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || 'local')
    .replace(/^https?:\/\//, '')
    .replace(/\.vercel\.app$/, '')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .slice(0, 60);
  return `gemach-ai-recordings-${host}`;
}

async function fetchThroughRedirect(url, body, signal) {
  let res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal, redirect: 'manual' });
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location');
    if (!location) throw new Error(`הפניה מהגשר בלי כתובת יעד (${res.status})`);
    res = await fetch(location, { method: 'GET', signal });
    if (!res.ok) {
      await sleep(400);
      res = await fetch(location, { method: 'GET', signal });
    }
  }
  return { res, text: await res.text() };
}

async function callBridge(action, payload = {}) {
  const { url, secret } = cfg();
  if (!url || !secret) throw new Error('גשר הדרייב לא מוגדר (חסרים DRIVE_BRIDGE_URL / DRIVE_BRIDGE_SECRET)');
  const body = JSON.stringify({ secret, action, ...payload });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), BRIDGE_TIMEOUT_MS);
  try {
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      let res, text;
      try {
        ({ res, text } = await fetchThroughRedirect(url, body, ctrl.signal));
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        lastErr = e;
        continue;
      }
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        lastErr = new Error(`תשובה לא תקינה מהגשר (${res.status}): ${text.slice(0, 200)}`);
        if (attempt < 3) await sleep(500 * attempt);
        continue;
      }
      if (!res.ok || json.ok === false) throw new Error(json.error || `שגיאת גשר (${res.status})`);
      return json;
    }
    throw lastErr || new Error('שגיאת גשר לא ידועה');
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('גשר הדרייב לא ענה בזמן (timeout)');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

let tokenCache = null;
async function getAccessToken() {
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.token;
  const r = await callBridge('archive_token');
  if (!r.token) throw new Error('הגשר לא החזיר טוקן גישה לדרייב');
  tokenCache = { token: r.token, exp: Date.now() + 50 * 60 * 1000 };
  return tokenCache.token;
}

const rootIdCache = new Map();

/** מוצא/יוצר את תיקיית ה-root של ההקלטות ומחזיר את מזהה התיקייה (נשמר בזיכרון — כל קריאת גשר היא כמה שניות). */
export async function ensureRecordingsRoot() {
  const name = recordingsRootName();
  if (rootIdCache.has(name)) return rootIdCache.get(name);
  const r = await callBridge('archive_ping', { root: name });
  if (!r.rootFolderId) throw new Error('הגשר לא החזיר תיקיית ארכיון');
  rootIdCache.set(name, r.rootFolderId);
  return r.rootFolderId;
}

/**
 * פותח העלאה resumable ישירה מול Drive לקובץ חדש בתיקיית ההקלטות, ומחזיר את ה-session URI.
 * ה-Origin של האתר נשלח בפתיחה — בלי זה הדפדפן לא יוכל לבצע PUT ל-URI וגם לקרוא את התשובה (CORS).
 */
export async function startResumableUpload({ name, mimeType, size, origin }) {
  const rootId = await ensureRecordingsRoot();
  const token = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': mimeType,
  };
  if (size) headers['X-Upload-Content-Length'] = String(size);
  if (origin) headers.Origin = origin;
  const init = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers,
    // appProperties: סימון שמאפשר ל-downloadRecording לאמת שהקובץ הוא הקלטה של האתר הזה בלי קריאת גשר נוספת
    body: JSON.stringify({ name, mimeType, parents: [rootId], appProperties: { gemachAiRecording: recordingsRootName() } }),
  });
  if (!init.ok) throw new Error(`פתיחת העלאה לדרייב נכשלה (${init.status})`);
  const sessionUri = init.headers.get('location');
  if (!sessionUri) throw new Error('דרייב לא החזיר session להעלאה');
  return { sessionUri };
}

/**
 * מוריד הקלטה מהדרייב כ-Buffer. מאמת שהקובץ נוצר ע"י האתר הזה (appProperties.gemachAiRecording
 * שווה לשם תיקיית ההקלטות של האתר) ושמו מתחיל ב-"rec-" — הטוקן של הגשר רחב, ואסור שלקוח יוכל
 * לבקש קובץ אחר כלשהו מהדרייב.
 */
export async function downloadRecording(fileId) {
  if (!/^[A-Za-z0-9_-]{10,80}$/.test(String(fileId || ''))) throw new Error('מזהה קובץ לא חוקי');
  const token = await getAccessToken();
  const auth = { Authorization: `Bearer ${token}` };
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,appProperties,trashed`,
    { headers: auth }
  );
  if (!metaRes.ok) throw new Error(`קריאת פרטי הקובץ מהדרייב נכשלה (${metaRes.status})`);
  const meta = await metaRes.json();
  if (meta.trashed || meta.appProperties?.gemachAiRecording !== recordingsRootName() || !String(meta.name || '').startsWith('rec-')) {
    throw new Error('הקובץ אינו הקלטה של האתר הזה');
  }
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { headers: auth });
  if (!res.ok) throw new Error(`הורדת ההקלטה מהדרייב נכשלה (${res.status})`);
  return { buffer: Buffer.from(await res.arrayBuffer()), mimeType: meta.mimeType || 'video/webm' };
}
