// POST /api/upload-logo + GET /api/logo, מול prisma בזיכרון (shim). בלי DB ובלי שרת.
//   node --import ./scripts/logo-measure-tests/register.mjs --test scripts/logo-measure-tests/upload-logo-route.test.mjs
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const up = await L('app/api/upload-logo/route.js');
const logo = await L('app/api/logo/route.js');
const SC = await L('lib/settingsCache.js');
const LC = await L('lib/logoCompress.js');

async function bigPng() {
  const w = 1800; const h = 1200;
  const raw = Buffer.alloc(w * h * 4);
  for (let i = 0; i < raw.length; i += 4) { raw[i] = (i / 4) % 251; raw[i + 1] = ((i / 4) >> 3) % 241; raw[i + 2] = 90; raw[i + 3] = i < 4000 ? 0 : 255; }
  return sharp(raw, { raw: { width: w, height: h, channels: 4 } }).png({ compressionLevel: 0 }).toBuffer();
}
const post = (file) => { const fd = new FormData(); if (file) fd.append('file', file); return up.POST(new Request('http://localhost/api/upload-logo', { method: 'POST', body: fd })); };

beforeEach(() => { globalThis.__ROLE_OK = true; globalThis.__AUTH_ROLES = []; globalThis.__SETTINGS.length = 0; globalThis.__MOCK_CALLS.length = 0; globalThis.__AUTH = true; SC.invalidateSettingsCache(); });

test('העלאה: נשמר data URL דחוס (לא המקור), התשובה כוללת לפני/אחרי', async () => {
  const input = await bigPng();
  assert.ok(input.length > 1024 * 1024);
  const res = await post(new File([input], 'logo.png', { type: 'image/png' }));
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.success, true);
  assert.equal(j.originalBytes, input.length);
  assert.ok(j.storedBytes <= LC.LOGO_TARGET_BYTES && j.storedBytes > 0);
  assert.ok(Math.max(j.width, j.height) <= LC.LOGO_MAX_PX);
  const stored = globalThis.__SETTINGS.find((s) => s.key === 'BRAND_LOGO');
  assert.ok(stored, 'BRAND_LOGO row written');
  assert.ok(/^data:image\/(png|webp);base64,/.test(stored.value));
  assert.equal(LC.parseDataUrl(stored.value).buffer.length, j.storedBytes);
  assert.ok(stored.value.length < input.length / 5, 'raw original must not be stored');
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.op === 'upsert').length, 1);
});

test('העלאה: אחרי שמירה הלוגו החדש מוגש מיד (מטמון ההגדרות בוטל)', async () => {
  globalThis.__SETTINGS.push({ id: 'x', key: 'BRAND_LOGO', value: 'data:image/png;base64,AAAA', updatedAt: new Date('2026-01-01T00:00:00Z') });
  await SC.getCachedSetting('BRAND_LOGO'); // ממלא מטמון עם הערך הישן
  const res = await post(new File([await bigPng()], 'l.png', { type: 'image/png' }));
  assert.equal(res.status, 200);
  const row = await SC.getCachedSetting('BRAND_LOGO');
  assert.ok(row.value.length > 100 && row.value !== 'data:image/png;base64,AAAA');
});

test('העלאה: רק הנהלה ראשית (checkAuth("הנהלה ראשית")); עובד מחובר רגיל => 401 ולא נכתב ולא נדחס כלום', async () => {
  globalThis.__ROLE_OK = false;
  const res = await post(new File([await bigPng()], 'l.png', { type: 'image/png' }));
  assert.equal(res.status, 401);
  assert.ok(globalThis.__AUTH_ROLES.includes('הנהלה ראשית'));
  assert.equal(globalThis.__SETTINGS.length, 0);
});

test('העלאה: קובץ שאינו תמונה => 400 בעברית ולא נכתב כלום', async () => {
  const res = await post(new File([Buffer.from('MZ\x90\x00 not an image '.repeat(30))], 'evil.png', { type: 'image/png' }));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /תמונה/);
  assert.equal(globalThis.__SETTINGS.length, 0);
});

