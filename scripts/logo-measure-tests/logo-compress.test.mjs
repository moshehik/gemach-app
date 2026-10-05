// lib/logoCompress.js - אוטומטית כל העלאת לוגו נדחסת. בלי DB ובלי שרת (sharp אמיתי על תמונות שנוצרות בזיכרון).
//   node --import ./scripts/logo-measure-tests/register.mjs --test scripts/logo-measure-tests/logo-compress.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const LC = await L('lib/logoCompress.js');
const LF = await L('lib/logoFormat.js');

// "צילום סריקה" של לוגו: מדרג צבעים + רעש עדין (גדול ב-PNG, סביר לדחיסה) עם פינה שקופה. noise=high => רעש מלא (גרוע ביותר).
async function noisyPng(w, h, { noise = 'low' } = {}) {
  const ch = 4;
  const raw = Buffer.alloc(w * h * ch);
  const rnd = randomBytes(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * ch;
      const n = rnd[y * w + x];
      if (noise === 'high') { raw[i] = n; raw[i + 1] = rnd[(y * w + x + 1) % rnd.length]; raw[i + 2] = rnd[(y * w + x + 7) % rnd.length]; }
      else { raw[i] = ((x * 255) / w + (n & 15)) & 255; raw[i + 1] = ((y * 255) / h + (n & 15)) & 255; raw[i + 2] = (128 + (n & 31)) & 255; }
      raw[i + 3] = x < 200 && y < 200 ? 0 : 255; // פינה שקופה
    }
  }
  return sharp(raw, { raw: { width: w, height: h, channels: ch } }).png({ compressionLevel: 1 }).toBuffer();
}
async function flatLogo(w, h) {
  return sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: { create: { width: Math.floor(w / 2), height: Math.floor(h / 2), channels: 4, background: { r: 200, g: 30, b: 90, alpha: 1 } } }, top: 40, left: 40 }])
    .png().toBuffer();
}

test('לוגו ענק ורועש: התוצר <= יעד, צד ארוך <= 512, מקור לא נשמר', async () => {
  const input = await noisyPng(1600, 1100);
  assert.ok(input.length > 2 * 1024 * 1024, `fixture should be a multi-MB original (got ${input.length})`);
  const r = await LC.compressLogoBuffer(input);
  assert.ok(r.bytes <= LC.LOGO_TARGET_BYTES, `output ${r.bytes} should be <= ${LC.LOGO_TARGET_BYTES}`);
  assert.equal(r.bytes, r.buffer.length);
  assert.ok(Math.max(r.width, r.height) <= LC.LOGO_MAX_PX);
  assert.equal(r.originalBytes, input.length);
  assert.ok(['image/png', 'image/webp'].includes(r.mime));
  assert.ok(r.buffer.length < input.length / 10);
});

test('שקיפות נשמרת (פינה שקופה נשארת שקופה)', async () => {
  const input = await noisyPng(1200, 1200);
  const r = await LC.compressLogoBuffer(input);
  const meta = await sharp(r.buffer).metadata();
  assert.equal(meta.hasAlpha, true);
  const { data, info } = await sharp(r.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0, 'pixel (0,0) alpha should stay 0');
  assert.equal(info.channels, 4);
});

test('לוגו שטוח קטן: נשאר קטן, לא מוגדל, שקיפות נשמרת', async () => {
  const input = await flatLogo(300, 200);
  const r = await LC.compressLogoBuffer(input);
  assert.ok(r.width <= 300 && r.height <= 200, 'no enlargement');
  assert.ok(r.bytes <= LC.LOGO_TARGET_BYTES);
  assert.equal((await sharp(r.buffer).metadata()).hasAlpha, true);
});

test('JPEG בלי שקיפות מתקבל ונדחס', async () => {
  const jpg = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 10, g: 120, b: 200 } } }).jpeg().toBuffer();
  const r = await LC.compressLogoBuffer(jpg);
  assert.ok(r.bytes <= LC.LOGO_TARGET_BYTES);
  assert.ok(Math.max(r.width, r.height) <= 512);
});

test('רעש מלא (מקרה גרוע): או מתכווץ ליעד/תקרה או נדחה בהודעה ברורה - אף פעם לא תוצר מעל התקרה', async () => {
  const input = await noisyPng(900, 900, { noise: 'high' });
  try {
    const r = await LC.compressLogoBuffer(input);
    assert.ok(r.bytes <= LC.LOGO_HARD_CAP_BYTES);
  } catch (e) {
    assert.ok(e instanceof LC.LogoError && e.code === 'too-large-output' && /תמונה/.test(e.message));
  }
});

test('קובץ שאינו תמונה נדחה בהודעה בעברית', async () => {
  await assert.rejects(() => LC.compressLogoBuffer(Buffer.from('this is not an image, just text '.repeat(50))), (e) => e instanceof LC.LogoError && e.code === 'not-image' && /תמונה/.test(e.message));
  await assert.rejects(() => LC.compressLogoBuffer(Buffer.from('<html><script>alert(1)</script></html>')), (e) => e.code === 'not-image');
});

test('קובץ ריק ו-קובץ ענק מדי נדחים', async () => {
  await assert.rejects(() => LC.compressLogoBuffer(Buffer.alloc(0)), (e) => e.code === 'empty');
  await assert.rejects(() => LC.compressLogoBuffer(Buffer.alloc(LC.LOGO_MAX_INPUT_BYTES + 1)), (e) => e.code === 'too-large-input' && /גדול/.test(e.message));
});

test('data URL: parse / round trip / compressLogoDataUrl', async () => {
  const input = await noisyPng(1500, 1500);
  const url = LC.toDataUrl(input, 'image/png');
  const parsed = LC.parseDataUrl(url);
  assert.equal(parsed.mime, 'image/png');
  assert.ok(parsed.buffer.equals(input));
  const r = await LC.compressLogoDataUrl(url);
  assert.ok(r.dataUrl.startsWith('data:image/'));
  assert.ok(r.dataUrl.length < url.length / 10);
  assert.equal(LC.parseDataUrl(r.dataUrl).buffer.length, r.bytes);
  assert.equal(LC.parseDataUrl('not a data url'), null);
  assert.equal(LC.parseDataUrl(null), null);
  await assert.rejects(() => LC.compressLogoDataUrl('hello'), (e) => e.code === 'not-image');
});

test('תצוגה: formatBytes / describeLogoResult', () => {
  assert.equal(LF.formatBytes(2.4 * 1048576), '2.4MB');
  assert.equal(LF.formatBytes(38 * 1024), '38KB');
  assert.equal(LF.formatBytes(500), '500B');
  assert.match(LF.describeLogoResult({ originalBytes: 2600000, storedBytes: 40000, width: 512, height: 300 }), /2\.5MB ← 39KB \(512×300\)/);
  assert.equal(LF.describeLogoResult({}), '');
});
