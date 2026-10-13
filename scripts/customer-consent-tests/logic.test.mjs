// Pure tests for the explicit-consent feature: lib/customerConsent.js (answers, validation, write plan, kiosk registration plan, journal wrapper),
// lib/consentForm.js (client-side helpers), lib/consentDocsServer.js (terms file sniffing, privacy resolution), lib/privacyPolicyDefault.js,
// lib/publicRateLimit.js and lib/enterNavigation.js (against a tiny fake DOM). No DB, no network, no browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(`${process.env.PROJ}/${rel}`).href);
const C = await L('lib/customerConsent.js');
const F = await L('lib/consentForm.js');
const D = await L('lib/consentDocsServer.js');
const P = await L('lib/privacyPolicyDefault.js');
const R = await L('lib/publicRateLimit.js');
const N = await L('lib/enterNavigation.js');

const NOW = new Date('2026-10-12T09:00:00.000Z');
const DOCS = { termsVersion: 'a'.repeat(64), termsRef: 'att-1', privacyVersion: 'p1p1p1p1p1p1' };
const ON = { explicit_consent_enabled: 'true' };
const ctx = (over = {}) => ({ channel: 'staff', method: 'staff_recorded', surface: 'new-order', employeeId: 'emp-1', docs: DOCS, ...over });
const plan = (body, { existing = null, latest = {}, c = ctx() } = {}) => C.planConsentWrite({ answers: C.readConsentAnswers(body), existing, latest, ctx: c, now: NOW });
const kinds = (p) => p.entries.map((e) => `${e.kind}:${e.granted}`);

// ---------- config + answers ----------
test('config: missing settings = everything off (the pre-change behaviour)', () => {
  const off = C.consentConfig(new Map());
  assert.deepEqual(off, { enabled: false, hideMarketing: false, requireMarketingYes: false, requirePrivacy: false });
  assert.equal(C.consentConfig(ON).enabled, true);
  assert.equal(C.consentConfig(ON).requirePrivacy, true, 'privacy is required by default once the feature is on');
  assert.equal(C.consentConfig({ ...ON, require_privacy_acceptance: 'false' }).requirePrivacy, false);
  assert.equal(C.consentConfig(new Map([['explicit_consent_enabled', 'true'], ['hide_marketing_consent_field', 'true']])).hideMarketing, true);
});

test('answers: explicit booleans are kept, null/absent = unanswered, non-booleans are errors (nothing guessed)', () => {
  const a = C.readConsentAnswers({ consentExplicit: true, acceptedTerms: false, marketingConsent: false, acceptedPrivacy: true });
  assert.deepEqual([a.explicit, a.terms, a.marketing, a.privacy, a.errors], [true, false, false, true, []]);
  const none = C.readConsentAnswers({ consentExplicit: true, acceptedTerms: null });
  assert.deepEqual([none.terms, none.marketing, none.privacy], [undefined, undefined, undefined]);
  assert.equal(C.readConsentAnswers({ acceptedTerms: 'yes' }).errors.length, 1);
  assert.equal(C.readConsentAnswers({ consentExplicit: true, marketingConsent: 'yes' }).errors.length, 1);
  assert.equal(C.readConsentAnswers({ acceptedPrivacy: 'yes' }).errors.length, 1);
  assert.equal(C.readConsentAnswers({ acceptedPrivacy: false }).privacy, undefined, 'an unticked privacy box is not an answer');
  assert.equal(C.readConsentAnswers(null).explicit, false);
  // consentExplicit must be exactly true
  assert.equal(C.readConsentAnswers({ consentExplicit: 'true' }).explicit, false);
});

