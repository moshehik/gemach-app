#!/usr/bin/env node
/**
 * גשר Google Drive לגיבויי הגמח, דרך אותו פרויקט Apps Script משותף שכבר מריץ
 * את print-center ("apps-script-send", ArchiveBridge.js) ואת אתר "חומרים
 * לבגרות" - שלושתם באותו חשבון גוגל. שום פרויקט GAS חדש, שום URL חדש, שום
 * סוד חדש - בהתאם להחלטת הבעלים (17.09.2026): אותו גשר, הפרדה רק בדרייב
 * (root folder נפרד per-org). מקביל ל-driveBridgeCore.ts באתר הבגרות, מותאם
 * ל-CommonJS/Node רגיל (לא TypeScript, לא Next) כדי לרוץ מ-GitHub Actions.
 *
 * דורש DRIVE_BRIDGE_URL + DRIVE_BRIDGE_SECRET ב-env (GitHub secrets, לא
 * SystemSetting - הסוד משותף לשני הארגונים ולא שייך לאף DB ספציפי, בדיוק
 * כמו DATABASE_URL/DATABASE_URL_ORG2). שם התיקייה (root) הוא הדבר היחיד
 * שמפריד בין הארגונים בדרייב - כל ארגון מעביר root משלו.
 *
 * הקבצים בארכיון הזה תמיד פרטיים (ArchiveBridge.js לא עושה setSharing) -
 * שיתוף עם backup_owner_email נעשה כאן במפורש דרך permissions.create, לא
 * דרך שיתוף גורף "כל מי שיש לו קישור" כמו מצורפי המייל ללקוחות.
 */

'use strict';

const BRIDGE_TIMEOUT_MS = 55000;

function cfg() {
  const url = (process.env.DRIVE_BRIDGE_URL || '').trim();
  const secret = (process.env.DRIVE_BRIDGE_SECRET || '').trim();
  return { url, secret };
}

function isConfigured() {
  const { url, secret } = cfg();
  return Boolean(url && secret);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ה-echo endpoint שה-exec מפנה אליו לפעמים מחזיר 404 זמני (עניין consistency
// בצד גוגל, לא שגיאה אמיתית) - אותה תופעה ואותו תיקון כמו ב-driveBridgeCore.ts.
async function fetchOnceThroughRedirect(url, body, signal) {
  let res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal,
    redirect: 'manual',
  });
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location');
    if (!location) throw new Error(`הפניה מהגשר בלי כתובת יעד (${res.status})`);
    res = await fetch(location, { method: 'GET', signal });
    if (!res.ok) {
      await sleep(400);
      res = await fetch(location, { method: 'GET', signal });
    }
  }
  const text = await res.text();
  return { res, text };
}

async function callBridge(action, payload = {}) {
  const { url, secret } = cfg();
  if (!url || !secret) {
    throw new Error('גשר הדרייב לא מוגדר (חסרים DRIVE_BRIDGE_URL / DRIVE_BRIDGE_SECRET)');
  }
  const body = JSON.stringify({ secret, action, ...payload });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), BRIDGE_TIMEOUT_MS);
  try {
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      let res, text;
      try {
        ({ res, text } = await fetchOnceThroughRedirect(url, body, ctrl.signal));
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
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || `שגיאת גשר (${res.status})`);
      }
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

/** מוצא/יוצר את תיקיית ה-root של הארגון בדרייב (לפי שם). */
async function ping(root) {
  const r = await callBridge('archive_ping', { root });
  if (!r.rootFolderId) throw new Error('הגשר לא החזיר תיקיית ארכיון');
  return r.rootFolderId;
}

let tokenCache = null;
async function getAccessToken() {
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.token;
  const r = await callBridge('archive_token');
  if (!r.token) throw new Error('הגשר לא החזיר טוקן גישה לדרייב');
  tokenCache = { token: r.token, exp: Date.now() + 50 * 60 * 1000 };
  return tokenCache.token;
}

async function driveFetch(path, opts = {}) {
  const token = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  return res;
}

