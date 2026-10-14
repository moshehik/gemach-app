// בדיקה ל-lib/orderNotes.js - איחוד הערות ההזמנה להדפסה (Order.notes + Order.orderNotes מהייבוא מאקסס).
//   node scripts/test_order_notes.mjs
import assert from 'node:assert/strict';
import { combinedOrderNotes, legacyOrderNotesText } from '../lib/orderNotes.js';

let pass = 0; let fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ok   - ' + name); } catch (e) { fail++; console.log('  FAIL - ' + name + '\n         ' + e.message); } };

t('אין הערות בכלל -> ריק', () => {
  assert.equal(combinedOrderNotes({}), '');
  assert.equal(combinedOrderNotes({ notes: '  ', orderNotes: null }), '');
  assert.equal(combinedOrderNotes(null), '');
});
t('רק notes -> כמו שהיה', () => assert.equal(combinedOrderNotes({ notes: 'לקוחה תאסוף בבוקר' }), 'לקוחה תאסוף בבוקר'));
t('רק orderNotes (הזמנה מהייבוא) -> מודפס', () => assert.equal(combinedOrderNotes({ notes: null, orderNotes: 'תחתית חום' }), 'תחתית חום'));
t('orderNotes שהוא רק חותמת "חתמו על התקנון" -> לא מודפס', () => {
  assert.equal(combinedOrderNotes({ notes: null, orderNotes: 'חתמו על התקנון' }), '');
  assert.equal(combinedOrderNotes({ notes: '', orderNotes: '  חתמו על התקנון  ' }), '');
});
t('חותמת + הערה אמיתית -> נשארת ההערה בלבד', () => {
  assert.equal(combinedOrderNotes({ orderNotes: 'תחתית חום   חתמו על התקנון' }), 'תחתית חום');
  assert.equal(combinedOrderNotes({ orderNotes: 'תחתית-שחור   חתמו על התקנון' }), 'תחתית-שחור');
  assert.equal(combinedOrderNotes({ orderNotes: 'חתמו על התקנון תחתית חום' }), 'תחתית חום');
  assert.equal(combinedOrderNotes({ orderNotes: 'הזמנה טלפונית' }), 'הזמנה טלפונית');
});
t('שני השדות -> מאוחדים', () => assert.equal(combinedOrderNotes({ notes: 'לתאם משלוח', orderNotes: 'תחתית ירוק' }), 'לתאם משלוח | תחתית ירוק'));
t('אותה הערה בשני השדות -> פעם אחת', () => {
  assert.equal(combinedOrderNotes({ notes: 'תחתית ירוק', orderNotes: 'תחתית ירוק' }), 'תחתית ירוק');
  assert.equal(combinedOrderNotes({ notes: 'לתאם משלוח. תחתית ירוק', orderNotes: 'תחתית ירוק' }), 'לתאם משלוח. תחתית ירוק');
});
t('טקסט שאינו מחרוזת לא קורס', () => {
  assert.equal(combinedOrderNotes({ notes: 5, orderNotes: {} }), '');
  assert.equal(legacyOrderNotesText(undefined), '');
});
console.log(`\n${pass} passed${fail ? ', FAILURES' : ''}`);
process.exit(fail ? 1 : 0);