test('validation: required answers only for a NEW customer, with the feature on and the explicit declaration', () => {
  const cfg = C.consentConfig(ON);
  const empty = C.readConsentAnswers({ consentExplicit: true });
  assert.equal(C.validateConsentAnswers({ answers: empty, config: cfg, isNew: true }).length, 3);
  assert.equal(C.validateConsentAnswers({ answers: empty, config: cfg, isNew: false }).length, 0, 'editing an old customer never blocks on consents');
  assert.equal(C.validateConsentAnswers({ answers: C.readConsentAnswers({}), config: cfg, isNew: true }).length, 0, 'legacy form (no declaration) is not blocked');
  assert.equal(C.validateConsentAnswers({ answers: empty, config: C.consentConfig(new Map()), isNew: true }).length, 0, 'feature off');
  const hidden = C.consentConfig(new Map([['explicit_consent_enabled', 'true'], ['hide_marketing_consent_field', 'true']]));
  assert.equal(C.validateConsentAnswers({ answers: empty, config: hidden, isNew: true }).length, 2, 'marketing hidden -> not required');
  const full = C.readConsentAnswers({ consentExplicit: true, acceptedTerms: false, marketingConsent: false, acceptedPrivacy: true });
  assert.deepEqual(C.validateConsentAnswers({ answers: full, config: cfg, isNew: true }), [], 'No/No + privacy ticked is a complete answer');
  const noPriv = C.readConsentAnswers({ consentExplicit: true, acceptedTerms: true, marketingConsent: true });
  assert.deepEqual(C.validateConsentAnswers({ answers: noPriv, config: cfg, isNew: true }), ['יש לאשר את מדיניות הפרטיות']);
});

test('echoed versions: a stale terms/privacy version is rejected, a missing one is fine', () => {
  assert.deepEqual(C.checkEchoedVersions({}, DOCS), []);
  assert.deepEqual(C.checkEchoedVersions({ termsVersion: DOCS.termsVersion, privacyVersion: DOCS.privacyVersion }, DOCS), []);
  assert.equal(C.checkEchoedVersions({ termsVersion: 'old' }, DOCS).length, 1);
  assert.equal(C.checkEchoedVersions({ privacyVersion: 'old' }, DOCS).length, 1);
  assert.deepEqual(C.checkEchoedVersions({ termsVersion: 'x' }, { termsVersion: null }), [], 'no terms file configured -> nothing to compare');
});

// ---------- the write plan ----------
test('plan: a new customer with explicit Yes/Yes/privacy -> columns + 3 journal rows, all server-computed', () => {
  const p = plan({ consentExplicit: true, acceptedTerms: true, marketingConsent: true, acceptedPrivacy: true, regulationsSignedAt: '1999-01-01', createdAt: '1999-01-01', recordedByEmployeeId: 'evil' });
  assert.equal(p.data.hasSignedRegulations, true);
  assert.deepEqual(p.data.regulationsSignedAt, NOW, 'server time, never the body');
  assert.equal(p.data.marketingConsent, true);
  assert.deepEqual(kinds(p), ['terms:true', 'marketing:true', 'privacy:true']);
  const [t, m, v] = p.entries;
  for (const e of p.entries) { assert.equal(e.channel, 'staff'); assert.equal(e.method, 'staff_recorded'); assert.equal(e.recordedByEmployeeId, 'emp-1'); assert.equal(e.surface, 'new-order'); assert.ok(!('createdAt' in e)); }
  assert.equal(t.documentVersion, DOCS.termsVersion);
  assert.equal(t.documentRef, 'att-1');
  assert.equal(m.wording, C.MARKETING_WORDING);
  assert.equal(m.documentVersion, C.MARKETING_WORDING_VERSION);
  assert.equal(v.documentVersion, DOCS.privacyVersion);
});

test('plan: an explicit NO is evidence too (journal row, granted=false) and writes no signature', () => {
  const p = plan({ consentExplicit: true, acceptedTerms: false, marketingConsent: false });
  assert.deepEqual(kinds(p), ['terms:false', 'marketing:false']);
  assert.equal(p.data.hasSignedRegulations, undefined);
  assert.equal(p.data.marketingConsent, false);
});

test('plan: legacy (non-explicit) create: only a TRUE marketing consent is journaled; the default false is "unanswered", not a refusal', () => {
  assert.deepEqual(kinds(plan({ marketingConsent: false })), []);
  assert.deepEqual(kinds(plan({ marketingConsent: true })), ['marketing:true']);
});