/** מעלה קובץ (Buffer) לתיקיית root, בהעלאה resumable ישירה מול Drive REST -
 * עוקף לגמרי את תקרת ה-~50MB של קריאת GAS רגילה (גיבויים רק יגדלו עם הזמן). */
async function uploadFile({ root, name, mimeType, buffer }) {
  const rootId = await ping(root);
  const total = buffer.length;
  const token = await getAccessToken();
  const init = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType || 'application/octet-stream',
      'X-Upload-Content-Length': String(total),
    },
    body: JSON.stringify({ name, mimeType: mimeType || 'application/octet-stream', parents: [rootId] }),
  });
  if (!init.ok) throw new Error(`פתיחת העלאה ישירה לדרייב נכשלה (${init.status})`);
  const sessionUri = init.headers.get('location');
  if (!sessionUri) throw new Error('דרייב לא החזיר session להעלאה');

  const STEP = 8 * 1024 * 1024;
  let off = 0;
  for (;;) {
    const end = Math.min(off + STEP, total);
    const chunk = buffer.subarray(off, end);
    const put = await fetch(sessionUri, {
      method: 'PUT',
      headers: { 'Content-Length': String(chunk.length), 'Content-Range': `bytes ${off}-${end - 1}/${total}` },
      body: chunk,
    });
    if (put.status === 308) {
      off = end;
      continue;
    }
    if (!put.ok) throw new Error(`נתח העלאה ישירה נכשל (${put.status})`);
    const meta = await put.json();
    return { fileId: meta.id, size: parseInt(meta.size || String(total), 10) || total, rootFolderId: rootId };
  }
}

/** משתף קובץ קריאה-בלבד עם כתובת מייל ספציפית (לא "כל מי שיש לו קישור"). */
async function shareFile(fileId, email) {
  const res = await driveFetch(`drive/v3/files/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'user', emailAddress: email }),
  });
  if (!res.ok) throw new Error(`שיתוף הקובץ עם ${email} נכשל (${res.status})`);
}

/** קישור לצפייה בקובץ (רק ל-owner/מי ששותף) */
function webViewLink(fileId) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/** כל הקבצים בתיקיית ה-root (שטוחה - לא נכנסים לתת-תיקיות). */
async function listFiles(root) {
  const rootId = await ping(root);
  const files = [];
  let pageToken;
  do {
    const params = new URLSearchParams({
      q: `'${rootId}' in parents and trashed=false`,
      fields: 'nextPageToken,files(id,name,createdTime,size)',
      pageSize: '1000',
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await driveFetch(`drive/v3/files?${params}`);
    if (!res.ok) throw new Error(`רשימת קבצי דרייב נכשלה (${res.status})`);
    const json = await res.json();
    for (const f of json.files || []) files.push(f);
    pageToken = json.nextPageToken;
  } while (pageToken);
  return files;
}

/** מוחק (לסל מיחזור) קובץ בודד לפי id, דרך Drive REST ישיר. */
async function deleteFile(fileId) {
  const res = await driveFetch(`drive/v3/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`מחיקת קובץ מהדרייב נכשלה (${res.status})`);
}

/** פרטי קובץ (שם, גודל, appProperties, trashed) - לאימות לפני הורדה. */
async function getFileInfo(fileId) {
  const res = await driveFetch(`drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,createdTime,appProperties,trashed`);
  if (!res.ok) throw new Error(`קריאת פרטי קובץ מהדרייב נכשלה (${res.status})`);
  return res.json();
}

/** מוריד קובץ מהדרייב ישירות לדיסק (זרם, בלי לטעון הכול לזיכרון). */
async function downloadFile(fileId, destPath) {
  const res = await driveFetch(`drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
  if (!res.ok || !res.body) throw new Error(`הורדת קובץ מהדרייב נכשלה (${res.status})`);
  const { Readable } = require('stream');
  const { pipeline } = require('stream/promises');
  await pipeline(Readable.fromWeb(res.body), require('fs').createWriteStream(destPath));
}

module.exports = { isConfigured, ping, uploadFile, shareFile, webViewLink, listFiles, deleteFile, getFileInfo, downloadFile };
