// Behavioural tests of the REAL routes against an in-memory prisma/auth shim (scripts/customer-consent-tests/shims). No DB, no network.
//  - POST/PUT /api/customers: explicit consents are validated in the SERVER, journaled with server-computed fields (time, employee, channel, versions,
//    wording), a forged body can't set any of them, a stale document version is a 409, a journal failure never fails the save (consentWarning)
//  - the feature is invisible while explicit_consent_enabled is off (legacy bodies behave exactly as before)
//  - GET /api/public-terms serves ONLY the configured, verified file with safe headers; /api/public-consent-info; /api/admin/terms-file
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(`${process.env.PROJ}/${rel}`).href);
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { resetPublicRateLimit } = await L('lib/publicRateLimit.js');
const idRoute = await L('app/api/customers/[id]/route.js');
const listRoute = await L('app/api/customers/route.js');
const termsRoute = await L('app/api/public-terms/route.js');
const infoRoute = await L('app/api/public-consent-info/route.js');
const adminRoute = await L('app/api/admin/terms-file/route.js');
const settingsRoute = await L('app/api/settings/route.js');

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 7)]);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const row = (over = {}) => ({
  id: 'c1', legacyId: 5, firstName: 'רחל', lastName: 'כהן', phone1: '0501234567', phone2: null, email: null, emailSuffix: null, city: null, street: null,
  houseNum: null, notes: null, bankName: null, bankBranch: null, bankAccount: null, bankAccountName: null, zeout: null, marketingConsent: false,
  isDeleted: false, hasSignedRegulations: false, regulationsSignedAt: null, updatedAt: new Date('2026-01-01T00:00:00.000Z'), ...over,
});
const setting = (key, value) => { const r = globalThis.__SETTINGS.find((s) => s.key === key); if (r) r.value = value; else globalThis.__SETTINGS.push({ key, value }); invalidateSettingsCache(); };
const withTerms = () => {
  globalThis.__ATTACHMENTS = [{ id: 'att-1', data: PDF, contentType: 'application/pdf' }];
  setting('terms_file_id', 'att-1'); setting('terms_file_sha256', sha(PDF)); setting('terms_file_type', 'application/pdf'); setting('terms_file_name', 'תקנון.pdf');
};

beforeEach(() => {
  globalThis.__CUSTOMERS = [row()];
  globalThis.__SETTINGS = [];
  globalThis.__AUDIT = [];
  globalThis.__CALLS = [];
  globalThis.__CONSENTS = [];
  globalThis.__ATTACHMENTS = [];
  globalThis.__MANUAL_AUDIT = [];
  globalThis.__CONSENT_FAIL = undefined;
  globalThis.__ACTOR = 'emp-1';
  globalThis.__AUTH = true;
  globalThis.__AUTH_ROLE_ONLY = false;
  resetPublicRateLimit();
  invalidateSettingsCache();
});