test('plan: editing - explicit answers equal to the latest journal row are not duplicated; a change is', () => {
  const existing = { marketingConsent: true, hasSignedRegulations: true };
  const latest = { marketing: { granted: true, createdAt: '2026-01-01' }, terms: { granted: true, createdAt: '2026-01-01' } };
  assert.deepEqual(kinds(plan({ consentExplicit: true, marketingConsent: true, acceptedTerms: true }, { existing, latest })), []);
  const changed = plan({ consentExplicit: true, marketingConsent: false }, { existing, latest });
  assert.deepEqual(kinds(changed), ['marketing:false']);
  assert.equal(changed.data.marketingConsent, false);
  assert.deepEqual(changed.changes.marketingConsent, { from: true, to: false });
  const unsign = plan({ consentExplicit: true, acceptedTerms: false }, { existing, latest });
  assert.deepEqual(kinds(unsign), ['terms:false']);
  assert.equal(unsign.data.hasSignedRegulations, false);
  assert.equal(unsign.data.regulationsSignedAt, undefined, 'un-signing keeps the stored timestamp as the revoked marker (existing rule)');
});

test('plan: a legacy customer (true in the column, no journal) re-affirmed explicitly gets a fresh row; untouched legacy saves never invent evidence', () => {
  const existing = { marketingConsent: true, hasSignedRegulations: false };
  assert.deepEqual(kinds(plan({ consentExplicit: true, marketingConsent: true }, { existing, latest: {} })), ['marketing:true']);
  // an old form re-sends the same stored value on every save: no change -> no journal row
  assert.deepEqual(kinds(plan({ marketingConsent: true }, { existing, latest: {} })), []);
  // an old form unchecks the box: a real true -> false transition is journaled
  assert.deepEqual(kinds(plan({ marketingConsent: false }, { existing, latest: {} })), ['marketing:false']);
});

test('plan: privacy acceptance is recorded once per document version; a new version needs a new acceptance', () => {
  const latest = { privacy: { granted: true, documentVersion: DOCS.privacyVersion, createdAt: '2026-01-01' } };
  assert.deepEqual(kinds(plan({ consentExplicit: true, acceptedPrivacy: true }, { existing: {}, latest })), []);
  const newer = plan({ consentExplicit: true, acceptedPrivacy: true }, { existing: {}, latest, c: ctx({ docs: { ...DOCS, privacyVersion: 'newversion123' } }) });
  assert.deepEqual(kinds(newer), ['privacy:true']);
  assert.equal(newer.entries[0].documentVersion, 'newversion123');
});

test('plan: the legacy signature path (card signatureEdit) goes through the same plan and is journaled on a real transition', () => {
  const answers = C.readConsentAnswers({ cardVariant: 'a5' });
  answers.terms = true; // what prepareStaffConsent does with legacyTerms
  const p = C.planConsentWrite({ answers, existing: { hasSignedRegulations: false }, latest: {}, ctx: ctx({ surface: 'customer-card' }), now: NOW });
  assert.deepEqual(kinds(p), ['terms:true']);
  assert.deepEqual(p.changes.hasSignedRegulations, { from: false, to: true });
});

test('surface: only the closed list is stored', () => {
  assert.equal(C.normalizeSurface('new-order'), 'new-order');
  assert.equal(C.normalizeSurface('<script>'), 'unknown');
  assert.equal(C.normalizeSurface(undefined, 'customer-card'), 'customer-card');
});

