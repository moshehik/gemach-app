// W7 (מסמכים): פעולות המסמכים (parts/ocDocsActions.js) מול תלויות מוזרקות - fetch / pdf / oc מדומים. מוודא שהזרימות זהות לישן
// (HTML→PDF→base64, אישור מנהל רק אחרי 403 approval_required עם אותו PDF, שמירת מייל בכרטיס הלקוח) ושהרישום להיסטוריה נעשה במקום הנכון.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJ = process.env.PROJ;
const L = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const A = await L('app/components/order-card/parts/ocDocsActions.js');

const ORDER = { orderId: 53375, hasSignedRegulations: true, isDelivery: true, deliveryDirection: 'הלוך', customer: { id: 'c1', firstName: 'מרים', lastName: 'א', email: 'miriam@example.com' }, eventDate: '2026-10-07T21:00:00.000Z' };
const j = (o, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => o });

// fetch מדומה: מתעד כל קריאה; handlers לפי כתובת
function makeFetch(handlers = {}) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ url, method: opts.method || 'GET', body });
    if (body && body.returnHtmlOnly) return handlers.html ? handlers.html(body) : j({ success: true, html: `<html>${body.type}</html>` });
    if (handlers[url]) return handlers[url](body, calls.length);
    return j({ success: true });
  };
  fn.calls = calls;
  return fn;
}
function makePdf() {
  const pdf = { calls: [], downloads: [] };
  pdf.fetchPdfBase64 = async (p) => { pdf.calls.push(p); return p.path ? `PATH:${p.path}` : `B64:${(p.html || '').slice(0, 20)}`; };
  pdf.downloadPdf = async (p, name) => { pdf.downloads.push({ p, name }); };
  return pdf;
}
function makeOc(over = {}) {
  const oc = {
    order: ORDER, snapshot: { order: ORDER, items: [], obligations: [], payments: [] }, items: [], obligations: [], payments: [], dirty: false,
    approvals: [], events: [], bumped: 0, patches: [],
    bumpHistory() { oc.bumped++; },
    approve: async (kind, reason) => { oc.approvals.push({ kind, reason }); return over.approval === undefined ? { employeeId: 'e1', employeeName: 'שרה', pin: '1234' } : over.approval; },
    logEvent: async (action, meta) => { oc.events.push({ action, meta }); return { ok: true, status: 200 }; },
    patchOrder: (p) => { oc.patches.push(p); },
    ...over.oc,
  };
  return oc;
}
const EMAIL_URL = '/api/orders/53375/email';
const posts = (f) => f.calls.filter((c) => c.url === EMAIL_URL && !c.body.returnHtmlOnly);

// ---------- שליחת מייל: מצב doc ----------
test('doc: HTML→PDF→POST עם pdfBase64 (כמו הישן); בלי אישור כשהשרת מאשר; bumpHistory אחרי שליחה', async () => {
  const f = makeFetch(); const pdf = makePdf(); const oc = makeOc();
  const r = await A.sendOrderMail({ oc, orderId: 53375, mode: 'doc', to: 'a@b.co', type: 'rental', fetchImpl: f, pdf, readFile: async () => '' });
  assert.deepEqual({ ok: r.ok, fileCount: r.fileCount }, { ok: true, fileCount: 1 });
  assert.equal(f.calls[0].body.returnHtmlOnly, true);
  assert.equal(f.calls[0].body.type, 'rental');
  assert.equal(pdf.calls.length, 1);
  assert.equal(pdf.calls[0].html, '<html>rental</html>');
  const sent = posts(f);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.pdfBase64, 'B64:<html>rental</html>');
  assert.equal(sent[0].body.email, 'a@b.co');
  assert.equal(sent[0].body.type, 'rental');
  assert.ok(!('quick' in sent[0].body));
  assert.ok(!('emailApproverId' in sent[0].body));
  assert.equal(oc.approvals.length, 0);
  assert.equal(oc.bumped, 1);
});

test('doc: 403 approval_required → oc.approve(feature:customer_email_approval) → שליחה חוזרת עם אותו PDF (לא נוצר שוב) ופרטי המאשר', async () => {
  let n = 0;
  const f = makeFetch({ [EMAIL_URL]: () => (++n === 1 ? j({ success: false, code: 'approval_required', error: 'דרוש אישור' }, 403) : j({ success: true, driveLinks: [] })) });
  const pdf = makePdf(); const oc = makeOc();
  const r = await A.sendOrderMail({ oc, orderId: 53375, mode: 'doc', to: 'a@b.co', fetchImpl: f, pdf, readFile: async () => '' });
  assert.equal(r.ok, true);
  assert.deepEqual(oc.approvals, [{ kind: 'feature:customer_email_approval', reason: 'שליחת מייל ללקוח · הזמנה #53375' }]);
  assert.equal(pdf.calls.length, 1, 'ה-PDF לא נוצר מחדש');
  const sent = posts(f);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].body.emailApproverId, 'e1');
  assert.equal(sent[1].body.emailApproverPin, '1234');
  assert.equal(sent[1].body.pdfBase64, sent[0].body.pdfBase64);
});

