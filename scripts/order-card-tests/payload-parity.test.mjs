// זוגיות גוף ה-PUT (ו-preview-pricing / validate-inventory) בין הכרטיס החדש לישן (PLAN §D.3.3, §E.1).
// האורקל = הליטרלים מתוך LegacyOrderPage.js עצמו (legacy.mjs). הציפייה: גוף החדש = גוף הישן + "extraDay" (G13) + "cardVariant":"a5"
// (חוזה W0 §1.4) בסוף, בייט-בייט.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { payloadStates, baseState } from './fixtures.mjs';
import { legacySaveBody, legacyExitBody, legacyPreviewLiveBody, legacyPreviewSummaryBody, legacyValidateBody } from './legacy.mjs';

const L = await import(pathToFileURL(process.env.PROJ + '/app/components/order-card/orderCardLogic.js').href);

const withoutExtraDay = (o) => { const c = { ...o }; delete c.extraDay; delete c.cardVariant; return c; };
const expectSerialized = (newer, legacy, extraDay) => {
  const a = JSON.stringify(newer);
  const b = JSON.stringify(legacy);
  const suffix = `,"extraDay":${JSON.stringify(extraDay)},"cardVariant":"a5"}`;
  assert.ok(a.endsWith(suffix), `new body must end with ${suffix}`);
  assert.equal(a.slice(0, -suffix.length) + '}', b, 'new body (without extraDay) must equal legacy body byte for byte');
};

const states = payloadStates();
test('19 מצבים בדיוק', () => assert.equal(states.length, 19));

for (const { name, st, opts } of states) {
  test(`PUT שמירה = handleSave + extraDay + cardVariant · ${name}`, () => {
    const legacy = legacySaveBody(st.order, st, opts);
    const neu = L.buildPutPayload(st.order, { items: st.items, obligations: st.obligations, payments: st.payments, mode: 'save', debtApprovedBy: opts.debtApprovedBy || null, managerAuth: opts.managerAuth || null, orderDateApproval: opts.orderDateApproval || null });
    assert.deepEqual(withoutExtraDay(neu), legacy);
    const xd = st.order.extraDay !== undefined ? st.order.extraDay : null;
    assert.equal(neu.extraDay, xd);
    assert.equal(neu.cardVariant, 'a5');
    expectSerialized(neu, legacy, xd);
  });
  test(`PUT יציאה = handleExit + extraDay + cardVariant · ${name}`, () => {
    const legacy = legacyExitBody(st.order, st, { debtApprovedBy: opts.debtApprovedBy || null });
    const neu = L.buildPutPayload(st.order, { items: st.items, obligations: st.obligations, payments: st.payments, mode: 'exit', debtApprovedBy: opts.debtApprovedBy || null });
    const xd = st.order.extraDay !== undefined ? st.order.extraDay : null;
    expectSerialized(neu, legacy, xd);
  });
  test(`preview-pricing = שני גופי הישן + order.extraDay · ${name}`, () => {
    const neu = L.buildPreviewBody(st.items, st.order);
    const xd = st.order.extraDay !== undefined ? st.order.extraDay : null;
    assert.equal(neu.order.extraDay, xd);
    const stripped = { ...neu, order: { ...neu.order } }; delete stripped.order.extraDay;
    // הפרש מכוון יחיד מהישן: שורה מקומית חצי-ריקה (בלי id ובלי dressItem.dress - השרת מתעלם ממנה בכל מקרה) לא נשלחת
    const sent = st.items.filter(i => !L.isHalfFilledLocalItem(i));
    assert.equal(JSON.stringify(stripped), JSON.stringify(legacyPreviewLiveBody(sent, st.order)));
    assert.equal(JSON.stringify(stripped), JSON.stringify(legacyPreviewSummaryBody(sent, st.order)));
    assert.equal(neu.items.length, sent.length);
  });
  test(`validate-inventory = הישן · ${name}`, () => {
    const active = st.items.filter(i => !i.isDeleted);
    assert.equal(JSON.stringify(L.buildValidateInventoryBody(st.order, active)), JSON.stringify(legacyValidateBody(active, st.order)));
  });
}

test('totalAmount: אותו חישוב כמו ה-IIFE של הישן', () => {
  const st = baseState();
  assert.equal(L.computeItemsTotalAmount(st.items, st.obligations, st.order), 300);
});