// ---------- the staff entry point (prepareStaffConsent) ----------
test('prepareStaffConsent: feature off + legacy body -> no entries (pre-change behaviour); on + explicit -> validated + journaled', async () => {
  const prisma = { customerConsent: { findMany: async () => [] } };
  const off = await C.prepareStaffConsent({ prisma, body: { marketingConsent: true }, settings: new Map(), existing: null, docs: DOCS, employeeId: 'e' });
  assert.deepEqual(off.errors, []);
  assert.deepEqual(off.plan.entries, []);
  assert.equal(off.plan.data.marketingConsent, true, 'the column still follows the body, as before');
  const bad = await C.prepareStaffConsent({ prisma, body: { consentExplicit: true }, settings: new Map(Object.entries(ON)), existing: null, docs: DOCS, employeeId: 'e' });
  assert.equal(bad.errors.length, 3);
  assert.equal(bad.status, 400);
  const stale = await C.prepareStaffConsent({ prisma, body: { consentExplicit: true, acceptedTerms: true, marketingConsent: true, acceptedPrivacy: true, termsVersion: 'old' }, settings: new Map(Object.entries(ON)), existing: null, docs: DOCS, employeeId: 'e' });
  assert.equal(stale.status, 409);
  const ok = await C.prepareStaffConsent({ prisma, body: { consentExplicit: true, acceptedTerms: true, marketingConsent: false, acceptedPrivacy: true, consentSurface: 'new-customer' }, settings: new Map(Object.entries(ON)), existing: null, docs: DOCS, employeeId: 'emp-9' });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.plan.entries.map((e) => [e.kind, e.surface, e.recordedByEmployeeId]), [['terms', 'new-customer', 'emp-9'], ['marketing', 'new-customer', 'emp-9'], ['privacy', 'new-customer', 'emp-9']]);
});

// ---------- the kiosk entry point ----------
test('kiosk registration plan: channel kiosk / customer_self, no employee, everything explicit and required', () => {
  const settings = new Map(Object.entries(ON));
  const missing = C.processRegistrationConsents({ body: { acceptedTerms: true }, settings, docs: DOCS, now: NOW });
  assert.ok(missing.errors.length >= 2 && missing.plan === null);
  const ok = C.processRegistrationConsents({ body: { acceptedTerms: true, marketingConsent: false, acceptedPrivacy: true, termsVersion: DOCS.termsVersion, privacyVersion: DOCS.privacyVersion }, settings, docs: DOCS, now: NOW, meta: { station: 'k1' } });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(kinds(ok.plan), ['terms:true', 'marketing:false', 'privacy:true']);
  for (const e of ok.plan.entries) { assert.equal(e.channel, 'kiosk'); assert.equal(e.method, 'customer_self'); assert.equal(e.recordedByEmployeeId, null); assert.equal(e.surface, 'kiosk-register'); assert.equal(e.meta, '{"station":"k1"}'); }
  const stale = C.processRegistrationConsents({ body: { acceptedTerms: true, marketingConsent: true, acceptedPrivacy: true, privacyVersion: 'old' }, settings, docs: DOCS, now: NOW });
  assert.equal(stale.errors.length, 1);
});

// ---------- journal wrapper ----------
test('journal wrapper never throws: ok / client-missing / table-missing / error', async () => {
  const entries = [{ kind: 'terms', granted: true, channel: 'staff', method: 'staff_recorded' }];
  const rows = [];
  assert.deepEqual(await C.recordConsentEntries({ customerConsent: { createMany: async ({ data }) => { rows.push(...data); } } }, 'c1', entries), { ok: true, count: 1 });
  assert.equal(rows[0].customerId, 'c1');
  assert.deepEqual(await C.recordConsentEntries({ customerConsent: { createMany: async () => { throw new Error('x'); } } }, 'c1', []), { ok: true, count: 0 }, 'nothing to write = ok, no call');
  assert.equal((await C.recordConsentEntries({}, 'c1', entries)).reason, 'client-missing');
  const e = new Error('no table'); e.code = 'P2021';
  assert.equal((await C.recordConsentEntries({ customerConsent: { createMany: async () => { throw e; } } }, 'c1', entries)).reason, 'table-missing');
  assert.equal((await C.recordConsentEntries({ customerConsent: { createMany: async () => { throw new Error('boom'); } } }, 'c1', entries)).reason, 'error');
});