test('doc: ביטול חלון האישור = לא נשלח כלום נוסף ולא נרשם; כישלון שרת = הודעה + נרשם בהיסטוריה (EMAIL_FAILED בשרת)', async () => {
  const f1 = makeFetch({ [EMAIL_URL]: () => j({ success: false, code: 'approval_required' }, 403) });
  const oc1 = makeOc({ approval: null });
  const r1 = await A.sendOrderMail({ oc: oc1, orderId: 53375, mode: 'doc', to: 'a@b.co', fetchImpl: f1, pdf: makePdf(), readFile: async () => '' });
  assert.deepEqual(r1, { ok: false, cancelled: true });
  assert.equal(posts(f1).length, 1);
  assert.equal(oc1.bumped, 0);

  const f2 = makeFetch({ [EMAIL_URL]: () => j({ error: 'השליחה נכשלה: חסימה' }, 500) });
  const oc2 = makeOc();
  const r2 = await A.sendOrderMail({ oc: oc2, orderId: 53375, mode: 'doc', to: 'a@b.co', fetchImpl: f2, pdf: makePdf(), readFile: async () => '' });
  assert.deepEqual(r2, { ok: false, error: 'השליחה נכשלה: חסימה' });
  assert.equal(oc2.bumped, 1);
});

test('doc: כתובת לא תקינה = אין קריאות בכלל; כשל ביצירת ה-HTML/PDF = הודעה, ולא נשלח מייל', async () => {
  const f = makeFetch(); const oc = makeOc();
  assert.deepEqual(await A.sendOrderMail({ oc, orderId: 53375, mode: 'doc', to: 'nope', fetchImpl: f, pdf: makePdf() }), { ok: false, error: 'כתובת המייל אינה תקינה' });
  assert.equal(f.calls.length, 0);
  const bad = makeFetch({ html: () => j({ success: false, error: 'שגיאת שרת' }, 500) });
  const r = await A.sendOrderMail({ oc, orderId: 53375, mode: 'doc', to: 'a@b.co', fetchImpl: bad, pdf: makePdf(), readFile: async () => '' });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'שגיאת שרת');
  assert.equal(posts(bad).length, 0);
  const pdfFail = makePdf(); pdfFail.fetchPdfBase64 = async () => { throw new Error('שגיאה ביצירת ה-PDF'); };
  const r2 = await A.sendOrderMail({ oc, orderId: 53375, mode: 'doc', to: 'a@b.co', fetchImpl: makeFetch(), pdf: pdfFail, readFile: async () => '' });
  assert.equal(r2.error, 'שגיאה ביצירת ה-PDF');
});

test('doc: קבצים נוספים (R8) נשלחים עם kind:file וה-dest שנבחר', async () => {
  const f = makeFetch(); const oc = makeOc();
  const file = { name: 'מדידות.pdf', type: 'application/pdf', size: 2048 };
  const r = await A.sendOrderMail({ oc, orderId: 53375, mode: 'doc', to: 'a@b.co', extraFiles: [file], sendMode: 'both', fetchImpl: f, pdf: makePdf(), readFile: async (x) => `BASE64(${x.name})` });
  assert.equal(r.ok, true);
  assert.equal(r.fileCount, 2);
  const body = posts(f)[0].body;
  assert.equal(body.sendMode, 'both');
  assert.deepEqual(body.extraAttachments, [{ fileName: 'מדידות.pdf', fileContent: 'BASE64(מדידות.pdf)', mimeType: 'application/pdf', sizeBytes: 2048, dest: 'both', kind: 'file' }]);
});

