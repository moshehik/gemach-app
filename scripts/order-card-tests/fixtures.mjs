// מצבי הזמנה לבדיקות הכרטיס החדש (בלי DB). baseOrder דומה לתשובת GET /api/orders/[id].
export const CUSTOMER = { id: 'c1', firstName: 'מרים', lastName: 'אברמוביץ', phone1: '050-7123456', email: 'm@example.com', city: 'ירושלים', street: 'הנביאים', houseNum: 3, zeout: '' };

export function baseOrder(over = {}) {
  return {
    id: 'o-uuid-1', orderId: 53375, customerId: 'c1', customer: { ...CUSTOMER },
    orderDate: '2026-09-23T07:12:00.000Z', eventDate: '2026-10-07T21:00:00.000Z', eventDateHebrew: 'כ״ו תשרי תשפ״ז',
    returnDate: null, isAbroad: false, fromDate: null, toDate: null, customSpacing: null,
    extraDay: null, notes: 'הערה', internalNotes: '', isDelivery: false, deliveryDirection: null, deliveryAddress: null,
    deliveryCity: null, deliveryOneDayBefore: false, status: null, hasSignedRegulations: false, isDeleted: false,
    totalAmount: 300, updatedAt: '2026-10-01T10:00:00.000Z',
    ...over,
  };
}

export const item = (id, over = {}) => ({
  id, orderId: 53375, dressItemId: `di-${id}`, dressItem: { id: `di-${id}`, dressModelId: 'm1', dress: { id: 'm1', name: '4512' } },
  sizeText: '38', price: 150, finalPrice: 150, isDeleted: false, deletedAt: null, isTaken: false, isReturned: false,
  neckAlteration: 0, sleeveAlteration: 0, lengthAlteration: '', alterationDetails: '', alterationDone: false, ...over,
});
export const obligation = (id, over = {}) => ({ id, orderId: 53375, amount: 150, description: 'השכרת שמלה דגם 4512 מידה 38 (פריט #a1)', isManual: false, isDeleted: false, orderItemId: 'a1', ...over });
export const payment = (id, over = {}) => ({ id, orderId: 53375, amount: 100, paymentMethod: 'מזומן', isDeleted: false, ...over });

export function baseState(over = {}) {
  const order = baseOrder(over.order);
  const items = over.items || [item('a1'), item('a2', { sizeText: '40' })];
  const obligations = over.obligations || [obligation('ob1'), obligation('ob2', { orderItemId: 'a2', description: 'השכרת שמלה דגם 4512 מידה 40 (פריט #a2)' })];
  const payments = over.payments || [payment('p1')];
  const refunds = over.refunds || [];
  return { order, items, obligations, payments, refunds };
}

// 20 מצבים שונים לבדיקת זוגיות ה-PUT (כל אחד: state + אפשרויות האישור)
export function payloadStates() {
  const S = [];
  const push = (name, st, opts = {}) => S.push({ name, st, opts });
  push('basic', baseState());
  push('abroad range', baseState({ order: { isAbroad: true, fromDate: '2026-10-05T21:00:00.000Z', toDate: '2026-10-12T21:00:00.000Z', eventDate: null } }));
  push('customSpacing undefined', baseState({ order: { customSpacing: undefined } }));
  push('customSpacing 2', baseState({ order: { customSpacing: 2 } }));
  push('notes + internal notes', baseState({ order: { notes: 'שורה\nשנייה', internalNotes: 'פנימי "בגרש"' } }));
  push('delivery both', baseState({ order: { isDelivery: true, deliveryDirection: 'הלוך-חזור', deliveryCity: 'בית שמש', deliveryAddress: 'רחוב 1', deliveryOneDayBefore: true } }));
  push('signed + status', baseState({ order: { hasSignedRegulations: true, status: 'שולם' } }));
  push('extraDay after', baseState({ order: { isAbroad: true, fromDate: '2026-10-05', toDate: '2026-10-07', extraDay: 'after' } }));
  push('extraDay missing from GET', baseState({ order: { extraDay: undefined } }));
  push('deleted item pending', baseState({ items: [item('a1'), item('a2', { isDeleted: true })] }));
  push('local new item', baseState({ items: [item('a1'), { _localId: 'L1', dressModelId: 'm2', sizeText: '42', price: 120, finalPrice: 0 }] }));
  push('items sum zero -> obligations', baseState({ items: [item('a1', { price: 0, finalPrice: 0 })] }));
  push('items+obligations zero -> order total', baseState({ items: [item('a1', { price: 0, finalPrice: 0 })], obligations: [obligation('ob1', { amount: 0 })] }));
  push('string prices', baseState({ items: [item('a1', { price: '99.5', finalPrice: '' })] }));
  push('manual obligation + deleted payment', baseState({ obligations: [obligation('ob1'), { amount: 30, description: 'חיוב ידני', isManual: true, isDeleted: false }], payments: [payment('p1', { isDeleted: true })] }));
  push('debt approved', baseState(), { debtApprovedBy: 'e7' });
  push('manager auth (item cancel)', baseState({ items: [item('a1'), item('a2', { isDeleted: true })] }), { managerAuth: { employeeId: 'm1', pin: 'x' } });
  push('order date approval (legacy only)', baseState(), { orderDateApproval: { employeeId: 'p2', pin: 'y' } });
  push('no customer / nulls', baseState({ order: { customerId: null, customer: null, eventDate: null, notes: null } }));
  return S;
}