test('latestByKind / summarizeConsents: newest row per kind, no employee ids leak', () => {
  const rows = [
    { kind: 'marketing', granted: true, createdAt: '2026-01-01', channel: 'staff', method: 'staff_recorded', recordedByEmployeeId: 'secret' },
    { kind: 'marketing', granted: false, createdAt: '2026-02-01', channel: 'kiosk', method: 'customer_self' },
    { kind: 'other', granted: true, createdAt: '2026-03-01' },
  ];
  const latest = C.latestByKind(rows);
  assert.equal(latest.marketing.granted, false);
  const sum = C.summarizeConsents(latest);
  assert.deepEqual(Object.keys(sum), ['marketing']);
  assert.ok(!JSON.stringify(sum).includes('secret'));
});

// ---------- client helpers ----------
test('consentForm: requirements, missing labels, request body (only changed keys for edits)', () => {
  assert.deepEqual(F.missingConsentLabels(F.EMPTY_CONSENT_ANSWERS, ON, { isNew: true }), ['חתימה על התקנון (כן / לא)', 'אישור קבלת דיוורים (כן / לא)', 'אישור מדיניות הפרטיות']);
  assert.deepEqual(F.missingConsentLabels(F.EMPTY_CONSENT_ANSWERS, ON, { isNew: false }), []);
  assert.deepEqual(F.missingConsentLabels({ acceptedTerms: false, marketingConsent: false, acceptedPrivacy: true }, ON, { isNew: true }), []);
  assert.deepEqual(F.missingConsentLabels({ acceptedTerms: true, marketingConsent: false, acceptedPrivacy: true }, { ...ON, require_marketing_consent: 'true' }, { isNew: true }), ['אישור קבלת דיוורים'], 'require_marketing_consent still demands a YES');
  assert.equal(F.consentRequirements({ hide_marketing_consent_field: 'true' }, { isNew: true }).showMarketing, false);
  const info = { terms: { version: 'T' }, privacy: { version: 'P' } };
  const body = F.withConsentBody({ firstName: 'a', marketingConsent: true, acceptedTerms: true }, { acceptedTerms: false, marketingConsent: null, acceptedPrivacy: true }, info, 'new-order');
  assert.deepEqual(body, { firstName: 'a', consentExplicit: true, consentSurface: 'new-order', acceptedTerms: false, acceptedPrivacy: true, termsVersion: 'T', privacyVersion: 'P' });
  const edit = F.withConsentBody({ marketingConsent: true }, { acceptedTerms: true, marketingConsent: false, acceptedPrivacy: true }, info, 'customer-card', { only: ['marketingConsent'] });
  assert.equal(edit.marketingConsent, false);
  assert.ok(!('acceptedTerms' in edit) && !('acceptedPrivacy' in edit));
  const untouched = F.withConsentBody({ marketingConsent: true }, { acceptedTerms: true, marketingConsent: true, acceptedPrivacy: false }, null, 'customer-card', { only: ['acceptedTerms'] });
  assert.ok(!('marketingConsent' in untouched), 'an unchanged marketing flag is not re-sent (the server would treat it as an explicit answer)');
});

test('consentForm.answersFromCustomer: true is "yes"; false/absent is "unanswered" unless the journal / timestamp says it was refused', () => {
  assert.deepEqual(F.answersFromCustomer({ hasSignedRegulations: true, marketingConsent: true }, {}), { acceptedTerms: true, marketingConsent: true, acceptedPrivacy: false });
  assert.deepEqual(F.answersFromCustomer({ hasSignedRegulations: false, marketingConsent: false }, {}), { acceptedTerms: null, marketingConsent: null, acceptedPrivacy: false });
  assert.deepEqual(F.answersFromCustomer({ hasSignedRegulations: false, regulationsSignedAt: '2026-01-01', marketingConsent: false }, { marketing: { granted: false }, privacy: { granted: true } }), { acceptedTerms: false, marketingConsent: false, acceptedPrivacy: true });
});