// ---------- מייל מהיר (A8) ----------
test('quick: quick:{subject,bodyText}, בלי pdfBase64, צרופה לכל kind שנבחר (הזמנה/השכרה מ-HTML של השרת, תשלומים/קבלה/תמונות מ-HTML מקומי, משלוח מדף הלו״ז PP-12 עם orderId)', async () => {
  const f = makeFetch(); const pdf = makePdf(); const oc = makeOc();
  const docData = {
    order: ORDER, obligations: [{ amount: 100, isDeleted: false }], payments: [{ amount: 40, paymentMethod: 'מזומן', paymentDate: '2026-09-23T07:18:00.000Z', isDeleted: false }],
    items: [{ id: 'a', sizeText: '38', dressItem: { dress: { id: 'm1', name: '4512', imageUrl: '/api/attachment/u1' } } }],
  };
  const loaded = [];
  const images = async (items) => { loaded.push(items.length); return [{ name: '4512', sizes: ['38'], dataUri: 'data:image/jpeg;base64,QQ==' }]; };
  const r = await A.sendOrderMail({ oc, orderId: 53375, mode: 'quick', to: 'a@b.co', subject: 'אישור הזמנה', bodyText: 'שלום', kinds: ['order-pdf', 'payments', 'delivery', 'rental-pdf', 'receipt', 'model-photos'], sendMode: 'drive', docData, fetchImpl: f, pdf, images, readFile: async () => '' });
  assert.deepEqual({ ok: r.ok, fileCount: r.fileCount }, { ok: true, fileCount: 6 });
  const body = posts(f)[0].body;
  assert.deepEqual(body.quick, { subject: 'אישור הזמנה', bodyText: 'שלום' });
  assert.ok(!('pdfBase64' in body));
  assert.deepEqual(body.extraAttachments.map((a) => [a.kind, a.fileName, a.dest]), [
    ['order-pdf', 'הזמנה 53375.pdf', 'drive'], ['payments', 'תשלומים 53375.pdf', 'drive'], ['delivery', 'משלוח 53375.pdf', 'drive'], ['rental-pdf', 'השכרה 53375.pdf', 'drive'],
    ['receipt', 'קבלה 53375.pdf', 'drive'], ['model-photos', 'תמונות דגמים 53375.pdf', 'drive'],
  ]);
  assert.ok(body.extraAttachments.every((a) => a.mimeType === 'application/pdf' && a.sizeBytes > 0));
  assert.equal(pdf.calls.length, 6);
  assert.equal(pdf.calls.find((c) => c.path).path, '/schedule/print/PP-12?orderId=53375&downloadPdf=true');
  assert.ok(pdf.calls.find((c) => c.html && c.html.includes('דף תשלומים')), 'דף התשלומים נבנה מקומית');
  assert.ok(pdf.calls.find((c) => c.html && c.html.includes('אישור קבלת תשלום')), 'הקבלה נבנתה מקומית');
  const photosHtml = pdf.calls.find((c) => c.html && c.html.includes('תמונות הדגמים'));
  assert.ok(photosHtml && photosHtml.html.includes('data:image/jpeg;base64,QQ=='), 'תמונות הדגמים מוטמעות כ-data URI');
  assert.deepEqual(loaded, [1]);
  assert.equal(f.calls.filter((c) => c.body && c.body.returnHtmlOnly).length, 2, 'HTML מהשרת רק להזמנה ולהשכרה');
});

test('model-photos: אין אף תמונה שנטענה = שגיאה בעברית ולא נשלח מייל; loadModelPhotos: imageUrl אז thumbnailUrl, מדלג על שגיאות, תקרת גודל', async () => {
  const f = makeFetch(); const oc = makeOc();
  const r = await A.sendOrderMail({ oc, orderId: 53375, mode: 'quick', to: 'a@b.co', subject: 'נושא', bodyText: 'תוכן', kinds: ['model-photos'], docData: { order: ORDER, items: [] }, fetchImpl: f, pdf: makePdf(), images: async () => [], readFile: async () => '' });
  assert.deepEqual(r, { ok: false, error: 'לא ניתן לטעון את תמונות הדגמים' });
  assert.equal(posts(f).length, 0);

  const { loadModelPhotos } = await L('app/components/order-card/parts/ocDocsImages.js');
  const items = [
    { id: 'a', sizeText: '38', dressItem: { dress: { id: 'm1', name: '4512', imageUrl: '/big1', thumbnailUrl: '/thumb1' } } },
    { id: 'b', sizeText: '36', dressItem: { dress: { id: 'm2', name: '3087', imageUrl: '/big2' } } },
    { id: 'c', sizeText: '40', dressItem: { dress: { id: 'm3', name: '2764', imageUrl: '/big3' } } },
  ];
  const tried = [];
  const toDataUri = async (url) => { tried.push(url); if (url === '/big1') throw new Error('404'); if (url === '/big2') throw new Error('404'); return 'data:image/jpeg;base64,' + 'A'.repeat(100); };
  const photos = await loadModelPhotos(items, { toDataUri });
  assert.deepEqual(photos.map((p) => [p.name, p.sizes]), [['4512', ['38']], ['2764', ['40']]], 'דגם 3087 נזרק כי אין לו תמונה שנטענה');
  assert.deepEqual(tried, ['/big1', '/thumb1', '/big2', '/big3']);
  const capped = await loadModelPhotos(items, { toDataUri: async () => 'data:image/jpeg;base64,' + 'A'.repeat(100), maxTotal: 250 });
  assert.equal(capped.length, 2, 'תקרת גודל כולל: השלישית לא נכנסת');
});