const json = (url, method, b) => new Request(`http://t.local${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
const post = async (b) => { const res = await listRoute.POST(json('/api/customers', 'POST', { email: 'new@example.com', ...b })); return { status: res.status, body: await res.json() }; };
const put = async (b, id = 'c1') => { const res = await idRoute.PUT(json(`/api/customers/${id}`, 'PUT', b), { params: Promise.resolve({ id }) }); return { status: res.status, body: await res.json() }; };
const get = async (id = 'c1') => { const res = await idRoute.GET(new Request(`http://t.local/api/customers/${id}`), { params: Promise.resolve({ id }) }); return { status: res.status, body: await res.json() }; };
const base = (over = {}) => ({ firstName: 'דנה', lastName: 'לוי', phone1: '0521234567', houseNum: '', ...over });
const full = (over = {}) => base({ consentExplicit: true, acceptedTerms: true, marketingConsent: true, acceptedPrivacy: true, consentSurface: 'new-order', ...over });
const cust = (id) => globalThis.__CUSTOMERS.find((c) => c.id === id);

// ---------- POST ----------
test('POST explicit: columns + 3 journal rows with server-computed fields; one Customer audit row and no hand-written audit rows', async () => {
  setting('explicit_consent_enabled', 'true'); withTerms();
  const t0 = Date.now();
  const r = await post(full({ termsVersion: sha(PDF) }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(!('consentWarning' in r.body));
  const c = cust(r.body.id);
  assert.equal(c.hasSignedRegulations, true);
  assert.ok(c.regulationsSignedAt instanceof Date && c.regulationsSignedAt.getTime() >= t0);
  assert.equal(c.marketingConsent, true);
  assert.deepEqual(globalThis.__CONSENTS.map((x) => [x.kind, x.granted, x.channel, x.method, x.surface, x.recordedByEmployeeId, x.customerId]),
    [['terms', true, 'staff', 'staff_recorded', 'new-order', 'emp-1', r.body.id], ['marketing', true, 'staff', 'staff_recorded', 'new-order', 'emp-1', r.body.id], ['privacy', true, 'staff', 'staff_recorded', 'new-order', 'emp-1', r.body.id]]);
  const terms = globalThis.__CONSENTS[0];
  assert.equal(terms.documentVersion, sha(PDF));
  assert.equal(terms.documentRef, 'att-1');
  assert.ok(globalThis.__CONSENTS[1].wording.includes('מאשר/ת קבלת דיוורים'));
  assert.equal(globalThis.__CONSENTS[2].documentVersion.length, 12);
  assert.equal(globalThis.__AUDIT.filter((a) => a.entityType === 'Customer').length, 1);
  assert.equal(globalThis.__MANUAL_AUDIT.length, 0);
});

test('POST explicit: a forged body cannot set the time, the employee, the channel, the version or the wording', async () => {
  setting('explicit_consent_enabled', 'true'); withTerms();
  const r = await post(full({ channel: 'kiosk', method: 'customer_self', recordedByEmployeeId: 'evil', createdAt: '1999-01-01T00:00:00Z', documentVersion: 'forged', wording: 'forged', regulationsSignedAt: '1999-01-01T00:00:00Z', surface: 'x' }));
  assert.equal(r.status, 200);
  for (const e of globalThis.__CONSENTS) { assert.equal(e.channel, 'staff'); assert.equal(e.method, 'staff_recorded'); assert.equal(e.recordedByEmployeeId, 'emp-1'); assert.notEqual(e.documentVersion, 'forged'); assert.notEqual(e.wording, 'forged'); assert.ok(e.createdAt.getFullYear() >= 2025); }
  assert.notEqual(cust(r.body.id).regulationsSignedAt.getFullYear(), 1999);
});

test('POST explicit: missing answers / missing privacy approval -> 400 and nothing is created', async () => {
  setting('explicit_consent_enabled', 'true');
  const before = globalThis.__CUSTOMERS.length;
  for (const b of [base({ consentExplicit: true }), full({ acceptedPrivacy: false }), full({ acceptedTerms: undefined }), full({ marketingConsent: 'yes' })]) {
    const r = await post(b);
    assert.equal(r.status, 400, JSON.stringify(r.body));
  }
  assert.equal(globalThis.__CUSTOMERS.length, before);
  assert.equal(globalThis.__CONSENTS.length, 0);
  // an explicit "No" to both is a complete answer
  const ok = await post(base({ consentExplicit: true, acceptedTerms: false, marketingConsent: false, acceptedPrivacy: true }));
  assert.equal(ok.status, 200);
  assert.deepEqual(globalThis.__CONSENTS.map((x) => `${x.kind}:${x.granted}`), ['terms:false', 'marketing:false', 'privacy:true']);
  assert.equal(cust(ok.body.id).hasSignedRegulations, false);
});

test('POST explicit with marketing hidden (hide_marketing_consent_field): marketing is not required and nothing is journaled for it', async () => {
  setting('explicit_consent_enabled', 'true'); setting('hide_marketing_consent_field', 'true');
  const r = await post(base({ consentExplicit: true, acceptedTerms: true, acceptedPrivacy: true }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(globalThis.__CONSENTS.map((x) => x.kind), ['terms', 'privacy']);
});

test('POST explicit: a stale terms/privacy version -> 409 CONSENT_DOC_CHANGED, nothing created', async () => {
  setting('explicit_consent_enabled', 'true'); withTerms();
  const before = globalThis.__CUSTOMERS.length;
  const r = await post(full({ termsVersion: 'f'.repeat(64) }));
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'CONSENT_DOC_CHANGED');
  const r2 = await post(full({ privacyVersion: 'stale0000000' }));
  assert.equal(r2.status, 409);
  assert.equal(globalThis.__CUSTOMERS.length, before);
});

test('POST: the feature OFF -> legacy bodies behave exactly as before (no journal, no new validation) even if the body claims consentExplicit', async () => {
  const r = await post(base({ marketingConsent: true }));
  assert.equal(r.status, 200);
  assert.equal(cust(r.body.id).marketingConsent, true);
  assert.equal(globalThis.__CONSENTS.length, 0, 'nothing journaled while the feature is off');
  assert.equal(globalThis.__CALLS.filter((c) => c.op.startsWith('customerConsent')).length, 0);
  // claiming consentExplicit while the setting is off still records what was explicitly chosen, but enforces nothing
  const r2 = await post(base({ consentExplicit: true, acceptedTerms: false }));
  assert.equal(r2.status, 200);
  assert.deepEqual(globalThis.__CONSENTS.map((x) => `${x.kind}:${x.granted}`), ['terms:false']);
});

test('POST: feature on but a LEGACY body (no consentExplicit): a true marketing consent is journaled, the default false is not', async () => {
  setting('explicit_consent_enabled', 'true');
  assert.equal((await post(base({ marketingConsent: false }))).status, 200);
  assert.equal(globalThis.__CONSENTS.length, 0);
  assert.equal((await post(base({ marketingConsent: true }))).status, 200);
  assert.deepEqual(globalThis.__CONSENTS.map((x) => `${x.kind}:${x.granted}`), ['marketing:true']);
});

test('POST: a journal failure (table not created yet / client without the model) never fails the save - the response carries consentWarning', async () => {
  setting('explicit_consent_enabled', 'true');
  for (const mode of ['table-missing', 'error']) {
    globalThis.__CONSENT_FAIL = mode;
    const r = await post(full());
    assert.equal(r.status, 200, mode);
    assert.ok(r.body.consentWarning, mode);
    assert.ok(cust(r.body.id), 'customer saved anyway');
    assert.equal(cust(r.body.id).hasSignedRegulations, true, 'the columns are still written');
  }
});

// ---------- PUT ----------
test('PUT explicit: changing marketing journals one row + one history entry; re-sending the same answer adds nothing', async () => {
  setting('explicit_consent_enabled', 'true');
  globalThis.__CUSTOMERS = [row({ marketingConsent: true })];
  const r = await put({ ...base(), cardVariant: 'a5', consentExplicit: true, marketingConsent: false, consentSurface: 'customer-card' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(cust('c1').marketingConsent, false);
  assert.deepEqual(globalThis.__CONSENTS.map((x) => `${x.kind}:${x.granted}:${x.surface}`), ['marketing:false:customer-card']);
  const again = await put({ ...base(), cardVariant: 'a5', consentExplicit: true, marketingConsent: false });
  assert.equal(again.status, 200);
  assert.equal(globalThis.__CONSENTS.length, 1, 'same answer as the latest journal row -> not duplicated');
  assert.equal(globalThis.__MANUAL_AUDIT.length, 0);
});

test('PUT explicit: terms yes/no go through the existing signature plan (server timestamp, one history entry) and are journaled', async () => {
  setting('explicit_consent_enabled', 'true'); withTerms();
  const r = await put({ firstName: 'רחל', lastName: 'כהן', phone1: '0501234567', houseNum: '', cardVariant: 'a5', consentExplicit: true, acceptedTerms: true, regulationsSignedAt: '1999-01-01T00:00:00Z' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(cust('c1').hasSignedRegulations, true);
  assert.notEqual(cust('c1').regulationsSignedAt.getFullYear(), 1999);
  assert.deepEqual(globalThis.__CONSENTS.map((x) => [x.kind, x.granted, x.documentVersion === sha(PDF)]), [['terms', true, true]]);
  assert.deepEqual(Object.keys(globalThis.__AUDIT.filter((a) => a.entityId === 'c1').at(-1).changes), ['hasSignedRegulations']);
});

test('PUT: an old form that re-sends the stored marketing flag never invents consent evidence; an unticked box is journaled as a withdrawal', async () => {
  setting('explicit_consent_enabled', 'true');
  globalThis.__CUSTOMERS = [row({ marketingConsent: true })];
  assert.equal((await put({ ...base(), marketingConsent: true })).status, 200);
  assert.equal(globalThis.__CONSENTS.length, 0);
  assert.equal((await put({ ...base(), marketingConsent: false })).status, 200);
  assert.deepEqual(globalThis.__CONSENTS.map((x) => `${x.kind}:${x.granted}`), ['marketing:false']);
});

test('PUT: require_marketing_consent uses the STORED value when an explicit form omits the unchanged flag', async () => {
  setting('explicit_consent_enabled', 'true'); setting('require_marketing_consent', 'true');
  globalThis.__CUSTOMERS = [row({ marketingConsent: true })];
  assert.equal((await put({ ...base(), cardVariant: 'a5' })).status, 200);
  globalThis.__CUSTOMERS = [row({ marketingConsent: false })];
  assert.equal((await put({ ...base(), cardVariant: 'a5' })).status, 400);
});

test('PUT: a customer row without the signature columns answers 503 when terms are sent (same rule as the legacy flag)', async () => {
  setting('explicit_consent_enabled', 'true');
  const r = row(); delete r.hasSignedRegulations; globalThis.__CUSTOMERS = [r];
  const res = await put({ ...base(), cardVariant: 'a5', consentExplicit: true, acceptedTerms: true });
  assert.equal(res.status, 503);
});

test('GET customer: the consent summary is attached only while the feature is on, newest row per kind, without employee ids', async () => {
  globalThis.__CONSENTS = [
    { id: '1', customerId: 'c1', kind: 'marketing', granted: true, channel: 'staff', method: 'staff_recorded', recordedByEmployeeId: 'secret-emp', createdAt: new Date('2026-01-01') },
    { id: '2', customerId: 'c1', kind: 'marketing', granted: false, channel: 'kiosk', method: 'customer_self', createdAt: new Date('2026-02-01') },
  ];
  assert.ok(!('consents' in (await get()).body));
  setting('explicit_consent_enabled', 'true');
  const g = await get();
  assert.equal(g.body.consents.marketing.granted, false);
  assert.equal(g.body.consents.marketing.channel, 'kiosk');
  assert.ok(!JSON.stringify(g.body.consents).includes('secret-emp'));
  globalThis.__CONSENT_FAIL = 'table-missing';
  invalidateSettingsCache();
  assert.equal((await get()).status, 200, 'a missing table never breaks the card');
});

// ---------- public terms ----------
const termsGet = (headers = {}) => termsRoute.GET(new Request('http://t.local/api/public-terms', { headers }));

test('public-terms: no configured file -> 404; configured -> the exact bytes inline with nosniff / CSP / ETag, no login needed', async () => {
  globalThis.__AUTH = false;
  assert.equal((await termsGet()).status, 404);
  withTerms();
  const res = await termsGet();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.match(res.headers.get('content-disposition'), /^inline;/);
  assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
  assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(res.headers.get('etag'), `"${sha(PDF)}"`);
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), PDF);
  assert.equal((await termsGet({ 'if-none-match': `"${sha(PDF)}"` })).status, 304);
  const dl = await termsRoute.GET(new Request('http://t.local/api/public-terms?download=1'));
  assert.match(dl.headers.get('content-disposition'), /^attachment;/);
});

test('public-terms: never serves anything but the configured file - a query id, a swapped file, a wrong type or a tampered hash are all 404', async () => {
  withTerms();
  globalThis.__ATTACHMENTS.push({ id: 'att-secret', data: Buffer.from('%PDF-1.7 secret screenshot'), contentType: 'application/pdf' });
  const other = await termsRoute.GET(new Request('http://t.local/api/public-terms?id=att-secret&file=att-secret'));
  assert.deepEqual(Buffer.from(await other.arrayBuffer()), PDF, 'query parameters never choose the file');
  globalThis.__ATTACHMENTS[0].data = Buffer.from('%PDF-1.7 tampered bytes ....');
  assert.equal((await termsGet()).status, 404, 'hash mismatch');
  globalThis.__ATTACHMENTS[0] = { id: 'att-1', data: Buffer.from('<html><script>alert(1)</script></html>'), contentType: 'text/html' };
  setting('terms_file_type', 'text/html');
  assert.equal((await termsGet()).status, 404, 'a stored html type is never allowed');
  setting('terms_file_id', 'att-missing'); setting('terms_file_type', 'application/pdf');
  assert.equal((await termsGet()).status, 404);
});

test('public-terms: rate limited per IP', async () => {
  withTerms();
  let last;
  for (let i = 0; i < 61; i++) last = await termsGet({ 'x-forwarded-for': '9.9.9.9' });
  assert.equal(last.status, 429);
  assert.ok(last.headers.get('retry-after'));
  assert.equal((await termsGet({ 'x-forwarded-for': '8.8.8.8' })).status, 200);
});

test('public-consent-info: public, versions + links + labels, nothing sensitive', async () => {
  globalThis.__AUTH = false;
  withTerms(); setting('explicit_consent_enabled', 'true'); setting('gmach_name', 'נווה יעקב');
  const res = await infoRoute.GET(new Request('http://t.local/api/public-consent-info'));
  assert.equal(res.status, 200);
  const b = await res.json();
  assert.equal(b.enabled, true);
  assert.equal(b.terms.version, sha(PDF));
  assert.equal(b.terms.fileUrl, '/api/public-terms');
  assert.equal(b.terms.pageUrl, '/terms');
  assert.equal(b.privacy.pageUrl, '/privacy');
  assert.equal(b.privacy.version.length, 12);
  assert.ok(b.marketing.detail.includes('להסיר'));
  assert.ok(!JSON.stringify(b).includes('att-1'), 'no attachment id leaks');
});

// ---------- admin terms file ----------
const upload = (bytes, name = 'תקנון.pdf', type = 'application/pdf') => {
  const fd = new FormData();
  fd.append('file', new File([bytes], name, { type }));
  return adminRoute.POST(new Request('http://t.local/api/admin/terms-file', { method: 'POST', body: fd }));
};

test('admin terms-file: head management only; a PDF becomes the active version, the history keeps the old one, one audit row per change', async () => {
  globalThis.__AUTH = false;
  assert.equal((await adminRoute.GET(new Request('http://t.local/api/admin/terms-file'))).status, 401);
  assert.equal((await upload(PDF)).status, 401);
  globalThis.__AUTH = true; globalThis.__AUTH_ROLE_ONLY = true;
  assert.equal((await upload(PDF)).status, 401, 'a logged-in non-head-management employee is refused');
  globalThis.__AUTH_ROLE_ONLY = false;
  const r = await upload(PDF);
  assert.equal(r.status, 200);
  const v1 = await r.json();
  assert.equal(v1.current.sha256, sha(PDF));
  assert.equal(v1.history.length, 1);
  const pdf2 = Buffer.concat([PDF, Buffer.from('second version')]);
  const v2 = await (await upload(pdf2, 'new.pdf')).json();
  assert.equal(v2.current.sha256, sha(pdf2));
  assert.deepEqual(v2.history.map((h) => h.active), [true, false], 'newest first, the old file stays as evidence');
  assert.equal(globalThis.__ATTACHMENTS.length, 2, 'the old file is never deleted');
  assert.equal(globalThis.__MANUAL_AUDIT.length, 2);
  assert.equal(globalThis.__MANUAL_AUDIT[0].action, 'TERMS_FILE_UPLOADED');
  assert.equal(globalThis.__MANUAL_AUDIT[0].employeeId, 'emp-1');
  const same = await (await upload(pdf2, 'again.pdf')).json();
  assert.equal(same.unchanged, true);
  assert.equal(globalThis.__ATTACHMENTS.length, 2, 'the identical file is not stored twice');
  // the public route now serves version 2
  assert.deepEqual(Buffer.from(await (await termsGet()).arrayBuffer()), pdf2);
  // viewing an old version from the admin screen works only for ids in the history
  const oldId = v2.history[1].id;
  assert.equal((await adminRoute.GET(new Request(`http://t.local/api/admin/terms-file?file=${oldId}`))).status, 200);
  assert.equal((await adminRoute.GET(new Request('http://t.local/api/admin/terms-file?file=att-secret'))).status, 404);
});

test('admin terms-file: only PDF/PNG/JPEG by content, size capped; remove clears the active file but keeps the history', async () => {
  assert.equal((await upload(Buffer.from('<html>x</html> padding padding'), 'a.pdf', 'application/pdf')).status, 415, 'the extension / claimed type do not matter');
  assert.equal((await upload(Buffer.from('PK\u0003\u0004 office zip bytes bytes'), 'a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).status, 415);
  assert.equal((await upload(Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(4 * 1024 * 1024 + 1)]))).status, 413);
  assert.equal(globalThis.__ATTACHMENTS.length, 0, 'nothing stored for refused files');
  await upload(PDF);
  const del = await adminRoute.DELETE();
  assert.equal(del.status, 200);
  const v = await del.json();
  assert.equal(v.current, null);
  assert.equal(v.history.length, 1);
  assert.equal((await termsGet()).status, 404);
  assert.equal(globalThis.__MANUAL_AUDIT.at(-1).action, 'TERMS_FILE_CLEARED');
});

test('settings: the generic settings API refuses to write terms_file_* keys (they would let an admin publish any attachment through the public route)', async () => {
  const res = await settingsRoute.POST(json('/api/settings', 'POST', [{ key: 'terms_file_id', value: 'att-secret' }]));
  assert.equal(res.status, 400);
  assert.ok(!globalThis.__SETTINGS.some((s) => s.key === 'terms_file_id'));
});

// ---------- kiosk / public self-registration adapter ----------
test('recordConsentsForCustomer (kiosk adapter): journal rows channel kiosk/customer_self without an employee, signature via the existing plan, stale version rejected, missing table tolerated', async () => {
  const { recordConsentsForCustomer } = await L('lib/customerConsentServer.js');
  withTerms(); setting('explicit_consent_enabled', 'true');
  globalThis.__CUSTOMERS = [row({ id: 'k1', marketingConsent: true })];
  const r = await recordConsentsForCustomer({ customerId: 'k1', channel: 'kiosk', consents: { acceptedTerms: true, marketingConsent: true, acceptedPrivacy: true, termsVersion: sha(PDF) }, meta: { station: 's1' } });
  assert.deepEqual([r.ok, r.recorded], [true, 3]);
  assert.deepEqual(globalThis.__CONSENTS.map((x) => [x.kind, x.granted, x.channel, x.method, x.surface, x.recordedByEmployeeId, x.documentVersion === sha(PDF) || x.kind !== 'terms']),
    [['terms', true, 'kiosk', 'customer_self', 'kiosk-register', null, true], ['marketing', true, 'kiosk', 'customer_self', 'kiosk-register', null, true], ['privacy', true, 'kiosk', 'customer_self', 'kiosk-register', null, true]]);
  assert.equal(cust('k1').hasSignedRegulations, true);
  assert.ok(cust('k1').regulationsSignedAt instanceof Date);
  const pub = await recordConsentsForCustomer({ customerId: 'k1', channel: 'public', consents: { acceptedTerms: true, marketingConsent: false, acceptedPrivacy: true } });
  assert.equal(pub.ok, true);
  assert.equal(globalThis.__CONSENTS.at(-1).channel === 'public' || globalThis.__CONSENTS.at(-1).kind === 'privacy', true);
  const stale = await recordConsentsForCustomer({ customerId: 'k1', consents: { acceptedTerms: true, marketingConsent: true, acceptedPrivacy: true, termsVersion: 'old' } });
  assert.deepEqual([stale.ok, stale.reason], [false, 'invalid']);
  assert.equal((await recordConsentsForCustomer({ customerId: 'nope', consents: { acceptedTerms: true } })).reason, 'no-customer');
  globalThis.__CONSENT_FAIL = 'table-missing';
  globalThis.__CUSTOMERS = [row({ id: 'k2' })];
  const miss = await recordConsentsForCustomer({ customerId: 'k2', consents: { acceptedTerms: true, marketingConsent: false, acceptedPrivacy: true } });
  assert.deepEqual([miss.ok, miss.reason], [true, 'table-missing']);
  assert.equal(cust('k2').hasSignedRegulations, true, 'the signature column is still written');
});
