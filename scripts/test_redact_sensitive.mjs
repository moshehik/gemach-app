// בדיקת יחידה ל-lib/redactSensitive.js (הסתרת סודות / PII מ-PageVisitLog ומיומן השגיאות). לא נוגעת ב-DB.
// הרצה: node scripts/test_redact_sensitive.mjs   (יוצא עם קוד 1 אם משהו נכשל)
// הגרסה המקבילה בתוך app/layout.js נבדקת ב-scripts/test_visitlog_interceptor_rendered.mjs
import assert from 'node:assert/strict';
import { SECRET_SETTING_KEYS } from '../app/lib/secretSettingKeys.js';
import {
  REDACTED, MAX_BODY_LEN, isSensitiveKey, isAuthEndpoint, redactRequestQuery, redactUrl, redactLogText,
} from '../lib/redactSensitive.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const J = (o) => JSON.stringify(o);
const rq = (o, url = '/api/orders') => JSON.parse(redactRequestQuery(J(o), url));

t('sensitive key names (exact + patterns)', () => {
  for (const k of [
    'pin', 'PIN', 'approverPin', 'managerPin', 'authPin', 'pin_code', 'pinHash', 'employeePin',
    'password', 'newPassword', 'passwordConfirm', 'passcode', 'secret', 'clientSecret', 'token', 'accessToken', 'apiKey', 'api_key',
    'authorization', 'Authorization', 'credentials', 'otp', 'code', 'smsCode', 'verificationCode', 'resetCode',
    'zeout', 'customerZeout', 'idNumber', 'id_number', 'teudatZehut', 'nationalId',
    'bank', 'bankName', 'bankAccount', 'bankBranch', 'iban', 'IBAN', 'accountNumber',
    'card', 'cardNumber', 'cardExpiry', 'creditCard', 'ccNumber', 'cvv', 'CVV', 'cvc',
    'fileContent', 'base64', 'contentBase64', 'ssn', 'jwt',
  ]) assert.equal(isSensitiveKey(k), true, k);
});

t('ordinary keys are kept (no over-redaction of the working fields)', () => {
  for (const k of [
    'orderId', 'customerName', 'phone', 'status', 'barcode', 'dressId', 'notes', 'amount', 'paymentMethod', 'items',
    'eventDate', 'pickupDate', 'cardVariant', 'shipping', 'employeeId', 'className', 'timestamp', 'description',
  ]) assert.equal(isSensitiveKey(k), false, k);
});

t('JSON body: sensitive fields masked, rest untouched', () => {
  const out = rq({ orderId: 7, pin: '1234', password: 'hunter2', zeout: '123456789', iban: 'IL620108000000099999999', cardNumber: '4580458045804580', cvv: '123', notes: 'hello' });
  assert.deepEqual(out, { orderId: 7, pin: REDACTED, password: REDACTED, zeout: REDACTED, iban: REDACTED, cardNumber: REDACTED, cvv: REDACTED, notes: 'hello' });
});

t('nested objects and arrays', () => {
  const out = rq({ order: { customer: { name: 'x', idNumber: '1' }, payments: [{ amount: 5, card: { number: '4', cvv: '9' } }, { approverPin: '1111', amount: 2 }] } });
  assert.deepEqual(out, { order: { customer: { name: 'x', idNumber: REDACTED }, payments: [{ amount: 5, card: REDACTED }, { approverPin: REDACTED, amount: 2 }] } });
  const arr = JSON.parse(redactRequestQuery(J([{ managerPin: '1' }, { a: 1 }]), '/api/x'));
  assert.deepEqual(arr, [{ managerPin: REDACTED }, { a: 1 }]);
});

t('depth past 6 is dropped, not passed through (fail closed)', () => {
  let o = { pin: '9999' };
  for (let i = 0; i < 9; i++) o = { a: o };
  const text = redactRequestQuery(J(o), '/api/x');
  assert.ok(!text.includes('9999'));
});

t('file / base64 content is dropped', () => {
  const b64 = 'QUJD'.repeat(400);
  const out = rq({ to: 'a@b.c', attachments: [{ filename: 'x.pdf', content: b64 }, { filename: 'y.png', url: 'data:image/png;base64,' + 'A'.repeat(50) }], fileContent: b64 });
  assert.equal(out.attachments[0].content, REDACTED);
  assert.equal(out.attachments[1].url, REDACTED);
  assert.equal(out.fileContent, REDACTED);
  assert.equal(out.attachments[0].filename, 'x.pdf');
  assert.ok(!redactRequestQuery(J({ image: b64 }), '/api/x').includes('QUJD'));
});

t('long free text is truncated', () => {
  const out = rq({ notes: 'xx '.repeat(700) });
  assert.ok(out.notes.length < 400 && out.notes.startsWith('xx xx') && out.notes.endsWith('[נחתך]'));
});