test('quick: בלי צרופות - רק נושא ותוכן; fileCount 0; אישור מנהל כמו במצב doc', async () => {
  let n = 0;
  const f = makeFetch({ [EMAIL_URL]: () => (++n === 1 ? j({ code: 'approval_required' }, 403) : j({ success: true })) });
  const oc = makeOc();
  const r = await A.sendOrderMail({ oc, orderId: 53375, mode: 'quick', to: 'a@b.co', subject: 'נושא', bodyText: 'תוכן', fetchImpl: f, pdf: makePdf(), readFile: async () => '' });
  assert.deepEqual({ ok: r.ok, fileCount: r.fileCount }, { ok: true, fileCount: 0 });
  assert.equal(oc.approvals.length, 1);
  assert.deepEqual(posts(f)[1].body.extraAttachments, []);
  assert.equal(posts(f)[1].body.emailApproverPin, '1234');
});

test('גודל: צרופות מעל תקרת הבקשה (Vercel 4.5MB) נחסמות לפני השליחה בהודעה ברורה; מתחת לתקרה נשלח כרגיל', async () => {
  const f = makeFetch(); const oc = makeOc();
  const big = { name: 'גדול.pdf', type: 'application/pdf', size: 3_300_000 };
  const r = await A.sendOrderMail({ oc, orderId: 53375, mode: 'quick', to: 'a@b.co', subject: 'נושא', bodyText: 'תוכן', extraFiles: [big], fetchImpl: f, pdf: makePdf(), readFile: async () => 'A'.repeat(A.MAX_MAIL_PAYLOAD_CHARS + 1) });
  assert.equal(r.ok, false);
  assert.match(r.error, /גדולים מדי/);
  assert.equal(posts(f).length, 0);
  const ok = await A.sendOrderMail({ oc, orderId: 53375, mode: 'quick', to: 'a@b.co', subject: 'נושא', bodyText: 'תוכן', extraFiles: [big], fetchImpl: makeFetch(), pdf: makePdf(), readFile: async () => 'A'.repeat(1_000_000) });
  assert.equal(ok.ok, true);
});

test('makeDocPdf: סוג לא נתמך = שגיאה; משלוח ללא מספר הזמנה תקין = שגיאה', async () => {
  await assert.rejects(() => A.makeDocPdf({ kind: 'invoice', orderId: 1, pdf: makePdf(), fetchImpl: makeFetch() }), /סוג מסמך לא נתמך/);
  await assert.rejects(() => A.makeDocPdf({ kind: 'delivery', orderId: 'x', pdf: makePdf(), fetchImpl: makeFetch() }), /מספר הזמנה לא תקין/);
});

// ---------- כתובת מייל חסרה ----------
test('saveCustomerEmail: PUT /api/customers/:id עם כל שדות הלקוח + email חדש (כמו הישן) ואז סנכרון הכרטיס; לא תקין = בלי fetch', async () => {
  const f = makeFetch(); const oc = makeOc({ oc: { order: { ...ORDER, customer: { id: 'c1', firstName: 'מרים', lastName: 'א', phone1: '050', email: '' } } } });
  const r = await A.saveCustomerEmail({ oc, email: ' new@example.com ', fetchImpl: f });
  assert.deepEqual(r, { ok: true, email: 'new@example.com' });
  assert.equal(f.calls[0].url, '/api/customers/c1');
  assert.equal(f.calls[0].method, 'PUT');
  assert.deepEqual(f.calls[0].body, { id: 'c1', firstName: 'מרים', lastName: 'א', phone1: '050', email: 'new@example.com' });
  assert.deepEqual(oc.patches, [{ customer: { id: 'c1', firstName: 'מרים', lastName: 'א', phone1: '050', email: 'new@example.com' } }]);

  const f2 = makeFetch();
  const bad = await A.saveCustomerEmail({ oc, email: 'nope', fetchImpl: f2 });
  assert.equal(bad.ok, false);
  assert.equal(f2.calls.length, 0);
  assert.equal(oc.patches.length, 1);

  const f3 = makeFetch({ '/api/customers/c1': () => j({ error: 'x' }, 500) });
  const fail = await A.saveCustomerEmail({ oc, email: 'a@b.co', fetchImpl: f3 });
  assert.equal(fail.ok, false);
  assert.equal(oc.patches.length, 1, 'כישלון = הכרטיס לא מתעדכן');
  const noCust = await A.saveCustomerEmail({ oc: makeOc({ oc: { order: { orderId: 1 } } }), email: 'a@b.co', fetchImpl: makeFetch() });
  assert.deepEqual(noCust, { ok: true, email: 'a@b.co', unsaved: true });
});