// ---------- documents ----------
test('terms file: only PDF / PNG / JPEG by CONTENT; html, svg, office files and tiny buffers are refused', () => {
  const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n');
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(12)]);
  assert.equal(D.sniffTermsType(pdf), 'application/pdf');
  assert.equal(D.sniffTermsType(png), 'image/png');
  assert.equal(D.sniffTermsType(jpg), 'image/jpeg');
  assert.equal(D.sniffTermsType(Buffer.from('<html><script>alert(1)</script></html>')), null);
  assert.equal(D.sniffTermsType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(D.sniffTermsType(Buffer.from('PK\u0003\u0004 docx zip bytes ....')), null);
  assert.equal(D.sniffTermsType(Buffer.from('%PDF')), null, 'too short');
  assert.equal(D.sniffTermsType(null), null);
  assert.ok(!/[/:*?"<>|]/.test(D.safeTermsFileName('../../etc/passwd.pdf', 'application/pdf')) && !D.safeTermsFileName('a\\b.pdf', 'application/pdf').includes('\\'), 'no path characters survive');
  assert.ok(D.safeTermsFileName('a'.repeat(300), 'application/pdf').length <= 84);
  assert.equal(D.safeTermsFileName('', 'image/png'), 'תקנון.png');
  assert.equal(D.hashBytes(pdf).length, 64);
});

test('terms file: the configured version needs id + sha + an allowed type; history parsing is defensive', () => {
  assert.equal(D.currentTermsFile(new Map()), null);
  assert.equal(D.currentTermsFile(new Map([['terms_file_id', 'x'], ['terms_file_sha256', 'h'], ['terms_file_type', 'text/html']])), null, 'a non-allowed stored type is never served');
  const cur = D.currentTermsFile(new Map([['terms_file_id', 'x'], ['terms_file_sha256', 'h'], ['terms_file_type', 'application/pdf'], ['terms_file_name', 'n.pdf']]));
  assert.deepEqual([cur.id, cur.sha256, cur.type, cur.name], ['x', 'h', 'application/pdf', 'n.pdf']);
  assert.deepEqual(D.parseTermsHistory('not json'), []);
  assert.deepEqual(D.parseTermsHistory('[{"id":"a","sha256":"b"},{"x":1}]').map((h) => h.id), ['a']);
  const docs = D.resolveConsentDocs(new Map([['terms_file_id', 'x'], ['terms_file_sha256', 'h'], ['terms_file_type', 'image/png']]), []);
  assert.equal(docs.hasTermsFile, true);
  assert.equal(docs.termsVersion, 'h');
  assert.equal(D.resolveConsentDocs(new Map(), []).hasTermsFile, false);
});

test('privacy policy: default text covers the legal topics, the contact comes from each gemach settings, the version follows the visible text', () => {
  const t = P.DEFAULT_PRIVACY_POLICY_TEXT;
  for (const needle of ['זכות עיון', 'זכות תיקון', 'זכות מחיקה', 'ביטול הסכמה לדיוור', 'דיוור שיווקי והסרה', 'אבטחת מידע', 'כמה זמן המידע נשמר', 'למי המידע מועבר', 'איזה מידע אנחנו אוספים', 'יצירת קשר']) assert.ok(t.includes(needle), needle);
  const main = D.resolvePrivacyPolicy(new Map([['gmach_name', 'גמ"ח א'], ['main_email', 'a@example.com'], ['gmach_phone', '02-1234567'], ['gmach_address', 'רחוב 1']]), []);
  const neve = D.resolvePrivacyPolicy(new Map([['gmach_name', 'נווה יעקב'], ['main_email', 'b@example.com'], ['gmach_phone', ''], ['gmach_address', '']]), []);
  assert.ok(main.text.includes('גמ"ח א') && main.text.includes('a@example.com') && main.text.includes('02-1234567') && main.text.includes('רחוב 1'));
  assert.ok(neve.text.includes('נווה יעקב') && neve.text.includes('b@example.com'));
  assert.ok(!neve.text.includes('טלפון:') && !neve.text.includes('כתובת:'), 'blank settings are not printed');
  assert.ok(!main.text.includes('{{') && !neve.text.includes('{{'));
  assert.notEqual(main.version, neve.version, 'different visible text = different version');
  const custom = D.resolvePrivacyPolicy(new Map([['privacy_policy_text', '## כותרת\nשלום {{שם}}\n- א\n- ב'], ['gmach_name', 'X']]), [{ key: 'privacy_policy_text', updatedAt: '2026-11-05T10:00:00Z' }]);
  assert.equal(custom.custom, true);
  assert.equal(custom.updatedAt, '2026-11-05');
  assert.deepEqual(custom.blocks, [{ type: 'h', text: 'כותרת' }, { type: 'p', text: 'שלום X' }, { type: 'ul', items: ['א', 'ב'] }]);
  assert.equal(D.resolvePrivacyPolicy(new Map(), []).custom, false);
  assert.equal(P.effectivePrivacyTemplate('   '), P.DEFAULT_PRIVACY_POLICY_TEXT);
  assert.deepEqual(P.parsePolicyBlocks('<b>hi</b>'), [{ type: 'p', text: '<b>hi</b>' }], 'rendered as text by React, never parsed as HTML');
});

test('public rate limit: window per key, resets after the window, keys are independent', () => {
  R.resetPublicRateLimit();
  for (let i = 0; i < 3; i++) assert.equal(R.admitPublic('ip1', { max: 3, windowMs: 1000, now: 1000 }).ok, true);
  const blocked = R.admitPublic('ip1', { max: 3, windowMs: 1000, now: 1500 });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSec >= 1);
  assert.equal(R.admitPublic('ip2', { max: 3, windowMs: 1000, now: 1500 }).ok, true);
  assert.equal(R.admitPublic('ip1', { max: 3, windowMs: 1000, now: 2100 }).ok, true);
  assert.equal(R.clientIpFromHeaders(new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })), '1.2.3.4');
});

