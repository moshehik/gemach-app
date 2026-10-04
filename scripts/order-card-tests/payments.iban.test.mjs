// A15 (D4b): IBAN ישראלי → בנק/סניף/חשבון הקיימים, בלי DDL. ביקורת mod-97 (ISO 13616), פירוק, ושגיאות.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const I = await import(pathToFileURL(process.env.PROJ + '/lib/iban.js').href);

test('דוגמת IBAN ישראלי רשמית (ISO 13616 registry) עוברת ביקורת ומפורקת', () => {
  const r = I.parseIsraeliIban('IL62 0108 0000 0009 9999 999');
  assert.deepEqual(r, { ok: true, bankCode: '10', bankName: 'לאומי', bankBranch: '800', bankAccount: '99999999' });
  assert.equal(I.ibanChecksumOk('IL620108000000099999999'), true);
});

test('IBANs זרים תקינים עוברים את הביקורת הכללית (בדיקת mod-97 עצמה)', () => {
  for (const s of ['GB82 WEST 1234 5698 7654 32', 'DE89 3704 0044 0532 0130 00', 'FR14 2004 1010 0505 0001 3M02 606']) assert.equal(I.ibanChecksumOk(s), true, s);
});

test('שינוי ספרה אחת / החלפת שתי ספרות סמוכות → ביקורת נכשלת', () => {
  const good = 'IL620108000000099999999';
  for (let i = 4; i < good.length; i++) {
    const d = good[i] === '9' ? '8' : '9';
    assert.equal(I.ibanChecksumOk(good.slice(0, i) + d + good.slice(i + 1)), false, `ספרה ${i}`);
  }
  assert.equal(I.parseIsraeliIban('IL620108000000099999998').ok, false);
  assert.match(I.parseIsraeliIban('IL630108000000099999999').error, /ביקורת/);
});

test('build ↔ parse (סבב מלא) לכל קוד בנק ברשימה + קוד לא מוכר', () => {
  for (const code of [...Object.keys(I.IL_BANK_NAMES), '99']) {
    const iban = I.buildIsraeliIban(code, '075', '123456');
    assert.equal(iban.length, 23);
    const r = I.parseIsraeliIban(I.formatIban(iban));
    assert.equal(r.ok, true, iban);
    assert.equal(r.bankBranch, '75');
    assert.equal(r.bankAccount, '123456');
    assert.equal(r.bankName, I.IL_BANK_NAMES[Number(code)] || `בנק ${Number(code)}`);
  }
});

test('שגיאות קלט: ריק, לא IL, אורך שגוי, אותיות בגוף', () => {
  assert.equal(I.parseIsraeliIban('').ok, false);
  assert.match(I.parseIsraeliIban('GB82WEST12345698765432').error, /IL/);
  assert.match(I.parseIsraeliIban('IL6201080000000999999').error, /21 ספרות/);
  assert.equal(I.parseIsraeliIban('IL62010800000009999999A').ok, false);
  assert.equal(I.looksLikeIban('il62 0108'), true);
  assert.equal(I.looksLikeIban('123456'), false);
});

test('נרמול: רווחים, מקפים, אותיות קטנות', () => {
  assert.equal(I.normalizeIban(' il62-0108 0000.0009 9999 999 '), 'IL620108000000099999999');
  assert.equal(I.formatIban('IL620108000000099999999'), 'IL62 0108 0000 0009 9999 999');
});