// ---------- הורדת PDF / Excel ----------
test('A2: הורדת PDF = HTML של הזמנה → downloadPdf; נרשם ORDER_PDF_DOWNLOADED {doc:order, fileName}; כישלון לא נרשם', async () => {
  const f = makeFetch(); const pdf = makePdf(); const oc = makeOc();
  const r = await A.downloadOrderPdf({ oc, orderId: 53375, fetchImpl: f, pdf });
  assert.deepEqual(r, { ok: true, fileName: 'הזמנה 53375.pdf' });
  assert.equal(f.calls[0].body.type, 'order');
  assert.equal(f.calls[0].body.returnHtmlOnly, true);
  assert.deepEqual(pdf.downloads[0], { p: { html: '<html>order</html>', filename: 'הזמנה 53375' }, name: 'הזמנה 53375.pdf' });
  assert.deepEqual(oc.events, [{ action: 'ORDER_PDF_DOWNLOADED', meta: { doc: 'order', fileName: 'הזמנה 53375.pdf' } }]);

  const oc2 = makeOc();
  const pdf2 = makePdf(); pdf2.downloadPdf = async () => { throw new Error('נכשל'); };
  await assert.rejects(() => A.downloadOrderPdf({ oc: oc2, orderId: 53375, fetchImpl: makeFetch(), pdf: pdf2 }), /נכשל/);
  assert.equal(oc2.events.length, 0);
});

test('A1: ייצוא Excel מנתוני השרת האחרונים (snapshot) → download; נרשם ORDER_XLSX_EXPORTED; בלי שורות = לא נרשם', async () => {
  const snapOrder = { ...ORDER, notes: 'נשמר' };
  const oc = makeOc({ oc: { order: { ...ORDER, notes: 'לא נשמר' }, snapshot: { order: snapOrder, items: [{ id: 'i', description: 'שמלה', sizeText: '38', price: 100 }], obligations: [{ amount: 100, description: 'x' }], payments: [] } } });
  const saved = [];
  const r = await A.exportOrderXlsx({ oc, orderId: 53375, download: async (sheets, name) => { saved.push({ sheets, name }); return true; } });
  assert.deepEqual(r, { ok: true, fileName: 'הזמנה 53375.xlsx' });
  assert.equal(saved[0].name, 'הזמנה 53375');
  const note = saved[0].sheets[0].rows.find((x) => x['שדה'] === 'הערות');
  assert.equal(note['ערך'], 'נשמר', 'מצב השרת, לא מה שבעריכה');
  assert.deepEqual(oc.events, [{ action: 'ORDER_XLSX_EXPORTED', meta: { fileName: 'הזמנה 53375.xlsx' } }]);
  const oc2 = makeOc();
  assert.deepEqual(await A.exportOrderXlsx({ oc: oc2, orderId: 53375, download: async () => false }), { ok: false });
  assert.equal(oc2.events.length, 0);
});

test('הפעולות שנרשמות בכרטיס עומדות בחוזה W0 (parseEventsRequest) - ORDER_PDF_DOWNLOADED ו-ORDER_XLSX_EXPORTED', async () => {
  const { parseEventsRequest } = await L('lib/history/orderEvents.js');
  for (const [action, meta] of [['ORDER_PDF_DOWNLOADED', { doc: 'order', fileName: 'הזמנה 53375.pdf' }], ['ORDER_XLSX_EXPORTED', { fileName: 'הזמנה 53375.xlsx' }]]) {
    const p = parseEventsRequest({ orderIds: [53375], action, meta, clientEventId: 'abcdef123456' });
    assert.equal(p.ok, true, JSON.stringify(p));
    assert.equal(p.meta.fileName, meta.fileName);
  }
});
