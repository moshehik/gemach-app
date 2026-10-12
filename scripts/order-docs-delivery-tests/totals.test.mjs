// Totals parity: the email / emailed PDF / print page total (sum of non-deleted obligations) equals the order card total (requiredOf),
// with and without the delivery section, for delivery-both / out-only / back-only / no-delivery orders; and delivery rows add up to the delivery charge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const D = await import(pathToFileURL(process.env.PROJ + '/lib/orderDelivery.js').href);
const C = await import(pathToFileURL(process.env.PROJ + '/app/components/order-card/orderCardLogic.js').href);

const ON = [{ key: 'enable_deliveries', value: 'true' }];
const ITEMROW = [...ON, { key: 'delivery_as_item_row', value: 'true' }];
const item = { id: 'i1', description: 'שמלה', isDeleted: false };
const dressObl = { amount: 300, description: 'שמלה', isDeleted: false, orderItemId: 'i1' };
const del = (amount, description) => ({ amount, description, isDeleted: false, isRefund: false });
const mk = (direction, obligations) => ({ isDelivery: !!direction, deliveryDirection: direction, deliveryCity: 'ירושלים', deliveryAddress: 'הרצל 5', eventDate: new Date('2026-11-18T00:00:00Z'), customer: {}, obligations });

const CASES = {
  both: mk('הלוך-חזור', [dressObl, del(120, 'משלוח הלוך-חזור - ירושלים')]),
  bothLegs: mk('הלוך-חזור', [dressObl, del(60, 'משלוח הלוך'), del(70, 'משלוח חזור')]),
  outOnly: mk('הלוך', [dressObl, del(60, 'משלוח הלוך - ירושלים')]),
  backOnly: mk('חזור', [dressObl, del(60, 'משלוח חזור - ירושלים')]),
  none: { ...mk(null, [dressObl]), isDelivery: false },
};

for (const [name, order] of Object.entries(CASES)) {
  test(`totals parity: ${name}`, () => {
    const emailTotal = order.obligations.filter((o) => !o.isDeleted).reduce((s, o) => s + o.amount, 0); // as in the email routes / print page
    const cardTotal = C.requiredOf(order.obligations, [item]);
    assert.equal(emailTotal, cardTotal);
    for (const settings of [ON, ITEMROW, []]) {
      const before = JSON.stringify(order);
      const s = D.buildDeliverySection(order, { settings });
      assert.equal(JSON.stringify(order), before); // display only
      assert.equal(order.obligations.filter((o) => !o.isDeleted).reduce((x, o) => x + o.amount, 0), emailTotal); // same total with / without the section
      if (s && s.summaryRows.length) {
        const legsSum = Math.round(s.summaryRows.reduce((x, r) => x + r.amount, 0) * 100) / 100;
        assert.equal(legsSum, s.amount);
        assert.equal(Math.round((emailTotal - 300) * 100) / 100, legsSum); // dresses 300 + delivery legs = total
      }
      if (s && s.itemRows.length) assert.equal(Math.round(s.itemRows.reduce((x, r) => x + (r.amount || 0), 0) * 100) / 100, s.amount);
    }
  });
}