// ---------- Enter navigation against a fake DOM ----------
class El {
  constructor(tag, attrs = {}, children = []) {
    this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = attrs; this.children = children; this.parentElement = null;
    this.type = attrs.type || (this.tagName === 'INPUT' ? 'text' : undefined); this.name = attrs.name; this.disabled = !!attrs.disabled; this.readOnly = !!attrs.readOnly;
    this.checked = !!attrs.checked; this.hidden = false; this.tabIndex = attrs.tabIndex === undefined ? 0 : attrs.tabIndex;
    this.invisible = !!attrs.invisible;
    for (const c of children) c.parentElement = this;
    this.ownerDocument = { defaultView: { getComputedStyle: () => ({ visibility: 'visible', display: 'block' }) } };
  }
  hasAttribute(a) { return a in this.attrs || (a === 'hidden' && this.hidden); }
  getAttribute(a) { return a in this.attrs ? String(this.attrs[a]) : null; }
  getClientRects() { return this.invisible ? [] : [{}]; }
  contains(el) { let n = el; while (n) { if (n === this) return true; n = n.parentElement; } return false; }
  closest(sel) { const m = /\[role="(\w+)"\]/.exec(sel); let n = this; while (n) { if (m && n.attrs.role === m[1]) return n; n = n.parentElement; } return null; }
  matches(sel) {
    return sel.split(',').map((s) => s.trim()).some((s) => {
      if (s === 'input' || s === 'select' || s === 'textarea') return this.tagName === s.toUpperCase();
      const r = /^\[(\w[\w-]*)(?:="([^"]*)")?\]$/.exec(s);
      return r ? (r[2] === undefined ? r[1] in this.attrs : this.attrs[r[1]] === r[2]) : false;
    });
  }
  walk(out) { for (const c of this.children) { out.push(c); c.walk(out); } return out; }
  querySelectorAll(sel) { return this.walk([]).filter((e) => e.matches(sel)); }
  focus() { El.focused = this; }
  select() { El.selected = this; }
}
const input = (id, attrs = {}) => new El('input', { id, ...attrs });
const radio = (id, group, checked = false) => new El('button', { id, role: 'radio', 'aria-checked': checked }, []);
const press = (container, target, over = {}) => {
  const ev = { key: 'Enter', target, currentTarget: container, defaultPrevented: false, isComposing: false, keyCode: 13, preventDefault() { this.defaultPrevented = true; }, ...over };
  let submitted = 0;
  const handled = N.handleEnterKey(ev, { container, onSubmit: over.noSubmit ? undefined : () => { submitted++; } });
  return { handled, submitted, prevented: ev.defaultPrevented, focused: El.focused && El.focused.attrs.id };
};