test('העלאה: בלי קובץ => 400; לא מחובר => 401; קובץ ענק => 413', async () => {
  assert.equal((await post(null)).status, 400);
  globalThis.__AUTH = false;
  assert.equal((await post(new File([Buffer.from('x')], 'a.png'))).status, 401);
  globalThis.__AUTH = true;
  const big = new File([Buffer.alloc(LC.LOGO_MAX_INPUT_BYTES + 10)], 'big.png', { type: 'image/png' });
  const res = await post(big);
  assert.equal(res.status, 413);
  assert.match((await res.json()).error, /גדול מדי/);
  assert.equal(globalThis.__SETTINGS.length, 0);
});

test('הגשה: 404 כשאין לוגו; כשיש - Cache-Control ארוך, ETag, ו-304 בבקשה חוזרת', async () => {
  assert.equal((await logo.GET(new Request('http://localhost/api/logo'))).status, 404);
  SC.invalidateSettingsCache(); // ה-404 נמטמן (null) - מנקים כמו שהעלאה אמיתית עושה
  const png = await sharp({ create: { width: 40, height: 20, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } } }).png().toBuffer();
  globalThis.__SETTINGS.push({ id: 'x', key: 'BRAND_LOGO', value: LC.toDataUrl(png, 'image/png'), updatedAt: new Date('2026-10-01T00:00:00Z') });
  const r1 = await logo.GET(new Request('http://localhost/api/logo'));
  assert.equal(r1.status, 200);
  assert.equal(r1.headers.get('content-type'), 'image/png');
  assert.match(r1.headers.get('cache-control'), /max-age=31536000/);
  assert.equal(r1.headers.get('x-logo-oversize'), null);
  assert.equal(r1.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r1.headers.get('content-security-policy'), "default-src 'none'; sandbox");
  assert.ok(Buffer.from(await r1.arrayBuffer()).equals(png));
  const etag = r1.headers.get('etag');
  assert.ok(etag);
  const r2 = await logo.GET(new Request('http://localhost/api/logo', { headers: { 'if-none-match': etag } }));
  assert.equal(r2.status, 304);
});

test('הגשה: שורה ישנה עם SVG/HTML לא מוגשת (415) ובכל מקרה עם nosniff + CSP', async () => {
  for (const mime of ['image/svg+xml', 'text/html', 'application/javascript']) {
    SC.invalidateSettingsCache(); globalThis.__SETTINGS.length = 0;
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    globalThis.__SETTINGS.push({ id: 'x', key: 'BRAND_LOGO', value: LC.toDataUrl(svg, mime), updatedAt: new Date('2026-10-01T00:00:00Z') });
    const r = await logo.GET(new Request('http://localhost/api/logo'));
    assert.equal(r.status, 415, mime);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.match(r.headers.get('content-security-policy'), /sandbox/);
    assert.ok(!/svg|html|javascript/.test(r.headers.get('content-type') || ''), 'never echoes the stored type');
  }
  // webp/jpeg/gif מותרים, image/jpg הישן מנורמל
  for (const [mime, expected] of [['image/webp', 'image/webp'], ['image/jpeg', 'image/jpeg'], ['image/gif', 'image/gif'], ['image/jpg', 'image/jpeg']]) {
    SC.invalidateSettingsCache(); globalThis.__SETTINGS.length = 0;
    globalThis.__SETTINGS.push({ id: 'x', key: 'BRAND_LOGO', value: LC.toDataUrl(Buffer.from('abc'), mime), updatedAt: new Date('2026-10-02T00:00:00Z') });
    const r = await logo.GET(new Request('http://localhost/api/logo'));
    assert.equal(r.status, 200, mime);
    assert.equal(r.headers.get('content-type'), expected);
  }
});

test('הגשה: לוגו ישן וגדול (>300KB) מוגש עם מטמון ארוך + x-logo-oversize', async () => {
  const big = Buffer.alloc(400 * 1024, 7);
  globalThis.__SETTINGS.push({ id: 'x', key: 'BRAND_LOGO', value: LC.toDataUrl(big, 'image/png'), updatedAt: new Date('2026-10-01T00:00:00Z') });
  const r = await logo.GET(new Request('http://localhost/api/logo'));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-logo-oversize'), '1');
  assert.match(r.headers.get('cache-control'), /max-age=31536000/);
});