t('auth endpoints: body dropped entirely', () => {
  for (const u of [
    '/api/login', '/api/logout', '/api/auth/verify-pin', '/api/auth/forgot-password', '/api/auth/trusted-device', '/api/auth/api-key-login',
    '/api/attendance', '/api/attendance/', '/api/dev/agent-login', '/api/employees/abc-123/password', '/api/employees/5/reset-password',
    '/api/employees/5/set-password', '/api/admin/api-keys', '/api/history', '/api/logs',
    'https://gemach.example/api/login', '/api/login?x=1', '/API/Login',
  ]) {
    assert.equal(isAuthEndpoint(u), true, u);
    assert.equal(redactRequestQuery(J({ x: 'harmless' }), u), null, u);
  }
});

t('non-auth endpoints are NOT dropped (regression for the PR #188 "\\/" collapse: every /api call was unlogged)', () => {
  for (const u of ['/api/orders', '/api/customers/5', '/api/dresses?x=1', '/api/employees', '/api/employees/5', '/api/attendance-sheet', '/api/auth-like', '/api/loginx']) {
    assert.equal(isAuthEndpoint(u), false, u);
    assert.equal(redactRequestQuery(J({ x: 1 }), u), J({ x: 1 }), u);
  }
});

t('truncated / invalid JSON: dropped when it mentions a sensitive word, kept otherwise', () => {
  assert.equal(redactRequestQuery('{"orderId":1,"pin":"12', '/api/x'), null);
  assert.equal(redactRequestQuery('{"zeout":"1234567', '/api/x'), null);
  assert.equal(redactRequestQuery('{"orderId":1,"notes":"abc', '/api/x'), '{"orderId":1,"notes":"abc');
});

t('non-JSON bodies: query strings are masked per param', () => {
  assert.equal(redactRequestQuery('?orderId=5&pin=1234', '/api/x'), '?orderId=5&pin=' + encodeURIComponent(REDACTED));
  assert.equal(redactRequestQuery('orderId=5&password=abc&zeout=1', '/api/x'), '?orderId=5&password=' + encodeURIComponent(REDACTED) + '&zeout=' + encodeURIComponent(REDACTED));
  assert.equal(redactRequestQuery('?orderId=5&page=2', '/api/x'), '?orderId=5&page=2');
});

t('non-JSON bodies: bare PIN / ID digits, bare base64, secret-looking text are dropped', () => {
  assert.equal(redactRequestQuery('1234', '/api/x'), null);
  assert.equal(redactRequestQuery('"123456789"', '/api/x'), null);
  assert.equal(redactRequestQuery('QUJD'.repeat(100) + '==', '/api/x'), null);
  assert.equal(redactRequestQuery('data:image/png;base64,AAAA', '/api/x'), null);
  assert.equal(redactRequestQuery('my password is x', '/api/x'), null);
  assert.equal(redactRequestQuery('plain text note', '/api/x'), 'plain text note');
});

t('empty input -> null', () => {
  assert.equal(redactRequestQuery('', '/api/x'), null);
  assert.equal(redactRequestQuery(null, '/api/x'), null);
  assert.equal(redactRequestQuery(undefined), null);
});

t('redactRequestQuery is idempotent (client-redacted text re-run on the server)', () => {
  const once = redactRequestQuery(J({ pin: '1', a: { zeout: '2' }, n: 'x'.repeat(900) }), '/api/x');
  assert.equal(redactRequestQuery(once, '/api/x'), once);
});

t('redactUrl: sensitive query params masked; auth endpoint loses its query entirely', () => {
  assert.equal(redactUrl('/api/orders'), '/api/orders');
  assert.equal(redactUrl('/api/orders?page=2'), '/api/orders?page=2');
  assert.equal(redactUrl('/api/orders?page=2&pin=1234'), '/api/orders?page=2&pin=' + encodeURIComponent(REDACTED));
  assert.equal(redactUrl('/api/x?token=abc&zeout=1'), '/api/x?token=' + encodeURIComponent(REDACTED) + '&zeout=' + encodeURIComponent(REDACTED));
  assert.equal(redactUrl('/api/attendance?code=1234'), '/api/attendance');
  assert.equal(redactUrl('/api/login?password=x'), '/api/login');
});

t('redactLogText: digit runs, base64 and length', () => {
  assert.ok(!redactLogText('שגיאה בלקוחה 0501234567 ת"ז 123456789').match(/[0-9]{7}/));
  assert.ok(!redactLogText('x' + 'QUJD'.repeat(40)).includes('QUJD'));
  assert.equal(redactLogText('xx '.repeat(300), 100).length, 101);
  assert.equal(redactLogText(null), '');
  assert.equal(redactLogText('שגיאה בשמירה'), 'שגיאה בשמירה');
  assert.equal(typeof redactLogText({ a: 1 }), 'string');
});