test('enter navigation: text -> next field -> through the checkbox AND the Yes/No groups -> save on the last field', () => {
  const first = input('first'); const last = input('last'); const mkt = input('mkt', { type: 'checkbox' });
  const yes1 = radio('t-yes'); const no1 = radio('t-no'); const grp1 = new El('div', { role: 'radiogroup' }, [yes1, no1]);
  const yes2 = radio('m-yes'); const no2 = radio('m-no'); const grp2 = new El('div', { role: 'radiogroup' }, [yes2, no2]);
  const priv = input('priv', { type: 'checkbox' });
  const form = new El('form', {}, [first, last, mkt, grp1, grp2, priv]);
  let r = press(form, first); assert.deepEqual([r.handled, r.focused], [true, 'last']);
  r = press(form, last); assert.equal(r.focused, 'mkt', 'a checkbox is a stop - the flow does not skip it or stop at it');
  r = press(form, mkt); assert.equal(r.focused, 't-yes', 'Enter on the switch only advances (to the first option of the next group)');
  r = press(form, yes1); assert.equal(r.focused, 'm-yes', 'a Yes/No group is ONE stop');
  r = press(form, no2); assert.equal(r.focused, 'priv', 'any member of the group advances to the next stop');
  r = press(form, priv); assert.deepEqual([r.handled, r.submitted, r.prevented], [true, 1, true], 'the last stop submits');
  r = press(form, priv, { noSubmit: true }); assert.equal(r.handled, true, 'a checkbox at the end never toggles/submits by accident');
  r = press(form, last, { shiftKey: true }); assert.equal(r.focused, 'first', 'Shift+Enter goes back');
});

test('enter navigation: the checked radio represents its group; disabled / hidden / readOnly / skipped fields are not stops', () => {
  const a = input('a'); const dis = input('dis', { disabled: true }); const hid = input('hid', { invisible: true }); const ro = input('ro', { readOnly: true }); const sk = input('sk', { 'data-enter-skip': '1' });
  const yes = radio('yes'); const no = radio('no', null, true); no.attrs['aria-checked'] = 'true';
  const grp = new El('div', { role: 'radiogroup' }, [yes, no]);
  const z = input('z');
  const form = new El('form', {}, [a, dis, hid, ro, sk, grp, z]);
  let r = press(form, a); assert.equal(r.focused, 'no', 'the checked radio is the group stop, skipped fields in between are ignored');
  r = press(form, yes); assert.equal(r.focused, 'z');
});

test('enter navigation: buttons, links, textarea, IME and already-handled events are left alone', () => {
  const a = input('a'); const btn = new El('button', { id: 'b' }); const ta = new El('textarea', { id: 'ta' }); const z = input('z');
  const form = new El('form', {}, [a, btn, ta, z]);
  assert.equal(press(form, btn).handled, false);
  assert.equal(press(form, ta).handled, false, 'plain Enter in a textarea is a newline');
  assert.equal(press(form, ta, { ctrlKey: true }).handled, true, 'Ctrl+Enter in a textarea advances');
  assert.equal(press(form, a, { isComposing: true }).handled, false);
  assert.equal(press(form, a, { defaultPrevented: true }).handled, false, 'a suggestion pick that already prevented the event does not also advance');
  assert.equal(press(form, a, { key: 'Tab' }).handled, false);
  assert.equal(press(form, input('outside')).handled, false, 'targets outside the container are ignored');
});

test('enter navigation: a closed details block (hidden fields) is skipped, and the last visible field submits', () => {
  const a = input('a'); const hiddenCity = input('city', { invisible: true });
  const form = new El('form', {}, [a, hiddenCity]);
  const r = press(form, a);
  assert.deepEqual([r.handled, r.submitted], [true, 1]);
});