t('key/value pair objects: sibling value masked when the NAME is sensitive (SystemSetting arrays)', () => {
  const body = [
    { key: 'nedarim_plus_token', value: 'PLAINTEXT-TOKEN-1' }, { key: 'neon_api_key', value: 'napi_PLAINTEXT2' },
    { key: 'yemot_api_token', value: 'PLAINTEXT-3' }, { key: 'store_name', value: 'Gemach' }, { name: 'adminPassword', newValue: 'pw!', oldValue: 'old' },
  ];
  const out = JSON.parse(redactRequestQuery(J(body), '/api/orders'));
  assert.deepEqual(out.map((o) => o.value ?? o.newValue), [REDACTED, REDACTED, REDACTED, 'Gemach', REDACTED]);
  assert.equal(out[4].oldValue, REDACTED);
  assert.equal(out[0].key, 'nedarim_plus_token');
  const wrapped = JSON.parse(redactRequestQuery(J({ employeeId: 5, pin: '1234', items: body }), '/api/orders'));
  assert.equal(wrapped.pin, REDACTED);
  assert.ok(!J(wrapped).includes('PLAINTEXT'));
  for (const k of SECRET_SETTING_KEYS) assert.equal(isSensitiveKey(k), true, 'secret setting key not covered by the key rule: ' + k);
});

t('/api/settings* bodies are dropped entirely', () => {
  for (const u of ['/api/settings', '/api/settings/', '/api/settings/guide', '/api/settings/labels', '/api/a5/settings', '/api/a5/settings/approvers', '/api/admin/backups/settings'])
    assert.equal(redactRequestQuery(J([{ key: 'x', value: 'y' }]), u), null, u);
  for (const u of ['/api/settingsx', '/api/system-settings', '/api/my/settings-x']) assert.equal(isAuthEndpoint(u), false, u);
});

t('gmk_ API keys and Bearer tokens are masked anywhere (neutral keys, URLs, query strings, text)', () => {
  const key = 'gmk_' + 'a1B2c3D4e5F6g7H8i9';
  const out = redactRequestQuery(J({ note: 'use ' + key + ' now', headers: { x: 'Bearer abc.def-123' }, h: 'bearer   zzz' }), '/api/x');
  assert.ok(!out.includes(key) && !out.includes('abc.def') && !out.includes('zzz'));
  assert.ok(out.includes('Bearer ' + REDACTED));
  assert.ok(!redactUrl('/api/x/' + key + '?a=1').includes(key));
  assert.ok(!redactRequestQuery('?k=' + key, '/api/x').includes('a1B2c3'));
  assert.equal(redactRequestQuery('see ' + key, '/api/x'), null);
  assert.equal(redactRequestQuery('Authorization: Bearer abc', '/api/x'), null);
  assert.equal(redactRequestQuery(J({ k: 'gmk_short' }), '/api/x'), J({ k: 'gmk_short' }));
});

t('JSON inside a string value (one level) is scanned with the key rules', () => {
  const inner = J({ pin: '9876', amount: 5, nested: { zeout: '123' } });
  const out = JSON.parse(redactRequestQuery(J({ payload: inner, other: 'x' }), '/api/x'));
  assert.ok(!out.payload.includes('9876') && !out.payload.includes('123'));
  assert.deepEqual(JSON.parse(out.payload), { pin: REDACTED, amount: 5, nested: { zeout: REDACTED } });
  // broken / too long embedded JSON that mentions a secret key -> dropped, never passed through
  assert.equal(JSON.parse(redactRequestQuery(J({ p: '{"pin":"12' }), '/api/x')).p, REDACTED);
  assert.equal(JSON.parse(redactRequestQuery(J({ p: J({ a: 'xx '.repeat(200), pin: '1' }) }), '/api/x')).p, REDACTED);
  // idempotent
  const once = redactRequestQuery(J({ payload: inner }), '/api/x');
  assert.equal(redactRequestQuery(once, '/api/x'), once);
});

t('key-name gaps: pin*, pwd, ccv', () => {
  for (const k of ['pinCode', 'pin1', 'pinValue', 'pinNumber', 'pwd', 'userPwd', 'newPwd', 'ccv', 'CCV2']) assert.equal(isSensitiveKey(k), true, k);
  for (const k of ['pinned', 'pinnedItems', 'pinMode']) assert.equal(isSensitiveKey(k), false, k);
});

t('query string: duplicated keys scanned one by one, #fragment stripped', () => {
  const q = redactRequestQuery('?pin=1&pin=2&a=1&a=2', '/api/x');
  assert.equal(q, '?pin=' + encodeURIComponent(REDACTED) + '&pin=' + encodeURIComponent(REDACTED) + '&a=1&a=2');
  assert.equal(redactRequestQuery('?a=1#token=abc', '/api/x'), '?a=1');
  assert.equal(redactUrl('/orders?a=1&a=2#secret'), '/orders?a=1&a=2');
  assert.equal(redactUrl('/orders#frag'), '/orders');
  assert.ok(!decodeURIComponent(redactUrl('/api/x?a=1&a=%7B%22pin%22%3A%229876%22%7D')).includes('9876'));
  assert.equal(redactUrl('/api/x?t=1&t=Bearer%20abcdef'), '/api/x?t=1&t=Bearer+' + encodeURIComponent(REDACTED));
});

t('oversized body is dropped without parsing', () => {
  assert.equal(redactRequestQuery('{"a":"' + 'x '.repeat(MAX_BODY_LEN) + '"}', '/api/x'), null);
});

console.log(`\n${passed} passed${process.exitCode ? ' (with failures)' : ''}`);
